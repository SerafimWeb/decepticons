import { PRAIA_COMPLEXO } from '../environment/PraiaLayout';

/**
 * O NÚCLEO DA ESTAÇÃO DE CABOS (ordem P126, `fichas/ataque-e-defesa.md` § 2.2): o que a missão em ondas da praia **defende**. É a
 * "integridade da rede": uma estrutura com **vida própria** (um número só — não colide com o dano por parte dos Mechs, decisão 2 da
 * folha do Comandante). Os rebeldes que **entram no complexo** (os muros da estação) invadem a rede e **drenam** a vida dele; quem
 * defende precisa **expulsar** quem entrou. Passou um tempo sem invasor lá dentro, a rede **se recompõe** devagar, e cada onda
 * eliminada devolve um pouco. Chegou a zero, **a estação cai** e a missão falha.
 *
 * Regra pura (G1/G2): só números, sem relógio nem sorteio — roda igual no cliente e no servidor. O custo é uma conta por tick e um
 * laço sobre os rebeldes vivos (≤ 8): nada é alocado.
 */

export const NUCLEO = {
  /** A vida do núcleo (a "integridade da rede"). */
  vidaMax: 1000,
  /** Dano por segundo para cada ponto de peso de invasor dentro do complexo (três Mechs: 21 por segundo, ~48 s até cair). */
  danoPorPesoPorS: 7,
  /** Quanto a rede se recompõe por segundo, depois da espera sem invasor. */
  regenPorS: 14,
  /** Segundos sem nenhum invasor dentro do complexo antes de a rede começar a se recompor. */
  esperaDaRegenS: 6,
  /** O que cada onda eliminada devolve de uma vez. */
  curaPorOnda: 150,
} as const;

/** O peso de um invasor: o Mech vale 1, o andróide meio, o Colossus quatro (o chefe derruba a rede em 36 s sozinho). */
export function pesoDoInvasor(nome: string): number {
  if (nome.startsWith('ANDR')) return 0.5;
  if (nome.startsWith('COLOSSUS')) return 4;
  return 1;
}

/** O ponto (x, z) está dentro do complexo da estação (os muros)? É onde um rebelde conta como invasor. */
export function dentroDoComplexo(x: number, z: number): boolean {
  return x >= PRAIA_COMPLEXO.minX && x <= PRAIA_COMPLEXO.maxX && z >= PRAIA_COMPLEXO.minZ && z <= PRAIA_COMPLEXO.maxZ;
}

export class NucleoDaEstacao {
  vida: number = NUCLEO.vidaMax;
  /** O peso dos invasores dentro do complexo neste tick (o HUD acende o alerta com ele). */
  pressao = 0;
  private calmaS = 0;

  /** A vida de 0 a 1. */
  get fracao(): number {
    return this.vida / NUCLEO.vidaMax;
  }

  /** A estação caiu: a missão acabou. */
  get caiu(): boolean {
    return this.vida <= 0;
  }

  /** Um tick: `peso` é a soma dos pesos dos invasores dentro do complexo. Com invasor, drena; sem, espera e depois recompõe. */
  fixedUpdate(dt: number, peso: number): void {
    if (this.caiu) return;
    this.pressao = peso;
    if (peso > 0) {
      this.calmaS = 0;
      this.vida = Math.max(0, this.vida - peso * NUCLEO.danoPorPesoPorS * dt);
      return;
    }
    this.calmaS += dt;
    if (this.calmaS >= NUCLEO.esperaDaRegenS) this.vida = Math.min(NUCLEO.vidaMax, this.vida + NUCLEO.regenPorS * dt);
  }

  /** Devolve vida de uma vez (a onda eliminada). Não ressuscita: uma estação que caiu segue caída. */
  curar(n: number): void {
    if (this.caiu) return;
    this.vida = Math.min(NUCLEO.vidaMax, this.vida + n);
  }

  /** Missão nova: inteira de novo. */
  reset(): void {
    this.vida = NUCLEO.vidaMax;
    this.pressao = 0;
    this.calmaS = 0;
  }
}
