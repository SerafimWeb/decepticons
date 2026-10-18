/**
 * Audiência (P188): de onde vêm as visitas e que tipo de gente (de aparelho, não de pessoa) joga, **sem identificar ninguém**. Contrato único do que a landing, o jogo e o servidor combinam:
 * as categorias fechadas, a classificação da origem (link, busca, rede social, digitou o endereço, campanha), a família do navegador e do sistema, o tipo de aparelho, o idioma e a faixa
 * "há quantos dias esta pessoa visitou pela primeira vez".
 *
 * **Privacidade (o que torna isto aceitável):** nada aqui é identificador. Cada valor é uma **categoria** de poucas opções (`chrome`, `mobile`, `social`…) e o servidor só soma quantas vezes cada
 * categoria apareceu por dia. O único estado que fica no navegador é uma data (o dia da primeira visita) para separar "novo" de "recorrente": é a mesma para todo mundo que visitou naquele dia
 * e nunca é enviada. O endereço de quem visita (referrer) vira só a categoria e, quando é outro site, o **nome do site** (`instagram.com`), nunca o caminho nem a consulta. A política de
 * privacidade (`/privacidade/`) descreve isto; mudar o que se coleta aqui muda o texto e a `POLITICA_VERSAO`.
 */

export const CANAIS = ['direto', 'busca', 'social', 'site', 'campanha', 'interno'] as const;
export type Canal = (typeof CANAIS)[number];
export const DISPOSITIVOS = ['mobile', 'tablet', 'desktop'] as const;
export const NAVEGADORES = ['chrome', 'edge', 'firefox', 'safari', 'opera', 'samsung', 'outro'] as const;
export const SISTEMAS = ['windows', 'mac', 'linux', 'android', 'ios', 'chromeos', 'outro'] as const;
export const IDIOMAS_VISITA = ['pt', 'en', 'es', 'fr', 'ja', 'zh', 'ru', 'outro'] as const;
export const RETORNOS = ['novo', 'd1', 'd2-7', 'd8-30', 'd31+'] as const;
export const CONTAS = ['logado', 'convidado'] as const;
/** O degrau da qualidade gráfica em que a rodada terminou: 0 = a mais alta; 2 = a mais baixa (o jogo rebaixa sozinho quando o aparelho não aguenta, G12). */
export const QUALIDADES = ['alta', 'media', 'baixa'] as const;
export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

export type Dispositivo = (typeof DISPOSITIVOS)[number];
export type Navegador = (typeof NAVEGADORES)[number];
export type Sistema = (typeof SISTEMAS)[number];
export type IdiomaVisita = (typeof IDIOMAS_VISITA)[number];
export type Retorno = (typeof RETORNOS)[number];
export type ContaTipo = (typeof CONTAS)[number];
export type Qualidade = (typeof QUALIDADES)[number];

/** Quem chegou, descrito por categorias. `host` só vem quando o canal é `busca`, `social` ou `site`; as três `utm_*` só na `campanha`. */
export interface Visita {
  canal: Canal;
  host?: string;
  us?: string;
  um?: string;
  uc?: string;
  disp: Dispositivo;
  nav: Navegador;
  so: Sistema;
  lang: IdiomaVisita;
  ret: Retorno;
}

/** O que acompanha os eventos do funil: o canal da visita (para o funil por canal) e, na partida, se havia conta e a qualidade. */
export interface ContextoDoFunil {
  canal: Canal;
  conta?: ContaTipo;
}

/** O contexto que um evento do cliente pode levar (`o` no corpo de `POST /evento`): a visita (`landing_view`, `boot_ok`) ou o do funil (os outros). */
export type ContextoDeEvento = { tipo: 'visita'; visita: Visita } | { tipo: 'funil'; funil: ContextoDoFunil };

/** Os eventos que levam a visita inteira (uma vez por carregamento de página) e os que levam só o canal. */
export const EVENTOS_DE_VISITA: readonly string[] = ['landing_view', 'boot_ok'];
export const EVENTOS_DO_FUNIL: readonly string[] = ['click_cockpit', 'click_online', 'partida_iniciada', 'partida_terminada'];

// ---------------------------------------------------------------- classificação (pura: roda no navegador e nos testes)

const TEXTO_UTM = /^[a-z0-9][a-z0-9_.-]{0,31}$/;
const HOST = /^[a-z0-9]([a-z0-9.-]{0,58}[a-z0-9])?$/;

