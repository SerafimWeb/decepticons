/**
 * A audiência (P188) para a landing estática: a landing não passa por bundler, mas a classificação da origem e a descrição da visita têm de ser **as mesmas** do jogo (um valor diferente
 * entre as duas páginas deixaria o painel do dono dizendo duas coisas para a mesma pessoa). Em vez de copiar a lógica à mão, o build da landing pega os dois arquivos TypeScript
 * (`shared/net/audiencia.ts` e `client/src/core/Audiencia.ts`), os transpila e os embute como JavaScript puro, numa função isolada (os nomes internos não colidem com os da página).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transformWithOxc } from 'vite';

const ARQUIVOS = ['shared/net/audiencia.ts', 'client/src/core/Audiencia.ts'];

/** O código como texto: uma expressão `(() => { ...; return { Audiencia, lerAmbiente, armazensDoNavegador }; })()`. */
export async function audienciaParaLanding() {
  const partes = [];
  for (const arquivo of ARQUIVOS) {
    const fonte = readFileSync(resolve(arquivo), 'utf8');
    const { code } = await transformWithOxc(fonte, arquivo, { lang: 'ts' });
    partes.push(
      code
        .replace(/\/\*[\s\S]*?\*\//g, '') // os comentários de bloco não precisam ir para a página
        .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm, '')
        .replace(/^export\s+(?=(const|function|class|let|var)\b)/gm, '')
        .replace(/^export\s*\{[^}]*\};?[ \t]*$/gm, ''),
    );
  }
  return `(() => {\n${partes.join('\n')}\nreturn { Audiencia, lerAmbiente, armazensDoNavegador };\n})()`;
}
