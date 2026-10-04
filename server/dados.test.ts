import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { EVENTO_PATH } from '../shared/net/telemetry';
import { bancoDeContas, DADOS_VARIAVEL, pastaDados } from './dados';
import { TOKEN_ARQUIVO } from './metricas';
import { startServer } from './Server';

/** Pasta de teste dentro do projeto (G15: nada fora de `.tmp/`). */
const pasta = (nome: string) => {
  const p = resolve('.tmp', `teste-dados-${nome}-${process.pid}`);
  rmSync(p, { recursive: true, force: true });
  mkdirSync(p, { recursive: true });
  return p;
};

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
