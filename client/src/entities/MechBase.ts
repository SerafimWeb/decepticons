import { EnergyShield } from '../combat/EnergyShield';
import { MetalShield, RAISED_SPEED } from '../combat/MetalShield';
import { StatusSet, type StatusKind } from '../combat/StatusEffects';
import { CombatBoost } from '../combat/CombatBoost';
import { legDamageLean } from '../fx/DamageVisuals';
import { statusTint, type Tint } from './statusTint';
import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { HeatSink, OVERHEAT_SPEED, type ChassisHeat, type HeatState } from '../combat/heat';
import { repairModules } from '../combat/repair';
import { applyDamage, partAt, type DamageResult } from '../combat/damage';
import { FLINCH_DECAY, FLINCH_MAX } from '../combat/reaction';
import { DEFAULT_TRIGGERS, MOUNT_PART, MOUNTS, type MountId, type NamedLayout, type TriggerLayout, type Vec3 } from '../combat/mounts';
import type { DamageType, Loadout, WeaponStats } from '../combat/weapons';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

/** Gravidade dos Mechs (mais alta que a do mundo: queda "pesada" e rápida, estilo arena shooter). */
export const MECH_GRAVITY = 32;
/** Fase da passada por metro andado × altura do robô (0,55 rad/m no Vector-09 de 5,3 m). */
const STRIDE = 0.55 * 5.3;
/** A passada de quem não declara a sua (MechStats.gait): a mesma para todo Mech desde 25/09. */
const DEFAULT_GAIT = { hip: 0.7, knee: 1.1 };
const CONTROLLER_OFFSET = 0.05;
const HARD_LANDING_SPEED = 14;
/** Empurrão (`MechBase.push`): quanto da velocidade externa sobra por segundo (e^-3,5: meio segundo depois resta ~17%), e o teto da velocidade somada (m/s). */
const SHOVE_DECAY = 3.5;
const SHOVE_MAX = 12;
const MAX_CLIMB_ANGLE = (50 * Math.PI) / 180;
/** Normal com y abaixo disso é parede ou teto (mais íngreme que a rampa máxima). */
const WALL_NORMAL_Y = Math.cos(MAX_CLIMB_ANGLE);
/** Ao refazer um movimento travado no chão, afasta este tanto (m) do piso; o snap devolve no tick seguinte. */
const UNSTICK_LIFT = 0.002;
const IGNORE_DEBRIS = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC;

/** Partes com vida independente (dano localizado). */
export type MechPart = 'torso' | 'head' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
const PARTS: readonly MechPart[] = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
export type MechModules = Record<MechPart, number>;

export interface MechStats extends ChassisHeat {
  /**
   * Passada e joelho DO CHASSI (radianos): quanto o quadril abre no passo e quanto o joelho dobra no apoio. Sem isto,
   * todo Mech anda com a mesma passada — um titã de 20 m dava o passo do Vector-09. Robô pesado abre menos (passo curto,
   * planta firme) e dobra mais o joelho (o pé sobe raspando, como um peso que se arrasta). Dono, 12/10.
   */
  gait?: { hip: number; knee: number };
  name: string;
  moveSpeed: number; // m/s no chão
  groundAccel: number; // m/s² — alto = resposta "Quake", quase sem inércia
  airAccel: number;
  jumpVelocity: number;
  maxJumps: number; // 2 = pulo duplo
  dashSpeed: number;
  dashDuration: number;
  dashCooldown: number;
  radius: number; // cápsula de colisão
  height: number;
  stepHeight: number; // degraus que sobe sem pular
  demolishOnDash: boolean; // Colossus-01: dash atravessa paredes destrutíveis
  maxScrapSlots: number; // Vector-09: 0 | Colossus-01: 1 | Ferret-X: 4
  /** Armas de fábrica do chassi (o Hangar troca). Dano, cadência e calor vêm de cada arma. */
  loadout: Loadout;
  /** Carga máxima das armas nos braços (t): o orçamento do Hangar. */
  weaponCapacity: number;
  maxModuleHealth: MechModules;
  /** Status do chassi: 'hangar' (público) ou 'oficina' (escondido para jogadores comuns). */
  status?: 'oficina' | 'hangar';
  /** Quais encaixes atiram em cada botão (`combat/mounts.ts`). Sem isto: principal na mão direita, secundário na esquerda. */
  triggers?: TriggerLayout;
  /** Layouts de gatilho que o jogador escolhe no Hangar (o primeiro é o padrão e é o `triggers`). Sem a lista, o chassi tem um só. */
  layouts?: readonly NamedLayout[];
  /**
   * Boca de cada encaixe, em metros a partir dos pés, com o Mech virado para -Z. Os chassis de malha importada trazem a
   * medida do desenho aqui: o servidor não tem o desenho (usa o corpo procedural), e sem este dado a boca dele seria outra
   * (G14: o tiro tem que sair do mesmo lugar no cliente e no servidor). Sem isto, vale a medida do rig.
   */
  muzzles?: Partial<Record<MountId, Vec3>>;
  /**
   * Quanto dura em você cada estado (fogo, choque, gelo): 1 = normal, 0,5 = metade (Mech grande resiste), 1,5 = uma vez e meia.
   * Sem isto, 1. Decisão do dono (09/10): o Colossus-01 resiste (`.decepticons/ARMAS_ELEMENTAIS.md`).
   */
  statusResist?: number;
}

/**
 * Input já "traduzido" (sem depender de teclado ou câmera). É isso que no futuro
 * será enviado ao servidor e reaplicado na client-side prediction.
 */
export interface MechInput {
  shield?: boolean;
  moveX: number; // -1..1, direita positiva
  moveZ: number; // -1..1, frente positiva
  moveYaw: number; // referencial do WASD (câmera); na visão tática é fixo
  yaw: number; // para onde o torso aponta
  jump: boolean;
  dash: boolean;
}

/**
 * O bastante de um nó pra animação procedural mexer (mira, passada): um `THREE.Object3D` de verdade
 * já serve (é o caso de todo blueprint em `mechBlueprint.ts`). Só existe pra permitir um rig importado
 * (`importedMechRig.ts`) corrigir por baixo dos panos o eixo de giro real de um osso Mixamo — cujo eixo
 * local de bind não é garantido bater com o "gira pra frente" que `rotation.x` aqui sempre assumiu.
 */
