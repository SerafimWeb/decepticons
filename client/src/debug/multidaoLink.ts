/**
 * O `?multidao` do link (P217, passo 3 da ficha do 8 DE JANEIRO): liga a demonstração da multidão (`MultidaoDemo.ts`) em qualquer mapa. **Fica num arquivo pequeno à parte de propósito**
 * (como o `walkerLink.ts`): o `Game` o lê no começo e a demonstração (a simulação, o desenho e os shaders) é **carregada sob demanda**, então não pesa no download de quem joga sem o link.
 *
 * `?multidao=1` liga com 1.500 figurantes; `&cota=N` muda (100 a 5.000); `&t=N` começa a fase no tick N (para ver a Praça cheia sem esperar a marcha); `&semente=N` muda a multidão.
 */
export interface PedidoDaMultidao {
  cota: number;
  inicio: number;
  semente: number;
}

export const COTA_PADRAO = 1500;
export const COTA_MIN = 100;
export const COTA_MAX = 5000;

const inteiro = (v: string | null, padrao: number, min: number, max: number): number => {
  const n = v === null || v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : padrao;
};

export function multidaoFromSearch(search: string): PedidoDaMultidao | null {
  const q = new URLSearchParams(search);
  if (!q.has('multidao')) return null;
  return {
    cota: inteiro(q.get('cota'), COTA_PADRAO, COTA_MIN, COTA_MAX),
    inicio: inteiro(q.get('t'), 0, 0, 40_000),
    semente: inteiro(q.get('semente'), 8123, 0, 2_000_000_000),
  };
}
