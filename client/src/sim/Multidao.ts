import { mulberry32 } from '../core/rng';

/**
 * A MULTIDÃO DO 8 DE JANEIRO (P217 e P219, `fichas/cenario-8-de-janeiro.md` § 3): milhares de figurantes que chegam à Praça de ônibus, dos bueiros e das lixeiras, marcham até um prédio,
 * ficam um tempo na fachada e fogem. **Simulação pura** (sem tela, sem Rapier, sem DOM: G1/G2/G14), do jeito que o servidor e o cliente rodam igual.
 *
 * **A ideia que serve ao CPU e ao online de uma vez: a posição de um figurante é uma FUNÇÃO DO TEMPO**, não um estado integrado a cada tick. Cada um nasce com
 * `(fonte, tick de nascimento, tipo, alvo, semente)` e a posição em qualquer tick `t` é calculada: caminha em linha reta da fonte ao prédio, com um balanço que sai da semente. Só o que o jogador
 * causa é estado: *morreu no tick d* e *fugiu no tick f* (a partir de f, a posição é a de f mais a corrida até a saída). Por isso:
 * - **CPU:** nenhuma integração por figurante por tick. As posições se calculam **sob demanda** (uma vez por tick em que alguém atira ou assusta); a chegada, a fuga automática e a saída
 *   são **eventos agendados** (ponteiros sobre vetores ordenados), e o desenho calcula a posição na shader com o tick atual. Nada alocado depois da construção (G4/G5).
 * - **Rede (G11):** não se manda posição. O servidor e o cliente constroem a **mesma** multidão da mesma configuração (semente) e trocam só os eventos `morreu(id, tick)` e `fugiu(id, tick)`;
 *   quem entra no meio recebe o estado compacto (`exportarEstado`/`aplicarEstado`).
 * - **Determinismo:** só `+ − × ÷`, `floor` e `sqrt` (exatos no IEEE-754) e o `mulberry32` com semente; o balanço usa um seno em parábolas por partes (`senoParabolico`), não `Math.sin`, para
 *   dar o mesmo número em qualquer navegador.
 *
 * **Modos.** `autoridade: true` (o servidor e o jogo offline): os tiros, as explosões e o susto por perto geram morte e fuga. `autoridade: false` (o cliente online, o "espelho"): só aplica os
 * eventos do servidor (`aplicarMorte`, `aplicarFuga`); a chegada, a fuga automática e a saída são as mesmas, porque saem do tempo.
 *
 * **Os androides rebeldes** (os únicos que lutam) **não** são linhas deste vetor: são entidades de verdade, no máximo 6 vivos. A multidão só **agenda** a chegada deles (`androides`: tick e lugar);
 * a missão os cria.
 */

/** Os três tipos de figurante que andam em vetor (o androide rebelde é entidade, `androides`). */
export const GADO = 0;
export const CARECA = 1;
export const PERUCA = 2;
export type TipoDeFigurante = typeof GADO | typeof CARECA | typeof PERUCA;
export const TIPOS = 3;

export type TipoDeFonte = 'onibus' | 'bueiro' | 'lixeira';

export interface FonteDeChegada {
  tipo: TipoDeFonte;
  x: number;
  z: number;
}

/** Um prédio: `x`/`z` é o centro da faixa de chão em frente à fachada, onde a multidão se aglomera; `meia` é a meia largura dela (m). */
export interface PredioDaPraca {
  x: number;
  z: number;
  meia: number;
}

export interface PontoDeSaida {
  x: number;
  z: number;
}

