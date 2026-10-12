import { describe, expect, it, vi } from 'vitest';
import { ADMIN_HEADER, type AdminEstado } from '../../../shared/net/admin';
import { ADMIN_TOKEN_KEY, AdminCliente, chaveDoToken, TokenDoDono } from './admin';

const SERVIDOR = 'wss://jogo.selvamkt.com.br';
const estado = (): AdminEstado => ({
  protocolo: 16, release: 'abc', iniciadoEm: '2026-10-12T14:00:00.000Z', uptimeS: 10, node: 'v22', plataforma: 'win32 x64', porta: 2567, supervisionado: true,
  memoria: { rssMB: 100, heapMB: 50 }, cpuPct: 1, lacoMs: { medio: 0, p99: 1, maximo: 2 }, conexoes: 0, jogadores: 0, salas: [],
  recusas: { total: 0, ip: 0, taxa: 0 }, redeKBs: { saida: 0, entrada: 0 }, contas: 3, reiniciando: false,
});
const resposta = (corpo: unknown, status = 200, texto = false) =>
  vi.fn(async () => new Response(texto ? String(corpo) : JSON.stringify(corpo), { status, headers: { 'content-type': texto ? 'text/plain' : 'application/json' } })) as unknown as typeof fetch;
const cliente = (buscar: typeof fetch, token: string | null = 'T0KEN') => new AdminCliente(SERVIDOR, () => token, buscar);

