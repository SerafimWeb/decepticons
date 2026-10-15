import * as THREE from 'three';
import { DIRECAO_DO_SOL } from './PraiaCeu';
import { chaveDoAdereco, praiaAderecos, type Adereco } from './PraiaAderecos';
import { praiaColisores } from './PraiaColisores';
import { PRAIA_LIMITES } from './PraiaTerreno';

/**
 * AS SOMBRAS ASSADAS DA PRAIA DOS CABOS (P127, rodada de luz): o mapa não tem sombra dinâmica (o estilo e a GPU integrada não pedem), mas
 * um chão sem sombra faz tudo flutuar — o guarda-sol, o coqueiro, o carro, o hotel ficam "colados" na areia. Aqui a sombra do sol poente
 * é **calculada uma vez, no carregamento**, e vira uma textura de duas camadas em coordenadas do mundo:
 *  - **R: a sombra do sol** — o polígono que cada prédio, muro, contêiner, coqueiro, guarda-sol, poste e guindaste projeta no chão,
 *    na direção oposta à do sol (para dentro da cidade);
 *  - **G: a oclusão de ambiente** — o escurecimento junto da base de tudo que é sólido (o pé da parede, o cantinho entre contêineres).
 * Os shaders do chão (o terreno, a pista, o calçadão, o pátio) leem a textura e apagam **só a luz direta** (o sol) na sombra — a luz do
 * céu continua, e a sombra sai fria (azulada), como no fim de tarde de verdade.
 *
 * **Custo:** zero por quadro (uma amostra de textura por pixel de chão); ~40 ms no carregamento, uma vez por processo (a textura é
 * memorizada). Mapa estático, sombra estática: os Mechs seguem com o disco de sombra deles (`fx/ShadowBlobs`).
 */

/** O lado do texel (m): 0,5 m → 1280 × 480 texels para os 640 × 240 m do mapa (1,2 MB). */
export const SOMBRA_RES_M = 0.5;
export const SOMBRA_AREA = { minX: PRAIA_LIMITES.minX, minZ: PRAIA_LIMITES.minZ, tamX: PRAIA_LIMITES.maxX - PRAIA_LIMITES.minX, tamZ: PRAIA_LIMITES.maxZ - PRAIA_LIMITES.minZ } as const;
export const SOMBRA_LARGURA = Math.round(SOMBRA_AREA.tamX / SOMBRA_RES_M);
export const SOMBRA_ALTURA = Math.round(SOMBRA_AREA.tamZ / SOMBRA_RES_M);

/**
 * O comprimento da sombra por metro de altura. O sol do desenho está a ~11° do horizonte (sombra de 5 vezes a altura: um hotel de 34 m
 * cobriria a cidade inteira); a sombra assada usa um sol um pouco mais alto (~18°): sombras longas — a marca do fim de tarde — sem apagar o mapa.
 */
export const COMPRIMENTO_DA_SOMBRA = 3;
/** Nenhuma sombra passa disto (m): o guindaste e o mastro riscariam o mapa de ponta a ponta. */
const SOMBRA_MAXIMA_M = 70;

type P = readonly [number, number];

/** Um polígono convexo no plano do chão (x, z, em metros) e a densidade dele (0 a 1). */
export interface Poligono {
  pontos: readonly P[];
  d: number;
  /** A chave (`chaveDoAdereco`) do adereço que projeta este polígono, quando é um adereço: é o que deixa apagar a sombra de um coqueiro quebrado (P138). */
  dono?: string;
}

export interface Oclusores {
  sombras: Poligono[];
  ao: Poligono[];
}

/** A direção para onde a sombra cai: a oposta à do sol, no plano do chão (unitária). */
const _n = Math.hypot(DIRECAO_DO_SOL.x, DIRECAO_DO_SOL.z);
export const DIRECAO_DA_SOMBRA: P = [-DIRECAO_DO_SOL.x / _n, -DIRECAO_DO_SOL.z / _n];

/** O quanto (m) a sombra de um ponto a `y` metros do chão se afasta da base. */
function desvio(y: number): number {
  return Math.min(COMPRIMENTO_DA_SOMBRA * Math.max(0, y), SOMBRA_MAXIMA_M);
}

