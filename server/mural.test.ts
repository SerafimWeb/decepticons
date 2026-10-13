import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { ADMIN_ESTADO_PATH, ADMIN_HEADER } from '../shared/net/admin';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION, ROOM_SIZE } from '../shared/net/constants';
import { decodeRoster, encodeJoin, messageType, MSG } from '../shared/net/messages';
import { decodeMural, encodeMuralPedido, MURAL_FECHOU, type MuralSala } from '../shared/net/mural';
import { startServer, type GameServer } from './Server';

const TOKEN = 'token-do-dono-so-para-o-teste-0123456789';
const w = new Writer(256);
const join_ = (name: string) => new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name, build: 'v1.vector09.plasma-0.rockets-0' }));
/** O guard solto: o teste abre vários sockets do mesmo IP. */
const GUARD = { perIp: 100, total: 200, msgs: 400, burst: 400 };

async function until(ok: () => boolean | Promise<boolean>, ms = 8000) {
  const t0 = Date.now();
  while (!(await ok())) {
    if (Date.now() - t0 > ms) throw new Error('tempo esgotado');
    await new Promise((r) => setTimeout(r, 30));
  }
}

/** Um jogador de verdade: abre o socket, manda o JOIN e espera as boas-vindas. Guarda a última lista de jogadores que a sala mandou. */
async function entrar(port: number, sala: string, nome: string): Promise<WebSocket & { roster?: number }> {
  const ws: WebSocket & { roster?: number } = new WebSocket(`ws://127.0.0.1:${port}/?sala=${sala}`);
  ws.binaryType = 'arraybuffer';
  let bemVindo = false;
  ws.on('message', (d: ArrayBuffer) => {
    const b = new Uint8Array(d);
    if (messageType(b) === MSG.WELCOME) bemVindo = true;
    if (messageType(b) === MSG.ROSTER) ws.roster = decodeRoster(b)?.length;
  });
  await new Promise<void>((ok, err) => {
    ws.on('open', () => ok());
    ws.on('error', () => err(new Error('sem conexão')));
  });
  ws.send(join_(nome));
  await until(() => bemVindo);
  return ws;
}

