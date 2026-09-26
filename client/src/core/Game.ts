import * as THREE from 'three';
import { GLOW } from './palette';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { CameraRig } from '../camera/CameraRig';
import type { CombatSystem } from '../combat/CombatSystem';
import type { ProjectileSystem } from '../combat/ProjectileSystem';
import type { RocketSystem } from '../combat/RocketSystem';
import { BOT_SKILLS } from '../combat/BotController';
import type { BotSystem } from '../combat/BotSystem';
import type { Respawner } from '../combat/Respawner';
import type { Round } from '../combat/Round';
import { Vector09 } from '../entities/Vector09';
import { Android } from '../entities/Android';
import type { MechBase } from '../entities/MechBase';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { AimAssist } from '../player/AimAssist';
import { PlayerController } from '../player/PlayerController';
import { DamageIndicator } from '../ui/DamageIndicator';
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
import { DebugPanel } from '../debug/DebugPanel';
import { TouchControls } from '../ui/TouchControls';
import { loadTouchLayout, saveTouchLayout } from '../ui/touchLayout';
import { AudioSystem } from '../audio/AudioSystem';
import { BrandSplash } from '../brand/BrandSplash';
import { Hangar } from '../hangar/Hangar';
import { PILOT_ANDROID_STATS, VECTOR09_STATS } from '../entities/chassis';
import { poweredLoadout, poweredStats } from '../tuning/power';
import { PowerStore } from '../tuning/PowerStore';
import { PALETTE } from './palette';
import { PilotSwitch } from '../ui/PilotSwitch';
import { PowerSettings } from '../ui/PowerSettings';
import { parseLoadoutKey } from '../hangar/loadout';
import { defaultServer, onlineConfig } from '../net/onlineConfig';
import { OnlineSwitch } from '../ui/OnlineSwitch';
import { reloadWithout } from './url';
import { OnlineSession, type OnlineStatus } from '../net/OnlineSession';
import { defaultPower } from '../tuning/power';
import type { RosterEntry } from '../../../shared/net/messages';
import { Match } from '../sim/Match';

