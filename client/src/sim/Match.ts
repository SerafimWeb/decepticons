import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { BarrageSystem } from '../combat/BarrageSystem';
import { BotSystem, type BotKit, type BotSystemOptions } from '../combat/BotSystem';
import { CombatSystem, type MechHitEvent } from '../combat/CombatSystem';
import { CrushRule } from '../combat/crush';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { RocketSystem } from '../combat/RocketSystem';
import { Respawner } from '../combat/Respawner';
import { DroneSystem } from '../combat/DroneSystem';
import { FireRing, type RingSides } from '../combat/FireRing';
import { Round } from '../combat/Round';
import { hitDamage, rangeFactor, type Flame, type WeaponStats } from '../combat/weapons';
import type { TaticaId } from '../combat/taticas';
import type { PhysicsHit } from '../physics/PhysicsWorld';
import { ZoneSystem } from '../combat/Zone';
import { PALETTE } from '../core/palette';
import type { GameSettings } from '../core/Settings';
import type { MechBase } from '../entities/MechBase';
import { Arena, SPAWN_POINTS } from '../environment/Arena';
import { BUNKER_SPAWNS, type MapId } from '../environment/Bunker';
import { PRAIA_AGUA, PRAIA_ASSALTO, PRAIA_INIMIGOS, PRAIA_SPAWNS, PRAIA_TITA, PRAIA_ZONES } from '../environment/PraiaLayout';
import { dentroDoComplexo, NUCLEO, NucleoDaEstacao, pesoDoInvasor } from './NucleoDaEstacao';
import { danoDeAfogamento, fatorDeVelocidade, FUNDURA_MOLHADA, fundoParaAfogar, funduraEm, passoDoAfogamento, type Agua } from '../combat/Agua';
import { DebrisSystem } from '../environment/DebrisSystem';
import { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { drawWave } from '../fx/WaveVisuals';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { PowerSpec } from '../tuning/power';
import {
  CTF_BASES,
  CaptureTheFlag,
  type CtfScore,
  type CtfTeam,
} from './CaptureTheFlag';
import { Dominio, type DominioLado, type DominioPlacar, type DominioPonto } from './Dominio';
import { atribuirPontos } from './DominioObjetivos';
import { NASCIMENTOS_DO_DOMINIO, PONTOS_DO_DOMINIO } from './dominioMapa';
import { ehTita } from '../entities/chassis';
import { esquadraoDeFoes, planejarEsquadrao, sanearEsquadrao, type EsquadraoSpec, type PlanoDoEsquadrao, type SlotDoPlano } from './esquadrao';
import type { GameMode } from './gameMode';
import { ALLY_COUNT, ANDROID_SPAWNS, BOT_SPAWNS, COLOSSUS_SPAWN } from './nascimentos';
import {
  SURVIVAL_MAX_ANDROIDS,
  SURVIVAL_MAX_MECHS,
  SURVIVAL_WAVE_PLANS,
  SurvivalWaves,
  type MissionStats,
  type WavePlan,
} from './SurvivalWaves';

/**
 * Os pontos de nascimento ficam em `nascimentos.ts` (o esquadrão e a partida leem os mesmos). IAs rebeldes da Arena sem esquadrão pedido:
 * as das configurações, até 3 Mechs, 3 andróides de combate e 1 técnico (ou, na missão, o Colossus de escala 3 no lugar do técnico), com
 * 2 aliados que tiram vaga dos Mechs; teto de 8 character controllers no servidor, o tamanho de sala do jogo (G11). Com esquadrão
 * (`MatchOptions.squad`), o teto é o de `LIMITES_DO_ESQUADRAO`.
 */
export { ALLY_COUNT, ALLY_SPAWNS, ANDROID_SPAWNS, BOT_SPAWNS, COLOSSUS_SPAWN, TECHNICIAN_SPAWNS } from './nascimentos';
/** Dois defensores offline do CTF, perto da base vermelha e sem sobrepor a bandeira. */
export const CTF_DEFENDER_SPAWNS: readonly (readonly [number, number])[] = [
  [68, -72],
  [72, -62],
];
/** De quanto em quanto tempo (s) os bots do Domínio refazem a escolha do ponto em que vão (`DominioObjetivos`). */
const DOMINIO_REPLANEJA_S = 2;
/** O Domínio leva cada lado para a sua base: o jogador e os aliados no canto azul, os rebeldes no vermelho (os titãs mantêm os pontos deles). */
function levarParaAsBases(plano: PlanoDoEsquadrao): void {
  const { blue, red } = NASCIMENTOS_DO_DOMINIO;
  let r = 0;
  for (const s of [...plano.inimigos.mechs.filter((m) => !ehTita(m.chassi)), ...plano.inimigos.androids, ...plano.inimigos.tecnicos]) s.ponto = red[r++ % red.length]!;
  let b = 1; // o ponto 0 azul é o do jogador
  for (const s of [...plano.aliados.mechs, ...plano.aliados.androids]) s.ponto = blue[b++ % blue.length]!;
}
/** Piloto nasce ao lado do mastro: área segura legível, sem sobrepor a bandeira. */
const CTF_PLAYER_OFFSET_X = 5;
/** Tiros no ar de uma vez: 64 no jogo de sempre (3 Mechs de IA) e mais 4 por Mech de IA a partir do quarto (esquadrão, P91). */
const PROJETEIS_BASE = 64;
const PROJETEIS_POR_MECH = 4;
const MECHS_DO_JOGO_BASE = 3;
/** Segundos até o jogador renascer (os bots: `BOT_RESPAWN_S`). */
export const PLAYER_RESPAWN_S = 3;

/** Quem comanda um Mech a cada tick: o controle do jogador no cliente, a rede no servidor. */
export interface Pilot {
  fixedUpdate(dt: number): void;
}

/** Quantos inimigos e quem são (as configurações do jogador; no servidor, as da sala). */
export type Foes = Pick<GameSettings, 'enemyMechs' | 'enemyAndroids' | 'technician' | 'enemyPersonas' | 'names'>;

export interface MatchOptions {
  /** O corpo de malha importada de um chassi, se o cliente o tem pronto (os bots do esquadrão usam; o servidor não passa). */
  rigDoChassi?: BotSystemOptions['rigDoChassi'];
  map?: MapId;
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
  /**
   * Aliados na Arena normal (30/09). Padrão ligado offline; o servidor (`ArenaRoom.ts`) passa `false`
   * de propósito — o roster de rede (`shared/net`) ainda não sabe descrever um aliado pros outros
   * jogadores, então isso ficaria invisível e fora de sincronia no multiplayer. AUSENTE lá até isso
   * ser resolvido (`STATUS_REAL.md`); a Arena offline (single-player) já funciona hoje.
   */
  allies?: boolean;
  /** Drones da base Serafim (06/10). Seguem os aliados: ligados na Arena offline, desligados no servidor por ora. */
  drones?: boolean;
  /**
   * Quem nasce na Arena e no Bunker, um por um (12/10, P91: "mais bots e aliados, além dos 3 do padrão"). Sem isto, sai das configurações
   * (`foes`): o jogo de sempre, que `esquadraoPadrao.test.ts` fotografa. Passa por `sanearEsquadrao`, que corta o que não cabe no mapa;
   * com `allies: false` (o servidor, o online) os aliados do esquadrão ficam de fora. Sobrevivência e CTF têm o pool e os times deles.
   */
  squad?: EsquadraoSpec;
  /** A **tática** do esquadrão aliado (ordem P122): a formação e o leash. Ausente = `centro`. */
  tatica?: TaticaId | null;
}

/**
 * Uma partida inteira sem tela: arena, barricadas, Mechs, bots, tiros, foguetes, dano, renascimento e
 * rodadas, no tick fixo de 60 Hz (G1/G2). É a simulação única do jogo (G14): o cliente a monta e
 * desenha por cima (`core/Game.ts`); o servidor do multiplayer vai rodar esta mesma classe, sem
 * WebGL nem DOM (`MULTIPLAYER.md`, etapa M1). Quem quiser mostrar ou tocar algo ouve os eventos.
 */
const _flameAt = new THREE.Vector3();
const _flameTo = new THREE.Vector3();
/** O "acerto" que o cone entrega ao CombatSystem: um objeto só, reescrito a cada alvo (nada alocado por pulso). */
const _flameHit: PhysicsHit = { point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), distance: 0, collider: undefined as unknown as RAPIER.Collider };