/** Um espectador: abre `/?mural=1`, guarda o último quadro e como a conexão acabou. */
function espectar(port: number, token: string | null = TOKEN) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/?mural=1`);
  ws.binaryType = 'arraybuffer';
  const e = { ws, quadros: [] as MuralSala[][], fechou: null as number | null, aberto: false, recebidos: 0, bytes: 0 };
  ws.on('open', () => {
    e.aberto = true;
    if (token !== null) ws.send(new Uint8Array(encodeMuralPedido(w, token)));
  });
  ws.on('message', (d: ArrayBuffer) => {
    const b = new Uint8Array(d);
    if (messageType(b) !== MSG.MURAL) return;
    const q = decodeMural(b);
    if (!q) return;
    e.quadros.push(q);
    e.recebidos++;
    e.bytes += b.length;
  });
  ws.on('close', (codigo) => (e.fechou = codigo));
  ws.on('error', () => {});
  return e;
}

const ultimo = (e: ReturnType<typeof espectar>): MuralSala[] => e.quadros[e.quadros.length - 1] ?? [];

describe('o mural de câmeras, com o servidor de verdade', () => {
  let server: GameServer;
  const abertos: WebSocket[] = [];
  beforeAll(async () => {
    server = await startServer({
      port: 0,
      host: '127.0.0.1',
      dbContas: ':memory:',
      metricasToken: TOKEN,
      guard: GUARD,
      salvarCadaMs: 60_000,
      mural: { cadaMs: 50, esperaMs: 400, max: 3 },
      limiteAdmin: { teto: 10_000 },
    });
  });
  afterAll(async () => {
    for (const ws of abertos) ws.terminate();
    await server.close();
  });

  it('com o token certo recebe quadros com a sala, os jogadores e os bots; e não custa nada antes de alguém assistir', async () => {
    expect(server.mural.assistindo).toBe(0);
    expect(server.mural.conexoes).toBe(0);
    const jogador = await entrar(server.port, 'ARENA', 'DAN');
    abertos.push(jogador);
    const e = espectar(server.port);
    abertos.push(e.ws);
    await until(() => ultimo(e).some((s) => s.codigo === 'ARENA' && s.jogadores === 1));
    expect(server.mural.assistindo).toBe(1);
    const arena = ultimo(e).find((s) => s.codigo === 'ARENA')!;
    expect(arena.n).toBeGreaterThanOrEqual(2); // o jogador e os bots
    expect(arena.unidades.filter((u) => u.tipo === 'human')).toHaveLength(1);
    expect(arena.unidades.some((u) => u.tipo === 'mech' || u.tipo === 'android')).toBe(true);
    // As posições são da arena (±100 m) e há vida entre 0 e 1.
    for (const u of arena.unidades) {
      expect(Math.abs(u.x)).toBeLessThanOrEqual(120);
      expect(Math.abs(u.z)).toBeLessThanOrEqual(120);
      expect(u.vida).toBeGreaterThanOrEqual(0);
      expect(u.vida).toBeLessThanOrEqual(1);
    }
    // Vários quadros por segundo (aqui a cada 50 ms): o mural anda.
    const antes = e.recebidos;
    await until(() => e.recebidos >= antes + 3);
    // O mural não é jogador: não conta em /status e não abriu sala nenhuma.
    const status = await (await fetch(`http://127.0.0.1:${server.port}/status`)).json();
    expect(status.players).toBe(1);
    expect(status.rooms).toBe(1);
    e.ws.close();
    await until(() => server.mural.conexoes === 0);
    expect(server.mural.assistindo).toBe(0);
    jogador.close();
  });

  it('não ocupa vaga: a sala enche com oito jogadores mesmo com o mural aberto, e o mural não aparece na lista da sala', async () => {
    const e = espectar(server.port);
    abertos.push(e.ws);
    await until(() => server.mural.assistindo === 1);
    const jogadores: WebSocket[] = [];
    for (let i = 0; i < ROOM_SIZE; i++) jogadores.push(await entrar(server.port, 'CHEIA', `P${i}`));
    abertos.push(...jogadores);
    await until(() => ultimo(e).some((s) => s.codigo === 'CHEIA' && s.jogadores === ROOM_SIZE));
    expect(ultimo(e).find((s) => s.codigo === 'CHEIA')!.unidades.filter((u) => u.tipo === 'human')).toHaveLength(ROOM_SIZE);
    // O mural mostra exatamente quem a lista da sala mostra: os bots reservados (que a sala cheia não usa) não aparecem em nenhum dos dois.
    await until(() => jogadores.every((j) => (j as WebSocket & { roster?: number }).roster !== undefined));
    await new Promise((r) => setTimeout(r, 150));
    const doRoster = Math.max(...jogadores.map((j) => (j as WebSocket & { roster?: number }).roster ?? 0));
    expect(ultimo(e).find((s) => s.codigo === 'CHEIA')!.n).toBe(doRoster);
    // Todas no mesmo código: ninguém foi desviado para CHEIA-2 por causa do espectador.
    expect([...server.rooms.keys()]).not.toContain('CHEIA-2');
    for (const j of jogadores) j.close();
    e.ws.close();
    await until(() => server.mural.conexoes === 0);
  });

  it('as salas de teste do painel (TESTE-…) não aparecem no mural', async () => {
    const jogador = await entrar(server.port, 'TESTE-ABCD', 'FALSO');
    abertos.push(jogador);
    const e = espectar(server.port);
    abertos.push(e.ws);
    await until(() => e.recebidos >= 2);
    expect(ultimo(e).some((s) => s.codigo.startsWith('TESTE-'))).toBe(false);
    jogador.close();
    e.ws.close();
    await until(() => server.mural.conexoes === 0);
  });

  it('token errado, sem pedido ou lixo no lugar do pedido: a conexão cai (4003) e nada é mandado', async () => {
    const errado = espectar(server.port, 'token-errado-qualquer');
    await until(() => errado.fechou !== null);
    expect(errado.fechou).toBe(MURAL_FECHOU.token);
    expect(errado.recebidos).toBe(0);
    // Quem não manda o pedido em 400 ms (aqui) é cortado.
    const mudo = espectar(server.port, null);
    await until(() => mudo.fechou !== null);
    expect(mudo.fechou).toBe(MURAL_FECHOU.token);
    // Lixo no lugar do pedido também.
    const lixo = new WebSocket(`ws://127.0.0.1:${server.port}/?mural=1`);
    lixo.on('open', () => lixo.send(new Uint8Array([MSG.MURAL_PEDIR, 200, 1, 2, 3])));
    let fechouLixo: number | null = null;
    lixo.on('close', (c) => (fechouLixo = c));
    lixo.on('error', () => {});
    await until(() => fechouLixo !== null);
    expect(fechouLixo).toBe(MURAL_FECHOU.token);
    expect(server.mural.assistindo).toBe(0);
  });

  it('depois de entrar, o que o espectador mandar é ignorado: não vira jogador, não move ninguém', async () => {
    const e = espectar(server.port);
    abertos.push(e.ws);
    await until(() => server.mural.assistindo === 1);
    const salasAntes = [...server.rooms.keys()];
    e.ws.send(join_('INTRUSO'));
    e.ws.send(new Uint8Array([MSG.INPUT, 0, 0, 0]));
    await new Promise((r) => setTimeout(r, 200));
    expect([...server.rooms.keys()]).toEqual(salasAntes);
    expect([...server.rooms.values()].reduce((n, r) => n + r.humanCount, 0)).toBe(0);
    expect(e.fechou).toBeNull();
    e.ws.close();
    await until(() => server.mural.conexoes === 0);
  });

  it('tem teto de espectadores (3 aqui): o quarto é recusado, e quando um sai, entra outro', async () => {
    const tres = [espectar(server.port), espectar(server.port), espectar(server.port)];
    abertos.push(...tres.map((t) => t.ws));
    await until(() => server.mural.assistindo === 3);
    const quarto = espectar(server.port);
    abertos.push(quarto.ws);
    await until(() => quarto.fechou !== null);
    expect(quarto.fechou).toBe(4013);
    tres[0]!.ws.close();
    await until(() => server.mural.assistindo === 2);
    const outro = espectar(server.port);
    abertos.push(outro.ws);
    await until(() => outro.recebidos >= 1);
    for (const t of [...tres, outro]) t.ws.close();
    await until(() => server.mural.conexoes === 0);
  });

  it('o erro de token do mural gasta a mesma régua das rotas /admin: depois de 10, até o token certo é barrado, no WebSocket e no HTTP', async () => {
    const outro = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', metricasToken: TOKEN, guard: GUARD, mural: { cadaMs: 50, esperaMs: 400 } });
    try {
      for (let i = 0; i < 10; i++) {
        const e = espectar(outro.port, `errado-${i}`);
        await until(() => e.fechou !== null);
        expect(e.fechou, `tentativa ${i}`).toBe(MURAL_FECHOU.token);
      }
      const certo = espectar(outro.port);
      await until(() => certo.fechou !== null);
      expect(certo.fechou).toBe(MURAL_FECHOU.bloqueado);
      // E a porta HTTP do painel, do mesmo IP, também fecha (é uma régua só).
      const http = await fetch(`http://127.0.0.1:${outro.port}${ADMIN_ESTADO_PATH}`, { headers: { [ADMIN_HEADER]: TOKEN } });
      expect(http.status).toBe(429);
    } finally {
      await outro.close();
    }
  });

  it('sem token configurado o mural nem existe: a conexão cai (4005) e nada é mandado', async () => {
    const semToken = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: GUARD, mural: { cadaMs: 50, esperaMs: 400 } });
    try {
      const e = espectar(semToken.port);
      await until(() => e.fechou !== null);
      expect(e.fechou).toBe(MURAL_FECHOU.desligado);
      expect(e.recebidos).toBe(0);
    } finally {
      await semToken.close();
    }
  });

  it('o espectador devolve a vaga do IP ao sair: com o teto de 2 por IP, dá para abrir e fechar o mural muitas vezes', async () => {
    const apertado = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', metricasToken: TOKEN, guard: { ...GUARD, perIp: 2 }, mural: { cadaMs: 50, esperaMs: 400 } });
    try {
      for (let i = 0; i < 5; i++) {
        const e = espectar(apertado.port);
        await until(() => apertado.mural.assistindo === 1);
        expect(e.fechou, `vez ${i}`).toBeNull();
        e.ws.close();
        await until(() => apertado.mural.conexoes === 0);
      }
    } finally {
      await apertado.close();
    }
  });

  it('o custo de rede cabe na meta: um espectador com uma sala cheia recebe bem menos que 1 KB/s a 4 Hz', async () => {
    const quatroHz = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', metricasToken: TOKEN, guard: GUARD });
    const jogadores: WebSocket[] = [];
    try {
      for (let i = 0; i < ROOM_SIZE; i++) jogadores.push(await entrar(quatroHz.port, 'ARENA', `P${i}`));
      const e = espectar(quatroHz.port);
      await until(() => e.recebidos >= 1);
      const t0 = Date.now();
      const b0 = e.bytes;
      const r0 = e.recebidos;
      await new Promise((r) => setTimeout(r, 1500));
      const s = (Date.now() - t0) / 1000;
      const hz = (e.recebidos - r0) / s;
      const kbs = (e.bytes - b0) / 1024 / s;
      expect(hz).toBeGreaterThan(1.5); // o padrão é 4 por segundo; servidor e clientes dividem o mesmo processo (e a máquina), então o piso é folgado
      expect(hz).toBeLessThan(5.5);
      expect(kbs).toBeLessThan(1.5);
      e.ws.close();
    } finally {
      for (const j of jogadores) j.terminate();
      await quatroHz.close();
    }
  }, 20_000);
});
