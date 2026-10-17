import type { WeaponId } from '../combat/weapons';

/**
 * As dicas de uma linha de cada arma na tela do Hangar (as de primeiro uso, no tiro, são `dicasDeArma.ts`). Moram em `public/dicas-do-hangar.json` e chegam quando o Hangar abre:
 * eram 3 KB de texto no pacote, e o orçamento de JS (R7, 500 KB gzip) já não tinha folga. Um texto por arma; `dicasDoHangar.test.ts` confere que nenhuma falta.
 * Módulo independente (G3). Custo de CPU: um `fetch` na primeira abertura do Hangar.
 */

let tabela: Partial<Record<WeaponId, string>> = {};
let carregando: Promise<boolean> | null = null;

/** A dica da arma (vazia enquanto o arquivo não chegou, ou se não chegar). */
export function dicaDoHangar(id: WeaponId): string {
  return tabela[id] ?? '';
}

/** Busca o arquivo uma vez. Resolve `true` só na vez em que as dicas chegaram (quem chamou refaz o texto); depois, `false`. Falha de rede: `false`, e a próxima abertura tenta de novo. */
export function carregarDicasDoHangar(): Promise<boolean> {
  if (carregando) return carregando.then(() => false);
  carregando = fetch(`${import.meta.env.BASE_URL}dicas-do-hangar.json`)
    .then((r) => r.json() as Promise<Partial<Record<WeaponId, string>>>)
    .then((j) => {
      tabela = j;
      return true;
    })
    .catch(() => {
      carregando = null;
      return false;
    });
  return carregando;
}
