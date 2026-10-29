import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ACEITE_ATUAL,
  CONTA_APAGAR_PATH,
  CONTA_CRIAR_PATH,
  CONTA_DADOS_PATH,
  CONTA_ENTRAR_PATH,
  CONTA_EU_PATH,
  CONTA_MEDICAO_PATH,
  CONTA_PROGRESSO_PATH,
  POLITICA_VERSAO,
  SESSAO_HEADER,
  type DadosDaConta,
} from '../shared/net/auth';
import { WebSocket } from 'ws';
import { PLAY_PATH } from '../shared/net/playMetrics';
import { METRICAS_HEADER, METRICAS_PATH, parseMetricas } from '../shared/net/telemetry';
import { startServer, type GameServer } from './Server';

const TOKEN_DONO = 'token-de-teste-com-mais-de-16';
const SENHA = 'senhasegura';

/** Os direitos do titular (P192, LGPD art. 18) de ponta a ponta, contra o servidor de verdade: aceite na criação, baixar os dados, apagar a conta, não medir a atividade, e nada de dado pessoal no log. */
describe('LGPD: aceite, baixar os dados, apagar a conta e oposição à medição', () => {
  const pasta = resolve('.tmp', `teste-lgpd-${process.pid}`);
  const banco = resolve(pasta, 'contas.db');
  const linhas: string[] = [];
  let server: GameServer;
  const url = (path: string) => `http://127.0.0.1:${server.port}${path}`;
  const json = { 'content-type': 'application/json' };
  const post = (path: string, corpo: unknown, sessao?: string) =>
    fetch(url(path), { method: 'POST', headers: { ...json, ...(sessao ? { [SESSAO_HEADER]: sessao } : {}) }, body: JSON.stringify(corpo) });
  const criar = async (email: string): Promise<string> => ((await (await post(CONTA_CRIAR_PATH, { email, senha: SENHA, aceite: ACEITE_ATUAL })).json()) as { token: string }).token;
  const dados = async (token: string) => (await fetch(url(CONTA_DADOS_PATH), { headers: { [SESSAO_HEADER]: token } })).json() as Promise<DadosDaConta>;
  const lerBanco = <T>(sql: string, ...args: (string | number)[]): T[] => {
    const outra = new DatabaseSync(banco);
    try {
      return outra.prepare(sql).all(...args) as T[];
    } finally {
      outra.close();
    }
  };
  const metricas = async () => (await fetch(url(METRICAS_PATH), { headers: { [METRICAS_HEADER]: TOKEN_DONO } })).json() as Promise<{ dias: { eventos: Record<string, Record<string, number>> }[]; usuarios: { contas: number; ativos: { dia: number } } }>;

  beforeAll(async () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    server = await startServer({
      port: 0,
      host: '127.0.0.1',
      dbContas: banco,
      dirDados: pasta,
      metricasToken: TOKEN_DONO,
      guard: { perIp: 100, total: 200, msgs: 200, burst: 200 },
      limiteLogin: { teto: 1000 },
      log: (l) => linhas.push(l),
    });
  });
  afterAll(async () => {
    await server.close();
    rmSync(pasta, { recursive: true, force: true });
  });

  it('criar a conta exige as duas caixas e a política da versão de hoje; o aceite fica guardado com a data', async () => {
    const base = { email: 'aceite@x.com', senha: SENHA };
    const sem = await post(CONTA_CRIAR_PATH, base);
    expect(sem.status).toBe(400);
    expect((await sem.json()).codigo).toBe('aceite');
    const semIdade = await post(CONTA_CRIAR_PATH, { ...base, aceite: { politica: POLITICA_VERSAO, idade: false } });
    expect(semIdade.status).toBe(400);
    const velha = await post(CONTA_CRIAR_PATH, { ...base, aceite: { politica: '2020-01-01', idade: true } });
    expect(velha.status).toBe(409);
    expect((await velha.json()).codigo).toBe('versao');
    expect(lerBanco('SELECT id FROM contas WHERE email = ?', 'aceite@x.com')).toHaveLength(0); // nada foi criado pelas recusas
    const token = ((await (await post(CONTA_CRIAR_PATH, { ...base, aceite: ACEITE_ATUAL })).json()) as { token: string }).token;
    const d = await dados(token);
    expect(d.conta.aceiteVersao).toBe(POLITICA_VERSAO);
    expect(Date.now() - Date.parse(d.conta.aceiteEm!)).toBeLessThan(60_000);
  });

  it('baixar os dados: só com a sessão; traz a conta, o progresso e a atividade, e nunca o hash da senha nem os segredos das sessões', async () => {
    expect((await fetch(url(CONTA_DADOS_PATH))).status).toBe(401);
    expect((await fetch(url(CONTA_DADOS_PATH), { headers: { [SESSAO_HEADER]: 'inventado' } })).status).toBe(401);
    const token = await criar('dados@x.com');
    const progresso = { apelido: 'ANA', nivel: 4, xp: 120, creditos: 700, montagem: '{"chassis":"marauder"}', atualizadoEm: 1700000000000 };
    await fetch(url(CONTA_PROGRESSO_PATH), { method: 'PUT', headers: { ...json, [SESSAO_HEADER]: token }, body: JSON.stringify(progresso) });
    await fetch(url(PLAY_PATH), {
      method: 'POST',
      headers: { 'content-type': 'text/plain', [SESSAO_HEADER]: token },
      body: JSON.stringify({ v: 1, id: 'rodada-lgpd-01', release: 't', mode: 'deathmatch', online: false, build: 'v2.vector09.plasma-0.rockets-0.-.frontal', assisted: false, outcome: 'completed', seconds: 120, frames: 100, slowFrames: 0, kills: 3, deaths: 1, damage: 10, firstKillS: 5 }),
    });
    const r = await fetch(url(CONTA_DADOS_PATH), { headers: { [SESSAO_HEADER]: token } });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toContain('attachment');
    const d = (await r.json()) as DadosDaConta;
    expect(d.conta).toMatchObject({ email: 'dados@x.com', medirAtividade: true, administrador: false });
    expect(d.progresso).toEqual(progresso);
    expect(d.atividade).toHaveLength(1);
    expect(d.atividade[0]).toMatchObject({ segundos: 120, partidas: 1, abates: 3, mortes: 1 });
    expect(d.sessoes).toHaveLength(1);
    expect(d.entradasEmSalas).toEqual([]); // sem ter entrado numa sala, o diário de presença (P275) vai vazio no arquivo
    const texto = JSON.stringify(d);
    const [linha] = lerBanco<{ hash: string; sal: string }>('SELECT hash, sal FROM contas WHERE email = ?', 'dados@x.com');
    expect(texto).not.toContain(linha!.hash);
    expect(texto).not.toContain(linha!.sal);
    expect(texto).not.toContain(token); // nem o token, nem o hash dele
    for (const s of lerBanco<{ token_hash: string }>('SELECT token_hash FROM sessoes')) expect(texto).not.toContain(s.token_hash);
  });

  it('apagar a conta: senha errada não apaga (e conta como tentativa); senha certa apaga TUDO da conta e só dela, e a sessão morre', async () => {
    const token = await criar('apagar@x.com');
    const outra = await criar('fica@x.com');
    const id = lerBanco<{ id: number }>('SELECT id FROM contas WHERE email = ?', 'apagar@x.com')[0]!.id;
    await fetch(url(CONTA_PROGRESSO_PATH), { method: 'PUT', headers: { ...json, [SESSAO_HEADER]: token }, body: JSON.stringify({ apelido: 'X', nivel: 2, xp: 1, creditos: 1, montagem: '', atualizadoEm: 1 }) });
    expect(lerBanco('SELECT 1 FROM atividade WHERE conta_id = ?', id).length).toBeGreaterThan(0);
    expect((await post(CONTA_APAGAR_PATH, { senha: SENHA })).status).toBe(401); // sem sessão
    const errada = await post(CONTA_APAGAR_PATH, { senha: 'senha-errada-123' }, token);
    expect(errada.status).toBe(401);
    expect((await errada.json()).erro).toBe('senha incorreta');
    expect((await post(CONTA_APAGAR_PATH, {}, token)).status).toBe(401);
    expect(lerBanco('SELECT 1 FROM contas WHERE id = ?', id)).toHaveLength(1);
    const certa = await post(CONTA_APAGAR_PATH, { senha: SENHA }, token);
    expect(certa.status).toBe(200);
    for (const tabela of ['contas', 'progresso', 'atividade', 'sessoes']) {
      const coluna = tabela === 'contas' ? 'id' : 'conta_id';
      expect(lerBanco(`SELECT 1 FROM ${tabela} WHERE ${coluna} = ?`, id), tabela).toHaveLength(0);
    }
    expect((await fetch(url(CONTA_EU_PATH), { headers: { [SESSAO_HEADER]: token } })).status).toBe(401);
    expect((await post(CONTA_ENTRAR_PATH, { email: 'apagar@x.com', senha: SENHA })).status).toBe(401);
    expect((await fetch(url(CONTA_EU_PATH), { headers: { [SESSAO_HEADER]: outra } })).status).toBe(200); // a outra conta segue intacta
    expect((await dados(outra)).conta.email).toBe('fica@x.com');
  });

  it('a oposição: desligar a medição apaga a atividade já registrada e para de registrar; ligar de novo recomeça; /conta/eu mostra a escolha', async () => {
    const token = await criar('medir@x.com');
    const eu = async () => (await (await fetch(url(CONTA_EU_PATH), { headers: { [SESSAO_HEADER]: token } })).json()) as { medir: boolean };
    expect((await eu()).medir).toBe(true);
    const id = lerBanco<{ id: number }>('SELECT id FROM contas WHERE email = ?', 'medir@x.com')[0]!.id;
    expect(lerBanco('SELECT 1 FROM atividade WHERE conta_id = ?', id)).toHaveLength(1);
    expect((await post(CONTA_MEDICAO_PATH, { ativa: false }, token)).status).toBe(200);
    expect((await eu()).medir).toBe(false);
    expect(lerBanco('SELECT 1 FROM atividade WHERE conta_id = ?', id)).toHaveLength(0);
    await fetch(url(PLAY_PATH), {
      method: 'POST',
      headers: { 'content-type': 'text/plain', [SESSAO_HEADER]: token },
      body: JSON.stringify({ v: 1, id: 'rodada-lgpd-02', release: 't', mode: 'deathmatch', online: false, build: 'v2.vector09.plasma-0.rockets-0.-.frontal', assisted: false, outcome: 'completed', seconds: 60, frames: 100, slowFrames: 0, kills: 1, deaths: 0, damage: 1, firstKillS: 5 }),
    });
    expect(lerBanco('SELECT 1 FROM atividade WHERE conta_id = ?', id), 'rodada de quem se opôs não vira atividade').toHaveLength(0);
    expect((await post(CONTA_MEDICAO_PATH, { ativa: true }, token)).status).toBe(200);
    await fetch(url(CONTA_EU_PATH), { headers: { [SESSAO_HEADER]: token } }); // abrir o jogo é a visita do dia
    expect(lerBanco('SELECT 1 FROM atividade WHERE conta_id = ?', id)).toHaveLength(1);
    expect((await post(CONTA_MEDICAO_PATH, { ativa: 'sim' }, token)).status).toBe(400);
    expect((await post(CONTA_MEDICAO_PATH, { ativa: true })).status).toBe(401);
  });

  it('a vida da conta entra nas contagens do dono (criada, login, falha, apagada, dados baixados), só como número', async () => {
    const antes = parseMetricas(await metricas())!;
    const somar = (m: typeof antes, nome: string) => m.dias.reduce((s, d) => s + Object.values(d.eventos[nome] ?? {}).reduce((a, b) => a + b, 0), 0);
    const token = await criar('vida@x.com');
    await post(CONTA_ENTRAR_PATH, { email: 'vida@x.com', senha: SENHA });
    await post(CONTA_ENTRAR_PATH, { email: 'vida@x.com', senha: 'errada-errada' });
    await dados(token);
    await post(CONTA_APAGAR_PATH, { senha: SENHA }, token);
    const depois = parseMetricas(await metricas())!;
    for (const [nome, n] of [['conta_criada', 1], ['login_ok', 1], ['login_falhou', 1], ['dados_baixados', 1], ['conta_apagada', 1]] as const) expect(somar(depois, nome) - somar(antes, nome), nome).toBe(n);
  });

  it('o preflight do navegador libera as três rotas novas', async () => {
    for (const [path, metodo] of [[CONTA_DADOS_PATH, 'GET'], [CONTA_APAGAR_PATH, 'POST'], [CONTA_MEDICAO_PATH, 'POST']] as const) {
      const r = await fetch(url(path), { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } });
      expect(r.status, path).toBe(204);
      expect(r.headers.get('access-control-allow-methods'), path).toContain(metodo);
      expect(r.headers.get('access-control-allow-headers'), path).toContain(SESSAO_HEADER);
    }
  });

  it('o log não leva dado pessoal: nenhum e-mail das contas dos testes e nenhum IP inteiro', async () => {
    const tudo = linhas.join('\n');
    expect(tudo).toContain('conta criada (número');
    expect(tudo).toContain('conta apagada a pedido do titular');
    for (const email of ['aceite@x.com', 'dados@x.com', 'apagar@x.com', 'fica@x.com', 'medir@x.com', 'vida@x.com']) expect(tudo).not.toContain(email);
  });
});

