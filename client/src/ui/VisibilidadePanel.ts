import { FUNCIONALIDADES, NOME_DO_GRUPO, padraoDe, type GrupoDeFuncionalidade } from '../core/funcionalidades';
import type { Visibilidade } from '../core/Visibilidade';
import type { AdminCliente, MotivoDeFalha } from '../net/admin';
import type { EstadoDeVisibilidade } from '../../../shared/visibilidade';

/**
 * O PAINEL DE VISIBILIDADE (P191, `PAINEL_ADMIN.md` § 6): a lista de **tudo** o que o jogo tem (fases, modos, botões e telas, robôs, armas) e, para cada item, **PÚBLICO** (todo jogador vê) ou
 * **RESTRITO** (só o Comandante vê, com o selo TESTE: em desenvolvimento). **SALVAR PARA TODOS** grava no servidor (com a chave do dono) e vale na próxima vez que qualquer jogador abrir o jogo;
 * **SÓ NESTE NAVEGADOR** vale só aqui (para ensaiar). **VER COMO JOGADOR** mostra na hora o que o jogador normal enxerga. Só abre no modo Comandante; pedaço sob demanda (R7). Módulo independente (G3).
 */

const ORDEM: readonly GrupoDeFuncionalidade[] = ['fases', 'modos', 'telas', 'robos', 'armas'];

const MOTIVO: Readonly<Record<MotivoDeFalha, string>> = {
  'sem-servidor': 'Este jogo não sabe onde está o servidor.',
  'sem-token': 'Falta a chave do dono: cole-a na janela SERVIDOR e tente de novo.',
  token: 'O servidor recusou a chave do dono.',
  bloqueado: 'Erros demais de chave: espere uns minutos.',
  'fora-do-ar': 'O servidor não respondeu. Use SÓ NESTE NAVEGADOR ou tente de novo.',
  recusado: 'O servidor recusou a lista.',
  resposta: 'O servidor respondeu algo que não entendi.',
} as Record<MotivoDeFalha, string>;

/** As exceções ao padrão do código: é o que o servidor guarda (o resto volta ao padrão). */
export function excecoes(escolhas: Readonly<Record<string, EstadoDeVisibilidade>>): Record<string, EstadoDeVisibilidade> {
  const r: Record<string, EstadoDeVisibilidade> = {};
  for (const [id, estado] of Object.entries(escolhas)) if (estado !== padraoDe(id)) r[id] = estado;
  return r;
}

