import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANUNCIOS, anuncioPorId, ARQUIVO_DO_HOLOGRAMA, arquivosDosAnuncios, URL_ODP, URL_SWB } from './anuncios';

/**
 * Os anúncios da marca (P266): o catálogo, as imagens e as páginas que as geram têm de andar juntos, e o que os anúncios dizem tem de bater com o que o produto afirma. O teste lê o
 * disco (as imagens são arquivos de verdade em `client/public/anuncios/`), então ele também pega o esquecimento de rodar `npm run anuncios` depois de mudar uma página.
 */
const PUBLICO = new URL('../../public/', import.meta.url);
const FONTES = new URL('../../../scripts/anuncios/', import.meta.url);
/** O teto de cada imagem (KB): o mesmo da mesa de anúncios. */
const TETO_KB = 140;

describe('o catálogo de anúncios da marca (P266)', () => {
  it('cada anúncio tem id único, ao menos uma imagem e um texto por imagem', () => {
    const ids = new Set(ANUNCIOS.map((a) => a.id));
    expect(ids.size).toBe(ANUNCIOS.length);
    for (const a of ANUNCIOS) {
      expect(a.arquivos.length, a.id).toBeGreaterThan(0);
      expect(a.texto.length, `${a.id}: um texto por imagem`).toBe(a.arquivos.length);
      if (a.arquivos.length > 1) expect(a.periodoDoSlide, `${a.id}: o que alterna precisa de período`).toBeGreaterThan(1);
      expect(a.cor, a.id).toBeGreaterThan(0);
      expect(anuncioPorId(a.id)).toBe(a);
    }
  });

  it('cada imagem existe, é WebP, cabe no teto e tem a página que a gera (nenhuma sobra no disco)', () => {
    for (const arquivo of arquivosDosAnuncios()) {
      const caminho = new URL(`anuncios/${arquivo}`, PUBLICO);
      expect(existsSync(caminho), `falta ${arquivo}: rode npm run anuncios`).toBe(true);
      expect(statSync(caminho).size / 1024, `${arquivo} passou do teto`).toBeLessThan(TETO_KB);
      expect(arquivo.endsWith('.webp')).toBe(true);
      expect(existsSync(new URL(arquivo.replace('.webp', '.html'), FONTES)), `falta a página de ${arquivo} em scripts/anuncios/`).toBe(true);
    }
    const noDisco = readdirSync(new URL('anuncios/', PUBLICO)).filter((f) => f.endsWith('.webp'));
    expect([...noDisco].sort()).toEqual([...arquivosDosAnuncios()].sort());
  });

  it('a textura do holograma e a logo mestre existem (a logo mestre é a fonte; não vai para o jogador)', () => {
    expect(existsSync(new URL(`brand/${ARQUIVO_DO_HOLOGRAMA}`, PUBLICO))).toBe(true);
    expect(existsSync(new URL('marca/vetorserafim.png', FONTES))).toBe(true);
  });

  it('todo anúncio que fala do Olho do Pai mostra o endereço dele, e o da Serafim Web, o dela (ordem do Comandante)', () => {
    for (const a of ANUNCIOS.filter((x) => x.marca === 'odp')) {
      expect(a.url, a.id).toBe(URL_ODP);
      for (const t of a.texto) expect(t, `${a.id}: a URL tem de aparecer em cada imagem`).toContain(URL_ODP);
    }
    expect(anuncioPorId('swb').url).toBe(URL_SWB);
    expect(anuncioPorId('swb').texto[0]).toContain(URL_SWB);
    expect(URL_ODP).toBe('odp.serafimweb.com');
  });

  it('o que alterna cobre as três mensagens pedidas: segurança para a família, Android com histórico de movimentação e cercas virtuais', () => {
    const familia = anuncioPorId('odp-familia');
    expect(familia.arquivos).toHaveLength(4);
    const todo = familia.texto.join(' | ').toUpperCase();
    expect(todo).toContain('SEGURANÇA PARA SUA FAMÍLIA');
    expect(todo).toContain('ANDROID');
    expect(todo).toContain('HISTÓRICO DE MOVIMENTAÇÃO');
    expect(todo).toContain('CERCAS VIRTUAIS');
  });

  it('o Software Bureau diz o que a Serafim Web faz (aplicativos, sites, jogos, correção de código)', () => {
    const t = anuncioPorId('swb').texto[0]!.toUpperCase();
    for (const servico of ['APLICATIVOS', 'SITES', 'JOGOS', 'CORREÇÃO DE CÓDIGO']) expect(t).toContain(servico);
  });

  it('só afirma o que o produto afirma: o ping é "em até 5 s" (o tutorial documenta menos de 5 s), sem preço, sem oferta com prazo, sem "100%"', () => {
    const tudo = ANUNCIOS.flatMap((a) => a.texto).join(' | ');
    expect(anuncioPorId('odp-ping').texto[0]).toContain('< 5s');
    expect(tudo).not.toMatch(/<\s*3\s*s/i); // o exemplo do Comandante dizia "<3s"; o produto documenta menos de 5 s
    expect(tudo).not.toMatch(/R\$|\bgr[aá]tis\b|\bdias? gr[aá]tis|\b100\s*%|\bgarantid|\bespion|\bsem que (ele|ela) saiba|\boculto\b(?!\.)/i);
    // "Sem modo oculto" é o posicionamento do produto (proteção com ciência); o único "oculto" permitido é a negação dele.
    expect(anuncioPorId('odp-familia').texto[3]).toContain('Sem modo oculto');
  });
});
