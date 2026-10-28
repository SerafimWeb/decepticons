/**
 * OS ANÚNCIOS DA MARCA (P266, ordem do Comandante de 28/10): as fases do jogo divulgam os produtos dele ("vamos usar os nossos produtos, nosso branding, pra fortalecer nossa marca").
 * Este arquivo é o catálogo — dado puro, sem Three nem DOM: quais anúncios existem, a imagem de cada um, a cor de acento e o texto que eles dizem. Quem posiciona os outdoors em cada mapa
 * (a Cidade Neon agora; a Estação dos Cabos depois, com menos frequência) escolhe daqui; quem desenha é `environment/Outdoors.ts`.
 *
 * **As imagens** (`client/public/anuncios/<arquivo>.webp`, 512×1024, na vertical) nascem em `scripts/anuncios/*.html` pela mesa de anúncios (`npm run anuncios`): para mudar um texto, mude a
 * página e rode de novo. **O texto dos anúncios só afirma o que o produto afirma** (fonte: o README, a landing e o tutorial do Olho do Pai em `D:\SERAFIMHUB\odpv9\web`; o site da Serafim
 * Web em `D:\SERAFIMHUB\serafimweb`): por exemplo, o ping é "em até 5 s" porque o tutorial documenta "menos de 5 s" (1–2 s com o app aberto), e o produto se apresenta como "proteção com
 * ciência, sem modo oculto" — nada de preço, de oferta com prazo, nem de promessa que o produto não faz. O teste `anuncios.test.ts` trava isso.
 */

/** O endereço do Olho do Pai: aparece em todo anúncio que fala dele (ordem do Comandante). */
export const URL_ODP = 'odp.serafimweb.com';
/** O endereço da Serafim Web (o Software Bureau). */
export const URL_SWB = 'serafimweb.com';

export type IdDoAnuncio = 'odp-olho' | 'odp-gps' | 'odp-ping' | 'odp-sos' | 'odp-familia' | 'swb' | 'logo';
export type MarcaDoAnuncio = 'odp' | 'swb' | 'serafim';

export interface Anuncio {
  readonly id: IdDoAnuncio;
  /** Quem é divulgado: o Olho do Pai, a Serafim Web (o bureau) ou só a logo. */
  readonly marca: MarcaDoAnuncio;
  /** As imagens em `public/anuncios/` (sem a pasta). Uma = fixa; várias = o outdoor que alterna, um slide por vez, na ordem. */
  readonly arquivos: readonly string[];
  /** Quanto cada slide fica na tela (s); só vale com mais de um arquivo. */
  readonly periodoDoSlide: number;
  /** O acento do anúncio (RGB): o reflexo dele no chão molhado e o brilho em volta do outdoor. */
  readonly cor: number;
  /** O que cada imagem diz (uma entrada por arquivo, na mesma ordem): é o que o teste confere contra o produto. */
  readonly texto: readonly string[];
  /** O endereço que o anúncio mostra, ou `null` (a logo plana). */
  readonly url: string | null;
}

const A = (a: Anuncio): Anuncio => Object.freeze({ ...a, arquivos: Object.freeze([...a.arquivos]), texto: Object.freeze([...a.texto]) });

export const ANUNCIOS: readonly Anuncio[] = Object.freeze([
  A({ id: 'odp-olho', marca: 'odp', arquivos: ['odp-olho.webp'], periodoDoSlide: 0, cor: 0xff9d1c, texto: [`OLHO DO PAI · RASTREAMENTO DE CELULAR 24H · ${URL_ODP}`], url: URL_ODP }),
  A({ id: 'odp-gps', marca: 'odp', arquivos: ['odp-gps.webp'], periodoDoSlide: 0, cor: 0x2aa0ff, texto: [`OLHO DO PAI · GPS AO VIVO 24H · Rastreamento em tempo real · ${URL_ODP}`], url: URL_ODP }),
  A({ id: 'odp-ping', marca: 'odp', arquivos: ['odp-ping.webp'], periodoDoSlide: 0, cor: 0xa8ff1a, texto: [`PING < 5s · Localização na hora · ${URL_ODP}`], url: URL_ODP }),
  A({ id: 'odp-sos', marca: 'odp', arquivos: ['odp-sos.webp'], periodoDoSlide: 0, cor: 0xff2bd6, texto: [`BOTÃO SOS · Segurança imediata · alerta automático por impacto · ${URL_ODP}`], url: URL_ODP }),
  A({
    id: 'odp-familia',
    marca: 'odp',
    arquivos: ['odp-familia-1.webp', 'odp-familia-2.webp', 'odp-familia-3.webp', 'odp-familia-4.webp'],
    periodoDoSlide: 4.5,
    cor: 0x19e3ff,
    texto: [
      `OLHO DO PAI · SEGURANÇA PARA SUA FAMÍLIA · Proteção GPS 24h · ${URL_ODP}`,
      `OLHO DO PAI · RASTREAMENTO DE CELULARES ANDROID · com histórico de movimentação · ${URL_ODP}`,
      `OLHO DO PAI · CERCAS VIRTUAIS · Alerta na hora quando entram ou saem · ${URL_ODP}`,
      `OLHO DO PAI · ${URL_ODP} · Proteção com ciência. Sem modo oculto. · APP PARA ANDROID`,
    ],
    url: URL_ODP,
  }),
  A({ id: 'swb', marca: 'swb', arquivos: ['swb.webp'], periodoDoSlide: 0, cor: 0x19d3ff, texto: [`SERAFIM WEB · SOFTWARE BUREAU · APLICATIVOS · SITES · JOGOS · CORREÇÃO DE CÓDIGO · SEGURANÇA DIGITAL · ${URL_SWB}`], url: URL_SWB }),
  A({ id: 'logo', marca: 'serafim', arquivos: ['logo.webp'], periodoDoSlide: 0, cor: 0x19d3ff, texto: ['SERAFIM WEB · SOFTWARE BUREAU'], url: null }),
]);

const POR_ID: ReadonlyMap<IdDoAnuncio, Anuncio> = new Map(ANUNCIOS.map((a) => [a.id, a]));

/** O anúncio pelo id (sempre existe: o tipo só deixa os do catálogo). */
export function anuncioPorId(id: IdDoAnuncio): Anuncio {
  return POR_ID.get(id)!;
}

/** Todos os arquivos de imagem do catálogo (para o teste e para quem precisar pré-carregar). */
export function arquivosDosAnuncios(): readonly string[] {
  return ANUNCIOS.flatMap((a) => a.arquivos);
}

/** A textura do holograma da logo (`client/public/brand/`): a logo oficial em RGB sobre preto. Fica fora do catálogo de anúncios porque é a luz de um objeto 3D, não um outdoor. */
export const ARQUIVO_DO_HOLOGRAMA = 'serafim-logo-holo.webp';
