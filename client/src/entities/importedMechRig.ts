import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import type { MechRig, RigJoint } from './MechBase';
import { createWeaponMounts } from './weaponMount';

const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);

/**
 * Gira `bone` em torno do pivô dele por `offset`, dado no referencial do Mech (`frameQuat`), e não no do osso;
 * os filhos acompanham. É a conta de re-posar um osso exportado em outra pose (T-pose) antes de ele virar o repouso.
 * local' = P⁻¹ · (F · offset · F⁻¹) · P · local.
 */
function poseInFrame(bone: THREE.Object3D, frameQuat: THREE.Quaternion, offset: THREE.Quaternion): void {
  bone.updateWorldMatrix(true, false);
  const parentQuat = bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  const world = frameQuat.clone().multiply(offset).multiply(frameQuat.clone().invert());
  bone.quaternion.premultiply(parentQuat.clone().invert().multiply(world).multiply(parentQuat));
}

/**
 * Nó de rig sobre um osso importado (glTF/Mixamo): guarda a rotação de repouso e, na primeira leitura,
 * calcula em que eixo LOCAL desse osso caem os eixos X/Y do MECH. Sem isso, `rotation.x = valor` (o que
 * toda animação em `MechBase.ts` sempre assumiu) giraria o osso no eixo que o exportador escolheu pra ele —
 * quase nunca o mesmo "pra frente" que o resto do jogo usa. Achado construindo o protótipo: girar direto
 * o osso Mixamo por um ângulo "absoluto" chutado fazia a perna sumir de quadro (girava pro lado errado).
 *
 * `frame` é o referencial do Mech: o grupo que o jogo gira pelo yaw (`MechRig.model`), com a frente em -Z.
 * **Nunca** passe a cena importada já girada por `rotationY`: ela é o referencial do ARQUIVO (frente em
 * +Z), e medir os eixos nela inverte o sentido de toda a animação (a perna balança para trás, o joelho
 * dobra para a frente e a mira abaixa o braço quando o jogador olha para cima). Foi o "anda de costas" do
 * Marauder, e valia para os quatro chassis importados.
 *
 * `restOffset` (opcional) re-posa o osso, no referencial do Mech, ANTES de congelar o repouso: serve para
 * malhas exportadas em T-pose, cujos braços abertos nunca sairiam do lugar com a mira (girar um braço
 * horizontal em X é só rolar o braço sobre si mesmo).
 */
export class AxisCorrectedJoint implements RigJoint {
  readonly position: THREE.Vector3;
  private readonly restQuat: THREE.Quaternion;
  private readonly localXAxis: THREE.Vector3;
  private readonly localYAxis: THREE.Vector3;
  private readonly qx = new THREE.Quaternion();
  private readonly qy = new THREE.Quaternion();
  private angleX = 0;
  private angleY = 0;
  readonly rotation: { x: number; y: number };

  constructor(private readonly bone: THREE.Object3D, frame: THREE.Object3D, restOffset?: THREE.Quaternion) {
    frame.updateWorldMatrix(true, false);
    const frameQuat = frame.getWorldQuaternion(new THREE.Quaternion());

    if (restOffset) poseInFrame(bone, frameQuat, restOffset);

    bone.updateWorldMatrix(true, false);
    const worldQuat = bone.getWorldQuaternion(new THREE.Quaternion());
    const inv = worldQuat.clone().invert();
    this.restQuat = bone.quaternion.clone();

    const frameX = _axisX.clone().applyQuaternion(frameQuat);
    const frameY = _axisY.clone().applyQuaternion(frameQuat);

    this.localXAxis = frameX.applyQuaternion(inv).normalize();
    this.localYAxis = frameY.applyQuaternion(inv).normalize();
    this.position = bone.position;
    const self = this;
    this.rotation = {
      get x() { return self.angleX; },
      set x(v: number) { self.angleX = v; self.apply(); },
      get y() { return self.angleY; },
      set y(v: number) { self.angleY = v; self.apply(); },
    };
  }

  private apply(): void {
    this.qx.setFromAxisAngle(this.localXAxis, this.angleX);
    this.qy.setFromAxisAngle(this.localYAxis, this.angleY);
    this.bone.quaternion.copy(this.restQuat).multiply(this.qy).multiply(this.qx);
  }

