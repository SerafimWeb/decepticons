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

/** As frações de vida do núcleo que disparam o alerta de "a rede está caindo", do maior para o menor. */
export const LIMIARES_DO_NUCLEO = [0.75, 0.5, 0.25] as const;

/**
 * O alerta do núcleo da estação: devolve o texto **uma vez** quando há o que avisar — os invasores entraram no complexo, a rede
 * passou de um limiar para baixo (75%, 50%, 25%) ou a estação caiu. Recompor a rede (acima de 90%) rearma os limiares. O `PraiaHud`
 * mostra o texto; aqui só mora a regra.
 */
export class AlertaDoNucleo {
  private ultimoLimiar = 1;
  private pressaoAntes = 0;
  private caiu = false;

  atualiza(fracao: number, pressao: number): string | null {
    if (fracao <= 0) {
      if (this.caiu) return null;
      this.caiu = true;
      return 'A ESTAÇÃO CAIU';
    }
    if (fracao > 0.9) this.ultimoLimiar = 1;
    let texto: string | null = null;
    for (const l of LIMIARES_DO_NUCLEO) {
      if (fracao <= l && l < this.ultimoLimiar) {
        this.ultimoLimiar = l;
        texto = `ESTAÇÃO A ${Math.round(l * 100)}% · EXPULSE OS INVASORES`;
        break;
      }
    }
    if (texto === null && pressao > 0 && this.pressaoAntes === 0) texto = 'INVASORES NA ESTAÇÃO · EXPULSE-OS';
    this.pressaoAntes = pressao;
    return texto;
  }

  /** Missão nova: os limiares e a queda voltam a valer. */
  reset(): void {
    this.ultimoLimiar = 1;
    this.pressaoAntes = 0;
    this.caiu = false;
  }
}

/**
 * Os avisos dos CABOS DE DADOS (P162): compara o estado de cada cabo no quadro anterior com o de agora (códigos de `CabosDeDados`: 0 livre, 1 injetando, 2 tomado,
 * 3 cortado) e devolve **uma** linha curta para o anúncio do topo, ou `null` se nada mudou. Manda o mais grave: cabo tomado, depois cortado, depois liberado e, por
 * último, o andróide que acabou de se ligar. Quem está desde o começo no mesmo estado não avisa de novo.
 */
export function avisoDosCabos(antes: ArrayLike<number>, depois: ArrayLike<number>): string | null {
  let melhor: string | null = null;
  let prioridade = 0;
  for (let i = 0; i < depois.length; i++) {
    const a = antes[i] ?? 0;
    const d = depois[i] ?? 0;
    if (a === d) continue;
    const n = i + 1;
    let texto: string | null = null;
    let p = 0;
    if (d === 2) {
      texto = `CABO ${n} TOMADO · A REDE ESTÁ SENDO ENVENENADA`;
      p = 4;
    } else if (d === 3) {
      texto = `CABO ${n} CORTADO · CONSERTE`;
      p = 3;
    } else if (a >= 2 && d < 2) {
      texto = `CABO ${n} LIBERADO`;
      p = 2;
    } else if (a === 0 && d === 1) {
      texto = `CABO ${n} · ANDRÓIDE LIGADO · INJETANDO DESINFORMAÇÃO`;
      p = 1;
    }
    if (texto !== null && p > prioridade) {
      melhor = texto;
      prioridade = p;
    }
  }
  return melhor;
}

/**
 * Os avisos das PORTAS do prédio (P163): compara o estado de cada porta no quadro anterior com o de agora (0 fechada, 1 forçada, 2 arrombada) e devolve **uma** linha curta, ou
 * `null`. Manda a mais grave: arrombada, depois recuperada, por último "sob ataque" (a primeira vez que a porta passa a ser forçada).
 */
export function avisoDasPortas(antes: ArrayLike<number>, depois: ArrayLike<number>, nomes: readonly string[]): string | null {
  let melhor: string | null = null;
  let prioridade = 0;
  for (let i = 0; i < depois.length; i++) {
    const a = antes[i] ?? 0;
    const d = depois[i] ?? 0;
    if (a === d) continue;
    const nome = nomes[i] ?? `PORTA ${i + 1}`;
    let texto: string | null = null;
    let p = 0;
    if (d === 2) {
      texto = `${nome} ARROMBADA · INVASORES DENTRO`;
      p = 3;
    } else if (a === 2) {
      texto = `${nome} RECUPERADA`;
      p = 2;
    } else if (a === 0 && d === 1) {
      texto = `${nome} SOB ATAQUE`;
      p = 1;
    }
    if (texto !== null && p > prioridade) {
      melhor = texto;
      prioridade = p;
    }
  }
  return melhor;
}

/**
 * O aviso do QUADRO DE LUZ da cidade (P164): compara o estado do quadro no quadro anterior com o de agora (0 ligado, 1 sabotado, 2 apagado) e devolve uma linha curta, ou `null`. Manda a mais
 * grave: apagado, depois recuperado, por último "sob sabotagem" (a primeira vez que o quadro passa a ser depredado).
 */
export function avisoDoQuadro(antes: number, depois: number): string | null {
  if (antes === depois) return null;
  if (depois === 2) return 'CIDADE NO ESCURO · AS ZONAS DE CURA CAÍRAM';
  if (antes === 2) return 'QUADRO DE LUZ RECUPERADO · A LUZ VOLTOU';
  if (antes === 0 && depois === 1) return 'QUADRO DE LUZ SOB SABOTAGEM · A CIDADE VAI AO ESCURO';
  return null;
}

/** O cartão de missão da praia (mostrado uma vez, ao começar): a história em três linhas curtas — alegoria, sem nomes reais. */
export const CARTAO_DA_MISSAO = {
  titulo: 'OPERAÇÃO CABOS ABERTOS',
  linhas: [
    'Os cabos submarinos de Fortaleza trazem a internet para o país.',
    'Forças hostis desembarcam pela orla para invadir a rede e plantar desinformação.',
    'Segure a ESTAÇÃO: expulse quem entrar nos muros e elimine as ondas. Rede caída, missão perdida.',
  ],
} as const;
