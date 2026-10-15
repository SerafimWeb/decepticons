import type { Agua } from '../combat/Agua';
import type { ZoneDef } from '../combat/Zone';
import { mulberry32 } from '../core/rng';
import { costaEm, faixaEm, NIVEL_DO_MAR, PRAIA_FAIXAS, PRAIA_LIMITES } from './PraiaTerreno';

export { PRAIA_EXTENSAO, PRAIA_FUNDURA_MAXIMA } from './PraiaTerreno';

/**
 * A PRAIA DOS CABOS (ordens P126 e P127, Fortaleza · CE): o **layout** do cenário, em **dado puro** — o mesmo caminho do
 * `BunkerLayout.ts`: o construtor do mapa (`Praia.ts`) e a física leem esta lista, e os testes conferem o desenho **sem** montar 3D.
 *
 * **O desenho (P127, "a praia ao longo do cenário, não num só lado"):** a orla corre pelos **640 m do eixo X**, com o **mar** de um lado
 * (z negativo) e a cidade do outro. Do mar para dentro: o mar → a **praia** (areia, dunas, barracas, jangadas) → o **calçadão** (com a ciclovia)
 * → a **Av. Beira-Mar** → a **cidade** (hotéis na frente, prédios menores atrás, ruas que cortam para o mar). **Três marcos** guiam quem
 * joga: a oeste o **PORTO** (cais, navio, guindastes, contêineres e o farol), no meio a **PONTE METÁLICA** (o píer, a via alta sobre o mar) e
 * a leste a **ESTAÇÃO DE CABOS** — o complexo murado onde os cabos que vêm do mar chegam, e o que o Comandante defende.
 *
 * **Tetos (da ficha `cenario-cabos.md`):** residente (sem streaming), estático, **menos de 310 colisores** (o `PraiaLayout.test.ts` conta),
 * nenhuma luz nova. O chão é UM colisor de altura (`PraiaTerreno.ts`); o que está aqui são as construções e os adereços sólidos.
 */

/** Um bloco do cenário: posição (o centro), tamanho, tipo e (opcional) inclinação em torno de X/Z, em radianos. */
export interface BlocoDaPraia {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  kind: TipoDeBloco;
  rx?: number; rz?: number;
  /** Sem `solid`, o bloco é só desenho (pista, marcação, luz) e não ganha colisor. */
  solid?: boolean;
  /** Cor da instância (sobrescreve a do tipo): contêineres e prédios variam. */
  cor?: number;
  /** Só para `luz`: o quanto acende (multiplica a cor; acima de 1 pega no bloom). Sem isto, 3. */
  brilho?: number;
}

export type TipoDeBloco =
  | 'predio' | 'tecnico' | 'concreto' | 'muro' | 'metal' | 'deque' | 'conteiner' | 'cais' | 'madeira'
  | 'asfalto' | 'calcada' | 'patio' | 'ciclovia' | 'marca' | 'luz' | 'escotilha' | 'cabo';

/** A **água** do mapa (P126): o mar inteiro de um lado, com a superfície abaixo da areia. Quem a cobra é o `Match` (freia e afoga). */
export const PRAIA_AGUA: Agua = {
  minX: PRAIA_LIMITES.minX,
  maxX: PRAIA_LIMITES.maxX,
  minZ: PRAIA_LIMITES.minZ,
  maxZ: PRAIA_FAIXAS.calcada.minZ,
  superficie: NIVEL_DO_MAR,
  afogarS: 3,
  danoPorSegundo: 8,
  // Até o joelho é só vadear (freia um pouco, não afoga): o raso é uma via lenta, não uma armadilha.
  afogaDesde: 1.4,
};

/** Onde a ESTAÇÃO DE CABOS fica: o prédio central do complexo, no fim da orla — o objetivo da missão. */
export const PRAIA_ESTACAO = { x: 288, z: 64 } as const;
/** A escotilha (a saída do P123): onde o jogador nasce, logo depois do portão da praia. */
export const PRAIA_ESCOTILHA = { x: 262, z: 16 } as const;

/** O complexo da estação (m): o que a cerca fecha. A praia, o calçadão e a avenida terminam nele. */
export const PRAIA_COMPLEXO = { minX: 236, maxX: 316, minZ: 2, maxZ: 100 } as const;

