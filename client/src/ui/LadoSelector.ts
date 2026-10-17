/**
 * "De que lado você joga?" (ordem P179, 17/10; `LADO_E_PEDAGOGIA.md`). O Comandante: perguntar se o jogador quer jogar pelos **aliados anti-imperialistas** (justiça social, redistribuição
 * das riquezas) ou fazer a **campanha do Consórcio** (a extração, o desmatamento, a hegemonia); e mostrar o posicionamento do jogo **sutil, elegante e pedagogicamente**.
 *
 * **Camada 1** (o que está no jogo hoje): a escolha é guardada (`cybermech.lado.v1`), aparece no selo LADO do console e o painel do Consórcio mostra **o discurso e o custo** (a sátira
 * dos eufemismos). **Ainda não muda o combate nem os textos das missões**: a campanha do Consórcio e o Relatório de Consequências são as camadas 3 e 4 (`STATUS_REAL.md`: DEMO).
 * **Nunca é uma porta** (P133): o selo fica no console completo e na pausa; o primeiro acesso não pergunta nada. O padrão é a Aliança.
 *
 * O estilo é o da **placa** das interfaces de jogos antigos que o Comandante mandou (`REFERENCIA_VISUAL.md` § 8): chapa com rebites, linha selecionada em barra dourada com chevron, a
 * outra em ciano frio, o título fora. Módulo independente (G3): só o `Game` o cria. Custo de CPU: zero fora do clique.
 */

export type LadoId = 'alianca' | 'consorcio';
export const LADO_KEY = 'cybermech.lado.v1';

/** O mínimo do `Storage` que a escolha usa (o `localStorage` serve; o teste entrega um falso). */
export interface Memoria {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

export interface LadoInfo {
  readonly id: LadoId;
  readonly nome: string;
  readonly quem: string;
  readonly busca: string;
}

/** As duas respostas, na ordem da tela (a Aliança é o padrão). */
export const LADOS: readonly LadoInfo[] = [
  { id: 'alianca', nome: 'ALIANÇA', quem: 'Os povos e a soberania', busca: 'Justiça social, redistribuição das riquezas e proteger quem a opressão ameaça.' },
  { id: 'consorcio', nome: 'CONSÓRCIO', quem: 'As elites e a extração', busca: 'A campanha do lucro: desmatamento, hegemonia e o medo como governo.' },
];

export const TEXTO_PERGUNTA = 'DE QUE LADO VOCÊ JOGA?';
export const TEXTO_RODAPE = 'Você muda quando quiser, no selo LADO do console.';
export const TEXTO_CONFIRMAR = '[ CONFIRMAR ]';
export const TEXTO_FECHAR = '[ FECHAR ]';
export const TEXTO_CUSTO_TITULO = 'O DISCURSO E O CUSTO';
export const TEXTO_CUSTO_RODAPE = 'Sátira dos arquétipos do Consórcio. O jogo mostra o custo no fim de cada missão (em construção): por ora a partida segue igual.';
export const TEXTO_SEGUIR = '[ SEGUIR COMO CONSÓRCIO ]';
export const TEXTO_VOLTAR = '[ VOLTAR ]';
export const TEXTO_ELES_DIZEM = 'ELES DIZEM';
export const TEXTO_SIGNIFICA = 'NA PRÁTICA';
export const SELO_SEM_LADO = 'ESCOLHA O LADO ▸';

/** O que o Consórcio diz e o que isso significa (sátira dos eufemismos; sem afirmação de fato: o fato entra só com fonte, `LADO_E_PEDAGOGIA.md` § 5). */
export const CUSTO_DO_CONSORCIO: readonly (readonly [string, string])[] = [
  ['"Desenvolvimento"', 'A mina cresce; o rio vira esgoto e o povo é empurrado para fora.'],
  ['"Segurança jurídica"', 'A lei vale para quem pode comprá-la.'],
  ['"Ordem"', 'O inimigo é inventado para o medo governar.'],
  ['"Notícia"', 'A Rede Verdade Plena repete o que o Consórcio paga.'],
];

export const ehLado = (v: unknown): v is LadoId => v === 'alianca' || v === 'consorcio';

/** A escolha guardada, ou `null` (ainda não escolheu). Nunca lança. */
export function lerLado(memoria: Memoria | null): LadoId | null {
  try {
    const v = memoria?.getItem(LADO_KEY);
    return ehLado(v) ? v : null;
  } catch {
    return null;
  }
}

export function gravarLado(memoria: Memoria | null, lado: LadoId): void {
  try {
    memoria?.setItem(LADO_KEY, lado);
  } catch {
    /* armazenamento bloqueado: a escolha vale só nesta aba */
  }
}

/** O texto do selo do console. */
export function rotuloDoSelo(lado: LadoId | null): string {
  return lado === null ? SELO_SEM_LADO : `LADO: ${LADOS.find((l) => l.id === lado)!.nome}`;
}

export class LadoSelector {
  private lado: LadoId | null;
  private readonly selo: HTMLElement | null;
  private modal: HTMLElement | null = null;
  private marcado: LadoId = 'alianca';
  /** As setas, Enter e Esc valem com o painel aberto **em qualquer foco**: o painel se refaz (do custo de volta à pergunta) e o foco se perde com o botão que sumiu. */
  private readonly aoTeclar = (e: KeyboardEvent): void => this.teclado(e);
  /** O jogo foi avisado de uma escolha nova (a campanha do Consórcio, no futuro, lê o lado por aqui). */
  onMudou?: (lado: LadoId) => void;

