import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { BarrageSystem } from '../combat/BarrageSystem';
import { BotSystem, type BotKit, type BotSystemOptions } from '../combat/BotSystem';
import { BOT_SKILLS } from '../combat/BotController';
import { CombatSystem, type MechHitEvent } from '../combat/CombatSystem';
import { CruiseSystem } from '../combat/CruiseSystem';
import { GrenadeSystem } from '../combat/GrenadeSystem';
import { HookSystem } from '../combat/HookSystem';
import type { MountId } from '../combat/mounts';
import { CrushRule } from '../combat/crush';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { RocketSystem } from '../combat/RocketSystem';
import { Respawner } from '../combat/Respawner';
import { DroneSystem } from '../combat/DroneSystem';
import { FireRing, type RingSides } from '../combat/FireRing';
import { Round } from '../combat/Round';
import { hitDamage, rangeFactor, weapon, type Flame, type WeaponStats } from '../combat/weapons';
import type { TaticaId } from '../combat/taticas';
import type { PhysicsHit } from '../physics/PhysicsWorld';
import { ZoneSystem } from '../combat/Zone';
import { GLOW, PALETTE } from '../core/palette';
import type { GameSettings } from '../core/Settings';
import type { MechBase } from '../entities/MechBase';
import { Arena, SPAWN_POINTS } from '../environment/Arena';
import { BUNKER_SPAWNS, type MapId } from '../environment/Bunker';
import { PRAIA_AGUA, PRAIA_ASSALTO, PRAIA_INIMIGOS, PRAIA_MANIFESTANTES, PRAIA_QUADRO_DE_LUZ, PRAIA_SPAWNS, PRAIA_TITA, PRAIA_ZONES } from '../environment/PraiaLayout';
import { ehManifestante } from '../entities/chassis';
import { caboDoPonto, CABOS, CabosDeDados, CODIGO_DO_ESTADO, ehAndroide, PONTOS_DOS_CABOS } from './CabosDeDados';
import { alvoDoChefe } from './FasesDoChefe';
import { PORTAS, PORTAS_DA_ESTACAO, PortasDaEstacao, pesoNaPorta, portaDoPonto } from './PortasDaEstacao';
import { AMAZONIA_POSTO_AVANCADO, AMAZONIA_RESISTENCIA, AMAZONIA_SPAWNS, rioEmX } from '../environment/AmazoniaLayout';
import { PRACA_SPAWNS } from '../environment/PracaNascimentos';
import { exigirChefe, exigirMapa, exigirMissaoJaneiro, temEscudo, type MissaoJaneiroCarregada } from '../environment/mapasSobDemanda';
import { EscudoDoDraga } from './EscudoDoDraga';
import { escotilhaDoDraga, INVASAO, InvasaoDoDraga } from './InvasaoDoDraga';
import { TorresDeVigia } from './TorresDeVigia';
import { MissaoDoRio } from './MissaoDoRio';
import type { MissaoJaneiro, SituacaoDaPraca } from './MissaoJaneiro';
import type { Multidao } from './Multidao';
import type { ChefesJaneiro } from './ChefesJaneiro';
import { posicaoNaMarcha } from './DragaMarcha';
import { ARENA_QUADRO_DE_LUZ, ARENA_QUADRO_VIDA } from '../environment/ArenaLayout';
import { QUADRO, QuadroDeLuz } from './QuadroDeLuz';
import { dentroDoComplexo, NUCLEO, NucleoDaEstacao, pesoDoInvasor } from './NucleoDaEstacao';
import { danoDeAfogamento, fatorDeVelocidade, FUNDURA_MOLHADA, fundoParaAfogar, funduraEm, passoDoAfogamento, type Agua } from '../combat/Agua';
import { DebrisSystem } from '../environment/DebrisSystem';
import { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { BeamVisuals } from '../fx/BeamVisuals';
import { IMPACT_FX } from '../fx/impactFx';
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
import { RoteiroStepper, type BeatDoRoteiro, type RoteiroSpec } from './Roteiro';
import type { GameMode } from './gameMode';
import { ALLY_COUNT, ANDROID_SPAWNS, BOT_SPAWNS, COLOSSUS_SPAWN } from './nascimentos';
import {
  SURVIVAL_MAX_ANDROIDS,
  SURVIVAL_MAX_MANIFESTANTES,
  SURVIVAL_MAX_MECHS,
  totalDaOnda,
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
/** O alvo de cada vaga do pool de manifestantes (P163): 3 = a porta principal, 4 = a dos fundos, 0 e 2 = os cabos 1 e 3. A vaga 1 e a 3 nascem na rua dos fundos. */
const ALVO_DO_MANIFESTANTE: readonly number[] = [3, 4, 0, 4, 2];
/** O alvo do saboteiro (P164): o quadro de luz da cidade, depois dos três cabos (0 a 2) e das duas portas (3 e 4). */
const ALVO_DO_QUADRO = 5;
/** O alvo do chefe quando os três cabos já caíram (P165): a porta principal do prédio. */
const ALVO_DA_PORTA_PRINCIPAL = 3;
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
  /** Os bots lançam a arma explosiva da mão esquerda (foguetes, granadas…) em salvas (P160 parte 4). Padrão: sim. */
  explosivos?: boolean;
  /** Duração da rodada (s). No cliente do multiplayer, infinita: a rodada é a do servidor. */
  roundS?: number;
  /** Regra da missão. `deathmatch` preserva a arena atual; os objetivos estreiam offline. */
  mode?: GameMode;
  /** Onda em que a missão começa (1 a 6). É o atalho de bancada `?onda=`; fora do intervalo, começa na 1. */
  startWave?: number;
  /** O chefe da missão (o Colossus) veste a máscara (P165)? Padrão sim; `Game` passa o `?mascara=` do link (`0` a tira). */
  bossMask?: boolean;
  /** O desenho do chefe do mapa (o Draga-01 da Amazônia, P180 parte C): o cliente o carrega antes (`mapasSobDemanda`); o servidor e os testes de regra não passam e o corpo nasce só com física e números. */
  visualDoChefe?: object | null;
  /** Quanto da marcha o Draga já andou ao começar (0 a 0,95; `?marcha=` do link): a missão do rio recomeçada no meio, para testar o fim. Padrão 0 (a largada). */
  marcha?: number;
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
  /** O roteiro do WARGAME (P262): dispara ordens de alto nível nos dois esquadrões em ticks marcados. Ausente = o jogo de sempre. */
  roteiro?: RoteiroSpec;
  /**
   * Modo espectador (P262, o WARGAME): os bots dos dois lados nunca miram nos `players` — eles continuam existindo
   * e simulando normalmente (câmera, HUD, input do `Game.ts` não mudam nada), só ficam fora da mira da IA, para o
   * Comandante assistir dois esquadrões brigarem entre si sem o próprio Mech virar alvo nem atrapalhar a cena.
   */
  espectador?: boolean;
}

/**
 * Uma partida inteira sem tela: arena, barricadas, Mechs, bots, tiros, foguetes, dano, renascimento e
 * rodadas, no tick fixo de 60 Hz (G1/G2). É a simulação única do jogo (G14): o cliente a monta e
 * desenha por cima (`core/Game.ts`); o servidor do multiplayer vai rodar esta mesma classe, sem
 * WebGL nem DOM (`MULTIPLAYER.md`, etapa M1). Quem quiser mostrar ou tocar algo ouve os eventos.
 */
const _beamEnd = new THREE.Vector3();
const _hitNormal = new THREE.Vector3();
const _flameAt = new THREE.Vector3();
const _flameTo = new THREE.Vector3();
const _caceteteFrom = new THREE.Vector3();
const _caceteteDir = new THREE.Vector3();
const _caceteteTo = new THREE.Vector3();
/** O "acerto" que o cone entrega ao CombatSystem: um objeto só, reescrito a cada alvo (nada alocado por pulso). */
const _hookEnd = new THREE.Vector3();
/** A metralhadora das torres de vigia da Amazônia (P180, parte D2): a automática de aço, de dano baixo e alcance longo (o fogo de cobertura atravessa o rio). */
/** Os nomes dos três andróides da Resistência (P180, parte E): figuras do folclore amazônico. */
const NOMES_DA_RESISTENCIA = ['CAIPORA', 'IARA', 'CURUPIRA'];
const ARMA_DA_TORRE: WeaponStats = Object.freeze({ ...weapon('autocannon'), name: 'Metralhadora da torre', damage: 8, optimalRange: 110, maxRange: 190, speed: 150 });
const _torreFrom = new THREE.Vector3();
const _torreDir = new THREE.Vector3();
const _hookFrom = new THREE.Vector3();
const _hookTo = new THREE.Vector3();
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
  /** Míssil cruzador (armas com `cruise`): sobe em arco e mergulha no ponto da mira. */
  readonly cruise: CruiseSystem;
  /** Lança-granadas (armas com `lob`, P160): o arco com gravidade que cai no ponto da mira, quica e estoura. */
  readonly grenades: GrenadeSystem;
  /** Os feixes do raio laser (só desenho; a regra do pulso é `beamPulse`). */
  readonly beams: BeamVisuals;
  /** Os cabos do arpão presos agora (`combat/HookSystem.ts`, P77): a partida os avança no tick e o desenho lê daqui. */
  readonly hooks: HookSystem;
  /** Saiu um arpão (o servidor o transforma em evento de tiro para os outros jogadores desenharem). */
  onHook?: (origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;
  /** Só o cliente liga: desenha o raio do arpão, da boca (`from`) até onde ele terminou (`to`). O servidor não desenha nada. */
  onHookFx?: (from: THREE.Vector3, to: THREE.Vector3, w: WeaponStats, hostile: boolean) => void;
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
  /** O WARGAME (P262): `null` fora de um roteiro ativo. */
  private readonly roteiroStepper: RoteiroStepper | null;
  private tickRoteiro = 0;
  /** P262: os bots nunca miram nos `players` quando o roteiro está rodando (ver `MatchOptions.espectador`). */
  private readonly espectador: boolean;
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
  /** A missão do rio (P180, parte C): o Draga-01 marcha rumo à aldeia; só na Amazônia, no modo Sobrevivência. */
  readonly rio: MissaoDoRio | null = null;
  /** A missão do 8 DE JANEIRO (P217, passo 5): a regra de fim (os três prédios, a sujeira, a faxina). Só na Sobrevivência da Praça dos Três Poderes; `null` nos outros mapas e modos. */
  readonly missaoJaneiro: MissaoJaneiro | null = null;
  /** A multidão da missão (`sim/Multidao.ts`): uma linha de dados por figurante, sem corpo na física. O cliente a desenha; o servidor (e o jogo offline) decide a morte e a fuga. */
  readonly multidao: Multidao | null = null;
  /** Trampado e Evil (P250), em sequência. `null` fora da missão offline do 8 DE JANEIRO. */
  readonly chefesJaneiro: ChefesJaneiro | null = null;
  /** O tick da missão do 8 DE JANEIRO (o relógio da multidão: o mesmo no servidor e no cliente, G2). */
  private tickJaneiro = 0;
  /** Rascunhos reaproveitados da missão (G4): a situação da Praça, onde estão os jogadores (para o susto) e quem fugiu por causa do jogador. */
  private readonly situacaoDaPraca: SituacaoDaPraca = { naFachada: [], faltamChegar: 0, presentes: 0, eliminados: 0, rebeldesEliminados: 0 };
  private readonly pontosDoSusto: { x: number; z: number }[] = [];
  private fugaPeloJogador = new Uint8Array(0);
  /** O pedaço sob demanda da missão (a multidão e a regra): as constantes dela vêm daqui. `null` fora da missão. */
  private janeiroPedaco: MissaoJaneiroCarregada | null = null;
  /** Os androides rebeldes agendados pela multidão, em ordem de chegada, e quantos já entraram em campo (G2: o cronograma é o da semente). */
  private rebeldesAgendados: readonly { tick: number; x: number; z: number }[] = [];
  private rebeldesEntraram = 0;
  private rebeldesVivosN = 0;
  /** O escudo do Draga-01 (P180, parte D): três geradores que se quebram a tiro; de pé, o Draga leva 90% menos dano. `null` fora da missão do rio. */
  readonly escudo: EscudoDoDraga | null = null;
  /** As oito torres de vigia armadas da margem (P180, parte D2): atiram atravessando o rio enquanto o gerador da CERCA estiver de pé. `null` fora da missão do rio. */
  readonly torres: TorresDeVigia | null = null;
  /** A invasão do Draga (P180, parte E): com o escudo caído, a escotilha abre e os andróides da Resistência plantam a carga; cheia, o Draga cai por dentro. `null` fora da missão do rio e sem aliados. */
  readonly invasao: InvasaoDoDraga | null = null;
  /** O ponto da escotilha neste tick (só vale com a invasão aberta e o Draga de pé): o desenho e a ordem aos andróides leem daqui. */
  readonly escotilha = { x: 0, z: 0 };
  /** Para onde a última ordem mandou os andróides (reemitida quando a escotilha anda mais de 6 m) e quais já a receberam. */
  private readonly escotilhaOrdenada = { x: Number.NaN, z: Number.NaN };
  private readonly resistenciaOrdenada: boolean[] = [];
  /** Os três cabos de dados da estação (P162, capítulo 1): injeção dos andróides rebeldes, dano e reparo. `null` fora da missão em ondas da praia. */
  readonly cabos: CabosDeDados | null = null;
  /** Rascunhos reaproveitados dos cabos (G4): por cabo, quantos andróides rebeldes ligados, o peso dos depredadores e quantos defensores perto. */
  private readonly cabosLigados = PONTOS_DOS_CABOS.map(() => 0);
  private readonly cabosDepredadores = PONTOS_DOS_CABOS.map(() => 0);
  private readonly cabosDefensores = PONTOS_DOS_CABOS.map(() => 0);
  /** As duas portas do prédio da estação (P163, frente 2): a principal e a dos fundos. `null` fora da missão em ondas da praia. */
  readonly portas: PortasDaEstacao | null = null;
  private readonly portasAtacantes = PORTAS_DA_ESTACAO.map(() => 0);
  private readonly portasDefensores = PORTAS_DA_ESTACAO.map(() => 0);
  /**
   * O quadro de luz da cidade (P164, frente 3): a energia das luzes e das zonas de cura. **Na praia** é o armário do porto; **na Cidade Neon** (parte E) é o transformador do Banco Vorcaris,
   * o mesmo circuito em outro lugar e com mais vida. `null` fora da missão em ondas.
   */
  readonly quadro: QuadroDeLuz | null = null;
  private quadroDefensores = 0;
  /** Para qual alvo cada andróide e cada manifestante foi mandado (0 a 2 = o cabo; 3 e 4 = a porta principal e a dos fundos; 5 = o quadro de luz; -1 nenhum), na ordem de `bots.mechs`. */
  private readonly rumoDosAlvos: number[] = [];
  private readonly pontosDosAlvos = [...PONTOS_DOS_CABOS, ...PORTAS_DA_ESTACAO, PRAIA_QUADRO_DE_LUZ].map((p) => new THREE.Vector3(p.x, 0, p.z));
  private readonly _pontoDoAlvo = new THREE.Vector3();
  private readonly _pontoDoRoteiro = new THREE.Vector3();
  /** Os códigos de estado dos três cabos (0 livre a 3 cortado), refeitos a cada replanejamento: o chefe escolhe o cabo que ainda não caiu. */
  private readonly estadosDosCabosDoChefe = [0, 0, 0];
  private cabosReplanejaEm = 0;
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
  /** Uma batida do roteiro do WARGAME disparou (P262): quem desenha (legenda, corte de câmera) decide o que fazer; a ordem de combate já foi aplicada. */
  onRoteiroEvento?: (beat: BeatDoRoteiro) => void;
  /** Foguete explodiu em `at` (o dano já foi aplicado): fogo, fumaça, tremor, som. `w` é a arma que explodiu (o tamanho do estouro vem do raio dela). */
  onExplosion?: (at: THREE.Vector3, w: WeaponStats) => void;
  /** Saiu um pulso do raio laser (o servidor o transforma em evento de tiro para os outros jogadores desenharem). */
  onBeam?: (origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats) => void;
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
  /**
   * A autoridade (o servidor, e o jogo offline) decidiu: o figurante `i` da multidão do 8 DE JANEIRO morreu, ou fugiu pela mão do jogador (tiro ou susto — a fuga por ter cumprido o tempo
   * na fachada é determinística e não dispara isto). O servidor (`ArenaRoom`) manda o evento (G11: nunca a posição, só o índice); o espelho de cada cliente aplica em `multidao.aplicarMorte`/`aplicarFuga`.
   * Nunca dispara no espelho (`multidao.autoridade === false`), só em quem decide de verdade.
   */
  onFiguranteMorreu?: (i: number) => void;
  onFiguranteFugiu?: (i: number) => void;
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
    this.espectador = o.espectador ?? false;
    this.roteiroStepper = o.roteiro ? new RoteiroStepper(o.roteiro.beats) : null;
    this.round = survival || ctf || dominio ? new Round(Number.POSITIVE_INFINITY) : o.roundS === undefined ? new Round() : new Round(o.roundS);
    this.scene = o.scene;
    this.debris = o.debris === false ? (new NoDebris() as unknown as DebrisSystem) : new DebrisSystem(o.scene, o.physics);
    this.destructibles = new Destructibles(o.scene, o.physics, this.debris, o.particles);
    this.destructibles.onBreak = (id, at) => this.onPropBroken?.(id, at);
    this.destructibles.onAlvoQuebrado = (at, peso) => this.onAlvoQuebrado?.(at, peso);
    const bunker = o.map === 'bunker' && !survival && !ctf && !dominio;
    // A praia abre o Deathmatch e as **ondas** (a defesa da estação, P126): os CTF/Domínio continuam na Arena.
    const praia = o.map === 'praia' && !ctf && !dominio;
    // A Amazônia (P180) abre o Deathmatch e a **missão** (a Sobrevivência: o Draga-01 marcha rumo à aldeia, parte C); o CTF e o Domínio ficam na Arena.
    const amazonia = o.map === 'amazonia' && !ctf && !dominio;
    // A Praça dos Três Poderes (o 8 DE JANEIRO, P217) abre o Deathmatch e a **missão** (a Sobrevivência: a multidão contra os três prédios, passo 5 da ficha); o CTF e o Domínio ficam na Arena.
    const janeiro = o.map === 'janeiro' && !ctf && !dominio;
    // Na missão da Amazônia (TERRAS RARAS) o jogador nasce e renasce no posto avançado (um ponto só); o Deathmatch usa os pontos ao longo da margem.
    this.spawnPoints = bunker ? BUNKER_SPAWNS : praia ? PRAIA_SPAWNS : amazonia ? (survival ? [[AMAZONIA_POSTO_AVANCADO.x, AMAZONIA_POSTO_AVANCADO.z]] : AMAZONIA_SPAWNS) : janeiro ? PRACA_SPAWNS : SPAWN_POINTS;
    this.zones = bunker || amazonia || janeiro ? new ZoneSystem([]) : praia ? new ZoneSystem(PRAIA_ZONES) : new ZoneSystem();
    this.arena = new Arena(o.scene, o.physics, this.destructibles, bunker ? 'bunker' : praia ? 'praia' : amazonia ? 'amazonia' : janeiro ? 'janeiro' : 'arena', { transformador: survival && !praia && !janeiro });
    // A água da praia (P126): o mar freia e afoga quem entra nele. Nos outros mapas não há água.
    this.agua = praia ? PRAIA_AGUA : null;
    // A missão em ondas da praia defende a estação: os rebeldes que entram nos muros drenam o núcleo; a estação cair é perder a missão.
    this.nucleo = praia && survival ? new NucleoDaEstacao() : null;
    this.cabos = praia && survival ? new CabosDeDados() : null;
    this.portas = praia && survival ? new PortasDaEstacao() : null;
    this.quadro = survival && !amazonia && !janeiro ? (praia ? new QuadroDeLuz() : new QuadroDeLuz(ARENA_QUADRO_DE_LUZ, ARENA_QUADRO_VIDA)) : null;
    // A missão do rio: o fim é o do Draga (cai: vitória; chega à aldeia: derrota), e sai pelo mesmo aviso de fim de missão das ondas.
    this.rio = amazonia && survival
      ? new MissaoDoRio((sobreviveu, r) => this.onMissionEnd?.(sobreviveu, 1, { wavesCleared: sobreviveu ? 1 : 0, kills: r.abates, damageDealt: r.danoCausado, survivalSeconds: r.segundos }))
      : null;
    // A missão do 8 DE JANEIRO: a multidão chega pelas fontes do mapa e os prédios apanham; o fim sai pelo mesmo aviso de fim de missão das ondas (a tela lê o resultado inteiro em `missaoJaneiro`).
    if (janeiro && survival) {
      const J = exigirMissaoJaneiro();
      this.janeiroPedaco = J;
      // A autoridade (o servidor e o jogo offline) decide morte e fuga; o cliente online é o espelho (P243, mesma regra do `damage` — quem tira vida é o servidor).
      const multidao = new J.Multidao({ ...J.configDaMissaoJaneiro(), autoridade: o.damage !== false });
      this.multidao = multidao;
      this.rebeldesAgendados = [...multidao.androides].sort((a, b) => a.tick - b.tick);
      this.fugaPeloJogador = new Uint8Array(multidao.total);
      this.missaoJaneiro = new J.MissaoJaneiro(J.MESAS_POR_PREDIO, (sobreviveu, r) =>
        this.onMissionEnd?.(sobreviveu, 1, { wavesCleared: sobreviveu ? 1 : 0, kills: r.eliminados, damageDealt: 0, survivalSeconds: r.segundos }),
      );
      multidao.aoChegar = (_i, predio) => {
        this.missaoJaneiro?.aoChegar(_i, predio);
      };
      multidao.aoMorrer = (i) => this.onFiguranteMorreu?.(i);
      // Expulso é quem sai do mapa fugindo do jogador (tiro ou susto); quem foi embora por conta própria depois de cumprir o tempo na fachada não conta nem vira evento de rede (determinístico, o espelho já chega lá sozinho).
      multidao.aoFugir = (i, causa) => {
        if (causa === 'tiro' || causa === 'susto') {
          this.fugaPeloJogador[i] = 1;
          this.onFiguranteFugiu?.(i);
        }
      };
      multidao.aoSair = (i) => {
        if (this.fugaPeloJogador[i] === 1) this.missaoJaneiro?.registrarExpulso();
      };
      // P250: dois chefes em sequência; a vitória também exige vencê-los.
      this.chefesJaneiro = new J.ChefesJaneiro();
      this.chefesJaneiro.aoAcertar = (i, dano, x, z) => {
        const p = this.players[i];
        if (!p?.alive) return;
        p.partWorldPosition('torso', _flameHit.point, true);
        _caceteteFrom.set(x, 3, z);
        _caceteteTo.subVectors(_flameHit.point, _caceteteFrom);
        const distancia = _caceteteTo.length();
        _caceteteTo.normalize();
        const parede = this.physics.raycast(_caceteteFrom, _caceteteTo, distancia);
        if (parede && parede.collider !== p.collider && !this.combat.mechOf(parede.collider) && parede.distance < distancia - p.stats.radius) return;
        _flameHit.collider = p.collider; _flameHit.distance = distancia;
        this.combat.onProjectileHit(_flameHit, _caceteteTo, dano, undefined, weapon('sonic'), distancia);
      };
      const figuranteVisivel = (x: number, z: number): boolean => {
        _caceteteTo.set(x - _caceteteFrom.x, 1 - _caceteteFrom.y, z - _caceteteFrom.z);
        const distancia = _caceteteTo.length();
        if (distancia > J.CACETETE.alcance) return false;
        _caceteteTo.normalize();
        const parede = this.physics.raycast(_caceteteFrom, _caceteteTo, distancia, this.players[0]?.collider);
        return !parede || !!this.combat.mechOf(parede.collider) || parede.distance >= distancia - 0.3;
      };
      this.chefesJaneiro.aoGolpear = (x, y, z, yaw) => {
        const jogador = this.players[0];
        if (!jogador?.alive || !this.combat.damageEnabled) return;
        _caceteteFrom.set(x, y + jogador.stats.height * 0.5, z);
        _caceteteDir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        multidao.assustarEmCone(x, z, _caceteteDir.x, _caceteteDir.z, Math.PI * 0.45, J.CACETETE.alcance, this.tickJaneiro, figuranteVisivel, true);
        const chefe = this.chefesJaneiro?.ativo;
        if (chefe) {
          _caceteteTo.set(chefe.x - x, Math.min(chefe.config.escala * 2.3, Math.max(0, _caceteteFrom.y)) - _caceteteFrom.y, chefe.z - z);
          const distancia = _caceteteTo.length();
          if (distancia > 0.01 && distancia <= J.CACETETE.alcance && _caceteteTo.dot(_caceteteDir) / distancia >= Math.cos(Math.PI * 0.45)) {
            _caceteteTo.normalize();
            const parede = this.physics.raycast(_caceteteFrom, _caceteteTo, distancia, jogador.collider);
            if (!parede || !!this.combat.mechOf(parede.collider) || parede.distance >= distancia - 1)
              this.chefesJaneiro!.atirar(x, _caceteteFrom.y, z, _caceteteTo.x, _caceteteTo.y, _caceteteTo.z, J.CACETETE.alcance, J.CACETETE.dano);
          }
        }
        const w = weapon('sonic');
        for (const bot of this.bots.mechs) {
          if (!this.bots.brainOf(bot)) continue;
          const gap = this.coneGap(jogador, _caceteteFrom, _caceteteDir, w, Math.PI * 0.45, bot, true, J.CACETETE.alcance);
          if (gap < 0) continue;
          this.combat.onProjectileHit(_flameHit, _caceteteDir, J.CACETETE.dano, jogador.collider, w, gap);
          bot.push(_caceteteDir.x, _caceteteDir.z, 8);
        }
      };
    }
    // O escudo do Draga (parte D): os geradores nascem na cena como alvos destrutíveis (o mesmo registro dos coqueiros); o último a cair derruba o escudo. A defesa vem do chefe do mapa (sob demanda).
    const defesa = amazonia && survival ? exigirChefe('amazonia').defesa : undefined;
    this.escudo = defesa ? new EscudoDoDraga(defesa.geradores) : null;
    this.torres = defesa ? new TorresDeVigia(defesa.torres, 17) : null;
    if (defesa && this.escudo) {
      const escudo = this.escudo;
      defesa.criarGeradores({ scene: o.scene, destructibles: this.destructibles, aoQuebrar: (i) => escudo.quebrar(i), aoVoltar: () => escudo.reiniciar() });
    }
    this.fx = o.particles;
    // O esquadrão (P91): quem nasce na Arena e no Bunker, um por um. Sem um pedido, o das configurações. Aliados (30/09, "sozinho tá
    // muito intenso"): só na Arena normal; o esquadrão das configurações dá a eles as vagas do pool de Mechs inimigos para não
    // estourar o teto de 8 personagens da sala (G11). Sobrevivência e CTF não usam esquadrão (pool e times próprios).
    const arenaMode = !survival && !ctf;
    const mapa: MapId = bunker ? 'bunker' : praia ? 'praia' : amazonia ? 'amazonia' : janeiro ? 'janeiro' : 'arena';
    const semAliados = o.allies === false;
    const pedido = o.squad ?? esquadraoDeFoes(o.foes, semAliados ? 0 : ALLY_COUNT);
    const plano = arenaMode ? planejarEsquadrao(sanearEsquadrao(semAliados ? { ...pedido, aliados: [] } : pedido, mapa), mapa, o.foes.names) : null;
    if (dominio && plano) levarParaAsBases(plano);
    // O pool de tiros cresce com os Mechs que atiram (cada um solta uma rajada por vez): sem isso, num esquadrão grande o tiro some (G5).
    const atiradores = plano ? plano.inimigos.mechs.length + plano.aliados.mechs.length : 0;
    this.projectiles = new ProjectileSystem(o.scene, o.physics, o.particles, PROJETEIS_BASE + PROJETEIS_POR_MECH * Math.max(0, atiradores - MECHS_DO_JOGO_BASE));
    this.rockets = new RocketSystem(o.scene, o.physics, o.particles);
    this.barrage = new BarrageSystem(o.scene, o.physics);
    this.cruise = new CruiseSystem(o.scene, o.physics, o.particles);
    this.grenades = new GrenadeSystem(o.scene, o.physics);
    this.beams = new BeamVisuals(o.scene);
    // Os cabos do arpão: quem puxa de verdade é quem tem o dano ligado (o servidor e o jogo offline); o cliente online só os desenha. A parede no meio solta o cabo.
    this.hooks = new HookSystem((owner, target) => this.hookSight(owner, target), () => this.combat.damageEnabled);
    this.combat = new CombatSystem(this.destructibles, this.debris, o.particles);
    this.combat.damageEnabled = o.damage !== false;
    this.combat.sameSide = (a, b) => this.sameSide(a, b);
    this.respawner = new Respawner(this.spawnPoints); // na missão do rio o ponto é um só (o posto avançado): jogador e Resistência renascem juntos
    this.crush = new CrushRule(this.combat);
    const kitDe = (s: SlotDoPlano): BotKit => ({ chassi: s.chassi, arma: s.arma, secundaria: s.secundaria, dificuldade: s.dificuldade });
    const pontos = (l: readonly SlotDoPlano[]) => l.map((s) => s.ponto);
    const nomes = (l: readonly SlotDoPlano[]) => l.map((s) => s.nome);
    const rebeldes = plano?.inimigos;
    // Os bots lançam a arma explosiva da mão esquerda em salvas (P160 parte 4), pelos mesmos lançadores do jogador; `explosivos: false` desliga.
    const lancadores = o.explosivos === false ? null : { rockets: this.rockets, grenades: this.grenades, cruise: this.cruise, barrage: this.barrage };
    this.bots = new BotSystem({
      rigDoChassi: o.rigDoChassi,
      scene: o.scene,
      physics: o.physics,
      combat: this.combat,
      projectiles: this.projectiles,
      particles: o.particles,
      ...(lancadores ? { launchers: lancadores } : {}),
      pulso: (m, origin, dir, w) => this.beamPulse(m, origin, dir, w),
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
            // Na Amazônia (P180, parte C) o Draga-01 é o único inimigo da missão: a defesa dele (Mechs, androides, torres) vem na parte D.
            spawns: amazonia ? defesa?.guarda.mechs ?? [] : janeiro ? [] : ctf ? CTF_DEFENDER_SPAWNS : praia ? PRAIA_INIMIGOS.slice(0, SURVIVAL_MAX_MECHS) : BOT_SPAWNS.slice(0, SURVIVAL_MAX_MECHS),
            androidSpawns: amazonia ? defesa?.guarda.androids ?? [] : janeiro ? this.janeiroPedaco!.PONTOS_DOS_REBELDES : ctf ? [] : praia ? PRAIA_INIMIGOS.slice(SURVIVAL_MAX_MECHS, SURVIVAL_MAX_MECHS + SURVIVAL_MAX_ANDROIDS) : ANDROID_SPAWNS.slice(0, SURVIVAL_MAX_ANDROIDS),
            manifestanteSpawns: praia && !ctf ? PRAIA_MANIFESTANTES.slice(0, SURVIVAL_MAX_MANIFESTANTES) : [],
            technicianSpawns: [],
            faxineiroSpawns: janeiro ? this.janeiroPedaco!.PONTOS_DOS_FAXINEIROS : [],
            mesasDosPredios: janeiro ? this.janeiroPedaco!.MESAS_DOS_PREDIOS : undefined,
            missaoJaneiro: janeiro ? this.missaoJaneiro ?? undefined : undefined,
            personas: o.foes.enemyPersonas,
            names: { mechs: o.foes.names.mechs, androids: janeiro ? this.janeiroPedaco!.NOMES_DOS_REBELDES : o.foes.names.androids, technicians: o.foes.names.technicians },
          }),
      // A força de defesa da Amazônia (parte D2) segura o posto em volta dos geradores: não corre atrás do jogador e não renasce.
      ...(defesa ? { defensores: true, alturaDoChao: (x: number, z: number) => exigirMapa('amazonia').alturaDoTerreno?.(x, z) ?? 0 } : {}),
      bossSpawn: survival && !amazonia && !janeiro ? (praia ? PRAIA_TITA : COLOSSUS_SPAWN[0]) : undefined,
      ...(amazonia && survival
        ? { chefeDoMapa: 'amazonia' as const, visualDoChefe: o.visualDoChefe ?? null, ...(o.marcha ? { chefeNascimento: { x: posicaoNaMarcha(o.marcha), z: rioEmX(posicaoNaMarcha(o.marcha)) } } : {}) }
        : {}),
      ...(janeiro ? { androidPaint: 0x15171a } : {}), // os androides rebeldes da Praça de preto, no meio do verde e amarelo
      // O 8 de Janeiro é para o jogador sozinho: reação, mira e giro mais lentos (achado 24/10: "muito agressivos e rapidos pra eu combater sozinho").
      ...(janeiro ? { skill: BOT_SKILLS.facil } : {}),
      ...(o.bossMask === undefined ? {} : { mascaraDoChefe: o.bossMask }),
      respawn: !survival,
      respawnAtHome: ctf,
      // Na praia de 640 m as ondas marcham para os portões da estação (patrulham a rota de assalto): sem isso vagariam por pontos espalhados.
      waypoints: survival && praia ? PRAIA_ASSALTO : this.spawnPoints,
      power: o.power,
    });
    // Mesma régua da onda 1 do Survival (só androides, também solo-friendly): no máx. 2 atacam por vez, o resto cerca e espera a vez.
    if (janeiro) this.bots.maxAttackers = 1;
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
            ...(lancadores ? { launchers: lancadores } : {}),
            pulso: (m, origin, dir, w) => this.beamPulse(m, origin, dir, w),
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
        : defesa && !semAliados
          ? new BotSystem({
              // A Resistência (parte E): três andróides aliados na aldeia. Acompanham o jogador até a escotilha do Draga abrir; aí vão plantar a carga.
              rigDoChassi: o.rigDoChassi,
              scene: o.scene,
              physics: o.physics,
              combat: this.combat,
              projectiles: this.projectiles,
              particles: o.particles,
              ...(lancadores ? { launchers: lancadores } : {}),
              pulso: (m, origin, dir, w) => this.beamPulse(m, origin, dir, w),
              respawner: this.respawner,
              escort: this.players,
              tatica: o.tatica,
              paint: PALETTE.playerPaint,
              visor: PALETTE.green,
              spawns: [],
              androidSpawns: AMAZONIA_RESISTENCIA,
              plantadores: true,
              names: { mechs: [], androids: NOMES_DA_RESISTENCIA },
              alturaDoChao: (x: number, z: number) => exigirMapa('amazonia').alturaDoTerreno?.(x, z) ?? 0,
              waypoints: this.spawnPoints,
              power: o.power,
            })
          : null;
    if (this.allies && defesa) this.invasao = new InvasaoDoDraga();
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
    this.waves = survival && !amazonia && !janeiro
      ? new SurvivalWaves({
          onRoster: (plan) => this.applyWaveRoster(plan),
          onWaveStart: (plan) => this.onWaveStart?.(plan.wave, totalDaOnda(plan, praia), plan.mechs, plan.androids, plan.title, SURVIVAL_WAVE_PLANS.length),
          onWaveProgress: (wave, killed, total, elapsedS) => this.onWaveProgress?.(wave, killed, total, elapsedS),
          onWaveClear: (wave, elapsedS) => {
            this.nucleo?.curar(NUCLEO.curaPorOnda); // a onda eliminada devolve um pouco da rede
            this.onWaveClear?.(wave, elapsedS);
          },
          onMissionEnd: (survived, stats) => this.onMissionEnd?.(survived, this.waves?.wave ?? 1, stats),
        }, o.startWave, praia)
      : null;
    if (this.waves || this.missaoJaneiro) this.bots.setRoster(0, 0);
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
    // O tiro do jogador também acerta a multidão da missão do 8 DE JANEIRO (ela não tem corpo na física): a linha deste passo do projétil, até onde a parede ou o chão a deixa ir.
    const multidao = this.multidao;
    const chefesJaneiro = this.chefesJaneiro;
    if (multidao || chefesJaneiro) {
      this.projectiles.contraMassa = (ox, oy, oz, dx, dy, dz, alcance, dano) => {
        if (multidao && multidao.presentes > 0) {
          // O espelho (online, não autoridade) não decide quem morre, mas precisa do mesmo tiro parando na hora certa (achado 26/10: sem isto, o tiro atravessava a multidão sem nenhum efeito).
          const acertou = multidao.autoridade
            ? multidao.atirar(ox, oy, oz, dx, dy, dz, alcance, dano, this.tickJaneiro) >= 0
            : multidao.naMira(ox, oy, oz, dx, dy, dz, alcance, this.tickJaneiro) >= 0;
          if (acertou) return true;
        }
        return !!chefesJaneiro && chefesJaneiro.atirar(ox, oy, oz, dx, dy, dz, alcance, dano);
      };
    }
    const explode = (at: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats): void => {
      this.combat.explode(at, dir, owner, w);
      if (multidao && w.blastRadius > 0) multidao.explodir(at.x, at.y, at.z, w.blastRadius, w.damage, this.tickJaneiro);
      if (chefesJaneiro && w.blastRadius > 0) chefesJaneiro.explodir(at.x, at.y, at.z, w.blastRadius, w.damage);
      this.drones?.explosion(at, w);
      this.onExplosion?.(at, w);
    };
    // Drones (06/10): só onde os aliados existem; o kamikaze explode pela mesma regra dos foguetes.
    this.drones =
      this.allies !== null && o.drones !== false && !bunker && !this.rio // a Resistência da missão do rio não leva drones
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
    this.cruise.onExplode = explode;
    this.grenades.onExplode = explode;
    this.combat.onMechHit = (e) => {
      if (this.players.includes(e.mech)) this.allies?.defend(e.mech, e.shooter);
      if (this.allies?.mechs.includes(e.mech)) this.allies.onDamaged(e.mech, e.shooter);
      else if (!this.players.includes(e.mech)) this.bots.onDamaged(e.mech, e.shooter);
      if (this.waves && e.shooter && this.players.includes(e.shooter) && this.bots.mechs.includes(e.mech)) {
        this.waves.recordDamage(e.result.applied);
      }
      if (this.rio && e.shooter && this.players.includes(e.shooter) && this.bots.mechs.includes(e.mech)) this.rio.registrarDano(e.result.applied);
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
        this.cruise.clear();
        this.grenades.clear();
        this.hooks.clear();
        this.beams.clear();
      }
      if (this.waves && this.players.includes(dead) && this.players.every((player) => !player.alive)) this.waves.fail();
      if (this.rio && this.bots.mechs.includes(dead)) this.rio.registrarAbate();
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
    const players = this.espectador ? [] : this.players;
    this.bots.targets = this.allies ? [...players, ...this.allies.mechs] : players;
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
   * desligado) só desenha. **A multidão do 8 DE JANEIRO (P242) também está no cone**: foge, sem perder vida — a arma de dispersão não letal da missão (ao contrário do tiro e da
   * explosão, que ferem). Fora do `damageEnabled` por ser o mesmo tratamento do `explode()` (a multidão não é "dano" no sentido do Mech online). Regra da partida (G14): o mesmo
   * código offline e no servidor; sem alocação (G4).
   */
  waveCone(attacker: MechBase, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats): void {
    const wave = w.wave;
    if (!wave) return;
    this.onWave?.(origin, dir, attacker.collider, w);
    this.drawWave(origin, dir, w);
    if (this.multidao && this.multidao.presentes > 0) this.multidao.assustarEmCone(origin.x, origin.z, dir.x, dir.z, wave.halfAngle, w.maxRange, this.tickJaneiro);
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

  /**
   * Um pulso do raio laser (`Armament` o pede a cada `fireInterval` com o gatilho apertado): **acerta na hora o primeiro que o feixe encontra** (parede, caixa-alvo, drone ou Mech,
   * menos quem atirou) até o alcance da arma, com o dano da distância e as defesas pelo caminho do projétil (`projectiles.onHit`: parte, abate, escudo, calor, tudo igual a um tiro).
   * O desenho (`BeamVisuals`) acende a linha do cano até onde bateu e solta as fagulhas do impacto. O cliente online (dano desligado) só desenha. Regra da partida (G14): o mesmo
   * código offline e no servidor; um raio por pulso e nada alocado (G4).
   */
  beamPulse(attacker: MechBase, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats): void {
    const b = w.beam;
    if (!b) return;
    this.onBeam?.(origin, dir, attacker.collider, w);
    const hit = this.physics.raycast(origin, dir, w.maxRange, attacker.collider, true);
    const dist = hit ? hit.distance : w.maxRange;
    _beamEnd.copy(origin).addScaledVector(dir, dist);
    this.beams.spawn(origin, _beamEnd, !this.players.includes(attacker), b.glow);
    this.muzzleSpark(origin, dir, w, !this.players.includes(attacker));
    if (!hit) return;
    // O resultado do raycast é reaproveitado: copia o ponto e a normal antes de o acerto disparar outro raio.
    _hitNormal.copy(hit.normal);
    _beamEnd.copy(hit.point).addScaledVector(_hitNormal, 0.05);
    for (const o of IMPACT_FX[w.id]) this.fx.burst(_beamEnd, _hitNormal, o);
    if (!this.combat.damageEnabled) return;
    this.projectiles.onHit?.(hit, dir, hitDamage(w, dist), attacker.collider, w, dist);
  }

  /**
   * Só o desenho de um pulso de laser de outro jogador (o evento de tiro traz a direção, não onde bateu): acha onde o feixe acaba, como o servidor fez, e o acende. Sem regra
   * nem dano (são do servidor).
   */
  drawBeam(origin: THREE.Vector3, dir: THREE.Vector3, owner: RAPIER.Collider | undefined, w: WeaponStats, hostile: boolean): void {
    const b = w.beam;
    if (!b) return;
    const hit = this.physics.raycast(origin, dir, w.maxRange, owner, true);
    const dist = hit ? hit.distance : w.maxRange;
    _beamEnd.copy(origin).addScaledVector(dir, dist);
    this.beams.spawn(origin, _beamEnd, hostile, b.glow);
    this.muzzleSpark(origin, dir, w, hostile);
    if (!hit) return;
    _hitNormal.copy(hit.normal);
    _beamEnd.copy(hit.point).addScaledVector(_hitNormal, 0.05);
    for (const o of IMPACT_FX[w.id]) this.fx.burst(_beamEnd, _hitNormal, o);
  }

  /**
   * Um arpão (`Armament` o pede a cada aperto do Ataque 2, um por boca de ombro): um **raio** de `maxRange` da boca; o primeiro robô à vista, **se for inimigo**, leva a mordida (o dano da arma, pelas defesas do
   * caminho do projétil) e fica **preso** (`HookSystem`: puxado até chegar, soltar ou o dash cortar o cabo). Parede, chão, aliado e o próprio dono não prendem nada. O cliente online (dano desligado)
   * só desenha o raio. Regra da partida (G14): a mesma offline e no servidor; um raycast por aperto, sem alocação (G4).
   */
  hookShot(attacker: MechBase, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats, mount: MountId): void {
    if (!w.hook) return;
    this.onHook?.(origin, dir, attacker.collider, w);
    const hit = this.hookRay(origin, dir, w, attacker.collider);
    this.onHookFx?.(origin, _hookEnd, w, !this.players.includes(attacker));
    if (!hit || !this.combat.damageEnabled) return;
    const target = this.combat.mechOf(hit.collider);
    if (!target || !target.alive || !this.foesOf(attacker).some((group) => group.includes(target))) return;
    this.projectiles.onHit?.(hit, dir, hitDamage(w, hit.distance), attacker.collider, w, hit.distance);
    this.hooks.attach(attacker, target, w, mount);
  }

  /** O raio do arpão de `origin` na direção `dir`: o primeiro acerto (ou nada), com o ponto onde ele terminou em `_hookEnd` (o acerto, ou o alcance). */
  private hookRay(origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats, ignore: RAPIER.Collider | undefined): PhysicsHit | null {
    const hit = this.physics.raycast(origin, dir, w.maxRange, ignore);
    _hookEnd.copy(origin).addScaledVector(dir, hit ? hit.distance : w.maxRange);
    return hit;
  }

  /** O alvo está à vista do dono (sem parede no meio)? Confere o cabo do arpão a cada poucos ticks. */
  private hookSight(owner: MechBase, target: MechBase): boolean {
    const a = owner.simPosition;
    const b = target.simPosition;
    _hookFrom.set(a.x, a.y + owner.stats.height * 0.6, a.z);
    _hookTo.set(b.x - _hookFrom.x, b.y + target.stats.height * 0.5 - _hookFrom.y, b.z - _hookFrom.z);
    const dist = _hookTo.length();
    if (dist < 1e-3) return true;
    _hookTo.multiplyScalar(1 / dist);
    const wall = this.physics.raycast(_hookFrom, _hookTo, dist, owner.collider);
    return !wall || wall.collider === target.collider || !!this.combat.mechOf(wall.collider) || wall.distance >= dist - target.stats.radius;
  }

  /** A torre `torre` enxerga o jogador `alvo`? Um raio da boca ao peito dele: o barranco do rio e as estruturas escondem quem anda no leito (é a cobertura natural). */
  private torreVe(torre: number, alvo: number): boolean {
    const p = this.torres!.pontos[torre]!;
    const a = this.players[alvo]!;
    const b = a.simPosition;
    _torreFrom.set(p.x, p.y, p.z);
    _torreDir.set(b.x - p.x, b.y + a.stats.height * 0.5 - p.y, b.z - p.z);
    const dist = _torreDir.length();
    if (dist < 1e-3) return true;
    _torreDir.multiplyScalar(1 / dist);
    const parede = this.physics.raycast(_torreFrom, _torreDir, dist);
    return !parede || parede.collider === a.collider || !!this.combat.mechOf(parede.collider) || parede.distance >= dist - a.stats.radius;
  }

  /** A torre `torre` solta um tiro hostil no jogador `alvo`, com o desvio de mira (`ex` em torno do eixo vertical, `ey` na altura; rad) que a regra sorteou. */
  private torreAtira(torre: number, alvo: number, ex: number, ey: number): void {
    const p = this.torres!.pontos[torre]!;
    const a = this.players[alvo]!;
    const b = a.simPosition;
    _torreFrom.set(p.x, p.y, p.z);
    _torreDir.set(b.x - p.x, b.y + a.stats.height * 0.5 - p.y, b.z - p.z).normalize();
    const c = Math.cos(ex);
    const s = Math.sin(ex);
    const dx = _torreDir.x * c - _torreDir.z * s;
    const dz = _torreDir.x * s + _torreDir.z * c;
    _torreDir.set(dx, _torreDir.y + ey, dz).normalize();
    this.projectiles.fire(_torreFrom, _torreDir, undefined, true, ARMA_DA_TORRE);
  }

  /**
   * A invasão do Draga (parte E): acha a escotilha no flanco do casco, conta os andróides da Resistência junto dela e roda a regra (`InvasaoDoDraga`). Com a escotilha aberta, manda os
   * andróides até lá (a ordem `hold`, reemitida quando o Draga anda mais de 6 m: reemitir a cada tick zeraria a memória de obstáculos deles). A carga cheia derruba o Draga por dentro.
   */
  private fixedUpdateInvasao(dt: number, chefe: MechBase | null): void {
    const inv = this.invasao!;
    const aliados = this.allies!;
    const vivo = chefe !== null;
    if (chefe) escotilhaDoDraga(chefe.simPosition.x, chefe.simPosition.z, chefe.yaw, this.escotilha);
    let juntos = 0;
    if (chefe && inv.aberta) {
      const r2 = INVASAO.raioDaEscotilhaM * INVASAO.raioDaEscotilhaM;
      for (const m of aliados.mechs) {
        if (!m.alive || !ehAndroide(m.stats.name)) continue;
        const dx = m.simPosition.x - this.escotilha.x;
        const dz = m.simPosition.z - this.escotilha.z;
        if (dx * dx + dz * dz < r2) juntos++;
      }
    }
    inv.fixedUpdate(dt, this.escudo ? !this.escudo.ativo : false, vivo, juntos);
    if (chefe && inv.aberta && !inv.detonou) {
      const o = this.escotilhaOrdenada;
      const longe = !(Math.abs(this.escotilha.x - o.x) < 6 && Math.abs(this.escotilha.z - o.z) < 6);
      for (let i = 0; i < aliados.mechs.length; i++) {
        const m = aliados.mechs[i]!;
        if (!m.alive || !ehAndroide(m.stats.name)) {
          this.resistenciaOrdenada[i] = false; // morreu (renasce na aldeia com a cabeça limpa): precisa da ordem de novo
          continue;
        }
        if (this.resistenciaOrdenada[i] && !longe) continue;
        const cerebro = aliados.brainOf(m);
        if (!cerebro) continue;
        cerebro.receiveOrder('hold', this._pontoDoAlvo.set(this.escotilha.x - cerebro.escortSide * 6, 0, this.escotilha.z), null);
        this.resistenciaOrdenada[i] = true;
      }
      if (longe) {
        o.x = this.escotilha.x;
        o.z = this.escotilha.z;
      }
    }
    if (inv.consumirDetonacao() && chefe) {
      const autor = aliados.mechs.find((m) => m.alive && ehAndroide(m.stats.name));
      this.combat.detonar(chefe, autor);
    }
  }

  /** Só o desenho do raio do arpão de outro jogador (ele o vê pelo evento de tiro, sem regra): da boca até o primeiro acerto ou o alcance. */
  drawHook(origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats, ignore: RAPIER.Collider | undefined, hostile: boolean): void {
    if (!w.hook) return;
    this.hookRay(origin, dir, w, ignore);
    this.onHookFx?.(origin, _hookEnd, w, hostile);
  }

  /** O clarão pequeno na boca do laser: duas fagulhas na cor do feixe (oito pulsos por segundo: poucas partículas por pulso). */
  private muzzleSpark(origin: THREE.Vector3, dir: THREE.Vector3, _w: WeaponStats, hostile: boolean): void {
    this.fx.burst(origin, dir, { count: 2, color: hostile ? GLOW.hostileLaser : GLOW.friendlyLaser, speed: 6, life: 0.1, size: 1.8, spread: 0.3, gravity: 0 });
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
      // A missão do rio (P180, parte C): o Draga caiu (vitória) ou chegou à aldeia (derrota); acabou, o mundo congela como nas ondas.
      if (this.rio) {
        const chefe = this.bots.chefe;
        // O escudo: o corpo do Draga recebe 10% do dano enquanto houver gerador de pé (um número por tick).
        if (this.escudo && chefe && temEscudo(chefe)) chefe.escudo = this.escudo.fator;
        // As torres da margem: o gerador da CERCA (o primeiro) as alimenta; derrubado, elas calam. A visão é um raio na física e só roda quando uma torre está pronta para atirar.
        if (this.torres) {
          this.torres.ativa = this.escudo ? this.escudo.vivo(0) : false;
          this.torres.fixedUpdate(dt, this.players, (torre, alvo) => this.torreVe(torre, alvo), (torre, alvo, ex, ey) => this.torreAtira(torre, alvo, ex, ey));
        }
        if (this.invasao && this.allies) this.fixedUpdateInvasao(dt, chefe);
        this.rio.fixedUpdate(dt, chefe ? chefe.simPosition.x : null);
        if (this.rio.terminou) return false;
      }
      // A missão do 8 DE JANEIRO: a multidão avança, o jogador assusta e investe, e os prédios apanham; acabou, o mundo congela como nas ondas.
      if (this.missaoJaneiro && this.multidao) {
        if (!this.missaoJaneiro.terminou) this.fixedUpdateJaneiro(dt, this.multidao, this.missaoJaneiro);
        if (this.missaoJaneiro.terminou) return false;
      }
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
      this.cruise.fixedUpdate(dt);
      this.grenades.fixedUpdate(dt);
      this.hooks.fixedUpdate(dt);
      this.beams.update(dt);
      this.physics.step();
      this.ctf?.fixedUpdate(dt);
      this.dominio?.fixedUpdate(dt);
      this.dirigirOsBots(dt);
      this.dirigirOsInvasoresAosAlvos(dt);
      this.tickDosCabos(dt);
      this.tickDasPortas(dt);
      this.tickDoQuadro(dt);
      this.drenarONucleo(dt);
      this.aplicarRoteiro();
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
    n.fixedUpdate(dt, peso, (this.cabos?.drenoDaRedePorS ?? 0) + (this.portas?.drenoDaRedePorS ?? 0));
  }

  /**
   * Os cabos de dados (P162): conta, por cabo, quem está perto do ponto de conexão e roda a regra pura (`CabosDeDados`). O **andróide rebelde** a menos de 4,5 m está
   * ligado (injeta); o rebelde **pesado** a menos de 7 m depreda (peso do `NucleoDaEstacao`); o jogador e os aliados a menos de 6 m defendem (o andróide aliado vale dois).
   * Custo: um laço sobre os rebeldes (≤ 8), os aliados e os jogadores, sem alocar.
   */
  private tickDosCabos(dt: number): void {
    const c = this.cabos;
    if (!c) return;
    this.cabosLigados.fill(0);
    this.cabosDepredadores.fill(0);
    this.cabosDefensores.fill(0);
    for (const m of this.bots.mechs) {
      if (!m.alive) continue;
      const p = m.simPosition;
      const nome = m.stats.name;
      if (ehAndroide(nome)) {
        const i = caboDoPonto(p.x, p.z, CABOS.raioDaConexao);
        if (i >= 0) this.cabosLigados[i]! += 1;
      } else {
        const i = caboDoPonto(p.x, p.z, CABOS.raioDeDano);
        if (i >= 0) this.cabosDepredadores[i]! += pesoDoInvasor(nome);
      }
    }
    this.contarDefensoresDosCabos(this.players);
    if (this.allies) this.contarDefensoresDosCabos(this.allies.mechs);
    c.fixedUpdate(dt, this.cabosLigados, this.cabosDepredadores, this.cabosDefensores);
  }

  private contarDefensoresDosCabos(mechs: readonly MechBase[]): void {
    for (const m of mechs) {
      if (!m.alive) continue;
      const i = caboDoPonto(m.simPosition.x, m.simPosition.z, CABOS.raioDeReparo);
      if (i >= 0) this.cabosDefensores[i]! += ehAndroide(m.stats.name) ? 2 : 1;
    }
  }

  /**
   * Manda os invasores aos seus alvos (a cada segundo, com a mesma ordem `hold` do Domínio: ele vai até o ponto e fica por ali, trocando tiro com quem chega):
   *  - os **andróides rebeldes** vivos aos **pontos de conexão dos cabos** (o 1º ao cabo 1, o 2º ao 2, o 3º ao 3, o 4º ao 1...): é o que faz o andróide **se ligar**;
   *  - os **manifestantes**, pela vaga do pool (cada vaga nasce num lado, `PRAIA_MANIFESTANTES`): **entrada principal**, **dos fundos**, cabo 1, **dos fundos**, cabo 3.
   * Os Mechs rebeldes seguem o comportamento de sempre (e depredam o cabo ou forçam a porta que cruzarem). A ordem soma `escortSide × 6` ao posto; aqui se desconta,
   * para o invasor parar **no** ponto.
   */
  private dirigirOsInvasoresAosAlvos(dt: number): void {
    if (!this.cabos) {
      this.dirigirOsInvasoresDaArena(dt);
      return;
    }
    this.cabosReplanejaEm -= dt;
    if (this.cabosReplanejaEm > 0) return;
    this.cabosReplanejaEm = 1;
    const mechs = this.bots.mechs;
    if (this.rumoDosAlvos.length !== mechs.length) {
      this.rumoDosAlvos.length = mechs.length;
      this.rumoDosAlvos.fill(-1);
    }
    let androides = 0;
    let manifestantes = 0;
    // O saboteiro (P164): da onda 2 em diante, o primeiro andróide vivo vai ao quadro de luz da cidade, em vez de a um cabo.
    const haSaboteiro = (this.waves?.wave ?? 1) >= 2;
    for (let i = 0; i < mechs.length; i++) {
      const m = mechs[i]!;
      const nome = m.stats.name;
      let alvo = -1;
      if (ehManifestante(nome)) {
        const vaga = manifestantes++; // a vaga do pool (viva ou não): o lado de onde ele nasce
        if (m.alive) alvo = ALVO_DO_MANIFESTANTE[vaga % ALVO_DO_MANIFESTANTE.length]!;
      } else if (nome.startsWith('COLOSSUS')) {
        // O chefe (P165, parte D): vai ao cabo mais perto que ainda não foi cortado e o depreda (peso 4); com os três cortados, vai à porta principal do prédio.
        if (m.alive) {
          for (let k = 0; k < this.estadosDosCabosDoChefe.length; k++) this.estadosDosCabosDoChefe[k] = CODIGO_DO_ESTADO[this.cabos.estado(k)];
          const cabo = alvoDoChefe(m.simPosition.x, m.simPosition.z, this.estadosDosCabosDoChefe);
          alvo = cabo >= 0 ? cabo : ALVO_DA_PORTA_PRINCIPAL;
        }
      } else if (ehAndroide(nome)) {
        if (m.alive) {
          alvo = haSaboteiro && androides === 0 ? ALVO_DO_QUADRO : (androides - (haSaboteiro ? 1 : 0)) % this.cabos.quantidade;
          androides++;
        }
      }
      if (alvo < 0) {
        this.rumoDosAlvos[i] = -1;
        continue;
      }
      const cerebro = this.bots.brainOf(m);
      if (!cerebro) continue;
      if (alvo !== this.rumoDosAlvos[i] || cerebro.order !== 'hold') {
        const ponto = this.pontosDosAlvos[alvo]!;
        cerebro.receiveOrder('hold', this._pontoDoAlvo.set(ponto.x - cerebro.escortSide * 6, 0, ponto.z), null);
        this.rumoDosAlvos[i] = alvo;
      }
    }
  }

  /**
   * A Cidade Neon (P164, parte E) não tem cabos nem portas: o alvo dos invasores é o **transformador do Banco Vorcaris**. Da onda 2 em diante o **primeiro andróide vivo** é o saboteiro e o
   * **Colossus** vai direto a ele (peso 4: apaga o de 480 em ~20 s); os outros seguem o comportamento de sempre. A ordem é a `hold` dos cabos (vai até o ponto e fica, trocando tiro com quem
   * chega). Com o transformador **apagado** (nada mais a depredar) o invasor é solto: volta ao comportamento normal e vem atrás do jogador. A cada segundo; sem alocar.
   */
  private dirigirOsInvasoresDaArena(dt: number): void {
    const q = this.quadro;
    if (!q) return;
    this.cabosReplanejaEm -= dt;
    if (this.cabosReplanejaEm > 0) return;
    this.cabosReplanejaEm = 1;
    const mechs = this.bots.mechs;
    if (this.rumoDosAlvos.length !== mechs.length) {
      this.rumoDosAlvos.length = mechs.length;
      this.rumoDosAlvos.fill(-1);
    }
    const haSaboteiro = (this.waves?.wave ?? 1) >= 2;
    let androides = 0;
    for (let i = 0; i < mechs.length; i++) {
      const m = mechs[i]!;
      const nome = m.stats.name;
      if (!m.alive) {
        this.rumoDosAlvos[i] = -1;
        continue;
      }
      let vai = false;
      if (nome.startsWith('COLOSSUS')) vai = true;
      else if (ehAndroide(nome)) vai = haSaboteiro && androides++ === 0;
      const cerebro = this.bots.brainOf(m);
      if (!cerebro) continue;
      if (vai && !q.apagado) {
        if (this.rumoDosAlvos[i] !== ALVO_DO_QUADRO || cerebro.order !== 'hold') {
          cerebro.receiveOrder('hold', this._pontoDoAlvo.set(q.ponto.x - cerebro.escortSide * 6, 0, q.ponto.z), null);
          this.rumoDosAlvos[i] = ALVO_DO_QUADRO;
        }
      } else if (this.rumoDosAlvos[i] === ALVO_DO_QUADRO) {
        // não é mais o saboteiro (ou o transformador caiu): volta ao comportamento de sempre
        cerebro.receiveOrder('follow', this._pontoDoAlvo.set(m.simPosition.x, 0, m.simPosition.z), null);
        this.rumoDosAlvos[i] = -1;
      }
    }
  }

  /**
   * As portas do prédio (P163): conta quem as força (todo rebelde a menos de 7 m, com o peso de `pesoNaPorta`) e quem está perto para recuperá-las (o jogador e os aliados),
   * e roda a regra pura (`PortasDaEstacao`). Custo: um laço sobre os rebeldes (≤ 13 com os manifestantes), os aliados e os jogadores, sem alocar.
   */
  private tickDasPortas(dt: number): void {
    const p = this.portas;
    if (!p) return;
    this.portasAtacantes.fill(0);
    this.portasDefensores.fill(0);
    for (const m of this.bots.mechs) {
      if (!m.alive) continue;
      const pos = m.simPosition;
      const i = portaDoPonto(pos.x, pos.z, PORTAS.raioDeAtaque);
      if (i >= 0) this.portasAtacantes[i]! += pesoNaPorta(m.stats.name);
    }
    this.contarDefensoresDasPortas(this.players);
    if (this.allies) this.contarDefensoresDasPortas(this.allies.mechs);
    p.fixedUpdate(dt, this.portasAtacantes, this.portasDefensores);
  }

  /**
   * O quadro de luz da cidade (P164): conta quem o depreda (todo rebelde a menos de 7 m, com o peso de `pesoDoInvasor`) e quem está perto para recuperá-lo (o jogador e os aliados), roda a regra
   * pura (`QuadroDeLuz`) e **liga a energia às zonas**: com o quadro apagado, as zonas de cura e de resfriamento deixam de funcionar. Custo: um laço sobre os rebeldes, aliados e jogadores.
   */
  private tickDoQuadro(dt: number): void {
    const q = this.quadro;
    if (!q) return;
    let atacantes = 0;
    for (const m of this.bots.mechs) {
      if (!m.alive) continue;
      const p = m.simPosition;
      if (q.perto(p.x, p.z, QUADRO.raioDeAtaque)) atacantes += pesoDoInvasor(m.stats.name);
    }
    this.quadroDefensores = 0;
    this.contarDefensoresDoQuadro(q, this.players);
    if (this.allies) this.contarDefensoresDoQuadro(q, this.allies.mechs);
    q.fixedUpdate(dt, atacantes, this.quadroDefensores);
    this.zones.energizadas = !q.apagado;
  }

  private contarDefensoresDoQuadro(q: QuadroDeLuz, mechs: readonly MechBase[]): void {
    for (const m of mechs) {
      if (!m.alive) continue;
      if (q.perto(m.simPosition.x, m.simPosition.z, QUADRO.raioDeReparo)) this.quadroDefensores += ehAndroide(m.stats.name) ? 2 : 1;
    }
  }

  /** Os contêineres de desembarque estão abertos? (P164) Quando a onda está em campo, as portas deles se abrem e os rebeldes saem; entre as ondas ficam fechadas. Só a praia. */
  get desembarqueAberto(): boolean {
    return this.nucleo !== null && this.waves?.phase === 'active';
  }

  private contarDefensoresDasPortas(mechs: readonly MechBase[]): void {
    for (const m of mechs) {
      if (!m.alive) continue;
      const i = portaDoPonto(m.simPosition.x, m.simPosition.z, PORTAS.raioDeReparo);
      if (i >= 0) this.portasDefensores[i]! += ehAndroide(m.stats.name) ? 2 : 1;
    }
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

  /**
   * O WARGAME (P262): dispara as batidas do tick atual (`RoteiroStepper.tick`, vazio na maioria dos ticks — G4/G5).
   * Para cada batida com `ordem`, manda o lado inteiro para o ponto (mesmo padrão de `dirigirLado`/a Resistência:
   * `brainOf(m)?.receiveOrder(...)`) — os bots continuam andando, mirando e errando sozinhos, a ordem só diz para
   * onde ir e o que fazer lá. Sempre avisa `onRoteiroEvento` (legenda e câmera são decisão de quem desenha, não da regra).
   */
  private aplicarRoteiro(): void {
    const stepper = this.roteiroStepper;
    if (!stepper) return;
    const batidas = stepper.tick(this.tickRoteiro++);
    if (batidas.length === 0) return;
    for (const b of batidas) {
      if (b.lado && b.ordem) {
        const sistema = b.lado === 'inimigo' ? this.bots : this.allies;
        if (sistema) {
          this._pontoDoRoteiro.set(b.ordem.ponto.x, 0, b.ordem.ponto.z);
          for (const m of sistema.mechs) {
            if (m.alive) sistema.brainOf(m)?.receiveOrder(b.ordem.tipo, this._pontoDoRoteiro, null);
          }
        }
      }
      this.onRoteiroEvento?.(b);
    }
  }

  /** Quantos androides rebeldes estão em campo agora (a missão do 8 DE JANEIRO; 0 fora dela). O painel e os testes leem daqui. */
  get rebeldesVivos(): number {
    return this.rebeldesVivosN;
  }

  /** O tick da missão do 8 DE JANEIRO (0 fora dela): o desenho da multidão lê daqui, e os testes sabem em que tick a multidão está. */
  get tickDaMissao(): number {
    return this.tickJaneiro;
  }

  /**
   * Um tick da missão do 8 DE JANEIRO (P217): a multidão anda no relógio da missão; quem está perto de um jogador vivo foge (o susto); a investida do Mech (o dash) leva quem está no caminho (a
   * "porrada" da ficha: eliminar à mão, sem arma nova); e a regra lê a situação da Praça. Custo: uma passada pela multidão (1.500) para a fachada e uma para o susto, sem alocar (G4/G5).
   */
  private fixedUpdateJaneiro(dt: number, multidao: Multidao, missao: MissaoJaneiro): void {
    const { RAIO_DA_INVESTIDA, DANO_DA_INVESTIDA, RAIO_DO_SUSTO } = this.janeiroPedaco!;
    const t = ++this.tickJaneiro;
    multidao.avancar(t);
    this.chefesJaneiro?.avancar(dt, this.players);
    const pontos = this.pontosDoSusto;
    while (pontos.length < this.players.length) pontos.push({ x: 0, z: 0 });
    for (let k = 0; k < pontos.length; k++) {
      const p = this.players[k];
      const vivo = p !== undefined && p.alive;
      pontos[k]!.x = vivo ? p.simPosition.x : 1e6;
      pontos[k]!.z = vivo ? p.simPosition.z : 1e6;
      if (vivo && p.isDashing) {
        multidao.explodir(p.simPosition.x, 1, p.simPosition.z, RAIO_DA_INVESTIDA, DANO_DA_INVESTIDA, t);
        this.chefesJaneiro?.explodir(p.simPosition.x, 1, p.simPosition.z, RAIO_DA_INVESTIDA, DANO_DA_INVESTIDA);
      }
    }
    multidao.assustarPorPerto(pontos, RAIO_DO_SUSTO, t);
    // Os androides rebeldes entram no cronograma da multidão, um por vaga do pool (no máximo REBELDES_MAX vivos); sem vaga, esperam a próxima.
    const agenda = this.rebeldesAgendados;
    while (this.rebeldesEntraram < agenda.length && agenda[this.rebeldesEntraram]!.tick <= t) {
      const a = agenda[this.rebeldesEntraram]!;
      if (!this.bots.entrarAndroide(a.x, a.z)) break;
      this.rebeldesEntraram++;
    }
    // Só os de combate (androides rebeldes): o faxineiro (P243) é sempre ativo, de fora da conta da Praça.
    const vivos = this.bots.combatAliveCount();
    this.rebeldesVivosN = vivos;
    const s = this.situacaoDaPraca;
    s.naFachada = multidao.contarNaFachada(t);
    s.faltamChegar = multidao.faltamChegar + (agenda.length - this.rebeldesEntraram);
    s.presentes = multidao.presentes + vivos + (this.chefesJaneiro?.restantes ?? 0);
    s.eliminados = multidao.eliminados;
    s.rebeldesEliminados = this.rebeldesEntraram - vivos;
    missao.fixedUpdate(dt, t, s);
  }

  /** Recomeça o objetivo usando os mesmos corpos físicos e pools. */
  restartMission(): void {
    if (!this.waves && !this.ctf && !this.dominio && !this.rio && !this.missaoJaneiro) return;
    this.players.forEach((m, i) => {
      const [x, z] = this.ctf
        ? [CTF_BASES.blue.x + CTF_PLAYER_OFFSET_X, CTF_BASES.blue.z]
        : this.dominio
          ? NASCIMENTOS_DO_DOMINIO.blue[0]!
          : this.spawnPoints[i % this.spawnPoints.length]!;
      m.respawn(this._spawn.set(x, 0, z));
    });
    if (this.ctf || this.dominio || this.rio) this.bots.respawnAll(); // na missão do rio, o Draga volta inteiro à largada
    if (this.rio) {
      this.allies?.respawnAll(); // e a Resistência, à aldeia
      this.invasao?.reiniciar();
      this.escotilhaOrdenada.x = Number.NaN;
      this.escotilhaOrdenada.z = Number.NaN;
      this.resistenciaOrdenada.fill(false);
    }
    if (this.dominio) {
      this.allies?.respawnAll();
      this.rumoRed.fill(-1);
      this.rumoBlue.fill(-1);
      this.replanejaEm = 0;
    }
    this.projectiles.clear();
    this.rockets.clear();
    this.barrage.clear();
    this.cruise.clear();
    this.grenades.clear();
    this.hooks.clear();
    this.beams.clear();
    this.debris.clear();
    this.destructibles.restoreAll();
    this.round.resetScores();
    this.waves?.reset();
    this.rio?.reset();
    if (this.missaoJaneiro && this.multidao) {
      this.missaoJaneiro.reset();
      this.multidao.reiniciar();
      this.fugaPeloJogador.fill(0);
      this.tickJaneiro = 0;
      this.rebeldesEntraram = 0;
      this.rebeldesVivosN = 0;
      this.bots.setRoster(0, 0); // os androides rebeldes saem de campo e voltam no cronograma
      this.chefesJaneiro?.reiniciar();
    }
    this.nucleo?.reset();
    this.cabos?.reset();
    this.portas?.reset();
    this.quadro?.reset();
    this.zones.energizadas = true;
    this.rumoDosAlvos.fill(-1);
    this.cabosReplanejaEm = 0;
    this.ctf?.reset();
    this.dominio?.reset();
  }

  private applyWaveRoster(plan: WavePlan | null): void {
    const boss = plan?.boss ? 1 : 0;
    const manifestantes = this.nucleo ? plan?.manifestantes ?? 0 : 0; // só a praia traz o pool de manifestantes (o núcleo existe só lá)
    const active = this.bots.setRoster(plan?.mechs ?? 0, plan?.androids ?? 0, boss, manifestantes);
    if (plan) {
      this.bots.maxAttackers = plan.maxAttackers;
      if (active !== plan.mechs + plan.androids + manifestantes + boss) throw new Error('Pool da missão não cobre o plano da onda');
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
    this.cruise.clear();
    this.grenades.clear();
    this.hooks.clear();
    this.beams.clear();
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
