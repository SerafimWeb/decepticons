/**
 * O que a tarefa "CYBERMECH atualizar" roda a cada 10 min (registrada por `servidor-atualizar.ps1`).
 * Puxa o `origin/main`, só avança se a verificação passar, e volta atrás sem deixar rastro se falhar. A ordem das
 * coisas (e as regras de segurança do `node_modules`) está em `atualizador.mjs`, que tem teste; aqui só se liga ao git,
 * ao npm e ao Agendador de Tarefas do Windows.
 *
 * **Puxar, nunca receber:** não existe nenhum endpoint novo escutando a internet — o PC de casa só faz
 * `git fetch` para fora. Zero superfície nova de ataque (comparado a um webhook que o CI chamaria).
 *
 * **Por que roda numa worktree separada, nunca na pasta principal (G15 + segurança):** a pasta principal é
 * onde você edita o projeto. Se o atualizador desse `git reset --hard` ali, um dia com edição sua
 * não-commitada em andamento seria apagado por um script automático — inaceitável. Este script assume que
 * roda dentro de `.tmp/wt-servidor-prod/` (uma `git worktree`, convenção já usada pelos agentes: AGENTS.md
 * regra 12), com `node_modules` PRÓPRIO (não um atalho para o do projeto).
 *
 * Saída: 0 = atualizou e verificou, quem chamou deve (re)ligar o servidor. 1 = nada novo, não fez nada.
 * 2 = recusou ou havia código novo mas falhou; o código voltou ao anterior.
 *
 * `CYBERMECH_TAREFA` (nome da tarefa do servidor no Agendador) liga o para-e-religa do servidor quando o
 * `package-lock.json` muda; sem ela (fora do Windows) o servidor não é tocado.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, lstatSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { atualizar } from './atualizador.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const LOG = resolve(RAIZ, '.tmp', 'servidor', 'atualizacao.log');
mkdirSync(resolve(RAIZ, '.tmp', 'servidor'), { recursive: true });
const TAREFA = process.env.CYBERMECH_TAREFA;

function tarefa(acao) {
  if (!TAREFA) return;
  spawnSync('powershell.exe', ['-NoProfile', '-Command', `${acao}-ScheduledTask -TaskName '${TAREFA}' -ErrorAction SilentlyContinue`], { stdio: 'inherit' });
}

const codigo = atualizar({
  git: (...args) => spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8' }),
  executar: (comando, args) => spawnSync(comando, args, { cwd: RAIZ, stdio: 'inherit', shell: true }).status,
  log(linha) {
    const texto = `[${new Date().toISOString()}] ${linha}`;
    console.log(texto);
    appendFileSync(LOG, texto + '\n');
  },
  nodeModulesEhAtalho() {
    try {
      return lstatSync(resolve(RAIZ, 'node_modules')).isSymbolicLink(); // no Windows, a junção também aparece como link
    } catch {
      return false; // ainda não existe: o npm ci cria
    }
  },
  pararServidor() {
    tarefa('Stop');
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{}, 4000)']); // dá tempo de o processo soltar os arquivos
  },
  ligarServidor() {
    tarefa('Start');
  },
});
process.exit(codigo);
