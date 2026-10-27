import type { RoteiroStore } from '../core/RoteiroStore';
import { withoutParam } from '../core/url';
import { camerasDoMapa } from '../camera/camerasDoMapa';
import { esquadraoPadrao, resumoDoEsquadrao, type EsquadraoSpec, type LadoDoBot } from '../sim/esquadrao';
import {
  chaveDoRoteiro,
  LEGENDA_MAX,
  LIMITES_DO_ROTEIRO,
  PARAM_DO_ROTEIRO,
  roteiroPadrao,
  sanearRoteiro,
  type BeatDoRoteiro,
  type RoteiroSpec,
  type TipoDeOrdem,
} from '../sim/Roteiro';
import { RoteiroMapa, type PlantaEstatica } from './RoteiroMapa';

/** O que a janela precisa do jogo (o `Game.ts` só liga: G3). */
export interface WargamePanelOptions {
  store: RoteiroStore;
  /** A planta estática da Arena (v1: só este mapa — `camerasDoMapa` ainda não tem câmeras fixas nos outros). */
  planta: PlantaEstatica;
  /** O esquadrão que o Comandante salvou no editor de esquadrão (tela ESQUADRÃO), ou `null` se não há. */
  esquadraoMeu: () => EsquadraoSpec | null;
  /** `null` = a janela abre normal; senão o motivo em palavras (v1: só funciona com a partida já na Cidade Neon). */
  indisponivel: () => string | null;
}

const LADO_ROTULO: Readonly<Record<LadoDoBot, string>> = { inimigo: 'INIMIGO', aliado: 'ALIADO' };
const ORDEM_ROTULO: Readonly<Record<TipoDeOrdem, string>> = { hold: 'Segurar aqui', follow: 'Avançar/agrupar aqui' };
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
 * O PAINEL WARGAME (P262: "transformar a gameplay num filme roteirizado"): monta um episódio de IA contra IA —
 * o elenco (os dois esquadrões, reaproveitando a tela ESQUADRÃO existente: escolhe **padrão** ou **o meu**, como a
 * tela CAMPANHA já faz para as etapas) e uma lista de **batidas** (um momento do episódio: ordem de combate para um
 * esquadrão, legenda e/ou corte de câmera), marcadas clicando no mapa (`RoteiroMapa`). **EXECUTAR** carrega o jogo
 * com o link do roteiro (`?wargame=`); `Game.ts` entra direto no modo espectador (nunca o Comandante jogando).
 * Só abre no modo Comandante; pedaço sob demanda (R7). Módulo independente (G3).
 */
export class WargamePanel {
  private modal: HTMLElement | null = null;
  private draft: RoteiroSpec = roteiroPadrao();
  private elenco: 'padrao' | 'meu' = 'padrao';
  /** Índice da batida armada para o próximo clique no mapa (`null` = nenhuma). */
  private armado: number | null = null;
  private mapa: RoteiroMapa | null = null;
  private lista: HTMLElement | null = null;
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
    this.elenco = this.ehOMeuElenco(this.draft.esquadrao) ? 'meu' : 'padrao';
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
    elencoSelect.value = this.elenco;
    const elencoResumo = el('span', 'wargame-elenco-resumo');
    const atualizarResumo = (): void => {
      const r = resumoDoEsquadrao(this.draft.esquadrao);
      elencoResumo.textContent = `${r.inimigos} inimigo${r.inimigos === 1 ? '' : 's'} · ${r.aliados} aliado${r.aliados === 1 ? '' : 's'}`;
    };
    elencoSelect.addEventListener('change', () => {
      this.elenco = elencoSelect.value === 'meu' ? 'meu' : 'padrao';
      this.draft.esquadrao = this.elenco === 'meu' ? (this.o.esquadraoMeu() ?? esquadraoPadrao()) : esquadraoPadrao();
      atualizarResumo();
    });
    atualizarResumo();
    const elencoLinha = el('div', 'wargame-elenco');
    elencoLinha.append(el('b', '', 'ELENCO'), elencoSelect, elencoResumo);