export interface RigJoint {
  name: string;
  readonly rotation: { x: number; y: number };
  readonly position: THREE.Vector3;
  visible: boolean;
  getWorldPosition(target: THREE.Vector3): THREE.Vector3;
  localToWorld(target: THREE.Vector3): THREE.Vector3;
}

export interface LegRig {
  hip: RigJoint;
  knee: RigJoint;
}

/** Os gatilhos de um chassi no layout `layout` (índice em `MechStats.layouts`; fora da lista ou ausente = o padrão do chassi). */
export function triggersOf(stats: Pick<MechStats, 'triggers' | 'layouts'>, layout?: number): TriggerLayout {
  return stats.layouts?.[layout ?? 0]?.triggers ?? stats.triggers ?? DEFAULT_TRIGGERS;
}

/** Pontos articulados do modelo que a animação procedural controla. */
export interface MechRig {
  model: THREE.Object3D;
  pelvis: THREE.Object3D;
  torso: RigJoint;
  head: THREE.Object3D;
  leftArm: RigJoint;
  rightArm: RigJoint;
  leftLeg: LegRig;
  rightLeg: LegRig;
  muzzle: THREE.Object3D;
  /** Boca do lançador do braço esquerdo (sem ela, os foguetes saem do meio do braço). */
  leftMuzzle?: THREE.Object3D;
  /** Boca de cada lançador de ombro (só nos rigs com ombros). Sem elas, o tiro sai do torso. */
  shoulderMuzzles?: { right: THREE.Object3D; left: THREE.Object3D };
  thrusters: THREE.Object3D[];
  thrusterMaterial: THREE.MeshStandardMaterial;
  setDashVisual?: (active: boolean) => void;
  /** Chapa do escudo físico: `shown` = no braço e inteira; `raised` = botão 2. Só desenho (`mechBlueprint.ts`). */
  setGuardVisual?: (dt: number, shown: boolean, raised: boolean) => void;
  /** Atualiza sinais visuais de calor sem tocar na simulação. */
  setHeatVisual?: (dt: number, heat: number, overheated: boolean, coolingBoost: boolean) => void;
  /** Materiais do casco (por instância): piscam quando o Mech toma dano. */
  hullMaterials: THREE.MeshStandardMaterial[];
  hipHeight: number;
  /**
   * Só nos rigs com encaixe de arma nos pulsos (`weaponMount.ts`): monta no desenho as armas da montagem.
   * Idempotente e barata; o `MechBase` a chama ao nascer e a cada `equip`. Sem ela, a arma é parte do modelo.
   */
  mountWeapons?: (loadout: Loadout) => void;
  /**
   * Só nos rigs com morteiro de chuva de mísseis nas costas (`mechBlueprint.ts`): o nó da boca dele. Serve só ao desenho do
   * lançamento subindo (`MechBase.barrageMouth`); a boca de simulação do tiro continua a do dado/medida de sempre (G14).
   */
  barrageMouth?: THREE.Object3D;
  /**
   * Coice dos braços em **metros para trás** (+Z do Mech), direito e esquerdo. Só nos rigs cujos ossos não deixam
   * `position.z` do braço valer isso: num osso importado o eixo e a unidade são do arquivo, e o mesmo `position.z` dava
   * um salto de 1,9 m (direito, para baixo) e 2,7 m (esquerdo, para cima) no Gênesis. Sem ela, o `MechBase` escreve em `position.z` do braço.
   */
  setRecoil?: (right: number, left: number) => void;
}

/** Onde fica o "miolo" de cada parte, a partir do grupo dela no rig (para efeitos). */
const PART_CENTER: Record<MechPart, [number, number, number]> = {
  torso: [0, 0.95, 0],
  head: [0, 0.2, 0],
  leftArm: [0, -0.6, 0],
  rightArm: [0, -0.6, 0],
  leftLeg: [0, -0.55, 0],
  rightLeg: [0, -0.55, 0],
};

/** Qualquer coisa que diga onde está no mundo: um nó do desenho ou uma junta do rig. */
interface Located {
  getWorldPosition(target: THREE.Vector3): THREE.Vector3;
}

/** O nó do rig de onde o tiro de um encaixe nasce. Faltando a boca, o ponto de apoio mais perto: a junta do braço ou o torso. */
function mountNode(rig: MechRig, mount: MountId): Located {
  switch (mount) {
    case 'rightHand':
      return rig.muzzle;
    case 'leftHand':
      return rig.leftMuzzle ?? rig.leftArm;
    case 'rightShoulder':
      return rig.shoulderMuzzles?.right ?? rig.torso;
    case 'leftShoulder':
      return rig.shoulderMuzzles?.left ?? rig.torso;
  }
}

const _tint: Tint = { r: 0, g: 0, b: 0 };
const _wish = new THREE.Vector3();
const _desired = { x: 0, y: 0, z: 0 };
const _hit = new RAPIER.CharacterCollision();
const lerp = THREE.MathUtils.lerp;

export abstract class MechBase {
  readonly root = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  /**
   * Empurrão: velocidade horizontal **externa** (onda sônica, tranco de impacto) somada ao movimento do Mech sem passar pela aceleração dele, e que decai sozinha
   * (`SHOVE_DECAY`). O input não a cancela (senão o piloto anularia o empurrão na hora): ele só anda por cima. Só x e z. Regra de simulação (G1): decai no tick fixo.
   */
  readonly shove = new THREE.Vector3();
  /** Modificador temporário de regra (CTF: portador da bandeira corre a 85%; o dash não muda). */
  moveSpeedScale = 1;
  readonly modules: MechModules;
  yaw = 0;
  pitch = 0;
  grounded = false;
  dashCooldownLeft = 0;

  /** Pouso forte (velocidade vertical de impacto). */
  onLand?: (impactSpeed: number) => void;
  /**
   * Um pé tocou o chão andando (visual, no quadro; não é regra de jogo). `weight` 0..1: quanto do passo
   * cheio (velocidade atual ÷ máxima). Para som de passo e tremor de câmera.
   */
  onFootstep?: (weight: number) => void;
  /** Encostou em algo durante o dash (só dispara se `demolishOnDash`). */
  onDashImpact?: (collider: RAPIER.Collider, dir: THREE.Vector3) => void;

