import * as THREE from 'three';
import { GLOW, PALETTE } from '../core/palette';
import type { MechBase } from '../entities/MechBase';
import { Android } from '../entities/Android';
import { ANDROID_STATS, COLOSSUS_BOSS_STATS, ehTita, VECTOR09_STATS, type ChassisId } from '../entities/chassis';
import { armaDoBot, statsDoBot, TITA_RESPAWN_S } from './titaBot';
import { BLUEPRINT_BY_CHASSIS } from '../entities/blueprintByChassis';
import { ImportedMech } from '../entities/ImportedMech';
import type { MechRig } from '../entities/MechBase';
import { COLOSSUS_01_BLUEPRINT } from '../entities/mechBlueprint';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { PERSONA_LABELS, type Difficulty, type Persona } from '../core/Settings';
import { ANDROID_PROFILE, BOSS_PROFILE, BOT_SKILL_NORMAL, BOT_SKILLS, BotController, type BotSkill, type SquadOrder, MECH_PROFILE, PERSONAS } from './BotController';
import type { CombatSystem } from './CombatSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import { weapon, type Tier, type WeaponId } from './weapons';
import { REPAIR_RATE } from './repair';
import { TechnicianController } from './TechnicianController';
import type { Respawner } from './Respawner';
import { defaultPower, poweredStats, type PowerSpec } from '../tuning/power';
import { BOT_NAMES } from '../core/botNames';
import { wrapAngle } from './steer';

export const BOT_RESPAWN_S = 4;
/** IA rebelde: vermelho, com visor e tiros vermelhos (o jogador é amarelo com verde neon). */
const BOT_PAINT = PALETTE.enemyPaint;
const MUZZLE_COLOR = GLOW.enemyMuzzle;

const pick = (list: readonly string[], i: number, prefix: string) => list[i] ?? `${prefix}-${String(i + 1).padStart(2, '0')}`;
/** O diretor redistribui as vagas de ataque a cada tanto (não a cada tick: 5 vezes por segundo basta). */
const DIRECTOR_INTERVAL_S = 0.2;
/** Turno de quem tem a vaga: passado isto, a vaga vai para quem está esperando (revezam). */
const TURN_S = 7;
/** Custo de uma vaga: um Mech conta 1, um andróide conta ½ (é fraco). */
const ANDROID_COST = 0.5;
/**
 * Cerco (11/10): quem espera a vaga vai para o flanco do alvo, a este ângulo (~100°) da frente dele (para onde o
 * torso aponta); o segundo do mesmo lado vai mais para trás, de `FLANK_STEP_RAD` em `FLANK_STEP_RAD`, até as costas.
 */
const FLANK_RAD = 1.75;
const FLANK_STEP_RAD = 0.8;
/** Perto da frente do alvo (menos que isto), o lado do flanco vai para o lado com menos gente. */
const FLANK_TIE_RAD = 0.5;
/** Rádio do clã: alcance do aviso de contato entre companheiros (m). */
export const RADIO_RANGE = 80;
/** Aviso de rádio na tela: no máximo um a cada tanto por time (não vira ruído). */
const RADIO_CALLOUT_S = 8;

const _muzzle = new THREE.Vector3();

/**
 * O que um robô do esquadrão tem de próprio (P91, `sim/esquadrao.ts`): o corpo (os números do chassi e a silhueta), a arma principal e a
 * dificuldade. Ausente = o padrão do clã. Quem monta é a partida; o que a IA faz com a arma (a distância de tiro) está em `BotController`.
 */
export interface BotKit {
  chassi?: ChassisId;
  /** Troca a arma principal (a secundária sai: o bot só atira a principal). */
  arma?: { id: WeaponId; tier: Tier } | null;
  dificuldade?: Difficulty | null;
}

