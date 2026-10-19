import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * O hook de push não repete o `npm run check` na mesma árvore (AGENTS.md, regra 19c). O perigo é o inverso do que se quer: o portão pular um check que devia rodar.
 * Por isso estes testes provam as bordas: só pula com a árvore limpa e igual à do HEAD, só depois de um check que passou, e qualquer mudança roda de novo.
 * Repositório temporário em `.tmp/` (G15), `git` sem as variáveis `GIT_*` do hook (senão ele mexeria no repositório de quem está empurrando) e um `npm` falso que só anota a chamada.
 */
const HOOK = resolve('.githooks/pre-push');
const RAIZ = resolve('.tmp', `teste-hook-${process.pid}`);
const BIN = join(RAIZ, 'bin');
const REPO = join(RAIZ, 'repo');
const LOG = join(RAIZ, 'npm.log');
const ZEROS = '0'.repeat(40);

const ambiente = (extra: Record<string, string> = {}) => {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('GIT_')) delete env[k];
  return { ...env, PATH: `${BIN}${delimiter}${process.env.PATH ?? ''}`, NPM_LOG: LOG, ...extra } as NodeJS.ProcessEnv;
};
const git = (...args: string[]) => {
  const r = spawnSync('git', ['-c', 'user.name=teste', '-c', 'user.email=teste@teste.invalido', '-c', 'commit.gpgsign=false', ...args], { cwd: REPO, encoding: 'utf8', env: ambiente() });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const commitar = (arquivo: string, texto: string) => {
  writeFileSync(join(REPO, arquivo), texto);
  git('add', '-A');
  git('commit', '-q', '-m', `muda ${arquivo}`);
  return git('rev-parse', 'HEAD');
};
/** Roda o hook como o Git roda: com `local_ref local_sha remote_ref remote_sha` na entrada. */
const empurrar = (sha: string, ref = 'refs/heads/claude/tarefa', npmSai = '0') => {
  const r = spawnSync('bash', [HOOK], { cwd: REPO, encoding: 'utf8', env: ambiente({ NPM_SAI: npmSai }), input: `refs/heads/claude/tarefa ${sha} ${ref} ${ZEROS}\n` });
  return { status: r.status, saida: `${r.stdout}${r.stderr}` };
};
const chamadasDoNpm = () => (existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean).length : 0);
const arvoresGuardadas = () => (existsSync(join(REPO, '.tmp', 'check-ok')) ? readdirSync(join(REPO, '.tmp', 'check-ok')) : []);

// O atualizador de produção (a tarefa agendada do Windows) roda `server/` e `shared/` num ambiente SEM `bash` no PATH: o `spawnSync('bash')` devolvia 127 e **cada atualização era revertida** (19/10: o site e o
// servidor ficaram 2 h sem publicar). O hook só roda sob o Bash do Git (é o que o `git push` usa), então sem bash não há o que testar aqui: a suíte pula (o `check` de quem empurra roda com bash e a testa).
const temBash = spawnSync('bash', ['-c', 'exit 0']).status === 0;

beforeAll(() => {
  if (!temBash) return;
  rmSync(RAIZ, { recursive: true, force: true });
  mkdirSync(BIN, { recursive: true });
  mkdirSync(REPO, { recursive: true });
  const npm = join(BIN, 'npm');
  writeFileSync(npm, '#!/usr/bin/env bash\necho "npm $*" >> "$NPM_LOG"\nexit "${NPM_SAI:-0}"\n');
  chmodSync(npm, 0o755);
  git('init', '-q', '-b', 'claude/tarefa');
  writeFileSync(join(REPO, '.gitignore'), '.tmp/\n');
  commitar('a.txt', 'um');
});
afterAll(() => rmSync(RAIZ, { recursive: true, force: true }));

