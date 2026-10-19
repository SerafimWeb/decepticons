/**
 * A PRAÇA DOS TRÊS PODERES (P217, passo 4 da ficha `fichas/cenario-8-de-janeiro.md`): o chão da fase do 8 DE JANEIRO, em **dados puros** (sem THREE, sem física, sem DOM: o servidor e os testes leem
 * o mesmo layout). O desenho e os colisores moram em `PracaMapa.ts`, **carregado sob demanda** (`mapasSobDemanda.ts`); este arquivo é o único que o pacote de partida enxerga (os pontos de
 * nascimento, a capacidade e os limites), e é minúsculo de propósito (o teto de 500 KB de JS, R7).
 *
 * **O lugar, em escala de jogo (≈ 1:2):** a Esplanada corre de oeste (x −270) a leste, ladeada pelos ministérios (duas fileiras de caixas brancas), e termina no Congresso (a laje baixa, as duas
 * torres gêmeas, a cúpula e a tigela); **a Praça** fica logo a leste dele (x 46 a 124), com o **Planalto** ao norte (z −70) e o **Supremo** ao sul (z +70), o espelho d'água, o monumento no meio e,
 * ao fundo, o lago. A multidão da fase marcha pela Esplanada de oeste para leste e bate nos três prédios. **Os nomes no jogo são os dos poderes** (LEGISLATIVO, EXECUTIVO, JUDICIÁRIO), não os das
 * instituições nem os de pessoas (a proposta da ficha, § 8, pergunta 1).
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
  kind: 'pavimento' | 'gramado' | 'asfalto' | 'concreto' | 'vidro' | 'agua' | 'onibus' | 'cerca' | 'pedra' | 'metal';
  /** Tem colisor (o Mech esbarra) ou é só desenho. */
  solid: boolean;
}

/** Os limites jogáveis (m): o mapa vai de `minX` a `maxX` e de `minZ` a `maxZ`. O radar e a cerca usam. */
export const PRACA_LIMITES = { minX: -275, maxX: 126, minZ: -104, maxZ: 104 } as const;

/** Os três prédios que a fase defende (a ficha, § 2): o centro da fachada onde a multidão chega, a meia largura dessa faixa de chão e o nome no jogo. */
export interface PredioDaPraca {
  id: 'legislativo' | 'executivo' | 'judiciario';
  nome: string;
  /** O centro da faixa de chão em frente à fachada (x, z) e a meia largura (m): é onde a multidão se aglomera. */
  frente: { x: number; z: number; meia: number };
  /** A caixa que o prédio ocupa (a planta de cima). */
  caixa: { x0: number; z0: number; x1: number; z1: number };
}

export const PRACA_PREDIOS: readonly PredioDaPraca[] = [
  { id: 'legislativo', nome: 'LEGISLATIVO', frente: { x: -28, z: 0, meia: 36 }, caixa: { x0: 0, z0: -66, x1: 44, z1: 66 } },
  { id: 'executivo', nome: 'EXECUTIVO', frente: { x: 70, z: -52, meia: 22 }, caixa: { x0: 44, z0: -82, x1: 96, z1: -60 } },
  { id: 'judiciario', nome: 'JUDICIÁRIO', frente: { x: 70, z: 52, meia: 22 }, caixa: { x0: 44, z0: 60, x1: 96, z1: 82 } },
];

/**
 * Onde o jogador e os rebeldes nascem no Deathmatch (o primeiro é do jogador). Todos em chão livre: a Praça, o pé da Esplanada e o meio dela. O teste confere que nenhum cai dentro de um bloco
 * sólido.
 */
export const PRACA_SPAWNS: readonly (readonly [number, number])[] = [
  [72, 16],
  [58, 16],
  [58, -16],
  [100, 30],
  [100, -30],
  [88, 40],
  [88, -40],
  [96, 0],
  [-14, 40],
  [-14, -40],
  [-48, 0],
  [-90, 22],
  [-90, -22],
  [-140, 0],
  [-190, 18],
];

/**
 * Onde a multidão chega (a fase, passos 5 e 6): os ônibus parados na Esplanada, os bueiros e as lixeiras. Posições **do mapa** (a ficha, § 2): o ritmo de cada fonte é do cronograma da fase
 * (`sim/Multidao.ts`), não daqui.
 */
