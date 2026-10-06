import RAPIER from '@dimforge/rapier3d-simd-compat';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import * as THREE from 'three';
import type { MechBase } from '../client/src/entities/MechBase';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION, ROOM_SIZE, SNAPSHOT_HZ, SIM_HZ } from '../shared/net/constants';
import { EVENT } from '../shared/net/events';
import { hitDamage, weapon } from '../client/src/combat/weapons';
import { netWeaponIndex } from '../client/src/net/adapters';
import { factorySpec, loadoutKey } from '../client/src/hangar/loadout';
import { newNetInput, type NetInput } from '../shared/net/input';
import { NET_PARTS } from '../shared/net/state';
import {
  decodeEvents,
  decodeReject,
  decodeRoster,
  decodeSnapshot,
  decodeWelcome,
  encodeInputs,
  encodeJoin,
  encodeLeave,
  encodePing,
  decodePong,
  messageType,
  MSG,
  newEventBatch,
  newSnapshot,
  type Snapshot,
} from '../shared/net/messages';
import { ArenaRoom, type Peer } from './ArenaRoom';
import { roomCode, startServer, type GameServer } from './Server';

const MECH_BUILD = 'v1.vector09.plasma-0.rockets-0';

/** Um jogador de mentira: guarda cópias do que o servidor manda. */
class FakePeer implements Peer {
  readonly got: Uint8Array[] = [];
  closed = false;
  send(bytes: Uint8Array): void {
    this.got.push(new Uint8Array(bytes));
  }
  close(): void {
    this.closed = true;
  }
  of(type: number): Uint8Array[] {
    return this.got.filter((b) => messageType(b) === type);
  }
  lastSnapshot(): Snapshot {
    const s = newSnapshot();
    expect(decodeSnapshot(this.of(MSG.SNAPSHOT).at(-1)!, s)).toBe(true);
    return s;
  }
}

const w = new Writer();
const join = (name = 'DAN', build = MECH_BUILD, protocol = PROTOCOL_VERSION) => new Uint8Array(encodeJoin(w, { protocol, name, build }));
const inputs = (first: number, count: number, o: Partial<NetInput> = {}) =>
  new Uint8Array(encodeInputs(w, Array.from({ length: count }, (_, i) => ({ ...newNetInput(), ...o, tick: first + i })), count));