describe.skipIf(!temBash)('hook de push: o check não se repete na mesma árvore (regra 19c)', () => {
  it('a primeira vez roda o check e guarda a árvore; a segunda, com a mesma árvore, não roda', () => {
    const sha = git('rev-parse', 'HEAD');
    expect(empurrar(sha).status).toBe(0);
    expect(chamadasDoNpm()).toBe(1);
    const arvore = git('rev-parse', 'HEAD^{tree}');
    expect(arvoresGuardadas()).toContain(arvore);
    const de_novo = empurrar(sha);
    expect(de_novo.status).toBe(0);
    expect(chamadasDoNpm(), 'o check NÃO rodou de novo').toBe(1);
    expect(de_novo.saida).toContain('já passou no npm run check');
  });

  it('um commit novo (outra árvore) roda o check de novo, e uma junção com a main também seria outra árvore', () => {
    const antes = chamadasDoNpm();
    const sha = commitar('b.txt', 'dois');
    expect(empurrar(sha).status).toBe(0);
    expect(chamadasDoNpm()).toBe(antes + 1);
  });

  it('check que FALHA bloqueia o push e não guarda nada: o retry roda o check de novo', () => {
    const sha = commitar('c.txt', 'tres');
    const antes = chamadasDoNpm();
    const falhou = empurrar(sha, 'refs/heads/claude/tarefa', '1');
    expect(falhou.status).toBe(1);
    expect(falhou.saida).toContain('PUSH BLOQUEADO');
    expect(arvoresGuardadas()).not.toContain(git('rev-parse', 'HEAD^{tree}'));
    expect(empurrar(sha).status).toBe(0);
    expect(chamadasDoNpm(), 'rodou na falha e rodou no retry').toBe(antes + 2);
  });

  it('árvore suja (algo por commitar) nunca pula o check, nem guarda: o check olharia outra coisa que a do commit', () => {
    const sha = commitar('d.txt', 'quatro');
    expect(empurrar(sha).status).toBe(0); // guarda a árvore limpa
    writeFileSync(join(REPO, 'd.txt'), 'quatro, mas editado e sem commit');
    const antes = chamadasDoNpm();
    expect(empurrar(sha).status).toBe(0);
    expect(chamadasDoNpm(), 'com a árvore suja o check roda mesmo com a árvore do commit já guardada').toBe(antes + 1);
    git('checkout', '--', 'd.txt');
  });

  it('arquivo novo ainda não commitado também conta como sujo', () => {
    const sha = commitar('e.txt', 'cinco');
    expect(empurrar(sha).status).toBe(0);
    writeFileSync(join(REPO, 'novo-sem-commit.txt'), 'x');
    const antes = chamadasDoNpm();
    expect(empurrar(sha).status).toBe(0);
    expect(chamadasDoNpm()).toBe(antes + 1);
    rmSync(join(REPO, 'novo-sem-commit.txt'));
  });

  it('empurrar um commit que não é o HEAD (outra árvore que a do check) nunca pula nem guarda', () => {
    const velho = git('rev-parse', 'HEAD');
    commitar('f.txt', 'seis');
    const antes = chamadasDoNpm();
    const guardadas = arvoresGuardadas().length;
    expect(empurrar(velho).status).toBe(0);
    expect(chamadasDoNpm()).toBe(antes + 1);
    expect(arvoresGuardadas().length, 'não guardou a árvore de um commit que o check não olhou').toBe(guardadas);
    expect(empurrar(velho).status).toBe(0);
    expect(chamadasDoNpm(), 'e roda de novo').toBe(antes + 2);
  });

  it('push direto na main continua bloqueado, sem rodar o check', () => {
    const antes = chamadasDoNpm();
    const r = empurrar(git('rev-parse', 'HEAD'), 'refs/heads/main');
    expect(r.status).toBe(1);
    expect(r.saida).toContain('push direto na main');
    expect(chamadasDoNpm()).toBe(antes);
  });

  it('só apagar um branch remoto (sha zero, nenhum commit sobe) não roda check e não guarda árvore', () => {
    const antes = chamadasDoNpm();
    const guardadas = arvoresGuardadas().length;
    const r = spawnSync('bash', [HOOK], { cwd: REPO, encoding: 'utf8', env: ambiente(), input: `(delete) ${ZEROS} refs/heads/claude/velho ${'1'.repeat(40)}\n` });
    expect(r.status).toBe(0);
    expect(`${r.stdout}${r.stderr}`).toContain('só apaga branch remoto');
    expect(chamadasDoNpm()).toBe(antes);
    expect(arvoresGuardadas().length).toBe(guardadas);
  });
});
