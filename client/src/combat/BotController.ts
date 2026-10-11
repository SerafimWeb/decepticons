import * as THREE from 'three';
import { CoverSeeking } from './CoverSeeking';
import { ObstacleSteering } from './ObstacleSteering';
import { mulberry32 } from '../core/rng';
import type { Difficulty, Persona } from '../core/Settings';
import type { MechBase, MechInput } from '../entities/MechBase';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { setLocalMove, turnToward, wrapAngle, yawOf } from './steer';

export type SquadOrder = 'follow' | 'focus' | 'hold';
export type BotState = 'patrol' | 'chase' | 'attack' | 'retreat' | 'cool' | 'stalk' | 'search';

/** Como o bot pilota: tempo de reação, mira e ritmo de tiro. Um conjunto por nível de dificuldade. */
export interface BotSkill {
  /** Segundos entre ver o alvo e reagir (começar a caçar e atirar). */
  reactionS: number;
  /** Erro máximo da mira em radianos, sorteado a cada tiro em yaw e em pitch. */
  aimErrorRad: number;
  /** 0 = mira onde o alvo está; 1 = antecipa todo o movimento dele. */
  leadFactor: number;
  /** Velocidade de giro do torso (rad/s): o bot não vira instantaneamente. */
  turnRate: number;
  burstShots: number;
  burstPauseS: number;
  /**
   * Lê a mira: com o torso do alvo apontado para ele por um tempo de reação, chance de trocar o lado do zigue-zague
   * (0 = não lê). É percepção honesta: o torso do adversário está à vista de qualquer piloto.
   */
  readAim: number;
  /** Quando lê a mira, chance de a troca de lado vir com dash. */
  jukeDash: number;
}

/** Aprovado pelo dono jogando ("grau de dificuldade considerável, está bom assim", 2026-09-24). */
export const BOT_SKILL_NORMAL: BotSkill = {
  reactionS: 0.5,
  aimErrorRad: 0.045,
  leadFactor: 0.5,
  turnRate: 3.0,
  burstShots: 4,
  burstPauseS: 0.9,
  readAim: 0.6,
  jukeDash: 0.25,
};

export const BOT_SKILLS: Record<Difficulty, BotSkill> = {
  facil: { reactionS: 0.9, aimErrorRad: 0.085, leadFactor: 0.15, turnRate: 2.2, burstShots: 3, burstPauseS: 1.4, readAim: 0, jukeDash: 0 },
  normal: BOT_SKILL_NORMAL,
  dificil: { reactionS: 0.3, aimErrorRad: 0.028, leadFactor: 0.85, turnRate: 4.0, burstShots: 5, burstPauseS: 0.7, readAim: 1, jukeDash: 0.6 },
};

const VISION_RANGE = 90;
/** Em patrulha só vê à frente (±110°); mais perto que isto, "ouve" em qualquer direção. */
const VISION_HALF_ANGLE = 1.9;
const HEARING_RADIUS = 14;
/** Linha de visão a 10 Hz, não a cada tick: 1 raio por alvo a cada 0,1 s. */
const LOS_INTERVAL_S = 0.1;
/**
 * Jeito de lutar de cada tipo de robô (além da dificuldade): a que distância ataca, quão perto aceita
 * ficar, de quanto em quanto tempo muda o lado do zigue-zague e a chance de desviar com dash ao mudar.
 */
export interface BotProfile {
  attackRange: number;
  keepMinRange: number;
  strafeMinS: number;
  strafeMaxS: number;
  dodgeChance: number;
  /** Multiplica o erro de mira da dificuldade (1 = como está; maior = mira mais solta). */
  aimErrorScale: number;
  /** Arma corpo a corpo: vai colado no alvo e circula em volta dele, cortando. */
  melee?: boolean;
  /** Não lê a mira nem cerca: a máquina de cerco segura a posição (o giro lento é a fraqueza dela). */
  steady?: boolean;
}

/** Mech (escala 2): ataca de longe, anda de lado devagar, não desvia com dash. */
export const MECH_PROFILE: BotProfile = { attackRange: 38, keepMinRange: 14, strafeMinS: 1, strafeMaxS: 2.2, dodgeChance: 0, aimErrorScale: 1 };
/**
 * Andróide (escala 1) com motosserra: a 18 m parte para cima, gruda no alvo, circula em volta cortando
 * as pernas e desvia com dash; difícil de acertar, mas quem chega perto de um Mech corre o risco do pisão.
 */
export const ANDROID_PROFILE: BotProfile = { attackRange: 18, keepMinRange: 0, strafeMinS: 0.35, strafeMaxS: 0.9, dodgeChance: 0.35, aimErrorScale: 2.2, melee: true };
/**
 * Colossus (escala 3, cerco): domina o espaço de longe e **não desvia nem corre** — o giro lento é a fraqueza
 * que a ficha promete ("circular e expor o flanco"). Chegar perto é a resposta do jogador; ficar no aberto
 * na frente dele, não.
 *
 * `aimErrorScale: 1.8` é decisão de **equilíbrio** (dono, 29/09: *"não pode ser absurdamente forte... pra que
 * possamos ter combates épicos e com inteligência"*): a máquina é grande, a torre é lenta e os tiros saem
 * espalhados. O dano por tiro continua sendo o do plasma de qualquer rebelde — o que o Colossus tem de
 * diferente não é peso de fogo, é vida e espaço. Quem se expõe muito tempo morre; quem circula, vence.
 */
export const BOSS_PROFILE: BotProfile = { attackRange: 46, keepMinRange: 24, strafeMinS: 2.6, strafeMaxS: 4.2, dodgeChance: 0, aimErrorScale: 1.8, steady: true };
/**
 * Personalidade do piloto (dono, 25/09: "um mais brabo, outro mais manso, outro fujão que ataca na
 * covardia"). Por cima do tipo de robô (`BotProfile`) e da dificuldade (`BotSkill`): muda quão perto
 * luta, quando recua, quando para para esfriar, quanto atira e se só ataca pelas costas.
 */
