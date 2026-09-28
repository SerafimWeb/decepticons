/**
 * O que a tarefa "CYBERMECH atualizar" roda a cada 10 min (registrada por `servidor-atualizar.ps1`).
 * Puxa o `origin/main`, só avança se a verificação passar, e some fora sem reiniciar nada se falhar —
 * o processo que já está no ar nunca é tocado até o novo código provar que funciona.
 *
 * **Puxar, nunca receber:** não existe nenhum endpoint novo escutando a internet — o PC de casa só faz
 * `git fetch` para fora. Zero superfície nova de ataque (comparado a um webhook que o CI chamaria).
 *
 * **Por que roda numa worktree separada, nunca na pasta principal (G15 + segurança):** a pasta principal é
 * onde você edita o projeto. Se o atualizador desse `git reset --hard` ali, um dia com edição sua
 * não-commitada em andamento seria apagado por um script automático — inaceitável. Este script assume que
 * roda dentro de `.tmp/wt-servidor-prod/` (uma `git worktree`, convenção já usada pelos agentes: AGENTS.md
 * regra 12), separada da pasta que você usa. Se não for uma worktree, ou se houver qualquer mudança não
 * commitada nela (não deveria haver nunca, mas confere), o script recusa mexer e só avisa.
 *
 * Saída: 0 = atualizou e verificou, quem chamou deve reiniciar o servidor. 1 = nada novo, não fez nada.
 * 2 = havia código novo mas a verificação falhou; o worktree volta pro commit anterior, e o servidor que
 * já está rodando continua exatamente como estava (nunca reinicia com código que não passou no gate).
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const LOG = resolve(RAIZ, '.tmp', 'servidor', 'atualizacao.log');
mkdirSync(resolve(RAIZ, '.tmp', 'servidor'), { recursive: true });

function log(linha) {
  const carimbo = new Date().toISOString();
  const texto = `[${carimbo}] ${linha}`;
  console.log(texto);
  appendFileSync(LOG, texto + '\n');
}

function git(...args) {
  return spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8' });
}

// Confere que é mesmo uma worktree separada, não a pasta que o dono usa para editar.
const commonDir = git('rev-parse', '--git-common-dir').stdout.trim();
const gitDir = git('rev-parse', '--git-dir').stdout.trim();
if (commonDir === gitDir) {
  log('RECUSADO: esta pasta não é uma worktree separada (git-dir == git-common-dir). Rode a partir de .tmp/wt-servidor-prod/.');
  process.exit(2);
}

const sujo = git('status', '--porcelain').stdout.trim();
if (sujo) {
  log(`RECUSADO: a worktree do servidor tem mudanças não commitadas — não deveria ter nenhuma; verifique manualmente:\n${sujo}`);
  process.exit(2);
}

const antes = git('rev-parse', 'HEAD').stdout.trim();
const fetch = git('fetch', 'origin', 'main', '--quiet');
if (fetch.status !== 0) {
  log(`RECUSADO: git fetch falhou (sem internet, ou o túnel caiu de vez):\n${fetch.stderr}`);
  process.exit(2);
}
const remoto = git('rev-parse', 'origin/main').stdout.trim();

if (antes === remoto) {
  process.exit(1); // nada novo — não polui o log toda vez que roda
}

log(`código novo: ${antes.slice(0, 7)} → ${remoto.slice(0, 7)}`);
const antesLock = git('show', `${antes}:package-lock.json`).stdout;
const merge = git('merge', '--ff-only', remoto);
if (merge.status !== 0) {
  log(`RECUSADO: merge --ff-only falhou (a worktree divergiu de origin/main, o que não deveria acontecer aqui):\n${merge.stderr}`);
  process.exit(2);
}
const depoisLock = git('show', `${remoto}:package-lock.json`).stdout;

function rollback(motivo) {
  log(`FALHOU (${motivo}) — voltando para ${antes.slice(0, 7)}, o servidor no ar não é tocado`);
  git('reset', '--hard', antes);
  process.exit(2);
}

if (antesLock !== depoisLock) {
  log('package-lock.json mudou: npm ci');
  const ci = spawnSync('npm', ['ci'], { cwd: RAIZ, stdio: 'inherit', shell: true });
  if (ci.status !== 0) rollback('npm ci');
}

log('verificando: typecheck + testes do servidor');
const tsc = spawnSync('npm', ['run', 'typecheck'], { cwd: RAIZ, stdio: 'inherit', shell: true });
if (tsc.status !== 0) rollback('typecheck');

const testes = spawnSync('node', ['scripts/test.mjs', 'run', '--no-isolate', 'server', 'shared'], { cwd: RAIZ, stdio: 'inherit', shell: true });
if (testes.status !== 0) rollback('testes de server/ e shared/');

log(`OK: ${remoto.slice(0, 7)} verificado, pedindo reinício`);
process.exit(0);
