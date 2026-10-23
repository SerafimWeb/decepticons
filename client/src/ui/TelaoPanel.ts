import { ARQUIVOS_DE_TELAO, TELOES_DA_ARENA, type IdDeTelao, type TelaoItem } from '../../../shared/telao';
import type { AdminCliente } from '../net/admin';

/** Um nome de tela para o painel (não aparece no jogo): só para o Comandante saber qual fachada é qual. */
const NOME_DA_TELA: Readonly<Record<IdDeTelao, string>> = {
  'arena:telao-1': 'Telão 1 · fachada leste',
  'arena:telao-2': 'Telão 2 · fachada norte',
};

/**
 * O PAINEL DOS TELÕES (P246, `GAME_DESIGN.md` § HORIZONTE): escolhe qual vídeo de `ARQUIVOS_DE_TELAO` toca em cada tela da Cidade Neon, ou desliga ("sem sinal"). **SALVAR PARA TODOS** grava no
 * servidor (com a chave do dono) e vale na próxima vez que o jogo montar a Cidade Neon. Só abre no modo Comandante; pedaço sob demanda (R7). Módulo independente (G3).
 */
export class TelaoPanel {
  private modal: HTMLElement | null = null;
  private escolhas: Record<IdDeTelao, TelaoItem | null> = {};
  private mensagem: HTMLElement | null = null;
  private readonly aoTeclar = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.fechar();
    }
  };

  constructor(private readonly cliente: Pick<AdminCliente, 'gravarTelao' | 'telaoPublico'>) {}

  async abrir(): Promise<void> {
    if (this.modal) return;
    this.escolhas = Object.fromEntries(TELOES_DA_ARENA.map((id) => [id, null]));
    const atual = await this.cliente.telaoPublico();
    if (atual) for (const id of TELOES_DA_ARENA) this.escolhas[id] = atual.itens[id] ?? null;
    if (this.modal) return; // fechado enquanto a busca corria
    this.modal = this.montar();
    document.body.append(this.modal);
    document.addEventListener('keydown', this.aoTeclar, true);
  }

  fechar(): void {
    document.removeEventListener('keydown', this.aoTeclar, true);
    this.modal?.remove();
    this.modal = null;
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, texto?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  private botao(texto: string, classe: string, aoClicar: () => void): HTMLButtonElement {
    const b = this.el('button', classe, texto);
    b.type = 'button';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      aoClicar();
    });
    return b;
  }

  private montar(): HTMLElement {
    const fundo = this.el('div', 'lado-modal telao-modal');
    fundo.dataset.i18n = 'nao'; // painel do dono: fica em português
    fundo.addEventListener('click', () => this.fechar());
    const placa = this.el('div', 'lado-placa telao-placa');
    placa.setAttribute('role', 'dialog');
    placa.setAttribute('aria-modal', 'true');
    placa.setAttribute('aria-label', 'Telões');
    placa.addEventListener('click', (e) => e.stopPropagation());
    const lista = this.el('div', 'telao-lista');
    for (const id of TELOES_DA_ARENA) {
      const linha = this.el('div', 'telao-linha');
      linha.append(this.el('b', 'telao-nome', NOME_DA_TELA[id] ?? id));
      if (ARQUIVOS_DE_TELAO.length === 0) {
        linha.append(this.el('span', 'telao-vazio', 'Nenhum vídeo no site ainda'));
      } else {
        const select = this.el('select', 'telao-select') as HTMLSelectElement;
        const desligada = this.el('option', '', 'Desligada (sem sinal)') as HTMLOptionElement;
        desligada.value = '';
        select.append(desligada);
        for (const arquivo of ARQUIVOS_DE_TELAO) {
          const op = this.el('option', '', arquivo) as HTMLOptionElement;
          op.value = arquivo;
          select.append(op);
        }
        select.value = this.escolhas[id]?.arquivo ?? '';
        select.addEventListener('change', () => {
          this.escolhas[id] = select.value ? { arquivo: select.value } : null;
        });
        linha.append(select);
      }
      lista.append(linha);
    }
    this.mensagem = this.el('p', 'telao-mensagem', 'Sem vídeo atribuído, a tela fica escura ("sem sinal"). Vale para todo jogador assim que gravar.');
    const rodape = this.el('div', 'lado-botoes telao-rodape');
    rodape.append(this.botao('SALVAR PARA TODOS', 'lado-botao primario', () => void this.salvar()), this.botao('[ FECHAR ]', 'lado-botao', () => this.fechar()));
    placa.append(this.el('h3', 'telao-titulo', 'TELÕES · CIDADE NEON'), lista, this.mensagem, rodape);
    fundo.append(placa);
    return fundo;
  }

  private say(texto: string): void {
    if (this.mensagem) this.mensagem.textContent = texto;
  }

  private async salvar(): Promise<void> {
    this.say('Gravando no servidor…');
    const r = await this.cliente.gravarTelao(this.escolhas);
    if (!r.ok) {
      this.say('Não consegui gravar (confira o token do dono em SERVIDOR).');
      return;
    }
    this.say(`Gravado (versão ${r.dados.versao}). Vale na próxima vez que o jogo montar a Cidade Neon.`);
  }
}
