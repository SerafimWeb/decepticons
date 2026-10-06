import type { BankReply } from '../../../shared/bank/codes';
import * as THREE from 'three';
import { INPUTS_PER_PACKET, NO_UNIT, SIM_HZ } from '../../../shared/net/constants';
import { EVENT, type NetEvent } from '../../../shared/net/events';
import { newNetInput } from '../../../shared/net/input';
import { newSnapshot, type EventBatch, type RosterEntry, type Snapshot } from '../../../shared/net/messages';
import type { UnitState } from '../../../shared/net/state';
import { weapon } from '../combat/weapons';
import type { MechBase, MechInput } from '../entities/MechBase';
import type { Match, Pilot } from '../sim/Match';
import { netInputFromMech, weaponFromNet } from './adapters';
import { NetClient } from './NetClient';

/** Os robôs dos outros são desenhados este tanto no passado: dois estados de folga para a rede oscilar. */
const INTERP_MS = 100;
/** Histórico da previsão do próprio Mech, em ticks (~4 s). */
const HISTORY = 256;
/** Erro de previsão acima disto (m): pula para onde o servidor diz. Abaixo de MIN_ERROR, ignora. */
const SNAP_ERROR = 3;
const MIN_ERROR = 0.03;
/** Fração da correção aplicada por tick: o Mech escorrega para o lugar certo, sem teleporte visível. */
const CORRECT_RATE = 0.2;
/** Estados guardados para interpolar (~1,6 s a 20 Hz). */
const SNAPSHOTS = 32;
/** Calor previsto só é trocado pelo do servidor se errar mais que isto. */
const HEAT_TOLERANCE = 0.2;

/** Quem pilota o Mech local: o comando do último tick e os gatilhos (o `PlayerController`). */
export interface Commander {
  readonly command: Readonly<MechInput>;
  readonly firing: boolean;
  readonly secondaryHeld: boolean;
}

/** Para onde a mira aponta: ângulos da câmera e o ponto no mundo sob a mira. */
export interface AimSource {
  readonly yaw: number;
  readonly pitch: number;
  readonly point: THREE.Vector3;
}

export interface OnlineStatus {
  state: 'conectando' | 'na sala' | 'recusado' | 'caiu';
  room: string;
  rttMs: number;
  /** Pessoas na sala (sem contar os bots). */
  players: number;
  reason?: string;
}

export interface OnlineSessionOptions {
  url: string;
  room: string;
  name: string;
  /** Montagem do Hangar (`loadoutKey`). */
  build: string;
  /** A partida local: sem bots, sem dano (quem decide é o servidor) e sem rodada própria. */
  match: Match;
  me: MechBase;
  commander: Commander;
  aim?: () => AimSource | null;
  /** Monta o robô de um participante remoto (modelo e cores são da tela). */
  makeUnit: (entry: RosterEntry) => MechBase;
  scene: THREE.Scene;
  onStatus?: (s: OnlineStatus) => void;
  onBank?: (reply: BankReply) => void;
  onDamage?: (amount: number) => void;
  onRoundEnd?: () => void;
  onKill?: (killer: string | null, dead: string, meInvolved: boolean) => void;
  /** Placar do jogador local (o servidor não conta a rodada offline; a gente conta pelos eventos KILL). */
  onScore?: (kills: number, deaths: number) => void;
}

/** Linha do placar do multiplayer, montada só com os eventos KILL vindos do servidor. */
export interface OnlineStanding {
  id: number;
  name: string;
  kills: number;
  deaths: number;
}

interface Remote {
  mech: MechBase;
  kind: RosterEntry['kind'];
  build: string;
  /** Já recebeu uma pose (antes disso fica escondido). */
  placed: boolean;
}

interface Stored {
  tick: number;
  s: Snapshot;
}

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _aimPoint = new THREE.Vector3();
const _mouth = new THREE.Vector3();
const HIDDEN = new THREE.Vector3(0, -200, 0);

