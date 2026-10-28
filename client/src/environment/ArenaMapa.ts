/**
 * A PLANTA DA CIDADE NEON PARA CONTA (P268, a praça urbana): o chão da arena visto de cima, como dado puro (sem Three, sem DOM, sem física), para conferir o que um mapa de combate tem de ter
 * e que o olho não confere: **ninguém fica preso** (todo canto da praça é alcançável de todo ponto de nascimento, para o Mech de 1,3 m de raio e para o Colossus-01 de 3,6 m), **nenhuma fresta fecha
 * o Mech no meio** (entre dois obstáculos o vão é zero ou largo o bastante para passar), e **o alcance cai** (quanto da praça um Mech enxerga em linha reta, a olho de Mech e a olho de andróide).
 * `ArenaUrbana.test.ts` trava isso; o relatório do PR tira os números das mesmas funções.
 *
 * Tudo em metros, no plano x/z (x leste, z sul). Um obstáculo é uma caixa alinhada aos eixos que vai do chão até `h`.
 */

export interface Obstaculo {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  /** A altura do topo (m): decide se o Mech passa por cima (degrau) e se a caixa tapa a vista. */
  readonly h: number;
  readonly nome: string;
}

/** O lado da praça jogável (m do centro): a avenida e a cidade começam depois (`CidadeNeonLayout.ts`, `RUA.calcadao`). */
export const MEIA_PRACA = 84.5;

/** A caixa a partir do centro e do tamanho (a forma que `Arena.ts` usa). */
export const caixa = (nome: string, x: number, z: number, w: number, d: number, h: number): Obstaculo => ({ nome, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h });

/** A menor distância entre duas caixas no plano (0 se se tocam ou se cruzam). */
export function vao(a: Obstaculo, b: Obstaculo): number {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1, 0);
  const dz = Math.max(a.z0 - b.z1, b.z0 - a.z1, 0);
  return Math.hypot(dx, dz);
}

/** A tolerância de ponto flutuante: duas bordas a menos de 1 µm uma da outra estão encostadas (os degraus do playground são somas de 1,6 m). */
const EPS = 1e-6;

/** As caixas se cruzam (tocar na borda não conta)? */
export function cruzam(a: Obstaculo, b: Obstaculo): boolean {
  return a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS;
}

/**
 * Os vãos que **prendem**: pares de obstáculos que se enfrentam, separados por mais de zero e menos que `minimo` (o Mech de raio `r` precisa de `2r` e uma folga para virar), com o vão **vazio**.
 * Fresta menor que a passagem do Mech é armadilha para quem entra por ela (o piloto e o bot): ou a caixa encosta na outra, ou deixa passar. Um vão que outro obstáculo preenche (os degraus
 * entre a plataforma e o chão, a rampa) não é fresta: o degrau está dentro dele. Só conta quando os dois lados se enfrentam (as faixas se sobrepõem num eixo): em quina o vão é a diagonal, aberta.
 */
export function frestasQuePrendem(obstaculos: readonly Obstaculo[], minimo: number): { a: string; b: string; vao: number }[] {
  const achadas: { a: string; b: string; vao: number }[] = [];
  for (let i = 0; i < obstaculos.length; i++) {
    for (let j = i + 1; j < obstaculos.length; j++) {
      const a = obstaculos[i]!;
      const b = obstaculos[j]!;
      if (cruzam(a, b)) continue;
      const sobrepoeX = a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS;
      const sobrepoeZ = a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS;
      if (!sobrepoeX && !sobrepoeZ) continue; // só em quina: o vão é a diagonal, aberto
      const v = vao(a, b);
      if (!(v > EPS && v < minimo)) continue;
      // O retângulo do vão: a faixa em comum entre as duas caixas, do fim de uma ao começo da outra.
      const retangulo: Obstaculo = sobrepoeX
        ? { nome: '', h: 0, x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), z0: a.z1 <= b.z0 ? a.z1 : b.z1, z1: a.z1 <= b.z0 ? b.z0 : a.z0 }
        : { nome: '', h: 0, z0: Math.max(a.z0, b.z0), z1: Math.min(a.z1, b.z1), x0: a.x1 <= b.x0 ? a.x1 : b.x1, x1: a.x1 <= b.x0 ? b.x0 : a.x0 };
      const preenchido = obstaculos.some((o, k) => k !== i && k !== j && cruzam(o, retangulo));
      if (!preenchido) achadas.push({ a: a.nome, b: b.nome, vao: +v.toFixed(2) });
    }
  }
  return achadas;
}

