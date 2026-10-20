import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { EVENTO_PATH } from '../shared/net/telemetry';
import { bancoDeContas, DADOS_VARIAVEL, pastaDados, pastaDadosDasFerramentas } from './dados';
import { TOKEN_ARQUIVO } from './metricas';
import { startServer } from './Server';

/** Pasta de teste dentro do projeto (G15: nada fora de `.tmp/`). */
const pasta = (nome: string) => {
  const p = resolve('.tmp', `teste-dados-${nome}-${process.pid}`);
  rmSync(p, { recursive: true, force: true });
  mkdirSync(p, { recursive: true });
  return p;
};

describe('pastaDadosDasFerramentas: o npm run admin e o npm run email numa worktree acham os dados de produção', () => {
  /** Uma "pasta principal" de mentira com `.tmp/servidor` e uma worktree cujo `.git` aponta para ela, do jeito que o git escreve. */
  const montar = (nome: string, comDados = true) => {
    const raiz = pasta(nome);
    const principal = join(raiz, 'principal');
    const worktree = join(raiz, 'wt');
    mkdirSync(join(principal, '.git', 'worktrees', 'wt'), { recursive: true });
    if (comDados) mkdirSync(join(principal, '.tmp', 'servidor'), { recursive: true });
    mkdirSync(worktree, { recursive: true });
    writeFileSync(join(worktree, '.git'), `gitdir: ${join(principal, '.git', 'worktrees', 'wt').replace(/\\/g, '/')}\n`);
    return { principal, worktree };
  };

  it('numa worktree, os dados são os da pasta principal (onde está o contas.db de produção), não uma pasta vazia da worktree', () => {
    const { principal, worktree } = montar('wt');
    expect(pastaDadosDasFerramentas(worktree, undefined)).toBe(join(principal, '.tmp', 'servidor'));
  });

  it('a variável CYBERMECH_DADOS manda mais que tudo, e fora de worktree (ou sem dados lá) vale a pasta ao lado do código', () => {
    const { worktree } = montar('var');
    expect(pastaDadosDasFerramentas(worktree, resolve('.tmp', 'servidor'))).toBe(resolve('.tmp', 'servidor'));
    const sem = montar('sem', false);
    expect(pastaDadosDasFerramentas(sem.worktree, undefined), 'a principal ainda não tem .tmp/servidor').toBe(join(sem.worktree, '.tmp', 'servidor'));
    const solta = pasta('solta');
    expect(pastaDadosDasFerramentas(solta, undefined), 'pasta que não é worktree: .git ausente ou diretório').toBe(join(solta, '.tmp', 'servidor'));
    mkdirSync(join(solta, '.git'), { recursive: true });
    expect(pastaDadosDasFerramentas(solta, undefined), 'checkout principal (.git é pasta)').toBe(join(solta, '.tmp', 'servidor'));
  });

  it('o servidor NÃO usa isto: pastaDados ignora worktree (um servidor de teste numa worktree nunca pega o banco de produção)', () => {
    const { worktree } = montar('servidor');
    expect(pastaDados(worktree, undefined)).toBe(join(worktree, '.tmp', 'servidor'));
  });
});

describe('a subida do servidor com pasta de dados não registra erro de faxina', () => {
  const dir = pasta('faxina');
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('a primeira faxina (sessões vencidas e auditoria antiga) roda depois de a auditoria existir: nada de "Cannot access \'auditoria\' before initialization" no log (visto em 18, 19 e 20/10)', async () => {
    const antes = process.env[DADOS_VARIAVEL];
    process.env[DADOS_VARIAVEL] = dir;
    const linhas: string[] = [];
    let s;
    try {
      s = await startServer({ port: 0, host: '127.0.0.1', log: (l) => linhas.push(l) });
    } finally {
      if (antes === undefined) delete process.env[DADOS_VARIAVEL];
      else process.env[DADOS_VARIAVEL] = antes;
    }
    try {
      expect(linhas.filter((l) => l.includes('não consegui varrer'))).toEqual([]);
    } finally {
      await s.close();
    }
  });
});

describe('pastaDados: onde o servidor guarda banco, números e token', () => {
  const codigo = resolve('.tmp', 'wt-servidor-prod');

  it('sem a variável, é o .tmp/servidor ao lado do código (o que sempre foi)', () => {
    expect(pastaDados(codigo, undefined)).toBe(join(codigo, '.tmp', 'servidor'));
  });

  it('com a variável, os dados saem da pasta do código: trocar ou apagar a worktree não leva o banco', () => {
    const fixa = resolve('.tmp', 'servidor');
    expect(pastaDados(codigo, fixa)).toBe(fixa);
    expect(bancoDeContas(pastaDados(codigo, fixa))).toBe(join(fixa, 'contas.db'));
  });

  it('variável vazia ou só de espaços não vale, e caminho relativo é resolvido a partir de onde o servidor roda', () => {
    expect(pastaDados(codigo, '')).toBe(join(codigo, '.tmp', 'servidor'));
    expect(pastaDados(codigo, '   ')).toBe(join(codigo, '.tmp', 'servidor'));
    expect(pastaDados(codigo, '.tmp/dados')).toBe(resolve('.tmp/dados'));
  });
});

describe('o servidor de verdade usa a pasta da variável CYBERMECH_DADOS', () => {
  const dir = pasta('variavel');
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('banco de contas, token e números nascem na pasta indicada, e o log diz qual', async () => {
    const antes = process.env[DADOS_VARIAVEL];
    process.env[DADOS_VARIAVEL] = dir;
    const linhas: string[] = [];
    let s;
    try {
      s = await startServer({ port: 0, host: '127.0.0.1', log: (l) => linhas.push(l) });
    } finally {
      if (antes === undefined) delete process.env[DADOS_VARIAVEL];
      else process.env[DADOS_VARIAVEL] = antes;
    }
    try {
      expect(existsSync(bancoDeContas(dir))).toBe(true);
      expect(existsSync(join(dir, TOKEN_ARQUIVO))).toBe(true);
      expect(linhas.some((l) => l.includes('pasta de dados') && l.includes(dir))).toBe(true);
      // Um evento muda os números: ao fechar, o servidor os grava (só grava quando algo mudou).
      const r = await fetch(`http://127.0.0.1:${s.port}${EVENTO_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'boot_ok', aba: 'abcd1234' }) });
      expect(r.status).toBe(204);
    } finally {
      await s.close();
    }
    expect(existsSync(join(dir, 'telemetria.json'))).toBe(true); // gravado ao fechar
  });
});
