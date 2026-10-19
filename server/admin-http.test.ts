import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import {
  ADMIN_AVALIAR_PATH,
  ADMIN_ESTADO_PATH,
  ADMIN_FECHAR_SALA_PATH,
  ADMIN_HEADER,
  ADMIN_HISTORICO_PATH,
  ADMIN_LOG_PATH,
  ADMIN_REINICIAR_PATH,
  ADMIN_TESTAR_PATH,
  lerAvaliacao,
  lerErro,
  lerEstado,
  lerHistorico,
  lerLog,
  lerTeste,
} from '../shared/net/admin';
import { ACEITE_ATUAL, CONTA_CRIAR_PATH } from '../shared/net/auth';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION } from '../shared/net/constants';
import { encodeJoin, messageType, MSG } from '../shared/net/messages';
import { startServer, type GameServer } from './Server';

const TOKEN = 'token-do-dono-so-para-o-teste-0123456789';
const w = new Writer(256);
const join_ = (name: string) => new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name, build: 'v1.vector09.plasma-0.rockets-0' }));
/** O guard solto: o teste abre vários sockets do mesmo IP. */
const GUARD = { perIp: 100, total: 200, msgs: 400, burst: 400 };

// 25 s: com a máquina ocupada o servidor de teste, o autoteste e os pings demoram; o limite curto reprovava o deploy por tempo, não por erro (12/10).
async function until(ok: () => boolean | Promise<boolean>, ms = 25_000) {
  const t0 = Date.now();
  while (!(await ok())) {
    if (Date.now() - t0 > ms) throw new Error('tempo esgotado');
    await new Promise((r) => setTimeout(r, 40));
  }
}

/** Um jogador de verdade: abre o socket, manda o JOIN e espera as boas-vindas. */
async function entrar(port: number, sala: string, nome: string): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/?sala=${sala}`);
  ws.binaryType = 'arraybuffer';
  let bemVindo = false;
  ws.on('message', (d: ArrayBuffer) => {
    if (messageType(new Uint8Array(d)) === MSG.WELCOME) bemVindo = true;
  });
  await new Promise<void>((ok, err) => {
    ws.on('open', () => ok());
    ws.on('error', () => err(new Error('sem conexão')));
  });
  ws.send(join_(nome));
  await until(() => bemVindo);
  return ws;
}

const chamar = (porta: number, caminho: string, o: { metodo?: string; token?: string | null; corpo?: unknown } = {}) =>
  fetch(`http://127.0.0.1:${porta}${caminho}`, {
    method: o.metodo ?? 'GET',
    headers: { ...(o.token === null ? {} : { [ADMIN_HEADER]: o.token ?? TOKEN }), ...(o.corpo !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(o.corpo !== undefined ? { body: JSON.stringify(o.corpo) } : {}),
  });

