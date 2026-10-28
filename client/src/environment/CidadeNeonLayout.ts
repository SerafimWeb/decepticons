import { CITY_NEON, PALETTE } from '../core/palette';
import { mulberry32 } from '../core/rng';

/**
 * O ENTORNO DA CIDADE NEON (P264, PR2). O Comandante mandou quatro quadros de uma cidade cyberpunk e escreveu "quero que o cenário fique nesse
 * nível": antes de qualquer detalhe, o que aqueles quadros têm e a Cidade Neon não tinha é **estar dentro de uma cidade** — a praça de combate
 * (±100 m) cercada por um paredão de torres cobertas de janelas, telões e letreiros, e mais duas camadas de torres atrás, sumindo na névoa.
 *
 * Este arquivo é só o **dado** (sem Three, sem DOM, roda no Node): onde fica cada torre, cada telão, cada letreiro e cada desenho em neon. Semente
 * fixa: a mesma cidade em toda partida. Quem desenha é `CidadeNeonCenario.ts`, num pedaço carregado sob demanda (`mapasSobDemanda.ts`).
 * **Nada aqui tem colisão:** tudo fica fora da praça (a parede invisível da Arena, em ±100 m, segura Mech, bot e câmera do lado de dentro).
 */

/** 0 = torre (com loja no térreo), 1 = coroa (o recuo no alto de uma torre), 2 = antena. */
export type TipoDeTorre = 0 | 1 | 2;

/** Uma caixa do entorno, alinhada aos eixos, apoiada em `y0`. */
export interface TorreDaCidade {
  readonly x: number;
  readonly z: number;
  /** Largura em x, profundidade em z e altura (m). */
  readonly w: number;
  readonly d: number;
  readonly h: number;
  /** Onde a base apoia: 0 no chão; a coroa e a antena sentam no teto de quem as carrega. */
  readonly y0: number;
  /** 1 = a fachada da praça, 2 = a segunda fila, 3 = o fundo na névoa. */
  readonly anel: 1 | 2 | 3;
  readonly tipo: TipoDeTorre;
  /** A cor de destaque (faixas e quina), da paleta da cidade. */
  readonly cor: number;
  /** 0 a 1: o sorteio do desenho das janelas (passo, andar, faixas). */
  readonly semente: number;
  /** A fração média das janelas acesas. */
  readonly ocupacao: number;
}

/** Um telão de propaganda encostado numa fachada, virado para a praça. */
export interface TelaoDaCidade {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Rotação em Y: o plano nasce olhando para +z. */
  readonly ry: number;
  readonly w: number;
  readonly h: number;
  /** Em pé (1:2) ou deitado (2:1): cada formato tem os seus quatro anúncios no atlas. */
  readonly vertical: boolean;
  /** Qual dos quatro anúncios do formato abre o ciclo. */
  readonly primeiro: number;
  /** Deslocamento do ciclo (s) e quanto tempo cada anúncio fica (s): os telões não trocam juntos. */
  readonly fase: number;
  readonly periodo: number;
}

/** Um letreiro vertical "de bandeira": sai perpendicular da fachada, as duas faces olhando ao longo da rua. */
export interface LetreiroDaCidade {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly ry: number;
  /** Espessura (eixo x local), quanto sai da parede (z local) e altura (m). */
  readonly espessura: number;
  readonly largura: number;
  readonly altura: number;
  /** Qual coluna de glifos do atlas (0 a `COLUNAS_DE_GLIFOS` − 1). */
  readonly coluna: number;
  readonly cor: number;
  readonly semente: number;
}

/** Um desenho em tubo de neon (contorno) pregado na fachada. */
export interface NeonDaCidade {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly ry: number;
  readonly lado: number;
  /** Qual desenho do atlas (0 a `DESENHOS_DE_NEON` − 1). */
  readonly desenho: number;
  readonly cor: number;
  readonly semente: number;
}

/** Um poste de rua na calçada da praça: a base, para onde o braço aponta (a avenida) e a luz. */
export interface PosteDaRua {
  readonly x: number;
  readonly z: number;
  /** Rotação em Y: o braço nasce apontando para +z. */
  readonly ry: number;
  /** Para onde o braço aponta (a avenida), em x e z: a cabeça fica a `BRACO_DO_POSTE` m da base. */
  readonly fx: number;
  readonly fz: number;
  /** A luz da cabeça e a faixa de neon do poste. */
  readonly corLuz: number;
  readonly corFaixa: number;
  /** A fase do respirar da luz e se o poste tem defeito (pisca e falha). */
  readonly fase: number;
  readonly defeito: boolean;
}

