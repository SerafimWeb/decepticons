import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DestructibleDef, EstiloDeBarricada } from './Destructibles';
import { Montador } from './PraiaMontador';

/**
 * OS SUPERCOMPUTADORES DA PRAÇA (P272, ordem do Comandante em 28/10: "essas caixas do centro do cenário… supercomputadores… algo bem tecnológico, moderno, vanguardista, que chame
 * atenção pela beleza… mac minis gigantes… servidores blindados"). As barricadas que quebram (e os quiosques) eram caixas escuras com uma linha de neon; aqui cada uma ganha um corpo
 * de máquina, **do tamanho exato do colisor** (só desenho: a vida, o colisor e o id de rede não mudam):
 *
 *  - **mini-Mac gigante** (laje larga e baixa): corpo de alumínio em dois degraus, tampa clara com o anel aceso, portas e a luz de energia na frente, as grades de ventilação atrás, e uma
 *    faixa de luz embaixo que o faz flutuar;
 *  - **rack blindado** (alto e estreito): pilares de armadura com fios de luz, a base com listras de aviso, lâminas de servidor com fileiras de LED e a ventoinha na tampa;
 *  - **nó quântico** (cubo): armadura com aletas de resfriamento no topo e, em cada face, uma janela de anéis concêntricos que acende o núcleo;
 *  - **banco de servidores** (parede comprida): dez colunas de lâminas com LEDs, as bandejas de cabo no topo e as pontas acesas.
 *
 * **Custo:** cada máquina é duas malhas (o corpo, que a luz da cena acende, e as luzes, que passam do limiar do bloom e **respiram**: o piscar é conta do shader, pelo relógio da cidade, sem
 * nada por quadro) e os materiais são compartilhados; as geometrias são feitas uma vez por tamanho e reaproveitadas quando a rodada nova traz a barricada de volta. Só no navegador, num pedaço
 * sob demanda (`CidadeNeonCenario`): o servidor e os testes de regra seguem com a caixa de sempre. As luzes entram na energia da cidade: **sem o transformador do banco, os servidores apagam**.
 */

export type VarianteDeServidor = 'minimac' | 'rack' | 'noQuantico' | 'banco';

/** Qual máquina cada tamanho de barricada vira: o formato manda (lajes, torres, paredes, cubos). */
export function varianteDe(def: Pick<DestructibleDef, 'w' | 'd' | 'h'>): VarianteDeServidor {
  const L = Math.max(def.w, def.d);
  const P = Math.max(0.01, Math.min(def.w, def.d));
  if (def.h >= 4.5 && L / P < 2) return 'rack';
  if (L / P >= 4) return def.h > 2.6 ? 'banco' : 'minimac';
  return 'noQuantico';
}

// ─── A paleta ────────────────────────────────────────────────────────────────

const GRAFITE = 0x11151b;
const ACO = 0x222a34;
const ACO_CLARO = 0x35404d;
const ALUMINIO = 0x7d8995;
const ALUMINIO_MEDIO = 0x939faa;
const ALUMINIO_CLARO = 0xaab5c0;
const PAINEL = 0x070a0e;
const BURACO = 0x020304;
const AVISO = 0xe9b400;
const PRETO = 0x0a0a0a;
const CIANO = 0x19d3ff;
const VERDE = 0x39ff6a;
const AMBAR = 0xffb21f;
const ROSA = 0xff2bd6;
const BRANCO = 0xe8f6ff;
/** Os LEDs de dados, em ordem: o índice (do lugar de cada um) sorteia a cor, sempre a mesma. */
const LEDS = [CIANO, VERDE, AMBAR, ROSA, BRANCO, CIANO, VERDE] as const;
const ledCor = (i: number): number => LEDS[Math.abs(Math.floor(i)) % LEDS.length]!;

/** Quanto cada tipo de luz passa de 1 (o HDR que o bloom pega): os LEDs respiram, as linhas de acento ficam firmes. O shader separa um do outro por esta intensidade. */
const BRILHO_DO_LED = 4.2;
const BRILHO_DO_ACENTO = 2.2;

