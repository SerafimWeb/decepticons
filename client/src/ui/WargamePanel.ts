import type { RoteiroStore } from '../core/RoteiroStore';
import type { GameMode } from '../sim/gameMode';
import type { EnemyNames } from '../core/Settings';
import { withoutParam } from '../core/url';
import { camerasDoMapa } from '../camera/camerasDoMapa';
import { esquadraoPadrao, type EsquadraoSpec, type LadoDoBot } from '../sim/esquadrao';
import {
  chaveDoRoteiro,
  LEGENDA_MAX,
  limparAlvos,
  LIMITES_DO_ROTEIRO,
  PARAM_DO_ROTEIRO,
  roteiroPadrao,
  sanearRoteiro,
  type BeatDoRoteiro,
  type RoteiroSpec,
  type TipoDeOrdem,
} from '../sim/Roteiro';
import { afetadosPelaBatida, desenhoDoMapa, descreverPonto, elencoDoRoteiro, rotuloDoLado, type RoboDoElenco } from './elencoDoWargame';
import { RoteiroMapa, type PlantaEstatica } from './RoteiroMapa';
import { marcosDoMapa } from './TacticalRadar';

/** O que a janela precisa do jogo (o `Game.ts` só liga: G3). */
export interface WargamePanelOptions {
  store: RoteiroStore;
  /** A planta estática da Arena (v1: só este mapa — `camerasDoMapa` ainda não tem câmeras fixas nos outros). */
  planta: PlantaEstatica;
  /** O esquadrão que o Comandante salvou no editor de esquadrão (tela ESQUADRÃO), ou `null` se não há. */
  esquadraoMeu: () => EsquadraoSpec | null;
  /** Os nomes de fábrica dos robôs (Configurações): o elenco mostra o nome que cada um tem na partida. */
  nomes: () => EnemyNames;
  /** `null` = a janela abre normal; senão o motivo em palavras (v1: só funciona com a partida já na Cidade Neon). */
  indisponivel: () => string | null;
}

const ORDEM_ROTULO: Readonly<Record<TipoDeOrdem, string>> = { hold: 'Segurar a posição', follow: 'Avançar até lá' };
/** Os modos que o WARGAME roda (P292): o mesmo rótulo que o seletor de modo do console. */
const MODO_ROTULO: Readonly<Record<GameMode, string>> = { deathmatch: 'DEATHMATCH', survival: 'SOBREVIVÊNCIA', ctf: 'BANDEIRA', dominio: 'DOMÍNIO' };
const CAMERAS_DA_ARENA = camerasDoMapa('arena');

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', texto?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function botao(texto: string, className: string, aoClicar: () => void): HTMLButtonElement {
  const b = el('button', className, texto);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    aoClicar();
  });
  return b;
}

function opcao(valor: string, texto: string): HTMLOptionElement {
  const op = el('option', '', texto) as HTMLOptionElement;
  op.value = valor;
  return op;
}

/**
 * O PAINEL WARGAME (P262: "transformar a gameplay num filme roteirizado"): monta um episódio de IA contra IA — o elenco (os dois esquadrões) e uma lista de **batidas** (um momento do episódio: uma ordem de
 * combate, legenda e/ou corte de câmera). **EXECUTAR** carrega o jogo com o link do roteiro (`?wargame=`); `Game.ts` entra direto no modo espectador (nunca o Comandante jogando). Só abre no modo
 * Comandante; pedaço sob demanda (R7). Módulo independente (G3).
 *
 * **P290 (30/10: "não sei qual mech vai em cada ponto"):** o mapa mostra cada robô **numerado onde nasce**, cada ordem como um **anel com o número da batida** e, da batida em foco, uma **seta de cada robô que a
 * recebe**; a lista "quem é quem" diz o número, o nome e o chassi de cada um; e cada batida diz **QUEM** (o lado inteiro ou UM robô), **FAZ** (segurar ou avançar) e **ONDE** (o ponto, perto de que marco), com a
 * legenda e a câmera recolhidas. Marcar o ponto é um clique no mapa.
 */
