import { describe, expect, it, vi } from 'vitest';
import { ContaCliente } from './auth';

const respostaJson = (body: unknown, ok = true, status = ok ? 200 : 400): typeof fetch =>
  (async () => ({ ok, status, json: async () => body }) as unknown as Response) as unknown as typeof fetch;

describe('ContaCliente', () => {
  it('sem servidor, toda chamada devolve erro sem tentar rede', async () => {
    const c = new ContaCliente(undefined);
    expect(await c.criar('a@b.com', 'senhasegura')).toEqual({ erro: 'sem servidor' });
    expect(await c.entrar('a@b.com', 'senhasegura')).toEqual({ erro: 'sem servidor' });
    expect(await c.eu('token')).toBeNull();
    await expect(c.sair('token')).resolves.toBeUndefined();
  });

  it('criar conta com sucesso devolve token e e-mail', async () => {
    const c = new ContaCliente('wss://jogo.selvamkt.com.br');
    vi.stubGlobal('fetch', respostaJson({ token: 'abc', email: 'a@b.com', is_admin: false }));
    expect(await c.criar('a@b.com', 'senhasegura')).toEqual({ token: 'abc', email: 'a@b.com', is_admin: false });
    vi.unstubAllGlobals();
  });

  it('erro do servidor (409, 401...) repassa a mensagem dele', async () => {
    const c = new ContaCliente('wss://jogo.selvamkt.com.br');
    vi.stubGlobal('fetch', respostaJson({ erro: 'este e-mail já tem conta' }, false));
    expect(await c.criar('a@b.com', 'senhasegura')).toEqual({ erro: 'este e-mail já tem conta' });
    vi.unstubAllGlobals();
  });

  it('servidor fora do ar (fetch lança) vira mensagem amigável, nunca lança para quem chamou', async () => {
    const c = new ContaCliente('wss://jogo.selvamkt.com.br');
    vi.stubGlobal('fetch', (async () => { throw new Error('failed to fetch'); }) as unknown as typeof fetch);
    expect(await c.entrar('a@b.com', 'senhasegura')).toEqual({ erro: 'servidor fora do ar' });
    vi.unstubAllGlobals();
  });

  it('eu(): token válido devolve o e-mail, inválido devolve null', async () => {
    const c = new ContaCliente('wss://jogo.selvamkt.com.br');
    vi.stubGlobal('fetch', respostaJson({ email: 'a@b.com', is_admin: false }));
    expect(await c.eu('token-valido')).toEqual({ email: 'a@b.com', is_admin: false });
    vi.stubGlobal('fetch', respostaJson({ erro: 'sem sessão' }, false, 401));
    expect(await c.eu('token-invalido')).toBeNull();
    vi.unstubAllGlobals();
  });
});

const progresso = { apelido: 'ANA', nivel: 4, xp: 120, creditos: 700, montagem: '{}', atualizadoEm: 1700000000000 };

describe('ContaCliente: progresso do piloto (P174)', () => {
  it('sem servidor ou sem token, nada de rede: leitura devolve null e gravação devolve false', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const sem = new ContaCliente(undefined);
    expect(await sem.lerProgresso('t')).toBeNull();
    expect(await sem.gravarProgresso('t', progresso)).toBe(false);
    const com = new ContaCliente('wss://jogo.exemplo');
    expect(await com.lerProgresso('')).toBeNull();
    expect(await com.gravarProgresso('', progresso)).toBe(false);
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('lerProgresso manda a sessão no cabeçalho, devolve o progresso validado ou "nada guardado"', async () => {
    const chamadas: Array<[string, RequestInit | undefined]> = [];
    vi.stubGlobal('fetch', (async (url: string, init?: RequestInit) => {
      chamadas.push([url, init]);
      return { ok: true, status: 200, json: async () => ({ progresso }) } as unknown as Response;
    }) as unknown as typeof fetch);
    const c = new ContaCliente('wss://jogo.exemplo');
    expect(await c.lerProgresso('tk')).toEqual({ progresso });
    expect(chamadas[0]![0]).toBe('https://jogo.exemplo/conta/progresso');
    expect((chamadas[0]![1]!.headers as Record<string, string>)['x-cybermech-sessao']).toBe('tk');
    vi.stubGlobal('fetch', respostaJson({ progresso: null }));
    expect(await c.lerProgresso('tk')).toEqual({ progresso: null });
    vi.unstubAllGlobals();
  });

  it('um servidor que devolve lixo não injeta nada: resposta fora do contrato vira "não deu para saber" (null)', async () => {
    const c = new ContaCliente('wss://jogo.exemplo');
    for (const lixo of [{ progresso: { nivel: 99999 } }, { progresso: 'x' }, {}, null]) {
      vi.stubGlobal('fetch', respostaJson(lixo));
      expect(await c.lerProgresso('tk'), JSON.stringify(lixo)).toBeNull();
    }
    vi.unstubAllGlobals();
  });

  it('sessão recusada (401) ou rede fora: leitura null, gravação false, nunca lança', async () => {
    const c = new ContaCliente('wss://jogo.exemplo');
    vi.stubGlobal('fetch', respostaJson({ erro: 'sem sessão' }, false, 401));
    expect(await c.lerProgresso('tk')).toBeNull();
    expect(await c.gravarProgresso('tk', progresso)).toBe(false);
    vi.stubGlobal('fetch', (async () => { throw new Error('offline'); }) as unknown as typeof fetch);
    expect(await c.lerProgresso('tk')).toBeNull();
    expect(await c.gravarProgresso('tk', progresso)).toBe(false);
    vi.unstubAllGlobals();
  });

  it('gravarProgresso faz PUT com o JSON e a sessão e devolve true quando o servidor aceita', async () => {
    let visto: { url: string; init: RequestInit } | null = null;
    vi.stubGlobal('fetch', (async (url: string, init: RequestInit) => {
      visto = { url, init };
      return { ok: true, status: 200, json: async () => ({ progresso }) } as unknown as Response;
    }) as unknown as typeof fetch);
    const c = new ContaCliente('wss://jogo.exemplo');
    expect(await c.gravarProgresso('tk', progresso)).toBe(true);
    expect(visto!.url).toBe('https://jogo.exemplo/conta/progresso');
    expect(visto!.init.method).toBe('PUT');
    expect(JSON.parse(visto!.init.body as string)).toEqual(progresso);
    expect((visto!.init.headers as Record<string, string>)['x-cybermech-sessao']).toBe('tk');
    vi.unstubAllGlobals();
  });
});
