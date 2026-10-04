import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION } from '../shared/net/constants';
import { decodeReject, encodeJoin, messageType, MSG } from '../shared/net/messages';
import { EVENTO_PATH, METRICAS_HEADER, METRICAS_PATH, parseMetricas, RESUMO_PATH } from '../shared/net/telemetry';
import { carregarToken, DADOS_ARQUIVO, gravarJson, lerJson, TOKEN_ARQUIVO, tokenConfere } from './metricas';
import { startServer, type GameServer } from './Server';

const TOKEN = 'token-de-teste-com-mais-de-16';
const w = new Writer();
const join_ = (build: string, protocol = PROTOCOL_VERSION) => new Uint8Array(encodeJoin(w, { protocol, name: 'Dan', build }));
const MECH_BUILD = 'v1.vector09.plasma-0.rockets-0';
const WIDE = { perIp: 100, total: 200, msgs: 200, burst: 200 };

/** Pasta de teste dentro do projeto (G15: nada fora de `.tmp/`). */
const pasta = (nome: string) => {
  const p = resolve('.tmp', `teste-metricas-${nome}-${process.pid}`);
  rmSync(p, { recursive: true, force: true });
  mkdirSync(p, { recursive: true });
  return p;
};

async function metricas(port: number, token: string | null = TOKEN) {
  return fetch(`http://127.0.0.1:${port}${METRICAS_PATH}`, { headers: token ? { [METRICAS_HEADER]: token } : {} });
}
async function postEvento(port: number, nome: string, pais?: string) {
  return fetch(`http://127.0.0.1:${port}${EVENTO_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(pais ? { 'cf-ipcountry': pais } : {}) },
    body: JSON.stringify({ nome, aba: 'abcd1234' }),
  });
}

describe('token das métricas e gravação dos números', () => {
  const dir = pasta('token');
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('o token da variável de ambiente manda; curto demais não vale', () => {
    expect(carregarToken(dir, 'abcdefghijklmnopqrst')).toBe('abcdefghijklmnopqrst');
    expect(existsSync(join(dir, TOKEN_ARQUIVO))).toBe(false); // veio do ambiente: nada é gravado
  });

  it('sem ambiente, gera um token forte na primeira vez, grava no arquivo e reusa nas seguintes', () => {
    const a = carregarToken(dir, '');
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(readFileSync(join(dir, TOKEN_ARQUIVO), 'utf8').trim()).toBe(a);
    expect(carregarToken(dir, 'curto')).toBe(a);
  });

  it('compara em tempo constante e recusa o que não é texto, vazio ou de outro tamanho', () => {
    expect(tokenConfere(TOKEN, TOKEN)).toBe(true);
    expect(tokenConfere(`${TOKEN}x`, TOKEN)).toBe(false);
    expect(tokenConfere(TOKEN.slice(1), TOKEN)).toBe(false);
    expect(tokenConfere('', TOKEN)).toBe(false);
    expect(tokenConfere(undefined, TOKEN)).toBe(false);
    expect(tokenConfere([TOKEN], TOKEN)).toBe(false);
  });

  it('gravar troca o arquivo de uma vez (sem sobra) e ler arquivo quebrado ou ausente devolve null', () => {
    const arq = join(dir, 'x.json');
    gravarJson(arq, { a: 1 });
    expect(lerJson(arq)).toEqual({ a: 1 });
    expect(existsSync(`${arq}.tmp`)).toBe(false);
    writeFileSync(arq, '{ quebrado', 'utf8');
    expect(lerJson(arq)).toBeNull();
    expect(lerJson(join(dir, 'nao-existe.json'))).toBeNull();
  });
});

describe('GET /metricas: a porta privada do dono', () => {
  let server: GameServer;
  beforeAll(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: WIDE, metricasToken: TOKEN });
  });
  afterAll(async () => {
    await server.close();
  });

  it('sem token ou com o token errado: 401, e nenhum número vaza', async () => {
    const sem = await metricas(server.port, null);
    expect(sem.status).toBe(401);
    expect(await sem.text()).toBe('');
    expect((await metricas(server.port, 'errado-errado-errado')).status).toBe(401);
  });

  it('com o token: o detalhe por dia e por país, no formato do contrato', async () => {
    await postEvento(server.port, 'boot_ok', 'BR');
    await postEvento(server.port, 'boot_ok', 'BR');
    await postEvento(server.port, 'hangar_aberto', 'US');
    const r = await metricas(server.port);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const m = parseMetricas(await r.json());
    expect(m).not.toBeNull();
    const hoje = m!.dias.at(-1)!;
    expect(hoje.eventos.boot_ok).toMatchObject({ BR: 2 });
    expect(hoje.eventos.hangar_aberto).toMatchObject({ US: 1 });
    expect(m!.fuso).toBe('UTC-03:00');
  });

  it('o resumo público continua sem país nenhum, e o preflight do navegador é respondido', async () => {
    const texto = await (await fetch(`http://127.0.0.1:${server.port}${RESUMO_PATH}`)).text();
    expect(texto).not.toContain('BR');
    expect(texto).not.toContain('dias');
    const pre = await fetch(`http://127.0.0.1:${server.port}${METRICAS_PATH}`, { method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-headers')).toBe(METRICAS_HEADER);
  });

  it('o país só vale vindo do túnel: um cabeçalho inventado por outra máquina é ignorado (coberto no clientCountry); lixo no cabeçalho vira ??', async () => {
    await postEvento(server.port, 'click_cockpit', '<script>');
    await postEvento(server.port, 'click_cockpit', 'xx');
    const m = parseMetricas(await (await metricas(server.port)).json())!;
    expect(m.dias.at(-1)!.eventos.click_cockpit).toEqual({ '??': 2 });
  });

  it('tentativas demais com token errado são cortadas (429): ninguém força o token na porta', async () => {
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: WIDE, metricasToken: TOKEN });
    try {
      let ultimo = 0;
      for (let i = 0; i < 40; i++) ultimo = (await metricas(s.port, `errado-${i}-errado-errado`)).status;
      expect(ultimo).toBe(429);
      expect((await metricas(s.port)).status).toBe(429); // até o token certo espera a janela passar
    } finally {
      await s.close();
    }
  });
});