describe('M3: a sala do servidor', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('entrar: boas-vindas com o id, e a lista com o jogador e os bots da partida (Mechs, andróides, técnico)', async () => {
    const room = await ArenaRoom.create('TESTE');
    const dan = new FakePeer();
    room.receive(dan, join('Dan'));
    const welcome = decodeWelcome(dan.of(MSG.WELCOME)[0]!)!;
    expect(welcome).toMatchObject({ protocol: PROTOCOL_VERSION, simHz: SIM_HZ, snapshotHz: SNAPSHOT_HZ, room: 'TESTE' });
    const roster = decodeRoster(dan.of(MSG.ROSTER)[0]!)!;
    expect(roster.find((e) => e.id === welcome.id)).toMatchObject({ kind: 'human', name: 'Dan', build: MECH_BUILD });
    expect(roster.filter((e) => e.kind === 'mech').length).toBe(3);
    expect(roster.filter((e) => e.kind === 'android').length).toBe(2);
    expect(roster.filter((e) => e.kind === 'technician').map((e) => e.name)).toEqual(['ENTRÓPICO']);
    room.dispose();
  });

  it('recusa: montagem adulterada, versão diferente e sala cheia (8 jogadores)', async () => {
    const room = await ArenaRoom.create('CHEIA');
    const cheat = new FakePeer();
    room.receive(cheat, join('X', 'v1.vector09.plasma-2.rockets-2')); // não cabe na carga
    expect(decodeReject(cheat.got[0]!)).toBe('montagem');
    expect(cheat.closed).toBe(true);
    const old = new FakePeer();
    room.receive(old, join('Y', MECH_BUILD, PROTOCOL_VERSION + 1));
    expect(decodeReject(old.got[0]!)).toBe('versao');
    for (let i = 0; i < ROOM_SIZE; i++) room.receive(new FakePeer(), join(`P${i}`));
    expect(room.humanCount).toBe(ROOM_SIZE);
    const late = new FakePeer();
    room.receive(late, join('Z'));
    expect(decodeReject(late.got[0]!)).toBe('cheia');
    room.dispose();
  });

  it('o servidor decide: os comandos andam com o Mech, o estado sai a 20 Hz com o ack, e atirar esquenta', async () => {
    const room = await ArenaRoom.create('ANDA');
    const dan = new FakePeer();
    room.receive(dan, join());
    const me = decodeWelcome(dan.of(MSG.WELCOME)[0]!)!.id;
    room.step();
    room.step();
    room.step();
    const start = dan.lastSnapshot().units.find((u) => u.id === me)!;
    const z0 = start.z;
    // 1 s de "para a frente" (yaw 0: frente é -Z), em pacotes de 2 ticks, como o cliente manda.
    for (let t = 1; t <= SIM_HZ; t += 2) {
      room.receive(dan, inputs(t, 2, { moveZ: 1 }));
      room.step();
      room.step();
    }
    const snaps = dan.of(MSG.SNAPSHOT).length;
    expect(snaps).toBe(Math.floor(room.tick / (SIM_HZ / SNAPSHOT_HZ)));
    const moved = dan.lastSnapshot();
    const unit = moved.units.find((u) => u.id === me)!;
    expect(z0 - unit.z).toBeGreaterThan(4); // andou para a frente (a 9 m/s, menos a arrancada)
    expect(moved.ack).toBe(SIM_HZ);
    // Gatilho apertado: o plasma sai e o calor sobe (só o servidor calcula o calor).
    for (let t = SIM_HZ + 1; t <= SIM_HZ + 30; t += 2) {
      room.receive(dan, inputs(t, 2, { fire: true }));
      room.step();
      room.step();
    }
    expect(dan.lastSnapshot().units.find((u) => u.id === me)!.heat).toBeGreaterThan(0.2);
    room.dispose();
  });

  it('comando repetido ou velho não é aplicado de novo; mensagem torta não derruba a sala; ping responde', async () => {
    const room = await ArenaRoom.create('RUIDO');
    const dan = new FakePeer();
    room.receive(dan, join());
    room.receive(dan, inputs(1, 2, { moveZ: 1 }));
    room.receive(dan, inputs(1, 2, { moveZ: 1 })); // repetido
    room.receive(dan, new Uint8Array([MSG.INPUT, 1, 2, 3])); // cortado
    room.receive(dan, new Uint8Array([200, 1, 2])); // tipo desconhecido
    for (let i = 0; i < 6; i++) room.step();
    expect(dan.lastSnapshot().ack).toBe(2);
    room.receive(dan, new Uint8Array(encodePing(w, 777)));
    expect(decodePong(dan.of(MSG.PONG)[0]!)).toEqual({ clientTime: 777, tick: room.tick });
    room.dispose();
  });

  it('sem comando novo (pausa, rede travada), o Mech para: não anda sozinho no servidor', async () => {
    const room = await ArenaRoom.create('PARADO');
    const dan = new FakePeer();
    room.receive(dan, join());
    const me = decodeWelcome(dan.of(MSG.WELCOME)[0]!)!.id;
    room.receive(dan, inputs(1, 8, { moveZ: 1 }));
    for (let i = 0; i < 40; i++) room.step(); // 8 comandos e 32 ticks sem nada
    const z1 = room.positionOf(me)!.z;
    for (let i = 0; i < 30; i++) room.step();
    expect(Math.abs(room.positionOf(me)!.z - z1)).toBeLessThan(0.05);
    room.dispose();
  });

  it('sair: o Mech sai da partida e da lista de todos; o id volta a valer', async () => {
    const room = await ArenaRoom.create('SAIDA');
    const a = new FakePeer();
    const b = new FakePeer();
    room.receive(a, join('A'));
    room.receive(b, join('B'));
    const idA = decodeWelcome(a.of(MSG.WELCOME)[0]!)!.id;
    room.receive(a, new Uint8Array(encodeLeave(w)));
    for (let i = 0; i < 3; i++) room.step();
    expect(room.humanCount).toBe(1);
    expect(decodeRoster(b.of(MSG.ROSTER).at(-1)!)!.some((e) => e.id === idA)).toBe(false);
    expect(b.lastSnapshot().units.slice(0, b.lastSnapshot().count).some((u) => u.id === idA)).toBe(false);
    const c = new FakePeer();
    room.receive(c, join('C'));
    expect(decodeWelcome(c.of(MSG.WELCOME)[0]!)!.id).toBe(idA);
    room.dispose();
  });

  it('código da sala: do endereço, em maiúsculas; sem código, a ARENA; inválido, recusado', () => {
    expect(roomCode('/?sala=k7q2')).toBe('K7Q2');
    expect(roomCode('/')).toBe('ARENA');
    expect(roomCode('/?sala=<script>')).toBeNull();
  });
});

