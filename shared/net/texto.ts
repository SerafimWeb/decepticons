/**
 * O CHAT DE TEXTO entre dois pilotos da sala (P216, `MULTIPLAYER.md`): uma mensagem **direta**, de um piloto a outro (não há canal da sala inteira). Duas mensagens, de tipos acima dos da voz
 * (`VOZ` vai de 30 a 32; o `MSG` do jogo, até 18), sem subir o `PROTOCOL_VERSION`: servidor velho descarta o tipo que não conhece e cliente velho nunca recebe (só o servidor novo manda `RECEBER`).
 *
 * - `ENVIAR` (cliente → servidor): `[tipo][destino][texto em UTF-8]`.
 * - `RECEBER` (servidor → destino): `[tipo][remetente][texto em UTF-8]`. O servidor troca o `destino` pelo **remetente de verdade** (ninguém se passa por outro) e manda **o texto que ele limpou**, não o bruto.
 *
 * O texto é curto (`TEXTO_MAX_CARACTERES`), sem caractere de controle nem de formatação (nada de inverter o sentido da linha) e sem quebra de linha: `limparTexto` é a mesma regra no servidor e no cliente.
 */
export const TEXTO = { ENVIAR: 33, RECEBER: 34 } as const;

/** Quantos caracteres cabem numa mensagem (um chat de jogo, não uma carta). */
export const TEXTO_MAX_CARACTERES = 160;
/** O teto em bytes: 4 por caractere no pior caso (UTF-8), sem passar do teto de uma mensagem de jogo (1 KB). */
export const TEXTO_MAX_BYTES = TEXTO_MAX_CARACTERES * 4;
const CABECALHO = 2;

export interface MensagemDeTexto {
  /** No envio, o destino; no recebimento, quem mandou. */
  id: number;
  texto: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/** Controle (inclui quebra de linha e tab), formatação invisível (inverter a direção, juntar sem largura) e separadores de linha: tudo vira espaço e depois some no recorte. */
const PROIBIDOS = /[\p{Cc}\p{Cf}\u2028\u2029]/gu;

/** O texto como o jogo o aceita: sem proibidos, espaços juntos, sem espaço nas pontas, no máximo `TEXTO_MAX_CARACTERES`. Pode devolver `''` (não há o que mandar). */
export function limparTexto(bruto: string): string {
  const limpo = bruto.replace(PROIBIDOS, ' ').replace(/\s+/gu, ' ').trim();
  return Array.from(limpo).slice(0, TEXTO_MAX_CARACTERES).join('').trim();
}

function codificar(tipo: number, id: number, texto: string): Uint8Array {
  const corpo = encoder.encode(limparTexto(texto));
  const out = new Uint8Array(CABECALHO + corpo.length);
  out[0] = tipo;
  out[1] = id & 0xff;
  out.set(corpo, CABECALHO);
  return out;
}

/** O cliente manda: `destino` é o id da unidade do outro piloto. Devolve `null` se não há o que mandar (texto vazio depois de limpo). */
export function codificarEnviar(destino: number, texto: string): Uint8Array | null {
  const out = codificar(TEXTO.ENVIAR, destino, texto);
  return out.length > CABECALHO ? out : null;
}

/** O servidor repassa: `de` é quem mandou. O texto já foi limpo na leitura; limpa de novo por segurança (é barato). */
export function codificarReceber(de: number, texto: string): Uint8Array {
  return codificar(TEXTO.RECEBER, de, texto);
}

function ler(bytes: Uint8Array, tipo: number): MensagemDeTexto | null {
  if (bytes.length <= CABECALHO || bytes.length > CABECALHO + TEXTO_MAX_BYTES || bytes[0] !== tipo) return null;
  let bruto: string;
  try {
    bruto = decoder.decode(bytes.subarray(CABECALHO));
  } catch {
    return null; // UTF-8 torto
  }
  const texto = limparTexto(bruto);
  return texto ? { id: bytes[1]!, texto } : null;
}

/** O servidor lê o que o cliente mandou: `null` se a mensagem não vale (formato, UTF-8 torto, vazia depois de limpa). O texto sai **limpo**. */
export function lerEnviar(bytes: Uint8Array): MensagemDeTexto | null {
  return ler(bytes, TEXTO.ENVIAR);
}

/** O cliente lê o que o servidor repassou. */
export function lerReceber(bytes: Uint8Array): MensagemDeTexto | null {
  return ler(bytes, TEXTO.RECEBER);
}
