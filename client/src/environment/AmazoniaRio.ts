/**
 * A LIMPEZA DO RIO (P180, parte B; `AMAZONIA.md` § 3): **o rio é o termômetro da fase**. A montante da **frente** o rio é limpo e vivo; a jusante dela é sujo, com óleo e veneno. No começo a
 * frente é a posição do **Draga-01** (o veneno nasce nele: a água acima dele é limpa); a cada peça desmontada a frente de cura avança rio abaixo, até a vitória. **Só um número** (a frente) chega
 * ao desenho: o shader da água, o do terreno e o da folhagem leem a mesma função (`limpezaDoRio`), e nada é calculado por quadro além dele. Pura (G1/G2/G14): a simulação e o desenho dizem a
 * mesma coisa.
 *
 * Convenção: x cresce **rio abaixo** (para o leste). Limpo = 1, morto = 0.
 */

/** A largura (m) da faixa de mistura entre o limpo e o morto, de cada lado da frente: o veneno não é uma parede, é uma mancha que se espalha. */
export const BANDA_DA_FRENTE = 70;

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Quão limpo é o rio em `x` (0 a 1), dada a `frente`: 1 bem a montante, 0 bem a jusante, em curva suave. Número torto (NaN) conta como limpo. */
export function limpezaDoRio(x: number, frente: number, banda: number = BANDA_DA_FRENTE): number {
  if (!Number.isFinite(x) || !Number.isFinite(frente)) return 1;
  const t = clamp01((x - (frente - banda)) / (2 * banda));
  return 1 - t * t * (3 - 2 * t);
}

/**
 * A frente depois de curar `metros` rio abaixo (a cada peça desmontada): só avança, nunca recua, e para no fim do rio (`xFim`). Quem chama decide quantos metros vale cada peça. Para o rio ficar **todo** limpo (`rioTodoLimpo`), passe `xFim` = o fim do rio + `BANDA_DA_FRENTE`.
 */
export function frenteDepoisDeCurar(frente: number, metros: number, xFim: number): number {
  if (!Number.isFinite(frente)) return xFim;
  if (!(metros > 0)) return Math.min(frente, xFim);
  return Math.min(xFim, frente + metros);
}

/** O rio inteiro está limpo (a frente passou do fim, com a banda)? */
export function rioTodoLimpo(frente: number, xFim: number, banda: number = BANDA_DA_FRENTE): boolean {
  return Number.isFinite(frente) && frente - banda >= xFim;
}