const BUSCAS = ['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'brave', 'yandex', 'baidu', 'startpage', 'qwant', 'naver', 'seznam', 'ask.com'];
const REDES = [
  'facebook.com', 'fb.com', 'fb.me', 'instagram.com', 'twitter.com', 't.co', 'x.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'reddit.com', 'redd.it', 'discord.com', 'discord.gg', 'discordapp.com',
  'whatsapp.com', 'wa.me', 'telegram.org', 't.me', 'linkedin.com', 'lnkd.in', 'pinterest.com', 'threads.net', 'bsky.app', 'vk.com', 'twitch.tv', 'tumblr.com', 'snapchat.com', 'kwai.com', 'steamcommunity.com',
];

/** O nome do site de um endereço (`https://www.Instagram.com/p/x?y=1` vira `instagram.com`), ou `''` se não der. Sem caminho, sem consulta, sem porta. */
export function hostDeEndereco(endereco: string): string {
  try {
    const h = new URL(endereco).hostname.toLowerCase().replace(/^www\./, '');
    return HOST.test(h) ? h : '';
  } catch {
    return '';
  }
}

const bate = (host: string, base: string): boolean => host === base || host.endsWith(`.${base}`);

/**
 * De onde a visita veio. Ordem: uma campanha marcada no link (`utm_*`) vale mais que tudo; sem referrer é `direto` (digitou o endereço, favorito, app); referrer do próprio site é `interno`
 * (quem vem da landing para o jogo: a origem verdadeira é a da primeira página, guardada pelo chamador); busca, rede social, ou `site` (qualquer outro).
 */
export function classificarOrigem(entrada: { referrer: string; hostProprio: string; search: string }): Pick<Visita, 'canal' | 'host' | 'us' | 'um' | 'uc'> {
  const params = new URLSearchParams(entrada.search);
  const utm = (nome: string): string | undefined => {
    const v = (params.get(nome) ?? '').trim().toLowerCase();
    return TEXTO_UTM.test(v) ? v : undefined;
  };
  const us = utm('utm_source');
  const um = utm('utm_medium');
  const uc = utm('utm_campaign');
  const host = hostDeEndereco(entrada.referrer);
  const propria = entrada.hostProprio.toLowerCase().replace(/^www\./, '');
  if (us || um || uc) return { canal: 'campanha', ...(host && host !== propria ? { host } : {}), ...(us ? { us } : {}), ...(um ? { um } : {}), ...(uc ? { uc } : {}) };
  if (!host) return { canal: 'direto' };
  if (host === propria || host.endsWith(`.${propria}`)) return { canal: 'interno' };
  if (BUSCAS.some((b) => host.split('.').includes(b) || host.startsWith(`${b}.`) || host === b)) return { canal: 'busca', host };
  if (REDES.some((r) => bate(host, r))) return { canal: 'social', host };
  return { canal: 'site', host };
}

/** A família do navegador. `marcas` são as do `navigator.userAgentData.brands` (mais confiáveis que o texto do user agent, quando existem). */
export function familiaDoNavegador(ua: string, marcas: readonly string[] = []): Navegador {
  const m = marcas.join(' ').toLowerCase();
  if (m.includes('microsoft edge')) return 'edge';
  if (m.includes('opera')) return 'opera';
  if (m.includes('samsung')) return 'samsung';
  if (m.includes('google chrome')) return 'chrome';
  const t = ua.toLowerCase();
  if (/edg(e|a|ios)?\//.test(t)) return 'edge';
  if (/opr\/|opera/.test(t)) return 'opera';
  if (/samsungbrowser/.test(t)) return 'samsung';
  if (/firefox|fxios/.test(t)) return 'firefox';
  if (/chrome|crios|chromium/.test(t)) return 'chrome';
  if (/safari/.test(t)) return 'safari';
  return 'outro';
}

/** A família do sistema operacional (do `navigator.userAgentData.platform` ou do user agent). */
export function familiaDoSistema(ua: string, plataforma = ''): Sistema {
  const t = `${plataforma} ${ua}`.toLowerCase();
  if (/android/.test(t)) return 'android';
  if (/iphone|ipad|ipod|ios/.test(t)) return 'ios';
  if (/cros|chrome os/.test(t)) return 'chromeos';
  if (/windows|win32|win64/.test(t)) return 'windows';
  if (/macintosh|mac os|macos|macintel/.test(t)) return 'mac';
  if (/linux|x11/.test(t)) return 'linux';
  return 'outro';
}

/** Celular, tablet ou computador: ponteiro "grosso" (dedo) e a largura da janela. */
export function tipoDeAparelho(dedo: boolean, largura: number): Dispositivo {
  if (!dedo) return 'desktop';
  return largura >= 768 ? 'tablet' : 'mobile';
}

/** A língua principal do navegador (`pt-BR` vira `pt`); fora das sete do jogo, `outro`. */
export function idiomaPrincipal(lang: string): IdiomaVisita {
  const p = (lang ?? '').toLowerCase().slice(0, 2);
  return (IDIOMAS_VISITA as readonly string[]).includes(p) && p !== 'outro' ? (p as IdiomaVisita) : 'outro';
}

const DIA_MS = 86_400_000;
/** Há quantos dias foi a primeira visita? `null` (nunca visitou) é `novo`. Datas em AAAA-MM-DD; o que não for data vira `novo` (a marca estragada não vale). */
export function faixaDeRetorno(primeiroDia: string | null, hoje: string): Retorno {
  if (!primeiroDia || !/^\d{4}-\d{2}-\d{2}$/.test(primeiroDia)) return 'novo';
  const dias = Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${primeiroDia}T00:00:00Z`)) / DIA_MS);
  if (!Number.isFinite(dias) || dias <= 0) return 'novo';
  if (dias === 1) return 'd1';
  if (dias <= 7) return 'd2-7';
  if (dias <= 30) return 'd8-30';
  return 'd31+';
}

// ---------------------------------------------------------------- validação do que chega ao servidor

const em = <T extends string>(lista: readonly T[], v: unknown): v is T => typeof v === 'string' && (lista as readonly string[]).includes(v);

/** Lê a visita do corpo de um evento. Qualquer campo fora das listas fechadas, ou um texto fora do formato, derruba a visita inteira (ninguém injeta categoria no painel). */
export function parseVisita(raw: unknown): Visita | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!em(CANAIS, r.canal) || !em(DISPOSITIVOS, r.disp) || !em(NAVEGADORES, r.nav) || !em(SISTEMAS, r.so) || !em(IDIOMAS_VISITA, r.lang) || !em(RETORNOS, r.ret)) return null;
  const v: Visita = { canal: r.canal, disp: r.disp, nav: r.nav, so: r.so, lang: r.lang, ret: r.ret };
  if (r.host !== undefined) {
    if (typeof r.host !== 'string' || !HOST.test(r.host)) return null;
    v.host = r.host;
  }
  for (const k of ['us', 'um', 'uc'] as const) {
    if (r[k] === undefined) continue;
    if (typeof r[k] !== 'string' || !TEXTO_UTM.test(r[k] as string)) return null;
    v[k] = r[k] as string;
  }
  return v;
}

export function parseContextoDoFunil(raw: unknown): ContextoDoFunil | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!em(CANAIS, r.canal)) return null;
  if (r.conta !== undefined && !em(CONTAS, r.conta)) return null;
  return { canal: r.canal, ...(r.conta === undefined ? {} : { conta: r.conta as ContaTipo }) };
}

/** O contexto de um evento, conforme o tipo dele: a visita para `landing_view`/`boot_ok`, o do funil para os outros. `undefined` = o evento veio sem contexto (vale, só não entra na audiência); `null` = veio torto. */
export function parseContextoDeEvento(nome: string, raw: unknown): ContextoDeEvento | undefined | null {
  if (raw === undefined) return undefined;
  if (EVENTOS_DE_VISITA.includes(nome)) {
    const visita = parseVisita(raw);
    return visita ? { tipo: 'visita', visita } : null;
  }
  if (EVENTOS_DO_FUNIL.includes(nome)) {
    const funil = parseContextoDoFunil(raw);
    return funil ? { tipo: 'funil', funil } : null;
  }
  return null;
}

/** A região (UF) do cabeçalho `cf-region-code` da Cloudflare, só para o Brasil e só uma das 27 siglas; qualquer outra coisa é nada. Nunca cidade. */
export function parseUf(pais: string, header: unknown): string | null {
  const v = (Array.isArray(header) ? header[0] : header) as unknown;
  if (pais !== 'BR' || typeof v !== 'string') return null;
  const s = v.trim().toUpperCase();
  return (UFS as readonly string[]).includes(s) ? s : null;
}
