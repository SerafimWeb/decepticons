/**
 * O MAPA DA SALA ONLINE (P218, `MULTIPLAYER.md` § 12, etapa O1): a sala deixou de ser só a Cidade Neon. A conexão leva o mapa (`/?sala=ARENA&mapa=praia`) e o servidor mantém **uma sala por código
 * e por mapa**: `ARENA` na Cidade Neon, `ARENA@praia` na Praia. O código que o jogador digita é o mesmo; o mapa é parte da identidade da sala (quem pede um mapa nunca cai numa sala de outro).
 * Sem `mapa`, é a Cidade Neon (os links e os clientes antigos seguem valendo). Sem mensagem nova no protocolo.
 *
 * Sem dependência do cliente (o servidor e o cliente leem o mesmo contrato); o teste confere que esta lista é a dos mapas do jogo (`core/Lancamento.ts`).
 */
export const MAPAS_ONLINE = ['arena', 'bunker', 'praia', 'amazonia'] as const;
export type MapaOnline = (typeof MAPAS_ONLINE)[number];

/** O padrão: a Cidade Neon. */
export const MAPA_PADRAO: MapaOnline = 'arena';

/** O `mapa` do link ou da conexão: ausente é a Cidade Neon; um valor que não é mapa do jogo devolve `null` (a conexão é recusada em vez de cair numa sala de outro mapa). */
export function mapaDoLink(bruto: string | null | undefined): MapaOnline | null {
  if (bruto === null || bruto === undefined || bruto.trim() === '') return MAPA_PADRAO;
  const m = bruto.trim().toLowerCase();
  return (MAPAS_ONLINE as readonly string[]).includes(m) ? (m as MapaOnline) : null;
}

/** A chave interna da sala: o código sozinho na Cidade Neon (as salas e os painéis de sempre), `CODIGO@mapa` nos outros. */
export function chaveDaSala(codigo: string, mapa: MapaOnline): string {
  return mapa === MAPA_PADRAO ? codigo : `${codigo}@${mapa}`;
}

/** O mapa de uma chave de sala (o inverso de `chaveDaSala`). */
export function mapaDaChave(chave: string): MapaOnline {
  const i = chave.indexOf('@');
  return i < 0 ? MAPA_PADRAO : (mapaDoLink(chave.slice(i + 1)) ?? MAPA_PADRAO);
}