/** A grade de células livres da praça: 1 = o centro de um Mech de raio `raio` cabe ali (sem tocar em nenhum obstáculo que ele não transponha); 0 = ocupada. */
export interface Grade {
  readonly passo: number;
  readonly lado: number;
  readonly livre: Uint8Array;
}

/** Monta a grade. Obstáculo de topo até `transponivel` m não conta (o Mech sobe o degrau ou passa por cima: `stepHeight` do Colossus é 3,2 m). */
export function montarGrade(obstaculos: readonly Obstaculo[], raio: number, transponivel = 0, passo = 1): Grade {
  const lado = Math.ceil((2 * MEIA_PRACA) / passo);
  const livre = new Uint8Array(lado * lado).fill(1);
  for (const o of obstaculos) {
    if (o.h <= transponivel) continue;
    const i0 = Math.max(0, Math.floor((o.x0 - raio + MEIA_PRACA) / passo));
    const i1 = Math.min(lado - 1, Math.ceil((o.x1 + raio + MEIA_PRACA) / passo) - 1);
    const j0 = Math.max(0, Math.floor((o.z0 - raio + MEIA_PRACA) / passo));
    const j1 = Math.min(lado - 1, Math.ceil((o.z1 + raio + MEIA_PRACA) / passo) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) livre[j * lado + i] = 0;
  }
  // A borda da praça: o centro do Mech não chega a menos de `raio` da parede.
  for (let j = 0; j < lado; j++) {
    for (let i = 0; i < lado; i++) {
      const cx = -MEIA_PRACA + (i + 0.5) * passo;
      const cz = -MEIA_PRACA + (j + 0.5) * passo;
      if (Math.abs(cx) > MEIA_PRACA - raio || Math.abs(cz) > MEIA_PRACA - raio) livre[j * lado + i] = 0;
    }
  }
  return { passo, lado, livre };
}

const indice = (g: Grade, x: number, z: number): number => Math.floor((z + MEIA_PRACA) / g.passo) * g.lado + Math.floor((x + MEIA_PRACA) / g.passo);

/** A célula do ponto `(x, z)` está livre? */
export function pontoLivre(g: Grade, x: number, z: number): boolean {
  if (Math.abs(x) >= MEIA_PRACA || Math.abs(z) >= MEIA_PRACA) return false;
  return g.livre[indice(g, x, z)] === 1;
}

/** Os componentes conectados da grade (vizinhança de 4): `rotulos[c]` = o número do componente da célula (0 = ocupada) e `tamanhos[n]` = quantas células tem o componente `n`. */
export function componentes(g: Grade): { rotulos: Int32Array; tamanhos: number[] } {
  const rotulos = new Int32Array(g.lado * g.lado);
  const tamanhos: number[] = [0];
  const fila: number[] = [];
  for (let c = 0; c < rotulos.length; c++) {
    if (g.livre[c] !== 1 || rotulos[c] !== 0) continue;
    const n = tamanhos.length;
    let total = 0;
    rotulos[c] = n;
    fila.length = 0;
    fila.push(c);
    for (let k = 0; k < fila.length; k++) {
      const cur = fila[k]!;
      total++;
      const i = cur % g.lado;
      const j = (cur - i) / g.lado;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= g.lado || nj >= g.lado) continue;
        const nc = nj * g.lado + ni;
        if (g.livre[nc] === 1 && rotulos[nc] === 0) {
          rotulos[nc] = n;
          fila.push(nc);
        }
      }
    }
    tamanhos.push(total);
  }
  return { rotulos, tamanhos };
}

/** O componente de um ponto (0 se o ponto está ocupado ou fora). */
export function componenteDe(g: Grade, rotulos: Int32Array, x: number, z: number): number {
  return pontoLivre(g, x, z) ? rotulos[indice(g, x, z)]! : 0;
}

/**
 * O segmento de `(ax, az)` a `(bx, bz)` passa livre, à altura do olho `olho` (m)? Só tapam a vista os obstáculos cujo topo chega à altura do olho. Método das lajes (o mesmo de
 * `CidadeNeonLayout.segmentoBateNaCaixa`, no plano).
 */
export function linhaLivre(ax: number, az: number, bx: number, bz: number, obstaculos: readonly Obstaculo[], olho: number): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  for (const o of obstaculos) {
    if (o.h < olho) continue;
    let t0 = 0;
    let t1 = 1;
    for (const [p, d, lo, hi] of [[ax, dx, o.x0, o.x1], [az, dz, o.z0, o.z1]] as const) {
      if (Math.abs(d) < 1e-9) {
        if (p < lo || p > hi) {
          t0 = 2;
          break;
        }
      } else {
        const ta = (lo - p) / d;
        const tb = (hi - p) / d;
        t0 = Math.max(t0, Math.min(ta, tb));
        t1 = Math.min(t1, Math.max(ta, tb));
      }
    }
    if (t0 <= t1) return false;
  }
  return true;
}

