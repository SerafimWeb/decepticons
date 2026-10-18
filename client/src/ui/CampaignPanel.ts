import { LIMITE_DE_CAMPANHAS_SALVAS, type CampanhaStore, type ResultadoDoSalvar } from '../core/CampanhaStore';
import type { MapId } from '../environment/Bunker';
import { campanhasDeFabrica, chaveDaCampanha, LIMITES_DA_CAMPANHA, linkDaEtapa, MAPA_NOME, MAPAS, MODO_NOME, objetivoDaEtapa, tituloDaEtapa, type CampanhaSpec } from '../sim/campanha';
import { chaveDoEsquadrao, esquadraoPadrao, type EsquadraoSpec } from '../sim/esquadrao';
import type { GameMode } from '../sim/gameMode';
import {
  adicionarEtapa,
  modosOferecidos,
  moverEtapa,
  novaEtapa,
  podeAdicionar,
  removerEtapa,
  renomear,
  resumoDoEsquadraoDaEtapa,
  tituloDaCampanha,
  trocarAbates,
  trocarEsquadrao,
  trocarMapa,
  trocarModo,
} from './campanhaEditor';
import { mapaLiberado } from '../core/Lancamento';

/** O que a janela precisa do jogo (o `Game.ts` só liga: G3). */
export interface CampaignPanelOptions {
  store: CampanhaStore;
  /** O esquadrão que o Comandante salvou no editor de esquadrão, ou `null` se não há (valem as configurações). */
  esquadraoMeu: () => EsquadraoSpec | null;
  /** `null` = a janela abre; senão o motivo em palavras (online: o servidor manda os inimigos). */
  indisponivel: () => string | null;
  /** Abre o jogo na etapa: o `Game` navega para a busca (`?modo=…&campanha=…&etapa=N`). */
  jogar: (busca: string) => void;
  /** Copia o texto para a área de transferência; `false` se o navegador negou. */
  copiar: (texto: string) => Promise<boolean>;
  /** O endereço do jogo sem a busca (`https://…/jogar/`). */
  base: () => string;
}

type Origem = { tipo: 'fabrica'; i: number } | { tipo: 'salva'; nome: string } | { tipo: 'rascunho' };

const TEXTO_DO_SALVAR: Readonly<Record<ResultadoDoSalvar, string>> = {
  ok: 'Campanha salva neste aparelho.',
  'sem-nome': 'Dê um nome à campanha para salvar.',
  reservado: 'Esse nome é de uma campanha de fábrica: escolha outro.',
  cheio: `Você já guardou ${LIMITE_DE_CAMPANHAS_SALVAS} campanhas: apague uma para salvar outra.`,
  'sem-armazenamento': 'Este navegador não deixou guardar (aba anônima?). Use COPIAR LINK para levar a campanha.',
};

/** Cria um elemento com classe e texto (nada de `innerHTML`: o nome da campanha é texto do jogador). */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function botao(texto: string, className: string, dados: Record<string, string>, titulo?: string): HTMLButtonElement {
  const b = el('button', className, texto);
  b.type = 'button';
  for (const [k, v] of Object.entries(dados)) b.dataset[k] = v;
  if (titulo) b.title = titulo;
  return b;
}

function seletor(dados: Record<string, string>, opcoes: readonly { valor: string; rotulo: string }[], atual: string, rotulo: string): HTMLSelectElement {
  const s = el('select', 'camp-sel');
  s.setAttribute('aria-label', rotulo);
  for (const [k, v] of Object.entries(dados)) s.dataset[k] = v;
  for (const o of opcoes) {
    const op = el('option', '', o.rotulo);
    op.value = o.valor;
    s.append(op);
  }
  s.value = atual;
  return s;
}

/**
 * A janela Campanha (fase 4B, ordens P27/P54: "painel de campanhas: escolher oponentes, missões e tarefas e salvar campanhas personalizadas com nome"): a
 * partir do monitor COMANDO do console, o Comandante escolhe uma campanha de fábrica ou monta a sua (etapa por etapa: mapa, modo, meta e esquadrão), salva com
 * nome neste aparelho, copia o link e joga. O que vale está em `sim/campanha.ts` (o contrato) e `ui/campanhaEditor.ts` (as contas); aqui só se desenha e se
 * liga os botões. **Jogar é abrir o jogo com o link da etapa**: a partida não muda de caminho.
 *
 * Custo: zero no jogo (a janela só existe com a pausa à vista; cada ação refaz no máximo oito linhas).
 */
