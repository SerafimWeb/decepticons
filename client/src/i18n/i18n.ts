/**
 * Idiomas do jogo (ordem P172, 17/10/2026: "vamos JÁ colocar a opção para outras línguas").
 *
 * O português é o texto de origem: está escrito no `index.html` e nos módulos, e **sem dicionário nada muda** (custo zero). Cada outra língua é um arquivo
 * `public/locales/<id>.json` com `{ "texto em português": "tradução" }` — JSON em `public/` e não módulo, para não entrar no teto de 500 KB de JS (G12) e para só
 * baixar quem escolheu a língua. Uma chave pode ter lacunas `{0}`, `{1}`… (o que o jogo preenche: número, nome); a tradução repete as mesmas lacunas, na ordem que a língua pedir.
 *
 * Como traduz: `traduzir(texto)` é a função pura (a tabela, o cache e os padrões). A camada de DOM percorre os textos e os atributos `title`/`aria-label`/`placeholder`/`alt`
 * e fica de olho (`MutationObserver`) no que o jogo escreve depois (HUD, avisos, menus): **nenhum módulo de interface precisa saber de idioma**. O observador só liga fora do português;
 * a troca de língua é ao vivo, sem recarregar (cada nó guarda o seu original). O que não está no dicionário aparece em português, nunca vazio.
 *
 * Fora do alcance (marcado PARCIAL em `STATUS_REAL.md`): a voz do narrador (gravada em português), textos desenhados em canvas (placas de nome, mapa-múndi) e as fichas longas do Hangar.
 */

export const IDIOMAS = [
  { id: 'pt', nome: 'Português', html: 'pt-BR' },
  { id: 'en', nome: 'English', html: 'en' },
  { id: 'es', nome: 'Español', html: 'es' },
  { id: 'fr', nome: 'Français', html: 'fr' },
  { id: 'ja', nome: '日本語', html: 'ja' },
  { id: 'zh', nome: '中文', html: 'zh-CN' },
  { id: 'ru', nome: 'Русский', html: 'ru' },
] as const;

export type IdiomaId = (typeof IDIOMAS)[number]['id'];
export const IDIOMA_PADRAO: IdiomaId = 'pt';
export const CHAVE_IDIOMA = 'cybermech.lang';

export type Dicionario = Readonly<Record<string, string>>;

const ID_VALIDOS: ReadonlySet<string> = new Set(IDIOMAS.map((i) => i.id));

export function idiomaValido(v: string | null | undefined): v is IdiomaId {
  return !!v && ID_VALIDOS.has(v);
}

/**
 * Qual língua abrir. Ordem: `?lang=` do link → a escolha salva → a língua do navegador → português.
 * `automatizado` (navegador de teste, `navigator.webdriver`) pula a detecção: as bancadas e o smoke comparam textos em português.
 */
export function idiomaInicial(search: string, salvo: string | null, navegador: string | undefined, automatizado: boolean): IdiomaId {
  const doLink = new URLSearchParams(search).get('lang')?.toLowerCase().slice(0, 2);
  if (idiomaValido(doLink)) return doLink;
  const guardado = salvo?.toLowerCase().slice(0, 2);
  if (idiomaValido(guardado)) return guardado;
  if (automatizado) return IDIOMA_PADRAO;
  const doNavegador = navegador?.toLowerCase().slice(0, 2);
  return idiomaValido(doNavegador) ? doNavegador : IDIOMA_PADRAO;
}

// ---------------------------------------------------------------- tradução (pura)

interface Padrao {
  readonly re: RegExp;
  /** Para cada lacuna `{n}` da tradução, qual grupo do regex a preenche (a ordem em que ela aparece na chave). */
  readonly modelo: string;
  readonly grupos: readonly number[];
  /** Quanto texto fixo a chave tem (sem as lacunas): é o que decide quem vence entre dois padrões que servem ao mesmo texto. */
  readonly fixo: number;
  /** A chave não tem " · ": então nenhuma lacuna dela pode conter um separador " · " solto (a composição "A · B" é de quem a junta, a chave "{0} · {1}"). */
  readonly semSeparador: boolean;
}

const LACUNA = /\{(\d+)\}/g;
const ESCAPE = /[.*+?^${}()|[\]\\]/g;
const TETO_CACHE = 2000;
/** Quantas voltas de tradução aninhada valem: a composição "{0} · {1}" (1ª volta) traduz cada parte, e uma parte pode ser ela mesma um padrão ("Lançador EMP MK I" = "{0} MK {1}", 2ª volta). Mais que isso o custo cresce sem ganho. */
const PROFUNDIDADE = 2;
/** Um " · " solto (no meio, no começo ou no fim do que a lacuna pegou); o "·" colado a nomes ("CLAWD·BRABO") não conta. */
const SEPARADOR = /(?:^|\s)·(?:\s|$)/;

let exato = new Map<string, string>();
let padroes: Padrao[] = [];
const cache = new Map<string, string>();
let atual: IdiomaId = IDIOMA_PADRAO;

