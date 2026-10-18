import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EVENTO_PATH, RESUMO_PATH } from '../shared/net/telemetry';
import { startServer, type GameServer } from './Server';

async function post(port: number, body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  return fetch(`http://127.0.0.1:${port}${EVENTO_PATH}`, { method: 'POST', headers, body: JSON.stringify(body) });
}
async function resumo(port: number) {
  const res = await fetch(`http://127.0.0.1:${port}${RESUMO_PATH}`);
  expect(res.headers.get('access-control-allow-origin')).toBe('*');
  return res.json();
}

describe('POST /evento e GET /eventos/resumo: telemetria de produto pela porta HTTP', () => {
  let server: GameServer;
  beforeAll(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 100, total: 200, msgs: 200, burst: 200 } });
  });
  afterAll(async () => {
    await server.close();
  });

  it('evento válido conta 204, e some no resumo', async () => {
    const r = await post(server.port, { nome: 'click_cockpit', aba: 'abcd1234' });
    expect(r.status).toBe(204);
    const s = await resumo(server.port);
    expect(s.total.click_cockpit).toBe(1);
    expect(s.janela24h.click_cockpit).toBe(1);
  });

  it('nome fora da lista fechada: 400, não conta nada', async () => {
    const antes = await resumo(server.port);
    const r = await post(server.port, { nome: 'evento_inventado', aba: 'abcd1234' });
    expect(r.status).toBe(400);
    const depois = await resumo(server.port);
    expect(depois.total.click_cockpit).toBe(antes.total.click_cockpit);
  });

  it('corpo maior que o teto: 413, conexão cortada sem travar o servidor', async () => {
    const grande = { nome: 'boot_ok', aba: 'a'.repeat(1500) }; // passa do teto de 1 KB (P193: era 256 bytes antes da audiência)
    const r = await post(server.port, grande);
    expect(r.status).toBe(413);
  });

  it('lixo estrutural (JSON inválido) não derruba o servidor: 400', async () => {
    const r = await fetch(`http://127.0.0.1:${server.port}${EVENTO_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ isso não é json',
    });
    expect(r.status).toBe(400);
  });

  it('preflight OPTIONS responde sem corpo, liberando o POST cross-origin', async () => {
    const r = await fetch(`http://127.0.0.1:${server.port}${EVENTO_PATH}`, { method: 'OPTIONS' });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('reenvio com mesmo identificador não duplica, mas outro evento da aba conta', async () => {
    const before = (await resumo(server.port)).total.boot_ok;
    const event = {nome:'boot_ok',aba:'1234abcd',seq:1};
    expect((await post(server.port,event)).status).toBe(204);
    expect((await post(server.port,event)).status).toBe(204);
    expect((await post(server.port,{...event,seq:2})).status).toBe(204);
    expect((await resumo(server.port)).total.boot_ok-before).toBe(2);
  });

  it('mesmo IP em rajada esbarra na taxa e devolve 429, sem contar mais', async () => {
    let aceitos = 0;
    let recusados = 0;
    for (let i = 0; i < 40; i++) {
      const r = await post(server.port, { nome: 'partida_iniciada', aba: 'ffffffff' });
      if (r.status === 204) aceitos++;
      else if (r.status === 429) recusados++;
    }
    expect(aceitos).toBeLessThanOrEqual(30);
    expect(recusados).toBeGreaterThan(0);
  });
});
