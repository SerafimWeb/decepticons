import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ADMIN_HEADER } from '../shared/net/admin';
import { ADMIN_TELAO_PATH, normalizarItensDeTelao, TELAO_PATH, TELOES_DA_ARENA } from '../shared/telao';
import { startServer } from './Server';
import { ArmazemDeTelao, TELAO_ARQUIVO } from './telao';

const TOKEN = 'token-do-dono-so-para-o-teste-0123456789';
const GUARD = { perIp: 100, total: 200, msgs: 400, burst: 400 };
const pasta = resolve('.tmp', 'telao-teste');
const ARQUIVOS = ['arena-trailer.mp4', 'marauder.mp4'];

afterAll(() => rmSync(pasta, { recursive: true, force: true }));

describe('o contrato dos telões (P246)', () => {
  it('só passam ids das telas da Cidade Neon, com um arquivo da lista permitida ou null (desligada); o resto do item (titulo) é cosmético e opcional', () => {
    expect(normalizarItensDeTelao({ 'arena:telao-1': { arquivo: 'arena-trailer.mp4' }, 'arena:telao-2': null }, ARQUIVOS)).toEqual({
      'arena:telao-1': { arquivo: 'arena-trailer.mp4' },
      'arena:telao-2': null,
    });
    expect(normalizarItensDeTelao({ 'arena:telao-1': { arquivo: 'arena-trailer.mp4', titulo: '  Trailer da Arena  ' } }, ARQUIVOS)).toEqual({
      'arena:telao-1': { arquivo: 'arena-trailer.mp4', titulo: 'Trailer da Arena' },
    });
  });

  it('recusa silenciosamente o que não presta: tela que não existe, arquivo fora da lista, item em formato torto — cada um vira ausente, não derruba o resto', () => {
    expect(normalizarItensDeTelao({ 'arena:telao-1': { arquivo: 'nao-existe.mp4' }, 'mapa:amazonia': { arquivo: 'arena-trailer.mp4' }, 'arena:telao-2': 'lixo' }, ARQUIVOS)).toEqual({});
  });

  it('formato torto ou grande demais é recusado inteiro (null)', () => {
    expect(normalizarItensDeTelao(null)).toBeNull();
    expect(normalizarItensDeTelao([])).toBeNull();
    expect(normalizarItensDeTelao(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`arena:telao-${i}`, null])))).toBeNull();
  });

  it('sem nenhum arquivo em produção ainda (ARQUIVOS_DE_TELAO vazio), todo arquivo é recusado: só desligar (null) vale', () => {
    expect(normalizarItensDeTelao({ 'arena:telao-1': { arquivo: 'arena-trailer.mp4' } })).toEqual({});
    expect(normalizarItensDeTelao({ 'arena:telao-1': null })).toEqual({ 'arena:telao-1': null });
  });
});

describe('o armazém: guarda no arquivo e sobrevive ao reinício', () => {
  it('grava a versão seguinte, e um armazém novo na mesma pasta lê o que o outro gravou', () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const a = new ArmazemDeTelao(pasta, ARQUIVOS);
    expect(a.atual()).toEqual({ versao: 0, itens: {} });
    expect(a.gravar({ 'arena:telao-1': { arquivo: 'arena-trailer.mp4' } })?.versao).toBe(1);
    expect(a.gravar('lixo')).toBeNull();
    expect(JSON.parse(readFileSync(join(pasta, TELAO_ARQUIVO), 'utf8')).itens).toEqual({ 'arena:telao-1': { arquivo: 'arena-trailer.mp4' } });
    expect(new ArmazemDeTelao(pasta, ARQUIVOS).atual()).toEqual({ versao: 1, itens: { 'arena:telao-1': { arquivo: 'arena-trailer.mp4' } } });
  });

  it('gravar de novo troca a tela inteira: desligar uma não desliga a outra, mas a que não vier mais some (sem sinal)', () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const a = new ArmazemDeTelao(pasta, ARQUIVOS);
    a.gravar({ 'arena:telao-1': { arquivo: 'arena-trailer.mp4' }, 'arena:telao-2': { arquivo: 'marauder.mp4' } });
    const depois = a.gravar({ 'arena:telao-1': null });
    expect(depois).toEqual({ versao: 2, itens: { 'arena:telao-1': null } });
  });
});

describe('as rotas, com o servidor de verdade', () => {
  it('GET /telao é público (sem token, com CORS); só o dono grava por /admin/telao (401 sem a chave, 400 com lixo) e o que ele grava aparece no GET', async () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', dirDados: pasta, metricasToken: TOKEN, guard: GUARD });
    try {
      const base = `http://127.0.0.1:${s.port}`;
      const antes = await fetch(base + TELAO_PATH);
      expect(antes.status).toBe(200);
      expect(antes.headers.get('access-control-allow-origin')).toBe('*');
      expect(await antes.json()).toEqual({ versao: 0, itens: {} });
      const post = (token: string | null, corpo: unknown) =>
        fetch(base + ADMIN_TELAO_PATH, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { [ADMIN_HEADER]: token } : {}) }, body: JSON.stringify(corpo) });
      expect((await post(null, { itens: {} })).status).toBe(401);
      expect((await post('chave-errada-chave-errada', { itens: {} })).status).toBe(401);
      expect((await post(TOKEN, { itens: 'lixo' })).status).toBe(400);
      // Desligar uma tela sempre vale (não depende de nenhum arquivo existir em produção).
      const ok = await post(TOKEN, { itens: { 'arena:telao-1': null } });
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ versao: 1, itens: { 'arena:telao-1': null } });
      expect(await (await fetch(base + TELAO_PATH)).json()).toEqual({ versao: 1, itens: { 'arena:telao-1': null } });
      // Sem nenhum arquivo cadastrado em produção ainda, um arquivo pedido some da gravação (não derruba a chamada: só aquela tela fica de fora).
      const comArquivo = await post(TOKEN, { itens: { 'arena:telao-2': { arquivo: 'qualquer.mp4' } } });
      expect(comArquivo.status).toBe(200);
      expect(await comArquivo.json()).toEqual({ versao: 2, itens: {} });
    } finally {
      await s.close();
    }
  });
});

describe('as telas conhecidas (layout e contrato de acordo)', () => {
  it('TELOES_DA_ARENA tem exatamente as duas telas da Cidade Neon, hoje', () => {
    expect(TELOES_DA_ARENA).toEqual(['arena:telao-1', 'arena:telao-2']);
  });
});
