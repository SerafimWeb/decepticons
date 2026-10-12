/**
 * A escala tipográfica do console de comando: o CSS dá a `#overlay.console` a variável `--k` (1 no laptop, 1,2 no 1080p, 1,5 no
 * 1440p, 1,15 no celular) e todo texto é "tamanho × --k". Os textos que o mapa e o radar desenham em canvas leem o mesmo valor, para
 * acompanharem o resto. Lê o estilo calculado (uma vez por mudança de tamanho, nunca por quadro).
 */
export function escalaTipografica(el: Element): number {
  const v = parseFloat(getComputedStyle(el).getPropertyValue('--k'));
  return Number.isFinite(v) && v > 0 ? v : 1;
}
