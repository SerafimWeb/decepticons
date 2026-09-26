import * as THREE from 'three';
import { FireTimer, RocketLauncher } from '../client/src/combat/trigger';
import { weapon } from '../client/src/combat/weapons';
import type { MechBase, MechInput } from '../client/src/entities/MechBase';
import { mechInputFromNet } from '../client/src/net/adapters';
import type { Match, Pilot } from '../client/src/sim/Match';
import { newNetInput, type NetInput } from '../shared/net/input';

/** Comandos guardados por jogador: ~0,25 s de folga para a rede oscilar. */
const QUEUE = 16;

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();

/**
 * O piloto de um jogador remoto, no servidor (M3). A cada tick aplica um comando, na ordem em que chegaram; sem
 * comando novo, repete o último movimento sem repetir pulo e dash. O estado mandado ao cliente leva o tick do
 * último comando aplicado (\`ack\`): é o que a reconciliação da M4 usa.
 *
 * As regras de tiro são as do jogador local (\`PlayerController\`): cadência, calor e carregador. O tiro sai da
 * simulação (\`simMuzzle\`), na direção de yaw e pitch do comando, nunca de um modelo desenhado
 * (MULTIPLAYER.md, seção 9, item 3). Nada alocado por tick (G4).
 */
export class NetPilot implements Pilot {
  /** Tick do último comando aplicado. */
  ack = 0;
  private readonly queue: NetInput[] = Array.from({ length: QUEUE }, newNetInput);
  private head = 0;
  private size = 0;
  private lastQueued = 0;
  private readonly current = newNetInput();
  private readonly cmd: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
  private readonly trigger = new FireTimer();
  private readonly saw = new FireTimer();
  private launcher: RocketLauncher;

  constructor(
    readonly mech: MechBase,
    private readonly match: Match,
  ) {
    this.launcher = new RocketLauncher(mech.loadout.secondary ?? weapon('rockets'));
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
    } else {
      c.jump = false;
      c.dash = false;
    }
    const m = this.mech;
    m.applyFacing(c.yaw, c.pitch);
    m.fixedUpdate(mechInputFromNet(c, this.cmd), dt);

    this.trigger.fixedUpdate(dt);
    if (c.fire && this.trigger.ready && m.canFirePrimary) {
      this.aim(c);
      this.match.projectiles.fire(_origin, _dir, m.collider, false, m.loadout.primary);
      m.onFire();
      this.trigger.shot(m.loadout.primary.fireInterval);
    }

    if (!m.alive) this.launcher.refill();
    else this.launcher.fixedUpdate(dt);
    const secondary = m.loadout.secondary;
    if (secondary?.kind === 'melee') {
      this.saw.fixedUpdate(dt);
      if (c.secondary && this.saw.ready && m.canFireSecondary) {
        this.match.meleeNearest(m, secondary);
        m.onFireSecondary();
        this.saw.shot(secondary.fireInterval);
      }
    } else if (c.secondary && m.canFireSecondary && this.launcher.tryFire()) {
      this.aim(c);
      this.match.rockets.fire(_origin, _dir, m.collider, this.launcher.weapon);
      m.onFireSecondary();
    }
  }

  /** Boca da arma pela simulação e direção de yaw e pitch do comando (em _origin e _dir). */
  private aim(c: NetInput): void {
    this.mech.simMuzzle(_origin);
    _dir.set(-Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch));
  }
}
