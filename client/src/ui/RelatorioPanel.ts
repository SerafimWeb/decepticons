import { idiomaAtual, type IdiomaId } from '../i18n/i18n';
import { proximoIndice } from './Passo';

/**
 * O RELATÓRIO DE CONSEQUÊNCIAS (ordem P179, camada 3; `LADO_E_PEDAGOGIA.md` § 3.3): o que o jogo mostra **depois** da missão do rio, nunca no meio dela (*"nenhuma partida é interrompida por sermão"*).
 * Cinco abas: **o que aconteceu** (a missão, em números do jogo), **três fatos do mundo real** (o mercúrio no Tapajós, o garimpo em terras indígenas, a emergência Yanomami: cada um com a data, a
 * fonte com o endereço e **o que o fato não diz**) e **o que é ficção** (o que o jogo inventou, inclusive que o rio se cura em minutos). A regra é a de sempre: **sátira exagera, fato tem fonte**; só
 * entra aqui o que está lido na fonte (`fichas/fatos-mineracao-amazonia.md`, § 0).
 *
 * Nada disto está no JS de partida (R7): o painel é um pedaço sob demanda (o `Game` o chama por `import()` no clique do chip RELATÓRIO) e o conteúdo são arquivos `public/relatorio/<língua>.json`,
 * pedidos na primeira abertura; língua sem arquivo cai no inglês e depois no português. Módulo independente (G3), no estilo do Arquivo (as mesmas classes). Custo de CPU: zero fora do clique.
 */

/** O que a missão do rio deixou (o `Game` monta no fim dela). */
export interface ResumoDoRio {
  venceu: boolean;
  /** O Draga caiu pela carga plantada (a invasão), e não a tiro. */
  porDentro: boolean;
  geradoresCaidos: number;
  geradoresTotal: number;
  androidesVivos: number;
  androidesTotal: number;
  segundos: number;
}

/**
 * O que a missão do 8 DE JANEIRO deixou (P233): o `Game` monta no fim dela. O Relatório dela vem de `relatorio/janeiro/<língua>.json` e só afirma o que a ficha de fatos (`fichas/fatos-8-de-janeiro.md`)
 * marca como 🟢, com a fonte; **nenhuma pessoa real é nomeada**. A nota diz como a Praça foi esvaziada: expulsar vale mais que eliminar (a força é a última saída).
 */
export interface ResumoDaPraca {
  missao: 'janeiro';
  venceu: boolean;
  /** Por que perdeu (`null` se venceu): um prédio caiu (`predio` é o nome dele) ou o tempo acabou com gente na Praça. */
  causa: 'predio' | 'tempo' | null;
  predio: string | null;
  expulsos: number;
  eliminados: number;
  /** Os androides rebeldes derrubados. */
  rebeldes: number;
  mesasLimpas: number;
  /** Quantos por cento dos que saíram da Praça foram expulsos, e não eliminados (0 a 100). */
  naoLetalPct: number;
  segundos: number;
}

/** O que o Relatório recebe do fim de uma missão: a do rio ou a da Praça. */
export type ResumoDaMissao = ResumoDoRio | ResumoDaPraca;

export interface RotulosDoRelatorio {
  readonly titulo: string;
  readonly sub: string;
  readonly aconteceuNome: string;
  readonly aconteceuLema: string;
  readonly ficcaoNome: string;
  readonly ficcaoLema: string;
  readonly quando: string;
  readonly fonte: string;
  readonly nota: string;
  readonly fechar: string;
}

export type ChavesDasLinhas = 'venceuDentro' | 'venceuTiro' | 'aldeiaSalva' | 'rioVenceu' | 'perdeu' | 'aldeiaCaiu' | 'rioPerdeu' | 'geradores' | 'resistencia' | 'tempo';
export type ChavesDasLinhasJaneiro = 'venceu' | 'perdeuPredio' | 'perdeuTempo' | 'expulsos' | 'eliminados' | 'rebeldes' | 'mesas' | 'naoLetal' | 'tempo';

export interface FatoDoRelatorio {
  readonly id: string;
  readonly nome: string;
  readonly lema: string;
  readonly texto: string;
  readonly quando: string;
  readonly fonte: string;
  /** O endereço da fonte primária (https). */
  readonly link: string;
  /** O que o fato **não** diz: o limite honesto dele. */
  readonly nota: string;
}

