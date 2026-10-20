/**
 * A CREDENCIAL DA CONEXÃO (P226, pacote A0 de `CAMINHO_DO_LANCAMENTO.md`): **quem entra num mapa restrito prova no servidor que é administrador.** Antes, o mapa restrito (`mapa:janeiro`, `mapa:bunker`,
 * `mapa:amazonia`...) só sumia da vitrine do jogo: `?sala=X&mapa=janeiro` abria para qualquer um que digitasse o link. Agora o **servidor** confere.
 *
 * Uma mensagem, de tipo acima dos do chat de texto (`MSG` vai até 18, `VOZ` de 30 a 32, `TEXTO` de 33 a 34), sem subir o `PROTOCOL_VERSION` (como a voz e o texto): servidor velho descarta o tipo que não conhece.
 * - `CREDENCIAL` (cliente → servidor): `[tipo][token da sessão da conta, UTF-8]`, **a primeira mensagem da conexão, antes do `JOIN`**. O servidor a lê e **nunca a repassa à sala**.
 *
 * O token só vale se a conta é administradora (`/conta/eu` devolve `is_admin`); mapa público não pede nada (a mensagem, se vier, é descartada). Uma conexão num mapa restrito que não manda uma credencial
 * válida em 5 s é recusada com `REJECT` (`restrito`) e cortada: **a sala nem é criada**.
 */
export const CREDENCIAL = 35;

/** O token da sessão tem de 8 a 200 caracteres (o mesmo teto da voz e do mural). */
export const CREDENCIAL_TOKEN_MAX = 200;
/** Quanto o servidor espera a credencial de quem pediu um mapa restrito (ms). */
export const CREDENCIAL_ESPERA_MS = 5000;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/** A mensagem do cliente. `null` se o token não serve (vazio ou grande demais): nem vale mandar. */
export function codificarCredencial(token: string): Uint8Array | null {
  const corpo = encoder.encode(token);
  if (corpo.length < 8 || corpo.length > CREDENCIAL_TOKEN_MAX) return null;
  const out = new Uint8Array(1 + corpo.length);
  out[0] = CREDENCIAL;
  out.set(corpo, 1);
  return out;
}

/** É uma credencial (pelo tipo)? O servidor a trata antes de a sala ver qualquer byte. */
export function ehCredencial(bytes: Uint8Array): boolean {
  return bytes.length > 0 && bytes[0] === CREDENCIAL;
}

/** O token que a mensagem leva, ou `null` se está malformada (curta, grande ou UTF-8 inválido). */
export function lerCredencial(bytes: Uint8Array): string | null {
  if (bytes.length < 1 + 8 || bytes.length > 1 + CREDENCIAL_TOKEN_MAX || bytes[0] !== CREDENCIAL) return null;
  try {
    return decoder.decode(bytes.subarray(1));
  } catch {
    return null;
  }
}
