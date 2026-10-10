import * as THREE from 'three';
import { GLOW } from '../core/palette';
import type { CameraRig } from '../camera/CameraRig';
import { AIM_RANGE, Armament, type ShotSink } from '../combat/Armament';
import type { BarrageSystem } from '../combat/BarrageSystem';
import { fireKick } from '../combat/fireFeel';
import type { MountId } from '../combat/mounts';
import { applySpread, type Spread } from '../combat/spread';
import type { ProjectileSystem } from '../combat/ProjectileSystem';
import type { RocketSystem } from '../combat/RocketSystem';
import type { RocketLauncher } from '../combat/trigger';
import type { WeaponStats } from '../combat/weapons';
import type { InputManager } from '../core/InputManager';
import { DEFAULT_SETTINGS, type KeyAction } from '../core/Settings';
import type { MechBase, MechInput } from '../entities/MechBase';
import type { ParticleSystem } from '../fx/ParticleSystem';

const MUZZLE_COLOR = GLOW.playerMuzzle;
const ROCKET_FLASH = new THREE.Color(3.0, 1.2, 0.3);

const _muzzle = new THREE.Vector3();
const _mouth = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();

/**
 * Liga teclado/câmera ao Mech local. Eventos de borda (pulo, dash) ficam
 * "travados" até o próximo tick fixo, para não se perderem em monitores >60 Hz.
 *
 * A regra de tiro (cadência, carregador, calor, quais encaixes atiram) é do `Armament`, a mesma do servidor; aqui só o
 * que é do jogador: de onde o tiro sai no desenho, para onde a câmera mira, som e partículas.
 */
export class PlayerController {
  active = false;
  /** Um foguete saiu (som). Uma vez por aperto do botão, mesmo que a salva tenha dois. */
  onRocket?: () => void;
  /** Saiu um tiro de energia, de qualquer encaixe (som). */
  onShot?: () => void;
  /** O tiro pesou na câmera: quanto tremer (trauma 0..1, `fireKick`). Só render; não mexe na mira nem na regra. */
  onKick?: (amount: number) => void;
  /** Corte corpo a corpo (motosserra no braço esquerdo): quem aplica é a partida (`Match.meleeNearest`). */
  melee?: (w: WeaponStats) => void;
  /** Teclas de cada ação (e.code), vindas das configurações. */
  keys: Readonly<Record<KeyAction, string>> = DEFAULT_SETTINGS.keys;

  /** Gatilhos apertados no último tick (o multiplayer manda no comando). */
  firing = false;
  secondaryHeld = false;

  private shieldRequested = false;
  private inputResetVersion = 0;
  private jumpQueued = false;
  private dashQueued = false;
  private spinShots = 0;
  private readonly armament: Armament;
  private readonly cmd: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
  private readonly sink: ShotSink = {
    projectile: (mount, w, spread) => this.shoot(mount, w, spread),
    rocket: (mount, w, volley) => this.launch(mount, w, volley),
    melee: (w) => this.melee?.(w),
  };

  constructor(
    private readonly mech: MechBase,
    private readonly input: InputManager,
    private readonly rig: CameraRig,
    private readonly projectiles: ProjectileSystem,
    private readonly particles: ParticleSystem,
    private readonly rockets: RocketSystem,
    private readonly barrage: BarrageSystem,
  ) {
    this.armament = new Armament(mech);
  }

  /** Carregador do gatilho secundário (regra no tick fixo; o HUD lê daqui). Refeito ao trocar de armas. */
  get primaryCharge(): number { return this.armament.primaryCharge; }
  get secondaryCharge(): number { return this.armament.secondaryCharge; }

  get launcher(): RocketLauncher {
    return this.armament.launcher;
  }

  /** O Mech trocou de armas (Hangar): carregador novo, cheio, com o lançador montado. */
  rearm(): void {
    this.armament.rearm();
    this.shieldRequested = false;
  }

  /** O comando do último tick (o multiplayer manda para o servidor). */
  get command(): Readonly<MechInput> {
    return this.cmd;
  }

  /** Taxa do render: captura eventos de borda. */
  collect(): void {
    if (!this.active || !this.mech.alive || this.inputResetVersion !== this.input.resetVersion) {
      this.shieldRequested = false;
      this.jumpQueued = this.dashQueued = false;
      this.inputResetVersion = this.input.resetVersion;
      this.input.virtualShield = false;
      if (!this.active || !this.mech.alive) return;
    }
    if (this.input.wasPressed(this.keys.shield) || this.input.virtualShield) this.shieldRequested = !this.shieldRequested;
    this.input.virtualShield = false;
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
    cmd.shield = a && this.mech.alive && this.shieldRequested;
    this.jumpQueued = this.dashQueued = false;

    this.mech.fixedUpdate(cmd, dt);
    // Colapso, morte ou energia insuficiente exigem um novo toque, nunca religam sozinhos.
    if (!this.mech.energyShield.active) this.shieldRequested = false;

    const wantsToFire = this.input.mouseDown || this.input.virtualFire || this.input.autoFire;
    this.firing = a && wantsToFire;
    const wantsRocket = this.input.mouseDown2 || this.input.isDown(k.secondary) || this.input.virtualRocket;
    this.secondaryHeld = a && wantsRocket;
    this.armament.fixedUpdate(dt, this.firing, this.secondaryHeld, this.sink);
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

  /** Um projétil de energia de `mount`: sai da boca do desenho e vai até a mira. */
  private shoot(mount: MountId, w: WeaponStats, spread: Readonly<Spread>): void {
    this.mech.mountWorldPosition(mount, _muzzle);
    this.aimFrom(_muzzle);
    applySpread(_dir, spread);
    this.projectiles.fire(_muzzle, _dir, this.mech.collider, false, w);
    // A rotatória atira 20 vezes por segundo: clarão menor e som a cada quarto tiro (o zumbido contínuo é do Gemini, ARMAS_ELEMENTAIS.md T5).
    this.particles.burst(_muzzle, _dir, { count: w.spin ? 3 : 10, color: MUZZLE_COLOR, speed: 10, life: 0.15, spread: 0.5, gravity: 0 });
    if (!w.spin || (this.spinShots++ & 3) === 0) this.onShot?.();
    this.onKick?.(fireKick(w));
  }

  private launch(mount: MountId, w: WeaponStats, volley: number): void {
    this.mech.mountWorldPosition(mount, _muzzle);
    this.aimFrom(_muzzle);
    // Chuva de mísseis: sobe e cai em volta do ponto sob a mira, em vez de ir reto até ele.
    // O desenho do lançamento sobe do morteiro das costas, se o Mech tem um (a conta da chuva usa a boca do tiro).
    if (w.barrage) this.barrage.fire(_muzzle, _dir, this.rig.aim.point, this.mech.collider, w, volley, this.mech.barrageMouth(_mouth));
    else this.rockets.fire(_muzzle, _dir, this.mech.collider, w);
    this.particles.burst(_muzzle, _dir, { count: 14, color: ROCKET_FLASH, speed: 8, life: 0.25, spread: 0.6, gravity: 0 });
    // Uma vez por aperto: a salva do Marauder (dois ombros) e os dois foguetes juntos pesam como um estrondo só.
    if (volley === 0) {
      this.onRocket?.();
      this.onKick?.(fireKick(w));
    }
  }
}
