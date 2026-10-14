import type { CtfTeam } from './CaptureTheFlag';

/** Os dois lados do Domínio: o do jogador e dos aliados dele (azul) e o dos rebeldes (vermelho). Os mesmos nomes do CTF. */
export type DominioLado = CtfTeam;

/** Um ponto de controle: a letra que a tela escreve e onde ele fica no mapa (metros). */
export interface DominioPontoDef {
  readonly letra: string;
  readonly x: number;
  readonly z: number;
}

/** Quem está em cima de um ponto agora, e em que pé ele está. Estado vivo da partida, lido pela tela e pelos bots. */
export interface DominioPonto {
  readonly def: DominioPontoDef;
  /** De −1 (inteiro vermelho) a +1 (inteiro azul). 0 = neutro. */
  control: number;
  /** Quem o domina: só muda quando o controle chega ao fim da escala (±1) e volta a ninguém quando passa por 0. */
  dono: DominioLado | null;
  /** Há unidades dos dois lados em cima dele: ninguém avança. */
  disputado: boolean;
  /** Quantas unidades vivas de cada lado estão no raio agora. */
  presenca: Record<DominioLado, number>;
}

export interface DominioPlacar {
  /** Pontos acumulados (fracionários por dentro; a tela mostra o inteiro de baixo). */
  pontos: number;
  /** Abates (desempate). */
  kills: number;
}

/** Uma unidade em campo: só o que a regra lê (um Mech, no jogo; um objeto simples, nos testes). */
export interface DominioUnidade {
  readonly alive: boolean;
  readonly simPosition: { readonly x: number; readonly z: number };
}

export interface DominioCallbacks {
  /** O dono de um ponto mudou (`antes` e `depois` podem ser `null`: neutro). */
  onDono?(ponto: DominioPonto, antes: DominioLado | null, depois: DominioLado | null): void;
  onProgresso?(tempoRestante: number, azul: Readonly<DominioPlacar>, vermelho: Readonly<DominioPlacar>): void;
  onFim?(vencedor: DominioLado | null, azul: Readonly<DominioPlacar>, vermelho: Readonly<DominioPlacar>): void;
}

/** Raio de captura (m): uma unidade a até esta distância do centro conta como "em cima" do ponto. */
export const DOMINIO_RAIO = 12;
/** Segundos para um ponto ir de neutro a dominado com uma unidade; mais unidades, mais rápido (até 3). Tomar de quem o domina leva o dobro (neutraliza, depois conquista). */
export const DOMINIO_CAPTURA_S = 8;
/** Cada unidade a mais em cima do ponto soma tanto à velocidade, até `DOMINIO_ACELERA_ATE` unidades. */
export const DOMINIO_ACELERA = 0.5;
export const DOMINIO_ACELERA_ATE = 3;
/** Pontos por segundo por ponto dominado. */
export const DOMINIO_PONTOS_POR_S = 1;
/** Quem chega aqui primeiro vence. */
export const DOMINIO_ALVO = 400;
/** Relógio da partida (s): no fim, vence quem tem mais pontos (empate: mais abates). */
export const DOMINIO_TEMPO_S = 480;

const LADOS: readonly DominioLado[] = ['blue', 'red'];

/** Quanto o controle de um ponto avança por segundo com `n` unidades de um lado só em cima dele. */
export function velocidadeDeCaptura(n: number): number {
  if (n <= 0) return 0;
  return (1 + DOMINIO_ACELERA * (Math.min(n, DOMINIO_ACELERA_ATE) - 1)) / DOMINIO_CAPTURA_S;
}

interface Entrada {
  readonly unidade: DominioUnidade;
  readonly lado: DominioLado;
}

/**
 * Regra pura do Domínio (pontos de controle). Cinco pontos (ou seis: a regra é a mesma, a lista é que muda), dois lados. Por tick, uma
 * passada por unidade e por ponto (≤ 40 unidades × 6 pontos), sem alocar, sem DOM, sem relógio de parede e sem sorteio (G1/G2):
 * o servidor poderá rodar esta mesma classe.
 *
 *  - **Capturar:** só um lado em cima do ponto, o controle anda para o lado dele (mais unidades, mais rápido). Os dois lados em cima:
 *    o ponto fica **disputado** e ninguém avança. Ninguém em cima: o ponto mantém o que tem.
 *  - **Dono:** quem leva o controle até o fim da escala domina o ponto; para tomá-lo, o inimigo primeiro o neutraliza (leva o controle a 0).
 *  - **Pontuar:** cada ponto dominado dá `DOMINIO_PONTOS_POR_S` por segundo ao dono. O alvo ou o relógio decide a partida.
 */
export class Dominio {
  readonly pontos: DominioPonto[];
  readonly placar: Record<DominioLado, DominioPlacar> = {
    blue: { pontos: 0, kills: 0 },
    red: { pontos: 0, kills: 0 },
  };
  tempoRestante: number;
  ended = false;
  vencedor: DominioLado | null = null;
  private readonly unidades: Entrada[] = [];
  private progressoEm = 0;

  constructor(
    defs: readonly DominioPontoDef[],
    private readonly callbacks: DominioCallbacks = {},
    private readonly tempoS = DOMINIO_TEMPO_S,
    private readonly alvo = DOMINIO_ALVO,
  ) {
    this.pontos = defs.map((def) => ({ def, control: 0, dono: null, disputado: false, presenca: { blue: 0, red: 0 } }));
    this.tempoRestante = tempoS;
  }