interface TestUnit {
  id: number;
  kind: string;
  mech: MechBase;
}

/** Os acertos (HIT) que chegaram a este jogador, na ordem. */
function hitsSeen(peer: FakePeer): { unit: number; other: number; index: number; amount: number }[] {
  const out: { unit: number; other: number; index: number; amount: number }[] = [];
  const batch = newEventBatch();
  for (const bytes of peer.of(MSG.EVENTS)) {
    expect(decodeEvents(bytes, batch)).toBe(true);
    for (let i = 0; i < batch.count; i++) {
      const e = batch.list[i]!;
      if (e.kind === EVENT.HIT) out.push({ unit: e.unit, other: e.other, index: e.index, amount: e.amount });
    }
  }
  return out;
}

const lifeOf = (m: MechBase) => Object.values(m.modules).reduce((a, b) => a + b, 0);

describe('M5: o acerto é decidido pelo servidor e vira evento HIT', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('o evento HIT leva quem levou, de quem, a parte e o dano', async () => {
    const room = await ArenaRoom.create('HITEVT');
    const dan = new FakePeer();
    room.receive(dan, join('Dan'));
    const me = decodeWelcome(dan.of(MSG.WELCOME)[0]!)!.id;
    const units = room['units'] as TestUnit[];
    const bot = units.find((u) => u.kind === 'mech')!;
    const mine = units.find((u) => u.id === me)!;
    room['match'].onMechHit?.({ mech: bot.mech, shooter: mine.mech, result: { part: 'leftArm', applied: 37, partDestroyed: false, killed: false } });
    for (let i = 0; i < 3; i++) room.step();
    expect(hitsSeen(dan)).toContainEqual({ unit: bot.id, other: me, index: NET_PARTS.indexOf('leftArm'), amount: 37 });
    room.dispose();
  });

  it('um tiro real acerta o alvo uma vez só, e o evento HIT conta exatamente a vida que o alvo perdeu', async () => {
    const room = await ArenaRoom.create('UMTIRO');
    const dan = new FakePeer();
    room.receive(dan, join('Dan'));
    const me = decodeWelcome(dan.of(MSG.WELCOME)[0]!)!.id;
    room.step();
    const units = room['units'] as TestUnit[];
    const bot = units.find((u) => u.kind === 'mech')!;
    const feet = room.positionOf(me)!;
    const mine = units.find((u) => u.id === me)!;
    const muzzle = new THREE.Vector3();
    mine.mech.simMuzzle(muzzle);
    // Yaw 0: a frente é -Z. O alvo fica na linha do cano (que é deslocado do eixo do Mech), a 3 m da boca.
    bot.mech.respawn(new THREE.Vector3(muzzle.x, feet.y, muzzle.z - 3));
    const before = lifeOf(bot.mech);
    room.receive(dan, inputs(1, 1, { fire: true }));
    room.receive(dan, inputs(2, 17));
    for (let i = 0; i < 24; i++) room.step();
    const hits = hitsSeen(dan).filter((h) => h.unit === bot.id && h.other === me);
    const lost = before - lifeOf(bot.mech);
    expect(hits.length).toBe(1);
    expect(lost).toBeGreaterThan(0);
    expect(Math.abs(lost - hits[0]!.amount)).toBeLessThanOrEqual(0.5);
    room.dispose();
  });
});