export class WargamePanel {
  private modal: HTMLElement | null = null;
  private draft: RoteiroSpec = roteiroPadrao();
  private elencoEscolhido: 'padrao' | 'meu' = 'padrao';
  /** O modo em que o episódio roda (P292): vai no link (`modo=`); o padrão é o Deathmatch, como antes. */
  private modo: GameMode = 'deathmatch';
  /** Quem é quem no episódio (recalculado quando o elenco muda). */
  private robos: RoboDoElenco[] = [];
  /** Índice da batida armada para o próximo clique no mapa (`null` = nenhuma). */
  private armado: number | null = null;
  /** A batida em foco (a última tocada): é a das setas do mapa e a que recebe o clique numa ficha de robô. */
  private foco: number | null = null;
  private mapa: RoteiroMapa | null = null;
  private lista: HTMLElement | null = null;
  private quadroDoElenco: HTMLElement | null = null;
  private mensagem: HTMLElement | null = null;
  private readonly aoTeclar = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.fechar();
    }
  };

  constructor(private readonly o: WargamePanelOptions) {}

  abrir(): void {
    if (this.modal) return;
    const salvos = this.o.store.list();
    this.draft = sanearRoteiro(salvos[salvos.length - 1] ?? roteiroPadrao());
    this.elencoEscolhido = this.ehOMeuElenco(this.draft.esquadrao) ? 'meu' : 'padrao';
    this.armado = null;
    this.foco = this.draft.beats.length ? 0 : null;
    this.recalcularElenco();
    this.modal = this.montar();
    document.body.append(this.modal);
    document.addEventListener('keydown', this.aoTeclar, true);
    this.mapa?.ligar();
    this.refrescarMapa();
  }

  fechar(): void {
    document.removeEventListener('keydown', this.aoTeclar, true);
    this.mapa?.desligar();
    this.mapa = null;
    this.modal?.remove();
    this.modal = null;
  }

  private ehOMeuElenco(spec: EsquadraoSpec): boolean {
    const meu = this.o.esquadraoMeu();
    return !!meu && JSON.stringify(meu) === JSON.stringify(spec);
  }

  private recalcularElenco(): void {
    try {
      this.robos = elencoDoRoteiro(this.draft.esquadrao, 'arena', this.o.nomes());
    } catch {
      this.robos = []; // um esquadrão que não cabe na Cidade Neon não chega aqui (o roteiro é saneado), mas a janela não cai por isso
    }
  }

  private montar(): HTMLElement {
    const fundo = el('div', 'lado-modal wargame-modal');
    fundo.dataset.i18n = 'nao'; // painel do dono: fica em português
    fundo.addEventListener('click', () => this.fechar());
    const placa = el('div', 'lado-placa wargame-placa');
    placa.setAttribute('role', 'dialog');
    placa.setAttribute('aria-modal', 'true');
    placa.setAttribute('aria-label', 'WARGAME');
    placa.addEventListener('click', (e) => e.stopPropagation());

    const motivo = this.o.indisponivel();
    if (motivo) {
      placa.append(el('h3', 'wargame-titulo', 'WARGAME · CIDADE NEON'), el('p', 'wargame-mensagem', motivo), botao('[ FECHAR ]', 'lado-botao', () => this.fechar()));
      fundo.append(placa);
      return fundo;
    }

    const nome = el('input', 'wargame-nome') as HTMLInputElement;
    nome.type = 'text';
    nome.maxLength = 24;
    nome.placeholder = 'Nome do episódio (ex.: Cerco ao Banco Vorcaris)';
    nome.value = this.draft.nome ?? '';
    nome.addEventListener('input', () => {
      const v = nome.value.trim();
      if (v) this.draft.nome = v;
      else delete this.draft.nome;
    });

    const elencoSelect = el('select', 'wargame-elenco-select') as HTMLSelectElement;
    elencoSelect.append(opcao('padrao', 'Elenco padrão'), opcao('meu', 'O meu (tela ESQUADRÃO)'));
    elencoSelect.value = this.elencoEscolhido;
    elencoSelect.addEventListener('change', () => {
      this.elencoEscolhido = elencoSelect.value === 'meu' ? 'meu' : 'padrao';
      this.draft.esquadrao = sanearRoteiro({ ...this.draft, esquadrao: this.elencoEscolhido === 'meu' ? (this.o.esquadraoMeu() ?? esquadraoPadrao()) : esquadraoPadrao() }).esquadrao;
      // O esquadrão mudou: um alvo que já não existe volta a valer para o lado (a ficha de cada batida mostra o que sobrou).
      limparAlvos(this.draft.esquadrao, this.draft.beats);
      this.recalcularElenco();
      this.desenharElenco();
      this.desenharLista();
      this.refrescarMapa();
    });
    const modoSelect = el('select', 'wargame-elenco-select') as HTMLSelectElement;
    modoSelect.title = 'Em que modo o episódio roda: o Comandante vê a partida que escolher, com a visão aérea e a IA dos dois lados';
    for (const m of Object.keys(MODO_ROTULO) as GameMode[]) modoSelect.append(opcao(m, MODO_ROTULO[m]));
    modoSelect.value = this.modo;
    modoSelect.addEventListener('change', () => {
      this.modo = modoSelect.value as GameMode;
      // Sobrevivência e Bandeira têm times próprios no jogo: o lado aliado do elenco não entra nesses dois (P292).
      this.say(this.modo === 'survival' || this.modo === 'ctf' ? 'Neste modo o jogo monta os times dele: o elenco de aliados não entra.' : 'Modo escolhido. Copie o link ou execute.');
    });
    const topo = el('div', 'wargame-topo');
    topo.append(nome, el('b', 'wargame-rotulo', 'ELENCO'), elencoSelect, el('b', 'wargame-rotulo', 'MODO'), modoSelect);

    this.mapa = new RoteiroMapa(this.o.planta);
    this.mapa.onClicar = (x, z) => this.aoClicarNoMapa(x, z);
    const coluna = el('div', 'wargame-coluna-mapa');
    coluna.append(this.mapa.el, el('p', 'wargame-legenda', 'Número = robô, no ponto onde nasce. Anel = ordem (o número da batida). Seta = quem vai até o ponto da batida em foco.'));

    this.quadroDoElenco = el('div', 'wargame-quem');
    this.desenharElenco();
    this.lista = el('div', 'wargame-lista');
    this.desenharLista();
    const cabecalho = el('div', 'wargame-batidas-topo');
    cabecalho.append(el('b', 'wargame-rotulo', 'BATIDAS'), botao('+ NOVA BATIDA', 'lado-botao', () => this.adicionarBatida()));
    const direita = el('div', 'wargame-coluna-batidas');
    direita.append(this.quadroDoElenco, cabecalho, this.lista);

    const corpo = el('div', 'wargame-corpo');
    corpo.append(coluna, direita);

    this.mensagem = el('p', 'wargame-mensagem', 'Escolha uma batida, diga QUEM faz o quê e clique no mapa para marcar o ponto. A legenda e a câmera são opcionais.');
    const rodape = el('div', 'lado-botoes wargame-rodape');
    rodape.append(
      botao('SALVAR', 'lado-botao', () => this.salvar()),
      botao('COPIAR LINK', 'lado-botao', () => void this.copiarLink()),
      botao('[ DEMO ]', 'lado-botao', () => this.demo()),
      botao('[ EXECUTAR ]', 'lado-botao primario', () => this.executar()),
      botao('[ FECHAR ]', 'lado-botao', () => this.fechar()),
    );

    placa.append(el('h3', 'wargame-titulo', 'WARGAME · CIDADE NEON'), topo, corpo, this.mensagem, rodape);
    fundo.append(placa);
    return fundo;
  }

  /** "Quem é quem": uma ficha por robô (número, nome, chassi), inimigos e aliados. Clicar numa ficha manda a batida em foco para esse robô. */
  private desenharElenco(): void {
    const quadro = this.quadroDoElenco;
    if (!quadro) return;
    quadro.replaceChildren();
    for (const lado of ['inimigo', 'aliado'] as const) {
      const robos = this.robos.filter((r) => r.lado === lado);
      const linha = el('div', `wargame-elenco-lado wargame-lado-${lado}`);
      linha.append(el('b', 'wargame-rotulo', `${lado === 'inimigo' ? 'INIMIGOS' : 'ALIADOS'} ${robos.length}`));
      if (robos.length === 0) linha.append(el('span', 'wargame-vazio', 'ninguém'));
      for (const r of robos) {
        const ficha = el('button', `wargame-ficha${r.ordenavel ? '' : ' wargame-ficha-parada'}`);
        ficha.type = 'button';
        ficha.title = r.ordenavel ? `${rotuloDoLado(lado)} ${r.numero} · ${r.nome} · ${r.corpo}. Clique para mandar a batida em foco para ele.` : `${r.nome} · ${r.corpo}: o técnico segue quem está avariado e não recebe ordem de posição.`;
        ficha.append(el('i', '', String(r.numero)), document.createTextNode(` ${r.corpo}`), el('small', '', r.nome));
        ficha.addEventListener('click', (e) => {
          e.stopPropagation();
          if (r.ordenavel) this.mandarFocoPara(r);
        });
        linha.append(ficha);
      }
      quadro.append(linha);
    }
  }

  private mandarFocoPara(r: RoboDoElenco): void {
    const b = this.foco === null ? undefined : this.draft.beats[this.foco];
    if (!b) {
      this.say('Escolha ou crie uma batida antes: a ficha manda a ordem da batida em foco para o robô.');
      return;
    }
    b.lado = r.lado;
    b.alvo = r.indice;
    if (!b.ordem) this.armado = this.foco;
    this.desenharLista();
    this.refrescarMapa();
    this.say(b.ordem ? `Batida ${this.foco}: agora só o ${rotuloDoLado(r.lado)} ${r.numero} (${r.corpo}) recebe a ordem.` : `Batida ${this.foco}: ${rotuloDoLado(r.lado)} ${r.numero}. Clique no mapa para marcar o ponto.`);
  }

  private desenharLista(): void {
    if (!this.lista) return;
    this.lista.replaceChildren();
    this.draft.beats.forEach((b, i) => this.lista!.append(this.linhaDaBatida(b, i)));
    if (this.draft.beats.length === 0) this.lista.append(el('p', 'wargame-vazio', 'Nenhuma batida ainda — comece por "+ NOVA BATIDA".'));
  }

  /** O que a seleção "QUEM" guarda: `''` (sem ordem), `inimigo:*` (o lado inteiro) ou `inimigo:2` (o robô de posição 2). */
  private valorDeQuem(b: BeatDoRoteiro): string {
    return !b.lado ? '' : b.alvo === undefined ? `${b.lado}:*` : `${b.lado}:${b.alvo}`;
  }

  private linhaDaBatida(b: BeatDoRoteiro, i: number): HTMLElement {
    const linha = el('div', 'wargame-linha');
    if (this.armado === i) linha.classList.add('wargame-armada');
    if (this.foco === i) linha.classList.add('wargame-foco');
    linha.addEventListener('click', () => this.focar(i));

    // ── o topo: o número da batida, o segundo em que dispara e tirar ───────────────────────────────
    const segundos = el('input', 'wargame-campo-curto') as HTMLInputElement;
    segundos.type = 'number';
    segundos.min = '0';
    segundos.step = '1';
    segundos.title = 'Segundo do episódio em que a batida dispara';
    segundos.value = String(Math.round(b.tick / 60));
    segundos.addEventListener('change', () => {
      const s = Math.max(0, Math.min(Math.round(LIMITES_DO_ROTEIRO.tickMax / 60), Number(segundos.value) || 0));
      b.tick = s * 60;
      this.ordenarEDesenhar();
    });
    const remover = botao('✕', 'wargame-remover', () => {
      this.draft.beats.splice(i, 1);
      if (this.armado === i) this.armado = null;
      else if (this.armado !== null && this.armado > i) this.armado--;
      this.foco = this.draft.beats.length ? Math.min(i, this.draft.beats.length - 1) : null;
      this.desenharLista();
      this.refrescarMapa();
    });
    remover.title = 'Tirar esta batida';
    const topo = el('div', 'wargame-linha-topo');
    const tempo = el('label', 'wargame-tempo');
    tempo.append('aos ', segundos, ' s');
    topo.append(el('span', 'wargame-num', `#${i}`), tempo, remover);

    // ── QUEM faz o quê ──────────────────────────────────────────────────────────────────────────────
    const quemSelect = el('select', 'wargame-quem-select') as HTMLSelectElement;
    quemSelect.title = 'Quem recebe a ordem: o lado inteiro ou um robô só';
    quemSelect.append(opcao('', '— sem ordem (só legenda ou câmera) —'));
    for (const lado of ['inimigo', 'aliado'] as const) {
      const grupo = el('optgroup') as HTMLOptGroupElement;
      grupo.label = lado === 'inimigo' ? 'INIMIGOS' : 'ALIADOS';
      const pode = this.robos.filter((r) => r.lado === lado && r.ordenavel);
      grupo.append(opcao(`${lado}:*`, `Todos os ${lado === 'inimigo' ? 'inimigos' : 'aliados'} (${pode.length})`));
      for (const r of pode) grupo.append(opcao(`${lado}:${r.indice}`, `${r.numero} · ${r.corpo} · ${r.nome}`));
      quemSelect.append(grupo);
    }
    quemSelect.value = this.valorDeQuem(b);
    const tipoSelect = el('select', 'wargame-tipo-select') as HTMLSelectElement;
    tipoSelect.append(opcao('hold', ORDEM_ROTULO.hold), opcao('follow', ORDEM_ROTULO.follow));
    tipoSelect.value = b.ordem?.tipo ?? 'hold';
    tipoSelect.disabled = !b.lado;
    const ordem = el('div', 'wargame-ordem');
    ordem.append(quemSelect, tipoSelect);

    // ── ONDE: o ponto, em palavras, e marcar no mapa ─────────────────────────────────────────────────
    const pontoTexto = el('span', 'wargame-ponto');
    const atualizarPonto = (): void => {
      pontoTexto.textContent = b.ordem ? descreverPonto(b.ordem.ponto, marcosDoMapa(this.o.planta)) : b.lado ? 'sem ponto: clique no mapa' : '';
      pontoTexto.classList.toggle('wargame-sem-ponto', !!b.lado && !b.ordem);
    };
    atualizarPonto();
    const marcarBtn = botao(this.armado === i ? 'CLIQUE NO MAPA…' : b.ordem ? 'MUDAR PONTO' : 'MARCAR NO MAPA', 'lado-botao', () => {
      this.armado = this.armado === i ? null : i;
      this.foco = i;
      this.desenharLista();
      this.refrescarMapa();
      if (this.armado === i) this.say('Clique no mapa para marcar o ponto da ordem.');
    });
    marcarBtn.disabled = !b.lado;
    const onde = el('div', 'wargame-onde');
    onde.append(marcarBtn, pontoTexto);

    quemSelect.addEventListener('change', () => {
      const v = quemSelect.value;
      if (!v) {
        delete b.lado;
        delete b.alvo;
        delete b.ordem;
        if (this.armado === i) this.armado = null;
      } else {
        const [lado, alvo] = v.split(':') as [LadoDoBot, string];
        b.lado = lado;
        if (alvo === '*') delete b.alvo;
        else b.alvo = Number(alvo);
        // Sem ponto ainda: o próximo clique no mapa o marca (nunca uma ordem escondida para o centro do mapa).
        if (!b.ordem) this.armado = i;
      }
      this.foco = i;
      this.desenharLista();
      this.refrescarMapa();
      if (v && !b.ordem) this.say('Clique no mapa para marcar o ponto da ordem.');
    });
    tipoSelect.addEventListener('change', () => {
      if (b.ordem) b.ordem.tipo = tipoSelect.value as TipoDeOrdem;
    });

    linha.append(topo, ordem, onde, this.extrasDaBatida(b));
    return linha;
  }

  /** A legenda e a câmera, recolhidas: são opcionais e a maioria das batidas não as usa. A faixa do resumo diz o que está ligado. */
  private extrasDaBatida(b: BeatDoRoteiro): HTMLElement {
    const detalhes = el('details', 'wargame-extra') as HTMLDetailsElement;
    const resumo = el('summary');
    const atualizarResumo = (): void => {
      const ligados = [b.legenda ? 'legenda' : '', b.camera ? 'câmera' : ''].filter(Boolean);
      resumo.textContent = ligados.length ? `legenda e câmera · ${ligados.join(' + ')}` : 'legenda e câmera';
    };
    atualizarResumo();
    detalhes.open = !!b.legenda || !!b.camera;
    detalhes.addEventListener('click', (e) => e.stopPropagation());

    const legendaTexto = el('input', 'wargame-campo-longo') as HTMLInputElement;
    legendaTexto.type = 'text';
    legendaTexto.maxLength = LEGENDA_MAX;
    legendaTexto.placeholder = 'Legenda na tela (opcional)';
    legendaTexto.value = b.legenda?.texto ?? '';
    const duracao = el('input', 'wargame-campo-curto') as HTMLInputElement;
    duracao.type = 'number';
    duracao.min = String(LIMITES_DO_ROTEIRO.duracaoMin);
    duracao.max = String(LIMITES_DO_ROTEIRO.duracaoMax);
    duracao.title = 'Segundos na tela';
    duracao.value = String(b.legenda?.duracaoS ?? 4);
    const aplicarLegenda = (): void => {
      const texto = legendaTexto.value.trim();
      if (!texto) delete b.legenda;
      else b.legenda = { texto, duracaoS: Math.max(LIMITES_DO_ROTEIRO.duracaoMin, Math.min(LIMITES_DO_ROTEIRO.duracaoMax, Number(duracao.value) || 4)) };
      atualizarResumo();
    };
    legendaTexto.addEventListener('input', aplicarLegenda);
    duracao.addEventListener('change', aplicarLegenda);
    const legendaGrupo = el('div', 'wargame-grupo');
    legendaGrupo.append(el('b', '', 'LEGENDA'), legendaTexto, duracao, el('span', 'wargame-ponto', 's'));

    const cameraTipo = el('select', '') as HTMLSelectElement;
    cameraTipo.append(opcao('', '— sem corte —'), opcao('fixa', 'Câmera fixa do mapa'), opcao('mech', 'Seguir um Mech'));
    cameraTipo.value = b.camera?.modo ?? '';
    const cameraValor = el('div', 'wargame-camera-valor');
    const desenharCameraValor = (): void => {
      cameraValor.replaceChildren();
      if (cameraTipo.value === 'fixa') {
        const s = el('select', '') as HTMLSelectElement;
        CAMERAS_DA_ARENA.forEach((c, idx) => s.append(opcao(String(idx), c.label)));
        s.value = String(b.camera?.modo === 'fixa' ? b.camera.indice : 0);
        s.addEventListener('change', () => { b.camera = { modo: 'fixa', indice: Number(s.value) }; });
        cameraValor.append(s);
        if (!b.camera || b.camera.modo !== 'fixa') b.camera = { modo: 'fixa', indice: 0 };
      } else if (cameraTipo.value === 'mech') {
        const s = el('select', '') as HTMLSelectElement;
        s.append(opcao('inimigo', 'dos INIMIGOS'), opcao('aliado', 'dos ALIADOS'));
        s.value = b.camera?.modo === 'mech' ? b.camera.lado : 'inimigo';
        const n = el('input', 'wargame-campo-curto') as HTMLInputElement;
        n.type = 'number';
        n.min = '1';
        n.title = 'O N-ésimo Mech vivo deste lado (1 = o primeiro da lista que ainda está de pé)';
        n.value = String((b.camera?.modo === 'mech' ? b.camera.ordinal : 0) + 1);
        const quem = el('span', 'wargame-ponto');
        const aplicarMech = (): void => {
          b.camera = { modo: 'mech', lado: s.value as LadoDoBot, ordinal: Math.max(0, Number(n.value) - 1) };
          // Quem é o Mech que a câmera pega quando todos estão de pé (o mesmo número da lista "quem é quem").
          const mechs = this.robos.filter((r) => r.lado === s.value && r.papel === 'mech');
          const r = mechs[b.camera.ordinal];
          quem.textContent = r ? `começa em ${r.corpo} · ${r.nome}` : 'não há tantos Mechs';
        };
        s.addEventListener('change', aplicarMech);
        n.addEventListener('change', aplicarMech);
        cameraValor.append(s, n, quem);
        aplicarMech();
      } else {
        delete b.camera;
      }
      atualizarResumo();
    };
    cameraTipo.addEventListener('change', desenharCameraValor);
    const cameraGrupo = el('div', 'wargame-grupo');
    cameraGrupo.append(el('b', '', 'CÂMERA'), cameraTipo, cameraValor);
    desenharCameraValor();

    detalhes.append(resumo, legendaGrupo, cameraGrupo);
    return detalhes;
  }

  /** Põe a batida em foco: as setas do mapa são as dela. Não refaz a lista (o campo que está sendo digitado não perde o foco). */
  private focar(i: number): void {
    if (this.foco === i) return;
    this.foco = i;
    this.lista?.querySelectorAll('.wargame-linha').forEach((linha, k) => linha.classList.toggle('wargame-foco', k === i));
    this.refrescarMapa();
  }

  private ordenarEDesenhar(): void {
    const emFoco = this.foco === null ? undefined : this.draft.beats[this.foco];
    const armada = this.armado === null ? undefined : this.draft.beats[this.armado];
    this.draft.beats.sort((a, b2) => a.tick - b2.tick);
    // Os índices mudam com a ordem por segundo: o foco e a batida armada seguem a mesma batida.
    if (emFoco) this.foco = this.draft.beats.indexOf(emFoco);
    if (armada) this.armado = this.draft.beats.indexOf(armada);
    this.desenharLista();
    this.refrescarMapa();
  }

  private adicionarBatida(): void {
    if (this.draft.beats.length >= LIMITES_DO_ROTEIRO.beats) {
      this.say(`No máximo ${LIMITES_DO_ROTEIRO.beats} batidas.`);
      return;
    }
    const ultimoTick = this.draft.beats.at(-1)?.tick ?? -60;
    this.draft.beats.push({ tick: ultimoTick + 60 });
    this.foco = this.draft.beats.length - 1;
    this.desenharLista();
    this.refrescarMapa();
    this.lista?.lastElementChild?.scrollIntoView({ block: 'nearest' });
    this.say('Batida nova: escolha QUEM faz o quê (ou só uma legenda ou câmera).');
  }

  private aoClicarNoMapa(x: number, z: number): void {
    if (this.armado === null) return;
    const b = this.draft.beats[this.armado];
    if (!b || !b.lado) return;
    b.ordem = { tipo: b.ordem?.tipo ?? 'hold', ponto: { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 } };
    this.foco = this.armado;
    this.armado = null;
    this.desenharLista();
    this.refrescarMapa();
    const quem = afetadosPelaBatida(this.robos, b);
    this.say(quem.length === 1 ? `Ponto marcado: vai o ${rotuloDoLado(quem[0]!.lado)} ${quem[0]!.numero} (${quem[0]!.corpo}).` : `Ponto marcado: vão ${quem.length} robôs.`);
  }

  private refrescarMapa(): void {
    this.mapa?.atualizar(desenhoDoMapa(this.robos, this.draft.beats, this.armado ?? this.foco));
  }

  private say(texto: string): void {
    if (this.mensagem) this.mensagem.textContent = texto;
  }

  private salvar(): void {
    const r = this.o.store.save(this.draft);
    if (r === 'sem-nome') this.say('Dê um nome ao episódio para salvar (o EXECUTAR funciona sem nome).');
    else if (r === 'cheio') this.say(`Já há ${LIMITES_DO_ROTEIRO.beats} roteiros salvos — apague um antes de salvar outro.`);
    else if (r === 'sem-armazenamento') this.say('Não consegui salvar neste aparelho (armazenamento indisponível).');
    else this.say('Salvo neste aparelho.');
  }

  /**
   * O endereço que roda este episódio no modo escolhido (P292). Tira o `wargame=` e o `modo=` que a página tinha e põe os do episódio;
   * o Deathmatch não leva `modo=` (é o padrão do jogo).
   */
  private urlDoEpisodio(r: RoteiroSpec): string {
    const base = new URL(withoutParam(withoutParam(location.href, PARAM_DO_ROTEIRO), 'modo'));
    const partes = [base.search.replace(/^\?/, ''), this.modo === 'deathmatch' ? '' : `modo=${this.modo}`, `${PARAM_DO_ROTEIRO}=${chaveDoRoteiro(r)}`].filter(Boolean);
    return `${base.origin}${base.pathname}?${partes.join('&')}${base.hash}`;
  }

  /** O DEMO: o mesmo elenco, sem batidas (só a visão aérea e a IA dos dois lados), no modo escolhido (P292). */
  private demo(): void {
    location.assign(this.urlDoEpisodio({ ...this.draft, beats: [] }));
  }

  private async copiarLink(): Promise<void> {
    const texto = this.urlDoEpisodio(this.draft);
    try {
      await navigator.clipboard.writeText(texto);
      this.say('Link copiado.');
    } catch {
      this.say(`Copie o link: ${texto}`);
    }
  }

  private executar(): void {
    location.assign(this.urlDoEpisodio(this.draft));
  }
}