/**
 * O jogo online (M4). Entra como mais um piloto da partida local (G3), logo depois do jogador:
 * - **o seu Mech** continua sendo previsto na hora pelo jogo; o comando de cada tick vai para o servidor e fica no
 *   histórico. Quando o estado chega com o \`ack\`, compara o que o servidor calculou com o que foi previsto naquele
 *   tick e corrige a diferença aos poucos (acima de 3 m, pula). Vida, morte e renascimento são os do servidor;
 * - **os outros robôs** (bots e pessoas) são desenhados 100 ms no passado, interpolando entre dois estados, sem
 *   rodar o character controller (G6);
 * - **tiros dos outros** chegam como evento e viram o projétil visual saindo da boca do robô; **abates**, a lista.
 * Nada alocado por tick ou por quadro nos caminhos normais (G4).
 */
export class OnlineSession implements Pilot {
  /** Tick local (o número de cada comando mandado). */
  tick = 0;
  myId = -1;
  rttMs = 0;
  /** Tiros de outros robôs desenhados (diagnóstico e teste). */
  shotsSeen = 0;
  readonly remotes = new Map<number, Remote>();
  private readonly client: NetClient;
  private readonly names = new Map<number, string>();
  /** Placar acumulado por unidade (só monta com os KILL do servidor; nunca invade a simulação). */
  private readonly scores = new Map<number, { kills: number; deaths: number }>();
  private humans = 0;
  private state: OnlineStatus['state'] = 'conectando';
  private reason: string | undefined;
  private readonly histTick = new Int32Array(HISTORY).fill(-1);
  private readonly histPos = new Float32Array(HISTORY * 3);
  private readonly correction = new THREE.Vector3();
  private readonly inputs = Array.from({ length: INPUTS_PER_PACKET }, newNetInput);
  private buffered = 0;
  private readonly snaps: Stored[] = Array.from({ length: SNAPSHOTS }, () => ({ tick: -1, s: newSnapshot() }));
  private newest = -1;
  /** Relógio do servidor visto daqui: ms do servidor ≈ agora + offset. */
  private clockOffset = Number.NaN;

  redeemBank(code: string): boolean { return this.joined && this.client.redeemBank(code); }

  constructor(private readonly o: OnlineSessionOptions) {
    this.client = new NetClient(o.url, {
      bank: (reply) => o.onBank?.(reply),
      welcome: (m) => {
        this.myId = m.id;
        this.state = 'na sala';
        this.status();
      },
      roster: (entries) => this.onRoster(entries),
      snapshot: (s) => this.onSnapshot(s),
      events: (b) => this.onEvents(b),
      pong: (ms) => {
        this.rttMs = ms;
        this.status();
      },
      reject: (reason) => {
        this.state = 'recusado';
        this.reason = reason;
        this.status();
      },
      closed: () => {
        if (this.state !== 'recusado') this.state = 'caiu';
        this.status();
      },
    });
    this.client.join(o.name, o.build);
    this.status();
  }

  /** Na sala e recebendo o estado. */
  get joined(): boolean {
    return this.myId >= 0;
  }

  /** Um tick da partida local, depois do jogador: guarda a previsão, manda o comando e aplica a correção. */
  fixedUpdate(): void {
    if (!this.joined) return;
    const me = this.o.me;
    this.tick++;
    if (me.alive && this.correction.lengthSq() > 1e-8) {
      _d.copy(this.correction).multiplyScalar(CORRECT_RATE);
      me.nudge(_d.x, _d.y, _d.z);
      this.correction.sub(_d);
    }
    // A previsão guardada já conta a correção que ainda falta aplicar: é onde o Mech vai estar.
    const i = this.tick % HISTORY;
    const p = me.simPosition;
    this.histTick[i] = this.tick;
    this.histPos[i * 3] = p.x + this.correction.x;
    this.histPos[i * 3 + 1] = p.y + this.correction.y;
    this.histPos[i * 3 + 2] = p.z + this.correction.z;

    const c = this.o.commander;
    const input = netInputFromMech(this.tick, c.command, 0, c.firing, c.secondaryHeld, this.inputs[this.buffered]!);
    this.aimInput(input);
    if (++this.buffered === INPUTS_PER_PACKET) {
      this.client.sendInputs(this.inputs, this.buffered);
      this.buffered = 0;
    }
    if (this.tick % SIM_HZ === 0) this.client.ping();
  }