describe('Lancer-L1 online: a escopeta no servidor', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('entra com o texto da montagem (id com maiúscula) e o tiro sai como escopeta, com o dano de perto', async () => {
    const room = await ArenaRoom.create('LANCER');
    const dan = new FakePeer();
    room.receive(dan, join('Dan', 'v1.lancerL1.shotgun-0.-'));
    expect(dan.of(MSG.WELCOME)).toHaveLength(1); // não foi recusado como 'montagem'
    const me = decodeWelcome(dan.of(MSG.WELCOME)[0]!)!.id;
    expect(decodeRoster(dan.of(MSG.ROSTER).at(-1)!)!.find((e) => e.id === me)).toMatchObject({ build: 'v1.lancerL1.shotgun-0.-' });
    room.step();
    const units = room['units'] as TestUnit[];
    const bot = units.find((u) => u.kind === 'mech')!;
    const mine = units.find((u) => u.id === me)!;
    expect(mine.mech.loadout.primary.id).toBe('shotgun');
    expect(mine.mech.loadout.secondary).toBeNull();
    const muzzle = new THREE.Vector3();
    mine.mech.simMuzzle(muzzle);
    bot.mech.respawn(new THREE.Vector3(muzzle.x, room.positionOf(me)!.y, muzzle.z - 3));
    room.receive(dan, inputs(1, 1, { fire: true }));
    room.receive(dan, inputs(2, 17));
    for (let i = 0; i < 24; i++) room.step();

    const batch = newEventBatch();
    const shots: number[] = [];
    for (const bytes of dan.of(MSG.EVENTS)) {
      decodeEvents(bytes, batch);
      for (let i = 0; i < batch.count; i++) if (batch.list[i]!.kind === EVENT.SHOT && batch.list[i]!.unit === me) shots.push(batch.list[i]!.index);
    }
    expect(shots).toEqual([netWeaponIndex('shotgun')]);
    const hits = hitsSeen(dan).filter((h) => h.unit === bot.id && h.other === me);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.amount).toBe(hitDamage(weapon('shotgun'), 3));
    expect(hits[0]!.amount).toBeGreaterThan(weapon('plasma').damage * 2);
    room.dispose();
  });
});

/** Uma sala com o jogador de `build`, um alvo parado a `dist` m à frente e o comando que o cliente mandaria: da boca direita ao centro do alvo. */
async function palco(build = loadoutKey(factorySpec('marauder')), dist = 15) {
  const room = await ArenaRoom.create('PALCO');
  const dan = new FakePeer();
  room.receive(dan, join('Dan', build));
  expect(dan.of(MSG.WELCOME)).toHaveLength(1); // a montagem não foi recusada
  const me = decodeWelcome(dan.of(MSG.WELCOME)[0]!)!.id;
  expect(decodeRoster(dan.of(MSG.ROSTER).at(-1)!)!.find((e) => e.id === me)).toMatchObject({ build });
  room.step();
  const units = room['units'] as TestUnit[];
  const bot = units.find((u) => u.kind === 'mech')!;
  const mine = units.find((u) => u.id === me)!;
  const feet = room.positionOf(me)!.clone();
  bot.mech.respawn(new THREE.Vector3(feet.x, feet.y, feet.z - dist));
  bot.mech.moveSpeedScale = 0; // parado: o teste mede o tiro, não a esquiva
  room.step(); // o colisor do alvo só muda de lugar no passo da física: sem isto a mira ainda o veria onde estava
  room.step();
  // A boca anda quando o Mech gira: refaz a conta com o yaw já aplicado até assentar (o cliente mira do yaw de agora).
  const muzzle = new THREE.Vector3();
  const to = new THREE.Vector3();
  let yaw = 0;
  let pitch = 0;
  for (let i = 0; i < 6; i++) {
    mine.mech.applyFacing(yaw, pitch);
    mine.mech.simMuzzle(muzzle, 'rightHand');
    to.set(feet.x, feet.y + 2.5, feet.z - dist).sub(muzzle);
    yaw = Math.atan2(-to.x, -to.z);
    pitch = Math.asin(to.y / to.length());
  }
  return { room, dan, me, mine, bot, yaw, pitch };
}