export interface BotPersona {
  id: Persona;
  /** Multiplica a distância de ataque do tipo de robô (< 1 chega mais perto). */
  rangeScale: number;
  /** Com o torso abaixo desta fração, recua. */
  retreatAt: number;
  /** Com o calor nesta fração, para para esfriar (1 = só quando superaquece). */
  coolAt: number;
  /** Multiplica a rajada e divide a pausa entre rajadas (> 1 atira mais). */
  aggression: number;
  /** Só ataca com brecha: o alvo de costas, avariado ou superaquecido; pego de frente, foge. */
  ambush: boolean;
  /** Prioridade na vaga de ataque (o diretor dá a vaga aos maiores primeiro). */
  priority: number;
}

export const PERSONAS: Record<Persona, BotPersona> = {
  /** O de sempre (aprovado pelo dono em 24/09): troca tiros de média distância e recua avariado. */
  soldado: { id: 'soldado', rangeScale: 1, retreatAt: 0.35, coolAt: 0.9, aggression: 1, ambush: false, priority: 1 },
  /** Vem para cima, quase não recua e atira até ferver. */
  brabo: { id: 'brabo', rangeScale: 0.55, retreatAt: 0.12, coolAt: 1, aggression: 1.5, ambush: false, priority: 3 },
  /** Fica longe, atira menos, recua cedo e esfria antes de ferver. */
  manso: { id: 'manso', rangeScale: 1.45, retreatAt: 0.55, coolAt: 0.7, aggression: 0.6, ambush: false, priority: 0 },
  /** Espreita pelas costas e só ataca com brecha; visto de frente, foge com dash. */
  fujao: { id: 'fujao', rangeScale: 1, retreatAt: 0.6, coolAt: 0.8, aggression: 1.2, ambush: true, priority: 2 },
};

/** Sem a vaga de ataque, o bot espera nesta fração a mais da distância de ataque, sem atirar. */
const HOLD_SCALE = 1.4;
/** Emboscada: o alvo está "de costas" se o bot estiver a mais que isto da frente dele (~100°). */
const AMBUSH_BACK_RAD = 1.75;
/** Emboscada: o alvo "viu" o bot se o bot estiver dentro disto da frente dele (~35°) e perto. */
const AMBUSH_SEEN_RAD = 0.6;
const AMBUSH_SEEN_DIST = 60;
/** Emboscada: brecha também quando o alvo está com o torso abaixo disto. */
const AMBUSH_WEAK = 0.5;
/** Espreitando, fica a esta distância, atrás do alvo. */
const STALK_DIST = 32;
/** Depois de fugir de uma emboscada, espera isto para fugir de novo. */
const AMBUSH_RETREAT_COOLDOWN_S = 4;
const FIRE_RANGE = 75;
/** Só atira com o torso apontado para o alvo dentro deste ângulo. */
const FIRE_CONE_RAD = 0.12;
const LOSE_TARGET_S = 2.5;
const WAYPOINT_REACHED = 4;
const RETREAT_S = 3;
const RETREAT_COOLDOWN_S = 8;
/** Esfriando (o gatilho é o `coolAt` da personalidade), volta a lutar abaixo disto. */
const COOLED_AT = 0.45;
const STUCK_CHECK_S = 0.5;
const STUCK_DIST = 0.8;
const SIDESTEP_S = 0.8;
/** Olhos na cabeça; mira no meio do torso (zonas de dano em combat/damage.ts). */
const EYE_HEIGHT = 0.85;
const AIM_HEIGHT = 0.62;
/**
 * Caça (11/10): ao perder o alvo de vista, projeta o caminho dele por até isto (s) e no máximo esta distância (m):
 * vai aonde ele deve estar, não aonde estava. Chegando lá sem achar, vasculha em volta por `SEARCH_S`.
 */
const SEARCH_LEAD_S = 1.2;
const SEARCH_LEAD_MAX = 14;
const SEARCH_S = 3;
/** Caçando às cegas há mais disto, desiste do caminho e vasculha onde está (rota bloqueada, alvo escondido). */
const CHASE_BLIND_S = 10;
/** Leitura da mira: o alvo "aponta para o bot" com o torso dentro disto (~7°) e ao alcance de tiro. */
const AIM_READ_RAD = 0.12;
/** Depois de ler a mira (reagindo ou não), espera isto antes de ler de novo. */
const JUKE_COOLDOWN_S = 1.6;
/** Quem acertou o bot há menos disto vira o alvo, se estiver à vista: revida em quem atira, não no mais perto. */
const THREAT_MEMORY_S = 4;
/** Rádio do clã: com o alvo à vista, passa a posição dele aos companheiros a cada tanto (quem ouve é o `BotSystem`). */
const RADIO_INTERVAL_S = 1.5;
/** Cerco: dentro deste ângulo do flanco (rad) o bot já chegou e só corrige devagar. */
const FLANK_SETTLED_RAD = 0.2;

const _eye = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _move = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _goal = new THREE.Vector3();
const _probe = new THREE.Vector3();


/**
 * IA de um Mech inimigo. Produz o mesmo `MechInput` que o teclado do jogador, e um pedido de
 * tiro; quem executa é o `BotSystem`. Tudo sai da simulação (posições do tick, RNG com semente),
 * nunca do render, então o mesmo cenário dá sempre o mesmo resultado (G2) e o servidor poderá
 * rodar os mesmos bots.
 * Custo por bot por tick: algumas contas de vetor; 1 raycast por alvo a 10 Hz.
 */
