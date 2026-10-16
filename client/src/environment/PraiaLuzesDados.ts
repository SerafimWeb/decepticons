import { instanteDeLigar } from './CicloDoDia';
import { LAMPADAS_DA_BARRACA, praiaAderecos, TIPOS_QUE_FLUTUAM, type Adereco, type TipoDeAdereco } from './PraiaAderecos';
import { alturaDoChao, NIVEL_DO_MAR } from './PraiaTerreno';

/**
 * AS LUZES da PRAIA DOS CABOS (P127, rodada de luz e de vida), em **dado puro**: onde cada ponto de luz fica no mapa. Quem lê a lista de
 * adereços (`PraiaAderecos.ts`) sabe onde estão o poste, o refletor, o farol e o varal da barraca; esta lista diz **o que cada um acende**
 * (o halo, a poça no chão, o feixe) — as duas coisas nunca se desencontram (a geometria do bulbo e o halo leem as mesmas posições). O
 * desenho (`PraiaLuzes.ts`) faz um desenho por tipo de efeito, sem luz dinâmica (a ficha proíbe luz nova) e sem CPU por quadro.
 *
 * **Os modos** dizem como a luz se comporta no tempo, calculado na GPU: **fixa**, **respira** (a festa, o farol), **pisca** (o aviso das
 * antenas, das boias e das lanchas rebeldes) e **cintila** (o painel do ponto de ônibus, que falha).
 */

export const LUZ_FIXA = 0;
export const LUZ_RESPIRA = 1;
export const LUZ_PISCA = 2;
export const LUZ_CINTILA = 3;
export type ModoDeLuz = typeof LUZ_FIXA | typeof LUZ_RESPIRA | typeof LUZ_PISCA | typeof LUZ_CINTILA;

type Cor = readonly [number, number, number];
/** As cores passam de 1 de propósito: o realce (bloom) pega o que passa do limiar. */
const SODIO: Cor = [1.15, 0.9, 0.55];
const BRANCA: Cor = [1.3, 1.25, 1.1];
const VERMELHA: Cor = [1.5, 0.16, 0.1];
const VERDE: Cor = [0.25, 1.4, 0.45];
const AGUA: Cor = [0.5, 1.2, 0.95];
const DOURADA: Cor = [1.6, 1.15, 0.55];
const LARANJA: Cor = [1.5, 0.6, 0.2];

/**
 * Quem é **iluminação pública** (P161): acende com o fim do dia, cada uma no seu instante (`instanteDeLigar`). O resto é sinalização (o semáforo, a boia, o aviso
 * das antenas, as luzes de navegação dos navios): fica ligado de dia e de noite, no brilho que sempre teve.
 */
export const TIPOS_DE_ILUMINACAO_PUBLICA: ReadonlySet<TipoDeAdereco> = new Set<TipoDeAdereco>(['poste', 'refletor', 'vigia', 'farol', 'barraca']);

/**
 * O instante em que as luzes de UM adereço acendem (`-1` = sinalização, sempre ligada). Vale por adereço, não por lâmpada: o bulbo desenhado na malha e o halo dele
 * (e todas as lâmpadas do varal de uma barraca) ligam juntos, no mesmo instante.
 */
export function ligaEmDoAdereco(a: Adereco): number {
  return TIPOS_DE_ILUMINACAO_PUBLICA.has(a.tipo) ? instanteDeLigar(a.x * 0.173 + a.z * 0.091) : -1;
}

/**
 * Uma luz: o centro (m), o raio do halo (m), a cor, o modo e a fase (rad) do tempo. `ligaEm`: o instante (0 a 1, na escala das lâmpadas do ciclo do dia) em que
 * a luz pública acende; `-1` = sinalização, sempre ligada.
 */
export interface LuzDaPraia {
  x: number;
  y: number;
  z: number;
  raio: number;
  r: number;
  g: number;
  b: number;
  modo: ModoDeLuz;
  fase: number;
  ligaEm: number;
}

