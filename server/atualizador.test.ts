import { describe, expect, it } from 'vitest';
import { atualizar, ultimasLinhas, type Operacoes, type Pendencia, type Resultado } from '../scripts/atualizador.mjs';

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
  /** O servidor não saiu quando pedimos a parada (servidor de antes da vigia, só administrador encerra). */
  naoPara?: boolean;
  /** Comandos que falham: 'npm ci', 'npm ci (volta)', 'typecheck' ou 'testes'. */
  falhas?: string[];
  /** O código que já está em disco (HEAD); a rodada cortada deixou isto para trás. */
  head?: string;
  /** A origin/main; o padrão é 'bbbbbbb2222' (ou o mesmo do HEAD se `novo` for falso). */
  remoto?: string;
  /** O registro que uma rodada anterior deixou pela metade. */
  pendencia?: Pendencia | null;
  /** O comando em que o Agendador mata a tarefa no meio (lança uma exceção): 'typecheck' ou 'testes'. */
  corta?: string;
}

function palco(c: Cenario = {}) {
  const { worktreeSeparada = true, atalho = false, sujo = false, novo = true, lockMudou = false, mergeFalha = false, naoPara = false, falhas = [], head = 'aaaaaaa1111', pendencia = null, corta } = c;
  const remoto = c.remoto ?? (novo ? 'bbbbbbb2222' : head);
  const chamadas: string[] = [];
  /** O registro em disco (sobrevive a uma rodada cortada) e o que foi feito com ele, fora das `chamadas` para não mexer nas ordens já testadas. */
  let armazenada: Pendencia | null = pendencia ? { ...pendencia, feito: [...pendencia.feito] } : null;
  const registro: string[] = [];
  /** O marcador de reinício pendente em disco: sobrevive a uma rodada cortada, como o registro da verificação. */
  let reinicioMarcado = false;
  const ok = (stdout = ''): Resultado => ({ status: 0, stdout });
  let npmCi = 0;
  const op: Operacoes = {
    git(...args) {
      const a = args.join(' ');
      if (a.startsWith('rev-parse --git-common-dir')) return ok('/repo/.git');
      if (a.startsWith('rev-parse --git-dir')) return ok(worktreeSeparada ? '/repo/.git/worktrees/servidor' : '/repo/.git');
      if (a.startsWith('status')) return ok(sujo ? ' M arquivo.ts' : '');
      if (a === 'rev-parse HEAD') return ok(head);
      if (a.startsWith('fetch')) return ok();
      if (a === 'rev-parse origin/main') return ok(remoto);
      if (a.startsWith('show aaaaaaa1111:package-lock.json')) return ok('lock-antigo');
      if (/^show \w+:package-lock\.json/.test(a)) return ok(lockMudou ? 'lock-novo' : 'lock-antigo');
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
        if (corta === 'typecheck') throw new Error('tarefa cortada pelo Agendador');
        return falhas.includes('typecheck') ? 1 : 0;
      }
      if (a.startsWith('node scripts/test.mjs')) {
        chamadas.push('testes');
        if (corta === 'testes') throw new Error('tarefa cortada pelo Agendador');
        return falhas.includes('testes') ? 1 : 0;
      }
      throw new Error(`comando inesperado: ${a}`);
    },
    log: (l) => chamadas.push(`log: ${l}`),
    nodeModulesEhAtalho: () => atalho,
    pararServidor: () => {
      chamadas.push('PARA servidor');
      return !naoPara;
    },
    ligarServidor: () => chamadas.push('LIGA servidor'),
    lerPendencia: () => (armazenada ? { ...armazenada, feito: [...armazenada.feito] } : null),
    gravarPendencia: (p) => {
      armazenada = { ...p, feito: [...p.feito] };
      registro.push(`grava ${p.de.slice(0, 7)}→${p.para.slice(0, 7)} [${p.feito.join(',')}]`);
    },
    limparPendencia: () => {
      armazenada = null;
      registro.push('limpa');
    },
    marcarReinicio: () => {
      reinicioMarcado = true;
      registro.push('marca o reinício');
      chamadas.push('log: (marcador) reinício pendente gravado'); // com prefixo de log: as ordens já testadas em `sem()` não mudam
    },
  };
  /** As chamadas sem as linhas de log. */
  const sem = () => chamadas.filter((c) => !c.startsWith('log:'));
  return { op, chamadas, sem, registro, armazenada: () => armazenada, reinicioMarcado: () => reinicioMarcado };
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

  it('o servidor não saiu (só administrador o encerra): NÃO roda npm ci, volta o código e não religa nada', () => {
    const p = palco({ lockMudou: true, naoPara: true });
    expect(atualizar(p.op)).toBe(2);
    expect(p.sem()).toEqual(['git merge', 'PARA servidor', 'git reset --hard (volta)']); // sem npm ci: o binário em uso travaria e deixaria a pasta pela metade
    expect(p.chamadas.join(' | ')).toContain('RECUSADO: não consegui parar o servidor');
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

describe('atualizador do servidor: o reinício nunca se perde entre "verificado" e o marcador (achado 11/10)', () => {
  it('passou na verificação: o marcador de reinício pendente é gravado ANTES de o registro da verificação sumir e ANTES do log de OK', () => {
    const p = palco();
    expect(atualizar(p.op)).toBe(0);
    expect(p.reinicioMarcado()).toBe(true);
    expect(p.registro.indexOf('marca o reinício')).toBeLessThan(p.registro.indexOf('limpa'));
    const iMarca = p.chamadas.indexOf('log: (marcador) reinício pendente gravado');
    const iOk = p.chamadas.findIndex((c) => c.startsWith('log: OK:'));
    expect(iMarca).toBeGreaterThan(-1);
    expect(iMarca).toBeLessThan(iOk);
  });

  it('a rodada morre logo depois de verificar (o Agendador mata a tarefa, ou a máquina trava): o marcador já está em disco, então a rodada seguinte reinicia o servidor', () => {
    const p = palco();
    const original = p.op.log;
    p.op.log = (l) => {
      if (l.startsWith('OK:')) throw new Error('tarefa cortada pelo Agendador logo depois de verificar');
      original(l);
    };
    expect(() => atualizar(p.op)).toThrow('cortada');
    expect(p.reinicioMarcado()).toBe(true); // o que faltava em 11/10: sem marcador, sem pendência e sem "código novo", o reinício se perdia
  });

  it('falhou a verificação (typecheck, testes, npm ci ou parada): nenhum marcador, porque o código volta ao anterior e o servidor segue com ele', () => {
    for (const falhas of [['typecheck'], ['testes']]) {
      const p = palco({ falhas });
      expect(atualizar(p.op)).toBe(2);
      expect(p.reinicioMarcado()).toBe(false);
    }
    const naoPara = palco({ lockMudou: true, naoPara: true });
    expect(atualizar(naoPara.op)).toBe(2);
    expect(naoPara.reinicioMarcado()).toBe(false);
  });

  it('nada novo na main: nenhum marcador (o servidor no ar não é tocado)', () => {
    const p = palco({ novo: false });
    expect(atualizar(p.op)).toBe(1);
    expect(p.reinicioMarcado()).toBe(false);
  });
});

describe('atualizador do servidor: rodada cortada pelo limite de tempo do Agendador (achado 09/10)', () => {
  const PENDENTE: Pendencia = { de: 'aaaaaaa1111', para: 'bbbbbbb2222', feito: [] };

  it('a verificação grava o progresso: o registro nasce ao puxar, ganha o typecheck e some quando tudo passa', () => {
    const p = palco();
    expect(atualizar(p.op)).toBe(0);
    expect(p.registro).toEqual(['grava aaaaaaa→bbbbbbb []', 'grava aaaaaaa→bbbbbbb [typecheck]', 'marca o reinício', 'limpa']);
    expect(p.armazenada()).toBeNull();
  });

  it('cortada no meio, a rodada seguinte NÃO diz "nada novo": retoma, verifica e pede o reinício (antes, o servidor ficava no código velho para sempre)', () => {
    const cortada = palco({ corta: 'typecheck' });
    expect(() => atualizar(cortada.op)).toThrow('cortada');
    const deixado = cortada.armazenada();
    expect(deixado).toEqual({ de: 'aaaaaaa1111', para: 'bbbbbbb2222', feito: [] }); // o que sobrou em disco

    // A rodada seguinte: o código novo já está em disco (HEAD = origin/main), então o git não vê nada novo.
    const retoma = palco({ head: 'bbbbbbb2222', remoto: 'bbbbbbb2222', pendencia: deixado });
    expect(atualizar(retoma.op)).toBe(0);
    expect(retoma.sem()).toEqual(['typecheck', 'testes']); // sem novo merge: o código já está lá
    expect(retoma.chamadas.join('\n')).toContain('retomando a verificação cortada');
    expect(retoma.armazenada()).toBeNull();
  });

  it('sem o registro, a mesma situação (código em disco, git sem novidade) continua sendo "nada novo": o registro é o que faz a diferença', () => {
    const p = palco({ head: 'bbbbbbb2222', remoto: 'bbbbbbb2222', pendencia: null });
    expect(atualizar(p.op)).toBe(1);
    expect(p.sem()).toEqual([]);
  });

  it('o typecheck que já passou não se repete: cada rodada avança, mesmo cortada (a máquina lenta precisa de mais de uma para terminar)', () => {
    const cortada = palco({ corta: 'testes' });
    expect(() => atualizar(cortada.op)).toThrow('cortada');
    expect(cortada.armazenada()).toEqual({ de: 'aaaaaaa1111', para: 'bbbbbbb2222', feito: ['typecheck'] });

    const retoma = palco({ head: 'bbbbbbb2222', remoto: 'bbbbbbb2222', pendencia: cortada.armazenada() });
    expect(atualizar(retoma.op)).toBe(0);
    expect(retoma.sem()).toEqual(['testes']); // só o que faltava
  });

  it('falha na retomada volta para o último código VERIFICADO (de), não para o que estava em disco, e apaga o registro', () => {
    const p = palco({ head: 'bbbbbbb2222', remoto: 'bbbbbbb2222', pendencia: PENDENTE, falhas: ['testes'] });
    expect(atualizar(p.op)).toBe(2);
    expect(p.sem()).toEqual(['typecheck', 'testes', 'git reset --hard (volta)']);
    expect(p.armazenada()).toBeNull();
  });

  it('um registro velho (a worktree já não está no código dele) é apagado e vale "nada novo", sem verificar nada', () => {
    const p = palco({ head: 'ccccccc3333', remoto: 'ccccccc3333', pendencia: PENDENTE });
    expect(atualizar(p.op)).toBe(1);
    expect(p.sem()).toEqual([]);
    expect(p.registro).toEqual(['limpa']);
  });

  it('chegou código mais novo com uma verificação pela metade: mescla o novo, refaz os passos (eram de outro código) e volta, se falhar, para o último verificado', () => {
    const feito: Pendencia = { de: 'aaaaaaa1111', para: 'bbbbbbb2222', feito: ['typecheck'] };
    const ok = palco({ head: 'bbbbbbb2222', remoto: 'ccccccc3333', pendencia: feito });
    expect(atualizar(ok.op)).toBe(0);
    expect(ok.sem()).toEqual(['git merge', 'typecheck', 'testes']); // o typecheck é de novo: o de antes era do código bbbbbbb
    const falha = palco({ head: 'bbbbbbb2222', remoto: 'ccccccc3333', pendencia: feito, falhas: ['testes'] });
    expect(atualizar(falha.op)).toBe(2);
    expect(falha.sem()).toEqual(['git merge', 'typecheck', 'testes', 'git reset --hard (volta)']); // volta a aaaaaaa, não a bbbbbbb
  });

  it('recusas e falhas antes de puxar não deixam registro (nada em disco para retomar)', () => {
    for (const c of [{ worktreeSeparada: false }, { sujo: true }, { atalho: true }, { mergeFalha: true }]) {
      const p = palco(c);
      expect(atualizar(p.op)).toBe(2);
      expect(p.armazenada()).toBeNull();
    }
  });

  it('com o package-lock mudado, o registro some também quando o servidor não pode ser parado (o código volta)', () => {
    const p = palco({ lockMudou: true, naoPara: true });
    expect(atualizar(p.op)).toBe(2);
    expect(p.armazenada()).toBeNull();
  });
});

describe('atualizador do servidor: a saída de um comando que falhou fica no log (17/10: a verificação falhava e o log não dizia qual teste)', () => {
  it('guarda só as últimas linhas, sem cores do terminal e sem linhas vazias', () => {
    const saida = ['\u001b[31m FAIL \u001b[39m server/x.test.ts', '', '  AssertionError: esperava 1', '', 'Test Files  1 failed | 48 passed'].join('\n');
    expect(ultimasLinhas(saida, 2)).toBe('  AssertionError: esperava 1\nTest Files  1 failed | 48 passed');
    expect(ultimasLinhas(saida, 10)).toBe(' FAIL  server/x.test.ts\n  AssertionError: esperava 1\nTest Files  1 failed | 48 passed');
  });

  it('saída vazia ou ausente não quebra o atualizador (devolve texto vazio)', () => {
    expect(ultimasLinhas('', 40)).toBe('');
    expect(ultimasLinhas(undefined as unknown as string, 40)).toBe('');
    expect(ultimasLinhas('\n\n', 40)).toBe('');
  });

  it('quantidade absurda (0 ou negativa) ainda devolve ao menos a última linha', () => {
    expect(ultimasLinhas('a\nb\nc', 0)).toBe('c');
    expect(ultimasLinhas('a\nb\nc', -5)).toBe('c');
  });
});
