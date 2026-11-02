/**
 * As cores do casco do Mech (P305, "fazer bem feito e completo": a pintura é comprada com Créditos e os outros pilotos a veem).
 *
 * Fonte única do catálogo: o cliente (o Hangar e o desenho do seu Mech e dos outros), o servidor (valida a montagem que chega no JOIN e no roster)
 * e a conta (o que cada piloto já comprou, um bit por cor).
 *
 * As regras, todas aqui e testadas em `pinturas.test.ts`:
 * - **A 0 é "DE FÁBRICA"**: não mexe em cor nenhuma. O Vector-09 sai amarelo, como sempre; os modelos importados saem com o visual deles. É a de todo mundo que não comprou.
 * - **Cosmético, nunca combate** (`VISAO.md`): nenhuma cor muda dano, vida, hitbox nem cadência. Nenhuma é o vermelho do inimigo nem o verde do visor do jogador.
 * - **Compra só cresce**: não há reembolso, então a posse é a união dos aparelhos (um bit por cor, do jeito que `unirPinturas` faz).
 */
export interface Pintura {
  readonly id: string;
  /** O nome que o Hangar mostra (em português; o dicionário de idiomas traduz). */
  readonly nome: string;
  /** A cor do casco em 0xRRGGBB; `null` = a de fábrica do chassi. */
  readonly cor: number | null;
  /** Preço em Créditos (₵). A de fábrica é grátis. */
  readonly preco: number;
}

export const PINTURAS: readonly Pintura[] = [
  { id: 'fabrica', nome: 'DE FÁBRICA', cor: null, preco: 0 },
  { id: 'grafite', nome: 'GRAFITE', cor: 0x3b4450, preco: 150 },
  { id: 'osseo', nome: 'BRANCO ÓSSEO', cor: 0xd9dcd0, preco: 200 },
  { id: 'ciano', nome: 'CIANO DE ENGENHARIA', cor: 0x1fa7b8, preco: 300 },
  { id: 'marinho', nome: 'AZUL MARINHO', cor: 0x24479a, preco: 300 },
  { id: 'laranja', nome: 'LARANJA DE SINALIZAÇÃO', cor: 0xe8741c, preco: 400 },
  { id: 'roxo', nome: 'ROXO NEON', cor: 0x7d3fd0, preco: 600 },
];

/** Quantas cores existem (o índice `pintura` da montagem vai de 0 a esta menos 1). */
export const QUANTIDADE_PINTURAS = PINTURAS.length;
/** A máscara de posse: um bit por cor, só os bits que existem. */
export const MASCARA_PINTURAS = 2 ** QUANTIDADE_PINTURAS - 1;

/** Um índice de cor que existe no catálogo (inteiro, de 0 a `QUANTIDADE_PINTURAS - 1`). */
export function pinturaValida(i: unknown): i is number {
  return typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < QUANTIDADE_PINTURAS;
}

/** A cor do casco de um índice, ou `null` (de fábrica, ou índice que não existe). */
export function corDaPintura(i: number): number | null {
  return pinturaValida(i) ? PINTURAS[i]!.cor : null;
}

/** Quanto custa a cor (0 para a de fábrica e para índice que não existe). */
export function precoDaPintura(i: number): number {
  return pinturaValida(i) ? PINTURAS[i]!.preco : 0;
}

/** O piloto tem esta cor? A de fábrica é sempre dele; as outras, se o bit estiver ligado na máscara. */
export function possuiPintura(bits: number, i: number): boolean {
  if (!pinturaValida(i)) return false;
  return i === 0 || ((bits >> i) & 1) === 1;
}

/** A união de dois aparelhos (ou da conta com o navegador): quem comprou em qualquer um, tem. Nunca passa dos bits do catálogo. */
export function unirPinturas(a: number, b: number): number {
  return (a | b) & MASCARA_PINTURAS;
}

/**
 * A compra: tira o preço dos Créditos e liga o bit. `null` = não dá (cor que não existe, cor que já é dele, ou Créditos que não bastam).
 * Pura: quem chama grava o resultado (`ui/DailyChallenges`).
 */
export function comprarPintura(bits: number, i: number, creditos: number): { bits: number; creditos: number } | null {
  if (!pinturaValida(i) || possuiPintura(bits, i)) return null;
  const preco = precoDaPintura(i);
  if (creditos < preco) return null;
  return { bits: unirPinturas(bits, 1 << i), creditos: creditos - preco };
}
