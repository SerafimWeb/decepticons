import { PRACA_FONTES, PRACA_PREDIOS, PRACA_SAIDAS } from '../environment/PracaLayout';
import type { ConfigDaMultidao } from './Multidao';

/**
 * A MISSÃO DO 8 DE JANEIRO (ordem P217, `fichas/cenario-8-de-janeiro.md` § 2 e § 6, passo 5): a regra de fim da fase, **pura** (G1/G2, G14: só números, sem Three nem Rapier). O jogador defende os três
 * prédios da Praça dos Três Poderes de uma multidão que chega pelas fontes do mapa (`sim/Multidao.ts`):
 *
 *  - **A integridade** de cada prédio (`INTEGRIDADE_MAX`) cai com quem está na fachada e com cada mesa suja do saguão. **Um prédio a zero perde a missão.**
 *  - **A sujeira:** parte de quem chega à fachada entra e suja uma mesa do saguão (o Mech não passa pela porta, `LARGURA_DA_PORTA`). Os **faxineiros são agentes de verdade** (P243,
 *    `combat/FaxineiroController.ts`): andróides aliados que andam até a mesa suja do prédio deles, ficam parados limpando por `TEMPO_DE_LIMPEZA_S` e voltam ao posto. Esta classe só
 *    guarda o estado (suja, reservada por quem já vai nela, limpa) e decide **qual** mesa cada um pega (`reservarMesa`); quem anda e quando termina é o cérebro de cada um.
 *  - **Vence** quem mantém os três prédios de pé até a cota acabar e a Praça esvaziar. **Perde** se um prédio cai, ou se o tempo passa da última chegada (`GRACA_TICKS`) com gente na Praça.
 *  - **A nota** não é só o número de abates: `naoLetal` é a parte dos que foram **expulsos** (fugiram do tiro ou do susto) entre os que a missão tirou da Praça. O jogo mostra que a força é a última saída.
 *
 * **Os números são palpite de engenheiro** (R13): falta jogar para calibrar. O fim dispara **uma vez** (`aoTerminar`). Custo: uma passada por 3 prédios por tick, sem alocar (G4/G5).
 */

/** A semente da missão (G2): o servidor e o cliente geram a mesma multidão. É uma data, não um sorteio. */
export const SEMENTE_DA_MISSAO = 20260108;
/** Quantos chegam ao todo (contando os androides rebeldes, passo seguinte). */
export const COTA_DA_MISSAO = 1500;
/** As fontes despejam por 5 minutos (a regra de duração do projeto): 18.000 ticks a 60 Hz. */
export const DURACAO_DA_MISSAO_TICKS = 18_000;
/** Depois da última chegada a Praça tem este tempo (60 s) para esvaziar; passou disso com gente nela, a missão se perde. */
export const GRACA_TICKS = 3_600;

/** A vida de cada prédio. */
export const INTEGRIDADE_MAX = 1000;
/** Quanto cada figurante na fachada desgasta o prédio, por segundo. */
export const DESGASTE_DA_FACHADA_S = 1.4;
/** Quanto cada mesa suja desgasta o prédio, por segundo, enquanto estiver suja. */
export const DESGASTE_DA_MESA_S = 1.0;
/** De cada 100 que chegam à fachada, quantos entram e sujam uma mesa. */
export const PERCENTUAL_DE_SUJEIRA = 18;
/** Quantos faxineiros cada prédio tem (um por porta do saguão: `PONTOS_DOS_FAXINEIROS`). O tempo de limpeza é do agente (`combat/FaxineiroController.ts`), não desta regra. */
export const FAXINEIROS_POR_PREDIO = 2;

/** O susto por perto: quem está a menos disto de um jogador vivo foge (m). */
export const RAIO_DO_SUSTO = 6;
/** A investida do Mech (o dash) leva quem está nesta distância dele (m), com este dano: a "porrada" da ficha, eliminar à mão sem arma nova. */
export const RAIO_DA_INVESTIDA = 2.4;
export const DANO_DA_INVESTIDA = 30;

