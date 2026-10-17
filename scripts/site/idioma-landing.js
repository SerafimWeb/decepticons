/**
 * O idioma da landing (ordem P178, 17/10: "idioma tem que ficar logo no início da landing, pra pessoa já selecionar o idioma nativo dele").
 *
 * A mesma ideia do jogo (`client/src/i18n/i18n.ts`, P173): o português é o texto de origem, escrito na página; cada outra língua é um dicionário JSON `{ "texto em português": "tradução" }`
 * (`locales/<id>.json`, ao lado desta página), com lacunas `{0}`, `{1}` para o que o gerador preenche (números do código do jogo). Aqui é JavaScript puro, sem build, porque a landing é uma
 * página estática: **o algoritmo é o mesmo do jogo e um teste os compara** (`server/idiomaLanding.test.ts`), então os dois não se afastam.
 *
 * A escolha vai para `localStorage['cybermech.lang']`, a **mesma chave do jogo** (a landing e `/jogar/` são a mesma origem): quem escolhe aqui já entra no jogo na língua dele. Sem escolha, a língua
 * do navegador (**só fora de navegador de teste**, `navigator.webdriver`: as bancadas e o `site.mjs --check` comparam texto em português). A faixa de idiomas fica no topo da página.
 */

export const IDIOMAS = [
  { id: 'pt', nome: 'Português', html: 'pt-BR' },
  { id: 'en', nome: 'English', html: 'en' },
  { id: 'es', nome: 'Español', html: 'es' },
  { id: 'fr', nome: 'Français', html: 'fr' },
  { id: 'ja', nome: '日本語', html: 'ja' },
  { id: 'zh', nome: '中文', html: 'zh-CN' },
  { id: 'ru', nome: 'Русский', html: 'ru' },
];
export const CHAVE_IDIOMA = 'cybermech.lang';
const VALIDOS = new Set(IDIOMAS.map((i) => i.id));

/** Qual língua abrir: `?lang=` → a escolha salva → a do navegador (fora de teste) → português. */
export function idiomaInicial(search, salvo, navegador, automatizado) {
  const doLink = new URLSearchParams(search).get('lang')?.toLowerCase().slice(0, 2);
  if (VALIDOS.has(doLink)) return doLink;
  const guardado = salvo?.toLowerCase().slice(0, 2);
  if (VALIDOS.has(guardado)) return guardado;
  if (automatizado) return 'pt';
  const doNavegador = navegador?.toLowerCase().slice(0, 2);
  return VALIDOS.has(doNavegador) ? doNavegador : 'pt';
}

const LACUNA = /\{(\d+)\}/g;
const ESCAPE = /[.*+?^${}()|[\]\\]/g;
const TETO_CACHE = 2000;

/** O tradutor de uma língua (`dic` null = português, sem tradução). Mesma conta de `client/src/i18n/i18n.ts`: busca exata, padrões com lacuna, margens das pontas preservadas, cache. */
export function criarTradutor(dic) {
  const exato = new Map();
  const padroes = [];
  const cache = new Map();
  for (const [chave, valor] of Object.entries(dic ?? {})) {
    if (!valor) continue;
    if (!chave.includes('{')) {
      exato.set(chave, valor);
      continue;
    }
    const grupos = [];
    let fonte = '';
    let fim = 0;
    for (const m of chave.matchAll(LACUNA)) {
      fonte += chave.slice(fim, m.index).replace(ESCAPE, '\\$&') + '([\\s\\S]+?)';
      grupos.push(Number(m[1]));
      fim = m.index + m[0].length;
    }
    fonte += chave.slice(fim).replace(ESCAPE, '\\$&');
    padroes.push({ re: new RegExp(`^${fonte}$`), modelo: valor, grupos });
  }
  padroes.sort((a, b) => b.re.source.length - a.re.source.length);

  const margens = (texto) => {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(texto);
    return [m[1], m[2], m[3]];
  };
  const lacuna = (valor, fundo) => {
    const [antes, miolo, depois] = margens(valor);
    const achado = /\p{L}/u.test(miolo) ? traduzirMiolo(miolo, fundo) : undefined;
    return achado === undefined ? valor : antes + achado + depois;
  };
  const traduzirMiolo = (miolo, fundo) => {
    const direto = exato.get(miolo);
    if (direto !== undefined) return direto;
    for (const p of padroes) {
      const m = p.re.exec(miolo);
      if (!m) continue;
      const valores = p.grupos.map((_, i) => (fundo > 0 ? lacuna(m[i + 1], fundo - 1) : m[i + 1]));
      return p.modelo.replace(LACUNA, (_, n) => {
        const posicao = p.grupos.indexOf(Number(n));
        return posicao >= 0 ? valores[posicao] : '';
      });
    }
    // O gerador pode quebrar a linha dentro de um texto: tenta de novo com os espaços juntos.
    const junto = miolo.replace(/\s+/g, ' ');
    return junto !== miolo ? traduzirMiolo(junto, fundo) : undefined;
  };

  return function traduzir(texto) {
    if (exato.size === 0 && padroes.length === 0) return texto;
    const guardado = cache.get(texto);
    if (guardado !== undefined) return guardado;
    const [antes, miolo, depois] = margens(texto);
    const achado = /\p{L}/u.test(miolo) ? traduzirMiolo(miolo, 1) : undefined;
    const feito = achado === undefined ? texto : antes + achado + depois;
    if (cache.size >= TETO_CACHE) cache.clear();
    cache.set(texto, feito);
    return feito;
  };
}