export interface ConfigDaMultidao {
  /** A semente da fase (G2): a mesma semente é a mesma multidão, no servidor e no cliente. */
  semente: number;
  fontes: readonly FonteDeChegada[];
  predios: readonly PredioDaPraca[];
  /** Por onde a multidão foge (o limite do mapa). Sem saídas, foge de volta para a fonte. */
  saidas: readonly PontoDeSaida[];
  /** Quantos chegam ao todo (a cota da fase), contando os androides rebeldes. */
  cota: number;
  /** Até que tick as fontes despejam (a fase tem 5 minutos: 18.000 ticks). */
  duracaoTicks: number;
  /** Quanto tempo ficam na fachada antes de fugir (ticks). */
  tempoNaFachadaTicks?: number;
  /** A parte da cota que vem de cada tipo de fonte (soma 1; o que não tem fonte no mapa passa para as outras). */
  partes?: Readonly<Record<TipoDeFonte, number>>;
  /** A mistura dos tipos de figurante (a parte dos androides rebeldes é `pAndroide`): `[GADO, CARECA, PERUCA]` normalizada. */
  mistura?: readonly [number, number, number];
  /** A fração da cota que são androides rebeldes (a missão os cria). */
  pAndroide?: number;
  /** O servidor e o jogo offline decidem a morte e a fuga; o cliente online só espelha. */
  autoridade?: boolean;
  /** A vida de cada tipo, na mesma escala do dano das armas. */
  vida?: readonly [number, number, number];
}

export const PADRAO = {
  tempoNaFachadaTicks: 240,
  partes: { onibus: 0.45, bueiro: 0.35, lixeira: 0.2 } as Readonly<Record<TipoDeFonte, number>>,
  mistura: [0.75, 0.12, 0.08] as readonly [number, number, number],
  pAndroide: 0.05,
  vida: [12, 24, 12] as readonly [number, number, number],
} as const;

/** Metros por segundo de cada tipo andando (o careca é o mais lento, a peruca o mais rápido) e a correria da fuga (× esta razão). */
export const VELOCIDADE: readonly [number, number, number] = [1.6, 1.1, 2.2];
export const RAZAO_DA_FUGA = 2.2;
/** A altura e o raio do corpo (o acerto). */
export const ALTURA: readonly [number, number, number] = [1.75, 1.7, 1.8];
export const RAIO_DO_CORPO = 0.45;
/** O balanço do andar (m); o período (90 a 130 ticks) sai da semente. A velocidade lateral máxima (8 × amplitude ÷ período) fica abaixo de 1 m/s: um gingado, não um tremor. */
const BALANCO = 0.18;
const TICKS_POR_SEGUNDO = 60;
/** O susto por perto é conferido de 6 em 6 ticks. */
export const PASSO_DO_SUSTO = 6;

/** A quantidade de figurantes por leva e o intervalo entre um e outro (ticks), por tipo de fonte: o ônibus despeja um grupo grande, o bueiro um jato, a lixeira um fio. */
const LEVA: Readonly<Record<TipoDeFonte, { tamanho: number; passo: number }>> = {
  onibus: { tamanho: 40, passo: 10 },
  bueiro: { tamanho: 16, passo: 18 },
  lixeira: { tamanho: 3, passo: 50 },
};
/** A primeira chegada só depois de 5 s (o jogador respira). */
const PRIMEIRA_CHEGADA = 300;

/** Seno em parábolas por partes: só `+ − ×`, `floor`: o mesmo número em qualquer plataforma (G1/G2). `u` em voltas, devolve [-1, 1]. */
export function senoParabolico(u: number): number {
  const f = u - Math.floor(u);
  const h = f < 0.5 ? f * 2 : f * 2 - 1;
  const y = 4 * h * (1 - h);
  return f < 0.5 ? y : -y;
}

/** Quem é a causa de uma fuga (o desenho e a pontuação diferenciam). */
export type CausaDaFuga = 'cumpriu' | 'tiro' | 'susto' | 'rede';

export interface AndroideAgendado {
  tick: number;
  x: number;
  z: number;
}

/** O estado compacto que quem entra no meio da fase recebe: os mortos (um bit por figurante) e as fugas (id e tick). */
export interface EstadoDaMultidao {
  mortos: Uint8Array;
  fugas: Int32Array;
}

interface Leva {
  fonte: number;
  inicio: number;
  n: number;
  passo: number;
}

export class Multidao {
  readonly total: number;
  /** A chegada dos androides rebeldes (a missão os cria): o tick e o lugar. */
  readonly androides: readonly AndroideAgendado[];
  readonly autoridade: boolean;