describe('o cliente do painel do servidor', () => {
  it('sem endereço de servidor (build offline) e sem token, nem tenta a rede', async () => {
    const buscar = resposta(estado());
    expect(await new AdminCliente(undefined, () => 'x', buscar).estado()).toEqual({ ok: false, motivo: 'sem-servidor' });
    expect(await cliente(buscar, null).estado()).toEqual({ ok: false, motivo: 'sem-token' });
    expect(buscar).not.toHaveBeenCalled();
    expect(new AdminCliente(undefined, () => 'x').temServidor).toBe(false);
    expect(cliente(buscar).temServidor).toBe(true);
  });

  it('manda o token no cabeçalho certo, no endereço certo (wss vira https), e lê o contrato', async () => {
    const buscar = resposta(estado());
    const r = await cliente(buscar).estado();
    expect(r).toEqual({ ok: true, dados: estado() });
    const [url, init] = (buscar as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe('https://jogo.selvamkt.com.br/admin/estado');
    expect((init.headers as Record<string, string>)[ADMIN_HEADER]).toBe('T0KEN');
    expect(init.method).toBe('GET');
    expect(init.cache).toBe('no-store');
  });

  it('cada falha tem o seu motivo: token recusado, bloqueado, sem token no servidor, fora do ar, resposta que não é do painel', async () => {
    expect(await cliente(resposta({}, 401)).estado()).toMatchObject({ ok: false, motivo: 'token' });
    expect(await cliente(resposta({}, 429)).estado()).toMatchObject({ ok: false, motivo: 'bloqueado' });
    expect(await cliente(resposta({}, 404)).estado()).toMatchObject({ ok: false, motivo: 'sem-token' });
    expect(await cliente(vi.fn(async () => { throw new Error('rede'); }) as unknown as typeof fetch).estado()).toMatchObject({ ok: false, motivo: 'fora-do-ar' });
    // Um servidor de versão antiga responde o texto da raiz para /admin/estado: não é o painel.
    expect(await cliente(resposta('CYBERMECH · servidor de jogo · 0 sala(s)\n', 200, true)).estado()).toMatchObject({ ok: false, motivo: 'resposta' });
    // E um JSON fora do contrato também.
    expect(await cliente(resposta({ uptimeS: 'muito' })).estado()).toMatchObject({ ok: false, motivo: 'resposta' });
  });

  it('recusa do servidor (409, 501) traz a frase e, se for o caso, quantos jogam', async () => {
    const r = await cliente(resposta({ erro: 'há 2 jogadores jogando: confirme para derrubá-los', jogadores: 2 }, 409)).reiniciar(false);
    expect(r).toEqual({ ok: false, motivo: 'recusado', erro: { erro: 'há 2 jogadores jogando: confirme para derrubá-los', jogadores: 2 } });
    const sem = await cliente(resposta({ erro: 'este servidor não sabe se reiniciar' }, 501)).reiniciar(true);
    expect(sem).toMatchObject({ ok: false, motivo: 'recusado', erro: { erro: expect.stringContaining('não sabe') } });
  });

  it('as ações vão por POST com o corpo certo', async () => {
    const buscar = resposta({ ok: true, emS: 2, religa: 'supervisionado' }, 202);
    expect(await cliente(buscar).reiniciar(true)).toEqual({ ok: true, dados: { ok: true, emS: 2, religa: 'supervisionado' } });
    const [url, init] = (buscar as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe('https://jogo.selvamkt.com.br/admin/reiniciar');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ confirmar: true });
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    // O "confirmar" é o que a tela decidiu: sem confirmação o servidor recusa com gente jogando, então o cliente não pode mandar true por conta.
    const semConfirmar = resposta({ ok: true, emS: 2, religa: 'sozinho' }, 202);
    await cliente(semConfirmar).reiniciar(false);
    expect(JSON.parse(((semConfirmar as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![1]).body as string)).toEqual({ confirmar: false });
    const fecha = resposta({ ok: true });
    expect(await cliente(fecha).fecharSala('ARENA')).toEqual({ ok: true, dados: true });
    expect(JSON.parse(((fecha as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![1]).body as string)).toEqual({ sala: 'ARENA' });
    const teste = resposta({ ok: true, duracaoS: 8, clientes: 4, checagens: [] });
    expect(await cliente(teste).testar()).toMatchObject({ ok: true, dados: { ok: true, clientes: 4 } });
    expect(((teste as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![1]).method).toBe('POST');
  });

  it('um reinício de resposta torta não vale (a tela não diz "reiniciando" sem o servidor ter dito)', async () => {
    expect(await cliente(resposta({ ok: true }, 202)).reiniciar(true)).toMatchObject({ ok: false, motivo: 'resposta' });
    expect(await cliente(resposta({ ok: true, emS: 2, religa: 'talvez' }, 202)).reiniciar(true)).toMatchObject({ ok: false, motivo: 'resposta' });
  });

  it('o status público não leva token e diz que voltou pelo uptime', async () => {
    const buscar = resposta({ protocol: 16, players: 0, rooms: 0, roomSize: 8, uptimeS: 7 });
    const s = await cliente(buscar, null).statusPublico();
    expect(s).toMatchObject({ uptimeS: 7, players: 0 });
    const init = (buscar as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![1];
    expect((init.headers as Record<string, string> | undefined)?.[ADMIN_HEADER]).toBeUndefined();
    expect(await cliente(resposta({}, 502)).statusPublico()).toBeNull();
    expect(await cliente(vi.fn(async () => { throw new Error('x'); }) as unknown as typeof fetch).statusPublico()).toBeNull();
    expect(await new AdminCliente(undefined, () => null).statusPublico()).toBeNull();
  });
});

describe('o token do dono, guardado só neste aparelho', () => {
  const armazem = () => {
    const d = new Map<string, string>();
    return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v), removeItem: (k: string) => void d.delete(k), d };
  };

  it('grava, lê e apaga', () => {
    const a = armazem();
    const t = new TokenDoDono(a, SERVIDOR);
    expect(t.ler()).toBeNull();
    t.gravar('segredo-comprido-do-dono');
    expect(a.d.get(chaveDoToken(SERVIDOR))).toBe('segredo-comprido-do-dono');
    expect(new TokenDoDono(a, SERVIDOR).ler()).toBe('segredo-comprido-do-dono');
    t.apagar();
    expect(a.d.has(chaveDoToken(SERVIDOR))).toBe(false);
    expect(t.ler()).toBeNull();
  });

  it('o token é de UM servidor: um link com ?servidor= de outro lugar não recebe o guardado dos demais', () => {
    const a = armazem();
    new TokenDoDono(a, SERVIDOR).gravar('segredo-comprido-do-dono');
    expect(new TokenDoDono(a, 'wss://outro-lugar.exemplo').ler()).toBeNull();
    expect(new TokenDoDono(a, 'ws://localhost:2567').ler()).toBeNull();
    expect(new TokenDoDono(a, undefined).ler()).toBeNull();
    // O mesmo servidor por ws ou por http, com ou sem barra no fim, é o mesmo servidor.
    expect(new TokenDoDono(a, 'https://jogo.selvamkt.com.br/').ler()).toBe('segredo-comprido-do-dono');
    expect(chaveDoToken('wss://jogo.selvamkt.com.br')).toBe(`${ADMIN_TOKEN_KEY}|https://jogo.selvamkt.com.br`);
    // Um servidor não tem a chave do outro nem por prefixo.
    expect(chaveDoToken('wss://jogo.selvamkt.com.br')).not.toBe(chaveDoToken('wss://jogo.selvamkt.com.br.evil.com'));
  });

  it('sem armazenamento (aba anônima) vale na memória até recarregar, e nada lança', () => {
    const t = new TokenDoDono(null, SERVIDOR);
    t.gravar('abc');
    expect(t.ler()).toBe('abc');
    const quebrado = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    const q = new TokenDoDono(quebrado, SERVIDOR);
    q.gravar('xyz');
    expect(q.ler()).toBe('xyz');
    expect(() => q.apagar()).not.toThrow();
    expect(q.ler()).toBeNull();
  });
});
