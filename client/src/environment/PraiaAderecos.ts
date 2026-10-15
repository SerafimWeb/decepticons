import { mulberry32 } from '../core/rng';
import { aderecosDeCena } from './PraiaAderecosCena';
import { PRAIA_PIER, PRAIA_FAROL, PRAIA_RUAS_X, PRAIA_CABOS_X } from './PraiaLayout';
import { costaEm, PRAIA_LIMITES } from './PraiaTerreno';

/**
 * Os ADEREÇOS da PRAIA DOS CABOS (P127): o que dá vida ao cenário — coqueiros, guarda-sóis, jangadas, barracas, torres de salva-vidas,
 * postes, carros, boias, o guindaste, o farol —, em **dado puro**: onde cada um fica e quais têm corpo sólido. O construtor
 * (`Praia.ts`) desenha cada tipo com **um** `InstancedMesh` (um desenho por tipo, não por coqueiro); o colisor é só dos que bloqueiam
 * passagem (os demais são enfeite: o tiro e o Mech atravessam, como numa folhagem).
 *
 * Posições sorteadas usam semente fixa (G2): o mapa sai igual em toda máquina, e os testes conferem folga contra os pontos da partida.
 */

export type TipoDeAdereco =
  | 'palmeira' | 'guardasol' | 'jangada' | 'barraca' | 'torre' | 'quiosque' | 'poste' | 'carro' | 'onibus' | 'boia' | 'rocha'
  | 'barco' | 'guindaste' | 'farol' | 'antena' | 'parabolica' | 'radome' | 'navio'
  // A cena (rodada de luz e de roleplay): a base da estação, a praia e a calçada, o porto e o mar.
  | 'refletor' | 'vigia' | 'carretel' | 'hesco' | 'barreira' | 'saco' | 'tenda' | 'gerador' | 'caminhonete' | 'bandeira' | 'cftv'
  | 'cadeira' | 'toalha' | 'rede' | 'banco' | 'lixeira' | 'ponto' | 'semaforo' | 'touceira' | 'alga'
  | 'empilhadeira' | 'caminhao' | 'lancha' | 'navioDeCabos' | 'navioRebelde';

/** Os tipos que flutuam: ficam na altura d'água (`NIVEL_DO_MAR`), não na do chão. A malha e as luzes leem a mesma lista. */
export const TIPOS_QUE_FLUTUAM: ReadonlySet<TipoDeAdereco> = new Set<TipoDeAdereco>(['boia', 'barco', 'navioDeCabos', 'navioRebelde']);

export interface Adereco {
  tipo: TipoDeAdereco;
  x: number;
  z: number;
  /** Altura da base (m): 0 no chão; o poste do píer e a antena do telhado sobem. */
  y?: number;
  /** Giro em torno de Y (rad). */
  giro: number;
  /** Escala uniforme (1 = o tamanho de fábrica do tipo). */
  escala?: number;
  /** Cor da instância (guarda-sol, carro, jangada). */
  cor?: number;
  /** `false`: sem colisor mesmo que o tipo tenha (o navio ao longe, além do mapa). */
  solido?: boolean;
}

/** Uma caixa de colisão, em coordenadas locais do adereço (antes do giro): o centro e o tamanho. */
export interface CaixaLocal {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  /** Só nas caixas-alvo (P138): o quanto o TOPO da caixa se inclina para o +x local (rad), como o tronco do coqueiro. */
  inclina?: number;
}

