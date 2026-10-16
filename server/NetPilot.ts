import * as THREE from 'three';
import { AIM_RANGE, Armament, type ShotSink } from '../client/src/combat/Armament';
import type { MountId } from '../client/src/combat/mounts';
import { applySpread } from '../client/src/combat/spread';
import type { MechBase, MechInput } from '../client/src/entities/MechBase';
import { mechInputFromNet } from '../client/src/net/adapters';
import type { Match, Pilot } from '../client/src/sim/Match';
import { newNetInput, type NetInput } from '../shared/net/input';

/**
 * Comandos guardados por jogador: ~0,5 s de folga para a rede (ou o servidor) engasgar. Com 16 (~0,25 s), um servidor
 * sobrecarregado descartava comandos e o Mech andava menos que o previsto (visto no teste com a máquina cheia).
 */
const QUEUE = 32;
/** Sem comando novo por este tanto de ticks (pausa, rede travada), o Mech para: não anda sozinho. */
const STARVED_TICKS = 10;

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _ref = new THREE.Vector3();
const _refDir = new THREE.Vector3();
const _point = new THREE.Vector3();

/**
 * O piloto de um jogador remoto, no servidor (M3). A cada tick aplica um comando, na ordem em que chegaram; sem
 * comando novo, repete o último movimento sem repetir pulo e dash. O estado mandado ao cliente leva o tick do
 * último comando aplicado (\`ack\`): é o que a reconciliação da M4 usa.
 *
 * As regras de tiro são as do jogador local, e são a mesma (`Armament`): cadência, calor, carregador e quais
 * encaixes atiram em cada botão. O tiro sai da simulação (`simMuzzle` de cada encaixe), na direção de yaw e pitch do
 * comando, nunca de um modelo desenhado (MULTIPLAYER.md, seção 9, item 3). Nada alocado por tick (G4).
 */
export class NetPilot implements Pilot {
  /** Tick do último comando aplicado. */
  ack = 0;
  private readonly queue: NetInput[] = Array.from({ length: QUEUE }, newNetInput);
  private head = 0;
  private size = 0;
  private lastQueued = 0;
  private starved = 0;
  private readonly current = newNetInput();
  private readonly cmd: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
  private readonly armament: Armament;
  private readonly sink: ShotSink = {
    projectile: (mount, w, spread) => {
      this.aim(mount);
      applySpread(_dir, spread);
      this.match.projectiles.fire(_origin, _dir, this.mech.collider, false, w);
      // M5 TODO: compensação de latência (volta cápsulas ao tempo do comando)
    },
    rocket: (mount, w, volley, spread) => {
      // A chuva e o cruzador precisam do ponto da mira (o centro da chuva, o ponto de mergulho); o míssil leve e os foguetes só da direção.
      this.aim(mount, w.barrage !== undefined || w.cruise !== undefined);
      if (w.barrage) this.match.barrage.fire(_origin, _dir, _point, this.mech.collider, w, volley);
      else if (w.cruise) this.match.cruise.fire(_origin, _dir, _point, this.mech.collider, w);
      else this.match.rockets.fire(_origin, applySpread(_dir, spread), this.mech.collider, w);
    },
    melee: (w) => this.match.meleeNearest(this.mech, w),
    flame: (mount, w) => {
      this.aim(mount);
      this.match.flameCone(this.mech, _origin, _dir, w);
    },
    wave: (mount, w) => {
      this.aim(mount);
      this.match.waveCone(this.mech, _origin, _dir, w);
    },
    beam: (mount, w) => {
      this.aim(mount);
      this.match.beamPulse(this.mech, _origin, _dir, w);
    },
  };

  constructor(
    readonly mech: MechBase,
    private readonly match: Match,
  ) {
    this.armament = new Armament(mech);
  }

  /**
   * Um comando que chegou (já validado pelo codec). Repetido ou mais velho que o último aplicado não entra;
   * fila cheia descarta o mais antigo (o cliente adiantado não acumula atraso).
   */
  push(input: NetInput): void {
    if (input.tick <= this.ack || (this.size > 0 && input.tick <= this.lastQueued)) return;
    if (this.size === QUEUE) {
      this.head = (this.head + 1) % QUEUE;
      this.size--;
    }
    Object.assign(this.queue[(this.head + this.size) % QUEUE]!, input);
    this.size++;
    this.lastQueued = input.tick;
  }

  /** Comandos esperando a vez (para teste e diagnóstico). */
  get pending(): number {
    return this.size;
  }

  fixedUpdate(dt: number): void {
    const c = this.current;
    if (this.size > 0) {
      Object.assign(c, this.queue[this.head]!);
      this.head = (this.head + 1) % QUEUE;
      this.size--;
      this.ack = c.tick;
      this.starved = 0;
    } else {
      c.jump = false;
      c.dash = false;
      if (++this.starved > STARVED_TICKS) {
        c.moveX = 0;
        c.moveZ = 0;
        c.fire = false;
        c.secondary = false;
        c.shield = false;
      }
    }
    const m = this.mech;
    m.applyFacing(c.yaw, c.pitch);
    m.fixedUpdate(mechInputFromNet(c, this.cmd), dt);

    this.armament.fixedUpdate(dt, c.fire, c.secondary, this.sink);
  }

  /**
   * Boca do encaixe pela simulação e a direção do tiro (em _origin e _dir). O yaw e o pitch do comando saem da boca da
   * mão direita (é dela que o cliente mira); a mão esquerda e os ombros ficam a metros de lado, e tiro paralelo errava o
   * alvo. Então o servidor acha onde o raio da mão direita bate (a mira, de novo) e faz cada boca apontar para lá, como
   * o jogador local faz. Um raio por tiro, nunca por tick; o chão, a parede e o outro Mech contam, o próprio Mech não.
   * `needPoint`: a chuva de mísseis e o míssil cruzador também precisam desse ponto (o centro dela, o ponto de mergulho dele), mesmo saindo da mão direita.
   */
  private aim(mount: MountId, needPoint = false): void {
    const c = this.current;
    _refDir.set(-Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch));
    this.mech.simMuzzle(_origin, mount);
    if (mount === 'rightHand' && !needPoint) {
      _dir.copy(_refDir);
      return;
    }
    this.mech.simMuzzle(_ref, 'rightHand');
    const hit = this.match.physics.raycast(_ref, _refDir, AIM_RANGE, this.mech.collider);
    _point.copy(_ref).addScaledVector(_refDir, hit ? hit.distance : AIM_RANGE);
    _dir.subVectors(_point, _origin);
    // Alvo "atrás" da boca (a mira no chão, colado no pé): atira reto, como o jogador local.
    if (_dir.dot(_refDir) < 3) _dir.copy(_refDir);
    else _dir.normalize();
  }
}