  collider!: RAPIER.Collider;
  private body!: RAPIER.RigidBody;
  private controller!: RAPIER.KinematicCharacterController;

  // Estado da simulação (pés do Mech) — o render interpola entre prev e curr.
  private readonly simPos = new THREE.Vector3();
  private readonly prevPos = new THREE.Vector3();
  private readonly feetOffset: number;

  private dashTimeLeft = 0;
  private readonly dashDir = new THREE.Vector3();
  private jumpsLeft: number;
  private walkPhase = 0;
  /** Lado do último passo (sinal do seno da passada): a troca de sinal é um pé tocando o chão. */
  private stepSide = 1;
  private recoil = 0;
  /** Para onde o comando do tick manda andar, no mundo (0..1 de intensidade). O pisão lê daqui. */
  readonly moveIntent = new THREE.Vector3();
  /** Calor do Mech: um dissipador para todas as armas (regra no tick fixo). */
  private readonly heatSink: HeatSink;
  /** Aviso de carga: simulação local ou bit recebido do servidor. */
  weaponCharging = false;
  readonly combatBoost = new CombatBoost();
  readonly energyShield = new EnergyShield();
  /** Escudo físico da mão esquerda (`MetalShield.ts`): o botão 2 levanta a chapa. */
  readonly metalShield = new MetalShield();
  /** Fogo, choque e gelo em andamento (`combat/StatusEffects.ts`); o `CombatSystem` aplica e o `Match` faz o tempo correr. */
  readonly status = new StatusSet();
  /** Armas nos braços: as de fábrica do chassi ou as montadas no Hangar (`equip`). */
  private armed: Loadout;
  private leftRecoil = 0;
  private readonly pelvisBaseRoll: number;
  private readonly rightArmBaseZ: number;
  private readonly leftArmBaseZ: number;
  private hitFlash = 0;
  /** O tranco do torso ao levar tiro (rad: inclina para trás/para a frente e torce de lado): só desenho, decai sozinho (`combat/reaction.ts`). Só x e y, os dois eixos que todo rig expõe (`RigJoint`). */
  private flinchPitch = 0;
  private flinchYaw = 0;
  /** A cor que o casco mostra agora (flash de dano + estado): só se escreve no material quando muda. */
  private shownR = 0;
  private shownG = 0;
  private shownB = 0;
  private visualTime = 0;
  /** Boca de cada encaixe em relação aos pés, com o Mech em repouso e virado para -Z (dado do chassi ou medida no rig). */
  private readonly muzzlesLocal: Record<MountId, THREE.Vector3> = {
    rightHand: new THREE.Vector3(),
    leftHand: new THREE.Vector3(),
    rightShoulder: new THREE.Vector3(),
    leftShoulder: new THREE.Vector3(),
  };
  /** A 1ª pessoa esconde a cabeça do próprio Mech; parte destruída também some. */
  private headVisibleByCamera = true;

  protected constructor(
    readonly stats: MechStats,
    protected readonly rig: MechRig,
    loadout: Loadout = stats.loadout,
  ) {
    this.root.add(rig.model);
    this.modules = { ...stats.maxModuleHealth };
    this.jumpsLeft = stats.maxJumps;
    this.pelvisBaseRoll = rig.pelvis.rotation.z;
    this.rightArmBaseZ = rig.rightArm.position.z;
    this.heatSink = new HeatSink(stats);
    this.status.resist = stats.statusResist ?? 1;
    this.armed = loadout;
    this.energyShield.equip(loadout.module);
    this.metalShield.equip(loadout.metalShield, stats.maxModuleHealth.leftArm);
    rig.mountWeapons?.(loadout);
    this.leftArmBaseZ = rig.leftArm.position.z;
    this.feetOffset = stats.height / 2 + CONTROLLER_OFFSET;
    this.root.updateMatrixWorld(true);
    for (const mount of MOUNTS) {
      const fixed = stats.muzzles?.[mount];
      if (fixed) this.muzzlesLocal[mount].set(fixed[0], fixed[1], fixed[2]);
      else mountNode(rig, mount).getWorldPosition(this.muzzlesLocal[mount]);
    }
  }

  /** Cria cápsula cinemática + character controller no mundo físico. */
  spawn(physics: PhysicsWorld, feet: THREE.Vector3): void {
    const s = this.stats;
    const world = physics.world;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(feet.x, feet.y + this.feetOffset, feet.z),
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(s.height / 2 - s.radius, s.radius),
      this.body,
    );

    const c = world.createCharacterController(CONTROLLER_OFFSET);
    c.setUp({ x: 0, y: 1, z: 0 });
    c.setMaxSlopeClimbAngle(MAX_CLIMB_ANGLE);
    c.setMinSlopeSlideAngle((35 * Math.PI) / 180);
    c.enableAutostep(s.stepHeight, 0.4, true);
    c.enableSnapToGround(0.6);
    this.controller = c;

