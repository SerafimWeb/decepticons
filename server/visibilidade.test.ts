import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ADMIN_HEADER } from '../shared/net/admin';
import { ADMIN_VISIBILIDADE_PATH, normalizarItens, VISIBILIDADE_PATH } from '../shared/visibilidade';
import { startServer } from './Server';
import { ArmazemDeVisibilidade, VISIBILIDADE_ARQUIVO } from './visibilidade';

const TOKEN = 'token-do-dono-so-para-o-teste-0123456789';
const GUARD = { perIp: 100, total: 200, msgs: 400, burst: 400 };
const pasta = resolve('.tmp', 'visibilidade-teste');

afterAll(() => rmSync(pasta, { recursive: true, force: true }));

describe('o contrato da visibilidade (P191)', () => {
  it('só passam ids bem formados com um estado conhecido; formato torto ou grande demais é recusado inteiro', () => {
    expect(normalizarItens({ 'mapa:amazonia': 'restrito', 'tela:lado': 'publico', 'Maiúscula': 'restrito', 'arma:x': 'secreto' })).toEqual({ 'mapa:amazonia': 'restrito', 'tela:lado': 'publico' });
    expect(normalizarItens(null)).toBeNull();
    expect(normalizarItens([])).toBeNull();
    expect(normalizarItens(Object.fromEntries(Array.from({ length: 401 }, (_, i) => [`a:${i}`, 'restrito'])))).toBeNull();
  });
});

describe('o armazém: guarda no arquivo e sobrevive ao reinício', () => {
  it('grava a versão seguinte, e um armazém novo na mesma pasta lê o que o outro gravou', () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const a = new ArmazemDeVisibilidade(pasta);
    expect(a.atual()).toEqual({ versao: 0, itens: {} });
    expect(a.gravar({ 'tela:arquivo': 'publico' })?.versao).toBe(1);
    expect(a.gravar('lixo')).toBeNull();
    expect(JSON.parse(readFileSync(join(pasta, VISIBILIDADE_ARQUIVO), 'utf8')).itens).toEqual({ 'tela:arquivo': 'publico' });
    expect(new ArmazemDeVisibilidade(pasta).atual()).toEqual({ versao: 1, itens: { 'tela:arquivo': 'publico' } });
  });
});

describe('as rotas, com o servidor de verdade', () => {
  it('GET /visibilidade é público (sem token, com CORS); só o dono grava por /admin/visibilidade (401 sem a chave, 400 com lixo) e o que ele grava aparece no GET', async () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', dirDados: pasta, metricasToken: TOKEN, guard: GUARD });
    try {
      const base = `http://127.0.0.1:${s.port}`;
      const antes = await fetch(base + VISIBILIDADE_PATH);
      expect(antes.status).toBe(200);
      expect(antes.headers.get('access-control-allow-origin')).toBe('*');
      expect(await antes.json()).toEqual({ versao: 0, itens: {} });
      const post = (token: string | null, corpo: unknown) => fetch(base + ADMIN_VISIBILIDADE_PATH, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { [ADMIN_HEADER]: token } : {}) }, body: JSON.stringify(corpo) });
      expect((await post(null, { itens: {} })).status).toBe(401);
      expect((await post('chave-errada-chave-errada', { itens: {} })).status).toBe(401);
      expect((await post(TOKEN, { itens: 'lixo' })).status).toBe(400);
      const ok = await post(TOKEN, { itens: { 'mapa:amazonia': 'restrito' } });
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ versao: 1, itens: { 'mapa:amazonia': 'restrito' } });
      expect(await (await fetch(base + VISIBILIDADE_PATH)).json()).toEqual({ versao: 1, itens: { 'mapa:amazonia': 'restrito' } });
      // e o /status (por onde o jogo pergunta: todo servidor o responde com CORS) já traz a visibilidade nova
      expect((await (await fetch(`${base}/status`)).json()).visibilidade).toEqual({ versao: 1, itens: { 'mapa:amazonia': 'restrito' } });
    } finally {
      await s.close();
    }
  });
});
