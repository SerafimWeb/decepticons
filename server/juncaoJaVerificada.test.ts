import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avaliarJuncao, decidirJuncao } from '../scripts/juncaoJaVerificada.mjs';
import { BASH, temBash } from './ajudaBash';

/**
 * O hook pula o check depois de uma junção PURA com a main (P224). O perigo é pular o que devia rodar, então cada condição tem o seu teste e qualquer dúvida roda o check:
 * (1) a decisão pura; (2) o git de verdade num repositório temporário (em `.tmp/`, G15, sem as variáveis `GIT_*` do hook); (3) o hook de ponta a ponta, com um `npm` falso.
 */
const meu = '100644 aaaa';
const da_main = '100644 bbbb';
const ok = { ehJuncao: true, primeiroPaiVerificado: true, segundoPaiNaMain: true };

describe('decidirJuncao: só pula com tudo junto', () => {
  it('arquivos que vieram inteiros da main, ou que não mudaram, ou .md: pula', () => {
    const d = decidirJuncao({
      ...ok,
      diferentes: [
        { caminho: 'client/src/a.ts', naJuncao: da_main, noSegundoPai: da_main }, // veio inteiro da main
        { caminho: 'server/velho.ts', naJuncao: null, noSegundoPai: null }, // apagado dos dois lados
        { caminho: '.decepticons/ESTADO_ATUAL.md', naJuncao: meu, noSegundoPai: da_main }, // documentação mesclada à mão
      ],
    });
    expect(d.pular).toBe(true);
    expect(d.motivo).toContain('3 arquivo(s)');
  });

  it('um arquivo que não é nem o meu nem o da main (mesclado dos dois lados): roda o check e diz qual', () => {
    const d = decidirJuncao({ ...ok, diferentes: [{ caminho: 'client/public/locales/en.json', naJuncao: '100644 cccc', noSegundoPai: da_main }] });
    expect(d.pular).toBe(false);
    expect(d.motivo).toContain('client/public/locales/en.json');
  });

  it('um arquivo de código apagado pela junção mas presente na main, ou o contrário: roda o check', () => {
    expect(decidirJuncao({ ...ok, diferentes: [{ caminho: 'a.ts', naJuncao: null, noSegundoPai: da_main }] }).pular).toBe(false);
    expect(decidirJuncao({ ...ok, diferentes: [{ caminho: 'a.ts', naJuncao: meu, noSegundoPai: null }] }).pular).toBe(false);
  });

  it('não é junção, primeiro pai nunca verificado, ou segundo pai fora da main: roda o check, mesmo sem arquivo diferente', () => {
    expect(decidirJuncao({ ...ok, ehJuncao: false, diferentes: [] }).pular).toBe(false);
    expect(decidirJuncao({ ...ok, primeiroPaiVerificado: false, diferentes: [] }).pular).toBe(false);
    expect(decidirJuncao({ ...ok, segundoPaiNaMain: false, diferentes: [] }).pular).toBe(false);
  });

  it('só .md não basta se algo não for .md e for dos dois lados: um arquivo ruim reprova o conjunto', () => {
    const d = decidirJuncao({ ...ok, diferentes: [{ caminho: 'a.md', naJuncao: meu, noSegundoPai: da_main }, { caminho: 'b.ts', naJuncao: meu, noSegundoPai: da_main }] });
    expect(d.pular).toBe(false);
    expect(d.motivo).toContain('b.ts');
  });
});

