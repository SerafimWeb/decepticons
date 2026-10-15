import { mulberry32 } from '../core/rng';
import type { Adereco } from './PraiaAderecos';
import { PRAIA_CFTV, PRAIA_RUAS_X } from './PraiaLayout';
import { alturaDoChao, costaEm, PRAIA_DUNAS } from './PraiaTerreno';

/**
 * A CENA da PRAIA DOS CABOS (P127, rodada de luz e de roleplay): onde fica o que conta a história do lugar, em **dado puro** (os testes
 * conferem a folga contra os pontos da partida, as vias e o mapa). Três cenas:
 *  - **a base da estação**: um posto avançado da SERAFIM em estado de defesa — refletores e torres de vigia com holofote nos cantos,
 *    barreiras HESCO e de concreto e sacos de areia onde a defesa se abriga, carretéis de cabo submarino (o que a estação guarda), a tenda
 *    de campanha e o gerador, a picape, as bandeiras verdes e as câmeras de CFTV nos portões;
 *  - **a orla**: a vida da praia (espreguiçadeiras, toalhas, a rede de vôlei), o calçadão (bancos, lixeiras, pontos de ônibus,
 *    semáforos) e a vegetação (touceiras da restinga, algas na linha de maré);
 *  - **o porto e o mar**: empilhadeiras e caminhões no cais, **as lanchas de desembarque dos rebeldes** na areia (a história: eles
 *    chegam do mar) e os dois navios do horizonte — o lançador de cabos da SERAFIM e a nau de comando rebelde (o C2 das IAs).
 */

export interface ContextoDaCena {
  /** Os guarda-sóis já sorteados: as espreguiçadeiras e as toalhas nascem ao lado deles. */
  guardaSois: readonly Adereco[];
  /** O x das barracas de praia (a rede de vôlei e as lanchas fogem delas). */
  barracasX: readonly number[];
}

/** O verde da SERAFIM no pano das bandeiras (a cor da instância multiplica o branco do pano). */
const VERDE_DA_BANDEIRA = 0x2ecc71;
const CORES_DE_TOALHA = [0xe8453c, 0x2f9fd8, 0xf2c43b, 0x3fbf7f, 0xe86fa8, 0xffffff, 0x8e5aa8];
const CORES_DE_CADEIRA = [0xf5f2ea, 0x2f9fd8, 0xe8453c, 0xf2c43b];

const arredonda = (n: number): number => Math.round(n * 10) / 10;

/** O centro do pátio da estação: os refletores olham para ele. */
const CENTRO_DO_PATIO = { x: 276, z: 51 } as const;

function baseDaEstacao(): Adereco[] {
  const out: Adereco[] = [];
  const noPatio = (tipo: Adereco['tipo'], x: number, z: number, giro = 0, extra: Partial<Adereco> = {}): void => {
    out.push({ tipo, x, z, giro, ...extra });
  };
  // As torres de vigia (com holofote) nos cantos do mar, e os refletores no resto do perímetro (a luz do banco de lâmpadas olha para o pátio).
  noPatio('vigia', 241, 7);
  noPatio('vigia', 311, 7);
  for (const [x, z] of [[276, 6.5], [241, 95], [311, 95], [312, 60], [240, 44]] as const) {
    noPatio('refletor', x, z, Math.atan2(CENTRO_DO_PATIO.x - x, CENTRO_DO_PATIO.z - z));
  }
  // Os carretéis de cabo submarino (o que a estação guarda): fileiras que também são cobertura.
  for (const z of [27, 30.4, 33.8]) noPatio('carretel', 272, z);
  for (const z of [90.3, 93.7]) noPatio('carretel', 276, z);
  // As barreiras HESCO, de concreto e os sacos de areia: a defesa se abriga.
  for (const x of [253.6, 256, 258.4, 245.6, 248, 250.4]) noPatio('hesco', x, x < 252 ? 86 : 40);
  noPatio('hesco', 299, 52);
  noPatio('hesco', 301.4, 52);
  for (const x of [284.2, 287.4]) noPatio('barreira', x, 22);
  for (const x of [281, 284.2, 287.4]) noPatio('barreira', x, 40);
  for (const z of [42.6, 45.8, 49]) noPatio('barreira', 270, z, Math.PI / 2);
  noPatio('saco', 246.5, 12);
  noPatio('saco', 305, 12);
  // O posto de campanha: a tenda, o gerador, a picape (cor da instância) e o segundo gerador, junto do prédio.
  noPatio('tenda', 296, 12.5);
  noPatio('gerador', 306, 14, Math.PI / 2);
  noPatio('gerador', 262, 53, Math.PI / 2);
  noPatio('caminhonete', 262, 63, 0, { cor: 0x3a4a40 });
  // As bandeiras verdes da SERAFIM nos portões e na frente do prédio, e as câmeras de CFTV.
  for (const [x, z] of [[247.2, 4.6], [268.8, 4.6], [238.2, 15.2], [238.2, 38.8], [268.8, 98.2], [293.2, 98.2]] as const) noPatio('bandeira', x, z, 0, { cor: VERDE_DA_BANDEIRA });
  noPatio('bandeira', 288, 47, 0, { cor: VERDE_DA_BANDEIRA, escala: 1.4 });
  for (const p of PRAIA_CFTV) noPatio('cftv', p.x, p.z, p.giro);
  return out;
}