/** Monta a tabela de uma língua. Chaves com `{n}` viram padrões; as demais, busca exata. */
export function carregarDicionario(dic: Dicionario | null): void {
  exato = new Map();
  padroes = [];
  cache.clear();
  if (!dic) return;
  for (const [chave, valor] of Object.entries(dic)) {
    if (!valor) continue;
    if (!chave.includes('{')) {
      exato.set(chave, valor);
      continue;
    }
    const grupos: number[] = [];
    let fonte = '';
    let fim = 0;
    const lacuna = '([\\s\\S]+?)';
    for (const m of chave.matchAll(LACUNA)) {
      fonte += chave.slice(fim, m.index!).replace(ESCAPE, '\\$&') + lacuna;
      grupos.push(Number(m[1]));
      fim = m.index! + m[0].length;
    }
    fonte += chave.slice(fim).replace(ESCAPE, '\\$&');
    padroes.push({ re: new RegExp(`^${fonte}$`), modelo: valor, grupos, fixo: chave.replace(LACUNA, '').length, semSeparador: !chave.includes(' · ') });
  }
  // O padrão mais específico (mais texto fixo) primeiro: "ONDA {0} ELIMINADA" antes de "ONDA {0}", e "RODADA {0} · {1}" antes da composição genérica "{0} · {1}".
  padroes.sort((a, b) => b.fixo - a.fixo || b.re.source.length - a.re.source.length);
}

function semMargens(texto: string): [string, string, string] {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(texto)!;
  return [m[1]!, m[2]!, m[3]!];
}

/** O que preencheu uma lacuna, traduzido se for texto (com os espaços das pontas intactos). */
function traduzirLacuna(valor: string, fundo: number): string {
  const [antes, miolo, depois] = semMargens(valor);
  const achado = /\p{L}/u.test(miolo) ? traduzirMiolo(miolo, fundo) : undefined;
  return achado === undefined ? valor : antes + achado + depois;
}

function traduzirMiolo(miolo: string, fundo: number): string | undefined {
  const direto = exato.get(miolo);
  if (direto !== undefined) return direto;
  for (const p of padroes) {
    const m = p.re.exec(miolo);
    if (!m) continue;
    // Uma chave sem " · " não engole uma composição "A · B": quem junta partes com " · " é a chave "{0} · {1}", que traduz cada parte pelo que o dicionário já sabe. (O " · " pode ficar
    // na borda da lacuna, colado ao texto fixo da chave: "ANDRÓIDE " + "· manso"; por isso o teste é no que a lacuna pegou, não na expressão.)
    if (p.semSeparador && m.some((g, i) => i > 0 && SEPARADOR.test(g))) continue;
    // As lacunas podem ser texto traduzível (o nome de uma missão): uma volta só, sem recursão sem fim.
    const valores = p.grupos.map((_, i) => (fundo > 0 ? traduzirLacuna(m[i + 1]!, fundo - 1) : m[i + 1]!));
    return p.modelo.replace(LACUNA, (_, n: string) => {
      const posicao = p.grupos.indexOf(Number(n));
      return posicao >= 0 ? valores[posicao]! : '';
    });
  }
  // O gerador de uma página pode quebrar a linha dentro de um texto: tenta de novo com os espaços juntos.
  const junto = miolo.replace(/\s+/g, ' ');
  return junto !== miolo ? traduzirMiolo(junto, fundo) : undefined;
}

/** O texto na língua atual (o próprio texto, se não houver tradução). Preserva os espaços das pontas. */
export function traduzir(texto: string): string {
  if (exato.size === 0 && padroes.length === 0) return texto;
  const guardado = cache.get(texto);
  if (guardado !== undefined) return guardado;
  const [antes, miolo, depois] = semMargens(texto);
  // Só números, tempos e símbolos (o relógio, a vida): nada a traduzir.
  const achado = /\p{L}/u.test(miolo) ? traduzirMiolo(miolo, PROFUNDIDADE) : undefined;
  const feito = achado === undefined ? texto : antes + achado + depois;
  if (cache.size >= TETO_CACHE) cache.clear();
  cache.set(texto, feito);
  return feito;
}

/** Atalho para o código que monta texto na mão: `t('SAIR DA CONTA')`, `t('ONDA {0}', 3)`. */
export function t(chave: string, ...valores: (string | number)[]): string {
  const base = valores.length ? chave.replace(LACUNA, (_, n: string) => String(valores[Number(n)] ?? '')) : chave;
  return traduzir(base);
}

export function idiomaAtual(): IdiomaId {
  return atual;
}

// ---------------------------------------------------------------- DOM (só no navegador)

interface Registro {
  orig: string;
  mostrado: string;
}

const ATRIBUTOS = ['title', 'aria-label', 'placeholder', 'alt'] as const;
const IGNORAR = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT']);
const textos = new WeakMap<Node, Registro>();
const atributos = new WeakMap<Element, Map<string, Registro>>();
let observador: MutationObserver | null = null;
let tituloOriginal = '';
/** Os seletores de idioma da tela (o do canto e o das Configurações): andam juntos. */
const seletores = new Set<HTMLSelectElement>();

