/**
 * `npm run publicar -- --titulo "feat: ..." --corpo .tmp/pr.md` — do commit ao site, em um passo (AGENTS.md, regra 13).
 *
 * O que ele faz, na ordem: confere que está num branch de trabalho e sem mudança solta; junta a `main` se ela andou (parando no conflito);
 * `git push` (o hook roda o `npm run check`); abre o PR (ou reaproveita o que já existe); **espera a linha `check` do CI aparecer** e
 * terminar; **só mergeia com o CI verde e o PR `CLEAN`**; e **só apaga o branch remoto depois de confirmar `MERGED`** (em 10/10 um branch
 * apagado depois de um merge que falhou fechou um PR aberto). Usa `ghSeguro.mjs`: se o token do `gh` morrer, cai para a credencial do Git.
 *
 * A lógica é uma função com tudo injetado (`publicar(ops, opcoes)`), testada em `server/publicar.test.ts`.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gh as ghReal } from './ghSeguro.mjs';

const TENTATIVAS_CHECK = 40; // × 6 s: o CI leva até alguns segundos para criar a linha `check`
const TENTATIVAS_ESTADO = 10;
const TENTATIVAS_MERGE = 4; // o GitHub às vezes ainda não calculou a mergeabilidade quando o CI acaba: o 1º merge falha e o 2º passa (11/10, #231)

/** @returns {Promise<{ ok: boolean, motivo?: string, pr?: number, merge?: string }>} */
export async function publicar(ops, opcoes) {
  const { git, gh, empurrar, dormir, log } = ops;
  const falha = (motivo) => {
    log(`✗ ${motivo}`);
    return { ok: false, motivo };
  };
  const json = (r) => {
    try {
      return JSON.parse(r.stdout);
    } catch {
      return null;
    }
  };

  const branch = git(['branch', '--show-current']).stdout.trim();
  if (!branch || branch === 'main' || branch === 'master') return falha('estou na main (ou sem branch): crie um branch <agente>/<tarefa> primeiro (AGENTS.md, regra 2)');
  const solto = git(['status', '--porcelain'])
    .stdout.split('\n')
    .filter((l) => l.trim() && !l.slice(3).startsWith('.tmp/'))
    .join('\n');
  if (solto) return falha(`há mudança sem commit:\n${solto}\ncommite (ou descarte) antes de publicar`);

  git(['fetch', 'origin', 'main', '--quiet']);
  const atras = git(['rev-list', '--count', 'HEAD..origin/main']).stdout.trim();
  if (atras !== '0') {
    log(`a main andou ${atras} commit(s): juntando antes de enviar`);
    if (git(['merge', 'origin/main', '--no-edit']).status !== 0) {
      return falha(`conflito ao juntar a main; resolva, commite e rode de novo. Arquivos em conflito:\n${git(['diff', '--name-only', '--diff-filter=U']).stdout.trim()}`);
    }
  }

  log('enviando o branch (o hook roda o npm run check; leva alguns minutos)…');
  if (empurrar(branch) !== 0) return falha('o push foi recusado (o check do hook falhou?): veja a saída acima');

  // O PR: reaproveita o aberto, senão cria.
  let n = Number(gh(['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number', '--jq', '.[0].number']).stdout.trim()) || 0;
  if (n) log(`PR #${n} já existia: reaproveitando`);
  else {
    if (!opcoes.titulo || !opcoes.corpo) return falha('faltam --titulo e --corpo (arquivo com a descrição) para abrir o PR');
    const c = gh(['pr', 'create', '--base', 'main', '--head', branch, '--title', opcoes.titulo, '--body-file', opcoes.corpo]);
    n = Number(/\/pull\/(\d+)/.exec(c.stdout)?.[1]) || 0;
    if (c.status !== 0 || !n) return falha(`não consegui abrir o PR: ${(c.stderr || c.stdout).trim()}`);
    log(`PR #${n} aberto`);
  }
  if (opcoes.soPr) return { ok: true, pr: n };

  // O CI: a linha `check` precisa existir antes do --watch (senão ele volta na hora e o merge sairia com o CI rodando).
  let existe = false;
  for (let i = 0; i < TENTATIVAS_CHECK && !existe; i++) {
    existe = /^check\t/m.test(gh(['pr', 'checks', String(n)]).stdout);
    if (!existe) await dormir(6000);
  }
  if (!existe) return falha(`o CI não criou a linha "check" no PR #${n} (conflito com a main? veja o PR no GitHub)`);
  log('esperando o CI terminar…');
  gh(['pr', 'checks', String(n), '--watch']);
  const resultado = /^check\t(\w+)/m.exec(gh(['pr', 'checks', String(n)]).stdout)?.[1];
  if (resultado !== 'pass') return falha(`o CI não passou (check: ${resultado ?? 'sem resultado'}); PR #${n} aberto e branch preservado`);

  // O estado do PR: só mergeia limpo.
  let estado = null;
  for (let i = 0; i < TENTATIVAS_ESTADO; i++) {
    estado = json(gh(['pr', 'view', String(n), '--json', 'state,mergeStateStatus']));
    if (estado && estado.mergeStateStatus !== 'UNKNOWN' && estado.mergeStateStatus !== 'BLOCKED') break;
    await dormir(6000);
  }
  if (!estado || estado.state !== 'OPEN') return falha(`o PR #${n} não está aberto (${estado?.state ?? 'estado ilegível'}); nada foi mergeado`);
  if (estado.mergeStateStatus !== 'CLEAN') {
    return falha(`o PR #${n} está ${estado.mergeStateStatus} (conflito ou fora de dia com a main): junte a main, resolva e rode de novo; branch preservado`);
  }

  log('mergeando…');
  let depois = null;
  for (let i = 0; i < TENTATIVAS_MERGE; i++) {
    if (i > 0) {
      log(`o merge ainda não saiu (o GitHub calcula a mergeabilidade com atraso); tentando de novo (${i + 1}/${TENTATIVAS_MERGE})`);
      await dormir(10_000);
    }
    gh(['pr', 'merge', String(n), '--merge']);
    depois = json(gh(['pr', 'view', String(n), '--json', 'state,mergeCommit']));
    if (depois?.state !== 'OPEN') break; // MERGED, ou fechado de outro jeito: não insiste
  }
  if (depois?.state !== 'MERGED') return falha(`o merge do PR #${n} NÃO aconteceu (estado: ${depois?.state ?? 'ilegível'}); branch preservado`);
  const oid = depois.mergeCommit?.oid ?? '';
  log(`✓ PR #${n} mergeado (${oid.slice(0, 7)})`);

  // Só agora apaga o branch remoto.
  const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).stdout.trim();
  if (repo) {
    const d = gh(['api', '-X', 'DELETE', `repos/${repo}/git/refs/heads/${branch}`]);
    log(d.status === 0 ? `branch remoto ${branch} apagado` : `não consegui apagar o branch remoto (${(d.stderr || d.stdout).trim()}); apague à mão`);
  }
  const deploy = json(gh(['run', 'list', '--branch', 'main', '--limit', '1', '--json', 'status,conclusion,workflowName']))?.[0];
  if (deploy) log(`deploy: ${deploy.workflowName} ${deploy.status}${deploy.conclusion ? ` (${deploy.conclusion})` : ''}; o site atualiza em poucos minutos`);
  log('lembrete: troque de branch antes do próximo commit (git switch -c <agente>/<tarefa> origin/main)');
  return { ok: true, pr: n, merge: oid };
}

/** Lê `--chave valor` da linha de comando. */
function opcoesDaLinha(argv) {
  const pega = (nome) => {
    const i = argv.indexOf(`--${nome}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return { titulo: pega('titulo'), corpo: pega('corpo'), soPr: argv.includes('--so-pr') };
}

const euMesmo = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (euMesmo) {
  const roda = (args) => {
    const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  };
  const resultado = await publicar(
    {
      git: roda,
      gh: (args) => ghReal(args),
      empurrar: (branch) => spawnSync('git', ['push', '-u', 'origin', branch], { stdio: 'inherit' }).status ?? 1,
      dormir: (ms) => new Promise((ok) => setTimeout(ok, ms)),
      log: (l) => console.log(l),
    },
    opcoesDaLinha(process.argv.slice(2)),
  );
  process.exit(resultado.ok ? 0 : 1);
}
