import { BankAccount } from '../client/src/bank/BankAccount';
import { decodeBankCode, encodeBankReply } from '../shared/net/bank';
import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { MOUNTS, type MountId } from '../client/src/combat/mounts';
import type { WeaponStats } from '../client/src/combat/weapons';
import { BOT_SKILLS } from '../client/src/combat/BotController';
import { DEFAULT_SETTINGS } from '../client/src/core/Settings';
import { REGRAS_SEM_LIMITE, type RegrasOnline } from '../shared/regras';
import { Android } from '../client/src/entities/Android';
import { CHASSIS, PILOT_ANDROID_STATS } from '../client/src/entities/chassis';
import type { MechBase, MechPart } from '../client/src/entities/MechBase';
import { Vector09 } from '../client/src/entities/Vector09';
import type { ParticleSystem } from '../client/src/fx/ParticleSystem';
import { factorySpec, loadoutKey, parseLoadoutKey, validateLoadout } from '../client/src/hangar/loadout';
import { netWeaponIndex, unitFromMech } from '../client/src/net/adapters';
import { FIXED_DT, PhysicsWorld } from '../client/src/physics/PhysicsWorld';
import { Match } from '../client/src/sim/Match';
import type { AdminSala } from '../shared/net/admin';
import type { MuralSala } from '../shared/net/mural';
import { Writer } from '../shared/net/codec';
import { MAX_EVENTS, MAX_UNITS, NO_UNIT, PROTOCOL_VERSION, ROOM_SIZE, SIM_HZ, SNAPSHOT_HZ } from '../shared/net/constants';
import { EVENT } from '../shared/net/events';
import { NET_PARTS } from '../shared/net/state';
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
import { VOZ } from '../shared/net/voz';
import { NetPilot } from './NetPilot';
import { RelayDeVoz } from './voz';
import { TEXTO } from '../shared/net/texto';
import { RelayDeTexto } from './texto';

/** O outro lado de uma conexão. A sala só manda bytes; o transporte (WebSocket) é do \`Server\`. */
export interface Peer {
  send(bytes: Uint8Array): void;
  close(): void;
  /** País de quem conectou (código de 2 letras, ou `??`): só para a contagem de origem, nunca para a regra do jogo. */
  readonly pais?: string;
}

/** Rascunho da boca de um encaixe (`mountOf`): nada é criado por tiro (G4). */
const _mount = new THREE.Vector3();
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
  bank: BankAccount;
}

