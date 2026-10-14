import type { Agua } from '../combat/Agua';

/**
 * A PRAIA DOS CABOS (ordem P126, Fortaleza · CE): o **layout** do cenário comprido, em **dado puro** — o mesmo caminho do
 * `BunkerLayout.ts`: o construtor do mapa e a física leem esta lista, e os testes conferem o desenho **sem** montar 3D.
 *
 * **O desenho (o que ele FAZ):** uma **praia comprida** (a fase maior da fila) com o **mar de um lado**, onde chegam os
 * cabos. O chão seco vai de `x = 0` a `x = 240`; dali para o mar o **fundo desce em degraus** — é o que faz o Mech
 * **afundar** ao entrar na água pela física de sempre (`combat/Agua.ts` cobra o freio e o afogamento). Na ponta seca fica
 * a **ESTAÇÃO DE CABOS**: o prédio, a escotilha (a **saída** do P123) e as **duas vias** — a areia (baixa e exposta) e a
 * **passarela alta** (longa e coberta) — mais os contêineres de cobertura.
 *
 * **Tetos (da ficha `cenario-cabos.md`):** residente (o maior cenário que cabe **sem streaming**), estático, sem luz nova.
 * A validação contra a física (folga de 3,4 m para o maior Mech, rampas sem pulo) é do teste do mapa, com o construtor.
 */

/** Um bloco do cenário: posição, tamanho, cor e (opcional) inclinação em torno de X/Z, em radianos. */
export interface BlocoDaPraia {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  kind: 'areia' | 'mar' | 'aco' | 'concreto' | 'luz' | 'escotilha';
  rx?: number; rz?: number;
  /** Sem `solid`, o bloco é só desenho (marcação, luz) e não ganha colisor. */
  solid?: boolean;
}

/** A extensão do mapa (m). É a fase maior: 480 m de ponta a ponta, contra os 200 m da Arena. */
export const PRAIA_EXTENSAO = { comprimento: 480, largura: 140 } as const;

/** A **água** do mapa (P126): a metade do mar, com a superfície no nível da areia. O P126 cobra o freio e o afogamento. */
export const PRAIA_AGUA: Agua = {
  minX: -PRAIA_EXTENSAO.comprimento / 2,
  maxX: 0,
  minZ: -PRAIA_EXTENSAO.largura / 2,
  maxZ: PRAIA_EXTENSAO.largura / 2,
  superficie: 0,
  afogarS: 3,
  danoPorSegundo: 8,
};

/** Onde a ESTAÇÃO DE CABOS fica (a ponta seca): o ponto mais alto e o objetivo da missão. */
export const PRAIA_ESTACAO = { x: 200, z: 0 } as const;

/** A meta do mar (m de fundura no fim do mapa): o fundo desce em degraus até aqui. */
export const PRAIA_FUNDURA_MAXIMA = 14;

/**
 * O chão: a **areia** (seca) e o **fundo do mar**, que desce em degraus de `x = 0` para o mar. Cada degrau é um bloco mais
 * fundo que o anterior — é a "rampa" que afunda o Mech, sem física nova.
 */
export function praiaChao(): readonly BlocoDaPraia[] {
  const largura = PRAIA_EXTENSAO.largura;
  const metade = PRAIA_EXTENSAO.comprimento / 2;
  const degraus: BlocoDaPraia[] = [
    { x: metade / 2, y: -1, z: 0, w: metade, h: 2, d: largura, kind: 'areia', solid: true }, // areia seca, topo em y = 0
  ];
  // O fundo do mar: degraus de 60 m, cada um mais fundo (2, 5, 9 e 14 m). O topo de cada degrau fica na fundura dele.
  const funduras = [2, 5, 9, PRAIA_FUNDURA_MAXIMA];
  for (let i = 0; i < funduras.length; i++) {
    const fundura = funduras[i]!;
    const cx = -(i + 0.5) * 60;
    degraus.push({ x: cx, y: -fundura - 2, z: 0, w: 60, h: 4, d: largura, kind: 'mar', solid: true });
  }
  return degraus;
}

/** A estação de cabos, a passarela alta (a segunda via) e a cobertura. O `solid: false` é só desenho. */
export function praiaEstruturas(): readonly BlocoDaPraia[] {
  const { x: ex, z: ez } = PRAIA_ESTACAO;
  return [
    // O prédio da estação: alto, na ponta seca, com a escotilha no pé (a saída do P123).
    { x: ex, y: 7, z: ez, w: 30, h: 14, d: 30, kind: 'concreto', solid: true },
    { x: ex, y: 14.4, z: ez, w: 34, h: 0.8, d: 34, kind: 'aco', solid: true },
    { x: ex - 20, y: 0.6, z: ez, w: 8, h: 1.2, d: 10, kind: 'escotilha', solid: true },
    // A passarela alta: a via longa e coberta, de 8 m, correndo a praia inteira (do lado de dentro, contra o vento).
    { x: 120, y: 8, z: -55, w: 200, h: 0.6, d: 9, kind: 'aco', solid: true },
    { x: 20, y: 4, z: -55, w: 22, h: 0.6, d: 9, kind: 'aco', rz: -0.36, solid: true }, // a rampa da areia para a passarela
    { x: 220, y: 4, z: -55, w: 22, h: 0.6, d: 9, kind: 'aco', rz: 0.36, solid: true }, // a descida para a estação
    // Cobertura na areia: contêineres onde a escolta se abriga e a emboscada acontece.
    { x: 70, y: 1.5, z: 20, w: 12, h: 3, d: 6, kind: 'aco', solid: true },
    { x: 120, y: 1.5, z: -18, w: 12, h: 3, d: 6, kind: 'aco', solid: true },
    { x: 165, y: 1.5, z: 26, w: 6, h: 3, d: 12, kind: 'aco', solid: true },
    // Luz de posição (sem colisor), para o céu do litoral ter marcas.
    { x: 200, y: 15.5, z: 0, w: 2, h: 2, d: 2, kind: 'luz' },
  ];
}

/** Todo o cenário, na ordem em que o construtor desenha. */
export function praiaBlocks(): readonly BlocoDaPraia[] {
  return [...praiaChao(), ...praiaEstruturas()];
}

/**
 * Os pontos de nascimento (x, z): a **estação** (onde o jogador e os aliados saem, pela escotilha — P123) e as posições
 * na areia, espalhadas ao longo da praia. A folga contra prédio e barricada é conferida pelo teste do mapa, com a física.
 */
export const PRAIA_SPAWNS: readonly (readonly [number, number])[] = [
  [PRAIA_ESTACAO.x - 26, PRAIA_ESTACAO.z], // a boca da escotilha
  [180, -30],
  [150, 34],
  [110, 0],
  [70, -34],
  [30, 26],
];