/** Uma tampa de bueiro (na avenida) ou uma grelha (na calçada de fora, junto das fachadas): as duas soltam vapor. */
export interface BueiroDaRua {
  readonly x: number;
  readonly z: number;
  readonly grelha: boolean;
  readonly periodo: number;
}

export interface LayoutDaCidade {
  readonly torres: readonly TorreDaCidade[];
  readonly teloes: readonly TelaoDaCidade[];
  readonly letreiros: readonly LetreiroDaCidade[];
  readonly neons: readonly NeonDaCidade[];
  readonly postes: readonly PosteDaRua[];
  readonly bueiros: readonly BueiroDaRua[];
}

/** Quantas colunas de glifos e quantos desenhos o atlas dos letreiros tem (`CidadeNeonArte.ts` desenha exatamente estes). */
export const COLUNAS_DE_GLIFOS = 8;
export const DESENHOS_DE_NEON = 8;

/** Até onde vai a praça jogável (m): nada do entorno pode passar daqui para dentro. */
export const BORDA_DA_PRACA = 100;
/** A fachada mais perto da praça (m do centro): uma calçada de 5 m entre a borda e o paredão. */
const FACHADA_MIN = 105;

/**
 * O DESENHO DA RUA (o Comandante, ao ver os postes da PR1 soltos no quadriculado: "só se tiver o desenho das ruas, pois nesse quadriculado não achei
 * bom não"). A praça vira um **calçadão** cercado por uma **avenida** em anel quadrado, que corre junto da parede da arena: medidas em
 * "distância quadrada" do centro, `max(|x|, |z|)` (m). O piso (`CidadeNeonRua.ts`) e os postes leem daqui.
 */
export const RUA = Object.freeze({
  /** Até aqui é o calçadão (lajotas grandes). */
  calcadao: 84.5,
  /** O meio-fio: daqui até a parede é asfalto. */
  meioFio: 88,
  /** A borda de fora da avenida (a parede invisível da arena); dali para fora, a calçada das fachadas. */
  borda: BORDA_DA_PRACA,
  /** O centro de cada faixa de pedestre, ao longo do lado (m): o 0 em todos os lados, e mais uma em `+55` (norte e sul) ou `−55` (leste e oeste). */
  faixaDoMeio: 0,
  faixaDeLado: 55,
  /** Meia largura de uma faixa de pedestre (m, ao longo do lado). */
  meiaFaixa: 2.6,
});

/** Onde ficam os postes ao longo de cada lado da calçada (m). Nenhum em cima de faixa de pedestre nem na esquina. */
const POSTES_AO_LONGO = [-74, -46, -20, 20, 46, 74] as const;
/** Quanto o braço do poste avança sobre a avenida (m): a cabeça fica sobre a pista de dentro. */
export const BRACO_DO_POSTE = 3.9;
/** A altura da cabeça do poste (m). */
export const ALTURA_DO_POSTE = 10.4;

/** As caixas que um poste não pode ocupar (o prédio Serafim, que encosta na calçada do leste). */
const SEM_POSTE: readonly { x0: number; x1: number; z0: number; z1: number }[] = [{ x0: 72, x1: 88, z0: 32, z1: 48 }];

/** As cores dos letreiros e dos desenhos: as da cidade e um roxo (o rosa e o ciano dominam nas referências). */
const CORES_DE_NEON: readonly number[] = [...CITY_NEON, PALETTE.pink, PALETTE.cyan, 0xb04dff];

/** Um lado da praça: a direção que a fachada encara (para dentro) e a rotação de um plano que nasce olhando para +z. */
interface Lado {
  readonly nx: number;
  readonly nz: number;
  readonly ry: number;
}
const LADOS: readonly Lado[] = [
  { nx: 0, nz: 1, ry: 0 }, // a fila do norte (z negativo) olha para +z
  { nx: 0, nz: -1, ry: Math.PI }, // a do sul (z positivo) olha para −z
  { nx: 1, nz: 0, ry: Math.PI / 2 }, // a do oeste (x negativo) olha para +x
  { nx: -1, nz: 0, ry: -Math.PI / 2 }, // a do leste (x positivo) olha para −x
];