/** Dois conjuntos de peças: o corpo (aceso pela cena) e as luzes (LEDs que respiram e linhas de acento). */
class Peca {
  readonly corpo = new Montador();
  readonly led = new Montador();
  readonly acento = new Montador();
  contaLed = 0;
  contaAcento = 0;
  contaCorpo = 0;
}

/** Uma caixa de cada tipo (a ordem dos argumentos do `Montador`: tamanho, depois o centro). */
const caixa = (p: Peca, w: number, h: number, d: number, x: number, y: number, z: number, cor: number): void => {
  p.corpo.caixa(w, h, d, x, y, z, cor);
  p.contaCorpo++;
};
const led = (p: Peca, w: number, h: number, d: number, x: number, y: number, z: number, cor: number): void => {
  p.led.caixa(w, h, d, x, y, z, cor);
  p.contaLed++;
};
const linha = (p: Peca, w: number, h: number, d: number, x: number, y: number, z: number, cor: number): void => {
  p.acento.caixa(w, h, d, x, y, z, cor);
  p.contaAcento++;
};
/** Cilindro de eixo Y (`eixo` 'z' deita sobre o plano XY, 'x' sobre o ZY, 'xx' ao longo de X). */
type Eixo = 'y' | 'z' | 'x';
const cilindro = (m: Montador, r: number, h: number, lados: number, x: number, y: number, z: number, cor: number, eixo: Eixo = 'y'): void => {
  m.cilindro(r, r, h, lados, x, y, z, cor, eixo === 'z' ? Math.PI / 2 : 0, 0, eixo === 'x' ? Math.PI / 2 : 0);
};

// ─── O mini-Mac gigante ──────────────────────────────────────────────────────

/** Canônico: o comprimento `L` ao longo de X, a profundidade `P` ao longo de Z; a frente é +Z. */
function minimac(p: Peca, L: number, P: number, H: number, acento: number): void {
  const Hb = H - 0.45;
  const fundo = -H / 2;
  // A base recuada, e a faixa de luz embaixo que o faz flutuar.
  caixa(p, L - 0.6, 0.2, P - 0.6, 0, fundo + 0.1 + 0.06, 0, GRAFITE);
  linha(p, L - 0.3, 0.06, P - 0.3, 0, fundo + 0.03, 0, acento);
  // O corpo de alumínio e a tampa em degrau; a frente e o fundo (`P - 0.16`) guardam o espaço das portas e das grades.
  caixa(p, L, Hb - 0.06, P - 0.16, 0, fundo + 0.26 + (Hb - 0.06) / 2, 0, ALUMINIO);
  caixa(p, L - 0.3, 0.24, P - 0.46, 0, H / 2 - 0.15, 0, ALUMINIO_CLARO);
  // A frente: a placa, a luz de energia, as portas, a emenda e o filete de luz.
  const yf = fundo + 0.26 + (Hb - 0.06) / 2;
  caixa(p, L - 0.1, Hb - 0.16, 0.08, 0, yf, P / 2 - 0.04, ALUMINIO_MEDIO);
  led(p, 0.16, 0.16, 0.04, -L / 2 + 0.85, yf + Hb * 0.12, P / 2 - 0.02, BRANCO);
  for (let k = 0; k < 3; k++) caixa(p, 0.65, 0.2, 0.05, -L / 2 + 2.2 + k * 0.85, yf - Hb * 0.05, P / 2 - 0.025, BURACO);
  // O visor escuro com a linha de luz que corre dentro (só nas lajes compridas, onde cabe ao lado das portas).
  if (L >= 6) {
    caixa(p, L * 0.3, 0.32, 0.05, L * 0.22, yf + Hb * 0.02, P / 2 - 0.025, BURACO);
    led(p, L * 0.26, 0.04, 0.02, L * 0.22, yf + Hb * 0.02, P / 2 - 0.01, CIANO);
  }
  caixa(p, L - 0.2, 0.03, 0.05, 0, yf + Hb * 0.3, P / 2 - 0.025, PAINEL);
  linha(p, Math.max(0.5, L - 1.6), 0.07, 0.05, 0.3, fundo + 0.62, P / 2 - 0.025, acento);
  // O fundo: a grade de ventilação e duas saídas.
  const grade = Math.max(3, Math.floor((L - 1.4) / 0.34));
  for (let k = 0; k < grade; k++) caixa(p, 0.09, Hb * 0.55, 0.05, -((grade - 1) * 0.34) / 2 + k * 0.34, yf + 0.05, -P / 2 + 0.025, BURACO);
  caixa(p, 0.5, 0.22, 0.05, -L / 2 + 0.75, yf - Hb * 0.3, -P / 2 + 0.025, PAINEL);
  caixa(p, 0.5, 0.22, 0.05, L / 2 - 0.75, yf - Hb * 0.3, -P / 2 + 0.025, PAINEL);
  // Em cima: o anel aceso da "maçã" (a luz tem de ficar abaixo do disco de dentro, que é a peça mais alta).
  const R = Math.min(P * 0.22, 0.5);
  cilindro(p.acento, R, 0.05, 20, 0, H / 2 - 0.037, 0, acento);
  p.contaAcento++;
  cilindro(p.corpo, R - 0.1, 0.05, 20, 0, H / 2 - 0.025, 0, ALUMINIO_CLARO);
  p.contaCorpo++;
  // As laterais: duas fendas de ar em cada ponta.
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) caixa(p, 0.05, Hb * 0.5, 0.12, s * (L / 2 - 0.025), yf + 0.05, -0.3 + k * 0.6, BURACO);
}

