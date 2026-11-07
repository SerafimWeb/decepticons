import type { Fala } from '../combat/CerebroDoTime';
import { caminhoDaFala } from './falas';
import type { PlayerDeVoz } from './Narrador';
import { falasDoGatilho, radioGravada, type FalaDeRadio } from './radio';

/**
 * O rádio de campo no jogo (P316): quando o cérebro do time faz uma chamada (pinça, em posição, vai, reagrupar), toca a fala que o Comandante gravou no Estúdio: a do **piloto aliado**
 * (o rádio de quem está do seu lado) ou a do **rádio inimigo interceptado**, o plano que o time inimigo de fato vai executar, dito em voz alta. Só da tela (G1/G2): a simulação não sabe
 * que existe voz; o gancho é o `match.onFala`, que já diz o lado. **Não fala e não falha:** fala sem `.mp3` gravado fica muda (o texto do rádio continua no feed).
 *
 * Como num rádio de verdade, o bipe que abre o canal vem **antes** da voz e o que fecha vem **depois** dela.
 *
 * Custo: uma consulta a um `Map` e uma lista curta por chamada (poucas por minuto: o cérebro fala a cada ~20 s); os clipes (~15 KB) só são pedidos para quem tem o interruptor ligado
 * e só os que o manifesto `vozesGeradas.json` lista (sem 404 à toa). Nada por quadro, nada por tick.
 */
export interface OpcoesDoRadio {
  player: PlayerDeVoz;
  /** A fala de rádio tem `.mp3` gravado? Por padrão, o manifesto `vozesGeradas.json` (sotaque br): o catálogo do rádio só entra neste pedaço sob demanda, nunca no pacote de partida. */
  gravada?: (chave: string) => boolean;
  /** A raiz do jogo (`/` ou `/jogar/`): é de onde os `.mp3` são pedidos. */
  base: string;
  /** Relógio em segundos (qualquer um que só cresça). */
  agora: () => number;
  /** Outra voz (o narrador) está falando agora? O rádio espera a vez e nunca fala por cima. */
  ocupado?: () => boolean;
  /** O bipe que abre (`true`) e fecha (`false`) o canal, sintetizado pelo `AudioSystem`. Sem ele, a voz toca direto. */
  bipe?: (abrir: boolean) => void;
  /** Agenda uma função para daqui a `ms` (o `setTimeout` por padrão; o teste injeta o seu). */
  agendar?: (fn: () => void, ms: number) => unknown;
  /** O equilíbrio da voz contra os efeitos (o volume do jogador é aplicado pelo mestre do `AudioSystem`). Padrão 1. */
  ganho?: number;
}

/** As chamadas do cérebro do time, as mesmas do rádio de texto (`combat/radioFalas.ts`). */
export const CHAMADAS_DO_CEREBRO = ['pinca', 'posicao', 'vai', 'reagrupar'] as const satisfies readonly Fala[];

/** Entre duas falas de rádio, no mínimo (s): o cérebro fala em ondas e o rádio não pode virar tagarelice. */
export const INTERVALO_MINIMO_S = 3;
/** Depois que uma fala acaba, a folga antes da próxima (s). */
export const FOLGA_DEPOIS_DA_FALA_S = 1;
/** Entre o bipe que abre o canal e o começo da voz (ms): o bipe toca inteiro antes da primeira sílaba. */
export const ABERTURA_MS = 130;

export class RadioDeCampo {
  private livreAte = Number.NEGATIVE_INFINITY;
  /** Qual variação toca da próxima vez, por lado e chamada: gira por todas antes de repetir. */
  private readonly vez = new Map<string, number>();

  constructor(private readonly o: OpcoesDoRadio) {}

  private candidatas(aliado: boolean, fala: Fala): readonly FalaDeRadio[] {
    const gravada = this.o.gravada ?? radioGravada;
    return falasDoGatilho(aliado ? 'piloto' : 'intercepto', `cerebro:${fala}`).filter((f) => gravada(f.chave));
  }

  private nome = (chave: string): string => `br/${chave}`;

  private pedir(chave: string): void {
    this.o.player.pedir(this.nome(chave), this.o.base + caminhoDaFala('br', chave));
  }

  private agendar(fn: () => void, ms: number): void {
    (this.o.agendar ?? ((f, t) => setTimeout(f, t)))(fn, ms);
  }

  /** Pede os clipes já gravados das chamadas do cérebro, dos dois lados. Chamar quando a partida abre e quando o interruptor do painel liga. */
  preparar(): void {
    for (const aliado of [true, false]) for (const fala of CHAMADAS_DO_CEREBRO) for (const f of this.candidatas(aliado, fala)) this.pedir(f.chave);
  }

  /** O time `aliado` (ou o inimigo) fez a chamada `fala`: toca uma fala gravada dela. Devolve `true` se a fala saiu (ou foi agendada para sair). */
  chamada(aliado: boolean, fala: Fala): boolean {
    const lista = this.candidatas(aliado, fala);
    if (lista.length === 0) return false;
    const agora = this.o.agora();
    if (agora < this.livreAte || this.o.ocupado?.()) return false;
    const lado = `${aliado ? 'aliado' : 'inimigo'}/${fala}`;
    const i = (this.vez.get(lado) ?? 0) % lista.length;
    const nome = this.nome(lista[i]!.chave);
    if (!this.o.player.pronto(nome)) {
      this.pedir(lista[i]!.chave); // ainda baixando: esta vez fica muda, a próxima sai com a voz
      return false;
    }
    this.vez.set(lado, i + 1);
    this.livreAte = agora + INTERVALO_MINIMO_S; // a vez do rádio fica reservada desde já
    const falar = (): void => {
      const duracao = this.o.player.tocar(nome, this.o.ganho ?? 1);
      if (duracao <= 0) return;
      this.livreAte = Math.max(this.livreAte, this.o.agora() + duracao + FOLGA_DEPOIS_DA_FALA_S);
      if (this.o.bipe) this.agendar(() => this.o.bipe?.(false), duracao * 1000);
    };
    if (this.o.bipe) {
      this.o.bipe(true);
      this.agendar(falar, ABERTURA_MS);
    } else falar();
    return true;
  }
}