/** Máximo de ticks por frame: se a máquina engasgar, o jogo desacelera em vez de travar. */
const MAX_STEPS_PER_FRAME = 4;
/** Até esta distância (m) o passo de um Mech gigante treme a câmera de quem é pequeno. */
const GIANT_STEP_RANGE = 25;
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
  /** A partida (sem tela): arena, bots, tiros, dano, rodadas. As partes abaixo são atalhos para ela. */
  private readonly match: Match;
  private readonly debris: DebrisSystem;
  private readonly destructibles: Destructibles;
  private readonly projectiles: ProjectileSystem;
  private readonly rockets: RocketSystem;
  private readonly combat: CombatSystem;
  private readonly bots: BotSystem;
  private readonly respawner: Respawner;
  private readonly round: Round;
  private readonly roundHud: RoundHud;
  private readonly mech: MechBase;
  private readonly rig: CameraRig;
  private readonly touch: TouchControls;
  private readonly assist: AimAssist;
  private readonly player: PlayerController;
  private readonly hud = new HUD();
  private readonly killFeed = new KillFeed();
  /** Jogo online (M4): a sessão com o servidor, ou null no jogo de sempre. */
  private readonly online: OnlineSession | null;
  private readonly netStatus = document.createElement('div');
  private readonly damageIndicator = new DamageIndicator();
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
  readonly hangar = new Hangar();
  /** Potências (painel do dono): as salvas no aparelho ou as de um link `?potencias=`. */
  readonly power = new PowerStore(browserStorage(), location.search);
  private appliedQuality: QualityPreset | null = null;

  private playing = false;
  private accumulator = 0;
  private last = -1;

  static async create(container: HTMLElement): Promise<Game> {
    const physics = await PhysicsWorld.create();
    return new Game(container, physics);
  }

  private constructor(
    container: HTMLElement,
    physics: PhysicsWorld,
  ) {
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
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.5, 0.9);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    window.addEventListener('resize', () => this.onResize());

    // --- A partida (a simulação única; quantos inimigos vêm das configurações e mudam ao reiniciar) ---
    this.scene.add(this.particles.points);
    // Online (M4): /jogar/?sala=CODIGO[&servidor=wss://…][&nome=Dan]. A partida local fica sem bots, sem dano e sem
    // rodada própria (quem decide é o servidor); o jogo prevê o seu Mech e desenha os outros.
    const publicServer = import.meta.env.VITE_GAME_SERVER;
    const net = onlineConfig(location.search, location.hostname, publicServer);
    const online = net && !('error' in net) ? net : null;
    const foes = online ? { ...this.settings.value, enemyMechs: 0, enemyAndroids: 0, technician: false } : this.settings.value;
    // Potências do painel (por arma e por clã): montadas uma vez, aqui; mudam ao reiniciar. Online, o padrão do servidor.
    const power = online ? defaultPower() : this.power.current;
    this.match = new Match({
      physics,
      scene: this.scene,
      particles: this.particles,
      foes,
      power,
      ...(online ? { damage: false, roundS: Number.POSITIVE_INFINITY } : {}),
    });
    ({ debris: this.debris, destructibles: this.destructibles, projectiles: this.projectiles, rockets: this.rockets } = this.match);
    ({ combat: this.combat, respawner: this.respawner, bots: this.bots, round: this.round } = this.match);
    // O piloto escolhe o chassi (Hangar): Vector-09 ou andróide, sempre nas cores do jogador.
    this.mech =
      this.hangar.current.chassis === 'android'
        ? new Android({ stats: poweredStats(PILOT_ANDROID_STATS, power, 'player'), paint: PALETTE.playerPaint, visor: PALETTE.green, tool: 'pilot', loadout: poweredLoadout(this.hangar.equipped, power, 'player') })
        : new Vector09({ stats: poweredStats(VECTOR09_STATS, power, 'player'), loadout: poweredLoadout(this.hangar.equipped, power, 'player') });
    this.match.addPlayer(this.mech, 'VOCÊ', 0, () => this.equipPending());
    // Online, quem faz renascer é o servidor.
    if (online) this.match.respawner.untrack(this.mech);
    this.nameplates = new Nameplates(this.scene, this.bots);
    // Sons dos andróides (Gemini): tiro e pouso, mais baixos quanto mais longe do jogador.
    for (const b of this.bots.mechs) {
      if (!(b instanceof Android)) continue;
      const fire = b.onFire.bind(b);
      b.onFire = () => {
        fire();
        this.audio.playAndroidShot(this.nearness(b));
      };
      b.onLand = () => this.audio.playAndroidStep(this.nearness(b));
    }
    this.roundHud = new RoundHud(this.mech);
    // Botão na tela de pausa; a calibração tem camada própria e não retoma o jogo.
    new MouseCalibration(this.settings, [
      document.getElementById('btn-settings')!,
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
    this.player = new PlayerController(this.mech, this.input, this.rig, this.projectiles, this.particles, this.rockets);
    this.match.pilots.push(this.player);
    this.player.melee = (w) => this.match.meleeNearest(this.mech, w);
    this.netStatus.className = 'net-status';
    if (online) {
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
        onKill: (killer, dead, mine) => this.killFeed.push(killer, dead, mine),
      });
      this.match.pilots.push(this.online);
      document.body.append(this.netStatus);
    } else {
      this.online = null;
      if (net && 'error' in net) {
        this.netStatus.textContent = `ONLINE: ${net.error} · jogando offline`;
        this.netStatus.classList.add('bad');
        document.body.append(this.netStatus);
      }
    }
    this.hud.setSecondaryLabel(this.mech.loadout.secondary?.kind === 'melee' ? 'MOTOSSERRA' : 'FOGUETES');
    this.assist = new AimAssist(physics, this.mech, this.bots.mechs);

    this.wireEvents();
    // Celular e tablet (toque é o ponteiro principal) começam no modo toque; o toque ou o clique
    // que inicia a partida confirma o modo (notebook com tela de toque continua no mouse).
    this.setTouchMode(matchMedia('(hover: none) and (pointer: coarse)').matches);
    this.hud.setMode(this.rig.mode);
    this.hud.setReady(this.input.touchMode);
    this.hud.setBuild(`CYBERMECH ${import.meta.env.VITE_BUILD ?? 'dev'} · © ${new Date().getFullYear()} SERAFIM WEB`);

    this.quality = new Quality(
      (ratio) => this.setPixelRatio(ratio),
      (enabled) => {
        this.bloomPass.enabled = enabled;
      },
    );
    new PilotSwitch(this.hangar);
    new OnlineSwitch(this.online !== null, defaultServer(location.hostname, import.meta.env.VITE_GAME_SERVER) !== null);
    new SettingsMenu(this.settings);
    // Seção "Inimigos": a contagem da partida em curso é a base do aviso de reiniciar.
    new EnemySettings(this.settings, { enemyMechs: foes.enemyMechs, enemyAndroids: foes.enemyAndroids, technician: foes.technician });
    new PowerSettings(this.power);
    this.settings.onChange((s) => this.applySettings(s));
  }

  /**
   * O robô de outro participante da sala online: os bots com as cores de sempre; outra pessoa, com o chassi da
   * montagem dela e visor ciano (verde é você; vermelho, as IAs).
   */
  private makeRemote(e: RosterEntry): MechBase {
    if (e.kind === 'mech') return new Vector09({ paint: PALETTE.enemyPaint, visor: PALETTE.signal });
    if (e.kind === 'android') return new Android();
    if (e.kind === 'technician') return new Android({ visor: PALETTE.fluo, tool: 'repair' });
    return parseLoadoutKey(e.build)?.chassis === 'android'
      ? new Android({ stats: PILOT_ANDROID_STATS, paint: PALETTE.playerPaint, visor: PALETTE.cyan, tool: 'pilot' })
      : new Vector09({ visor: PALETTE.cyan });
  }

  /** Linha de status do online, no topo: sala, ping e pessoas; ou o motivo da recusa ou da queda. */
  private showNet(s: OnlineStatus): void {
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
  private equipPending(): void {
    const loadout = this.hangar.takePending();
    if (!loadout) return;
    this.mech.equip(poweredLoadout(loadout, this.power.current, 'player'));
    this.player.rearm();
  }

  /** Rodada nova: a partida já pôs todos de volta e restaurou a arena; aqui, o que é do jogador local. */
  private startRound(): void {
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
    this.player.keys = s.keys;
    this.bots.setSkill(BOT_SKILLS[s.difficulty]);
    this.bots.setPersonas(s.enemyPersonas);
    this.bots.maxAttackers = s.maxAttackers;
    this.debugPanel.setVisible(s.showPerf);
    this.audio.setVolume(s.volume);
    if (s.quality !== this.appliedQuality) {
      this.appliedQuality = s.quality;
      // 'auto' começa no máximo e deixa a qualidade adaptativa rebaixar (G12); os outros fixam.
      this.setPixelRatio(s.quality === 'media' ? 1 : s.quality === 'baixa' ? 0.75 : maxPixelRatio());
      this.bloomPass.enabled = s.quality !== 'baixa';
      this.quality.setAdaptive(s.quality === 'auto');
    }
  }

  start(): void {
    this.renderer.setAnimationLoop((now: number) => this.frame(now));
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
        this.audio.playStep(near * w);
        const giant = THREE.MathUtils.clamp(b.stats.height / this.mech.stats.height - 1, 0, 1);
        const close = Math.max(0, 1 - b.position.distanceTo(this.mech.position) / GIANT_STEP_RANGE);
        if (giant > 0 && close > 0) rig.addShake(0.4 * giant * close * close * w);
      };
    }
    // Som de disparo: wrap do onFire do jogador (não toca para bots — só mech do jogador).
    // O método onFire original anima o recuo; o wrap mantém esse comportamento e adiciona o som.
    const _origFire = mech.onFire.bind(mech);
    mech.onFire = () => { _origFire(); this.audio.playShot(); };
    this.player.onRocket = () => {
      this.audio.playRocketLaunch();
      this.onboarding.trigger('rockets');
    };
    this.match.onMechHit = (e) => {
      if (e.shooter === mech) {
        this.hud.showHit(e.result);
        // Confirmação auditiva de acerto (ouvida pelo jogador ao acertar)
        this.audio.playHit();
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

      const deadName = dead === mech ? 'VOCÊ' : this.round.scoreOf(dead)?.name ?? 'INIMIGO';
      const killerName = killer ? (killer === mech ? 'VOCÊ' : this.round.scoreOf(killer)?.name ?? null) : null;
      const isPlayerInvolved = dead === mech || killer === mech;
      this.killFeed.push(killerName, deadName, isPlayerInvolved);
      if (killer === mech && dead !== mech) this.vibrate([25, 40, 25]);
    };
    // Foguete: o dano em área já foi aplicado pela partida; aqui, fogo, fumaça, tremor e som.
    this.match.onExplosion = (at) => {
      this.particles.burst(at, UP, { count: 70, color: BLAST_COLOR, speed: 18, life: 0.75, size: 2.2, expansion: 0.9, spread: 2.4, gravity: 2 });
      this.particles.burst(at, UP, { count: 24, color: SMOKE_COLOR, speed: 4, life: 1.4, size: 2.7, expansion: 1.2, spread: 1.6, gravity: -1.5 });
      const dist = at.distanceTo(mech.position);
      if (dist < 40) rig.addShake(0.5 * (1 - dist / 40));
      this.audio.playExplosion(dist);
    };
    this.match.onRoundStart = () => this.startRound();
    this.destructibles.onBreak = (center) => {
      const falloff = 1 - center.distanceTo(mech.position) / 60;
      if (falloff > 0) rig.addShake(0.55 * falloff);
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
      if (locked) this.startPlaying();
      else if (rig.mode.pointerLock) this.setPlaying(false);
    };
    input.onWheel = (dy) => this.playing && rig.onWheel(dy);
    input.onKey = (code) => {
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
      if (!this.playing) return;
      if (code === this.settings.value.keys.camera) this.switchCamera();
      else if (code === 'Escape' && !rig.mode.pointerLock) this.setPlaying(false);
    };
  }

  private resume(): void {
    // Primeira partida da sessão: vinheta da marca (o clique é o gesto que libera o som). O mouse já
    // fica preso agora (o Pointer Lock só pode ser pedido dentro do clique); o mundo espera a vinheta.
    if (!this.brandShown) {
      this.brandShown = true;
      this.audio.resume();
      this.hud.setPaused(false);
      this.splash.play(this.audio.output, () => this.afterBrand());
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
    if (!this.playing) this.assist.reset();
    else {
      const target = this.combat.mechOf(this.rig.aim.target);
      const pull = this.assist.update(dt, this.camera, this.rig.look, target, touch && s.touchAimAssist, engaged);
      this.rig.nudge(pull.yaw, pull.pitch);
      // Mira no ponto antecipado: o tiro vai até a distância do alvo, não até a parede atrás dele.
      if (this.assist.aimDist > 0) {
        this.camera.getWorldDirection(_aimDir);
        this.rig.aim.point.copy(this.camera.getWorldPosition(_aimFrom)).addScaledVector(_aimDir, this.assist.aimDist);
      }
    }
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
    const mode = this.rig.cycle(this.input.touchMode ? 'tactical' : undefined);
    if (mode.pointerLock && !this.input.locked) this.input.requestLock();
    else if (!mode.pointerLock && this.input.locked) this.input.exitLock();
    this.hud.setMode(mode);
    this.touch.setCameraLabel(mode.id === 'fps' ? 'CAM 1ª' : 'CAM 3ª');
    this.updateCursor();
  }

  private setPlaying(playing: boolean): void {
    this.playing = playing;
    this.player.active = playing;
    this.hud.setPaused(!playing);
    this.touch.setVisible(playing && this.input.touchMode);
    this.updateCursor();
  }

  private updateCursor(): void {
    this.renderer.domElement.style.cursor = this.playing && !this.rig.mode.pointerLock ? 'none' : '';
  }

  private frame(now: number): void {
    // O timestamp do rAF pode ser anterior ao fim do setup; clamp evita dt negativo.
    const dt = this.last < 0 ? 0 : THREE.MathUtils.clamp((now - this.last) / 1000, 0, 0.1);
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
    this.player.collect();

    // --- Simulação em passo fixo (pausado = mundo congelado: os bots não atacam no menu) ---
    if (this.playing) this.accumulator += dt;
    let steps = 0;
    const t0 = performance.now();
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      // A partida roda o controle do jogador, os bots, os tiros e a física; entre rodadas, só o relógio.
      this.match.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    const tickMs = performance.now() - t0;
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    const alpha = this.accumulator / FIXED_DT;

    // --- Render ---
    this.mech.render(dt, alpha);
    this.bots.render(dt, alpha);
    this.online?.render(dt, now);
    this.nameplates.update(this.mech);
    this.rig.update(dt);
    this.updateAim(dt);
    this.projectiles.render(alpha);
    this.rockets.render(alpha);
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

    this.particles.update(dt);

    this.hud.setRespawn(this.respawner.timeLeft(this.mech));
    this.killFeed.update(dt);
    this.onboarding.update(dt);
    this.roundHud.update(dt, this.round, this.input.isDown('Tab') || this.input.virtualBoard);
    const saw = this.mech.loadout.secondary?.kind === 'melee';
    this.hud.setRockets(saw ? 4 : this.player.launcher.ammo, saw ? 1 : this.player.launcher.reloadProgress, this.mech.canFireSecondary);
    this.hud.setHeat(this.mech.heat, this.mech.overheated);
    if (this.mech.heatState !== 'normal') this.onboarding.trigger('heat');
    this.offscreen.update(this.camera, this.bots, this.mech);
    this.touch.setOverheated(this.mech.overheated);
    this.hud.update(dt, this.mech, this.input.mouseX, this.input.mouseY, this.debris.count);
    this.renderer.info.reset();
    this.composer.render(dt);
    
    // Atualiza medidor de FPS depois do render
    this.quality.update(dt);
    this.debugPanel.update(dt, tickMs, this.renderer.info, this.quality.currentTier);
    
    this.input.endFrame();
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }
}
