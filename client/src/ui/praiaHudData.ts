import { FUNDURA_MOLHADA } from '../combat/Agua';
import { localEm, PRAIA_ESTACAO, PRAIA_PIER } from '../environment/PraiaLayout';
import { PRAIA_LIMITES } from '../environment/PraiaTerreno';

/**
 * O que o HUD da PRAIA DOS CABOS precisa saber, em **funções puras** (P127): onde cada ponto cai na faixa da costa, como o marcador da
 * estação se prende à borda da tela, quando anunciar o lugar em que o jogador entrou e o que dizer da água. O `PraiaHud.ts` só
 * desenha o resultado. Separar assim deixa a regra testável sem DOM (G14) e a UI sem conta.
 */

/** Até onde (m) o jogador vê os inimigos na faixa da costa: um alcance generoso, não um radar do mapa inteiro (P23: sem perfeição). */
export const FAIXA_ALCANCE_M = 260;

/** Um marco na faixa da costa: um rótulo e a posição (x) dele no mapa. */
export interface MarcoDaFaixa {
  id: 'porto' | 'ponte' | 'estacao';
  texto: string;
  x: number;
}

/** Os três marcos que orientam quem joga: o porto a oeste, a Ponte Metálica no meio e a estação (o objetivo) a leste. */
export const MARCOS_DA_FAIXA: readonly MarcoDaFaixa[] = [
  { id: 'porto', texto: 'PORTO', x: -273 },
  { id: 'ponte', texto: 'PONTE', x: PRAIA_PIER.x },
  { id: 'estacao', texto: 'ESTAÇÃO', x: PRAIA_ESTACAO.x },
];

/** Onde `x` cai na faixa (0 = ponta oeste, 1 = ponta leste), sempre dentro do intervalo. */
export function fracaoNaFaixa(x: number): number {
  const t = (x - PRAIA_LIMITES.minX) / (PRAIA_LIMITES.maxX - PRAIA_LIMITES.minX);
  return Math.max(0, Math.min(1, t));
}

/** A distância para o painel: metros inteiros até 999, depois quilômetros com uma casa ("1,2 km"). */
export function textoDeDistancia(m: number): string {
  const d = Math.max(0, m);
  return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Margens (px) que o marcador respeita nas bordas: o topo e a base guardam os banners e a barra de vida. */
export interface MargensDaTela {
  topo: number;
  base: number;
  esq: number;
  dir: number;
}

export interface MarcadorNaTela {
  /** Posição em pixels do centro do marcador. */
  x: number;
  y: number;
  /** O alvo está fora da tela (ou atrás): o marcador foi preso numa borda para mostrar a direção. */
  naBorda: boolean;
}

/**
 * Onde o marcador de um alvo cai na tela. `ndcX`/`ndcY` são as coordenadas de tela normalizadas (-1..1) do alvo, `atras` diz se ele
 * está atrás da câmera (e então o x vem espelhado: o marcador vai para a borda de baixo, do lado certo). Dentro das margens fica no
 * lugar; fora, é preso na borda mais próxima — assim o jogador sempre sabe para que lado fica o objetivo. Escreve em `fora` (sem alocar: G4).
 */
export function marcadorNaTela(ndcX: number, ndcY: number, atras: boolean, largura: number, altura: number, m: MargensDaTela, fora: MarcadorNaTela): MarcadorNaTela {
  const xMin = m.esq;
  const xMax = largura - m.dir;
  const yMin = m.topo;
  const yMax = altura - m.base;
  let px = ((atras ? -ndcX : ndcX) * 0.5 + 0.5) * largura;
  let py = (-ndcY * 0.5 + 0.5) * altura;
  if (atras) py = yMax; // atrás da câmera: na borda de baixo, do lado de onde ele está
  const dentro = !atras && px >= xMin && px <= xMax && py >= yMin && py <= yMax;
  fora.x = Math.max(xMin, Math.min(xMax, px));
  fora.y = Math.max(yMin, Math.min(yMax, py));
  fora.naBorda = !dentro;
  return fora;
}

/**
 * Anuncia em que lugar do mapa o jogador está: devolve o nome **uma vez**, quando ele mudou e ficou ali um instante (para o
 * anúncio não piscar ao roçar numa fronteira). A primeira leitura anuncia na hora (o início da partida).
 */
export class AnunciadorDeLugar {
  private atual = '';
  private candidato = '';
  private ha = 0;

  /** `dt` em segundos desde a última chamada; devolve o nome novo ou `null`. */
  atualiza(x: number, z: number, dt: number): string | null {
    const nome = localEm(x, z);
    if (this.atual === '') {
      this.atual = nome;
      return nome;
    }
    if (nome === this.atual) {
      this.candidato = '';
      this.ha = 0;
      return null;
    }
    if (nome !== this.candidato) {
      this.candidato = nome;
      this.ha = 0;
    }
    this.ha += dt;
    if (this.ha < 0.7) return null;
    this.atual = nome;
    this.candidato = '';
    this.ha = 0;
    return nome;
  }

  reset(): void {
    this.atual = '';
    this.candidato = '';
    this.ha = 0;
  }
}

export interface AvisoDeAgua {
  nivel: 'seco' | 'raso' | 'fundo';
  /** 0 a 1: o quanto do tempo de afogar já passou (só no fundo). */
  progresso: number;
  texto: string;
}

/** O que dizer da água sob os pés: seco (nada), raso (vadeando: freia, não afoga) ou fundo (o relógio do afogamento corre). Escreve em `fora`. */
export function avisoDeAgua(fundura: number, afogandoS: number, afogarS: number, afogaDesde: number, fora: AvisoDeAgua): AvisoDeAgua {
  if (fundura <= FUNDURA_MOLHADA) return escreve(fora, 'seco', 0, '');
  if (fundura < afogaDesde) return escreve(fora, 'raso', 0, 'VADEANDO · ANDA MAIS DEVAGAR');
  const progresso = afogarS > 0 ? Math.max(0, Math.min(1, afogandoS / afogarS)) : 1;
  if (afogandoS < afogarS) return escreve(fora, 'fundo', progresso, `FUNDO · AFOGA EM ${Math.max(0, afogarS - afogandoS).toFixed(1)} s · SAIA DO MAR`);
  return escreve(fora, 'fundo', 1, 'AFOGANDO · SAIA DO MAR');
}

function escreve(fora: AvisoDeAgua, nivel: AvisoDeAgua['nivel'], progresso: number, texto: string): AvisoDeAgua {
  fora.nivel = nivel;
  fora.progresso = progresso;
  fora.texto = texto;
  return fora;
}

/** O cartão de missão da praia (mostrado uma vez, ao começar): a história em três linhas curtas — alegoria, sem nomes reais. */
export const CARTAO_DA_MISSAO = {
  titulo: 'OPERAÇÃO CABOS ABERTOS',
  linhas: [
    'Os cabos submarinos de Fortaleza trazem a internet para o país.',
    'Forças hostis desembarcam pela orla para invadir a rede e plantar desinformação.',
    'Segure a ESTAÇÃO DE CABOS: elimine as ondas e proteja a liberdade da informação.',
  ],
} as const;