  /**
   * Por quadro: os robôs dos outros na pose de 100 ms atrás, interpolada entre os dois estados em volta.
   * \`nowMs\` = \`performance.now()\`.
   */
  render(dt: number, nowMs: number): void {
    if (this.newest < 0 || Number.isNaN(this.clockOffset)) return;
    const renderTick = ((nowMs + this.clockOffset - INTERP_MS) * SIM_HZ) / 1000;
    let a: Stored | null = null;
    let b: Stored | null = null;
    for (const st of this.snaps) {
      if (st.tick < 0) continue;
      if (st.tick <= renderTick && (!a || st.tick > a.tick)) a = st;
      if (st.tick > renderTick && (!b || st.tick < b.tick)) b = st;
    }
    const from = a ?? b!;
    const to = b ?? a!;
    const span = to.tick - from.tick;
    const t = span > 0 ? Math.min(1, Math.max(0, (renderTick - from.tick) / span)) : 1;
    for (const [id, r] of this.remotes) {
      const ub = findUnit(to.s, id) ?? findUnit(from.s, id);
      if (!ub) continue;
      const ua = findUnit(from.s, id) ?? ub;
      const m = r.mech;
      const x = ua.x + (ub.x - ua.x) * t;
      const y = ua.y + (ub.y - ua.y) * t;
      const z = ua.z + (ub.z - ua.z) * t;
      const secs = span > 0 ? span / SIM_HZ : 1;
      m.setNetPose(x, y, z, lerpAngle(ua.yaw, ub.yaw, t), ua.pitch + (ub.pitch - ua.pitch) * t, (ub.x - ua.x) / secs, (ub.z - ua.z) / secs, ub.grounded);
      m.applyNetVitals(ub.parts, null, ub.alive);
      m.weaponCharging = ub.charging ?? false;
      m.energyShield.active = ub.shield ?? false;
      r.placed = true;
      m.render(dt, 1);
    }
  }

  /** Sai da sala e tira os robôs dos outros da cena. */
  dispose(): void {
    this.client.close();
    for (const id of [...this.remotes.keys()]) this.removeRemote(id);
  }

  // ---------- mensagens ----------

  private onRoster(entries: RosterEntry[]): void {
    this.humans = 0;
    const present = new Set<number>();
    for (const e of entries) {
      this.names.set(e.id, e.name);
      if (e.kind === 'human') this.humans++;
      if (e.id === this.myId) continue;
      present.add(e.id);
      const r = this.remotes.get(e.id);
      if (r && r.kind === e.kind && r.build === e.build) continue;
      if (r) this.removeRemote(e.id);
      const mech = this.o.makeUnit(e);
      mech.spawn(this.o.match.physics, HIDDEN);
      mech.root.visible = false;
      this.o.scene.add(mech.root);
      this.remotes.set(e.id, { mech, kind: e.kind, build: e.build, placed: false });
    }
    for (const id of [...this.remotes.keys()]) if (!present.has(id)) this.removeRemote(id);
    this.status();
  }

  private removeRemote(id: number): void {
    const r = this.remotes.get(id);
    if (!r) return;
    this.remotes.delete(id);
    this.o.scene.remove(r.mech.root);
    r.mech.despawn(this.o.match.physics);
  }

  private onSnapshot(s: Snapshot): void {
    // Guarda uma cópia (o objeto do cliente é reaproveitado na próxima mensagem).
    this.newest = (this.newest + 1) % SNAPSHOTS;
    const slot = this.snaps[this.newest]!;
    slot.tick = s.tick;
    copySnapshot(s, slot.s);
    const sample = (s.tick * 1000) / SIM_HZ - performance.now();
    this.clockOffset = Number.isNaN(this.clockOffset) ? sample : this.clockOffset + (sample - this.clockOffset) * 0.1;

    const u = findUnit(s, this.myId);
    if (u) this.reconcile(u, s.ack, s.energy ?? 0);
  }

