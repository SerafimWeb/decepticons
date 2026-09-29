import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import type { WeaponStats } from '../client/src/combat/weapons';
import { DEFAULT_SETTINGS } from '../client/src/core/Settings';
import { Android } from '../client/src/entities/Android';
import { CHASSIS, PILOT_ANDROID_STATS } from '../client/src/entities/chassis';
import type { MechBase } from '../client/src/entities/MechBase';
import { Vector09 } from '../client/src/entities/Vector09';
import type { ParticleSystem } from '../client/src/fx/ParticleSystem';
import { factorySpec, loadoutKey, parseLoadoutKey, validateLoadout } from '../client/src/hangar/loadout';
import { netWeaponIndex, unitFromMech } from '../client/src/net/adapters';
import { FIXED_DT, PhysicsWorld } from '../client/src/physics/PhysicsWorld';
import { Match } from '../client/src/sim/Match';
import { Writer } from '../shared/net/codec';
import { MAX_EVENTS, MAX_UNITS, NO_UNIT, PROTOCOL_VERSION, ROOM_SIZE, SIM_HZ, SNAPSHOT_HZ } from '../shared/net/constants';
import { EVENT } from '../shared/net/events';
import {
  decodeInputs,
  decodeJoin,
  decodePing,
  encodeEvents,
  encodePong,
  encodeReject,
  encodeRoster,
  encodeSnapshot,
  encodeWelcome,
  messageType,
  MSG,
  newEventBatch,
  newInputPacket,
  newSnapshot,
  type RejectReason,
  type RosterEntry,
  type UnitKind,
} from '../shared/net/messages';
import { NetPilot } from './NetPilot';

/** O outro lado de uma conexão. A sala só manda bytes; o transporte (WebSocket) é do \`Server\`. */
export interface Peer {
  send(bytes: Uint8Array): void;
  close(): void;
}

/** No servidor ninguém vê faísca: as regras chamam o efeito, e ele não faz nada. */
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
/** Ticks entre dois estados mandados (60 Hz / 20 Hz = 3). */
const SNAPSHOT_EVERY = SIM_HZ / SNAPSHOT_HZ;

interface Unit {
  id: number;
  mech: MechBase;
  kind: UnitKind;
  name: string;
  build: string;
}

interface Human extends Unit {
  peer: Peer;
  pilot: NetPilot;
}

/**
 * Uma sala do multiplayer (M3): a partida inteira (\`Match\`, a mesma simulação do jogo) rodando no servidor a 60 Hz,
 * sem tela, sem efeitos e sem destroços (determinística). Os bots do padrão lutam desde o começo; cada jogador
 * que entra ganha um Mech com a montagem dele, validada aqui (G7, G13).
 *
 * Mensagens: \`JOIN\` → \`WELCOME\` e a lista de todos (\`ROSTER\`); \`INPUT\` → fila do piloto; \`PING\` → \`PONG\`;
 * \`LEAVE\` ou queda da conexão → sai da partida. A cada 3 ticks, o estado de todas as unidades para cada jogador,
 * com o \`ack\` dele. Mensagem torta é ignorada: não derruba a sala.
 */
export class ArenaRoom {
  /** Tick da simulação desta sala. */
  tick = 0;
  /** Tempo médio de um tick (ms, média móvel), para o log do servidor e a meta do G14. */
  tickMs = 0;
  private readonly match: Match;
  private readonly units: Unit[] = [];
  private readonly humans = new Map<Peer, Human>();
  private readonly w = new Writer(4096);
  private readonly snapshot = newSnapshot();
  private readonly packet = newInputPacket();
  /** Eventos juntados entre dois estados (tiros e abates), mandados logo depois do estado. */
  private readonly events = newEventBatch();
  /** Sala fechada: o mundo físico foi liberado; mensagens e saídas que ainda chegarem são ignoradas. */
  private disposed = false;

  static async create(code: string): Promise<ArenaRoom> {
    return new ArenaRoom(code, await PhysicsWorld.create());
  }

