import { describe, expect, it } from 'vitest';
import { ACEITE_ATUAL, EMAIL_MAX, normalizarEmail, parseCredenciais, parseCriarConta, parseMedicao, parseSenhaDeConfirmacao, POLITICA_VERSAO, SENHA_MAX, SENHA_MIN, validarEmail, validarSenha } from './auth';

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

describe('criar conta exige o aceite da política (P192, LGPD)', () => {
  const base = { email: 'Dan@X.com', senha: 'senhasegura' };
  it('com as duas caixas e a política de hoje: lê e normaliza o e-mail', () => {
    expect(parseCriarConta({ ...base, aceite: ACEITE_ATUAL })).toEqual({ ok: true, email: 'dan@x.com', senha: 'senhasegura' });
    expect(ACEITE_ATUAL).toEqual({ politica: POLITICA_VERSAO, idade: true });
  });
  it('sem o aceite, com a idade desmarcada ou com lixo: "aceite"', () => {
    for (const aceite of [undefined, null, 'sim', {}, { politica: POLITICA_VERSAO }, { politica: POLITICA_VERSAO, idade: false }, { politica: POLITICA_VERSAO, idade: 'true' }, { idade: true }, { politica: 5, idade: true }])
      expect(parseCriarConta({ ...base, aceite }), JSON.stringify(aceite)).toEqual({ ok: false, motivo: 'aceite' });
  });
  it('política de outra versão: "versao" (o navegador está velho e precisa recarregar)', () => {
    expect(parseCriarConta({ ...base, aceite: { politica: '2020-01-01', idade: true } })).toEqual({ ok: false, motivo: 'versao' });
  });
  it('credencial ruim vence o aceite: "dados" (a mensagem de e-mail ou senha inválidos não muda)', () => {
    expect(parseCriarConta({ email: 'x', senha: 'senhasegura', aceite: ACEITE_ATUAL })).toEqual({ ok: false, motivo: 'dados' });
    expect(parseCriarConta(null)).toEqual({ ok: false, motivo: 'dados' });
  });
});

describe('os corpos dos direitos do titular', () => {
  it('apagar a conta pede a senha no formato de senha', () => {
    expect(parseSenhaDeConfirmacao({ senha: 'senhasegura' })).toBe('senhasegura');
    for (const raw of [null, {}, { senha: 'curta' }, { senha: 5 }, { senha: 'x'.repeat(73) }]) expect(parseSenhaDeConfirmacao(raw)).toBeNull();
  });
  it('a medição é um booleano e nada mais', () => {
    expect(parseMedicao({ ativa: true })).toBe(true);
    expect(parseMedicao({ ativa: false })).toBe(false);
    for (const raw of [null, {}, { ativa: 'sim' }, { ativa: 1 }, 'true']) expect(parseMedicao(raw)).toBeNull();
  });
});