  /** O seu Mech: vida e morte do servidor; posição corrigida pelo que foi previsto no tick do \`ack\`. */
  private reconcile(u: UnitState, ack: number, energy: number): void {
    const me = this.o.me;
    if (u.alive && !me.alive) {
      // Renasceu no servidor: começa de novo onde ele diz.
      me.respawn(_o.set(u.x, u.y, u.z));
      this.correction.set(0, 0, 0);
      this.histTick.fill(-1);
    }
    me.applyNetVitals(u.parts, Math.abs(u.heat - me.heat) > HEAT_TOLERANCE ? u.heat : null, u.alive);
    me.energyShield.applyNet(energy, u.shield ?? false);
    if (!u.alive) return;
    const i = ack % HISTORY;
    if (this.histTick[i] !== ack) return;
    const ex = u.x - this.histPos[i * 3]!;
    const ey = u.y - this.histPos[i * 3 + 1]!;
    const ez = u.z - this.histPos[i * 3 + 2]!;
    const err = Math.hypot(ex, ey, ez);
    if (err < MIN_ERROR) return;
    if (err > SNAP_ERROR) {
      me.nudge(ex + this.correction.x, ey + this.correction.y, ez + this.correction.z);
      this.correction.set(0, 0, 0);
    } else this.correction.set(this.correction.x + ex, this.correction.y + ey, this.correction.z + ez);
    // O que foi previsto depois do ack partiu do lugar errado: desloca junto.
    for (let k = 0; k < HISTORY; k++) {
      if (this.histTick[k]! <= ack) continue;
      this.histPos[k * 3] += ex;
      this.histPos[k * 3 + 1] += ey;
      this.histPos[k * 3 + 2] += ez;
    }
  }

  private onEvents(b: EventBatch): void {
    for (let i = 0; i < b.count; i++) {
      const e = b.list[i]!;
      if (e.kind === EVENT.SHOT) this.remoteShot(e);
      else if (e.kind === EVENT.HIT && e.other === this.myId && e.unit !== this.myId) this.o.onDamage?.(e.amount);
      else if (e.kind === EVENT.KILL) {
        const dead = e.unit === this.myId ? 'VOCÊ' : (this.names.get(e.unit) ?? 'INIMIGO');
        const killer = e.other === NO_UNIT ? null : e.other === this.myId ? 'VOCÊ' : (this.names.get(e.other) ?? null);
        this.o.onKill?.(killer, dead, e.unit === this.myId || e.other === this.myId);
        this.recordKill(e.unit, e.other);
      } else if (e.kind === EVENT.PROP_BROKEN) {
        this.o.match.destructibles.breakById(e.amount);
      } else if (e.kind === EVENT.ARENA_RESET) {
        // O servidor iniciou uma rodada nova: as barricadas voltam e o placar zera.
        this.o.onRoundEnd?.();
        this.o.match.destructibles.restoreAll();
        this.o.match.debris.clear();
        this.scores.clear();
        this.o.onScore?.(0, 0);
      }
    }
  }

  /** KILL vindo do servidor: um a mais para quem derrubou (se foi outro), um a mais para quem caiu. */
  private recordKill(deadId: number, killerId: number): void {
    const dead = this.rowFor(deadId);
    dead.deaths++;
    if (killerId !== NO_UNIT && killerId !== deadId) this.rowFor(killerId).kills++;
    if (this.myId >= 0) {
      const me = this.scores.get(this.myId);
      this.o.onScore?.(me?.kills ?? 0, me?.deaths ?? 0);
    }
  }

  private rowFor(id: number): { kills: number; deaths: number } {
    let row = this.scores.get(id);
    if (!row) {
      row = { kills: 0, deaths: 0 };
      this.scores.set(id, row);
    }
    return row;
  }

