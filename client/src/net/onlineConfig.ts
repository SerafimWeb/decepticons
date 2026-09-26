/** Porta padrão do servidor de jogo (`npm run server`). */
export const DEFAULT_SERVER_PORT = 2567;

export interface OnlineConfig {
  /** Endereço WebSocket do servidor, já com a sala (`ws://…/?sala=ARENA`). */
  url: string;
  room: string;
  name: string;
}

const ROOM_RE = /^[A-Z0-9-]{1,12}$/;

/**
 * Jogar online (M4): `/jogar/?sala=ARENA` entra na sala; `&servidor=wss://…` diz onde está o servidor (sem isso,
 * só funciona com o jogo aberto no próprio PC do servidor: `ws://localhost:2567`); `&nome=Dan` é o apelido.
 * Sem `sala`, o jogo é o de sempre (offline). Devolve `{ error }` quando pediu online e falta o servidor.
 */
export function onlineConfig(search: string, hostname: string): OnlineConfig | { error: string } | null {
  const q = new URLSearchParams(search);
  const rawRoom = q.get('sala');
  if (rawRoom === null) return null;
  const room = rawRoom.trim().toUpperCase() || 'ARENA';
  if (!ROOM_RE.test(room)) return { error: 'código de sala inválido (use letras, números e hífen, até 12)' };
  let server = q.get('servidor')?.trim() ?? '';
  if (!server) {
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return { error: 'falta o endereço do servidor (&servidor=wss://…)' };
    server = `ws://${hostname}:${DEFAULT_SERVER_PORT}`;
  }
  // Endereço de túnel copiado com https:// vira wss:// (e http:// vira ws://).
  server = server.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  if (!/^wss?:\/\/[^\s/?#]+/.test(server)) return { error: 'endereço do servidor inválido (ws:// ou wss://)' };
  const url = new URL(server);
  url.searchParams.set('sala', room);
  return { url: url.toString(), room, name: (q.get('nome') ?? '').trim() || 'PILOTO' };
}
