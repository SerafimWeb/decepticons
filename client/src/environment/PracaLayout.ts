import { mulberry32 } from '../core/rng';
import { PRACA_SPAWNS } from './PracaNascimentos';
export { PRACA_SPAWNS };

/**
 * A PRAÇA DOS TRÊS PODERES (P217 e P222, `fichas/cenario-8-de-janeiro.md`): o chão da fase do 8 DE JANEIRO, em **dados puros** (sem THREE, sem física, sem DOM: o servidor e os testes leem o mesmo
 * layout). O desenho e os colisores moram em `PracaMapa.ts`, **carregado sob demanda** (`mapasSobDemanda.ts`); só os pontos de nascimento
 * (`PracaNascimentos.ts`) ficam no pacote de partida; este arquivo (prédios, blocos, fontes da multidão) baixa **com o mapa**, e nada do pacote de partida pode importá-lo (o teto de 500 KB de JS, R7).
 *
 * **O mapa é compacto, no núcleo da confusão** (P222: *"não precisa ser grande como a Terras Raras, para o jogo ser mais dinâmico"*): 224 × 160 m. Do oeste para o leste: o pé da Esplanada (o gramado,
 * os ministérios, o acampamento dos ônibus e dos bueiros), **a linha de gradis** (a que a multidão derruba), **o Congresso** (a laje, as **duas rampas brancas** que sobem ao telhado, o saguão no térreo,
 * as torres gêmeas, a cúpula e a tigela), e a **Praça** com o **Planalto** ao norte e o **Supremo** ao sul, o monumento no meio e a estátua diante do Supremo.
 *
 * **Os saguões são ambientes fechados que só androides e gente atravessam:** cada um tem paredes inteiras e **portas de 1,9 m** (`LARGURA_DA_PORTA`); o menor Mech tem raio de 1,0 m, então **nenhum
 * Mech passa** (e o teste confere com a física), enquanto o androide (raio 0,36 m) entra. Dentro: as mesas onde a sujeira cai na missão (`mesas`). **Os nomes no jogo são os dos poderes**
 * (LEGISLATIVO, EXECUTIVO, JUDICIÁRIO), não os das instituições nem os de pessoas.
 *
 * Eixos como no resto do jogo: x leste, z sul (para baixo na planta), y para cima; o chão está em y = 0.
 */

export interface BlocoDaPraca {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  /** Giro em torno de z (rad): as rampas. */
  rz: number;
  kind: 'pavimento' | 'piso' | 'gramado' | 'asfalto' | 'concreto' | 'vidro' | 'agua' | 'onibus' | 'cerca' | 'pedra' | 'metal';
  /** Tem colisor (o Mech esbarra) ou é só desenho. */
  solid: boolean;
}

/** Os limites jogáveis (m): o mapa vai de `minX` a `maxX` e de `minZ` a `maxZ`. O radar e a cerca usam. */
export const PRACA_LIMITES = { minX: -122, maxX: 102, minZ: -80, maxZ: 80 } as const;

/** A porta de um saguão: a abertura livre (m). O Vector-09 tem raio 1,3 m, o menor Mech (a Arara) 1,0 m: **nenhum Mech passa**; o androide (0,36 m) passa folgado. */
export const LARGURA_DA_PORTA = 1.9;
/** A altura da porta e do pé-direito dos saguões (m). */
const ALTURA_DA_PORTA = 3;
const PE_DIREITO = 4.2;

type Retangulo = { x0: number; z0: number; x1: number; z1: number };

/** Um saguão: o chão de dentro, as portas (o centro da abertura na linha da fachada) e as mesas (onde a sujeira cai na missão). */
export interface SaguaoDaPraca {
  caixa: Retangulo;
  /** O pé-direito (m). */
  altura: number;
  portas: readonly { x: number; z: number }[];
  mesas: readonly { x: number; z: number }[];
}

/** Os três prédios que a fase defende: o chão em frente à fachada, onde a multidão se aglomera antes de entrar, a caixa do prédio (a planta de cima) e o saguão. */
export interface PredioDaPraca {
  id: 'legislativo' | 'executivo' | 'judiciario';
  nome: string;
  /** O centro da faixa de chão em frente às portas (x, z) e a meia largura (m). */
  frente: { x: number; z: number; meia: number };
  caixa: Retangulo;
  saguao: SaguaoDaPraca;
}

