import { SPAWN_POINTS } from '../environment/Arena';
import { BUNKER_SPAWNS, type MapId } from '../environment/Bunker';
import { AMAZONIA_SPAWNS } from '../environment/AmazoniaLayout';
import { PRAIA_SPAWNS } from '../environment/PraiaLayout';

/** Um ponto de nascimento (x, z) no chão da arena. */
export type Ponto = readonly [number, number];

/**
 * Os pontos de sempre (o jogo de hoje): cada papel ocupa os seus, na ordem. Quem passa do que a lista tem usa os pontos extras
 * de `EXTRAS_INIMIGOS` e `EXTRAS_ALIADOS`. Ficam aqui, e não no `Match`, porque o esquadrão (`esquadrao.ts`) e a partida leem o mesmo.
 */
export const BOT_SPAWNS: readonly Ponto[] = [SPAWN_POINTS[2]!, SPAWN_POINTS[4]!, SPAWN_POINTS[8]!];
export const ANDROID_SPAWNS: readonly Ponto[] = [SPAWN_POINTS[5]!, SPAWN_POINTS[6]!, SPAWN_POINTS[9]!];
export const TECHNICIAN_SPAWNS: readonly Ponto[] = [SPAWN_POINTS[10]!];
/**
 * Aliados do jogador na Arena normal (30/09, pedido do dono: "sozinho tá muito intenso"). Tiram vaga
 * dos inimigos pra não estourar o teto de 8 (G11) quando a sala vem das configurações — ver `esquadraoDeFoes`.
 * Só na Arena e no Bunker: Sobrevivência e CTF já têm lógica própria de pool/time (`SurvivalWaves`, `CaptureTheFlag`).
 */
export const ALLY_SPAWNS: readonly Ponto[] = [SPAWN_POINTS[1]!, SPAWN_POINTS[3]!];
export const ALLY_COUNT = ALLY_SPAWNS.length;
/** O Colossus (escala 3) nasce longe do jogador e de frente para ele: 14 m de cápsula pedem espaço. */
export const COLOSSUS_SPAWN = [SPAWN_POINTS[7]!] as const;

/**
 * Onde os titãs inimigos nascem (13/10, P108: "quero colocar os Colossus 3 e 4 no time adversário"). Um Colossus-V4 tem 20 m de altura e 5 m de raio: nenhum
 * ponto dos outros papéis tem folga para ele. Estes são de chão livre para um cilindro de **10 m de raio e 21 m de altura** (a cápsula do titã mais 5 m de folga)
 * em volta, a 60 m ou mais do nascimento do jogador, a 14 m ou mais de qualquer ponto fixo e fora das zonas de cura e resfriamento, e **na ordem de espalhamento**
 * (o primeiro é o mais longe do jogador; cada seguinte, o mais longe dos anteriores). Só na Arena: o Bunker não tem onde pôr um titã.
 * `nascimentos.test.ts` confere cada um contra a arena de verdade (física).
 */
export const PONTOS_DOS_TITAS: readonly Ponto[] = [[-85, -85], [85, 85], [-85, 85], [55, -55]];

/**
 * Pontos extras dos inimigos (12/10, P91: "mais bots, além dos 3 do padrão"). Chão livre num anel de 55 a 100 m do nascimento do
 * jogador, a 14 m ou mais de qualquer ponto fixo e a 5 m ou mais de prédio, barricada, plataforma, rampa e da torre Serafim, fora das
 * zonas de cura e de resfriamento (ninguém nasce de graça numa vantagem). Na ordem de espalhamento: o primeiro é o mais longe de todos
 * os pontos fixos, o segundo o mais longe dos dois, e assim por diante, então qualquer quantidade fica bem distribuída pela arena.
 * `nascimentos.test.ts` confere cada um contra a arena de verdade (física), então mover um prédio sem refazer a lista falha lá.
 */
export const EXTRAS_INIMIGOS: readonly Ponto[] = [
  [-85, -20], [85, -20], [-15, -70], [-30, 85], [30, 85], [-85, 25], [45, -10], [10, -50], [0, 85],
  [-80, 85], [-55, -30], [-55, 20], [30, -70], [50, 50], [-35, -50], [85, 10], [-70, 0], [-55, 85],
  [70, -45], [-10, -35], [-75, -40], [-40, 65], [25, -35], [55, 85], [60, -25], [70, -5], [85, 55],
  [-85, 65], [-50, 50], [40, 65], [65, 40], [80, 85], [-85, 5], [-70, -25], [-55, -10], [-50, -45],
];

/**
 * Pontos extras dos aliados: de 10 a 48 m do nascimento do jogador (a escolta chega rápido), a 8 m ou mais de qualquer ponto fixo,
 * com as mesmas folgas de obstáculo. Também na ordem de espalhamento.
 */