export const PRACA_FONTES: readonly { tipo: 'onibus' | 'bueiro' | 'lixeira'; x: number; z: number }[] = [
  { tipo: 'onibus', x: -232, z: -20 },
  { tipo: 'onibus', x: -232, z: 20 },
  { tipo: 'bueiro', x: -170, z: -26 },
  { tipo: 'bueiro', x: -130, z: 22 },
  { tipo: 'bueiro', x: -96, z: -18 },
  { tipo: 'bueiro', x: -60, z: 28 },
  { tipo: 'lixeira', x: -110, z: 33 },
  { tipo: 'lixeira', x: -76, z: -33 },
  { tipo: 'lixeira', x: -30, z: 36 },
];

/** Por onde quem foge sai do mapa (o limite oeste e as pontas norte e sul da Esplanada). */
export const PRACA_SAIDAS: readonly { x: number; z: number }[] = [
  { x: -300, z: 0 },
  { x: -120, z: -140 },
  { x: -120, z: 140 },
];

/** Um bloco sem rotação: o desenho e o colisor. `solid` por padrão. */
const bloco = (b: Partial<BlocoDaPraca> & Pick<BlocoDaPraca, 'x' | 'y' | 'z' | 'w' | 'h' | 'd' | 'kind'>): BlocoDaPraca => ({ rz: 0, solid: true, ...b });

/** As fileiras de ministérios que ladeiam a Esplanada: caixas brancas com uma faixa de vidro, de oeste a leste, cada lado de uma avenida larga. */
function ministerios(): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  for (const lado of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const x = -250 + i * 30;
      out.push(bloco({ x, y: 7, z: lado * 56, w: 20, h: 14, d: 12, kind: 'concreto' }));
      out.push(bloco({ x, y: 9, z: lado * 49.7, w: 18, h: 4.5, d: 0.5, kind: 'vidro', solid: false }));
    }
  }
  return out;
}

/** O Congresso: a laje baixa (a plataforma), a rampa de subida, as duas torres gêmeas e os dois volumes da cúpula e da tigela (o desenho redondo é do `PracaMapa`). */
function legislativo(): BlocoDaPraca[] {
  const rampa = Math.atan2(5, 22);
  return [
    bloco({ x: 22, y: 2.5, z: 0, w: 44, h: 5, d: 130, kind: 'concreto' }),
    bloco({ x: 22, y: 5.15, z: 0, w: 44.4, h: 0.3, d: 130.4, kind: 'pedra', solid: false }),
    // a rampa que sobe da Esplanada para a laje (o telhado): a superfície vai de y = 0 em x = −20,7 a y = 5 em x = 1,5, onde encosta na laje
    bloco({ x: -9.6, y: 2.2, z: 0, w: 22.8, h: 0.6, d: 30, rz: rampa, kind: 'pedra' }),
    // as duas torres gêmeas
    bloco({ x: 24, y: 28, z: -15, w: 9, h: 46, d: 28, kind: 'vidro' }),
    bloco({ x: 24, y: 28, z: 15, w: 9, h: 46, d: 28, kind: 'vidro' }),
    bloco({ x: 24, y: 51.3, z: 0, w: 9, h: 0.6, d: 3, kind: 'concreto', solid: false }),
    // sob a cúpula (norte) e sob a tigela (sul): o volume sólido que o desenho redondo cobre
    bloco({ x: 24, y: 9.5, z: -48, w: 22, h: 9, d: 22, kind: 'concreto' }),
    bloco({ x: 24, y: 8, z: 48, w: 22, h: 6, d: 22, kind: 'concreto' }),
  ];
}

