import * as THREE from 'three';
import { GLOW, PALETTE } from '../core/palette';
import type { MechBase } from '../entities/MechBase';
import { Android } from '../entities/Android';
import { ANDROID_STATS, COLOSSUS_BOSS_STATS, VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { PERSONA_LABELS, type Persona } from '../core/Settings';
import { ANDROID_PROFILE, BOSS_PROFILE, BOT_SKILL_NORMAL, BotController, type BotSkill, MECH_PROFILE, PERSONAS } from './BotController';
import type { CombatSystem } from './CombatSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import { REPAIR_RATE } from './repair';
import { TechnicianController } from './TechnicianController';
import type { Respawner } from './Respawner';
import { defaultPower, poweredStats, type PowerSpec } from '../tuning/power';

export const BOT_RESPAWN_S = 4;
/** IA rebelde: vermelho, com visor e tiros vermelhos (o jogador é amarelo com verde neon). */
const BOT_PAINT = PALETTE.enemyPaint;
const MUZZLE_COLOR = GLOW.enemyMuzzle;
/**
 * Nomes das IAs rebeldes, por tipo, na ordem em que entram na arena. Paródias das IAs de verdade (dono, 25/09:
 * "chad-gpt, geminai, kuen, dipsik: nomes meio engraçados, que as pessoas entendam a alusão"), no lugar das
 * marcas registradas. É a única lista a trocar.
 */
export const BOT_NAMES = {
  mechs: ['CLAWD', 'GEMINAI', 'CHAD-GPT'],
  androids: ['KUEN', 'DIPSIK', 'MISTRAU'],
  technicians: ['ENTRÓPICO'],
} as const;

const pick = (list: readonly string[], i: number, prefix: string) => list[i] ?? `${prefix}-${String(i + 1).padStart(2, '0')}`;
/** O diretor redistribui as vagas de ataque a cada tanto (não a cada tick: 5 vezes por segundo basta). */
const DIRECTOR_INTERVAL_S = 0.2;
/** Turno de quem tem a vaga: passado isto, a vaga vai para quem está esperando (revezam). */
const TURN_S = 7;
/** Custo de uma vaga: um Mech conta 1, um andróide conta ½ (é fraco). */
const ANDROID_COST = 0.5;

const _muzzle = new THREE.Vector3();

export interface BotSystemOptions {
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
  /** Potências do painel (por arma e por clã); sem isso, o padrão do jogo. */
  power?: PowerSpec;
}

interface Bot {
  mech: MechBase;
  brain: BotController | TechnicianController;
  name: string;
  home: THREE.Vector3;
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
  /** O Colossus (escala 3), quando a missão tem boss: guardado à parte para o recorte de onda contá-lo. */
  private bossMech: MechBase | null = null;
  /**
   * Vaga de ataque: quantos podem atacar o mesmo alvo ao mesmo tempo (Mech conta 1, andróide ½). Os
   * outros esperam afastados, sem atirar, e revezam a cada turno (dono, 25/09: "eles são muitos e me
   * juntam"). Técnica clássica de jogos de tiro: pressão constante, sem todo mundo de uma vez.
   */
  maxAttackers = Infinity;
  private directorTimer = 0;
  /** Cérebros de combate (o diretor só olha para eles) e a fila ordenada, reaproveitados: sem alocar. */
  private readonly fighters: { bot: Bot; brain: BotController; key: number }[] = [];
  private readonly cand: { bot: Bot; brain: BotController; key: number }[] = [];
  private readonly projectiles: ProjectileSystem;
  private readonly combat: CombatSystem;
  private readonly particles: ParticleSystem;
  /** Ritmo do conserto do técnico (potência do clã; 1 = padrão). */
  private readonly repairScale: number;

  constructor(o: BotSystemOptions) {
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
    const fighter = (mech: MechBase, p: readonly [number, number], name: string, i: number, android: boolean) => {
      const home = place(mech, p);
      const persona = PERSONAS[(!android && o.personas?.[i]) || 'soldado'];
      const brain = new BotController(mech, o.physics, waypoints, seed * 1000 + i, o.skill ?? BOT_SKILL_NORMAL, android ? ANDROID_PROFILE : MECH_PROFILE, persona);
      if (o.respawn !== false) {
        o.respawner.track(mech, BOT_RESPAWN_S, () => {
          if (o.respawnAtHome) mech.respawn(home);
          brain.reset();
        });
      }
      this.bots.push({ mech, brain, name, home });
    };
    // No placar e no nome sobre a cabeça, o nome e a personalidade (CLAUDE·BRABO): o jogador aprende quem é quem.
    const mechName = (i: number) => {
      const persona = o.personas?.[i];
      const name = pick(BOT_NAMES.mechs, i, 'M');
      return persona && persona !== 'soldado' ? `${name}·${PERSONA_LABELS[persona].label.toUpperCase()}` : name;
    };
    // Potências: os números de cada clã são montados uma vez aqui (nada muda no tick).
    const power = o.power ?? defaultPower();
    const mechStats = poweredStats(VECTOR09_STATS, power, 'mechs');
    const androidStats = poweredStats(ANDROID_STATS, power, 'androids');
    this.repairScale = power.clans.technician.damage;
    o.spawns.forEach((p, i) => fighter(new Vector09({ paint: BOT_PAINT, visor: PALETTE.signal, stats: mechStats }), p, mechName(i), i, false));

    // Andróides: sementes depois das dos Mechs.
    (o.androidSpawns ?? []).forEach((p, i) => fighter(new Android({ stats: androidStats }), p, pick(BOT_NAMES.androids, i, 'A'), o.spawns.length + i, true));
    // O Colossus (escala 3), quando a missão tem boss: nasce no ponto dedicado, com o perfil de cerco e sem
    // personalidade de piloto (não é um rebelde, é uma máquina). Entra no pool como os outros: nada é criado no tick.
    if (o.bossSpawn) {
      const boss = new Vector09({ paint: BOT_PAINT, visor: PALETTE.signal, stats: poweredStats(COLOSSUS_BOSS_STATS, power, 'mechs') });
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
      this.bots.push({ mech, brain, name: pick(BOT_NAMES.technicians, i, 'T'), home, beam });
    });
    this.mechs = this.bots.map((b) => b.mech);
    for (const bot of this.bots) if (bot.brain instanceof BotController) this.fighters.push({ bot, brain: bot.brain, key: 0 });
  }

  nameOf(mech: MechBase): string {
    return this.bots.find((b) => b.mech === mech)?.name ?? 'BOT';
  }

  /** Rodada nova: todos inteiros de volta ao ponto de nascimento, olhando o centro, cérebro zerado. */
  respawnAll(): void {
    for (const { mech, brain, home } of this.bots) {
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
    for (const b of this.bots) if (b.brain instanceof BotController) b.brain.skill = skill;
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
  }

  fixedUpdate(dt: number): void {
    this.direct(dt);
    for (const { mech, brain } of this.bots) {
      if (!mech.alive) continue;
      mech.fixedUpdate(brain.think(dt, this.targets), dt);
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