/** Quais tipos bloqueiam passagem, e com que caixas. Os outros (palmeira, guarda-sol, poste...) são enfeite. */
export const COLISORES_DOS_ADERECOS: Readonly<Partial<Record<TipoDeAdereco, readonly CaixaLocal[]>>> = {
  barraca: [{ x: 0, y: 1.7, z: 0, w: 9, h: 3.4, d: 6 }],
  jangada: [{ x: 0, y: 0.55, z: 0, w: 1.9, h: 1.1, d: 7.6 }],
  torre: [{ x: 0, y: 2.4, z: 0, w: 3.4, h: 4.8, d: 3.4 }],
  quiosque: [{ x: 0, y: 1.7, z: 0, w: 6.4, h: 3.4, d: 5 }],
  carro: [{ x: 0, y: 0.8, z: 0, w: 4.6, h: 1.6, d: 1.9 }],
  onibus: [{ x: 0, y: 1.7, z: 0, w: 12, h: 3.4, d: 2.7 }],
  guindaste: [
    { x: -9, y: 17, z: -5, w: 2.6, h: 34, d: 2.6 }, { x: 9, y: 17, z: -5, w: 2.6, h: 34, d: 2.6 },
    { x: -9, y: 17, z: 5, w: 2.6, h: 34, d: 2.6 }, { x: 9, y: 17, z: 5, w: 2.6, h: 34, d: 2.6 },
  ],
  farol: [{ x: 0, y: 19, z: 0, w: 8.5, h: 38, d: 8.5 }],
  antena: [{ x: 0, y: 23, z: 0, w: 4.4, h: 46, d: 4.4 }],
  navio: [{ x: 0, y: 1, z: 0, w: 104, h: 14, d: 26 }, { x: -36, y: 20, z: 0, w: 18, h: 24, d: 22 }],
  refletor: [{ x: 0, y: 7, z: 0, w: 1.8, h: 14, d: 1.8 }],
  vigia: [{ x: 0, y: 4.5, z: 0, w: 4.2, h: 9, d: 4.2 }],
  carretel: [{ x: 0, y: 1.6, z: 0, w: 1.9, h: 3.2, d: 3.2 }],
  hesco: [{ x: 0, y: 1.2, z: 0, w: 2.4, h: 2.4, d: 1.1 }],
  barreira: [{ x: 0, y: 0.58, z: 0, w: 3.2, h: 1.15, d: 0.8 }],
  saco: [{ x: 0, y: 0.47, z: 0, w: 4, h: 0.94, d: 0.8 }],
  tenda: [{ x: 0, y: 1.95, z: 0, w: 8.6, h: 3.9, d: 6.6 }],
  gerador: [{ x: 0, y: 1.1, z: 0, w: 3.6, h: 2.2, d: 1.7 }],
  caminhonete: [{ x: -0.1, y: 1.1, z: 0, w: 5.4, h: 2.2, d: 2.2 }],
  empilhadeira: [{ x: 0, y: 1.15, z: 0.1, w: 1.6, h: 2.3, d: 3.4 }],
  caminhao: [{ x: 0.85, y: 2, z: 0, w: 14.6, h: 3.8, d: 2.6 }],
  lancha: [{ x: 0, y: 0.9, z: 0, w: 7.3, h: 1.8, d: 2.8 }],
};

/**
 * O que se QUEBRA A TIRO (P138, "quero poder detonar os coqueiros… e os elementos menores do cenário"): a vida, o abalo da câmera e as
 * caixas-alvo de cada tipo, em coordenadas locais do adereço (antes do giro e da escala). **A caixa é um sensor** (`addStaticSensorBox`): o tiro e
 * a explosão a acertam, o Mech, a câmera e a rota dos bots a atravessam, então as vias livres do `PraiaLayout.test` seguem valendo. Um coqueiro
 * tem duas caixas (o tronco, que se inclina até 1,7 m no alto, e a copa, que abre 4,6 m): acertar qualquer uma tira da mesma vida.
 *
 * Só o que **não tem luz nem é a defesa da estação**: as luminárias (poste, semáforo, refletor) e as barreiras do pátio (HESCO, sacos, concreto)
 * ficam de pé, porque a luz desenhada e a cobertura do pátio dependem delas.
 */
export interface DestrutivelDef {
  vida: number;
  /** O tamanho do abalo da câmera quando cai (1 = uma barricada). */
  peso: number;
  caixas: readonly CaixaLocal[];
}

export const DESTRUTIVEIS: Readonly<Partial<Record<TipoDeAdereco, DestrutivelDef>>> = {
  palmeira: {
    vida: 70,
    peso: 0.35,
    caixas: [
      // O tronco: uma caixa fina inclinada do pé (0, 0) ao alto (1,7; 10,5), como o tubo da malha (`PraiaGeometrias.palmeira`).
      { x: 0.85, y: 5.25, z: 0, w: 1.1, h: Math.hypot(1.7, 10.5), d: 1.0, inclina: Math.atan2(1.7, 10.5) },
      // A copa: o miolo das palmas (o quadrado inscrito no círculo de 4,6 m), onde estão as folhas de verdade.
      { x: 1.7, y: 9.9, z: 0, w: 6.6, h: 2.4, d: 6.6 },
    ],
  },
  guardasol: {
    vida: 25,
    peso: 0.12,
    caixas: [
      { x: 0, y: 1.25, z: 0, w: 0.3, h: 2.5, d: 0.3 },
      { x: 0, y: 2.65, z: 0, w: 2.9, h: 0.7, d: 2.9 },
    ],
  },
  banco: { vida: 35, peso: 0.1, caixas: [{ x: 0, y: 0.55, z: -0.05, w: 2.0, h: 1.1, d: 0.7 }] },
  lixeira: { vida: 20, peso: 0.08, caixas: [{ x: 0, y: 0.5, z: 0, w: 0.85, h: 1.0, d: 0.85 }] },
  cadeira: { vida: 12, peso: 0.06, caixas: [{ x: 0, y: 0.45, z: -0.05, w: 0.9, h: 0.95, d: 1.9 }] },
};