/** Os androides rebeldes (o único inimigo que luta): quantos ficam vivos ao mesmo tempo (o pool do `BotSystem`, G11: nada é criado no tick) e as vagas em que o pool nasce (o lugar de verdade é o do ônibus, `aoEntrar`). */
export const REBELDES_MAX = 6;
export const PONTOS_DOS_REBELDES: readonly (readonly [number, number])[] = Array.from({ length: REBELDES_MAX }, (_, k) => {
  const onibus = PRACA_FONTES.filter((f) => f.tipo === 'onibus');
  const o = onibus[k % onibus.length]!;
  return [o.x, o.z] as const;
});

/**
 * O nome de todo androide rebelde (P251, ordem do Comandante): "AI-5", o modelo — o mesmo em todos, nunca numerado (1, 2, 3…).
 * Os apelidos individuais que o Comandante pediu junto (crítica política genérica, nunca nome ou marca de pessoa ou grupo real —
 * a régua de sempre desta fase) não cabem no nameplate (`NAME_MAX` = 16 bytes: "AI-5 " + a maioria das palavras já estoura);
 * ficam como a lista de referência para quem narrar a partida (`fichas/cenario-8-de-janeiro.md`).
 */
export const NOME_DOS_REBELDES = 'AI-5';
export const NOMES_DOS_REBELDES: readonly string[] = Array.from({ length: REBELDES_MAX }, () => NOME_DOS_REBELDES);

/** Quantas mesas tem o saguão de cada prédio (a ordem é a de `PracaLayout`). */
export const MESAS_POR_PREDIO: readonly number[] = PRACA_PREDIOS.map((p) => p.saguao.mesas.length);
/** As mesas de cada prédio (x, z): onde o faxineiro anda para limpar (`combat/FaxineiroController.ts`). */
export const MESAS_DOS_PREDIOS: readonly (readonly { x: number; z: number }[])[] = PRACA_PREDIOS.map((p) => p.saguao.mesas);

/** Quanto o faxineiro nasce para dentro do saguão, além da linha da porta (m): a porta fica no meio da parede (1 m de espessura, `environment/PracaLayout.ts`) e o piso só começa do lado de dentro — nascer na própria linha cai fora do mapa, sem chão sob o pé. */
const DENTRO_DA_PORTA_M = 1.2;

/** Onde cada faxineiro nasce e para onde volta sem mesa para limpar: uma porta de cada prédio (`FAXINEIROS_POR_PREDIO` por prédio), puxada para dentro do saguão (`DENTRO_DA_PORTA_M`), reto, na perpendicular da parede mais perto — nunca na diagonal rumo ao centro, que empurraria a porta estreita (1,9 m) para cima do batente ao lado. */
export const PONTOS_DOS_FAXINEIROS: readonly { predio: number; x: number; z: number }[] = PRACA_PREDIOS.flatMap((p, predio) => {
  const { x0, z0, x1, z1 } = p.saguao.caixa;
  return p.saguao.portas.slice(0, FAXINEIROS_POR_PREDIO).map((porta) => {
    const normal = [
      { d: Math.abs(porta.x - x0), dx: 1, dz: 0 },
      { d: Math.abs(porta.x - x1), dx: -1, dz: 0 },
      { d: Math.abs(porta.z - z0), dx: 0, dz: 1 },
      { d: Math.abs(porta.z - z1), dx: 0, dz: -1 },
    ].sort((a, b) => a.d - b.d)[0]!;
    return { predio, x: porta.x + normal.dx * DENTRO_DA_PORTA_M, z: porta.z + normal.dz * DENTRO_DA_PORTA_M };
  });
});

/** A multidão da missão: as fontes e as saídas do mapa, a frente de cada prédio como alvo, a cota e a duração da missão. */
export function configDaMissaoJaneiro(): ConfigDaMultidao {
  return { semente: SEMENTE_DA_MISSAO, cota: COTA_DA_MISSAO, duracaoTicks: DURACAO_DA_MISSAO_TICKS, fontes: PRACA_FONTES, predios: PRACA_PREDIOS.map((p) => p.frente), saidas: PRACA_SAIDAS };
}

export type FaseDaMissaoJaneiro = 'em-curso' | 'vitoria' | 'derrota';
/** Por que se perdeu: um prédio caiu, ou o tempo passou com gente na Praça. */
export type CausaDaDerrotaJaneiro = 'predio' | 'tempo';

