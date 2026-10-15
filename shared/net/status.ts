/**
 * Status público do servidor de jogo (`GET /status`): o que a landing e a pausa do jogo mostram **sem abrir
 * conexão de jogo** — se o servidor está de pé e quantos pilotos estão nele agora.
 *
 * Contrato único do servidor, do cliente e dos testes (G14). Sem nenhuma dependência do cliente: o servidor
 * importa direto, como faz com `constants.ts`.
 *
 * **Só números agregados.** Nenhum apelido, nenhum IP, nenhum código de sala: a resposta é pública
 * (`access-control-allow-origin: *`, porque o site e o servidor moram em endereços diferentes) e não conta
 * nada sobre quem está jogando.
 *
 * **Custo:** a resposta é montada uma vez por segundo no servidor (uma soma sobre as salas abertas) e tem
 * ~70 bytes; com os cabeçalhos, uma pergunta custa ~350 bytes. A cada 20 s dá ~18 B/s por aba aberta —
 * 0,2% do orçamento de download de um jogador (G11), e nenhuma delas entra no laço de 60 Hz.
 */
import { PROTOCOL_VERSION, ROOM_SIZE } from './constants';
import { serverHttpUrl } from './serverUrl';

/** Caminho do status no servidor de jogo (o mesmo processo do WebSocket, outra porta não existe). */
export const STATUS_PATH = '/status';
/** De quanto em quanto tempo a página pergunta de novo (s). Aba escondida não pergunta. */
export const STATUS_POLL_S = 20;
/** Sem resposta neste prazo (ms), o servidor conta como fora do ar. */
export const STATUS_TIMEOUT_MS = 4000;

export interface ServerStatus {
  /** Versão do protocolo do servidor: diferente da do jogo aberto = não dá para entrar. */
  protocol: number;
  /** Pilotos humanos conectados agora, somando as salas (bots não contam: a pergunta é se tem gente). */
  players: number;
  /** Salas abertas agora. */
  rooms: number;
  /** Mechs por sala (humanos + bots completando): quantos cabem. */
  roomSize: number;
  /** Segundos desde que o servidor subiu. */
  uptimeS: number;
}

/** O status deste servidor, para o `GET /status` responder. */
export function serverStatus(players: number, rooms: number, uptimeS: number): ServerStatus {
  return {
    protocol: PROTOCOL_VERSION,
    players: Math.max(0, Math.trunc(players)),
    rooms: Math.max(0, Math.trunc(rooms)),
    roomSize: ROOM_SIZE,
    uptimeS: Math.max(0, Math.trunc(uptimeS)),
  };
}

/**
 * Lê o que veio do servidor. Qualquer coisa fora do contrato (campo faltando, número negativo, texto no
 * lugar de número, HTML de página de erro) devolve `null`: para a página, isso é "fora do ar" — nunca um
 * número inventado na tela do dono.
 */
export function parseStatus(raw: unknown): ServerStatus | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : null);
  const protocol = n(r.protocol);
  const players = n(r.players);
  const rooms = n(r.rooms);
  const roomSize = n(r.roomSize);
  const uptimeS = n(r.uptimeS);
  if (protocol === null || players === null || rooms === null || roomSize === null || uptimeS === null) return null;
  return { protocol, players, rooms, roomSize, uptimeS };
}

/**
 * Endereço do status a partir do endereço do servidor de jogo (`VITE_GAME_SERVER` ou `&servidor=`):
 * `wss://jogo.cybermech.online` → `https://jogo.cybermech.online/status`. Aceita `ws`, `wss`, `http` e
 * `https` (o dono cola o endereço do túnel dos dois jeitos); qualquer outra coisa devolve `null`.
 */
export function statusUrl(gameServer: string | undefined | null): string | null {
  return serverHttpUrl(gameServer, STATUS_PATH);
}