  constructor(
    private readonly memoria: Memoria | null,
    seloId = 'cc-lado',
  ) {
    this.lado = lerLado(memoria);
    this.selo = document.getElementById(seloId);
    this.atualizarSelo();
    this.selo?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.abrir();
    });
  }

  get atual(): LadoId | null {
    return this.lado;
  }

  /** Abre a pergunta (a Aliança marcada, ou o lado de agora). */
  abrir(): void {
    this.fechar();
    this.marcado = this.lado ?? 'alianca';
    this.modal = this.montar();
    document.body.append(this.modal);
    document.addEventListener('keydown', this.aoTeclar, true);
    this.modal.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }

  fechar(): void {
    document.removeEventListener('keydown', this.aoTeclar, true);
    this.modal?.remove();
    this.modal = null;
  }

  private escolher(lado: LadoId): void {
    this.lado = lado;
    gravarLado(this.memoria, lado);
    this.atualizarSelo();
    this.fechar();
    this.onMudou?.(lado);
  }

  private atualizarSelo(): void {
    if (!this.selo) return;
    this.selo.textContent = rotuloDoSelo(this.lado);
    this.selo.classList.toggle('sem-lado', this.lado === null);
    this.selo.hidden = false;
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, texto?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  private botao(texto: string, classe: string, acao: () => void): HTMLButtonElement {
    const b = this.el('button', `lado-botao ${classe}`, texto);
    b.type = 'button';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      acao();
    });
    return b;
  }

  /** O painel: a pergunta, as duas linhas (a marcada em barra dourada) e os botões. */
  private montar(): HTMLElement {
    const fundo = this.el('div', 'lado-modal');
    fundo.addEventListener('click', () => this.fechar());
    const placa = this.el('div', 'lado-placa');
    placa.setAttribute('role', 'dialog');
    placa.setAttribute('aria-modal', 'true');
    placa.addEventListener('click', (e) => e.stopPropagation());
    this.conteudoDaPergunta(placa);
    fundo.append(this.el('h2', 'lado-titulo', TEXTO_PERGUNTA), placa);
    return fundo;
  }

  private conteudoDaPergunta(placa: HTMLElement): void {
    placa.replaceChildren();
    const titulo = this.modal?.querySelector<HTMLElement>('.lado-titulo');
    if (titulo) titulo.textContent = TEXTO_PERGUNTA;
    const grupo = this.el('div', 'lado-linhas');
    grupo.setAttribute('role', 'radiogroup');
    for (const info of LADOS) {
      const linha = this.el('button', 'lado-linha');
      linha.type = 'button';
      linha.dataset.lado = info.id;
      linha.setAttribute('role', 'radio');
      linha.setAttribute('aria-checked', String(info.id === this.marcado));
      linha.append(this.el('b', 'lado-nome', info.nome), this.el('span', 'lado-quem', info.quem), this.el('span', 'lado-busca', info.busca));
      linha.addEventListener('click', (e) => {
        e.stopPropagation();
        this.marcar(info.id);
      });
      grupo.append(linha);
    }
    const botoes = this.el('div', 'lado-botoes');
    botoes.append(this.botao(TEXTO_CONFIRMAR, 'primario', () => this.confirmar()), this.botao(TEXTO_FECHAR, '', () => this.fechar()));
    placa.append(grupo, this.el('p', 'lado-rodape', TEXTO_RODAPE), botoes);
    this.sincronizarLinhas();
    // Voltar do painel do custo refaz as linhas: devolve o foco à marcada.
    placa.querySelector<HTMLElement>(`[data-lado="${this.marcado}"]`)?.focus();
  }

  private marcar(lado: LadoId): void {
    this.marcado = lado;
    this.sincronizarLinhas();
  }

  private sincronizarLinhas(): void {
    for (const linha of this.modal?.querySelectorAll<HTMLElement>('.lado-linha') ?? []) {
      const ligada = linha.dataset.lado === this.marcado;
      linha.setAttribute('aria-checked', String(ligada));
      linha.tabIndex = ligada ? 0 : -1;
    }
  }

  /** A Aliança confirma na hora; o Consórcio mostra antes o discurso e o custo (a sátira), e só então vale. */
  private confirmar(): void {
    if (this.marcado === 'alianca') {
      this.escolher('alianca');
      return;
    }
    const placa = this.modal?.querySelector<HTMLElement>('.lado-placa');
    if (!placa) return;
    placa.replaceChildren();
    const tabela = this.el('div', 'lado-custo');
    tabela.append(this.el('b', 'lado-custo-cab', TEXTO_ELES_DIZEM), this.el('b', 'lado-custo-cab', TEXTO_SIGNIFICA));
    for (const [diz, significa] of CUSTO_DO_CONSORCIO) tabela.append(this.el('span', 'lado-diz', diz), this.el('span', 'lado-significa', significa));
    const botoes = this.el('div', 'lado-botoes');
    botoes.append(this.botao(TEXTO_SEGUIR, 'primario', () => this.escolher('consorcio')), this.botao(TEXTO_VOLTAR, '', () => this.conteudoDaPergunta(placa)));
    const titulo = this.modal?.querySelector<HTMLElement>('.lado-titulo');
    if (titulo) titulo.textContent = TEXTO_CUSTO_TITULO;
    placa.append(tabela, this.el('p', 'lado-rodape', TEXTO_CUSTO_RODAPE), botoes);
    placa.querySelector<HTMLElement>('.primario')?.focus();
  }

  private teclado(e: KeyboardEvent): void {
    if (!this.modal) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.fechar();
      return;
    }
    // Só a tela da pergunta tem linhas; a do custo tem os botões.
    if (!this.modal.querySelector('.lado-linha')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const i = LADOS.findIndex((l) => l.id === this.marcado);
      const j = (i + (e.key === 'ArrowDown' ? 1 : LADOS.length - 1)) % LADOS.length;
      e.preventDefault();
      this.marcar(LADOS[j]!.id);
      this.modal.querySelector<HTMLElement>(`[data-lado="${LADOS[j]!.id}"]`)?.focus();
    } else if (e.key === 'Enter' && (document.activeElement as HTMLElement | null)?.classList.contains('lado-linha')) {
      e.preventDefault();
      this.confirmar();
    }
  }
}