/** Um gerador de números de 0 a 1 com semente (os testes e o relatório amostram sempre os mesmos pares: nada de `Math.random`). */
function sorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * O alcance de combate: de `pares` pares de pontos livres sorteados (com a semente, sempre os mesmos), a fração que se **enxerga em linha reta** a olho de Mech (`olho` m) quando a distância
 * está entre `de` e `ate` m. É a medida de "reduzir o alcance": quanto menos pares a longa distância se enxergam, mais a praça obriga o combate de perto.
 */
export function fracaoQueSeEnxerga(obstaculos: readonly Obstaculo[], olho: number, de: number, ate: number, pares = 4000, semente = 267): number {
  const g = montarGrade(obstaculos, 0.5, 0, 1);
  const r = sorteio(semente);
  let vistos = 0;
  let total = 0;
  let tentativas = 0;
  while (total < pares && tentativas < pares * 60) {
    tentativas++;
    const ax = (r() * 2 - 1) * (MEIA_PRACA - 1);
    const az = (r() * 2 - 1) * (MEIA_PRACA - 1);
    const bx = (r() * 2 - 1) * (MEIA_PRACA - 1);
    const bz = (r() * 2 - 1) * (MEIA_PRACA - 1);
    const d = Math.hypot(bx - ax, bz - az);
    if (d < de || d > ate) continue;
    if (!pontoLivre(g, ax, az) || !pontoLivre(g, bx, bz)) continue;
    total++;
    if (linhaLivre(ax, az, bx, bz, obstaculos, olho)) vistos++;
  }
  return total ? vistos / total : 0;
}

/** O maior trecho de linha reta livre (a olho de Mech) a partir de um ponto, nas 16 direções: o "corredor de tiro" mais longo que o ponto tem (m). */
export function corredorMaisLongo(x: number, z: number, obstaculos: readonly Obstaculo[], olho: number, alcanceMaximo = 200): number {
  let melhor = 0;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    let lo = 0;
    // Só vale o que está dentro da praça: a linha para na borda (a parede invisível da arena).
    let hi = Math.min(alcanceMaximo, cx > 1e-9 ? (MEIA_PRACA - x) / cx : cx < -1e-9 ? (-MEIA_PRACA - x) / cx : Infinity, cz > 1e-9 ? (MEIA_PRACA - z) / cz : cz < -1e-9 ? (-MEIA_PRACA - z) / cz : Infinity);
    // busca binária do primeiro ponto em que a linha deixa de ser livre
    if (!linhaLivre(x, z, x + Math.cos(a) * hi, z + Math.sin(a) * hi, obstaculos, olho)) {
      for (let i = 0; i < 18; i++) {
        const meio = (lo + hi) / 2;
        if (linhaLivre(x, z, x + Math.cos(a) * meio, z + Math.sin(a) * meio, obstaculos, olho)) lo = meio;
        else hi = meio;
      }
      melhor = Math.max(melhor, lo);
    } else melhor = Math.max(melhor, hi);
  }
  return Math.min(melhor, alcanceMaximo);
}

/** A abertura média de um ponto: a média, nas `direcoes` direções, do trecho de vista livre (a olho de Mech) até o primeiro obstáculo ou a borda da praça (m). Quanto menor, mais fechado é o lugar. */
export function aberturaMedia(x: number, z: number, obstaculos: readonly Obstaculo[], olho: number, direcoes = 32, alcanceMaximo = 200): number {
  let soma = 0;
  for (let k = 0; k < direcoes; k++) {
    const a = ((k + 0.5) / direcoes) * Math.PI * 2;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    let lo = 0;
    let hi = Math.min(alcanceMaximo, cx > 1e-9 ? (MEIA_PRACA - x) / cx : cx < -1e-9 ? (-MEIA_PRACA - x) / cx : Infinity, cz > 1e-9 ? (MEIA_PRACA - z) / cz : cz < -1e-9 ? (-MEIA_PRACA - z) / cz : Infinity);
    if (!linhaLivre(x, z, x + cx * hi, z + cz * hi, obstaculos, olho)) {
      for (let i = 0; i < 16; i++) {
        const meio = (lo + hi) / 2;
        if (linhaLivre(x, z, x + cx * meio, z + cz * meio, obstaculos, olho)) lo = meio;
        else hi = meio;
      }
      soma += lo;
    } else soma += hi;
  }
  return soma / direcoes;
}