export interface BotSystemOptions {
  /**
   * O corpo de malha importada de um chassi (Marauder, Lancer, Bastion...), se o cliente tem o arquivo pronto: o esquadrão (P91) escolhe o
   * chassi, e sem isto todo bot nascia como o Vector-09 com os números do chassi certo e a silhueta errada (achado do Comandante, 13/10).
   * O servidor não tem malha nenhuma e não passa isto: lá o corpo é só física e números.
   */
  rigDoChassi?: (chassi: ChassisId) => MechRig | null;
  scene: THREE.Scene;
  physics: PhysicsWorld;
  combat: CombatSystem;
  projectiles: ProjectileSystem;
  particles: ParticleSystem;
  respawner: Respawner;
  /** Desligado em missões com pool: a própria regra decide quando cada unidade volta. */
  respawn?: boolean;
  /** No CTF, cada defensor renasce na própria base em vez do ponto global mais distante. */
  respawnAtHome?: boolean;
  /** Jogadores que a equipe acompanha (lista viva, sem cópia por tick). */
  escort?: readonly MechBase[];
  /** Nomes na tela (padrão: os de `core/botNames.ts`; o time de aliados usa os nomes dos aliados). */
  names?: { mechs?: readonly string[]; androids?: readonly string[]; technicians?: readonly string[] };
  /**
   * Cor do casco e do visor (padrão: as de sempre, roxo/violeta — "IA rebelde"). Um segundo `BotSystem`
   * pode passar as cores do jogador aqui pra virar um time de aliados, visualmente diferente do inimigo
   * (senão o jogador não teria como distinguir quem atira nele de quem luta ao lado dele).
   */
  paint?: number;
  visor?: number;
  /** Onde cada Mech rebelde (escala 2) nasce (x, z): um por ponto. */
  spawns: readonly (readonly [number, number])[];
  /** Onde cada andróide rebelde (escala 1) nasce (x, z): um por ponto. */
  androidSpawns?: readonly (readonly [number, number])[];
  /** Onde cada andróide técnico nasce (x, z): conserta os Mechs rebeldes, não atira. */
  technicianSpawns?: readonly (readonly [number, number])[];
  /** Onde o Colossus (escala 3) nasce (x, z): um só, com perfil de cerco. Sem isto, a missão não tem boss. */
  bossSpawn?: readonly [number, number];
  /** Rota de patrulha (x, z). */
  waypoints: readonly (readonly [number, number])[];
  seed?: number;
  skill?: BotSkill;
  /** Personalidade de cada Mech rebelde, na ordem dos `spawns` (padrão: soldado). */
  personas?: readonly Persona[];
  /**
   * O kit de cada Mech, na ordem dos `spawns` (esquadrão, P91). Quando existe, o esquadrão diz a arma de cada um e o supressor
   * automático dos aliados (o de índice ímpar leva o EMP) deixa de valer: o aliado de EMP é uma escolha do esquadrão, não uma regra.
   */
  kits?: readonly (BotKit | undefined)[];
  /** O kit de cada andróide, na ordem dos `androidSpawns` (só a dificuldade vale). */
  androidKits?: readonly (BotKit | undefined)[];
  /** Potências do painel (por arma e por clã); sem isso, o padrão do jogo. */
  power?: PowerSpec;
}

/** Rádio do clã, para a tela: `from` avistou `target` (primeiro contato; no máximo um aviso a cada `RADIO_CALLOUT_S`). */
export type RadioCallout = (from: string, target: MechBase) => void;

/** Lugar de um cérebro de combate na fila do diretor: chave de ordem e o lado do cerco (+1/−1, 0 = sem flanco). */
interface Fighter {
  bot: Bot;
  brain: BotController;
  key: number;
  side: number;
}

interface Bot {
  mech: MechBase;
  brain: BotController | TechnicianController;
  name: string;
  home: THREE.Vector3;
  /** A dificuldade é do robô (esquadrão): a das configurações não a troca. */
  ownSkill?: boolean;
  /** Feixe de conserto (só técnicos): 2 pontos atualizados no render, sem alocar. */
  beam?: THREE.Line;
}

const BEAM_COLOR = new THREE.Color(PALETTE.fluo).multiplyScalar(3);
const _beamTo = new THREE.Vector3();

/**
 * Mechs inimigos: um Vector-09 violeta por ponto de nascimento, cada um com o seu
 * `BotController`. No tick: o cérebro decide, o Mech simula, e o tiro sai da boca do canhão
 * calculada da simulação. Custo por bot: 1 character controller por tick + a IA (ver BotController).
 */
