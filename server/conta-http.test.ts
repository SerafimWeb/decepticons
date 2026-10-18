import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACEITE_ATUAL, CONTA_CRIAR_PATH, CONTA_ENTRAR_PATH, CONTA_EU_PATH, CONTA_SAIR_PATH, SESSAO_HEADER } from '../shared/net/auth';
import { startServer, type GameServer } from './Server';

async function post(port: number, path: string, body: unknown) {
  return fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

describe('rotas de conta: criar, entrar, sair, eu', () => {
  let server: GameServer;
  beforeAll(async () => {
    // limiteLogin alargado: o teste do rate limit de verdade mora sozinho, num servidor próprio, abaixo.
    server = await startServer({
      port: 0,
      host: '127.0.0.1',
      dbContas: ':memory:',
      guard: { perIp: 100, total: 200, msgs: 200, burst: 200 },
      limiteLogin: { teto: 1000 },
    });
  });
  afterAll(async () => {
    await server.close();
  });

  it('cria conta, recebe token, e /conta/eu confirma a sessão', async () => {
    const r = await post(server.port, CONTA_CRIAR_PATH, { email: 'dan@x.com', senha: 'senhasegura', aceite: ACEITE_ATUAL });
    expect(r.status).toBe(201);
    const { token, email } = await r.json();
    expect(email).toBe('dan@x.com');
    expect(typeof token).toBe('string');

    const eu = await fetch(`http://127.0.0.1:${server.port}${CONTA_EU_PATH}`, { headers: { [SESSAO_HEADER]: token } });
    expect(eu.status).toBe(200);
    expect((await eu.json()).email).toBe('dan@x.com');
  });

  it('e-mail repetido recusa com 409', async () => {
    await post(server.port, CONTA_CRIAR_PATH, { email: 'repetido@x.com', senha: 'senhasegura', aceite: ACEITE_ATUAL });
    const r = await post(server.port, CONTA_CRIAR_PATH, { email: 'repetido@x.com', senha: 'outrasenha', aceite: ACEITE_ATUAL });
    expect(r.status).toBe(409);
  });

  it('entrar com a senha certa devolve token; senha errada devolve 401', async () => {
    await post(server.port, CONTA_CRIAR_PATH, { email: 'entra@x.com', senha: 'senhasegura', aceite: ACEITE_ATUAL });
    const ok = await post(server.port, CONTA_ENTRAR_PATH, { email: 'entra@x.com', senha: 'senhasegura' });
    expect(ok.status).toBe(200);
    const ruim = await post(server.port, CONTA_ENTRAR_PATH, { email: 'entra@x.com', senha: 'senhaerrada' });
    expect(ruim.status).toBe(401);
  });

  it('/conta/eu sem sessão ou com token inventado devolve 401', async () => {
    const semToken = await fetch(`http://127.0.0.1:${server.port}${CONTA_EU_PATH}`);
    expect(semToken.status).toBe(401);
    const tokenFalso = await fetch(`http://127.0.0.1:${server.port}${CONTA_EU_PATH}`, { headers: { [SESSAO_HEADER]: 'nao-existe' } });
    expect(tokenFalso.status).toBe(401);
  });

  it('sair invalida a sessão', async () => {
    const criado = await post(server.port, CONTA_CRIAR_PATH, { email: 'sai@x.com', senha: 'senhasegura', aceite: ACEITE_ATUAL });
    const { token } = await criado.json();
    const sair = await fetch(`http://127.0.0.1:${server.port}${CONTA_SAIR_PATH}`, { method: 'POST', headers: { [SESSAO_HEADER]: token } });
    expect(sair.status).toBe(204);
    const eu = await fetch(`http://127.0.0.1:${server.port}${CONTA_EU_PATH}`, { headers: { [SESSAO_HEADER]: token } });
    expect(eu.status).toBe(401);
  });

  it('e-mail ou senha fora do contrato: 400, nada criado', async () => {
    const semSenha = await post(server.port, CONTA_CRIAR_PATH, { email: 'x@x.com' });
    expect(semSenha.status).toBe(400);
    const senhaCurta = await post(server.port, CONTA_CRIAR_PATH, { email: 'x2@x.com', senha: 'curta', aceite: ACEITE_ATUAL });
    expect(senhaCurta.status).toBe(400);
  });

  it('corpo grande demais: 413', async () => {
    const r = await post(server.port, CONTA_CRIAR_PATH, { email: 'grande@x.com', senha: 'x'.repeat(5000) });
    expect(r.status).toBe(413);
  });
});

describe('rate limit das rotas de conta: sozinho, com régua apertada de propósito', () => {
  let server: GameServer;
  beforeAll(async () => {
    server = await startServer({
      port: 0,
      host: '127.0.0.1',
      dbContas: ':memory:',
      guard: { perIp: 100, total: 200, msgs: 200, burst: 200 },
      limiteLogin: { teto: 5, janelaMs: 10 * 60 * 1000 },
    });
  });
  afterAll(async () => {
    await server.close();
  });

  it('depois do teto, o mesmo IP toma 429', async () => {
    let ultimoStatus = 0;
    for (let i = 0; i < 8; i++) {
      const r = await post(server.port, CONTA_ENTRAR_PATH, { email: 'nao-existe-mesmo@x.com', senha: 'qualquercoisa' });
      ultimoStatus = r.status;
    }
    expect(ultimoStatus).toBe(429);
  });
});
