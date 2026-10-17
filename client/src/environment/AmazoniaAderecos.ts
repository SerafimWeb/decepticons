import {
  AMAZONIA_ALDEIA,
  AMAZONIA_MARGEM,
  AMAZONIA_MINA,
  AMAZONIA_PLANTA,
  AMAZONIA_REJEITOS,
  larguraDoRio,
  rioEmX,
} from './AmazoniaLayout';
import { alturaDoTerreno } from './AmazoniaTerreno';

/**
 * AS ESTRUTURAS DA AMAZÔNIA (P180, parte B): o catálogo em **dado puro**, lido pelo construtor (`AmazoniaCenario.ts`) e pelos testes. A aldeia (as malocas e as canoas), a **planta** (galpões,
 * silos, tanques, esteiras e a chaminé), a **margem fortificada** (a cerca e as torres de vigia, as de `torre_{n}` da ficha da missão), as máquinas da borda da cava e a bomba da lagoa.
 * Cada peça é uma forma simples (caixa, cilindro ou cone) com uma cor e, quando é sólida, um colisor (a caixa que a envolve).
 */

export type Forma = 'caixa' | 'cilindro' | 'cone';
export type CorDaPeca = 'palha' | 'madeira' | 'concreto' | 'metal' | 'amarelo' | 'ferrugem' | 'tanque' | 'vermelho' | 'escuro';

export interface Adereco {
  forma: Forma;
  cor: CorDaPeca;
  /** O centro da peça no mundo. */
  x: number;
  y: number;
  z: number;
  /** Caixa: largura (x), altura (y), profundidade (z). Cilindro e cone: o raio em `w` (e `d`), a altura em `h`. */
  w: number;
  h: number;
  d: number;
  /** O giro em torno de Y (rad). */
  giro: number;
  /** Tem colisor (a caixa que envolve a peça)? */
  solido: boolean;
  /** A vida que a frente do rio mata (a palha da aldeia seca): 0 pedra e metal. */
  vida: number;
}

/** A cor (linear) de cada material. */
export const COR_DA_PECA: Readonly<Record<CorDaPeca, readonly [number, number, number]>> = {
  palha: [0.32, 0.22, 0.07],
  madeira: [0.1, 0.06, 0.03],
  concreto: [0.26, 0.26, 0.24],
  metal: [0.12, 0.15, 0.18],
  amarelo: [0.55, 0.36, 0.02],
  ferrugem: [0.2, 0.07, 0.03],
  tanque: [0.42, 0.42, 0.4],
  vermelho: [0.3, 0.03, 0.02],
  escuro: [0.04, 0.04, 0.045],
};

/** O chão sob (x, z): a altura do terreno, para a peça assentar nele. */
const chao = (x: number, z: number): number => alturaDoTerreno(x, z);

function caixa(lista: Adereco[], cor: CorDaPeca, x: number, z: number, w: number, h: number, d: number, giro = 0, solido = true, yBase?: number, vida = 0): void {
  const base = yBase ?? chao(x, z) - 0.3;
  lista.push({ forma: 'caixa', cor, x, y: base + h / 2, z, w, h, d, giro, solido, vida });
}

function cilindro(lista: Adereco[], cor: CorDaPeca, x: number, z: number, raio: number, h: number, solido = true, yBase?: number, vida = 0): void {
  const base = yBase ?? chao(x, z) - 0.3;
  lista.push({ forma: 'cilindro', cor, x, y: base + h / 2, z, w: raio, h, d: raio, giro: 0, solido, vida });
}

function cone(lista: Adereco[], cor: CorDaPeca, x: number, z: number, raio: number, h: number, yBase: number, vida = 0): void {
  lista.push({ forma: 'cone', cor, x, y: yBase + h / 2, z, w: raio, h, d: raio, giro: 0, solido: false, vida });
}

/** As torres de vigia da margem fortificada (as `torre_{n}` da ficha): o ponto de cada uma, em x, na margem norte do rio. */
export const TORRES_DA_MARGEM: readonly number[] = [-240, -140, -40, 60, 160, 260, 360, 460];