/** O arquivo de uma missão: os rótulos, as linhas de "o que aconteceu" (as chaves mudam por missão), os fatos com fonte e o que é ficção. */
export interface ConteudoDoRelatorio<K extends string = ChavesDasLinhas> {
  readonly rotulos: RotulosDoRelatorio;
  readonly linhas: Readonly<Record<K, string>>;
  readonly fatos: readonly FatoDoRelatorio[];
  readonly ficcao: readonly string[];
}

const CHAVES: readonly ChavesDasLinhas[] = ['venceuDentro', 'venceuTiro', 'aldeiaSalva', 'rioVenceu', 'perdeu', 'aldeiaCaiu', 'rioPerdeu', 'geradores', 'resistencia', 'tempo'];
export const CHAVES_JANEIRO: readonly ChavesDasLinhasJaneiro[] = ['venceu', 'perdeuPredio', 'perdeuTempo', 'expulsos', 'eliminados', 'rebeldes', 'mesas', 'naoLetal', 'tempo'];

/** Os arquivos a tentar, em ordem: a língua do jogador, o inglês (a mais lida) e o português (a origem). */
export function arquivosParaTentar(id: IdiomaId): IdiomaId[] {
  return id === 'pt' ? ['pt'] : id === 'en' ? ['en', 'pt'] : [id, 'en', 'pt'];
}

