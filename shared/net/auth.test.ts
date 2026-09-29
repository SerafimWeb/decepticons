import { describe, expect, it } from 'vitest';
import { EMAIL_MAX, normalizarEmail, parseCredenciais, SENHA_MAX, SENHA_MIN, validarEmail, validarSenha } from './auth';

describe('validação de e-mail', () => {
  it('aceita e-mail plausível', () => {
    expect(validarEmail('dan@serafimweb.com.br')).toBeNull();
  });

  it('normaliza para minúsculas e sem espaço nas pontas', () => {
    expect(normalizarEmail('  Dan@SerafimWeb.com.br  ')).toBe('dan@serafimweb.com.br');
  });

  it('recusa o que não parece e-mail', () => {
    expect(validarEmail('nao é email')).not.toBeNull();
    expect(validarEmail('sem-arroba.com')).not.toBeNull();
    expect(validarEmail('@sem-usuario.com')).not.toBeNull();
    expect(validarEmail('sem-dominio@')).not.toBeNull();
    expect(validarEmail('')).not.toBeNull();
    expect(validarEmail(42)).not.toBeNull();
    expect(validarEmail(null)).not.toBeNull();
  });

  it('recusa e-mail longo demais', () => {
    const longo = 'a'.repeat(EMAIL_MAX) + '@x.com';
    expect(validarEmail(longo)).not.toBeNull();
  });
});

describe('validação de senha', () => {
  it('aceita entre 8 e 72 caracteres', () => {
    expect(validarSenha('a'.repeat(SENHA_MIN))).toBeNull();
    expect(validarSenha('a'.repeat(SENHA_MAX))).toBeNull();
  });

  it('recusa curta ou longa demais, e tipo errado', () => {
    expect(validarSenha('a'.repeat(SENHA_MIN - 1))).not.toBeNull();
    expect(validarSenha('a'.repeat(SENHA_MAX + 1))).not.toBeNull();
    expect(validarSenha(12345678)).not.toBeNull();
    expect(validarSenha(undefined)).not.toBeNull();
  });
});

describe('parseCredenciais: a mesma mensagem para os dois campos', () => {
  it('aceita e normaliza o e-mail', () => {
    expect(parseCredenciais({ email: ' Dan@X.com ', senha: 'senhasegura' })).toEqual({ email: 'dan@x.com', senha: 'senhasegura' });
  });

  it('recusa lixo estrutural sem lançar', () => {
    expect(parseCredenciais(null)).toBeNull();
    expect(parseCredenciais('texto')).toBeNull();
    expect(parseCredenciais({})).toBeNull();
    expect(parseCredenciais({ email: 'dan@x.com' })).toBeNull();
    expect(parseCredenciais({ email: 'dan@x.com', senha: 'curta' })).toBeNull();
    expect(parseCredenciais({ email: 'invalido', senha: 'senhasegura' })).toBeNull();
  });
});