/** Um comando por tick, como o cliente manda (o pacote aceita no máximo 8 comandos; mais que isso o servidor descarta o pacote inteiro). */
function drive(room: ArenaRoom, peer: FakePeer, first: number, ticks: number, o: Partial<NetInput>): void {
  for (let i = 0; i < ticks; i++) {
    room.receive(peer, inputs(first + i, 1, o));
    room.step();
  }
}

function shotsOf(peer: FakePeer, me: number): number[] {
  const batch = newEventBatch();
  const out: number[] = [];
  for (const bytes of peer.of(MSG.EVENTS)) {
    decodeEvents(bytes, batch);
    for (let i = 0; i < batch.count; i++) if (batch.list[i]!.kind === EVENT.SHOT && batch.list[i]!.unit === me) out.push(batch.list[i]!.index);
  }
  return out;
}


describe('Marauder online: duas mãos no botão principal e dois lançadores nos ombros, pelo servidor', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('entra com a montagem de fábrica: blaster nas duas mãos e foguetes nos ombros, com as bocas do dado do chassi', async () => {
    const { room, mine } = await palco();
    const { loadout } = mine.mech;
    expect(loadout.primary.id).toBe('blaster');
    expect(loadout.offhand?.id).toBe('blaster');
    expect(loadout.secondary?.id).toBe('rockets');
    // O corpo do servidor é o procedural, mas a boca de cada encaixe é a do desenho (dado do chassi): G14.
    const rightShoulder = mine.mech.simMuzzle(new THREE.Vector3(), 'rightShoulder');
    const pos = room.positionOf(mine.id)!;
    expect(rightShoulder.x - pos.x).toBeCloseTo(1.08, 1);
    expect(rightShoulder.y - pos.y).toBeCloseTo(4.82, 1);
    room.dispose();
  });

  it('segurar o botão principal atira as DUAS mãos (um tiro de cada, a esquerda meio intervalo depois) e as duas acertam o alvo', async () => {
    const { room, dan, me, bot, yaw, pitch } = await palco();
    drive(room, dan, 1, 15, { fire: true, yaw, pitch }); // 0,25 s segurando
    drive(room, dan, 16, 35, { yaw, pitch }); // solta e deixa os projéteis chegarem

    expect(shotsOf(dan, me)).toEqual([netWeaponIndex('blaster'), netWeaponIndex('blaster')]);
    const hits = hitsSeen(dan).filter((h) => h.unit === bot.id && h.other === me);
    expect(hits).toHaveLength(2); // a mão esquerda também acerta: a mira converge no alvo
    expect(hits.every((h) => h.amount === hitDamage(weapon('blaster'), 15))).toBe(true);
    room.dispose();
  });

  it('o botão secundário solta os DOIS foguetes de ombro de uma vez, gasta um tiro do carregador, e os dois acertam', async () => {
    const { room, dan, me, bot, mine, yaw, pitch } = await palco();
    const before = lifeOf(bot.mech);
    drive(room, dan, 1, 1, { secondary: true, yaw, pitch }); // um aperto
    expect(mine.mech.heat).toBeCloseTo(2 * weapon('rockets').heatPerShot, 2); // dois lançamentos esquentam o mesmo dissipador
    drive(room, dan, 2, 50, { yaw, pitch }); // os foguetes levam ~0,2 s para chegar

    expect(shotsOf(dan, me)).toEqual([netWeaponIndex('rockets'), netWeaponIndex('rockets')]);
    const hits = hitsSeen(dan).filter((h) => h.unit === bot.id && h.other === me);
    expect(hits.length).toBeGreaterThanOrEqual(2); // um foguete de cada ombro
    const total = hits.reduce((s, h) => s + h.amount, 0);
    expect(total).toBeGreaterThan(weapon('rockets').damage); // mais que um foguete só
    expect(before - lifeOf(bot.mech)).toBe(total); // o evento é a vida que saiu, sem segunda via de dano
    room.dispose();
  });
});