  // ---- o cronograma (imutável depois da construção): um figurante por posição, em ordem de nascimento ----
  readonly nasce: Int32Array;
  readonly tipo: Uint8Array;
  readonly alvo: Uint8Array;
  readonly origemX: Float32Array;
  readonly origemZ: Float32Array;
  readonly destinoX: Float32Array;
  readonly destinoZ: Float32Array;
  readonly dirX: Float32Array;
  readonly dirZ: Float32Array;
  readonly comprimento: Float32Array;
  readonly velocidade: Float32Array;
  readonly fase: Float32Array;
  readonly periodo: Float32Array;
  readonly chegaEm: Int32Array;

  // ---- o que o jogador causa ----
  private readonly vida: Int16Array;
  private readonly morto: Uint8Array;
  private readonly morreuEm: Int32Array;
  private readonly fugiu: Uint8Array;
  private readonly fugaEm: Int32Array;
  private readonly fugaX: Float32Array;
  private readonly fugaZ: Float32Array;
  private readonly fugaDirX: Float32Array;
  private readonly fugaDirZ: Float32Array;
  private readonly fugaVel: Float32Array;
  private readonly saiuEm: Int32Array;
  private readonly saiu: Uint8Array;

  // ---- os ponteiros dos eventos agendados ----
  private readonly porChegada: Int32Array;
  private proxNasce = 0;
  private proxChegada = 0;
  private proxFugaAuto = 0;
  private readonly fugindo: Int32Array;
  private nFugindo = 0;
  private tickAtual = -1;

  private readonly tempoNaFachada: number;
  private readonly vidaPorTipo: readonly [number, number, number];
  private readonly saidas: readonly PontoDeSaida[];
  private eliminadosN = 0;
  private expulsosN = 0;

  // ---- o cache de posições (calculado sob demanda, uma vez por tick) ----
  readonly posX: Float32Array;
  readonly posZ: Float32Array;
  readonly presente: Uint8Array;
  private posTick = -2;
  private readonly _naFachada: Uint16Array;
  private px = 0;
  private pz = 0;

  // ---- os avisos (G3: o jogo liga o módulo por callbacks) ----
  aoChegar: ((i: number, predio: number) => void) | null = null;
  aoFugir: ((i: number, causa: CausaDaFuga) => void) | null = null;
  aoMorrer: ((i: number) => void) | null = null;
  aoSair: ((i: number) => void) | null = null;

