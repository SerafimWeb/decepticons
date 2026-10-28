import { ANUNCIOS_QUE_ALTERNAM, PERIODO_MAXIMO, PERIODO_MINIMO, type ParametrosDeOutdoors } from '../../../shared/outdoors';
import type { CenarioDaCidade } from '../environment/mapasSobDemanda';
import type { AdminCliente } from '../net/admin';

/** O nome de cada anúncio no painel (não aparece no jogo): só para o Comandante saber qual é qual. */
const NOME_DO_ANUNCIO: Readonly<Record<string, string>> = {
  'odp-olho': 'Olho do Pai · rastreamento 24h',
  'odp-gps': 'Olho do Pai · GPS ao vivo 24h',
  'odp-ping': 'Olho do Pai · ping < 5 s',
  'odp-sos': 'Olho do Pai · botão SOS',
  'odp-familia': 'Olho do Pai · segurança para a família (4 mensagens)',
  swb: 'Serafim Web · Software Bureau',
};

/** Os dois tempos que o Comandante pediu ("a cada 10 ou 15 segundos"): atalhos ao lado do controle deslizante. */
const PERIODOS_RAPIDOS = [10, 15] as const;

/**
 * Liga ou desliga um anúncio na troca, sem nunca deixar a troca vazia: desligar o **último** que sobra não faz nada (o outdoor ficaria sem o que mostrar; o servidor também recusa). Ligar tira da lista.
 */
export function alternarAnuncio(desligados: readonly string[], id: string): readonly string[] {
  if (desligados.includes(id)) return desligados.filter((d) => d !== id);
  const restariam = ANUNCIOS_QUE_ALTERNAM.filter((a) => a !== id && !desligados.includes(a));
  return restariam.length ? [...desligados, id] : desligados;
}

/** O que o painel precisa do cenário: aplicar na hora, saber o que vale agora e quantos outdoors existem. */
export type CenarioDosOutdoors = Pick<CenarioDaCidade, 'aplicarOutdoors' | 'outdoorsDaVez' | 'totalDeOutdoors'>;

/**
 * O PAINEL DOS OUTDOORS (P267, ordem do Comandante de 28/10: "tá meio poluído… quero um painel de edição na interface pra configurar quantas imagens devem aparecer… trocar a cada 10 ou 15 segundos"):
 * **quantos outdoors aparecem** (as logos planas são as últimas a sair, depois os maiores), **de quanto em quanto tempo cada um troca de imagem** e **quais anúncios entram na troca**. Cada mexida aparece
 * **na hora** na cidade, atrás do painel; **SALVAR PARA TODOS** grava no servidor (com a chave do dono) e vale para todo jogador na próxima vez que a cidade montar; **FECHAR** desfaz o que não foi salvo.
 * Só abre no modo Comandante; pedaço sob demanda (R7). Módulo independente (G3).
 */