    this.mapa = new RoteiroMapa(this.o.planta);
    this.mapa.onClicar = (x, z) => this.aoClicarNoMapa(x, z);

    this.lista = el('div', 'wargame-lista');
    this.desenharLista();

    const corpo = el('div', 'wargame-corpo');
    corpo.append(this.mapa.el, this.lista);

    const adicionar = botao('+ NOVA BATIDA', 'lado-botao', () => this.adicionarBatida());
    this.mensagem = el('p', 'wargame-mensagem', 'Marque uma ordem no mapa, escreva uma legenda ou escolha uma câmera por batida.');
    const rodape = el('div', 'lado-botoes wargame-rodape');
    rodape.append(
      botao('SALVAR', 'lado-botao', () => this.salvar()),
      botao('COPIAR LINK', 'lado-botao', () => void this.copiarLink()),
      botao('[ EXECUTAR ]', 'lado-botao primario', () => this.executar()),
      botao('[ FECHAR ]', 'lado-botao', () => this.fechar()),
    );

    placa.append(el('h3', 'wargame-titulo', 'WARGAME · CIDADE NEON'), nome, elencoLinha, corpo, adicionar, this.mensagem, rodape);
    fundo.append(placa);
    return fundo;
  }

  private desenharLista(): void {
    if (!this.lista) return;
    this.lista.replaceChildren();
    this.draft.beats.forEach((b, i) => this.lista!.append(this.linhaDaBatida(b, i)));
    if (this.draft.beats.length === 0) this.lista.append(el('p', 'wargame-vazio', 'Nenhuma batida ainda — comece por "+ NOVA BATIDA".'));
  }

  private linhaDaBatida(b: BeatDoRoteiro, i: number): HTMLElement {
    const linha = el('div', 'wargame-linha');
    if (this.armado === i) linha.classList.add('wargame-armada');

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

    const ladoSelect = el('select', '') as HTMLSelectElement;
    ladoSelect.append(opcao('', '— sem ordem —'), opcao('inimigo', LADO_ROTULO.inimigo), opcao('aliado', LADO_ROTULO.aliado));
    ladoSelect.value = b.lado ?? '';
    const tipoSelect = el('select', '') as HTMLSelectElement;
    tipoSelect.append(opcao('hold', ORDEM_ROTULO.hold), opcao('follow', ORDEM_ROTULO.follow));
    tipoSelect.value = b.ordem?.tipo ?? 'hold';
    tipoSelect.disabled = !b.lado;
    const pontoTexto = el('span', 'wargame-ponto', b.ordem ? `(${b.ordem.ponto.x}, ${b.ordem.ponto.z})` : 'sem ponto');
    const marcarBtn = botao('MARCAR NO MAPA', 'lado-botao', () => {
      this.armado = this.armado === i ? null : i;
      this.desenharLista();
    });
    marcarBtn.disabled = !b.lado;

    const aplicarLado = (): void => {
      const lado = ladoSelect.value as LadoDoBot | '';
      if (!lado) {
        delete b.lado;
        delete b.ordem;
      } else {
        b.lado = lado;
        if (!b.ordem) b.ordem = { tipo: 'hold', ponto: { x: 0, z: 0 } };
      }
      tipoSelect.disabled = !lado;
      marcarBtn.disabled = !lado;
      pontoTexto.textContent = b.ordem ? `(${b.ordem.ponto.x}, ${b.ordem.ponto.z})` : 'sem ponto';
      if (!lado && this.armado === i) this.armado = null;
    };
    ladoSelect.addEventListener('change', aplicarLado);
    tipoSelect.addEventListener('change', () => {
      if (b.ordem) b.ordem.tipo = tipoSelect.value as TipoDeOrdem;
    });
    const ordemGrupo = el('div', 'wargame-grupo');
    ordemGrupo.append(el('b', '', 'ORDEM'), ladoSelect, tipoSelect, marcarBtn, pontoTexto);

    const legendaTexto = el('input', 'wargame-campo-longo') as HTMLInputElement;
    legendaTexto.type = 'text';
    legendaTexto.maxLength = LEGENDA_MAX;
    legendaTexto.placeholder = 'Legenda (opcional)';
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
    };
    legendaTexto.addEventListener('input', aplicarLegenda);
    duracao.addEventListener('change', aplicarLegenda);
    const legendaGrupo = el('div', 'wargame-grupo');
    legendaGrupo.append(el('b', '', 'LEGENDA'), legendaTexto, duracao);

    const cameraTipo = el('select', '') as HTMLSelectElement;
    cameraTipo.append(opcao('', '— sem corte —'), opcao('fixa', 'Câmera fixa do mapa'), opcao('mech', 'Mech de um esquadrão'));
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
        s.append(opcao('inimigo', LADO_ROTULO.inimigo), opcao('aliado', LADO_ROTULO.aliado));
        s.value = b.camera?.modo === 'mech' ? b.camera.lado : 'inimigo';
        const n = el('input', 'wargame-campo-curto') as HTMLInputElement;
        n.type = 'number';
        n.min = '1';
        n.title = 'O N-ésimo Mech vivo deste lado (1 = o primeiro)';
        n.value = String((b.camera?.modo === 'mech' ? b.camera.ordinal : 0) + 1);
        const aplicarMech = (): void => { b.camera = { modo: 'mech', lado: s.value as LadoDoBot, ordinal: Math.max(0, Number(n.value) - 1) }; };
        s.addEventListener('change', aplicarMech);
        n.addEventListener('change', aplicarMech);
        cameraValor.append(s, n);
        if (!b.camera || b.camera.modo !== 'mech') aplicarMech();
      } else {
        delete b.camera;
      }
    };
    cameraTipo.addEventListener('change', desenharCameraValor);
    const cameraGrupo = el('div', 'wargame-grupo');
    cameraGrupo.append(el('b', '', 'CÂMERA'), cameraTipo, cameraValor);
    desenharCameraValor();

    const remover = botao('✕', 'wargame-remover', () => {
      this.draft.beats.splice(i, 1);
      if (this.armado === i) this.armado = null;
      this.desenharLista();
      this.refrescarMapa();
    });

    linha.append(segundos, ordemGrupo, legendaGrupo, cameraGrupo, remover);
    return linha;
  }

  private ordenarEDesenhar(): void {
    this.draft.beats.sort((a, b2) => a.tick - b2.tick);
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
    this.desenharLista();
  }

  private aoClicarNoMapa(x: number, z: number): void {
    if (this.armado === null) return;
    const b = this.draft.beats[this.armado];
    if (!b || !b.lado) return;
    b.ordem = { tipo: b.ordem?.tipo ?? 'hold', ponto: { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 } };
    this.armado = null;
    this.desenharLista();
    this.refrescarMapa();
  }

  private refrescarMapa(): void {
    const pontos = this.draft.beats.flatMap((b) => (b.lado && b.ordem ? [{ lado: b.lado, x: b.ordem.ponto.x, z: b.ordem.ponto.z }] : []));
    this.mapa?.atualizarPontos(pontos);
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

  private async copiarLink(): Promise<void> {
    const base = new URL(withoutParam(location.href, PARAM_DO_ROTEIRO));
    const texto = `${base.origin}${base.pathname}${base.search}${base.search ? '&' : '?'}${PARAM_DO_ROTEIRO}=${chaveDoRoteiro(this.draft)}${base.hash}`;
    try {
      await navigator.clipboard.writeText(texto);
      this.say('Link copiado.');
    } catch {
      this.say(`Copie o link: ${texto}`);
    }
  }

  private executar(): void {
    const base = new URL(withoutParam(location.href, PARAM_DO_ROTEIRO));
    location.assign(`${base.pathname}${base.search}${base.search ? '&' : '?'}${PARAM_DO_ROTEIRO}=${chaveDoRoteiro(this.draft)}${base.hash}`);
  }
}