/** Uma caixa-alvo no mundo: o centro, o tamanho (já na escala) e o giro em Y (o sinal é o do `Quaternion.setFromAxisAngle(Y, giro)` do three). */
export interface CaixaNoMundo {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  giro: number;
  /** A inclinação do topo para o +x local (rad), antes do giro: só o tronco do coqueiro. */
  inclina: number;
}

/** As caixas-alvo de `a` no mundo (vazio se o tipo não se quebra): gira cada centro local em torno do pé do adereço e aplica a escala. */
export function caixasDoAdereco(a: Adereco): CaixaNoMundo[] {
  const def = DESTRUTIVEIS[a.tipo];
  if (!def) return [];
  const e = a.escala ?? 1;
  const c = Math.cos(a.giro);
  const s = Math.sin(a.giro);
  return def.caixas.map((b) => ({
    // A rotação de `Quaternion.setFromAxisAngle(Y, g)`: x' = x·cos + z·sin, z' = −x·sin + z·cos.
    x: a.x + e * (b.x * c + b.z * s),
    y: (a.y ?? 0) + e * b.y,
    z: a.z + e * (-b.x * s + b.z * c),
    w: b.w * e,
    h: b.h * e,
    d: b.d * e,
    giro: a.giro,
    inclina: b.inclina ?? 0,
  }));
}

/** A chave estável de um adereço (o tipo e o lugar): os adereços não têm id, e o mapa é determinístico (semente fixa). */
export const chaveDoAdereco = (a: Pick<Adereco, 'tipo' | 'x' | 'z'>): string => `${a.tipo}@${a.x},${a.z}`;

/**
 * As lâmpadas da festa das barracas (a luz de varal sob o beiral): onde cada uma fica, em coordenadas locais da barraca. A geometria
 * (o brilho de cada bulbo) e o halo de cada uma (`PraiaLuzes.ts`) leem esta lista: as duas coisas nunca se desencontram.
 */
export const LAMPADAS_DA_BARRACA: readonly (readonly [number, number, number])[] = (() => {
  const l: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) l.push([-4.2 + i * 1.05, 3.2 - 0.34 * Math.sin((Math.PI * i) / 8), -2.7]); // o varal da frente, com a barriga
  for (const x of [-4.2, 4.2]) for (let i = 1; i < 5; i++) l.push([x, 3.2 - 0.3 * Math.sin((Math.PI * i) / 5), -2.7 + i * 1.08]); // os varais das laterais
  return l;
})();

const arredonda = (n: number): number => Math.round(n * 10) / 10;

/** Num ponto: a costa mais perto de `z` (para pôr algo "à beira d'água" sem entrar no mar). */
const praiaEm = (x: number, folga: number): number => costaEm(x) + folga;

const CORES_DE_GUARDASOL = [0xe8453c, 0xf2a93b, 0x2f9fd8, 0xf5f2ea, 0x3fbf7f, 0xe86fa8, 0xf7d23e];
const CORES_DE_CARRO = [0xf1f1ee, 0x2c3138, 0xc2342f, 0x2e6da4, 0xd9b53b, 0x8b97a0, 0x3d8b5a, 0xe8e2d2];
const CORES_DE_JANGADA = [0xf3efe6, 0xe86f3c, 0x2f9fd8, 0xf2c43b];

/** As barracas de praia: no fundo da areia, de frente para o mar. */
export const PRAIA_BARRACAS_X: readonly number[] = [-200, -158, -118, -80, -40, 0, 46, 88, 128, 168, 206];

function barracas(): Adereco[] {
  return PRAIA_BARRACAS_X.map((x) => ({ tipo: 'barraca' as const, x, z: -13, giro: 0 }));
}

function guardaSois(rand: () => number): Adereco[] {
  const out: Adereco[] = [];
  for (const bx of PRAIA_BARRACAS_X) {
    for (let i = 0; i < 5; i++) {
      const x = bx + (rand() - 0.5) * 24;
      const z = praiaEm(x, 8) + rand() * (-17 - praiaEm(x, 8));
      out.push({ tipo: 'guardasol', x: arredonda(x), z: arredonda(z), giro: rand() * Math.PI, escala: 0.9 + rand() * 0.3, cor: CORES_DE_GUARDASOL[Math.floor(rand() * CORES_DE_GUARDASOL.length)]! });
    }
  }
  return out;
}