export const EXTRAS_ALIADOS: readonly Ponto[] = [
  [-15, 70], [30, 60], [-45, 20], [15, -20], [-40, 50], [45, 35], [-15, 45], [-20, 15],
  [5, 0], [10, 45], [10, 70], [45, 10], [-5, -20], [-40, 5], [15, 30], [20, -5],
];

/** Quantos corpos de cada papel a partida pede. */
export interface Contagem {
  mechs: number;
  androids: number;
  tecnicos: number;
  aliadosMechs: number;
  aliadosAndroids: number;
  /** Quantos titãs (P108). Não entram em `mechs`: têm pontos próprios (`PONTOS_DOS_TITAS`). Ausente = 0. */
  titas?: number;
}

/** Onde cada corpo nasce, na ordem do esquadrão. */
export interface Nascimentos {
  mechs: Ponto[];
  /** Os titãs inimigos (P108), cada um no seu ponto de `PONTOS_DOS_TITAS`. */
  titas: Ponto[];
  androids: Ponto[];
  tecnicos: Ponto[];
  aliadosMechs: Ponto[];
  aliadosAndroids: Ponto[];
}

/** Quantos corpos cada mapa comporta (cada um nasce no seu ponto, sem sobrepor outro). */
export interface Capacidade {
  inimigos: number;
  aliados: number;
  /** Inimigos e aliados juntos (no Bunker, os pontos são de todos). */
  total: number;
  /** Quantos titãs (P108): os pontos de `PONTOS_DOS_TITAS` na Arena; nenhum no Bunker. */
  titas: number;
}

/**
 * Na Arena, os extras sobram: o que limita o esquadrão é a CPU (`LIMITES_DO_ESQUADRAO`), não o chão. A capacidade é a conservadora
 * (a quantidade de extras): cada papel que passa do número de pontos fixos gasta no máximo um extra por corpo, então nunca falta ponto.
 */
const CAPACIDADE_ARENA: Capacidade = {
  inimigos: EXTRAS_INIMIGOS.length,
  aliados: EXTRAS_ALIADOS.length,
  total: EXTRAS_INIMIGOS.length + EXTRAS_ALIADOS.length,
  titas: PONTOS_DOS_TITAS.length,
};
/** O Bunker tem 12 pontos no total e o primeiro é do jogador: os outros 11 são de quem nasce com ele. */
const CAPACIDADE_BUNKER: Capacidade = { inimigos: BUNKER_SPAWNS.length - 1, aliados: BUNKER_SPAWNS.length - 1, total: BUNKER_SPAWNS.length - 1, titas: 0 };
/** A praia (P126) é o mapa maior: os pontos dela, menos o do jogador, são de quem nasce com ele. */
const CAPACIDADE_PRAIA: Capacidade = { inimigos: PRAIA_SPAWNS.length - 1, aliados: PRAIA_SPAWNS.length - 1, total: PRAIA_SPAWNS.length - 1, titas: 0 };

/** A Amazônia (P180): os pontos dela, menos o do jogador, são de quem nasce com ele. */
const CAPACIDADE_AMAZONIA: Capacidade = { inimigos: AMAZONIA_SPAWNS.length - 1, aliados: AMAZONIA_SPAWNS.length - 1, total: AMAZONIA_SPAWNS.length - 1, titas: 0 };

export const capacidadeDoMapa = (mapa: MapId): Capacidade =>
  mapa === 'bunker' ? CAPACIDADE_BUNKER : mapa === 'praia' ? CAPACIDADE_PRAIA : mapa === 'amazonia' ? CAPACIDADE_AMAZONIA : CAPACIDADE_ARENA;

/**
 * Os pontos da Arena: cada papel usa primeiro os fixos (o jogo de hoje) e o que passar sai dos extras, os inimigos de um lado
 * e os aliados de outro, sempre na mesma ordem (determinístico: servidor e cliente chegam nos mesmos pontos).
 */
function nascimentosDaArena(c: Contagem): Nascimentos {
  let extraInimigo = 0;
  let extraAliado = 0;
  const inimigo = (fixos: readonly Ponto[], n: number): Ponto[] =>
    Array.from({ length: n }, (_, i) => fixos[i] ?? EXTRAS_INIMIGOS[extraInimigo++]!);
  const aliado = (fixos: readonly Ponto[], n: number): Ponto[] =>
    Array.from({ length: n }, (_, i) => fixos[i] ?? EXTRAS_ALIADOS[extraAliado++]!);
  const aliadosMechs = aliado(ALLY_SPAWNS, c.aliadosMechs);
  return {
    mechs: inimigo(BOT_SPAWNS, c.mechs),
    titas: PONTOS_DOS_TITAS.slice(0, c.titas ?? 0),
    androids: inimigo(ANDROID_SPAWNS, c.androids),
    tecnicos: inimigo(TECHNICIAN_SPAWNS, c.tecnicos),
    aliadosMechs,
    // Os andróides aliados continuam a lista dos Mechs aliados: nenhum ponto repete.
    aliadosAndroids: aliado([], c.aliadosAndroids),
  };
}

