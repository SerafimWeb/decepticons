import { DIFICULDADES_ONLINE, LIMITES_DAS_REGRAS, RECEITAS_DAS_REGRAS, REGRAS_PADRAO, type DificuldadeOnline, type RegrasOnline } from '../../../shared/regras';
import type { AdminCliente, MotivoDeFalha } from '../net/admin';

/**
 * AS REGRAS DAS SALAS ONLINE (P199, `PAINEL_ADMIN.md` § 7): a janela do dono para **domar os bots** que enfrentam os jogadores online: a **dificuldade**, quantos **Mechs** e **andróides** e a
 * **pressão** (quantos atacam ao mesmo tempo). Abre pelo botão REGRAS DAS SALAS da janela do servidor (que já exige a chave do dono ou a conta admin) e fala com o servidor só por `AdminCliente`.
 * Três receitas de um clique (INICIANTE, PADRÃO, DESAFIO) e os ajustes finos; **APLICAR** grava e vale na hora nas salas de pé (dificuldade, pressão e Mechs; os andróides valem nas salas novas).
 * Pedaço sob demanda (R7). Custo de CPU: zero no jogo.
 */

const NOME_DA_DIFICULDADE: Readonly<Record<DificuldadeOnline, string>> = { facil: 'FÁCIL', normal: 'NORMAL', dificil: 'DIFÍCIL' };

const MOTIVO: Readonly<Partial<Record<MotivoDeFalha, string>>> = {
  'sem-token': 'Falta a chave do dono: entre na janela SERVIDOR primeiro.',
  token: 'O servidor recusou a chave do dono.',
  bloqueado: 'Erros demais de chave: espere uns minutos.',
  'fora-do-ar': 'O servidor não respondeu.',
};