export const PRACA_PREDIOS: readonly PredioDaPraca[] = [
  {
    id: 'legislativo',
    nome: 'LEGISLATIVO',
    frente: { x: -12, z: 0, meia: 24 },
    caixa: { x0: 0, z0: -60, x1: 40, z1: 60 },
    saguao: {
      caixa: { x0: 1, z0: -22, x1: 22, z1: 22 },
      altura: PE_DIREITO,
      portas: [{ x: 0.5, z: -12 }, { x: 0.5, z: 12 }],
      mesas: [{ x: 8, z: -14 }, { x: 8, z: 0 }, { x: 8, z: 14 }, { x: 14, z: -8 }, { x: 14, z: 8 }, { x: 18, z: -14 }, { x: 18, z: 0 }, { x: 18, z: 14 }],
    },
  },
  {
    id: 'executivo',
    nome: 'EXECUTIVO',
    frente: { x: 62, z: -44, meia: 22 },
    caixa: { x0: 38, z0: -72, x1: 86, z1: -52 },
    saguao: {
      caixa: { x0: 39, z0: -71, x1: 85, z1: -53 },
      altura: PE_DIREITO,
      portas: [{ x: 52, z: -52.5 }, { x: 72, z: -52.5 }],
      mesas: [{ x: 46, z: -60 }, { x: 46, z: -66 }, { x: 58, z: -60 }, { x: 58, z: -66 }, { x: 66, z: -60 }, { x: 66, z: -66 }, { x: 78, z: -60 }, { x: 78, z: -66 }],
    },
  },
  {
    id: 'judiciario',
    nome: 'JUDICIÁRIO',
    frente: { x: 62, z: 48, meia: 18 },
    caixa: { x0: 42, z0: 55, x1: 82, z1: 74 },
    saguao: {
      caixa: { x0: 43, z0: 56, x1: 81, z1: 73 },
      altura: PE_DIREITO,
      portas: [{ x: 54, z: 55.5 }, { x: 70, z: 55.5 }],
      mesas: [{ x: 50, z: 63 }, { x: 50, z: 69 }, { x: 62, z: 63 }, { x: 62, z: 69 }, { x: 74, z: 63 }, { x: 74, z: 69 }],
    },
  },
];

/**
 * Onde a multidão chega (a fase, passos 5 e 6): os ônibus parados no pé da Esplanada, os bueiros e as lixeiras. Posições **do mapa**: o ritmo de cada fonte é do cronograma da fase
 * (`sim/Multidao.ts`), não daqui.
 */
export const PRACA_FONTES: readonly { tipo: 'onibus' | 'bueiro' | 'lixeira'; x: number; z: number }[] = [
  { tipo: 'onibus', x: -110, z: -14 },
  { tipo: 'onibus', x: -110, z: 14 },
  { tipo: 'bueiro', x: -96, z: -22 },
  { tipo: 'bueiro', x: -84, z: 22 },
  { tipo: 'bueiro', x: -66, z: -16 },
  { tipo: 'bueiro', x: -52, z: 16 },
  { tipo: 'lixeira', x: -78, z: 32 },
  { tipo: 'lixeira', x: -58, z: -32 },
  { tipo: 'lixeira', x: -40, z: 30 },
];

/** Por onde quem foge sai do mapa (o limite oeste e as pontas norte e sul da Esplanada). */
export const PRACA_SAIDAS: readonly { x: number; z: number }[] = [
  { x: -150, z: 0 },
  { x: -70, z: -110 },
  { x: -70, z: 110 },
];

/** Os gradis da linha da frente (o que a multidão derruba): onde a fila começa, o espaçamento (m) e quais caíram. */
export const PRACA_GRADIS = { x: -34, z0: -32, passo: 3.2, quantos: 21, caidos: [3, 7, 8, 12, 16, 17] as readonly number[] } as const;

