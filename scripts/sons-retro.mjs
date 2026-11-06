/**
 * O kit de sons retrô (P316): gera, por código, candidatos de som no espírito dos videogames e da música eletrônica dos anos 80 e 90 e os grava como `RETRO_<som>_<estilo>.wav`
 * na pasta de referências do Estúdio (`.tmp/SOUNDS/ARMAS` por padrão). Na aba SONS do Estúdio eles aparecem na lista de referências: o Comandante ouve, corta, trata e atribui a uma
 * arma, como qualquer outro. Nada de rede, nada de chave, nada de amostra de ninguém (`scripts/retroSynthLib.mjs`).
 *
 *   npm run sons-retro                          # grava os candidatos em .tmp/SOUNDS/ARMAS (as duas leituras: 8bit e rave)
 *   npm run sons-retro -- --saida <pasta>       # em outra pasta (dentro do projeto: regra G15)
 *   npm run sons-retro -- --so blaster,cannon   # só estes sons
 *   npm run sons-retro -- --estilo 8bit         # só uma leitura
 *   npm run sons-retro -- --listar              # só mostra a tabela, sem gravar
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emWav, ESTILOS, nomeDoArquivo, RECEITAS, renderizar, TAXA } from './retroSynthLib.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const tem = (n) => args.includes(`--${n}`);
const valor = (n) => (tem(n) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const lista = (n) => valor(n)?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;

const saida = resolve(valor('saida') ?? join(raiz, '.tmp/SOUNDS/ARMAS'));
// G15 (regra do dono): nada salvo fora da pasta do projeto.
const fora = relative(raiz, saida);
if (fora.startsWith('..') || isAbsolute(fora)) throw new Error(`a pasta de saída tem de ficar dentro do projeto (G15): ${saida}`);
const so = lista('so');
const estilos = lista('estilo') ?? ESTILOS;
for (const e of estilos) if (!ESTILOS.includes(e)) throw new Error(`estilo desconhecido: ${e} (use ${ESTILOS.join(' ou ')})`);
const receitas = RECEITAS.filter((r) => !so || so.includes(r.id));
if (so) for (const id of so) if (!RECEITAS.some((r) => r.id === id)) throw new Error(`som desconhecido: ${id}`);

if (!tem('listar')) mkdirSync(saida, { recursive: true });
let total = 0;
console.log(`${'som'.padEnd(18)}${'arma'.padEnd(12)}${'estilo'.padEnd(8)}${'dur'.padEnd(8)}uso`);
for (const r of receitas) {
  for (const e of estilos) {
    const x = renderizar(r, e);
    if (!tem('listar')) writeFileSync(join(saida, nomeDoArquivo(r, e)), emWav(x));
    console.log(`${r.id.padEnd(18)}${(r.arma ?? '-').padEnd(12)}${e.padEnd(8)}${`${(x.length / TAXA).toFixed(2)} s`.padEnd(8)}${r.uso}`);
    total++;
  }
}
console.log(tem('listar') ? `\n${total} sons (nada gravado)` : `\n${total} sons gravados em ${saida}\nAbra o Estúdio (npm run estudio), aba SONS: eles aparecem na lista de referências com o prefixo RETRO_.`);