/** O invólucro convexo (monotone chain) de um conjunto de pontos. */
export function casco(pontos: readonly P[]): P[] {
  const p = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cruz = (o: P, a: P, b: P): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const baixo: P[] = [];
  for (const q of p) {
    while (baixo.length >= 2 && cruz(baixo[baixo.length - 2]!, baixo[baixo.length - 1]!, q) <= 0) baixo.pop();
    baixo.push(q);
  }
  const alto: P[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (alto.length >= 2 && cruz(alto[alto.length - 2]!, alto[alto.length - 1]!, q) <= 0) alto.pop();
    alto.push(q);
  }
  baixo.pop();
  alto.pop();
  return [...baixo, ...alto];
}

/** Os quatro cantos de um retângulo `w × d` centrado em (cx, cz), girado `giro` rad em torno de Y. */
export function cantos(cx: number, cz: number, w: number, d: number, giro: number): P[] {
  const c = Math.cos(giro);
  const s = Math.sin(giro);
  const pts: P[] = [];
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]] as const) {
    pts.push([cx + lx * c + lz * s, cz - lx * s + lz * c]);
  }
  return pts;
}

/** A sombra de um prisma (a pegada `base`, de `y0` a `y1` m de altura): o casco da pegada deslocada por `desvio(y0)` e por `desvio(y1)`. */
export function sombraDoPrisma(base: readonly P[], y0: number, y1: number, d = 1): Poligono {
  const [dx, dz] = DIRECAO_DA_SOMBRA;
  const a = desvio(y0);
  const b = desvio(y1);
  const pts: P[] = [];
  for (const [x, z] of base) {
    pts.push([x + dx * a, z + dz * a], [x + dx * b, z + dz * b]);
  }
  return { pontos: casco(pts), d };
}

/** Uma elipse (n pontos) centrada em (cx, cz), com `ra` de raio ao longo da sombra e `rb` de través. */
function elipse(cx: number, cz: number, ra: number, rb: number, d: number, n = 12): Poligono {
  const [dx, dz] = DIRECAO_DA_SOMBRA;
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const u = Math.cos(a) * ra;
    const v = Math.sin(a) * rb;
    pts.push([cx + dx * u - dz * v, cz + dz * u + dx * v]);
  }
  return { pontos: pts, d };
}

/** Um traço (um poste, um tronco) de `a` a `b`, com `larg` m de largura. */
function traco(a: P, b: P, larg: number, d: number): Poligono {
  const vx = b[0] - a[0];
  const vz = b[1] - a[1];
  const n = Math.hypot(vx, vz) || 1;
  const px = (-vz / n) * (larg / 2);
  const pz = (vx / n) * (larg / 2);
  return { pontos: [[a[0] + px, a[1] + pz], [b[0] + px, b[1] + pz], [b[0] - px, b[1] - pz], [a[0] - px, a[1] - pz]], d };
}

/** Densidade da sombra pelo andar da altura: as fatias de cima de uma torre alta ficam mais leves (a sombra some no fim). */
const FATIA_M = 10;
function fatias(base: readonly P[], y0: number, y1: number): Poligono[] {
  const out: Poligono[] = [];
  const n = Math.max(1, Math.ceil((y1 - y0) / FATIA_M));
  for (let i = 0; i < n; i++) {
    const a = y0 + ((y1 - y0) * i) / n;
    const b = y0 + ((y1 - y0) * (i + 1)) / n;
    out.push(sombraDoPrisma(base, a, b, Math.max(0.42, 1 - 0.16 * i)));
  }
  return out;
}

/** As sombras de um adereço que NÃO é sólido (os sólidos entram pelos colisores): coqueiro, guarda-sol, poste e o telhado da barraca. */
function sombrasDoAdereco(a: Adereco, saida: Poligono[]): void {
  const antes = saida.length;
  poligonosDoAdereco(a, saida);
  const dono = chaveDoAdereco(a);
  for (let i = antes; i < saida.length; i++) saida[i]!.dono = dono;
}

