import type { NivelDaMusica } from './energiaDeCombate';

/**
 * O PADRÃO DA MÚSICA DE COMBATE (P315): a harmonia e a batida, em dados, sem áudio. Quatro compassos de lá menor (Am, F, C, G) em 4/4, a
 * 108 BPM, com 16 passos por compasso. O nível escolhe quais camadas tocam em cada passo. Puro e testado em `padraoDaMusica.test.ts`; o
 * som (osciladores e ruído) fica em `MusicaDeCombate.ts`.
 */

export const BPM = 108;
export const PASSOS_POR_COMPASSO = 16;

/** Os bits de cada passo: que instrumento toca nele. */
export const BUMBO = 1;
export const CAIXA = 2;
export const CHIMBAL = 4;
export const BAIXO = 8;

/** Os acordes em notas MIDI (três vozes por acorde). A raiz do baixo é a nota de baixo do acorde, uma oitava abaixo. */
const ACORDES: readonly (readonly number[])[] = [
  [57, 60, 64], // Lá menor: A3 C4 E4
  [53, 57, 60], // Fá maior: F3 A3 C4
  [48, 52, 55], // Dó maior: C3 E3 G3
  [55, 59, 62], // Sol maior: G3 B3 D4
];

/** As notas do acorde do compasso (o ciclo de quatro compassos se repete). */
export function acordeDoCompasso(compasso: number): readonly number[] {
  return ACORDES[((compasso % ACORDES.length) + ACORDES.length) % ACORDES.length]!;
}

/** A nota do baixo no compasso: a raiz do acorde, uma oitava abaixo. */
export function raizDoCompasso(compasso: number): number {
  return acordeDoCompasso(compasso)[0]! - 12;
}

/**
 * Os instrumentos que tocam no passo (0 a 15) do nível. Calmo: nenhuma batida nem baixo (só o pad, que é o colchão e fica em todos os
 * níveis). Tensão: bumbo nos tempos 1 e 3 (com a pancada extra no 3 e meio no nível 2), e baixo nas semínimas. Combate: chimbal em todas
 * as colcheias, caixa nos tempos 2 e 4, e baixo nas colcheias.
 */
export function padraoDoPasso(nivel: NivelDaMusica, passo: number): number {
  const p = ((passo % PASSOS_POR_COMPASSO) + PASSOS_POR_COMPASSO) % PASSOS_POR_COMPASSO;
  let bits = 0;
  if (nivel >= 1) {
    if (p === 0 || p === 8) bits |= BUMBO;
    if (p % 4 === 0) bits |= BAIXO;
  }
  if (nivel >= 2) {
    if (p === 10) bits |= BUMBO;
    if (p === 4 || p === 12) bits |= CAIXA;
    if (p % 2 === 0) bits |= CHIMBAL;
    if (p % 2 === 0) bits |= BAIXO;
  }
  return bits;
}

/** A frequência, em Hz, de uma nota MIDI (lá de 440 Hz no MIDI 69). */
export function frequenciaDaNota(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Os segundos de um passo de 16 avos a este BPM. */
export function segundosPorPasso(bpm = BPM): number {
  return 60 / bpm / 4;
}
