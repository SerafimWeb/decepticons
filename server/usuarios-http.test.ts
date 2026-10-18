import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONTA_CRIAR_PATH, CONTA_EU_PATH, SESSAO_HEADER } from '../shared/net/auth';
import { PLAY_PATH } from '../shared/net/playMetrics';
import { METRICAS_HEADER, METRICAS_PATH } from '../shared/net/telemetry';
import type { MetricasUsuarios } from './contas';
import { startServer, type GameServer } from './Server';

const TOKEN = 'token-de-teste-com-mais-de-16';
const BUILD = 'v2.vector09.plasma-0.rockets-0.-.frontal';
const RODADA = {
  v: 1,
  id: 'rodada-aaaa1111',
  release: 'teste',
  mode: 'survival',
  online: false,
  build: BUILD,
  assisted: false,
  outcome: 'completed',
  seconds: 60,
  frames: 3600,
  slowFrames: 1,
  kills: 2,
  deaths: 1,
  damage: 300,
  firstKillS: 15,
  map: 'amazonia',
  wave: 3,
  won: true,
};

/** As métricas dos pilotos com conta (P185) de ponta a ponta: a sessão que o navegador manda com a rodada, a visita ao abrir o jogo e o que o dono lê em `/metricas`. */
describe('atividade dos pilotos com conta no servidor de verdade', () => {
  const pasta = resolve('.tmp', `teste-usuarios-${process.pid}`);
  const banco = resolve(pasta, 'contas.db');
  let server: GameServer;
  let token: string;
  const url = (path: string) => `http://127.0.0.1:${server.port}${path}`;
  const lerMetricas = async () =>
    (await (await fetch(url(METRICAS_PATH), { headers: { [METRICAS_HEADER]: TOKEN } })).json()) as {
      usuarios: MetricasUsuarios;
      play: { days: { reports: number; logged: number }[]; maps: { map: string; mode: string; reports: number; won: number; waves: number; logged: number }[] };
    };
  const enviar = (rodada: object, sessao?: string) =>
    fetch(url(PLAY_PATH), { method: 'POST', headers: { 'content-type': 'text/plain', ...(sessao ? { [SESSAO_HEADER]: sessao } : {}) }, body: JSON.stringify(rodada) });

  beforeAll(async () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: banco, dirDados: pasta, metricasToken: TOKEN, guard: { perIp: 100, total: 200, msgs: 200, burst: 200 }, limiteLogin: { teto: 1000 } });
    const r = await fetch(url(CONTA_CRIAR_PATH), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'piloto@x.com', senha: 'senhasegura' }) });
    token = ((await r.json()) as { token: string }).token;
  });
  afterAll(async () => {
    await server.close();
    rmSync(pasta, { recursive: true, force: true });
  });

  it('criar a conta já é uma entrada do dia (o piloto abriu o jogo), mas ainda não é partida', async () => {
    const m = await lerMetricas();
    expect(m.usuarios.contas).toBe(1);
    expect(m.usuarios.ativos.dia).toBe(1);
    expect(m.usuarios.jogaram.dia).toBe(0);
  });

  it('a rodada que chega com a sessão da conta entra na atividade do piloto e nos totais com a marca de conta; o mapa, a onda e a vitória aparecem', async () => {
    expect((await enviar(RODADA, token)).status).toBe(204);
    const m = await lerMetricas();
    expect(m.usuarios.jogaram.dia).toBe(1);
    expect(m.usuarios.minutosPorJogador).toBe(1);
    expect(m.usuarios.porDia.at(-1)).toMatchObject({ partidas: 1, abates: 2, mortes: 1, minutos: 1 });
    expect(m.play.days.at(-1)).toMatchObject({ reports: 1, logged: 1 });
    expect(m.play.maps).toHaveLength(1);
    expect(m.play.maps[0]).toMatchObject({ map: 'amazonia', mode: 'survival', reports: 1, won: 1, waves: 3, logged: 1 });
  });

  it('o reenvio da mesma rodada (a rede falhou no meio) não conta duas vezes na atividade do piloto', async () => {
    expect((await enviar(RODADA, token)).status).toBe(204);
    const m = await lerMetricas();
    expect(m.usuarios.porDia.at(-1)!.partidas).toBe(1);
    expect(m.play.days.at(-1)!.reports).toBe(1);
  });

  it('sem sessão, ou com uma sessão inventada, a rodada vale como a de um convidado: entra nos totais, não na atividade de ninguém', async () => {
    expect((await enviar({ ...RODADA, id: 'rodada-bbbb2222' })).status).toBe(204);
    expect((await enviar({ ...RODADA, id: 'rodada-cccc3333' }, 'sessao-inventada-que-nao-existe')).status).toBe(204);
    const m = await lerMetricas();
    expect(m.play.days.at(-1)).toMatchObject({ reports: 3, logged: 1 });
    expect(m.usuarios.porDia.at(-1)!.partidas).toBe(1);
    expect(m.usuarios.jogaram.dia).toBe(1);
  });

  it('o preflight do navegador libera o cabeçalho da sessão na rota das partidas (sem isso o envio com conta cai no CORS)', async () => {
    const r = await fetch(url(PLAY_PATH), { method: 'OPTIONS' });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-headers')).toContain(SESSAO_HEADER);
    expect(r.headers.get('access-control-allow-headers')).toContain('content-type');
  });

  it('abrir o jogo com a sessão guardada (GET /conta/eu) é a visita do dia, mesmo sem jogar', async () => {
    const outra = new DatabaseSync(banco); // uma segunda conexão ao mesmo arquivo: zera a atividade para ver só a visita
    outra.exec('DELETE FROM atividade');
    outra.close();
    expect((await lerMetricas()).usuarios.ativos.dia).toBe(0);
    expect((await fetch(url(CONTA_EU_PATH), { headers: { [SESSAO_HEADER]: token } })).status).toBe(200);
    const m = await lerMetricas();
    expect(m.usuarios.ativos.dia).toBe(1);
    expect(m.usuarios.jogaram.dia).toBe(0);
    // uma sessão que não vale não faz visita de ninguém
    await fetch(url(CONTA_EU_PATH), { headers: { [SESSAO_HEADER]: 'sessao-inventada' } });
    expect((await lerMetricas()).usuarios.ativos.dia).toBe(1);
  });

  it('o que o dono lê são só contagens: nenhum e-mail nem identificador de conta no bloco dos pilotos', async () => {
    const m = await lerMetricas();
    const texto = JSON.stringify(m.usuarios);
    expect(texto).not.toContain('piloto@x.com');
    expect(texto).not.toContain('x.com');
    expect(Object.keys(m.usuarios).sort()).toEqual(['ativos', 'contas', 'desde', 'jogaram', 'minutosPorJogador', 'novasPorDia', 'porDia', 'retencao']);
  });
});
