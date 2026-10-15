/**
 * Tática de esquadrão (ordem P119, 14/10/2026): o Comandante achou os bots "meio burros, bagunçados, que só correm e
 * rusham" e pediu **critério e técnica** — que usem cada arma da melhor forma e joguem conforme a configuração do
 * esquadrão. Este arquivo é a **classificação** (dado puro, sem estado, sem alocação), e quem age é o `BotController`
 * e o diretor do `BotSystem`.
 *
 * A ideia, em uma linha: **quem carrega arma de longo alcance não entra no bolo** — segura a linha de tiro (e, no
 * esquadrão grande, um deles fica de **retaguarda** no seu setor, em vez de todo mundo perseguir o alvo).
 *
 * Cuidado que veio da ordem P120 e do próprio Comandante: **não inventar regra que estrague o que já está certo**. Por
 * isso a arma **média** (o plasma, que é o jogo de sempre) luta como sempre lutou (`assalto`), e só a **longa** vira
 * `apoio`: no esquadrão padrão (plasma) nada muda.
 */

/** Onde a arma rende, em três faixas de alcance ótimo (m). Os cortes são proposta minha, ajustáveis numa linha. */
export type FaixaDeArma = 'curta' | 'media' | 'longa';

/** Até aqui é arma de perto (escopeta 8, motosserra 1,2, sônico 10, lança-chamas 17, gelo 20). */
export const FAIXA_CURTA_ATE = 20;
/**
 * Daqui para cima é arma de **linha** (canhão pesado 90, trilho e cerco 140). O corte é **acima do plasma (60)**, que é o
 * padrão do jogo: assim o esquadrão de fábrica (plasma) luta como sempre lutou, e só as armas de longa viram apoio.
 */
export const FAIXA_LONGA_A_PARTIR = 90;

/** A faixa de uma arma pelo alcance ótimo dela. Número inválido conta como de perto (o mais conservador). */
export function faixaDaArma(optimalRange: number): FaixaDeArma {
  const r = Number.isFinite(optimalRange) ? optimalRange : 0;
  if (r <= FAIXA_CURTA_ATE) return 'curta';
  if (r >= FAIXA_LONGA_A_PARTIR) return 'longa';
  return 'media';
}

/**
 * O papel de quem carrega a arma, na organização do esquadrão:
 * - **`assalto`**: arma de perto, média ou corpo a corpo — é quem entra e fecha (o jogo de sempre);
 * - **`apoio`**: arma de longo alcance — segura a linha de tiro, de longe, sem se meter no bolo.
 */
export type PapelTatico = 'assalto' | 'apoio';

export function papelTatico(optimalRange: number, melee: boolean): PapelTatico {
  if (melee) return 'assalto';
  return faixaDaArma(optimalRange) === 'longa' ? 'apoio' : 'assalto';
}

/** A partir de quantos soldados o esquadrão ganha uma retaguarda (com menos que isto, todos têm de atacar). */
export const REARGUARD_MIN_SQUAD = 3;

/**
 * Quem fica de **retaguarda**: o primeiro `apoio` do esquadrão, e só quando há pelo menos `REARGUARD_MIN_SQUAD`
 * soldados **e** algum `assalto` para fazer o assalto (senão o esquadrão inteiro de arma longa ficaria parado).
 * Devolve o índice no array, ou `-1` se ninguém fica de guarda. Determinístico: o primeiro, sempre.
 */
export function escolherRearguarda(papeis: readonly PapelTatico[]): number {
  if (papeis.length < REARGUARD_MIN_SQUAD) return -1;
  if (!papeis.some((p) => p === 'assalto')) return -1;
  return papeis.indexOf('apoio');
}
