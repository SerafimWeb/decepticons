/**
 * A VITRINE: o que as páginas públicas do site podem dizer (`.decepticons/VITRINE.md`).
 *
 * O Comandante (21/10): *"divulgando só o superficial … não ensinamos a clonarem nossas ideias e processos"*. Naquele dia a `/sala-de-controle/` publicava a hospedagem, o túnel, o protocolo de
 * engenharia, o nome das ferramentas, os títulos de todos os PRs e até a confissão de uma queda do servidor. Esta guarda roda no `npm run check` (`site.mjs --check`) sobre o **texto visível**
 * de cada página pública: se um termo de infraestrutura, segurança ou processo aparecer, o check falha e o site não vai ao ar.
 *
 * Só o texto que a pessoa lê (sem `<script>`, `<style>` nem marcação) e o `<title>`/`description`. A política de privacidade fica de fora de propósito: a LGPD obriga a nomear quem trata os dados.
 */

/** Termos que não aparecem no texto das páginas públicas. Cada um vem de algo que vazou ou de algo que ensinaria a copiar o processo. */
export const TERMOS_PROIBIDOS = [
  // Infraestrutura e segurança
  'Cloudflare',
  'Hostinger',
  'túnel',
  'tunnel',
  'SSH',
  'VPS',
  'HSTS',
  'CSP',
  'token',
  'cópia de segurança',
  'backup',
  // Processo e ferramentas
  'worktree',
  'atualizador',
  'hook',
  'Protocolo Serafim',
  'revisão cruzada',
  'aprova o próprio',
  'ESTADO_ATUAL',
  'HISTORICO_DE_DECISOES',
  '.decepticons',
  'pull request',
  'commit',
  'commits',
  'merge',
];

/** O texto que a pessoa lê numa página HTML: sem script, estilo e marcação; com o título e a descrição. */
export function textoVisivel(html) {
  const meta = [...html.matchAll(/<meta\s+(?:name="description"\s+content|content)="([^"]*)"/gi)].map((m) => m[1]).join(' ');
  const corpo = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return `${meta} ${corpo}`.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Os termos proibidos que aparecem no texto visível da página (palavra inteira, sem diferenciar maiúscula), sem repetir. */
export function vazamentos(html, termos = TERMOS_PROIBIDOS) {
  const texto = textoVisivel(html);
  return termos.filter((t) => new RegExp(`(?<![\\p{L}\\p{N}_])${escapar(t)}(?![\\p{L}\\p{N}_])`, 'iu').test(texto));
}