describe('GET /metricas desligada: sem token configurado e sem pasta de dados', () => {
  it('404, como se a rota não existisse', async () => {
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: WIDE });
    try {
      expect((await metricas(s.port)).status).toBe(404);
    } finally {
      await s.close();
    }
  });
});

describe('origem das conexões online: o servidor conta quem chegou, de onde, e quem foi recusado', () => {
  let server: GameServer;
  beforeAll(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: WIDE, metricasToken: TOKEN });
  });
  afterAll(async () => {
    await server.close();
  });

  /** Conecta como se viesse da Cloudflare (cabeçalho do país), manda o JOIN e devolve o que o servidor respondeu primeiro. */
  async function entrar(pais: string, sala: string, protocolo = PROTOCOL_VERSION): Promise<'welcome' | string> {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/?sala=${sala}`, { headers: { 'cf-ipcountry': pais } });
    ws.binaryType = 'arraybuffer';
    const resposta = new Promise<'welcome' | string>((ok, erro) => {
      ws.onmessage = (e) => {
        const bytes = new Uint8Array(e.data as ArrayBuffer);
        if (messageType(bytes) === MSG.WELCOME) ok('welcome');
        else if (messageType(bytes) === MSG.REJECT) ok(decodeReject(bytes) ?? '?');
      };
      ws.onerror = () => erro(new Error('sem conexão'));
    });
    await new Promise<void>((ok, erro) => {
      ws.onopen = () => ok();
      ws.onerror = () => erro(new Error('sem conexão'));
    });
    ws.send(join_(MECH_BUILD, protocolo));
    const r = await resposta;
    ws.close();
    return r;
  }

  it('conexão aceita, entrada na sala, recusa por versão e o pico de jogadores, cada um com o país', async () => {
    expect(await entrar('BR', 'ORIGEM1')).toBe('welcome');
    expect(await entrar('BR', 'ORIGEM2')).toBe('welcome');
    expect(await entrar('US', 'ORIGEM3', PROTOCOL_VERSION + 1)).toBe('versao');
    const m = parseMetricas(await (await metricas(server.port)).json())!;
    const hoje = m.dias.at(-1)!;
    expect(hoje.eventos.conexao_online).toEqual({ BR: 2, US: 1 });
    expect(hoje.eventos.entrou_na_sala).toEqual({ BR: 2 });
    expect(hoje.eventos.recusa_versao).toEqual({ US: 1 });
    expect(hoje.pico).toBeGreaterThanOrEqual(1);
    expect(m.total.recusa_versao).toBe(1);
  });
});

describe('os números sobrevivem ao reinício do servidor', () => {
  const dir = pasta('reinicio');
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('grava ao fechar e volta igual; o token fica no arquivo e continua o mesmo', async () => {
    const a = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: WIDE, dirDados: dir, salvarCadaMs: 20 });
    await postEvento(a.port, 'boot_ok', 'BR');
    await postEvento(a.port, 'partida_iniciada', 'BR');
    const token = readFileSync(join(dir, TOKEN_ARQUIVO), 'utf8').trim();
    expect(token.length).toBeGreaterThanOrEqual(40);
    await a.close();
    expect(existsSync(join(dir, DADOS_ARQUIVO))).toBe(true);
    expect(readFileSync(join(dir, DADOS_ARQUIVO), 'utf8')).not.toContain('127.0.0.1'); // o arquivo não tem IP

    const b = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: WIDE, dirDados: dir });
    try {
      const resumo = await (await fetch(`http://127.0.0.1:${b.port}${RESUMO_PATH}`)).json();
      expect(resumo.total.boot_ok).toBe(1);
      expect(resumo.total.partida_iniciada).toBe(1);
      expect(resumo.janela24h.boot_ok).toBe(1);
      const m = parseMetricas(await (await metricas(b.port, token)).json())!;
      expect(m.dias.at(-1)!.eventos.boot_ok).toEqual({ BR: 1 });
    } finally {
      await b.close();
    }
  });

  it('arquivo de números quebrado não impede o servidor de subir', async () => {
    writeFileSync(join(dir, DADOS_ARQUIVO), '{ isso não é json', 'utf8');
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: WIDE, dirDados: dir });
    try {
      const resumo = await (await fetch(`http://127.0.0.1:${s.port}${RESUMO_PATH}`)).json();
      expect(resumo.total.boot_ok).toBe(0);
    } finally {
      await s.close();
    }
  });
});