// ─── O rack blindado ─────────────────────────────────────────────────────────

function rack(p: Peca, W: number, D: number, H: number, acento: number): void {
  const fundo = -H / 2;
  // A base, com as listras de aviso na frente e atrás.
  caixa(p, W, 0.55, D - 0.04, 0, fundo + 0.275, 0, ACO);
  const faixas = 6;
  for (let i = 0; i < faixas; i++) {
    for (const s of [-1, 1]) caixa(p, W / faixas, 0.3, 0.04, -W / 2 + (W / faixas) * (i + 0.5), fundo + 0.275, s * (D / 2 - 0.02), i % 2 ? PRETO : AVISO);
  }
  const Hb = H - 0.55 - 0.35;
  const yc = fundo + 0.55 + Hb / 2;
  caixa(p, W - 0.1, Hb, D - 0.1, 0, yc, 0, GRAFITE);
  // Os quatro pilares de armadura, com o fio de luz de cada um.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      caixa(p, 0.3, Hb, 0.27, sx * (W / 2 - 0.15), yc, sz * (D / 2 - 0.145), ACO_CLARO);
      linha(p, 0.06, Math.max(0.4, Hb - 0.8), 0.02, sx * (W / 2 - 0.15), yc, sz * (D / 2 - 0.01), acento);
    }
  }
  // As lâminas de servidor: em cada uma, o painel, a faixa de LEDs, dois pontos e as fendas.
  const Wi = W - 0.6;
  const linhas = Math.max(3, Math.floor((Hb - 0.5) / 0.52));
  const passo = (Hb - 0.8) / linhas;
  for (const sz of [-1, 1]) {
    for (let i = 0; i < linhas; i++) {
      const y = yc - Hb / 2 + 0.4 + passo * (i + 0.5);
      const z = sz * (D / 2 - 0.03);
      caixa(p, Wi, passo - 0.06, 0.04, 0, y, z, PAINEL);
      led(p, Wi * 0.5, 0.05, 0.02, -Wi * 0.2, y + passo * 0.18, sz * (D / 2 - 0.01), ledCor(i + (sz > 0 ? 0 : 3)));
      for (let k = 0; k < 2; k++) led(p, 0.07, 0.07, 0.02, Wi * 0.1 + k * 0.15, y - passo * 0.12, sz * (D / 2 - 0.01), ledCor(i * 2 + k + 1));
      for (let k = 0; k < 3; k++) caixa(p, 0.05, passo * 0.55, 0.02, Wi * 0.3 + k * 0.1, y, sz * (D / 2 - 0.01), BURACO);
    }
  }
  // As laterais: ripas de ventilação.
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) caixa(p, 0.03, Hb * 0.6, 0.12, sx * (W / 2 - 0.025), yc, -D / 2 + 0.55 + k * ((D - 1.1) / 5), BURACO);
  // A tampa e a ventoinha: o anel aceso, o disco de dentro (abaixo da ponta das pás) e a cruz.
  caixa(p, W, 0.35, D, 0, H / 2 - 0.175, 0, ACO);
  const R = Math.min(W, D) * 0.3;
  cilindro(p.acento, R, 0.05, 20, 0, H / 2 - 0.037, 0, acento);
  p.contaAcento++;
  cilindro(p.corpo, R - 0.1, 0.05, 20, 0, H / 2 - 0.04, 0, GRAFITE);
  p.contaCorpo++;
  caixa(p, 0.1, 0.05, (R - 0.1) * 1.9, 0, H / 2 - 0.025, 0, PAINEL);
  caixa(p, (R - 0.1) * 1.9, 0.05, 0.1, 0, H / 2 - 0.025, 0, PAINEL);
}