function jangadas(rand: () => number): Adereco[] {
  return [-186, -146, -104, -58, -26, 18, 62, 110, 152, 196].map((x) => ({
    tipo: 'jangada' as const,
    x,
    z: arredonda(praiaEm(x, 9 + rand() * 3)),
    giro: (rand() - 0.5) * 0.5,
    cor: CORES_DE_JANGADA[Math.floor(rand() * CORES_DE_JANGADA.length)]!,
  }));
}

function palmeiras(rand: () => number): Adereco[] {
  const out: Adereco[] = [];
  const linha = (z: number, passo: number, x0: number, x1: number, jitter: number): void => {
    for (let x = x0; x <= x1; x += passo) {
      out.push({ tipo: 'palmeira', x: arredonda(x + (rand() - 0.5) * jitter), z: arredonda(z + (rand() - 0.5) * 0.8), giro: rand() * Math.PI * 2, escala: 0.85 + rand() * 0.4 });
    }
  };
  linha(5.4, 13, -220, 230, 4); // o lado do mar do calçadão
  linha(16, 17, -218, 228, 5); // o lado da avenida
  linha(27, 15, -222, 226, 3); // o canteiro central da Beira-Mar
  // Touceiras no fundo da areia, perto das barracas.
  for (const bx of PRAIA_BARRACAS_X) {
    for (let i = 0; i < 3; i++) out.push({ tipo: 'palmeira', x: arredonda(bx + 8 + rand() * 10), z: arredonda(-10 + rand() * 4), giro: rand() * Math.PI * 2, escala: 0.8 + rand() * 0.5 });
  }
  // O pátio da estação e o fundo do porto também têm verde.
  for (let x = 242; x <= 312; x += 14) out.push({ tipo: 'palmeira', x: arredonda(x), z: 6, giro: rand() * Math.PI * 2, escala: 0.9 + rand() * 0.3 });
  return out;
}

function postes(): Adereco[] {
  const out: Adereco[] = [];
  for (let x = -214; x <= 230; x += 26) out.push({ tipo: 'poste', x, z: 4.8, giro: 0 }); // calçadão
  for (let x = -200; x <= 226; x += 30) out.push({ tipo: 'poste', x, z: 27, giro: 0 }); // o canteiro central
  // No píer, de dois em dois lados.
  for (let z = PRAIA_PIER.zTabuleiro - 6; z >= PRAIA_PIER.zFim + 6; z -= 14) {
    out.push({ tipo: 'poste', x: PRAIA_PIER.x - 3.4, z, y: PRAIA_PIER.topo, giro: 0 });
    out.push({ tipo: 'poste', x: PRAIA_PIER.x + 3.4, z, y: PRAIA_PIER.topo, giro: 0 });
  }
  for (const [x, z] of [[246, 30], [270, 36], [262, 52], [248, 76], [292, 42]] as const) out.push({ tipo: 'poste', x, z, giro: 0 });
  // As ruas que cortam a cidade também têm luz, nos dois lados, com o braço para o meio da rua.
  for (const rx of PRAIA_RUAS_X) {
    for (const z of [52, 88, 112]) {
      out.push({ tipo: 'poste', x: rx - 6.2, z, giro: 0 });
      out.push({ tipo: 'poste', x: rx + 6.2, z: z + 4, giro: Math.PI });
    }
  }
  return out;
}

function carros(rand: () => number): Adereco[] {
  const out: Adereco[] = [];
  const naoNaRua = (x: number): boolean => PRAIA_RUAS_X.every((rx) => Math.abs(x - rx) > 9);
  for (const z of [20.2, 33.8]) {
    for (let x = -212 + rand() * 10; x < 216; x += 32 + rand() * 14) {
      if (!naoNaRua(x)) continue;
      out.push({ tipo: 'carro', x: arredonda(x), z, giro: z < 27 ? Math.PI : 0, cor: CORES_DE_CARRO[Math.floor(rand() * CORES_DE_CARRO.length)]! });
    }
  }
  // Dois ônibus nos pontos da avenida.
  out.push({ tipo: 'onibus', x: -64, z: 33.6, giro: 0, cor: 0xe8b53a });
  out.push({ tipo: 'onibus', x: 130, z: 20.4, giro: Math.PI, cor: 0x3a8fd6 });
  return out;
}