export class BotController {
  readonly input: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
  /** Direção do tiro deste tick, válida quando `wantsToFire`. */
  readonly shotDir = new THREE.Vector3();
  wantsToFire = false;
  state: BotState = 'patrol';
  /**
   * Vaga de ataque (o diretor do `BotSystem` distribui; sem diretor, sempre tem): sem ela o bot espera
   * afastado, sem atirar. É o que impede todos de caírem em cima do jogador ao mesmo tempo.
   */
  hasToken = true;
  /** Há quanto tempo segura a vaga (o diretor passa a vez depois de um turno). */
  tokenHeld = 0;
  /** Há quanto tempo espera a vaga (fila justa: quem espera há mais tempo vai primeiro). */
  tokenWait = 0;
  /**
   * Cerco (o diretor do `BotSystem` dá): sem a vaga, espera no flanco do alvo, nesta direção vista do alvo
   * (rad; 0 = +Z), em vez de ficar na mesma linha de quem está atacando.
   */
  hasFlank = false;
  flankBearing = 0;
  /** Rádio do clã: o alvo que este bot está vendo, para passar aos companheiros (o `BotSystem` lê e limpa). */
  radioReport: MechBase | null = null;
  /** Primeiro contato visual (saiu da patrulha ou da varredura por ter visto): vira aviso na tela. */
  radioContact = false;
  /** Quantas vezes leu a mira do alvo e trocou de lado (testes e telemetria). */
  jukes = 0;

  /** Escolta acompanha o líder; a lista do time determina quem pode ser líder. */
  leader: MechBase | null = null;
  escortSide = 1;
  order: SquadOrder = 'follow';
  private focusTarget: MechBase | null = null;
  private readonly guardPoint = new THREE.Vector3();
  receiveOrder(order: SquadOrder, point: Readonly<THREE.Vector3>, target: MechBase | null): void {
    this.order = order;
    this.guardPoint.set(point.x + this.escortSide * 6, point.y, point.z);
    this.focusTarget = order === 'focus' ? target : null;
    this.target = this.focusTarget;
    this.targetVisible = false;
    this.visibleFor = 0;
    this.losTimer = 0;
    this.state = this.focusTarget ? 'chase' : 'patrol';
    if (this.focusTarget) { this.lastSeen.copy(this.focusTarget.simPosition); this.searchPoint.copy(this.lastSeen); this.sinceSeen = 0; }
    this.obstacles.reset();
    this.cover.reset();
  }
  private readonly obstacles: ObstacleSteering;
  private readonly cover: CoverSeeking;
  private readonly rand: () => number;
  private target: MechBase | null = null;
  private targetVisible = false;
  /** Amostras de linha de visão perdidas em seguida. */
  private losMisses = 0;
  private visibleFor = 0;
  private sinceSeen = Infinity;
  private readonly lastSeen = new THREE.Vector3();
  /** Velocidade do alvo na última vez que foi visto (para projetar a fuga dele). */
  private readonly lastSeenVel = new THREE.Vector3();
  /** Para onde a caça vai quando o alvo não está à vista: onde ele deve estar. */
  private readonly searchPoint = new THREE.Vector3();
  private searchTimer = 0;
  private searchSweep = 1;
  /** Há quanto tempo o alvo aponta o torso para este bot. */
  private aimedAtFor = 0;
  private jukeCooldown = 0;
  /** Quem acertou o bot por último, e há quanto tempo. */
  private threat: MechBase | null = null;
  private threatAge = Infinity;
  private radioTimer = 0;
  private losTimer = 0;
  private waypoint = 0;
  private yaw: number;
  private pitch = 0;
  private strafeSign = 1;
  private strafeTimer = 0;
  private retreatTimer = 0;
  private retreatCooldown = 0;
  private fireCooldown = 0;
  private burstLeft: number;
  private stuckTimer = STUCK_CHECK_S;
  private readonly stuckFrom = new THREE.Vector3();
  private sidestepTimer = 0;
  private sidestepSign = 1;

  constructor(
    readonly mech: MechBase,
    private readonly physics: PhysicsWorld,
    private readonly waypoints: readonly THREE.Vector3[],
    seed: number,
    /** Pode mudar no meio da partida (tela de configurações): vale a partir do próximo tick. */
    public skill: BotSkill = BOT_SKILL_NORMAL,
    readonly profile: BotProfile = MECH_PROFILE,
    /** Pode mudar no meio da partida (configurações): vale a partir do próximo tick. */
    public persona: BotPersona = PERSONAS.soldado,
  ) {
    this.rand = mulberry32(seed);
    this.cover = new CoverSeeking(physics, mech);
    this.obstacles = new ObstacleSteering(physics, mech, seed % 2 ? -1 : 1);
    this.yaw = mech.yaw;
    this.burstLeft = this.burstSize();
    this.waypoint = Math.floor(this.rand() * waypoints.length);
    this.stuckFrom.copy(mech.simPosition);
  }

  /** Distância em que ataca: a do tipo de robô, ajustada pela personalidade. */
  get attackRange(): number {
    return this.profile.attackRange * this.persona.rangeScale;
  }

  /**
   * Quer a vaga de ataque: está lutando com um alvo à vista, ou acabou de ganhar a vaga e está chegando
   * perto (de longe, quem ganha a vaga persegue até o alcance; sem isso, largava a vaga no caminho).
   */
  /**
   * Levanta a chapa do escudo físico: alvo à vista enquanto avança, recua ou esfria. No ataque abaixa, para andar de
   * lado na velocidade cheia (a chapa levantada pesa).
   */
  get wantsGuard(): boolean {
    return this.targetVisible && (this.state === 'chase' || this.state === 'retreat' || this.state === 'cool');
  }

  get wantsToken(): boolean {
    return this.targetVisible && (this.state === 'attack' || this.state === 'retreat' || this.state === 'chase');
  }

