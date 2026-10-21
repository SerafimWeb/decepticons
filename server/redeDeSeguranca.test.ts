import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { descreverFalha, instalarRedeDeSeguranca, JANELA_MS, MAX_POR_JANELA, type ProcessoParaARede } from './redeDeSeguranca';

/** Um `process` de mentira: guarda o ouvinte para o teste disparar a rejeição, e conta as saídas. */
function processoFalso() {
  let ouvinte: ((motivo: unknown) => void) | null = null;
  const saidas: number[] = [];
  const proc: ProcessoParaARede = {
    on: (_evento, f) => void (ouvinte = f),
    exit: (codigo) => void saidas.push(codigo),
  };
  return { proc, saidas, rejeitar: (m: unknown) => ouvinte?.(m) };
}

describe('a rede de segurança do processo (P239)', () => {
  it('uma rejeição não tratada é registrada com a causa e o servidor segue (não sai)', () => {
    const { proc, saidas, rejeitar } = processoFalso();
    const linhas: string[] = [];
    const erro = vi.fn();
    instalarRedeDeSeguranca(proc, (l) => linhas.push(l), erro);
    rejeitar(new Error('o código do mapa não carregou'));
    expect(saidas).toEqual([]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toContain('o código do mapa não carregou');
    expect(linhas[0]).toContain('o servidor segue');
    expect(linhas[0]).not.toContain('\n');
    expect(erro).toHaveBeenCalledTimes(1); // a pilha inteira vai ao servidor.log
  });

  it('uma rejeição que não é Error (texto, undefined) também é registrada, sem estourar', () => {
    const { proc, saidas, rejeitar } = processoFalso();
    const linhas: string[] = [];
    instalarRedeDeSeguranca(proc, (l) => linhas.push(l), vi.fn());
    rejeitar('falhou sem Error');
    rejeitar(undefined);
    expect(saidas).toEqual([]);
    expect(linhas[0]).toContain('falhou sem Error');
    expect(descreverFalha(undefined)).toBe('undefined');
  });

  it('as rejeições dentro do teto passam; a que estoura o teto na janela de 1 min tira o processo (tempestade = algo quebrado)', () => {
    const { proc, saidas, rejeitar } = processoFalso();
    instalarRedeDeSeguranca(proc, vi.fn(), vi.fn(), () => 1000);
    for (let i = 0; i < MAX_POR_JANELA; i++) rejeitar(new Error(`falha ${i}`));
    expect(saidas).toEqual([]);
    rejeitar(new Error('a que passa do teto'));
    expect(saidas).toEqual([1]);
  });

  it('o teto vale por janela: rejeições espaçadas por mais de 1 min nunca somam', () => {
    const { proc, saidas, rejeitar } = processoFalso();
    let t = 0;
    instalarRedeDeSeguranca(proc, vi.fn(), vi.fn(), () => t);
    for (let i = 0; i < MAX_POR_JANELA * 3; i++) {
      t += JANELA_MS + 1;
      rejeitar(new Error('esporádica'));
    }
    expect(saidas).toEqual([]);
  });

  it('o main.ts liga a rede no processo de verdade, antes de subir o servidor (apagar a linha deixaria tudo verde e a produção sem rede)', () => {
    const main = readFileSync(resolve(import.meta.dirname, 'main.ts'), 'utf8');
    const liga = main.indexOf('instalarRedeDeSeguranca(process,');
    expect(liga, 'o main.ts não chama instalarRedeDeSeguranca(process, …)').toBeGreaterThan(-1);
    expect(liga).toBeLessThan(main.indexOf('await startServer('));
  });

  it('de verdade, num processo à parte: sem a rede o Node morre numa rejeição solta; com ela, vive', async () => {
    const rodar = (instalar: boolean) =>
      new Promise<{ codigo: number | null; saida: string }>((acabou) => {
        const codigo = `
          import { runnerImport } from 'vite';
          import { resolve } from 'node:path';
          const { module: rede } = await runnerImport(resolve('server/redeDeSeguranca.ts'), { configFile: false, logLevel: 'error' });
          if (${instalar}) rede.instalarRedeDeSeguranca(process, () => {}, () => {});
          Promise.reject(new Error('rejeição solta'));
          setTimeout(() => { console.log('VIVO'); process.exit(0); }, 400);
        `;
        const f = spawn(process.execPath, ['--input-type=module', '-e', codigo], { cwd: resolve(import.meta.dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] });
        let saida = '';
        f.stdout.on('data', (d: Buffer) => (saida += d.toString()));
        f.stderr.on('data', (d: Buffer) => (saida += d.toString()));
        f.on('exit', (c) => acabou({ codigo: c, saida }));
      });
    const sem = await rodar(false);
    expect(sem.saida).not.toContain('VIVO');
    expect(sem.codigo).not.toBe(0);
    const com = await rodar(true);
    expect(com.saida).toContain('VIVO');
    expect(com.codigo).toBe(0);
  }, 60_000);
});
