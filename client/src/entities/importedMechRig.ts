import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { MechRig, RigJoint } from './MechBase';

/**
 * Nó de rig sobre um osso importado (glTF/Mixamo): guarda a rotação de repouso e, na primeira leitura,
 * calcula em que eixo LOCAL desse osso caem os eixos X/Y do MUNDO. Sem isso, `rotation.x = valor` (o que
 * toda animação em `MechBase.ts` sempre assumiu) giraria o osso no eixo que o exportador escolheu pra ele —
 * quase nunca o mesmo "pra frente" que o resto do jogo usa. Achado construindo o protótipo: girar direto
 * o osso Mixamo por um ângulo "absoluto" chutado fazia a perna sumir de quadro (girava pro lado errado).
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

  constructor(private readonly bone: THREE.Object3D) {
    bone.updateWorldMatrix(true, false);
    const worldQuat = bone.getWorldQuaternion(new THREE.Quaternion());
    const inv = worldQuat.clone().invert();
    this.restQuat = bone.quaternion.clone();
    this.localXAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(inv).normalize();
    this.localYAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(inv).normalize();
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
  /** Nomes alternativos de osso, pra malhas que não seguem a convenção `mixamorig:`. */
  boneNames?: Partial<Record<keyof typeof DEFAULT_BONES, string>>;
}

/**
 * Sem dois-pontos: o `GLTFLoader` sanitiza nome de nó com `PropertyBinding.sanitizeNodeName` (tira
 * `:`, `.`, `[`, `]`, `/` — caracteres com sentido especial no path de uma trilha de animação) antes
 * de expor `.name`. O arquivo exportado ainda tem "mixamorig:Hips" no JSON cru; só depois de carregado
 * no Three.js é que vira "mixamorigHips". Achado depurando o primeiro carregamento real no dev server.
 */
const DEFAULT_BONES = {
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

/**
 * Carrega um `.glb` com esqueleto (skin) e devolve um `MechRig` no mesmo contrato de
 * `buildMechBlueprintRig` — `MechBase` não sabe (nem precisa saber) que a malha veio de fora.
 * G4/G5: só roda na montagem do rig, nunca no quadro/tick; o custo de carregar o arquivo é do
 * `loadAsync`, não deste código.
 */
export async function loadImportedMechRig(url: string, options: ImportedRigOptions): Promise<MechRig> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  model.updateMatrixWorld(true);

  const names = { ...DEFAULT_BONES, ...options.boneNames };
  const bones = new Map<string, THREE.Object3D>();
  model.traverse((o) => { if ((o as THREE.Bone).isBone) bones.set(o.name, o); });
  const find = (key: keyof typeof DEFAULT_BONES): THREE.Object3D => {
    const bone = bones.get(names[key]);
    if (!bone) throw new Error(`rig importado: osso "${names[key]}" não encontrado (chave ${key})`);
    return bone;
  };

  const hips = find('hips');
  const headBone = find('head');
  const rightHand = find('rightHand');
  const leftHand = find('leftHand');

  // Altura de repouso (pé ao topo da caixa): escala pra bater com a stat do chassi e apoia em y=0,
  // mesma convenção do procedural (mechBlueprint.test.ts cobra boxes.min.y ≈ 0).
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = options.targetHeight / size.y;
  model.scale.setScalar(scale);
  model.position.y -= box.min.y * scale;
  model.updateMatrixWorld(true);

  const muzzle = new THREE.Object3D();
  rightHand.add(muzzle);
  muzzle.position.set(0, 0.1, 0.06);
  const leftMuzzle = new THREE.Object3D();
  leftHand.add(leftMuzzle);
  leftMuzzle.position.set(0, 0.1, 0.06);

  const hullMaterials: THREE.MeshStandardMaterial[] = [];
  model.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const mats = Array.isArray((o as THREE.Mesh).material) ? (o as THREE.Mesh).material as THREE.Material[] : [(o as THREE.Mesh).material as THREE.Material];
    for (const m of mats) if (m instanceof THREE.MeshStandardMaterial) hullMaterials.push(m);
  });

  return {
    model,
    pelvis: hips,
    torso: new AxisCorrectedJoint(find('torso')),
    head: headBone,
    leftArm: new AxisCorrectedJoint(find('leftArm')),
    rightArm: new AxisCorrectedJoint(find('rightArm')),
    leftLeg: { hip: new AxisCorrectedJoint(find('leftUpLeg')), knee: new AxisCorrectedJoint(find('leftLowerLeg')) },
    rightLeg: { hip: new AxisCorrectedJoint(find('rightUpLeg')), knee: new AxisCorrectedJoint(find('rightLowerLeg')) },
    muzzle,
    leftMuzzle,
    thrusters: [],
    // Sem apêndice do casco (mochila/propulsor) na malha importada ainda; array vazio é um chassi sem
    // efeito de exaustão, não um erro.
    thrusterMaterial: hullMaterials[0] ?? new THREE.MeshStandardMaterial(),
    hullMaterials,
    hipHeight: hips.position.y,
  };
}