export class VisibilidadePanel {
  private modal: HTMLElement | null = null;
  private escolhas: Record<string, EstadoDeVisibilidade> = {};
  private mensagem: HTMLElement | null = null;
  private botaoComoJogador: HTMLElement | null = null;
  private readonly aoTeclar = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.fechar();
    }
  };

  constructor(
    private readonly visibilidade: Visibilidade,
    private readonly cliente: Pick<AdminCliente, 'gravarVisibilidade'>,
  ) {}

  abrir(): void {
    if (this.modal) return;
    this.escolhas = Object.fromEntries(FUNCIONALIDADES.map((f) => [f.id, this.visibilidade.estado(f.id)]));
    this.modal = this.montar();
    document.body.append(this.modal);
    document.addEventListener('keydown', this.aoTeclar, true);
  }

  fechar(): void {
    document.removeEventListener('keydown', this.aoTeclar, true);
    this.visibilidade.verComoJogador(false);
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
    const fundo = this.el('div', 'lado-modal vis-modal');
    fundo.dataset.i18n = 'nao'; // painel do dono: fica em português
    fundo.addEventListener('click', () => this.fechar());
    const placa = this.el('div', 'lado-placa vis-placa');
    placa.setAttribute('role', 'dialog');
    placa.setAttribute('aria-modal', 'true');
    placa.setAttribute('aria-label', 'Visibilidade');
    placa.addEventListener('click', (e) => e.stopPropagation());
    const lista = this.el('div', 'vis-lista');
    for (const grupo of ORDEM) {
      const itens = FUNCIONALIDADES.filter((f) => f.grupo === grupo);
      const cab = this.el('div', 'vis-grupo');
      cab.append(this.el('b', '', `${NOME_DO_GRUPO[grupo]} · ${itens.length}`));
      cab.append(this.botao('TUDO PÚBLICO', 'vis-mini', () => this.todos(itens.map((f) => f.id), 'publico')), this.botao('TUDO RESTRITO', 'vis-mini', () => this.todos(itens.map((f) => f.id), 'restrito')));
      lista.append(cab);
      for (const f of itens) {
        const linha = this.el('div', 'vis-linha');
        linha.dataset.id = f.id;
        const nome = this.el('span', 'vis-nome', f.nome);
        if (f.efeito) nome.title = `Restrito esconde: ${f.efeito}`;
        const seg = this.el('span', 'vis-seg');
        for (const estado of ['publico', 'restrito'] as const) seg.append(this.botao(estado === 'publico' ? 'PÚBLICO' : 'RESTRITO', `vis-opcao ${estado}`, () => this.escolher(f.id, estado)));
        linha.append(nome, seg);
        lista.append(linha);
      }
    }
    this.mensagem = this.el('p', 'vis-mensagem', 'Restrito = só você (modo Comandante) vê, com o selo TESTE. Não é cadeado: quem souber ligar o modo Comandante vê tudo.');
    const rodape = this.el('div', 'lado-botoes vis-rodape');
    this.botaoComoJogador = this.botao('VER COMO JOGADOR', 'lado-botao', () => this.alternarComoJogador());
    rodape.append(
      this.botao('SALVAR PARA TODOS', 'lado-botao primario', () => void this.salvarParaTodos()),
      this.botao('SÓ NESTE NAVEGADOR', 'lado-botao', () => this.salvarAqui()),
      this.botaoComoJogador,
      this.botao('RESTAURAR PADRÕES', 'lado-botao', () => this.todosPadrao()),
      this.botao('[ FECHAR ]', 'lado-botao', () => this.fechar()),
    );
    placa.append(this.el('h3', 'vis-titulo', 'VISIBILIDADE · O QUE O JOGADOR VÊ'), lista, this.mensagem, rodape);
    fundo.append(placa);
    this.pintar(fundo);
    return fundo;
  }

  private escolher(id: string, estado: EstadoDeVisibilidade): void {
    this.escolhas[id] = estado;
    if (this.modal) this.pintar(this.modal);
  }

  private todos(ids: readonly string[], estado: EstadoDeVisibilidade): void {
    for (const id of ids) this.escolhas[id] = estado;
    if (this.modal) this.pintar(this.modal);
  }

  private todosPadrao(): void {
    for (const f of FUNCIONALIDADES) this.escolhas[f.id] = f.padrao;
    if (this.modal) this.pintar(this.modal);
  }

  /** O estado marcado de cada linha e o que difere do padrão. */
  private pintar(raiz: HTMLElement): void {
    raiz.querySelectorAll<HTMLElement>('.vis-linha').forEach((linha) => {
      const id = linha.dataset.id!;
      const atual = this.escolhas[id] ?? padraoDe(id);
      linha.classList.toggle('restrito', atual === 'restrito');
      linha.classList.toggle('mudou', atual !== padraoDe(id));
      linha.querySelectorAll<HTMLElement>('.vis-opcao').forEach((b) => b.setAttribute('aria-pressed', String(b.classList.contains(atual))));
    });
  }

  private say(texto: string): void {
    if (this.mensagem) this.mensagem.textContent = texto;
  }

  private async salvarParaTodos(): Promise<void> {
    this.say('Gravando no servidor…');
    const exc = excecoes(this.escolhas);
    const r = await this.cliente.gravarVisibilidade(exc);
    if (!r.ok) {
      this.say(MOTIVO[r.motivo] ?? 'Não consegui gravar.');
      return;
    }
    this.visibilidade.definir(r.dados);
    this.say(`Gravado para todos (versão ${r.dados.versao}, ${Object.keys(r.dados.itens).length} exceções ao padrão). Vale na próxima vez que cada jogador abrir o jogo.`);
  }

  private salvarAqui(): void {
    const exc = excecoes(this.escolhas);
    this.visibilidade.definir({ versao: 0, itens: exc });
    this.say(`Vale só neste navegador (${Object.keys(exc).length} exceções). Para os jogadores, use SALVAR PARA TODOS.`);
  }

  private alternarComoJogador(): void {
    const ligar = this.visibilidade.ehAdmin; // vendo tudo agora: liga o "como jogador"; já ligado: volta a ver tudo
    this.visibilidade.verComoJogador(ligar);
    if (this.botaoComoJogador) this.botaoComoJogador.textContent = ligar ? 'VOLTAR A VER TUDO' : 'VER COMO JOGADOR';
    this.say(ligar ? 'Agora o jogo está como o jogador normal o vê (o que é restrito sumiu). Feche este painel para voltar ao normal.' : 'Vendo tudo de novo, com o selo TESTE no que é restrito.');
  }
}
