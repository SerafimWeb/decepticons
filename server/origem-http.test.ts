import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { ACEITE_ATUAL, CONTA_CRIAR_PATH, CONTA_ENTRAR_PATH, CONTA_EU_PATH } from '../shared/net/auth';
import { startServer, type GameServer } from './Server';

const JOGO = 'https://cybermech.online';
const DE_FORA = 'https://site-de-fora.exemplo';

function post(port: number, path: string, origem: string | undefined, body: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (origem) headers.origin = origem;
  return fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

/**
 * Abre o WebSocket e diz se o aperto de mão passou (`open`) ou foi recusado (`error`/`unexpected-response`).
 * Usa o caminho do mural (`/?mural=1`): o aperto de mão é o mesmo de uma sala, mas não cria partida nem física (barato).
 */
function abre(port: number, origem: string | undefined): Promise<'aberto' | 'recusado'> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?mural=1`, origem ? { origin: origem } : {});
    ws.on('open', () => {
      ws.close();
      resolve('aberto');
    });
    ws.on('error', () => resolve('recusado'));
    ws.on('unexpected-response', () => resolve('recusado'));
  });
}

describe('trava de origem do servidor', () => {
  let server: GameServer;
  beforeAll(async () => {
    server = await startServer({
      port: 0,
      host: '127.0.0.1',
      dbContas: ':memory:',
      guard: { perIp: 100, total: 200, msgs: 200, burst: 200 },
      limiteLogin: { teto: 1000 },
      origens: ['https://beta.exemplo'],
    });
  });
  afterAll(async () => {
    await server.close();
  });

  it('conta: origem de fora leva 403 e nenhuma conta nasce', async () => {
    const r = await post(server.port, CONTA_CRIAR_PATH, DE_FORA, { email: 'fora@x.com', senha: 'senhasegura', aceite: ACEITE_ATUAL });
    expect(r.status).toBe(403);
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
    // se tivesse criado, entrar com a senha certa devolveria 200
    const entra = await post(server.port, CONTA_ENTRAR_PATH, JOGO, { email: 'fora@x.com', senha: 'senhasegura' });
    expect(entra.status).toBe(401);
  });

  it('conta: o jogo no ar passa e recebe a PRÓPRIA origem no CORS, nunca o asterisco', async () => {
    const r = await post(server.port, CONTA_CRIAR_PATH, JOGO, { email: 'dentro@x.com', senha: 'senhasegura', aceite: ACEITE_ATUAL });
    expect(r.status).toBe(201);
    expect(r.headers.get('access-control-allow-origin')).toBe(JOGO);
    expect(r.headers.get('vary')).toContain('origin');
  });

  it('conta: origem extra da configuração passa; sem origem (não é navegador) passa', async () => {
    const extra = await post(server.port, CONTA_CRIAR_PATH, 'https://beta.exemplo', { email: 'beta@x.com', senha: 'senhasegura', aceite: ACEITE_ATUAL });
    expect(extra.status).toBe(201);
    const semOrigem = await post(server.port, CONTA_CRIAR_PATH, undefined, { email: 'curl@x.com', senha: 'senhasegura', aceite: ACEITE_ATUAL });
    expect(semOrigem.status).toBe(201);
  });

  it('conta: /conta/eu de fora também leva 403', async () => {
    const r = await fetch(`http://127.0.0.1:${server.port}${CONTA_EU_PATH}`, { headers: { origin: DE_FORA } });
    expect(r.status).toBe(403);
  });

  it('WebSocket: origem de fora é recusada no aperto de mão; jogo, rede local e cliente sem origem abrem', async () => {
    expect(await abre(server.port, DE_FORA)).toBe('recusado');
    expect(await abre(server.port, 'null')).toBe('recusado');
    expect(await abre(server.port, JOGO)).toBe('aberto');
    expect(await abre(server.port, 'http://localhost:5173')).toBe('aberto');
    expect(await abre(server.port, 'https://beta.exemplo')).toBe('aberto');
    expect(await abre(server.port, undefined)).toBe('aberto');
  });
});
