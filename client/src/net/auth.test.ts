import { describe, expect, it, vi } from 'vitest';
import { ACEITE_ATUAL, CONTA_APAGAR_PATH, CONTA_CRIAR_PATH, CONTA_DADOS_PATH, CONTA_ENTRAR_PATH, CONTA_MEDICAO_PATH, SESSAO_HEADER } from '../../../shared/net/auth';
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
    expect(await c.criar('a@b.com', 'senhasegura')).toEqual({ token: 'abc', email: 'a@b.com', is_admin: false, medir: true, idade: 'sem-idade' });
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
    expect(await c.eu('token-valido')).toEqual({ email: 'a@b.com', is_admin: false, medir: true, idade: 'sem-idade' });
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

describe('ContaCliente: aceite e direitos do titular (P192, LGPD)', () => {
  type Chamada = { url: string; init: RequestInit };
  const espiao = (corpo: unknown, ok = true, status = 200) => {
    const chamadas: Chamada[] = [];
    vi.stubGlobal('fetch', (async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return { ok, status, json: async () => corpo } as unknown as Response;
    }) as unknown as typeof fetch);
    return chamadas;
  };
  const SERVIDOR = 'wss://jogo.exemplo';

  it('criar manda o aceite da política; entrar não manda', async () => {
    const c = new ContaCliente(SERVIDOR);
    const a = espiao({ token: 't', email: 'a@b.com' });
    await c.criar('a@b.com', 'senhasegura');
    expect(a[0]!.url).toBe('https://jogo.exemplo' + CONTA_CRIAR_PATH);
    expect(JSON.parse(a[0]!.init.body as string)).toEqual({ email: 'a@b.com', senha: 'senhasegura', aceite: ACEITE_ATUAL });
    const b = espiao({ token: 't', email: 'a@b.com' });
    await c.entrar('a@b.com', 'senhasegura');
    expect(b[0]!.url).toBe('https://jogo.exemplo' + CONTA_ENTRAR_PATH);
    expect(JSON.parse(b[0]!.init.body as string)).toEqual({ email: 'a@b.com', senha: 'senhasegura' });
    vi.unstubAllGlobals();
  });

  it('dados: manda a sessão, devolve o JSON formatado; 401 diz para entrar de novo; sem token nem rede', async () => {
    const c = new ContaCliente(SERVIDOR);
    const a = espiao({ v: 1, conta: { email: 'a@b.com' } });
    const r = await c.dados('tk');
    expect(a[0]!.url).toBe('https://jogo.exemplo' + CONTA_DADOS_PATH);
    expect((a[0]!.init.headers as Record<string, string>)[SESSAO_HEADER]).toBe('tk');
    expect(r).toEqual({ json: JSON.stringify({ v: 1, conta: { email: 'a@b.com' } }, null, 2) });
    espiao({ erro: 'sem sessão' }, false, 401);
    expect(await c.dados('tk')).toEqual({ erro: 'sessão vencida: entre de novo' });
    const f = espiao({});
    expect(await c.dados('')).toEqual({ erro: 'sem servidor' });
    expect(await new ContaCliente(undefined).dados('tk')).toEqual({ erro: 'sem servidor' });
    expect(f).toHaveLength(0);
    vi.stubGlobal('fetch', (async () => { throw new Error('x'); }) as unknown as typeof fetch);
    expect(await c.dados('tk')).toEqual({ erro: 'servidor fora do ar' });
    vi.unstubAllGlobals();
  });

  it('apagar: manda a senha e a sessão; null = apagada; a mensagem do servidor volta como está; nunca lança', async () => {
    const c = new ContaCliente(SERVIDOR);
    const a = espiao({ apagada: true });
    expect(await c.apagar('tk', 'senhasegura')).toBeNull();
    expect(a[0]!.url).toBe('https://jogo.exemplo' + CONTA_APAGAR_PATH);
    expect(a[0]!.init.method).toBe('POST');
    expect(JSON.parse(a[0]!.init.body as string)).toEqual({ senha: 'senhasegura' });
    expect((a[0]!.init.headers as Record<string, string>)[SESSAO_HEADER]).toBe('tk');
    espiao({ erro: 'senha incorreta' }, false, 401);
    expect(await c.apagar('tk', 'errada-errada')).toBe('senha incorreta');
    espiao(null, false, 500);
    expect(await c.apagar('tk', 'x'.repeat(8))).toBe('não deu para apagar a conta');
    vi.stubGlobal('fetch', (async () => { throw new Error('x'); }) as unknown as typeof fetch);
    expect(await c.apagar('tk', 'senhasegura')).toBe('servidor fora do ar');
    expect(await c.apagar('', 'senhasegura')).toBe('sem servidor');
    vi.unstubAllGlobals();
  });

  it('medição: devolve a escolha que o servidor guardou, ou null quando não deu', async () => {
    const c = new ContaCliente(SERVIDOR);
    const a = espiao({ ativa: false });
    expect(await c.medicao('tk', false)).toBe(false);
    expect(a[0]!.url).toBe('https://jogo.exemplo' + CONTA_MEDICAO_PATH);
    expect(JSON.parse(a[0]!.init.body as string)).toEqual({ ativa: false });
    espiao({ erro: 'x' }, false, 400);
    expect(await c.medicao('tk', true)).toBeNull();
    espiao({ ativa: 'talvez' });
    expect(await c.medicao('tk', true)).toBeNull();
    expect(await c.medicao('', true)).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('ContaCliente: a idade (P211)', () => {
  const corpoDa = (chamada: unknown) => JSON.parse(((chamada as [string, RequestInit])[1].body as string) ?? '{}') as Record<string, unknown>;

  it('criar manda o nascimento junto do aceite; sem nascimento, o corpo não leva o campo', async () => {
    const c = new ContaCliente('wss://jogo.selvamkt.com.br');
    const f = vi.fn(respostaJson({ token: 'abc', email: 'a@b.com', idade: 'adulto' }));
    vi.stubGlobal('fetch', f);
    const r = await c.criar('a@b.com', 'senhasegura', '1990-01');
    expect(r).toMatchObject({ idade: 'adulto' });
    expect(corpoDa(vi.mocked(f).mock.calls[0])).toMatchObject({ email: 'a@b.com', nascimento: '1990-01' });
    await c.criar('a@b.com', 'senhasegura');
    expect('nascimento' in corpoDa(vi.mocked(f).mock.calls[1])).toBe(false);
    vi.unstubAllGlobals();
  });

  it('a faixa que o servidor manda vale só se for adulto ou menor; qualquer outra coisa é sem-idade (nunca abre a voz por engano)', async () => {
    const c = new ContaCliente('wss://jogo.selvamkt.com.br');
    for (const [mandou, vale] of [['adulto', 'adulto'], ['menor', 'menor'], ['sem-idade', 'sem-idade'], ['admin', 'sem-idade'], [true, 'sem-idade'], [undefined, 'sem-idade']] as const) {
      vi.stubGlobal('fetch', respostaJson({ email: 'a@b.com', idade: mandou }));
      expect((await c.eu('t'))!.idade, String(mandou)).toBe(vale);
    }
    vi.unstubAllGlobals();
  });

  it('nascimento(): manda o AAAA-MM com a sessão e devolve a faixa; recusa vira a mensagem do servidor; sem rede nunca lança', async () => {
    const c = new ContaCliente('wss://jogo.selvamkt.com.br');
    const f = vi.fn(respostaJson({ idade: 'menor' }));
    vi.stubGlobal('fetch', f);
    expect(await c.nascimento('tk', '2015-01')).toEqual({ idade: 'menor' });
    const [url, init] = vi.mocked(f).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/conta/nascimento');
    expect((init.headers as Record<string, string>)[SESSAO_HEADER]).toBe('tk');
    expect(JSON.parse(init.body as string)).toEqual({ nascimento: '2015-01' });
    vi.stubGlobal('fetch', respostaJson({ erro: 'o nascimento já foi informado e não muda' }, false, 409));
    expect(await c.nascimento('tk', '1990-01')).toEqual({ erro: 'o nascimento já foi informado e não muda' });
    vi.stubGlobal('fetch', (async () => { throw new Error('x'); }) as unknown as typeof fetch);
    expect(await c.nascimento('tk', '1990-01')).toEqual({ erro: 'servidor fora do ar' });
    expect(await new ContaCliente(undefined).nascimento('tk', '1990-01')).toEqual({ erro: 'sem servidor' });
    vi.unstubAllGlobals();
  });
});
