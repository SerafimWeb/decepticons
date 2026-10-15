/**
 * A ÁGUA (ordem P126 do Comandante, 14/10): *"que os mechs possam entrar na água e ir afundando"*.
 *
 * A regra, pura e sem física nova: a **superfície** é um plano (`superficie`) dentro de um retângulo (`x`/`z`). O fundo do
 * mar **desce** (isso é geometria, no mapa), então entrar no mar já afunda o Mech pela física de sempre; o que esta regra
 * acrescenta é o **preço** de estar dentro dela:
 *  - **freia**: a água come a velocidade — e come mais quanto mais fundo (o `MechBase.moveSpeedScale`, que já existe);
 *  - **afoga**: passado `afogarS` segundos com os pés dentro da água, o casco leva dano por segundo: quem entra para
 *    atravessar tem de sair, e quem tenta se esconder no mar perde a aposta.
 *
 * Regra de simulação (G1/G2): só números, sem relógio nem sorteio — roda igual no cliente e no servidor.
 */

/** A área de água de um mapa: o retângulo da superfície, a altura dela e o preço de ficar dentro. */
export interface Agua {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  /** Altura da superfície (m). Com os pés abaixo dela, o Mech está dentro da água. */
  readonly superficie: number;
  /** Segundos com os pés na água antes de começar a afogar. */
  readonly afogarS: number;
  /** Dano por segundo no casco depois de afogar. */
  readonly danoPorSegundo: number;
  /**
   * Fundura mínima (m) para o tempo de afogamento correr (P127): abaixo dela é só **vadear** — freia, mas não afoga. Sem ela, qualquer
   * água que molha (`FUNDURA_MOLHADA`) já conta: era o comportamento do passo 1, e os mapas que não declaram nada seguem assim.
   */
  readonly afogaDesde?: number;
}

/** Abaixo disto (m) o pé está só úmido: não freia nem conta como água. */
export const FUNDURA_MOLHADA = 0.05;

/** Fundura a partir da qual a água já freia o máximo (m). */
export const FUNDURA_QUE_FREIA = 2.5;
/** Fração da velocidade que sobra no fundo (0,35 = 35% da velocidade no seco). */
export const FATOR_MINIMO = 0.35;

/** O quão fundo os pés do Mech estão na água (0 = seco, fora do retângulo ou na/sobre a superfície). */
export function funduraEm(a: Agua, x: number, z: number, pesY: number): number {
  if (x < a.minX || x > a.maxX || z < a.minZ || z > a.maxZ) return 0;
  return Math.max(0, a.superficie - pesY);
}

/** Fator de velocidade com a fundura `f`: 1 no seco, caindo até `FATOR_MINIMO` a `FUNDURA_QUE_FREIA` m. */
export function fatorDeVelocidade(fundura: number): number {
  const f = Math.max(0, fundura);
  if (f <= 0) return 1;
  const t = Math.min(1, f / FUNDURA_QUE_FREIA);
  return 1 - (1 - FATOR_MINIMO) * t;
}

/** A água está funda o bastante para afogar (e não só para vadear) com os pés a `fundura` m dela? */
export function fundoParaAfogar(a: Agua, fundura: number): boolean {
  return fundura > FUNDURA_MOLHADA && fundura >= (a.afogaDesde ?? FUNDURA_MOLHADA);
}

/** Acumulado de tempo dentro da água: soma com os pés molhados, **zera** ao sair. */
export function passoDoAfogamento(acumulado: number, dt: number, naAgua: boolean): number {
  return naAgua ? acumulado + dt : 0;
}

/** Dano de afogamento neste tick (0 antes de `afogarS`; linear depois). */
export function danoDeAfogamento(a: Agua, acumulado: number, dt: number): number {
  return acumulado > a.afogarS ? a.danoPorSegundo * dt : 0;
}
