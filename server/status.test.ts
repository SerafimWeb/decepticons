import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION, ROOM_SIZE } from '../shared/net/constants';
import { encodeJoin, messageType, MSG } from '../shared/net/messages';
import { parseStatus, STATUS_PATH } from '../shared/net/status';
import { startServer, type GameServer } from './Server';

const w = new Writer(256);
const join = () => new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name: 'DAN', build: 'v1.vector09.plasma-0.rockets-0' }));

/** O que a landing e a pausa do jogo fazem: um GET no status, sem abrir conexão de jogo. */
async function status(port: number) {
  const res = await fetch(`http://127.0.0.1:${port}${STATUS_PATH}`);
  expect(res.headers.get('access-control-allow-origin')).toBe('*');
  expect(res.headers.get('cache-control')).toBe('no-store');
  return parseStatus(await res.json());
}

async function until(ok: () => Promise<boolean>, ms = 6000) {
  const t0 = Date.now();
  while (!(await ok())) {
    if (Date.now() - t0 > ms) throw new Error('tempo esgotado');
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe('GET /status: o servidor conta quem está jogando', () => {
  let server: GameServer;
  beforeAll(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 100, total: 200, msgs: 200, burst: 200 } });
  });
  afterAll(async () => {
    await server.close();
  });

  it('servidor vazio: online, nenhum piloto, nenhuma sala', async () => {
    const s = await status(server.port);
    expect(s).not.toBeNull();
    expect(s!.protocol).toBe(PROTOCOL_VERSION);
    expect(s!.roomSize).toBe(ROOM_SIZE);
    expect(s!.players).toBe(0);
    expect(s!.rooms).toBe(0);
  });

  it('um piloto entra e o status passa a contar 1 piloto em 1 sala', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/?sala=STATUS`);
    ws.binaryType = 'arraybuffer';
    const got: Uint8Array[] = [];
    ws.onmessage = (e) => got.push(new Uint8Array(e.data as ArrayBuffer));
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('sem conexão'));
    });
    ws.send(join());
    await until(async () => got.some((b) => messageType(b) === MSG.WELCOME));
    // O status é montado no máximo uma vez por segundo: o teste espera a janela virar.
    await until(async () => {
      const s = await status(server.port);
      return s?.players === 1 && s.rooms === 1;
    });
    ws.close();
    await until(async () => (await status(server.port))?.players === 0);
  });

  it('não é caminho de status: a raiz continua respondendo o texto de sempre', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/`);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toContain('CYBERMECH');
  });
});
