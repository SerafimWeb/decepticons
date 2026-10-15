import catalogo from './falas.json';
import geradas from './vozesGeradas.json';

/**
 * As falas do narrador (P146): o catálogo de `falas.json` com tipos. Só da tela (G1/G2): nada aqui entra na simulação.
 *
 * **Sotaque é a voz**, não o texto: `br` fala português, `en` inglês, e `ru` e `cn` falam o mesmo inglês com uma voz de sotaque russo ou chinês
 * (as vozes ficam em `scripts/vozes.config.json`; o `npm run vozes` gera um `.mp3` por fala e por sotaque).
 */
export type Sotaque = 'br' | 'en' | 'ru' | 'cn';
export const SOTAQUES: readonly Sotaque[] = ['br', 'en', 'ru', 'cn'];

/** O que o jogador escolhe em Configurações > Áudio: um sotaque, `mix` (cada fala sorteia o sotaque) ou `off` (sem narrador). */
export type Narracao = Sotaque | 'mix' | 'off';
export const NARRACOES: readonly Narracao[] = ['br', 'en', 'ru', 'cn', 'mix', 'off'];

export const ROTULO_DA_NARRACAO: Readonly<Record<Narracao, string>> = {
  br: 'Brasileiro',
  en: 'Inglês',
  ru: 'Sotaque russo',
  cn: 'Sotaque chinês',
  mix: 'Mistura (um sotaque por fala)',
  off: 'Sem narrador',
};

export type EstiloDeFala = 'grave' | 'grito' | 'seco';

export interface Fala {
  readonly chave: string;
  readonly estilo: EstiloDeFala;
  readonly texto: Readonly<Record<Sotaque, string>>;
}

export const FALAS: readonly Fala[] = catalogo.falas as readonly Fala[];

const POR_CHAVE: ReadonlyMap<string, Fala> = new Map(FALAS.map((f) => [f.chave, f]));

export function falaDe(chave: string): Fala | undefined {
  return POR_CHAVE.get(chave);
}

/** A chave da fala de "Rodada N" (1 a 9; depois disso não há fala e a tela segue só com o número). */
export function chaveDaRodada(n: number): string | null {
  return Number.isInteger(n) && n >= 1 && n <= 9 ? `rodada_${n}` : null;
}

/** A chave da fala de uma sequência de abates (2 em diante; 6 ou mais usa a última). Sequência de 1 não fala (é o abate normal). */
export function chaveDaSequencia(abates: number): string | null {
  if (!Number.isInteger(abates) || abates < 2) return null;
  return `abate_${Math.min(abates, 6)}`;
}

/** O manifesto das falas já geradas (`vozesGeradas.json`, reescrito pelo `npm run vozes`): esta fala tem `.mp3` neste sotaque? */
export function falaGerada(sotaque: Sotaque, chave: string, manifesto: Readonly<Record<string, readonly string[] | string>> = geradas): boolean {
  const lista = manifesto[sotaque];
  return Array.isArray(lista) && lista.includes(chave);
}

/** `?narrador=ru` na URL força a voz (teste e vídeo), por cima da configuração do jogador. Valor inválido ou ausente: `null`. */
export function narracaoDaUrl(busca: string = typeof location !== 'undefined' ? location.search : ''): Narracao | null {
  const v = new URLSearchParams(busca).get('narrador');
  return v !== null && (NARRACOES as readonly string[]).includes(v) ? (v as Narracao) : null;
}

/** Onde mora o `.mp3` de uma fala (relativo à raiz do jogo): `audio/vozes/<sotaque>/<chave>.mp3`. */
export function caminhoDaFala(sotaque: Sotaque, chave: string): string {
  return `audio/vozes/${sotaque}/${chave}.mp3`;
}