// ─── O nó quântico ───────────────────────────────────────────────────────────

function noQuantico(p: Peca, W: number, D: number, H: number, acento: number): void {
  const fundo = -H / 2;
  caixa(p, W - 0.5, 0.2, D - 0.5, 0, fundo + 0.16, 0, GRAFITE);
  linha(p, W - 0.3, 0.06, D - 0.3, 0, fundo + 0.03, 0, acento);
  const Hb = H - 0.5;
  const yc = fundo + 0.2 + Hb / 2;
  caixa(p, W - 0.3, Hb, D - 0.3, 0, yc, 0, ACO);
  // Os pilares das quinas e as aletas de resfriamento no topo.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      caixa(p, 0.4, Hb, 0.4, sx * (W / 2 - 0.2), yc, sz * (D / 2 - 0.2), ACO_CLARO);
      linha(p, 0.05, Math.max(0.4, Hb - 0.5), 0.05, sx * (W / 2 - 0.04), yc, sz * (D / 2 - 0.04), acento);
    }
  }
  const aletas = Math.max(5, Math.floor((W - 1.2) / 0.5));
  for (let k = 0; k < aletas; k++) caixa(p, 0.1, 0.3, D - 0.9, -((aletas - 1) * 0.5) / 2 + k * 0.5, H / 2 - 0.15, 0, k % 2 ? ACO_CLARO : GRAFITE);
  // Em cada face: a janela de anéis concêntricos (cada camada sobe um pouco mais que a de fora) e o núcleo.
  const R0 = Math.max(0.35, Math.min(Math.min(W, D) * 0.22, Hb / 2 - 0.2));
  const camadas: readonly (readonly ['corpo' | 'acento' | 'led', number, number, number])[] = [
    ['corpo', 1.0, 0.04, BURACO],
    ['acento', 0.92, 0.052, acento],
    ['corpo', 0.8, 0.064, PAINEL],
    ['acento', 0.62, 0.076, acento],
    ['corpo', 0.48, 0.088, BURACO],
    ['led', 0.3, 0.1, CIANO],
  ];
  const lados = 16;
  for (const [fx, fz, rotacao] of [[0, 1, 'z'], [0, -1, 'z'], [1, 0, 'x'], [-1, 0, 'x']] as const) {
    const face = fx !== 0 ? W / 2 - 0.15 : D / 2 - 0.15;
    for (const [tipo, k, h, cor] of camadas) {
      const m = tipo === 'corpo' ? p.corpo : tipo === 'acento' ? p.acento : p.led;
      const meio = face + h / 2;
      cilindro(m, R0 * k, h, lados, fx * meio, yc, fz * meio, cor, rotacao);
      if (tipo === 'corpo') p.contaCorpo++;
      else if (tipo === 'acento') p.contaAcento++;
      else p.contaLed++;
    }
  }
}

// ─── O banco de servidores ───────────────────────────────────────────────────

