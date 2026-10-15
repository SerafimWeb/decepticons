/**
 * Táticas pré-selecionadas (ordem P122 do Comandante, 14/10): *"quero poder 'desenhar' ou escolher entre táticas pre
 * selecionadas (atacar pelos flancos, pelo centro, recuar para tal ponto se alguma coisa acontecer, proteger algum dos
 * nossos, usar táticas de distração e mover a batalha a nosso favor, etc, dependendo de cada missão"*.
 *
 * É a tática que o **jogador** escolhe para o **esquadrão aliado** — não mais uma regra dentro do cérebro do bot: cada
 * tática é um punhado de **parâmetros** que o esquadrão obedece. Dado puro: a tela só lista, e o link `?tatica=` leva a
 * escolha (o seletor dentro da partida é o passo seguinte).
 *
 * **Prontas:** `centro` (o de sempre), `flanco` (formação aberta, ataca pelos lados) e `proteger` (formação apertada, não
 * larga o líder). **Reservadas** (`pronta: false`): `recuar` (recolher para um ponto quando a coisa aperta) e `distrair`
 * (puxar o fogo) — as duas pedem o **gatilho por missão** (P99) e ficam na lista **dizendo que não mudam o jogo ainda**
 * (R13), em vez de mentir sobre o que fazem.
 */

export type TaticaId = 'centro' | 'flanco' | 'proteger' | 'recuar' | 'distrair';

export interface Tatica {
  readonly id: TaticaId;
  readonly nome: string;
  readonly descricao: string;
  /** Largura lateral da formação do esquadrão (m): maior = mais aberto, ataca pelos lados. */
  readonly formacaoLargura: number;
  /** O esquadrão não deixa o líder passar desta distância (m): menor = mais colado. */
  readonly leash: number;
  /** Ligada de verdade? `false` = reservada: aparece na lista, mas não muda o jogo ainda. */
  readonly pronta: boolean;
}

export const TATICAS: Readonly<Record<TaticaId, Tatica>> = {
  centro: { id: 'centro', nome: 'PELO CENTRO', descricao: 'O esquadrão se mantém junto de você e entra pelo meio.', formacaoLargura: 7, leash: 36, pronta: true },
  flanco: { id: 'flanco', nome: 'PELOS FLANCOS', descricao: 'Formação aberta: o esquadrão se espalha e ataca pelos lados.', formacaoLargura: 16, leash: 46, pronta: true },
  proteger: { id: 'proteger', nome: 'PROTEGER', descricao: 'Formação apertada: o esquadrão não larga você.', formacaoLargura: 4, leash: 22, pronta: true },
  recuar: { id: 'recuar', nome: 'RECUAR SE…', descricao: 'Reservada (depende da missão): o esquadrão recolhe para um ponto quando a coisa aperta.', formacaoLargura: 7, leash: 36, pronta: false },
  distrair: { id: 'distrair', nome: 'DISTRAIR', descricao: 'Reservada: o esquadrão puxa o fogo para longe de você.', formacaoLargura: 7, leash: 36, pronta: false },
};

export const TATICA_PADRAO: TaticaId = 'centro';
/** Parâmetro do link que leva a tática: `?tatica=flanco`. */
export const PARAM_DA_TATICA = 'tatica';

/** A tática de um texto (o link): só um id do catálogo vale; o resto é `null`. */
export function taticaDeTexto(texto: string | null | undefined): TaticaId | null {
  if (!texto || !Object.prototype.hasOwnProperty.call(TATICAS, texto)) return null;
  return texto as TaticaId;
}

/** Os parâmetros que o esquadrão obedece. Tática ausente ou **reservada** cai no padrão (não muda o jogo ainda). */
export function parametrosDaTatica(id: TaticaId | null | undefined): Tatica {
  const t = id ? TATICAS[id] : undefined;
  return t && t.pronta ? t : TATICAS[TATICA_PADRAO];
}