/** Um bloco sem rotação: o desenho e o colisor. `solid` por padrão. */
const bloco = (b: Partial<BlocoDaPraca> & Pick<BlocoDaPraca, 'x' | 'y' | 'z' | 'w' | 'h' | 'd' | 'kind'>): BlocoDaPraca => ({ rz: 0, solid: true, ...b });

/** Uma caixa por retângulo no chão e faixa de altura: `retangulo(x0, z0, x1, z1, y0, y1, kind)`. */
const caixa = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, kind: BlocoDaPraca['kind'], solid = true): BlocoDaPraca =>
  bloco({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, w: x1 - x0, h: y1 - y0, d: z1 - z0, kind, solid });

/**
 * Uma parede inteira com portas: os trechos entre as portas e a verga (a faixa acima de cada porta). `eixo` 'z': a parede corre ao longo de z, na linha x = `linha`; 'x': corre ao longo de x, em z = `linha`.
 * A espessura é 1 m, a partir de `linha` (para 'z', de x a x + 1; para 'x', de z a z + 1).
 */
function parede(eixo: 'x' | 'z', linha: number, ini: number, fim: number, portas: readonly number[], altura: number, kind: BlocoDaPraca['kind'] = 'concreto'): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  const metade = LARGURA_DA_PORTA / 2;
  const trecho = (a: number, b: number, y0: number, y1: number): void => {
    if (b - a < 1e-6) return;
    out.push(eixo === 'z' ? caixa(linha, a, linha + 1, b, y0, y1, kind) : caixa(a, linha, b, linha + 1, y0, y1, kind));
  };
  let atual = ini;
  for (const p of [...portas].sort((m, n) => m - n)) {
    trecho(atual, p - metade, 0, altura);
    trecho(p - metade, p + metade, ALTURA_DA_PORTA, altura); // a verga
    atual = p + metade;
  }
  trecho(atual, fim, 0, altura);
  return out;
}

/** O chão: o pavimento de tudo, o gramado e a avenida do pé da Esplanada, o lago e a cerca do limite. */
function chao(): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  const L = PRACA_LIMITES;
  const largura = L.maxX - L.minX;
  const cx = (L.minX + L.maxX) / 2;
  out.push(bloco({ x: cx, y: -0.5, z: 0, w: largura, h: 1, d: L.maxZ - L.minZ, kind: 'pavimento' }));
  // a avenida (asfalto) e os gramados que a ladeiam, do pé da Esplanada ao Congresso
  out.push(bloco({ x: -61, y: 0.04, z: 0, w: 122, h: 0.08, d: 16, kind: 'asfalto', solid: false }));
  for (const lado of [-1, 1]) out.push(bloco({ x: -61, y: 0.03, z: lado * 28, w: 122, h: 0.06, d: 24, kind: 'gramado', solid: false }));
  out.push(bloco({ x: 68, y: 0.03, z: 0, w: 60, h: 0.06, d: 44, kind: 'gramado', solid: false }));
  // o lago, além do limite leste (só desenho)
  out.push(bloco({ x: L.maxX + 70, y: -0.35, z: 0, w: 140, h: 0.3, d: 200, kind: 'agua', solid: false }));
  // a cerca do limite: sólida, em volta
  const altura = 5;
  out.push(bloco({ x: L.minX, y: altura / 2, z: 0, w: 2, h: altura, d: L.maxZ - L.minZ, kind: 'cerca' }));
  out.push(bloco({ x: L.maxX, y: altura / 2, z: 0, w: 2, h: altura, d: L.maxZ - L.minZ, kind: 'cerca' }));
  out.push(bloco({ x: cx, y: altura / 2, z: L.minZ, w: largura, h: altura, d: 2, kind: 'cerca' }));
  out.push(bloco({ x: cx, y: altura / 2, z: L.maxZ, w: largura, h: altura, d: 2, kind: 'cerca' }));
  return out;
}