describe('M3: o servidor de verdade, pela rede', () => {
  let server: GameServer;
  beforeAll(async () => {
    // No teste todo mundo sai de 127.0.0.1: por isso o `perIp` bem largo. As defesas ganham blocos próprios abaixo.
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 100, total: 200, msgs: 200, burst: 200 } });
  });
  afterAll(async () => {
    await server.close();
  });

  /** Um cliente WebSocket de verdade (o do Node), guardando o que chega. */
  function client(sala: string) {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/?sala=${sala}`);
    ws.binaryType = 'arraybuffer';
    const got: Uint8Array[] = [];
    ws.onmessage = (e) => got.push(new Uint8Array(e.data as ArrayBuffer));
    const open = new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('sem conexão'));
    });
    const until = async (ok: () => boolean, ms = 5000) => {
      const t0 = Date.now();
      while (!ok()) {
        if (Date.now() - t0 > ms) throw new Error('tempo esgotado');
        await new Promise((r) => setTimeout(r, 10));
      }
    };
    return { ws, got, open, until, of: (type: number) => got.filter((b) => messageType(b) === type) };
  }

  it('dois jogadores na mesma sala se veem no estado; o comando de um anda com o Mech dele no servidor', async () => {
    const a = client('DUELO');
    const b = client('DUELO');
    await Promise.all([a.open, b.open]);
    a.ws.send(join('Alfa'));
    b.ws.send(join('Bravo'));
    await a.until(() => a.of(MSG.WELCOME).length > 0);
    await b.until(() => b.of(MSG.WELCOME).length > 0);
    const idA = decodeWelcome(a.of(MSG.WELCOME)[0]!)!.id;
    const idB = decodeWelcome(b.of(MSG.WELCOME)[0]!)!.id;
    expect(idA).not.toBe(idB);
    await b.until(() => b.of(MSG.SNAPSHOT).length > 0);
    const s = newSnapshot();
    decodeSnapshot(b.of(MSG.SNAPSHOT).at(-1)!, s);
    const ids = s.units.slice(0, s.count).map((u) => u.id);
    expect(ids).toContain(idA);
    expect(ids).toContain(idB);
    const z0 = s.units.find((u) => u.id === idA)!.z;
    // Alfa anda para a frente por ~0,6 s, pela rede, e Bravo vê.
    for (let t = 1; t <= 36; t += 2) {
      a.ws.send(inputs(t, 2, { moveZ: 1 }));
      await new Promise((r) => setTimeout(r, 33));
    }
    await b.until(() => {
      decodeSnapshot(b.of(MSG.SNAPSHOT).at(-1)!, s);
      return z0 - s.units.find((u) => u.id === idA)!.z > 2;
    });
    expect(server.rooms.get('DUELO')!.humanCount).toBe(2);
    a.ws.close();
    await b.until(() => server.rooms.get('DUELO')!.humanCount === 1);
    b.ws.close();
  });

  it('sala cheia abre a próxima: o 9º que clica em Jogar online cai na ARENA-2, não fica de fora', async () => {
    const all = Array.from({ length: ROOM_SIZE + 1 }, () => client('ARENA'));
    await Promise.all(all.map((c) => c.open));
    for (const [i, c] of all.entries()) c.ws.send(join(`P${i}`));
    for (const c of all) await c.until(() => c.of(MSG.WELCOME).length > 0);
    const rooms = all.map((c) => decodeWelcome(c.of(MSG.WELCOME)[0]!)!.room);
    expect(rooms.filter((r) => r === 'ARENA').length).toBe(ROOM_SIZE);
    expect(rooms.filter((r) => r === 'ARENA-2').length).toBe(1);
    for (const c of all) c.ws.close();
  });

  it('salas diferentes não se misturam', async () => {
    const a = client('SALA-A');
    const b = client('SALA-B');
    await Promise.all([a.open, b.open]);
    a.ws.send(join('A'));
    b.ws.send(join('B'));
    await a.until(() => a.of(MSG.WELCOME).length > 0);
    await b.until(() => b.of(MSG.WELCOME).length > 0);
    expect(decodeWelcome(a.of(MSG.WELCOME)[0]!)!.room).toBe('SALA-A');
    expect(server.rooms.get('SALA-A')!.humanCount).toBe(1);
    expect(server.rooms.get('SALA-B')!.humanCount).toBe(1);
    a.ws.close();
    b.ws.close();
  });
});

describe('M3: defesas do servidor (mesmo domínio da Selva MKT, DEPLOY.md)', () => {
  /** Abre uma conexão: `open()` promete quando o handshake termina; `closeCode()` promete o motivo do fechamento. */
  function open(port: number, sala = 'CAPZ') {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?sala=${sala}`);
    ws.binaryType = 'arraybuffer';
    const opened = new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('sem conexão'));
    });
    // Quem é recusado pela porteira dispara `onerror` sem que ninguém aguarde `opened`; catch aqui evita rejeição solta.
    opened.catch(() => {});
    const closed = new Promise<number>((resolve) => {
      ws.onclose = (e: { code: number }) => resolve(e.code);
    });
    return { ws, opened, closed };
  }

  it('teto por IP: um mesmo endereço não consegue abrir mais que `perIp` conexões', async () => {
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 2, total: 10, msgs: 60, burst: 30 } });
    try {
      // Abro as `perIp` vagas uma de cada vez, esperando o handshake de cada uma terminar antes da
      // próxima: sem isso, numa máquina sobrecarregada (muitos testes em paralelo), a ordem de chegada
      // das três conexões não é garantida em 5 s, e "qualquer uma pode ser a recusada" vira instável.
      // Com as vagas já ocupadas de verdade, a terceira SEMPRE é a recusada — determinístico mesmo sob
      // carga (só depende do handshake dela mesma, não de uma corrida entre três).
      const fill = [open(s.port), open(s.port)];
      await Promise.all(fill.map((c) => c.opened));
      const extra = open(s.port);
      const code = await extra.closed; // sem prazo próprio: o timeout do teste (Vitest) já cobre o caso "nunca fechou"
      expect(code).toBe(4013);
      expect(s.guard.rejected.ip).toBe(1);
      for (const c of fill) c.ws.close();
      await Promise.all(fill.map((c) => c.closed));
    } finally {
      await s.close();
    }
  });

  it('taxa por conexão: quem manda mais que o balde aguenta é derrubado', async () => {
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 10, total: 10, msgs: 10, burst: 5 } });
    try {
      const c = open(s.port, 'FLUD');
      await c.opened;
      // Dispara mais que o balde (nominal 10 + folga 5 = 15) de uma vez, tudo binário.
      for (let i = 0; i < 30; i++) c.ws.send(new Uint8Array([0]));
      expect(await c.closed).toBe(4008);
      expect(s.guard.rejected.flood).toBe(1);
    } finally {
      await s.close();
    }
  });
});

