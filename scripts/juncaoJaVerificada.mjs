/**
 * O hook de push precisa refazer o `npm run check` depois de uma junção com a `main`? (P224, 19/10: o laço de 10 a 25 minutos por tentativa, porque a `main` anda no meio do check e a junção refaz tudo.)
 *
 * Não, quando a junção é **pura**: a árvore do primeiro pai (a minha, já verificada aqui) + o segundo pai (a `main`, que passou nos checks dela), e **cada arquivo que difere da minha árvore veio inteiro da `main`**
 * (ou é documentação `.md`, como a regra do CI). A combinação das duas metades é testada pelo CI do PR numa máquina limpa (o `pull_request` roda sobre o merge com a `main`).
 * **Na dúvida roda o check inteiro:** arquivo mesclado à mão ou auto-mesclado dos dois lados (o resultado não é nem o meu nem o da `main`: os locales, por exemplo), primeiro pai nunca verificado,
 * segundo pai fora da `main`, commit que não é de junção. Sem CI (o Actions sem cota, `--sem-ci`), `CYBERMECH_CHECK_COMPLETO=1` no hook desliga este atalho.
 *
 * Uso no hook: `node scripts/juncaoJaVerificada.mjs <sha enviado>` (sai com 0 = pode pular; 1 = rode o check). Nunca lança.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ehDocumento = (caminho) => /\.md$/i.test(caminho);

/**
 * A decisão, pura. `diferentes` = os arquivos que diferem entre o primeiro pai e a junção: `{ caminho, naJuncao, noSegundoPai }`, onde cada lado é `"modo blob"` ou `null` (arquivo ausente).
 */
export function decidirJuncao({ ehJuncao, primeiroPaiVerificado, segundoPaiNaMain, diferentes }) {
  if (!ehJuncao) return { pular: false, motivo: 'não é um commit de junção (sem segundo pai): roda o check' };
  if (!primeiroPaiVerificado) return { pular: false, motivo: 'a árvore do primeiro pai nunca passou no check aqui: roda o check' };
  if (!segundoPaiNaMain) return { pular: false, motivo: 'o segundo pai não está na origin/main (não veio da main): roda o check' };
  for (const d of diferentes) {
    if (ehDocumento(d.caminho)) continue;
    if (d.naJuncao === d.noSegundoPai) continue;
    return { pular: false, motivo: `${d.caminho} não é nem o meu nem o da main (mesclado à mão ou dos dois lados): roda o check` };
  }
  return { pular: true, motivo: `junção da main sobre uma árvore já verificada (${diferentes.length} arquivo(s) vieram inteiros da main ou são .md): o CI do PR testa a combinação` };
}

const rodar = (args) => {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { status: r.status ?? 1, saida: (r.stdout ?? '').replace(/\n$/, '') };
};

/** `caminho -> "modo blob"` de uma árvore inteira. */
function arquivosDaArvore(commit, executar) {
  const r = executar(['ls-tree', '-r', '-z', commit]);
  const mapa = new Map();
  if (r.status !== 0) return mapa;
  for (const entrada of r.saida.split('\0').filter(Boolean)) {
    const tab = entrada.indexOf('\t');
    const [modo, , blob] = entrada.slice(0, tab).split(' ');
    mapa.set(entrada.slice(tab + 1), `${modo} ${blob}`);
  }
  return mapa;
}

/**
 * Junta os fatos do git e decide (`executar` e `existe` são injetáveis para teste). Nunca lança: qualquer erro vira "roda o check".
 * `raiz` é a raiz do repositório (onde mora `.tmp/check-ok/`).
 */
export function avaliarJuncao(sha, { raiz, executar = rodar, existe = existsSync } = {}) {
  try {
    const p1 = executar(['rev-parse', '--verify', '--quiet', `${sha}^1`]);
    const p2 = executar(['rev-parse', '--verify', '--quiet', `${sha}^2`]);
    if (p1.status !== 0 || p2.status !== 0 || !p1.saida || !p2.saida) return decidirJuncao({ ehJuncao: false, primeiroPaiVerificado: false, segundoPaiNaMain: false, diferentes: [] });
    const arvoreP1 = executar(['rev-parse', `${p1.saida}^{tree}`]).saida;
    const primeiroPaiVerificado = !!arvoreP1 && existe(join(raiz, '.tmp', 'check-ok', arvoreP1));
    const segundoPaiNaMain = executar(['merge-base', '--is-ancestor', p2.saida, 'origin/main']).status === 0;
    if (!primeiroPaiVerificado || !segundoPaiNaMain) return decidirJuncao({ ehJuncao: true, primeiroPaiVerificado, segundoPaiNaMain, diferentes: [] });
    const nomes = executar(['diff', '--name-only', '-z', '--no-renames', p1.saida, sha]);
    if (nomes.status !== 0) return { pular: false, motivo: 'não consegui listar o que a junção mudou: roda o check' };
    const naJuncao = arquivosDaArvore(sha, executar);
    const noSegundoPai = arquivosDaArvore(p2.saida, executar);
    const diferentes = nomes.saida
      .split('\0')
      .filter(Boolean)
      .map((caminho) => ({ caminho, naJuncao: naJuncao.get(caminho) ?? null, noSegundoPai: noSegundoPai.get(caminho) ?? null }));
    return decidirJuncao({ ehJuncao: true, primeiroPaiVerificado, segundoPaiNaMain, diferentes });
  } catch (erro) {
    return { pular: false, motivo: `não consegui conferir (${String(erro?.message ?? erro).slice(0, 80)}): roda o check` };
  }
}

if (process.argv[1]?.endsWith('juncaoJaVerificada.mjs')) {
  const sha = process.argv[2] ?? '';
  const raiz = rodar(['rev-parse', '--show-toplevel']).saida;
  const d = sha && raiz ? avaliarJuncao(sha, { raiz }) : { pular: false, motivo: 'sem commit ou fora de um repositório: roda o check' };
  console.log(`${d.pular ? '✔' : '▶'} ${d.motivo}`);
  process.exit(d.pular ? 0 : 1);
}
