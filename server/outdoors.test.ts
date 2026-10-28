import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ADMIN_HEADER } from '../shared/net/admin';
import {
  ADMIN_OUTDOORS_PATH,
  ANUNCIOS_QUE_ALTERNAM,
  configPadraoDeOutdoors,
  lerConfigDeOutdoors,
  normalizarParametros,
  OUTDOORS_MAXIMO,
  OUTDOORS_PATH,
  PARAMETROS_PADRAO,
  PERIODO_MAXIMO,
  PERIODO_MINIMO,
} from '../shared/outdoors';
import { startServer } from './Server';
import { ArmazemDeOutdoors, OUTDOORS_ARQUIVO } from './outdoors';

const TOKEN = 'token-do-dono-so-para-o-teste-0123456789';
const GUARD = { perIp: 100, total: 200, msgs: 400, burst: 400 };
const pasta = resolve('.tmp', 'outdoors-teste');

afterAll(() => rmSync(pasta, { recursive: true, force: true }));

describe('o contrato dos outdoors (P267)', () => {
  it('aceita o que o painel oferece: quantidade inteira, período entre 5 e 30 s (ao meio segundo mais perto) e desligados só de anúncios que existem, sem repetir', () => {
    expect(normalizarParametros({ quantidade: 12, periodo: 10, desligados: [] })).toEqual({ quantidade: 12, periodo: 10, desligados: [] });
    expect(normalizarParametros({ quantidade: 0, periodo: 15.3, desligados: ['odp-ping', 'odp-ping', 'nao-existe'] })).toEqual({ quantidade: 0, periodo: 15.5, desligados: ['odp-ping'] });
    expect(normalizarParametros({ quantidade: OUTDOORS_MAXIMO, periodo: PERIODO_MINIMO, desligados: [] })?.quantidade).toBe(OUTDOORS_MAXIMO);
    expect(normalizarParametros({ quantidade: 1, periodo: PERIODO_MAXIMO, desligados: [] })?.periodo).toBe(PERIODO_MAXIMO);
  });

  it('recusa inteiro o que está fora do que o painel oferece: quantidade fracionada/negativa/grande, período fora de 5–30 s ou não numérico, lista torta', () => {
    const bom = { quantidade: 10, periodo: 12, desligados: [] };
    for (const ruim of [
      { ...bom, quantidade: 1.5 },
      { ...bom, quantidade: -1 },
      { ...bom, quantidade: OUTDOORS_MAXIMO + 1 },
      { ...bom, quantidade: '10' },
      { ...bom, periodo: PERIODO_MINIMO - 0.5 },
      { ...bom, periodo: PERIODO_MAXIMO + 0.5 },
      { ...bom, periodo: Number.NaN },
      { ...bom, desligados: 'odp-ping' },
      { ...bom, desligados: Array(33).fill('odp-ping') },
      null,
      'lixo',
      [],
    ]) {
      expect(normalizarParametros(ruim), JSON.stringify(ruim)).toBeNull();
    }
  });

  it('não deixa desligar todos os anúncios que alternam (o outdoor ficaria sem o que mostrar), mas deixa um só', () => {
    expect(normalizarParametros({ quantidade: 10, periodo: 12, desligados: [...ANUNCIOS_QUE_ALTERNAM] })).toBeNull();
    expect(normalizarParametros({ quantidade: 10, periodo: 12, desligados: ANUNCIOS_QUE_ALTERNAM.slice(1) })?.desligados).toHaveLength(ANUNCIOS_QUE_ALTERNAM.length - 1);
  });

  it('lerConfigDeOutdoors é tolerante: o que não presta vira o padrão, e a versão torta vira 0', () => {
    expect(lerConfigDeOutdoors('lixo')).toEqual(configPadraoDeOutdoors());
    expect(lerConfigDeOutdoors({ versao: 7, quantidade: 8, periodo: 20, desligados: ['swb'] })).toEqual({ versao: 7, quantidade: 8, periodo: 20, desligados: ['swb'] });
    expect(lerConfigDeOutdoors({ versao: -3, quantidade: 8, periodo: 20, desligados: [] }).versao).toBe(0);
    expect(configPadraoDeOutdoors()).toEqual({ versao: 0, quantidade: PARAMETROS_PADRAO.quantidade, periodo: PARAMETROS_PADRAO.periodo, desligados: [] });
  });
});

describe('o armazém dos outdoors: guarda no arquivo e sobrevive ao reinício', () => {
  it('começa no padrão, grava a versão seguinte, recusa lixo sem mexer em nada, e um armazém novo na mesma pasta lê o que o outro gravou', () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const a = new ArmazemDeOutdoors(pasta);
    expect(a.atual()).toEqual(configPadraoDeOutdoors());
    expect(a.gravar({ quantidade: 18, periodo: 15, desligados: ['swb'] })?.versao).toBe(1);
    expect(a.gravar({ quantidade: 999, periodo: 15, desligados: [] })).toBeNull();
    expect(a.atual()).toEqual({ versao: 1, quantidade: 18, periodo: 15, desligados: ['swb'] });
    expect(JSON.parse(readFileSync(join(pasta, OUTDOORS_ARQUIVO), 'utf8'))).toEqual({ versao: 1, quantidade: 18, periodo: 15, desligados: ['swb'] });
    expect(new ArmazemDeOutdoors(pasta).atual()).toEqual({ versao: 1, quantidade: 18, periodo: 15, desligados: ['swb'] });
  });
});

describe('as rotas dos outdoors, com o servidor de verdade', () => {
  it('GET /outdoors é público (sem token, com CORS); só o dono grava por /admin/outdoors (401 sem a chave, 400 com lixo) e o que ele grava aparece no GET', async () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', dirDados: pasta, metricasToken: TOKEN, guard: GUARD });
    try {
      const base = `http://127.0.0.1:${s.port}`;
      const antes = await fetch(base + OUTDOORS_PATH);
      expect(antes.status).toBe(200);
      expect(antes.headers.get('access-control-allow-origin')).toBe('*');
      expect(await antes.json()).toEqual(configPadraoDeOutdoors());
      const post = (token: string | null, corpo: unknown) =>
        fetch(base + ADMIN_OUTDOORS_PATH, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { [ADMIN_HEADER]: token } : {}) }, body: JSON.stringify(corpo) });
      const bom = { quantidade: 14, periodo: 10, desligados: ['odp-gps'] };
      expect((await post(null, bom)).status).toBe(401);
      expect((await post('chave-errada-chave-errada', bom)).status).toBe(401);
      expect((await post(TOKEN, { ...bom, quantidade: 'muitos' })).status).toBe(400);
      expect((await post(TOKEN, { ...bom, periodo: 1 })).status).toBe(400);
      // Nada do que foi recusado mudou o que vale.
      expect(await (await fetch(base + OUTDOORS_PATH)).json()).toEqual(configPadraoDeOutdoors());
      const ok = await post(TOKEN, bom);
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ versao: 1, ...bom });
      expect(await (await fetch(base + OUTDOORS_PATH)).json()).toEqual({ versao: 1, ...bom });
    } finally {
      await s.close();
    }
  });
});