function ignorado(no: Node): boolean {
  const pai = no.parentElement;
  return !pai || IGNORAR.has(pai.tagName) || pai.closest('[data-i18n="nao"]') !== null;
}

function aplicarTexto(no: Text): void {
  if (ignorado(no)) return;
  const reg = textos.get(no);
  // Se o texto atual é o que escrevemos, o original é o guardado; se mudou, o jogo escreveu texto novo: ele é o original.
  const orig = reg && reg.mostrado === no.data ? reg.orig : no.data;
  const novo = traduzir(orig);
  if (novo !== orig || reg) textos.set(no, { orig, mostrado: novo });
  if (no.data !== novo) no.data = novo;
}

function aplicarAtributo(el: Element, nome: string): void {
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
}

/** Traduz (ou restaura) a árvore inteira a partir de `raiz`. */
export function traduzirDOM(raiz: Node): void {
  if (raiz.nodeType === Node.TEXT_NODE) {
    aplicarTexto(raiz as Text);
    return;
  }
  if (raiz.nodeType !== Node.ELEMENT_NODE && raiz.nodeType !== Node.DOCUMENT_NODE) return;
  const andador = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  for (let n = andador.nextNode(); n; n = andador.nextNode()) aplicarTexto(n as Text);
  const elementos = raiz.nodeType === Node.ELEMENT_NODE ? [raiz as Element, ...(raiz as Element).querySelectorAll('*')] : [...(raiz as Document).querySelectorAll('*')];
  for (const el of elementos) for (const a of ATRIBUTOS) if (el.hasAttribute(a)) aplicarAtributo(el, a);
}

function ligarObservador(): void {
  if (observador || typeof MutationObserver === 'undefined') return;
  observador = new MutationObserver((lote) => {
    for (const m of lote) {
      if (m.type === 'characterData') aplicarTexto(m.target as Text);
      else if (m.type === 'attributes') aplicarAtributo(m.target as Element, m.attributeName!);
      else for (const n of m.addedNodes) traduzirDOM(n);
    }
  });
  observador.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATRIBUTOS] });
}

function desligarObservador(): void {
  observador?.disconnect();
  observador = null;
}

// ---------------------------------------------------------------- carregar e trocar

function lerSalvo(): string | null {
  try {
    return localStorage.getItem(CHAVE_IDIOMA);
  } catch {
    return null;
  }
}

function gravar(id: IdiomaId): void {
  try {
    localStorage.setItem(CHAVE_IDIOMA, id);
  } catch {
    /* navegador sem armazenamento: a escolha vale só nesta sessão */
  }
}

async function buscar(id: IdiomaId): Promise<Dicionario | null> {
  if (id === IDIOMA_PADRAO) return null;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}locales/${id}.json`);
    return res.ok ? ((await res.json()) as Dicionario) : null;
  } catch {
    return null;
  }
}

async function aplicar(id: IdiomaId): Promise<void> {
  const dic = await buscar(id);
  // Sem dicionário (rede, arquivo ausente) o jogo continua em português, sem prometer outra língua.
  atual = dic ? id : IDIOMA_PADRAO;
  carregarDicionario(dic);
  document.documentElement.lang = IDIOMAS.find((i) => i.id === atual)!.html;
  document.title = traduzir(tituloOriginal);
  traduzirDOM(document.body);
  if (atual === IDIOMA_PADRAO) desligarObservador();
  else ligarObservador();
  for (const s of seletores) s.value = atual;
}

/** Abre o jogo na língua certa. Chame antes de montar a interface (`main.ts`); nunca lança. */
export async function iniciarIdioma(): Promise<IdiomaId> {
  tituloOriginal = document.title;
  const id = idiomaInicial(location.search, lerSalvo(), navigator.language, navigator.webdriver === true);
  if (id !== IDIOMA_PADRAO) await aplicar(id);
  return atual;
}

/** A troca ao vivo (o seletor das configurações): grava a escolha e retraduz a tela inteira, sem recarregar. */
export async function trocarIdioma(id: IdiomaId): Promise<IdiomaId> {
  gravar(id);
  await aplicar(id);
  return atual;
}

/** Liga um `<select>` à troca de língua: lista as línguas pelo próprio nome (nunca traduzido) e acompanha a escolha. */
export function ligarSeletorIdioma(seletor: HTMLSelectElement): void {
  seletores.add(seletor);
  seletor.replaceChildren(
    ...IDIOMAS.map((i) => {
      const o = document.createElement('option');
      o.value = i.id;
      o.textContent = i.nome;
      return o;
    }),
  );
  seletor.value = atual;
  seletor.addEventListener('change', () => {
    const id = seletor.value;
    if (idiomaValido(id)) void trocarIdioma(id).then((feito) => (seletor.value = feito));
  });
}
