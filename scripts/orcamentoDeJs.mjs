/**
 * O ORÇAMENTO DE JAVASCRIPT por fase (P180, 17/10): o teto de 500 KB gzip somava **todo** o JS do pacote, então cada mapa novo empurrava o download de quem joga os outros. Agora o `smoke`
 * mede **dois** orçamentos:
 *
 *  - **De partida:** o que todo jogador baixa para abrir o jogo (o `index`, tudo o que ele nomeia e o que esses pedaços importam de forma **estática**). O teto continua 500 KB gzip: a
 *    regra de sempre (`JS_PARTIDA_KB`).
 *  - **Sob demanda:** os pedaços que só baixa quem entra numa fase ou num recurso (carregados por `import()` de dentro do jogo: o Draga-01, e daqui para a frente o mapa da Amazônia).
 *    Cada pedaço tem o seu teto (`JS_SOB_DEMANDA_KB`): código de uma fase não pesa no download de quem joga outra.
 *
 * A classificação é por **leitura do código gerado** (sem plugin): o que o `index` cita pelo nome é de partida; o que só um pedaço de partida carrega com `import()` é sob demanda.
 */

/** O teto, em KB gzip, de tudo o que é baixado para abrir o jogo (o mesmo de sempre). */
export const JS_PARTIDA_KB = 500;
/** O teto, em KB gzip, de cada pedaço sob demanda. */
export const JS_SOB_DEMANDA_KB = 150;

/** Todo nome de pedaço citado no código (`"./x.js"`): imports estáticos, `import()` e a lista de pré-carga do Vite. */
export function nomesCitados(codigo) {
  const nomes = new Set();
  for (const m of codigo.matchAll(/["']\.\/([\w.-]+\.js)["']/g)) nomes.add(m[1]);
  return [...nomes];
}

/** Só os imports **estáticos** (`import"./x.js"`, `import{a}from"./x.js"`, `export*from"./x.js"`); o `import("./x.js")` tem parêntese e fica de fora. */
export function importsEstaticos(codigo) {
  const nomes = new Set();
  for (const m of codigo.matchAll(/(?:\bimport|\bfrom)\s*["']\.\/([\w.-]+\.js)["']/g)) nomes.add(m[1]);
  return [...nomes];
}

/** O nome do pedaço de entrada (o `<script type="module" src="./assets/index-xxx.js">` do `index.html`), ou `null`. */
export function entradaDoHtml(html) {
  const m = html.match(/<script[^>]*type=["']module["'][^>]*src=["']\.?\/?assets\/([\w.-]+\.js)["']/) ?? html.match(/<script[^>]*src=["']\.?\/?assets\/([\w.-]+\.js)["'][^>]*type=["']module["']/);
  return m ? m[1] : null;
}

/**
 * Quais pedaços são **de partida**: a entrada, tudo o que ela cita pelo nome (o jogo principal que ela carrega e a pré-carga), e o fecho dos imports estáticos de cada um. O resto
 * (carregado só de dentro do jogo, por `import()`) é sob demanda. `codigos`: nome do pedaço → código.
 */
export function chunksDePartida(codigos, entrada) {
  const de = new Set();
  const fila = [];
  const poe = (n) => {
    if (codigos.has(n) && !de.has(n)) {
      de.add(n);
      fila.push(n);
    }
  };
  poe(entrada);
  for (const n of nomesCitados(codigos.get(entrada) ?? '')) poe(n);
  while (fila.length) {
    const n = fila.pop();
    for (const e of importsEstaticos(codigos.get(n))) poe(e);
  }
  return de;
}