  constructor(cfg: ConfigDaMultidao) {
    if (cfg.predios.length === 0) throw new Error('a multidão precisa de ao menos um prédio');
    if (cfg.fontes.length === 0) throw new Error('a multidão precisa de ao menos uma fonte de chegada');
    this.tempoNaFachada = cfg.tempoNaFachadaTicks ?? PADRAO.tempoNaFachadaTicks;
    this.vidaPorTipo = cfg.vida ?? PADRAO.vida;
    this.saidas = cfg.saidas;
    this.autoridade = cfg.autoridade ?? true;
    const rng = mulberry32(cfg.semente);
    const mistura = cfg.mistura ?? PADRAO.mistura;
    const soma = mistura[0] + mistura[1] + mistura[2];
    const pAndroide = cfg.pAndroide ?? PADRAO.pAndroide;

    // 1. as levas: quanto cada tipo de fonte despeja, e quando
    const indicesDe: Record<TipoDeFonte, number[]> = { onibus: [], bueiro: [], lixeira: [] };
    cfg.fontes.forEach((f, i) => indicesDe[f.tipo].push(i));
    const partes = { ...(cfg.partes ?? PADRAO.partes) };
    let sobra = 0;
    for (const t of ['onibus', 'bueiro', 'lixeira'] as const) if (indicesDe[t].length === 0) { sobra += partes[t]; partes[t] = 0; }
    const comFonte = (['onibus', 'bueiro', 'lixeira'] as const).filter((t) => indicesDe[t].length > 0);
    for (const t of comFonte) partes[t] += sobra / comFonte.length;
    const levas: Leva[] = [];
    let restante = cfg.cota;
    comFonte.forEach((t, k) => {
      const q = k === comFonte.length - 1 ? restante : Math.min(restante, Math.round(cfg.cota * partes[t]));
      restante -= q;
      if (q <= 0) return;
      const { tamanho, passo } = LEVA[t];
      const nLevas = Math.max(1, Math.round(q / tamanho));
      const janela = Math.max(1, cfg.duracaoTicks - PRIMEIRA_CHEGADA);
      for (let j = 0; j < nLevas; j++) {
        const n = Math.floor(q / nLevas) + (j < q % nLevas ? 1 : 0);
        if (n <= 0) continue;
        const centro = (j + 0.5 + (rng() - 0.5) * 0.6) / nLevas;
        const ultimo = (n - 1) * passo;
        const inicio = Math.max(PRIMEIRA_CHEGADA, Math.min(cfg.duracaoTicks - 1 - ultimo, Math.floor(PRIMEIRA_CHEGADA + centro * janela)));
        const fonte = indicesDe[t][Math.floor(rng() * indicesDe[t].length)]!;
        levas.push({ fonte, inicio, n, passo });
      }
    });

    // 2. um nascimento por figurante: o tipo, o prédio-alvo, o desvio da origem e do destino, a velocidade e o balanço (tudo do mesmo gerador, em ordem fixa)
    interface Nascimento { tick: number; fonte: number; tipo: number; alvo: number; ox: number; oz: number; tx: number; tz: number; vel: number; fase: number; periodo: number }
    const lista: Nascimento[] = [];
    const androides: AndroideAgendado[] = [];
    for (const l of levas) {
      const f = cfg.fontes[l.fonte]!;
      for (let k = 0; k < l.n; k++) {
        const tick = l.inicio + k * l.passo;
        if (rng() < pAndroide) {
          androides.push({ tick, x: f.x + (rng() - 0.5) * 3, z: f.z + (rng() - 0.5) * 3 });
          continue;
        }
        const sorteio = rng() * soma;
        const tipo = sorteio < mistura[0] ? GADO : sorteio < mistura[0] + mistura[1] ? CARECA : PERUCA;
        const alvo = Math.floor(rng() * cfg.predios.length);
        const p = cfg.predios[alvo]!;
        lista.push({
          tick, fonte: l.fonte, tipo, alvo,
          ox: f.x + (rng() - 0.5) * 3, oz: f.z + (rng() - 0.5) * 3,
          tx: p.x + (rng() - 0.5) * 2 * p.meia, tz: p.z + rng() * 3,
          vel: VELOCIDADE[tipo]! * (0.9 + 0.2 * rng()),
          fase: rng(), periodo: 90 + Math.floor(rng() * 5) * 10,
        });
      }
    }
    // a ordem de nascimento é o id (estável: empate pela ordem em que foi criado)
    const ordem = lista.map((_, i) => i).sort((a, b) => lista[a]!.tick - lista[b]!.tick || a - b);
    androides.sort((a, b) => a.tick - b.tick);
    this.androides = androides;

    const n = (this.total = lista.length);
    this.nasce = new Int32Array(n);
    this.tipo = new Uint8Array(n);
    this.alvo = new Uint8Array(n);
    this.origemX = new Float32Array(n);
    this.origemZ = new Float32Array(n);
    this.destinoX = new Float32Array(n);
    this.destinoZ = new Float32Array(n);
    this.dirX = new Float32Array(n);
    this.dirZ = new Float32Array(n);
    this.comprimento = new Float32Array(n);
    this.velocidade = new Float32Array(n);
    this.fase = new Float32Array(n);
    this.periodo = new Float32Array(n);
    this.chegaEm = new Int32Array(n);
    this.vida = new Int16Array(n);
    this.morto = new Uint8Array(n);
    this.morreuEm = new Int32Array(n).fill(-1);
    this.fugiu = new Uint8Array(n);
    this.fugaEm = new Int32Array(n).fill(-1);
    this.fugaX = new Float32Array(n);
    this.fugaZ = new Float32Array(n);
    this.fugaDirX = new Float32Array(n);
    this.fugaDirZ = new Float32Array(n);
    this.fugaVel = new Float32Array(n);
    this.saiuEm = new Int32Array(n).fill(-1);
    this.saiu = new Uint8Array(n);
    this.fugindo = new Int32Array(n);
    this.posX = new Float32Array(n);
    this.posZ = new Float32Array(n);
    this.presente = new Uint8Array(n);
    this._naFachada = new Uint16Array(cfg.predios.length);
    ordem.forEach((k, i) => {
      const s = lista[k]!;
      this.nasce[i] = s.tick;
      this.tipo[i] = s.tipo;
      this.alvo[i] = s.alvo;
      this.origemX[i] = s.ox;
      this.origemZ[i] = s.oz;
      this.destinoX[i] = s.tx;
      this.destinoZ[i] = s.tz;
      const dx = s.tx - s.ox;
      const dz = s.tz - s.oz;
      const L = Math.sqrt(dx * dx + dz * dz);
      this.comprimento[i] = L;
      this.dirX[i] = L > 0 ? dx / L : 1;
      this.dirZ[i] = L > 0 ? dz / L : 0;
      this.velocidade[i] = s.vel;
      this.fase[i] = s.fase;
      this.periodo[i] = s.periodo;
      this.chegaEm[i] = s.tick + Math.ceil((L / s.vel) * TICKS_POR_SEGUNDO);
      this.vida[i] = this.vidaPorTipo[s.tipo]!;
    });
    // a chegada e a fuga automática seguem a mesma ordem (a fuga é a chegada mais um tempo fixo)
    this.porChegada = Int32Array.from({ length: n }, (_, i) => i).sort((a, b) => this.chegaEm[a]! - this.chegaEm[b]! || a - b);
  }

