import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { ADMIN_HEADER } from '../shared/net/admin';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION } from '../shared/net/constants';
import { ADMIN_VISIBILIDADE_PATH } from '../shared/visibilidade';
import { chaveDaSala, MAPAS_ONLINE, mapaDaChave, mapaDoLink, modoDaChave, modoDaSala } from '../shared/net/mapa';
import { decodeRoster, encodeJoin, messageType, MSG } from '../shared/net/messages';
import { TODOS_OS_MAPAS } from '../client/src/core/Lancamento';
import { mapFromSearch } from '../client/src/environment/Bunker';
import { mapHref } from '../client/src/ui/MapLinks';
import { modoEmSala, urlComMapa } from '../client/src/net/onlineConfig';
import { roomMapa, startServer, type GameServer } from './Server';

const TOKEN_DO_DONO = 'token-do-dono-so-para-o-teste-0123456789';
const w = new Writer(256);
const join_ = (name: string) => new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name, build: 'v1.vector09.plasma-0.rockets-0' }));
const GUARD = { perIp: 100, total: 200, msgs: 400, burst: 400 };

async function until(ok: () => boolean, ms = 100_000) {
  const t0 = Date.now();
  while (!ok()) {
    if (Date.now() - t0 > ms) throw new Error('tempo esgotado');
    await new Promise((r) => setTimeout(r, 30));
  }
}