/** Os três **cabos** que vêm do mar (x de cada um): cruzam a praia, passam pelo portão e entram na estação (os brilhos do desenho). */
export const PRAIA_CABOS_X: readonly number[] = [251, 257, 263];

/**
 * A **Ponte Metálica** (o píer): x do eixo, o z onde a rampa começa na areia, o z onde o tabuleiro começa (a água), onde acaba, a
 * largura e a altura do tabuleiro (m). Ela nasce na água, não no calçadão: a faixa de trás da praia fica livre para quem passa.
 */
export const PRAIA_PIER = { x: -70, zRampa: -14, zTabuleiro: -38, zFim: -100, largura: 8, topo: 2.6 } as const;

/** O farol (com o feixe que gira): o marco do oeste, na esquina do cais com o começo da praia. */
export const PRAIA_FAROL = { x: -236, z: -2 } as const;

/** Um poste de CFTV da estação: onde fica (x, z), o nome no letreiro do CFTV, para onde a lente olha (x, z) e o giro do adereço (a lente aponta para o alvo). */
export interface PostoDeCftv {
  readonly x: number;
  readonly z: number;
  readonly nome: string;
  readonly alvo: readonly [number, number];
  readonly giro: number;
}

/** O giro do adereço que faz a lente (o +x local do poste) apontar de (x, z) para o alvo: o +x local gira para (cos g, -sin g). */
function giroPara(x: number, z: number, alvo: readonly [number, number]): number {
  return Math.round(Math.atan2(-(alvo[1] - z), alvo[0] - x) * 100) / 100;
}

function posto(x: number, z: number, nome: string, alvo: readonly [number, number]): PostoDeCftv {
  return { x, z, nome, alvo, giro: giroPara(x, z, alvo) };
}

/**
 * Os postes de CFTV da estação (P148): os portões do mar e do sul e as portarias do portão oeste. **Uma lista só:** o adereço
 * (`PraiaAderecosCena.ts`) desenha o poste e a câmera do botão CFTV (`camera/camerasDoMapa.ts`) liga a mesma, então a câmera que o jogador
 * vê no portão é a que ele consegue ligar, e a lente aponta para onde a câmera olha. Os do mar e do sul olham **para fora**, pela abertura do muro
 * (a praia por onde a rede é invadida; a rua de trás); os do portão oeste olham **para dentro**, para quem entra (o muro oeste, de 4,6 m, fica
 * mais alto que o poste e só deixa ver a avenida pela abertura de 22 m, onde o poste não está).
 */
export const PRAIA_CFTV: readonly PostoDeCftv[] = [
  posto(249, 3.4, 'PORTÃO DO MAR · OESTE', [249, -30]),
  posto(267, 3.4, 'PORTÃO DO MAR · LESTE', [267, -30]),
  posto(237.6, 14.6, 'PORTÃO OESTE · ENTRADA 1', [268, 30]),
  posto(237.6, 39.4, 'PORTÃO OESTE · ENTRADA 2', [268, 34]),
  posto(272, 97.6, 'PORTÃO SUL · OESTE', [272, 118]),
  posto(290, 97.6, 'PORTÃO SUL · LESTE', [290, 118]),
];

/** O que o mapa chama cada pedaço (para a faixa de local do HUD). */
export function localEm(x: number, z: number): string {
  if (Math.abs(x - PRAIA_PIER.x) < PRAIA_PIER.largura / 2 + 8 && z < PRAIA_PIER.zRampa && z > PRAIA_PIER.zFim - 12) return 'PONTE METÁLICA';
  if (x >= PRAIA_COMPLEXO.minX - 6 && z >= PRAIA_COMPLEXO.minZ - 8) return 'ESTAÇÃO DE CABOS';
  if (x <= -226) return z < costaEm(x) - 20 ? 'MAR ABERTO' : 'PORTO DE MUCURIPE';
  switch (faixaEm(x, z)) {
    case 'mar': return z < costaEm(x) - 22 ? 'MAR ABERTO' : 'ARREBENTAÇÃO';
    case 'praia': return 'PRAIA DOS CABOS';
    case 'calcada': return 'CALÇADÃO';
    case 'avenida': return 'AV. BEIRA-MAR';
    default: return 'CIDADE COSTEIRA';
  }
}

