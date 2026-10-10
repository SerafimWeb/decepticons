import { ChargeTimer } from '../combat/ChargeTimer';
import type { WeaponStats } from '../combat/weapons';
import * as THREE from 'three';
import type { MountId } from '../combat/mounts';
import type { Loadout } from '../combat/weapons';
import type { TestFire } from './testFire';
import { PALETTE } from '../core/palette';
import { Android } from '../entities/Android';
import { CHASSIS, PILOT_ANDROID_STATS, type ChassisId } from '../entities/chassis';
import type { MechBase } from '../entities/MechBase';
import { COLOSSUS_01_BLUEPRINT, HEAVY_MECH_BLUEPRINT, LIGHT_MECH_BLUEPRINT, type MechBlueprint } from '../entities/mechBlueprint';
import { Vector09 } from '../entities/Vector09';
import { ImportedMech } from '../entities/ImportedMech';
import { IMPORTED_CHASSIS, tryInstantiateMechRig, whenMechAssetReady } from '../entities/importedMechAssets';
import { AIM_TARGET_SPEED, aimTargetDirectionAt, aimTargetXAt } from './aimPractice';

const CYAN = 0x5ce1ff;
const WARM = 0xffb05a;
const STEEL = 0x151c22;
/** Altura do topo do pedestal (m). */
const PEDESTAL_TOP = 0.7;
/** Raio do pedestal e da coluna de holograma (m). */
const PEDESTAL_R = 4.6;
const COLUMN_H = 15;
/** Volta completa da plataforma, girando sozinha (s). */
const TURN_S = 28;
/** Depois de girar com o dedo ou o mouse, a plataforma espera este tanto e volta a girar sozinha (s). */
const IDLE_AFTER_DRAG_S = 3;
/** Robô pequeno (o andróide, 1,6 m) aparece ampliado no pedestal, como num holograma de montagem: dá para ver as peças. */
const MIN_SHOWN_HEIGHT = 3.2;
/** Blueprint visual de cada chassi que passa pelo `Vector09` no pedestal (o andróide tem classe própria). */
const BLUEPRINT_BY_CHASSIS: Partial<Record<ChassisId, MechBlueprint>> = {
  colossus01: COLOSSUS_01_BLUEPRINT,
  arara: LIGHT_MECH_BLUEPRINT,
  onca: HEAVY_MECH_BLUEPRINT,
};

const _arm = new THREE.Vector3();
const _v = new THREE.Vector3();
/** Alvo do teste de disparo: à direita e atrás do pedestal. */
const TARGET = new THREE.Vector3(15, 0, -9);
const TARGET_H = 6;
/** Projéteis de teste na tela ao mesmo tempo, e a velocidade visual deles (m/s). */
const SHOTS_POOL = 16;
const FLASH_POOL = 8;

interface Shot {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
}

interface Flash {
  mesh: THREE.Mesh;
  t: number;
}

/** Brilho redondo (canvas) do impacto no alvo. */
function flashTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.3, 'rgba(255,220,160,0.8)');
  r.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Placa do alvo: anéis concêntricos (canvas). */
function targetTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b1318';
  g.fillRect(0, 0, 256, 256);
  for (let r = 120; r > 0; r -= 24) {
    g.strokeStyle = r % 48 === 0 ? 'rgba(255,176,90,0.95)' : 'rgba(106,232,255,0.9)';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(128, 128, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,176,90,1)';
  g.beginPath();
  g.arc(128, 128, 10, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Diferença de ângulo pelo lado mais curto. */
function shortAngle(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Piso de placas de grade: bordas ciano e grade fina (canvas, feito uma vez). */
function floorTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(92,225,255,0.18)';
  g.lineWidth = 1;
  for (let i = 20; i < 240; i += 12) {
    g.beginPath();
    g.moveTo(i, 12);
    g.lineTo(i, 244);
    g.moveTo(12, i);
    g.lineTo(244, i);
    g.stroke();
  }
  g.strokeStyle = 'rgba(92,225,255,0.95)';
  g.lineWidth = 3;
  g.strokeRect(6, 6, 244, 244);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Linhas de varredura do holograma: forte embaixo, some em cima, com faixas mais claras (canvas). */
function holoTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 512; y += 4) {
    const fade = 1 - y / 512;
    const band = y % 64 < 6 ? 0.5 : 0;
    g.fillStyle = `rgba(160,240,255,${(0.1 + band) * fade})`;
    g.fillRect(0, 511 - y, 128, 2);
  }
  // Colunas de "dados" subindo: pontos em linhas verticais.
  for (let x = 4; x < 128; x += 16) {
    for (let y = 0; y < 512; y += 10) {
      if ((x * 7 + y * 13) % 29 > 11) continue;
      g.fillStyle = `rgba(200,250,255,${0.35 * (1 - y / 512)})`;
      g.fillRect(x, 511 - y, 2, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Disco do pedestal: anéis concêntricos e marcas de régua, como uma mira de montagem (canvas). */
function discTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.translate(256, 256);
  g.strokeStyle = 'rgba(120,235,255,0.9)';
  for (const [r, w] of [
    [250, 3],
    [214, 1.5],
    [150, 2],
    [96, 1],
  ] as const) {
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  }
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    g.lineWidth = long ? 3 : 1;
    g.beginPath();
    g.moveTo(Math.cos(a) * (long ? 190 : 202), Math.sin(a) * (long ? 190 : 202));
    g.lineTo(Math.cos(a) * 212, Math.sin(a) * 212);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Tela de holograma do fundo: a planta de um Mech em linhas (canvas). */
function blueprintTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(20,90,110,0.35)';
  g.fillRect(0, 0, 256, 320);
  g.strokeStyle = 'rgba(140,240,255,0.95)';
  g.lineWidth = 2;
  g.strokeRect(4, 4, 248, 312);
  const box = (x: number, y: number, w: number, h: number) => g.strokeRect(x, y, w, h);
  box(108, 40, 40, 34); // cabeça
  box(84, 80, 88, 80); // torso
  box(52, 86, 26, 70); // braço E
  box(178, 86, 26, 70); // braço D
  box(92, 166, 30, 90); // perna E
  box(134, 166, 30, 90); // perna D
  g.lineWidth = 1;
  g.globalAlpha = 0.6;
  for (let y = 270; y < 310; y += 8) {
    g.beginPath();
    g.moveTo(16, y);
    g.lineTo(16 + ((y * 37) % 200), y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * O galpão do Hangar (dono, 26/09: a imagem de referência em \`.tmp/arte/hangar-referencia.png\`): uma cena 3D só
 * dele, desenhada no lugar da arena enquanto o Hangar está aberto (o jogo fica pausado). Piso de placas com bordas
 * ciano, pedestal com anéis e uma coluna de holograma com linhas de varredura, anel de varredura subindo e descendo,
 * lâmpadas quentes penduradas, passarelas e Mechs escuros no fundo, telas de holograma e névoa. O Mech do jogador fica
 * no pedestal, girando devagar; arrastar gira.
 *
 * Tudo feito por código (texturas em canvas, geometria simples): nada para baixar. Custo só com o Hangar aberto.
 */
export class HangarScene {
  /** Uma carga atrasada não pode substituir a seleção mais recente do piloto. */
  private showVersion = 0;
  /** Contrato de render: preparar só o modelo escolhido, com as luzes reais do Hangar. */
  prepareModel?: (root: THREE.Object3D) => Promise<boolean>;
  private readonly prepared = new WeakSet<THREE.Object3D>();
  private pendingPreparation: { model: MechBase; version: number } | null = null;
  private preparing = false;
  /** A UI pode consultar este estado; o modelo anterior fica no pedestal durante a preparação. */
  get graphicsPreparing(): boolean { return this.preparing; }
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
  private readonly turntable = new THREE.Group();
  private readonly holo: THREE.Texture;
  private readonly holoInner: THREE.Texture;
  private readonly scanner: THREE.Mesh;
  private readonly lampLights: THREE.PointLight[] = [];
  private readonly displays = new Map<ChassisId, MechBase>();
  private shown: MechBase | null = null;
  private height = 5.3;
  private time = 0;
  private sinceDrag = IDLE_AFTER_DRAG_S;
  /** Fração da largura que o painel da direita cobre: o Mech fica no espaço que sobra (0 no celular). */
  private shift = 0;
  private width = 0;
  private screenH = 0;
  // Teste de disparo: o alvo, os projéteis e brilhos de impacto (pools feitos uma vez), e o andamento.
  private readonly targetMat: THREE.MeshStandardMaterial;
  /** Alvo sem IA de combate: só animação de passada e trilha fixa durante o treino manual. */
  private readonly aimTarget: Android;
  private readonly aimTargetRing: THREE.Mesh;
  private readonly practiceRay = new THREE.Ray();
  private readonly practiceOrigin = new THREE.Vector3();
  private readonly practiceDirection = new THREE.Vector3();
  private readonly practiceCenter = new THREE.Vector3();
  private readonly practiceSphere = new THREE.Sphere(new THREE.Vector3(), 0.62);
  private readonly practiceHit = new THREE.Vector3();
  private readonly practiceEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private practiceActive = false;
  private practiceTime = 0;
  private practiceCooldown = 0;
  private readonly practiceCharge = new ChargeTimer();
  private practiceShots = 0;
  private practiceHits = 0;
  private practiceAccuracy = 0;
  private readonly shotsPool: Shot[] = [];
  private readonly flashes: Flash[] = [];
  private test: { data: TestFire; mounts: readonly MountId[]; t: number; next: number; aimFrom: number; aimTo: number } | null = null;
  /** 0 = câmera do Hangar, 1 = câmera aberta do teste (mistura suave entre as duas). */
  private testCam = 0;
  private readonly camHome = new THREE.Vector3();
  private readonly lookHome = new THREE.Vector3();
  private readonly camTest = new THREE.Vector3();
  private readonly lookTest = new THREE.Vector3();
  private readonly look = new THREE.Vector3();

  constructor() {
    const s = this.scene;
    s.background = new THREE.Color(0x05080b);
    s.fog = new THREE.Fog(0x05080b, 22, 75);
    s.add(new THREE.HemisphereLight(0x5f9fbf, 0x0a0c0e, 0.7));

    // Piso de placas de grade.
    const floorTex = floorTexture();
    floorTex.repeat.set(22, 22);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({ color: 0x0a1015, roughness: 0.75, metalness: 0.45, emissive: CYAN, emissiveMap: floorTex, emissiveIntensity: 0.5 }),
    );
    floor.rotation.x = -Math.PI / 2;
    s.add(floor);

    // Pedestal: base de aço, anel aceso na borda e o disco de montagem.
    const steel = new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.5, metalness: 0.8 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(PEDESTAL_R, PEDESTAL_R + 0.5, PEDESTAL_TOP, 64), steel);
    base.position.y = PEDESTAL_TOP / 2;
    s.add(base);
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(CYAN).multiplyScalar(1.6) });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(PEDESTAL_R - 0.15, 0.06, 8, 96), glow);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = PEDESTAL_TOP + 0.01;
    s.add(rim);
    const foot = new THREE.Mesh(new THREE.TorusGeometry(PEDESTAL_R + 0.55, 0.05, 8, 96), glow);
    foot.rotation.x = Math.PI / 2;
    foot.position.y = 0.05;
    s.add(foot);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(PEDESTAL_R - 0.3, 64),
      new THREE.MeshBasicMaterial({ map: discTexture(), color: CYAN, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = PEDESTAL_TOP + 0.02;
    s.add(disc);

    // Coluna de holograma: dois cilindros abertos com linhas de varredura correndo em sentidos opostos.
    this.holo = holoTexture();
    this.holo.repeat.set(6, 1);
    this.holoInner = this.holo.clone();
    this.holoInner.repeat.set(4, 1);
    const column = (r: number, map: THREE.Texture, opacity: number) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, COLUMN_H, 64, 1, true),
        new THREE.MeshBasicMaterial({ map, color: CYAN, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }),
      );
      m.position.y = PEDESTAL_TOP + COLUMN_H / 2;
      s.add(m);
    };
    column(PEDESTAL_R - 0.25, this.holo, 0.2);
    column(PEDESTAL_R - 0.9, this.holoInner, 0.1);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(PEDESTAL_R - 0.25, 0.04, 6, 96), glow);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = PEDESTAL_TOP + COLUMN_H;
    s.add(halo);
    // Anel de varredura: sobe e desce pelo Mech.
    this.scanner = new THREE.Mesh(
      new THREE.TorusGeometry(PEDESTAL_R - 0.6, 0.035, 6, 96),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbff6ff).multiplyScalar(2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.scanner.rotation.x = Math.PI / 2;
    s.add(this.scanner);
    const baseGlow = new THREE.PointLight(CYAN, 18, 14, 2);
    baseGlow.position.set(0, PEDESTAL_TOP + 2.2, 3);
    s.add(baseGlow);

    // Luz principal quente de cima (o Mech lido de longe) e um contraluz frio.
    const key = new THREE.SpotLight(WARM, 900, 60, Math.PI / 6, 0.5, 2);
    key.position.set(4, 24, 8);
    key.target.position.set(0, 3, 0);
    s.add(key, key.target);
    // Luz de frente, branca quente, do lado da câmera: o Mech do jogador é o que mais aparece no galpão.
    const front = new THREE.SpotLight(0xfff1dc, 700, 70, Math.PI / 7, 0.6, 2);
    front.position.set(7, 11, 20);
    front.target.position.set(0, 3, 0);
    s.add(front, front.target);
    const rimLight = new THREE.DirectionalLight(0x6fd8ff, 0.8);
    rimLight.position.set(-6, 8, -10);
    s.add(rimLight);

    this.buildHall();
    this.turntable.position.y = PEDESTAL_TOP;
    s.add(this.turntable);

    // Estande de tiro: postes, a placa do alvo e a base; acende a cada impacto.
    // Só os anéis acendem no impacto (o mapa de emissão é a própria textura do alvo).
    const rings = targetTexture();
    this.targetMat = new THREE.MeshStandardMaterial({ map: rings, emissive: 0xffffff, emissiveMap: rings, emissiveIntensity: 0.25, roughness: 0.6, metalness: 0.3 });
    const post = new THREE.MeshStandardMaterial({ color: 0x1b242b, roughness: 0.6, metalness: 0.7 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.4, 0.3), [post, post, post, post, this.targetMat, post]);
    plate.position.set(TARGET.x, TARGET_H, TARGET.z);
    plate.lookAt(0, TARGET_H, 0);
    s.add(plate);
    for (const dx of [-2.6, 2.6]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, TARGET_H + 2.2, 0.3), post);
      p.position.copy(plate.position).add(_v.set(dx, 0, 0).applyQuaternion(plate.quaternion));
      p.position.y = (TARGET_H + 2.2) / 2;
      s.add(p);
    }
    const shotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbff6ff).multiplyScalar(3) });
    for (let i = 0; i < SHOTS_POOL; i++) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 6), shotMat.clone());
      mesh.visible = false;
      s.add(mesh);
      this.shotsPool.push({ mesh, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, dur: 1 });
    }
    const flashMat = new THREE.MeshBasicMaterial({ map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < FLASH_POOL; i++) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), flashMat.clone());
      mesh.visible = false;
      s.add(mesh);
      this.flashes.push({ mesh, t: 1 });
    }

    this.aimTarget = new Android({ paint: 0x75858e, visor: WARM, tool: 'repair' });
    this.aimTarget.root.visible = false;
    s.add(this.aimTarget.root);
    this.aimTargetRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.035, 6, 32),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.85 }),
    );
    this.aimTargetRing.rotation.x = Math.PI / 2;
    this.aimTargetRing.visible = false;
    s.add(this.aimTargetRing);
  }

  /**
   * Teste de disparo: o Mech vira para o alvo e dispara a arma do braço escolhido no ritmo do teste (`testFire`, as
   * regras do jogo). A câmera abre para mostrar o Mech e o alvo. Chame `testProgress` a cada quadro.
   */
  startTest(data: TestFire, mounts: readonly MountId[]): void {
    const aimTo = Math.atan2(-(TARGET.x - 0), -(TARGET.z - 0));
    this.test = { data, mounts, t: 0, next: 0, aimFrom: this.turntable.rotation.y, aimTo };
  }

  /** O teste em andamento: segundo atual e duração (null = sem teste). */
  testProgress(): { t: number; seconds: number } | null {
    return this.test ? { t: this.test.t, seconds: this.test.data.seconds } : null;
  }

  stopTest(): void {
    this.test = null;
  }

  /** Inicia uma linha de tiro isolada da simulação; câmera usa yaw/pitch reais do CameraRig. */
  startAimPractice(): void {
    this.practiceActive = true;
    this.practiceTime = 0;
    this.practiceCooldown = 0;
    this.practiceCharge.reset();
    this.practiceShots = 0;
    this.practiceHits = 0;
    this.practiceAccuracy = 0;
    this.aimTarget.root.visible = true;
    this.aimTargetRing.visible = true;
    this.turntable.rotation.y = 0;
    this.camera.clearViewOffset();
    this.camera.fov = 72;
    this.camera.updateProjectionMatrix();
  }

  stopAimPractice(): void {
    this.practiceActive = false;
    this.practiceCharge.reset();
    this.aimTarget.root.visible = false;
    this.aimTargetRing.visible = false;
    this.camera.fov = 38;
    this.camera.updateProjectionMatrix();
    this.placeCamera();
  }

  get aimPracticeShots(): number {
    return this.practiceShots;
  }

  get aimPracticeHits(): number {
    return this.practiceHits;
  }

  get aimPracticeTime(): number {
    return this.practiceTime;
  }

  get aimPracticeCharge(): number { return this.practiceCharge.progress; }

  get aimPracticeAccuracy(): number {
    return this.practiceAccuracy;
  }

  /** Aim pelo mesmo input/sensibilidade do jogador; tiro e acerto só afetam o placar do treino. */
  updateAimPractice(dt: number, yaw: number, pitch: number, firing: boolean, weapon: WeaponStats): void {
    if (!this.practiceActive) return;
    this.camera.position.set(0, 2.35, 17);
    this.camera.quaternion.setFromEuler(this.practiceEuler.set(pitch, yaw, 0, 'YXZ'));
    this.camera.updateMatrixWorld();
    this.practiceCooldown = Math.max(0, this.practiceCooldown - dt);
    if (this.practiceCharge.step(dt, firing, this.practiceCooldown <= 0, weapon.chargeTime)) {
      this.practiceCooldown = Math.max(0.08, weapon.fireInterval);
      this.fireAimPracticeShot();
    }
  }

  private fireAimPracticeShot(): void {
    this.practiceShots++;
    this.practiceOrigin.copy(this.camera.position);
    this.camera.getWorldDirection(this.practiceDirection);
    this.practiceRay.set(this.practiceOrigin, this.practiceDirection);
    this.practiceCenter.copy(this.aimTarget.root.position).add(_v.set(0, 0.9, 0));
    this.practiceSphere.center.copy(this.practiceCenter);
    const hit = this.practiceRay.intersectSphere(this.practiceSphere, this.practiceHit);
    if (hit) {
      this.practiceHits++;
      this.practiceAccuracy = Math.round((this.practiceHits / this.practiceShots) * 100);
      this.flash(hit, 0.9);
    } else {
      this.practiceAccuracy = Math.round((this.practiceHits / this.practiceShots) * 100);
    }

    let shot: Shot | undefined;
    for (const candidate of this.shotsPool) {
      if (candidate.t >= candidate.dur) {
        shot = candidate;
        break;
      }
    }
    if (!shot) return;
    shot.from.copy(this.practiceOrigin);
    if (hit) shot.to.copy(hit);
    else shot.to.copy(this.practiceOrigin).addScaledVector(this.practiceDirection, 22);
    shot.dur = shot.from.distanceTo(shot.to) / 110;
    shot.t = 0;
    const mat = shot.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(0xbff6ff).multiplyScalar(3);
    shot.mesh.scale.set(1, 1, 1);
    shot.mesh.position.copy(shot.from);
    shot.mesh.lookAt(shot.to);
    shot.mesh.rotateX(Math.PI / 2);
    shot.mesh.visible = true;
  }

  /** Galpão: paredes com colunas, passarela com guarda-corpo, lâmpadas penduradas, Mechs e telas no fundo. */
  private buildHall(): void {
    const s = this.scene;
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c1116, roughness: 0.9, metalness: 0.3 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x1b242b, roughness: 0.6, metalness: 0.7 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 32), dark);
    back.position.set(0, 16, -26);
    s.add(back);
    for (const x of [-38, 38]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(60, 32), dark);
      side.position.set(x, 16, 4);
      side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      s.add(side);
    }
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = metal) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      s.add(b);
      return b;
    };
    // Colunas da parede do fundo e vigas do teto.
    for (let x = -36; x <= 36; x += 12) box(1.2, 32, 1.2, x, 16, -25.4);
    for (let z = -24; z <= 12; z += 12) box(78, 0.9, 0.9, 0, 26, z);
    // Passarela no fundo e nas laterais, com guarda-corpo aceso fraco.
    const rail = new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(0.22) });
    box(76, 0.4, 3, 0, 8, -23);
    box(76, 0.08, 0.08, 0, 9.1, -21.6, rail);
    for (const x of [-35, 35]) {
      box(3, 0.4, 36, x, 8, -5);
      box(0.08, 0.08, 36, x > 0 ? x - 1.4 : x + 1.4, 9.1, -5, rail);
    }
    // Lâmpadas penduradas: cúpula escura, bulbo quente (o brilho acende no bloom) e luz de verdade em algumas.
    const shade = new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide });
    const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(3) });
    // Aditivo: frente e verso somam luz, sem exigir duas submissões de desenho.
    const cone = new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.018, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
    [
      [-12, -8],
      [12, -8],
      [-20, 6],
      [20, 6],
      [0, -16],
    ].forEach(([x, z], i) => {
      box(0.06, 6, 0.06, x!, 23, z!);
      const hood = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.9, 20, 1, true), shade);
      hood.position.set(x!, 19.6, z!);
      s.add(hood);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), bulb);
      b.position.set(x!, 19.2, z!);
      s.add(b);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(3.2, 17, 24, 1, true), cone);
      beam.position.set(x!, 10.7, z!);
      s.add(beam);
      if (i < 3) {
        const l = new THREE.PointLight(WARM, 120, 30, 2);
        l.position.set(x!, 18.8, z!);
        s.add(l);
        this.lampLights.push(l);
      }
    });
    // Mechs parados no fundo, escuros (o do jogador é o único aceso).
    const parked: [number, number, number, number][] = [
      [-16, 0, -17, 0.5],
      [16, 0, -17, -0.5],
      [-26, 0, -10, 0.9],
      [26, 8.2, -22, -0.3],
    ];
    for (const [x, y, z, yaw] of parked) {
      const m = new Vector09({ paint: 0x2b3238, visor: 0x1c3a44 });
      m.root.position.set(x, y, z);
      m.root.rotation.y = yaw;
      s.add(m.root);
    }
    for (const [x, z] of [
      [-8, -21],
      [9, -21.5],
    ] as const) {
      const a = new Android({ paint: 0x3a4248, visor: 0x1c3a44 });
      a.root.position.set(x, 8.2, z);
      s.add(a.root);
    }
    // Telas de holograma soltas no ar, com a planta de um Mech.
    const screen = new THREE.MeshBasicMaterial({ map: blueprintTexture(), color: CYAN, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
    for (const [x, y, z, yaw] of [
      [-11, 5.5, -3, 0.55],
      [-21, 12, -18, 0.2],
      [22, 12.5, -16, -0.3],
    ] as const) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), screen);
      p.position.set(x, y, z);
      p.rotation.y = yaw;
      s.add(p);
    }
  }

  /** O Mech do pedestal: o chassi e as armas da montagem (um modelo por chassi, feito na primeira vez). */
  show(chassis: ChassisId, loadout: Loadout): void {
    const version = ++this.showVersion;
    this.pendingPreparation = null;
    let m = this.displays.get(chassis);
    if (!m) {
      const importedAsset = IMPORTED_CHASSIS[chassis];
      if (importedAsset) {
        const rig = tryInstantiateMechRig(importedAsset.url, CHASSIS[chassis].height);
        if (!rig) {
          // Ainda carregando (raro — o preload dispara no boot do jogo): tenta de novo assim que
          whenMechAssetReady(importedAsset.url, CHASSIS[chassis].height, importedAsset)
            .then(() => { if (version === this.showVersion) this.show(chassis, loadout); })
            .catch((err: unknown) => console.warn('Hangar: não foi possível carregar o Mech selecionado', err));
          return;
        }
        m = new ImportedMech(CHASSIS[chassis], rig, loadout);
      } else {
        m =
          chassis === 'android'
            ? new Android({ stats: PILOT_ANDROID_STATS, paint: PALETTE.playerPaint, visor: PALETTE.green, tool: 'pilot', loadout })
            : new Vector09({ stats: CHASSIS[chassis], loadout, blueprint: BLUEPRINT_BY_CHASSIS[chassis] });
      }
      this.displays.set(chassis, m);
    }
    m.equip(loadout);
    if (m !== this.shown && this.prepareModel && !this.prepared.has(m.root)) {
      // Uma operação ativa + só a última pendente: cliques rápidos não criam uma fila de compilações.
      this.pendingPreparation = { model: m, version };
      if (!this.preparing) void this.prepareSelection();
      return;
    }
    this.display(m);
  }

  private async prepareSelection(): Promise<void> {
    this.preparing = true;
    try {
      while (this.pendingPreparation) {
        const request = this.pendingPreparation;
        this.pendingPreparation = null;
        try {
          if (await this.prepareModel!(request.model.root)) this.prepared.add(request.model.root);
        } catch (err: unknown) {
          console.warn('Hangar: preparação gráfica falhou (segue no primeiro uso)', err);
        }
        if (request.version === this.showVersion) this.display(request.model);
      }
    } finally {
      this.preparing = false;
    }
  }

  private display(m: MechBase): void {
    if (m !== this.shown) {
      if (this.shown) this.turntable.remove(this.shown.root);
      this.turntable.add(m.root);
      this.shown = m;
      const scale = Math.max(1, MIN_SHOWN_HEIGHT / m.stats.height);
      this.turntable.scale.setScalar(scale);
      this.height = m.stats.height * scale;
      this.frame();
    }
  }

  /**
   * Onde um braço do Mech do pedestal está na tela (px), para os marcadores da interface. Falso se o braço não existe
   * ou está atrás da câmera. Nada alocado.
   */
  armScreen(part: 'rightArm' | 'leftArm', width: number, height: number, out: { x: number; y: number }): boolean {
    const m = this.shown;
    if (!m || m.modules[part] <= 0) return false;
    m.partWorldPosition(part, _arm).project(this.camera);
    if (_arm.z > 1) return false;
    out.x = (_arm.x * 0.5 + 0.5) * width;
    out.y = (-_arm.y * 0.5 + 0.5) * height;
    return true;
  }

  /** Gira a plataforma (arrastar o dedo ou o mouse); a volta sozinha espera um pouco. */
  rotate(dx: number): void {
    this.turntable.rotation.y += dx * 0.008;
    this.sinceDrag = 0;
  }

  /** Tamanho da tela e quanto dela o painel da direita cobre (o Mech fica centrado no que sobra). */
  resize(width: number, height: number, coveredRight: number): void {
    this.camera.aspect = width / height;
    this.shift = coveredRight;
    this.frame(width, height);
  }

  private frame(width = this.width, height = this.screenH): void {
    const h = this.height;
    // Mais perto do andróide (1,6 m) que do Mech (5,3 m), sempre um pouco de baixo: o robô parece grande.
    const dist = 4 + h * 3.2;
    this.camHome.set(dist * 0.26, PEDESTAL_TOP + h * 0.5, dist);
    this.lookHome.set(0, PEDESTAL_TOP + h * 0.48, 0);
    // Teste: de trás e do lado do Mech, vendo o Mech e o alvo juntos.
    this.camTest.set(-9, 9, 20);
    this.lookTest.set(TARGET.x * 0.45, PEDESTAL_TOP + h * 0.45, TARGET.z * 0.45);
    this.width = width;
    this.screenH = height;
    if (this.practiceActive) {
      this.camera.updateProjectionMatrix();
      return;
    }
    this.placeCamera();
  }

  private placeCamera(): void {
    const k = this.testCam * this.testCam * (3 - 2 * this.testCam);
    this.camera.position.lerpVectors(this.camHome, this.camTest, k);
    this.look.lerpVectors(this.lookHome, this.lookTest, k);
    this.camera.lookAt(this.look);
    // Durante o teste os painéis somem: a câmera usa a tela toda.
    const shift = this.shift * (1 - k);
    if (this.width > 0 && shift > 0) this.camera.setViewOffset(this.width, this.screenH, (this.width * shift) / 2, 0, this.width, this.screenH);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  /** Um tiro do teste: da boca da arma até um ponto do alvo (motosserra só solta faísca na lâmina). */
  private fire(test: { data: TestFire; mounts: readonly MountId[]; next: number }): void {
    const m = this.shown;
    if (!m) return;
    const w = test.data.weapon;
    const from = _v;
    // Vários encaixes atiram juntos (os dois ombros): cada tiro da lista sai do encaixe seguinte, em rodízio.
    m.mountWorldPosition(test.mounts[test.next % test.mounts.length]!, from);
    if (w.kind === 'melee') {
      this.flash(from, 0.7);
      return;
    }
    const shot = this.shotsPool.find((s) => s.t >= s.dur);
    if (!shot) return;
    shot.from.copy(from);
    // Espalha um pouco pelo alvo, de forma fixa (sem sorteio): o desenho de cada tiro muda com a ordem.
    const k = test.data.shots.length ? this.shotsPool.indexOf(shot) : 0;
    shot.to.set(TARGET.x + Math.sin(k * 2.3) * 0.9, TARGET_H + Math.cos(k * 1.7) * 0.9, TARGET.z + Math.sin(k * 1.1) * 0.5);
    const visualSpeed = w.kind === 'ammo' ? 45 : 110;
    shot.dur = shot.from.distanceTo(shot.to) / visualSpeed;
    shot.t = 0;
    const mat = shot.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(w.kind === 'ammo' ? 0xffb05a : 0xbff6ff).multiplyScalar(3);
    shot.mesh.scale.set(w.kind === 'ammo' ? 2.2 : 1, w.kind === 'ammo' ? 0.8 : 1, w.kind === 'ammo' ? 2.2 : 1);
    shot.mesh.position.copy(shot.from);
    shot.mesh.lookAt(shot.to);
    shot.mesh.rotateX(Math.PI / 2);
    shot.mesh.visible = true;
  }

  private flash(at: THREE.Vector3, size: number): void {
    const f = this.flashes.find((x) => x.t >= 1);
    if (!f) return;
    f.t = 0;
    f.mesh.position.copy(at);
    f.mesh.scale.setScalar(size);
    f.mesh.visible = true;
  }

  private updateShots(dt: number): void {
    for (const s of this.shotsPool) {
      if (s.t >= s.dur) continue;
      s.t += dt;
      if (s.t >= s.dur) {
        s.mesh.visible = false;
        this.flash(s.to, 1.4);
        this.targetMat.emissiveIntensity = 1.6;
        continue;
      }
      s.mesh.position.lerpVectors(s.from, s.to, s.t / s.dur);
    }
    for (const f of this.flashes) {
      if (f.t >= 1) continue;
      f.t += dt * 4;
      f.mesh.lookAt(this.camera.position);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - f.t);
      if (f.t >= 1) f.mesh.visible = false;
    }
    this.targetMat.emissiveIntensity = Math.max(0.25, this.targetMat.emissiveIntensity - dt * 5);
  }

  /** Por quadro, com o Hangar aberto. */
  update(dt: number): void {
    this.time += dt;
    this.sinceDrag += dt;
    const test = this.test;
    if (this.practiceActive) {
      this.practiceTime += dt;
      const x = aimTargetXAt(this.practiceTime);
      const direction = aimTargetDirectionAt(this.practiceTime);
      this.aimTarget.velocity.set(direction * AIM_TARGET_SPEED, 0, 0);
      this.aimTarget.render(dt, 1);
      this.aimTarget.root.position.set(x, 0, 7);
      this.aimTarget.root.rotation.y = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.aimTargetRing.position.set(x, 0.06, 7);
    } else if (test) {
      test.t += dt;
      // Vira para o alvo no primeiro meio segundo; os tiros começam depois disso.
      const turn = Math.min(1, test.t / 0.5);
      this.turntable.rotation.y = test.aimFrom + shortAngle(test.aimFrom, test.aimTo) * turn;
      const shots = test.data.shots;
      while (test.next < shots.length && shots[test.next]! + 0.5 <= test.t) {
        this.fire(test);
        test.next++;
      }
      if (test.t > test.data.seconds + 1.2) this.test = null;
    } else if (this.sinceDrag > IDLE_AFTER_DRAG_S) this.turntable.rotation.y += (dt * Math.PI * 2) / TURN_S;
    if (!this.practiceActive) {
      const camGoal = this.test ? 1 : 0;
      if (this.testCam !== camGoal) {
        this.testCam = camGoal > this.testCam ? Math.min(1, this.testCam + dt * 1.6) : Math.max(0, this.testCam - dt * 1.6);
        this.placeCamera();
      }
    }
    this.updateShots(dt);
    this.holo.offset.y -= dt * 0.08;
    this.holoInner.offset.y += dt * 0.05;
    this.holoInner.offset.x += dt * 0.01;
    const h = this.height;
    this.scanner.position.y = PEDESTAL_TOP + 0.2 + (0.5 + 0.5 * Math.sin(this.time * 0.9)) * h * 1.05;
    // Lâmpadas de galpão: um tremor leve na intensidade.
    this.lampLights.forEach((l, i) => (l.intensity = 120 * (0.93 + 0.07 * Math.sin(this.time * (7 + i * 3.1)))));
    this.shown?.render(dt, 1);
  }
}