/** Canônico: o comprimento `L` ao longo de X, a profundidade `D` ao longo de Z. */
function banco(p: Peca, L: number, D: number, H: number, acento: number): void {
  const fundo = -H / 2;
  caixa(p, L - 0.2, 0.24, D - 0.3, 0, fundo + 0.18, 0, ACO);
  linha(p, L - 0.1, 0.06, D - 0.15, 0, fundo + 0.03, 0, acento);
  const Hb = H - 0.7;
  const yc = fundo + 0.3 + Hb / 2;
  caixa(p, L, Hb, D - 0.1, 0, yc, 0, GRAFITE);
  const colunas = Math.max(3, Math.round(L / 1.2));
  const larg = L / colunas;
  for (let i = 0; i <= colunas; i++) for (const s of [-1, 1]) caixa(p, 0.06, Hb, 0.06, -L / 2 + larg * i + (i === 0 ? 0.03 : i === colunas ? -0.03 : 0), yc, s * (D / 2 - 0.03), ACO_CLARO);
  for (let i = 0; i < colunas; i++) {
    const x = -L / 2 + larg * (i + 0.5);
    for (const s of [-1, 1]) {
      caixa(p, larg - 0.14, Hb - 0.5, 0.03, x, yc, s * (D / 2 - 0.065), PAINEL);
      for (let k = 0; k < 4; k++) led(p, 0.085, 0.085, 0.03, x - 0.2 + (k % 2) * 0.14, yc + Hb * 0.28 - k * 0.2, s * (D / 2 - 0.015), ledCor(i * 4 + k + (s > 0 ? 0 : 2)));
      for (let k = 0; k < 2; k++) caixa(p, larg * 0.5, 0.1, 0.03, x, yc - Hb * 0.22 - k * 0.3, s * (D / 2 - 0.015), BURACO);
    }
  }
  // O topo: a bandeja de cabos com dois tubos de luz, e as pontas acesas.
  caixa(p, L - 0.3, 0.18, D * 0.55, 0, H / 2 - 0.3, 0, ACO);
  for (const s of [-1, 1]) {
    cilindro(p.acento, 0.05, L - 0.6, 6, 0, H / 2 - 0.16, s * 0.3, acento, 'x');
    p.contaAcento++;
  }
  caixa(p, L, 0.12, D - 0.1, 0, H / 2 - 0.06, 0, GRAFITE);
  for (const s of [-1, 1]) linha(p, 0.06, Math.max(0.4, Hb - 0.4), Math.max(0.3, D - 0.5), s * (L / 2 - 0.03), yc, 0, acento);
}

// ─── A montagem ──────────────────────────────────────────────────────────────

/** O desenho de uma máquina: o corpo (cor de vértice, aceso pela cena) e as luzes (HDR: LEDs a mais de 3, linhas de acento a menos). Centrado na origem, do tamanho do colisor. */
export interface SupercomputadorGeo {
  variante: VarianteDeServidor;
  corpo: THREE.BufferGeometry;
  luz: THREE.BufferGeometry;
  /** Quantas peças cada conjunto tem (os testes conferem o orçamento). */
  pecas: { corpo: number; led: number; acento: number };
}

const escalaCor = (g: THREE.BufferGeometry, k: number): THREE.BufferGeometry => {
  const cor = g.getAttribute('color') as THREE.BufferAttribute;
  for (let i = 0; i < cor.array.length; i++) cor.array[i] = (cor.array[i] ?? 0) * k;
  return g;
};

