import { idiomaAtual, type IdiomaId } from '../i18n/i18n';
import { proximoIndice } from './Passo';

/**
 * O Arquivo (ordem P179, camada 2; `LADO_E_PEDAGOGIA.md` § 4): a tela **opcional** que ensina o que é o fascismo e como ele se manifesta, a rede de mentiras, quem lucra, a manutenção do
 * medo, a mídia comprada e (sátira declarada) as incoerências. O Comandante: mostrar o posicionamento do jogo **sutil, elegante e pedagogicamente**: nenhuma partida é interrompida por sermão,
 * o Arquivo mora na pausa e quem quer aprender abre. Cada ficha tem **o que é, como aparece, como se defender e a fonte** (a regra "sátira exagera, fato é fato": `fichas/fascismo-e-propaganda.md`).
 *
 * Nada disto está no JS de partida (R7, `scripts/orcamentoDeJs.mjs`: o orçamento de partida está no limite, e o Arquivo é opcional): o **painel** é um pedaço sob demanda (o `Game` o chama
 * por `import()` no clique do chip) e o **conteúdo** são arquivos `public/arquivo/<língua>.json`, um por língua, pedidos na primeira abertura; língua sem arquivo cai no inglês e depois
 * no português. Módulo independente (G3). Estilo da placa dos jogos antigos (`REFERENCIA_VISUAL.md` § 8). Custo de CPU: zero fora do clique.
 */

export interface RotulosDoArquivo {
  readonly titulo: string;
  readonly sub: string;
  readonly oQueE: string;
  readonly comoAparece: string;
  readonly comoSeDefender: string;
  readonly fontes: string;
  readonly satira: string;
  readonly fechar: string;
}

export interface FichaDoArquivo {
  readonly id: string;
  readonly nome: string;
  readonly lema: string;
  /** Sátira declarada: o jogo avisa na ficha que nada ali afirma fato. */
  readonly satira?: boolean;
  readonly oQueE: string;
  readonly comoAparece: readonly string[];
  readonly comoSeDefender: string;
  readonly fonte: string;
}

export interface ConteudoDoArquivo {
  readonly rotulos: RotulosDoArquivo;
  readonly fichas: readonly FichaDoArquivo[];
}

/** Os arquivos a tentar, em ordem: a língua do jogador, o inglês (a mais lida) e o português (a origem). */
export function arquivosParaTentar(id: IdiomaId): IdiomaId[] {
  return id === 'pt' ? ['pt'] : id === 'en' ? ['en', 'pt'] : [id, 'en', 'pt'];
}

const texto = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** O arquivo veio inteiro e no formato certo (um JSON quebrado ou antigo não pode derrubar a tela). */
export function conteudoValido(x: unknown): x is ConteudoDoArquivo {
  const c = x as ConteudoDoArquivo | null;
  if (!c || typeof c !== 'object' || !c.rotulos || !Array.isArray(c.fichas) || c.fichas.length === 0) return false;
  if (!(['titulo', 'sub', 'oQueE', 'comoAparece', 'comoSeDefender', 'fontes', 'satira', 'fechar'] as const).every((k) => texto(c.rotulos[k]))) return false;
  return c.fichas.every(
    (f) => texto(f.id) && texto(f.nome) && texto(f.lema) && texto(f.oQueE) && texto(f.comoSeDefender) && texto(f.fonte) && Array.isArray(f.comoAparece) && f.comoAparece.length > 0 && f.comoAparece.every(texto),
  );
}

export class ArquivoPanel {
  private readonly cache = new Map<IdiomaId, ConteudoDoArquivo>();
  private modal: HTMLElement | null = null;
  private conteudo: ConteudoDoArquivo | null = null;
  private indice = 0;
  private abrindo = false;
  /** As setas, Enter e Esc valem com o painel aberto em qualquer foco (a ficha se refaz e o foco passa de um item a outro). */
  private readonly aoTeclar = (e: KeyboardEvent): void => this.teclado(e);