  // ======================= a posição, função do tempo =======================

  /** Calcula a posição do figurante `i` no tick `t` em `px`/`pz`. `false` se ele não está na Praça (ainda não nasceu, morreu ou já saiu). Sem alocar. */
  private calcular(i: number, t: number): boolean {
    if (t < this.nasce[i]!) return false;
    // morto some no tick da morte; `morreuEm < 0` é o que morreu antes de o estado ser recebido (entrada no meio da fase)
    if (this.morto[i] === 1 && (this.morreuEm[i]! < 0 || t >= this.morreuEm[i]!)) return false;
    if (this.fugiu[i] === 1 && t >= this.fugaEm[i]!) {
      if (t >= this.saiuEm[i]!) return false;
      const s = ((t - this.fugaEm[i]!) / TICKS_POR_SEGUNDO) * this.fugaVel[i]!;
      this.px = this.fugaX[i]! + this.fugaDirX[i]! * s;
      this.pz = this.fugaZ[i]! + this.fugaDirZ[i]! * s;
      return true;
    }
    return this.caminho(i, t);
  }

  /** A posição no caminho da fonte ao prédio (antes de fugir), sem olhar se morreu ou fugiu. */
  private caminho(i: number, t: number): boolean {
    const dt = t - this.nasce[i]!;
    if (dt < 0) return false;
    const L = this.comprimento[i]!;
    let d = (dt / TICKS_POR_SEGUNDO) * this.velocidade[i]!;
    if (d > L) d = L;
    const falta = L - d;
    // o balanço some na chegada (a amplitude encolhe nos últimos 2 m)
    const amp = BALANCO * (falta >= 2 ? 1 : falta / 2);
    const lat = amp * senoParabolico(this.fase[i]! + dt / this.periodo[i]!);
    const dx = this.dirX[i]!;
    const dz = this.dirZ[i]!;
    this.px = this.origemX[i]! + dx * d - dz * lat;
    this.pz = this.origemZ[i]! + dz * d + dx * lat;
    return true;
  }

  /** A posição do figurante `i` no tick `t` (para o teste e para quem quer um só). `false` se não está na Praça. */
  posicao(i: number, t: number, saida: { x: number; z: number }): boolean {
    if (!this.calcular(i, t)) return false;
    saida.x = this.px;
    saida.z = this.pz;
    return true;
  }