/**
 * Uma sala do multiplayer (M3): a partida inteira (\`Match\`, a mesma simulação do jogo) rodando no servidor a 60 Hz,
 * sem tela, sem efeitos e sem destroços (determinística). Os bots do padrão lutam desde o começo; cada jogador
 * que entra ganha um Mech com a montagem dele, validada aqui (G7, G13).
 *
 * Mensagens: \`JOIN\` → \`WELCOME\` e a lista de todos (\`ROSTER\`); \`INPUT\` → fila do piloto; \`PING\` → \`PONG\`;
 * \`LEAVE\` ou queda da conexão → sai da partida; \`PRONTO\` e \`SINAL\` são do chat de voz (\`voz.ts\`: só repassa, o áudio não passa aqui). A cada 3 ticks, o estado de todas as unidades para cada jogador,
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
  /** A sinalização do chat de voz (P205): só repassa; o áudio vai direto entre os navegadores. */
  private readonly voz = new RelayDeVoz<Peer>((peer, bytes) => peer.send(bytes));
  /** O chat de texto direto entre dois pilotos (P216): só repassa, sem histórico. */
  private readonly texto = new RelayDeTexto<Peer>((peer, bytes) => peer.send(bytes));
  /** Alguém entrou na partida (montagem aceita). O servidor conta a origem; a sala não sabe para quê. */
  onEntrou?: (peer: Peer) => void;
  /** Alguém foi recusado, e por quê. */
  onRecusou?: (peer: Peer, motivo: RejectReason) => void;
  /** Sala fechada: o mundo físico foi liberado; mensagens e saídas que ainda chegarem são ignoradas. */
  private disposed = false;

  /** O servidor sempre passa as regras do dono; quem chama sem elas (os testes e as bancadas) fica com a sala antiga, sem limite de atacantes. */
  static async create(code: string, regras: RegrasOnline = REGRAS_SEM_LIMITE): Promise<ArenaRoom> {
    return new ArenaRoom(code, await PhysicsWorld.create(), regras);
  }

  /** As regras dos bots desta sala (P199): quantos Mechs a sala usa; a dificuldade e a pressão vão direto no `BotSystem`. */
  private regras: RegrasOnline;

  private constructor(
    readonly code: string,
    private readonly physics: PhysicsWorld,
    regras: RegrasOnline,
  ) {
    this.regras = regras;
    // allies: false — o roster de rede ainda não sabe descrever um aliado pros outros jogadores
    // (AUSENTE no multiplayer, ver Match.ts e STATUS_REAL.md); a Arena offline já tem aliado.
    // O pool de Mechs é sempre o cheio (3): quantos entram em campo é a regra (`aplicarRegras`); os andróides são os da regra e valem a partir desta sala.
    this.match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: { ...DEFAULT_SETTINGS, enemyMechs: 3, enemyAndroids: regras.androides }, debris: false, allies: false });
    this.aplicarRegras(regras);
    // Eventos para os clientes desenharem o que o servidor decidiu: cada tiro (o cliente faz o projétil visual)
    // e cada abate (lista de abates).
    this.match.projectiles.onFired = (origin, dir, owner, w) => this.shot(owner, origin, dir, w);
    this.match.rockets.onFired = (origin, dir, owner, w) => this.shot(owner, origin, dir, w);
    this.match.barrage.onFired = (origin, dir, owner, w) => this.shot(owner, origin, dir, w);
    this.match.cruise.onFired = (origin, dir, owner, w) => this.shot(owner, origin, dir, w);
    // A granada manda a direção até a mira (P160): o cliente acha o ponto da mira por ela e refaz o mesmo arco e a mesma carga.
    this.match.grenades.onFired = (origin, dir, owner, w) => this.shot(owner, origin, dir, w);
    this.match.onBeam = (origin, dir, owner, w) => this.shot(owner, origin, dir, w);
    this.match.onWave = (origin, dir, owner, w) => this.shot(owner, origin, dir, w);
    this.match.onHook = (origin, dir, owner, w) => this.shot(owner, origin, dir, w);
    this.match.onMechHit = (e) => this.hit(e.mech, e.shooter, e.result.part, e.result.applied);
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

  /** O que o painel do servidor mostra desta sala (P93): números e os apelidos que os outros jogadores já veem. */
  resumo(): AdminSala {
    const round = this.match.round;
    let bots = 0;
    for (const u of this.units) if (u.kind !== 'human' && !this.match.bots.isReserved(u.mech)) bots++;
    return {
      codigo: this.code,
      jogadores: this.humans.size,
      bots,
      tick: this.tick,
      tickMs: Math.round(this.tickMs * 100) / 100,
      rodada: round.number,
      restanteS: Number.isFinite(round.timeLeft) ? Math.max(0, Math.round(round.timeLeft)) : 0,
      jogando: round.playing,
      nomes: [...this.humans.values()].map((h) => h.name).slice(0, ROOM_SIZE),
    };
  }

  /**
   * O que o mural de câmeras (P88) mostra desta sala: quem está onde, para onde olha e se vive. Preenche um quadro que o servidor reaproveita
   * (G4: nada é criado aqui) e roda só enquanto alguém assiste (a 4 Hz, fora do tick). Não mostra os reservados nem diz nome nenhum.
   */
  muralDe(out: MuralSala): void {
    const round = this.match.round;
    out.codigo = this.code;
    out.jogadores = this.humans.size;
    out.rodada = round.number;
    out.restanteS = Number.isFinite(round.timeLeft) ? Math.max(0, Math.round(round.timeLeft)) : 0;
    out.jogando = round.playing;
    let n = 0;
    for (const u of this.units) {
      if (n >= out.unidades.length) break;
      if (this.match.bots.isReserved(u.mech)) continue;
      const m = out.unidades[n++]!;
      const p = u.mech.simPosition;
      m.tipo = u.kind;
      m.x = p.x;
      m.z = p.z;
      m.yaw = u.mech.yaw;
      m.vida = u.mech.modules.torso / u.mech.stats.maxModuleHealth.torso;
      m.viva = u.mech.alive;
    }
    out.n = n;
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
      case MSG.BANK: {
        const h = this.humans.get(peer), code = decodeBankCode(bytes);
        if (h && code !== null) peer.send(encodeBankReply(this.w, h.bank.redeem(code, h.mech, this.tick)));
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
      case VOZ.PRONTO: {
        const h = this.humans.get(peer);
        if (h) this.voz.pronto(peer, h.id, bytes);
        return;
      }
      case VOZ.SINAL:
        this.voz.sinal(peer, bytes);
        return;
      case TEXTO.ENVIAR: {
        const h = this.humans.get(peer);
        if (h) this.texto.mensagem(peer, h.id, bytes, (id) => this.pessoa(id));
        return;
      }
    }
  }

  /** A conexão da pessoa (não bot) com este id na sala, ou `undefined`: o destino do chat de texto. */
  private pessoa(id: number): Peer | undefined {
    for (const h of this.humans.values()) if (h.id === id) return h.peer;
    return undefined;
  }

  /** O jogador saiu (mensagem ou queda da conexão): sai da partida e da lista. */
  leave(peer: Peer): void {
    if (this.disposed) return;
    const h = this.humans.get(peer);
    if (!h) return;
    this.voz.sairDaSala(peer);
    this.texto.sairDaSala(peer);
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

  /** O Mech desta unidade no servidor, para diagnóstico e teste (ver ou aplicar um estado de fogo, choque ou gelo). */
  mechOf(id: number): MechBase | null {
    for (const u of this.units) if (u.id === id) return u.mech;
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
    const human: Human = { id: this.freeId(), mech, kind: 'human', name: m.name, build: loadoutKey(spec), peer, pilot, bank: new BankAccount() };
    this.units.push(human);
    this.humans.set(peer, human);
    peer.send(encodeWelcome(this.w, { protocol: PROTOCOL_VERSION, id: human.id, tick: this.tick, simHz: SIM_HZ, snapshotHz: SNAPSHOT_HZ, room: this.code }));
    this.broadcastRoster();
    this.onEntrou?.(peer);
  }

  private reject(peer: Peer, reason: RejectReason): void {
    this.onRecusou?.(peer, reason);
    peer.send(encodeReject(this.w, reason));
    peer.close();
  }

  private idOf(mech: MechBase | undefined): number {
    for (const u of this.units) if (u.mech === mech) return u.id;
    return NO_UNIT;
  }

  /**
   * De qual encaixe do corpo saiu um tiro: o mais perto da origem entre os que o chassi usa nos dois botões. O tiro nasce na boca do encaixe (a mesma conta do
   * simMuzzle), então a distância é ~0 no encaixe certo e de metros nos outros. O outro jogador desenha o tiro dali (antes: sempre da mão direita).
   */
  private mountOf(mech: MechBase, origin: THREE.Vector3): number {
    const t = mech.triggers;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < MOUNTS.length; i++) {
      const m: MountId = MOUNTS[i]!;
      if (!t.primary.includes(m) && !t.secondary.includes(m)) continue;
      const d = mech.simMuzzle(_mount, m).distanceToSquared(origin);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  private shot(owner: RAPIER.Collider | undefined, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats): void {
    // A rotatória (20 tiros/s) não manda um evento por tiro: a bandeira `fx` de "cano girando" faz os outros jogadores desenharem o fluxo.
    if (w.spin) return;
    const b = this.events;
    if (!owner || b.count >= MAX_EVENTS) return;
    let id = NO_UNIT;
    let shooter: MechBase | undefined;
    for (const u of this.units) if (u.mech.collider === owner) { id = u.id; shooter = u.mech; }
    if (id === NO_UNIT || !shooter) return;
    const e = b.list[b.count++]!;
    e.kind = EVENT.SHOT;
    e.unit = id;
    e.index = netWeaponIndex(w.id);
    e.other = this.mountOf(shooter, origin);
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

  /**
   * Acerto em Mech: o dano já foi aplicado pela simulação (projétil, foguete, serra ou pisão); o evento só conta
   * aos clientes quem levou, de quem, em qual parte e quanto. Não existe segunda via de dano.
   */
  private hit(target: MechBase, shooter: MechBase | undefined, part: MechPart, damage: number): void {
    const b = this.events;
    if (b.count >= MAX_EVENTS) return;
    const e = b.list[b.count++]!;
    e.kind = EVENT.HIT;
    e.unit = this.idOf(target);
    e.other = this.idOf(shooter);
    e.index = NET_PARTS.indexOf(part);
    e.amount = Math.min(65535, Math.round(damage));
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

  /**
   * As regras do dono (P199), na hora e com a sala de pé: a dificuldade e a pressão valem no próximo tick; o número de Mechs vale já (o excedente vira reserva). Os andróides só mudam nas salas novas.
   */
  aplicarRegras(r: RegrasOnline): void {
    this.regras = r;
    this.match.bots.setSkill(BOT_SKILLS[r.dificuldade]);
    this.match.bots.maxAttackers = r.atacantes;
    if (!this.disposed && this.units.length > 0) this.broadcastRoster();
  }

  private broadcastRoster(): void {
    this.match.bots.setMechCapacity(Math.min(ROOM_SIZE - this.humans.size, this.regras.mechs));
    const entries: RosterEntry[] = this.units.filter(u => !this.match.bots.isReserved(u.mech)).map(({ id, kind, name, build }) => ({ id, kind, name, build }));
    const bytes = encodeRoster(this.w, entries);
    for (const h of this.humans.values()) h.peer.send(bytes);
  }

  /** O estado de todas as unidades, montado uma vez; só o \`ack\` muda de um jogador para o outro. */
  private broadcastSnapshot(): void {
    const s = this.snapshot;
    s.tick = this.tick;
    s.count = 0;
    for (const u of this.units) {
      if (!this.match.bots.isReserved(u.mech)) unitFromMech(u.mech, u.id, s.units[s.count++]!);
    }
    for (const h of this.humans.values()) {
      s.ack = h.pilot.ack;
      s.energy = h.mech.energyShield.fraction;
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
