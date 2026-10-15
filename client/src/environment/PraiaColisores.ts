import { colisoresDoAdereco, praiaAderecos } from './PraiaAderecos';
import { praiaBlocks } from './PraiaLayout';

/**
 * Todos os **colisores sólidos** da praia, em dado puro (P127): os blocos sólidos do layout mais as caixas dos adereços que bloqueiam
 * passagem. É a lista que o construtor entrega ao Rapier — e a que os testes conferem (a contagem, a folga dos pontos da partida, a
 * largura das ruas). O chão é um colisor à parte (o colisor de altura, `PraiaTerreno.ts`) e as paredes do mapa são do construtor.
 */
export interface Colisor {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  /** Inclinação (rampa) em torno de X e de Z, e giro em torno de Y, em radianos. */
  rx?: number; rz?: number; giro?: number;
}

/** O teto de colisores estáticos da ficha `cenario-cabos.md` (o do Bunker): o mapa tem de caber nele. */
export const TETO_DE_COLISORES = 310;

export function praiaColisores(): readonly Colisor[] {
  const out: Colisor[] = [];
  for (const b of praiaBlocks()) {
    if (b.solid === true) out.push({ x: b.x, y: b.y, z: b.z, w: b.w, h: b.h, d: b.d, rx: b.rx, rz: b.rz });
  }
  for (const a of praiaAderecos()) out.push(...colisoresDoAdereco(a));
  return out;
}

/** A pegada do colisor no plano XZ (caixa que o contém, com o giro em Y): o `[x0, z0, x1, z1]` que os testes e as ruas usam. */
export function pegada(c: Colisor): readonly [number, number, number, number] {
  const g = c.giro ?? 0;
  const mx = (c.w * Math.abs(Math.cos(g)) + c.d * Math.abs(Math.sin(g))) / 2;
  const mz = (c.w * Math.abs(Math.sin(g)) + c.d * Math.abs(Math.cos(g))) / 2;
  return [c.x - mx, c.z - mz, c.x + mx, c.z + mz];
}