/** Os pontos que cada papel prefere no Bunker (o jogo de hoje); o resto vem dos que sobraram, em ordem. */
const BUNKER_PREFERIDOS = {
  aliados: [1, 3],
  mechs: [2, 3, 4],
  androids: [5, 6, 7],
  tecnicos: [10],
} as const;

/**
 * Os pontos do Bunker: nenhum ponto serve a dois corpos. Cada papel pega primeiro os que preferia (aliados, depois Mechs, andróides e
 * técnicos, nesta ordem de disputa) e, passando disso, o primeiro ponto livre que nenhum papel preferia (para não tomar o de outro).
 * O jogo de hoje sai igual; o que mudou é que o ponto 3, que o aliado e o terceiro Mech disputavam, agora vai só para um deles.
 */
function nascimentosDoBunker(c: Contagem): Nascimentos {
  const livres = new Set(BUNKER_SPAWNS.map((_, i) => i).filter((i) => i > 0));
  const deAlguem = new Set<number>(Object.values(BUNKER_PREFERIDOS).flat());
  const pegar = (preferidos: readonly number[], n: number): Ponto[] => {
    const out: Ponto[] = [];
    const usa = (i: number): void => {
      livres.delete(i);
      out.push(BUNKER_SPAWNS[i]!);
    };
    for (const i of preferidos) if (out.length < n && livres.has(i)) usa(i);
    while (out.length < n) {
      const sobra = [...livres].filter((i) => !deAlguem.has(i));
      const proximo = Math.min(...(sobra.length ? sobra : livres));
      if (!Number.isFinite(proximo)) throw new Error('Bunker sem ponto livre: o esquadrão passou da capacidade do mapa');
      usa(proximo);
    }
    return out;
  };
  const aliadosMechs = pegar(BUNKER_PREFERIDOS.aliados, c.aliadosMechs);
  const mechs = pegar(BUNKER_PREFERIDOS.mechs, c.mechs);
  const androids = pegar(BUNKER_PREFERIDOS.androids, c.androids);
  const tecnicos = pegar(BUNKER_PREFERIDOS.tecnicos, c.tecnicos);
  return { mechs, titas: [], androids, tecnicos, aliadosMechs, aliadosAndroids: pegar([], c.aliadosAndroids) };
}

/**
 * Os nascimentos de um mapa cujos pontos são uma **lista simples** (a praia, P126): o jogador no primeiro ponto e os
 * outros na ordem — cada ponto é de um corpo só, como a regra exige.
 */
function nascimentosDaLista(c: Contagem, pontos: readonly Ponto[]): Nascimentos {
  let i = 1; // o ponto 0 é do jogador
  const pega = (n: number): Ponto[] => pontos.slice(i, (i += n));
  return { mechs: pega(c.mechs), titas: [], androids: pega(c.androids), tecnicos: pega(c.tecnicos), aliadosMechs: pega(c.aliadosMechs), aliadosAndroids: pega(c.aliadosAndroids) };
}

/**
 * Onde cada corpo do esquadrão nasce. Passar da capacidade do mapa é erro de quem chama (o esquadrão passa por
 * `sanearEsquadrao`, que corta no limite do mapa antes): a Arena avisa em vez de empilhar dois robôs no mesmo chão.
 */
export function nascimentosDoEsquadrao(c: Contagem, mapa: MapId): Nascimentos {
  const cap = capacidadeDoMapa(mapa);
  const titas = c.titas ?? 0;
  if (titas > cap.titas) throw new Error(`o esquadrão pede ${titas} titã(s) e o mapa comporta ${cap.titas}`);
  const inimigos = c.mechs + c.androids + c.tecnicos + titas;
  const aliados = c.aliadosMechs + c.aliadosAndroids;
  if (inimigos > cap.inimigos || aliados > cap.aliados || inimigos + aliados > cap.total) {
    throw new Error(`o esquadrão (${inimigos} inimigos, ${aliados} aliados) não cabe no mapa (${cap.inimigos}, ${cap.aliados}, ${cap.total})`);
  }
  return mapa === 'bunker' ? nascimentosDoBunker(c) : mapa === 'praia' ? nascimentosDaLista(c, PRAIA_SPAWNS) : mapa === 'amazonia' ? nascimentosDaLista(c, AMAZONIA_SPAWNS) : nascimentosDaArena(c);
}
