import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { CameraRig } from '../camera/CameraRig';
import { CombatSystem } from '../combat/CombatSystem';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { BOT_SKILLS } from '../combat/BotController';
import { BotSystem } from '../combat/BotSystem';
import { Respawner } from '../combat/Respawner';
import { Round } from '../combat/Round';
import { Vector09 } from '../entities/Vector09';
import type { MechBase } from '../entities/MechBase';
import { Arena, SPAWN_POINTS } from '../environment/Arena';
import { DebrisSystem } from '../environment/DebrisSystem';
import { Destructibles } from '../environment/Destructibles';
import { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { PlayerController } from '../player/PlayerController';
import { HUD } from '../ui/HUD';
import { MouseCalibration } from '../ui/MouseCalibration';
import { RoundHud } from '../ui/RoundHud';
import { SettingsMenu } from '../ui/SettingsMenu';
import { InputManager } from './InputManager';
import { Quality } from './Quality';
import { browserStorage, radiansPerCount, Settings, type GameSettings, type QualityPreset } from './Settings';
import { DebugPanel } from '../debug/DebugPanel';
import { TouchControls } from '../ui/TouchControls';
import { AudioSystem } from '../audio/AudioSystem';

/** Máximo de ticks por frame: se a máquina engasgar, o jogo desacelera em vez de travar. */
const MAX_STEPS_PER_FRAME = 4;
const PLAYER_RESPAWN_S = 3;
/** Resolução máxima do render: acima de 1,5 o custo de GPU sobe muito para pouco ganho visível. */
const maxPixelRatio = () => Math.min(window.devicePixelRatio, 1.5);
/** Um bot perto (entra em combate logo) e dois mais longe (chegam patrulhando). */
const BOT_SPAWNS = [SPAWN_POINTS[2]!, SPAWN_POINTS[4]!, SPAWN_POINTS[8]!];
const THRUSTER_COLOR = new THREE.Color(3.0, 1.0, 0.2);
const DUST_COLOR = new THREE.Color(0.45, 0.42, 0.5);
const UP = new THREE.Vector3(0, 1, 0);

const _tmp = new THREE.Vector3();

/**
 * Monta os módulos e roda o loop:
 *  - simulação (Mech, projéteis, física) em passo fixo de 60 Hz;
 *  - render (câmera, animação, partículas) na taxa do monitor, interpolado.
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
  private readonly debris: DebrisSystem;
  private readonly destructibles: Destructibles;
  private readonly projectiles: ProjectileSystem;
  private readonly combat: CombatSystem;
  private readonly bots: BotSystem;
  private readonly respawner: Respawner;
  private readonly round = new Round();
  private readonly roundHud: RoundHud;
  private readonly mech: MechBase;
  private readonly rig: CameraRig;
  private readonly player: PlayerController;
  private readonly hud = new HUD();
  private readonly debugPanel = new DebugPanel();
  private readonly audio = new AudioSystem();
  /** Nó de gain do loop de chiado do Blind Mode; null = som não está tocando. */
  private blindGain: GainNode | null = null;
  /** Flag para detectar a transição false→true do dash a cada frame. */
  private wasDashing = false;
  /** Configurações do jogador (salvas no navegador). A tela de configurações chama `settings.update()`. */
  readonly settings = new Settings(browserStorage());
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
    private readonly physics: PhysicsWorld,
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

    // --- Mundo ---
    this.scene.add(this.particles.points);
    this.debris = new DebrisSystem(this.scene, physics);
    this.destructibles = new Destructibles(this.scene, physics, this.debris, this.particles);
    const arena = new Arena(this.scene, physics, this.destructibles);
    this.projectiles = new ProjectileSystem(this.scene, physics, this.particles);

    this.mech = new Vector09();
    const [px, pz] = SPAWN_POINTS[0]!;
    this.mech.spawn(physics, new THREE.Vector3(px, 0, pz));
    this.scene.add(this.mech.root);

    // --- Combate ---
    this.combat = new CombatSystem(this.destructibles, this.debris, this.particles);
    this.combat.register(this.mech);
    this.respawner = new Respawner(SPAWN_POINTS);
    this.respawner.track(this.mech, PLAYER_RESPAWN_S);
    this.bots = new BotSystem({
      scene: this.scene,
      physics,
      combat: this.combat,
      projectiles: this.projectiles,
      particles: this.particles,
      respawner: this.respawner,
      spawns: BOT_SPAWNS,
      waypoints: SPAWN_POINTS,
    });
    this.bots.targets = [this.mech];
    this.round.register(this.mech, 'VOCÊ');
    for (const b of this.bots.mechs) this.round.register(b, this.bots.nameOf(b));
    this.roundHud = new RoundHud(this.mech);
    // Botão na tela de pausa; a calibração tem camada própria e não retoma o jogo.
    new MouseCalibration(this.settings, [
      document.getElementById('btn-settings')!,
      document.getElementById('setting-sens')!.closest('.setting-row')!,
    ]);

    // --- Jogador ---
    this.input = new InputManager(this.renderer.domElement);
    new TouchControls(this.input);
    this.rig = new CameraRig({
      camera: this.camera,
      physics,
      input: this.input,
      mech: this.mech,
      occluders: arena.occluders,
    });
    this.player = new PlayerController(this.mech, this.input, this.rig, this.projectiles, this.particles);

    this.wireEvents();
    this.hud.setMode(this.rig.mode);
    this.hud.setReady();

    this.quality = new Quality(
      (ratio) => this.setPixelRatio(ratio),
      (enabled) => {
        this.bloomPass.enabled = enabled;
      },
    );
    new SettingsMenu(this.settings);
    this.settings.onChange((s) => this.applySettings(s));
  }

  /**
   * Rodada nova: todos inteiros nos pontos de nascimento, arena restaurada. A ordem importa:
   * Mechs saem de perto das estruturas e os destroços somem antes de as barricadas voltarem.
   */
  private startRound(): void {
    const [px, pz] = SPAWN_POINTS[0]!;
    this.mech.respawn(_tmp.set(px, 0, pz));
    this.bots.respawnAll();
    this.projectiles.clear();
    this.debris.clear();
    this.destructibles.restoreAll();
    this.hud.setScore(0, 0);
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
    this.debugPanel.setVisible(s.showPerf);
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
    mech.onDashImpact = (collider, dir) => this.destructibles.demolish(collider, dir);
    // Som de disparo: wrap do onFire do jogador (não toca para bots — só mech do jogador).
    // O método onFire original anima o recuo; o wrap mantém esse comportamento e adiciona o som.
    const _origFire = mech.onFire.bind(mech);
    mech.onFire = () => { _origFire(); this.audio.playShot(); };
    this.projectiles.onHit = (hit, dir, damage, owner) => this.combat.onProjectileHit(hit, dir, damage, owner);
    this.combat.onMechHit = (e) => {
      if (e.shooter === mech) {
        this.hud.showHit(e.result);
        // Confirmação auditiva de acerto (ouvida pelo jogador ao acertar)
        this.audio.playHit();
      }
      if (e.mech === mech) {
        this.hud.showDamage();
        rig.addShake(0.12);
      } else {
        this.bots.onDamaged(e.mech, e.shooter);
      }
      // Parte destruída → estalo metálico
      if (e.result.partDestroyed) this.audio.playPartDestroyed();
    };
    this.combat.onMechKilled = (dead, at, killer) => {
      const falloff = 1 - at.distanceTo(mech.position) / 70;
      if (falloff > 0) rig.addShake(0.7 * falloff);
      this.audio.playExplosion(1 - Math.max(0, falloff));
      this.round.recordKill(dead, killer);
      const me = this.round.scoreOf(mech);
      this.hud.setScore(me?.kills ?? 0, me?.deaths ?? 0);
    };
    this.destructibles.onBreak = (center) => {
      const falloff = 1 - center.distanceTo(mech.position) / 60;
      if (falloff > 0) rig.addShake(0.55 * falloff);
    };

    document.getElementById('overlay')!.addEventListener('click', () => this.resume());
    // Resume do AudioContext na primeira interação (exigência dos navegadores)
    document.getElementById('overlay')!.addEventListener('click', () => this.audio.resume(), { once: true });
    input.onLockChange = (locked) => {
      if (locked) this.setPlaying(true);
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
    if (this.rig.mode.pointerLock) this.input.requestLock();
    else this.setPlaying(true);
  }

  /** Chamado dentro do keydown (gesto do usuário), exigência do Pointer Lock. */
  private switchCamera(): void {
    const mode = this.rig.cycle();
    if (mode.pointerLock && !this.input.locked) this.input.requestLock();
    else if (!mode.pointerLock && this.input.locked) this.input.exitLock();
    this.hud.setMode(mode);
    this.updateCursor();
  }

  private setPlaying(playing: boolean): void {
    this.playing = playing;
    this.player.active = playing;
    this.hud.setPaused(!playing);
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
      this.rig.applyMouse(m.x, m.y);
    }
    this.player.collect();

    // --- Simulação em passo fixo (pausado = mundo congelado: os bots não atacam no menu) ---
    if (this.playing) this.accumulator += dt;
    let steps = 0;
    const t0 = performance.now();
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      // No intervalo entre rodadas o mundo fica congelado (placar na tela); só o relógio anda.
      if (this.round.playing) {
        this.player.fixedUpdate(FIXED_DT);
        this.bots.fixedUpdate(FIXED_DT);
        this.respawner.fixedUpdate(FIXED_DT);
        this.projectiles.fixedUpdate(FIXED_DT);
        this.physics.step();
      }
      if (this.round.fixedUpdate(FIXED_DT) === 'started') this.startRound();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    const tickMs = performance.now() - t0;
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    const alpha = this.accumulator / FIXED_DT;

    // --- Render ---
    this.mech.render(dt, alpha);
    this.bots.render(dt, alpha);
    this.rig.update(dt);
    this.projectiles.render(alpha);
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
    this.roundHud.update(dt, this.round, this.input.isDown('Tab'));
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