function poligonosDoAdereco(a: Adereco, saida: Poligono[]): void {
  const e = a.escala ?? 1;
  const [dx, dz] = DIRECAO_DA_SOMBRA;
  const base: P = [a.x, a.z];
  switch (a.tipo) {
    case 'palmeira': {
      // O tronco se inclina para o +x local (1,7 m no alto); a copa é uma elipse esparsa no fim da sombra do tronco.
      const topo: P = [a.x + 1.7 * e * Math.cos(a.giro), a.z - 1.7 * e * Math.sin(a.giro)];
      const h = 10.5 * e;
      const fim: P = [topo[0] + dx * desvio(h), topo[1] + dz * desvio(h)];
      saida.push(traco(base, fim, 0.9 * e, 0.85), elipse(fim[0] + dx * 0.4, fim[1] + dz * 0.4, 3.6 * e, 3.1 * e, 0.7));
      break;
    }
    case 'guardasol': {
      const c: P = [a.x + dx * desvio(2.6 * e), a.z + dz * desvio(2.6 * e)];
      saida.push(elipse(c[0], c[1], 1.5 * e, 1.4 * e, 0.8, 10));
      break;
    }
    case 'poste': {
      if ((a.y ?? 0) > 0.5) break; // o poste do píer está sobre a água/tabuleiro
      saida.push(traco(base, [a.x + dx * desvio(7.2), a.z + dz * desvio(7.2)], 0.4, 0.7));
      break;
    }
    case 'barraca': {
      // O beiral de palha passa do corpo: um quadrado de 13 m a 3,2–5,6 m de altura.
      saida.push(sombraDoPrisma(cantos(a.x, a.z, 13, 13, a.giro + Math.PI / 4), 3.2, 5.6, 0.85));
      break;
    }
    case 'jangada': {
      const c: P = [a.x + dx * desvio(2.8), a.z + dz * desvio(2.8)];
      saida.push(elipse(c[0], c[1], 1.7, 0.6, 0.7, 8));
      break;
    }
    default:
      break;
  }
}

/** Todos os oclusores do mapa: as sombras do sol e a oclusão de ambiente. Pura e determinística. */
export function oclusoresDaPraia(): Oclusores {
  const sombras: Poligono[] = [];
  const ao: Poligono[] = [];
  for (const c of praiaColisores()) {
    if (c.rx || c.rz) continue; // as rampas são baixas: sem sombra
    const y1 = c.y + c.h / 2;
    const y0 = Math.max(0, c.y - c.h / 2);
    if (y1 < 0.5) continue;
    const pegada = cantos(c.x, c.z, c.w, c.d, c.giro ?? 0);
    sombras.push(...fatias(pegada, y0, y1));
    if (y0 < 1) ao.push({ pontos: cantos(c.x, c.z, c.w + 2.6, c.d + 2.6, c.giro ?? 0), d: 0.55 });
  }
  for (const a of praiaAderecos()) {
    sombrasDoAdereco(a, sombras);
    if (a.tipo === 'palmeira') ao.push({ ...elipse(a.x, a.z, 1.0 * (a.escala ?? 1), 1.0 * (a.escala ?? 1), 0.4, 8), dono: chaveDoAdereco(a) });
  }
  return { sombras, ao };
}

/** Preenche um polígono convexo num plano de `largura × altura` texels, no canal, com a densidade (composição pelo máximo). */
function preenche(plano: Uint8Array, largura: number, altura: number, poligono: Poligono, origemI = 0, origemJ = 0): void {
  const pts = poligono.pontos.map(([x, z]) => [(x - SOMBRA_AREA.minX) / SOMBRA_RES_M - origemI, (z - SOMBRA_AREA.minZ) / SOMBRA_RES_M - origemJ] as const);
  if (pts.length < 3) return;
  let minJ = Infinity;
  let maxJ = -Infinity;
  for (const [, y] of pts) {
    if (y < minJ) minJ = y;
    if (y > maxJ) maxJ = y;
  }
  const valor = Math.round(Math.max(0, Math.min(1, poligono.d)) * 255);
  const j0 = Math.max(0, Math.ceil(minJ - 0.5));
  const j1 = Math.min(altura - 1, Math.floor(maxJ - 0.5));
  for (let j = j0; j <= j1; j++) {
    const yc = j + 0.5;
    let xa = Infinity;
    let xb = -Infinity;
    for (let k = 0; k < pts.length; k++) {
      const [x0, y0] = pts[k]!;
      const [x1, y1] = pts[(k + 1) % pts.length]!;
      if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) {
        const x = x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0);
        if (x < xa) xa = x;
        if (x > xb) xb = x;
      }
    }
    if (xa === Infinity) continue;
    const i0 = Math.max(0, Math.ceil(xa - 0.5));
    const i1 = Math.min(largura - 1, Math.floor(xb - 0.5));
    const linha = j * largura;
    for (let i = i0; i <= i1; i++) if (plano[linha + i]! < valor) plano[linha + i] = valor;
  }
}