export class CampaignPanel {
  private readonly root: HTMLElement;
  private readonly fabrica = campanhasDeFabrica();
  private origem: Origem = { tipo: 'fabrica', i: 0 };
  private rascunho: CampanhaSpec = this.fabrica[0]!;
  private mudou = false;
  private aberta = false;
  private msg = '';
  private aviso = false;
  /** Mapa e modo da próxima etapa a acrescentar. */
  private novo: { mapa: MapId; modo: GameMode; esquadrao: 'padrao' | 'meu' } = { mapa: 'arena', modo: 'survival', esquadrao: 'padrao' };

  constructor(private readonly o: CampaignPanelOptions, root: HTMLElement | null = document.getElementById('campanha-modal')) {
    if (!root) {
      this.root = el('div');
      return;
    }
    this.root = root;
    root.addEventListener('click', (e) => this.clique(e));
    root.addEventListener('change', (e) => this.mudanca(e));
    root.addEventListener('input', (e) => this.entrada(e));
  }

  /** O Esc fecha de onde estiver o foco (a janela refaz os botões a cada clique e o foco se perde): o ouvido fica no documento enquanto ela está aberta. */
  private readonly aoTeclar = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    this.fechar();
  };

  get isOpen(): boolean {
    return this.aberta;
  }

  /** Abre a janela. Devolve `false` (e não abre) se a partida não aceita campanha. */
  abrir(): boolean {
    if (!this.root.id || this.o.indisponivel() !== null) return false;
    this.msg = '';
    this.aberta = true;
    document.addEventListener('keydown', this.aoTeclar, true);
    this.root.classList.remove('hidden');
    this.desenhar();
    this.root.querySelector<HTMLElement>('.camp-jogar')?.focus();
    return true;
  }

  fechar(): void {
    document.removeEventListener('keydown', this.aoTeclar, true);
    this.aberta = false;
    this.root.classList.add('hidden');
  }

  private get editavel(): boolean {
    return this.origem.tipo !== 'fabrica';
  }

  // ─── O que o Comandante escolhe ────────────────────────────────────────────────

  private escolher(origem: Origem): void {
    if (this.mudou && this.editavel && !confirm('Descartar o que você mudou nesta campanha sem salvar?')) return;
    this.origem = origem;
    this.mudou = false;
    this.msg = '';
    if (origem.tipo === 'fabrica') this.rascunho = this.fabrica[origem.i]!;
    else if (origem.tipo === 'salva') this.rascunho = this.o.store.list().find((c) => c.nome === origem.nome) ?? this.fabrica[0]!;
    else this.rascunho = { v: 1, etapas: [novaEtapa(this.escolhaDeEsquadrao())] };
    this.desenhar();
  }

  private escolhaDeEsquadrao(): EsquadraoSpec {
    return this.novo.esquadrao === 'meu' ? (this.o.esquadraoMeu() ?? esquadraoPadrao()) : esquadraoPadrao();
  }

  private aplicar(proxima: CampanhaSpec): void {
    if (proxima === this.rascunho) return;
    this.rascunho = proxima;
    this.mudou = true;
    this.msg = '';
    this.desenhar();
  }

  private editarCopia(): void {
    const copia = structuredClone(this.rascunho);
    delete copia.nome;
    this.origem = { tipo: 'rascunho' };
    this.rascunho = copia;
    this.mudou = true;
    this.avisar('Cópia para editar. Dê um nome e salve.', false);
  }

  private avisar(texto: string, alerta: boolean): void {
    this.msg = texto;
    this.aviso = alerta;
    this.desenhar();
  }

  // ─── Eventos ───────────────────────────────────────────────────────────────────

  private clique(e: Event): void {
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-acao]');
    if (!alvo) return;
    const acao = alvo.dataset.acao;
    const i = Number(alvo.dataset.i);
    switch (acao) {
      case 'fechar':
        return this.fechar();
      case 'fabrica':
        return this.escolher({ tipo: 'fabrica', i });
      case 'salva':
        return this.escolher({ tipo: 'salva', nome: alvo.dataset.nome ?? '' });
      case 'nova':
        return this.escolher({ tipo: 'rascunho' });
      case 'copia':
        return this.editarCopia();
      case 'jogar':
        return this.jogar(1);
      case 'daqui':
        return this.jogar(i + 1);
      case 'sobe':
        return this.aplicar(moverEtapa(this.rascunho, i, -1));
      case 'desce':
        return this.aplicar(moverEtapa(this.rascunho, i, 1));
      case 'tira':
        return this.aplicar(removerEtapa(this.rascunho, i));
      case 'mais':
        return this.aplicar(adicionarEtapa(this.rascunho, this.etapaNova()));
      case 'salvar':
        return this.salvar();
      case 'apagar':
        return this.apagar();
      case 'link':
        return void this.copiarLink();
    }
  }

  private mudanca(e: Event): void {
    const s = e.target as HTMLInputElement | HTMLSelectElement;
    const i = Number(s.dataset.i);
    switch (s.dataset.campo) {
      case 'mapa':
        return this.aplicar(trocarMapa(this.rascunho, i, s.value as MapId));
      case 'modo':
        return this.aplicar(trocarModo(this.rascunho, i, s.value as GameMode));
      case 'abates':
        return this.aplicar(trocarAbates(this.rascunho, i, Number(s.value)));
      case 'esquadrao':
        if (s.value === 'outro') return; // o que a etapa já tinha: nada a trocar
        return this.aplicar(trocarEsquadrao(this.rascunho, i, s.value === 'meu' ? (this.o.esquadraoMeu() ?? esquadraoPadrao()) : esquadraoPadrao()));
      case 'novo-mapa':
        this.novo.mapa = s.value as MapId;
        if (!modosOferecidos(this.novo.mapa).includes(this.novo.modo)) this.novo.modo = 'deathmatch';
        return this.desenhar();
      case 'novo-modo':
        this.novo.modo = s.value as GameMode;
        return;
      case 'novo-esquadrao':
        this.novo.esquadrao = s.value === 'meu' ? 'meu' : 'padrao';
        return;
    }
  }

  /** O nome vale a cada tecla, sem refazer a janela (refazê-la tiraria o foco do campo). */
  private entrada(e: Event): void {
    const campo = e.target as HTMLInputElement;
    if (campo.dataset.campo !== 'nome') return;
    this.rascunho = renomear(this.rascunho, campo.value);
    this.mudou = true;
  }

  private etapaNova() {
    return novaEtapa(this.escolhaDeEsquadrao(), this.novo.mapa, this.novo.modo);
  }

  private jogar(n: number): void {
    const busca = linkDaEtapa(this.rascunho, n);
    if (busca) this.o.jogar(busca);
  }

  private salvar(): void {
    const r = this.o.store.save(this.rascunho);
    if (r === 'ok') {
      this.origem = { tipo: 'salva', nome: this.rascunho.nome ?? '' };
      this.mudou = false;
    }
    this.avisar(TEXTO_DO_SALVAR[r], r !== 'ok');
  }

  private apagar(): void {
    if (this.origem.tipo !== 'salva') return;
    if (!confirm(`Apagar a campanha ${this.origem.nome}?`)) return;
    this.o.store.remove(this.origem.nome);
    this.origem = { tipo: 'fabrica', i: 0 };
    this.rascunho = this.fabrica[0]!;
    this.mudou = false;
    this.avisar('Campanha apagada.', false);
  }

  private async copiarLink(): Promise<void> {
    const busca = linkDaEtapa(this.rascunho, 1);
    if (!busca) return;
    const ok = await this.o.copiar(this.o.base() + busca);
    this.avisar(ok ? 'Link copiado: quem abrir joga a campanha desde a primeira etapa.' : 'O navegador não deixou copiar. Selecione o endereço da janela do jogo depois de jogar a primeira etapa.', !ok);
  }

  // ─── O desenho ─────────────────────────────────────────────────────────────────

  private desenhar(): void {
    if (!this.root.id) return;
    const caixa = el('div', 'squad-box camp-box');
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-modal', 'true');
    caixa.setAttribute('aria-label', 'Campanhas');

    const cab = el('header', 'squad-head');
    cab.append(el('h2', '', 'CAMPANHAS'), el('span', 'squad-sub', 'etapas em sequência: onde, como, contra quem e o que vence'), botao('×', 'squad-fechar', { acao: 'fechar' }, 'Fechar (Esc)'));

    const corpo = el('div', 'camp-corpo');
    corpo.append(this.desenharLista(), this.desenharDetalhe());

    caixa.append(cab, corpo, this.desenharPe());
    this.root.replaceChildren(caixa);
  }

  private desenharLista(): HTMLElement {
    const nav = el('nav', 'camp-lista');
    nav.setAttribute('aria-label', 'Campanhas');
    nav.append(el('h3', '', 'DE FÁBRICA'));
    this.fabrica.forEach((c, i) => {
      const ativa = this.origem.tipo === 'fabrica' && this.origem.i === i;
      const b = botao('', `camp-item${ativa ? ' sel' : ''}`, { acao: 'fabrica', i: String(i) });
      b.append(el('b', '', tituloDaCampanha(c)), el('small', '', `${c.etapas.length} ${c.etapas.length === 1 ? 'etapa' : 'etapas'}`));
      nav.append(b);
    });
    nav.append(el('h3', '', 'SUAS CAMPANHAS'));
    const salvas = this.o.store.list();
    if (!salvas.length) nav.append(el('p', 'squad-vazio', 'Nenhuma ainda. Monte uma e salve com um nome.'));
    for (const c of salvas) {
      const ativa = this.origem.tipo === 'salva' && this.origem.nome === c.nome;
      const b = botao('', `camp-item${ativa ? ' sel' : ''}`, { acao: 'salva', nome: c.nome ?? '' });
      b.append(el('b', '', tituloDaCampanha(c)), el('small', '', `${c.etapas.length} ${c.etapas.length === 1 ? 'etapa' : 'etapas'}`));
      nav.append(b);
    }
    nav.append(botao('[ + NOVA CAMPANHA ]', `btn-terminal camp-nova${this.origem.tipo === 'rascunho' ? ' sel' : ''}`, { acao: 'nova' }));
    return nav;
  }

  private desenharDetalhe(): HTMLElement {
    const sec = el('section', 'camp-detalhe');
    const topo = el('div', 'camp-topo');
    if (this.editavel) {
      const nome = el('input', 'camp-nome');
      nome.type = 'text';
      nome.placeholder = 'nome da campanha';
      nome.maxLength = 16;
      nome.value = this.rascunho.nome ?? '';
      nome.dataset.campo = 'nome';
      nome.setAttribute('aria-label', 'Nome da campanha');
      topo.append(nome);
    } else {
      topo.append(el('h3', '', tituloDaCampanha(this.rascunho)));
    }
    topo.append(el('span', 'camp-conta', `${this.rascunho.etapas.length}/${LIMITES_DA_CAMPANHA.etapas} etapas`));
    sec.append(topo);

    const lista = el('ol', 'camp-etapas');
    this.rascunho.etapas.forEach((e, i) => lista.append(this.desenharEtapa(e, i)));
    sec.append(lista);

    if (this.editavel) sec.append(this.desenharAcrescentar());
    else sec.append(el('p', 'squad-dica', 'Campanha de fábrica: dá para jogar, mas não para mudar. Use EDITAR UMA CÓPIA para montar a sua a partir dela.'));
    return sec;
  }

  private desenharEtapa(e: CampanhaSpec['etapas'][number], i: number): HTMLElement {
    const li = el('li', 'camp-etapa');
    li.append(el('span', 'camp-num', String(i + 1)));
    const info = el('div', 'camp-info');
    info.append(el('b', '', tituloDaEtapa(e)), el('small', '', `${objetivoDaEtapa(e)} · ${resumoDoEsquadraoDaEtapa(e)}`));
    li.append(info);
    if (this.editavel) {
      const ed = el('div', 'camp-ed');
      ed.append(
        seletor({ campo: 'mapa', i: String(i) }, MAPAS.filter((m) => m === e.mapa || mapaLiberado(m)).map((m) => ({ valor: m, rotulo: MAPA_NOME[m] })), e.mapa, `Mapa da etapa ${i + 1}`),
        seletor({ campo: 'modo', i: String(i) }, modosOferecidos(e.mapa).map((m) => ({ valor: m, rotulo: MODO_NOME[m] })), e.modo, `Modo da etapa ${i + 1}`),
      );
      if (e.modo === 'deathmatch') {
        const n = el('input', 'camp-meta');
        n.type = 'number';
        n.min = String(LIMITES_DA_CAMPANHA.abatesMin);
        n.max = String(LIMITES_DA_CAMPANHA.abatesMax);
        n.value = String(e.abates ?? LIMITES_DA_CAMPANHA.abatesPadrao);
        n.dataset.campo = 'abates';
        n.dataset.i = String(i);
        n.title = 'Abates que vencem a etapa';
        n.setAttribute('aria-label', `Meta de abates da etapa ${i + 1}`);
        ed.append(n);
      }
      const chave = chaveDoEsquadrao(e.esquadrao);
      const meu = this.o.esquadraoMeu();
      const atual = chave === chaveDoEsquadrao(esquadraoPadrao()) ? 'padrao' : meu && chave === chaveDoEsquadrao(meu) ? 'meu' : 'outro';
      ed.append(
        seletor(
          { campo: 'esquadrao', i: String(i) },
          [
            { valor: 'padrao', rotulo: 'ESQUADRÃO PADRÃO' },
            { valor: 'meu', rotulo: 'O MEU ESQUADRÃO' },
            ...(atual === 'outro' ? [{ valor: 'outro', rotulo: 'ESQUADRÃO DA ETAPA' }] : []),
          ],
          atual,
          `Esquadrão da etapa ${i + 1}`,
        ),
      );
      li.append(ed);
    }
    const acoes = el('div', 'camp-acoes');
    acoes.append(botao('▶', 'camp-daqui', { acao: 'daqui', i: String(i) }, `Jogar a campanha a partir da etapa ${i + 1}`));
    if (this.editavel) {
      acoes.append(
        botao('▲', 'squad-x', { acao: 'sobe', i: String(i) }, 'Subir'),
        botao('▼', 'squad-x', { acao: 'desce', i: String(i) }, 'Descer'),
        botao('✕', 'squad-x', { acao: 'tira', i: String(i) }, 'Tirar a etapa'),
      );
    }
    li.append(acoes);
    return li;
  }

  private desenharAcrescentar(): HTMLElement {
    const barra = el('div', 'camp-mais');
    barra.append(
      el('span', 'squad-presets-rot', 'ACRESCENTAR'),
      seletor({ campo: 'novo-mapa' }, MAPAS.filter((m) => m === this.novo.mapa || mapaLiberado(m)).map((m) => ({ valor: m, rotulo: MAPA_NOME[m] })), this.novo.mapa, 'Mapa da nova etapa'),
      seletor({ campo: 'novo-modo' }, modosOferecidos(this.novo.mapa).map((m) => ({ valor: m, rotulo: MODO_NOME[m] })), this.novo.modo, 'Modo da nova etapa'),
      seletor({ campo: 'novo-esquadrao' }, [{ valor: 'padrao', rotulo: 'ESQUADRÃO PADRÃO' }, { valor: 'meu', rotulo: 'O MEU ESQUADRÃO' }], this.novo.esquadrao, 'Esquadrão da nova etapa'),
    );
    const mais = botao('[ + ETAPA ]', 'squad-mais', { acao: 'mais' }, podeAdicionar(this.rascunho) ? 'Acrescentar no fim' : `O teto é ${LIMITES_DA_CAMPANHA.etapas} etapas`);
    if (!podeAdicionar(this.rascunho)) mais.classList.add('off');
    barra.append(mais);
    return barra;
  }

  private desenharPe(): HTMLElement {
    const pe = el('footer', 'squad-pe');
    pe.append(el('p', `squad-msg${this.aviso ? ' aviso' : ''}`, this.msg || this.dicaDoPe()));
    const acoes = el('div', 'squad-acoes');
    acoes.append(botao('[ JOGAR CAMPANHA ]', 'btn-terminal squad-salvar camp-jogar', { acao: 'jogar' }, 'Abre a etapa 1; o jogo recarrega com ela'));
    if (this.editavel) {
      acoes.append(botao('[ SALVAR ]', 'btn-terminal', { acao: 'salvar' }, 'Guarda neste aparelho, com o nome acima'));
      if (this.origem.tipo === 'salva') acoes.append(botao('[ APAGAR ]', 'btn-terminal', { acao: 'apagar' }));
    } else {
      acoes.append(botao('[ EDITAR UMA CÓPIA ]', 'btn-terminal', { acao: 'copia' }, 'Abre uma cópia que você pode mudar e salvar com outro nome'));
    }
    acoes.append(botao('[ COPIAR LINK ]', 'btn-terminal', { acao: 'link' }, 'O endereço que abre esta campanha na etapa 1, em qualquer aparelho'), botao('[ FECHAR ]', 'btn-terminal', { acao: 'fechar' }));
    pe.append(acoes);
    return pe;
  }

  private dicaDoPe(): string {
    const chave = chaveDaCampanha(this.rascunho);
    return `${this.rascunho.etapas.length} ${this.rascunho.etapas.length === 1 ? 'etapa' : 'etapas'} · o link leva ${chave.length} letras`;
  }
}