describe('Chuva de mísseis online: o servidor decide onde cada bomba cai', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('um aperto no botão secundário sobe, avisa com UM evento de tiro e, ~2 s depois, as bombas caem em volta do alvo e tiram vida dele', async () => {
    const { room, dan, me, bot, mine, yaw, pitch } = await palco('v1.vector09.plasma-0.barrage-0', 40);
    expect(mine.mech.loadout.secondary?.id).toBe('barrage');
    const before = lifeOf(bot.mech);
    drive(room, dan, 1, 1, { secondary: true, yaw, pitch });
    expect(mine.mech.heat).toBeCloseTo(weapon('barrage').heatPerShot, 2);
    drive(room, dan, 2, 1, { yaw, pitch });
    // Antes de a primeira bomba cair (subida + queda = 2,1 s), ninguém levou nada.
    drive(room, dan, 3, 90, { yaw, pitch });
    expect(lifeOf(bot.mech)).toBe(before);
    drive(room, dan, 93, 120, { yaw, pitch });

    expect(shotsOf(dan, me)).toEqual([netWeaponIndex('barrage')]); // o lançamento é um tiro só para a rede
    const hits = hitsSeen(dan).filter((h) => h.unit === bot.id && h.other === me);
    expect(hits.length).toBeGreaterThanOrEqual(2); // as bombas mais perto do centro pegam o Mech parado
    const total = hits.reduce((s, h) => s + h.amount, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(weapon('barrage').barrage!.bombs * weapon('barrage').damage);
    expect(before - lifeOf(bot.mech)).toBe(total); // o evento é a vida que saiu
    // O dono não se fere com a própria chuva (os bots da sala podem acertá-lo: aqui só conta o fogo dele mesmo).
    expect(hitsSeen(dan).filter((h) => h.unit === me && h.other === me)).toEqual([]);
    room.dispose();
  });

  it('a montagem com a chuva entra pelo texto do link e a sala não a recusa', async () => {
    const room = await ArenaRoom.create('CHUVA');
    const dan = new FakePeer();
    room.receive(dan, join('Dan', 'v1.vector09.plasma-0.barrage-1'));
    expect(dan.of(MSG.WELCOME)).toHaveLength(1);
    room.dispose();
  });
});