describe('o painel do servidor (/admin/*), com o servidor de verdade', () => {
  let server: GameServer;
  let dados: string;
  const aoReiniciar = vi.fn();
  beforeAll(async () => {
    dados = resolve('.tmp', 'admin-http-teste');
    rmSync(dados, { recursive: true, force: true });
    mkdirSync(dados, { recursive: true });
    server = await startServer({
      port: 0,
      host: '127.0.0.1',
      dbContas: ':memory:',
      dirDados: dados,
      metricasToken: TOKEN,
      guard: GUARD,
      release: 'abc1234',
      supervisionado: true,
      aoReiniciar,
      amostraCadaMs: 60,
      reinicioEmMs: 80,
      // 3 s de medida: com a máquina ocupada, os pings (um por segundo) precisam de mais de uma chance de voltar dentro da janela.
      testeDuracaoS: 3,
      salvarCadaMs: 60_000,
      // Este servidor leva erros de token de propósito (o primeiro teste); a régua de verdade é testada à parte, em outro servidor.
      limiteAdmin: { teto: 10_000 },
    });
  });
  afterAll(async () => {
    await server.close();
    rmSync(dados, { recursive: true, force: true });
  });

  it('sem o token ou com o errado, nenhuma rota responde (401), e o método errado é 405', async () => {
    for (const p of [ADMIN_ESTADO_PATH, ADMIN_HISTORICO_PATH, ADMIN_LOG_PATH, ADMIN_AVALIAR_PATH]) {
      expect((await chamar(server.port, p, { token: null })).status, `${p} sem token`).toBe(401);
      expect((await chamar(server.port, p, { token: 'errado' })).status, `${p} com o token errado`).toBe(401);
    }
    for (const p of [ADMIN_TESTAR_PATH, ADMIN_FECHAR_SALA_PATH, ADMIN_REINICIAR_PATH]) {
      expect((await chamar(server.port, p, { metodo: 'POST', token: null, corpo: {} })).status, `${p} sem token`).toBe(401);
    }
    expect((await chamar(server.port, ADMIN_ESTADO_PATH, { metodo: 'POST', corpo: {} })).status).toBe(405);
    expect((await chamar(server.port, ADMIN_REINICIAR_PATH, { metodo: 'GET' })).status).toBe(405);
  });

  it('o preflight do navegador passa sem token e a resposta deixa o site do jogo chamar (CORS)', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}${ADMIN_ESTADO_PATH}`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-headers')).toContain(ADMIN_HEADER);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('rota de /admin/ que não é do painel não responde como painel (segue para o resto do servidor)', async () => {
    const res = await chamar(server.port, '/admin/qualquer-coisa', { token: null });
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  it('o estado: o contrato inteiro, a release, a supervisão e as salas vazias', async () => {
    const res = await chamar(server.port, ADMIN_ESTADO_PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const e = lerEstado(await res.json());
    expect(e).not.toBeNull();
    expect(e!.protocolo).toBe(PROTOCOL_VERSION);
    expect(e!.release).toBe('abc1234');
    expect(e!.supervisionado).toBe(true);
    expect(e!.porta).toBe(server.port);
    expect(e!.jogadores).toBe(0);
    expect(e!.salas).toEqual([]);
    expect(e!.contas).toBe(0);
    expect(e!.memoria.rssMB).toBeGreaterThan(20);
    expect(e!.reiniciando).toBe(false);
    expect(Date.parse(e!.iniciadoEm)).toBeLessThanOrEqual(Date.now());
  });

  it('com um piloto na sala, o estado mostra a sala, os bots, o apelido e o tráfego; o histórico passa a ter amostras com ele', async () => {
    const ws = await entrar(server.port, 'PAINEL', 'DAN');
    try {
      await until(async () => (lerEstado(await (await chamar(server.port, ADMIN_ESTADO_PATH)).json())?.salas.length ?? 0) === 1);
      const e = lerEstado(await (await chamar(server.port, ADMIN_ESTADO_PATH)).json())!;
      expect(e.jogadores).toBe(1);
      expect(e.conexoes).toBe(1);
      expect(e.salas[0]).toMatchObject({ codigo: 'PAINEL', jogadores: 1, jogando: true });
      expect(e.salas[0]!.nomes).toEqual(['DAN']);
      expect(e.salas[0]!.bots).toBeGreaterThan(0);
      // O amostrador (a cada 60 ms no teste) já viu o piloto, o tráfego e o tick.
      await until(async () => {
        const h = lerHistorico(await (await chamar(server.port, ADMIN_HISTORICO_PATH)).json());
        return !!h && h.amostras.some((a) => a.jogadores === 1 && a.saidaKBs > 0 && a.tickMs > 0);
      });
      // Esperar as amostras, não supor que já há mais de duas: com a máquina ocupada o amostrador atrasa (o atualizador reprovou um deploy por isto em 18/10).
      await until(async () => (lerHistorico(await (await chamar(server.port, ADMIN_HISTORICO_PATH)).json())?.amostras.length ?? 0) > 2);
      const h = lerHistorico(await (await chamar(server.port, ADMIN_HISTORICO_PATH)).json())!;
      expect(h.passoS).toBe(5);
      expect(h.amostras.length).toBeGreaterThan(2);
      expect(h.amostras.every((a) => a.t > 1_700_000_000 && a.rssMB > 0)).toBe(true);
    } finally {
      ws.close();
    }
    await until(async () => (lerEstado(await (await chamar(server.port, ADMIN_ESTADO_PATH)).json())?.jogadores ?? 1) === 0);
  });

  it('o log: sem servidor.log, o que o servidor escreveu; com o arquivo da tarefa, o fim dele', async () => {
    const memoria = lerLog(await (await chamar(server.port, ADMIN_LOG_PATH)).json())!;
    expect(memoria.fonte).toBe('memoria');
    expect(memoria.linhas.join('\n')).toMatch(/sala PAINEL aberta/);
    writeFileSync(join(dados, 'servidor.log'), '[servidor] primeira\r\n[servidor] segunda\r\n');
    const arquivo = lerLog(await (await chamar(server.port, ADMIN_LOG_PATH)).json())!;
    expect(arquivo).toEqual({ fonte: 'arquivo', linhas: ['[servidor] primeira', '[servidor] segunda'] });
  });

  it('a avaliação sai com o contrato, o veredito e a capacidade (logo depois de subir, avisa que é cedo)', async () => {
    const res = await chamar(server.port, ADMIN_AVALIAR_PATH);
    expect(res.status).toBe(200);
    const a = lerAvaliacao(await res.json());
    expect(a).not.toBeNull();
    expect(['apto', 'atencao', 'problema']).toContain(a!.veredito);
    expect(a!.checagens.length).toBeGreaterThan(3);
    expect(a!.capacidade.salasPorTick).toBeGreaterThanOrEqual(1);
    expect(a!.capacidade.jogadoresSimultaneos).toBe(a!.capacidade.salasPorTick * a!.capacidade.jogadoresPorSala);
  });

  it('fechar sala: o piloto cai, a sala some e o resto continua; sala que não existe é 404; nome torto é 400', async () => {
    const ws = await entrar(server.port, 'FECHAR', 'ANA');
    const caiu = new Promise<number>((ok) => ws.on('close', (codigo) => ok(codigo)));
    expect((await chamar(server.port, ADMIN_FECHAR_SALA_PATH, { metodo: 'POST', corpo: { sala: 'fechar' } })).status).toBe(200);
    expect(await caiu).toBe(1001);
    expect(server.rooms.has('FECHAR')).toBe(false);
    const de_novo = await chamar(server.port, ADMIN_FECHAR_SALA_PATH, { metodo: 'POST', corpo: { sala: 'FECHAR' } });
    expect(de_novo.status).toBe(404);
    expect(lerErro(await de_novo.json())!.erro).toMatch(/não está aberta/);
    expect((await chamar(server.port, ADMIN_FECHAR_SALA_PATH, { metodo: 'POST', corpo: { sala: '../etc' } })).status).toBe(400);
    expect((await chamar(server.port, ADMIN_FECHAR_SALA_PATH, { metodo: 'POST', corpo: {} })).status).toBe(400);
    // Quem era da sala pode entrar de novo: ela nasce outra.
    const outra = await entrar(server.port, 'FECHAR', 'ANA');
    expect(server.rooms.has('FECHAR')).toBe(true);
    outra.close();
  });

  it('testar com gente jogando é recusado (409) e diz quantos; sem ninguém, a bateria entra de verdade e passa', async () => {
    const jogador = await entrar(server.port, 'OCUPADA', 'DAN');
    const recusa = await chamar(server.port, ADMIN_TESTAR_PATH, { metodo: 'POST' });
    expect(recusa.status).toBe(409);
    expect(lerErro(await recusa.json())).toMatchObject({ jogadores: 1 });
    jogador.close();
    await until(async () => (lerEstado(await (await chamar(server.port, ADMIN_ESTADO_PATH)).json())?.jogadores ?? 1) === 0);

    const res = await chamar(server.port, ADMIN_TESTAR_PATH, { metodo: 'POST' });
    expect(res.status).toBe(200);
    const t = lerTeste(await res.json())!;
    expect(t.clientes).toBe(4);
    const por = (nome: string) => t.checagens.find((c) => c.nome.startsWith(nome));
    expect(por('Pilotos que entraram')).toMatchObject({ valor: '4 de 4', resultado: 'ok' });
    // Estado a 20 Hz de verdade: o piloto de mentira recebe os snapshots pela mesma porta do navegador.
    expect(por('Estados por segundo')).toBeTruthy();
    expect(por('Download por piloto')).toBeTruthy();
    expect(por('Download por piloto')!.resultado).not.toBe('falha');
    // O ping de ida e volta só entra se algum pong voltou dentro da janela, e o resultado dele (ok, atenção, falha) é do ambiente: com a máquina carregada o servidor responde devagar de verdade. O teste só confere que, se entrou, tem valor em ms.
    const ping = por('Ping');
    if (ping) expect(ping.valor).toMatch(/ms$/);
    expect(por('Tempo do tick da sala de teste')).toBeTruthy();
    expect(t.duracaoS).toBeGreaterThan(1.4);
    // A sala de teste fecha no fim e não suja o status público nem os números de produto.
    expect([...server.rooms.keys()].some((c) => c.startsWith('TESTE-'))).toBe(false);
    const status = await (await fetch(`http://127.0.0.1:${server.port}/status`)).json();
    expect(status.players).toBe(0);
    const resumo = await (await fetch(`http://127.0.0.1:${server.port}/eventos/resumo`)).json();
    expect(JSON.stringify(resumo)).not.toMatch(/TESTE/);
  }, 30_000);

  it('dois testes ao mesmo tempo não: o segundo pedido é recusado enquanto o primeiro roda', async () => {
    const primeiro = chamar(server.port, ADMIN_TESTAR_PATH, { metodo: 'POST' });
    await until(() => [...server.rooms.keys()].some((c) => c.startsWith('TESTE-')));
    const segundo = await chamar(server.port, ADMIN_TESTAR_PATH, { metodo: 'POST' });
    expect(segundo.status).toBe(409);
    expect(lerErro(await segundo.json())!.erro).toMatch(/já há um teste rodando/);
    expect((await primeiro).status).toBe(200);
  }, 30_000);

  it('o reinício: com gente jogando pede confirmação (409); confirmado, responde 202 e o servidor sai pelo gancho; a segunda vez é recusada', async () => {
    const jogador = await entrar(server.port, 'REINICIO', 'ANA');
    const sem = await chamar(server.port, ADMIN_REINICIAR_PATH, { metodo: 'POST', corpo: {} });
    expect(sem.status).toBe(409);
    expect(lerErro(await sem.json())).toMatchObject({ jogadores: 1 });
    expect(aoReiniciar).not.toHaveBeenCalled();
    // Só `true` confirma: "sim", 1 e false não derrubam ninguém.
    for (const confirmar of ['sim', 1, false, null]) {
      expect((await chamar(server.port, ADMIN_REINICIAR_PATH, { metodo: 'POST', corpo: { confirmar } })).status, String(confirmar)).toBe(409);
    }
    expect(aoReiniciar).not.toHaveBeenCalled();
    const com = await chamar(server.port, ADMIN_REINICIAR_PATH, { metodo: 'POST', corpo: { confirmar: true } });
    expect(com.status).toBe(202);
    expect(await com.json()).toMatchObject({ ok: true, religa: 'supervisionado' });
    await until(() => aoReiniciar.mock.calls.length === 1);
    expect(aoReiniciar).toHaveBeenCalledWith('pedido do painel');
    // O estado avisa que está reiniciando, e um segundo pedido não agenda outra saída.
    expect(lerEstado(await (await chamar(server.port, ADMIN_ESTADO_PATH)).json())!.reiniciando).toBe(true);
    const outra = await chamar(server.port, ADMIN_REINICIAR_PATH, { metodo: 'POST', corpo: { confirmar: true } });
    expect(outra.status).toBe(409);
    expect(lerErro(await outra.json())!.erro).toMatch(/já está reiniciando/);
    // E o teste também espera.
    expect((await chamar(server.port, ADMIN_TESTAR_PATH, { metodo: 'POST' })).status).toBe(409);
    jogador.close();
  });

  it('errar o token dez vezes barra o IP (429), até para quem acerta depois', async () => {
    const outro = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', metricasToken: TOKEN, guard: GUARD });
    try {
      for (let i = 0; i < 10; i++) expect((await chamar(outro.port, ADMIN_ESTADO_PATH, { token: `errado-${i}` })).status).toBe(401);
      expect((await chamar(outro.port, ADMIN_ESTADO_PATH, { token: 'errado-11' })).status).toBe(429);
      expect((await chamar(outro.port, ADMIN_ESTADO_PATH)).status).toBe(429);
    } finally {
      await outro.close();
    }
  });

  it('quem acerta o token não gasta a régua: o painel consulta de poucos em poucos segundos', async () => {
    const outro = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', metricasToken: TOKEN, guard: GUARD });
    try {
      for (let i = 0; i < 40; i++) expect((await chamar(outro.port, ADMIN_ESTADO_PATH)).status).toBe(200);
    } finally {
      await outro.close();
    }
  });

  it('P106, uma chave só: a sessão de uma conta admin abre as rotas do painel e as métricas no lugar do token do dono; a conta comum não', async () => {
    const pasta = resolve('.tmp', 'admin-conta-teste');
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const banco = join(pasta, 'contas.db');
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: banco, dirDados: pasta, metricasToken: TOKEN, guard: GUARD, limiteAdmin: { teto: 10_000 } });
    try {
      const criar = async (email: string) => {
        const r = await fetch(`http://127.0.0.1:${s.port}${CONTA_CRIAR_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha: 'senhasegura', aceite: ACEITE_ATUAL }) });
        expect(r.status).toBe(201);
        return (await r.json()).token as string;
      };
      const comum = await criar('comum@x.com');
      const admin = await criar('admin@x.com');
      const db = new DatabaseSync(banco);
      db.prepare('UPDATE contas SET is_admin = 1 WHERE email = ?').run('admin@x.com');
      db.close();

      expect((await chamar(s.port, ADMIN_ESTADO_PATH, { token: comum })).status).toBe(401); // conta comum não entra
      const res = await chamar(s.port, ADMIN_ESTADO_PATH, { token: admin });
      expect(res.status).toBe(200);
      expect(lerEstado(await res.json())).not.toBeNull();
      expect((await chamar(s.port, ADMIN_ESTADO_PATH, { token: TOKEN })).status).toBe(200); // a chave do dono segue valendo
      const metricas = (token: string) => fetch(`http://127.0.0.1:${s.port}/metricas`, { headers: { 'x-cybermech-metricas': token } });
      expect((await metricas(admin)).status).toBe(200);
      expect((await metricas(comum)).status).toBe(401);
      // Sessão encerrada não vale mais (o admin saiu da conta).
      await fetch(`http://127.0.0.1:${s.port}/conta/sair`, { method: 'POST', headers: { 'x-cybermech-sessao': admin } });
      expect((await chamar(s.port, ADMIN_ESTADO_PATH, { token: admin })).status).toBe(401);
    } finally {
      await s.close();
      rmSync(pasta, { recursive: true, force: true });
    }
  }, 120_000);

  it('sem token do dono, só a conta admin abre a porta: sem credencial responde 401; e sem gancho de reinício a rota responde 501', async () => {
    const semToken = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: GUARD });
    try {
      expect((await chamar(semToken.port, ADMIN_ESTADO_PATH, { token: null })).status).toBe(401);
      expect((await chamar(semToken.port, ADMIN_REINICIAR_PATH, { metodo: 'POST', token: 'sessao-que-nao-existe-1234', corpo: {} })).status).toBe(401);
    } finally {
      await semToken.close();
    }
    const semGancho = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', metricasToken: TOKEN, guard: GUARD });
    try {
      const res = await chamar(semGancho.port, ADMIN_REINICIAR_PATH, { metodo: 'POST', corpo: {} });
      expect(res.status).toBe(501);
      expect(lerErro(await res.json())!.erro).toMatch(/não sabe se reiniciar/);
      expect(lerEstado(await (await chamar(semGancho.port, ADMIN_ESTADO_PATH)).json())!.supervisionado).toBe(false);
    } finally {
      await semGancho.close();
    }
  });
});