  /** O alvo que está caçando (diretor: distância até ele). */
  get currentTarget(): MechBase | null {
    return this.target;
  }

  /** Está com o alvo à vista agora (linha de visão das últimas amostras). */
  get seesTarget(): boolean {
    return this.targetVisible;
  }

  /** Para onde a caça vai sem o alvo à vista: onde ele deve estar (testes e painel de depuração). */
  get searchGoal(): Readonly<THREE.Vector3> {
    return this.searchPoint;
  }

  /**
   * Levou tiro: lembra quem atirou (vira o alvo assim que estiver à vista). Se estava só patrulhando ou
   * vasculhando, vira e vai atrás.
   */
  alert(from: MechBase): void {
    this.threat = from;
    this.threatAge = 0;
    if (this.state !== 'patrol' && this.state !== 'search') return;
    this.target = from;
    this.lastSeen.copy(from.simPosition);
    this.searchPoint.copy(this.lastSeen);
    this.sinceSeen = 0;
    this.state = 'chase';
  }

  /**
   * Rádio do clã: um companheiro viu `target` em `at`. Quem não está vendo ninguém (patrulha, varredura,
   * caça às cegas) vai lá; quem já luta com alguém à vista continua no que está.
   */
  hear(target: MechBase, at: Readonly<THREE.Vector3>): void {
    if (!target.alive || target === this.mech || !this.mech.alive || this.targetVisible) return;
    if (this.state !== 'patrol' && this.state !== 'search' && this.state !== 'chase') return;
    this.target = target;
    this.lastSeen.copy(at);
    this.searchPoint.copy(at);
    this.lastSeenVel.set(0, 0, 0);
    this.sinceSeen = 0;
    this.state = 'chase';
  }

  /** Volta ao estado inicial (ex.: depois de renascer). */
  reset(): void {
    this.state = 'patrol';
    this.obstacles.reset();
    this.losTimer = this.losMisses = 0;
    this.target = null;
    this.targetVisible = false;
    this.visibleFor = 0;
    this.sinceSeen = Infinity;
    this.burstLeft = this.burstSize();
    this.fireCooldown = 0;
    this.retreatTimer = 0;
    this.tokenHeld = 0;
    this.tokenWait = 0;
    this.sidestepTimer = 0;
    this.searchTimer = 0;
    this.aimedAtFor = 0;
    this.jukeCooldown = 0;
    this.threat = null;
    this.threatAge = Infinity;
    this.radioTimer = 0;
    this.radioReport = null;
    this.radioContact = false;
    this.hasFlank = false;
    this.yaw = this.mech.yaw;
    this.stuckFrom.copy(this.mech.simPosition);
    this.stuckTimer = STUCK_CHECK_S;
  }

  /** Um tick fixo: percebe, decide, monta o input e (talvez) um tiro. */
  think(dt: number, targets: readonly MechBase[]): MechInput {
    const cmd = this.input;
    this.wantsToFire = false;
    cmd.jump = false;
    cmd.dash = false;
    if (!this.mech.alive) {
      cmd.moveX = cmd.moveZ = 0;
      return cmd;
    }

    this.perceive(dt, targets);
    this.decide(dt);
    this.report(dt);
    this.steer(dt);
    this.aimAndFire(dt);
    return cmd;
  }

  private perceive(dt: number, targets: readonly MechBase[]): void {
    if (this.target && !this.target.alive) {
      this.target = null;
      this.targetVisible = false;
    }
    this.threatAge += dt;
    this.jukeCooldown -= dt;
    this.losTimer -= dt;
    if (this.losTimer <= 0) {
      this.losTimer = LOS_INTERVAL_S;
      let best: MechBase | null = null;
      // Prioridade: a ordem de foco; depois quem acabou de acertar o bot; depois o alvo atual; depois o mais perto.
      if (this.focusTarget?.alive && this.visibleDistance(this.focusTarget) !== null) best = this.focusTarget;
      const threat = this.threat;
      if (!best && threat?.alive && this.threatAge < THREAT_MEMORY_S && threat !== this.mech &&
          targets.includes(threat) && this.visibleDistance(threat) !== null) best = threat;
      // Mantém o alvo atual enquanto ele estiver visível (1 raio).
      const current = this.target;
      if (!best && current?.alive && targets.includes(current) && this.visibleDistance(current) !== null) best = current;
      // Um raio perdido só não basta para largar o alvo: o Rapier às vezes deixa um raio passar direto por uma
      // cápsula (erro numérico, 1 amostra). Na primeira falha segue com ele, sem trocar pelo mais perto; larga
      // (ou troca) depois de 2 falhas seguidas (0,2 s).
      const grace = !best && this.targetVisible && this.losMisses < 1 && !!current?.alive;
      let bestDist = Infinity;
      if (!best && !grace) for (const t of targets) {
        if (t === this.mech || !t.alive || t === current) continue;
        const d = this.visibleDistance(t);
        if (d !== null && d < bestDist) {
          bestDist = d;
          best = t;
        }
      }
      if (best) this.target = best;
      this.losMisses = best ? 0 : this.losMisses + 1;
      this.targetVisible = best !== null || (this.targetVisible && this.losMisses < 2 && !!this.target?.alive);
      // A memória do bot é só o que a amostra viu (10 Hz): onde estava e para onde ia. Na tolerância, não atualiza.
      if (best) {
        this.lastSeen.copy(best.simPosition);
        this.lastSeenVel.set(best.velocity.x, 0, best.velocity.z);
        this.searchPoint.copy(this.lastSeen);
      }
    }
    if (this.targetVisible && this.target) {
      const t = this.target;
      this.visibleFor += dt;
      this.sinceSeen = 0;
      this.aimedAtFor = this.aimedBy(t) ? this.aimedAtFor + dt : 0;
    } else {
      if (this.visibleFor > 0) this.predictEscape();
      this.visibleFor = 0;
      this.sinceSeen += dt;
      this.aimedAtFor = 0;
    }
  }