/** O pé da Esplanada: três ministérios de cada lado (caixas brancas com uma faixa de vidro) e as faixas **em branco** do acampamento (a ficha de fatos, § 5: nenhuma mensagem é reproduzida). */
function esplanada(): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  for (const lado of [-1, 1]) {
    for (const x of [-100, -72, -44]) {
      out.push(bloco({ x, y: 7, z: lado * 52, w: 20, h: 14, d: 12, kind: 'concreto' }));
      out.push(bloco({ x, y: 9, z: lado * 45.7, w: 18, h: 4.5, d: 0.5, kind: 'vidro', solid: false }));
    }
  }
  // as faixas em branco do acampamento: um mastro e um pano liso (só desenho)
  for (const [x, z] of [[-60, -24], [-74, 26], [-88, -30], [-92, 20], [-48, 24], [-104, -4]] as const) {
    out.push(bloco({ x, y: 2, z, w: 0.12, h: 4, d: 0.12, kind: 'metal', solid: false }));
    out.push(bloco({ x, y: 3.1, z: z + 1.7, w: 0.06, h: 1.5, d: 3.4, kind: 'concreto', solid: false }));
  }
  return out;
}

/** A linha de gradis (as grades de metal da frente do Congresso) e as duas viaturas: **cenário**, não relato do que a polícia fez (a ficha de fatos, § 6). Alguns gradis estão caídos. */
function gradis(): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  const g = PRACA_GRADIS;
  for (let i = 0; i < g.quantos; i++) {
    const z = g.z0 + i * g.passo;
    if (g.caidos.includes(i)) out.push(bloco({ x: g.x + 0.5, y: 0.13, z, w: 1.1, h: 0.25, d: 3.1, kind: 'metal' }));
    else out.push(bloco({ x: g.x, y: 0.55, z, w: 0.25, h: 1.1, d: 3.1, kind: 'metal' }));
  }
  out.push(bloco({ x: -41, y: 0.95, z: -22, w: 5, h: 1.9, d: 2.2, kind: 'metal' }));
  out.push(bloco({ x: -42, y: 0.95, z: 24, w: 5, h: 1.9, d: 2.2, kind: 'metal' }));
  return out;
}

/** O Congresso: a laje com **o saguão no térreo** (paredes inteiras, duas portas), as **duas rampas** que sobem ao telhado, as torres gêmeas e os dois volumes da cúpula e da tigela. */
function legislativo(): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  const rampa = Math.atan2(5, 26);
  // as alas (norte e sul) e o miolo atrás do saguão: sólidos até o telhado (y = 5)
  out.push(caixa(0, -60, 40, -22, 0, 5, 'concreto'));
  out.push(caixa(0, 22, 40, 60, 0, 5, 'concreto'));
  out.push(caixa(22, -22, 40, 22, 0, 5, 'concreto'));
  // o saguão: a parede da frente (x de 0 a 1) com as duas portas, e o forro (o telhado do térreo)
  out.push(...parede('z', 0, -22, 22, [-12, 12], PE_DIREITO));
  out.push(caixa(0, -22, 22, 22, PE_DIREITO, 5, 'concreto'));
  // o desenho do telhado e do piso do saguão
  out.push(caixa(0, -60, 40, 60, 5, 5.3, 'pedra', false));
  out.push(caixa(1, -22, 22, 22, 0, 0.1, 'piso', false));
  // as vidraças da frente, entre as portas (só desenho)
  for (const z of [-17, 0, 17]) out.push(bloco({ x: -0.1, y: 2, z, w: 0.2, h: 2.4, d: z === 0 ? 14 : 5, kind: 'vidro', solid: false }));
  // as duas rampas brancas, uma de cada lado da entrada: a superfície vai de y = 0 em x = −26 a y = 5 em x = 0 (onde encosta no telhado)
  for (const lado of [-1, 1]) out.push(bloco({ x: -13, y: 2.2, z: lado * 34, w: 26.5, h: 0.6, d: 16, rz: rampa, kind: 'pedra' }));
  // as torres gêmeas e os volumes da cúpula (norte) e da tigela (sul)
  out.push(bloco({ x: 30, y: 28, z: -15, w: 9, h: 46, d: 28, kind: 'vidro' }));
  out.push(bloco({ x: 30, y: 28, z: 15, w: 9, h: 46, d: 28, kind: 'vidro' }));
  out.push(bloco({ x: 30, y: 51.3, z: 0, w: 9, h: 0.6, d: 3, kind: 'concreto', solid: false }));
  out.push(bloco({ x: 20, y: 9.5, z: -46, w: 22, h: 9, d: 22, kind: 'concreto' }));
  out.push(bloco({ x: 20, y: 8, z: 46, w: 22, h: 6, d: 22, kind: 'concreto' }));
  return out;
}