  /** Pede o arquivo da língua (uma vez por língua) e abre. Sem arquivo nenhum, abre o aviso de erro. */
  async abrir(): Promise<void> {
    if (this.abrindo || this.modal) return;
    this.abrindo = true;
    try {
      this.conteudo = await this.carregar(idiomaAtual());
    } finally {
      this.abrindo = false;
    }
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

  private async carregar(lingua: IdiomaId): Promise<ConteudoDoArquivo | null> {
    for (const id of arquivosParaTentar(lingua)) {
      const guardado = this.cache.get(id);
      if (guardado) return guardado;
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}arquivo/${id}.json`);
        if (!res.ok) continue;
        const dado: unknown = await res.json();
        if (!conteudoValido(dado)) continue;
        this.cache.set(id, dado);
        return dado;
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

  private montar(): HTMLElement {
    const fundo = this.el('div', 'lado-modal arq-modal');
    fundo.addEventListener('click', () => this.fechar());
    const placa = this.el('div', 'lado-placa arq-placa');
    placa.setAttribute('role', 'dialog');
    placa.setAttribute('aria-modal', 'true');
    placa.addEventListener('click', (e) => e.stopPropagation());
    const c = this.conteudo;
    if (!c) {
      fundo.append(this.el('h2', 'lado-titulo', 'ARQUIVO'), placa);
      placa.append(this.el('p', 'lado-rodape', 'O Arquivo não abriu. Feche e tente de novo.'), this.botaoFechar('[ FECHAR ]'));
      return fundo;
    }
    fundo.dataset.i18n = 'nao'; // o texto já vem na língua do jogador (do arquivo dela): o tradutor do DOM não mexe aqui
    fundo.append(this.el('h2', 'lado-titulo', `${c.rotulos.titulo} · ${c.rotulos.sub}`), placa);
    placa.setAttribute('aria-label', c.rotulos.titulo);
    const corpo = this.el('div', 'arq-corpo');
    const lista = this.el('nav', 'arq-lista');
    lista.setAttribute('role', 'tablist');
    lista.setAttribute('aria-orientation', 'vertical');
    c.fichas.forEach((f, i) => {
      const item = this.el('button', 'arq-item');
      item.type = 'button';
      item.setAttribute('role', 'tab');
      item.dataset.i = String(i);
      item.append(this.el('b', 'arq-nome', f.nome), this.el('span', 'arq-lema', f.lema));
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

  /** A linha marcada (barra dourada) e a ficha dela. */
  private sincronizar(raiz: HTMLElement): void {
    const c = this.conteudo;
    if (!c) return;
    raiz.querySelectorAll<HTMLElement>('.arq-item').forEach((item, i) => {
      item.setAttribute('aria-selected', String(i === this.indice));
      item.tabIndex = i === this.indice ? 0 : -1;
    });
    const ficha = raiz.querySelector<HTMLElement>('.arq-ficha');
    const f = c.fichas[this.indice];
    if (!ficha || !f) return;
    const r = c.rotulos;
    const bloco = (rotulo: string, ...filhos: HTMLElement[]): HTMLElement => {
      const s = this.el('section', 'arq-bloco');
      s.append(this.el('h4', 'arq-rotulo', rotulo), ...filhos);
      return s;
    };
    const aparece = this.el('ul', 'arq-sinais');
    for (const s of f.comoAparece) aparece.append(this.el('li', '', s));
    const fonte = this.el('p', 'arq-fonte');
    fonte.append(this.el('b', '', `${r.fontes}: `), document.createTextNode(f.fonte));
    ficha.replaceChildren(this.el('h3', 'arq-ficha-nome', f.nome));
    if (f.satira) ficha.append(this.el('p', 'arq-satira', r.satira));
    ficha.append(bloco(r.oQueE, this.el('p', '', f.oQueE)), bloco(r.comoAparece, aparece), bloco(r.comoSeDefender, this.el('p', '', f.comoSeDefender)), fonte);
    ficha.scrollTop = 0;
  }

  private teclado(e: KeyboardEvent): void {
    if (!this.modal) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.fechar();
      return;
    }
    const total = this.conteudo?.fichas.length ?? 0;
    const passo = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!passo || total === 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.marcar(proximoIndice(this.indice, total, passo));
    this.modal.querySelector<HTMLElement>(`.arq-item[data-i="${this.indice}"]`)?.focus();
  }
}

let painel: ArquivoPanel | null = null;

/** Abre o Arquivo (o painel nasce na primeira vez). */
export function abrirArquivo(): Promise<void> {
  painel ??= new ArquivoPanel();
  return painel.abrir();
}