  /**
   * Acabou de perder o alvo de vista: projeta para onde ele ia (velocidade × `SEARCH_LEAD_S`, até `SEARCH_LEAD_MAX`),
   * sem atravessar parede (1 raio, só no instante da perda).
   */
  private predictEscape(): void {
    const v = this.lastSeenVel;
    const speed = Math.hypot(v.x, v.z);
    if (speed < 0.5 || !this.target) return;
    let reach = Math.min(speed * SEARCH_LEAD_S, SEARCH_LEAD_MAX);
    _dir.set(v.x / speed, 0, v.z / speed);
    _probe.set(this.lastSeen.x, this.lastSeen.y + this.mech.stats.height * 0.35, this.lastSeen.z);
    const hit = this.physics.raycast(_probe, _dir, reach, this.target.collider);
    if (hit) reach = Math.max(0, hit.distance - this.mech.stats.radius - 1);
    this.searchPoint.copy(this.lastSeen).addScaledVector(_dir, reach);
  }

  /** O alvo aponta o torso para este bot (ao alcance de tiro): é o que um piloto vê de fora. */
  private aimedBy(t: MechBase): boolean {
    const me = this.mech.simPosition;
    const tp = t.simPosition;
    const dx = me.x - tp.x;
    const dz = me.z - tp.z;
    if (dx * dx + dz * dz > FIRE_RANGE * FIRE_RANGE) return false;
    return Math.abs(wrapAngle(yawOf(dx, dz) - t.yaw)) < AIM_READ_RAD;
  }

  /** Rádio do clã: com o alvo à vista (já reagiu), passa a posição dele aos companheiros a cada `RADIO_INTERVAL_S`. */
  private report(dt: number): void {
    this.radioTimer -= dt;
    if (this.radioContact) this.radioTimer = 0;
    if (this.radioTimer > 0 || !this.target || !this.targetVisible || this.visibleFor < this.skill.reactionS) return;
    this.radioTimer = RADIO_INTERVAL_S;
    this.radioReport = this.target;
  }

  /** Distância até `t` se houver linha de visão (e ele estiver no campo de visão), senão null. */
  private visibleDistance(t: MechBase): number | null {
    const me = this.mech.simPosition;
    const h = this.mech.stats.height;
    _eye.set(me.x, me.y + h * EYE_HEIGHT, me.z);
    const tp = t.simPosition;
    _aim.set(tp.x, tp.y + t.stats.height * AIM_HEIGHT, tp.z);
    _dir.subVectors(_aim, _eye);
    const dist = _dir.length();
    if (dist > VISION_RANGE) return null;
    if ((this.state === 'patrol' || this.state === 'search') && dist > HEARING_RADIUS) {
      const off = Math.abs(wrapAngle(yawOf(_dir.x, _dir.z) - this.yaw));
      if (off > VISION_HALF_ANGLE) return null;
    }
    _dir.divideScalar(dist);
    const first = this.physics.firstColliderOnRay(_eye, _dir, dist + 1, this.mech.collider);
    // O raio termina 1 m depois do peito do alvo, dentro da cápsula dele: se não bateu em nada, nada está no caminho
    // e o Rapier só deixou o raio passar pela cápsula (acontece com os dois alinhados, ex. x igual). Conta como visto.
    return first === null || first.handle === t.collider.handle ? dist : null;
  }

  private decide(dt: number): void {
    const m = this.mech;
    this.retreatCooldown = Math.max(0, this.retreatCooldown - dt);
    const reacted = this.targetVisible && this.visibleFor >= this.skill.reactionS;
    const dist = this.target ? this.flatDistance(this.target.simPosition) : Infinity;
    const torso = m.modules.torso / m.stats.maxModuleHealth.torso;

    if (
      this.state !== 'retreat' &&
      reacted &&
      torso < this.persona.retreatAt &&
      this.retreatCooldown <= 0 &&
      m.mobility > 0
    ) {
      this.state = 'retreat';
      this.retreatTimer = RETREAT_S;
      this.retreatCooldown = RETREAT_COOLDOWN_S;
      this.input.dash = true;
      return;
    }

    // Calor: superaquecido ou fervendo, para e esfria (parado esfria em dobro); volta com o Mech frio.
    if (this.state !== 'cool' && (m.overheated || m.heat >= this.persona.coolAt)) {
      this.state = 'cool';
      return;
    }

    // Emboscada (fujão): sem brecha, espreita pelas costas; com brecha, ataca; pego de frente, foge.
    if (this.persona.ambush && this.target && reacted) {
      const open = this.opening(this.target);
      if (this.state === 'attack' && !open && this.seenBy(this.target) && this.retreatCooldown <= 0 && m.mobility > 0) {
        this.state = 'retreat';
        this.retreatTimer = RETREAT_S;
        this.retreatCooldown = AMBUSH_RETREAT_COOLDOWN_S;
        this.input.dash = true;
        return;
      }
      if ((this.state === 'chase' || this.state === 'attack') && !open) {
        this.state = 'stalk';
        return;
      }
      if (this.state === 'stalk' && open) {
        this.state = 'attack';
        return;
      }
    }

    switch (this.state) {
      case 'cool':
        if (!m.overheated && m.heat <= COOLED_AT) this.state = this.target ? 'chase' : 'patrol';
        break;
      case 'patrol':
        if (reacted) {
          this.state = 'chase';
          this.radioContact = true;
        }
        break;
      case 'search':
        if (reacted) {
          this.state = 'chase';
          this.radioContact = true;
        } else {
          this.searchTimer -= dt;
          if (this.searchTimer <= 0) {
            this.target = null;
            this.state = 'patrol';
          }
        }
        break;
      case 'chase':
        if (!this.target) this.state = 'patrol';
        else if (reacted && dist <= this.attackRange) this.state = 'attack';
        else if (!this.targetVisible && this.sinceSeen > 0.5 &&
                 (this.flatDistance(this.searchPoint) < WAYPOINT_REACHED || this.sinceSeen > CHASE_BLIND_S)) {
          // Chegou aonde o alvo devia estar e ele não está (ou a rota não leva lá): vasculha antes de desistir.
          this.beginSearch();
        }
        break;
      case 'attack':
        // Sem a vaga, espera mais longe: só volta a perseguir se passar dessa distância de espera.
        if (!this.targetVisible || dist > this.attackRange * (this.hasToken ? 1 : HOLD_SCALE) + 8) this.state = 'chase';
        break;
      case 'stalk':
        if (!this.target) this.state = 'patrol';
        else if (!this.targetVisible && this.sinceSeen > LOSE_TARGET_S) this.beginSearch();
        break;
      case 'retreat':
        this.retreatTimer -= dt;
        if (this.retreatTimer <= 0) this.state = this.target ? 'chase' : 'patrol';
        break;
    }
  }