function orla(ctx: ContextoDaCena): Adereco[] {
  const out: Adereco[] = [];
  const rand = mulberry32(90210);
  const noChao = (tipo: Adereco['tipo'], x: number, z: number, giro: number, extra: Partial<Adereco> = {}): void => {
    out.push({ tipo, x: arredonda(x), z: arredonda(z), y: arredonda(alturaDoChao(x, z) * 10) / 10, giro, ...extra });
  };
  // A vida da praia: uma espreguiçadeira (de frente para o mar) e uma toalha ao lado de cada guarda-sol, quase sempre.
  for (const s of ctx.guardaSois) {
    if (rand() < 0.75) noChao('cadeira', s.x + 1.9, s.z + 0.4, Math.PI + (rand() - 0.5) * 0.5, { cor: CORES_DE_CADEIRA[Math.floor(rand() * CORES_DE_CADEIRA.length)]! });
    if (rand() < 0.55) noChao('toalha', s.x - 1.9, s.z - 0.5, rand() * Math.PI, { cor: CORES_DE_TOALHA[Math.floor(rand() * CORES_DE_TOALHA.length)]! });
  }
  // A rede de vôlei de praia, em três pontos da areia (longe das barracas e das jangadas).
  for (const x of [-80, -4, 130]) noChao('rede', x, costaEm(x) + 11, 0);
  // O calçadão: bancos de frente para o mar, lixeiras ao lado, e os pontos de ônibus na avenida.
  const noPerto = (x: number, lista: readonly number[], folga: number): boolean => lista.some((k) => Math.abs(x - k) < folga);
  const quiosquesX = [-150, -20, 100, 190];
  for (const x of [-205, -175, -130, -100, -70, -35, 0, 40, 80, 115, 145, 175, 215]) {
    if (noPerto(x, quiosquesX, 6)) continue;
    out.push({ tipo: 'banco', x, z: 8.6, giro: Math.PI });
    out.push({ tipo: 'lixeira', x: x + 2.3, z: 8.9, giro: 0 });
  }
  for (const x of [-150, 60, 200]) out.push({ tipo: 'ponto', x, z: 38.4, giro: 0 });
  out.push({ tipo: 'ponto', x: -64, z: 38.4, giro: 0 }, { tipo: 'ponto', x: 130, z: 17.2, giro: Math.PI });
  // Os semáforos nas bocas das ruas, com o braço sobre a avenida (o braço local +x vira para -z com o giro de 90°).
  for (const x of PRAIA_RUAS_X) out.push({ tipo: 'semaforo', x: x + 7.6, z: 37.4, giro: Math.PI / 2 });
  // A restinga: touceiras de capim em volta das dunas e ao longo do fundo da areia (junto do calçadão).
  for (const d of PRAIA_DUNAS) {
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2;
      const r = 0.55 + rand() * 0.6;
      const x = d.x + Math.cos(a) * d.rx * r;
      const z = d.z + Math.sin(a) * d.rz * r;
      if (z > 3 || z < costaEm(x) + 9) continue;
      noChao('touceira', x, z, rand() * Math.PI * 2, { escala: 0.8 + rand() * 0.7 });
    }
  }
  for (let x = -218; x <= 310; x += 11) noChao('touceira', x + (rand() - 0.5) * 6, 2.4 + rand() * 1.3, rand() * Math.PI * 2, { escala: 0.8 + rand() * 0.6 });
  // A linha de maré: algas e restos na faixa molhada **acima d'água** (a face da praia, 4 m), de ponta a ponta (fora do cais, que é concreto).
  for (let x = -222; x <= 312; x += 5.2) {
    const xx = x + (rand() - 0.5) * 3.2;
    noChao('alga', xx, costaEm(xx) + 0.3 + rand() * 1.9, rand() * Math.PI * 2, { escala: 0.7 + rand() * 0.6 });
  }
  return out;
}

function portoEMar(): Adereco[] {
  const out: Adereco[] = [];
  // O cais: empilhadeiras nos corredores do pátio e dois caminhões-cegonha parados na beira.
  out.push({ tipo: 'empilhadeira', x: -286, z: -40, giro: 0.6, cor: 0xf2b21a }, { tipo: 'empilhadeira', x: -258, z: -8, giro: -0.9, cor: 0xf2b21a });
  out.push({ tipo: 'caminhao', x: -262, z: 5, giro: 0, cor: 0xb5392b }, { tipo: 'caminhao', x: -292, z: 5, giro: Math.PI, cor: 0x2e6da4 });
  // O desembarque rebelde: lanchas encalhadas na faixa molhada, a rampa na areia (a proa para a cidade), longe das barracas e das jangadas.
  for (const [x, g] of [[14, 0.12], [70, -0.1], [112, 0.06]] as const) {
    const z = costaEm(x) + 2.6;
    out.push({ tipo: 'lancha', x, z: arredonda(z), y: arredonda(alturaDoChao(x, z) * 10) / 10, giro: -Math.PI / 2 + g });
  }
  // Os navios do horizonte (só desenho, além do mapa): o lançador de cabos da SERAFIM e a nau de comando rebelde, de proa para a praia.
  out.push({ tipo: 'navioDeCabos', x: 175, z: -215, giro: Math.PI, escala: 1.5, solido: false });
  out.push({ tipo: 'navioRebelde', x: 40, z: -185, giro: -Math.PI / 2, escala: 1.4, solido: false });
  return out;
}

/** Todos os adereços da cena (a base, a orla, o porto e o mar). */
export function aderecosDeCena(ctx: ContextoDaCena): Adereco[] {
  return [...baseDaEstacao(), ...orla(ctx), ...portoEMar()];
}