export class RegrasPanel {
  private modal: HTMLElement | null = null;
  private regras: RegrasOnline = { ...REGRAS_PADRAO };
  private mensagem: HTMLElement | null = null;
  private readonly aoTeclar = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.fechar();
    }
  };

  constructor(private readonly cliente: Pick<AdminCliente, 'regras' | 'gravarRegras'>) {}

  async abrir(): Promise<void> {
    if (this.modal) return;
    const atuais = await this.cliente.regras();
    if (atuais.ok) this.regras = atuais.dados;
    this.modal = this.montar(atuais.ok ? 'Estas são as regras que o servidor usa agora.' : (MOTIVO[atuais.motivo] ?? 'Não consegui ler as regras do servidor: mostro o padrão.'));
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

  private montar(aviso: string): HTMLElement {
    const fundo = this.el('div', 'lado-modal vis-modal');
    fundo.dataset.i18n = 'nao';
    fundo.addEventListener('click', () => this.fechar());
    const placa = this.el('div', 'lado-placa vis-placa');
    placa.setAttribute('role', 'dialog');
    placa.setAttribute('aria-modal', 'true');
    placa.setAttribute('aria-label', 'Regras das salas online');
    placa.addEventListener('click', (e) => e.stopPropagation());
    placa.append(this.el('h3', 'vis-titulo', 'REGRAS DAS SALAS ONLINE · OS BOTS INIMIGOS'));

    const receitas = this.el('div', 'lado-botoes vis-rodape');
    for (const [nome, rotulo] of [['iniciante', 'INICIANTE'], ['padrao', 'PADRÃO'], ['desafio', 'DESAFIO']] as const) {
      receitas.append(this.botao(rotulo, 'lado-botao', () => this.definir({ ...RECEITAS_DAS_REGRAS[nome] })));
    }
    placa.append(receitas);

    const linhas = this.el('div', 'vis-lista');
    linhas.append(this.linha('DIFICULDADE', 'quanto os bots erram a mira, demoram a reagir e desviam', DIFICULDADES_ONLINE.map((d) => ({ rotulo: NOME_DA_DIFICULDADE[d], ativo: this.regras.dificuldade === d, aoEscolher: () => this.definir({ ...this.regras, dificuldade: d }) }))));
    linhas.append(this.linha('MECHS', 'os robôs grandes (valem na hora; sala cheia de gente tira os últimos)', this.passos(LIMITES_DAS_REGRAS.mechs.min, LIMITES_DAS_REGRAS.mechs.max, 1, this.regras.mechs, (n) => this.definir({ ...this.regras, mechs: n }))));
    linhas.append(this.linha('ANDRÓIDES', 'os pequenos e rápidos (valem nas salas NOVAS; a de pé não muda o corpo)', this.passos(LIMITES_DAS_REGRAS.androides.min, LIMITES_DAS_REGRAS.androides.max, 1, this.regras.androides, (n) => this.definir({ ...this.regras, androides: n }))));
    linhas.append(this.linha('PRESSÃO', 'quantos atacam ao mesmo tempo (Mech = 1, andróide = ½); o resto espera afastado', this.passos(LIMITES_DAS_REGRAS.atacantes.min, LIMITES_DAS_REGRAS.atacantes.max, LIMITES_DAS_REGRAS.atacantes.passo, this.regras.atacantes, (n) => this.definir({ ...this.regras, atacantes: n }))));
    placa.append(linhas);

    this.mensagem = this.el('p', 'vis-mensagem', aviso);
    const rodape = this.el('div', 'lado-botoes vis-rodape');
    rodape.append(this.botao('APLICAR', 'lado-botao primario', () => void this.aplicar()), this.botao('[ FECHAR ]', 'lado-botao', () => this.fechar()));
    placa.append(this.mensagem, rodape);
    fundo.append(placa);
    return fundo;
  }

  /** Uma linha: o nome, a explicação e as opções (a marcada acesa). */
  private linha(nome: string, ajuda: string, opcoes: readonly { rotulo: string; ativo: boolean; aoEscolher: () => void }[]): HTMLElement {
    const l = this.el('div', 'vis-linha');
    const texto = this.el('span', 'vis-nome', nome);
    texto.title = ajuda;
    const ajudaEl = this.el('small', 'vis-ajuda', ajuda);
    const esq = this.el('span', 'vis-esq');
    esq.append(texto, ajudaEl);
    const seg = this.el('span', 'vis-seg');
    for (const o of opcoes) {
      const b = this.botao(o.rotulo, 'vis-opcao publico', o.aoEscolher);
      b.setAttribute('aria-pressed', String(o.ativo));
      seg.append(b);
    }
    l.append(esq, seg);
    return l;
  }

  private passos(min: number, max: number, passo: number, atual: number, aoEscolher: (n: number) => void) {
    const r: { rotulo: string; ativo: boolean; aoEscolher: () => void }[] = [];
    for (let n = min; n <= max + 1e-9; n += passo) {
      const v = Math.round(n * 2) / 2;
      r.push({ rotulo: String(v).replace('.', ','), ativo: v === atual, aoEscolher: () => aoEscolher(v) });
    }
    return r;
  }

  private definir(r: RegrasOnline): void {
    this.regras = r;
    if (!this.modal) return;
    const novo = this.montar(`Mudou (ainda não gravado): ${this.resumo(r)}. Clique em APLICAR.`);
    this.modal.replaceWith(novo);
    this.modal = novo;
  }

  private resumo(r: RegrasOnline): string {
    return `${NOME_DA_DIFICULDADE[r.dificuldade]}, ${r.mechs} Mech(s), ${r.androides} andróide(s), ${String(r.atacantes).replace('.', ',')} atacante(s) juntos`;
  }

  private async aplicar(): Promise<void> {
    if (this.mensagem) this.mensagem.textContent = 'Gravando…';
    const r = await this.cliente.gravarRegras(this.regras);
    if (!r.ok) {
      if (this.mensagem) this.mensagem.textContent = MOTIVO[r.motivo] ?? 'O servidor recusou as regras.';
      return;
    }
    this.regras = r.dados;
    if (this.mensagem) this.mensagem.textContent = `Gravado: ${this.resumo(r.dados)}. Valendo agora nas salas de pé e nas novas.`;
  }
}