  /** Vasculha: gira olhando em volta, para o lado em que o alvo ia (sem sorteio), por `SEARCH_S`. */
  private beginSearch(): void {
    this.state = 'search';
    this.searchTimer = SEARCH_S;
    const v = this.lastSeenVel;
    this.searchSweep = v.lengthSq() > 0.25 && wrapAngle(yawOf(v.x, v.z) - this.yaw) < 0 ? -1 : 1;
  }

  /** Para onde andar (direção no mundo) e para onde olhar; depois converte em `MechInput`. */
  private steer(dt: number): void {
    let faceYaw = this.yaw;
    _move.set(0, 0, 0);

    switch (this.state) {
      case 'patrol': {
        if (!this.waypoints.length) break;
        const wp = this.waypoints[this.waypoint]!;
        if (this.flatDistance(wp) < WAYPOINT_REACHED) this.nextWaypoint();
        const next = this.waypoints[this.waypoint]!;
        // Rota de um ponto só (ou já em cima dele): fica, em vez de girar em volta do ponto.
        if (this.flatDistance(next) < WAYPOINT_REACHED) break;
        this.towards(next);
        if (_move.lengthSq() > 1e-6) faceYaw = yawOf(_move.x, _move.z);
        break;
      }
      case 'chase': {
        // Esperando a vaga com o alvo à vista: já vai pelo flanco que o diretor deu, em vez de ir reto até ele.
        if (this.targetVisible && this.target && !this.hasToken && this.hasFlank && !this.profile.melee) {
          this.orbit(this.target.simPosition, this.attackRange * HOLD_SCALE);
          faceYaw = this.yawTo(this.target.simPosition);
          break;
        }
        const goal = this.targetVisible && this.target ? this.target.simPosition : this.searchPoint;
        this.towards(goal);
        faceYaw = this.targetVisible && this.target ? this.yawTo(this.target.simPosition) : yawOf(_move.x, _move.z);
        break;
      }
      case 'attack': {
        if (!this.target) break;
        const t = this.target.simPosition;
        faceYaw = this.yawTo(t);
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
          const p = this.profile;
          // Busca o flanco do alvo: o lado depende da orientação dele, não de um passeio aleatório.
          const off = wrapAngle(this.yawTo(t) - this.target.yaw);
          this.strafeSign = Math.sin(off) >= 0 ? -1 : 1;
          this.strafeTimer = p.strafeMinS + this.rand() * (p.strafeMaxS - p.strafeMinS);
          // Desvio com dash para o lado novo. Só quem tem a chance sorteia (o RNG dos Mechs não muda).
          if (p.dodgeChance > 0 && this.rand() < p.dodgeChance && this.mech.mobility > 0) this.input.dash = true;
        }
        this.dodgeAim();
        // Sem a vaga, com flanco dado pelo diretor: anda em volta do alvo até o flanco e espera lá, sem atirar.
        if (!this.hasToken && this.hasFlank && !this.profile.melee) {
          this.orbit(t, this.attackRange * HOLD_SCALE);
          break;
        }
        // Corpo a corpo, com a vaga: vai colado no alvo e circula devagar em volta dele.
        if (this.profile.melee && this.hasToken) {
          const gap = this.flatDistance(t) - this.mech.stats.radius - this.target.stats.radius;
          this.towards(t);
          const side = gap < this.mech.loadout.primary.maxRange * 0.6 ? 1 : 0.35;
          if (gap < this.mech.loadout.primary.maxRange * 0.6) _move.set(0, 0, 0);
          _move.x += Math.cos(faceYaw) * this.strafeSign * side;
          _move.z -= Math.sin(faceYaw) * this.strafeSign * side;
          break;
        }
        // Anda de lado (direita do torso = (cos, -sin)) e recua (trás = (sin, cos)) se estiver perto demais.
        _move.set(Math.cos(faceYaw) * this.strafeSign, 0, -Math.sin(faceYaw) * this.strafeSign);
        if (this.flatDistance(t) < (this.hasToken ? this.profile.keepMinRange : this.attackRange * HOLD_SCALE)) {
          _move.x += Math.sin(faceYaw);
          _move.z += Math.cos(faceYaw);
        }
        break;
      }
      case 'search':
        // Parado, girando para o lado em que o alvo ia: o cone de visão da patrulha vale aqui.
        faceYaw = this.yaw + this.searchSweep * this.skill.turnRate * 0.5 * dt;
        break;
      case 'cool':
        // Parado, de frente para o alvo (se houver): esfria em dobro e não atira.
        if (this.targetVisible && this.target) faceYaw = this.yawTo(this.target.simPosition);
        break;
      case 'stalk': {
        // Para as costas do alvo (a frente dele é (-sin, -cos)), a uma distância segura, olhando para ele.
        if (!this.target) break;
        const t = this.target.simPosition;
        _goal.set(t.x + Math.sin(this.target.yaw) * STALK_DIST, 0, t.z + Math.cos(this.target.yaw) * STALK_DIST);
        this.towards(_goal);
        faceYaw = this.targetVisible ? this.yawTo(t) : yawOf(_move.x, _move.z);
        break;
      }
      case 'retreat': {
        const from = this.target ? this.target.simPosition : this.lastSeen;
        this.towards(from, -1);
        faceYaw = this.targetVisible && this.target ? this.yawTo(from) : yawOf(_move.x, _move.z);
        break;
      }
    }