  get name(): string { return this.bone.name; }
  set name(v: string) { this.bone.name = v; }

  get visible(): boolean { return this.bone.visible; }
  set visible(v: boolean) {
    // Achado (30/09): virar .visible num osso não esconde nada — a malha é uma peça só, ligada ao
    // esqueleto por peso de pele, não por hierarquia de objetos renderizáveis. "Parte destruída some"
    // não funciona ainda pra rig importado; fica registrado como lacuna conhecida, não corrigido aqui.
    this.bone.visible = v;
  }

  getWorldPosition(target: THREE.Vector3): THREE.Vector3 { return this.bone.getWorldPosition(target); }
  localToWorld(target: THREE.Vector3): THREE.Vector3 { return this.bone.localToWorld(target); }
}

export interface ImportedRigOptions {
  /** Altura alvo (m); a malha (no bind pose) é escalada e apoiada em y=0. */
  targetHeight: number;
  /** Rotação extra em radianos no eixo Y da malha inteira, para alinhar a frente (padrão: 0). */
  rotationY?: number;
  /** Nomes alternativos de osso, pra malhas que não seguem a convenção `mixamorig:`. */
  boneNames?: Partial<Record<keyof typeof DEFAULT_BONES, string>>;
  /**
   * Só para malha exportada em T-pose (braços abertos): baixa os braços `lower` radianos (90° = pendurados) e
   * os leva `forward` radianos para a frente. `elbow` (opcional) dobra o antebraço para a frente por mais
   * tantos radianos: com ~90° menos o `forward` o antebraço fica na horizontal, na pose de arma em punho. O
   * lado de cada braço sai da geometria (de que lado do Mech a mão está), não do nome do osso.
   */
  armRest?: { lower: number; forward: number; elbow?: number };
  /**
   * Encaixes de arma nos pulsos (`weaponMount.ts`): esconde as mãos e os dedos e monta, em cada braço, o módulo
   * da arma da montagem (`MechRig.mountWeapons`). Para malha SEM arma desenhada; quem já traz a arma no modelo
   * (Gênesis, Bastion) não liga isto.
   */
  weaponMounts?: boolean;
}

/**
 * Sem dois-pontos: o `GLTFLoader` sanitiza nome de nó com `PropertyBinding.sanitizeNodeName` (tira
 * `:`, `.`, `[`, `]`, `/` — caracteres com sentido especial no path de uma trilha de animação) antes
 * de expor `.name`. O arquivo exportado ainda tem "mixamorig:Hips" no JSON cru; só depois de carregado
 * no Three.js é que vira "mixamorigHips". Achado depurando o primeiro carregamento real no dev server.
 */
export const DEFAULT_BONES = {
  hips: 'mixamorigHips',
  head: 'mixamorigHead',
  torso: 'mixamorigSpine1',
  leftArm: 'mixamorigLeftArm',
  rightArm: 'mixamorigRightArm',
  leftUpLeg: 'mixamorigLeftUpLeg',
  leftLowerLeg: 'mixamorigLeftLeg',
  rightUpLeg: 'mixamorigRightUpLeg',
  rightLowerLeg: 'mixamorigRightLeg',
  leftHand: 'mixamorigLeftHand',
  rightHand: 'mixamorigRightHand',
} as const;

/** Malha já carregada, escalada e apoiada em y=0 — pronta pra clonar sem custo de rede/parse de novo. */
export interface ImportedMechAsset {
  readonly scene: THREE.Object3D;
  readonly boneNames: Record<keyof typeof DEFAULT_BONES, string>;
  readonly hipHeight: number;
  readonly naturalHeight: number;
  readonly naturalMinY: number;
  readonly armRest?: ImportedRigOptions['armRest'];
  readonly weaponMounts?: boolean;
}

/**
 * Busca e prepara o arquivo uma vez só (fetch, `GLTFLoader`, escala pra bater com a stat, apoio em
 * y=0) — a parte cara e assíncrona. G4/G5: nunca chame isto no quadro/tick; chame uma vez por chassi
 * (`importedMechAssets.ts` cacheia) e depois use `instantiateImportedMechRig` pra cada Mech novo.
 */