/** Desfoque de caixa separável, `passos` vezes, com `raio` texels: amacia a borda da sombra. Escreve no próprio plano. */
function desfoca(plano: Uint8Array, largura: number, altura: number, raio: number, passos: number): void {
  const tmp = new Float32Array(largura * altura);
  const tmp2 = new Float32Array(largura * altura);
  for (let i = 0; i < plano.length; i++) tmp[i] = plano[i]!;
  const janela = raio * 2 + 1;
  for (let p = 0; p < passos; p++) {
    // horizontal: tmp -> tmp2
    for (let j = 0; j < altura; j++) {
      const linha = j * largura;
      let soma = 0;
      for (let i = -raio; i <= raio; i++) soma += tmp[linha + Math.max(0, Math.min(largura - 1, i))]!;
      for (let i = 0; i < largura; i++) {
        tmp2[linha + i] = soma / janela;
        soma += tmp[linha + Math.min(largura - 1, i + raio + 1)]! - tmp[linha + Math.max(0, i - raio)]!;
      }
    }
    // vertical: tmp2 -> tmp
    for (let i = 0; i < largura; i++) {
      let soma = 0;
      for (let j = -raio; j <= raio; j++) soma += tmp2[Math.max(0, Math.min(altura - 1, j)) * largura + i]!;
      for (let j = 0; j < altura; j++) {
        tmp[j * largura + i] = soma / janela;
        soma += tmp2[Math.min(altura - 1, j + raio + 1) * largura + i]! - tmp2[Math.max(0, j - raio) * largura + i]!;
      }
    }
  }
  for (let i = 0; i < plano.length; i++) plano[i] = Math.round(tmp[i]!);
}

/** As camadas de sombra (R) e oclusão (G) em texels, intercaladas (`RG`, 2 bytes por texel). Memorizada: o mapa é estático. */
export interface DadosDeSombra {
  largura: number;
  altura: number;
  /** `[sombra, ao, sombra, ao, ...]`, 0 = claro, 255 = escuro. */
  dados: Uint8Array;
}

let memorizado: DadosDeSombra | null = null;
let oclusoresMemo: Oclusores | null = null;
const oclusoresDoMapa = (): Oclusores => (oclusoresMemo ??= oclusoresDaPraia());

/** O desfoque (raio e passos) de cada camada: a penumbra do sol (~1 m) e a da oclusão. O alcance dele diz o tamanho da janela de `recalculaJanela`. */
const DESFOQUE_SOL = { raio: 1, passos: 2 } as const;
const DESFOQUE_AO = { raio: 3, passos: 2 } as const;
const ALCANCE_DO_DESFOQUE = Math.max(DESFOQUE_SOL.raio * DESFOQUE_SOL.passos, DESFOQUE_AO.raio * DESFOQUE_AO.passos);