    this.simPos.copy(feet);
    this.prevPos.copy(feet);
    this.root.position.copy(feet);
  }

  /**
   * Tira a cápsula e o character controller do mundo físico (jogador que saiu da sala). Depois disto o Mech
   * não pode mais ser simulado.
   */
  despawn(physics: PhysicsWorld): void {
    physics.world.removeCharacterController(this.controller);
    physics.world.removeRigidBody(this.body); // leva o colisor junto
  }

  /**
   * Pose vinda do servidor (multiplayer) para um robô remoto: posição dos pés, mira e a velocidade estimada entre
   * dois estados (anima as pernas). Nunca roda o character controller (G6); a cápsula só acompanha, para os tiros
   * pararem nele e a câmera não atravessar.
   */
  setNetPose(x: number, y: number, z: number, yaw: number, pitch: number, vx: number, vz: number, grounded: boolean): void {
    this.simPos.set(x, y, z);
    this.prevPos.copy(this.simPos);
    this.root.position.copy(this.simPos);
    this.velocity.set(vx, 0, vz);
    this.grounded = grounded;
    this.applyFacing(yaw, pitch);
    this.body.setNextKinematicTranslation({ x, y: y + this.feetOffset, z });
  }

  /**
   * Desloca o Mech (correção da previsão pelo servidor, no multiplayer): simulação, desenho e cápsula juntos.
   * A velocidade não muda: o movimento continua de onde o servidor diz que ele está.
   */
  nudge(dx: number, dy: number, dz: number): void {
    this.simPos.x += dx;
    this.simPos.y += dy;
    this.simPos.z += dz;
    this.prevPos.x += dx;
    this.prevPos.y += dy;
    this.prevPos.z += dz;
    const t = { x: this.simPos.x, y: this.simPos.y + this.feetOffset, z: this.simPos.z };
    this.body.setTranslation(t, true);
    this.body.setNextKinematicTranslation(t);
  }

  /**
   * Vida, calor e vivo vindos do servidor (multiplayer): a vida de cada parte chega como fração da máxima. Só o
   * servidor tira vida; aqui a parte some, o robô cai ou volta, como ele disser. `heat` null = manter o previsto.
   */
  applyNetVitals(parts: Readonly<Record<MechPart, number>>, heat: number | null, alive: boolean): void {
    const max = this.stats.maxModuleHealth;
    let changed = false;
    for (const p of PARTS) {
      const f = parts[p];
      const v = f <= 0 ? 0 : Math.max(1, Math.round(f * max[p]));
      if (this.modules[p] !== v) {
        this.modules[p] = v;
        changed = true;
      }
    }
    if (heat !== null) this.heatSink.heat = heat;
    if (!alive && this.root.visible) this.die();
    else if (alive && !this.root.visible) {
      this.collider.setEnabled(true);
      this.root.visible = true;
      changed = true;
    }
    if (changed) this.refreshParts();
  }

  /** Posição de render (interpolada entre ticks). Não use em regra de jogo: veja `simPosition`. */
  get position(): THREE.Vector3 {
    return this.root.position;
  }

  /** Pés na simulação (tick fixo). É o que regras de jogo e IA devem ler (G2). */
  get simPosition(): Readonly<THREE.Vector3> {
    return this.simPos;
  }

  /** Boca de um encaixe (padrão: a mão direita) calculada da simulação (posição + yaw), sem depender do render. */
  simMuzzle(target: THREE.Vector3, mount: MountId = 'rightHand'): THREE.Vector3 {
    const { x, y, z } = this.muzzlesLocal[mount];
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    return target.set(this.simPos.x + x * cos + z * sin, this.simPos.y + y, this.simPos.z - x * sin + z * cos);
  }

  /**
   * De onde a chuva de mísseis desse Mech sobe NO DESENHO: a boca do morteiro das costas, no mundo. `undefined` quando a arma
   * do botão secundário não é a chuva ou o desenho não tem o morteiro (aí vale a boca do tiro). É só visual: o servidor e a
   * simulação continuam com `simMuzzle`.
   */
  barrageMouth(target: THREE.Vector3): THREE.Vector3 | undefined {
    const mouth = this.rig.barrageMouth;
    if (!mouth || this.armed.secondary?.id !== 'barrage') return undefined;
    return mouth.getWorldPosition(target);
  }

  get isDashing(): boolean {
    return this.dashTimeLeft > 0;
  }

  /** Os estados que o Mech sofre agora (fogo, choque, gelo...), para o painel do alvo; lista reutilizada. */
  get statuses(): readonly StatusKind[] {
    return this.status.kinds();
  }

  /** 0 = acabou de usar, 1 = pronto. */
  get dashReadiness(): number {
    return 1 - this.dashCooldownLeft / this.stats.dashCooldown;
  }

  get thrusters(): readonly THREE.Object3D[] {
    return this.rig.thrusters;
  }

  /** Uma perna destruída = -50% velocidade; as duas = imóvel (torre estática). */
  get mobility(): number {
    const l = this.modules.leftLeg > 0;
    const r = this.modules.rightLeg > 0;
    return l && r ? 1 : l || r ? 0.5 : 0;
  }

  /** Cabeça destruída ativa o Blind Mode (a implementar no HUD). */
  get isBlind(): boolean {
    return this.modules.head <= 0;
  }

  /** Torso zerado = morto: sem colisão, invisível, esperando respawn. */
  get alive(): boolean {
    return this.modules.torso > 0;
  }

  /** Canhão de plasma fica no braço direito; superaquecido, trava até esfriar. */
  get canFirePrimary(): boolean {
    return this.alive && this.modules.rightArm > 0 && !this.heatSink.overheated && this.status.canAct;
  }

  /** Calor do Mech (0 a 1) e se as armas estão travadas por superaquecimento (HUD, IA). */
  get heat(): number {
    return this.heatSink.heat;
  }

  get overheated(): boolean {
    return this.heatSink.overheated;
  }

  get loadout(): Loadout {
    return this.armed;
  }

  /**
   * Troca as armas (Hangar). O jogo chama no renascimento: o Mech volta com a montagem nova e frio.
   * A montagem já vem validada (`hangar/loadout.ts`); aqui só se aplica.
   */
  /**
   * Troca as armas. No renascimento o Mech volta frio; trocando pelo Hangar no meio da partida (`keepHeat`), o calor
   * fica: a pausa não vira um jeito de esfriar.
   */
  equip(loadout: Loadout, keepHeat = false): void {
    this.energyShield.equip(loadout.module, keepHeat);
    this.metalShield.equip(loadout.metalShield, this.stats.maxModuleHealth.leftArm, keepHeat);
    this.armed = loadout;
    this.rig.mountWeapons?.(loadout);
    if (!keepHeat) this.heatSink.reset();
  }

  /** normal, QUENTE (≥ 70%) ou SUPERAQUECIDO (HUD, som, IA). */
  get heatState(): HeatState {
    return this.heatSink.state;
  }

  /** Parado e esfriando em dobro (o HUD mostra "RESFRIANDO"). */
  get coolingBoost(): boolean {
    return this.heatSink.coolingBoost;
  }

  /** Como os botões se ligam aos encaixes deste chassi, no layout que a montagem escolheu (`Loadout.layout`). */
  get triggers(): TriggerLayout {
    return triggersOf(this.stats, this.armed.layout);
  }

  /** O encaixe pode atirar agora: vivo, a parte do corpo dele de pé e as armas frias. Não olha se há arma nele. */
  canFireMount(mount: MountId): boolean {
    return this.alive && this.modules[MOUNT_PART[mount]] > 0 && !this.heatSink.overheated && this.status.canAct;
  }

  /**
   * O gatilho secundário pode atirar: há arma nele, ao menos um dos encaixes dele de pé (a mão esquerda, ou o torso, no
   * caso dos ombros) e as armas frias.
   */
  get canFireSecondary(): boolean {
    if (!this.alive || this.loadout.secondary === null || this.heatSink.overheated || !this.status.canAct) return false;
    return this.triggers.secondary.some((m) => this.modules[MOUNT_PART[m]] > 0);
  }

  /** Onde o encaixe está no mundo, pelo desenho (render). Para efeitos e para o tiro do jogador local. */
  mountWorldPosition(mount: MountId, target: THREE.Vector3): THREE.Vector3 {
    return mountNode(this.rig, mount).getWorldPosition(target);
  }

  muzzleWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    return this.mountWorldPosition('rightHand', target);
  }

  leftMuzzleWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    return this.mountWorldPosition('leftHand', target);
  }

  headWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    return this.rig.head.getWorldPosition(target);
  }

  setHeadVisible(visible: boolean): void {
    this.headVisibleByCamera = visible;
    this.refreshParts();
  }

  /** Centro de uma parte no mundo; center=false usa a junta (unidade/eixo de osso importado independentes). Efeitos a 10 Hz. */
  partWorldPosition(part: MechPart, target: THREE.Vector3, center = true): THREE.Vector3 {
    const r = this.rig;
    const node =
      part === 'head' ? r.head
      : part === 'leftArm' ? r.leftArm
      : part === 'rightArm' ? r.rightArm
      : part === 'leftLeg' ? r.leftLeg.knee
      : part === 'rightLeg' ? r.rightLeg.knee
      : r.torso;
    this.root.updateMatrixWorld(true);
    // A junta não depende da unidade/eixo local do osso importado.
    if (!center) return node.getWorldPosition(target);
    const [x, y, z] = PART_CENTER[part];
    return node.localToWorld(target.set(x, y, z));
  }

  /**
   * Acerto num ponto do mundo. A parte sai de onde o impacto caiu no referencial do Mech
   * (posição da simulação + yaw do torso), sem colisor extra por parte. Roda no tick fixo.
   */
  takeHit(point: THREE.Vector3, amount: number): DamageResult {
    const dx = point.x - this.simPos.x;
    const dz = point.z - this.simPos.z;
    const right = dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw);
    const part = partAt(right, point.y - this.simPos.y, this.stats.height, this.stats.radius);
    return this.damagePart(part, amount);
  }

  /** Conserto (técnico ou zona de cura): devolve vida à parte mais avariada que ainda existe. Devolve quanto consertou. */
  repair(amount: number): number {
    if (!this.alive) return 0;
    const used = repairModules(this.modules, this.stats.maxModuleHealth, amount);
    // O que sobra do conserto vai para a chapa do escudo físico (o braço vem antes: sem braço, sem escudo).
    return used + this.metalShield.restore(amount - used);
  }

  /** Botão 2 com o escudo físico na mão esquerda: levanta a chapa neste tick (sem escudo, nada acontece). */
  guard(held: boolean): void {
    this.metalShield.step(held && this.alive, this.modules.leftArm > 0);
  }

  /**
   * Defesas antes do dano: o campo de energia na frente, depois a chapa do escudo físico (só com o braço esquerdo
   * inteiro). (x, y, z): do centro do robô para a fonte do impacto, em mundo. Devolve o dano que chega ao corpo.
   */
  defend(damage: number, type: DamageType, x: number, y: number, z: number): number {
    const left = this.energyShield.absorb(damage, x, y, z, this.yaw, this.pitch);
    return this.modules.leftArm > 0 ? this.metalShield.absorb(left, type, x, z, this.yaw) : left;
  }

  /** Ventilação externa (zona de resfriamento): tira calor direto, sem exigir estar parado nem sem tiro recente. */
  vent(amount: number): void {
    if (!this.alive) return;
    this.heatSink.ventExternal(amount);
  }

  damagePart(part: MechPart, amount: number): DamageResult {
    // O congelado leva mais dano (`StatusSet.damageTaken`).
    const result = applyDamage(this.modules, part, amount * this.status.damageTaken);
    if (result.applied > 0) {
      this.hitFlash = 1;
      // Tomar tiro esquenta a blindagem (sem segurar o resfriamento: não é ação do Mech).
      this.heatSink.add(result.applied * this.stats.heatPerDamage, false);
    }
    if (result.partDestroyed) this.refreshParts();
    if (result.killed) this.die();
    return result;
  }

  /** Volta inteiro em `feet`: módulos cheios, colisão ligada, peças visíveis. */
  /** EMP: não segura o resfriamento e não tira mobilidade diretamente. */
  absorbEmp(amount: number): void {
    if (this.alive) this.heatSink.add(Math.max(0, amount), false);
  }

  /**
   * Dano por segundo de um estado (queimadura, choque): tira do torso, sem piscar o casco a cada tick e sem o calor de blindagem do
   * acerto, e sem o bônus de dano do congelado. Quem decide quem matou é o `CombatSystem`.
   */
  statusDamage(amount: number): DamageResult {
    const result = applyDamage(this.modules, 'torso', amount);
    if (result.killed) this.die();
    return result;
  }

  /** O fogo esquenta o Mech e **não o deixa resfriar** enquanto queima. */
  absorbBurn(amount: number): void {
    if (this.alive) this.heatSink.add(Math.max(0, amount), true);
  }

  respawn(feet: THREE.Vector3): void {
    this.status.reset();
    this.energyShield.reset();
    this.metalShield.reset();
    Object.assign(this.modules, this.stats.maxModuleHealth);
    this.heatSink.reset();
    this.weaponCharging = false;
    this.combatBoost.reset();
    this.energyShield.stop();
    this.velocity.set(0, 0, 0);
    this.shove.set(0, 0, 0);
    this.dashTimeLeft = 0;
    this.dashCooldownLeft = 0;
    this.jumpsLeft = this.stats.maxJumps;
    this.grounded = false;
    this.hitFlash = 0;
    this.simPos.copy(feet);
    this.prevPos.copy(feet);
    this.root.position.copy(feet);
    const t = { x: feet.x, y: feet.y + this.feetOffset, z: feet.z };
    this.body.setTranslation(t, true);
    this.body.setNextKinematicTranslation(t);
    this.collider.setEnabled(true);
    this.root.visible = true;
    this.refreshParts();
  }

  /**
   * Retira uma unidade pré-alocada da simulação sem destruí-la. Modos por ondas usam isto para manter
   * um pool fixo de Mechs: sem `new`, sem corpo físico novo e sem render enquanto a unidade está fora.
   */
  deactivate(): void {
    this.modules.torso = 0;
    this.die();
    this.refreshParts();
  }

  private die(): void {
    this.status.reset();
    this.combatBoost.reset();
    this.energyShield.stop();
    this.metalShield.raised = false;
    this.collider.setEnabled(false);
    this.root.visible = false;
    this.velocity.set(0, 0, 0);
    this.shove.set(0, 0, 0);
    this.dashTimeLeft = 0;
  }

  /** Parte destruída some do modelo (quem cuida do mundo transforma o pedaço em destroço). */
  private refreshParts(): void {
    const m = this.modules;
    const r = this.rig;
    r.head.visible = this.headVisibleByCamera && m.head > 0;
    r.leftArm.visible = m.leftArm > 0;
    r.rightArm.visible = m.rightArm > 0;
    r.leftLeg.knee.visible = m.leftLeg > 0;
    r.rightLeg.knee.visible = m.rightLeg > 0;
  }

  /** Um tiro do canhão principal (no tick fixo): recuo na animação e calor no Mech. */
  onFire(): void {
    this.onFireMount('rightHand', this.loadout.primary);
  }

  /** Um disparo do gatilho secundário: recuo do braço esquerdo (se for dele) e o calor do lançamento. */
  onFireSecondary(): void {
    if (this.triggers.secondary.includes('leftHand')) this.leftRecoil = 1;
    if (this.loadout.secondary) this.heatSink.add(this.loadout.secondary.heatPerShot);
  }

  /**
   * Um tiro que saiu de `mount` com `w` (no tick fixo): o calor entra no dissipador do Mech e a mão que atirou recua.
   * Ombro não recua (o lançador é preso ao torso).
   */
  onFireMount(mount: MountId, w: WeaponStats): void {
    if (mount === 'rightHand') this.recoil = 1;
    else if (mount === 'leftHand') this.leftRecoil = w.kind === 'ammo' ? 1 : 0.7;
    this.heatSink.add(w.heatPerShot);
  }

  /**
   * Orientação do torso/braços. Separada da simulação: roda na taxa do render
   * para a mira ficar instantânea (e em Mechs remotos vem do snapshot de rede).
   */
  applyFacing(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = pitch;
    const r = this.rig;
    this.root.rotation.y = yaw;
    r.torso.rotation.x = pitch * 0.25 + this.flinchPitch;
    r.rightArm.rotation.x = pitch * 0.75;
    r.leftArm.rotation.x = pitch * 0.75;
  }

  /**
   * Empurra o Mech na direção (`dirX`, `dirZ`) (não precisa ser unitária) com `speed` m/s, a menos do que ele resiste: **o robô grande empurra menos** (a resistência é 1,3 m
   * de raio ÷ o raio do Mech, de 25% a 100%: o Colossus quase não sai do lugar, o andróide voa). Soma no `shove` atual com o teto de `SHOVE_MAX` m/s: dois empurrões
   * juntos (dois ombros sônicos) não viram um arremesso. Morto não é empurrado.
   */
  push(dirX: number, dirZ: number, speed: number): void {
    if (!this.alive || speed <= 0) return;
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-6) return;
    const k = (speed * Math.min(1, Math.max(0.25, 1.3 / this.stats.radius))) / len;
    this.shove.x += dirX * k;
    this.shove.z += dirZ * k;
    const m = Math.hypot(this.shove.x, this.shove.z);
    if (m > SHOVE_MAX) this.shove.multiplyScalar(SHOVE_MAX / m);
  }

  /**
   * Um tranco no torso (só desenho): joga o torso para onde o tiro andava (`dirX`, `dirZ`, no mundo, não precisa ser unitária), `amount` rad, até `FLINCH_MAX`. Tiro de frente
   * inclina o torso para trás; de lado, torce o torso para o lado. Decai sozinho em `animate`. Morto não treme.
   */
  flinch(dirX: number, dirZ: number, amount: number): void {
    if (!this.alive || amount <= 0) return;
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-6) return;
    const x = dirX / len;
    const z = dirZ / len;
    const s = Math.sin(this.yaw);
    const co = Math.cos(this.yaw);
    // Atrás do Mech = (sen yaw, 0, cos yaw); a direita dele = (cos yaw, 0, -sen yaw).
    const back = x * s + z * co;
    const right = x * co - z * s;
    this.flinchPitch = Math.min(FLINCH_MAX, Math.max(-FLINCH_MAX, this.flinchPitch + amount * back));
    this.flinchYaw = Math.min(FLINCH_MAX, Math.max(-FLINCH_MAX, this.flinchYaw - amount * right));
  }

  /** O tranco que o torso mostra agora (rad, o maior dos dois eixos): para o teste e para quem quiser reagir (a câmera). */
  get flinchAmount(): number {
    return Math.max(Math.abs(this.flinchPitch), Math.abs(this.flinchYaw));
  }

  /** Um tick de simulação (60 Hz). Determinístico dado o input. */
  fixedUpdate(input: MechInput, dt: number): void {
    if (!this.alive) return;
    this.combatBoost.fixedUpdate(dt);
    this.energyShield.step(dt, input.shield === true);
    const s = this.stats;
    const vel = this.velocity;
    // Correr esquenta na proporção da velocidade no chão (a do tick anterior; no ar não conta).
    this.heatSink.fixedUpdate(dt, this.grounded ? Math.hypot(vel.x, vel.z) / s.moveSpeed : 0);
    const overheated = this.heatSink.overheated;
    this.dashCooldownLeft = Math.max(0, this.dashCooldownLeft - dt);

    const sin = Math.sin(input.moveYaw);
    const cos = Math.cos(input.moveYaw);
    _wish.set(cos * input.moveX - sin * input.moveZ, 0, -sin * input.moveX - cos * input.moveZ);
    if (_wish.lengthSq() > 1) _wish.normalize();
    this.moveIntent.copy(_wish);

    // Superaquecido: 3/4 da velocidade (dá para fugir), sem pulo nem dash (os sistemas entram em emergência).
    // Chapa do escudo levantada: anda mais devagar (o dash continua, para sair da linha de tiro).
    // Choque e gelo seguram a velocidade; atordoado ou congelado = 0 (nem anda, nem pula, nem dá dash: `mobility > 0` abaixo).
    const mobility = this.mobility * (overheated ? OVERHEAT_SPEED : 1) * (this.metalShield.raised ? RAISED_SPEED : 1) * this.status.speedMultiplier;

    if (input.dash && this.dashCooldownLeft <= 0 && mobility > 0 && !overheated) {
      this.heatSink.add(s.heatDash);
      if (_wish.lengthSq() > 0.01) this.dashDir.copy(_wish).normalize();
      else this.dashDir.set(-Math.sin(input.yaw), 0, -Math.cos(input.yaw));
      vel.x = this.dashDir.x * s.dashSpeed;
      vel.z = this.dashDir.z * s.dashSpeed;
      if (vel.y < 0) vel.y = 0;
      this.dashTimeLeft = s.dashDuration;
      this.dashCooldownLeft = s.dashCooldown;
    }

    if (this.dashTimeLeft > 0) {
      // Durante o dash mantém o impulso e ignora gravidade.
      this.dashTimeLeft -= dt;
    } else {
      const maxDelta = (this.grounded ? s.groundAccel : s.airAccel) * dt;
      let dx = _wish.x * s.moveSpeed * this.moveSpeedScale * mobility - vel.x;
      let dz = _wish.z * s.moveSpeed * this.moveSpeedScale * mobility - vel.z;
      const len = Math.hypot(dx, dz);
      if (len > maxDelta) {
        dx *= maxDelta / len;
        dz *= maxDelta / len;
      }
      vel.x += dx;
      vel.z += dz;
      vel.y -= MECH_GRAVITY * dt;
    }

    if (input.jump && this.jumpsLeft > 0 && mobility > 0 && !overheated) {
      this.heatSink.add(s.heatJump);
      vel.y = s.jumpVelocity;
      this.jumpsLeft--;
      this.grounded = false;
    }

    // Character controller: desliza em paredes, sobe rampas/degraus.
    // Ignora corpos dinâmicos (destroços são só cosméticos): o movimento não depende deles,
    // então cliente e servidor calculam o mesmo trajeto. O corpo cinemático ainda empurra
    // os destroços no world.step().
    const controller = this.controller;
    _desired.x = (vel.x + this.shove.x) * dt;
    // Apoiado e sem velocidade para cima, não se pede movimento vertical: a gravidade somada a cada tick (−9 mm) caía dentro da margem de
    // 5 cm do chão, o controller a devolvia em vez de segurar a cápsula e o Mech parado descia ~0,5 m/s, até atravessar o chão. O
    // `snapToGround` mantém o contato (rampa e degrau descem igual); sem chão embaixo, `grounded` cai e a gravidade volta no tick seguinte.
    // Medido e provado em `MechParado.test.ts` (achado de 29/09: o Colossus parado perdia 2 m em 3 s).
    _desired.y = this.grounded && vel.y <= 0 ? 0 : vel.y * dt;
    _desired.z = (vel.z + this.shove.z) * dt;
    // O empurrão decai (e depois de um bom tempo vira zero de vez, para não deixar um resto de 1e-30 vivo).
    const keep = Math.exp(-SHOVE_DECAY * dt);
    this.shove.x *= keep;
    this.shove.z *= keep;
    if (Math.abs(this.shove.x) + Math.abs(this.shove.z) < 0.02) this.shove.set(0, 0, 0);
    controller.computeColliderMovement(this.collider, _desired, IGNORE_DEBRIS);
    let m = controller.computedMovement();
    if (this.grounded && this.unstickFromGround(m)) {
      controller.computeColliderMovement(this.collider, _desired, IGNORE_DEBRIS);
      m = controller.computedMovement();
    }

    // Só parede e teto freiam: tira da velocidade a parte que entra neles. Chão e rampa
    // nunca freiam a horizontal (o controller já desvia o movimento ao longo deles).
    const demolish = this.isDashing && s.demolishOnDash ? this.onDashImpact : undefined;
    for (let i = 0; i < controller.numComputedCollisions(); i++) {
      const hit = controller.computedCollision(i, _hit);
      if (!hit) continue;
      if (demolish && hit.collider) demolish(hit.collider, this.dashDir);
      const n = hit.normal1;
      if (n.y >= WALL_NORMAL_Y) continue;
      const into = vel.x * n.x + vel.y * n.y + vel.z * n.z;
      if (into < 0) {
        vel.x -= n.x * into;
        vel.y -= n.y * into;
        vel.z -= n.z * into;
      }
    }

    const wasGrounded = this.grounded;
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && vel.y <= 0) {
      if (!wasGrounded && -vel.y > HARD_LANDING_SPEED) this.onLand?.(-vel.y);
      vel.y = 0;
      this.jumpsLeft = s.maxJumps;
    }

    this.prevPos.copy(this.simPos);
    this.simPos.x += m.x;
    this.simPos.y += m.y;
    this.simPos.z += m.z;
    this.body.setNextKinematicTranslation({
      x: this.simPos.x,
      y: this.simPos.y + this.feetOffset,
      z: this.simPos.z,
    });
  }

  /**
   * Contorno de imprecisão do Rapier: parado na margem (offset) do chão, um movimento com a
   * gravidade empurrando para baixo às vezes volta zerado e o Mech engasga. Nesse tick (raro,
   * menos de 1 por segundo) troca `_desired` pela tangente ao chão, levemente afastada dele, e
   * pede para refazer. Retorna true se trocou. Diagnóstico no HISTORICO_DE_DECISOES (2026-09-23).
   */
  private unstickFromGround(m: RAPIER.Vector): boolean {
    const want = Math.hypot(_desired.x, _desired.z);
    if (_desired.y > 0 || want < 1e-3 || Math.hypot(m.x, m.z) >= want * 0.5) return false;
    if (this.controller.numComputedCollisions() === 0) return false;
    const n = this.controller.computedCollision(0, _hit)?.normal1;
    if (!n || n.y < WALL_NORMAL_Y) return false; // parou numa parede de verdade
    const into = _desired.x * n.x + _desired.y * n.y + _desired.z * n.z - UNSTICK_LIFT;
    _desired.x -= n.x * into;
    _desired.y -= n.y * into;
    _desired.z -= n.z * into;
    return true;
  }

  /** Interpola a posição entre ticks e anima. `alpha` = fração do próximo tick. */
  /** O rig já desenha a ventilação; evita duplicar vapor no pool do mundo. */
  get hasHeatVisual(): boolean { return this.rig.setHeatVisual !== undefined; }

  /** Interpola a posição entre ticks e anima. `alpha` = fração do próximo tick. */
  render(dt: number, alpha: number): void {
    if (!this.alive) return;
    this.root.position.lerpVectors(this.prevPos, this.simPos, alpha);
    this.animate(dt);
  }

  /** Animação procedural: passada das pernas, bob do quadril, recuo do canhão. */
  private animate(dt: number): void {
    const r = this.rig;
    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const amt = this.grounded ? Math.min(1, hSpeed / this.stats.moveSpeed) : 0;
    const air = this.grounded ? 0 : 1;
    const k = 1 - Math.exp(-dt * 14);

    // Passada proporcional à perna: o Mech de 5,3 m dá passos lentos e pesados; o andróide, curtos e rápidos.
    this.walkPhase += (hSpeed * dt * STRIDE) / this.stats.height;
    const sw = Math.sin(this.walkPhase);
    const cw = Math.cos(this.walkPhase);
    const side = sw >= 0 ? 1 : -1;
    if (side !== this.stepSide) {
      this.stepSide = side;
      // Evita o passo extra ao final do movimento quando a velocidade decai e o jogador já soltou o teclado.
      if (amt > 0.25 && (this.moveIntent.lengthSq() > 0 || hSpeed > this.stats.moveSpeed * 0.5)) {
        this.onFootstep?.(amt);
      }
    }

    const lean = legDamageLean(this.modules, this.stats.maxModuleHealth);
    const leftStride = 1 - Math.max(0, lean) * 0.65;
    const rightStride = 1 - Math.max(0, -lean) * 0.65;
    // A passada e o joelho são do chassi (stats.gait): o titã anda curto e com o joelho bem dobrado.
    const gait = this.stats.gait ?? DEFAULT_GAIT;
    const lHip = sw * gait.hip * amt * leftStride + air * 0.55;
    const rHip = -sw * gait.hip * amt * rightStride - air * 0.25;
    const lKnee = -Math.max(0, cw) * gait.knee * amt - air * 1.0;
    const rKnee = -Math.max(0, -cw) * gait.knee * amt - air * 0.4;

    r.leftLeg.hip.rotation.x = lerp(r.leftLeg.hip.rotation.x, lHip, k);
    r.rightLeg.hip.rotation.x = lerp(r.rightLeg.hip.rotation.x, rHip, k);
    r.leftLeg.knee.rotation.x = lerp(r.leftLeg.knee.rotation.x, lKnee, k);
    r.rightLeg.knee.rotation.x = lerp(r.rightLeg.knee.rotation.x, rKnee, k);

    r.pelvis.position.y = r.hipHeight - Math.abs(sw) * (0.12 + Math.abs(lean) * 0.12) * amt;
    r.pelvis.rotation.z = this.pelvisBaseRoll + lean * (0.06 + Math.abs(sw) * 0.08) * amt;
    // O tranco do tiro: o torso volta sozinho (decai a e^-9 por segundo) e soma por cima da mira e do balanço da passada.
    const back = Math.exp(-dt * FLINCH_DECAY);
    this.flinchPitch = Math.abs(this.flinchPitch) < 1e-4 ? 0 : this.flinchPitch * back;
    this.flinchYaw = Math.abs(this.flinchYaw) < 1e-4 ? 0 : this.flinchYaw * back;
    r.torso.rotation.x = this.pitch * 0.25 + this.flinchPitch;
    r.torso.rotation.y = sw * 0.06 * amt + this.flinchYaw;

    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.leftRecoil = Math.max(0, this.leftRecoil - dt * 5);
    const kickRight = this.recoil * 0.35;
    const kickLeft = this.leftRecoil * 0.5;
    if (r.setRecoil) r.setRecoil(kickRight, kickLeft);
    else {
      r.rightArm.position.z = this.rightArmBaseZ + kickRight;
      r.leftArm.position.z = this.leftArmBaseZ + kickLeft;
    }

    // Canhão-torre (Colossus e afins): gira devagar sozinho, decorativo — a mira de verdade continua
    // nos braços. G4: um if e uma soma, sem alocação; só roda quando o blueprint marcou `head.turret`.
    if (r.head.userData.turret) r.head.rotation.y += dt * 0.35;

    if (r.setDashVisual) r.setDashVisual(this.isDashing);
    else r.thrusterMaterial.emissiveIntensity = this.isDashing ? 14 : 2;

    r.setHeatVisual?.(dt, this.heat, this.overheated, this.coolingBoost);
    r.setGuardVisual?.(dt, this.metalShield.intact && this.modules.leftArm > 0, this.metalShield.raised);

    // Cor do casco: o flash de dano (vermelho, ~0,17 s) e a cor do estado (gelo, chamas, choque) somam na luz própria do casco.
    // Só escreve no material quando a cor muda (parado e sem estado, nunca).
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    this.visualTime += dt;
    statusTint(this.status, this.visualTime, _tint);
    const fr = this.hitFlash * 1.4 + _tint.r;
    const fg = this.hitFlash * 0.35 + _tint.g;
    const fb = this.hitFlash * 0.2 + _tint.b;
    if (fr !== this.shownR || fg !== this.shownG || fb !== this.shownB) {
      this.shownR = fr;
      this.shownG = fg;
      this.shownB = fb;
      for (const m of r.hullMaterials) {
        const setTint = m.userData.setTint;
        if (typeof setTint === 'function') setTint(fr, fg, fb);
        else m.emissive.setRGB(fr, fg, fb);
      }
    }
  }
}