/** Uma poça de luz no chão: o centro, o raio (m), a força (0 a 1) e a cor. */
export interface PocaDeLuz {
  x: number;
  y: number;
  z: number;
  raio: number;
  forca: number;
  r: number;
  g: number;
  b: number;
}

/** Um feixe parado (a luz de um refletor até onde ele aponta): de onde sai, onde chega, o raio na ponta e a cor. */
export interface FeixeDeLuz {
  de: readonly [number, number, number];
  para: readonly [number, number, number];
  raio: number;
  alfa: number;
  r: number;
  g: number;
  b: number;
}

/** Um holofote que gira (a luz de busca das torres de vigia): onde fica, a velocidade (rad/s), a fase e o alcance. */
export interface Holofote {
  x: number;
  y: number;
  z: number;
  velocidade: number;
  fase: number;
  alcance: number;
  raio: number;
}

interface Fonte {
  x: number;
  y: number;
  z: number;
  raio: number;
  cor: Cor;
  modo: ModoDeLuz;
}

const fonte = (x: number, y: number, z: number, raio: number, cor: Cor, modo: ModoDeLuz = LUZ_FIXA): Fonte => ({ x, y, z, raio, cor, modo });

/** O que cada tipo de adereço acende, em coordenadas locais dele (a mesma posição da camada de brilho da geometria). */
const FONTES: Readonly<Partial<Record<TipoDeAdereco, readonly Fonte[]>>> = {
  poste: [fonte(1.3, 7.1, 0, 3.4, SODIO)],
  refletor: [fonte(0, 15.05, 0.55, 5.8, BRANCA)],
  vigia: [fonte(0, 8, 1.3, 4.2, BRANCA)],
  semaforo: [fonte(2.4, 4.76, 0.2, 1.3, VERMELHA)],
  ponto: [fonte(1.7, 1.55, 0.95, 2.6, AGUA, LUZ_CINTILA)],
  boia: [fonte(0, 3.6, 0, 2.4, LARANJA, LUZ_PISCA)],
  antena: [fonte(0, 48.6, 0, 4.8, VERMELHA, LUZ_PISCA)],
  farol: [fonte(0, 35.9, 0, 15, DOURADA, LUZ_RESPIRA)],
  lancha: [fonte(-2.2, 3.4, 0, 3, VERMELHA, LUZ_PISCA)],
  navioDeCabos: [fonte(12, 36.5, 0, 9, BRANCA), fonte(14, 18.8, 7.9, 5, VERDE), fonte(14, 18.8, -7.9, 5, VERMELHA)],
  navioRebelde: [
    fonte(-14, 34.5, -4, 5.5, VERMELHA, LUZ_PISCA), fonte(-14, 34.5, 4, 5.5, VERMELHA, LUZ_PISCA), fonte(-2, 34.5, 0, 5.5, VERMELHA, LUZ_PISCA),
    fonte(10, 21.5, 0, 5.5, VERMELHA, LUZ_PISCA), fonte(30, 7, 0, 5.5, VERMELHA, LUZ_PISCA),
  ],
};

/** Para o mundo: o ponto local `(lx, ly, lz)` do adereço `a` (escala, giro em Y e a altura da base ou d'água). */
export function pontoDoAdereco(a: Adereco, lx: number, ly: number, lz: number): [number, number, number] {
  const e = a.escala ?? 1;
  const c = Math.cos(a.giro);
  const s = Math.sin(a.giro);
  const base = (a.y ?? 0) + (TIPOS_QUE_FLUTUAM.has(a.tipo) ? NIVEL_DO_MAR : 0);
  return [a.x + (lx * c + lz * s) * e, base + ly * e, a.z + (-lx * s + lz * c) * e];
}

