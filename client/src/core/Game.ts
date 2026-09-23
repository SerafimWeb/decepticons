import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { CameraRig } from '../camera/CameraRig';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { Vector09 } from '../entities/Vector09';
import type { MechBase } from '../entities/MechBase';
import { Arena } from '../environment/Arena';
import { DebrisSystem } from '../environment/DebrisSystem';
import { Destructibles } from '../environment/Destructibles';
import { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { PlayerController } from '../player/PlayerController';
import { HUD } from '../ui/HUD';
import { InputManager } from './InputManager';
import { Quality } from './Quality';

/** Máximo de ticks por frame: se a máquina engasgar, o jogo desacelera em vez de travar. */
const MAX_STEPS_PER_FRAME = 4;
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
  private readonly mech: MechBase;
  private readonly rig: CameraRig;
  private readonly player: PlayerController;
  private readonly hud = new HUD();

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
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
    this.mech.spawn(physics, new THREE.Vector3(0, 0, 25));
    this.scene.add(this.mech.root);

    // --- Jogador ---
    this.input = new InputManager(this.renderer.domElement);
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
      (ratio) => this.renderer.setPixelRatio(ratio),
      (enabled) => { this.bloomPass.enabled = enabled; }
    );
  }

  start(): void {
    this.renderer.setAnimationLoop((now: number) => this.frame(now));
  }

  private wireEvents(): void {
    const { input, rig, mech } = this;

    mech.onLand = (speed) => {
      rig.addShake(THREE.MathUtils.clamp((speed - 12) / 30, 0.1, 0.6));
      this.particles.burst(mech.position, UP, { count: 30, color: DUST_COLOR, speed: 12, life: 0.7, spread: 2.5, gravity: 4 });
    };
    mech.onDashImpact = (collider, dir) => this.destructibles.demolish(collider, dir);
    this.projectiles.onHit = (hit, dir, damage) => this.destructibles.damage(hit.collider, damage, dir);
    this.destructibles.onBreak = (center) => {
      const falloff = 1 - center.distanceTo(mech.position) / 60;
      if (falloff > 0) rig.addShake(0.55 * falloff);
    };

    document.getElementById('overlay')!.addEventListener('click', () => this.resume());
    input.onLockChange = (locked) => {
      if (locked) this.setPlaying(true);
      else if (rig.mode.pointerLock) this.setPlaying(false);
    };
    input.onWheel = (dy) => this.playing && rig.onWheel(dy);
    input.onKey = (code) => {
      if (!this.playing) return;
      if (code === 'KeyV') this.switchCamera();
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

    // --- Simulação em passo fixo ---
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.player.fixedUpdate(FIXED_DT);
      this.projectiles.fixedUpdate(FIXED_DT);
      this.physics.step();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    const alpha = this.accumulator / FIXED_DT;

    // --- Render ---
    this.mech.render(dt, alpha);
    this.rig.update(dt);
    this.projectiles.render(alpha);
    this.debris.sync();

    if (this.mech.isDashing) {
      const count = Math.ceil(dt * 240);
      for (const t of this.mech.thrusters) {
        this.particles.burst(t.getWorldPosition(_tmp), UP, { count, color: THRUSTER_COLOR, speed: 4, life: 0.35, spread: 0.7, gravity: -4 });
      }
    }
    this.particles.update(dt);

    this.hud.update(dt, this.mech, this.input.mouseX, this.input.mouseY, this.debris.count);
    this.composer.render(dt);
    
    // Atualiza medidor de FPS depois do render
    this.quality.update(dt);
    
    this.input.endFrame();
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }
}
