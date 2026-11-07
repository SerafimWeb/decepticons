/**
 * O interruptor da geração 3 do movimento (P319, catálogo `mech:gen3`, nasce restrito). O `Game` o liga e desliga pelo
 * painel de visibilidade; o `MechBase` lê o valor a cada quadro. Desligado, cada Mech anda como antes, byte a byte.
 */
let ligado = false;

export const movimentoGen3Ligado = (): boolean => ligado;

export function setMovimentoGen3(valor: boolean): void {
  ligado = valor;
}