export function montarSupercomputador(def: Pick<DestructibleDef, 'w' | 'd' | 'h' | 'accent'>): SupercomputadorGeo {
  const variante = varianteDe(def);
  const p = new Peca();
  const L = Math.max(def.w, def.d);
  const P = Math.min(def.w, def.d);
  const H = def.h;
  // Um tamanho miúdo demais não leva os detalhes (as peças não cabem): vira uma caixa lisa com o filete de luz.
  const miudo = L < 1.2 || P < 0.8 || H < 1.2;
  if (miudo) {
    caixa(p, def.w, def.h, def.d, 0, 0, 0, ACO);
    linha(p, def.w * 0.8, 0.05, def.d * 0.8, 0, def.h / 2 - 0.03, 0, def.accent);
    led(p, 0.1, 0.05, 0.1, 0, def.h / 2 - 0.03, 0, CIANO);
  } else if (variante === 'rack') rack(p, def.w, def.d, H, def.accent);
  else if (variante === 'noQuantico') noQuantico(p, def.w, def.d, H, def.accent);
  else if (variante === 'minimac') minimac(p, L, P, H, def.accent);
  else banco(p, L, P, H, def.accent);

  // O mini-Mac e o banco são desenhados com o comprimento em X: se a barricada é comprida em Z, gira-se uma vez.
  const girar = !miudo && (variante === 'minimac' || variante === 'banco') && def.d > def.w;
  const montar = (m: Montador, k: number | null): THREE.BufferGeometry => {
    const g = m.build();
    if (k !== null) escalaCor(g, k);
    if (girar) g.rotateY(Math.PI / 2);
    return g;
  };
  const luzes: THREE.BufferGeometry[] = [];
  if (p.contaLed) luzes.push(montar(p.led, BRILHO_DO_LED));
  if (p.contaAcento) luzes.push(montar(p.acento, BRILHO_DO_ACENTO));
  const luz = luzes.length === 1 ? luzes[0]! : (mergeGeometries(luzes, false) ?? luzes[0]!);
  const corpo = montar(p.corpo, null);
  corpo.computeBoundingBox();
  luz.computeBoundingBox();
  return { variante, corpo, luz, pecas: { corpo: p.contaCorpo, led: p.contaLed, acento: p.contaAcento } };
}

// ─── O estilo que a Arena aplica ─────────────────────────────────────────────

/** O relógio da cidade (`CidadeNeonCenario`): um uniforme que o `update` da cidade avança. */
export interface RelogioDaCidade {
  value: number;
}

export interface SupercomputadoresCriados {
  /** O desenho de cada barricada, para `Destructibles.estilizar`. */
  estilo: EstiloDeBarricada;
  /** As cores das luzes: a energia do transformador as escurece (`Arena.registraLuzes`). */
  luzes: readonly THREE.Color[];
  /** Quantas máquinas já foram desenhadas (os testes). */
  readonly desenhadas: () => number;
  dispose(): void;
}

/** O piscar dos LEDs (só os de intensidade acima de 3): a fase sai da posição de cada LED, e a respiração, do relógio. Sem `pow`, `sqrt` nem `log`: nada que vire NaN. */
const PISCA_VERTEX = `
  vec3 qPisca = floor(position * 6.0);
  float hPisca = fract(sin(dot(qPisca, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  vPisca = 0.5 + 0.5 * sin(uTempo * (1.1 + 2.4 * hPisca) + hPisca * 6.2831);
`;
const PISCA_FRAGMENT = `
  float ledPisca = step(3.0, max(vColor.r, max(vColor.g, vColor.b)));
  diffuseColor.rgb *= mix(1.0, 0.45 + 0.75 * vPisca, ledPisca);
`;

export function criarSupercomputadores(relogio: RelogioDaCidade): SupercomputadoresCriados {
  const materialDoCorpo = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.42 });
  const materialDaLuz = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  materialDaLuz.onBeforeCompile = (shader) => {
    // O relógio é o da cidade: o uniforme do programa lê o valor dele a cada quadro (a referência é a mesma).
    shader.uniforms.uTempo = relogio as unknown as THREE.IUniform<number>;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTempo;\nvarying float vPisca;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${PISCA_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPisca;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n${PISCA_FRAGMENT}`);
  };
  const cache = new Map<string, SupercomputadorGeo>();
  let desenhadas = 0;
  const estilo: EstiloDeBarricada = (def) => {
    const chave = `${def.w}x${def.d}x${def.h}:${def.accent}`;
    let geo = cache.get(chave);
    if (!geo) {
      geo = montarSupercomputador(def);
      cache.set(chave, geo);
    }
    const grupo = new THREE.Group();
    const corpo = new THREE.Mesh(geo.corpo, materialDoCorpo);
    const luz = new THREE.Mesh(geo.luz, materialDaLuz);
    grupo.add(corpo, luz);
    desenhadas++;
    return grupo;
  };
  return {
    estilo,
    luzes: [materialDaLuz.color],
    desenhadas: () => desenhadas,
    dispose() {
      for (const g of cache.values()) {
        g.corpo.dispose();
        g.luz.dispose();
      }
      cache.clear();
      materialDoCorpo.dispose();
      materialDaLuz.dispose();
    },
  };
}
