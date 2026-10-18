import { MOBILIDADE_RASTEJANDO } from '../entities/MechBase';
import { AMAZONIA_ALDEIA, AMAZONIA_DRAGA_INICIO_X, rioEmX } from '../environment/AmazoniaLayout';

/**
 * A MARCHA DO DRAGA-01 (ordem P180, parte C, `AMAZONIA.md` § 6): as contas **puras** (G1/G2, G14: só números, nada de Three nem de física) de como o chefe da Amazônia anda
 * **rio acima pelo leito** rumo à aldeia: o ponto para onde ele olha, a linha que ele não pode cruzar, a conta da velocidade com as pernas caídas (a mesma do `MechBase.mobility`), quanto cada
 * uma das **quatro** pernas já caiu (para o desenho) e quanto falta para a aldeia (para a tela). O corpo, o cérebro e a física estão em `environment/AmazoniaChefe.ts`; aqui só a regra.
 *
 * Convenção: x cresce rio abaixo (leste); o Draga nasce em `AMAZONIA_DRAGA_INICIO_X` e anda para o oeste (x diminui). O Mech olha para -Z com yaw 0; yaw positivo vira para -X.
 */

/** A velocidade da marcha de pernas inteiras (m/s): a do `walkerGait` (o passo de 7,5 m a esta velocidade é o que a marcha de quatro tempos foi calculada para vestir). */
export const VELOCIDADE_DA_MARCHA_MS = 2.6;

/** Até onde a aldeia aguenta: o Draga com o corpo nesta linha (x) a alcançou e o rio perdeu. Fica a 90 m das últimas casas (a maloca grande está a 70 m do centro). */
export const LINHA_DA_ALDEIA_X = AMAZONIA_ALDEIA.x + AMAZONIA_ALDEIA.raio + 90;

/** Quanto o Draga tem de andar da largada até a linha da aldeia (m). */
export const DISTANCIA_DA_MARCHA_M = AMAZONIA_DRAGA_INICIO_X - LINHA_DA_ALDEIA_X;

/** Quantos metros à frente, rio acima, fica o ponto para onde ele olha (o rio serpenteia: olhar longe demais cortaria a margem). */
export const MIRA_NO_RIO_M = 70;

const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);

/** Quanto falta para a aldeia (m): 0 quando já chegou. Número torto (NaN) conta como a marcha toda por andar. */
export function distanciaAteAAldeia(x: number): number {
  if (!Number.isFinite(x)) return DISTANCIA_DA_MARCHA_M;
  return Math.max(0, x - LINHA_DA_ALDEIA_X);
}

/** O progresso da marcha (0 na largada, 1 na aldeia). */
export function progressoDaMarcha(x: number): number {
  return clamp01(1 - distanciaAteAAldeia(x) / DISTANCIA_DA_MARCHA_M);
}

/** A aldeia foi alcançada (o corpo do Draga cruzou a linha)? */
export const chegouAAldeia = (x: number): boolean => Number.isFinite(x) && x <= LINHA_DA_ALDEIA_X;

/** O ponto (x, z) do leito para onde o Draga olha estando em `x`: `MIRA_NO_RIO_M` rio acima, sobre o eixo do rio. Escreve em `out` (sem alocar). */
export function pontoDoRio(x: number, out: { x: number; z: number }): { x: number; z: number } {
  const px = x - MIRA_NO_RIO_M;
  out.x = px;
  out.z = rioEmX(px);
  return out;
}

/** O rumo (yaw do Mech: 0 olha para -Z, positivo vira para -X) de quem quer ir na direção (dx, dz). Parado (0, 0) mantém o rumo de frente. */
export function rumoPara(dx: number, dz: number): number {
  if (dx === 0 && dz === 0) return 0;
  return Math.atan2(-dx, -dz);
}

/**
 * A fração da velocidade que as pernas deixam: **a mesma regra do `MechBase.mobility`** (uma perna caída tira metade, as duas o deixam parado, e o chefe que rasteja segue a 30%). Aqui cada lado
 * é um módulo (as duas pernas da esquerda são o módulo `leftLeg`), então uma "perna" é um **par**: o Draga com um lado caído manca, com os dois lados caídos rasteja.
 */