  /** Placar da sala: quem mais abateu no topo; empate, quem menos morreu; depois, id crescente. */
  standings(): OnlineStanding[] {
    const rows: OnlineStanding[] = [];
    for (const [id, name] of this.names) {
      const s = this.scores.get(id);
      rows.push({ id, name, kills: s?.kills ?? 0, deaths: s?.deaths ?? 0 });
    }
    rows.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.id - b.id);
    return rows;
  }

  /** O tiro de outro robô: o projétil visual sai da boca dele, na direção que o servidor mandou. */
  private remoteShot(e: NetEvent): void {
    if (e.unit === this.myId) return;
    const r = this.remotes.get(e.unit);
    const id = weaponFromNet(e.index);
    if (!r || !r.placed || !r.mech.alive || !id || id === 'chainsaw') return;
    r.mech.simMuzzle(_o, id === 'barrage' ? r.mech.triggers.secondary[0] : 'rightHand');
    _d.set(-Math.sin(e.yaw) * Math.cos(e.pitch), Math.sin(e.pitch), -Math.cos(e.yaw) * Math.cos(e.pitch));
    if (id === 'barrage') {
      // O evento traz a direção, não o ponto: acha onde o raio bate (o servidor fez o mesmo) e joga a chuva ali. Só desenho (dano é do servidor).
      const hit = this.o.match.physics.raycast(_o, _d, 400, r.mech.collider);
      _aimPoint.copy(_o).addScaledVector(_d, hit ? hit.distance : 400);
      this.o.match.barrage.fire(_o, _d, _aimPoint, r.mech.collider, weapon('barrage'), 0, r.mech.barrageMouth(_mouth));
      r.mech.onFireSecondary();
    } else if (id === 'rockets') {
      this.o.match.rockets.fire(_o, _d, r.mech.collider, weapon('rockets'));
      r.mech.onFireSecondary();
    } else {
      this.o.match.projectiles.fire(_o, _d, r.mech.collider, true, weapon(id));
      r.mech.onFire();
    }
    this.shotsSeen++;
  }

  /**
   * A mira do comando: da boca do Mech (pela simulação, como o servidor faz) até o ponto sob a mira da câmera. Assim
   * o tiro no servidor vai onde a mira está, mesmo com a câmera atrás do ombro.
   */
  private aimInput(input: { yaw: number; pitch: number }): void {
    const aim = this.o.aim?.();
    if (!aim) return;
    input.yaw = aim.yaw;
    input.pitch = aim.pitch;
    this.o.me.simMuzzle(_o);
    _d.subVectors(aim.point, _o);
    _fwd.set(-Math.sin(aim.yaw) * Math.cos(aim.pitch), Math.sin(aim.pitch), -Math.cos(aim.yaw) * Math.cos(aim.pitch));
    const len = _d.length();
    if (len < 1e-3 || _d.dot(_fwd) < 3) return; // alvo atrás da boca: atira reto, como no jogo offline
    input.yaw = Math.atan2(-_d.x, -_d.z);
    input.pitch = Math.asin(_d.y / len);
  }

  private status(): void {
    this.o.onStatus?.({ state: this.state, room: this.o.room, rttMs: this.rttMs, players: this.humans, reason: this.reason });
  }
}

function findUnit(s: Snapshot, id: number): UnitState | null {
  for (let i = 0; i < s.count; i++) if (s.units[i]!.id === id) return s.units[i]!;
  return null;
}

function copySnapshot(from: Snapshot, to: Snapshot): void {
  to.tick = from.tick;
  to.ack = from.ack;
  to.energy = from.energy;
  to.count = from.count;
  for (let i = 0; i < from.count; i++) {
    const a = from.units[i]!;
    const b = to.units[i]!;
    b.id = a.id;
    b.x = a.x;
    b.y = a.y;
    b.z = a.z;
    b.yaw = a.yaw;
    b.pitch = a.pitch;
    Object.assign(b.parts, a.parts);
    b.heat = a.heat;
    b.alive = a.alive;
    b.grounded = a.grounded;
    b.dashing = a.dashing;
    b.overheated = a.overheated;
    b.charging = a.charging;
    b.shield = a.shield;
  }
}

/** Interpola dois ângulos pelo lado mais curto. */
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