/**
 * As **zonas de vantagem tática** (cura e resfriamento, a mesma regra da Arena — `combat/Zone.ts`): uma no pátio da estação e três no
 * calçadão (leste, meio e oeste), para o esquadrão e quem avança. O teste confere que ficam em chão plano e livre.
 */
export const PRAIA_ZONES: readonly ZoneDef[] = [
  { x: 252, z: 30, radius: 12, kind: 'heal' },
  { x: 150, z: 10, radius: 12, kind: 'cool' },
  { x: 20, z: 10, radius: 12, kind: 'heal' },
  { x: -110, z: 10, radius: 12, kind: 'cool' },
];

// ─── O chão da cidade: pistas, calçadas, pátios (só desenho, em cima do terreno) ───────────────────────────────

const Y_ASFALTO = 0.05;
const Y_CALCADA = 0.09;

/** As ruas que cortam a cidade para o mar (x do eixo) e a largura delas: são as passagens da cidade. */
export const PRAIA_RUAS_X: readonly number[] = [-190, -120, -50, 20, 90, 160];
export const PRAIA_RUA_LARGURA = 14;
/** A rua de trás (paralela à avenida): z do eixo. */
const RUA_DE_TRAS_Z = 71;

/** Os trechos de quadra entre as ruas (x0, x1), de oeste para leste: onde os prédios ficam. */
export function quadrasDaCidade(): readonly (readonly [number, number])[] {
  const meia = PRAIA_RUA_LARGURA / 2;
  const limites = [-218, ...PRAIA_RUAS_X.flatMap((x) => [x - meia, x + meia]), PRAIA_COMPLEXO.minX - 6];
  const quadras: [number, number][] = [];
  for (let i = 0; i + 1 < limites.length; i += 2) quadras.push([limites[i]!, limites[i + 1]!]);
  return quadras;
}

function pisos(): BlocoDaPraia[] {
  const b: BlocoDaPraia[] = [];
  const x0 = -226;
  const x1 = PRAIA_COMPLEXO.minX;
  const larg = x1 - x0;
  const cx = (x0 + x1) / 2;
  // O calçadão (a pedra portuguesa, em ondas) e a ciclovia vermelha do lado da avenida.
  b.push({ x: cx, y: Y_CALCADA / 2, z: (PRAIA_FAIXAS.calcada.minZ + PRAIA_FAIXAS.calcada.maxZ) / 2, w: larg, h: Y_CALCADA, d: PRAIA_FAIXAS.calcada.maxZ - PRAIA_FAIXAS.calcada.minZ, kind: 'calcada' });
  b.push({ x: cx, y: Y_CALCADA + 0.015, z: 14.2, w: larg, h: 0.03, d: 3, kind: 'ciclovia' });
  // A avenida (4 faixas) e o canteiro do meio.
  b.push({ x: cx, y: Y_ASFALTO / 2, z: (PRAIA_FAIXAS.avenida.minZ + PRAIA_FAIXAS.avenida.maxZ) / 2, w: larg, h: Y_ASFALTO, d: PRAIA_FAIXAS.avenida.maxZ - PRAIA_FAIXAS.avenida.minZ, kind: 'asfalto' });
  b.push({ x: cx, y: Y_ASFALTO + 0.05, z: 27, w: larg, h: 0.1, d: 1.6, kind: 'calcada' }); // o canteiro central
  // A calçada da cidade, quebrada nas ruas (cada quadra tem a sua).
  for (const [qa, qb] of quadrasDaCidade()) {
    b.push({ x: (qa + qb) / 2, y: Y_CALCADA / 2, z: 39, w: qb - qa, h: Y_CALCADA, d: 4, kind: 'calcada' });
  }
  // As ruas transversais e a rua de trás.
  for (const x of PRAIA_RUAS_X) b.push({ x, y: Y_ASFALTO / 2, z: (PRAIA_FAIXAS.cidade.minZ + PRAIA_LIMITES.maxZ) / 2, w: PRAIA_RUA_LARGURA, h: Y_ASFALTO, d: PRAIA_LIMITES.maxZ - PRAIA_FAIXAS.cidade.minZ, kind: 'asfalto' });
  b.push({ x: (x0 + x1) / 2, y: Y_ASFALTO / 2, z: RUA_DE_TRAS_Z, w: larg, h: Y_ASFALTO, d: 14, kind: 'asfalto' });
  // As marcas de pista: tracejado amarelo no eixo da avenida (e da rua de trás) e as faixas brancas das bordas.
  for (let x = x0 + 4; x < x1 - 6; x += 12) {
    b.push({ x, y: Y_ASFALTO + 0.02, z: 22.4, w: 5, h: 0.04, d: 0.28, kind: 'marca', cor: 0xf3f0e8 });
    b.push({ x, y: Y_ASFALTO + 0.02, z: 31.6, w: 5, h: 0.04, d: 0.28, kind: 'marca', cor: 0xf3f0e8 });
    b.push({ x, y: Y_ASFALTO + 0.02, z: RUA_DE_TRAS_Z, w: 5, h: 0.04, d: 0.3, kind: 'marca', cor: 0xf4d24a });
  }
  b.push({ x: cx, y: Y_ASFALTO + 0.02, z: 17.6, w: larg, h: 0.04, d: 0.3, kind: 'marca', cor: 0xf3f0e8 });
  b.push({ x: cx, y: Y_ASFALTO + 0.02, z: 36.4, w: larg, h: 0.04, d: 0.3, kind: 'marca', cor: 0xf3f0e8 });
  // Faixas de pedestres atravessando a avenida na boca de cada rua.
  for (const x of PRAIA_RUAS_X) {
    for (let k = -2; k <= 2; k++) b.push({ x: x + k * 2.4, y: Y_ASFALTO + 0.02, z: 27, w: 1.1, h: 0.04, d: 18, kind: 'marca', cor: 0xf3f0e8 });
  }
  return b;
}

