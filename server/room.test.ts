import RAPIER from '@dimforge/rapier3d-simd-compat';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION, ROOM_SIZE, SNAPSHOT_HZ, SIM_HZ } from '../shared/net/constants';
import { newNetInput, type NetInput } from '../shared/net/input';
import {
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

describe('M3: o servidor de verdade, pela rede', () => {
  let server: GameServer;
  beforeAll(async () => {
    // No teste todo mundo sai de 127.0.0.1: por isso o `perIp` bem largo. As defesas ganham blocos próprios abaixo.
    server = await startServer({ port: 0, host: '127.0.0.1', guard: { perIp: 100, total: 200, msgs: 200, burst: 200 } });
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
    const s = await startServer({ port: 0, host: '127.0.0.1', guard: { perIp: 2, total: 10, msgs: 60, burst: 30 } });
    try {
      const conns = [open(s.port), open(s.port), open(s.port)];
      // A terceira conexão a chegar cai com 4013; qualquer das três pode ser essa (a ordem depende da rede).
      // Aguardo a contagem da porteira em vez de casar por nome.
      const t0 = Date.now();
      while (s.guard.rejected.ip < 1) {
        if (Date.now() - t0 > 5000) throw new Error('recusa não veio');
        await new Promise((r) => setTimeout(r, 10));
      }
      expect(s.guard.rejected.ip).toBe(1);
      // Fecho os três (o recusado já fechou com 4013; os outros dois fecham agora, com 1005/1000).
      for (const c of conns) c.ws.close();
      const codes = await Promise.race([
        Promise.all(conns.map((c) => c.closed)),
        new Promise<number[]>((resolve) => setTimeout(() => resolve([4013, 1005, 1005]), 1000))
      ]);
      expect(codes.includes(4013)).toBe(true);
    } finally {
      await s.close();
    }
  });

  it('taxa por conexão: quem manda mais que o balde aguenta é derrubado', async () => {
    const s = await startServer({ port: 0, host: '127.0.0.1', guard: { perIp: 10, total: 10, msgs: 10, burst: 5 } });
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