/** Entra numa sala pelo endereço (com ou sem `mapa`) e espera as boas-vindas e a lista; devolve o socket e o que a sala disse. */
async function entrar(port: number, consulta: string, nome: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/?${consulta}`);
  ws.binaryType = 'arraybuffer';
  const e = { ws, bemVindo: false, lista: 0, fechou: null as { code: number; reason: string } | null };
  ws.on('message', (d: ArrayBuffer) => {
    const b = new Uint8Array(d);
    if (messageType(b) === MSG.WELCOME) e.bemVindo = true;
    if (messageType(b) === MSG.ROSTER) e.lista = decodeRoster(b)?.length ?? 0;
  });
  ws.on('close', (code, reason) => (e.fechou = { code, reason: reason.toString() }));
  ws.on('error', () => undefined);
  await new Promise<void>((ok) => ws.on('open', () => ok()).on('close', () => ok()));
  if (ws.readyState === ws.OPEN) ws.send(join_(nome));
  return e;
}

describe('o mapa da sala online (P218, etapa O1): o contrato', () => {
  it('a lista do contrato é a dos mapas do jogo; o link sem mapa é a Cidade Neon; mapa que não existe é recusado, não vira outra sala', () => {
    expect([...MAPAS_ONLINE].sort()).toEqual([...TODOS_OS_MAPAS].sort());
    expect(mapaDoLink(null)).toBe('arena');
    expect(mapaDoLink('')).toBe('arena');
    expect(mapaDoLink(' Praia ')).toBe('praia');
    expect(mapaDoLink('lua')).toBeNull();
    expect(roomMapa('/?sala=X')).toBe('arena');
    expect(roomMapa('/?sala=X&mapa=bunker')).toBe('bunker');
    expect(roomMapa('/?sala=X&mapa=lua')).toBeNull();
  });

  it('a chave da sala: o código sozinho na Cidade Neon (as salas e os painéis de sempre), CODIGO@mapa nos outros; ida e volta', () => {
    expect(chaveDaSala('ARENA', 'arena')).toBe('ARENA');
    expect(chaveDaSala('ARENA', 'praia')).toBe('ARENA@praia');
    for (const m of MAPAS_ONLINE) expect(mapaDaChave(chaveDaSala('K7Q2-3', m))).toBe(m);
  });

  it('o cliente: online também honra o ?mapa= (antes caía sempre na Cidade Neon), a conexão leva o mesmo mapa, e o link do seletor fica na sala', () => {
    expect(mapFromSearch('?mapa=bunker&sala=X', true, 'deathmatch')).toBe('bunker');
    expect(mapFromSearch('?mapa=praia&sala=X', true, 'deathmatch')).toBe('praia');
    expect(urlComMapa('ws://localhost:2567/?sala=ARENA', 'praia')).toBe('ws://localhost:2567/?sala=ARENA&mapa=praia');
    expect(urlComMapa('ws://localhost:2567/?sala=ARENA&mapa=praia', 'arena')).toBe('ws://localhost:2567/?sala=ARENA');
    const online = 'https://cybermech.online/jogar/?sala=ARENA&servidor=wss://jogo.cybermech.online&modo=ctf';
    const praia = new URL(mapHref(online, 'praia')).searchParams;
    expect([praia.get('sala'), praia.get('servidor'), praia.get('mapa'), praia.get('modo')]).toEqual(['ARENA', 'wss://jogo.cybermech.online', 'praia', null]);
    const offline = new URL(mapHref('https://cybermech.online/jogar/?mapa=praia&modo=survival', 'amazonia')).searchParams;
    expect([offline.get('mapa'), offline.get('modo')]).toEqual(['amazonia', 'survival']); // offline, a Amazônia abre a missão do rio
    expect(new URL(mapHref('https://cybermech.online/jogar/?sala=ARENA&mapa=praia', 'arena')).searchParams.get('mapa')).toBeNull();
  });
});

describe('o modo da sala online (P276): a Sobrevivência só existe onde o servidor a roda', () => {
  it('modo=survival fora do 8 de Janeiro é Deathmatch: a mesma sala, a mesma chave, o mesmo modo', () => {
    expect(modoDaSala('arena', 'survival')).toBe('deathmatch');
    expect(modoDaSala('praia', 'survival')).toBe('deathmatch');
    expect(modoDaSala('amazonia', 'survival')).toBe('deathmatch');
    expect(modoDaSala('janeiro', 'survival')).toBe('survival');
    expect(modoDaSala('janeiro', 'deathmatch')).toBe('deathmatch');
    expect(chaveDaSala('ARENA', 'arena', 'survival')).toBe('ARENA'); // o código sozinho: a sala de sempre
    expect(chaveDaSala('ARENA', 'praia', 'survival')).toBe('ARENA@praia');
    expect(chaveDaSala('ARENA', 'janeiro', 'survival')).toBe('ARENA@janeiro:survival'); // onde ela existe, é sala própria
    expect(modoDaChave(chaveDaSala('ARENA', 'arena', 'survival'))).toBe('deathmatch');
  });

  it('o cliente joga o que o servidor roda: online na Cidade Neon o link com modo=survival é Deathmatch; no 8 de Janeiro segue a Sobrevivência; CTF e Domínio online são Deathmatch', () => {
    expect(modoEmSala('survival', 'arena')).toBe('deathmatch');
    expect(modoEmSala('survival', 'janeiro')).toBe('survival');
    expect(modoEmSala('deathmatch', 'janeiro')).toBe('deathmatch');
    expect(modoEmSala('ctf', 'arena')).toBe('deathmatch');
    expect(modoEmSala('dominio', 'janeiro')).toBe('deathmatch');
  });
});

// 120 s: criar três salas de uma vez (a Praia e o Bunker são pesados) passava dos 30 s com a máquina ocupada e o atualizador de produção revertia a atualização por tempo, não por erro (19/10).
describe('a sala do servidor por mapa, com o servidor de verdade', { timeout: 120_000 }, () => {
  let server: GameServer;
  beforeAll(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: GUARD, metricasToken: TOKEN_DO_DONO });
    // O Bunker e a Terras Raras nascem restritos (só o administrador entra, A0/P226: `mapa-restrito.test.ts`). Aqui o assunto é a sala por mapa, então o painel os libera, como o Comandante faria.
    const r = await fetch(`http://127.0.0.1:${server.port}${ADMIN_VISIBILIDADE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [ADMIN_HEADER]: TOKEN_DO_DONO },
      body: JSON.stringify({ itens: { 'mapa:bunker': 'publico', 'mapa:amazonia': 'publico' } }),
    });
    expect(r.status).toBe(200);
  });
  afterAll(async () => {
    await server.close();
  });

  it('um mesmo código em mapas diferentes são salas diferentes (cada uma com o seu mapa e a sua gente); sem mapa é a Cidade Neon', async () => {
    const neon = await entrar(server.port, 'sala=MAPAS', 'Alfa');
    const praia = await entrar(server.port, 'sala=MAPAS&mapa=praia', 'Bravo');
    const bunker = await entrar(server.port, 'sala=MAPAS&mapa=bunker', 'Charlie');
    try {
      await until(() => neon.bemVindo && praia.bemVindo && bunker.bemVindo);
      expect([...server.rooms.keys()].sort()).toEqual(['MAPAS', 'MAPAS@bunker', 'MAPAS@praia']);
      expect(server.rooms.get('MAPAS')!.mapa).toBe('arena');
      expect(server.rooms.get('MAPAS@praia')!.mapa).toBe('praia');
      expect(server.rooms.get('MAPAS@bunker')!.mapa).toBe('bunker');
      for (const s of server.rooms.values()) expect(s.humanCount).toBe(1); // ninguém caiu na sala de outro mapa
    } finally {
      for (const c of [neon, praia, bunker]) c.ws.close();
    }
  });

  it('quem chega com modo=survival na Cidade Neon cai na MESMA sala de quem chegou sem ele (o lobby só acrescenta a sala à URL de quem tinha escolhido a missão): nada de sala fantasma ":survival"', async () => {
    const sem = await entrar(server.port, 'sala=MODO', 'Alfa');
    const com = await entrar(server.port, 'sala=MODO&modo=survival', 'Bravo');
    try {
      await until(() => sem.bemVindo && com.bemVindo);
      expect([...server.rooms.keys()].filter((k) => k.startsWith('MODO'))).toEqual(['MODO']);
      expect(server.rooms.get('MODO')!.humanCount).toBe(2);
    } finally {
      sem.ws.close();
      com.ws.close();
    }
  });

  it('mapa que não existe: a conexão é recusada com o motivo "mapa" e nenhuma sala nasce', async () => {
    const antes = [...server.rooms.keys()];
    const ruim = await entrar(server.port, 'sala=RUIM&mapa=lua', 'Delta');
    await until(() => ruim.fechou !== null);
    expect(ruim.fechou).toEqual({ code: 1008, reason: 'mapa' });
    expect([...server.rooms.keys()]).toEqual(antes);
  });

  it('a Terras Raras também constrói no servidor (o código do mapa baixa sob demanda no Node) e recebe gente', async () => {
    const rio = await entrar(server.port, 'sala=RIO&mapa=amazonia', 'Eco');
    try {
      await until(() => rio.bemVindo && rio.lista > 0);
      expect(server.rooms.get('RIO@amazonia')!.mapa).toBe('amazonia');
      expect(server.rooms.get('RIO@amazonia')!.humanCount).toBe(1);
    } finally {
      rio.ws.close();
    }
  });
});