// ─── O chão do mar e do porto: o cais, o navio ─────────────────────────────────────────────────────────────────

function porto(): BlocoDaPraia[] {
  const b: BlocoDaPraia[] = [];
  // O cais: um bloco de concreto do fundo do mar até o nível do chão, cobrindo o oeste (a quadra do porto vai até o calçadão).
  b.push({ x: -273, y: -9, z: -32, w: 90, h: 18, d: 80, kind: 'cais', solid: true });
  b.push({ x: -273, y: 0.05, z: -32, w: 88, h: 0.1, d: 78, kind: 'patio' });
  // O navio atracado (adereço `navio`, com casco e ponte sólidos) leva contêineres no convés: só desenho, a 8 m do mar.
  const convesRand = mulberry32(5150);
  for (let x = -284; x <= -228; x += 14) {
    for (const dz of [-4.5, 4.5]) {
      const andares = 1 + Math.floor(convesRand() * 2);
      b.push({ x, y: 8 + (andares * 2.6) / 2, z: -86 + dz, w: 12.2, h: andares * 2.6, d: 4.6, kind: 'conteiner', cor: [0xc0392b, 0x2e6da4, 0xd98d2b, 0x3d8b5a, 0xc9c3b4][Math.floor(convesRand() * 5)]! });
    }
  }
  // Os galpões do porto (no fundo do cais, onde a cidade ainda não chega).
  b.push({ x: -274, y: 7, z: 36, w: 64, h: 14, d: 28, kind: 'metal', solid: true });
  b.push({ x: -266, y: 6, z: 82, w: 70, h: 12, d: 30, kind: 'metal', solid: true });
  b.push({ x: -274, y: 0.05, z: 60, w: 88, h: 0.1, d: 100, kind: 'patio' });
  // O pátio de contêineres do cais: blocos de 12 × 5 m (duas fileiras), 1 a 3 andares, com corredores de 10 m entre eles.
  const rand = mulberry32(7301);
  const cores = [0xc0392b, 0x2e6da4, 0xd98d2b, 0x3d8b5a, 0x8e5aa8, 0xc9c3b4, 0x2f3b45];
  for (const z of [-48, -32, -16, 0]) {
    for (const x of [-298, -274, -250]) {
      const andares = 1 + Math.floor(rand() * 3);
      b.push({ x: x + (rand() - 0.5) * 3, y: (andares * 2.6) / 2, z, w: 12.2, h: andares * 2.6, d: 5.2, kind: 'conteiner', solid: true, cor: cores[Math.floor(rand() * cores.length)]! });
    }
  }
  return b;
}

// ─── A Ponte Metálica: o píer sobre o mar ──────────────────────────────────────────────────────────────────────