export class BotSystem {
  /** Quem os bots caçam (hoje: só o jogador). */
  targets: readonly MechBase[] = [];
  readonly mechs: readonly MechBase[];
  private readonly bots: Bot[] = [];
  /** Reservas retiradas da sala quando entram humanos; não renascem durante a reserva. */
  private readonly reserves = new Set<MechBase>();
  /** O Colossus (escala 3), quando a missão tem boss: guardado à parte para o recorte de onda contá-lo. */
  private bossMech: MechBase | null = null;
  /**
   * Vaga de ataque: quantos podem atacar o mesmo alvo ao mesmo tempo (Mech conta 1, andróide ½). Os
   * outros esperam afastados, sem atirar, e revezam a cada turno (dono, 25/09: "eles são muitos e me
   * juntam"). Técnica clássica de jogos de tiro: pressão constante, sem todo mundo de uma vez.
   */
  maxAttackers = Infinity;
  order: SquadOrder = 'follow';
  private pendingOrder: SquadOrder | null = null;
  private orderTarget: MechBase | null = null;
  private readonly orderPoint = new THREE.Vector3();
  /** UI apenas enfileira; ordens são aplicadas dentro do tick. */
  queueOrder(order: SquadOrder, point: Readonly<THREE.Vector3>, target: MechBase | null = null): boolean {
    if (!this.o.escort || (order === 'focus' && (!target?.alive || !this.targets.includes(target)))) return false;
    this.pendingOrder = order;
    this.orderPoint.copy(point);
    this.orderTarget = target;
    return true;
  }
  private directorTimer = 0;
  /** Cérebros de combate (o diretor só olha para eles) e a fila ordenada, reaproveitados: sem alocar. */
  private readonly fighters: Fighter[] = [];
  private readonly cand: Fighter[] = [];
  /** Aviso de rádio na tela (o `Game` liga; o servidor não). */
  onRadio?: RadioCallout;
  private radioQuiet = 0;
  private readonly projectiles: ProjectileSystem;
  private readonly combat: CombatSystem;
  private readonly particles: ParticleSystem;
  /** Ritmo do conserto do técnico (potência do clã; 1 = padrão). */
  private readonly repairScale: number;