export async function preloadImportedMechAsset(url: string, options: ImportedRigOptions): Promise<ImportedMechAsset> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);

  const names = { ...DEFAULT_BONES, ...options.boneNames };
  const found = new Set<string>();
  scene.traverse((o) => { if ((o as THREE.Bone).isBone) found.add(o.name); });
  for (const key of Object.keys(names) as (keyof typeof DEFAULT_BONES)[]) {
    if (!found.has(names[key])) throw new Error(`rig importado: osso "${names[key]}" não encontrado (chave ${key})`);
  }

  const box = new THREE.Box3();
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) box.expandByObject(o);
  });
  if (box.isEmpty()) throw new Error(`rig importado: nenhuma malha encontrada no modelo`);
  const size = box.getSize(new THREE.Vector3());
  
  if (options.rotationY) scene.rotation.y = options.rotationY;
  scene.updateMatrixWorld(true);

  let hipHeight = 0;
  scene.traverse((o) => { if (o.name === names.hips) hipHeight = o.position.y; });

  return { scene, boneNames: names, hipHeight, naturalHeight: size.y, naturalMinY: box.min.y, armRest: options.armRest, weaponMounts: options.weaponMounts };
}

/**
 * Rotação de repouso (no referencial do Mech) que baixa e adianta um braço de malha em T-pose. `undefined` se não
 * há `armRest` ou se o braço não está aberto para o lado (o osso já vem pendurado: não se mexe).
 */
function armRestOffset(arm: THREE.Object3D, hand: THREE.Object3D, frame: THREE.Object3D, rest: ImportedRigOptions['armRest']): THREE.Quaternion | undefined {
  if (!rest) return undefined;
  frame.updateMatrixWorld(true);
  const d = hand.getWorldPosition(new THREE.Vector3()).sub(arm.getWorldPosition(new THREE.Vector3()));
  d.applyQuaternion(frame.getWorldQuaternion(new THREE.Quaternion()).invert());
  if (Math.abs(d.x) < 0.8 * d.length()) return undefined;
  const lower = new THREE.Quaternion().setFromAxisAngle(_axisZ, -Math.sign(d.x) * rest.lower);
  const forward = new THREE.Quaternion().setFromAxisAngle(_axisX, rest.forward);
  return forward.multiply(lower);
}

/**
 * Clona o protótipo (síncrono, rápido — `SkeletonUtils.clone` duplica ossos e peso de pele) e monta
 * um `MechRig` novo. Cada chamada é um Mech independente: material clonado por instância, senão o
 * flash de dano de um clone acenderia todos os outros juntos (`SkeletonUtils.clone` não clona
 * material — comportamento normal do Three.js, pensado pra instância compartilhar aparência, não
 * pra Mechs com vida própria).
 */
