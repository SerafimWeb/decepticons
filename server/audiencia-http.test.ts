import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EVENTO_MAX_BYTES, EVENTO_PATH, METRICAS_HEADER, METRICAS_PATH } from '../shared/net/telemetry';
import type { AudienciaDia } from './Audiencia';
import { startServer, type GameServer } from './Server';

const TOKEN = 'token-de-teste-com-mais-de-16';
const VISITA = { canal: 'social', host: 'instagram.com', disp: 'mobile', nav: 'chrome', so: 'android', lang: 'pt', ret: 'novo' };

/** A audiência (P188) de ponta a ponta: o evento do navegador com o contexto, a Cloudflare dizendo o estado, o que o dono lê em /metricas. */
describe('audiência no servidor de verdade', () => {
  const pasta = resolve('.tmp', `teste-audiencia-${process.pid}`);
  let server: GameServer;
  const opcoes = () => ({ port: 0, host: '127.0.0.1', dbContas: ':memory:', dirDados: pasta, metricasToken: TOKEN, guard: { perIp: 100, total: 200, msgs: 200, burst: 200 } });
  const url = (p: string) => `http://127.0.0.1:${server.port}${p}`;
  const evento = (corpo: unknown, cabecalhos: Record<string, string> = {}) =>
    fetch(url(EVENTO_PATH), { method: 'POST', headers: { 'content-type': 'application/json', ...cabecalhos }, body: JSON.stringify(corpo) });
  const lerAudiencia = async (): Promise<AudienciaDia[]> => ((await (await fetch(url(METRICAS_PATH), { headers: { [METRICAS_HEADER]: TOKEN } })).json()) as { audiencia: { dias: AudienciaDia[] } }).audiencia.dias;
  const hoje = async () => (await lerAudiencia()).at(-1);

  beforeAll(async () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    server = await startServer(opcoes());
  });
  afterAll(async () => {
    await server.close();
    rmSync(pasta, { recursive: true, force: true });
  });

  it('a visita da landing entra no perfil e no funil do canal, com o estado que a Cloudflare disse (só do túnel, só do Brasil)', async () => {
    expect((await evento({ nome: 'landing_view', aba: 'aba00001', seq: 0, o: VISITA }, { 'cf-ipcountry': 'BR', 'cf-region-code': 'SP' })).status).toBe(204);
    const d = (await hoje())!;
    expect(d.perfil.landing).toMatchObject({ canal: { social: 1 }, host: { 'instagram.com': 1 }, disp: { mobile: 1 }, nav: { chrome: 1 }, so: { android: 1 }, lang: { pt: 1 }, ret: { novo: 1 }, uf: { SP: 1 } });
    expect(d.funil.social).toEqual({ landing_view: 1 });
  });

  it('o jogo aberto, o clique e a partida (com e sem conta) chegam ao funil do mesmo canal', async () => {
    await evento({ nome: 'boot_ok', aba: 'aba00002', seq: 0, o: VISITA });
    await evento({ nome: 'click_cockpit', aba: 'aba00001', seq: 1, o: { canal: 'social' } });
    await evento({ nome: 'partida_iniciada', aba: 'aba00002', seq: 1, o: { canal: 'social', conta: 'logado' } });
    await evento({ nome: 'partida_iniciada', aba: 'aba00003', seq: 0, o: { canal: 'social', conta: 'convidado' } });
    await evento({ nome: 'partida_terminada', aba: 'aba00002', seq: 2, o: { canal: 'social', conta: 'logado' } });
    const d = (await hoje())!;
    expect(d.funil.social).toEqual({ landing_view: 1, boot_ok: 1, click_cockpit: 1, partida_iniciada: 2, partida_terminada: 1 });
    expect(d.conta).toEqual({ logado: 1, convidado: 1 });
    expect(d.perfil.jogo!.canal).toEqual({ social: 1 });
  });

  it('o reenvio do mesmo evento (mesma aba e sequência) não conta duas vezes', async () => {
    const antes = (await hoje())!.funil.social!.landing_view!;
    await evento({ nome: 'landing_view', aba: 'aba00004', seq: 0, o: VISITA });
    await evento({ nome: 'landing_view', aba: 'aba00004', seq: 0, o: VISITA });
    expect((await hoje())!.funil.social!.landing_view).toBe(antes + 1);
  });

  it('estado que não vale não entra: de outro país, sigla inventada ou nome por extenso', async () => {
    const antes = { ...(await hoje())!.perfil.landing!.uf };
    await evento({ nome: 'landing_view', aba: 'aba00005', seq: 0, o: VISITA }, { 'cf-ipcountry': 'US', 'cf-region-code': 'SP' });
    await evento({ nome: 'landing_view', aba: 'aba00006', seq: 0, o: VISITA }, { 'cf-ipcountry': 'BR', 'cf-region-code': 'XX' });
    await evento({ nome: 'landing_view', aba: 'aba00007', seq: 0, o: VISITA }, { 'cf-ipcountry': 'BR', 'cf-region-code': 'Sao Paulo' });
    expect((await hoje())!.perfil.landing!.uf).toEqual(antes);
  });

  it('contexto torto não derruba o evento: o clique conta (204), só não entra na audiência', async () => {
    const antes = (await hoje())!.funil;
    for (const o of [{ ...VISITA, canal: 'inventado' }, 'texto', { ...VISITA, host: 'Tem Espaço' }]) expect((await evento({ nome: 'landing_view', aba: `torto${Math.random().toString(36).slice(2, 8)}`, o })).status).toBe(204);
    expect((await hoje())!.funil).toEqual(antes);
  });

  it('o evento do cliente sem contexto (o navegador de antes) continua valendo e não mexe na audiência', async () => {
    const antes = JSON.stringify(await lerAudiencia());
    expect((await evento({ nome: 'boot_ok', aba: 'aba00008', seq: 0 })).status).toBe(204);
    expect(JSON.stringify(await lerAudiencia())).toBe(antes);
  });

  it('o corpo passa de 256 bytes (a visita cheia cabe) mas o teto de 1 KB segura abuso', async () => {
    expect(EVENTO_MAX_BYTES).toBe(1024);
    expect((await evento({ nome: 'landing_view', aba: 'aba00009', seq: 0, o: { ...VISITA, canal: 'campanha', us: 'u'.repeat(32), um: 'm'.repeat(32), uc: 'c'.repeat(32) } })).status).toBe(204);
    expect((await evento({ nome: 'landing_view', aba: 'aba00010', o: VISITA, enchimento: 'x'.repeat(1200) })).status).toBe(413);
  });

  it('nada que identifique: o que o dono lê não leva o id da aba nem IP', async () => {
    const texto = JSON.stringify(await lerAudiencia());
    expect(texto).not.toMatch(/aba0000/);
    expect(texto).not.toContain('127.0.0.1');
  });

  it('sobrevive ao reinício: o servidor grava a audiência e a lê de volta', async () => {
    const antes = JSON.stringify(await lerAudiencia());
    await server.close(); // grava os números ao fechar
    server = await startServer(opcoes());
    expect(JSON.stringify(await lerAudiencia())).toBe(antes);
  });
});

describe('audiência: a régua de taxa por IP vale', () => {
  it('o que passa do teto de eventos do mesmo IP (429) não entra na audiência', async () => {
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', metricasToken: TOKEN, guard: { perIp: 100, total: 200, msgs: 200, burst: 200 } });
    try {
      let aceitos = 0;
      for (let i = 0; i < 40; i++) {
        const r = await fetch(`http://127.0.0.1:${s.port}${EVENTO_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'landing_view', aba: `taxa${String(i).padStart(4, '0')}`, seq: 0, o: VISITA }) });
        if (r.status === 204) aceitos++;
      }
      expect(aceitos, 'a régua cortou em algum ponto').toBeLessThan(40);
      const dias = ((await (await fetch(`http://127.0.0.1:${s.port}${METRICAS_PATH}`, { headers: { [METRICAS_HEADER]: TOKEN } })).json()) as { audiencia: { dias: AudienciaDia[] } }).audiencia.dias;
      expect(dias.at(-1)!.funil.social!.landing_view).toBe(aceitos);
    } finally {
      await s.close();
    }
  });
});