describe('capacidade e energia da sala', () => {
  it('bots cedem vagas, não renascem na reserva e voltam após a saída de humano', async () => {
    const room = await ArenaRoom.create('LOTADA');
    try {
      const peers = Array.from({ length: ROOM_SIZE }, () => new FakePeer());
      peers.forEach((p, i) => room.receive(p, join('P' + i)));
      const roster = () => decodeRoster(peers[0]!.of(MSG.ROSTER).at(-1)!)!;
      expect(roster().filter(u => u.kind === 'mech')).toHaveLength(0);
      expect(roster()).toHaveLength(11);
      for (let t = 0; t < 301; t++) room.step();
      room['match'].bots.respawnAll();
      expect(room['units'].filter(u => u.kind === 'mech').every(u => !u.mech.alive)).toBe(true);
      expect(peers[0]!.lastSnapshot().count).toBe(11);
      room.leave(peers[7]!);
      expect(roster().filter(u => u.kind === 'mech')).toHaveLength(1);
      expect(room['units'].filter(u => u.kind === 'mech' && u.mech.alive)).toHaveLength(1);
      expect(roster().filter(u => u.kind === 'technician')).toHaveLength(1);
    } finally { room.dispose(); }
  });
  it.each([['frontal', .9], ['sphere', 130/150]] as const)('%s mantém as duas armas, consome energia no servidor e só envia a energia ao dono', async (module, remaining) => {
    const room = await ArenaRoom.create('ENERGIA');
    try {
      const a = new FakePeer(), b = new FakePeer();
      room.receive(a, join('A', `v2.vector09.plasma-0.rockets-0.-.${module}`));
      room.receive(b, join('B'));
      expect(a.of(MSG.WELCOME)).toHaveLength(1);
      const id = decodeWelcome(a.of(MSG.WELCOME)[0]!)!.id;
      drive(room, a, 1, 30, { shield: true, fire: true, secondary: true });
      const sa = a.lastSnapshot(), sb = b.lastSnapshot();
      expect(sa.energy).toBeCloseTo(remaining, 2);
      expect(sb.energy).toBe(0);
      expect(sb.units.slice(0,sb.count).find(u => u.id === id)?.shield).toBe(true);
      expect(shotsOf(a,id)).toContain(netWeaponIndex('plasma'));
      expect(shotsOf(a,id)).toContain(netWeaponIndex('rockets'));
      for(let t=0;t<30;t++) room.step();
      expect(a.lastSnapshot().units.find(u => u.id === id)?.shield).toBe(false);
    } finally { room.dispose(); }
  });
});
