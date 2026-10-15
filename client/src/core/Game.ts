import { mapFromSearch, type MapId } from '../environment/Bunker';
import { CommandConsole } from '../ui/CommandConsole';
import { escalacaoDaPartida, fracoesDasPartes } from '../ui/consoleData';
import { fonteDoRadar } from '../ui/TacticalRadar';
import { SquadHUD } from '../ui/SquadHUD';
import { ShieldVisuals } from '../fx/ShieldVisuals';
import { ShieldHUD } from '../ui/ShieldHUD';
import { runtimeDiagnostics } from './runtimeDiagnostics';
import { PlayTelemetry } from './PlayTelemetry';
import { BankAccount } from '../bank/BankAccount';
import { addBankSign } from '../environment/BankSign';
import { addSerafimPlaque, SERAFIM_TOWER } from '../environment/SerafimTower';
import { DroneVisuals } from '../fx/DroneVisuals';
import { ShadowBlobs, terrainGround } from '../fx/ShadowBlobs';
import { BankTerminal } from '../ui/BankTerminal';
import { bankReward, nearBank, type BankReply } from '../../../shared/bank/codes';
import { ChargeVisuals } from '../fx/ChargeVisuals';
import * as THREE from 'three';
import { GLOW } from './palette';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { CameraRig } from '../camera/CameraRig';
import { KillCam } from '../camera/KillCam';
import { camerasDoMapa } from '../camera/camerasDoMapa';
import { SpectatorCam } from '../camera/SpectatorCam';
import { SpectatorHUD } from '../ui/SpectatorHUD';
import type { CameraModeId } from '../camera/CameraMode';
import type { CombatSystem } from '../combat/CombatSystem';
import type { ProjectileSystem } from '../combat/ProjectileSystem';
import type { BarrageSystem } from '../combat/BarrageSystem';
import type { RocketSystem } from '../combat/RocketSystem';
import { BOT_SKILLS } from '../combat/BotController';
import type { BotSystem } from '../combat/BotSystem';
import type { Respawner } from '../combat/Respawner';
import type { Round } from '../combat/Round';
import { Vector09 } from '../entities/Vector09';
import { Android } from '../entities/Android';
import type { MechBase } from '../entities/MechBase';
import type { DebrisSystem } from '../environment/DebrisSystem';
import { CtfObjectives } from '../environment/CtfObjectives';
import { DominioPontos } from '../environment/DominioPontos';
import { DamageVisuals } from '../fx/DamageVisuals';
import { protegerBloom } from '../fx/bloomSeguro';
import { FlameVisuals } from '../fx/FlameVisuals';
import { FireRingVisuals } from '../fx/FireRingVisuals';
import { FrameCopyPass } from '../fx/FrameCopyPass';
import { WaveRings } from '../fx/WaveRings';
import { HeatHaze } from '../fx/HeatHaze';
import { StatusVisuals } from '../fx/StatusVisuals';
import { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { AimAssist } from '../player/AimAssist';
import { PlayerController } from '../player/PlayerController';
import { DamageIndicator } from '../ui/DamageIndicator';
import { AlgozPanel, algozViewOf } from '../ui/AlgozPanel';
import { DamageNumbers } from '../ui/DamageNumbers';
import { StatusBadges } from '../ui/StatusBadges';
import { TargetPanel } from '../ui/TargetPanel';
import { StatusHud } from './statusHud';
import { HUD } from '../ui/HUD';
import { KillFeed } from '../ui/KillFeed';
import { MouseCalibration } from '../ui/MouseCalibration';
import { Onboarding } from '../ui/Onboarding';
import { OffscreenIndicators } from '../ui/OffscreenIndicators';
import { Nameplates } from '../ui/Nameplates';
import { RoundHud } from '../ui/RoundHud';
import { SettingsMenu } from '../ui/SettingsMenu';
import { EnemySettings } from '../ui/EnemySettings';
import { InputManager } from './InputManager';
import { Quality } from './Quality';
import { browserStorage, radiansPerCount, Settings, type GameSettings, type QualityPreset } from './Settings';
import { WARMUP_TIMEOUT_MS, warmUpSceneResources, warmUpShaders } from './ShaderWarmup';
import { DebugPanel } from '../debug/DebugPanel';
import { TouchControls } from '../ui/TouchControls';
import { loadTouchLayout, saveTouchLayout } from '../ui/touchLayout';
import { AudioSystem } from '../audio/AudioSystem';
import { BrandSplash } from '../brand/BrandSplash';
import { Hangar } from '../hangar/Hangar';
import { CHASSIS, PILOT_ANDROID_STATS, type ChassisId } from '../entities/chassis';
import { BLUEPRINT_BY_CHASSIS } from '../entities/blueprintByChassis';
import { ImportedMech } from '../entities/ImportedMech';
import { IMPORTED_CHASSIS, preloadMechAsset, tryInstantiateMechRig } from '../entities/importedMechAssets';
import { TIERS, type Loadout, type WeaponId, type WeaponStats } from '../combat/weapons';
import { poweredLoadout, poweredStats } from '../tuning/power';
import { PowerStore } from '../tuning/PowerStore';
import { EsquadraoStore } from './EsquadraoStore';
import { PARAM_DA_TATICA, taticaDeTexto } from '../combat/taticas';
import { CHASSIS_DOS_BOTS, esquadraoDeFoes, PARAM_DO_ESQUADRAO, resumoDoEsquadrao } from '../sim/esquadrao';
import { ALLY_COUNT } from '../sim/nascimentos';
import { SquadPanel } from '../ui/SquadPanel';
import { SequenciaDeAbates } from '../combat/killStreak';
import { bootProgresso } from './bootProgress';
import { locucaoDoNavegador } from '../ui/locucao';
import { ArsenalPanel } from '../ui/ArsenalPanel';
import { CampaignPanel } from '../ui/CampaignPanel';
import { CampaignRunHud } from '../ui/CampaignRunHud';
import { CampanhaStore } from './CampanhaStore';
import { EtapaEmCurso } from './EtapaEmCurso';
import { linkDaEtapa, PARAM_DA_CAMPANHA, PARAM_DA_ETAPA } from '../sim/campanha';
import { ServerPanel } from '../ui/ServerPanel';
import { CameraWall } from '../ui/CameraWall';
import { plantaDaArena, plantaDoBunker } from '../ui/TacticalRadar';
import { Minimapa, plantaComZonas, plantaDaPraiaNoMinimapa, pontoDaEstacao } from '../ui/Minimapa';
import { novoQuadroDaPraia, PraiaHud, type QuadroDaPraia } from '../ui/PraiaHud';
import { MuralCliente } from '../net/mural';
import { AdminCliente, TokenDoDono } from '../net/admin';
import { PALETTE } from './palette';
import { PilotLabels } from '../ui/PilotLabels';
import { PowerSettings } from '../ui/PowerSettings';
import { parseLoadoutKey, validateLoadout } from '../hangar/loadout';
import { defaultServer, onlineConfig } from '../net/onlineConfig';
import { OnlineSwitch } from '../ui/OnlineSwitch';
import { ServerStatus } from '../ui/ServerStatus';
import { GameRecorder } from './GameRecorder';
import { Telemetry } from './telemetry';
import { reloadWithout } from './url';
import { OnlineSession, type OnlineStatus } from '../net/OnlineSession';
import { defaultPower } from '../tuning/power';
import type { RosterEntry } from '../../../shared/net/messages';
import { Match } from '../sim/Match';
import { gameModeFromSearch, waveFromSearch, type GameMode } from '../sim/gameMode';
import { SURVIVAL_MAX_ANDROIDS, SURVIVAL_MAX_MECHS, SURVIVAL_WAVE_PLANS } from '../sim/SurvivalWaves';
import { HangarMenu } from '../ui/HangarMenu';
import { HangarScene } from '../hangar/HangarScene';
import { OnlineLobby } from '../ui/OnlineLobby';
import { ModeSelector } from '../ui/ModeSelector';
import { MissionHUD } from '../ui/MissionHUD';
import { CtfHud } from '../ui/CtfHud';
import { DominioHud, avisoDoPonto } from '../ui/DominioHud';
import { DailyChallenges } from '../ui/DailyChallenges';

/** Nome da arma do gatilho secundário no HUD; null = não há (o braço esquerdo leva um escudo). */
const HUD_NAME: Partial<Record<WeaponId, string>> = { rockets: 'FOGUETES', barrage: 'CHUVA', seeker: 'TELEGUIADO', chainsaw: 'MOTOSSERRA' };
/** O nome da arma no cartão do HUD, com o nível: "CANHÃO DE PLASMA MK I". */
const weaponLabel = (w: WeaponStats): string => `${HUD_NAME[w.id] ?? w.name.toUpperCase()} ${TIERS[w.tier]!.label}`;
const secondaryLabel = (l: Loadout): string | null => (l.secondary === null ? null : weaponLabel(l.secondary));
const primaryLabel = (l: Loadout): string => weaponLabel(l.primary);

/** Sem aliados (online, ou uma partida sem esquadrão aliado): a lista vazia que o minimapa lê. */
const SEM_ALIADOS: readonly MechBase[] = [];

/** Onde os braços do Mech do Hangar estão na tela (reaproveitados por quadro). */
const _hotRight = { x: 0, y: 0 };
const _hotLeft = { x: 0, y: 0 };
/** Máximo de ticks por frame: se a máquina engasgar, o jogo desacelera em vez de travar. */
const MAX_STEPS_PER_FRAME = 4;
/** Até esta distância (m) o passo de um Mech gigante treme a câmera de quem é pequeno. */
const GIANT_STEP_RANGE = 25;
/** Até esta distância (m) do jogador, o robô ganha fumaça, fogo e gelo no corpo (o resto do orçamento por pulso é para quem se vê). */
const FX_RANGE = 120;
/** Resolução máxima do render: acima de 1,5 o custo de GPU sobe muito para pouco ganho visível. */
const maxPixelRatio = () => Math.min(window.devicePixelRatio, 1.5);
const THRUSTER_COLOR = new THREE.Color(3.0, 1.0, 0.2);
const DUST_COLOR = GLOW.dust;
const UP = new THREE.Vector3(0, 1, 0);

const _tmp = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const BLAST_COLOR = new THREE.Color(3.2, 1.3, 0.25);
const SMOKE_COLOR = GLOW.smoke;
const _aimFrom = new THREE.Vector3();
/** Onde nasce o número de dano flutuante (a cabeça do alvo). */
const _dmgPos = new THREE.Vector3();

/**
 * O jogo no navegador: monta a partida (`sim/Match`, a simulação que o servidor também vai rodar) e
 * põe por cima o que é do cliente, e roda o loop:
 *  - simulação em passo fixo de 60 Hz (a partida e o controle do jogador);
 *  - render (câmera, animação, partículas, HUD, som) na taxa do monitor, interpolado.
 */
export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly bloomPass: UnrealBloomPass;

  private readonly quality: Quality;
  private readonly input: InputManager;
  private readonly particles = new ParticleSystem();
  private readonly damageVisuals = new DamageVisuals(this.particles);
  private readonly statusVisuals = new StatusVisuals(this.particles);
  /** A névoa de calor do lança-chamas e do anel de fogo (`fx/HeatHaze`): uma draw call, lê a cópia do quadro dos anéis da onda. */
  private readonly heatHaze = new HeatHaze();
  private readonly flameVisuals = new FlameVisuals(this.particles, this.heatHaze);
  private readonly fireRingVisuals = new FireRingVisuals(this.particles, this.heatHaze);
  private readonly chargeVisuals = new ChargeVisuals(this.particles);
  /** Os anéis da onda sônica e a cópia do quadro que eles distorcem (`fx/WaveRings`): um conjunto na arena e outro no Hangar. */
  private readonly waveRings = new WaveRings();
  private readonly frameCopy = new FrameCopyPass();
  /** A refração do ar da onda liga junto com o bloom: em qualidade baixa os anéis viram um brilho fraco, sem distorção nem cópia de tela. */
  private refractWaves = true;
  private readonly updateRemoteDamage = (remote: { mech: MechBase }): void => {
    this.damageVisuals.update(remote.mech);
    this.statusVisuals.update(remote.mech);
    this.flameVisuals.update(remote.mech);
    this.fireRingVisuals.update(remote.mech);
    this.chargeVisuals.update(remote.mech);
  };
  /** A partida (sem tela): arena, bots, tiros, dano, rodadas. As partes abaixo são atalhos para ela. */
  private readonly match: Match;
  private readonly gameMode: GameMode;
  private readonly debris: DebrisSystem;
  private readonly projectiles: ProjectileSystem;
  private readonly rockets: RocketSystem;
  private readonly barrage: BarrageSystem;
  private readonly combat: CombatSystem;
  private readonly bots: BotSystem;
  private readonly respawner: Respawner;
  private readonly round: Round;
  /** Bandeiras, bases e zonas holográficas: cinco draw calls, somente no modo CTF. */
  private readonly ctfObjectives: CtfObjectives | null;
  private readonly dominioPontos: DominioPontos | null;
  private readonly dominioHud = new DominioHud();
  private readonly roundHud: RoundHud;
  private readonly mech: MechBase;
  private readonly rig: CameraRig;
  /** Câmera de abate local: render puro; o multiplayer não a aciona até a decisão de PvP. */
  private readonly killCam: KillCam;
  /** Câmeras de vigilância e espectador (visão de drones, prédios da arena e outros Mechs). */
  private readonly spectatorCam: SpectatorCam;
  private readonly spectatorHud: SpectatorHUD;
  private readonly btnCftv: HTMLButtonElement | null;
  private readonly touch: TouchControls;
  private readonly assist: AimAssist;
  private readonly player: PlayerController;
  private readonly hud = new HUD();
  /** O radar do canto de cima à esquerda (12 Hz, só com a partida em andamento). `remotos` é a lista reaproveitada dos Mechs de outros jogadores. */
  private readonly minimapa = new Minimapa(document.getElementById('minimapa')!);
  /** O HUD da praia (a faixa da costa, o marcador da estação, o lugar e a água): só existe no mapa da praia (P127). */
  private praiaHud: PraiaHud | null = null;
  /** O quadro que o HUD da praia lê, reaproveitado a cada frame (G4). */
  private praiaQuadro: QuadroDaPraia | null = null;
  private readonly remotos: MechBase[] = [];
  private readonly juntarRemoto = (r: { readonly mech: MechBase }): void => {
    this.remotos.push(r.mech);
  };
  private readonly modeSelector = new ModeSelector();
  private readonly missionHud = new MissionHUD();
  readonly ctfHud = new CtfHud();
  private readonly dailyChallenges = new DailyChallenges();
  private readonly killFeed = new KillFeed();
  /** Jogo online (M4): a sessão com o servidor, ou null no jogo de sempre. */
  private readonly online: OnlineSession | null;
  private readonly netStatus = document.createElement('div');
  private readonly damageIndicator = new DamageIndicator();
  private readonly damageNumbers = new DamageNumbers();
  /** Painel "seu algoz" (frente 3 da P109): quem te matou, em que robô e com que armas, durante o contador. */
  private readonly algoz = new AlgozPanel();
  private readonly targetPanel = new TargetPanel();
  /** Estados do jogador (fogo, choque, gelo) na tela e no som: os indicadores e as bordas são do Gemini, a ponte é `core/statusHud.ts`. */
  private readonly statusBadges = new StatusBadges(document.getElementById('hud')!);
  private readonly statusHud = new StatusHud({
    badges: (list) => this.statusBadges.update(list),
    entered: (kind) => this.audio.playStatusEnter(kind),
    loop: (kind) => this.audio.setStatusLoop(kind),
  });
  private readonly debugPanel = new DebugPanel();
  private readonly audio = new AudioSystem();
  /** Vinheta da SERAFIM WEB antes da primeira partida da sessão. */
  private readonly splash = new BrandSplash();
  private brandShown = false;
  private readonly onboarding = new Onboarding();
  /** Setas na borda da tela para inimigos fora da visão. */
  private readonly offscreen = new OffscreenIndicators();
  /** Nome sobre a cabeça de cada IA rebelde. */
  private readonly nameplates: Nameplates;
  /** Nó de gain do loop de chiado do Blind Mode; null = som não está tocando. */
  private blindGain: GainNode | null = null;
  /** Flag para detectar a transição false→true do dash a cada frame. */
  private wasDashing = false;
  /** Configurações do jogador (salvas no navegador). A tela de configurações chama `settings.update()`. */
  readonly settings = new Settings(browserStorage());
  /** Montagem do Mech (Hangar): salva no aparelho ou vinda de um link `?build=`. A tela do Hangar usa isto. */
  readonly hangar: Hangar;
  /** Potências (painel do dono): as salvas no aparelho ou as de um link `?potencias=`. */
  readonly power = new PowerStore(browserStorage(), location.search);
  /** O esquadrão do Comandante (P91): quantos bots e aliados, cada um com o seu corpo, arma e personalidade. Sem um salvo, valem as configurações. */
  readonly squad = new EsquadraoStore(browserStorage(), location.search);
  /** As campanhas que o Comandante montou e guardou (fase 4B). */
  readonly campanhas = new CampanhaStore(browserStorage());
  /** A etapa de campanha que esta partida é (o link traz `?campanha=…&etapa=N` e bate com o modo e o mapa), ou `null`. */
  private campanha: EtapaEmCurso | null = null;
  private campanhaHud: CampaignRunHud | null = null;
  /** A sequência de abates do jogador (P96): alimenta o aviso de abate. Só da tela (G1/G2). */
  private readonly sequencia = new SequenciaDeAbates();
  /** O "COMBATE!" da primeira rodada já apareceu (ao entrar na partida)? */
  private aberturaFeita = false;
  private appliedQuality: QualityPreset | null = null;
  /** Por onde começa a volta dos efeitos por robô a cada quadro (inimigos e aliados), para o orçamento por pulso alcançar todos. */
  private fxStart = 0;
  private fxStartAllies = 0;

  private readonly bankAccount = new BankAccount();
  private readonly bankTerminal: BankTerminal;
  private bankTick = 0;
  private bankNear = false;
  /** Contador visual online; a regra de dano fica exclusivamente no servidor. */
  private bankOnlineBoost = 0;
  private bankOnlineMultiplier = 1;
  private playing = false;
  private missionEnded = false;
  /** O galpão 3D do Hangar (feito na primeira vez que abre) e se ele está na tela no lugar da arena. */
  private hangarScene: HangarScene | null = null;
  private hangarView = false;
  private readonly hangarMenu: HangarMenu;
  /** Métricas de produto (dono, 28/09): poucos eventos de funil, nunca por quadro. */
  private readonly telemetry: Telemetry;
  private readonly playTelemetry: PlayTelemetry;
  private activeBuild = '';
  private readonly shieldHUD: ShieldHUD;
  /** `?serafim=festa`: o LED do Prédio Serafim gira as cores. */
  private serafimParty = false;
  /** Desenho dos drones da base Serafim (só quando a partida tem drones). */
  private droneVisuals: DroneVisuals | null = null;
  private serafimCheck = 0;
  private readonly squadHUD: SquadHUD;
  private readonly shieldVisuals = new ShieldVisuals(this.scene);
  private readonly drawShield = (r: {mech: MechBase}): void => this.shieldVisuals.update(r.mech);
  /** Sombra de contato sob cada robô (1 draw call); montada junto com a partida, que tem a física. */
  private readonly shadows: ShadowBlobs;
  private readonly addShadow = (r: { mech: MechBase }): void => this.shadows.add(r.mech);
  /** Gravação nativa de gameplay (dono, 28/09): tecla escondida, só para uso interno. */
  private readonly recorder: GameRecorder;
  private readonly lobby = new OnlineLobby();
  private aimPracticeWeapon: WeaponStats | null = null;
  private savedPracticeLook: { yaw: number; pitch: number; mode: CameraModeId } | null = null;
  private readonly renderPass: RenderPass;
  private accumulator = 0;
  private last = -1;

  static async create(container: HTMLElement): Promise<Game> {
    bootProgresso('fisica');
    const physics = await PhysicsWorld.create();
    bootProgresso('robos');
    const hangar = new Hangar();
    const chassisId = hangar.current.chassis;
    const importedAsset = IMPORTED_CHASSIS[chassisId];
    if (importedAsset) {
      const { whenMechAssetReady } = await import('../entities/importedMechAssets');
      await whenMechAssetReady(importedAsset.url, CHASSIS[chassisId].height, importedAsset);
    }
    // Os chassis de malha importada que o esquadrão do Comandante usa têm de estar prontos antes de a partida montar os bots (senão nascem como Vector-09).
    const esquadrao = new EsquadraoStore(browserStorage(), location.search).current;
    if (esquadrao) {
      const { whenMechAssetReady } = await import('../entities/importedMechAssets');
      const usados = new Set([...esquadrao.inimigos, ...esquadrao.aliados].map((b) => b.chassi).filter((c): c is ChassisId => !!c && c !== chassisId));
      await Promise.all([...usados].map((c) => IMPORTED_CHASSIS[c] && whenMechAssetReady(IMPORTED_CHASSIS[c]!.url, CHASSIS[c].height, IMPORTED_CHASSIS[c]!)));
    }
    bootProgresso('jogo');
    const game = new Game(container, physics, hangar);
    await game.precompileShaders();
    bootProgresso('pronto');
    return game;
  }

  private constructor(
    container: HTMLElement,
    physics: PhysicsWorld,
    hangar: Hangar,
  ) {
    this.hangar = hangar;
    // Carrega chassis de malha importada (assíncrono, dispara cedo — CHASSIS[id].height é a mesma
    // stat usada na hora de montar o Mech de verdade, então o cache bate certo).
    for (const [chassisId, asset] of Object.entries(IMPORTED_CHASSIS)) {
      preloadMechAsset(asset.url, CHASSIS[chassisId as ChassisId].height, asset);
    }

    // Carrega samples de áudio (assíncrono)
    const base = import.meta.env.BASE_URL;
    this.audio.loadSample('logo_serafim', base + 'audio/logo_serafim.mp3');
    this.audio.loadSample('ui_transition', base + 'audio/ui_transition.mp3');
    this.audio.loadSample('ui_bass', base + 'audio/ui_bass.mp3');
    this.audio.loadSample('ambient_bram', base + 'audio/ambient_bram.mp3');
    this.audio.loadSample('ambient_action', base + 'audio/ambient_action.mp3');
    this.audio.loadSample('shot_plasma', base + 'audio/shot_plasma.wav');
    this.audio.loadSample('shot_heavy', base + 'audio/shot_heavy.mp3');
    this.audio.loadSample('shot_futuristic', base + 'audio/shot_futuristic.wav');
    this.audio.loadSample('hit', base + 'audio/hit.mp3');
    this.audio.loadSample('step_mech', base + 'audio/step_mech.mp3');
    this.audio.loadSample('step_heavy', base + 'audio/step_heavy.mp3');

    // --- Render ---
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(maxPixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    // O composer chama render() várias vezes por frame; com autoReset o info.render só
    // guardaria a última passada. Zeramos à mão no início do frame (ver frame()).
    this.renderer.info.autoReset = false;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 800);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.25;
    pmrem.dispose();

    // Render target HDR com MSAA -> bloom -> tone mapping/sRGB.
    this.composer = new EffectComposer(
      this.renderer,
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
    );
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.frameCopy); // desligada até haver onda no ar (custo zero)
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.5, 0.9);
    protegerBloom(this.bloomPass); // um NaN num pixel não vira mais a tela preta (P130/P136)
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    window.addEventListener('resize', () => this.onResize());

    // --- A partida (a simulação única; quantos inimigos vêm das configurações e mudam ao reiniciar) ---
    this.scene.add(this.particles.points);
    this.scene.add(this.waveRings.mesh);
    this.scene.add(this.heatHaze.mesh);
    // Online (M4): /jogar/?sala=CODIGO[&servidor=wss://…][&nome=Dan]. A partida local fica sem bots, sem dano e sem
    // rodada própria (quem decide é o servidor); o jogo prevê o seu Mech e desenha os outros.
    const publicServer = import.meta.env.VITE_GAME_SERVER;
    const net = onlineConfig(location.search, location.hostname, publicServer);
    const online = net && !('error' in net) ? net : null;
    this.gameMode = online ? 'deathmatch' : gameModeFromSearch(location.search);
    const foes = online
      ? { ...this.settings.value, enemyMechs: 0, enemyAndroids: 0, technician: false }
      : this.gameMode === 'survival'
        ? { ...this.settings.value, enemyMechs: SURVIVAL_MAX_MECHS, enemyAndroids: SURVIVAL_MAX_ANDROIDS, technician: false }
        : this.settings.value;
    // Potências do painel (por arma e por clã): montadas uma vez, aqui; mudam ao reiniciar. Online, o padrão do servidor.
    const power = online ? defaultPower() : this.power.current;
    this.match = new Match({
      physics,
      scene: this.scene,
      particles: this.particles,
      foes,
      power,
      ...(online || !this.squad.current ? {} : { squad: this.squad.current }),
      // A tática do esquadrão aliado (ordem P122): vem do link `?tatica=`; sem ela, o esquadrão entra pelo centro.
      tatica: taticaDeTexto(new URLSearchParams(location.search).get(PARAM_DA_TATICA)),
      // Os bots do esquadrão com chassi de malha importada (Marauder, Lancer...) nascem com o corpo certo, não como Vector-09.
      rigDoChassi: (id) => {
        const a = IMPORTED_CHASSIS[id];
        return a ? tryInstantiateMechRig(a.url, CHASSIS[id].height) : null;
      },
      mode: this.gameMode,
      map: mapFromSearch(location.search, !!online, this.gameMode),
      startWave: waveFromSearch(location.search, SURVIVAL_WAVE_PLANS.length),
      // allies: false online — os inimigos locais já vão a 0 (o servidor manda o estado de verdade);
      // um aliado sem ninguém pra lutar, fora de sincronia com o servidor, não serve pra nada aqui.
      ...(online ? { damage: false, roundS: Number.POSITIVE_INFINITY, allies: false } : {}),
    });
    ({ debris: this.debris, projectiles: this.projectiles, rockets: this.rockets, barrage: this.barrage } = this.match);
    // A missão em ondas da praia (a estação sob ataque): a orla está evacuada, sem banhistas, ciclistas nem pipas.
    if (this.match.nucleo) this.match.arena.praia?.setCivis(false);
    ({ combat: this.combat, respawner: this.respawner, bots: this.bots, round: this.round } = this.match);
    if (this.match.arena.serafim) {
      addBankSign(this.scene);
      addSerafimPlaque(this.scene);
    }
    this.droneVisuals = this.match.drones ? new DroneVisuals(this.scene, this.match.drones) : null;
    this.shadows = new ShadowBlobs(this.scene, terrainGround(physics));
    // ?serafim=festa: o LED do prédio gira as cores (o dono quer poder variar a luz).
    this.serafimParty = new URLSearchParams(location.search).get('serafim') === 'festa';
    this.bankTerminal = new BankTerminal((code) => {
      if (this.online) {
        if (!this.online.redeemBank(code)) this.bankTerminal.showMessage("Sem conexão com a sala. Nenhuma recompensa concedida.");
      } else this.acceptBank(this.bankAccount.redeem(code, this.mech, this.bankTick));
    }, () => { this.hud.setPaused(true); this.resume(); });
    this.ctfObjectives = this.match.ctf ? new CtfObjectives(this.scene) : null;
    this.dominioPontos = this.match.dominio ? new DominioPontos(this.scene, this.match.dominio) : null;
    // O piloto escolhe o chassi (Hangar): qualquer um em CHASSIS, sempre nas cores do jogador. O andróide
    // tem classe própria (ferramenta, sem blueprint); os de malha importada (`IMPORTED_CHASSIS`) usam o
    // rig pré-carregado no boot (síncrono a essa altura — deu tempo de sobra); os outros passam pelo
    // Vector09 com o blueprint certo (`BLUEPRINT_BY_CHASSIS`) — sem isso, um chassi novo nasce com a
    // silhueta do Vector-09 esticada (era o bug do Colossus como boss, achado e corrigido em 29/09).
    const chassisId: ChassisId = this.hangar.current.chassis;
    const importedAsset = IMPORTED_CHASSIS[chassisId];
    const importedRig = importedAsset ? tryInstantiateMechRig(importedAsset.url, CHASSIS[chassisId].height) : null;
    if (importedAsset && !importedRig) {
      // Não devia acontecer (preload disparou no boot) — mas nunca trava a partida por causa de um
      // asset externo; entra com a silhueta procedural padrão em vez de quebrar.
      console.warn(`rig importado de "${chassisId}" ainda não estava pronto; entrando com o Vector-09 padrão`);
    }
    this.mech =
      chassisId === 'android'
        ? new Android({ stats: poweredStats(PILOT_ANDROID_STATS, power, 'player'), paint: PALETTE.playerPaint, visor: PALETTE.green, tool: 'pilot', loadout: poweredLoadout(this.hangar.equipped, power, 'player') })
        : importedRig
        ? new ImportedMech(poweredStats(CHASSIS[chassisId], power, 'player'), importedRig, poweredLoadout(this.hangar.equipped, power, 'player'))
        : new Vector09({
            stats: poweredStats(CHASSIS[chassisId], power, 'player'),
            loadout: poweredLoadout(this.hangar.equipped, power, 'player'),
            blueprint: BLUEPRINT_BY_CHASSIS[chassisId],
          });
    this.match.addPlayer(this.mech, 'VOCÊ', 0, () => this.equipPending());
    // Online, quem faz renascer é o servidor.
    if (online) this.match.respawner.untrack(this.mech);
    this.nameplates = new Nameplates(this.scene, this.bots, this.match.allies ?? undefined);
    // Sons dos andróides (Gemini): tiro e pouso, mais baixos quanto mais longe do jogador. Os do esquadrão aliado também (P91).
    for (const b of [...this.bots.mechs, ...(this.match.allies?.mechs ?? [])]) {
      if (!(b instanceof Android)) continue;
      const fire = b.onFire.bind(b);
      b.onFire = () => {
        fire();
        this.audio.playAndroidShot(this.nearness(b));
      };
      b.onLand = () => this.audio.playAndroidStep(this.nearness(b));
    }
    this.roundHud = new RoundHud(this.mech, this.gameMode === 'deathmatch');
    // Botão na tela de pausa; a calibração tem camada própria e não retoma o jogo.
    new MouseCalibration(this.settings, [
      document.getElementById('setting-sens')!.closest('.setting-row')!,
    ]);

    // --- Jogador ---
    this.input = new InputManager(this.renderer.domElement);
    this.touch = new TouchControls(this.input, {
      onPause: () => this.pause(),
      onCamera: () => this.switchCamera(),
      // Editor de botões terminou: salva no aparelho e volta para a pausa.
      onLayoutDone: (layout) => {
        saveTouchLayout(browserStorage(), layout);
        this.hud.setPaused(true);
      },
    });
    this.touch.setLayout(loadTouchLayout(browserStorage()));
    this.rig = new CameraRig({
      camera: this.camera,
      physics,
      input: this.input,
      mech: this.mech,
      occluders: this.match.arena.occluders,
    });
    this.killCam = new KillCam(this.camera, physics, this.match.arena.occluders);
    this.spectatorHud = new SpectatorHUD();
    this.btnCftv = document.getElementById('btn-cftv') as HTMLButtonElement | null;
    this.btnCftv?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSpectatorCam();
    });
    this.spectatorCam = new SpectatorCam(this.camera, physics, this.match.arena.occluders, {
      // As câmeras do cenário (P148): cada mapa tem as suas (antes todos usavam as da Arena).
      fixedCameras: camerasDoMapa(this.match.arena.mapa),
      getDrones: () => this.match.drones?.drones ?? [],
      getDynamicMechs: () => {
        const list: MechBase[] = [];
        if (this.online?.joined) {
          for (const r of this.online.remotes.values()) {
            if (r.mech.alive) list.push(r.mech);
          }
        } else {
          for (const b of this.bots.mechs) {
            if (b.alive) list.push(b);
          }
          if (this.match.allies) {
            for (const a of this.match.allies.mechs) {
              if (a.alive && a !== this.mech) list.push(a);
            }
          }
        }
        return list;
      },
      getMechName: (m) => {
        if (this.online?.joined) {
          for (const [id, r] of this.online.remotes.entries()) {
            if (r.mech === m) return r.kind === 'human' ? `JOGADOR #${id}` : `BOT #${id}`;
          }
        }
        const sc = this.round.scoreOf(m);
        return sc?.name ?? (m instanceof Android ? 'ANDRÓIDE REBELDE' : 'MECH DE COMBATE');
      },
    });
    this.spectatorHud.onPrev = () => this.spectatorCam.prevTarget();
    this.spectatorHud.onNext = () => this.spectatorCam.nextTarget();
    this.spectatorHud.onExit = () => {
      this.spectatorCam.release();
      this.spectatorHud.setVisible(false);
      this.btnCftv?.classList.remove('active');
    };
    this.player = new PlayerController(this.mech, this.input, this.rig, this.projectiles, this.particles, this.rockets, this.barrage);
    this.match.pilots.push(this.player);
    this.player.melee = (w) => this.match.meleeNearest(this.mech, w);
    this.player.flame = (w, origin, dir) => this.match.flameCone(this.mech, origin, dir, w);
    this.player.wave = (w, origin, dir) => this.match.waveCone(this.mech, origin, dir, w);
    this.match.onWaveFx = (origin, dir, w) => this.waveRings.spawn(origin, dir, w);
    this.netStatus.className = 'net-status';
    
    const shouldConnect = online && online.explicitName;

    if (shouldConnect) {
      this.online = new OnlineSession({
        ...online,
        build: this.hangar.key,
        match: this.match,
        me: this.mech,
        commander: this.player,
        aim: () => this.rig.aim,
        makeUnit: (e) => this.makeRemote(e),
        scene: this.scene,
        onStatus: (s) => this.showNet(s),
        onBank: (reply) => this.acceptBank(reply),
        onDamage: (amount, hit) => {
          this.playTelemetry.hit(amount);
          // Número de dano flutuante online (frente 2): o servidor manda o valor; o alvo dá o lugar.
          if (hit) {
            _dmgPos.copy(hit.position);
            _dmgPos.y += hit.stats.height * 0.7;
            this.damageNumbers.show(this.camera, _dmgPos, amount);
          }
        },
        onRoundEnd: () => this.playTelemetry.finish('completed'),
        onKill: (killer, dead, mine) => {
          this.killFeed.push(killer, dead, mine);
          if (dead === 'VOCÊ') { this.playTelemetry.death(); this.sequencia.zerar(); }
          else if (killer === 'VOCÊ') { this.playTelemetry.kill(); this.hud.killBanner.showKill(dead, this.sequencia.abate(performance.now() / 1000)); }
        },
        onScore: (kills, deaths) => this.hud.setScore(kills, deaths),
      });
      this.match.pilots.push(this.online);
      document.body.append(this.netStatus);
    } else {
      this.online = null;
      if (online) {
        // Wanted to go online but missing name
        this.lobby.show(online.room);
      } else if (net && 'error' in net) {
        this.netStatus.textContent = `ONLINE: ${net.error} · jogando offline`;
        this.netStatus.classList.add('bad');
        document.body.append(this.netStatus);
      }
    }
    this.hud.setPrimaryLabel(primaryLabel(this.mech.loadout));
    this.hud.setSecondaryLabel(secondaryLabel(this.mech.loadout));
    this.assist = new AimAssist(physics, this.mech, this.bots.mechs);

    this.wireEvents();
    // Celular e tablet (toque é o ponteiro principal) começam no modo toque; o toque ou o clique
    // que inicia a partida confirma o modo (notebook com tela de toque continua no mouse).
    this.setTouchMode(matchMedia('(hover: none) and (pointer: coarse)').matches);
    this.hud.setMode(this.rig.mode);
    this.hud.setReady(this.input.touchMode);
    this.telemetry = new Telemetry(new URLSearchParams(location.search).get('servidor') || import.meta.env.VITE_GAME_SERVER);
    this.telemetry.enviar('boot_ok');
    this.shieldHUD = new ShieldHUD(this.input);
    this.squadHUD = new SquadHUD();
    this.squadHUD.onOrder = order => {
      const allies = this.match.allies;
      if (!allies || !this.playing || !this.mech.alive) return false;
      const aimed = this.rig.aim.target;
      const target = aimed ? this.bots.mechs.find(m => m.collider?.handle === aimed.handle) ?? null : null;
      return allies.queueOrder(order, this.mech.simPosition, target);
    };
    this.activeBuild = this.hangar.key;
    this.playTelemetry = new PlayTelemetry(new URLSearchParams(location.search).get('servidor') || import.meta.env.VITE_GAME_SERVER, () => ({mode:this.gameMode,online:!!this.online,build:this.activeBuild,release:runtimeDiagnostics.release,assisted:(!this.online && (this.power.changes>0||this.squad.custom))||this.mech.combatBoost.damageMultiplier>1||this.bankOnlineBoost>0}));
    this.recorder = new GameRecorder(this.renderer.domElement, this.audio);
    if (this.gameMode === 'survival') this.hud.setMissionMode(true);
    else if (this.gameMode === 'ctf') this.hud.setCtfMode(true);
    else if (this.gameMode === 'dominio') this.dominioHud.mostrar(true);
    else this.hud.setMissionMode(false);
    this.hud.setBuild(`CYBERMECH ${import.meta.env.VITE_BUILD ?? 'dev'} · © ${new Date().getFullYear()} SERAFIM WEB`);

    this.quality = new Quality(
      (ratio) => this.setPixelRatio(ratio),
      (enabled) => {
        this.bloomPass.enabled = enabled;
        this.refractWaves = enabled;
        this.match.arena.praia?.setDetalhe(enabled); // o último degrau do rebaixamento também tira as nuvens e o ruído do mar
      },
    );
    // Hangar: enquanto está aberto, o desenho troca a arena pelo galpão (o jogo está pausado).
    this.hangarMenu = new HangarMenu(this.hangar, {
      open: () => {
        this.telemetry.enviar('hangar_aberto');
        this.hangarScene ??= new HangarScene();
        this.configureHangarPreparation();
        this.hangarView = true;
        this.renderPass.scene = this.hangarScene.scene;
        this.renderPass.camera = this.hangarScene.camera;
        this.resizeHangar();
      },
      close: () => {
        this.hangarView = false;
        this.renderPass.scene = this.scene;
        this.renderPass.camera = this.camera;
      },
      show: (chassis, loadout) => this.hangarScene?.show(chassis, loadout),
      rotate: (dx) => this.hangarScene?.rotate(dx),
      applied: () => this.applyHangarNow(),
      credits: () => this.dailyChallenges.credits,
      status: () => (online ? `ONLINE · SALA ${online.room}` : 'OFFLINE'),
      test: (data, arm) => this.hangarScene?.startTest(data, arm),
      stopTest: () => this.hangarScene?.stopTest(),
      aimPractice: (w) => {
        this.savedPracticeLook = { yaw: this.rig.look.yaw, pitch: this.rig.look.pitch, mode: this.rig.mode.id };
        this.aimPracticeWeapon = w;
        if (!this.rig.mode.pointerLock) {
          this.rig.setMode('tps');
          this.hud.setMode(this.rig.mode);
        }
        this.rig.look.yaw = 0;
        this.rig.look.pitch = -0.14;
        this.hangarScene?.startAimPractice();
        this.input.requestLock();
      },
      canAimPractice: () => !this.input.touchMode,
      stopAimPractice: () => {
        this.hangarScene?.stopAimPractice();
        const previous = this.savedPracticeLook;
        if (previous) {
          this.rig.setMode(previous.mode);
          this.rig.look.yaw = previous.yaw;
          this.rig.look.pitch = previous.pitch;
          this.hud.setMode(this.rig.mode);
          this.savedPracticeLook = null;
        }
        this.input.exitLock();
      },
    });
    new PilotLabels(this.hangar);
    new OnlineSwitch(this.online !== null, defaultServer(location.hostname, import.meta.env.VITE_GAME_SERVER) !== null, document.getElementById('cc-online-slot'));
    // A linha "SERVIDOR ONLINE · 2 PILOTOS EM COMBATE" na pausa: um GET a cada 20 s, só com a pausa à vista.
    // Só o servidor público do build ou o `&servidor=` do link (o motivo do `defaultServer` ficar fora: ServerStatus.ts).
    new ServerStatus(new URLSearchParams(location.search).get('servidor') || import.meta.env.VITE_GAME_SERVER, document.getElementById('menu-status'));
    new SettingsMenu(this.settings);
    // Seção "Inimigos": a contagem da partida em curso é a base do aviso de reiniciar.
    const esquadrao = this.squad.current && !online ? resumoDoEsquadrao(this.squad.current) : null;
    new EnemySettings(this.settings, { enemyMechs: foes.enemyMechs, enemyAndroids: foes.enemyAndroids, technician: foes.technician, names: foes.names }, undefined, undefined,
      esquadrao
        ? {
            resumo: `${esquadrao.inimigos} inimigo${esquadrao.inimigos === 1 ? '' : 's'} e ${esquadrao.aliados} aliado${esquadrao.aliados === 1 ? '' : 's'}`,
            voltarAoPadrao: () => {
              this.squad.save(null);
              reloadWithout(PARAM_DO_ESQUADRAO);
            },
          }
        : null);
    new PowerSettings(this.power);
    this.settings.onChange((s) => this.applySettings(s));
    // O aviso de abate (P96) e a abertura da rodada (3·2·1·COMBATE!) só avisam; o som é do AudioSystem e a voz, do navegador (um contexto de áudio só).
    this.hud.killBanner.som = (streak) => this.audio.playKillStreak(streak);
    const locucao = locucaoDoNavegador(() => this.audio.enabled, () => this.settings.value.volume);
    this.hud.roundOverlay.som = { contagem: () => this.audio.playCountdownBeep(false), combate: () => this.audio.playCountdownBeep(true) };
    this.hud.roundOverlay.falar = (texto) => void locucao.falar(texto);

    // O mapa (Arena ou Bunker) se escolhe no mapa-múndi do console; aqui fica só o modo.
    this.modeSelector.attachTo(document.getElementById('menu-mode'));
    this.modeSelector.onModeChange((mode) => {
      this.telemetry.enviar('modo_trocado');
      this.audio.playUiTransition();
      const url = new URL(location.href);
      if (mode === 'deathmatch') url.searchParams.delete('modo');
      else { url.searchParams.set('modo', mode); url.searchParams.delete('sala'); url.searchParams.delete('servidor'); }
      location.assign(url);
    });

    this.missionHud.onRetry = () => {
      this.triggerMissionBriefing();
    };
    this.missionHud.onExit = () => {
      this.missionHud.hide();
    };

    this.dailyChallenges.attachTo(document.getElementById('menu-profile'));

    // Console de comando (P86): a pausa vira a sala de comando. Os monitores só leem o jogo por estes callbacks (G3).
    const mapa = mapFromSearch(location.search, !!online, this.gameMode);
    const allies = (): readonly MechBase[] => this.match.allies?.mechs ?? [];
    // Janela do esquadrão (P91): offline, na Arena e no Bunker. Online o servidor manda os inimigos; as missões têm o pool delas.
    const esquadraoIndisponivel = (): string | null =>
      online ? 'Online, quem manda nos inimigos é o servidor.' : this.gameMode !== 'deathmatch' && this.gameMode !== 'dominio' ? 'O esquadrão vale no combate livre (Arena e Bunker) e no Domínio; as missões têm o pool delas.' : null;
    const squadPanel = new SquadPanel({
      store: this.squad,
      padrao: () => esquadraoDeFoes(this.settings.value, ALLY_COUNT),
      nomes: () => this.settings.value.names,
      dificuldade: () => this.settings.value.difficulty,
      mapa,
      indisponivel: esquadraoIndisponivel,
      abrirAjustes: () => document.getElementById('btn-settings')?.click(),
      reiniciar: () => reloadWithout(PARAM_DO_ESQUADRAO),
    });
    // Janela Campanha (fase 4B): offline apenas. Jogar uma etapa é abrir o jogo com o link dela; o esquadrão "meu" é o salvo no aparelho, não o do link da etapa.
    const campanhaIndisponivel = (): string | null => (online ? 'Online, quem manda nos inimigos é o servidor.' : null);
    const campanhaPanel = new CampaignPanel({
      store: this.campanhas,
      esquadraoMeu: () => new EsquadraoStore(browserStorage(), '').current,
      indisponivel: campanhaIndisponivel,
      jogar: (busca) => location.assign(location.pathname + busca),
      copiar: async (texto) => {
        try {
          await navigator.clipboard.writeText(texto);
          return true;
        } catch {
          return false;
        }
      },
      base: () => location.origin + location.pathname,
    });
    this.ligarCampanha(mapa, !!online);
    // Janela ARSENAL (fase 4C): só leitura, as fichas das armas e dos chassis; abre sempre (offline e online).
    const arsenal = new ArsenalPanel({ chassisDeBot: CHASSIS_DOS_BOTS });
    // Janela do servidor (P93): o endereço é o do jogo online (o público do build, ou o do próprio PC); sem ele, o item se apaga.
    const enderecoDoServidor = new URLSearchParams(location.search).get('servidor') || defaultServer(location.hostname, import.meta.env.VITE_GAME_SERVER);
    const tokenDoDono = new TokenDoDono(browserStorage(), enderecoDoServidor);
    const adminCliente = new AdminCliente(enderecoDoServidor, tokenDoDono.ler);
    const painelDoServidor = new ServerPanel({ cliente: adminCliente, token: tokenDoDono });
    // Câmeras ao vivo (P88): o mural de radares de todas as partidas do servidor, com o mesmo token do dono. O canal só existe com a janela aberta.
    let parede: CameraWall | null = null;
    const mural = new MuralCliente(enderecoDoServidor, tokenDoDono.ler, { estado: (e) => parede?.estado(e), quadro: (q) => parede?.quadro(q) });
    // As salas online são da Arena: se o jogo local está no Bunker, o mural não desenha as paredes de outro mapa por cima.
    const plantaOnline = mapa === 'arena' ? plantaDaArena(this.match.arena.occluders) : [];
    const naPraia = this.match.arena.praia !== null;
    this.minimapa.setPlanta(naPraia ? plantaDaPraiaNoMinimapa() : plantaComZonas(mapa === 'bunker' ? plantaDoBunker() : plantaDaArena(this.match.arena.occluders), mapa === 'arena'));
    // Na praia a estação é o objetivo: o ponto E do minimapa aponta para ela de qualquer lugar do mapa (preso na borda quando longe).
    this.minimapa.setPontos(naPraia ? pontoDaEstacao() : this.match.dominio?.pontos ?? null);
    if (naPraia) {
      this.praiaHud = new PraiaHud(document.getElementById('hud')!);
      this.praiaQuadro = novoQuadroDaPraia(this.camera);
    }
    parede = new CameraWall({
      mural,
      planta: () => plantaOnline,
      meia: mapa === 'arena' ? this.match.arena.halfSize : 100,
      nomes: adminCliente,
      abrirServidor: () => void painelDoServidor.abrir(),
    });
    const cmd = new CommandConsole({
      mapa,
      modo: this.gameMode,
      online: !!online,
      montagem: () => this.hangar.current,
      partes: () => fracoesDasPartes(this.mech),
      escalacao: () => escalacaoDaPartida(this.bots, this.match.allies),
      dificuldade: () => this.settings.value.difficulty,
      potencias: () => this.power.changes,
      som: () => this.audio.playUiTransition(),
      esquadrao: { abrir: () => void squadPanel.abrir(), indisponivel: esquadraoIndisponivel, personalizado: () => this.squad.custom },
      campanha: { abrir: () => void campanhaPanel.abrir(), indisponivel: campanhaIndisponivel },
      arsenal: { abrir: () => void arsenal.abrir() },
      servidor: { abrir: () => void painelDoServidor.abrir(), indisponivel: () => (enderecoDoServidor ? null : 'Este build não sabe onde está o servidor de jogo.') },
      cameras: { abrir: () => void parede?.abrir(), indisponivel: () => (mural.temServidor ? null : 'Este build não sabe onde está o servidor de jogo.') },
      radar: fonteDoRadar(mapa, this.match.arena.halfSize, this.match.arena.occluders, () => this.mech, () => this.bots.mechs, allies),
    });
    this.settings.onChange(() => cmd.atualizar());
  }

  /** A faixa da etapa e o painel do fim, se esta partida é uma etapa de campanha (fase 4B). Os avisos de abate e de fim vêm dos callbacks do `Match` (abaixo). */
  private ligarCampanha(mapa: MapId, online: boolean): void {
    const run = EtapaEmCurso.doLink(location.search, mapa, this.gameMode, online);
    if (!run) return;
    this.campanha = run;
    this.campanhaHud = new CampaignRunHud(run, {
      ir: (acao) => location.assign(location.pathname + linkDaEtapa(run.campanha, acao === 'proxima' ? (run.proxima ?? run.n) : run.n)),
      // Sair volta ao combate livre de sempre: some o que o link da etapa trouxe (modo, mapa, esquadrão, campanha); o esquadrão salvo do Comandante volta a valer.
      sair: () => {
        const url = new URL(location.href);
        for (const p of ['modo', 'mapa', 'esquadrao', PARAM_DA_CAMPANHA, PARAM_DA_ETAPA]) url.searchParams.delete(p);
        location.assign(url);
      },
    });
  }

  /** Um abate do jogador em robô inimigo conta para a meta da etapa (Deathmatch); ao bater a meta, a etapa acaba. */
  private abateNaCampanha(): void {
    if (!this.campanha) return;
    const antes = this.campanha.resultado;
    const depois = this.campanha.abate();
    this.campanhaHud?.atualizar();
    if (antes === 'em-curso' && depois !== 'em-curso') this.fimDaEtapa();
  }

  /** A etapa decidida: o painel do fim, e o jogo para como em qualquer fim de partida. */
  private fimDaEtapa(): void {
    this.campanhaHud?.fim();
    this.setPlaying(false);
    this.input.exitLock();
  }

  /**
   * O robô de outro participante da sala online: os bots com as cores de sempre; outra pessoa, com o chassi da
   * montagem dela e visor ciano (verde é você; vermelho, as IAs).
   */
  private makeRemote(e: RosterEntry): MechBase {
    if (e.kind === 'mech') return new Vector09({ paint: PALETTE.enemyPaint, visor: PALETTE.signal });
    if (e.kind === 'android') return new Android();
    if (e.kind === 'technician') return new Android({ visor: PALETTE.fluo, tool: 'repair' });
    const spec = parseLoadoutKey(e.build);
    if (spec?.chassis === 'android') return new Android({ stats: PILOT_ANDROID_STATS, paint: PALETTE.playerPaint, visor: PALETTE.cyan, tool: 'pilot' });
    // O Vector-09 de outro jogador leva as armas da montagem dele (só desenho): sem isso toda arma nova aparecia como o plasma de fábrica.
    const check = spec?.chassis === 'vector09' ? validateLoadout(spec) : null;
    return new Vector09(check?.ok ? { visor: PALETTE.cyan, loadout: check.loadout } : { visor: PALETTE.cyan });
  }

  /** Linha de status do online, no topo: sala, ping e pessoas; ou o motivo da recusa ou da queda. */
  /**
   * LED do Prédio Serafim (só desenho): vermelho pulsando quando um Mech inimigo chega a 40 m da base, verde com tudo em
   * ordem. Confere a 4 Hz; o pulso em si é uma troca de cor por quadro.
   */
  private updateSerafimTower(dt: number): void {
    const tower = this.match.arena.serafim;
    if (!tower) return;
    this.serafimCheck -= dt;
    if (this.serafimCheck <= 0) {
      this.serafimCheck = 0.25;
      let danger = false;
      for (const bot of this.bots.mechs) {
        if (!bot.alive) continue;
        const dx = bot.simPosition.x - SERAFIM_TOWER.x;
        const dz = bot.simPosition.z - SERAFIM_TOWER.z;
        if (dx * dx + dz * dz < 40 * 40) { danger = true; break; }
      }
      tower.setMode(danger ? 'emergencia' : this.serafimParty ? 'festa' : 'ok');
    }
    tower.update(dt);
  }

  private showNet(s: OnlineStatus): void {
    if (s.state === 'conectando') {
      this.lobby.setConnecting(true, `CONECTANDO À SALA ${s.room}…`);
    } else if (s.state === 'na sala') {
      this.lobby.hide();
    } else if (s.state === 'recusado') {
      this.lobby.setConnecting(true, `RECUSADO: ${s.reason || 'erro'}`);
    } else {
      this.lobby.setConnecting(true, 'CONEXÃO CAIU');
    }

    const text =
      s.state === 'na sala'
        ? `ONLINE · SALA ${s.room} · ${s.rttMs} ms · ${s.players} piloto${s.players === 1 ? '' : 's'}`
        : s.state === 'conectando'
          ? `ONLINE · CONECTANDO À SALA ${s.room}…`
          : s.state === 'recusado'
            ? `ONLINE · RECUSADO (${s.reason === 'cheia' ? 'sala cheia' : s.reason === 'versao' ? 'versão diferente: recarregue' : s.reason === 'montagem' ? 'montagem inválida' : 'erro'})`
            : 'ONLINE · CONEXÃO CAIU: recarregue a página';
    this.netStatus.textContent = text;
    this.netStatus.classList.toggle('bad', s.state === 'recusado' || s.state === 'caiu');
    // Nem chegou a entrar (servidor desligado, PC do servidor fora do ar): avisa e volta ao jogo offline.
    if (s.state === 'caiu' && !this.online?.joined) {
      this.netStatus.textContent = 'SERVIDOR ONLINE FORA DO AR · voltando ao jogo offline…';
      setTimeout(() => reloadWithout('sala'), 3000);
    }
  }

  /** 1 perto do jogador, 0 a 70 m ou mais: o volume dos sons de um bot. */
  private nearness(m: MechBase): number {
    return Math.max(0, 1 - m.position.distanceTo(this.mech.position) / 70);
  }

  /** Montagem nova do Hangar entra no renascimento: armas trocadas, carregador cheio, Mech frio. */
  private equipPending(keepHeat = false): void {
    const loadout = this.hangar.takePending();
    if (!loadout) return;
    this.playTelemetry.finish('abandoned');
    this.activeBuild = this.hangar.key;
    this.mech.equip(poweredLoadout(loadout, this.power.current, 'player'), keepHeat);
    this.player.rearm();
    this.hud.setPrimaryLabel(primaryLabel(this.mech.loadout));
    this.hud.setSecondaryLabel(secondaryLabel(this.mech.loadout));
  }

  /**
   * "Aplicar montagem" no Hangar (mesmo chassi): offline, as armas trocam na hora, com o calor de agora. Online, o
   * servidor só conhece a montagem da entrada na sala: vale na próxima entrada. Devolve o aviso para a tela.
   */
  private applyHangarNow(): string {
    if (this.online) return 'Montagem salva · no online, vale ao entrar de novo na sala.';
    this.equipPending(true);
    return 'Montagem aplicada: as armas já estão no Mech.';
  }

  /** O galpão ocupa a tela; no computador, o painel da direita é mais largo que o da esquerda: o Mech vai um pouco para a esquerda, no meio do vão. */
  private resizeHangar(): void {
    const w = window.innerWidth;
    // Computador: painel da esquerda estreito e console da direita largo; celular: painéis embaixo, Mech no centro.
    const h = window.innerHeight;
    // Celular deitado: o painel ocupa a metade da direita e o Mech vai para a esquerda.
    this.hangarScene?.resize(w, h, h <= 540 && w > h ? 0.48 : w > 900 ? 0.12 : 0);
  }

  /** Rodada nova: a partida já pôs todos de volta e restaurou a arena; aqui, o que é do jogador local. */
  private startRound(): void {
    this.hud.roundOverlay.combate(this.round.number);
    this.sequencia.zerar();
    this.equipPending();
    this.player.launcher.refill();
    this.hud.setScore(0, 0);
    this.onboarding.trigger('walk');
  }

  /** O composer guarda o próprio pixelRatio (render targets): os dois mudam juntos. */
  private setPixelRatio(ratio: number): void {
    this.renderer.setPixelRatio(ratio);
    this.composer.setPixelRatio(ratio);
  }

  /** Aplica as configurações do jogador: na largada e a cada mudança na tela de configurações. */
  private applySettings(s: Readonly<GameSettings>): void {
    this.rig.sensitivity = radiansPerCount(s.sensitivity);
    this.input.rawInput = s.rawInput;
    this.rig.invertY = s.invertY;
    this.rig.fovOffset = s.fovOffset;
    const mira = document.getElementById('crosshair');
    mira?.style.setProperty('--reticle-scale', String(s.reticleSize));
    mira?.style.setProperty('--reticle-opacity', String(s.reticleOpacity));
    this.bloomPass.strength = s.glow;
    this.player.keys = s.keys;
    this.bots.setSkill(BOT_SKILLS[s.difficulty]);
    // A personalidade de cada Mech vem do esquadrão quando há um personalizado; senão, das configurações.
    if (!this.squad.custom) this.bots.setPersonas(s.enemyPersonas);
    if (!this.match.waves || this.match.waves.phase !== 'active') this.bots.maxAttackers = s.maxAttackers;
    this.debugPanel.setVisible(s.showPerf);
    this.audio.setVolume(s.volume);
    if (s.quality !== this.appliedQuality && !this.recorder.gravando) {
      this.appliedQuality = s.quality;
      this.aplicarQualidade(s.quality);
    }
  }

  /** 'auto' começa no máximo e deixa a qualidade adaptativa rebaixar (G12); os outros fixam. Extraído de
   * `applySettings` para o "modo captura" da gravação (dono, 28/09) reusar ao restaurar depois do F9. */
  private aplicarQualidade(quality: GameSettings['quality']): void {
    this.setPixelRatio(quality === 'media' ? 1 : quality === 'baixa' ? 0.75 : maxPixelRatio());
    this.bloomPass.enabled = quality !== 'baixa';
    this.refractWaves = quality !== 'baixa';
    this.match.arena.praia?.setDetalhe(quality !== 'baixa');
    this.quality.setAdaptive(quality === 'auto');
  }

  /**
   * Compila de uma vez, no carregamento, os programas de shader de tudo o que a cena já tem (`core/ShaderWarmup.ts`): sem
   * isso cada programa novo congelava o jogo ~1,5 s no primeiro uso em partida (primeiros tiros, primeira morte).
   * Enquanto compila, o botão avisa e o clique é ignorado; ao fim volta ao texto que o HUD tinha posto.
   */
  private async precompileShaders(): Promise<void> {
    const cta = document.getElementById('cta');
    const overlay = document.getElementById('overlay');
    const text = cta?.textContent ?? null;
    if (cta) cta.textContent = '[ preparando gráficos... ]';
    if (overlay) overlay.style.pointerEvents = 'none';
    try {
      const deadline = Date.now() + WARMUP_TIMEOUT_MS;
      const result = await warmUpShaders(this.renderer, this.composer.readBuffer, this.scene, this.camera, (done, total) => {
        if (cta) cta.textContent = `[ preparando gráficos ${done}/${total} ]`;
        bootProgresso('graficos', done, total);
      });
      if (result !== 'ok') console.warn(`pré-compilação dos shaders: ${result} (o jogo segue; os programas compilam no primeiro uso)`);
      // O galpão tem outras luzes e materiais: aquecer só a Arena não prepara a primeira abertura.
      // Reutiliza a montagem já carregada; os outros chassis continuam sob demanda, sem baixar assets novos aqui.
      const remainingMs = deadline - Date.now();
      if (remainingMs > 0) {
        this.hangarScene ??= new HangarScene();
        this.hangarScene.show(this.hangar.current.chassis, this.hangar.equipped);
        this.resizeHangar();
        const hangarResult = await warmUpShaders(this.renderer, this.composer.readBuffer, this.hangarScene.scene, this.hangarScene.camera, (done, total) => {
          if (cta) cta.textContent = `[ preparando Hangar ${done}/${total} ]`;
          bootProgresso('hangar', done, total);
        }, Math.max(0, deadline - Date.now()));
        if (hangarResult !== 'ok') console.warn(`pré-compilação do Hangar: ${hangarResult} (o jogo segue)`);
        else warmUpSceneResources(this.renderer, this.composer.readBuffer, this.hangarScene.scene, this.hangarScene.camera);
      } else {
        console.warn('pré-compilação do Hangar: prazo esgotado na Arena (preparação fica para o primeiro uso)');
      }
    } catch (err: unknown) {
      // Falha na preparação do galpão não impede entrar na Arena; a abertura mantém o fallback existente.
      console.warn('pré-compilação do Hangar: erro (o jogo segue)', err);
    } finally {
      if (cta && text !== null) cta.textContent = text;
      if (overlay) overlay.style.pointerEvents = '';
    }
  }

  start(): void {
    this.renderer.setAnimationLoop((now: number) => this.frame(now));
  }

  /** Instala depois do boot: não antecipa downloads nem retém uma segunda cena/modelo. */
  private configureHangarPreparation(): void {
    const hangar = this.hangarScene;
    if (!hangar || hangar.prepareModel) return;
    hangar.prepareModel = async (root) => {
      const result = await warmUpShaders(this.renderer, this.composer.readBuffer, root, hangar.camera, undefined, 5000, hangar.scene);
      if (result !== 'ok') console.warn(`Hangar: preparação do modelo ${result} (segue no primeiro uso)`);
      return result === 'ok';
    };
  }

  private wireEvents(): void {
    const { input, rig, mech } = this;

    mech.onLand = (speed) => {
      rig.addShake(THREE.MathUtils.clamp((speed - 12) / 30, 0.1, 0.6));
      this.particles.burst(mech.position, UP, { count: 30, color: DUST_COLOR, speed: 12, life: 0.7, spread: 2.5, gravity: 4 });
      // Som de pouso: intensidade proporcional à velocidade de impacto (12..40 m/s → 0..1)
      this.audio.playLand(THREE.MathUtils.clamp((speed - 12) / 28, 0, 1));
    };
    // Passos (dono: "os Mechs rápidos demais para o peso"): o som de passo do Gemini passa a tocar.
    // O Mech do jogador pisa com um tremor leve; os Mechs rebeldes pisam mais baixo de longe, e um
    // gigante perto de um pequeno treme a câmera: de andróide, sente-se cada passo do Mech.
    mech.onFootstep = (w) => {
      if (mech instanceof Android) {
        this.audio.playAndroidStep(0.3 * w);
        return;
      }
      this.audio.playStep(w);
      rig.addShake(0.18 * w);
    };
    for (const b of this.bots.mechs) {
      if (b instanceof Android) continue;
      b.onFootstep = (w) => {
        const near = this.nearness(b);
        if (near <= 0) return;
        // Aliados e inimigos andam o tempo todo; reduz o volume para não soar como um eco estrondoso.
        this.audio.playStep(near * w * 0.4);
        const giant = THREE.MathUtils.clamp(b.stats.height / this.mech.stats.height - 1, 0, 1);
        const close = Math.max(0, 1 - b.position.distanceTo(this.mech.position) / GIANT_STEP_RANGE);
        if (giant > 0 && close > 0) rig.addShake(0.4 * giant * close * close * w);
      };
    }
    // Som de disparo: o controle do jogador avisa a cada tiro de energia (bots têm o som deles, acima).
    this.player.onShot = (w) => (w.id === 'arc' ? this.audio.playArcShot() : w.id === 'cryo' ? this.audio.playCryoShot() : w.id === 'cannon' ? this.audio.playCannonShot() : w.id === 'autocannon' ? this.audio.playAutocannonShot() : w.id === 'sonic' ? this.audio.playSonicShot() : this.audio.playShot());
    // Peso do tiro na câmera (`combat/fireFeel.ts`): o solavanco do trilho e do foguete, o zumbido do plasma.
    this.player.onKick = (amount) => rig.addShake(amount);
    this.player.onRocket = () => {
      this.audio.playRocketLaunch();
      this.onboarding.trigger('rockets');
    };
    this.match.onMechHit = (e) => {
      if (e.shooter === mech) {
        this.hud.showHit(e.result);
        this.dailyChallenges.trackDamage(e.result.applied);
        this.playTelemetry.hit(e.result.applied);
        // Confirmação auditiva de acerto (ouvida pelo jogador ao acertar)
        this.audio.playHit();
        // Número de dano flutuante (frente 2): nasce no corpo do alvo, sobe e some.
        if (e.mech !== mech) {
          _dmgPos.copy(e.mech.position);
          _dmgPos.y += e.mech.stats.height * 0.7;
          this.damageNumbers.show(this.camera, _dmgPos, e.result.applied, e.result.partDestroyed);
        }
      }
      if (e.mech === mech) {
        this.hud.showDamage();
        this.onboarding.trigger(e.shooter instanceof Android ? 'androids' : 'damage');
        this.vibrate(35);
        if (e.shooter) {
          this.damageIndicator.show(mech.position, e.shooter.position, rig.look.yaw);
        }
        rig.addShake(0.12);
      }
      // Motosserra (andróide colado em alguém) e pisão: sons próprios, mais baixos de longe.
      if (e.kind === 'melee' && e.shooter) this.audio.playChainsaw(this.nearness(e.shooter));
      if (e.kind === 'crush') this.audio.playPartDestroyed();
      // Parte destruída → estalo metálico
      if (e.result.partDestroyed) this.audio.playPartDestroyed();
    };
    this.match.onMechKilled = (dead, at, killer) => {
      const falloff = 1 - at.distanceTo(mech.position) / 70;
      if (falloff > 0) rig.addShake(0.7 * falloff);
      this.audio.playExplosion(1 - Math.max(0, falloff));
      const me = this.round.scoreOf(mech);
      this.hud.setScore(me?.kills ?? 0, me?.deaths ?? 0);

      if (killer === mech && dead !== mech) {
        this.dailyChallenges.trackKill(dead instanceof Android ? 'android' : 'mech');
        this.playTelemetry.kill();
      }

      if (dead === mech) this.playTelemetry.death();
      const deadName = dead === mech ? 'VOCÊ' : this.round.scoreOf(dead)?.name ?? 'INIMIGO';
      const killerName = killer ? (killer === mech ? 'VOCÊ' : this.round.scoreOf(killer)?.name ?? null) : null;
      const isPlayerInvolved = dead === mech || killer === mech;
      this.killFeed.push(killerName, deadName, isPlayerInvolved);
      // Aviso de abate e de sequência (P96): abater aliado (fogo amigo) não conta; morrer zera.
      if (dead === mech) this.sequencia.zerar();
      else if (killer === mech && !(this.match.allies?.mechs ?? []).includes(dead)) this.hud.killBanner.showKill(deadName, this.sequencia.abate(performance.now() / 1000));
      if (!this.online && dead === mech && killer && killer !== mech) {
        this.killCam.start(killer, at);
        // Painel "seu algoz" (frente 3 da P109): a ficha do matador enquanto o contador corre.
        this.algoz.show(algozViewOf(killer, killerName ?? 'INIMIGO'));
      }
      if (killer === mech && dead !== mech) this.vibrate([25, 40, 25]);
      // Abater um aliado (fogo amigo) não conta para a meta da etapa.
      if (killer === mech && dead !== mech && !(this.match.allies?.mechs ?? []).includes(dead)) this.abateNaCampanha();
    };
    // Rádio do clã: o primeiro contato de um bot (inimigo ou aliado) aparece no feed, sem mudar a regra.
    this.match.onRadio = (from, target) => {
      if (this.online) return;
      const name = target === mech ? 'VOCÊ' : this.round.scoreOf(target)?.name ?? 'ALVO';
      this.killFeed.push(`◈ ${from}: CONTATO`, name, false);
    };
    // Foguete: o dano em área já foi aplicado pela partida; aqui, fogo, fumaça, tremor e som.
    this.match.onExplosion = (at) => {
      this.particles.burst(at, UP, { count: 70, color: BLAST_COLOR, speed: 18, life: 0.75, size: 2.2, expansion: 0.9, spread: 2.4, gravity: 2 });
      this.particles.burst(at, UP, { count: 24, color: SMOKE_COLOR, speed: 4, life: 1.4, size: 2.7, expansion: 1.2, spread: 1.6, gravity: -1.5 });
      const dist = at.distanceTo(mech.position);
      if (dist < 40) rig.addShake(0.5 * (1 - dist / 40));
      this.audio.playExplosion(dist);
    };
    this.match.onRoundStart = () => {
      this.telemetry.enviar('partida_iniciada');
      this.startRound();
    };
    this.match.onWaveStart = (wave, total, _mechs, _androids, title, waves) => {
      this.hud.setMissionWave(wave, total, title, waves);
      this.audio.playAmbientBram();
    };
    this.match.onWaveProgress = (wave, killed, total, elapsedS) => this.hud.setMissionProgress(wave, killed, total, elapsedS);
    this.match.onWaveClear = (wave, elapsedS) => this.hud.showMissionClear(wave, elapsedS);
    this.match.onMissionEnd = (survived, waveReached, stats) => {
      this.telemetry.enviar('partida_terminada');
      this.playTelemetry.finish('completed');
      this.missionEnded = true;
      this.hud.setMissionEnd(survived, waveReached, stats.kills, stats.survivalSeconds, this.match.nucleo?.caiu === true);
      this.setPlaying(false);
      this.input.exitLock();
      if (this.campanha) {
        this.campanha.fimDaSobrevivencia(survived);
        this.campanhaHud?.fim();
      }
    };
    this.match.onCtfFlag = (event, owner) => {
      const flag = owner === 'blue' ? 'AZUL' : 'VERMELHA';
      const action = event === 'pickup' ? 'TOMADA' : event === 'drop' ? 'DERRUBADA' : 'DEVOLVIDA';
      this.hud.showCtfEvent(`BANDEIRA ${flag} ${action}`);
    };
    this.match.onCtfCapture = (team, blue, red) => {
      this.ctfObjectives?.flashCapture();
      this.hud.showCtfEvent(`${team === 'blue' ? 'AZUL' : 'VERMELHO'} CAPTUROU · ${blue} × ${red}`);
    };
    this.match.onCtfProgress = (timeLeft, blue, red) => this.hud.setCtfProgress(timeLeft, blue.captures, red.captures);
    this.match.onCtfEnd = (winner, blue, red) => {
      this.telemetry.enviar('partida_terminada');
      this.playTelemetry.finish('completed');
      this.missionEnded = true;
      this.hud.setCtfEnd(winner, blue.captures, red.captures, blue.kills, red.kills);
      this.setPlaying(false);
      this.input.exitLock();
      if (this.campanha) {
        this.campanha.fimDaBandeira(winner);
        this.campanhaHud?.fim();
      }
    };
    // Domínio: a barra de pontos, o aviso de cada ponto que muda de dono e o fim da partida (a regra é do `Match`; aqui só a tela).
    this.match.onDominioProgresso = (tempo, azul, vermelho) => this.dominioHud.quadro(this.match.dominio!.pontos, tempo, azul, vermelho);
    this.match.onDominioDono = (ponto, antes, depois) => this.dominioHud.avisar(avisoDoPonto(ponto.def.letra, antes, depois));
    this.match.onDominioFim = (vencedor, azul, vermelho) => {
      this.telemetry.enviar('partida_terminada');
      this.playTelemetry.finish('completed');
      this.missionEnded = true;
      this.hud.setDominioEnd(vencedor, Math.floor(azul.pontos), Math.floor(vermelho.pontos));
      this.setPlaying(false);
      this.input.exitLock();
    };
    this.match.onPropBroken = (_id, center) => {
      const falloff = 1 - center.distanceTo(mech.position) / 60;
      if (falloff > 0) rig.addShake(0.55 * falloff);
    };
    // Um coqueiro ou guarda-sol que cai treme a câmera bem menos que uma barricada, e só de perto.
    this.match.onAlvoQuebrado = (center, peso) => {
      const falloff = 1 - center.distanceTo(mech.position) / 40;
      if (falloff > 0) rig.addShake(0.55 * peso * falloff);
    };

    const overlay = document.getElementById('overlay')!;
    // pointerdown vem antes do click: o jeito de entrar (dedo ou mouse) escolhe o modo.
    overlay.addEventListener('pointerdown', (e) => this.setTouchMode(e.pointerType !== 'mouse'));
    overlay.addEventListener('click', () => this.resume());
    // Ajustar controles (só no toque): esconde a pausa e abre o editor de botões com o mundo parado.
    document.getElementById('btn-touch-layout')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hud.setPaused(false);
      this.touch.startEditing();
    });
    // Trocou de app ou de aba no meio da partida: pausa (no desktop o Pointer Lock já cai sozinho).
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.playing) this.pause();
    });
    // Resume do AudioContext na primeira interação (exigência dos navegadores)
    document.getElementById('overlay')!.addEventListener('click', () => this.audio.resume(), { once: true });
    input.onLockChange = (locked) => {
      if (this.hangarMenu?.isAimTraining) {
        if (!locked) this.hangarMenu.endAimPractice(false);
        return;
      }
      if (locked) this.startPlaying();
      else if (rig.mode.pointerLock) this.setPlaying(false);
    };
    input.onWheel = (dy) => this.playing && rig.onWheel(dy);
    input.onKey = (code) => {
      if (this.bankTerminal.isOpen) return;
      // ' abre o painel de desempenho detalhado. O jogo lê a posição física da tecla (e.code,
      // com nomes do teclado americano): no ABNT2 o ' fica em 'Backquote'; no US e no
      // US-Internacional, em 'Quote'. Aceitar as duas cobre os dois teclados.
      if (code === 'Backquote' || code === 'Quote') {
        this.debugPanel.toggleDetailed();
        return;
      }
      if (code === 'F1') {
        this.hud.toggleVisibility();
        return;
      }
      // Gravação nativa (dono, 28/09): de propósito fora do keys-help da tela inicial — é para uso interno.
      // "Modo captura": trava a resolução no teto de qualidade "alta" (`maxPixelRatio()`, ≤1.5) e desliga o
      // rebaixamento automático (G12) enquanto grava — sem isso, a própria gravação derruba o FPS, e a
      // qualidade adaptativa reage baixando a resolução no meio do take (o problema que o dono já tinha
      // descrito do OBS, mas causado pelo jogo). Forçar acima desse teto (era `Math.max(2, devicePixelRatio)`,
      // até 3x+ em telas de alta densidade) foi o que causava o soluço e o vídeo com quadros perdidos
      // relatado pelo dono em 29/09 — o próprio WebGL não aguentava o pixel count somado ao encode do
      // MediaRecorder rodando ao vivo.
      if (code === 'F9') {
        const iniciando = !this.recorder.gravando;
        if (iniciando) {
          this.quality.setAdaptive(false);
          this.setPixelRatio(maxPixelRatio());
        }
        this.recorder.alternar();
        if (!iniciando) this.aplicarQualidade(this.settings.value.quality);
        return;
      }
      if (code === 'KeyM' || code === 'KeyB') {
        this.triggerMissionBriefing();
        return;
      }
      if (this.spectatorCam.isSpectating) {
        if (code === 'ArrowLeft' || code === 'KeyQ') {
          this.spectatorCam.prevTarget();
          return;
        }
        if (code === 'ArrowRight' || code === 'KeyE') {
          this.spectatorCam.nextTarget();
          return;
        }
        if (code === 'KeyC' || code === 'KeyV' || code === 'Space' || code === 'Escape') {
          this.spectatorCam.release();
          this.spectatorHud.setVisible(false);
          this.btnCftv?.classList.remove('active');
          return;
        }
      }
      if (code === 'KeyC') {
        this.toggleSpectatorCam();
        return;
      }
      if (!this.playing) return;
      if (!Object.values(this.settings.value.keys).includes(code)) {
        if (this.gameMode !== 'dominio') {
          if (code === 'Digit1') this.squadHUD.command('follow');
          if (code === 'Digit2') this.squadHUD.command('focus');
          if (code === 'Digit3') this.squadHUD.command('hold');
        }
      }
      if (code === this.settings.value.keys.camera) this.switchCamera();
      else if (code === 'Escape' && !rig.mode.pointerLock) this.setPlaying(false);
    };
  }

  /** Abre o briefing do modo sobrevivência com alarme tático e dados de exemplo. */
  triggerMissionBriefing(): void {
    this.audio.playWaveSiren();
    this.missionHud.showBriefing(
      {
        wave: 1,
        title: 'DEFESA DO PROTOCOLO SERAFIM',
        threats: [
          'Detector de movimento indicando aproximação de horda.',
          'Andróides insurgentes classe V-09 detectados no setor 4.',
          'Objetivo: Eliminar todas as unidades hostis e manter integridade.',
        ],
        autoStartSecs: 10,
      },
      () => {
        // Briefing demonstrativo não conta como partida real.
        this.hud.setPaused(false);
        this.missionHud.showWaveHud(1, 10);
      }
    );
  }

  private acceptBank(reply: BankReply): void {
    const reward = reply.status === "ok" ? bankReward(reply.code) : undefined;
    if (reward) {
      this.playTelemetry.cheat();
      if (reward.credits) this.dailyChallenges.addCredits(reward.credits);
      if (this.online && reward.seconds) { this.bankOnlineBoost = reward.seconds; this.bankOnlineMultiplier = reward.damage; }
    }
    this.bankTerminal.reply(reply);
  }

  private resume(): void {
    if (this.missionEnded) {
      this.missionEnded = false;
      this.match.restartMission();
      this.praiaHud?.reset();
      this.player.launcher.refill();
      this.hud.setScore(0, 0);
      if (this.gameMode === 'ctf') this.hud.resetCtf();
      else if (this.gameMode === 'dominio') this.hud.resetDominio();
      else this.hud.resetMission();
    }
    // Primeira partida da sessão: vinheta da marca (o clique é o gesto que libera o som). O mouse já
    // fica preso agora (o Pointer Lock só pode ser pedido dentro do clique); o mundo espera a vinheta.
    if (!this.brandShown) {
      this.brandShown = true;
      this.audio.resume();
      this.hud.setPaused(false);
      this.splash.play(() => this.audio.playLogoSerafim(), () => this.afterBrand());
    }
    if (this.input.touchMode) {
      this.enterFullscreen();
      this.input.requestLock(); // no toque: marca "jogando" e dispara onLockChange(true)
    } else if (this.rig.mode.pointerLock) this.input.requestLock();
    else this.startPlaying();
  }

  /** Começa a partida, a não ser que a vinheta ainda esteja na tela (ela chama afterBrand no fim). */
  private startPlaying(): void {
    if (!this.splash.running) this.setPlaying(true);
  }

  /** Fim da vinheta: entra na partida se o mouse ainda estiver preso (ou no toque); senão, volta à pausa. */
  private afterBrand(): void {
    if (this.input.locked || !this.rig.mode.pointerLock) this.setPlaying(true);
    else this.hud.setPaused(true);
  }

  /**
   * Depois do rig: mira que acende sobre um inimigo (toque e mouse); no toque, mira assistida (puxão
   * leve enquanto o jogador age) e tiro automático. O puxão entra no olhar do próximo quadro.
   */
  private updateAim(dt: number): void {
    const s = this.settings.value;
    const touch = this.input.touchMode && this.playing;
    const engaged = this.input.virtualMoveX !== 0 || this.input.virtualMoveZ !== 0 || this.touch.aiming || this.input.virtualFire;
    let aimed: MechBase | undefined;
    if (!this.playing || this.spectatorCam.isSpectating) {
      this.assist.reset();
      this.targetPanel.update(dt, null);
      this.hud.setOnTarget(false);
      return;
    }
    const target = this.combat.mechOf(this.rig.aim.target);
      aimed = target;
      const pull = this.assist.update(dt, this.camera, this.rig.look, target, touch && s.touchAimAssist, engaged);
      this.rig.nudge(pull.yaw, pull.pitch);
      // Mira no ponto antecipado: o tiro vai até a distância do alvo, não até a parede atrás dele.
      if (this.assist.aimDist > 0) {
        this.camera.getWorldDirection(_aimDir);
        this.rig.aim.point.copy(this.camera.getWorldPosition(_aimFrom)).addScaledVector(_aimDir, this.assist.aimDist);
      }
    // O painel do alvo mostra o que já vem no estado — partes, calor e bandeiras — sem custo de rede.
    this.targetPanel.update(dt, this.playing && this.mech.alive ? (aimed ?? null) : null);
    this.input.autoFire = touch && s.touchAutoFire && this.assist.fireReady;
    this.hud.setOnTarget(this.assist.onTarget);
    if (this.assist.onTarget) this.onboarding.trigger('aim');
  }

  /** Vibração curta no toque (Android; onde não existe, não faz nada). */
  private vibrate(pattern: number | number[]): void {
    if (this.input.touchMode) navigator.vibrate?.(pattern);
  }

  private pause(): void {
    if (this.input.touchMode) this.input.exitLock();
    this.setPlaying(false);
  }

  /** Modo toque: controles na tela, sem Pointer Lock, sem a câmera tática (ela mira pelo cursor). */
  private setTouchMode(on: boolean): void {
    this.input.touchMode = on;
    document.documentElement.classList.toggle('touch', on);
    if (on && !this.rig.mode.pointerLock) {
      this.rig.setMode('tps');
      this.hud.setMode(this.rig.mode);
      this.touch.setCameraLabel('CAM 3ª');
    }
  }

  /**
   * Tela cheia deitada no celular: some a barra do navegador e sobra tela para os polegares. Só vale
   * dentro de um gesto do jogador; onde o navegador não deixa (iPhone), o jogo segue como está.
   */
  private enterFullscreen(): void {
    const root = document.documentElement;
    if (document.fullscreenElement || !root.requestFullscreen) return;
    root
      .requestFullscreen({ navigationUI: 'hide' })
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
      .catch(() => {});
  }

  /** Chamado dentro do keydown ou do toque em CAM (gesto do usuário), exigência do Pointer Lock. */
  private switchCamera(): void {
    if (this.spectatorCam.active) {
      this.spectatorCam.release();
      this.spectatorHud.setVisible(false);
      this.btnCftv?.classList.remove('active');
      return;
    }
    if (this.killCam.active) {
      this.killCam.cancel();
      return;
    }
    const mode = this.rig.cycle(this.input.touchMode ? 'tactical' : undefined);
    if (mode.pointerLock && !this.input.locked) this.input.requestLock();
    else if (!mode.pointerLock && this.input.locked) this.input.exitLock();
    this.hud.setMode(mode);
    this.touch.setCameraLabel(mode.id === 'fps' ? 'CAM 1ª' : 'CAM 3ª');
    this.updateCursor();
  }

  /** Alterna entre visão do jogador e o modo de câmeras de vigilância/espectador. */
  private toggleSpectatorCam(): void {
    if (this.spectatorCam.isSpectating) {
      this.spectatorCam.release();
      this.spectatorHud.setVisible(false);
      this.btnCftv?.classList.remove('active');
    } else {
      if (this.killCam.active) this.killCam.cancel();
      this.spectatorCam.start(0);
      if (!this.spectatorCam.isSpectating) return; // nenhum alvo (mapa sem câmeras e sem drones nem Mechs vivos): nada de painel vazio
      this.spectatorHud.setVisible(true);
      this.spectatorHud.setLabel(this.spectatorCam.currentTargetLabel);
      this.btnCftv?.classList.add('active');
    }
  }

  private setPlaying(playing: boolean): void {
    // A primeira rodada abre com COMBATE! quando a partida começa de verdade (depois da vinheta); as seguintes abrem pelo `onRoundStart`.
    if (playing && !this.aberturaFeita && this.gameMode === 'deathmatch' && !this.online && this.round.playing) {
      this.aberturaFeita = true;
      this.hud.roundOverlay.combate(this.round.number);
    }
    if (!playing) this.hud.roundOverlay.parar();
    this.playing = playing;
    this.player.active = playing;
    this.hud.setPaused(!playing && !this.bankTerminal?.isOpen);
    this.touch.setVisible(playing && this.input.touchMode);
    this.updateCursor();
  }

  private updateCursor(): void {
    this.renderer.domElement.style.cursor = this.playing && !this.rig.mode.pointerLock ? 'none' : '';
  }

  private frame(now: number): void {
    // O timestamp do rAF pode ser anterior ao fim do setup; clamp evita dt negativo.
    const dt = this.last < 0 ? 0 : THREE.MathUtils.clamp((now - this.last) / 1000, 0, 0.1);
    const rawFrameMs = this.last < 0 ? 0 : now - this.last;
    if (this.playing && !this.hangarView && !document.hidden && this.round.playing) {runtimeDiagnostics.frame(rawFrameMs);this.playTelemetry.frame(rawFrameMs);}
    const wasRoundPlaying = this.round.playing;
    this.last = now;

    if (this.input.locked) {
      const m = this.input.consumeMouseDelta();
      // Toque com mira assistida: perto de um inimigo o dedo fica mais lento (fricção do quadro anterior).
      const f = this.input.touchMode && this.settings.value.touchAimAssist ? this.assist.friction : 1;
      const yaw0 = this.rig.look.yaw;
      const pitch0 = this.rig.look.pitch;
      this.rig.applyMouse(m.x * f, m.y * f);
      // Puxar a mira para longe do alvo solta a ajuda por um instante (não briga com o dedo).
      this.assist.noteLook(this.rig.look.yaw - yaw0, this.rig.look.pitch - pitch0);
    }
    if (this.online) this.bankOnlineBoost = this.mech.alive ? Math.max(0, this.bankOnlineBoost - dt) : 0;
    this.player.collect();

    // --- Simulação em passo fixo (pausado = mundo congelado: os bots não atacam no menu) ---
    if (this.playing) this.accumulator += dt;
    let steps = 0;
    const t0 = performance.now();
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      // A partida roda o controle do jogador, os bots, os tiros e a física; entre rodadas, só o relógio.
      this.match.step(FIXED_DT);
      this.bankTick++;
      this.accumulator -= FIXED_DT;
      steps++;
    }
    const tickMs = performance.now() - t0;
    if (wasRoundPlaying && !this.round.playing && !this.online) this.playTelemetry.finish('completed');
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    const alpha = this.accumulator / FIXED_DT;

    // --- Render ---
    this.mech.render(dt, alpha);
    this.bots.render(dt, alpha);
    this.match.allies?.render(dt, alpha);
    this.droneVisuals?.render(dt, alpha);
    if (this.match.ctf && this.ctfObjectives) this.ctfObjectives.update(dt, this.match.ctf);
    this.dominioPontos?.update(dt);
    // O mapa que anima (o mar da praia, P126): nos outros, o `Arena.update` não faz nada.
    this.match.arena.update(dt);
    this.dominioHud.update(dt);
    this.online?.render(dt, now);
    this.nameplates.update(dt, this.mech);
    if (this.mech.alive && this.killCam.overridesRig) this.killCam.release();
    if (this.spectatorCam.overridesRig) {
      this.spectatorCam.update(dt);
      this.spectatorHud.setVisible(true);
      this.spectatorHud.setLabel(this.spectatorCam.currentTargetLabel);
      this.btnCftv?.classList.add('active');
    } else {
      if (this.spectatorCam.active) this.spectatorCam.update(dt);
      this.spectatorHud.setVisible(false);
      this.btnCftv?.classList.remove('active');
      if (!this.killCam.overridesRig) this.rig.update(dt);
    }
    this.killCam.update(dt);
    if (this.hangarView) {
      const hs = this.hangarScene!;
      hs.update(dt);
      if (this.hangarMenu.isAimTraining) {
        hs.updateAimPractice(dt, this.rig.look.yaw, this.rig.look.pitch, this.input.mouseDown, this.aimPracticeWeapon!);
        this.hangarMenu.aimPracticeFrame(hs.aimPracticeTime, hs.aimPracticeShots, hs.aimPracticeHits, hs.aimPracticeAccuracy, hs.aimPracticeCharge);
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.hangarMenu.placeHotspots(hs.armScreen('rightArm', w, h, _hotRight) ? _hotRight : null, hs.armScreen('leftArm', w, h, _hotLeft) ? _hotLeft : null);
      this.hangarMenu.testFrame(hs.testProgress());
    }
    this.updateAim(dt);
    this.projectiles.render(alpha);
    this.rockets.render(alpha);
    this.barrage.render(alpha);
    this.debris.sync();

    const nowDashing = this.mech.isDashing;
    if (nowDashing) {
      const count = Math.ceil(dt * 240);
      for (const t of this.mech.thrusters) {
        this.particles.burst(t.getWorldPosition(_tmp), UP, { count, color: THRUSTER_COLOR, speed: 4, life: 0.35, spread: 0.7, gravity: -4 });
      }
    }
    // Detecta transição false→true do dash para tocar o som uma única vez por dash
    if (nowDashing && !this.wasDashing) this.audio.playDash();
    this.wasDashing = nowDashing;

    // Blind Mode: inicia/para o loop de chiado ao vivo
    const blind = this.mech.isBlind && this.mech.alive;
    if (blind && !this.blindGain) {
      this.blindGain = this.audio.playBlindLoop();
    } else if (!blind && this.blindGain) {
      this.audio.stopBlindLoop(this.blindGain);
      this.blindGain = null;
    }

    const squad = this.match.allies;
    let alliesAlive = 0;
    if (squad) for (const m of squad.mechs) if (m.alive) alliesAlive++;
    this.squadHUD.update(dt, !!squad && this.gameMode !== 'dominio' && this.playing && this.mech.alive && !this.hangarView, squad?.order ?? 'follow', alliesAlive, squad?.mechs.length ?? 0);
    this.shieldVisuals.begin();
    if (!this.hangarView) { this.shieldVisuals.update(this.mech); if(this.online?.joined)this.online.remotes.forEach(this.drawShield);else for(const bot of this.bots.mechs)this.shieldVisuals.update(bot); }
    this.shieldVisuals.end();
    this.shieldHUD.update(dt, this.mech, this.playing && !this.hangarView, this.settings.value.keys.shield);
    this.updateSerafimTower(dt);
    this.chargeVisuals.beginFrame(dt, this.playing && !this.hangarView);
    this.chargeVisuals.update(this.mech, false);
    this.damageVisuals.beginFrame(dt, this.playing && !this.hangarView);
    this.statusVisuals.beginFrame(dt, this.playing && !this.hangarView);
    this.flameVisuals.beginFrame(dt, this.playing && !this.hangarView);
    this.flameVisuals.update(this.mech);
    this.fireRingVisuals.beginFrame(dt, this.playing && !this.hangarView);
    this.fireRingVisuals.update(this.mech);
    this.damageVisuals.update(this.mech);
    if (this.online?.joined) {
      this.online.remotes.forEach(this.updateRemoteDamage);
    } else {
      // Fumaça, fogo e gelo por robô têm orçamento por pulso (G5): só dos que estão perto e, num esquadrão grande (P91), começando de um
      // robô diferente a cada quadro, para o orçamento alcançar todos com o tempo.
      const bots = this.bots.mechs;
      this.fxStart = bots.length > 0 ? (this.fxStart + 1) % bots.length : 0;
      for (let k = 0; k < bots.length; k++) {
        const bot = bots[(k + this.fxStart) % bots.length]!;
        if (bot.position.distanceToSquared(this.mech.position) > FX_RANGE * FX_RANGE) continue;
        this.damageVisuals.update(bot); this.statusVisuals.update(bot); this.flameVisuals.update(bot); this.fireRingVisuals.update(bot); this.chargeVisuals.update(bot);
      }
      const escolta = this.match.allies?.mechs;
      if (escolta && escolta.length > 0) {
        this.fxStartAllies = (this.fxStartAllies + 1) % escolta.length;
        for (let k = 0; k < escolta.length; k++) {
          const ally = escolta[(k + this.fxStartAllies) % escolta.length]!;
          if (ally.position.distanceToSquared(this.mech.position) > FX_RANGE * FX_RANGE) continue;
          this.damageVisuals.update(ally); this.statusVisuals.update(ally);
        }
      }
    }
    this.shadows.begin();
    if (!this.hangarView) {
      this.shadows.add(this.mech);
      if (this.online?.joined) this.online.remotes.forEach(this.addShadow);
      else {
        for (const bot of this.bots.mechs) this.shadows.add(bot);
        if (this.match.allies) for (const ally of this.match.allies.mechs) this.shadows.add(ally);
      }
    }
    this.shadows.end();
    this.particles.update(dt);

    const near = !!this.match.arena.serafim && this.mech.alive && nearBank(this.mech.simPosition);
    if (!near) this.bankNear = false;
    else if (this.playing && !this.hangarView && !this.bankNear && !this.killCam.overridesRig) {
      this.bankNear = true; this.pause(); this.input.exitLock();
      this.bankTerminal.open(this.dailyChallenges.credits, this.online !== null);
      this.hud.setPaused(false);
    }
    this.bankTerminal.updateBoost(this.mech.alive ? (this.online ? this.bankOnlineBoost : this.mech.combatBoost.secondsLeft) : 0, this.playing && !this.hangarView, this.online ? this.bankOnlineMultiplier : this.mech.combatBoost.damageMultiplier);
    this.hud.setRespawn(this.respawner.timeLeft(this.mech), this.killCam.active);
    if (this.mech.alive) this.algoz.hide();
    this.killFeed.update(dt);
    this.damageNumbers.update(dt);
    this.onboarding.update(dt);
    this.roundHud.update(dt, this.round, this.input.isDown('Tab') || this.input.virtualBoard);
    // Nos últimos 3 s do intervalo: RODADA N · 3 · 2 · 1 (só leitura do relógio da rodada; ninguém é segurado no lugar).
    if (this.playing && this.gameMode === 'deathmatch' && !this.round.playing) this.hud.roundOverlay.contar(this.round.timeLeft, this.round.number + 1);
    // Só o gatilho de carregador (foguetes) tem pips para esvaziar; serra e arma de energia ficam cheios.
    const noMagazine = this.mech.loadout.secondary?.kind !== 'ammo';
    this.hud.setRockets(noMagazine ? 4 : this.player.launcher.ammo, noMagazine ? 1 : this.player.launcher.reloadProgress, this.mech.canFireSecondary);
    // "RECARREGANDO" ao lado da mira: o carregador (foguetes) está vazio e enchendo (frente 2).
    this.hud.setReloading(!noMagazine && this.player.launcher.ammo === 0);
    this.hud.setHeat(this.mech.heat, this.mech.overheated, this.mech.coolingBoost);
    // Estados (choque, fogo, gelo) e rotação do cano: parado na pausa ou morto, o zumbido e os indicadores se calam.
    const ativo = this.playing && this.mech.alive && !this.hangarView;
    this.statusHud.update(this.mech.status, ativo);
    const giro = ativo ? this.player.spinLevel : 0;
    // O medidor em volta da mira serve às duas armas de fluxo: a rotação do cano da rotatória e o combustível do lança-chamas.
    this.hud.setSpin(Math.max(giro, ativo ? this.player.fuelLevel : 0));
    // Mira aberta (ordem P121): a mira cresce enquanto a arma não assentou — cada arma no seu tempo.
    this.hud.setAimOpen(ativo ? this.player.aimOpen : 0);
    this.audio.setRotarySpin(giro);
    this.audio.setFlame(ativo && this.mech.status.flaming);
    if (this.mech.heatState !== 'normal') this.onboarding.trigger('heat');
    this.offscreen.update(this.camera, this.bots, this.mech);
    this.touch.setOverheated(this.mech.overheated);
    // Minimapa (12 Hz): só com a partida em andamento, vivo e com a cabeça inteira (cego não vê o radar).
    this.minimapa.setVisivel(ativo && !this.mech.isBlind);
    if (this.minimapa.pronto(dt)) {
      let inimigos: readonly MechBase[] = this.bots.mechs;
      if (this.online?.joined) {
        this.remotos.length = 0;
        this.online.remotes.forEach(this.juntarRemoto);
        inimigos = this.remotos;
      }
      this.minimapa.desenhar(this.rig.look.yaw, this.mech, inimigos, this.match.allies?.mechs ?? SEM_ALIADOS);
    }
    if (this.praiaHud && this.praiaQuadro) {
      const q = this.praiaQuadro;
      q.ativo = ativo;
      q.eu.x = this.mech.simPosition.x;
      q.eu.z = this.mech.simPosition.z;
      q.eu.alive = this.mech.alive;
      q.inimigos = this.bots.mechs;
      this.match.estadoDaAgua(this.mech, q.agua);
      const rede = this.match.nucleo;
      q.nucleo.presente = rede !== null;
      if (rede) {
        q.nucleo.fracao = rede.fracao;
        q.nucleo.pressao = rede.pressao;
        this.match.arena.praia?.setNucleo(rede.fracao); // o centro de dados apaga as janelas conforme a rede cai
      }
      q.largura = window.innerWidth;
      q.altura = window.innerHeight;
      this.praiaHud.update(dt, q);
    }
    this.hud.update(dt, this.mech, this.input.mouseX, this.input.mouseY, this.player.firing, this.player.secondaryHeld, this.player.secondaryHeld && !this.player.firing ? this.player.secondaryCharge : this.player.primaryCharge);
    // A onda sônica: os anéis andam e leem a cópia do quadro (a cópia só roda enquanto há anel vivo, na arena ou no Hangar).
    this.waveRings.update(dt);
    this.heatHaze.enabled = this.refractWaves;
    this.heatHaze.update(dt);
    const hangarRings = this.hangarScene?.waveRings;
    this.frameCopy.setActive(this.refractWaves && (this.waveRings.active || this.heatHaze.active || (this.hangarView && !!hangarRings?.active)));
    const waveFrame = this.refractWaves ? this.frameCopy : null;
    this.waveRings.setFrame(waveFrame);
    this.heatHaze.setFrame(waveFrame);
    hangarRings?.setFrame(waveFrame);
    this.renderer.info.reset();
    this.composer.render(dt);
    this.recorder.capturarQuadro();

    // Atualiza medidor de FPS depois do render
    this.quality.update(dt);
    this.debugPanel.update(dt, tickMs, this.renderer.info, this.quality.currentTier, this.debris.count);
    
    this.input.endFrame();
  }

  private onResize(): void {
    this.minimapa.medir();
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    if (this.hangarView) this.resizeHangar();
  }
}