  /** Preenche `posX`, `posZ` e `presente` de todos no tick `t` (uma vez por tick: repetir no mesmo tick não custa nada). */
  calcularPosicoes(t: number): void {
    if (this.posTick === t) return;
    this.posTick = t;
    for (let i = 0; i < this.total; i++) {
      if (this.calcular(i, t)) {
        this.posX[i] = this.px;
        this.posZ[i] = this.pz;
        this.presente[i] = 1;
      } else this.presente[i] = 0;
    }
  }

  // ======================= o tempo andando =======================

  /**
   * Avança a multidão até o tick `t` (cada tick em ordem; pular ticks é permitido: os eventos agendados saem na ordem e com o tick certo). `silencioso` não avisa ninguém (quem entra
   * no meio da fase refaz o passado sem repetir os avisos da missão).
   */
  avancar(t: number, silencioso = false): void {
    if (t < this.tickAtual) return;
    this.tickAtual = t;
    while (this.proxNasce < this.total && this.nasce[this.proxNasce]! <= t) this.proxNasce++;
    // a chegada à fachada
    while (this.proxChegada < this.total) {
      const i = this.porChegada[this.proxChegada]!;
      if (this.chegaEm[i]! > t) break;
      this.proxChegada++;
      if (this.morto[i] === 1 || (this.fugiu[i] === 1 && this.fugaEm[i]! <= this.chegaEm[i]!)) continue;
      if (!silencioso) this.aoChegar?.(i, this.alvo[i]!);
    }
    // a fuga automática: a chegada mais o tempo na fachada
    const T = this.tempoNaFachada;
    while (this.proxFugaAuto < this.total) {
      const i = this.porChegada[this.proxFugaAuto]!;
      const quando = this.chegaEm[i]! + T;
      if (quando > t) break;
      this.proxFugaAuto++;
      if (this.morto[i] === 0 && this.fugiu[i] === 0) this.fugir(i, quando, 'cumpriu', silencioso);
    }
    // a saída pelo limite do mapa
    for (let k = 0; k < this.nFugindo; ) {
      const i = this.fugindo[k]!;
      if (this.saiuEm[i]! > t) {
        k++;
        continue;
      }
      this.fugindo[k] = this.fugindo[--this.nFugindo]!;
      if (this.morto[i] === 1) continue;
      this.saiu[i] = 1;
      this.expulsosN++;
      if (!silencioso) this.aoSair?.(i);
    }
  }

  // ======================= o que o jogador causa =======================

  /** Faz `i` fugir a partir do tick `t`: guarda de onde saiu, para onde corre e quando chega ao limite. */
  private fugir(i: number, t: number, causa: CausaDaFuga, silencioso = false): void {
    if (this.fugiu[i] === 1 || this.morto[i] === 1) return;
    if (!this.caminho(i, t)) return;
    const x = this.px;
    const z = this.pz;
    // a saída mais perto (sem saídas, de volta para a fonte)
    let sx = this.origemX[i]!;
    let sz = this.origemZ[i]!;
    let melhor = Infinity;
    for (const s of this.saidas) {
      const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
      if (d < melhor) {
        melhor = d;
        sx = s.x;
        sz = s.z;
      }
    }
    const dx = sx - x;
    const dz = sz - z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const vel = this.velocidade[i]! * RAZAO_DA_FUGA;
    this.fugiu[i] = 1;
    this.fugaEm[i] = t;
    this.fugaX[i] = x;
    this.fugaZ[i] = z;
    this.fugaDirX[i] = dist > 0 ? dx / dist : 1;
    this.fugaDirZ[i] = dist > 0 ? dz / dist : 0;
    this.fugaVel[i] = vel;
    this.saiuEm[i] = t + Math.ceil((dist / vel) * TICKS_POR_SEGUNDO);
    this.fugindo[this.nFugindo++] = i;
    this.posTick = -2;
    if (!silencioso) this.aoFugir?.(i, causa);
  }

  /** Tira `dano` de vida de `i` no tick `t`; devolve `true` se morreu. */
  private ferir(i: number, dano: number, t: number): boolean {
    if (this.morto[i] === 1 || this.saiu[i] === 1) return false;
    this.vida[i] = (this.vida[i]! - dano) | 0;
    if (this.vida[i]! > 0) {
      this.fugir(i, t, 'tiro');
      return false;
    }
    this.matar(i, t);
    return true;
  }

