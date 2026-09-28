import { PROTOCOL_VERSION } from '../../../shared/net/constants';
import { parseStatus, type ServerStatus, STATUS_TIMEOUT_MS } from '../../../shared/net/status';

/**
 * O que a página descobriu sobre o servidor. Três estados, não dois: **um servidor de pé que ainda não sabe
 * responder `/status`** (versão anterior a 28/09, como o que ficou 24 h no ar) é online sem contagem, não
 * "fora do ar" — dizer ao jogador que o servidor caiu quando ele está jogável seria mentira na tela.
 */
export type ServerProbe = { up: false } | { up: true; status: ServerStatus | null };

/**
 * Pergunta ao servidor de jogo se ele está de pé e quantos pilotos tem, pelo `GET /status` (contrato em
 * `shared/net/status.ts`). Nunca lança e nunca deixa a página pendurada: sem resposta no prazo, devolve
 * `{ up: false }`.
 *
 * `fetchImpl` e `timeoutMs` existem para o teste: em produção é o `fetch` do navegador.
 */
export async function probeStatus(url: string, fetchImpl: typeof fetch = fetch, timeoutMs = STATUS_TIMEOUT_MS): Promise<ServerProbe> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => ctrl.abort(), timeoutMs);
  const done = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, cache: 'no-store', mode: 'cors', credentials: 'omit' });
    // O prazo era para o servidor responder, não para ler ~70 bytes: desarmado aqui, senão um engasgo da
    // thread principal (o boot do jogo compila o Wasm e monta a arena) aborta o corpo de uma resposta que
    // já chegou — foi o que aconteceu na primeira captura, e a tela disse "sem contagem" sem motivo.
    done();
    if (!res.ok) return { up: false };
    try {
      return { up: true, status: parseStatus(await res.json()) };
    } catch {
      // Respondeu, mas não com o contrato (servidor antigo devolve texto): de pé, sem contagem.
      return { up: true, status: null };
    }
  } catch {
    // Servidor desligado, túnel fora do ar, CSP, DNS, tempo esgotado: para o jogador é tudo a mesma coisa.
    return { up: false };
  } finally {
    done();
  }
}

/** Como a linha do status aparece na tela, em uma função pura (é o que o teste trava). */
export function statusLine(probe: ServerProbe, protocol = PROTOCOL_VERSION): string {
  if (!probe.up) return 'SERVIDOR FORA DO AR · MODO OFFLINE CONTRA BOTS';
  const s = probe.status;
  if (!s) return 'SERVIDOR ONLINE · SEM CONTAGEM DE PILOTOS';
  if (s.protocol !== protocol) return 'SERVIDOR EM ATUALIZAÇÃO · RECARREGUE A PÁGINA';
  if (s.players === 0) return 'SERVIDOR ONLINE · ARENA VAZIA · SEJA O PRIMEIRO';
  const pilots = s.players === 1 ? '1 PILOTO EM COMBATE' : `${s.players} PILOTOS EM COMBATE`;
  // A contagem de salas só entra quando há mais de uma: numa sala só ela não diz nada ao jogador.
  return s.rooms > 1 ? `SERVIDOR ONLINE · ${pilots} · ${s.rooms} SALAS` : `SERVIDOR ONLINE · ${pilots}`;
}

/** Classe da linha, para a tela pintar sem repetir a regra. */
export function statusClass(probe: ServerProbe, protocol = PROTOCOL_VERSION): 'online' | 'vazio' | 'offline' | 'versao' {
  if (!probe.up) return 'offline';
  const s = probe.status;
  if (!s) return 'vazio';
  if (s.protocol !== protocol) return 'versao';
  return s.players > 0 ? 'online' : 'vazio';
}
