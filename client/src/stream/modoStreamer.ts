/**
 * O MODO STREAMER (P310, a ordem "modo streamer"): `?stream=1` leva o jogo à sala de código fixo `AO-VIVO` (o mesmo link para quem joga e
 * para quem assiste), liga o clipe quando a partida começa e mostra a faixa AO VIVO com o COPIAR LINK (`faixaAoVivo.ts`).
 *
 * Só o endereço e o link são daqui: puros, sem DOM, testados em `modoStreamer.test.ts`. Quem escolhe a sala é `onlineConfig`
 * (`net/onlineConfig.ts`); a faixa e o clipe entram no `Game.ts` por chamadas, como os outros módulos (G3). Sem servidor, o link cai
 * no jogo de sempre, sem faixa e sem clipe.
 */

/** A sala de código fixo do streamer: o mesmo código para quem abre o link (cabe no padrão de sala: letras, números e hífen, até 12). */
export const SALA_DO_STREAMER = 'AO-VIVO';

/** `?stream=1` pede o modo streamer. Qualquer outro valor (ou nenhum) é o jogo de sempre. */
export function pedeModoStreamer(busca: string): boolean {
  return new URLSearchParams(busca).get('stream') === '1';
}

/**
 * O link que o streamer copia: a página do jogo com `?stream=1`, mantendo a sala (se o link trouxe uma) e o servidor. Sem `sala`, quem
 * abre cai na sala fixa; com `sala`, cai na que o streamer escolheu (a faixa mostra essa mesma sala). O `nome` e o resto ficam de fora.
 */
export function linkDoStreamer(endereco: string): string {
  const atual = new URL(endereco);
  const u = new URL(atual.origin + atual.pathname);
  u.searchParams.set('stream', '1');
  for (const chave of ['sala', 'servidor']) {
    const valor = atual.searchParams.get(chave);
    if (valor) u.searchParams.set(chave, valor);
  }
  return u.toString();
}
