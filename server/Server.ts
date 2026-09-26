import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import { FIXED_DT } from '../client/src/physics/PhysicsWorld';
import { ROOM_MAX, ROOM_SIZE } from '../shared/net/constants';
import { ArenaRoom, type Peer } from './ArenaRoom';

/** Maior mensagem aceita de um cliente (a maior é o JOIN, ~90 bytes). Acima disso, a conexão cai (G7). */
const MAX_MESSAGE = 1024;
/** Sala sem ninguém por este tempo fecha (a memória da partida volta). */
const EMPTY_ROOM_S = 30;
/** Sala padrão para quem entra sem código. */
export const DEFAULT_ROOM = 'ARENA';
const ROOM_RE = /^[A-Z0-9-]{1,12}$/;

export interface GameServer {
  port: number;
  rooms: ReadonlyMap<string, ArenaRoom>;
  close(): Promise<void>;
}

/** Código da sala a partir do endereço da conexão (`/?sala=K7Q2`); inválido vira null. */
export function roomCode(url: string | undefined): string | null {
  const raw = new URL(url ?? '/', 'http://x').searchParams.get('sala');
  const code = (raw ?? DEFAULT_ROOM).trim().toUpperCase().slice(0, ROOM_MAX);
  return ROOM_RE.test(code) ? code : null;
}

/**
 * O servidor de jogo (M3): HTTP + WebSocket (\`ws\`) numa porta, salas por código (\`?sala=\`), criadas na primeira
 * entrada e fechadas depois de 30 s vazias. Um laço só roda todas as salas no tick fixo de 60 Hz, com acumulador
 * (o relógio do Windows acorda a cada ~15 ms: a sala dá 1 ou 2 passos por vez e nunca adianta nem atrasa).
 *
 * O transporte copia cada mensagem ao mandar: o socket guarda o buffer até ele sair, e as salas reaproveitam o
 * delas (G4 vale para a simulação; aqui é uma cópia de ~240 bytes por jogador, 20 vezes por segundo).
 */
export async function startServer(opts: { port?: number; host?: string; log?: (line: string) => void } = {}): Promise<GameServer> {
  const log = opts.log ?? (() => {});
  const rooms = new Map<string, ArenaRoom>();
  const creating = new Map<string, Promise<ArenaRoom>>();
  const emptyFor = new Map<string, number>();
  /** Conexões em cada sala (contando quem ainda não mandou o JOIN): é o que decide se a sala está cheia. */
  const occupancy = new Map<string, number>();
  /** Sala pedida cheia: a próxima (ARENA, ARENA-2, ARENA-3...). Quem clica em "Jogar online" nunca fica de fora. */
  const pickRoom = (code: string): string => {
    const base = code.replace(/-\d+$/, '');
    let n = code === base ? 1 : Number(code.slice(base.length + 1));
    let c = code;
    while ((occupancy.get(c) ?? 0) >= ROOM_SIZE && n < 99) c = `${base}-${++n}`.slice(0, ROOM_MAX);
    return c;
  };

  const roomFor = (code: string): Promise<ArenaRoom> => {
    const open = rooms.get(code);
    if (open) return Promise.resolve(open);
    let p = creating.get(code);
    if (!p) {
      p = ArenaRoom.create(code).then((room) => {
        rooms.set(code, room);
        creating.delete(code);
        log(`sala ${code} aberta`);
        return room;
      });
      creating.set(code, p);
    }
    return p;
  };

  const http = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`CYBERMECH · servidor de jogo · ${rooms.size} sala(s)\n`);
  });
  const wss = new WebSocketServer({ server: http, maxPayload: MAX_MESSAGE });

  wss.on('connection', (ws: WebSocket, req) => {
    const asked = roomCode(req.url);
    if (!asked) {
      ws.close(1008, 'sala');
      return;
    }
    const code = pickRoom(asked);
    occupancy.set(code, (occupancy.get(code) ?? 0) + 1);
    const peer: Peer = {
      send: (bytes) => {
        if (ws.readyState === ws.OPEN) ws.send(Buffer.from(bytes));
      },
      close: () => ws.close(1000),
    };
    // As mensagens esperam a sala ficar pronta, na ordem em que chegaram.
    const room = roomFor(code);
    ws.on('message', (data, isBinary) => {
      if (!isBinary) return;
      const bytes = data instanceof Buffer ? data : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data as ArrayBuffer)]);
      void room.then((r) => r.receive(peer, bytes));
    });
    ws.on('close', () => {
      occupancy.set(code, Math.max(0, (occupancy.get(code) ?? 1) - 1));
      void room.then((r) => r.leave(peer));
    });
    ws.on('error', () => ws.terminate());
  });

  await new Promise<void>((resolve) => http.listen(opts.port ?? 2567, opts.host, resolve));
  const port = (http.address() as AddressInfo).port;

  // O laço: passos fixos de 1/60 s, todas as salas juntas; no máximo 4 passos por volta (engasgo não vira bola de neve).
  const stepMs = FIXED_DT * 1000;
  let last = performance.now();
  let acc = 0;
  const loop = setInterval(() => {
    const now = performance.now();
    acc += now - last;
    last = now;
    let n = 0;
    while (acc >= stepMs && n < 4) {
      for (const r of rooms.values()) r.step();
      acc -= stepMs;
      n++;
    }
    if (n === 4) acc = 0;
    for (const [code, r] of rooms) {
      if (r.humanCount > 0) {
        emptyFor.delete(code);
        continue;
      }
      const since = emptyFor.get(code) ?? now;
      emptyFor.set(code, since);
      if (now - since > EMPTY_ROOM_S * 1000) {
        rooms.delete(code);
        emptyFor.delete(code);
        r.dispose();
        log(`sala ${code} fechada (vazia)`);
      }
    }
  }, 4);

  return {
    port,
    rooms,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(loop);
        for (const c of wss.clients) c.terminate();
        wss.close(() => http.close(() => resolve()));
        for (const r of rooms.values()) r.dispose();
        rooms.clear();
      }),
  };
}