    if (this.order === 'focus' && (!this.focusTarget?.alive || this.sinceSeen > 5)) {
      this.order = 'follow';
      this.focusTarget = null;
    }
    const leader = this.leader;
    if (this.order === 'follow' && leader?.alive && this.state !== 'retreat' &&
        (this.state === 'patrol' || !this.targetVisible || this.flatDistance(leader.simPosition) > 36)) {
      const p = leader.simPosition;
      const side = this.escortSide * 7;
      _goal.set(p.x + Math.sin(leader.yaw) * 9 + Math.cos(leader.yaw) * side, p.y,
        p.z + Math.cos(leader.yaw) * 9 - Math.sin(leader.yaw) * side);
      if (this.flatDistance(_goal) > 3) this.towards(_goal);
      else _move.set(0, 0, 0);
      faceYaw = this.targetVisible && this.target ? this.yawTo(this.target.simPosition) :
        _move.lengthSq() > 0 ? yawOf(_move.x, _move.z) : leader.yaw;
    }
    if (this.order === 'hold' && this.state !== 'retreat') {
      const distance = this.flatDistance(this.guardPoint);
      // Pode trocar tiros em torno do posto; não abandona a área perseguindo um alvo distante.
      if (distance > 10 || !this.targetVisible || this.state === 'chase' || this.state === 'patrol') {
        if (distance > 3) this.towards(this.guardPoint);
        else _move.set(0, 0, 0);
        if (this.targetVisible && this.target) faceYaw = this.yawTo(this.target.simPosition);
      }
    }
    if ((this.state === 'cool' || this.state === 'retreat') && this.target &&
        this.cover.find(dt, this.target, this.targetVisible ? this.target.simPosition : this.lastSeen)) {
      if (this.flatDistance(this.cover.goal) > 2.5) this.towards(this.cover.goal);
      else _move.set(0, 0, 0);
    }
    this.unstick(dt, faceYaw);
    this.obstacles.steer(_move, dt);
    if (!this.targetVisible && _move.lengthSq() > 0.01) faceYaw = yawOf(_move.x, _move.z);

    this.yaw = turnToward(this.yaw, faceYaw, this.skill.turnRate * dt);

