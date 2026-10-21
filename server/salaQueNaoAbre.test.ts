import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION } from '../shared/net/constants';
import { encodeJoin, messageType, MSG } from '../shared/net/messages';
import { ArenaRoom } from './ArenaRoom';
import { startServer, type GameServer } from './Server';

/**
 * SALA QUE NÃO ABRE (21/10): uma falha ao criar a sala (o código de um mapa que não carregou, a física que não subiu) era uma rejeição solta: o Node mata o processo, e com ele a sala de todo mundo.
 * A produção ficou fora do ar por isso. Agora cai só a conexão que pediu a sala, e a próxima tentativa abre a sala de novo (a falha não fica guardada).
 */
const w = new Writer(256);
const join_ = (name: string) => new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name, build: 'v1.vector09.plasma-0.rockets-0' }));
const GUARD = { perIp: 100, total: 200, msgs: 400, burst: 400 };

async function ate(ok: () => boolean, ms = 10_000) {
  const t0 = Date.now();
  while (!ok()) {
    if (Date.now() - t0 > ms) throw new Error('tempo esgotado');
    await new Promise((r) => setTimeout(r, 30));
  }
}

async function entrar(port: number, sala: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/?sala=${sala}`);
  ws.binaryType = 'arraybuffer';
  const e = { ws, bemVindo: false, fechou: null as number | null };
  ws.on('message', (d: ArrayBuffer) => {
    if (messageType(new Uint8Array(d)) === MSG.WELCOME) e.bemVindo = true;
  });
  ws.on('close', (code) => (e.fechou = code));
  ws.on('error', () => undefined);
  await new Promise<void>((ok) => ws.on('open', () => ok()).on('close', () => ok()));
  if (ws.readyState === ws.OPEN) ws.send(join_('Piloto'));
  return e;
}

describe('uma sala que não abre não derruba o servidor', () => {
  let server: GameServer;
  beforeAll(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: GUARD });
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await server.close();
  });

  it('a conexão cai com 1011, o servidor segue respondendo, e a tentativa seguinte abre a sala', async () => {
    const criar = vi.spyOn(ArenaRoom, 'create').mockRejectedValueOnce(new Error('o código do mapa não carregou'));
    const primeira = await entrar(server.port, 'FALHA');
    await ate(() => primeira.fechou !== null);
    expect(primeira.fechou).toBe(1011);
    expect(primeira.bemVindo).toBe(false);
    const depoisDaFalha = (await (await fetch(`http://127.0.0.1:${server.port}/status`)).json()) as { rooms: number };
    expect(depoisDaFalha.rooms).toBe(0);

    const segunda = await entrar(server.port, 'FALHA');
    await ate(() => segunda.bemVindo || segunda.fechou !== null);
    expect(segunda.fechou).toBeNull();
    expect(segunda.bemVindo).toBe(true);
    expect(criar).toHaveBeenCalledTimes(2);
    segunda.ws.terminate();
  });
});
