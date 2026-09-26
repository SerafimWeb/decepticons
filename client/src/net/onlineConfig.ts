/** Porta padrão do servidor de jogo (`npm run server`). */
export const DEFAULT_SERVER_PORT = 2567;
/** Sala de quem clica em "Jogar online" (cheia, o servidor abre ARENA-2, ARENA-3...). */
export const PUBLIC_ROOM = 'ARENA';

/**
 * O servidor que o jogo usa sem `&servidor=` no link: o público do build (`VITE_GAME_SERVER`), ou, com o jogo aberto
 * no próprio PC do servidor, `ws://localhost:2567`. Null = não há servidor (sem botão online).
 */
export function defaultServer(hostname: string, publicServer: string | undefined): string | null {
  if (publicServer?.trim()) return publicServer.trim();
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `ws://${hostname}:${DEFAULT_SERVER_PORT}`;
  return null;
}

export interface OnlineConfig {
  /** Endereço WebSocket do servidor, já com a sala (`ws://…/?sala=ARENA`). */
  url: string;
  room: string;
  name: string;
}

const ROOM_RE = /^[A-Z0-9-]{1,12}$/;

/**
 * Jogar online (M4): `/jogar/?sala=ARENA` entra na sala; `&servidor=wss://…` diz onde está o servidor (sem isso, o
 * servidor público do build ou, no próprio PC do servidor, `ws://localhost:2567`); `&nome=Dan` é o apelido.
 * Sem `sala`, o jogo é o de sempre (offline). Devolve `{ error }` quando pediu online e falta o servidor.
 */
export function onlineConfig(search: string, hostname: string, publicServer?: string): OnlineConfig | { error: string } | null {
  const q = new URLSearchParams(search);
  const rawRoom = q.get('sala');
  if (rawRoom === null) return null;
  const room = rawRoom.trim().toUpperCase() || 'ARENA';
  if (!ROOM_RE.test(room)) return { error: 'código de sala inválido (use letras, números e hífen, até 12)' };
  let server = q.get('servidor')?.trim() || defaultServer(hostname, publicServer) || '';
  if (!server) return { error: 'o servidor online ainda não está no ar' };
  // Endereço de túnel copiado com https:// vira wss:// (e http:// vira ws://).
  server = server.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  if (!/^wss?:\/\/[^\s/?#]+/.test(server)) return { error: 'endereço do servidor inválido (ws:// ou wss://)' };
  const url = new URL(server);
  url.searchParams.set('sala', room);
  return { url: url.toString(), room, name: (q.get('nome') ?? '').trim() || 'PILOTO' };
}
