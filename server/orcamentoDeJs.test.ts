import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chunksDePartida, entradaDoHtml, importsEstaticos, JS_PARTIDA_KB, JS_SOB_DEMANDA_KB, nomesCitados } from '../scripts/orcamentoDeJs.mjs';

describe('o orçamento de JS por fase (P180): o que todo jogador baixa e o que só baixa quem entra na fase', () => {
  it('os tetos: o de partida é o de sempre (500 KB gzip) e cada pedaço sob demanda tem o dele', () => {
    expect(JS_PARTIDA_KB).toBe(500);
    expect(JS_SOB_DEMANDA_KB).toBeGreaterThan(0);
    expect(JS_SOB_DEMANDA_KB).toBeLessThan(JS_PARTIDA_KB);
  });

  it('lê os nomes citados: import estático, import() e a lista de pré-carga do Vite', () => {
    const codigo = 'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./Game-A.js","./helper-B.js"])))=>i.map(i=>d[i]);import{n as e}from"./helper-B.js";import"./efeito-C.js";const x=()=>import("./Demo-D.js");';
    expect(nomesCitados(codigo).sort()).toEqual(['Game-A.js', 'Demo-D.js', 'efeito-C.js', 'helper-B.js'].sort());
  });

  it('separa o import estático do import() (o parêntese): só o estático entra no fecho', () => {
    const codigo = 'import{n as e}from"./helper-B.js";import"./efeito-C.js";export*from"./todos-E.js";const x=()=>import("./Demo-D.js");const y=import ("./Outro-F.js");';
    expect(importsEstaticos(codigo).sort()).toEqual(['efeito-C.js', 'helper-B.js', 'todos-E.js']);
  });

  it('acha a entrada no index.html, com o script em qualquer ordem de atributos', () => {
    expect(entradaDoHtml('<script type="module" crossorigin src="./assets/index-X1.js"></script>')).toBe('index-X1.js');
    expect(entradaDoHtml('<script crossorigin src="/assets/index-X2.js" type="module"></script>')).toBe('index-X2.js');
    expect(entradaDoHtml('<html><body>sem script</body></html>')).toBeNull();
  });

  it('de partida é a entrada, o que ela cita e o fecho dos imports estáticos; o que só o jogo carrega com import() é sob demanda', () => {
    const codigos = new Map<string, string>([
      ['index.js', 'import{a}from"./helper.js";const m=["./Game.js","./helper.js"];const g=()=>import("./Game.js");'],
      ['helper.js', 'export const a=1;'],
      ['Game.js', 'import{r}from"./rapier.js";const d=()=>import("./WalkerDemo.js");const o=()=>import("./Amazonia.js");'],
      ['rapier.js', 'import"./wasm-glue.js";export const r=1;'],
      ['wasm-glue.js', 'export const w=1;'],
      ['WalkerDemo.js', 'import{x}from"./Game.js";export const d=1;'],
      ['Amazonia.js', 'import{x}from"./Game.js";export const m=1;'],
    ]);
    const partida = chunksDePartida(codigos, 'index.js');
    expect([...partida].sort()).toEqual(['Game.js', 'helper.js', 'index.js', 'rapier.js', 'wasm-glue.js']);
    for (const lazy of ['WalkerDemo.js', 'Amazonia.js']) expect(partida.has(lazy), `${lazy} é sob demanda`).toBe(false);
  });

  it('um pedaço sob demanda que importa o jogo (estático) não puxa o jogo para o lado dele nem o contrário', () => {
    const codigos = new Map<string, string>([
      ['index.js', 'const g=()=>import("./Game.js");'],
      ['Game.js', 'const d=()=>import("./Lazy.js");'],
      ['Lazy.js', 'import{x}from"./Game.js";'],
    ]);
    expect([...chunksDePartida(codigos, 'index.js')].sort()).toEqual(['Game.js', 'index.js']);
  });

  it('citação de um pedaço que não existe é ignorada (não derruba a medição)', () => {
    const codigos = new Map<string, string>([['index.js', 'import"./some.js";const m=["./Game.js"];']]);
    expect([...chunksDePartida(codigos, 'index.js')]).toEqual(['index.js']);
  });

  it('no build de verdade (se houver dist/): o Draga-01 está fora da partida e o jogo principal, dentro', () => {
    const dir = join('dist', 'assets');
    let arquivos: string[];
    try {
      arquivos = readdirSync(dir).filter((f) => f.endsWith('.js'));
    } catch {
      return; // sem build: o `npm run check` roda o build antes do smoke, e o smoke imprime a mesma conta
    }
    const html = readFileSync(join('dist', 'index.html'), 'utf8');
    const entrada = entradaDoHtml(html);
    expect(entrada).not.toBeNull();
    const codigos = new Map(arquivos.map((f) => [f, readFileSync(join(dir, f), 'utf8')] as const));
    const partida = chunksDePartida(codigos, entrada!);
    expect(partida.has(entrada!)).toBe(true);
    expect([...partida].some((f) => f.startsWith('Game-')), 'o jogo principal é de partida').toBe(true);
    for (const f of arquivos.filter((x) => x.startsWith('WalkerDemo-'))) expect(partida.has(f), `${f} é sob demanda`).toBe(false);
  });
});
