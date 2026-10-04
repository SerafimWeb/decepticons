/**
 * Núcleo do atualizador do servidor (`atualizar-servidor.mjs` é a casca que liga isto ao git, ao npm e ao Windows).
 * A ordem das coisas mora aqui, sem tocar em disco nem em processo, para o teste (`server/atualizador.test.ts`) poder
 * conferir cada caminho com operações de mentira.
 *
 * Duas regras de segurança que custaram caro (04/10, o `npm ci` do atualizador apagou a `node_modules` que todas as
 * worktrees compartilham e deixou o servidor sem como reiniciar):
 * 1. **`node_modules` não pode ser atalho (junção/symlink).** O `npm ci` apaga a pasta inteira antes de reinstalar, e por
 *    uma junção apaga a pasta da OUTRA worktree. O servidor tem `node_modules` próprio ou o atualizador recusa.
 * 2. **Mudou o `package-lock.json`? O servidor para ANTES do `npm ci`.** O processo do jogo roda pelo Vite e mantém o
 *    binário nativo do rolldown aberto; no Windows o `npm ci` não consegue apagar um arquivo em uso (EPERM) e para no
 *    meio, deixando a pasta pela metade. Se algo falha depois de parar, volta o código E as dependências antigas e
 *    religa o servidor. Se tudo passa, quem chamou liga o servidor com o código novo.
 *
 * Retorno: 0 = atualizou e verificou (quem chamou deve (re)ligar o servidor); 1 = nada novo; 2 = recusou ou falhou,
 * e o código voltou ao anterior (o servidor foi religado se tinha sido parado).
 */

/**
 * @typedef {{ status: number | null, stdout?: string, stderr?: string }} Resultado
 * @typedef {object} Operacoes
 * @property {(...args: string[]) => Resultado} git
 * @property {(comando: string, args: string[]) => number | null} executar  executa e devolve o código de saída
 * @property {(linha: string) => void} log
 * @property {() => boolean} nodeModulesEhAtalho
 * @property {() => void} pararServidor
 * @property {() => void} ligarServidor
 */

/** @param {Operacoes} op */
export function atualizar(op) {
  const { git, executar, log } = op;

  // A pasta tem que ser uma worktree separada da que o dono usa: um `git reset --hard` automático nunca pode tocar nela.
  const commonDir = git('rev-parse', '--git-common-dir').stdout?.trim();
  const gitDir = git('rev-parse', '--git-dir').stdout?.trim();
  if (commonDir === gitDir) {
    log('RECUSADO: esta pasta não é uma worktree separada (git-dir == git-common-dir). Rode a partir de .tmp/wt-servidor-prod/.');
    return 2;
  }
  if (op.nodeModulesEhAtalho()) {
    log('RECUSADO: node_modules aqui é um atalho (junção) para a pasta de outra worktree. O npm ci apagaria a pasta de LÁ. Dê ao servidor um node_modules próprio: `cmd /c rmdir node_modules` (remove só o atalho) e `npm ci`.');
    return 2;
  }
  const sujo = git('status', '--porcelain').stdout?.trim();
  if (sujo) {
    log(`RECUSADO: a worktree do servidor tem mudanças não commitadas — não deveria ter nenhuma; verifique manualmente:\n${sujo}`);
    return 2;
  }

  const antes = git('rev-parse', 'HEAD').stdout?.trim() ?? '';
  const fetch = git('fetch', 'origin', 'main', '--quiet');
  if (fetch.status !== 0) {
    log(`RECUSADO: git fetch falhou (sem internet, ou o túnel caiu de vez):\n${fetch.stderr}`);
    return 2;
  }
  const remoto = git('rev-parse', 'origin/main').stdout?.trim() ?? '';
  if (antes === remoto) return 1; // nada novo — não polui o log toda vez que roda

  log(`código novo: ${antes.slice(0, 7)} → ${remoto.slice(0, 7)}`);
  const antesLock = git('show', `${antes}:package-lock.json`).stdout;
  const merge = git('merge', '--ff-only', remoto);
  if (merge.status !== 0) {
    log(`RECUSADO: merge --ff-only falhou (a worktree divergiu de origin/main, o que não deveria acontecer aqui):\n${merge.stderr}`);
    return 2;
  }
  const lockMudou = antesLock !== git('show', `${remoto}:package-lock.json`).stdout;
  let parado = false;

  /** Volta o código (e as dependências, se mudaram) e religa o servidor, se este script o parou. */
  const voltar = (motivo) => {
    log(`FALHOU (${motivo}) — voltando para ${antes.slice(0, 7)}`);
    git('reset', '--hard', antes);
    if (lockMudou) {
      log('restaurando as dependências do código anterior: npm ci');
      if (executar('npm', ['ci']) !== 0) log('ATENÇÃO: o npm ci de volta falhou — o servidor pode não subir; rode `npm ci` aqui à mão, com o servidor parado.');
    }
    if (parado) {
      log('religando o servidor, que o atualizador tinha parado');
      op.ligarServidor();
    } else log('o servidor no ar não foi tocado');
    return 2;
  };

  if (lockMudou) {
    log('package-lock.json mudou: paro o servidor (ele mantém aberto o binário que o npm ci precisa apagar) e rodo npm ci');
    op.pararServidor();
    parado = true;
    if (executar('npm', ['ci']) !== 0) return voltar('npm ci');
  }

  log('verificando: typecheck + testes do servidor');
  if (executar('npm', ['run', 'typecheck']) !== 0) return voltar('typecheck');
  if (executar('node', ['scripts/test.mjs', 'run', '--no-isolate', 'server', 'shared']) !== 0) return voltar('testes de server/ e shared/');

  log(`OK: ${remoto.slice(0, 7)} verificado, pedindo ${parado ? 'religar' : 'reinício'}`);
  return 0;
}
