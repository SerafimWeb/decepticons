/**
 * Molejo (P319, geração 3 dos Mechs): uma mola amortecida para o movimento secundário do robô (o tronco que inclina ao
 * arrancar e volta ao parar, a pelve que assenta depois de um pulo, o coice que recua e volta). Só desenho: roda no
 * render, nunca na simulação (G1/G2), e não toca em dano, mira nem bocas de tiro.
 *
 * Custo (G4/G5): cada mola são dois números, sem objeto por quadro. A integração é semi-implícita em passos de até
 * 1/240 s; o `dt` é limitado a 0,1 s, então uma aba que volta do fundo não faz a mola explodir.
 */
export interface Mola {
  x: number;
  v: number;
}

export const novaMola = (): Mola => ({ x: 0, v: 0 });

/** Teto do `dt` de uma integração (s): acima disso a mola anda como se tivessem passado 0,1 s, e não explode. */
const DT_MAX = 0.1;
/** Passo máximo da integração (s): com freq ≤ 30 rad/s o passo fica estável e o resultado não depende do quadro. */
const PASSO_MAX = 1 / 240;

/**
 * Avança a mola até `alvo`: `freq` é a frequência natural (rad/s) e `zeta` o amortecimento (1 = crítico, < 1 passa do alvo e volta).
 * Devolve a posição nova. Sem alocação.
 */
export function avancaMola(m: Mola, alvo: number, freq: number, zeta: number, dt: number): number {
  const t = dt < DT_MAX ? dt : DT_MAX;
  if (!(t > 0)) return m.x;
  const passos = Math.max(1, Math.ceil(t / PASSO_MAX));
  const h = t / passos;
  const k = freq * freq;
  const c = 2 * zeta * freq;
  for (let i = 0; i < passos; i++) {
    m.v += (k * (alvo - m.x) - c * m.v) * h;
    m.x += m.v * h;
  }
  return m.x;
}

/**
 * Frequência natural do corpo (rad/s) a partir da altura: um pêndulo, então quanto mais alto, mais lento. O Vector-09
 * (5,3 m) dá cerca de 10 rad/s (1,6 Hz); o Colossus (14 m) cai para uns 6 rad/s. Só a altura entra: a mesma conta vale
 * para todo chassi, sem número por robô.
 */
export function frequenciaDoCorpo(altura: number): number {
  return 10 * Math.sqrt(5.3 / Math.max(0.5, altura));
}