function mar(rand: () => number): Adereco[] {
  const out: Adereco[] = [];
  // As boias que marcam a rota dos cabos, mar adentro.
  for (const cx of PRAIA_CABOS_X) for (const s of [26, 50, 74]) out.push({ tipo: 'boia', x: cx, z: arredonda(Math.max(PRAIA_LIMITES.minZ + 4, costaEm(cx) - s)), giro: 0 });
  // Jangadas de pesca ao largo e dois navios muito ao longe (o horizonte tem vida).
  for (const [x, z] of [[-150, -66], [-30, -74], [60, -64], [132, -80], [204, -70], [-210, -90]] as const) {
    out.push({ tipo: 'barco', x, z, giro: rand() * Math.PI * 2, cor: CORES_DE_JANGADA[Math.floor(rand() * CORES_DE_JANGADA.length)]! });
  }
  return out; // os navios do horizonte (o de cabos e a nau rebelde) estão na cena: PraiaAderecosCena.ts
}

function pedras(rand: () => number): Adereco[] {
  const out: Adereco[] = [];
  // O molhe do leste e do oeste: pedras na ponta da praia, entrando no mar.
  for (let i = 0; i < 26; i++) out.push({ tipo: 'rocha', x: arredonda(PRAIA_LIMITES.maxX - 3 - rand() * 14), z: arredonda(costaEm(310) + 6 - rand() * 46), giro: rand() * Math.PI, escala: 0.8 + rand() * 1.6 });
  for (let i = 0; i < 16; i++) out.push({ tipo: 'rocha', x: arredonda(-224 + rand() * 12), z: arredonda(costaEm(-220) - 4 - rand() * 28), giro: rand() * Math.PI, escala: 0.8 + rand() * 1.6 });
  return out;
}

function marcos(): Adereco[] {
  return [
    { tipo: 'torre', x: -168, z: -20, giro: 0 },
    { tipo: 'torre', x: -36, z: -22, giro: 0 },
    { tipo: 'torre', x: 122, z: -21, giro: 0 },
    { tipo: 'quiosque', x: -150, z: 6.5, giro: 0 },
    { tipo: 'quiosque', x: -20, z: 6.5, giro: 0 },
    { tipo: 'quiosque', x: 100, z: 6.5, giro: 0 },
    { tipo: 'quiosque', x: 190, z: 6.5, giro: 0 },
    // O porto: os dois guindastes do cais (a lança vai para o mar, sobre o navio), o navio atracado e o farol.
    { tipo: 'guindaste', x: -296, z: -61, giro: 0 },
    { tipo: 'guindaste', x: -244, z: -61, giro: 0 },
    { tipo: 'navio', x: -262, z: -86, giro: 0 },
    { tipo: 'farol', x: PRAIA_FAROL.x, z: PRAIA_FAROL.z, giro: 0 },
    // A estação: o mastro de antenas (aviso vermelho no topo), as parabólicas e o domo do radar no teto.
    { tipo: 'antena', x: 304, z: 90, giro: 0 },
    { tipo: 'radome', x: 296, z: 64, y: 16.9, giro: 0 },
    { tipo: 'parabolica', x: 276, z: 56, y: 16.9, giro: 0.6 },
    { tipo: 'parabolica', x: 284, z: 74, y: 16.9, giro: -0.4 },
    { tipo: 'parabolica', x: 302, z: 74, y: 16.9, giro: 0.9 },
  ];
}

/** Todos os adereços, na ordem em que o construtor monta. */
export function praiaAderecos(): readonly Adereco[] {
  const rand = mulberry32(31415);
  const sois = guardaSois(rand);
  return [
    ...marcos(), ...barracas(), ...sois, ...jangadas(rand), ...palmeiras(rand), ...postes(), ...carros(rand), ...mar(rand), ...pedras(rand),
    ...aderecosDeCena({ guardaSois: sois, barracasX: PRAIA_BARRACAS_X }),
  ];
}

/** Uma caixa sólida em coordenadas do mundo: o centro, o tamanho e o giro em Y. */
export interface CaixaSolida {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  giro: number;
}

/** As caixas de colisão de um adereço no mundo (o giro e a escala aplicados). Vazio para os que são só enfeite. */
export function colisoresDoAdereco(a: Adereco): CaixaSolida[] {
  if (a.solido === false) return [];
  const caixas = COLISORES_DOS_ADERECOS[a.tipo];
  if (!caixas) return [];
  const e = a.escala ?? 1;
  const c = Math.cos(a.giro);
  const s = Math.sin(a.giro);
  return caixas.map((k) => ({
    x: Math.round((a.x + (k.x * c + k.z * s) * e) * 100) / 100,
    y: (a.y ?? 0) + k.y * e,
    z: Math.round((a.z + (-k.x * s + k.z * c) * e) * 100) / 100,
    w: k.w * e,
    h: k.h * e,
    d: k.d * e,
    giro: a.giro,
  }));
}