// ---------------------------------------------------------------- a página (só no navegador)

if (typeof document !== 'undefined') {
  const ATRIBUTOS = ['title', 'aria-label', 'alt', 'placeholder'];
  const IGNORAR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
  const textos = new WeakMap();
  const atributos = new WeakMap();
  let traduzir = criarTradutor(null);
  const titulo = document.title;
  const descricao = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';

  const lerSalvo = () => {
    try {
      return localStorage.getItem(CHAVE_IDIOMA);
    } catch {
      return null;
    }
  };
  const gravar = (id) => {
    try {
      localStorage.setItem(CHAVE_IDIOMA, id);
    } catch {
      /* sem armazenamento: vale só nesta aba */
    }
  };
  const fora = (no) => !no.parentElement || IGNORAR.has(no.parentElement.tagName) || no.parentElement.closest('[data-i18n="nao"]') !== null;

  const aplicarTexto = (no) => {
    if (fora(no)) return;
    const reg = textos.get(no);
    const orig = reg && reg.mostrado === no.data ? reg.orig : no.data;
    const novo = traduzir(orig);
    if (novo !== orig || reg) textos.set(no, { orig, mostrado: novo });
    if (no.data !== novo) no.data = novo;
  };
  const aplicarAtributo = (el, nome) => {
    const valor = el.getAttribute(nome);
    if (valor === null || el.closest('[data-i18n="nao"]')) return;
    let mapa = atributos.get(el);
    const reg = mapa?.get(nome);
    const orig = reg && reg.mostrado === valor ? reg.orig : valor;
    const novo = traduzir(orig);
    if (novo !== orig || reg) {
      if (!mapa) atributos.set(el, (mapa = new Map()));
      mapa.set(nome, { orig, mostrado: novo });
    }
    if (valor !== novo) el.setAttribute(nome, novo);
  };

  const traduzirPagina = () => {
    const andador = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = andador.nextNode(); n; n = andador.nextNode()) aplicarTexto(n);
    for (const el of document.body.querySelectorAll('*')) for (const a of ATRIBUTOS) if (el.hasAttribute(a)) aplicarAtributo(el, a);
    document.title = traduzir(titulo);
    document.querySelector('meta[name="description"]')?.setAttribute('content', traduzir(descricao));
  };

  const buscar = async (id) => {
    if (id === 'pt') return null;
    try {
      const res = await fetch(`locales/${id}.json`);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  };

  const marcarFaixa = (id) => {
    for (const b of document.querySelectorAll('.lang-strip [data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === id));
    document.querySelector('.lang-strip')?.classList.toggle('sem-escolha', false);
  };

  const aplicar = async (id) => {
    const dic = await buscar(id);
    // Sem dicionário (rede, arquivo ausente) a página continua em português, sem prometer outra língua.
    const efetivo = dic ? id : 'pt';
    traduzir = criarTradutor(dic);
    document.documentElement.lang = IDIOMAS.find((i) => i.id === efetivo).html;
    traduzirPagina();
    marcarFaixa(efetivo);
    return efetivo;
  };

  const inicio = async () => {
    const id = idiomaInicial(location.search, lerSalvo(), navigator.language, navigator.webdriver === true);
    if (!lerSalvo()) document.querySelector('.lang-strip')?.classList.add('sem-escolha');
    for (const b of document.querySelectorAll('.lang-strip [data-lang]')) {
      b.addEventListener('click', async () => {
        const feito = await aplicar(b.dataset.lang);
        void feito;
        gravar(b.dataset.lang);
      });
    }
    if (id !== 'pt') await aplicar(id);
    else marcarFaixa('pt');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicio);
  else void inicio();
}
