import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { ADMIN_HEADER } from '../shared/net/admin';
import { ACEITE_ATUAL, CONTA_CRIAR_PATH } from '../shared/net/auth';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION } from '../shared/net/constants';
import { CREDENCIAL_ESPERA_MS, codificarCredencial } from '../shared/net/credencial';
import { decodeReject, encodeJoin, messageType, MSG, type RejectReason } from '../shared/net/messages';
import { ADMIN_VISIBILIDADE_PATH } from '../shared/visibilidade';
import { startServer, type GameServer } from './Server';
import { mapaRestrito } from './acessoAoMapa';

const TOKEN_DO_DONO = 'token-do-dono-so-para-o-teste-0123456789';
const GUARD = { perIp: 100, total: 200, msgs: 400, burst: 400 };
const w = new Writer(256);
const join_ = () => new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name: 'Piloto', build: 'v1.vector09.plasma-0.rockets-0' }));

async function until(ok: () => boolean, ms = 25_000) {
  const t0 = Date.now();
  while (!ok()) {
    if (Date.now() - t0 > ms) throw new Error('tempo esgotado');
    await new Promise((r) => setTimeout(r, 30));
  }
}

/** Um jogador que pede um mapa: manda a credencial (se tiver) e o JOIN, como o cliente de verdade, e guarda como a conexão acabou. */
function pedir(port: number, mapa: string, credencial: string | null, mandarJoin = true) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/?sala=PROVA&mapa=${mapa}`);
  ws.binaryType = 'arraybuffer';
  const e = { ws, bemVindo: false, recusa: null as RejectReason | null, fechou: null as number | null };
  ws.on('open', () => {
    const prova = credencial === null ? null : codificarCredencial(credencial);
    if (prova) ws.send(prova);
    if (mandarJoin) ws.send(join_());
  });
  ws.on('message', (d: ArrayBuffer) => {
    const b = new Uint8Array(d);
    if (messageType(b) === MSG.WELCOME) e.bemVindo = true;
    if (messageType(b) === MSG.REJECT) e.recusa = decodeReject(b);
  });
  ws.on('close', (codigo) => (e.fechou = codigo));
  ws.on('error', () => {});
  return e;
}

describe('o mapa restrito só abre para a conta de administrador, conferida no servidor (P226, A0)', () => {
  const pasta = resolve('.tmp', 'mapa-restrito-teste');
  let s: GameServer;
  let comum = '';
  let admin = '';
  const abertos: WebSocket[] = [];

  beforeAll(async () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const banco = join(pasta, 'contas.db');
    s = await startServer({ port: 0, host: '127.0.0.1', dbContas: banco, dirDados: pasta, metricasToken: TOKEN_DO_DONO, guard: GUARD });
    const criar = async (email: string) => {
      const r = await fetch(`http://127.0.0.1:${s.port}${CONTA_CRIAR_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha: 'senhasegura', aceite: ACEITE_ATUAL }) });
      expect(r.status).toBe(201);
      return (await r.json()).token as string;
    };
    comum = await criar('comum@x.com');
    admin = await criar('admin@x.com');
    const db = new DatabaseSync(banco);
    db.prepare('UPDATE contas SET is_admin = 1 WHERE email = ?').run('admin@x.com');
    db.close();
  }, 120_000);

  afterAll(async () => {
    for (const ws of abertos) ws.close();
    await s.close();
    rmSync(pasta, { recursive: true, force: true });
  });

  const novo = (...a: Parameters<typeof pedir>) => {
    const e = pedir(...a);
    abertos.push(e.ws);
    return e;
  };

  it('a regra: a exceção do painel vence o padrão do catálogo (o Bunker, a Amazônia e o 8 DE JANEIRO nascem restritos; a Cidade Neon e os Cabos, públicos)', () => {
    expect(mapaRestrito('janeiro', {})).toBe(true);
    expect(mapaRestrito('bunker', {})).toBe(true);
    expect(mapaRestrito('amazonia', {})).toBe(true);
    expect(mapaRestrito('arena', {})).toBe(false);
    expect(mapaRestrito('praia', {})).toBe(false);
    expect(mapaRestrito('janeiro', { 'mapa:janeiro': 'publico' })).toBe(false);
    expect(mapaRestrito('praia', { 'mapa:praia': 'restrito' })).toBe(true);
  });

  it('sem credencial: recusado com o motivo "restrito" e cortado (1008), e a sala nem é criada', async () => {
    const e = novo(s.port, 'janeiro', null);
    await until(() => e.fechou !== null);
    expect(e.recusa).toBe('restrito');
    expect(e.fechou).toBe(1008);
    expect(e.bemVindo).toBe(false);
    expect(s.rooms.size).toBe(0);
  });

  it('com o token de uma conta comum: recusado do mesmo jeito (digitar o link não dá privilégio nenhum)', async () => {
    const e = novo(s.port, 'janeiro', comum);
    await until(() => e.fechou !== null);
    expect(e.recusa).toBe('restrito');
    expect(e.bemVindo).toBe(false);
    expect(s.rooms.size).toBe(0);
  });

  it('com um token inventado: recusado', async () => {
    const e = novo(s.port, 'janeiro', 'token-inventado-que-nao-existe-1234');
    await until(() => e.fechou !== null);
    expect(e.recusa).toBe('restrito');
    expect(s.rooms.size).toBe(0);
  });

  it('com o token de uma conta de administrador: entra no mapa restrito', async () => {
    const e = novo(s.port, 'bunker', admin);
    await until(() => e.bemVindo, 60_000);
    expect(e.recusa).toBeNull();
    expect(e.fechou).toBeNull();
    expect([...s.rooms.keys()]).toEqual(['PROVA@bunker']);
    e.ws.close();
  }, 90_000);

  it('mapa público: entra sem credencial, e uma credencial qualquer (até inválida) é descartada sem derrubar ninguém', async () => {
    const sem = novo(s.port, 'praia', null);
    await until(() => sem.bemVindo, 60_000);
    const lixo = novo(s.port, 'praia', 'credencial-que-nao-vale-de-nada-1234');
    await until(() => lixo.bemVindo, 60_000);
    expect(sem.recusa).toBeNull();
    expect(lixo.recusa).toBeNull();
    sem.ws.close();
    lixo.ws.close();
  }, 120_000);

  it('o painel do Comandante manda: com a Estação dos Cabos restrita, quem não é admin é recusado (e o admin entra)', async () => {
    const r = await fetch(`http://127.0.0.1:${s.port}${ADMIN_VISIBILIDADE_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json', [ADMIN_HEADER]: TOKEN_DO_DONO }, body: JSON.stringify({ itens: { 'mapa:praia': 'restrito' } }) });
    expect(r.status).toBe(200);
    const anonimo = novo(s.port, 'praia', null);
    await until(() => anonimo.fechou !== null);
    expect(anonimo.recusa).toBe('restrito');
    const dono = novo(s.port, 'praia', admin);
    await until(() => dono.bemVindo, 60_000);
    dono.ws.close();
    const volta = await fetch(`http://127.0.0.1:${s.port}${ADMIN_VISIBILIDADE_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json', [ADMIN_HEADER]: TOKEN_DO_DONO }, body: JSON.stringify({ itens: {} }) });
    expect(volta.status).toBe(200);
  }, 120_000);

  it('quem pede o mapa restrito e fica calado é recusado depois da espera, sem prender uma sala', async () => {
    const e = novo(s.port, 'janeiro', null, false);
    await new Promise((r) => setTimeout(r, 500));
    expect(e.fechou).toBeNull(); // ainda dentro da espera
    await until(() => e.fechou !== null, CREDENCIAL_ESPERA_MS + 5000);
    expect(e.recusa).toBe('restrito');
    expect(s.rooms.has('PROVA@janeiro')).toBe(false);
  }, 30_000);
});