function pier(): BlocoDaPraia[] {
  const { x, zRampa, zTabuleiro, zFim, largura, topo } = PRAIA_PIER;
  const b: BlocoDaPraia[] = [];
  // O tabuleiro de ferro (colisor contínuo) e a cabeça em T no fim, onde a via alta vira posto de tiro sobre o mar.
  b.push({ x, y: topo - 0.35, z: (zTabuleiro + zFim) / 2, w: largura, h: 0.7, d: zTabuleiro - zFim, kind: 'deque', solid: true });
  b.push({ x, y: topo - 0.35, z: zFim - 2, w: 28, h: 0.7, d: 16, kind: 'deque', solid: true });
  // A rampa que sobe da areia ao tabuleiro: 2,6 m em ~24 m (menos de 7°, o Mech sobe sem pular). Girar em X faz o +z descer.
  const rampa = zRampa - zTabuleiro;
  const ang = Math.atan2(topo, rampa);
  b.push({ x, y: topo / 2 - 0.35 * Math.cos(ang), z: (zRampa + zTabuleiro) / 2 - 0.35 * Math.sin(ang), w: largura, h: 0.7, d: rampa / Math.cos(ang), kind: 'deque', rx: ang, solid: true });
  // Cobertura no píer: um quiosque no meio e caixotes na cabeça.
  b.push({ x: x + 0.5, y: topo + 1.6, z: -62, w: 5, h: 3.2, d: 6, kind: 'madeira', solid: true });
  b.push({ x: x - 6, y: topo + 1.2, z: zFim - 4, w: 4, h: 2.4, d: 3, kind: 'madeira', solid: true });
  b.push({ x: x + 7, y: topo + 1.2, z: zFim + 1, w: 3, h: 2.4, d: 4, kind: 'madeira', solid: true });
  // Só desenho: o guarda-corpo (corrimão e montantes, dos dois lados e na cabeça em T) e os pilares que seguram o tabuleiro dentro d'água.
  const comp = zTabuleiro - zFim;
  for (const lado of [-1, 1]) {
    const px = x + lado * (largura / 2 - 0.12);
    b.push({ x: px, y: topo + 1.0, z: (zTabuleiro + zFim) / 2, w: 0.14, h: 0.14, d: comp, kind: 'metal' });
    for (let z = zTabuleiro - 2; z > zFim; z -= 4) b.push({ x: px, y: topo + 0.5, z, w: 0.14, h: 1.0, d: 0.14, kind: 'metal' });
  }
  b.push({ x, y: topo + 1.0, z: zFim - 10, w: 28, h: 0.14, d: 0.14, kind: 'metal' });
  for (const lado of [-1, 1]) b.push({ x: x + lado * 13.9, y: topo + 1.0, z: zFim - 2, w: 0.14, h: 0.14, d: 16, kind: 'metal' });
  for (let z = zTabuleiro - 6; z > zFim; z -= 8) {
    for (const lado of [-1, 1]) b.push({ x: x + lado * 3.2, y: (topo - 0.7 - 14) / 2, z, w: 0.8, h: topo - 0.7 + 14, d: 0.8, kind: 'metal' });
  }
  for (const [px, pz] of [[-12, zFim + 4], [12, zFim + 4], [-12, zFim - 8], [12, zFim - 8]] as const) b.push({ x: x + px, y: (topo - 0.7 - 14) / 2, z: pz, w: 0.9, h: topo - 0.7 + 14, d: 0.9, kind: 'metal' });
  return b;
}

// ─── A ESTAÇÃO DE CABOS: o complexo murado ─────────────────────────────────────────────────────────────────────

