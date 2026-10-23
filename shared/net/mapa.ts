/**
 * O MAPA DA SALA ONLINE (P218, `MULTIPLAYER.md` § 12, etapa O1): a sala deixou de ser só a Cidade Neon. A conexão leva o mapa (`/?sala=ARENA&mapa=praia`) e o servidor mantém **uma sala por código
 * e por mapa**: `ARENA` na Cidade Neon, `ARENA@praia` na Praia. O código que o jogador digita é o mesmo; o mapa é parte da identidade da sala (quem pede um mapa nunca cai numa sala de outro).
 * Sem `mapa`, é a Cidade Neon (os links e os clientes antigos seguem valendo). Sem mensagem nova no protocolo.
 *
 * **O modo (P243, coop online da Sobrevivência):** a conexão também leva `&modo=survival` (`ARENA@janeiro:survival`); sem ele, Deathmatch (o de sempre). Mesma ideia: identidade da sala, sem mensagem nova.
 *
 * Sem dependência do cliente (o servidor e o cliente leem o mesmo contrato); o teste confere que esta lista é a dos mapas do jogo (`core/Lancamento.ts`).
 */
export const MAPAS_ONLINE = ['arena', 'bunker', 'praia', 'amazonia', 'janeiro'] as const;
export type MapaOnline = (typeof MAPAS_ONLINE)[number];

/** O padrão: a Cidade Neon. */
export const MAPA_PADRAO: MapaOnline = 'arena';

/** Os modos que a sala online aceita hoje: Deathmatch (o de sempre) ou Sobrevivência (P243: a missão, com bots e crise do mapa). CTF e Domínio seguem offline só. */
export const MODOS_DA_SALA = ['deathmatch', 'survival'] as const;
export type SalaModo = (typeof MODOS_DA_SALA)[number];

/** O padrão: Deathmatch. */
export const MODO_PADRAO: SalaModo = 'deathmatch';

/** O `mapa` do link ou da conexão: ausente é a Cidade Neon; um valor que não é mapa do jogo devolve `null` (a conexão é recusada em vez de cair numa sala de outro mapa). */
export function mapaDoLink(bruto: string | null | undefined): MapaOnline | null {
  if (bruto === null || bruto === undefined || bruto.trim() === '') return MAPA_PADRAO;
  const m = bruto.trim().toLowerCase();
  return (MAPAS_ONLINE as readonly string[]).includes(m) ? (m as MapaOnline) : null;
}

/** O `modo` do link ou da conexão: ausente ou desconhecido é Deathmatch (nunca recusa a conexão por causa do modo). */
export function modoDoLink(bruto: string | null | undefined): SalaModo {
  if (bruto === null || bruto === undefined) return MODO_PADRAO;
  const m = bruto.trim().toLowerCase();
  return m === 'survival' || m === 'sobrevivencia' ? 'survival' : MODO_PADRAO;
}

/** A chave interna da sala: o código sozinho na Cidade Neon em Deathmatch (as salas e os painéis de sempre), `CODIGO@mapa` com outro mapa, `CODIGO@mapa:survival` na Sobrevivência. */
export function chaveDaSala(codigo: string, mapa: MapaOnline, modo: SalaModo = MODO_PADRAO): string {
  if (mapa === MAPA_PADRAO && modo === MODO_PADRAO) return codigo;
  const sufixo = modo === MODO_PADRAO ? mapa : `${mapa}:${modo}`;
  return `${codigo}@${sufixo}`;
}

/** O mapa de uma chave de sala (o inverso de `chaveDaSala`). */
export function mapaDaChave(chave: string): MapaOnline {
  const i = chave.indexOf('@');
  if (i < 0) return MAPA_PADRAO;
  const resto = chave.slice(i + 1);
  const j = resto.indexOf(':');
  return mapaDoLink(j < 0 ? resto : resto.slice(0, j)) ?? MAPA_PADRAO;
}

/** O modo de uma chave de sala (o inverso de `chaveDaSala`). */
export function modoDaChave(chave: string): SalaModo {
  const i = chave.indexOf(':');
  return i < 0 ? MODO_PADRAO : modoDoLink(chave.slice(i + 1));
}

/**
 * O código que o jogador digita, sem o mapa nem o modo (o inverso de `chaveDaSala`, a parte antes do `@`): é o que
 * a sala manda em `WELCOME.room` (`shared/net/messages.ts`) — a chave inteira (`ARENA@praia`) tem `@`, minúsculas
 * e pode passar de 12 caracteres, e `ROOM_RE` recusaria a mensagem inteira (achado ao ligar a Sobrevivência
 * online do 8 de Janeiro, P243: nenhum cliente de mapa != Cidade Neon jamais tinha completado o `WELCOME`).
 */
export function codigoDaChave(chave: string): string {
  const i = chave.indexOf('@');
  return i < 0 ? chave : chave.slice(0, i);
}
