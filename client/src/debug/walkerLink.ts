/**
 * O `?walker` do link (P180, parte A): liga a demonstração do Draga-01 (`WalkerDemo.ts`). **Fica num arquivo pequeno à parte de propósito**: o `Game` o lê no começo, e a demonstração
 * (o `WalkerDemo`, o `WalkerVisual`, a marcha) é **carregada sob demanda** (`import()`), então o código do Draga **não pesa no download de quem joga sem o link** (o orçamento de JS por
 * fase: `scripts/orcamentoDeJs.mjs`).
 */
export function walkerFromSearch(search: string): boolean {
  return new URLSearchParams(search).has('walker');
}