function estacao(): BlocoDaPraia[] {
  const { minX, maxX, minZ, maxZ } = PRAIA_COMPLEXO;
  const e = 1.2; // a espessura do muro
  const alto = 4.6;
  const b: BlocoDaPraia[] = [];
  const muro = (x0: number, x1: number, z0: number, z1: number): void => {
    b.push({ x: (x0 + x1) / 2, y: alto / 2, z: (z0 + z1) / 2, w: Math.max(e, x1 - x0), h: alto, d: Math.max(e, z1 - z0), kind: 'muro', solid: true });
  };
  // O muro oeste (a avenida entra pelo portão de 22 m), o do mar (portão de 24 m, o dos cabos), o do leste e o do fundo (portão de trás).
  muro(minX, minX, minZ, 16);
  muro(minX, minX, 38, maxZ);
  muro(minX, 246, minZ, minZ);
  muro(270, maxX, minZ, minZ);
  muro(maxX - e, maxX, minZ, maxZ);
  muro(minX, 270, maxZ, maxZ);
  muro(292, maxX, maxZ, maxZ);
  // O pátio (concreto em lajes) e o prédio central: a sala dos cabos, com a laje do teto e o domo do radar.
  b.push({ x: (minX + maxX) / 2, y: 0.05, z: (minZ + maxZ) / 2, w: maxX - minX - 2, h: 0.1, d: maxZ - minZ - 2, kind: 'patio' });
  const { x: ex, z: ez } = PRAIA_ESTACAO;
  b.push({ x: ex, y: 8, z: ez, w: 40, h: 16, d: 28, kind: 'tecnico', solid: true });
  b.push({ x: ex, y: 4.4, z: ez - 14.6, w: 16, h: 0.5, d: 5, kind: 'metal' }); // a marquise da entrada
  b.push({ x: ex, y: 16.4, z: ez, w: 42, h: 0.9, d: 30, kind: 'metal', solid: true });
  // A saída (P123): a escotilha, uma placa no chão onde o Mech emerge, com o anel de luz.
  b.push({ x: PRAIA_ESCOTILHA.x, y: 0.09, z: PRAIA_ESCOTILHA.z, w: 11, h: 0.18, d: 11, kind: 'escotilha' });
  b.push({ x: PRAIA_ESCOTILHA.x, y: 0.2, z: PRAIA_ESCOTILHA.z, w: 6.4, h: 0.04, d: 6.4, kind: 'luz', cor: 0x39ff6a, brilho: 1.15 });
  // As marcas amarelas do pátio: a moldura da escotilha e a faixa do portão do mar.
  for (const [mx, mz, mw, md] of [[PRAIA_ESCOTILHA.x, PRAIA_ESCOTILHA.z - 6.4, 13, 0.35], [PRAIA_ESCOTILHA.x, PRAIA_ESCOTILHA.z + 6.4, 13, 0.35], [PRAIA_ESCOTILHA.x - 6.4, PRAIA_ESCOTILHA.z, 0.35, 13], [PRAIA_ESCOTILHA.x + 6.4, PRAIA_ESCOTILHA.z, 0.35, 13], [258, 4.6, 24, 0.35]] as const) {
    b.push({ x: mx, y: 0.115, z: mz, w: mw, h: 0.03, d: md, kind: 'marca', cor: 0xf4d24a });
  }
  // Os edifícios de apoio: casa de força (geradores), tanques e o prédio de operações.
  b.push({ x: 258, y: 3, z: 76, w: 16, h: 6, d: 9, kind: 'concreto', solid: true });
  b.push({ x: 301, y: 4, z: 26, w: 8, h: 8, d: 8, kind: 'metal', solid: true });
  b.push({ x: 301, y: 4, z: 38, w: 8, h: 8, d: 8, kind: 'metal', solid: true });
  b.push({ x: 244, y: 3.2, z: 58, w: 8, h: 6.4, d: 14, kind: 'concreto', solid: true });
  // A cobertura do pátio (HESCO, barreiras, carretéis de cabo, geradores) são adereços da cena: PraiaAderecosCena.ts.
  // Os cabos: três faixas brilhantes do mar ao prédio (só desenho). O trecho da praia e o do pátio.
  for (const cx of PRAIA_CABOS_X) {
    const zMar = costaEm(cx) - 1;
    b.push({ x: cx, y: 0.14, z: (zMar + 49) / 2, w: 0.5, h: 0.06, d: 49 - zMar, kind: 'cabo' });
  }
  return b;
}

// ─── A cidade: hotéis na frente, prédios menores atrás ─────────────────────────────────────────────────────────

const PASTEIS = [0xf2e6d0, 0xe8cfa6, 0xdde6ea, 0xf4d8c6, 0xeadfc8, 0xcfdccf, 0xeadbe3, 0xf0ede4];