    setLocalMove(this.input, _move.x, _move.z, this.yaw);
  }

  /**
   * Leu a mira: o alvo aponta o torso para o bot há um tempo de reação. Com a chance da dificuldade, troca o lado
   * do zigue-zague (e às vezes dá dash); reagindo ou não, só volta a ler depois de `JUKE_COOLDOWN_S`.
   */
  private dodgeAim(): void {
    if (this.profile.steady || this.skill.readAim <= 0 || this.jukeCooldown > 0 || this.aimedAtFor < this.skill.reactionS) return;
    this.jukeCooldown = JUKE_COOLDOWN_S;
    if (this.rand() >= this.skill.readAim) return;
    const p = this.profile;
    this.strafeSign = -this.strafeSign;
    this.strafeTimer = p.strafeMinS + this.rand() * (p.strafeMaxS - p.strafeMinS);
    if (this.rand() < this.skill.jukeDash && this.mech.mobility > 0) this.input.dash = true;
    this.jukes++;
  }

  /**
   * Cerco: anda em volta do alvo (tangente ao círculo, sem cortar pela frente dele) até a direção `flankBearing`,
   * corrigindo para ficar a `radius` dele.
   */
  private orbit(t: Readonly<THREE.Vector3>, radius: number): void {
    const me = this.mech.simPosition;
    const dx = me.x - t.x;
    const dz = me.z - t.z;
    const r = Math.hypot(dx, dz) || 1;
    const bearing = Math.atan2(dx, dz);
    const diff = wrapAngle(this.flankBearing - bearing);
    const radial = Math.max(-1, Math.min(1, (radius - r) / 6));
    const tangential = Math.abs(diff) > FLANK_SETTLED_RAD ? Math.sign(diff) : diff / FLANK_SETTLED_RAD;
    // Posição = alvo + r·(sen b, cos b): girar b para mais anda em (cos b, −sen b).
    _move.set((dx / r) * radial + Math.cos(bearing) * tangential, 0, (dz / r) * radial - Math.sin(bearing) * tangential);
    if (_move.lengthSq() > 1) _move.normalize();
  }

  private towards(p: Readonly<THREE.Vector3>, sign = 1): void {
    const me = this.mech.simPosition;
    _move.set(p.x - me.x, 0, p.z - me.z);
    if (_move.lengthSq() > 1e-6) _move.normalize().multiplyScalar(sign);
  }

  /** Encalhou (andando e quase parado)? Na patrulha troca de destino; em combate dá um passo de lado e pula. */
  private unstick(dt: number, faceYaw: number): void {
    const me = this.mech.simPosition;
    if (this.sidestepTimer > 0) {
      this.sidestepTimer -= dt;
      _move.x += Math.cos(faceYaw) * this.sidestepSign;
      _move.z -= Math.sin(faceYaw) * this.sidestepSign;
    }
    this.stuckTimer -= dt;
    if (this.stuckTimer > 0) return;
    this.stuckTimer = STUCK_CHECK_S;
    const wantsToMove = _move.lengthSq() > 0.09 && this.mech.mobility > 0;
    const moved = Math.hypot(me.x - this.stuckFrom.x, me.z - this.stuckFrom.z);
    this.stuckFrom.copy(me);
    if (!wantsToMove || moved >= STUCK_DIST) return;
    if (this.state === 'patrol') {
      this.nextWaypoint();
    } else {
      this.sidestepTimer = SIDESTEP_S;
      this.sidestepSign = this.rand() < 0.5 ? -1 : 1;
      this.input.jump = true;
    }
  }

  private aimAndFire(dt: number): void {
    const m = this.mech;
    this.fireCooldown -= dt;
    const t = this.target;
    const engaged = this.state === 'chase' || this.state === 'attack' || this.state === 'retreat';
    if (!t || !engaged || !this.targetVisible || this.visibleFor < this.skill.reactionS) {
      m.applyFacing(this.yaw, 0);
      return;
    }

    // Mira no torso, antecipando parte do movimento do alvo (tempo de voo do plasma).
    const tp = t.simPosition;
    const dist = this.flatDistance(tp);
    // Corpo a corpo: sem mira nem antecipação; corta enquanto estiver encostado (quem aplica é o BotSystem).
    if (this.profile.melee) {
      m.applyFacing(this.yaw, 0);
      if (this.hasToken) this.tokenHeld += dt;
      const w = m.loadout.primary;
      if (dist - m.stats.radius - t.stats.radius > w.maxRange || this.fireCooldown > 0 || !m.canFirePrimary || !this.hasToken) return;
      this.wantsToFire = true;
      this.fireCooldown = Math.max(this.fireCooldown, -dt) + w.fireInterval;
      return;
    }
    const flight = dist / m.loadout.primary.speed;
    _aim
      .set(tp.x, tp.y + t.stats.height * AIM_HEIGHT, tp.z)
      .addScaledVector(t.velocity, flight * this.skill.leadFactor);
    m.applyFacing(this.yaw, this.pitch);
    m.simMuzzle(_muzzle);
    _dir.subVectors(_aim, _muzzle);
    this.pitch = Math.atan2(_dir.y, Math.hypot(_dir.x, _dir.z));

    const facingOff = Math.abs(wrapAngle(this.yawTo(tp) - this.yaw));
    if (this.hasToken) this.tokenHeld += dt;
    if (dist > FIRE_RANGE || facingOff > FIRE_CONE_RAD || this.fireCooldown > 0 || !m.canFirePrimary || !this.hasToken) return;

    // Erro de mira: gira a direção um pouco em yaw e em pitch.
    _dir.normalize();
    // Ver a cabeça do alvo não garante que a boca da arma esteja livre (cobertura/companheiro).
    const obstruction = this.physics.firstColliderOnRay(_muzzle, _dir, _muzzle.distanceTo(_aim), m.collider);
    if (obstruction && obstruction.handle !== t.collider?.handle) return;
    const err = this.skill.aimErrorRad * this.profile.aimErrorScale;
    const e = (this.rand() * 2 - 1) * err;
    const ce = Math.cos(e);
    const se = Math.sin(e);
    const x = _dir.x * ce + _dir.z * se;
    _dir.z = -_dir.x * se + _dir.z * ce;
    _dir.x = x;
    _dir.y += (this.rand() * 2 - 1) * err;
    this.shotDir.copy(_dir.normalize());
    this.wantsToFire = true;

    this.burstLeft--;
    if (this.burstLeft > 0) {
      this.fireCooldown = Math.max(this.fireCooldown, -dt) + m.loadout.primary.fireInterval;
    } else {
      this.burstLeft = this.burstSize();
      this.fireCooldown = (this.skill.burstPauseS / this.persona.aggression) * (0.8 + this.rand() * 0.4);
    }
  }

  private burstSize(): number {
    return Math.max(1, Math.round(this.skill.burstShots * this.persona.aggression));
  }

  /** Brecha para a emboscada: o alvo de costas para o bot, avariado ou superaquecido. */
  private opening(t: MechBase): boolean {
    if (t.overheated || t.modules.torso < t.stats.maxModuleHealth.torso * AMBUSH_WEAK) return true;
    const me = this.mech.simPosition;
    const tp = t.simPosition;
    return Math.abs(wrapAngle(yawOf(me.x - tp.x, me.z - tp.z) - t.yaw)) > AMBUSH_BACK_RAD;
  }

  /** O alvo está olhando para o bot, e perto. */
  private seenBy(t: MechBase): boolean {
    const me = this.mech.simPosition;
    const tp = t.simPosition;
    if (Math.hypot(me.x - tp.x, me.z - tp.z) > AMBUSH_SEEN_DIST) return false;
    return Math.abs(wrapAngle(yawOf(me.x - tp.x, me.z - tp.z) - t.yaw)) < AMBUSH_SEEN_RAD;
  }

  private nextWaypoint(): void {
    if (this.waypoints.length < 2) return;
    const step = 1 + Math.floor(this.rand() * (this.waypoints.length - 1));
    this.waypoint = (this.waypoint + step) % this.waypoints.length;
  }

  private yawTo(p: Readonly<THREE.Vector3>): number {
    const me = this.mech.simPosition;
    return yawOf(p.x - me.x, p.z - me.z);
  }

  private flatDistance(p: Readonly<THREE.Vector3>): number {
    const me = this.mech.simPosition;
    return Math.hypot(p.x - me.x, p.z - me.z);
  }
}
