import { MAPA_PADRAO, MODO_PADRAO, modoDaSala, type MapaOnline, type SalaModo } from '../../../shared/net/mapa';
import type { GameMode } from '../sim/gameMode';

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
  explicitName: boolean;
}

const ROOM_RE = /^[A-Z0-9-]{1,12}$/;

/** O endereço da conexão com o mapa da sala (P218): a Cidade Neon é o padrão e não leva `mapa`; os outros pedem a sala própria deles no servidor. */
export function urlComMapa(url: string, mapa: MapaOnline): string {
  const u = new URL(url);
  if (mapa === MAPA_PADRAO) u.searchParams.delete('mapa');
  else u.searchParams.set('mapa', mapa);
  return u.toString();
}

/** O endereço da conexão com o modo da sala (P243): Deathmatch é o padrão e não leva `modo`; a Sobrevivência pede a sala própria dela no servidor. */
export function urlComModo(url: string, modo: SalaModo): string {
  const u = new URL(url);
  if (modo === MODO_PADRAO) u.searchParams.delete('modo');
  else u.searchParams.set('modo', modo);
  return u.toString();
}

/**
 * O modo que a partida roda quando o jogo está numa sala (P276): o que o servidor roda (`modoDaSala`), nunca o que sobrou na URL.
 * Online só existem o Deathmatch e a Sobrevivência do 8 de Janeiro; CTF, Domínio e a Sobrevivência dos outros mapas são Deathmatch na sala.
 */
export function modoEmSala(pedido: GameMode, mapa: MapaOnline): GameMode {
  return modoDaSala(mapa, pedido === 'survival' ? 'survival' : MODO_PADRAO);
}

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
  const rawName = (q.get('nome') ?? '').trim();
  return { url: url.toString(), room, name: rawName || 'PILOTO', explicitName: !!rawName };
}