  constructor(private readonly o: BotSystemOptions) {
    this.projectiles = o.projectiles;
    this.combat = o.combat;
    this.particles = o.particles;
    const waypoints = o.waypoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const seed = o.seed ?? 1;
    const place = (mech: MechBase, [x, z]: readonly [number, number]) => {
      mech.spawn(o.physics, new THREE.Vector3(x, 0, z));
      mech.applyFacing(Math.atan2(x, z), 0); // nasce olhando para o centro da arena
      o.scene.add(mech.root);
      o.combat.register(mech);
      return new THREE.Vector3(x, 0, z);
    };
    const fighter = (mech: MechBase, p: readonly [number, number], name: string, i: number, android: boolean, kit?: BotKit) => {
      const home = place(mech, p);
      const persona = PERSONAS[(!android && o.personas?.[i]) || 'soldado'];
      const ownSkill = !!kit?.dificuldade;
      const skill = kit?.dificuldade ? BOT_SKILLS[kit.dificuldade] : o.skill ?? BOT_SKILL_NORMAL;
      // O titã (P108) luta como o chefe: de longe, sem correr, com o giro lento como fraqueza; e volta devagar depois de abatido.
      const titan = !android && !!kit?.chassi && ehTita(kit.chassi);
      const brain = new BotController(mech, o.physics, waypoints, seed * 1000 + i, skill, android ? ANDROID_PROFILE : titan ? BOSS_PROFILE : MECH_PROFILE, persona);
      brain.escortSide = i % 2 ? 1 : -1;
      if (o.respawn !== false) {
        o.respawner.track(mech, titan ? TITA_RESPAWN_S : BOT_RESPAWN_S, () => {
          if (o.respawnAtHome) mech.respawn(home);
          brain.reset();
        });
      }
      this.bots.push({ mech, brain, name, home, ...(ownSkill ? { ownSkill } : {}) });
    };
    // No placar e no nome sobre a cabeça, o nome e a personalidade (CLAUDE·BRABO): o jogador aprende quem é quem.
    const mechName = (i: number) => {
      const persona = o.personas?.[i];
      const name = pick(o.names?.mechs ?? (o.escort ? BOT_NAMES.allies : BOT_NAMES.mechs), i, 'M');
      return persona && persona !== 'soldado' ? `${name}·${PERSONA_LABELS[persona].label.toUpperCase()}` : name;
    };
    // Potências: os números de cada clã são montados uma vez aqui (nada muda no tick).
    const power = o.power ?? defaultPower();
    const mechStats = poweredStats(VECTOR09_STATS, power, 'mechs');
    const androidStats = poweredStats(ANDROID_STATS, power, 'androids');
    this.repairScale = power.clans.technician.damage;
    const paint = o.paint ?? BOT_PAINT;
    const visor = o.visor ?? PALETTE.signal;
    const suppressionStats = o.escort ? poweredStats({ ...VECTOR09_STATS,
      loadout: { primary: weapon('emp'), secondary: null } }, power, 'mechs') : mechStats;
    // O corpo de cada Mech: sem kits, o de sempre (e o supressor nos aliados de índice ímpar); com kits, o que o esquadrão pediu.
    const statsDoMech = (i: number, kit: BotKit | undefined) => {
      if (!o.kits) return o.escort && i % 2 ? suppressionStats : mechStats;
      const base = kit?.chassi ? statsDoBot(kit.chassi) : VECTOR09_STATS;
      if (kit?.arma) {
        const { metalShield } = base.loadout;
        return poweredStats({ ...base, loadout: { ...(metalShield ? { metalShield } : {}), primary: armaDoBot(kit.arma.id, kit.arma.tier, kit.chassi ?? 'vector09'), secondary: null } }, power, 'mechs');
      }
      return kit?.chassi ? poweredStats(base, power, 'mechs') : mechStats;
    };
    o.spawns.forEach((p, i) => {
      const kit = o.kits?.[i];
      const stats = statsDoMech(i, kit);
      const rig = kit?.chassi ? o.rigDoChassi?.(kit.chassi) : null;
      fighter(rig ? new ImportedMech(stats, rig) : new Vector09({ paint, visor, stats, blueprint: kit?.chassi ? BLUEPRINT_BY_CHASSIS[kit.chassi] : undefined }), p, mechName(i), i, false, kit);
    });

    // Andróides: sementes depois das dos Mechs.
    (o.androidSpawns ?? []).forEach((p, i) => fighter(new Android({ stats: androidStats }), p, pick(o.names?.androids ?? BOT_NAMES.androids, i, 'A'), o.spawns.length + i, true, o.androidKits?.[i]));
    // O Colossus (escala 3), quando a missão tem boss: nasce no ponto dedicado, com o perfil de cerco e sem
    // personalidade de piloto (não é um rebelde, é uma máquina). Entra no pool como os outros: nada é criado no tick.
    if (o.bossSpawn) {
      const boss = new Vector09({
        paint: BOT_PAINT,
        visor: PALETTE.signal,
        stats: poweredStats(COLOSSUS_BOSS_STATS, power, 'mechs'),
        blueprint: COLOSSUS_01_BLUEPRINT,
      });
      const home = place(boss, o.bossSpawn);
      const brain = new BotController(boss, o.physics, waypoints, seed * 1000 + 900, o.skill ?? BOT_SKILL_NORMAL, BOSS_PROFILE, PERSONAS.soldado);
      this.bots.push({ mech: boss, brain, name: 'COLOSSUS-01', home });
      this.bossMech = boss;
    }
    // Técnicos: consertam os Mechs rebeldes; visor amarelo para o jogador achar e caçar primeiro.
    const allies = this.bots.filter((b) => b.mech instanceof Vector09).map((b) => b.mech);
    (o.technicianSpawns ?? []).forEach((p, i) => {
      const mech = new Android({ visor: PALETTE.fluo, tool: 'repair', stats: poweredStats(ANDROID_STATS, power, 'technician') });
      const home = place(mech, p);
      const brain = new TechnicianController(mech, allies);
      if (o.respawn !== false) o.respawner.track(mech, BOT_RESPAWN_S, () => brain.reset());
      const beam = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: BEAM_COLOR }));
      beam.visible = false;
      beam.frustumCulled = false;
      o.scene.add(beam);
      this.bots.push({ mech, brain, name: pick(o.names?.technicians ?? BOT_NAMES.technicians, i, 'T'), home, beam });
    });
    this.mechs = this.bots.map((b) => b.mech);
    for (const bot of this.bots) if (bot.brain instanceof BotController) this.fighters.push({ bot, brain: bot.brain, key: 0, side: 0 });
  }

  /** Só muda os bots que cruzam o limite; mantém a vida dos demais e os técnicos. */
  setMechCapacity(count: number): void {
    let index = 0;
    for (const { mech, brain, home } of this.bots) {
      if (!(brain instanceof BotController) || mech instanceof Android || mech === this.bossMech) continue;
      const enabled = index++ < Math.max(0, count);
      if (enabled === !this.reserves.has(mech)) continue;
      if (!enabled) {
        this.reserves.add(mech);
        this.o.respawner.untrack(mech);
        mech.deactivate();
      } else {
        this.reserves.delete(mech);
        mech.respawn(home);
        mech.applyFacing(Math.atan2(home.x, home.z), 0);
        brain.reset();
        if (this.o.respawn !== false) this.o.respawner.track(mech, BOT_RESPAWN_S, () => {
          if (this.o.respawnAtHome) mech.respawn(home);
          brain.reset();
        });
      }
    }
    this.directorTimer = 0;
  }

  isReserved(mech: MechBase): boolean {
    return this.reserves.has(mech);
  }

  nameOf(mech: MechBase): string {
    return this.bots.find((b) => b.mech === mech)?.name ?? 'BOT';
  }

  /** Rodada nova: todos inteiros de volta ao ponto de nascimento, olhando o centro, cérebro zerado. */
  respawnAll(): void {
    for (const { mech, brain, home } of this.bots) {
      if (this.reserves.has(mech)) continue;
      mech.respawn(home);
      mech.applyFacing(Math.atan2(home.x, home.z), 0);
      brain.reset();
    }
  }

  /**
   * Ativa um recorte do pool por tipo e guarda o restante. Usado apenas entre ondas, nunca cria ou
   * remove objetos. Devolve quantos inimigos ficaram ativos para a regra conferir seu teto.
   */
  setRoster(mechCount: number, androidCount: number, bossCount = 0): number {
    let mechs = 0;
    let androids = 0;
    let active = 0;
    for (const { mech, brain, home, beam } of this.bots) {
      if (!(brain instanceof BotController)) {
        mech.deactivate();
        if (beam) beam.visible = false;
        continue;
      }
      // O Colossus tem vaga própria: não é um Mech rebelde, e é a onda que decide se ele entra.
      const android = mech instanceof Android;
      const enabled = mech === this.bossMech ? bossCount > 0 : android ? androids++ < androidCount : mechs++ < mechCount;
      if (!enabled) {
        mech.deactivate();
        continue;
      }
      mech.respawn(home);
      mech.applyFacing(Math.atan2(home.x, home.z), 0);
      brain.reset();
      active++;
    }
    this.directorTimer = 0;
    return active;
  }

  /** Troca a personalidade de cada Mech rebelde, na ordem (vale a partir do próximo tick). */
  setPersonas(list: readonly Persona[]): void {
    let i = 0;
    for (const b of this.bots) {
      if (!(b.brain instanceof BotController) || b.mech instanceof Android) continue;
      b.brain.persona = PERSONAS[list[i++] ?? 'soldado'];
    }
  }

  /** Troca a dificuldade de todos os bots (vale a partir do próximo tick). */
  setSkill(skill: BotSkill): void {
    for (const b of this.bots) if (b.brain instanceof BotController && !b.ownSkill) b.brain.skill = skill;
  }

  /** Cérebro de combate de um bot (HUD de debug e testes); undefined para técnicos. */
  brainOf(mech: MechBase): BotController | undefined {
    const brain = this.bots.find((b) => b.mech === mech)?.brain;
    return brain instanceof BotController ? brain : undefined;
  }

  /** Cérebro de um técnico (testes); undefined para os de combate. */
  technicianOf(mech: MechBase): TechnicianController | undefined {
    const brain = this.bots.find((b) => b.mech === mech)?.brain;
    return brain instanceof TechnicianController ? brain : undefined;
  }

  /** Um bot levou tiro de um alvo que ele caça: se estava só patrulhando, vira e vai atrás. */
  onDamaged(mech: MechBase, shooter: MechBase | undefined): void {
    if (!shooter || !this.targets.includes(shooter)) return;
    this.brainOf(mech)?.alert(shooter);
  }

  /** Um companheiro pede ajuda: informação de impacto, sem conceder visão através de paredes. */
  defend(player: MechBase, shooter: MechBase | undefined): void {
    if (!shooter || !this.targets.includes(shooter)) return;
    for (const { bot, brain } of this.fighters) {
      if (bot.mech.alive && bot.mech.simPosition.distanceToSquared(player.simPosition) < 60 * 60) brain.alert(shooter);
    }
  }

  /**
   * Diretor de ataque: dá as vagas a quem quer atacar, nesta ordem: quem já tem a vaga e está no turno,
   * a prioridade da personalidade (o brabo primeiro), quem espera há mais tempo, e o mais perto do alvo.
   * Quem terminou o turno vai para o fim da fila. Determinístico (ordem
   * estável, sem sorteio); roda 5 vezes por segundo. Custo: um laço e uma ordenação de ≤ 7 bots.
   */
  private direct(dt: number): void {
    this.directorTimer -= dt;
    if (this.directorTimer > 0) return;
    this.directorTimer = DIRECTOR_INTERVAL_S;
    const cand = this.cand;
    cand.length = 0;
    for (const q of this.fighters) {
      const { brain } = q;
      const target = brain.currentTarget;
      q.side = 0;
      brain.hasFlank = false;
      if (!q.bot.mech.alive || !brain.wantsToken || !target) {
        brain.hasToken = false;
        brain.tokenHeld = 0;
        continue;
      }
      // 0 = no turno; 1 = esperando; 2 = o turno acabou: vai para o fim da fila (sem isso, o mais perto do
      // alvo, que é quem estava atacando, ganhava a vaga de novo e só largava quando superaquecia).
      const onTurn = !brain.hasToken ? 1 : brain.tokenHeld < TURN_S ? 0 : 2;
      const me = q.bot.mech.simPosition;
      const tp = target.simPosition;
      // Prioridade (passos de 1e4) > espera (passos de 100 a cada 0,2 s, até 99) > distância (até 99 m).
      const waited = Math.min(Math.round(brain.tokenWait / DIRECTOR_INTERVAL_S), 99);
      q.key = onTurn * 1e6 - brain.persona.priority * 1e4 - waited * 100 + Math.min(Math.hypot(me.x - tp.x, me.z - tp.z), 99);
      // Inserção ordenada (≤ 7 bots), no mesmo array de sempre: nada alocado.
      let i = cand.length;
      cand.push(q);
      while (i > 0 && cand[i - 1]!.key > q.key) {
        cand[i] = cand[i - 1]!;
        i--;
      }
      cand[i] = q;
    }
    let budget = this.maxAttackers;
    for (const q of cand) {
      const cost = q.bot.mech instanceof Android ? ANDROID_COST : 1;
      if (cost <= budget + 1e-9) {
        if (!q.brain.hasToken) q.brain.tokenHeld = 0;
        q.brain.hasToken = true;
        q.brain.tokenWait = 0;
        budget -= cost;
      } else {
        q.brain.hasToken = false;
        q.brain.tokenHeld = 0;
        q.brain.tokenWait += DIRECTOR_INTERVAL_S;
      }
    }
    this.surround();
  }

  /**
   * Cerco: cada um que espera a vaga ganha um flanco do alvo dele, a `FLANK_RAD` da frente do alvo (para onde o torso
   * dele aponta, o que qualquer piloto vê), do lado em que já está (perto da frente, do lado com menos gente); o
   * segundo do mesmo lado vai mais para trás. Quando a vaga passar, ele ataca de onde o alvo não está olhando.
   * A referência é a frente do alvo, não quem ataca: quem ataca anda de lado em volta dele e arrastaria o flanco junto.
   * Determinístico (ordem da fila); custo: ≤ 8 × 8 contas, 5 vezes por segundo.
   */
  private surround(): void {
    const cand = this.cand;
    for (const q of cand) {
      const brain = q.brain;
      if (brain.hasToken || brain.profile.steady || brain.profile.melee) continue;
      const target = brain.currentTarget;
      if (!target) continue;
      const tp = target.simPosition;
      // A frente do alvo é (-sen yaw, -cos yaw); a direção dela, na convenção do cerco (0 = +Z).
      const anchor = Math.atan2(-Math.sin(target.yaw), -Math.cos(target.yaw));
      const me = q.bot.mech.simPosition;
      const off = wrapAngle(Math.atan2(me.x - tp.x, me.z - tp.z) - anchor);
      let left = 0;
      let right = 0;
      for (const o of cand) {
        if (o === q) break;
        if (o.side !== 0 && o.brain.currentTarget === target) o.side > 0 ? left++ : right++;
      }
      q.side = Math.abs(off) < FLANK_TIE_RAD ? (left <= right ? 1 : -1) : Math.sign(off);
      const rank = q.side > 0 ? left : right;
      brain.flankBearing = anchor + q.side * Math.min(Math.PI, FLANK_RAD + rank * FLANK_STEP_RAD);
      brain.hasFlank = true;
    }
  }

  /**
   * Rádio do clã: quem está vendo o alvo passa a posição aos companheiros a até `RADIO_RANGE` (quem não vê ninguém vai
   * lá). O primeiro contato vira aviso na tela. Custo: ≤ 8 contas, no máximo a cada 1,5 s por bot.
   */
  private radio(from: Bot, brain: BotController): void {
    const target = brain.radioReport;
    brain.radioReport = null;
    if (!target?.alive) return;
    const p = from.mech.simPosition;
    for (const { bot, brain: mate } of this.fighters) {
      if (mate === brain || !bot.mech.alive || this.reserves.has(bot.mech)) continue;
      if (bot.mech.simPosition.distanceToSquared(p) > RADIO_RANGE * RADIO_RANGE) continue;
      mate.hear(target, target.simPosition);
    }
    if (!brain.radioContact) return;
    brain.radioContact = false;
    if (this.radioQuiet > 0) return;
    this.radioQuiet = RADIO_CALLOUT_S;
    this.onRadio?.(from.name, target);
  }

  fixedUpdate(dt: number): void {
    if (this.pendingOrder) {
      this.order = this.pendingOrder;
      this.pendingOrder = null;
      for (const { brain } of this.fighters) brain.receiveOrder(this.order, this.orderPoint, this.orderTarget);
    }
    let focusing = false;
    if (this.order === 'focus') for (const { brain } of this.fighters) if (brain.order === 'focus') focusing = true;
    if (this.order === 'focus' && (!this.orderTarget?.alive || !focusing)) {
      this.order = 'follow';
      for (const { brain } of this.fighters) brain.receiveOrder('follow', this.orderPoint, null);
    }
    this.direct(dt);
    this.radioQuiet -= dt;
    for (const bot of this.bots) {
      const { mech, brain } = bot;
      if (!mech.alive) continue;
      if (brain instanceof BotController && this.o.escort) {
        let leader: MechBase | null = null;
        let distance = Infinity;
        for (const player of this.o.escort) {
          const d = player.simPosition.distanceToSquared(mech.simPosition);
          if (player.alive && d < distance) { leader = player; distance = d; }
        }
        brain.leader = leader;
      }
      const input = brain.think(dt, this.targets);
      if (brain instanceof BotController && brain.radioReport) this.radio(bot, brain);
      mech.guard(brain instanceof BotController && brain.wantsGuard);
      mech.fixedUpdate(input, dt);
      // Técnico no alcance: o conserto é regra do tick (quem escolhe o Mech é o cérebro).
      if (brain instanceof TechnicianController && brain.repairTarget) brain.repairTarget.repair(REPAIR_RATE * this.repairScale * dt);
      if (!brain.wantsToFire) continue;
      // Motosserra: o corte é regra do combate (sem projétil).
      if (mech.loadout.primary.kind === 'melee') {
        const target = brain instanceof BotController ? brain.currentTarget : null;
        if (target) this.combat.melee(mech, target, mech.loadout.primary);
        mech.onFire();
        continue;
      }
      mech.simMuzzle(_muzzle);
      this.projectiles.fire(_muzzle, brain.shotDir, mech.collider, true, mech.loadout.primary);
      this.particles.burst(_muzzle, brain.shotDir, { count: 8, color: MUZZLE_COLOR, speed: 10, life: 0.15, spread: 0.5, gravity: 0 });
      mech.onFire();
    }
  }

  render(dt: number, alpha: number): void {
    for (const { mech, brain, beam } of this.bots) {
      mech.render(dt, alpha);
      if (!beam) continue;
      const target = brain instanceof TechnicianController ? brain.repairTarget : null;
      beam.visible = !!target && mech.alive;
      if (!beam.visible || !target) continue;
      // Da ferramenta do técnico ao peito do Mech (posições de render; 6 números, sem alocar).
      const attr = beam.geometry.getAttribute('position') as THREE.BufferAttribute;
      mech.muzzleWorldPosition(_beamTo);
      attr.setXYZ(0, _beamTo.x, _beamTo.y, _beamTo.z);
      _beamTo.copy(target.position).y += target.stats.height * 0.55;
      attr.setXYZ(1, _beamTo.x, _beamTo.y, _beamTo.z);
      attr.needsUpdate = true;
    }
  }
}