/** O ponto (x, z) da torre `i` da margem: 24 m para dentro da margem norte. */
export function pontoDaTorre(i: number): { x: number; z: number } {
  const x = TORRES_DA_MARGEM[i]!;
  return { x, z: rioEmX(x) + larguraDoRio(x) / 2 + 24 };
}

let cache: readonly Adereco[] | null = null;

/** Todas as estruturas do mapa (calculadas uma vez e guardadas). */
export function aderecosDaAmazonia(): readonly Adereco[] {
  if (cache) return cache;
  const l: Adereco[] = [];

  // ── A aldeia: uma maloca grande no meio, as casas em volta e as canoas na beira do rio ────────────────────────────────────────────────
  const a = AMAZONIA_ALDEIA;
  {
    const yb = chao(a.x, a.z) - 0.3;
    cilindro(l, 'madeira', a.x, a.z, 9, 4.2, true, yb, 0.2);
    cone(l, 'palha', a.x, a.z, 12, 7, yb + 4.2, 1);
  }
  for (let i = 0; i < 13; i++) {
    const ang = (i / 13) * Math.PI * 2 + 0.3;
    const r = 30 + 10 * Math.sin(i * 2.3);
    const x = a.x + Math.cos(ang) * r;
    const z = a.z + Math.sin(ang) * r;
    const yb = chao(x, z) - 0.3;
    cilindro(l, 'madeira', x, z, 3.6, 2.6, true, yb, 0.2);
    cone(l, 'palha', x, z, 5.2, 3.2, yb + 2.6, 1);
  }
  // as canoas: encostadas na beira sul do rio, em frente à aldeia
  for (let i = 0; i < 5; i++) {
    const x = a.x - 40 + i * 24;
    const zBeira = rioEmX(x) - larguraDoRio(x) / 2 - 3;
    caixa(l, 'madeira', x, zBeira, 1.1, 0.7, 7.5, 1.5708 + 0.15 * (i - 2), false, chao(x, zBeira) + 0.1, 0);
  }

  // ── A planta (o pátio plano de 190 × 110 m): galpões, silos, tanques, esteiras, a chaminé ───────────────────────────────────────────────
  const p = AMAZONIA_PLANTA;
  const yp = chao(p.x, p.z) - 0.3;
  for (const [dx, dz, w, d] of [[-62, -30, 44, 24], [-62, 12, 44, 24], [6, 34, 50, 22]] as const) {
    caixa(l, 'metal', p.x + dx, p.z + dz, w, 10, d, 0, true, yp);
    caixa(l, 'amarelo', p.x + dx, p.z + dz, w + 1.6, 1.2, d + 1.6, 0, false, yp + 10);
  }
  for (const [dx, dz] of [[44, -28], [68, -28]] as const) {
    cilindro(l, 'concreto', p.x + dx, p.z + dz, 9, 26, true, yp);
    cone(l, 'metal', p.x + dx, p.z + dz, 9.6, 4, yp + 26);
  }
  for (let i = 0; i < 6; i++) {
    const dx = -8 + (i % 3) * 22;
    const dz = -34 + Math.floor(i / 3) * 24;
    cilindro(l, i % 2 ? 'tanque' : 'ferrugem', p.x + dx, p.z + dz, 7, 14, true, yp);
  }
  // a chaminé: alta, vermelha e branca, no fundo do pátio
  cilindro(l, 'concreto', p.x + 80, p.z + 40, 3.4, 52, true, yp);
  cilindro(l, 'vermelho', p.x + 80, p.z + 40, 3.7, 6, false, yp + 40);
  // a esteira: do galpão da frente à borda da cava, sobre pilares (a cava fica logo adiante, a 214 m da planta)
  for (let i = 0; i < 6; i++) {
    const x = p.x + 80 + i * 22;
    const z = p.z + 20 + i * 5;
    caixa(l, 'metal', x, z, 1.2, 7.4 - chao(x, z) + 0.3, 1.2, 0, i % 2 === 0, chao(x, z) - 0.3);
  }
  caixa(l, 'amarelo', p.x + 80 + 2.5 * 22, p.z + 20 + 2.5 * 5, Math.hypot(5 * 22, 5 * 5), 1.4, 3.2, -Math.atan2(5 * 5, 5 * 22), false, 7.4);

  // ── A margem fortificada: a cerca (postes e arame) e as torres de vigia, na margem norte ───────────────────────────────────────────────
  for (let x = AMAZONIA_MARGEM.minX; x <= AMAZONIA_MARGEM.maxX; x += 20) {
    const z = rioEmX(x) + larguraDoRio(x) / 2 + 14;
    caixa(l, 'metal', x, z, 0.7, 5.2, 0.7, 0, false, chao(x, z) - 0.3);
    if (x < AMAZONIA_MARGEM.maxX) {
      const z2 = rioEmX(x + 20) + larguraDoRio(x + 20) / 2 + 14;
      const yAr = (chao(x, z) + chao(x + 20, z2)) / 2 + 3.4;
      caixa(l, 'escuro', (x + x + 20) / 2, (z + z2) / 2, 20.2, 0.18, 0.18, -Math.atan2(z2 - z, 20), false, yAr - 0.09);
    }
  }
  for (let i = 0; i < TORRES_DA_MARGEM.length; i++) {
    const { x, z } = pontoDaTorre(i);
    const yb = chao(x, z) - 0.3;
    for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]] as const) caixa(l, 'metal', x + dx, z + dz, 0.6, 15, 0.6, 0, false, yb);
    caixa(l, 'metal', x, z, 6.4, 0.5, 6.4, 0, true, yb + 7);
    caixa(l, 'concreto', x, z, 7, 4.2, 7, 0, true, yb + 15);
    caixa(l, 'amarelo', x, z, 7.6, 0.5, 7.6, 0, false, yb + 19.2);
  }

  // ── A cava: as máquinas na borda (caminhões e escavadeiras) e os mastros de luz ─────────────────────────────────────────────────────
  const m = AMAZONIA_MINA;
  for (let i = 0; i < 7; i++) {
    const ang = -0.5 + i * 0.42;
    const x = m.x + Math.cos(ang + Math.PI) * (m.raio * 1.12);
    const z = m.z + Math.sin(ang + Math.PI) * (m.raio * 1.12);
    const yb = chao(x, z) - 0.3;
    if (i % 3 === 0) {
      caixa(l, 'amarelo', x, z, 9, 4.6, 11, ang, true, yb + 1.2);
      caixa(l, 'metal', x, z, 4, 3.4, 4.6, ang, false, yb + 5.8);
    } else {
      caixa(l, 'amarelo', x, z, 7, 4, 13, ang + 1.57, true, yb + 1.4);
      caixa(l, 'escuro', x, z, 7.4, 1.6, 4.4, ang + 1.57, false, yb + 5.4);
    }
  }
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI * 0.75 + i * 0.5;
    const x = m.x + Math.cos(ang) * (m.raio * 1.18);
    const z = m.z + Math.sin(ang) * (m.raio * 1.18);
    cilindro(l, 'metal', x, z, 0.5, 22, false);
  }

  // ── A lagoa de rejeitos: a casa de bombas e o tubo que vem da planta ───────────────────────────────────────────────────────────────
  const r = AMAZONIA_REJEITOS;
  caixa(l, 'concreto', r.x - r.rx * 1.2, r.z - 6, 14, 6, 10, 0, true);
  for (let i = 0; i < 8; i++) {
    const x = r.x - r.rx * 1.2 - 100 + i * 12.5;
    const z = r.z - 6 + (i - 8) * 0;
    cilindro(l, 'ferrugem', x, z, 0.9, 1.6, false, chao(x, z) + 0.2);
  }

  cache = l;
  return l;
}