/** O Planalto (norte) e o Supremo (sul): uma casca com **saguão fechado e duas portas** voltadas para a Praça, o forro, a massa de cima e a colunata (só desenho). */
function palacios(): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  const [, executivo, judiciario] = PRACA_PREDIOS;
  // o Planalto: a frente (z de −53 a −52) para o sul, os fundos, os lados, o forro e a massa de cima (até y = 11)
  const e = executivo!.caixa;
  out.push(...parede('x', e.z1 - 1, e.x0, e.x1, executivo!.saguao.portas.map((p) => p.x), PE_DIREITO));
  out.push(caixa(e.x0, e.z0, e.x1, e.z0 + 1, 0, PE_DIREITO, 'concreto'));
  out.push(caixa(e.x0, e.z0 + 1, e.x0 + 1, e.z1 - 1, 0, PE_DIREITO, 'concreto'));
  out.push(caixa(e.x1 - 1, e.z0 + 1, e.x1, e.z1 - 1, 0, PE_DIREITO, 'concreto'));
  out.push(caixa(e.x0, e.z0, e.x1, e.z1, PE_DIREITO, 5, 'concreto'));
  out.push(caixa(e.x0, e.z0, e.x1, e.z1, 5, 11, 'concreto'));
  out.push(caixa(e.x0 + 1, e.z0 + 1, e.x1 - 1, e.z1 - 1, 0, 0.1, 'piso', false));
  // o Supremo: a frente (z de 55 a 56) para o norte, o resto igual, mais baixo (y = 10)
  const j = judiciario!.caixa;
  out.push(...parede('x', j.z0, j.x0, j.x1, judiciario!.saguao.portas.map((p) => p.x), PE_DIREITO));
  out.push(caixa(j.x0, j.z1 - 1, j.x1, j.z1, 0, PE_DIREITO, 'concreto'));
  out.push(caixa(j.x0, j.z0 + 1, j.x0 + 1, j.z1 - 1, 0, PE_DIREITO, 'concreto'));
  out.push(caixa(j.x1 - 1, j.z0 + 1, j.x1, j.z1 - 1, 0, PE_DIREITO, 'concreto'));
  out.push(caixa(j.x0, j.z0, j.x1, j.z1, PE_DIREITO, 5, 'concreto'));
  out.push(caixa(j.x0, j.z0, j.x1, j.z1, 5, 10, 'concreto'));
  out.push(caixa(j.x0 + 1, j.z0 + 1, j.x1 - 1, j.z1 - 1, 0, 0.1, 'piso', false));
  // a colunata e as vidraças da frente, entre as portas (só desenho)
  for (let i = 0; i < 11; i++) {
    out.push(bloco({ x: 41 + i * 4.4, y: 3, z: e.z1 + 1.8, w: 0.8, h: 6, d: 0.8, kind: 'pedra', solid: false }));
    out.push(bloco({ x: 45 + i * 3.6, y: 3, z: j.z0 - 1.8, w: 0.8, h: 6, d: 0.8, kind: 'pedra', solid: false }));
  }
  for (const x of [45, 62, 79]) out.push(bloco({ x, y: 2, z: e.z1 - 0.1, w: 8, h: 2.2, d: 0.2, kind: 'vidro', solid: false }));
  for (const x of [48, 62, 76]) out.push(bloco({ x, y: 2, z: j.z0 + 1.1, w: 7, h: 2.2, d: 0.2, kind: 'vidro', solid: false }));
  return out;
}

