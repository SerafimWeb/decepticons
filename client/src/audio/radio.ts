import catalogo from './radio.json';
import geradas from './vozesGeradas.json';

/**
 * O rádio de campo (P316): as falas que o Comandante GRAVA no Estúdio (aba VOZES) com a própria voz: ordens do Controle, respostas dos pilotos, o computador de
 * bordo, os gritos de guerra, os androides e as IAs rebeldes, e o rádio inimigo interceptado (o plano que o time inimigo realmente executa).
 * O catálogo é `radio.json` (uma fonte só: o Estúdio, o jogo e o roteiro impresso `ROTEIRO_DE_GRAVACAO.md` leem o mesmo arquivo). **Só português**: é a voz dele, nunca
 * gerada pelo ElevenLabs. Só da tela (G1/G2): nada daqui entra na simulação.
 *
 * Este módulo só descreve o catálogo; quem toca é o `RadioDeCampo`, que escolhe uma fala pelo evento (`gatilho`) e pelo canal.
 */
export const CANAIS_DE_RADIO = ['controle', 'sistema', 'piloto', 'intercepto', 'androide', 'ia', 'grito'] as const;
export type CanalDeRadio = (typeof CANAIS_DE_RADIO)[number];

/** Como a fala é dita (a intenção que o Estúdio mostra ao Comandante na hora de gravar). */
export type EstiloDeRadio = 'frio' | 'urgente' | 'confirma' | 'cansado' | 'plano' | 'arrogante' | 'sujo' | 'sussurro' | 'grito';

export interface FalaDeRadio {
  readonly chave: string;
  readonly canal: CanalDeRadio;
  /** O tipo de momento (alvo, posicao, contato, queda...): agrupa as variações da mesma situação. */
  readonly situacao: string;
  readonly estilo: EstiloDeRadio;
  readonly texto: string;
  /** Uma dica de interpretação só desta fala. */
  readonly nota?: string;
  /** O diálogo de comando e resposta de que a fala faz parte, e a ordem dela nele (1 = quem começa). */
  readonly cena?: string;
  readonly turno?: number;
  /** O que a faz tocar: `cerebro:<chamada>` (a chamada do cérebro do time) ou `futuro` (ainda sem gancho no jogo). */
  readonly gatilho: string;
}

export const FALAS_DE_RADIO: readonly FalaDeRadio[] = catalogo.falas as readonly FalaDeRadio[];

const POR_CHAVE: ReadonlyMap<string, FalaDeRadio> = new Map(FALAS_DE_RADIO.map((f) => [f.chave, f]));

export function falaDeRadio(chave: string): FalaDeRadio | undefined {
  return POR_CHAVE.get(chave);
}

/** As falas de um canal que o gatilho dispara (na ordem do catálogo). */
export function falasDoGatilho(canal: CanalDeRadio, gatilho: string): readonly FalaDeRadio[] {
  return FALAS_DE_RADIO.filter((f) => f.canal === canal && f.gatilho === gatilho);
}

/** O manifesto das falas já gravadas (`vozesGeradas.json`): esta fala de rádio tem `.mp3`? (só o sotaque `br`) */
export function radioGravada(chave: string, manifesto: Readonly<Record<string, readonly string[] | string>> = geradas): boolean {
  const lista = manifesto.br;
  return Array.isArray(lista) && lista.includes(chave);
}
