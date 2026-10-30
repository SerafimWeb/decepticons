/**
 * A VISÃO NOTURNA (ordem P281/P282, Comandante, 29/10: *"quero jogar na fase escura e ver só os olhos, os fogos, os rastros e explosões… alguns robôs vão ter visão noturna, enquanto
 * outros não têm, e isso será um dos diferenciais de combate e do game… inicialmente só o ARARA, o Lancer e os andróides têm visão noturna nativa; os outros vão ter que usar como módulo extra"*).
 *
 * **A regra, em duas frases.** A **escuridão** da cena (0 = dia, 1 = apagão total) é a vida que falta ao quadro de luz (`Match.escuridao`). Quem **não** tem visão noturna enxerga cada vez menos
 * longe no escuro, a não ser quem **acabou de atirar** (o clarão do tiro o denuncia); quem tem (o chassi nativo ou o módulo) enxerga como de dia.
 *
 * Dado puro e conta pura, sem Three nem DOM (G1/G2/G14): o cliente, o servidor e os testes leem o mesmo arquivo. A **aparência** (a cena escura, o verde dos óculos, as luzes dos tiros) é de
 * `fx/FaseEscura.ts`: aqui mora só o que muda o jogo.
 */

/** Quanto do alcance de visão sobra a quem não tem visão noturna na escuridão total (30%: de 90 m para 27 m). */
export const ALCANCE_NO_ESCURO = 0.3;
/** Por quantos segundos o clarão de um tiro denuncia o atirador, no escuro, a quem não tem visão noturna (o rastro e a boca acesa). */
export const DENUNCIA_DO_TIRO_S = 2.5;
/** A partir de que escuridão a tela e o HUD tratam a fase como escura (o aviso, o verde dos óculos): abaixo disto é só o entardecer das luzes. */
export const ESCURO_PARA_O_HUD = 0.5;
/** O peso do módulo de visão noturna no Hangar (t): paga carga, como todo módulo. */
export const MASSA_DO_MODULO_VISAO = 0.5;

const limitar = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** A escuridão (0 a 1) que a energia da cidade (a vida do quadro, 0 a 1) deixa na cena: dia cheio com o quadro inteiro, escuro total com ele apagado. Valor torto cai no dia. */
export function escuridaoDaEnergia(energia: number): number {
  if (!Number.isFinite(energia)) return 0;
  return 1 - limitar(energia, 0, 1);
}

/**
 * O alcance de visão (m) de um robô na escuridão: o `base` de sempre, **menos** o que a escuridão tira de quem não enxerga no escuro. Contínuo (as luzes se apagam aos poucos e o alcance cai
 * junto): `base × (1 − escuridão × (1 − ALCANCE_NO_ESCURO))`. Quem tem visão noturna, ou está denunciado pelo clarão do tiro, mantém o `base`.
 */
export function alcanceDeVisao(base: number, escuridao: number, visaoNoturna: boolean, denunciado: boolean): number {
  if (visaoNoturna || denunciado) return base;
  return base * (1 - limitar(escuridao, 0, 1) * (1 - ALCANCE_NO_ESCURO));
}

/** A fase é escura para a tela (o HUD e os óculos)? */
export const faseEscura = (escuridao: number): boolean => escuridao >= ESCURO_PARA_O_HUD;
