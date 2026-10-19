import { ROOM_SIZE } from './constants';

/**
 * O chat de voz (P205, `VOICE_CHAT.md`): só a **sinalização** passa pelo servidor do jogo; o áudio vai direto de um navegador ao outro (WebRTC), então o servidor não gasta
 * banda nem CPU com voz. Três mensagens, de tipos acima dos do jogo (`MSG` vai até 17), sem subir o `PROTOCOL_VERSION`: servidor velho ignora (a sala descarta o que não conhece) e
 * cliente velho nunca recebe (só quem mandou `PRONTO` ganha `LISTA` e `SINAL`).
 *
 * - `PRONTO` (cliente → servidor): `[tipo][ligado 0|1][token da sessão, UTF-8]` — entrei na voz, ou saí. **O token da sessão da conta vai junto ao entrar (P211): o servidor só admite quem tem conta de maior de idade** (`server/voz.ts`); sem token, ou de menor, ou de conta sem idade, ou vencido, o `PRONTO` é ignorado (o jogador não recebe `LISTA` nem `SINAL`: nem ouve nem é ouvido).
 * - `LISTA` (servidor → quem está na voz): `[tipo][n][id × n]` — quem está na voz agora; é a lista, não o evento: quem chega depois recebe o mesmo.
 * - `SINAL` (os dois sentidos): `[tipo][id][oferta 0|resposta 1][SDP em UTF-8]` — a oferta ou a resposta da conexão. No envio, `id` é o **destino**; o servidor troca por
 *   **quem mandou** antes de repassar (ninguém se passa por outro: o remetente nunca é o que o cliente diz). O SDP já leva os endereços (sem "trickle"): uma oferta e uma resposta por par.
 */
export const VOZ = { PRONTO: 30, LISTA: 31, SINAL: 32 } as const;

/** Bytes de SDP que o servidor repassa (um SDP só de áudio tem de 0,6 a 2 KB). */
export const VOZ_SDP_MAX = 3072;
/** Cabeçalho do `SINAL`: tipo, id e oferta/resposta. */
const SINAL_CABECALHO = 3;

export type SinalTipo = 'oferta' | 'resposta';

export interface Sinal {
  /** No envio, o destino; no recebimento, quem mandou. */
  id: number;
  tipo: SinalTipo;
  sdp: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/** O teto do token na mensagem (o servidor aceita sessão de 8 a 200 caracteres). */
export const VOZ_TOKEN_MAX = 200;

export function codificarPronto(ligado: boolean, token = ''): Uint8Array {
  const t = ligado ? encoder.encode(token).subarray(0, VOZ_TOKEN_MAX) : new Uint8Array(0);
  const out = new Uint8Array(2 + t.length);
  out[0] = VOZ.PRONTO;
  out[1] = ligado ? 1 : 0;
  out.set(t, 2);
  return out;
}

/** `ligado`: entrou (`true`) ou saiu (`false`); `token`: a sessão da conta (vazio ao sair, ou de um cliente velho). `null` se a mensagem não vale. */
export function lerPronto(bytes: Uint8Array): { ligado: boolean; token: string } | null {
  if (bytes.length < 2 || bytes.length > 2 + VOZ_TOKEN_MAX || bytes[0] !== VOZ.PRONTO || bytes[1]! > 1) return null;
  try {
    return { ligado: bytes[1] === 1, token: decoder.decode(bytes.subarray(2)) };
  } catch {
    return null;
  }
}

export function codificarLista(ids: readonly number[]): Uint8Array {
  const n = Math.min(ids.length, ROOM_SIZE);
  const out = new Uint8Array(2 + n);
  out[0] = VOZ.LISTA;
  out[1] = n;
  for (let i = 0; i < n; i++) out[2 + i] = ids[i]! & 0xff;
  return out;
}

export function lerLista(bytes: Uint8Array): number[] | null {
  if (bytes.length < 2 || bytes[0] !== VOZ.LISTA) return null;
  const n = bytes[1]!;
  if (n > ROOM_SIZE || bytes.length !== 2 + n) return null;
  return Array.from(bytes.subarray(2));
}

export function codificarSinal(s: Sinal): Uint8Array {
  const sdp = encoder.encode(s.sdp);
  const out = new Uint8Array(SINAL_CABECALHO + sdp.length);
  out[0] = VOZ.SINAL;
  out[1] = s.id & 0xff;
  out[2] = s.tipo === 'oferta' ? 0 : 1;
  out.set(sdp, SINAL_CABECALHO);
  return out;
}

/**
 * O `SINAL` tem forma de sinal? (o tipo, o tamanho e o começo de um SDP: `v=0`). O servidor só confere isto e repassa os bytes, sem ler o SDP: o relé não vira
 * caminho para mandar outra coisa a outro jogador.
 */
export function sinalValido(bytes: Uint8Array): boolean {
  return (
    bytes.length > SINAL_CABECALHO + 3 &&
    bytes.length <= SINAL_CABECALHO + VOZ_SDP_MAX &&
    bytes[0] === VOZ.SINAL &&
    bytes[2]! <= 1 &&
    bytes[3] === 0x76 && // v
    bytes[4] === 0x3d && // =
    bytes[5] === 0x30 // 0
  );
}

export function lerSinal(bytes: Uint8Array): Sinal | null {
  if (!sinalValido(bytes)) return null;
  try {
    return { id: bytes[1]!, tipo: bytes[2] === 0 ? 'oferta' : 'resposta', sdp: decoder.decode(bytes.subarray(SINAL_CABECALHO)) };
  } catch {
    return null;
  }
}

/** Esta mensagem é de voz? (a sala manda para o relé; o resto segue o caminho do jogo). */
export function ehMensagemDeVoz(tipo: number): boolean {
  return tipo >= VOZ.PRONTO && tipo <= VOZ.SINAL;
}
