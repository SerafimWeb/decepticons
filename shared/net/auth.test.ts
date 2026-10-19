import { describe, expect, it } from 'vitest';
import { ACEITE_ATUAL, ehMaiorDeIdade, EMAIL_MAX, idadeDaConta, NASCIMENTO_ANOS_MAX, normalizarEmail, parseNascimento, validarNascimento, parseCredenciais, parseCriarConta, parseMedicao, parseSenhaDeConfirmacao, POLITICA_VERSAO, SENHA_MAX, SENHA_MIN, validarEmail, validarSenha } from './auth';

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

/** Quarta, 15 de outubro de 2026 (mês 10): a régua de todas as contas de idade abaixo. */
const AGORA = new Date(Date.UTC(2026, 9, 15, 12));

describe('o nascimento (P211): só o mês e o ano', () => {
  it('aceita AAAA-MM de quem já nasceu e não é velho demais; devolve o mesmo texto', () => {
    for (const ok of ['1990-01', '2026-10', '2010-12', '1906-10']) expect(validarNascimento(ok, AGORA), ok).toBe(ok);
  });

  it('recusa forma errada, mês fora de 1 a 12, o futuro, mais de ' + NASCIMENTO_ANOS_MAX + ' anos e tipo errado', () => {
    for (const ruim of ['', '1990', '1990-1', '90-01', '1990-13', '1990-00', '1990-01-15', ' 1990-01', '2026-11', '2027-01', '1906-09', '1800-01', 'abcd-ef'])
      expect(validarNascimento(ruim, AGORA), ruim).toBeNull();
    for (const tipo of [null, undefined, 1990, {}, [], true]) expect(validarNascimento(tipo, AGORA)).toBeNull();
  });

  it('a fronteira dos ' + NASCIMENTO_ANOS_MAX + ' anos: exatos passa, um mês a mais não', () => {
    expect(validarNascimento('1906-10', AGORA)).toBe('1906-10');
    expect(validarNascimento('1906-09', AGORA)).toBeNull();
  });

  it('parseNascimento lê o corpo { nascimento } e nada mais', () => {
    expect(parseNascimento({ nascimento: '1990-01' }, AGORA)).toBe('1990-01');
    for (const ruim of [null, 'x', 5, {}, { nascimento: 1990 }, { nascimento: '1990-13' }, { idade: 30 }]) expect(parseNascimento(ruim, AGORA)).toBeNull();
  });
});

describe('maior de idade (P211): o mês é a única precisão, e na dúvida não abre a voz', () => {
  it('mais de 18 anos completos: adulto', () => {
    expect(ehMaiorDeIdade('1990-01', AGORA)).toBe(true);
    expect(ehMaiorDeIdade('2008-09', AGORA)).toBe(true); // fez 18 em set/2026: o mês passou
    expect(ehMaiorDeIdade('2008-01', AGORA)).toBe(true);
  });

  it('quem faz 18 anos NESTE mês ainda não é (o dia não se sabe): menor até o mês seguinte', () => {
    expect(ehMaiorDeIdade('2008-10', AGORA)).toBe(false);
    expect(ehMaiorDeIdade('2008-11', AGORA)).toBe(false);
    expect(ehMaiorDeIdade('2008-10', new Date(Date.UTC(2026, 10, 1)))).toBe(true); // em novembro já passou
  });

  it('crianças e adolescentes: menor', () => {
    for (const n of ['2026-10', '2020-05', '2015-01', '2009-12', '2009-01']) expect(ehMaiorDeIdade(n, AGORA), n).toBe(false);
  });

  it('sem data, data que não vale ou do futuro: não (padrão é negar)', () => {
    for (const n of [null, undefined, '', 'x', '1990', '2027-01', '1800-01']) expect(ehMaiorDeIdade(n as string | null, AGORA), String(n)).toBe(false);
  });

  it('idadeDaConta separa adulto, menor e sem-idade', () => {
    expect(idadeDaConta('1990-01', AGORA)).toBe('adulto');
    expect(idadeDaConta('2015-01', AGORA)).toBe('menor');
    expect(idadeDaConta('2008-10', AGORA)).toBe('menor');
    expect(idadeDaConta(null, AGORA)).toBe('sem-idade');
    expect(idadeDaConta('lixo', AGORA)).toBe('sem-idade');
  });
});

describe('criar conta com nascimento (P211)', () => {
  const base = { email: 'Dan@X.com', senha: 'senhasegura', aceite: ACEITE_ATUAL };
  it('com um nascimento que vale, ele vai junto; sem ele a conta vale do mesmo jeito (cliente velho: nasce "sem idade")', () => {
    expect(parseCriarConta({ ...base, nascimento: '1990-01' })).toEqual({ ok: true, email: 'dan@x.com', senha: 'senhasegura', nascimento: '1990-01' });
    expect(parseCriarConta(base)).toEqual({ ok: true, email: 'dan@x.com', senha: 'senhasegura' });
    expect(parseCriarConta({ ...base, nascimento: null })).toEqual({ ok: true, email: 'dan@x.com', senha: 'senhasegura' });
  });
  it('com um nascimento que não vale: "nascimento" (não cria a conta com lixo)', () => {
    for (const ruim of ['hoje', '1990-13', 1990, {}, '3000-01', ''])
      expect(parseCriarConta({ ...base, nascimento: ruim }), JSON.stringify(ruim)).toEqual({ ok: false, motivo: 'nascimento' });
  });
  it('e-mail ruim e aceite ausente ainda vêm antes do nascimento', () => {
    expect(parseCriarConta({ email: 'x', senha: 'senhasegura', aceite: ACEITE_ATUAL, nascimento: 'lixo' })).toEqual({ ok: false, motivo: 'dados' });
    expect(parseCriarConta({ email: 'dan@x.com', senha: 'senhasegura', nascimento: 'lixo' })).toEqual({ ok: false, motivo: 'aceite' });
  });
});
