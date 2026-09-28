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