/** O que o HUD da praia lê da água sob os pés de um Mech (`Match.estadoDaAgua`). */
export interface EstadoDaAgua {
  fundura: number;
  afogandoS: number;
  afogarS: number;
  afogaDesde: number;
}

export class Match {
  readonly debris: DebrisSystem;
  readonly destructibles: Destructibles;
  readonly arena: Arena;
  readonly projectiles: ProjectileSystem;
  readonly rockets: RocketSystem;
  /** Chuva de mísseis (armas com `barrage`): sobe, e as bombas caem em volta da mira. */
  readonly barrage: BarrageSystem;
  readonly combat: CombatSystem;
  /** As partículas da partida (vazias no servidor): a onda sônica se desenha por aqui. */
  private readonly fx: ParticleSystem;
  /** Saiu uma onda sônica (o servidor a transforma em evento de tiro para os outros jogadores desenharem). */
  onWave?: (origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;
  /** Só o cliente liga: solta os anéis que distorcem o ar (`fx/WaveRings`). O servidor não desenha nada. */
  onWaveFx?: (origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats) => void;
  /** O anel de fogo (módulo de escudo `fire`): o que cada pulso faz em volta do dono (`combat/FireRing.ts`). */
  readonly fireRing: FireRing;
  /** Quem o anel de cada lado queima e quem só esquenta; montado uma vez (G4). */
  private readonly ringOfPlayers: RingSides;
  private readonly ringOfAllies: RingSides;
  private readonly ringOfRebels: RingSides;
  readonly respawner: Respawner;
  readonly bots: BotSystem;
  /** Aliados do jogador (30/09), só na Arena normal — `null` em Sobrevivência/CTF. */
  readonly allies: BotSystem | null;
  /** Drones da base Serafim, do lado do jogador (`combat/DroneSystem.ts`); `null` fora da Arena offline. */
  readonly drones: DroneSystem | null;
  readonly round: Round;
  /** Máquina da missão, presente apenas no modo Sobrevivência. */
  readonly waves: SurvivalWaves | null;
  /** Regra pura de bandeiras, presente apenas no modo CTF. */
  readonly ctf: CaptureTheFlag | null;
  /** Regra pura dos pontos de controle, presente apenas no modo Domínio. */
  readonly dominio: Dominio | null;
  /** Para onde cada bot do Domínio foi mandado (índice do ponto; -1 nenhum), na ordem de `bots.mechs` e `allies.mechs`. */
  private readonly rumoRed: number[] = [];
  private readonly rumoBlue: number[] = [];
  private readonly rumoNovo: number[] = [];
  private readonly cargaDosPontos: number[] = PONTOS_DO_DOMINIO.map(() => 0);
  private readonly pontosV3 = PONTOS_DO_DOMINIO.map((p) => new THREE.Vector3(p.x, 0, p.z));
  private replanejaEm = 0;
  /** Pisão: robô grande andando na direção de um pequeno encostado. */
  readonly crush: CrushRule;
  /** Zonas de cura e resfriamento (vantagem tática de posicionamento, igual para os dois lados). */
  readonly zones: ZoneSystem;
  private readonly spawnPoints: readonly (readonly [number, number])[];
  /** A água do mapa (P126), quando é a praia: freia e afoga quem entra no mar. `null` nos outros mapas. */
  private readonly agua: Agua | null = null;
  /** Há quanto tempo cada Mech está com os pés na água (o afogamento) — rascunho reaproveitado, sem alocar (G4). */
  private readonly afogando = new Map<MechBase, number>();
  /** O núcleo da estação (P127): a "integridade da rede" que a missão em ondas da praia defende. `null` nos outros mapas e modos. */
  readonly nucleo: NucleoDaEstacao | null = null;
  /** Rodam antes de tudo, a cada tick (na ordem em que entraram). */
  readonly pilots: Pilot[] = [];
  /** Mechs de gente (os bots caçam estes). */
  readonly players: MechBase[] = [];

  /** Acerto em Mech (depois da regra): HUD, som, indicador de dano. */
  onMechHit?: (e: MechHitEvent) => void;
  /** Mech destruído (o placar já contou): explosão, tremor, kill feed. */
  onMechKilled?: (dead: MechBase, at: THREE.Vector3, killer?: MechBase) => void;
  /**
   * Rádio do clã (11/10): um bot avistou `target` e avisou os companheiros (primeiro contato, no máximo um aviso a cada
   * 8 s por time). `allied`: foi um aliado do jogador. Só tela; a regra já aconteceu dentro do `BotSystem`.
   */
  onRadio?: (from: string, target: MechBase, allied: boolean) => void;
  /** Foguete explodiu em `at` (o dano já foi aplicado): fogo, fumaça, tremor, som. */
  onExplosion?: (at: THREE.Vector3) => void;
  /** Barricada quebrou (o servidor manda `PROP_BROKEN` com o `id`; o cliente aplica a mesma no visual). */
  onPropBroken?: (id: number, at: THREE.Vector3) => void;
  /** Um alvo externo (um coqueiro, um guarda-sol: P138) caiu em `at`; `peso` é o tamanho do abalo (uma barricada vale 1). Só offline. */
  onAlvoQuebrado?: (at: THREE.Vector3, peso: number) => void;
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
  /** Eventos do Domínio; a tela e o som assinam sem entrar na simulação. */
  onDominioDono?: (ponto: DominioPonto, antes: DominioLado | null, depois: DominioLado | null) => void;
  onDominioProgresso?: (tempoRestante: number, azul: Readonly<DominioPlacar>, vermelho: Readonly<DominioPlacar>) => void;
  onDominioFim?: (vencedor: DominioLado | null, azul: Readonly<DominioPlacar>, vermelho: Readonly<DominioPlacar>) => void;

  /** O mundo físico da partida (o multiplayer põe nele os robôs remotos, só para colisão). */
  readonly physics: PhysicsWorld;
  private readonly scene: THREE.Scene;
  private readonly _spawn = new THREE.Vector3();

  constructor(o: MatchOptions) {
    const survival = o.mode === 'survival';
    const ctf = o.mode === 'ctf';
    const dominio = o.mode === 'dominio';
    this.physics = o.physics;
    this.round = survival || ctf || dominio ? new Round(Number.POSITIVE_INFINITY) : o.roundS === undefined ? new Round() : new Round(o.roundS);
    this.scene = o.scene;
    this.debris = o.debris === false ? (new NoDebris() as unknown as DebrisSystem) : new DebrisSystem(o.scene, o.physics);
    this.destructibles = new Destructibles(o.scene, o.physics, this.debris, o.particles);
    this.destructibles.onBreak = (id, at) => this.onPropBroken?.(id, at);
    this.destructibles.onAlvoQuebrado = (at, peso) => this.onAlvoQuebrado?.(at, peso);
    const bunker = o.map === 'bunker' && !survival && !ctf && !dominio;
    // A praia abre o Deathmatch e as **ondas** (a defesa da estação, P126): os CTF/Domínio continuam na Arena.
    const praia = o.map === 'praia' && !ctf && !dominio;
    this.spawnPoints = bunker ? BUNKER_SPAWNS : praia ? PRAIA_SPAWNS : SPAWN_POINTS;
    this.zones = bunker ? new ZoneSystem([]) : praia ? new ZoneSystem(PRAIA_ZONES) : new ZoneSystem();
    this.arena = new Arena(o.scene, o.physics, this.destructibles, bunker ? 'bunker' : praia ? 'praia' : 'arena');
    // A água da praia (P126): o mar freia e afoga quem entra nele. Nos outros mapas não há água.
    this.agua = praia ? PRAIA_AGUA : null;
    // A missão em ondas da praia defende a estação: os rebeldes que entram nos muros drenam o núcleo; a estação cair é perder a missão.
    this.nucleo = praia && survival ? new NucleoDaEstacao() : null;
    this.fx = o.particles;
    // O esquadrão (P91): quem nasce na Arena e no Bunker, um por um. Sem um pedido, o das configurações. Aliados (30/09, "sozinho tá
    // muito intenso"): só na Arena normal; o esquadrão das configurações dá a eles as vagas do pool de Mechs inimigos para não
    // estourar o teto de 8 personagens da sala (G11). Sobrevivência e CTF não usam esquadrão (pool e times próprios).
    const arenaMode = !survival && !ctf;
    const mapa: MapId = bunker ? 'bunker' : praia ? 'praia' : 'arena';
    const semAliados = o.allies === false;
    const pedido = o.squad ?? esquadraoDeFoes(o.foes, semAliados ? 0 : ALLY_COUNT);
    const plano = arenaMode ? planejarEsquadrao(sanearEsquadrao(semAliados ? { ...pedido, aliados: [] } : pedido, mapa), mapa, o.foes.names) : null;
    if (dominio && plano) levarParaAsBases(plano);
    // O pool de tiros cresce com os Mechs que atiram (cada um solta uma rajada por vez): sem isso, num esquadrão grande o tiro some (G5).
    const atiradores = plano ? plano.inimigos.mechs.length + plano.aliados.mechs.length : 0;
    this.projectiles = new ProjectileSystem(o.scene, o.physics, o.particles, PROJETEIS_BASE + PROJETEIS_POR_MECH * Math.max(0, atiradores - MECHS_DO_JOGO_BASE));
    this.rockets = new RocketSystem(o.scene, o.physics, o.particles);
    this.barrage = new BarrageSystem(o.scene, o.physics);
    this.combat = new CombatSystem(this.destructibles, this.debris, o.particles);
    this.combat.damageEnabled = o.damage !== false;
    this.combat.sameSide = (a, b) => this.sameSide(a, b);
    this.respawner = new Respawner(this.spawnPoints);
    this.crush = new CrushRule(this.combat);
    const kitDe = (s: SlotDoPlano): BotKit => ({ chassi: s.chassi, arma: s.arma, secundaria: s.secundaria, dificuldade: s.dificuldade });
    const pontos = (l: readonly SlotDoPlano[]) => l.map((s) => s.ponto);
    const nomes = (l: readonly SlotDoPlano[]) => l.map((s) => s.nome);
    const rebeldes = plano?.inimigos;
    this.bots = new BotSystem({
      rigDoChassi: o.rigDoChassi,
      scene: o.scene,
      physics: o.physics,
      combat: this.combat,
      projectiles: this.projectiles,
      particles: o.particles,
      respawner: this.respawner,
      ...(rebeldes
        ? {
            spawns: pontos(rebeldes.mechs),
            androidSpawns: pontos(rebeldes.androids),
            technicianSpawns: pontos(rebeldes.tecnicos),
            personas: rebeldes.mechs.map((s) => s.persona),
            names: { mechs: nomes(rebeldes.mechs), androids: nomes(rebeldes.androids), technicians: nomes(rebeldes.tecnicos) },
            kits: rebeldes.mechs.map(kitDe),
            androidKits: rebeldes.androids.map(kitDe),
          }
        : {
            // Na praia as ondas nascem na areia, longe da estação (o jogador defende a estação); na Arena, nos pontos de sempre.
            spawns: ctf ? CTF_DEFENDER_SPAWNS : praia ? PRAIA_INIMIGOS.slice(0, SURVIVAL_MAX_MECHS) : BOT_SPAWNS.slice(0, SURVIVAL_MAX_MECHS),
            androidSpawns: ctf ? [] : praia ? PRAIA_INIMIGOS.slice(SURVIVAL_MAX_MECHS, SURVIVAL_MAX_MECHS + SURVIVAL_MAX_ANDROIDS) : ANDROID_SPAWNS.slice(0, SURVIVAL_MAX_ANDROIDS),
            technicianSpawns: [],
            personas: o.foes.enemyPersonas,
            names: { mechs: o.foes.names.mechs, androids: o.foes.names.androids, technicians: o.foes.names.technicians },
          }),
      bossSpawn: survival ? (praia ? PRAIA_TITA : COLOSSUS_SPAWN[0]) : undefined,
      respawn: !survival,
      respawnAtHome: ctf,
      // Na praia de 640 m as ondas marcham para os portões da estação (patrulham a rota de assalto): sem isso vagariam por pontos espalhados.
      waypoints: survival && praia ? PRAIA_ASSALTO : this.spawnPoints,
      power: o.power,
    });
    const escolta = plano?.aliados;
    this.allies =
      escolta && escolta.mechs.length + escolta.androids.length > 0
        ? new BotSystem({
            rigDoChassi: o.rigDoChassi,
            scene: o.scene,
            physics: o.physics,
            combat: this.combat,
            projectiles: this.projectiles,
            particles: o.particles,
            respawner: this.respawner,
            escort: this.players,
            tatica: o.tatica,
            paint: PALETTE.playerPaint,
            visor: PALETTE.green,
            spawns: pontos(escolta.mechs),
            androidSpawns: pontos(escolta.androids),
            personas: escolta.mechs.map((s) => s.persona),
            names: { mechs: nomes(escolta.mechs), androids: nomes(escolta.androids) },
            kits: escolta.mechs.map(kitDe),
            androidKits: escolta.androids.map(kitDe),
            waypoints: this.spawnPoints,
            power: o.power,
          })
        : null;
    // O inimigo caça jogador E aliado; o aliado só caça o inimigo (nunca o próprio jogador).
    this.refreshEnemyTargets();
    if (this.allies) this.allies.targets = this.bots.mechs;
    // O anel de fogo: o jogador queima os rebeldes (e os outros jogadores, como o lança-chamas) e só esquenta os aliados; o aliado queima os rebeldes; o rebelde queima o jogador e os aliados.
    this.fireRing = new FireRing(this.combat);
    this.ringOfPlayers = { foes: [this.bots.mechs, this.players], friends: this.allies ? [this.allies.mechs] : [] };
    this.ringOfAllies = { foes: [this.bots.mechs], friends: this.allies ? [this.players, this.allies.mechs] : [this.players] };
    this.ringOfRebels = { foes: this.allies ? [this.players, this.allies.mechs] : [this.players], friends: [this.bots.mechs] };
    this.bots.onRadio = (from, target) => this.onRadio?.(from, target, false);
    if (this.allies) this.allies.onRadio = (from, target) => this.onRadio?.(from, target, true);
    for (const b of this.bots.mechs) this.round.register(b, this.bots.nameOf(b));
    if (this.allies) for (const b of this.allies.mechs) this.round.register(b, this.allies.nameOf(b));
    this.waves = survival
      ? new SurvivalWaves({
          onRoster: (plan) => this.applyWaveRoster(plan),
          onWaveStart: (plan) => this.onWaveStart?.(plan.wave, plan.mechs + plan.androids + (plan.boss ? 1 : 0), plan.mechs, plan.androids, plan.title, SURVIVAL_WAVE_PLANS.length),
          onWaveProgress: (wave, killed, total, elapsedS) => this.onWaveProgress?.(wave, killed, total, elapsedS),
          onWaveClear: (wave, elapsedS) => {
            this.nucleo?.curar(NUCLEO.curaPorOnda); // a onda eliminada devolve um pouco da rede
            this.onWaveClear?.(wave, elapsedS);
          },
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
    this.dominio = dominio
      ? new Dominio(PONTOS_DO_DOMINIO, {
          onDono: (p, antes, depois) => this.onDominioDono?.(p, antes, depois),
          onProgresso: (tempo, azul, vermelho) => this.onDominioProgresso?.(tempo, azul, vermelho),
          onFim: (vencedor, azul, vermelho) => this.onDominioFim?.(vencedor, azul, vermelho),
        })
      : null;
    if (this.dominio) {
      for (const bot of this.bots.mechs) this.dominio.register(bot, 'red');
      if (this.allies) for (const aliado of this.allies.mechs) this.dominio.register(aliado, 'blue');
      this.respawner.setTeams(NASCIMENTOS_DO_DOMINIO, (m) => this.dominio?.ladoDe(m));
      this.rumoRed.length = this.bots.mechs.length;
      this.rumoRed.fill(-1);
      this.rumoBlue.length = this.allies?.mechs.length ?? 0;
      this.rumoBlue.fill(-1);
      this.rumoNovo.length = Math.max(this.rumoRed.length, this.rumoBlue.length);
    }

    // As regras ficam aqui; a tela e o som só ouvem os eventos.
    this.projectiles.onHit = (hit, dir, damage, owner, w, distance) => {
      if (this.drones?.hit(hit.collider, damage)) return;
      this.combat.onProjectileHit(hit, dir, damage, owner, w, distance);
    };
    const explode = (at: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats): void => {
      this.combat.explode(at, dir, owner, w);
      this.drones?.explosion(at, w);
      this.onExplosion?.(at);
    };
    // Drones (06/10): só onde os aliados existem; o kamikaze explode pela mesma regra dos foguetes.
    this.drones =
      this.allies !== null && o.drones !== false && !bunker
        ? new DroneSystem({
            physics: o.physics,
            projectiles: this.projectiles,
            particles: o.particles,
            friends: () => this.friendly,
            enemies: () => this.bots.mechs,
            explode: (at, dir, w) => explode(at, dir, undefined, w),
          })
        : null;
    this.rockets.onExplode = explode;
    this.rockets.acquire = (origin, dir, owner, w) => this.seekTarget(origin, dir, owner, w);
    this.barrage.onExplode = explode;
    this.combat.onMechHit = (e) => {
      if (this.players.includes(e.mech)) this.allies?.defend(e.mech, e.shooter);
      if (this.allies?.mechs.includes(e.mech)) this.allies.onDamaged(e.mech, e.shooter);
      else if (!this.players.includes(e.mech)) this.bots.onDamaged(e.mech, e.shooter);
      if (this.waves && e.shooter && this.players.includes(e.shooter) && this.bots.mechs.includes(e.mech)) {
        this.waves.recordDamage(e.result.applied);
      }
      this.onMechHit?.(e);
    };
    this.combat.onMechKilled = (dead, at, killer) => {
      this.round.recordKill(dead, killer);
      this.ctf?.onKilled(dead, killer);
      this.dominio?.onKilled(dead, killer);
      if (this.waves && this.bots.mechs.includes(dead) && this.waves.recordEnemyKilled()) {
        this.projectiles.clear();
        this.rockets.clear();
        this.barrage.clear();
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
      : this.dominio
        ? NASCIMENTOS_DO_DOMINIO[team][0]!
        : this.spawnPoints[spawnIndex % this.spawnPoints.length]!;
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
    this.dominio?.register(mech, team);
    this.refreshEnemyTargets();
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
    this.dominio?.unregister(mech);
    this.scene.remove(mech.root);
    mech.despawn(this.physics);
    this.refreshEnemyTargets();
  }

  /** O time de cada Mech, quando a sala tem times (`setTeam`); fora dele valem o CTF e os aliados da Arena. */
  private readonly teams = new Map<MechBase, number>();

  /** Põe `mech` num time (salas com times). Dois Mechs do mesmo time são aliados: o gelo de um esfria o outro. Sem time, o Mech não é aliado de ninguém por este caminho. */
  setTeam(mech: MechBase, team: number | null): void {
    if (team === null) this.teams.delete(mech);
    else this.teams.set(mech, team);
  }

  /**
   * Dois Mechs diferentes estão do mesmo lado? Na ordem: (1) times da sala (`setTeam`); (2) times do CTF; (3) na Arena offline, o jogador e os aliados dele. **Jogadores
   * contra jogadores (o servidor de hoje, todos contra todos) nunca são do mesmo lado**: dois humanos na mesma partida só são aliados se estiverem no mesmo time.
   */
  sameSide(a: MechBase, b: MechBase): boolean {
    if (a === b) return false;
    const ta = this.teams.get(a);
    const tb = this.teams.get(b);
    if (ta !== undefined && tb !== undefined) return ta === tb;
    if (this.ctf) {
      const ca = this.ctf.teamOf(a);
      return ca !== undefined && ca === this.ctf.teamOf(b);
    }
    const aliado = (m: MechBase): boolean => this.allies?.mechs.includes(m) ?? false;
    if (aliado(a)) return aliado(b) || this.players.includes(b);
    return aliado(b) && this.players.includes(a);
  }

  /** O inimigo caça todo jogador de gente E todo aliado — a lista muda só quando alguém entra/sai (raro; não é por tick). */
  /** O lado do jogador (jogadores + aliados): a mesma lista que os inimigos caçam, sem montar outra. */
  private get friendly(): readonly MechBase[] {
    return this.bots.targets;
  }

  private refreshEnemyTargets(): void {
    this.bots.targets = this.allies ? [...this.players, ...this.allies.mechs] : this.players;
  }

  /**
   * Corte corpo a corpo de um jogador (motosserra do andróide pilotado): pega o inimigo vivo mais perto
   * dentro do alcance da arma. Regra da partida (o controle só pede); sem ninguém perto, nada acontece.
   */
  /**
   * Um pulso do lança-chamas (`Armament` o pede a cada `fireInterval` com o gatilho apertado): dano em **todos** os Mechs vivos dentro do
   * cone (alcance e meio ângulo da arma, com a folga do raio do corpo) e **à vista** (sem parede no meio; outro Mech não tapa a chama).
   * Cada alvo leva o dano da distância dele e as defesas, a parte, o abate e o estado de queimando seguem o caminho do projétil
   * (`combat.onProjectileHit`). O jogador acerta os bots e os outros jogadores, nunca os aliados; o bot acerta os jogadores e os aliados.
   * Regra da partida (G14): o mesmo código no jogo offline e no servidor; sem alocação (G4).
   */
  flameCone(attacker: MechBase, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats): void {
    const f = w.flame;
    if (!f) return;
    if (this.players.includes(attacker)) {
      for (const m of this.bots.mechs) this.flameAt(attacker, origin, dir, w, f, m);
      for (const m of this.players) this.flameAt(attacker, origin, dir, w, f, m);
    } else {
      for (const m of this.players) this.flameAt(attacker, origin, dir, w, f, m);
      if (this.allies) for (const m of this.allies.mechs) this.flameAt(attacker, origin, dir, w, f, m);
    }
  }

  /**
   * Uma onda sônica (`Armament` a pede a cada aperto do botão 2, uma por boca dos ombros): um cone **de uma vez só** (alcance e meio ângulo da arma, com a folga do raio do
   * corpo), à vista, em **todos** os inimigos vivos. Cada alvo leva o dano da distância e as defesas pelo caminho do projétil (`combat.onProjectileHit`, natureza `sonico`) e é
   * **empurrado** para longe da boca (`MechBase.push`), com o empurrão caindo com a distância como o dano. Quem a solta nunca se empurra; aliado nunca é pego. O cliente online (dano
   * desligado) só desenha. Regra da partida (G14): o mesmo código offline e no servidor; sem alocação (G4).
   */
  waveCone(attacker: MechBase, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats): void {
    const wave = w.wave;
    if (!wave) return;
    this.onWave?.(origin, dir, attacker.collider, w);
    this.drawWave(origin, dir, w);
    if (!this.combat.damageEnabled) return;
    for (const group of this.foesOf(attacker)) for (const m of group) this.waveAt(attacker, origin, dir, w, m);
  }

  /** Os grupos de inimigos de quem atira (jogadores, rebeldes ou aliados enxergam lados diferentes). */
  private foesOf(attacker: MechBase): readonly (readonly MechBase[])[] {
    return (this.players.includes(attacker) ? this.ringOfPlayers : this.allies?.mechs.includes(attacker) ? this.ringOfAllies : this.ringOfRebels).foes;
  }

  /**
   * A trava do míssil teleguiado (`RocketSystem.acquire`): o inimigo vivo **mais centrado no cone** da arma (`Guide`: meio ângulo e alcance da trava), à vista, na hora do
   * disparo. Quem atira nunca trava em si nem em aliado. Sem alvo, o míssil voa reto. Mesma conta do cone do lança-chamas e da onda (`coneGap`, que também testa a parede).
   * Deterministico: a ordem das listas decide o empate (o primeiro vence). Roda também no cliente online, só para o desenho.
   */
  private seekTarget(origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats): MechBase | null {
    const g = w.guide;
    const attacker = owner ? this.combat.mechOf(owner) : undefined;
    if (!g || !attacker) return null;
    let best: MechBase | null = null;
    let bestCos = -2;
    for (const group of this.foesOf(attacker)) {
      for (const m of group) {
        if (this.coneGap(attacker, origin, dir, w, g.lockHalfAngle, m, true, g.lockRange) < 0) continue;
        const cos = _flameTo.dot(dir);
        if (cos > bestCos) {
          bestCos = cos;
          best = m;
        }
      }
    }
    return best;
  }

  /** Só o desenho da onda (o outro jogador a vê pelo evento de tiro, sem regra). */
  drawWave(origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats): void {
    drawWave(this.fx, origin, dir, w);
    this.onWaveFx?.(origin, dir, w);
  }

  private waveAt(attacker: MechBase, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats, target: MechBase): void {
    const gap = this.coneGap(attacker, origin, dir, w, w.wave!.halfAngle, target, true);
    if (gap < 0) return;
    this.combat.onProjectileHit(_flameHit, dir, hitDamage(w, gap), attacker.collider, w, gap);
    // O empurrão sai radial da boca (_flameTo, o vetor unitário da boca ao alvo, deixado por `coneGap`), cai com a distância e vai pela resistência do alvo.
    target.push(_flameTo.x, _flameTo.z, w.wave!.shove * rangeFactor(w, gap));
  }

  /**
   * O alvo está dentro do cone de `halfAngle` e à vista de `origin`? Devolve a distância da boca à superfície do alvo (m), ou -1 se não. Deixa o acerto pronto em `_flameHit` e o vetor unitário
   * da boca ao alvo em `_flameTo`. O lança-chamas e a onda sônica usam a mesma conta; `axis` escolhe o ponto do alvo: o **torso** (o lança-chamas) ou o **ponto do eixo
   * vertical do corpo mais perto da altura da boca** (a onda: uma pressão que bate no corpo inteiro; sem isto o torso de um robô alto, como o Colossus, ficava fora do cone vertical).
   */
  private coneGap(attacker: MechBase, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats, halfAngle: number, target: MechBase, axis = false, range = w.maxRange): number {
    if (target === attacker || !target.alive) return -1;
    if (axis) {
      const p = target.simPosition;
      _flameAt.set(p.x, Math.min(p.y + target.stats.height, Math.max(p.y, origin.y)), p.z);
    } else target.partWorldPosition('torso', _flameAt, true);
    _flameTo.subVectors(_flameAt, origin);
    const dist = _flameTo.length();
    const r = target.stats.radius;
    if (dist < 1e-3 || dist > range + r) return -1;
    // O cone com a folga do corpo: um alvo largo e perto entra mesmo com o centro um pouco fora do eixo.
    if (_flameTo.dot(dir) / dist < Math.cos(halfAngle + Math.atan2(r, dist))) return -1;
    _flameTo.multiplyScalar(1 / dist);
    const wall = this.physics.raycast(origin, _flameTo, dist, attacker.collider);
    if (wall && wall.collider !== target.collider && !this.combat.mechOf(wall.collider) && wall.distance < dist - r) return -1;
    _flameHit.point.copy(_flameAt);
    _flameHit.distance = dist;
    _flameHit.collider = target.collider;
    return Math.max(0, dist - r);
  }

  private flameAt(attacker: MechBase, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats, f: Flame, target: MechBase): void {
    const gap = this.coneGap(attacker, origin, dir, w, f.halfAngle, target);
    if (gap < 0) return;
    this.combat.onProjectileHit(_flameHit, dir, hitDamage(w, gap), attacker.collider, w, gap);
  }

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

  /** O anel de fogo de cada Mech que o tem ligado: o passo do Mech (`EnergyShield.step`) já marcou o pulso; aqui ele sai (`combat/FireRing.ts`). */
  private ringTick(): void {
    for (const m of this.players) this.ringOf(m, this.ringOfPlayers);
    for (const m of this.bots.mechs) this.ringOf(m, this.ringOfRebels);
    if (this.allies) for (const m of this.allies.mechs) this.ringOf(m, this.ringOfAllies);
  }

  private ringOf(m: MechBase, sides: RingSides): void {
    if (m.energyShield.kind === 'fire' && m.energyShield.consumePulse()) this.fireRing.pulse(m, sides);
  }

  /**
   * Um tick fixo. Entre rodadas (placar na tela) o mundo fica congelado e só o relógio anda. Devolve
   * true no tick em que uma rodada nova começa.
   */
  step(dt: number): boolean {
    if (this.round.playing) {
      // A missão falha se o jogador cai OU se a estação cai (o núcleo chegou a zero no tick anterior).
      this.waves?.fixedUpdate(dt, this.players.some((player) => player.alive) && !this.nucleo?.caiu);
      if (this.waves?.ended) return false;
      // Fogo, choque e gelo: o tempo corre e o dano por segundo sai ANTES dos pilotos, para a velocidade e as travas do tick já usarem o
      // estado atualizado. Mesma ordem no servidor e no jogo offline (G14).
      for (const m of this.players) this.combat.tickStatus(m, dt);
      for (const m of this.bots.mechs) this.combat.tickStatus(m, dt);
      if (this.allies) for (const m of this.allies.mechs) this.combat.tickStatus(m, dt);
      for (const p of this.pilots) p.fixedUpdate(dt);
      this.bots.fixedUpdate(dt);
      this.allies?.fixedUpdate(dt);
      this.drones?.fixedUpdate(dt);
      this.ringTick();
      // Pisão nos dois sentidos: Mech do jogador em andróide rebelde, e Mech rebelde num jogador pequeno.
      // Aliado conta como o próprio jogador aqui (mesmo lado) — pisa e é pisado só pelo inimigo.
      this.crush.tick(dt);
      this.crush.check(this.players, this.bots.mechs);
      this.crush.check(this.bots.mechs, this.players);
      if (this.allies) {
        this.crush.check(this.allies.mechs, this.bots.mechs);
        this.crush.check(this.bots.mechs, this.allies.mechs);
      }
      this.zones.fixedUpdate(dt, this.players);
      this.zones.fixedUpdate(dt, this.bots.mechs);
      if (this.allies) this.zones.fixedUpdate(dt, this.allies.mechs);
      // A água (P126): o mar da praia freia e afoga quem está com os pés dentro. Nos outros mapas, `agua` é nulo.
      this.aplicarAgua(dt);
      this.respawner.fixedUpdate(dt);
      this.projectiles.fixedUpdate(dt);
      this.rockets.fixedUpdate(dt);
      this.barrage.fixedUpdate(dt);
      this.physics.step();
      this.ctf?.fixedUpdate(dt);
      this.dominio?.fixedUpdate(dt);
      this.dirigirOsBots(dt);
      this.drenarONucleo(dt);
    }
    if (this.round.fixedUpdate(dt) !== 'started') return false;
    this.restart();
    return true;
  }

  /**
   * O núcleo da estação (P127): soma o peso dos rebeldes vivos **dentro dos muros** do complexo (Mech 1, andróide meio, Colossus 4) e o
   * núcleo drena (ou, sem invasor, se recompõe). Sem o núcleo (outros mapas e modos), não roda nada. Custo: um laço sobre os rebeldes
   * (≤ 8), sem alocar.
   */
  private drenarONucleo(dt: number): void {
    const n = this.nucleo;
    if (!n) return;
    let peso = 0;
    for (const m of this.bots.mechs) {
      if (!m.alive) continue;
      const p = m.simPosition;
      if (dentroDoComplexo(p.x, p.z)) peso += pesoDoInvasor(m.stats.name);
    }
    n.fixedUpdate(dt, peso);
  }

  /**
   * A água do mapa (P126): quem está com os pés dentro do mar **freia** (o `MechBase.moveSpeedScale`, que já existia) e,
   * passado o tempo de afogar, **perde vida** no casco. Sem o mapa da praia (`agua` nulo), não roda nada. Custo: ≤ 4
   * contas por Mech por tick, sem alocar (o acumulado vive num `Map` reaproveitado).
   */
  private aplicarAgua(dt: number): void {
    const a = this.agua;
    if (!a) return;
    this.aguaEm(dt, a, this.players);
    this.aguaEm(dt, a, this.bots.mechs);
    if (this.allies) this.aguaEm(dt, a, this.allies.mechs);
  }

  private aguaEm(dt: number, a: Agua, mechs: readonly MechBase[]): void {
    for (const m of mechs) {
      const p = m.simPosition;
      const fundura = m.alive ? funduraEm(a, p.x, p.z, p.y) : 0;
      // Molhado freia; só o fundo (`afogaDesde`) conta tempo de afogamento: o raso é uma via lenta, não uma armadilha.
      const molhado = fundura > FUNDURA_MOLHADA;
      m.moveSpeedScale = molhado ? fatorDeVelocidade(fundura) : 1;
      const fundo = fundoParaAfogar(a, fundura);
      if (!fundo && !this.afogando.has(m)) continue; // seco (ou raso) e sem histórico: nada a fazer (caminho barato)
      const t = passoDoAfogamento(fundo ? this.afogando.get(m) ?? 0 : 0, dt, fundo);
      if (fundo) this.afogando.set(m, t);
      else this.afogando.delete(m);
      const dano = danoDeAfogamento(a, t, dt);
      if (dano > 0) m.damagePart('torso', dano);
    }
  }

  /**
   * Para o HUD da praia: a fundura em que os pés de `mech` estão (0 em terra ou fora do mapa da praia) e quantos segundos ele já passou no
   * fundo (o relógio do afogamento). Barato (uma conta e uma busca no `Map`), chamado a cada quadro: escreve em `fora` (sem alocar, G4).
   */
  estadoDaAgua(mech: MechBase, fora: EstadoDaAgua = { fundura: 0, afogandoS: 0, afogarS: 0, afogaDesde: FUNDURA_MOLHADA }): EstadoDaAgua {
    const a = this.agua;
    if (!a) {
      fora.fundura = 0;
      fora.afogandoS = 0;
      fora.afogarS = 0;
      fora.afogaDesde = FUNDURA_MOLHADA;
      return fora;
    }
    const p = mech.simPosition;
    fora.fundura = mech.alive ? funduraEm(a, p.x, p.z, p.y) : 0;
    fora.afogandoS = this.afogando.get(mech) ?? 0;
    fora.afogarS = a.afogarS;
    fora.afogaDesde = a.afogaDesde ?? FUNDURA_MOLHADA;
    return fora;
  }

  /**
   * `DominioObjetivos.atribuirPontos`) e recebe a ordem de **segurar posto** ali: trocam tiro em volta do posto e não o abandonam
   * perseguindo quem está longe. Só manda ordem a quem mudou de ponto (ou perdeu a ordem). Custo: ≤ 40 bots × 5 pontos a cada 2 s.
   */
  private dirigirOsBots(dt: number): void {
    const d = this.dominio;
    if (!d || d.ended) return;
    this.replanejaEm -= dt;
    if (this.replanejaEm > 0) return;
    this.replanejaEm = DOMINIO_REPLANEJA_S;
    this.dirigirLado(d, 'red', this.bots, this.rumoRed);
    if (this.allies) this.dirigirLado(d, 'blue', this.allies, this.rumoBlue);
  }

  private dirigirLado(d: Dominio, lado: DominioLado, sistema: BotSystem, rumo: number[]): void {
    const mechs = sistema.mechs;
    atribuirPontos(d.pontos, lado, mechs, rumo, this.rumoNovo, this.cargaDosPontos);
    for (let i = 0; i < mechs.length; i++) {
      const novo = this.rumoNovo[i]!;
      const cerebro = sistema.brainOf(mechs[i]!);
      if (!cerebro || novo < 0) {
        rumo[i] = novo;
        continue;
      }
      if (novo !== rumo[i] || cerebro.order !== 'hold') cerebro.receiveOrder('hold', this.pontosV3[novo]!, null);
      rumo[i] = novo;
    }
  }

  /** Recomeça o objetivo usando os mesmos corpos físicos e pools. */
  restartMission(): void {
    if (!this.waves && !this.ctf && !this.dominio) return;
    this.players.forEach((m, i) => {
      const [x, z] = this.ctf
        ? [CTF_BASES.blue.x + CTF_PLAYER_OFFSET_X, CTF_BASES.blue.z]
        : this.dominio
          ? NASCIMENTOS_DO_DOMINIO.blue[0]!
          : this.spawnPoints[i % this.spawnPoints.length]!;
      m.respawn(this._spawn.set(x, 0, z));
    });
    if (this.ctf || this.dominio) this.bots.respawnAll();
    if (this.dominio) {
      this.allies?.respawnAll();
      this.rumoRed.fill(-1);
      this.rumoBlue.fill(-1);
      this.replanejaEm = 0;
    }
    this.projectiles.clear();
    this.rockets.clear();
    this.barrage.clear();
    this.debris.clear();
    this.destructibles.restoreAll();
    this.round.resetScores();
    this.waves?.reset();
    this.nucleo?.reset();
    this.ctf?.reset();
    this.dominio?.reset();
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
      const [x, z] = this.spawnPoints[i % this.spawnPoints.length]!;
      m.respawn(this._spawn.set(x, 0, z));
    });
    this.bots.respawnAll();
    this.allies?.respawnAll();
    this.drones?.resetAll();
    this.projectiles.clear();
    this.rockets.clear();
    this.barrage.clear();
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