  private matar(i: number, t: number, silencioso = false): void {
    if (this.morto[i] === 1) return;
    this.morto[i] = 1;
    this.morreuEm[i] = t;
    this.eliminadosN++;
    this.posTick = -2;
    if (!silencioso) this.aoMorrer?.(i);
  }

  /**
   * O tiro: o primeiro figurante na linha da mira (origem, direção unitária, alcance em metros) no tick `t`. Devolve o id, ou -1 se errou; `dano` tira vida (morre ou foge). Só a autoridade
   * atira: o espelho devolve -1.
   */
  atirar(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, alcance: number, dano: number, t: number): number {
    if (!this.autoridade) return -1;
    this.calcularPosicoes(t);
    const h2 = dx * dx + dz * dz;
    let melhorI = -1;
    let melhorS = alcance;
    for (let i = 0; i < this.total; i++) {
      if (this.presente[i] === 0) continue;
      const cx = this.posX[i]! - ox;
      const cz = this.posZ[i]! - oz;
      const altura = ALTURA[this.tipo[i]!]!;
      // o trecho da reta (em metros ao longo da direção unitária) dentro do cilindro: [s0, s1] pelo plano, cortado pela faixa de altura [0, altura]
      let s0 = 0;
      let s1 = melhorS;
      if (h2 > 1e-12) {
        const proj = (cx * dx + cz * dz) / h2;
        const qx = cx - dx * proj;
        const qz = cz - dz * proj;
        const folga = RAIO_DO_CORPO * RAIO_DO_CORPO - (qx * qx + qz * qz);
        if (folga < 0) continue;
        const meio = Math.sqrt(folga / h2);
        s0 = Math.max(0, proj - meio);
        s1 = Math.min(s1, proj + meio);
      } else if (cx * cx + cz * cz > RAIO_DO_CORPO * RAIO_DO_CORPO) continue;
      if (dy > 1e-9 || dy < -1e-9) {
        const sA = -oy / dy;
        const sB = (altura - oy) / dy;
        s0 = Math.max(s0, sA < sB ? sA : sB);
        s1 = Math.min(s1, sA < sB ? sB : sA);
      } else if (oy < 0 || oy > altura) continue;
      if (s0 > s1) continue;
      if (s0 < melhorS) {
        melhorS = s0;
        melhorI = i;
      }
    }
    if (melhorI >= 0) this.ferir(melhorI, dano, t);
    return melhorI;
  }

  /** A explosão: tira `dano` de todos no raio (em 3D, com o chão) e **assusta** quem está até o dobro do raio. Devolve quantos morreram. Só a autoridade. */
  explodir(x: number, y: number, z: number, raio: number, dano: number, t: number): number {
    if (!this.autoridade) return 0;
    this.calcularPosicoes(t);
    const r2 = raio * raio;
    const susto2 = raio * raio * 4;
    let mortos = 0;
    for (let i = 0; i < this.total; i++) {
      if (this.presente[i] === 0) continue;
      const dx = this.posX[i]! - x;
      const dz = this.posZ[i]! - z;
      const altura = ALTURA[this.tipo[i]!]!;
      const dv = y > altura ? y - altura : y < 0 ? -y : 0;
      const d2 = dx * dx + dz * dz + dv * dv;
      if (d2 <= r2) {
        if (this.ferir(i, dano, t)) mortos++;
      } else if (d2 <= susto2) this.fugir(i, t, 'susto');
    }
    return mortos;
  }

  /** O susto por perto: quem está a menos de `raio` de algum dos pontos (os jogadores) foge. Só de 6 em 6 ticks (o chamador pode chamar todo tick). Devolve quantos assustou. */
  assustarPorPerto(pontos: readonly { x: number; z: number }[], raio: number, t: number): number {
    if (!this.autoridade || t % PASSO_DO_SUSTO !== 0) return 0;
    this.calcularPosicoes(t);
    const r2 = raio * raio;
    let n = 0;
    for (let i = 0; i < this.total; i++) {
      if (this.presente[i] === 0 || this.fugiu[i] === 1) continue;
      for (let k = 0; k < pontos.length; k++) {
        const dx = this.posX[i]! - pontos[k]!.x;
        const dz = this.posZ[i]! - pontos[k]!.z;
        if (dx * dx + dz * dz <= r2) {
          this.fugir(i, t, 'susto');
          n++;
          break;
        }
      }
    }
    return n;
  }