export function instantiateImportedMechRig(asset: ImportedMechAsset, targetHeight: number): MechRig {
  const clonedScene = cloneSkeleton(asset.scene);
  
  // Envolve o clone num grupo e escala o grupo. Evita bugs de skinning do SkeletonUtils
  // quando se clona uma cena já escalada (comum em rigs do Tripo3D).
  const model = new THREE.Group();
  model.add(clonedScene);
  const scale = targetHeight / asset.naturalHeight;
  model.scale.setScalar(scale);
  clonedScene.position.y -= asset.naturalMinY;
  model.updateMatrixWorld(true);

  const names = asset.boneNames;
  const bones = new Map<string, THREE.Object3D>();
  model.traverse((o) => { if ((o as THREE.Bone).isBone) bones.set(o.name, o); });
  const find = (key: keyof typeof DEFAULT_BONES): THREE.Object3D => {
    let bone = bones.get(names[key]);
    if (!bone) {
      // Fallback inteligente: procura por substring e pega a mais curta (para evitar Twist bones)
      const search = names[key].replace('mixamorig:', '').replace('mixamorig', '');
      const matches = Array.from(bones.keys()).filter(k => k.includes(search));
      matches.sort((a, b) => a.length - b.length);
      const foundName = matches[0];
      if (foundName) bone = bones.get(foundName);
    }
    if (!bone) {
      console.error(`Bones disponíveis:`, Array.from(bones.keys()));
      throw new Error(`rig importado: osso "${names[key]}" sumiu (chave ${key}). Fallback falhou.`);
    }
    return bone;
  };

  const hips = find('hips');
  const headBone = find('head');
  const rightHand = find('rightHand');
  const leftHand = find('leftHand');

  const muzzle = new THREE.Object3D();
  rightHand.add(muzzle);
  muzzle.position.set(0, 0.1, 0.06);
  const leftMuzzle = new THREE.Object3D();
  leftHand.add(leftMuzzle);
  leftMuzzle.position.set(0, 0.1, 0.06);

  let hasSkinnedMesh = false;
  model.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) hasSkinnedMesh = true; });

  const hullMaterials: THREE.MeshStandardMaterial[] = [];
  model.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    
    // Hide static meshes if the model has skinned meshes (e.g., duplicate T-pose in Marauder)
    if (hasSkinnedMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh) {
      o.visible = false;
    }

    const mesh = o as THREE.Mesh;
    const wasArray = Array.isArray(mesh.material);
    const mats = (wasArray ? mesh.material as THREE.Material[] : [mesh.material as THREE.Material])
      .map((m) => (m instanceof THREE.MeshStandardMaterial ? m.clone() : m));
    mesh.material = wasArray ? mats : mats[0]!;
    for (const m of mats) if (m instanceof THREE.MeshStandardMaterial) hullMaterials.push(m);
  });


  
  const useAxisCorrection = true; // Habilita para todos: Mixamo e Tripo precisam normalizar o eixo X/Y local.
  
  // O referencial dos eixos é o do Mech (`model`, que o jogo gira pelo yaw), nunca `clonedScene` (girada por rotationY).
  const createJoint = (b: THREE.Object3D, restOffset?: THREE.Quaternion): RigJoint => {
    if (useAxisCorrection) return new AxisCorrectedJoint(b, model, restOffset);
    return {
      name: b.name,
      rotation: b.rotation as unknown as { x: number; y: number },
      position: b.position,
      get visible() { return b.visible; },
      set visible(v) { b.visible = v; },
      getWorldPosition: (t) => b.getWorldPosition(t),
      localToWorld: (t) => b.localToWorld(t),
    };
  };

  const torso = createJoint(find('torso'));
  const leftArmBone = find('leftArm');
  const rightArmBone = find('rightArm');
  const leftRest = armRestOffset(leftArmBone, leftHand, model, asset.armRest);
  const rightRest = armRestOffset(rightArmBone, rightHand, model, asset.armRest);
  const leftArm = createJoint(leftArmBone, leftRest);
  const rightArm = createJoint(rightArmBone, rightRest);
  // Pose de arma em punho: o antebraço (pai da mão) dobra para a frente depois de o ombro baixar o braço.
  const elbow = asset.armRest?.elbow;
  if (elbow) {
    const frameQuat = model.getWorldQuaternion(new THREE.Quaternion());
    const bend = new THREE.Quaternion().setFromAxisAngle(_axisX, elbow);
    for (const [arm, hand, rest] of [[leftArmBone, leftHand, leftRest], [rightArmBone, rightHand, rightRest]] as const) {
      if (rest && hand.parent && hand.parent !== arm) poseInFrame(hand.parent, frameQuat, bend);
    }
  }
  const mountWeapons = asset.weaponMounts
    ? createWeaponMounts(
        model,
        { forearm: rightHand.parent!, hand: rightHand, muzzle },
        { forearm: leftHand.parent!, hand: leftHand, muzzle: leftMuzzle },
      )
    : undefined;

  return {
    model,
    pelvis: hips,
    torso,
    head: headBone,
    leftArm,
    rightArm,
    leftLeg: { hip: createJoint(find('leftUpLeg')), knee: createJoint(find('leftLowerLeg')) },
    rightLeg: { hip: createJoint(find('rightUpLeg')), knee: createJoint(find('rightLowerLeg')) },
    muzzle,
    leftMuzzle,
    thrusters: [],
    thrusterMaterial: hullMaterials[0] ?? new THREE.MeshStandardMaterial(),
    hullMaterials,
    hipHeight: asset.hipHeight,
    mountWeapons,
  };
}

/** Atalho pra quem só precisa de um rig de uma vez (scripts de depuração, teste manual). */
export async function loadImportedMechRig(url: string, options: ImportedRigOptions): Promise<MechRig> {
  return instantiateImportedMechRig(await preloadImportedMechAsset(url, options), options.targetHeight);
}
