import type { DesfechoDaMissao, TipoDeMissao } from '../sim/MissaoDeCombate';

/**
 * Os textos da missão de combate na tela (P314, corte 2). Cada função devolve o texto em português, já com os números no lugar; o idioma
 * o traduz pelas chaves de `public/locales` (a chave tem as lacunas `{0}`, `{1}`…, e a tradução repete as mesmas). Puro: testado em
 * `textosDaMissao.test.ts`, que confere que cada chave tem tradução nos seis idiomas.
 */

/** A linha de cima da partida na caça, na destruição e na aniquilação: o tipo, os alvos caídos e o prazo que resta. */
const LINHA_DE_STATUS: Readonly<Record<TipoDeMissao, string>> = {
  caca: 'CAÇA · ALVOS {0}/{1} · {2} s',
  destruicao: 'DESTRUIÇÃO · ALVOS {0}/{1} · {2} s',
  aniquilacao: 'ANIQUILAÇÃO · ALVOS {0}/{1} · {2} s',
};

/** O objetivo, em uma linha, mostrado na largada e nos primeiros segundos. */
const OBJETIVO: Readonly<Record<TipoDeMissao, string>> = {
  caca: 'DERRUBE O ALVO MARCADO ANTES DO PRAZO',
  destruicao: 'DERRUBE OS TRÊS MECHS MARCADOS',
  aniquilacao: 'NENHUM INIMIGO DE PÉ',
};

const TITULO_DO_FIM: Readonly<Record<TipoDeMissao, string>> = {
  caca: 'CAÇA CUMPRIDA',
  destruicao: 'DESTRUIÇÃO CUMPRIDA',
  aniquilacao: 'ANIQUILAÇÃO CUMPRIDA',
};

const MOTIVO_DO_FIM: Readonly<Record<TipoDeMissao, string>> = {
  caca: 'O ALVO CAIU DENTRO DO PRAZO',
  destruicao: 'OS TRÊS ALVOS CAÍRAM DENTRO DO PRAZO',
  aniquilacao: 'NENHUM INIMIGO SOBROU',
};

/** O texto da linha de cima com os números de hoje. Em `caca`, `destruicao` e `aniquilacao`, o `alvos` é o que precisa cair. */
export function linhaDeStatus(tipo: TipoDeMissao, alvosCaidos: number, alvos: number, restanteS: number): string {
  return LINHA_DE_STATUS[tipo].replace('{0}', String(alvosCaidos)).replace('{1}', String(alvos)).replace('{2}', String(Math.max(0, Math.ceil(restanteS))));
}

export function objetivoDoBriefing(tipo: TipoDeMissao): string {
  return OBJETIVO[tipo];
}

/** O título do fim: a missão cumprida, o prazo que acabou ou o piloto que caiu. */
export function tituloDoFim(desfecho: DesfechoDaMissao, tipo: TipoDeMissao): string {
  if (desfecho === 'cumprida') return TITULO_DO_FIM[tipo];
  return desfecho === 'tempo' ? 'PRAZO ESGOTADO' : 'VOCÊ CAIU';
}

/** O motivo, uma linha abaixo do título. */
export function motivoDoFim(desfecho: DesfechoDaMissao, tipo: TipoDeMissao): string {
  if (desfecho === 'cumprida') return MOTIVO_DO_FIM[tipo];
  return desfecho === 'tempo' ? 'O PRAZO ACABOU ANTES DO OBJETIVO' : 'O PILOTO CAIU ANTES DO FIM';
}

/** Todas as chaves que este módulo pode devolver (as formas com lacunas, como estão no locale): o teste confere cada uma nos seis idiomas. */
export const CHAVES_DA_MISSAO: readonly string[] = [
  ...Object.values(LINHA_DE_STATUS),
  ...Object.values(OBJETIVO),
  ...Object.values(TITULO_DO_FIM),
  ...Object.values(MOTIVO_DO_FIM),
  'PRAZO ESGOTADO',
  'VOCÊ CAIU',
  'O PRAZO ACABOU ANTES DO OBJETIVO',
  'O PILOTO CAIU ANTES DO FIM',
];
