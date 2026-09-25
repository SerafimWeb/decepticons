import * as THREE from 'three';
import { GLOW } from '../core/palette';
import type { CameraRig } from '../camera/CameraRig';
import type { ProjectileSystem } from '../combat/ProjectileSystem';
import type { RocketSystem } from '../combat/RocketSystem';
import { FireTimer, RocketLauncher } from '../combat/trigger';
import { weapon } from '../combat/weapons';
import type { InputManager } from '../core/InputManager';
import { DEFAULT_SETTINGS, type KeyAction } from '../core/Settings';
import type { MechBase, MechInput } from '../entities/MechBase';
import type { ParticleSystem } from '../fx/ParticleSystem';

const MUZZLE_COLOR = GLOW.playerMuzzle;
const ROCKET_FLASH = new THREE.Color(3.0, 1.2, 0.3);
const AIM_RANGE = 400;

const _muzzle = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();

/**
 * Liga teclado/câmera ao Mech local. Eventos de borda (pulo, dash) ficam
 * "travados" até o próximo tick fixo, para não se perderem em monitores >60 Hz.
 */
export class PlayerController {
  active = false;
  /** Carregador do braço esquerdo (regra no tick fixo; o HUD lê daqui). Refeito ao trocar de armas. */
  launcher: RocketLauncher;
  /** Um foguete saiu (som). */
  onRocket?: () => void;
  /** Teclas de cada ação (e.code), vindas das configurações. */
  keys: Readonly<Record<KeyAction, string>> = DEFAULT_SETTINGS.keys;

  private jumpQueued = false;
  private dashQueued = false;
  /** Cadência do canhão principal, sem arredondar para o tick. */
  private readonly trigger = new FireTimer();
  private readonly cmd: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };

  constructor(
    private readonly mech: MechBase,
    private readonly input: InputManager,
    private readonly rig: CameraRig,
    private readonly projectiles: ProjectileSystem,
    private readonly particles: ParticleSystem,
    private readonly rockets: RocketSystem,
  ) {
    this.launcher = new RocketLauncher(mech.loadout.secondary ?? weapon('rockets'));
  }

  /** O Mech trocou de armas (Hangar): carregador novo, cheio, com o lançador montado. */
  rearm(): void {
    this.launcher = new RocketLauncher(this.mech.loadout.secondary ?? weapon('rockets'));
    this.trigger.reset();
  }

  /** Taxa do render: captura eventos de borda. */
  collect(): void {
    if (!this.active) return;
    if (this.input.wasPressed(this.keys.jump) || this.input.virtualJump) this.jumpQueued = true;
    if (this.input.wasPressed(this.keys.dash) || this.input.virtualDash) this.dashQueued = true;
    // Reseta flags virtuais após ler
    this.input.virtualJump = false;
    this.input.virtualDash = false;
  }

  /** Taxa fixa (60 Hz): monta o comando e simula. */
  fixedUpdate(dt: number): void {
    const a = this.active;
    const aim = this.rig.aim;
    const cmd = this.cmd;
    const k = this.keys;
    
    // Mescla o direcional (teclado) com o joystick analógico (mobile)
    let mx = a ? this.input.axis(k.right, k.left) : 0;
    let mz = a ? this.input.axis(k.forward, k.back) : 0;
    if (a && this.input.virtualMoveX !== 0) mx = this.input.virtualMoveX;
    if (a && this.input.virtualMoveZ !== 0) mz = this.input.virtualMoveZ;
    
    cmd.moveX = mx;
    cmd.moveZ = mz;
    cmd.moveYaw = aim.moveYaw;
    cmd.yaw = aim.yaw;
    cmd.jump = this.jumpQueued;
    cmd.dash = this.dashQueued;
    this.jumpQueued = this.dashQueued = false;

    this.mech.fixedUpdate(cmd, dt);

    this.trigger.fixedUpdate(dt);
    const wantsToFire = this.input.mouseDown || this.input.virtualFire || this.input.autoFire;
    if (a && wantsToFire && this.trigger.ready && this.mech.canFirePrimary) {
      this.fire();
      this.trigger.shot(this.mech.loadout.primary.fireInterval);
    }

    // Foguetes: segurar dispara o carregador no ritmo do intervalo. Morto, o carregador enche
    // (renasce pronto). Braço esquerdo destruído = sem foguetes.
    if (!this.mech.alive) this.launcher.refill();
    else this.launcher.fixedUpdate(dt);
    const wantsRocket = this.input.mouseDown2 || this.input.isDown(k.secondary) || this.input.virtualRocket;
    if (a && wantsRocket && this.mech.canFireSecondary && this.launcher.tryFire()) this.fireRocket();
  }

  private fireRocket(): void {
    const { mech } = this;
    mech.leftMuzzleWorldPosition(_muzzle);
    this.aimFrom(_muzzle);
    this.rockets.fire(_muzzle, _dir, mech.collider, this.launcher.weapon);
    this.particles.burst(_muzzle, _dir, { count: 14, color: ROCKET_FLASH, speed: 8, life: 0.25, spread: 0.6, gravity: 0 });
    mech.onFireSecondary();
    this.onRocket?.();
  }

  /** Direção do tiro saindo de `from` até o ponto sob a mira (em _dir). */
  private aimFrom(from: THREE.Vector3): void {
    const { yaw, pitch, point } = this.rig.aim;
    _fwd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    // Se o alvo estiver "atrás" da boca (ex.: mirando o chão perto do pé), atira reto.
    _to.copy(point);
    if (_dir.subVectors(_to, from).dot(_fwd) < 3) _to.copy(from).addScaledVector(_fwd, AIM_RANGE);
    _dir.subVectors(_to, from).normalize();
  }

  private fire(): void {
    const { mech, rig } = this;
    const { yaw, pitch, point } = rig.aim;
    mech.muzzleWorldPosition(_muzzle);
    _fwd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

    // Se o alvo estiver "atrás" do canhão (ex.: mirando o chão perto do pé), atira reto.
    _to.copy(point);
    if (_dir.subVectors(_to, _muzzle).dot(_fwd) < 3) _to.copy(_muzzle).addScaledVector(_fwd, AIM_RANGE);
    _dir.subVectors(_to, _muzzle).normalize();

    this.projectiles.fire(_muzzle, _dir, mech.collider, false, mech.loadout.primary);
    this.particles.burst(_muzzle, _dir, { count: 10, color: MUZZLE_COLOR, speed: 10, life: 0.15, spread: 0.5, gravity: 0 });
    mech.onFire();
  }
}
