import type { MapId } from '../environment/Bunker';
import type { GameMode } from '../sim/gameMode';
import { WORLD_MASK } from './worldMask';
import { mapaLiberado } from '../core/Lancamento';

/**
 * O teatro de operações do console de comando (dono, 11/10: "um mapa do mundo, pra mostrar onde são as missões (cenários) de forma
 * tática e gamificada"). Só dados e contas, sem tela: a lista das missões com o lugar de cada uma no mapa, o estado de cada uma para
 * a partida atual e a projeção do mapa-múndi (graus → pixels). O desenho mora em `WorldMap.ts`.
 *
 * **Os lugares.** O `UNIVERSO.md` registra o Brasil no centro do mapa, o litoral de Fortaleza como chegada dos cabos submarinos e as
 * arenas possíveis por recurso (dados, energia, chips), e proíbe os agentes de escreverem geopolítica nova. Então: o que o universo já
 * diz entra como está; o lugar que ninguém decidiu ainda leva `proposta: true` e aparece assim no mapa, até o Comandante confirmar.
 */

export type Recurso = 'sede' | 'dados' | 'energia' | 'chips' | 'agua' | 'poder';

export interface Teatro {
  id: 'arena' | 'bunker' | 'cabos' | 'barragem' | 'chips' | 'rio' | 'janeiro';
  nome: string;
  lugar: string;
  lat: number;
  lon: number;
  recurso: Recurso;
  /** O mapa que o jogo abre. Ausente: a missão ainda não foi construída (EM BREVE). */
  mapa?: MapId;
  /** Modos em que a missão roda (o Bunker é só do Deathmatch, como em `mapFromSearch`). */
  modos: readonly GameMode[];
  resumo: string;
  /** O lugar ainda não foi confirmado pelo Comandante. */
  proposta: boolean;
  /** De que lado do marcador vai o nome (Manaus e Fortaleza estão na mesma latitude: um nome para cada lado). */
  lado: 'esquerda' | 'direita';
}

export const TEATROS: readonly Teatro[] = [
  {
    id: 'arena', nome: 'CIDADE NEON', lugar: 'São Paulo · SP', lat: -23.55, lon: -46.63, recurso: 'sede', mapa: 'arena',
    modos: ['deathmatch', 'survival', 'ctf'], resumo: 'A sede da SERAFIM e o Banco VORCARIS sob ataque das IAs rebeldes.', proposta: true, lado: 'direita',
  },
  {
    // Era em Brasília; saiu para dar lugar ao 8 DE JANEIRO (P217, 19/10): o Comandante o mandou para o Mato Grosso do Sul. Corumbá (o Pantanal, na fronteira) e não Campo Grande: a regra de 6° entre pinos (theater.test) barra a capital, a 4,9° da Foz do Iguaçu.
    id: 'bunker', nome: 'BUNKER', lugar: 'Corumbá · MS', lat: -19.01, lon: -57.65, recurso: 'dados', mapa: 'bunker',
    modos: ['deathmatch'], resumo: 'Quatro andares de concreto e aço. Treino offline contra os bots.', proposta: true, lado: 'direita',
  },
  {
    id: 'cabos', nome: 'ESTAÇÃO DE CABOS', lugar: 'Fortaleza · CE', lat: -3.73, lon: -38.52, recurso: 'dados', mapa: 'praia',
    modos: ['deathmatch', 'survival'], resumo: 'A orla de Fortaleza em 640 m: o porto, a Ponte Metálica e a estação onde os cabos do Atlântico Sul chegam. Defenda-a.', proposta: false, lado: 'direita',
  },
  {
    id: 'rio', nome: 'TERRAS RARAS', lugar: 'Afluente do Amazonas · PA', lat: -3.5, lon: -53.0, recurso: 'agua', mapa: 'amazonia',
    modos: ['deathmatch', 'survival'], resumo: 'O rio, a floresta e a mina que o envenena, em 2,4 km: o Draga-01 desce o leito rumo à aldeia. Derrube-o antes que ele chegue: acima dele a água é limpa e viva; depois dele, óleo e veneno.', proposta: true, lado: 'esquerda',
  },
  {
    // A fase do 8 de janeiro (P217): o lugar é o que o Comandante mandou (a Praça dos Três Poderes). Sem mapa ainda: "EM BREVE" até a ficha (`fichas/cenario-8-de-janeiro.md`) ser aprovada e o cenário ser construído.
    id: 'janeiro', nome: '8 DE JANEIRO', lugar: 'Praça dos Três Poderes · Brasília · DF', lat: -15.79, lon: -47.88, recurso: 'poder',
    modos: [], resumo: 'A Praça dos Três Poderes tomada por uma multidão de verde e amarelo que quer o poder à força. Missão em desenho: a ficha está no repositório.', proposta: false, lado: 'direita',
  },
  {
    id: 'barragem', nome: 'BARRAGEM', lugar: 'Foz do Iguaçu · PR', lat: -25.41, lon: -54.59, recurso: 'energia',
    modos: [], resumo: 'As turbinas que alimentam os datacenters do país.', proposta: true, lado: 'esquerda',
  },
  {
    id: 'chips', nome: 'FÁBRICA DE CHIPS', lugar: 'Manaus · AM', lat: -3.12, lon: -60.02, recurso: 'chips',
    modos: [], resumo: 'Sala limpa e braços robóticos: o silício que as IAs querem.', proposta: true, lado: 'esquerda',
  },
];

export const RECURSO_NOME: Readonly<Record<Recurso, string>> = { sede: 'SEDE SERAFIM', dados: 'DADOS', energia: 'ENERGIA', chips: 'CHIPS', agua: 'ÁGUA', poder: 'SEDE DOS PODERES' };

