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