/** O Planalto (norte) e o Supremo (sul): um corpo, a base e a colunata (só desenho) voltada para a Praça. */
function palacios(): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  for (const [z, lado] of [[-71, 1], [71, -1]] as const) {
    const alto = z < 0 ? 14 : 12;
    out.push(bloco({ x: 70, y: 1, z, w: 52, h: 2, d: 22, kind: 'pedra' }));
    out.push(bloco({ x: 70, y: 2 + alto / 2, z, w: 40, h: alto, d: 16, kind: 'concreto' }));
    out.push(bloco({ x: 70, y: 2 + alto + 0.6, z, w: 46, h: 1.2, d: 20, kind: 'concreto', solid: false }));
    for (let i = 0; i < 9; i++) out.push(bloco({ x: 51 + i * 4.75, y: 2 + alto / 2, z: z + lado * 9.2, w: 0.9, h: alto, d: 0.9, kind: 'pedra', solid: false }));
  }
  return out;
}

/** A Praça: o monumento no meio, os espelhos d'água diante dos dois palácios, os jardins, os bancos e os canteiros que servem de cobertura. */
function praca(): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  out.push(bloco({ x: 70, y: 0.9, z: 0, w: 6, h: 1.8, d: 6, kind: 'pedra' }));
  out.push(bloco({ x: 70, y: 8, z: 0, w: 2, h: 12, d: 2, kind: 'metal' }));
  for (const z of [-50, 50]) out.push(bloco({ x: 70, y: 0.06, z, w: 36, h: 0.12, d: 14, kind: 'agua', solid: false }));
  // os canteiros (cobertura): fileiras diante dos palácios e no corredor da Esplanada
  for (const [x, z] of [[56, -28], [84, -28], [56, 28], [84, 28], [108, -10], [108, 10], [30, -78], [30, 78]] as const) out.push(bloco({ x, y: 0.7, z, w: 8, h: 1.4, d: 2.6, kind: 'pedra' }));
  return out;
}

/** O chão: o pavimento de tudo, os gramados e a avenida da Esplanada, o lago e a cerca do limite. */
function chao(): BlocoDaPraca[] {
  const out: BlocoDaPraca[] = [];
  const L = PRACA_LIMITES;
  const largura = L.maxX - L.minX;
  const cx = (L.minX + L.maxX) / 2;
  out.push(bloco({ x: cx, y: -0.5, z: 0, w: largura, h: 1, d: L.maxZ - L.minZ, kind: 'pavimento' }));
  // a avenida da Esplanada (asfalto) e os dois gramados que a ladeiam
  out.push(bloco({ x: -135, y: 0.04, z: 0, w: 270, h: 0.08, d: 22, kind: 'asfalto', solid: false }));
  for (const lado of [-1, 1]) out.push(bloco({ x: -135, y: 0.03, z: lado * 30, w: 270, h: 0.06, d: 24, kind: 'gramado', solid: false }));
  out.push(bloco({ x: 70, y: 0.03, z: 0, w: 80, h: 0.06, d: 44, kind: 'gramado', solid: false }));
  // o lago, além do limite leste (só desenho)
  out.push(bloco({ x: L.maxX + 70, y: -0.35, z: 0, w: 140, h: 0.3, d: 260, kind: 'agua', solid: false }));
  // a cerca do limite: sólida, em volta (a Esplanada acaba nela, a Praça acaba no lago)
  const altura = 5;
  out.push(bloco({ x: L.minX, y: altura / 2, z: 0, w: 2, h: altura, d: L.maxZ - L.minZ, kind: 'cerca' }));
  out.push(bloco({ x: L.maxX, y: altura / 2, z: 0, w: 2, h: altura, d: L.maxZ - L.minZ, kind: 'cerca' }));
  out.push(bloco({ x: cx, y: altura / 2, z: L.minZ, w: largura, h: altura, d: 2, kind: 'cerca' }));
  out.push(bloco({ x: cx, y: altura / 2, z: L.maxZ, w: largura, h: altura, d: 2, kind: 'cerca' }));
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
  return [...chao(), ...ministerios(), ...legislativo(), ...palacios(), ...praca(), ...fontes()];
}

/** O raio dos Mechs que o teste dos pontos de nascimento usa (m): o Colossus V4 é o maior; ninguém nasce a menos disto de uma parede. */
export const FOLGA_DO_NASCIMENTO = 3;

/** Quantos pontos de nascimento: o primeiro é do jogador, os outros são de quem nasce com ele (a capacidade do mapa, `sim/nascimentos.ts`). */
export const PRACA_VAGAS = PRACA_SPAWNS.length - 1;
