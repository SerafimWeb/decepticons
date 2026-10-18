import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { AxisCorrectedJoint } from './importedMechRig';
import { advancePhase, LEG_IDS, newWalkerPose, WALKER_SCALE, walkerPose, type LegId, type WalkerPose } from './walkerGait';

/**
 * O DESENHO DO DRAGA-01 (ordem P180, `AMAZONIA.md` § 4): a malha riggada do Comandante (`client/public/models/draga-01.glb`, feita por `scripts/blender/rig-walker.py` a partir do
 * "heavy industrial walker 3d model"), com 18 ossos e pele rígida por parte, movida pela marcha pura de `walkerGait.ts`. **Só desenho, só do cliente** (o servidor nunca carrega
 * `.glb`, G14): a simulação vê um corpo com os números dele e este grupo segue a posição e o rumo dele.
 *
 * O referencial é o do Mech: o `root` tem a frente em **-Z**, a direita em +X, e a cena importada (frente em +Z no arquivo) vai girada meia-volta dentro dele. As juntas giram em torno
 * dos eixos desse referencial (`AxisCorrectedJoint`, a mesma correção dos robôs importados), então a pose independe de como o Blender orientou cada osso.
 *
 * **Custo:** um desenho (uma malha com pele, ~27 mil triângulos, 18 ossos) e nenhum objeto novo por quadro. A carga (`loadWalkerAsset`) é assíncrona e vem uma vez; `new WalkerVisual`
 * clona o esqueleto (uma instância por Draga).
 */

export const WALKER_URL = `${import.meta.env.BASE_URL}models/draga-01.glb`;

export interface WalkerAsset {
  /** A cena do arquivo (frente em +Z, pés em y = 0, o centro de apoio dos pés na origem). */
  scene: THREE.Group;
  /** A altura da malha no arquivo (unidades dele). */
  naturalHeight: number;
  naturalMinY: number;
}

/** Lê o `.glb` já em memória (o teste e o `loadWalkerAsset` passam por aqui). Falha com mensagem clara se faltar um osso. */
export async function parseWalkerGlb(data: ArrayBuffer): Promise<WalkerAsset> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); // sob demanda (dieta de JS)
  const gltf = await new GLTFLoader().parseAsync(data, '');
  const scene = gltf.scene;
  const bones = new Set<string>();
  scene.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.add(o.name);
  });
  for (const nome of WALKER_BONES) {
    if (!bones.has(nome)) throw new Error(`Draga-01: osso "${nome}" não encontrado no arquivo`);
  }
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) box.expandByObject(o);
  });
  if (box.isEmpty()) throw new Error('Draga-01: nenhuma malha no arquivo');
  return { scene, naturalHeight: box.max.y - box.min.y, naturalMinY: box.min.y };
}