/** O que a Praça mostra agora à regra (a partida preenche a cada tick, sem alocar). */
export interface SituacaoDaPraca {
  /** Quantos figurantes estão na fachada de cada prédio. */
  naFachada: ArrayLike<number>;
  /** Quantos ainda vão chegar pelas fontes (a multidão e os androides rebeldes agendados). */
  faltamChegar: number;
  /** Quantos estão na Praça agora (a multidão chegando, na fachada ou fugindo, e os androides rebeldes vivos). */
  presentes: number;
  /** Eliminados pelo jogador até agora (a multidão conta). */
  eliminados: number;
  /** Os androides rebeldes que o jogador já derrubou (eles contam em `presentes` e em `faltamChegar` enquanto vivos ou por chegar, e não entram na nota não letal). */
  rebeldesEliminados: number;
}

export interface ResultadoDaMissaoJaneiro {
  eliminados: number;
  expulsos: number;
  mesasLimpas: number;
  /** Os androides rebeldes derrubados. */
  rebeldes: number;
  segundos: number;
  /** A integridade que sobrou em cada prédio (0 a `INTEGRIDADE_MAX`). */
  integridade: readonly number[];
  /** Os expulsos entre os que a missão tirou da Praça (0 a 1; 1 = ninguém foi eliminado). */
  naoLetal: number;
  causa: CausaDaDerrotaJaneiro | null;
}

/** Um número estável de 0 a 99 para o figurante `i` (G2: sem sorteio ao vivo; o mesmo em qualquer plataforma). */
export function sorteioDoFigurante(i: number): number {
  return (Math.imul(i + 1, 2654435761) >>> 0) % 100;
}

export class MissaoJaneiro {
  fase: FaseDaMissaoJaneiro = 'em-curso';
  causa: CausaDaDerrotaJaneiro | null = null;
  /** Segundos de missão (o relógio só corre enquanto ela está em curso). */
  tempoS = 0;
  expulsos = 0;
  mesasLimpas = 0;
  private eliminados = 0;
  private rebeldes = 0;
  /** A integridade de cada prédio. */
  readonly integridade: number[];
  /** Por prédio, as mesas sujas (1) e limpas (0): a ordem é a de `PracaLayout`. */
  private readonly suja: Uint8Array[];
  private readonly nSujas: number[];
  /** Por prédio, a mesa suja que já tem um faxineiro indo nela (1) ou livre (0): evita dois agentes na mesma mesa. */
  private readonly reservada: Uint8Array[];

  /** `mesasPorPredio`: quantas mesas tem o saguão de cada prédio (o tamanho dá o número de prédios). */
  constructor(
    mesasPorPredio: readonly number[],
    private readonly aoTerminar?: (sobreviveu: boolean, resultado: ResultadoDaMissaoJaneiro) => void,
  ) {
    this.integridade = mesasPorPredio.map(() => INTEGRIDADE_MAX);
    this.suja = mesasPorPredio.map((n) => new Uint8Array(n));
    this.nSujas = mesasPorPredio.map(() => 0);
    this.reservada = mesasPorPredio.map((n) => new Uint8Array(n));
  }

  get terminou(): boolean {
    return this.fase !== 'em-curso';
  }

  get predios(): number {
    return this.integridade.length;
  }

  /** A mesa `m` do prédio `p` está suja? (o desenho lê daqui) */
  mesaSuja(p: number, m: number): boolean {
    return this.suja[p]?.[m] === 1;
  }

  mesasSujas(p: number): number {
    return this.nSujas[p] ?? 0;
  }

  /** Reserva a primeira mesa suja e livre do prédio `p` para um faxineiro (`FaxineiroController`, que vai andar até ela); -1 sem nenhuma livre (todas limpas, ou já reservadas por outro). */
  reservarMesa(p: number): number {
    const mesas = this.suja[p];
    const reservada = this.reservada[p];
    if (!mesas || !reservada) return -1;
    for (let m = 0; m < mesas.length; m++) if (mesas[m] === 1 && reservada[m] === 0) { reservada[m] = 1; return m; }
    return -1;
  }

  /** O faxineiro desistiu da mesa `m` sem limpar (hoje só o `reset`; mantém a conta certa se um dia ele for interrompido). */
  liberarMesa(p: number, m: number): void {
    const reservada = this.reservada[p];
    if (reservada) reservada[m] = 0;
  }