/** O cálculo completo, sem memória: as duas camadas intercaladas, sem os adereços de `ocultos` (as chaves dos quebrados). Puro e determinístico. */
export function dadosCompletos(ocultosDe: ReadonlySet<string> = new Set()): Uint8Array {
  const n = SOMBRA_LARGURA * SOMBRA_ALTURA;
  const sol = new Uint8Array(n);
  const oclusao = new Uint8Array(n);
  const { sombras, ao } = oclusoresDoMapa();
  for (const p of sombras) if (!p.dono || !ocultosDe.has(p.dono)) preenche(sol, SOMBRA_LARGURA, SOMBRA_ALTURA, p);
  for (const p of ao) if (!p.dono || !ocultosDe.has(p.dono)) preenche(oclusao, SOMBRA_LARGURA, SOMBRA_ALTURA, p);
  desfoca(sol, SOMBRA_LARGURA, SOMBRA_ALTURA, DESFOQUE_SOL.raio, DESFOQUE_SOL.passos); // penumbra de ~1 m
  desfoca(oclusao, SOMBRA_LARGURA, SOMBRA_ALTURA, DESFOQUE_AO.raio, DESFOQUE_AO.passos);
  const dados = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) {
    dados[i * 2] = sol[i]!;
    dados[i * 2 + 1] = oclusao[i]!;
  }
  return dados;
}

export function dadosDeSombra(): DadosDeSombra {
  if (memorizado) return memorizado;
  memorizado = { largura: SOMBRA_LARGURA, altura: SOMBRA_ALTURA, dados: dadosCompletos() };
  return memorizado;
}

// ─── Sombra que some junto com o adereço quebrado (P138) ──────────────────────────────────────────────────────
/** As chaves dos adereços quebrados agora: a sombra e a oclusão deles não valem. */
const ocultos = new Set<string>();

/** A caixa (em texels, inclusive) onde os polígonos do dono `chave` caem; `null` se ele não projeta nada. */
function pegadaDe(chave: string): { i0: number; j0: number; i1: number; j1: number } | null {
  let i0 = Infinity;
  let j0 = Infinity;
  let i1 = -Infinity;
  let j1 = -Infinity;
  const { sombras, ao } = oclusoresDoMapa();
  for (const lista of [sombras, ao]) {
    for (const p of lista) {
      if (p.dono !== chave) continue;
      for (const [x, z] of p.pontos) {
        const i = (x - SOMBRA_AREA.minX) / SOMBRA_RES_M;
        const j = (z - SOMBRA_AREA.minZ) / SOMBRA_RES_M;
        if (i < i0) i0 = i;
        if (i > i1) i1 = i;
        if (j < j0) j0 = j;
        if (j > j1) j1 = j;
      }
    }
  }
  return i0 === Infinity ? null : { i0: Math.floor(i0), j0: Math.floor(j0), i1: Math.ceil(i1), j1: Math.ceil(j1) };
}

/** A caixa dos texels de um polígono (para saber se ele toca uma janela). */
function caixaDoPoligono(p: Poligono): { i0: number; j0: number; i1: number; j1: number } {
  let i0 = Infinity;
  let j0 = Infinity;
  let i1 = -Infinity;
  let j1 = -Infinity;
  for (const [x, z] of p.pontos) {
    const i = (x - SOMBRA_AREA.minX) / SOMBRA_RES_M;
    const j = (z - SOMBRA_AREA.minZ) / SOMBRA_RES_M;
    if (i < i0) i0 = i;
    if (i > i1) i1 = i;
    if (j < j0) j0 = j;
    if (j > j1) j1 = j;
  }
  return { i0, j0, i1, j1 };
}

/**
 * Recalcula **só a janela** em volta de uma pegada (e não os 600 mil texels do mapa): a janela de escrita é a pegada mais o alcance do desfoque
 * (onde o valor pode mudar), e a de cálculo é essa mais outro alcance (o contexto que o desfoque precisa para dar o mesmo número do cálculo
 * completo). Poucos milissegundos, no tiro que quebra um coqueiro.
 */
