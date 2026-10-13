/**
 * Endereço HTTP de um caminho no servidor de jogo, a partir do endereço WebSocket dele (`VITE_GAME_SERVER`
 * ou `&servidor=`): troca `ws(s)://` por `http(s)://` e troca o caminho. Usado por `status.ts` (`/status`)
 * e `telemetry.ts` (`/evento`) — a mesma regra, um lugar só.
 */
export function serverHttpUrl(gameServer: string | undefined | null, path: string): string | null {
  const raw = gameServer?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const scheme = { 'ws:': 'http:', 'wss:': 'https:', 'http:': 'http:', 'https:': 'https:' }[url.protocol];
  if (!scheme) return null;
  url.protocol = scheme;
  url.pathname = path;
  url.search = '';
  url.hash = '';
  return url.toString();
}

/**
 * Endereço WebSocket do servidor de jogo com um caminho e uma busca (`/?mural=1`), a partir do endereço que o jogo conhece (`ws(s)://` ou
 * `http(s)://`): o contrário do `serverHttpUrl`. Endereço torto ou de outro esquema vira `null`.
 */
export function serverWsUrl(gameServer: string | undefined | null, path: string, search = ''): string | null {
  const raw = gameServer?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const scheme = { 'ws:': 'ws:', 'wss:': 'wss:', 'http:': 'ws:', 'https:': 'wss:' }[url.protocol];
  if (!scheme) return null;
  url.protocol = scheme;
  url.pathname = path;
  url.search = search;
  url.hash = '';
  return url.toString();
}