describe('LGPD: as defesas que protegem o apagamento e o log', () => {
  it('apagar a conta usa a régua de tentativas do login: depois do teto, 429 mesmo com a senha certa (uma sessão esquecida aberta não adivinha a senha)', async () => {
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 100, total: 200, msgs: 200, burst: 200 }, limiteLogin: { teto: 3 } });
    try {
      const u = (p: string) => `http://127.0.0.1:${s.port}${p}`;
      const criada = await fetch(u(CONTA_CRIAR_PATH), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'teto@x.com', senha: SENHA, aceite: ACEITE_ATUAL }) }); // 1 de 3
      const { token } = (await criada.json()) as { token: string };
      const apagar = (senha: string) => fetch(u(CONTA_APAGAR_PATH), { method: 'POST', headers: { 'content-type': 'application/json', [SESSAO_HEADER]: token }, body: JSON.stringify({ senha }) });
      expect((await apagar('errada-errada')).status).toBe(401); // 2 de 3
      expect((await apagar('errada-errada')).status).toBe(401); // 3 de 3
      expect((await apagar(SENHA)).status, 'estourou o teto: nem a senha certa passa').toBe(429);
      expect((await fetch(u(CONTA_EU_PATH), { headers: { [SESSAO_HEADER]: token } })).status, 'a conta segue de pé').toBe(200);
    } finally {
      await s.close();
    }
  });

  it('o IP nunca vai inteiro para o log: uma recusa por teto de conexões aparece com o último trecho mascarado', async () => {
    const linhas: string[] = [];
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 1, total: 200, msgs: 200, burst: 200 }, log: (l) => linhas.push(l) });
    const abertos: WebSocket[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://127.0.0.1:${s.port}/?sala=ARENA`);
        ws.on('error', () => {});
        abertos.push(ws);
        await new Promise((ok) => setTimeout(ok, 120));
      }
      await new Promise((ok) => setTimeout(ok, 200));
      const recusas = linhas.filter((l) => l.includes('recusa de'));
      expect(recusas.length, 'o teto por IP recusou').toBeGreaterThan(0);
      for (const l of recusas) {
        expect(l).toContain('127.0.0.x');
        expect(l).not.toContain('127.0.0.1');
      }
    } finally {
      for (const ws of abertos) ws.terminate();
      await s.close();
    }
  });
});