  register(unidade: DominioUnidade, lado: DominioLado): void {
    if (this.unidades.some((e) => e.unidade === unidade)) throw new Error('Unidade já registrada no Domínio');
    this.unidades.push({ unidade, lado });
  }

  unregister(unidade: DominioUnidade): void {
    const i = this.unidades.findIndex((e) => e.unidade === unidade);
    if (i >= 0) this.unidades.splice(i, 1);
  }

  ladoDe(unidade: DominioUnidade): DominioLado | undefined {
    return this.unidades.find((e) => e.unidade === unidade)?.lado;
  }

  /** Quantos pontos o lado domina agora. */
  dominados(lado: DominioLado): number {
    let n = 0;
    for (const p of this.pontos) if (p.dono === lado) n++;
    return n;
  }

  /** Os pontos de um lado, como a tela os escreve (inteiro de baixo). */
  pontosDe(lado: DominioLado): number {
    return Math.floor(this.placar[lado].pontos);
  }

  fixedUpdate(dt: number): void {
    if (this.ended) return;
    this.tempoRestante = Math.max(0, this.tempoRestante - dt);
    this.contarPresenca();
    for (const p of this.pontos) this.avancar(p, dt);
    for (const lado of LADOS) this.placar[lado].pontos += this.dominados(lado) * DOMINIO_PONTOS_POR_S * dt;

    const azul = this.pontosDe('blue');
    const vermelho = this.pontosDe('red');
    if (azul >= this.alvo || vermelho >= this.alvo) {
      // Os dois passando no mesmo tick é raríssimo; vence quem tem mais (e, igual, o desempate de sempre).
      this.terminar(this.desempate(azul, vermelho));
      return;
    }
    if (this.tempoRestante <= 0) {
      this.terminar(this.desempate(azul, vermelho));
      return;
    }
    this.progressoEm -= dt;
    if (this.progressoEm <= 0) {
      this.progressoEm = 0.2;
      this.callbacks.onProgresso?.(this.tempoRestante, this.placar.blue, this.placar.red);
    }
  }

  /** Quem matou quem: o abate de um lado conta (fogo amigo não). É só o desempate. */
  onKilled(morto: DominioUnidade, matador?: DominioUnidade): void {
    const ladoMorto = this.ladoDe(morto);
    const ladoMatador = matador ? this.ladoDe(matador) : undefined;
    if (ladoMatador && ladoMorto && ladoMatador !== ladoMorto) this.placar[ladoMatador].kills++;
  }

  /** Nova partida: tudo zerado, as unidades continuam registradas. */
  reset(): void {
    this.tempoRestante = this.tempoS;
    this.ended = false;
    this.vencedor = null;
    this.progressoEm = 0;
    for (const lado of LADOS) {
      this.placar[lado].pontos = 0;
      this.placar[lado].kills = 0;
    }
    for (const p of this.pontos) {
      p.control = 0;
      p.dono = null;
      p.disputado = false;
      p.presenca.blue = p.presenca.red = 0;
    }
    this.callbacks.onProgresso?.(this.tempoRestante, this.placar.blue, this.placar.red);
  }

  private contarPresenca(): void {
    for (const p of this.pontos) {
      p.presenca.blue = 0;
      p.presenca.red = 0;
    }
    for (const e of this.unidades) {
      if (!e.unidade.alive) continue;
      const { x, z } = e.unidade.simPosition;
      for (const p of this.pontos) {
        const dx = x - p.def.x;
        const dz = z - p.def.z;
        if (dx * dx + dz * dz <= DOMINIO_RAIO * DOMINIO_RAIO) p.presenca[e.lado]++;
      }
    }
  }

  private avancar(p: DominioPonto, dt: number): void {
    const { blue, red } = p.presenca;
    p.disputado = blue > 0 && red > 0;
    if (!p.disputado && (blue > 0 || red > 0)) {
      p.control = Math.max(-1, Math.min(1, p.control + (blue > 0 ? 1 : -1) * velocidadeDeCaptura(blue + red) * dt));
    }
    const antes = p.dono;
    let depois = antes;
    if (p.control >= 1) depois = 'blue';
    else if (p.control <= -1) depois = 'red';
    else if (antes === 'blue' && p.control <= 0) depois = null;
    else if (antes === 'red' && p.control >= 0) depois = null;
    if (depois !== antes) {
      p.dono = depois;
      this.callbacks.onDono?.(p, antes, depois);
    }
  }

  private desempate(azul: number, vermelho: number): DominioLado | null {
    if (azul !== vermelho) return azul > vermelho ? 'blue' : 'red';
    const ka = this.placar.blue.kills;
    const kv = this.placar.red.kills;
    if (ka !== kv) return ka > kv ? 'blue' : 'red';
    return null;
  }

  private terminar(vencedor: DominioLado | null): void {
    if (this.ended) return;
    this.ended = true;
    this.vencedor = vencedor;
    this.callbacks.onProgresso?.(this.tempoRestante, this.placar.blue, this.placar.red);
    this.callbacks.onFim?.(vencedor, this.placar.blue, this.placar.red);
  }
}
