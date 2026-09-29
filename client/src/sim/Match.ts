import * as THREE from 'three';
import { BotSystem } from '../combat/BotSystem';
import { CombatSystem, type MechHitEvent } from '../combat/CombatSystem';
import { CrushRule } from '../combat/crush';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { RocketSystem } from '../combat/RocketSystem';
import { Respawner } from '../combat/Respawner';
import { Round } from '../combat/Round';
import type { WeaponStats } from '../combat/weapons';
import { ZoneSystem } from '../combat/Zone';
import type { GameSettings } from '../core/Settings';
import type { MechBase } from '../entities/MechBase';
import { Arena, SPAWN_POINTS } from '../environment/Arena';
import { DebrisSystem } from '../environment/DebrisSystem';
import { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { PowerSpec } from '../tuning/power';
import {
  CTF_BASES,
  CaptureTheFlag,
  type CtfScore,
  type CtfTeam,
} from './CaptureTheFlag';
import type { GameMode } from './gameMode';
import {
  SURVIVAL_MAX_ANDROIDS,
  SURVIVAL_MAX_MECHS,
  SURVIVAL_WAVE_PLANS,
  SurvivalWaves,
  type MissionStats,
  type WavePlan,
} from './SurvivalWaves';

/**
 * IAs rebeldes na arena: até 3 Mechs, 3 andróides de combate e 1 técnico (ou, na missão, o Colossus de
 * escala 3 no lugar do técnico). Teto: 7 bots + o jogador = 8 character controllers, o tamanho de sala do jogo (G11).
 */
export const BOT_SPAWNS = [SPAWN_POINTS[2]!, SPAWN_POINTS[4]!, SPAWN_POINTS[8]!];
export const ANDROID_SPAWNS = [SPAWN_POINTS[5]!, SPAWN_POINTS[6]!, SPAWN_POINTS[9]!];
export const TECHNICIAN_SPAWNS = [SPAWN_POINTS[10]!];
/** O Colossus (escala 3) nasce longe do jogador e de frente para ele: 14 m de cápsula pedem espaço. */
export const COLOSSUS_SPAWN = [SPAWN_POINTS[7]!] as const;
/** Dois defensores offline do CTF, perto da base vermelha e sem sobrepor a bandeira. */
export const CTF_DEFENDER_SPAWNS: readonly (readonly [number, number])[] = [
  [68, -72],
  [72, -62],
];
/** Piloto nasce ao lado do mastro: área segura legível, sem sobrepor a bandeira. */
const CTF_PLAYER_OFFSET_X = 5;
/** Segundos até o jogador renascer (os bots: `BOT_RESPAWN_S`). */
export const PLAYER_RESPAWN_S = 3;

/** Quem comanda um Mech a cada tick: o controle do jogador no cliente, a rede no servidor. */
export interface Pilot {
  fixedUpdate(dt: number): void;
}

/** Quantos inimigos e quem são (as configurações do jogador; no servidor, as da sala). */
export type Foes = Pick<GameSettings, 'enemyMechs' | 'enemyAndroids' | 'technician' | 'enemyPersonas'>;

export interface MatchOptions {
  physics: PhysicsWorld;
  /** Onde os modelos entram. No servidor, uma cena que nunca é desenhada. */
  scene: THREE.Scene;
  /** Efeitos das regras (faíscas, fumaça). No servidor, um que não faz nada. */
  particles: ParticleSystem;
  foes: Foes;
  /** Destroços físicos (cosméticos). O servidor desliga: não vão pela rede e custam CPU (G11). */
  debris?: boolean;
  /** Potências do painel (laboratório do dono). O servidor usa o padrão. */
  power?: PowerSpec;
  /** Dano ligado (padrão). No cliente do multiplayer, desligado: quem tira vida é o servidor. */
  damage?: boolean;
  /** Duração da rodada (s). No cliente do multiplayer, infinita: a rodada é a do servidor. */
  roundS?: number;
  /** Regra da missão. `deathmatch` preserva a arena atual; os objetivos estreiam offline. */
  mode?: GameMode;
  /** Onda em que a missão começa (1 a 6). É o atalho de bancada `?onda=`; fora do intervalo, começa na 1. */
  startWave?: number;
}

/**
 * Uma partida inteira sem tela: arena, barricadas, Mechs, bots, tiros, foguetes, dano, renascimento e
 * rodadas, no tick fixo de 60 Hz (G1/G2). É a simulação única do jogo (G14): o cliente a monta e
 * desenha por cima (`core/Game.ts`); o servidor do multiplayer vai rodar esta mesma classe, sem
 * WebGL nem DOM (`MULTIPLAYER.md`, etapa M1). Quem quiser mostrar ou tocar algo ouve os eventos.
 */
export class Match {
  readonly debris: DebrisSystem;
  readonly destructibles: Destructibles;
  readonly arena: Arena;
  readonly projectiles: ProjectileSystem;
  readonly rockets: RocketSystem;
  readonly combat: CombatSystem;
  readonly respawner: Respawner;
  readonly bots: BotSystem;
  readonly round: Round;
  /** Máquina da missão, presente apenas no modo Sobrevivência. */
  readonly waves: SurvivalWaves | null;
  /** Regra pura de bandeiras, presente apenas no modo CTF. */
  readonly ctf: CaptureTheFlag | null;
  /** Pisão: robô grande andando na direção de um pequeno encostado. */
  readonly crush: CrushRule;
  /** Zonas de cura e resfriamento (vantagem tática de posicionamento, igual para os dois lados). */
  readonly zones = new ZoneSystem();
  /** Rodam antes de tudo, a cada tick (na ordem em que entraram). */
  readonly pilots: Pilot[] = [];
  /** Mechs de gente (os bots caçam estes). */
  readonly players: MechBase[] = [];

  /** Acerto em Mech (depois da regra): HUD, som, indicador de dano. */
  onMechHit?: (e: MechHitEvent) => void;
  /** Mech destruído (o placar já contou): explosão, tremor, kill feed. */
  onMechKilled?: (dead: MechBase, at: THREE.Vector3, killer?: MechBase) => void;
  /** Foguete explodiu em `at` (o dano já foi aplicado): fogo, fumaça, tremor, som. */
  onExplosion?: (at: THREE.Vector3) => void;
  /** Barricada quebrou (o servidor manda `PROP_BROKEN` com o `id`; o cliente aplica a mesma no visual). */
  onPropBroken?: (id: number, at: THREE.Vector3) => void;
  /** Rodada nova começou (todos já estão de volta aos pontos de nascimento). */
  onRoundStart?: () => void;
  /**
   * Contrato da interface de missão: nenhuma destas funções pertence à simulação. `total` inclui o Colossus
   * quando a onda tem boss, e `waves` é quantas ondas a missão tem (a tela escreve "ONDA 6/6").
   */
  onWaveStart?: (wave: number, total: number, mechs: number, androids: number, title: string, waves: number) => void;
  onWaveProgress?: (wave: number, killed: number, total: number, elapsedS: number) => void;
  onWaveClear?: (wave: number, elapsedS: number) => void;
  onMissionEnd?: (survived: boolean, waveReached: number, stats: MissionStats) => void;
  /** Eventos primitivos do CTF; HUD e render assinam sem entrar na simulação. */
  onCtfFlag?: (event: 'pickup' | 'drop' | 'return', owner: CtfTeam, actor?: CtfTeam) => void;
  onCtfCapture?: (team: CtfTeam, blue: number, red: number) => void;
  onCtfProgress?: (timeLeft: number, blue: Readonly<CtfScore>, red: Readonly<CtfScore>) => void;
  onCtfEnd?: (winner: CtfTeam | null, blue: Readonly<CtfScore>, red: Readonly<CtfScore>) => void;

  /** O mundo físico da partida (o multiplayer põe nele os robôs remotos, só para colisão). */
  readonly physics: PhysicsWorld;
  private readonly scene: THREE.Scene;
  private readonly _spawn = new THREE.Vector3();

  constructor(o: MatchOptions) {
    const survival = o.mode === 'survival';
    const ctf = o.mode === 'ctf';
    this.physics = o.physics;
    this.round = survival || ctf ? new Round(Number.POSITIVE_INFINITY) : o.roundS === undefined ? new Round() : new Round(o.roundS);
    this.scene = o.scene;
    this.debris = o.debris === false ? (new NoDebris() as unknown as DebrisSystem) : new DebrisSystem(o.scene, o.physics);
    this.destructibles = new Destructibles(o.scene, o.physics, this.debris, o.particles);
    this.destructibles.onBreak = (id, at) => this.onPropBroken?.(id, at);
    this.arena = new Arena(o.scene, o.physics, this.destructibles);
    this.projectiles = new ProjectileSystem(o.scene, o.physics, o.particles);
    this.rockets = new RocketSystem(o.scene, o.physics, o.particles);
    this.combat = new CombatSystem(this.destructibles, this.debris, o.particles);
    this.combat.damageEnabled = o.damage !== false;
    this.respawner = new Respawner(SPAWN_POINTS);
    this.crush = new CrushRule(this.combat);
    this.bots = new BotSystem({
      scene: o.scene,
      physics: o.physics,
      combat: this.combat,
      projectiles: this.projectiles,
      particles: o.particles,
      respawner: this.respawner,
      spawns: ctf ? CTF_DEFENDER_SPAWNS : BOT_SPAWNS.slice(0, survival ? SURVIVAL_MAX_MECHS : o.foes.enemyMechs),
      androidSpawns: ctf ? [] : ANDROID_SPAWNS.slice(0, survival ? SURVIVAL_MAX_ANDROIDS : o.foes.enemyAndroids),
      technicianSpawns: !survival && !ctf && o.foes.technician ? TECHNICIAN_SPAWNS : [],
      bossSpawn: survival ? COLOSSUS_SPAWN[0] : undefined,
      respawn: !survival,
      respawnAtHome: ctf,
      personas: o.foes.enemyPersonas,
      waypoints: SPAWN_POINTS,
      power: o.power,
    });
    this.bots.targets = this.players;
    for (const b of this.bots.mechs) this.round.register(b, this.bots.nameOf(b));
    this.waves = survival
      ? new SurvivalWaves({
          onRoster: (plan) => this.applyWaveRoster(plan),
          onWaveStart: (plan) => this.onWaveStart?.(plan.wave, plan.mechs + plan.androids + (plan.boss ? 1 : 0), plan.mechs, plan.androids, plan.title, SURVIVAL_WAVE_PLANS.length),
          onWaveProgress: (wave, killed, total, elapsedS) => this.onWaveProgress?.(wave, killed, total, elapsedS),
          onWaveClear: (wave, elapsedS) => this.onWaveClear?.(wave, elapsedS),
          onMissionEnd: (survived, stats) => this.onMissionEnd?.(survived, this.waves?.wave ?? 1, stats),
        }, o.startWave)
      : null;
    if (this.waves) this.bots.setRoster(0, 0);
    this.ctf = ctf
      ? new CaptureTheFlag({
          onFlagPickup: (owner, carrier) => this.onCtfFlag?.('pickup', owner, carrier),
          onFlagDrop: (owner) => this.onCtfFlag?.('drop', owner),
          onFlagReturn: (owner) => this.onCtfFlag?.('return', owner),
          onCapture: (team, blue, red) => this.onCtfCapture?.(team, blue, red),
          onProgress: (timeLeft, blue, red) => this.onCtfProgress?.(timeLeft, blue, red),
          onMatchEnd: (winner, blue, red) => this.onCtfEnd?.(winner, blue, red),
        })
      : null;
    if (this.ctf) for (const bot of this.bots.mechs) this.ctf.register(bot, 'red');

    // As regras ficam aqui; a tela e o som só ouvem os eventos.
    this.projectiles.onHit = (hit, dir, damage, owner) => this.combat.onProjectileHit(hit, dir, damage, owner);
    this.rockets.onExplode = (at, dir, owner, w) => {
      this.combat.explode(at, dir, owner, w);
      this.onExplosion?.(at);
    };
    this.combat.onMechHit = (e) => {
      if (!this.players.includes(e.mech)) this.bots.onDamaged(e.mech, e.shooter);
      if (this.waves && e.shooter && this.players.includes(e.shooter) && this.bots.mechs.includes(e.mech)) {
        this.waves.recordDamage(e.result.applied);
      }
      this.onMechHit?.(e);
    };
    this.combat.onMechKilled = (dead, at, killer) => {
      this.round.recordKill(dead, killer);
      this.ctf?.onKilled(dead, killer);
      if (this.waves && this.bots.mechs.includes(dead) && this.waves.recordEnemyKilled()) {
        this.projectiles.clear();
        this.rockets.clear();
      }
      if (this.waves && this.players.includes(dead) && this.players.every((player) => !player.alive)) this.waves.fail();
      this.onMechKilled?.(dead, at, killer);
    };
  }

  /**
   * Entra um Mech de gente: nasce no ponto `spawnIndex`, entra no combate, no renascimento e no placar,
   * e os bots passam a caçá-lo. `onRespawn`: o dono do Mech troca o que precisar (ex.: a montagem do Hangar).
   */
  addPlayer(mech: MechBase, name: string, spawnIndex = this.players.length, onRespawn?: () => void, team: CtfTeam = 'blue'): void {
    const [x, z] = this.ctf
      ? [CTF_BASES[team].x + (team === 'blue' ? CTF_PLAYER_OFFSET_X : -CTF_PLAYER_OFFSET_X), CTF_BASES[team].z]
      : SPAWN_POINTS[spawnIndex % SPAWN_POINTS.length]!;
    mech.spawn(this.physics, this._spawn.set(x, 0, z));
    this.scene.add(mech.root);
    mech.onDashImpact = (collider, dir) => this.destructibles.demolish(collider, dir);
    this.combat.register(mech);
    if (!this.waves) {
      this.respawner.track(mech, PLAYER_RESPAWN_S, () => {
        if (this.ctf) {
          const base = CTF_BASES[team];
          mech.respawn(this._spawn.set(base.x + (team === 'blue' ? CTF_PLAYER_OFFSET_X : -CTF_PLAYER_OFFSET_X), 0, base.z));
        }
        onRespawn?.();
      });
    }
    this.round.register(mech, name);
    this.players.push(mech);
    this.ctf?.register(mech, team);
  }

  /**
   * Tira um jogador da partida (saiu da sala): regras, placar, renascimento, cena e física. Antes, ele "cai"
   * (torso a zero, sem contar abate): os bots que o caçavam largam o alvo.
   */
  removePlayer(mech: MechBase): void {
    const i = this.players.indexOf(mech);
    if (i < 0) return;
    this.players.splice(i, 1);
    mech.modules.torso = 0;
    this.combat.unregister(mech);
    this.respawner.untrack(mech);
    this.round.unregister(mech);
    this.ctf?.unregister(mech);
    this.scene.remove(mech.root);
    mech.despawn(this.physics);
  }

  /**
   * Corte corpo a corpo de um jogador (motosserra do andróide pilotado): pega o inimigo vivo mais perto
   * dentro do alcance da arma. Regra da partida (o controle só pede); sem ninguém perto, nada acontece.
   */
  meleeNearest(attacker: MechBase, w: WeaponStats): void {
    const foes = this.players.includes(attacker) ? this.bots.mechs : this.players;
    const a = attacker.simPosition;
    let best: MechBase | null = null;
    let bestGap = w.maxRange;
    for (const m of foes) {
      if (!m.alive) continue;
      const gap = Math.hypot(m.simPosition.x - a.x, m.simPosition.z - a.z) - m.stats.radius - attacker.stats.radius;
      if (gap <= bestGap) {
        bestGap = gap;
        best = m;
      }
    }
    if (best) this.combat.melee(attacker, best, w);
  }

  /**
   * Um tick fixo. Entre rodadas (placar na tela) o mundo fica congelado e só o relógio anda. Devolve
   * true no tick em que uma rodada nova começa.
   */
  step(dt: number): boolean {
    if (this.round.playing) {
      this.waves?.fixedUpdate(dt, this.players.some((player) => player.alive));
      if (this.waves?.ended) return false;
      for (const p of this.pilots) p.fixedUpdate(dt);
      this.bots.fixedUpdate(dt);
      // Pisão nos dois sentidos: Mech do jogador em andróide rebelde, e Mech rebelde num jogador pequeno.
      this.crush.tick(dt);
      this.crush.check(this.players, this.bots.mechs);
      this.crush.check(this.bots.mechs, this.players);
      this.zones.fixedUpdate(dt, this.players);
      this.zones.fixedUpdate(dt, this.bots.mechs);
      this.respawner.fixedUpdate(dt);
      this.projectiles.fixedUpdate(dt);
      this.rockets.fixedUpdate(dt);
      this.physics.step();
      this.ctf?.fixedUpdate(dt);
    }
    if (this.round.fixedUpdate(dt) !== 'started') return false;
    this.restart();
    return true;
  }

  /** Recomeça o objetivo usando os mesmos corpos físicos e pools. */
  restartMission(): void {
    if (!this.waves && !this.ctf) return;
    this.players.forEach((m, i) => {
      const [x, z] = this.ctf
        ? [CTF_BASES.blue.x + CTF_PLAYER_OFFSET_X, CTF_BASES.blue.z]
        : SPAWN_POINTS[i % SPAWN_POINTS.length]!;
      m.respawn(this._spawn.set(x, 0, z));
    });
    if (this.ctf) this.bots.respawnAll();
    this.projectiles.clear();
    this.rockets.clear();
    this.debris.clear();
    this.destructibles.restoreAll();
    this.round.resetScores();
    this.waves?.reset();
    this.ctf?.reset();
  }

  private applyWaveRoster(plan: WavePlan | null): void {
    const boss = plan?.boss ? 1 : 0;
    const active = this.bots.setRoster(plan?.mechs ?? 0, plan?.androids ?? 0, boss);
    if (plan) {
      this.bots.maxAttackers = plan.maxAttackers;
      if (active !== plan.mechs + plan.androids + boss) throw new Error('Pool da missão não cobre o plano da onda');
    }
  }

  /**
   * Rodada nova: todos inteiros nos pontos de nascimento, arena restaurada. A ordem importa: Mechs saem
   * de perto das estruturas e os destroços somem antes de as barricadas voltarem.
   */
  private restart(): void {
    this.players.forEach((m, i) => {
      const [x, z] = SPAWN_POINTS[i % SPAWN_POINTS.length]!;
      m.respawn(this._spawn.set(x, 0, z));
    });
    this.bots.respawnAll();
    this.projectiles.clear();
    this.rockets.clear();
    this.debris.clear();
    this.destructibles.restoreAll();
    this.onRoundStart?.();
  }
}

/** Destroços desligados (servidor): as regras chamam, nada acontece. */
class NoDebris {
  readonly count = 0;
  shatter(): void {}
  clear(): void {}
  sync(): void {}
}
