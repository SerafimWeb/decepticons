/**
 * A moldura do cockpit (P317): o visor metálico que cerca a tela na câmera em primeira pessoa, obra do Gemini (CSS puro, sem custo por quadro) concluída aqui. A regra de quando ela
 * aparece é esta função pura, para o teste cobrá-la sem DOM: **só na primeira pessoa e só enquanto a funcionalidade `tela:cockpit` está liberada** (ela nasce restrita, P191: o Comandante
 * julga jogando, com `?comandante=1`, e libera no painel de visibilidade).
 */
export const MODO_DA_MOLDURA = 'fps';

export function moldaDoCockpit(modoDaCamera: string, liberada: boolean): boolean {
  return liberada && modoDaCamera === MODO_DA_MOLDURA;
}
