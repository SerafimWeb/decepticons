import type { StatusSet } from '../combat/StatusEffects';

/**
 * A cor que o casco ganha enquanto o Mech sofre um estado (dono, 11/10: *"o gelo funcionou, mas não percebi que o robô inimigo ficou
 * congelado"*). Soma-se à luz própria do casco, junto do flash vermelho do dano (`MechBase`): congelado fica azul-gelo parado, chocado pisca
 * em azul elétrico, queimando tremula em laranja, atordoado pulsa em amarelo. Valores **bem abaixo do limiar do bloom** (0,9): o estado se lê
 * no corpo, mas não vira halo de luz (a mesma regra da redução de brilho dos tiros) e **não satura o casco em branco**: a luz própria soma à cor
 * do casco, então acima de ~0,7 um robô claro (o andróide) vira só branco e a cor some (visto na captura de 11/10).
 *
 * Função pura e sem alocação (G4): escreve em `out`. Custo: um punhado de somas por Mech por quadro.
 */
export interface Tint {
  r: number;
  g: number;
  b: number;
}

/** O maior valor de qualquer canal que um estado pode pôr no casco (o limiar do bloom é 0,9). */
export const TINT_MAX = 0.7;

export function statusTint(status: StatusSet, time: number, out: Tint): void {
  let r = 0;
  let g = 0;
  let b = 0;
  if (status.frozen > 0) {
    // Congelado: azul-gelo firme, com um brilho lento de cristal.
    const shimmer = 0.9 + 0.1 * Math.sin(time * 5);
    r = 0.1 * shimmer;
    g = 0.46 * shimmer;
    b = 0.64 * shimmer;
  } else if (status.stacks > 0) {
    // Gelado: a camada de gelo cresce a cada acúmulo (1 a 3), antes de congelar.
    const k = status.stacks / 3;
    r = 0.02 + 0.05 * k;
    g = 0.08 + 0.26 * k;
    b = 0.12 + 0.36 * k;
  }
  if (status.burn > 0) {
    // Queimando: chama que tremula (dois ritmos somados, nunca apaga de vez).
    const f = 0.7 + 0.3 * Math.sin(time * 17 + 1.3) * Math.sin(time * 7.1);
    r = Math.max(r, 0.66 * f);
    g = Math.max(g, 0.17 * f);
    b = Math.max(b, 0.02 * f);
  }
  if (status.shock > 0) {
    // Chocado: pulsos curtos e secos, a ~5 por segundo, com um fundo fraco entre eles.
    // 27/10 (P261, "a luz ainda pisca forte em geral"): continuava o único liga/desliga puro (degrau, não
    // curva) do jogo — um estrobo de verdade a ~5 Hz. O pico caiu (0,66 → 0,42 de azul) mas a forma do
    // degrau ficou (é o "seco" do nome).
    const pulse = Math.sin(time * 31) > 0.5 ? 1 : 0.18;
    r = Math.max(r, 0.05 * pulse);
    g = Math.max(g, 0.18 * pulse);
    b = Math.max(b, 0.42 * pulse);
  }
  if (status.stun > 0) {
    // Atordoado: amarelo que pulsa mais devagar (sobrepõe o azul do choque, que é de onde ele vem).
    const p = 0.55 + 0.45 * Math.sin(time * 14);
    r = Math.max(r, 0.4 * p);
    g = Math.max(g, 0.33 * p);
    b = Math.max(b, 0.03 * p);
  }
  out.r = r;
  out.g = g;
  out.b = b;
}