export function escalaDaMarcha(esquerdaDePe: boolean, direitaDePe: boolean, rasteja: boolean): number {
  return esquerdaDePe && direitaDePe ? 1 : esquerdaDePe || direitaDePe ? 0.5 : rasteja ? MOBILIDADE_RASTEJANDO : 0;
}

/** Quantos segundos faltam para a aldeia andando assim (Infinity se ele não anda). */
export function tempoAteAAldeiaS(x: number, esquerdaDePe: boolean, direitaDePe: boolean, rasteja: boolean): number {
  const v = VELOCIDADE_DA_MARCHA_MS * escalaDaMarcha(esquerdaDePe, direitaDePe, rasteja);
  return v > 0 ? distanciaAteAAldeia(x) / v : Infinity;
}

/** As distâncias (m) em que a tela avisa que o Draga se aproxima da aldeia (da maior para a menor). */
export const AVISOS_DA_MARCHA_M: readonly number[] = [1000, 500, 250, 100];

/**
 * O aviso do topo da tela quando o Draga cruza uma das distâncias de `AVISOS_DA_MARCHA_M` (de `antes` para `depois`, as duas em metros até a aldeia), ou `null` se não cruzou nenhuma. Quando cruza mais de uma
 * no mesmo quadro (um salto), vale a **menor** (a mais grave). Só a aproximação avisa: voltar (o Draga empurrado para trás) não.
 */
export function avisoDaMarcha(antes: number, depois: number): string | null {
  if (!Number.isFinite(antes) || !Number.isFinite(depois) || depois >= antes) return null;
  let achada = -1;
  for (const m of AVISOS_DA_MARCHA_M) if (antes > m && depois <= m) achada = m;
  if (achada < 0) return null;
  return achada <= 100 ? 'O DRAGA ESTÁ ÀS PORTAS DA ALDEIA' : `O DRAGA ESTÁ A ${achada} m DA ALDEIA`;
}

/** O quanto da marcha o link deixa começar já andada: o teto de `?marcha=` (95%: o Draga nunca nasce na linha da aldeia). */
export const MARCHA_INICIAL_MAXIMA = 0.95;

/**
 * Onde (x) o Draga está quando já andou `fracao` da marcha (0 na largada, 1 na linha da aldeia). Número torto vale 0 e passar do teto vale o teto. É o que deixa o Comandante
 * testar o fim da missão sem esperar dez minutos: `?mapa=amazonia&modo=survival&marcha=0.8`.
 */
export function posicaoNaMarcha(fracao: number): number {
  const f = Number.isFinite(fracao) ? Math.min(MARCHA_INICIAL_MAXIMA, Math.max(0, fracao)) : 0;
  return AMAZONIA_DRAGA_INICIO_X - f * DISTANCIA_DA_MARCHA_M;
}

/** O `?marcha=` do link (0 a 0,95): quanto da marcha o Draga já andou ao começar. Sem o parâmetro ou com lixo, 0 (a largada). */
export function marchaFromSearch(search: string): number {
  const v = new URLSearchParams(search).get('marcha');
  if (v === null || v.trim() === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(MARCHA_INICIAL_MAXIMA, Math.max(0, n)) : 0;
}

/** O quanto cada uma das quatro pernas já caiu (0 de pé, 1 caída): é o `collapsed` da marcha de `walkerGait`. */
export interface PernasCaidas {
  fl: number;
  fr: number;
  rl: number;
  rr: number;
}

/**
 * O desenho tem quatro pernas e a regra tem dois módulos: cada lado do corpo é uma fração de vida (0 a 1). **A perna da frente cai primeiro**: de 100% a 50% de vida do módulo a dianteira vai de
 * em pé a caída; de 50% a 0% é a traseira. Com o módulo zerado as duas estão caídas (e é aí que `MechBase.mobility` corta a velocidade). Escreve em `out` (sem alocar).
 * A esquerda do robô é o lado -X do Mech (`fl`, `rl`); a direita, +X.
 */
export function pernasCaidas(vidaEsquerda: number, vidaDireita: number, out: PernasCaidas): PernasCaidas {
  const perdaE = 1 - clamp01(vidaEsquerda);
  const perdaD = 1 - clamp01(vidaDireita);
  out.fl = clamp01(perdaE * 2);
  out.rl = clamp01(perdaE * 2 - 1);
  out.fr = clamp01(perdaD * 2);
  out.rr = clamp01(perdaD * 2 - 1);
  return out;
}