const texto = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** O arquivo veio inteiro e no formato certo (um JSON quebrado ou antigo não pode derrubar a tela). Todo fato leva fonte **com endereço https**: sem ela, o arquivo não vale. */
export function conteudoValido(x: unknown): x is ConteudoDoRelatorio;
export function conteudoValido<K extends string>(x: unknown, chaves: readonly K[]): x is ConteudoDoRelatorio<K>;
export function conteudoValido(x: unknown, chaves: readonly string[] = CHAVES): boolean {
  const c = x as ConteudoDoRelatorio<string> | null;
  if (!c || typeof c !== 'object' || !c.rotulos || !c.linhas || !Array.isArray(c.fatos) || c.fatos.length === 0 || !Array.isArray(c.ficcao) || c.ficcao.length === 0) return false;
  if (!(['titulo', 'sub', 'aconteceuNome', 'aconteceuLema', 'ficcaoNome', 'ficcaoLema', 'quando', 'fonte', 'nota', 'fechar'] as const).every((k) => texto(c.rotulos[k]))) return false;
  if (!chaves.every((k) => texto(c.linhas[k]))) return false;
  if (!c.ficcao.every(texto)) return false;
  return c.fatos.every((f) => texto(f.id) && texto(f.nome) && texto(f.lema) && texto(f.texto) && texto(f.quando) && texto(f.fonte) && texto(f.nota) && texto(f.link) && /^https:\/\//.test(f.link));
}

/** Os minutos e segundos de uma missão (`m:ss`). */
export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(segundos) ? segundos : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const preencher = (modelo: string, v: Record<string, string | number>): string => modelo.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

/** As linhas da aba "o que aconteceu", na língua dos modelos: o desfecho, a aldeia, o rio, o que foi desmantelado, quem sobrou e o tempo. Pura. */
export function linhasDoRelatorio(r: ResumoDoRio, m: Readonly<Record<ChavesDasLinhas, string>>): string[] {
  const v = { n: r.geradoresCaidos, total: r.geradoresTotal, t: formatarTempo(r.segundos) };
  const desfecho = r.venceu ? [r.porDentro ? m.venceuDentro : m.venceuTiro, m.aldeiaSalva, m.rioVenceu] : [m.perdeu, m.aldeiaCaiu, m.rioPerdeu];
  return [
    ...desfecho,
    preencher(m.geradores, v),
    preencher(m.resistencia, { n: r.androidesVivos, total: r.androidesTotal }),
    preencher(m.tempo, v),
  ];
}

/** As linhas da aba "o que aconteceu" da missão do 8 DE JANEIRO: o desfecho e a conta de como a Praça foi esvaziada. Pura. */
export function linhasDaPraca(r: ResumoDaPraca, m: Readonly<Record<ChavesDasLinhasJaneiro, string>>): string[] {
  const desfecho = r.venceu ? m.venceu : r.causa === 'tempo' ? m.perdeuTempo : preencher(m.perdeuPredio, { predio: r.predio ?? '' });
  return [
    desfecho,
    preencher(m.expulsos, { n: r.expulsos }),
    preencher(m.eliminados, { n: r.eliminados }),
    preencher(m.rebeldes, { n: r.rebeldes }),
    preencher(m.mesas, { n: r.mesasLimpas }),
    preencher(m.naoLetal, { n: Math.round(r.naoLetalPct) }),
    preencher(m.tempo, { t: formatarTempo(r.segundos) }),
  ];
}

export class RelatorioPanel {
  private readonly cache = new Map<string, ConteudoDoRelatorio<string>>();
  private modal: HTMLElement | null = null;
  private conteudo: ConteudoDoRelatorio<string> | null = null;
  private resumo: ResumoDaMissao | null = null;
  private indice = 0;
  private abrindo = false;
  private readonly aoTeclar = (e: KeyboardEvent): void => this.teclado(e);

  /** Pede o arquivo da língua (uma vez por língua) e abre. Sem arquivo nenhum, abre o aviso de erro. */
  async abrir(resumo: ResumoDaMissao): Promise<void> {
    if (this.abrindo || this.modal) return;
    this.abrindo = true;
    try {
      this.conteudo = await this.carregar(idiomaAtual(), 'missao' in resumo);
    } finally {
      this.abrindo = false;
    }
    this.resumo = resumo;
    this.indice = 0;
    this.modal = this.montar();
    document.body.append(this.modal);
    document.addEventListener('keydown', this.aoTeclar, true);
    this.modal.querySelector<HTMLElement>('.arq-item[aria-selected="true"]')?.focus();
  }

  fechar(): void {
    document.removeEventListener('keydown', this.aoTeclar, true);
    this.modal?.remove();
    this.modal = null;
  }

  private async carregar(lingua: IdiomaId, daPraca: boolean): Promise<ConteudoDoRelatorio<string> | null> {
    // A missão do 8 DE JANEIRO tem os arquivos dela (`relatorio/janeiro/<língua>.json`); língua sem arquivo cai no inglês e depois no português, como a do rio.
    const pasta = daPraca ? 'janeiro/' : '';
    for (const id of arquivosParaTentar(lingua)) {
      const guardado = this.cache.get(pasta + id);
      if (guardado) return guardado;
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}relatorio/${pasta}${id}.json`);
        if (!res.ok) continue;
        const dado: unknown = await res.json();
        if (!(daPraca ? conteudoValido(dado, CHAVES_JANEIRO) : conteudoValido(dado))) continue;
        const conteudo = dado as ConteudoDoRelatorio<string>;
        this.cache.set(pasta + id, conteudo);
        return conteudo;
      } catch {
        /* sem rede ou JSON quebrado: tenta o próximo da lista */
      }
    }
    return null;
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, conteudo?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    e.className = classe;
    if (conteudo !== undefined) e.textContent = conteudo;
    return e;
  }

  /** As abas, na ordem: o que aconteceu, os fatos e o que é ficção (nome e lema de cada). */
  private abas(c: ConteudoDoRelatorio<string>): { nome: string; lema: string }[] {
    return [{ nome: c.rotulos.aconteceuNome, lema: c.rotulos.aconteceuLema }, ...c.fatos.map((f) => ({ nome: f.nome, lema: f.lema })), { nome: c.rotulos.ficcaoNome, lema: c.rotulos.ficcaoLema }];
  }

  private montar(): HTMLElement {
    const fundo = this.el('div', 'lado-modal arq-modal');
    fundo.addEventListener('click', () => this.fechar());
    const placa = this.el('div', 'lado-placa arq-placa');
    placa.setAttribute('role', 'dialog');
    placa.setAttribute('aria-modal', 'true');
    placa.addEventListener('click', (e) => e.stopPropagation());
    const c = this.conteudo;
    if (!c) {
      fundo.append(this.el('h2', 'lado-titulo', 'RELATÓRIO'), placa);
      placa.append(this.el('p', 'lado-rodape', 'O Relatório não abriu. Feche e tente de novo.'), this.botaoFechar('[ FECHAR ]'));
      return fundo;
    }
    fundo.dataset.i18n = 'nao'; // o texto já vem na língua do jogador (do arquivo dela): o tradutor do DOM não mexe aqui
    fundo.append(this.el('h2', 'lado-titulo', `${c.rotulos.titulo} · ${c.rotulos.sub}`), placa);
    placa.setAttribute('aria-label', c.rotulos.titulo);
    const corpo = this.el('div', 'arq-corpo');
    const lista = this.el('nav', 'arq-lista');
    lista.setAttribute('role', 'tablist');
    lista.setAttribute('aria-orientation', 'vertical');
    this.abas(c).forEach((a, i) => {
      const item = this.el('button', 'arq-item');
      item.type = 'button';
      item.setAttribute('role', 'tab');
      item.dataset.i = String(i);
      item.append(this.el('b', 'arq-nome', a.nome), this.el('span', 'arq-lema', a.lema));
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.marcar(i);
      });
      lista.append(item);
    });
    const ficha = this.el('article', 'arq-ficha');
    ficha.setAttribute('role', 'tabpanel');
    corpo.append(lista, ficha);
    placa.append(corpo, this.botaoFechar(c.rotulos.fechar));
    this.sincronizar(fundo);
    return fundo;
  }

  private botaoFechar(rotulo: string): HTMLElement {
    const botoes = this.el('div', 'lado-botoes');
    const b = this.el('button', 'lado-botao primario', rotulo);
    b.type = 'button';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      this.fechar();
    });
    botoes.append(b);
    return botoes;
  }

  private marcar(i: number): void {
    this.indice = i;
    if (this.modal) this.sincronizar(this.modal);
  }

  /** A aba marcada (barra dourada) e a página dela. */
  private sincronizar(raiz: HTMLElement): void {
    const c = this.conteudo;
    if (!c) return;
    const abas = this.abas(c);
    raiz.querySelectorAll<HTMLElement>('.arq-item').forEach((item, i) => {
      item.setAttribute('aria-selected', String(i === this.indice));
      item.tabIndex = i === this.indice ? 0 : -1;
    });
    const pagina = raiz.querySelector<HTMLElement>('.arq-ficha');
    if (!pagina) return;
    const bloco = (rotulo: string, ...filhos: HTMLElement[]): HTMLElement => {
      const s = this.el('section', 'arq-bloco');
      s.append(this.el('h4', 'arq-rotulo', rotulo), ...filhos);
      return s;
    };
    const lista = (itens: readonly string[]): HTMLElement => {
      const ul = this.el('ul', 'arq-sinais');
      for (const t of itens) ul.append(this.el('li', '', t));
      return ul;
    };
    pagina.replaceChildren(this.el('h3', 'arq-ficha-nome', abas[this.indice]?.nome ?? ''));
    if (this.indice === 0) {
      const r = this.resumo;
      if (r) pagina.append(lista('missao' in r ? linhasDaPraca(r, c.linhas as Readonly<Record<ChavesDasLinhasJaneiro, string>>) : linhasDoRelatorio(r, c.linhas as Readonly<Record<ChavesDasLinhas, string>>)));
    } else if (this.indice === abas.length - 1) {
      pagina.append(lista(c.ficcao));
    } else {
      const f = c.fatos[this.indice - 1];
      if (f) {
        const fonte = this.el('p', 'arq-fonte');
        const a = this.el('a', '', f.fonte);
        a.setAttribute('href', f.link);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        fonte.append(a);
        pagina.append(this.el('p', '', f.texto), bloco(c.rotulos.quando, this.el('p', '', f.quando)), bloco(c.rotulos.fonte, fonte), bloco(c.rotulos.nota, this.el('p', 'arq-satira', f.nota)));
      }
    }
    pagina.scrollTop = 0;
  }

  private teclado(e: KeyboardEvent): void {
    if (!this.modal) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.fechar();
      return;
    }
    const total = this.conteudo ? this.abas(this.conteudo).length : 0;
    const passo = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!passo || total === 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.marcar(proximoIndice(this.indice, total, passo));
    this.modal.querySelector<HTMLElement>(`.arq-item[data-i="${this.indice}"]`)?.focus();
  }
}

let painel: RelatorioPanel | null = null;

/** Abre o Relatório de Consequências da missão que acabou, a do rio ou a da Praça (o painel nasce na primeira vez). */
export function abrirRelatorio(resumo: ResumoDaMissao): Promise<void> {
  painel ??= new RelatorioPanel();
  return painel.abrir(resumo);
}
