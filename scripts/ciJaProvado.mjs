/**
 * O push na `main` repete o `check` que o PR já rodou na MESMA árvore? (P223, 19/10: o CI do push era 38% dos minutos do Actions de um dia de trabalho.)
 *
 * O merge é um commit de junção (`gh pr merge --merge`): o segundo pai é o último commit do PR. Se a árvore da `main` é **idêntica** à árvore desse commit e o CI do PR **passou** nele, esta
 * árvore exata já foi testada numa máquina limpa: o job termina verde em segundos em vez de refazer 5 minutos. **Na dúvida roda o check inteiro** (squash ou rebase não têm segundo pai, a `main`
 * andou e a árvore difere, o PR não tem execução verde, o `gh` falhou): um portão a mais nunca é pior que um portão furado.
 *
 * Uso no workflow: `node scripts/ciJaProvado.mjs` (lê GITHUB_EVENT_NAME e GITHUB_SHA; escreve `ja_provada=true|false` em GITHUB_OUTPUT; nunca falha o job).
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

/** A decisão, pura: `provado` só com as quatro condições juntas. */
export function decidirJaProvado({ evento, arvore, arvoreDoPai2, rodadasVerdesDoPai2 }) {
  if (evento !== 'push') return { provado: false, motivo: 'não é um push na main: o PR roda o check de verdade' };
  if (!arvore || !arvoreDoPai2) return { provado: false, motivo: 'não é um commit de junção (sem segundo pai, como squash ou rebase): roda o check' };
  if (arvore !== arvoreDoPai2) return { provado: false, motivo: 'a árvore da main difere da do PR (a main andou, ou a junção mexeu em algo): roda o check' };
  if (!(rodadasVerdesDoPai2 >= 1)) return { provado: false, motivo: 'o PR não tem uma execução verde do CI neste commit: roda o check' };
  return { provado: true, motivo: `a árvore ${arvore.slice(0, 12)} já passou no check do PR: não repito` };
}

const git = (args) => {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
};
const gh = (args) => {
  const r = spawnSync('gh', args, { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
};

/**
 * Junta os fatos (git e gh, injetáveis para teste) e decide. Nunca lança: qualquer erro vira "não provado".
 * `sha` é o commit da `main` que o push trouxe.
 */
export function avaliar({ evento, sha }, { executarGit = git, executarGh = gh } = {}) {
  try {
    if (evento !== 'push' || !sha) return decidirJaProvado({ evento, arvore: '', arvoreDoPai2: '', rodadasVerdesDoPai2: 0 });
    const pai2 = executarGit(['rev-parse', '--verify', '--quiet', `${sha}^2`]);
    const arvore = executarGit(['rev-parse', `${sha}^{tree}`]);
    const arvoreDoPai2 = pai2 ? executarGit(['rev-parse', `${pai2}^{tree}`]) : '';
    let verdes = 0;
    if (pai2 && arvore && arvore === arvoreDoPai2) {
      verdes = Number(executarGh(['run', 'list', '--workflow', 'ci.yml', '--commit', pai2, '--event', 'pull_request', '--status', 'success', '--json', 'conclusion', '--jq', 'length']));
      if (!Number.isFinite(verdes)) verdes = 0;
    }
    const d = decidirJaProvado({ evento, arvore, arvoreDoPai2, rodadasVerdesDoPai2: verdes });
    return d.provado ? { ...d, motivo: `a árvore ${arvore.slice(0, 12)} já passou no check do PR (commit ${pai2.slice(0, 8)}): não repito` } : d;
  } catch (erro) {
    return { provado: false, motivo: `não consegui conferir (${String(erro?.message ?? erro).slice(0, 80)}): roda o check` };
  }
}

if (process.argv[1]?.endsWith('ciJaProvado.mjs')) {
  const d = avaliar({ evento: process.env.GITHUB_EVENT_NAME ?? '', sha: process.env.GITHUB_SHA ?? '' });
  console.log(`${d.provado ? '✔' : '▶'} ${d.motivo}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ja_provada=${d.provado ? 'true' : 'false'}\n`);
}
