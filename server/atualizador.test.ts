import { describe, expect, it } from 'vitest';
import { atualizar, type Operacoes, type Resultado } from '../scripts/atualizador.mjs';

/**
 * O atualizador do servidor no PC de casa. As operações são de mentira e anotam a ordem em que foram chamadas: o que
 * importa aqui é a ORDEM (parar o servidor antes do npm ci, voltar tudo se algo falha) e o que NUNCA acontece (npm ci
 * por uma junção, mexer no servidor sem precisar).
 */
interface Cenario {
  worktreeSeparada?: boolean;
  atalho?: boolean;
  sujo?: boolean;
  novo?: boolean;
  lockMudou?: boolean;
  mergeFalha?: boolean;
  /** Comandos que falham: 'npm ci', 'npm ci (volta)', 'typecheck' ou 'testes'. */
  falhas?: string[];
}

function palco(c: Cenario = {}) {
  const { worktreeSeparada = true, atalho = false, sujo = false, novo = true, lockMudou = false, mergeFalha = false, falhas = [] } = c;
  const chamadas: string[] = [];
  const ok = (stdout = ''): Resultado => ({ status: 0, stdout });
  let npmCi = 0;
  const op: Operacoes = {
    git(...args) {
      const a = args.join(' ');
      if (a.startsWith('rev-parse --git-common-dir')) return ok('/repo/.git');
      if (a.startsWith('rev-parse --git-dir')) return ok(worktreeSeparada ? '/repo/.git/worktrees/servidor' : '/repo/.git');
      if (a.startsWith('status')) return ok(sujo ? ' M arquivo.ts' : '');
      if (a === 'rev-parse HEAD') return ok('aaaaaaa1111');
      if (a.startsWith('fetch')) return ok();
      if (a === 'rev-parse origin/main') return ok(novo ? 'bbbbbbb2222' : 'aaaaaaa1111');
      if (a.startsWith('show aaaaaaa1111:package-lock.json')) return ok('lock-antigo');
      if (a.startsWith('show bbbbbbb2222:package-lock.json')) return ok(lockMudou ? 'lock-novo' : 'lock-antigo');
      if (a.startsWith('merge')) {
        chamadas.push('git merge');
        return mergeFalha ? { status: 1, stderr: 'not ff' } : ok();
      }
      if (a.startsWith('reset --hard aaaaaaa1111')) {
        chamadas.push('git reset --hard (volta)');
        return ok();
      }
      throw new Error(`git inesperado: ${a}`);
    },
    executar(comando, args) {
      const a = [comando, ...args].join(' ');
      if (a === 'npm ci') {
        npmCi++;
        const nome = npmCi === 1 ? 'npm ci' : 'npm ci (volta)';
        chamadas.push(nome);
        return falhas.includes(nome) ? 1 : 0;
      }
      if (a === 'npm run typecheck') {
        chamadas.push('typecheck');
        return falhas.includes('typecheck') ? 1 : 0;
      }
      if (a.startsWith('node scripts/test.mjs')) {
        chamadas.push('testes');
        return falhas.includes('testes') ? 1 : 0;
      }
      throw new Error(`comando inesperado: ${a}`);
    },
    log: (l) => chamadas.push(`log: ${l}`),
    nodeModulesEhAtalho: () => atalho,
    pararServidor: () => chamadas.push('PARA servidor'),
    ligarServidor: () => chamadas.push('LIGA servidor'),
  };
  /** As chamadas sem as linhas de log. */
  const sem = () => chamadas.filter((c) => !c.startsWith('log:'));
  return { op, chamadas, sem };
}

describe('atualizador do servidor: o que nunca faz', () => {
  it('recusa se node_modules é atalho (junção): o npm ci apagaria a pasta compartilhada, como aconteceu em 04/10', () => {
    const p = palco({ atalho: true, lockMudou: true });
    expect(atualizar(p.op)).toBe(2);
    expect(p.sem()).toEqual([]); // não buscou, não mesclou, não parou o servidor, não rodou npm
    expect(p.chamadas.join('\n')).toContain('RECUSADO');
  });

  it('recusa fora de uma worktree separada e com mudança não commitada, sem tocar em nada', () => {
    for (const c of [{ worktreeSeparada: false }, { sujo: true }]) {
      const p = palco(c);
      expect(atualizar(p.op)).toBe(2);
      expect(p.sem()).toEqual([]);
    }
  });

  it('nada novo na main: sai com 1 e não faz nada (nem log)', () => {
    const p = palco({ novo: false });
    expect(atualizar(p.op)).toBe(1);
    expect(p.chamadas).toEqual([]);
  });

  it('o merge que não avança em linha reta recusa sem parar o servidor', () => {
    const p = palco({ lockMudou: true, mergeFalha: true });
    expect(atualizar(p.op)).toBe(2);
    expect(p.sem()).toEqual(['git merge']);
  });
});

describe('atualizador do servidor: sem mudança nas dependências, o servidor no ar não é tocado', () => {
  it('passa: mescla, verifica e pede o reinício (quem chamou religa); não para o servidor nem roda npm ci', () => {
    const p = palco();
    expect(atualizar(p.op)).toBe(0);
    expect(p.sem()).toEqual(['git merge', 'typecheck', 'testes']);
  });

  it('typecheck ou testes falham: volta o código e o servidor nunca é parado nem religado', () => {
    const p1 = palco({ falhas: ['typecheck'] });
    expect(atualizar(p1.op)).toBe(2);
    expect(p1.sem()).toEqual(['git merge', 'typecheck', 'git reset --hard (volta)']);
    const p2 = palco({ falhas: ['testes'] });
    expect(atualizar(p2.op)).toBe(2);
    expect(p2.sem()).toEqual(['git merge', 'typecheck', 'testes', 'git reset --hard (volta)']);
  });
});

describe('atualizador do servidor: package-lock mudou', () => {
  it('para o servidor ANTES do npm ci (o binário nativo em uso trava o npm no Windows), verifica e deixa parado para quem chamou religar', () => {
    const p = palco({ lockMudou: true });
    expect(atualizar(p.op)).toBe(0);
    expect(p.sem()).toEqual(['git merge', 'PARA servidor', 'npm ci', 'typecheck', 'testes']);
  });

  it('npm ci falha: volta o código, refaz as dependências do código antigo e religa o servidor que ele mesmo parou', () => {
    const p = palco({ lockMudou: true, falhas: ['npm ci'] });
    expect(atualizar(p.op)).toBe(2);
    expect(p.sem()).toEqual(['git merge', 'PARA servidor', 'npm ci', 'git reset --hard (volta)', 'npm ci (volta)', 'LIGA servidor']);
  });

  it('a verificação falha depois do npm ci: mesmo caminho de volta, e o servidor sobe de novo com o código bom', () => {
    const p = palco({ lockMudou: true, falhas: ['testes'] });
    expect(atualizar(p.op)).toBe(2);
    expect(p.sem()).toEqual(['git merge', 'PARA servidor', 'npm ci', 'typecheck', 'testes', 'git reset --hard (volta)', 'npm ci (volta)', 'LIGA servidor']);
  });

  it('se até o npm ci de volta falha, avisa em voz alta mas ainda tenta religar o servidor', () => {
    const p = palco({ lockMudou: true, falhas: ['npm ci', 'npm ci (volta)'] });
    expect(atualizar(p.op)).toBe(2);
    expect(p.chamadas.some((c) => c.startsWith('log: ATENÇÃO'))).toBe(true);
    expect(p.sem().at(-1)).toBe('LIGA servidor');
  });
});