  private constructor(
    readonly code: string,
    private readonly physics: PhysicsWorld,
  ) {
    this.match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false });
    // Eventos para os clientes desenharem o que o servidor decidiu: cada tiro (o cliente faz o projétil visual)
    // e cada abate (lista de abates).
    this.match.projectiles.onFired = (_origin, dir, owner, w) => this.shot(owner, dir, w);
    this.match.rockets.onFired = (_origin, dir, owner, w) => this.shot(owner, dir, w);
    this.match.onMechKilled = (dead, _at, killer) => this.kill(dead, killer);
    this.match.onPropBroken = (id) => this.propBroken(id);
    this.match.onRoundStart = () => this.arenaReset();
    const mechBuild = loadoutKey(factorySpec('vector09'));
    for (const mech of this.match.bots.mechs) {
      const kind: UnitKind = mech instanceof Vector09 ? 'mech' : this.match.bots.technicianOf(mech) ? 'technician' : 'android';
      this.units.push({ id: this.freeId(), mech, kind, name: this.match.bots.nameOf(mech), build: kind === 'mech' ? mechBuild : `bot.${kind}` });
    }
  }

  get humanCount(): number {
    return this.humans.size;
  }

  /** Uma mensagem de um jogador (bytes crus da conexão). */
  receive(peer: Peer, bytes: Uint8Array): void {
    if (this.disposed) return;
    switch (messageType(bytes)) {
      case MSG.JOIN:
        this.join(peer, bytes);
        return;
      case MSG.INPUT: {
        const h = this.humans.get(peer);
        if (!h || !decodeInputs(bytes, this.packet)) return;
        for (let i = 0; i < this.packet.count; i++) h.pilot.push(this.packet.inputs[i]!);
        return;
      }
      case MSG.PING: {
        const t = decodePing(bytes);
        if (t !== null) peer.send(encodePong(this.w, t, this.tick));
        return;
      }
      case MSG.LEAVE:
        this.leave(peer);
        return;
    }
  }

  /** O jogador saiu (mensagem ou queda da conexão): sai da partida e da lista. */
  leave(peer: Peer): void {
    if (this.disposed) return;
    const h = this.humans.get(peer);
    if (!h) return;
    this.humans.delete(peer);
    this.units.splice(this.units.indexOf(h), 1);
    this.match.pilots.splice(this.match.pilots.indexOf(h.pilot), 1);
    this.match.removePlayer(h.mech);
    this.broadcastRoster();
  }

  /** Um tick da sala; a cada 3, o estado para cada jogador. */
  step(): void {
    if (this.disposed) return;
    const t0 = performance.now();
    this.match.step(FIXED_DT);
    this.tick++;
    if (!this.humans.size) this.events.count = 0;
    else if (this.tick % SNAPSHOT_EVERY === 0) this.broadcastSnapshot();
    this.tickMs += (performance.now() - t0 - this.tickMs) * 0.02;
  }

  /** Onde o servidor diz que está a unidade (pés), para diagnóstico e teste. */
  positionOf(id: number): Readonly<THREE.Vector3> | null {
    for (const u of this.units) if (u.id === id) return u.mech.simPosition;
    return null;
  }

  /** Libera o mundo físico (sala vazia fechando). */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.physics.world.free();
  }

  private join(peer: Peer, bytes: Uint8Array): void {
    if (this.humans.has(peer)) return;
    const m = decodeJoin(bytes);
    if (!m) return this.reject(peer, 'mensagem');
    if (m.protocol !== PROTOCOL_VERSION) return this.reject(peer, 'versao');
    if (this.humans.size >= ROOM_SIZE || this.units.length >= MAX_UNITS) return this.reject(peer, 'cheia');
    const spec = parseLoadoutKey(m.build);
    const check = spec && validateLoadout(spec);
    if (!spec || !check || !check.ok) return this.reject(peer, 'montagem');
    // Servidor não desenha nada (sem blueprint, só física/simulação): qualquer chassi de CHASSIS
    // funciona aqui com os stats certos. Sem isso, um chassi novo (ex.: colossus01) jogava online
    // com os números do Vector-09 por padrão — achado em 29/09 junto com a rejeição de montagem.
    const mech =
      spec.chassis === 'android'
        ? new Android({ stats: PILOT_ANDROID_STATS, tool: 'pilot', loadout: check.loadout })
        : new Vector09({ stats: CHASSIS[spec.chassis], loadout: check.loadout });
    this.match.addPlayer(mech, m.name);
    const pilot = new NetPilot(mech, this.match);
    this.match.pilots.push(pilot);
    const human: Human = { id: this.freeId(), mech, kind: 'human', name: m.name, build: loadoutKey(spec), peer, pilot };
    this.units.push(human);
    this.humans.set(peer, human);
    peer.send(encodeWelcome(this.w, { protocol: PROTOCOL_VERSION, id: human.id, tick: this.tick, simHz: SIM_HZ, snapshotHz: SNAPSHOT_HZ, room: this.code }));
    this.broadcastRoster();
  }

  private reject(peer: Peer, reason: RejectReason): void {
    peer.send(encodeReject(this.w, reason));
    peer.close();
  }

  private idOf(mech: MechBase | undefined): number {
    for (const u of this.units) if (u.mech === mech) return u.id;
    return NO_UNIT;
  }

  private shot(owner: RAPIER.Collider | undefined, dir: THREE.Vector3, w: WeaponStats): void {
    const b = this.events;
    if (!owner || b.count >= MAX_EVENTS) return;
    let id = NO_UNIT;
    for (const u of this.units) if (u.mech.collider === owner) id = u.id;
    if (id === NO_UNIT) return;
    const e = b.list[b.count++]!;
    e.kind = EVENT.SHOT;
    e.unit = id;
    e.index = netWeaponIndex(w.id);
    e.yaw = Math.atan2(-dir.x, -dir.z);
    e.pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
  }

  private kill(dead: MechBase, killer: MechBase | undefined): void {
    const b = this.events;
    if (b.count >= MAX_EVENTS) return;
    const e = b.list[b.count++]!;
    e.kind = EVENT.KILL;
    e.unit = this.idOf(dead);
    e.other = killer ? this.idOf(killer) : NO_UNIT;
  }

  /** Barricada quebrou: o cliente aplica pelo `id`, sem calcular dano. */
  private propBroken(id: number): void {
    const b = this.events;
    if (b.count >= MAX_EVENTS) return;
    const e = b.list[b.count++]!;
    e.kind = EVENT.PROP_BROKEN;
    e.amount = id;
  }

  /** Rodada nova: o cliente restaura as barricadas e limpa destroços; o snapshot seguinte já traz todos vivos. */
  private arenaReset(): void {
    const b = this.events;
    if (b.count >= MAX_EVENTS) return;
    const e = b.list[b.count++]!;
    e.kind = EVENT.ARENA_RESET;
  }

  /** Menor id livre (os ids de quem saiu voltam a valer). */
  private freeId(): number {
    let id = 0;
    while (this.units.some((u) => u.id === id)) id++;
    return id;
  }

  private broadcastRoster(): void {
    const entries: RosterEntry[] = this.units.map(({ id, kind, name, build }) => ({ id, kind, name, build }));
    const bytes = encodeRoster(this.w, entries);
    for (const h of this.humans.values()) h.peer.send(bytes);
  }

  /** O estado de todas as unidades, montado uma vez; só o \`ack\` muda de um jogador para o outro. */
  private broadcastSnapshot(): void {
    const s = this.snapshot;
    s.tick = this.tick;
    s.count = this.units.length;
    for (let i = 0; i < this.units.length; i++) unitFromMech(this.units[i]!.mech, this.units[i]!.id, s.units[i]!);
    for (const h of this.humans.values()) {
      s.ack = h.pilot.ack;
      h.peer.send(encodeSnapshot(this.w, s));
    }
    if (this.events.count) {
      this.events.tick = this.tick;
      const bytes = encodeEvents(this.w, this.events);
      for (const h of this.humans.values()) h.peer.send(bytes);
      this.events.count = 0;
    }
  }
}
