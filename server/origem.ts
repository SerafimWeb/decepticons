/**
 * Trava de origem do servidor de jogo (DEPLOY.md, "Servidor no mesmo domínio"; PRONTIDÃO, risco 6).
 *
 * Por que existe: o navegador manda o cabeçalho `Origin` com a página que abriu a conexão, e ele não pode ser
 * forjado por um script de outra página. Sem a trava, qualquer site na internet pode pôr o nosso `wss://` e o
 * nosso `/conta/entrar` no JavaScript dele e usar o navegador de quem o visita: o servidor passa a ver o IP da
 * vítima (não o do atacante), e um teste de senha ou uma inundação de salas sai distribuído pelos visitantes.
 *
 * O que passa: o jogo servido de `cybermech.online`, a máquina local e a rede de casa (o `npm run dev` e o
 * playtest em LAN), e o que o dono listar em `CYBERMECH_ORIGENS`. Pedido **sem** `Origin` não é de navegador
 * (testes, `curl`, bots, o painel do Node): o teto por IP do `guard.ts` cuida deles.
 *
 * Custo: um teste de texto por conexão e por pedido de conta; nada por mensagem nem por tick.
 */

/** As páginas do jogo no ar. */
export const ORIGENS_DO_JOGO: readonly string[] = ['https://cybermech.online', 'https://www.cybermech.online'];

/** Máquina local e rede privada (RFC 1918): o `npm run dev` e o playtest em LAN, em qualquer porta. */
const REDE_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})(:\d{1,5})?$/;

/** `CYBERMECH_ORIGENS="https://a.exemplo,https://b.exemplo"` vira a lista (sem barra final, em minúsculas). */
export function origensExtras(texto: string | undefined): string[] {
  if (!texto) return [];
  return texto
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, '').toLowerCase())
    .filter((o) => o.length > 0);
}

/** Esta origem pode falar com o servidor? Sem origem (cliente que não é navegador) passa. */
export function origemPermitida(origem: string | undefined, extras: readonly string[] = []): boolean {
  if (origem === undefined || origem === '') return true;
  const o = origem.toLowerCase();
  return ORIGENS_DO_JOGO.includes(o) || extras.includes(o) || REDE_LOCAL.test(o);
}

/**
 * O cabeçalho CORS de uma resposta: devolve a origem do próprio pedido (nunca `*`) quando ela passa; sem origem ou
 * recusada, não manda nada (o navegador bloqueia a leitura). `vary: origin` impede um cache de servir a resposta de
 * uma origem a outra.
 */
export function corsDoPedido(origem: string | undefined, extras: readonly string[] = []): Record<string, string> {
  if (!origem || !origemPermitida(origem, extras)) return { vary: 'origin' };
  return { 'access-control-allow-origin': origem, vary: 'origin' };
}