const RAIZ = resolve('.tmp', `teste-juncao-${process.pid}`);
const REPO = join(RAIZ, 'repo');
const BIN = join(RAIZ, 'bin');
const LOG = join(RAIZ, 'npm.log');
const ambiente = (extra: Record<string, string> = {}) => {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('GIT_')) delete env[k];
  // O `publicar --sem-ci` liga esta variável no ambiente do push (e o check roda dentro dele): sem apagá-la, o teste do atalho herdava o "check completo" e reprovava **todo** push com --sem-ci (19/10). O caso que a quer a passa em `extra`.
  delete env.CYBERMECH_CHECK_COMPLETO;
  return { ...env, PATH: `${BIN}${delimiter}${process.env.PATH ?? ''}`, NPM_LOG: LOG, ...extra } as NodeJS.ProcessEnv;
};
const git = (...args: string[]) => {
  const r = spawnSync('git', ['-c', 'user.name=teste', '-c', 'user.email=teste@teste.invalido', '-c', 'commit.gpgsign=false', ...args], { cwd: REPO, encoding: 'utf8', env: ambiente() });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const executar = (args: string[]) => {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8', env: ambiente(), maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status ?? 1, saida: (r.stdout ?? '').replace(/\n$/, '') };
};
const escrever = (arquivo: string, texto: string) => {
  mkdirSync(join(REPO, ...arquivo.split('/').slice(0, -1)), { recursive: true });
  writeFileSync(join(REPO, arquivo), texto);
};
const commitar = (msg: string) => {
  git('add', '-A');
  git('commit', '-q', '-m', msg);
};
const linhas = (n: number, troca: Record<number, string> = {}) => Array.from({ length: n }, (_, i) => troca[i + 1] ?? `linha ${i + 1}`).join('\n') + '\n';
/** Marca a árvore de um commit como "passou no check aqui" (o que o hook faz depois de um check verde). */
const verificar = (commit: string) => {
  mkdirSync(join(REPO, '.tmp', 'check-ok'), { recursive: true });
  writeFileSync(join(REPO, '.tmp', 'check-ok', git('rev-parse', `${commit}^{tree}`)), 'ok\n');
};
const marcarOrigemMain = (commit: string) => git('update-ref', 'refs/remotes/origin/main', commit);
const avaliar = () => avaliarJuncao(git('rev-parse', 'HEAD'), { raiz: REPO, executar });

/** Recomeça com um repositório novo: main com a base (e o que `naBase` acrescentar), `origin/main` na base, e um branch `feat` saindo dela. */
function cenario(naBase?: () => void) {
  rmSync(REPO, { recursive: true, force: true });
  mkdirSync(REPO, { recursive: true });
  git('init', '-q', '-b', 'main');
  writeFileSync(join(REPO, '.gitignore'), '.tmp/\n');
  escrever('grande.ts', linhas(40));
  escrever('b.ts', 'b original\n');
  escrever('notas.md', 'notas\n');
  escrever('velho.ts', 'velho\n');
  naBase?.();
  commitar('base');
  marcarOrigemMain(git('rev-parse', 'HEAD'));
  git('checkout', '-q', '-b', 'feat');
}
beforeAll(() => {
  rmSync(RAIZ, { recursive: true, force: true });
  mkdirSync(BIN, { recursive: true });
  mkdirSync(REPO, { recursive: true });
});
afterAll(() => rmSync(RAIZ, { recursive: true, force: true }));

describe('avaliarJuncao: o git de verdade', () => {
  it('a main mexeu em outros arquivos (e numa nota): junção pura sobre árvore verificada, pula', () => {
    cenario();
    escrever('grande.ts', linhas(40, { 5: 'minha mudança' }));
    commitar('minha mudança');
    verificar(git('rev-parse', 'HEAD'));
    git('checkout', '-q', 'main');
    escrever('b.ts', 'b da main\n');
    escrever('notas.md', 'notas da main\n');
    git('rm', '-q', 'velho.ts');
    commitar('mudança da main');
    marcarOrigemMain(git('rev-parse', 'HEAD'));
    git('checkout', '-q', 'feat');
    git('merge', '-q', 'main', '--no-edit');
    const d = avaliar();
    expect(d.motivo).toContain('junção da main');
    expect(d.pular).toBe(true);
  });

  it('a main e eu mexemos no MESMO arquivo em lugares diferentes (a junção automática dá um arquivo que não é de ninguém): roda o check', () => {
    cenario();
    escrever('grande.ts', linhas(40, { 35: 'minha mudança lá embaixo' }));
    commitar('minha mudança');
    verificar(git('rev-parse', 'HEAD'));
    git('checkout', '-q', 'main');
    escrever('grande.ts', linhas(40, { 2: 'mudança da main lá em cima' }));
    commitar('mudança da main');
    marcarOrigemMain(git('rev-parse', 'HEAD'));
    git('checkout', '-q', 'feat');
    git('merge', '-q', 'main', '--no-edit');
    const d = avaliar();
    expect(d.pular).toBe(false);
    expect(d.motivo).toContain('grande.ts');
  });

  it('mesma coisa, mas o arquivo dos dois lados é .md: documentação não exige o check, pula', () => {
    cenario();
    escrever('notas.md', 'notas\n\nminha seção\n');
    commitar('minha nota');
    verificar(git('rev-parse', 'HEAD'));
    git('checkout', '-q', 'main');
    escrever('notas.md', 'sessão da main\n\nnotas\n');
    commitar('nota da main');
    marcarOrigemMain(git('rev-parse', 'HEAD'));
    git('checkout', '-q', 'feat');
    git('merge', '-q', 'main', '--no-edit');
    expect(avaliar().pular).toBe(true);
  });

  it('o meu lado nunca passou no check: roda o check (não há o que a junção herdar)', () => {
    cenario();
    escrever('grande.ts', linhas(40, { 5: 'minha mudança' }));
    commitar('minha mudança'); // sem verificar()
    git('checkout', '-q', 'main');
    escrever('b.ts', 'b da main\n');
    commitar('mudança da main');
    marcarOrigemMain(git('rev-parse', 'HEAD'));
    git('checkout', '-q', 'feat');
    git('merge', '-q', 'main', '--no-edit');
    const d = avaliar();
    expect(d.pular).toBe(false);
    expect(d.motivo).toContain('nunca passou');
  });

  it('o segundo pai não está na origin/main (uma junção com outro branch): roda o check', () => {
    cenario();
    escrever('grande.ts', linhas(40, { 5: 'minha mudança' }));
    commitar('minha mudança');
    verificar(git('rev-parse', 'HEAD'));
    git('checkout', '-q', '-b', 'outro', 'main');
    escrever('b.ts', 'b de outro branch\n');
    commitar('outro branch'); // não vai para a origin/main
    git('checkout', '-q', 'feat');
    git('merge', '-q', 'outro', '--no-edit');
    const d = avaliar();
    expect(d.pular).toBe(false);
    expect(d.motivo).toContain('origin/main');
    git('branch', '-q', '-D', 'outro');
  });

  it('um commit comum (não é junção): roda o check', () => {
    cenario();
    escrever('b.ts', 'b meu\n');
    commitar('commit comum');
    verificar(git('rev-parse', 'HEAD'));
    const d = avaliar();
    expect(d.pular).toBe(false);
    expect(d.motivo).toContain('não é um commit de junção');
  });

  it('qualquer erro do git vira "roda o check", sem lançar', () => {
    const d = avaliarJuncao('qualquer', {
      raiz: REPO,
      executar: () => {
        throw new Error('git quebrou');
      },
    });
    expect(d.pular).toBe(false);
    expect(d.motivo).toContain('git quebrou');
  });
});

describe.skipIf(!temBash)('o hook de push com a junção pura (de ponta a ponta, com npm falso)', () => {
  const HOOK = resolve('.githooks/pre-push');
  const ZEROS = '0'.repeat(40);
  const chamadasDoNpm = () => (existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean).length : 0);
  const empurrar = (sha: string, extra: Record<string, string> = {}) => {
    const r = spawnSync(BASH, [HOOK], { cwd: REPO, encoding: 'utf8', env: ambiente({ NPM_SAI: '0', ...extra }), input: `refs/heads/feat ${sha} refs/heads/feat ${ZEROS}\n` });
    return { status: r.status, saida: `${r.stdout}${r.stderr}` };
  };
  const copiarScriptDoHook = () => {
    mkdirSync(join(REPO, 'scripts'), { recursive: true });
    copyFileSync(resolve('scripts/juncaoJaVerificada.mjs'), join(REPO, 'scripts', 'juncaoJaVerificada.mjs'));
  };
  beforeAll(() => {
    const npm = join(BIN, 'npm');
    writeFileSync(npm, '#!/usr/bin/env bash\necho "npm $*" >> "$NPM_LOG"\nexit "${NPM_SAI:-0}"\n');
    chmodSync(npm, 0o755);
  });

  /** Um cenário completo até a junção: o primeiro push roda o check (guarda a árvore); a main anda; a junção é o que vai para o hook. */
  function ateAJuncao() {
    cenario(copiarScriptDoHook);
    escrever('grande.ts', linhas(40, { 5: 'minha mudança' }));
    commitar('minha mudança');
    rmSync(LOG, { force: true });
    expect(empurrar(git('rev-parse', 'HEAD')).status).toBe(0); // o check roda uma vez e guarda a árvore
    expect(chamadasDoNpm()).toBe(1);
    git('checkout', '-q', 'main');
    escrever('b.ts', 'b da main\n');
    commitar('mudança da main');
    marcarOrigemMain(git('rev-parse', 'HEAD'));
    git('checkout', '-q', 'feat');
    git('merge', '-q', 'main', '--no-edit');
    return git('rev-parse', 'HEAD');
  }

  it('a junção pura da main NÃO refaz o check, e a árvore da junção também fica guardada', () => {
    const sha = ateAJuncao();
    const r = empurrar(sha);
    expect(r.status).toBe(0);
    expect(r.saida).toContain('junção da main sobre uma árvore já verificada');
    expect(chamadasDoNpm(), 'o npm run check não rodou de novo').toBe(1);
    expect(existsSync(join(REPO, '.tmp', 'check-ok', git('rev-parse', 'HEAD^{tree}')))).toBe(true);
  });

  it('CYBERMECH_CHECK_COMPLETO=1 (o Actions parado, publicar --sem-ci) desliga o atalho: o check roda', () => {
    const sha = ateAJuncao();
    const r = empurrar(sha, { CYBERMECH_CHECK_COMPLETO: '1' });
    expect(r.status).toBe(0);
    expect(chamadasDoNpm(), 'o check rodou na junção').toBe(2);
  });

  it('a junção com um arquivo que não é de ninguém roda o check, e se o check falhar o push é bloqueado', () => {
    cenario(copiarScriptDoHook);
    escrever('grande.ts', linhas(40, { 35: 'minha mudança lá embaixo' }));
    commitar('minha mudança');
    rmSync(LOG, { force: true });
    expect(empurrar(git('rev-parse', 'HEAD')).status).toBe(0);
    git('checkout', '-q', 'main');
    escrever('grande.ts', linhas(40, { 2: 'mudança da main lá em cima' }));
    commitar('mudança da main');
    marcarOrigemMain(git('rev-parse', 'HEAD'));
    git('checkout', '-q', 'feat');
    git('merge', '-q', 'main', '--no-edit');
    const r = empurrar(git('rev-parse', 'HEAD'), { NPM_SAI: '1' });
    expect(r.status, 'o check rodou (falso, falhando) e bloqueou').toBe(1);
    expect(chamadasDoNpm()).toBe(2);
  });
});