/**
 * O que a missão é para a partida aberta agora: `aqui` (você está nela), `disponivel` (um clique leva até ela), `outro-modo` (existe,
 * mas não no modo escolhido) ou `em-breve` (ainda não construída).
 */
export type EstadoTeatro = 'aqui' | 'disponivel' | 'outro-modo' | 'em-breve';

export function estadoDoTeatro(t: Teatro, mapaAtual: MapId, modo: GameMode): EstadoTeatro {
  // Sem mapa construído, ou com o mapa ainda fechado ao público (P197, `core/Lancamento.ts`): EM BREVE. Quem já está nele (modo Comandante) continua "aqui".
  if (!t.mapa || (t.mapa !== mapaAtual && !mapaLiberado(t.mapa))) return 'em-breve';
  if (t.mapa === mapaAtual) return 'aqui';
  return t.modos.includes(modo) ? 'disponivel' : 'outro-modo';
}

/** "23°33′S 46°38′O": a posição da missão em graus e minutos (O de oeste e L de leste, como se escreve em português). */
export function formatarCoordenada(lat: number, lon: number): string {
  const gm = (v: number) => {
    const total = Math.round(Math.abs(v) * 60);
    return `${Math.floor(total / 60)}°${String(total % 60).padStart(2, '0')}′`;
  };
  return `${gm(lat)}${lat < 0 ? 'S' : 'N'} ${gm(lon)}${lon < 0 ? 'O' : 'L'}`;
}

// ─── Projeção ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Uma vista do mapa: o centro (graus) e a escala (pixels por grau). Equirretangular: simples, e o Brasil não deforma. */
export interface Vista {
  lon: number;
  lat: number;
  escala: number;
}

/** Caixa de enquadramento em graus (`lon0` < `lon1`; `lat0` é o norte). A do mundo é centrada no Brasil (`UNIVERSO.md` §2). */
export interface Caixa {
  lon0: number;
  lon1: number;
  lat0: number;
  lat1: number;
}

export const ENQUADRAMENTOS = {
  brasil: { lon0: -76, lon1: -32, lat0: 7, lat1: -35 },
  mundo: { lon0: -230, lon1: 130, lat0: WORLD_MASK.lat0, lat1: WORLD_MASK.lat0 - WORLD_MASK.rows * WORLD_MASK.step },
} as const satisfies Record<string, Caixa>;
export type Enquadramento = keyof typeof ENQUADRAMENTOS;

/** A vista que mostra a caixa inteira num retângulo de `w` × `h` pixels, com uma margem em volta. */
export function enquadrar(c: Caixa, w: number, h: number, margem = 0.06): Vista {
  const larg = (c.lon1 - c.lon0) * (1 + margem * 2);
  const alt = (c.lat0 - c.lat1) * (1 + margem * 2);
  return { lon: (c.lon0 + c.lon1) / 2, lat: (c.lat0 + c.lat1) / 2, escala: Math.max(0.01, Math.min(w / larg, h / alt)) };
}

/** Diferença de longitude em [-180, 180): o mapa dá a volta (a vista do mundo centrada no Brasil corta no Pacífico). */
export function deltaLon(lon: number, centro: number): number {
  return ((((lon - centro + 180) % 360) + 360) % 360) - 180;
}

/** Graus → pixels no retângulo `w` × `h`. Escreve em `out` (sem alocar) e o devolve. */
export function projetar(v: Vista, w: number, h: number, lon: number, lat: number, out: { x: number; y: number }): { x: number; y: number } {
  out.x = w / 2 + deltaLon(lon, v.lon) * v.escala;
  out.y = h / 2 - (lat - v.lat) * v.escala;
  return out;
}

/** Entre duas vistas, para o zoom animado: o centro anda em linha reta e a escala, em proporção (o zoom não acelera no fim). */
export function interpolarVista(a: Vista, b: Vista, t: number, out: Vista): Vista {
  const k = Math.min(1, Math.max(0, t));
  out.lon = a.lon + deltaLon(b.lon, a.lon) * k;
  out.lat = a.lat + (b.lat - a.lat) * k;
  out.escala = a.escala * Math.pow(b.escala / a.escala, k);
  return out;
}

// ─── A grade do mapa-múndi ────────────────────────────────────────────────────────────────────────────────────────────────

export const MAR = 0;
export const TERRA = 1;
export const BRASIL = 2;

/** A grade de `worldMask.ts` aberta: uma célula por grau, linha a linha do norte para o sul (0 mar, 1 terra, 2 Brasil). */
export function decodificarMascara(rle: readonly string[] = WORLD_MASK.rle, cols: number = WORLD_MASK.cols): Uint8Array {
  const grade = new Uint8Array(rle.length * cols);
  rle.forEach((linha, r) => {
    let c = 0;
    for (const m of linha.matchAll(/([.#b])(\d+)/g)) {
      const v = m[1] === 'b' ? BRASIL : m[1] === '#' ? TERRA : MAR;
      const n = Number(m[2]);
      if (v !== MAR) grade.fill(v, r * cols + c, r * cols + c + n);
      c += n;
    }
    if (c !== cols) throw new Error(`worldMask: a linha ${r} tem ${c} células, devia ter ${cols}`);
  });
  return grade;
}

/** Quantas células pular entre dois pontos desenhados: abaixo de `gapMin` pixels entre pontos o mapa vira borrão. */
export function passoDaGrade(escala: number, gapMin = 3.2): number {
  return Math.max(1, Math.ceil(gapMin / (escala * WORLD_MASK.step)));
}