  /** O faxineiro terminou de limpar a mesa `m` do prédio `p`. */
  limparMesa(p: number, m: number): void {
    const mesas = this.suja[p];
    if (!mesas || mesas[m] !== 1) return;
    mesas[m] = 0;
    const reservada = this.reservada[p];
    if (reservada) reservada[m] = 0;
    this.nSujas[p]!--;
    this.mesasLimpas++;
  }

  /** Um figurante chegou à fachada do prédio `p`: parte deles entra e suja uma mesa limpa (a primeira escolhida pelo número do figurante). Devolve a mesa suja, ou -1. */
  aoChegar(i: number, p: number): number {
    if (this.terminou) return -1;
    const mesas = this.suja[p];
    if (!mesas || sorteioDoFigurante(i) >= PERCENTUAL_DE_SUJEIRA) return -1;
    const limpas = mesas.length - (this.nSujas[p] ?? 0);
    if (limpas <= 0) return -1;
    let alvo = Math.floor(sorteioDoFigurante(i + 7919) * limpas / 100);
    for (let m = 0; m < mesas.length; m++) {
      if (mesas[m] === 1) continue;
      if (alvo-- > 0) continue;
      mesas[m] = 1;
      this.nSujas[p]!++;
      return m;
    }
    return -1;
  }

  /** O jogador assustou ou atirou em quem foi embora fugindo: conta como expulso (quem fugiu por conta própria, depois de cumprir o tempo, não conta). */
  registrarExpulso(): void {
    if (!this.terminou) this.expulsos++;
  }

  /** O resultado até agora (a tela de fim lê daqui). */
  resultado(): ResultadoDaMissaoJaneiro {
    const eliminados = this.eliminados;
    const tirados = eliminados + this.expulsos;
    return {
      eliminados,
      expulsos: this.expulsos,
      mesasLimpas: this.mesasLimpas,
      rebeldes: this.rebeldes,
      segundos: this.tempoS,
      integridade: this.integridade.slice(),
      naoLetal: tirados === 0 ? 1 : this.expulsos / tirados,
      causa: this.causa,
    };
  }

  /**
   * Um tick (`tick` é o da multidão, o mesmo no servidor e no cliente). Primeiro os prédios apanham com quem está na fachada e com cada mesa ainda suja (os faxineiros, agentes de
   * verdade, limpam por fora — `reservarMesa`/`limparMesa`); depois se vê o fim. **Se um prédio cai no mesmo tick em que a Praça esvazia, vale a derrota**: a missão é mantê-los de pé.
   */
  fixedUpdate(dt: number, tick: number, praca: SituacaoDaPraca): void {
    if (this.terminou) return;
    this.tempoS += dt;
    this.eliminados = praca.eliminados;
    this.rebeldes = praca.rebeldesEliminados;
    for (let p = 0; p < this.integridade.length; p++) {
      const desgaste = (praca.naFachada[p] ?? 0) * DESGASTE_DA_FACHADA_S + this.nSujas[p]! * DESGASTE_DA_MESA_S;
      if (desgaste > 0) this.integridade[p] = Math.max(0, this.integridade[p]! - desgaste * dt);
    }
    if (this.integridade.some((v) => v <= 0)) this.terminar('derrota', 'predio');
    else if (praca.faltamChegar === 0 && praca.presentes === 0) this.terminar('vitoria', null);
    else if (tick > DURACAO_DA_MISSAO_TICKS + GRACA_TICKS && praca.presentes > 0) this.terminar('derrota', 'tempo');
  }

  private terminar(fase: 'vitoria' | 'derrota', causa: CausaDaDerrotaJaneiro | null): void {
    this.fase = fase;
    this.causa = causa;
    this.aoTerminar?.(fase === 'vitoria', this.resultado());
  }

  /** Recomeça a missão (o jogo reinicia a partida). */
  reset(): void {
    this.fase = 'em-curso';
    this.causa = null;
    this.tempoS = 0;
    this.expulsos = 0;
    this.mesasLimpas = 0;
    this.eliminados = 0;
    this.rebeldes = 0;
    this.integridade.fill(INTEGRIDADE_MAX);
    for (const m of this.suja) m.fill(0);
    this.nSujas.fill(0);
    for (const r of this.reservada) r.fill(0);
  }
}