  // ======================= o espelho: o que o servidor mandou =======================

  /** O servidor disse: `i` morreu no tick `t`. */
  aplicarMorte(i: number, t: number, silencioso = false): void {
    this.matar(i, t, silencioso);
  }

  /** O servidor disse: `i` fugiu no tick `t`. */
  aplicarFuga(i: number, t: number, silencioso = false): void {
    this.fugir(i, t, 'rede', silencioso);
  }

  /** O estado que quem entra no meio da fase recebe: os mortos (um bit por figurante) e as fugas causadas pelo jogador (id e tick), sem as automáticas (saem do tempo). */
  exportarEstado(): EstadoDaMultidao {
    const mortos = new Uint8Array((this.total + 7) >> 3);
    for (let i = 0; i < this.total; i++) if (this.morto[i] === 1) mortos[i >> 3]! |= 1 << (i & 7);
    const fugas: number[] = [];
    const T = this.tempoNaFachada;
    for (let i = 0; i < this.total; i++) {
      if (this.fugiu[i] === 1 && this.fugaEm[i] !== this.chegaEm[i]! + T) fugas.push(i, this.fugaEm[i]!);
    }
    return { mortos, fugas: Int32Array.from(fugas) };
  }

  /** Aplica o estado recebido **antes** de `avancar(tickAtual, true)`: refaz o passado sem repetir os avisos. */
  aplicarEstado(e: EstadoDaMultidao): void {
    for (let i = 0; i < this.total; i++) if ((e.mortos[i >> 3]! >> (i & 7)) & 1) this.matar(i, -1, true);
    for (let k = 0; k + 1 < e.fugas.length; k += 2) this.fugir(e.fugas[k]!, e.fugas[k + 1]!, 'rede', true);
  }

  // ======================= o que a missão lê =======================

  get nasceram(): number {
    return this.proxNasce;
  }
  get eliminados(): number {
    return this.eliminadosN;
  }
  get expulsos(): number {
    return this.expulsosN;
  }
  /** Na Praça agora: nasceu e não morreu nem saiu. */
  get presentes(): number {
    return this.proxNasce - this.eliminadosN - this.expulsosN;
  }
  /** Ainda vão chegar (a cota que as fontes não despejaram). */
  get faltamChegar(): number {
    return this.total - this.proxNasce;
  }
  /** Ninguém mais vai chegar e a Praça está vazia: o fim da multidão (a vitória é isto com os prédios de pé). */
  get terminou(): boolean {
    return this.proxNasce === this.total && this.presentes === 0;
  }

  /** Quantos estão na fachada de cada prédio no tick `t` (chegaram, não morreram, não fugiram): é o que a missão usa para desgastar a integridade. */
  contarNaFachada(t: number): Uint16Array {
    this._naFachada.fill(0);
    for (let i = 0; i < this.total; i++) {
      if (this.morto[i] === 1 || this.saiu[i] === 1 || this.chegaEm[i]! > t) continue;
      if (this.fugiu[i] === 1 && this.fugaEm[i]! <= t) continue;
      this._naFachada[this.alvo[i]!]!++;
    }
    return this._naFachada;
  }

  /** Para o desenho: o tick em que `i` morreu (-1 se vivo ou se morreu antes de a entrada no meio da fase), para o tombo. */
  morreuNoTick(i: number): number {
    return this.morto[i] === 1 ? this.morreuEm[i]! : -1;
  }
  estaMorto(i: number): boolean {
    return this.morto[i] === 1;
  }
  fugiuNoTick(i: number): number {
    return this.fugiu[i] === 1 ? this.fugaEm[i]! : -1;
  }
}