function recalculaJanela(pegada: { i0: number; j0: number; i1: number; j1: number }): void {
  const dados = dadosDeSombra().dados;
  const trava = (v: number, max: number): number => Math.max(0, Math.min(max, v));
  const a = ALCANCE_DO_DESFOQUE;
  const z = {
    i0: trava(pegada.i0 - a, SOMBRA_LARGURA - 1),
    j0: trava(pegada.j0 - a, SOMBRA_ALTURA - 1),
    i1: trava(pegada.i1 + a, SOMBRA_LARGURA - 1),
    j1: trava(pegada.j1 + a, SOMBRA_ALTURA - 1),
  };
  const w = {
    i0: trava(z.i0 - a, SOMBRA_LARGURA - 1),
    j0: trava(z.j0 - a, SOMBRA_ALTURA - 1),
    i1: trava(z.i1 + a, SOMBRA_LARGURA - 1),
    j1: trava(z.j1 + a, SOMBRA_ALTURA - 1),
  };
  const lw = w.i1 - w.i0 + 1;
  const lh = w.j1 - w.j0 + 1;
  const sol = new Uint8Array(lw * lh);
  const oclusao = new Uint8Array(lw * lh);
  const { sombras, ao } = oclusoresDoMapa();
  const toca = (p: Poligono): boolean => {
    const c = caixaDoPoligono(p);
    return c.i1 >= w.i0 - 1 && c.i0 <= w.i1 + 2 && c.j1 >= w.j0 - 1 && c.j0 <= w.j1 + 2;
  };
  for (const p of sombras) if ((!p.dono || !ocultos.has(p.dono)) && toca(p)) preenche(sol, lw, lh, p, w.i0, w.j0);
  for (const p of ao) if ((!p.dono || !ocultos.has(p.dono)) && toca(p)) preenche(oclusao, lw, lh, p, w.i0, w.j0);
  desfoca(sol, lw, lh, DESFOQUE_SOL.raio, DESFOQUE_SOL.passos);
  desfoca(oclusao, lw, lh, DESFOQUE_AO.raio, DESFOQUE_AO.passos);
  for (let j = z.j0; j <= z.j1; j++) {
    for (let i = z.i0; i <= z.i1; i++) {
      const k = (j * SOMBRA_LARGURA + i) * 2;
      const l = (j - w.j0) * lw + (i - w.i0);
      dados[k] = sol[l]!;
      dados[k + 1] = oclusao[l]!;
    }
  }
  if (textura) textura.needsUpdate = true;
}

/** O adereço se quebrou: some a sombra e a oclusão dele do chão (só a janela em volta). */
export function ocultarSombrasDe(a: Adereco): void {
  const chave = chaveDoAdereco(a);
  if (ocultos.has(chave)) return;
  ocultos.add(chave);
  const pegada = pegadaDe(chave);
  if (pegada) recalculaJanela(pegada);
}

/** O adereço voltou (rodada nova): a sombra dele volta. */
export function mostrarSombrasDe(a: Adereco): void {
  const chave = chaveDoAdereco(a);
  if (!ocultos.delete(chave)) return;
  const pegada = pegadaDe(chave);
  if (pegada) recalculaJanela(pegada);
}

/** Uma partida nova no mesmo processo: nenhum adereço está quebrado, e o chão volta a ser o do carregamento (cálculo completo, só se algo estava oculto). */
export function restaurarSombras(): void {
  if (ocultos.size === 0) return;
  ocultos.clear();
  dadosDeSombra().dados.set(dadosCompletos());
  if (textura) textura.needsUpdate = true;
}

/** Quantos adereços estão com a sombra apagada agora (para os testes). */
export const sombrasOcultas = (): number => ocultos.size;

/** O valor (0 a 1) da sombra do sol e da oclusão em (x, z) do mundo, lido dos dados (para os testes e para quem precisar na CPU). */
export function sombraEm(x: number, z: number): { sol: number; ao: number } {
  const { largura, altura, dados } = dadosDeSombra();
  const i = Math.floor((x - SOMBRA_AREA.minX) / SOMBRA_RES_M);
  const j = Math.floor((z - SOMBRA_AREA.minZ) / SOMBRA_RES_M);
  if (i < 0 || j < 0 || i >= largura || j >= altura) return { sol: 0, ao: 0 };
  const k = (j * largura + i) * 2;
  return { sol: dados[k]! / 255, ao: dados[k + 1]! / 255 };
}

let textura: THREE.DataTexture | null = null;

/** A textura das sombras (a mesma para todos os mapas montados no processo). */
export function texturaDeSombras(): THREE.DataTexture {
  if (textura) return textura;
  const { largura, altura, dados } = dadosDeSombra();
  const t = new THREE.DataTexture(dados, largura, altura, THREE.RGFormat, THREE.UnsignedByteType);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  textura = t;
  return t;
}
