/**
 * Os trechos do buffer do clipe (P309). Pura (sem DOM e sem relógio próprio: quem chama passa o tempo), testada em `segmentos.test.ts`.
 *
 * **Por que trechos sobrepostos:** um arquivo de vídeo gravado pelo `MediaRecorder` só começa a tocar num quadro-chave, e cortar o começo de um
 * arquivo já gravado não é possível sem recodificar. Então o buffer é uma sequência de gravações completas, cada uma de até `DURACAO_SEGMENTO_S`,
 * abertas a cada `INICIO_DE_CADA_SEGMENTO_S`. Há sempre pelo menos uma gravação que começou entre 5 e 10 s atrás: é ela que vira o clipe. Cada
 * arquivo começa no seu próprio quadro-chave, e o clipe sai inteiro, sem remuxar.
 */
export const DURACAO_SEGMENTO_S = 10;
export const INICIO_DE_CADA_SEGMENTO_S = 5;

/**
 * O trecho a salvar agora: a gravação mais antiga que começou entre `INICIO` e `DURACAO` segundos atrás (ou seja, o clipe tem de 5 a 10 s). Sem nenhuma
 * nessa faixa, a mais antiga ainda gravando (um clipe mais curto, logo depois de ligar). `-1` quando não há nenhuma.
 *
 * @param inicios quando cada gravação começou, em segundos (qualquer relógio que só cresce)
 * @param agora o instante do pedido, no mesmo relógio
 */
export function escolherSegmento(inicios: readonly number[], agora: number): number {
  let melhor = -1;
  let melhorInicio = Infinity;
  for (let i = 0; i < inicios.length; i++) {
    const idade = agora - inicios[i]!;
    if (idade >= INICIO_DE_CADA_SEGMENTO_S && idade <= DURACAO_SEGMENTO_S && inicios[i]! < melhorInicio) {
      melhor = i;
      melhorInicio = inicios[i]!;
    }
  }
  if (melhor >= 0) return melhor;
  for (let i = 0; i < inicios.length; i++) {
    const idade = agora - inicios[i]!;
    if (idade >= 0 && idade < DURACAO_SEGMENTO_S && inicios[i]! < melhorInicio) {
      melhor = i;
      melhorInicio = inicios[i]!;
    }
  }
  return melhor;
}

/** Se é hora de abrir uma gravação nova: a primeira vez, ou quando passou `INICIO_DE_CADA_SEGMENTO_S` desde a última abertura. */
export function ehHoraDeNovoSegmento(ultimoInicio: number, agora: number): boolean {
  return !Number.isFinite(ultimoInicio) || agora - ultimoInicio >= INICIO_DE_CADA_SEGMENTO_S;
}