/** O mobiliário dos saguões: as mesas (sólidas: cobertura) e as cadeiras (só desenho, algumas viradas: a depredação). */
function mesas(): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  const rand = mulberry32(2023);
  for (const p of PRACA_PREDIOS) {
    for (const m of p.saguao.mesas) {
      out.push(bloco({ x: m.x, y: 0.4, z: m.z, w: 2.4, h: 0.8, d: 1.1, kind: 'pedra' }));
      for (const lado of [-1, 1]) {
        const virada = rand() < 0.4;
        out.push(bloco({ x: m.x + (rand() - 0.5) * 0.8, y: virada ? 0.2 : 0.35, z: m.z + lado * 1.1, w: 0.5, h: virada ? 0.4 : 0.7, d: virada ? 0.7 : 0.5, kind: 'metal', solid: false }));
      }
    }
  }
  return out;
}

/** A Praça: o monumento no meio, a estátua diante do Supremo, os espelhos d'água, os canteiros (cobertura) e o entulho (pedras soltas do calçamento, em frente às portas e aos gradis). */
function praca(): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  out.push(bloco({ x: 70, y: 0.9, z: 0, w: 6, h: 1.8, d: 6, kind: 'pedra' }));
  out.push(bloco({ x: 70, y: 8, z: 0, w: 2, h: 12, d: 2, kind: 'metal' }));
  // a estátua diante do Supremo (um pedestal e a figura sentada, em blocos)
  out.push(bloco({ x: 62, y: 0.6, z: 44, w: 4.2, h: 1.2, d: 4.2, kind: 'pedra' }));
  out.push(bloco({ x: 62, y: 2.9, z: 44, w: 1.8, h: 3.4, d: 1.8, kind: 'pedra' }));
  for (const z of [-40, 40]) out.push(bloco({ x: 70, y: 0.06, z, w: 30, h: 0.12, d: 10, kind: 'agua', solid: false }));
  for (const [x, z] of [[56, -24], [84, -24], [84, 24], [96, 0]] as const) out.push(bloco({ x, y: 0.7, z, w: 8, h: 1.4, d: 2.6, kind: 'pedra' }));
  // o entulho: pedras soltas, sem colisor (deterministas)
  const rand = mulberry32(8123);
  const solta = (x0: number, x1: number, z0: number, z1: number, n: number): void => {
    for (let i = 0; i < n; i++) out.push(bloco({ x: x0 + rand() * (x1 - x0), y: 0.12, z: z0 + rand() * (z1 - z0), w: 0.3 + rand() * 0.4, h: 0.22, d: 0.3 + rand() * 0.3, kind: 'pedra', solid: false }));
  };
  solta(40, 86, -50, -42, 14);
  solta(44, 80, 46, 54, 10);
  solta(-30, -2, -20, 20, 12);
  return out;
}

/** O que a multidão traz ao mapa: os ônibus parados, as tampas de esgoto e as lixeiras (os pontos de `PRACA_FONTES`). */
function fontes(): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  for (const f of PRACA_FONTES) {
    if (f.tipo === 'onibus') out.push(bloco({ x: f.x, y: 1.6, z: f.z, w: 12, h: 3.2, d: 3.2, kind: 'onibus' })); // parado ao longo da avenida
    else if (f.tipo === 'bueiro') out.push(bloco({ x: f.x, y: 0.1, z: f.z, w: 1.6, h: 0.1, d: 1.6, kind: 'metal', solid: false }));
    else out.push(bloco({ x: f.x, y: 0.55, z: f.z, w: 0.9, h: 1.1, d: 0.9, kind: 'metal' }));
  }
  return out;
}

/** Todos os blocos do mapa (sólidos e só desenho), na ordem de montagem. Determinístico: o servidor e o cliente montam o mesmo chão. */
export function blocosDaPraca(): BlocoDaPraca[] {
  return [...chao(), ...esplanada(), ...gradis(), ...legislativo(), ...palacios(), ...mesas(), ...praca(), ...fontes()];
}

/** O raio dos Mechs que o teste dos pontos de nascimento usa (m): o Colossus V4 é o maior; ninguém nasce a menos disto de uma parede. */
export const FOLGA_DO_NASCIMENTO = 3;

/** Quantos pontos de nascimento: o primeiro é do jogador, os outros são de quem nasce com ele (a capacidade do mapa, `sim/nascimentos.ts`). */
export const PRACA_VAGAS = PRACA_SPAWNS.length - 1;