/** As medidas de uma fila de torres em volta da praça. */
interface Fila {
  readonly anel: 1 | 2;
  /** Distância da fachada até o centro (m). */
  readonly fachada: readonly [number, number];
  readonly largura: readonly [number, number];
  readonly vao: readonly [number, number];
  readonly fundo: readonly [number, number];
  /** Até onde a fila vai ao longo do lado (m): norte e sul cobrem as esquinas; oeste e leste ficam entre eles. */
  readonly alcanceNS: number;
  readonly alcanceLO: number;
}

const FILA_1: Fila = { anel: 1, fachada: [FACHADA_MIN, 112], largura: [12, 26], vao: [0.5, 5], fundo: [16, 28], alcanceNS: 128, alcanceLO: 104 };
const FILA_2: Fila = { anel: 2, fachada: [146, 170], largura: [20, 40], vao: [3, 12], fundo: [20, 34], alcanceNS: 196, alcanceLO: 145 };

let cache: LayoutDaCidade | null = null;

/** A cidade em volta da praça. Calculada uma vez (o resultado é imutável e o mesmo em toda chamada). */
export function layoutDaCidade(): LayoutDaCidade {
  cache ??= montar();
  return cache;
}

function montar(): LayoutDaCidade {
  const rand = mulberry32(0xc1dade);
  const entre = (a: number, b: number): number => a + (b - a) * rand();
  const umDe = <T>(lista: readonly T[]): T => lista[Math.floor(rand() * lista.length)]!;

  const torres: TorreDaCidade[] = [];
  const teloes: TelaoDaCidade[] = [];
  const letreiros: LetreiroDaCidade[] = [];
  const neons: NeonDaCidade[] = [];

  /** Coroa e antena no teto de uma torre alta: a silhueta deixa de ser uma caixa só. */
  const enfeitarTeto = (t: TorreDaCidade): void => {
    let topo = t.h;
    let cx = t.x;
    let cz = t.z;
    let lw = t.w;
    let ld = t.d;
    if (t.h > 48 && rand() < 0.55) {
      lw = t.w * entre(0.5, 0.8);
      ld = t.d * entre(0.5, 0.8);
      cx = t.x + (t.w - lw) * entre(-0.5, 0.5);
      cz = t.z + (t.d - ld) * entre(-0.5, 0.5);
      const h = entre(8, 26);
      torres.push({ x: cx, z: cz, w: lw, d: ld, h, y0: topo, anel: t.anel, tipo: 1, cor: t.cor, semente: rand(), ocupacao: t.ocupacao * 0.8 });
      topo += h;
    }
    if (t.h > 40 && rand() < 0.4) {
      const ax = cx + lw * entre(-0.3, 0.3);
      const az = cz + ld * entre(-0.3, 0.3);
      torres.push({ x: ax, z: az, w: 0.7, d: 0.7, h: entre(10, 26), y0: topo, anel: t.anel, tipo: 2, cor: PALETTE.signal, semente: rand(), ocupacao: 0 });
    }
  };

  /** Uma fila de torres em volta da praça, lado a lado, com becos entre elas; devolve as da frente (para pendurar telão e letreiro). */
  const fila = (f: Fila): { torre: TorreDaCidade; lado: Lado; fachada: number; ao: number }[] => {
    const frente: { torre: TorreDaCidade; lado: Lado; fachada: number; ao: number }[] = [];
    for (const lado of LADOS) {
      const alcance = lado.nz !== 0 ? f.alcanceNS : f.alcanceLO;
      // A tangente do lado (ao longo da fachada): perpendicular à normal.
      const tx = -lado.nz;
      const tz = lado.nx;
      let s = -alcance + entre(0, 3);
      while (s < alcance - 6) {
        const largura = Math.min(entre(f.largura[0], f.largura[1]), alcance - s);
        const fundo = entre(f.fundo[0], f.fundo[1]);
        const fachada = entre(f.fachada[0], f.fachada[1]);
        const ao = s + largura / 2;
        // O centro da base: atrás da fachada (contra a normal), na posição `ao` ao longo do lado.
        const cx = -lado.nx * (fachada + fundo / 2) + tx * ao;
        const cz = -lado.nz * (fachada + fundo / 2) + tz * ao;
        const baixa = f.anel === 1 && rand() < 0.32; // o gueto: um bloco baixo entre as torres
        const h = f.anel === 1 ? (baixa ? entre(16, 32) : entre(40, 104)) : entre(60, 172);
        const torre: TorreDaCidade = {
          x: cx,
          z: cz,
          w: lado.nz !== 0 ? largura : fundo,
          d: lado.nz !== 0 ? fundo : largura,
          h,
          y0: 0,
          anel: f.anel,
          tipo: 0,
          cor: umDe(CITY_NEON),
          semente: rand(),
          ocupacao: entre(0.32, 0.68),
        };
        torres.push(torre);
        enfeitarTeto(torre);
        frente.push({ torre, lado, fachada, ao });
        s += largura + entre(f.vao[0], f.vao[1]);
      }
    }
    return frente;
  };

  /** Um ponto na fachada (`ao` ao longo do lado, `recuo` m para dentro da praça a partir da parede). */
  const naFachada = (lado: Lado, fachada: number, ao: number, recuo: number): { x: number; z: number } => ({
    x: -lado.nx * (fachada - recuo) + -lado.nz * ao,
    z: -lado.nz * (fachada - recuo) + lado.nx * ao,
  });

  for (const { torre, lado, fachada, ao } of fila(FILA_1)) {
    const frenteM = lado.nz !== 0 ? torre.w : torre.d; // a largura da fachada que olha para a praça
    // O letreiro de bandeira numa quina (às vezes nas duas): sai da parede para a calçada, nunca passa da borda da praça.
    const quinas = rand() < 0.3 ? [-1, 1] : rand() < 0.8 ? [rand() < 0.5 ? -1 : 1] : [];
    for (const q of quinas) {
      const altura = Math.min(entre(7, 15), torre.h - 6);
      if (altura < 4) continue;
      const largura = entre(2.2, 3.2);
      const base = entre(4, Math.max(4.5, Math.min(12, torre.h - altura - 2)));
      // A 1,2–2,2 m da quina: o telão do meio para a 2,5 m dela, então os dois nunca se cruzam.
      const p = naFachada(lado, fachada, ao + q * (frenteM / 2 - entre(1.2, 2.2)), largura / 2 + 0.05);
      letreiros.push({ x: p.x, y: base + altura / 2, z: p.z, ry: lado.ry, espessura: 0.36, largura, altura, coluna: Math.floor(rand() * COLUNAS_DE_GLIFOS), cor: umDe(CORES_DE_NEON), semente: rand() });
    }
    // O meio da fachada: um telão em pé, um deitado, um desenho em neon, ou nada (a fachada só de janelas também é cidade).
    const r = rand();
    const util = frenteM - 5; // o meio livre entre os dois letreiros de quina
    if (r < 0.42 && util >= 7 && torre.h > 30) {
      const w = Math.min(entre(7, 12), util);
      const h = w * 2;
      const yMin = 7 + h / 2;
      const yMax = torre.h - 3 - h / 2;
      if (yMax > yMin) {
        const p = naFachada(lado, fachada, ao + entre(-1, 1) * Math.max(0, (util - w) / 2), 0.25);
        teloes.push({ x: p.x, y: entre(yMin, yMax), z: p.z, ry: lado.ry, w, h, vertical: true, primeiro: Math.floor(rand() * 4), fase: entre(0, 20), periodo: entre(6, 11) });
        continue;
      }
    }
    if (r < 0.74 && util >= 11) {
      const w = Math.min(entre(12, 24), util);
      const h = w / 2;
      const yMin = 6 + h / 2;
      const yMax = Math.min(torre.h - 3 - h / 2, 30);
      if (yMax > yMin) {
        const p = naFachada(lado, fachada, ao + entre(-1, 1) * Math.max(0, (util - w) / 2), 0.25);
        teloes.push({ x: p.x, y: entre(yMin, yMax), z: p.z, ry: lado.ry, w, h, vertical: false, primeiro: Math.floor(rand() * 4), fase: entre(0, 20), periodo: entre(6, 11) });
        continue;
      }
    }
    if (util >= 6 && rand() < 0.75) {
      const ladoN = Math.min(entre(6, 11), util);
      const yMax = Math.min(torre.h - 2 - ladoN / 2, 32);
      const yMin = 5 + ladoN / 2;
      if (yMax > yMin) {
        const p = naFachada(lado, fachada, ao + entre(-1, 1) * Math.max(0, (util - ladoN) / 2), 0.2);
        neons.push({ x: p.x, y: entre(yMin, yMax), z: p.z, ry: lado.ry, lado: ladoN, desenho: Math.floor(rand() * DESENHOS_DE_NEON), cor: umDe(CORES_DE_NEON), semente: rand() });
      }
    }
  }

  // A segunda fila: telões grandes e altos, que aparecem por cima do paredão da frente.
  for (const { torre, lado, fachada, ao } of fila(FILA_2)) {
    const frenteM = lado.nz !== 0 ? torre.w : torre.d;
    if (torre.h < 80 || rand() > 0.42) continue;
    const w = Math.min(entre(12, 20), frenteM - 4);
    const h = w * 2;
    const yMin = Math.max(46, 8 + h / 2);
    const yMax = torre.h - 5 - h / 2;
    if (yMax <= yMin) continue;
    const p = naFachada(lado, fachada, ao + entre(-1, 1) * Math.max(0, (frenteM - 4 - w) / 2), 0.3);
    teloes.push({ x: p.x, y: entre(yMin, yMax), z: p.z, ry: lado.ry, w, h, vertical: true, primeiro: Math.floor(rand() * 4), fase: entre(0, 20), periodo: entre(7, 13) });
  }

  // O fundo: arranha-céus espalhados num anel quadrado (como as filas de dentro) além da segunda fila, que a névoa transforma em silhueta com janelas.
  // Em "distância quadrada" de 236 a 330 m: a segunda fila acaba em 204 m e a maior torre do fundo tem 27 m de meia largura, então nenhuma a cruza (o teste confere).
  const FUNDO = 46;
  for (let i = 0; i < FUNDO; i++) {
    const ang = (i / FUNDO) * Math.PI * 2 + entre(-0.05, 0.05);
    const dist = entre(236, 330);
    const quadrado = dist / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
    const torre: TorreDaCidade = {
      x: Math.cos(ang) * quadrado,
      z: Math.sin(ang) * quadrado,
      w: entre(26, 54),
      d: entre(26, 54),
      h: entre(90, 260),
      y0: 0,
      anel: 3,
      tipo: 0,
      cor: umDe(CITY_NEON),
      semente: rand(),
      ocupacao: entre(0.3, 0.6),
    };
    torres.push(torre);
    enfeitarTeto(torre);
  }

  // Os postes: na calçada da praça, a mesma distância do centro em todo lado, o braço sobre a avenida. Uns poucos com defeito (piscam e falham).
  const postes: PosteDaRua[] = [];
  const naCalcada = (RUA.calcadao + RUA.meioFio) / 2 + 0.2;
  for (const lado of LADOS) {
    // A normal do lado aponta para dentro (a praça); o braço aponta para fora (a avenida).
    const fx = -lado.nx;
    const fz = -lado.nz;
    for (const ao of POSTES_AO_LONGO) {
      const x = fx * naCalcada - lado.nz * ao;
      const z = fz * naCalcada + lado.nx * ao;
      if (SEM_POSTE.some((c) => x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1)) continue;
      postes.push({ x, z, ry: Math.atan2(fx, fz), fx, fz, corLuz: rand() < 0.7 ? 0xffc98a : 0xcfeeff, corFaixa: umDe(CORES_DE_NEON), fase: rand() * Math.PI * 2, defeito: rand() < 0.22 });
    }
  }

  // Os bueiros: duas tampas por lado no meio de uma pista da avenida (longe das faixas de pedestre e das esquinas) e grelhas na calçada das fachadas.
  const bueiros: BueiroDaRua[] = [];
  const PISTAS = [89.6, 92.4, 95.6, 98.4] as const;
  const longeDaFaixa = (s: number, lado: Lado): boolean => {
    const faixaDeLado = lado.nz !== 0 ? RUA.faixaDeLado : -RUA.faixaDeLado;
    return Math.abs(s - RUA.faixaDoMeio) > 6 && Math.abs(s - faixaDeLado) > 6;
  };
  for (const lado of LADOS) {
    for (let k = 0; k < 3; k++) {
      const grelha = k === 2;
      let s = entre(-76, 76);
      for (let tentativa = 0; tentativa < 8 && !longeDaFaixa(s, lado); tentativa++) s = entre(-76, 76);
      const dist = grelha ? entre(101.6, 103.2) : umDe(PISTAS);
      // Ao longo do lado: norte e sul andam em x, leste e oeste em z (a mesma convenção do desenho do piso).
      const x = lado.nz !== 0 ? s : -lado.nx * dist;
      const z = lado.nz !== 0 ? -lado.nz * dist : s;
      bueiros.push({ x, z, grelha, periodo: entre(1.5, 2.3) });
    }
  }

  return { torres, teloes, letreiros, neons, postes, bueiros };
}