function cidade(): BlocoDaPraia[] {
  const rand = mulberry32(2718);
  const b: BlocoDaPraia[] = [];
  const fileiras = [
    // zMin, profundidade, alturas possíveis (a frente é de hotéis altos; atrás, quarteirões baixos)
    { zMin: 42, prof: 22, alturas: [16, 20, 24, 28, 34] },
    { zMin: 80, prof: 24, alturas: [10, 12, 14, 18, 22] },
  ] as const;
  for (const f of fileiras) {
    for (const [qa, qb] of quadrasDaCidade()) {
      const larg = qb - qa;
      // Quadra larga vira dois prédios colados (a fachada da rua tem ritmo); estreita, um só.
      const partes = larg >= 54 ? 2 : 1;
      const cortes = [qa, ...(partes === 2 ? [qa + larg * (0.42 + rand() * 0.16)] : []), qb];
      for (let i = 0; i + 1 < cortes.length; i++) {
        const w = cortes[i + 1]! - cortes[i]!;
        const h = f.alturas[Math.floor(rand() * f.alturas.length)]!;
        const prof = f.prof - Math.floor(rand() * 3);
        const cx = (cortes[i]! + cortes[i + 1]!) / 2;
        const cz = f.zMin + prof / 2;
        b.push({ x: cx, y: h / 2, z: cz, w, h, d: prof, kind: 'predio', solid: true, cor: PASTEIS[Math.floor(rand() * PASTEIS.length)]! });
        // O telhado tem vida: casa de máquinas do elevador, caixa-d'água e aparelhos de ar-condicionado (só desenho).
        b.push({ x: cx + (rand() - 0.5) * (w - 12), y: h + 1.4, z: cz + (rand() - 0.5) * (prof - 10), w: 4.2, h: 2.8, d: 4.2, kind: 'concreto' });
        b.push({ x: cx + (rand() - 0.5) * (w - 8), y: h + 1.3, z: cz + (rand() - 0.5) * (prof - 8), w: 3.2, h: 2.6, d: 3.2, kind: 'metal', cor: 0xa9b4b8 });
        for (let k = 0; k < 2; k++) b.push({ x: cx + (rand() - 0.5) * (w - 6), y: h + 0.55, z: cz + (rand() - 0.5) * (prof - 6), w: 2.2, h: 1.1, d: 1.6, kind: 'metal', cor: 0xd8dcdc });
      }
    }
  }
  return b;
}

/** Todo o cenário em blocos, na ordem em que o construtor desenha. */
export function praiaBlocks(): readonly BlocoDaPraia[] {
  return [...pisos(), ...porto(), ...pier(), ...estacao(), ...cidade()];
}

// ─── Os pontos da partida ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Os pontos de nascimento (x, z): o **primeiro é do jogador** (a escotilha da estação, P123). Em seguida, os que o combate livre usa para
 * os rebeldes (longe, espalhados pela orla), e por último os da escolta (junto da estação). Cada ponto é de chão plano e livre, com
 * folga para o Colossus (o teste confere).
 */
export const PRAIA_SPAWNS: readonly (readonly [number, number])[] = [
  [PRAIA_ESCOTILHA.x, PRAIA_ESCOTILHA.z],
  [-150, 27], [-60, 27], [30, -22], [112, 14], [-205, 13], [140, -26], [70, 27], [-110, 28],
  [250, -6], [270, 20], [256, 28], [292, 30], [284, 86], [226, 28],
];

/**
 * Onde as **ondas rebeldes** nascem na missão da praia: o desembarque do mar e da orla, **longe da estação** (o jogador defende
 * a leste e as ondas chegam pelas três vias: a areia, o calçadão e a avenida). A ordem é a dos papéis: Mechs primeiro, andróides depois.
 */
export const PRAIA_INIMIGOS: readonly (readonly [number, number])[] = [
  [50, -26], [78, 12], [98, 28], [36, -26], [56, 13], [72, 29],
];

/** Onde o **Colossus da última onda** nasce: o meio da avenida aberta, a oeste, de onde ele vem andando pela orla. */
export const PRAIA_TITA: readonly [number, number] = [-20, 27];

/**
 * A rota de **assalto** dos rebeldes na missão: eles marcham da orla para os portões da estação e patrulham o pátio (sem isto, numa
 * praia de 640 m eles vagariam por pontos espalhados e a onda nunca chegaria). Dois portões: o da avenida (oeste) e o do mar (norte).
 */
export const PRAIA_ASSALTO: readonly (readonly [number, number])[] = [
  [226, 27], [250, -4], [250, 22], [264, 36],
];