/** Todas as luzes da praia (os halos): os pontos de luz dos adereços e o varal de cada barraca. */
export function luzesDaPraia(lista: readonly Adereco[] = praiaAderecos()): LuzDaPraia[] {
  const out: LuzDaPraia[] = [];
  for (const a of lista) {
    const e = a.escala ?? 1;
    const fase = a.x * 0.173 + a.z * 0.091;
    if (a.tipo === 'barraca') {
      for (let i = 0; i < LAMPADAS_DA_BARRACA.length; i++) {
        const [lx, ly, lz] = LAMPADAS_DA_BARRACA[i]!;
        const [x, y, z] = pontoDoAdereco(a, lx, ly, lz);
        out.push({ x, y, z, raio: 1.25, r: 1.2, g: 0.86, b: 0.5, modo: LUZ_RESPIRA, fase: fase + i * 0.7, ligaEm: ligaEmDoAdereco(a) });
      }
      continue;
    }
    const fontes = FONTES[a.tipo];
    if (!fontes) continue;
    fontes.forEach((f, i) => {
      const [x, y, z] = pontoDoAdereco(a, f.x, f.y, f.z);
      out.push({ x, y, z, raio: f.raio * e, r: f.cor[0], g: f.cor[1], b: f.cor[2], modo: f.modo, fase: fase + i * 1.9, ligaEm: ligaEmDoAdereco(a) });
    });
  }
  return out;
}

/** O centro do pátio da estação: onde os refletores apontam (a poça grande e os feixes). */
export const CENTRO_DO_PATIO = { x: 276, z: 51 } as const;

/** As poças de luz no chão: sob cada poste, na frente de cada barraca e a grande, no pátio, dos refletores. */
export function pocasDeLuz(lista: readonly Adereco[] = praiaAderecos()): PocaDeLuz[] {
  const out: PocaDeLuz[] = [];
  for (const a of lista) {
    if (a.tipo === 'poste') {
      if ((a.y ?? 0) > 0.5) continue; // o poste do píer ilumina o tabuleiro metálico, que já é claro
      const [x, , z] = pontoDoAdereco(a, 1.3, 0, 0);
      out.push({ x, y: Math.max(alturaDoChao(x, z), 0.09) + 0.04, z, raio: 6.4, forca: 0.5, r: SODIO[0], g: SODIO[1], b: SODIO[2] });
    } else if (a.tipo === 'barraca') {
      const [x, , z] = frenteDaBarraca(a);
      out.push({ x, y: alturaDoChao(x, z) + 0.05, z, raio: 7.5, forca: 0.3, r: 1.2, g: 0.86, b: 0.5 });
    }
  }
  out.push({ x: CENTRO_DO_PATIO.x, y: 0.12, z: CENTRO_DO_PATIO.z, raio: 17, forca: 0.55, r: BRANCA[0], g: BRANCA[1], b: BRANCA[2] });
  return out;
}

/** O chão logo na frente da barraca (para o mar): onde a luz do varal cai. */
function frenteDaBarraca(a: Adereco): [number, number, number] {
  return pontoDoAdereco(a, 0, 0, -3.4);
}

/** Os feixes parados dos refletores: do banco de lâmpadas até o centro do pátio da estação. */
export function feixesDosRefletores(lista: readonly Adereco[] = praiaAderecos()): FeixeDeLuz[] {
  const out: FeixeDeLuz[] = [];
  for (const a of lista) {
    if (a.tipo !== 'refletor') continue;
    const [x, y, z] = pontoDoAdereco(a, 0, 15.05, 0.55);
    out.push({ de: [x, y, z], para: [CENTRO_DO_PATIO.x, 0.2, CENTRO_DO_PATIO.z], raio: 8, alfa: 0.09, r: BRANCA[0], g: BRANCA[1], b: BRANCA[2] });
  }
  return out;
}

/** Os holofotes que giram: as torres de vigia da estação varrem o mar e a areia (um para cada lado). */
export function holofotesDaEstacao(lista: readonly Adereco[] = praiaAderecos()): Holofote[] {
  const out: Holofote[] = [];
  for (const a of lista) {
    if (a.tipo !== 'vigia') continue;
    const [x, y, z] = pontoDoAdereco(a, 0, 8, 1.3);
    const n = out.length;
    out.push({ x, y, z, velocidade: n % 2 === 0 ? 0.42 : -0.37, fase: n * 2.3, alcance: 120, raio: 7 });
  }
  return out;
}