/** Busca e prepara o arquivo uma vez só (G4/G5: nunca no quadro nem no tick). */
export async function loadWalkerAsset(url: string = WALKER_URL): Promise<WalkerAsset> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Draga-01: ${url} respondeu ${r.status}`);
  return parseWalkerGlb(await r.arrayBuffer());
}

/** Os 18 ossos do arquivo (o contrato do script de Blender). */
export const WALKER_BONES: readonly string[] = [
  'raiz', 'casco', 'deck', 'guindaste_esq', 'guindaste_dir', 'radar',
  ...(['fl', 'fr', 'rl', 'rr'] as const).flatMap((l) => [`${l}_coxa`, `${l}_canela`, `${l}_pe`]),
];

const _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();

/**
 * O casco: arfa (em torno de X do Mech), rola (em torno de Z) e desce. `AxisCorrectedJoint` só tem X e Y, e o casco precisa da rolagem e do afundamento (perna caída), então
 * este é o mesmo cálculo com os três eixos do Mech e o deslocamento para baixo.
 */
class HullJoint {
  private readonly restQuat: THREE.Quaternion;
  private readonly restPos: THREE.Vector3;
  private readonly axisX: THREE.Vector3;
  private readonly axisZ: THREE.Vector3;
  private readonly up: THREE.Vector3;
  private readonly qx = new THREE.Quaternion();
  private readonly qz = new THREE.Quaternion();

  constructor(private readonly bone: THREE.Object3D, frame: THREE.Object3D) {
    frame.updateWorldMatrix(true, false);
    const frameQuat = frame.getWorldQuaternion(new THREE.Quaternion());
    bone.updateWorldMatrix(true, false);
    const parentInv = (bone.parent ?? bone).getWorldQuaternion(new THREE.Quaternion()).invert();
    this.restQuat = bone.quaternion.clone();
    this.restPos = bone.position.clone();
    this.axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(frameQuat).applyQuaternion(parentInv).normalize();
    this.axisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(frameQuat).applyQuaternion(parentInv).normalize();
    this.up = _up.clone().applyQuaternion(frameQuat).applyQuaternion(parentInv).normalize();
  }

  /** `rx`, `rz` em rad (no referencial do Mech); `dropM` em metros para baixo. */
  set(rx: number, rz: number, dropM: number): void {
    this.qx.setFromAxisAngle(this.axisX, rx);
    this.qz.setFromAxisAngle(this.axisZ, rz);
    this.bone.quaternion.copy(this.restQuat).multiply(_q.copy(this.qx).multiply(this.qz));
    this.bone.position.copy(this.restPos).addScaledVector(this.up, -dropM / WALKER_SCALE);
  }
}

/** Uma perna do rig: as três juntas e o sinal (medido na carga) em que a dobra do joelho levanta o pé. */
interface LegJoints {
  hip: AxisCorrectedJoint;
  knee: AxisCorrectedJoint;
  ankle: AxisCorrectedJoint;
  /** +1 ou -1: o sinal de `knee.rotation.x` que levanta o pé (medido: sobe o tornozelo). */
  liftSign: number;
  footBone: THREE.Object3D;
  swinging: boolean;
}

export class WalkerVisual {
  /** O grupo do Mech (frente -Z): quem usa o põe na cena e o move/gira pelo yaw. */
  readonly root = new THREE.Group();
  /** A fase do ciclo da marcha (0 a 1). */
  phase = 0;
  /** O tempo visual (s): guindastes e radar. */
  time = 0;
  /** A queda de cada perna (0 de pé, 1 caída): quem manda é a simulação. */
  readonly collapse: Record<LegId, number> = { fl: 0, fr: 0, rl: 0, rr: 0 };
  /** O giro do convés sobre o casco (rad): para onde o Draga mira. */
  deckYaw = 0;
  /** Chamado quando um pé pousa (o fim do balanço): o som e a poeira são de quem usa. */
  onFootstep?: (leg: LegId, world: THREE.Vector3) => void;

  private readonly legs = {} as Record<LegId, LegJoints>;
  private readonly hull: HullJoint;
  private readonly deck: AxisCorrectedJoint;
  private readonly radar: AxisCorrectedJoint;
  private readonly craneLeft: AxisCorrectedJoint;
  private readonly craneRight: AxisCorrectedJoint;
  private readonly pose: WalkerPose = newWalkerPose();
  private readonly _foot = new THREE.Vector3();
  readonly material: THREE.MeshStandardMaterial;

  constructor(asset: WalkerAsset) {
    const scene = cloneSkeleton(asset.scene) as THREE.Group;
    scene.rotation.y = Math.PI; // o arquivo olha para +Z; o Mech, para -Z
    scene.position.y -= asset.naturalMinY; // pés em y = 0 (o arquivo já vem apoiado; o mínimo é ~0)
    this.root.add(scene);
    this.root.scale.setScalar(WALKER_SCALE);
    this.root.updateMatrixWorld(true);

    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.62 });
    scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        m.material = this.material;
        m.frustumCulled = false; // a malha é do tamanho do mapa e a caixa de pele em repouso não acompanha a pose
        m.castShadow = false;
        m.receiveShadow = false;
      }
    });

    const bones = new Map<string, THREE.Object3D>();
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.set(o.name, o);
    });
    const osso = (nome: string): THREE.Object3D => {
      const b = bones.get(nome);
      if (!b) throw new Error(`Draga-01: osso "${nome}" sumiu`);
      return b;
    };
    this.hull = new HullJoint(osso('casco'), this.root);
    this.deck = new AxisCorrectedJoint(osso('deck'), this.root);
    this.radar = new AxisCorrectedJoint(osso('radar'), this.root);
    this.craneLeft = new AxisCorrectedJoint(osso('guindaste_esq'), this.root);
    this.craneRight = new AxisCorrectedJoint(osso('guindaste_dir'), this.root);
    for (const id of LEG_IDS) {
      const ankleBone = osso(`${id}_pe`);
      const j: LegJoints = {
        hip: new AxisCorrectedJoint(osso(`${id}_coxa`), this.root),
        knee: new AxisCorrectedJoint(osso(`${id}_canela`), this.root),
        ankle: new AxisCorrectedJoint(ankleBone, this.root),
        liftSign: 1,
        footBone: ankleBone,
        swinging: false,
      };
      this.legs[id] = j;
    }
    this.calibrate();
  }

  /** Mede, em cada perna, para que lado gira o joelho que **levanta o pé** (o sinal depende de a perna dobrar para a frente ou para trás). */
  private calibrate(): void {
    const p = new THREE.Vector3();
    for (const id of LEG_IDS) {
      const j = this.legs[id];
      this.root.updateMatrixWorld(true);
      const y0 = j.footBone.getWorldPosition(p).y;
      j.knee.rotation.x = 0.2;
      this.root.updateMatrixWorld(true);
      const y1 = j.footBone.getWorldPosition(p).y;
      j.knee.rotation.x = 0;
      j.liftSign = y1 >= y0 ? 1 : -1;
    }
    this.root.updateMatrixWorld(true);
  }

  /** O sinal medido do joelho de uma perna (o teste confere que levantar é subir o tornozelo). */
  liftSignOf(id: LegId): number {
    return this.legs[id].liftSign;
  }

  /** A posição do pé de uma perna no mundo (para a poeira e o som do passo). Escreve em `out`. */
  footWorld(id: LegId, out: THREE.Vector3): THREE.Vector3 {
    return this.legs[id].footBone.getWorldPosition(out);
  }

  /** Um quadro: anda a fase com a velocidade, calcula a pose e a escreve nos ossos. `speedMs` é a velocidade do casco (m/s). */
  update(dt: number, speedMs: number, maxSpeedMs = 3.5): void {
    this.time += dt;
    this.phase = advancePhase(this.phase, speedMs, dt);
    walkerPose(this.phase, speedMs / maxSpeedMs, this.collapse, this.deckYaw, this.time, this.pose);
    this.apply(this.pose);
  }

  /** Escreve uma pose já calculada nos ossos (a bancada e o teste usam direto). */
  apply(pose: WalkerPose): void {
    this.hull.set(-pose.pitch, pose.roll, pose.bodyDrop);
    for (const id of LEG_IDS) {
      const j = this.legs[id];
      const l = pose.legs[id];
      const knee = j.liftSign * (l.lift + l.fold);
      j.hip.rotation.x = l.hip;
      j.knee.rotation.x = knee;
      j.ankle.rotation.x = -(l.hip + knee); // o pé fica chato no chão
      const swinging = l.lift > 0.02;
      if (j.swinging && !swinging && this.onFootstep) this.onFootstep(id, j.footBone.getWorldPosition(this._foot));
      j.swinging = swinging;
    }
    this.deck.rotation.y = pose.deckYaw;
    this.craneLeft.rotation.y = pose.craneLeft;
    this.craneRight.rotation.y = pose.craneRight;
    this.radar.rotation.y = pose.radar;
  }
}