export class OutdoorsPanel {
  private modal: HTMLElement | null = null;
  private mensagem: HTMLElement | null = null;
  /** A tela do console: some enquanto o painel está aberto, para o Comandante ver a cidade mudar (volta ao fechar). */
  private console: HTMLElement | null = null;
  private visibilidadeDoConsole = '';
  /** O que está valendo no servidor (ou o que a cidade tinha ao abrir): para onde `DESFAZER` e `FECHAR` voltam. */
  private salvo: ParametrosDeOutdoors = { quantidade: 0, periodo: 12, desligados: [] };
  private atual: ParametrosDeOutdoors = this.salvo;
  private atualizarControles: () => void = () => {};
  private readonly aoTeclar = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.fechar();
    }
  };

  constructor(
    private readonly cliente: Pick<AdminCliente, 'gravarOutdoors' | 'outdoorsPublico'>,
    private readonly cenario: CenarioDosOutdoors | null,
  ) {}

  async abrir(): Promise<void> {
    if (this.modal) return;
    if (this.cenario) {
      const publico = await this.cliente.outdoorsPublico();
      if (this.modal) return; // fechado enquanto a busca corria
      this.salvo = publico ? { quantidade: publico.quantidade, periodo: publico.periodo, desligados: publico.desligados } : this.cenario.outdoorsDaVez();
      this.atual = this.salvo;
      this.cenario.aplicarOutdoors(this.atual);
    }
    this.modal = this.montar();
    document.body.append(this.modal);
    document.addEventListener('keydown', this.aoTeclar, true);
    if (this.cenario) {
      this.console = document.getElementById('overlay');
      if (this.console) {
        this.visibilidadeDoConsole = this.console.style.visibility;
        this.console.style.visibility = 'hidden';
      }
    }
  }

  /** Fecha e desfaz o que não foi salvo (o que o Comandante viu na cidade enquanto mexia). */
  fechar(): void {
    document.removeEventListener('keydown', this.aoTeclar, true);
    this.cenario?.aplicarOutdoors(this.salvo);
    this.modal?.remove();
    this.modal = null;
    if (this.console) this.console.style.visibility = this.visibilidadeDoConsole;
    this.console = null;
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

  /** Aplica na cidade o que está nos controles e atualiza os números ao lado deles. */
  private mudou(novo: ParametrosDeOutdoors): void {
    this.atual = novo;
    this.cenario?.aplicarOutdoors(novo);
    this.atualizarControles();
  }

  private montar(): HTMLElement {
    // Sem a tela de fundo escura e sem fechar ao clicar fora: a placa fica à direita e a cidade, à esquerda, mostra cada mexida (o clique fora só não vaza para a cena).
    const fundo = this.el('div', 'lado-modal telao-modal outdoors-modal');
    fundo.dataset.i18n = 'nao'; // painel do dono: fica em português
    const placa = this.el('div', 'lado-placa telao-placa');
    placa.setAttribute('role', 'dialog');
    placa.setAttribute('aria-modal', 'true');
    placa.setAttribute('aria-label', 'Outdoors');
    placa.addEventListener('click', (e) => e.stopPropagation());
    placa.append(this.el('h3', 'telao-titulo', 'OUTDOORS · CIDADE NEON'));

    if (!this.cenario) {
      placa.append(this.el('p', 'telao-mensagem', 'Os outdoors só existem na Cidade Neon. Abra o mapa ARENA e volte aqui.'));
      const rodape = this.el('div', 'lado-botoes telao-rodape');
      rodape.append(this.botao('[ FECHAR ]', 'lado-botao', () => this.fechar()));
      placa.append(rodape);
      fundo.append(placa);
      return fundo;
    }
    const cenario = this.cenario;
    const total = cenario.totalDeOutdoors;
    const lista = this.el('div', 'telao-lista');

    // Quantos aparecem.
    const linhaQuantidade = this.el('div', 'telao-linha outdoors-linha');
    linhaQuantidade.append(this.el('b', 'telao-nome', 'Quantos aparecem'));
    const quantidade = this.el('input', 'outdoors-controle') as HTMLInputElement;
    quantidade.type = 'range';
    quantidade.min = '0';
    quantidade.max = String(total);
    quantidade.step = '1';
    const rotuloQuantidade = this.el('span', 'outdoors-valor');
    quantidade.addEventListener('input', () => this.mudou({ ...this.atual, quantidade: Number(quantidade.value) }));
    linhaQuantidade.append(quantidade, rotuloQuantidade);

    // De quanto em quanto tempo trocam.
    const linhaPeriodo = this.el('div', 'telao-linha outdoors-linha');
    linhaPeriodo.append(this.el('b', 'telao-nome', 'Trocar a imagem a cada'));
    const periodo = this.el('input', 'outdoors-controle') as HTMLInputElement;
    periodo.type = 'range';
    periodo.min = String(PERIODO_MINIMO);
    periodo.max = String(PERIODO_MAXIMO);
    periodo.step = '0.5';
    const rotuloPeriodo = this.el('span', 'outdoors-valor');
    periodo.addEventListener('input', () => this.mudou({ ...this.atual, periodo: Number(periodo.value) }));
    linhaPeriodo.append(periodo, rotuloPeriodo);
    const atalhos = this.el('div', 'outdoors-atalhos');
    for (const s of PERIODOS_RAPIDOS) atalhos.append(this.botao(`${s} s`, 'lado-botao outdoors-atalho', () => this.mudou({ ...this.atual, periodo: s })));

    // Quais anúncios entram na troca.
    const anuncios = this.el('div', 'outdoors-anuncios');
    anuncios.append(this.el('b', 'telao-nome', 'Anúncios que entram na troca'));
    const caixas = new Map<string, HTMLInputElement>();
    for (const id of ANUNCIOS_QUE_ALTERNAM) {
      const rotulo = this.el('label', 'outdoors-anuncio');
      const caixa = this.el('input', '') as HTMLInputElement;
      caixa.type = 'checkbox';
      caixa.addEventListener('change', () => this.mudou({ ...this.atual, desligados: alternarAnuncio(this.atual.desligados, id) }));
      rotulo.append(caixa, document.createTextNode(` ${NOME_DO_ANUNCIO[id] ?? id}`));
      caixas.set(id, caixa);
      anuncios.append(rotulo);
    }
    anuncios.append(this.el('span', 'telao-vazio', 'A logo plana não alterna: fica fixa. Pelo menos um anúncio fica na troca.'));

    this.atualizarControles = () => {
      quantidade.value = String(this.atual.quantidade);
      rotuloQuantidade.textContent = `${Math.min(this.atual.quantidade, total)} de ${total}`;
      periodo.value = String(this.atual.periodo);
      rotuloPeriodo.textContent = `${this.atual.periodo} s`;
      for (const [id, caixa] of caixas) caixa.checked = !this.atual.desligados.includes(id);
    };
    this.atualizarControles();
    lista.append(linhaQuantidade, linhaPeriodo, atalhos, anuncios);

    this.mensagem = this.el('p', 'telao-mensagem', 'Cada mexida aparece na cidade na hora (o console some enquanto este painel está aberto). SALVAR PARA TODOS vale para todo jogador; FECHAR desfaz o que não foi salvo.');
    const rodape = this.el('div', 'lado-botoes telao-rodape');
    rodape.append(
      this.botao('SALVAR PARA TODOS', 'lado-botao primario', () => void this.salvarTudo()),
      this.botao('DESFAZER', 'lado-botao', () => this.mudou(this.salvo)),
      this.botao('[ FECHAR ]', 'lado-botao', () => this.fechar()),
    );
    placa.append(lista, this.mensagem, rodape);
    fundo.append(placa);
    return fundo;
  }

  private say(texto: string): void {
    if (this.mensagem) this.mensagem.textContent = texto;
  }

  private async salvarTudo(): Promise<void> {
    this.say('Gravando no servidor…');
    const r = await this.cliente.gravarOutdoors(this.atual);
    if (!r.ok) {
      this.say('Não consegui gravar (confira o token do dono em SERVIDOR). A mudança continua só aqui, até você fechar.');
      return;
    }
    this.salvo = { quantidade: r.dados.quantidade, periodo: r.dados.periodo, desligados: r.dados.desligados };
    this.say(`Gravado (versão ${r.dados.versao}). Vale para todo jogador na próxima vez que a cidade montar.`);
  }
}
