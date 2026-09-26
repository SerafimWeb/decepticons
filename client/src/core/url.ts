/** O endereço sem um parâmetro (ex.: o link de build ou de potências, depois que o jogador trocou). */
export function withoutParam(href: string, param: string): string {
  const url = new URL(href);
  url.searchParams.delete(param);
  return url.toString();
}

/**
 * Recarrega a partida sem um parâmetro do endereço: sem isso, um link (`?build=`, `?potencias=`) reaplicaria
 * o que o jogador acabou de trocar.
 */
export function reloadWithout(param: string): void {
  const next = withoutParam(location.href, param);
  if (next === location.href) location.reload();
  else location.replace(next);
}
