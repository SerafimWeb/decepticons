import * as THREE from 'three';
import { PRAIA_COMPLEXO, PRAIA_ESTACAO } from '../environment/PraiaLayout';
import { PORTAS_DA_ESTACAO } from '../sim/PortasDaEstacao';
import { AlertaDoNucleo, AnunciadorDeLugar, avisoDeAgua, avisoDasPortas, avisoDoQuadro, avisoDosCabos, CARTAO_DA_MISSAO, FAIXA_ALCANCE_M, fracaoNaFaixa, MARCOS_DA_FAIXA, marcadorNaTela, textoDeDistancia, type AvisoDeAgua, type MargensDaTela, type MarcadorNaTela } from './praiaHudData';

/**
 * O HUD da PRAIA DOS CABOS (P127): o que um mapa de 640 m pede e os outros não. Quatro peças, todas só no mapa da praia:
 *  - **a faixa da costa** (embaixo do banner da missão): o mapa inteiro numa linha — o porto, a ponte, a estação, você e os inimigos
 *    que estão a até 260 m — para saber de relance onde está a luta e quanto falta para a estação;
 *  - **o marcador da estação** sobre o alvo, com a distância, preso à borda quando ele sai da tela (o objetivo nunca some);
 *  - **o anúncio do lugar** ("PONTE METÁLICA", "AV. BEIRA-MAR"...), uma vez a cada vez que o jogador muda de lugar;
 *  - **o aviso da água**: vadeando (freia) ou no fundo (o relógio do afogamento), com uma névoa azul nas bordas da tela.
 * E o **cartão da missão** (a história em três linhas), mostrado uma vez ao começar.
 *
 * **Custo:** a faixa e os textos se atualizam a 5 Hz e só escrevem no DOM o que mudou; o marcador é um `transform` por quadro (uma
 * projeção, sem alocar). Fora da praia nada disto é criado.
 */

/** Os estados do cabo de dados, na ordem dos códigos de `CabosDeDados` (o `data-estado` da célula no CSS). */
const ESTADO_DO_CABO = ['livre', 'injetando', 'tomado', 'cortado'] as const;

/** Os estados da porta, na ordem dos códigos de `PortasDaEstacao` (o `data-estado` da célula no CSS) e os nomes que o aviso usa. */
const ESTADO_DA_PORTA = ['fechada', 'forcada', 'arrombada'] as const;
const NOMES_DAS_PORTAS = PORTAS_DA_ESTACAO.map((p) => p.nome);
/** Os estados do quadro de luz, na ordem dos códigos de `QuadroDeLuz` (o `data-estado` da célula no CSS). */
const ESTADO_DO_QUADRO = ['ligado', 'sabotado', 'apagado'] as const;

const MARGENS: MargensDaTela = { topo: 194, base: 175, esq: 28, dir: 44 };
const PONTOS_DE_INIMIGO = 32;
const PERIODO_DA_FAIXA_S = 0.2;
const CARTAO_S = 8;

const _v = new THREE.Vector3();

export interface QuadroDaPraia {
  /** O jogador joga agora (não está pausado, no Hangar ou morto)? Fora disso o HUD some. */
  ativo: boolean;
  eu: { x: number; z: number; alive: boolean };
  /** Inimigos vivos (qualquer lista de robôs: só `x`, `z` e `alive` importam). */
  inimigos: readonly { alive: boolean; simPosition: { x: number; z: number } }[];
  agua: { fundura: number; afogandoS: number; afogarS: number; afogaDesde: number };
  /** O núcleo da estação (a rede): `presente` é falso fora da missão em ondas. */
  nucleo: { presente: boolean; fracao: number; pressao: number };
  /** Os três cabos de dados (P162): por cabo, o estado (0 livre, 1 injetando, 2 tomado, 3 cortado), a vida e a injeção de 0 a 1. `presente` é falso fora da missão em ondas. */
  cabos: { presente: boolean; estado: number[]; vida: number[]; injecao: number[] };
  /** As duas portas do prédio (P163): por porta, o estado (0 fechada, 1 forçada, 2 arrombada) e a vida de 0 a 1. `presente` é falso fora da missão em ondas. */
  portas: { presente: boolean; estado: number[]; vida: number[] };
  /** O quadro de luz da cidade (P164): o estado (0 ligado, 1 sabotado, 2 apagado) e a vida de 0 a 1. `presente` é falso fora da missão em ondas. */
  quadro: { presente: boolean; estado: number; vida: number };
  camera: THREE.Camera;
  largura: number;
  altura: number;
}

/** O quadro que o jogo reaproveita a cada frame (G4: nada de objeto novo por quadro): `Game` escreve nele e chama `update`. */
export function novoQuadroDaPraia(camera: THREE.Camera): QuadroDaPraia {
  return {
    ativo: false,
    eu: { x: 0, z: 0, alive: false },
    inimigos: [],
    agua: { fundura: 0, afogandoS: 0, afogarS: 0, afogaDesde: 0.05 },
    nucleo: { presente: false, fracao: 1, pressao: 0 },
    cabos: { presente: false, estado: [0, 0, 0], vida: [1, 1, 1], injecao: [0, 0, 0] },
    portas: { presente: false, estado: [0, 0], vida: [1, 1] },
    quadro: { presente: false, estado: 0, vida: 1 },
    camera,
    largura: 0,
    altura: 0,
  };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, pai?: HTMLElement, texto?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  pai?.appendChild(e);
  return e;
}

export class PraiaHud {
  private readonly raiz: HTMLElement;
  private readonly faixa: HTMLElement;
  private readonly euNaFaixa: HTMLElement;
  private readonly alvoNaFaixa: HTMLElement;
  private readonly pontos: HTMLElement[] = [];
  private readonly zona: HTMLElement;
  private readonly cartao: HTMLElement;
  private readonly agua: HTMLElement;
  private readonly aguaTexto: HTMLElement;
  private readonly aguaBarra: HTMLElement;
  private readonly alvo: HTMLElement;
  private readonly alvoDistancia: HTMLElement;
  private readonly anunciador = new AnunciadorDeLugar();
  private readonly alertaDoNucleo = new AlertaDoNucleo();
  private readonly nucleo: HTMLElement;
  private readonly nucleoPct: HTMLElement;
  private readonly nucleoBarra: HTMLElement;
  private readonly alvoNome: HTMLElement;
  /** Os três cabos de dados (P162): o painel, e por cabo a célula, a barra de vida e a de injeção. */
  private readonly cabos: HTMLElement;
  private readonly celulasDosCabos: { celula: HTMLElement; vida: HTMLElement; injecao: HTMLElement; pct: string }[] = [];
  private readonly estadosDosCabos = [0, 0, 0];
  /** As duas portas do prédio (P163): o painel, a célula e a barra de vida de cada uma. */
  private readonly portas: HTMLElement;
  private readonly celulasDasPortas: { celula: HTMLElement; vida: HTMLElement; pct: string }[] = [];
  private readonly estadosDasPortas = [0, 0];
  /** O quadro de luz da cidade (P164): a célula e a barra de vida. */
  private readonly quadro: HTMLElement;
  private readonly quadroVida: HTMLElement;
  private quadroEstado = 0;
  private quadroChave = '';
  private nucleoMostrado = -1;
  private nucleoClasse = '';
  private periodo = 0;
  private zonaS = 0;
  private cartaoS = 0;
  private mostradoCartao = false;
  private textoDaAgua = '';
  private nivelDaAgua = '';
  private distanciaMostrada = '';
  /** Nasce escondido (a `raiz` nasce `hidden`): o primeiro `setVisivel(true)` o mostra. */
  private visivel = false;
  /** O `#hud` inteiro: ganha a classe `hud-praia` enquanto este HUD está à vista (o escurecimento do topo, P139). */
  private readonly pai: HTMLElement;
  /** Objetos reaproveitados a cada quadro (G4): o lugar do marcador, o aviso da água e a última posição escrita no DOM. */
  private readonly marca: MarcadorNaTela = { x: 0, y: 0, naBorda: false };
  private readonly aviso: AvisoDeAgua = { nivel: 'seco', progresso: 0, texto: '' };
  private marcaX = -1e9;
  private marcaY = -1e9;
  private marcaNaBorda = false;

  constructor(hud: HTMLElement) {
    this.pai = hud;
    this.raiz = el('div', 'praia-hud', hud);
    this.raiz.hidden = true;

    this.faixa = el('div', 'praia-faixa', this.raiz);
    this.faixa.setAttribute('aria-hidden', 'true');
    const trilho = el('div', 'pf-trilho', this.faixa);
    // Os dois trechos que mandam no mapa: o porto (oeste, laranja) e o complexo da estação (leste, ciano).
    const porto = el('i', 'pf-trecho pf-t-porto', trilho);
    porto.style.width = `${fracaoNaFaixa(-226) * 100}%`;
    const complexo = el('i', 'pf-trecho pf-t-estacao', trilho);
    complexo.style.left = `${fracaoNaFaixa(PRAIA_COMPLEXO.minX) * 100}%`;
    complexo.style.right = '0';
    for (const m of MARCOS_DA_FAIXA) {
      const marco = el('span', `pf-marco pf-${m.id}`, this.faixa, m.texto);
      marco.style.left = `${fracaoNaFaixa(m.x) * 100}%`;
    }
    this.alvoNaFaixa = el('b', 'pf-alvo', this.faixa);
    this.alvoNaFaixa.style.left = `${fracaoNaFaixa(PRAIA_ESTACAO.x) * 100}%`;
    for (let i = 0; i < PONTOS_DE_INIMIGO; i++) {
      const p = el('i', 'pf-inimigo', this.faixa);
      p.hidden = true;
      this.pontos.push(p);
    }
    this.euNaFaixa = el('b', 'pf-eu', this.faixa);

    // A rede da estação (o núcleo): uma barra fina sob a faixa, só na missão em ondas.
    this.nucleo = el('div', 'praia-nucleo', this.raiz);
    this.nucleo.hidden = true;
    el('span', '', this.nucleo, 'REDE DA ESTAÇÃO');
    this.nucleoPct = el('b', '', this.nucleo, '100%');
    this.nucleoBarra = el('i', '', el('div', 'pn-barra', this.nucleo));

    // Os cabos de dados (P162): três células sob a rede da estação, cada uma com a vida do cabo (ciano) e a injeção dos andróides (vermelho).
    this.cabos = el('div', 'praia-cabos', this.raiz);
    this.cabos.hidden = true;
    for (let i = 0; i < 3; i++) {
      const celula = el('div', 'pc-cabo', this.cabos);
      el('span', '', celula, `CABO ${i + 1}`);
      const vida = el('i', 'pc-vida', el('div', 'pc-barra', celula));
      const injecao = el('i', 'pc-inj', el('div', 'pc-barra', celula));
      this.celulasDosCabos.push({ celula, vida, injecao, pct: '' });
    }

    // As portas do prédio (P163): duas células sob os cabos, com a vida da porta; laranja forçada, vermelha arrombada.
    this.portas = el('div', 'praia-portas', this.raiz);
    this.portas.hidden = true;
    for (const p of PORTAS_DA_ESTACAO) {
      const celula = el('div', 'pp-porta', this.portas);
      el('span', '', celula, p.nome);
      const vida = el('i', 'pc-vida', el('div', 'pc-barra', celula));
      this.celulasDasPortas.push({ celula, vida, pct: '' });
    }

    // O quadro de luz da cidade (P164): uma célula sob as portas, com a vida do quadro; laranja sabotado, vermelha apagado.
    this.quadro = el('div', 'praia-quadro', this.raiz);
    this.quadro.hidden = true;
    el('span', '', this.quadro, 'QUADRO DE LUZ DA CIDADE');
    this.quadroVida = el('i', 'pc-vida', el('div', 'pc-barra', this.quadro));

    this.zona = el('div', 'praia-zona', this.raiz);

    this.cartao = el('div', 'praia-cartao', this.raiz);
    el('h2', '', this.cartao, CARTAO_DA_MISSAO.titulo);
    for (const l of CARTAO_DA_MISSAO.linhas) el('p', '', this.cartao, l);
    this.cartao.hidden = true;

    el('div', 'praia-vinheta', this.raiz);
    this.agua = el('div', 'praia-agua', this.raiz);
    this.aguaTexto = el('div', 'pa-texto', this.agua);
    const trilhoDaAgua = el('div', 'pa-barra', this.agua);
    this.aguaBarra = el('i', '', trilhoDaAgua);
    this.agua.hidden = true;

    this.alvo = el('div', 'praia-alvo', this.raiz);
    el('i', '', this.alvo);
    this.alvoNome = el('b', '', this.alvo, 'ESTAÇÃO');
    this.alvoDistancia = el('span', '', this.alvo);
  }

  /** Mostra ou esconde o HUD inteiro (a partida pausada, o Hangar, morto). */
  setVisivel(v: boolean): void {
    if (v === this.visivel) return;
    this.visivel = v;
    this.raiz.hidden = !v;
    this.pai.classList.toggle('hud-praia', v);
  }

  /** Uma partida nova: o anúncio do lugar e o cartão da missão voltam a valer. */
  reset(): void {
    this.anunciador.reset();
    this.alertaDoNucleo.reset();
    this.nucleoMostrado = -1;
    this.estadosDosCabos.fill(0);
    this.estadosDasPortas.fill(0);
    this.quadroEstado = 0;
    this.quadroChave = '';
    for (const c of this.celulasDasPortas) c.pct = '';
    for (const c of this.celulasDosCabos) c.pct = '';
    this.mostradoCartao = false;
    this.cartaoS = 0;
    this.cartao.hidden = true;
  }

  update(dt: number, q: QuadroDaPraia): void {
    const ligado = q.ativo && q.eu.alive;
    this.setVisivel(ligado);
    if (!ligado) return;

    // O cartão da missão: uma vez, ao começar a jogar.
    if (!this.mostradoCartao) {
      this.mostradoCartao = true;
      this.cartaoS = CARTAO_S;
      this.cartao.hidden = false;
    } else if (this.cartaoS > 0) {
      this.cartaoS -= dt;
      if (this.cartaoS <= 0) this.cartao.hidden = true;
    }

    // O núcleo da estação: o alerta (invasores, 75/50/25%, a queda) toma o lugar do anúncio do lugar, em vermelho.
    const rede = q.nucleo;
    const alertaDaRede = rede.presente ? this.alertaDoNucleo.atualiza(rede.fracao, rede.pressao) : null;
    const alertaDosCabos = q.cabos.presente ? avisoDosCabos(this.estadosDosCabos, q.cabos.estado) : null;
    const alertaDasPortas = q.portas.presente ? avisoDasPortas(this.estadosDasPortas, q.portas.estado, NOMES_DAS_PORTAS) : null;
    const alertaDoQuadro = q.quadro.presente ? avisoDoQuadro(this.quadroEstado, q.quadro.estado) : null;
    const alerta = alertaDaRede ?? alertaDasPortas ?? alertaDoQuadro ?? alertaDosCabos;
    // O anúncio do lugar: aparece e some sozinho (a animação é do CSS; aqui só o texto e o relógio).
    const novo = alerta ?? this.anunciador.atualiza(q.eu.x, q.eu.z, dt);
    if (novo) {
      this.zona.textContent = novo;
      this.zona.classList.toggle('alerta', alerta !== null);
      this.zona.classList.remove('on');
      void this.zona.offsetWidth; // reinicia a animação de entrada
      this.zona.classList.add('on');
      this.zonaS = 3.2;
    } else if (this.zonaS > 0) {
      this.zonaS -= dt;
      if (this.zonaS <= 0) this.zona.classList.remove('on');
    }

    if (rede.presente) {
      this.nucleo.hidden = false;
      const pct = Math.round(rede.fracao * 100);
      const classe = rede.pressao > 0 ? 'ataque' : rede.fracao < 0.35 ? 'critico' : '';
      if (pct !== this.nucleoMostrado) {
        this.nucleoMostrado = pct;
        this.nucleoPct.textContent = `${pct}%`;
        this.alvoNome.textContent = `ESTAÇÃO ${pct}%`;
        this.nucleoBarra.style.transform = `scaleX(${rede.fracao.toFixed(3)})`;
      }
      if (classe !== this.nucleoClasse) {
        this.nucleoClasse = classe;
        this.nucleo.dataset.estado = classe;
        this.alvo.dataset.estado = classe;
      }
    } else if (!this.nucleo.hidden) {
      this.nucleo.hidden = true;
    }

    // Os cabos de dados: as três células só mexem no DOM quando o estado ou a barra (em passos de 2%) muda.
    if (q.cabos.presente) {
      this.cabos.hidden = false;
      for (let i = 0; i < this.celulasDosCabos.length; i++) {
        const c = this.celulasDosCabos[i]!;
        const estado = q.cabos.estado[i] ?? 0;
        const vida = Math.round((q.cabos.vida[i] ?? 1) * 50);
        const injecao = Math.round((q.cabos.injecao[i] ?? 0) * 50);
        const chave = `${estado}|${vida}|${injecao}`;
        if (chave !== c.pct) {
          c.pct = chave;
          c.celula.dataset.estado = ESTADO_DO_CABO[estado] ?? 'livre';
          c.vida.style.transform = `scaleX(${(vida / 50).toFixed(2)})`;
          c.injecao.style.transform = `scaleX(${(injecao / 50).toFixed(2)})`;
        }
        this.estadosDosCabos[i] = estado;
      }
    } else if (!this.cabos.hidden) {
      this.cabos.hidden = true;
    }

    // As portas do prédio: as duas células só mexem no DOM quando o estado ou a barra (em passos de 2%) muda.
    if (q.portas.presente) {
      this.portas.hidden = false;
      for (let i = 0; i < this.celulasDasPortas.length; i++) {
        const c = this.celulasDasPortas[i]!;
        const estado = q.portas.estado[i] ?? 0;
        const vida = Math.round((q.portas.vida[i] ?? 1) * 50);
        const chave = `${estado}|${vida}`;
        if (chave !== c.pct) {
          c.pct = chave;
          c.celula.dataset.estado = ESTADO_DA_PORTA[estado] ?? 'fechada';
          c.vida.style.transform = `scaleX(${(vida / 50).toFixed(2)})`;
        }
        this.estadosDasPortas[i] = estado;
      }
    } else if (!this.portas.hidden) {
      this.portas.hidden = true;
    }

    // O quadro de luz da cidade: a célula só mexe no DOM quando o estado ou a barra (em passos de 2%) muda.
    if (q.quadro.presente) {
      this.quadro.hidden = false;
      const vida = Math.round(q.quadro.vida * 50);
      const chave = `${q.quadro.estado}|${vida}`;
      if (chave !== this.quadroChave) {
        this.quadroChave = chave;
        this.quadro.dataset.estado = ESTADO_DO_QUADRO[q.quadro.estado] ?? 'ligado';
        this.quadroVida.style.transform = `scaleX(${(vida / 50).toFixed(2)})`;
      }
      this.quadroEstado = q.quadro.estado;
    } else if (!this.quadro.hidden) {
      this.quadro.hidden = true;
    }

    // O aviso da água, a cada quadro enquanto há água (uma comparação), com o DOM só quando muda.
    const aviso = avisoDeAgua(q.agua.fundura, q.agua.afogandoS, q.agua.afogarS, q.agua.afogaDesde, this.aviso);
    if (aviso.nivel !== this.nivelDaAgua) {
      this.nivelDaAgua = aviso.nivel;
      this.agua.hidden = aviso.nivel === 'seco';
      this.agua.dataset.nivel = aviso.nivel;
      this.raiz.dataset.agua = aviso.nivel;
    }
    if (aviso.nivel !== 'seco') {
      if (aviso.texto !== this.textoDaAgua) {
        this.textoDaAgua = aviso.texto;
        this.aguaTexto.textContent = aviso.texto;
      }
      this.aguaBarra.style.transform = `scaleX(${aviso.progresso.toFixed(3)})`;
    }

    // O marcador da estação sobre o alvo (uma projeção por quadro; sem alocar).
    _v.set(PRAIA_ESTACAO.x, 22, PRAIA_ESTACAO.z).applyMatrix4(q.camera.matrixWorldInverse);
    const atras = _v.z > 0;
    _v.applyMatrix4(q.camera.projectionMatrix);
    const m = marcadorNaTela(_v.x, _v.y, atras, q.largura, q.altura, MARGENS, this.marca);
    // Só escreve no DOM quando o marcador andou mais de meio pixel (parado, o jogo não toca na tela).
    if (Math.abs(m.x - this.marcaX) > 0.5 || Math.abs(m.y - this.marcaY) > 0.5) {
      this.marcaX = m.x;
      this.marcaY = m.y;
      this.alvo.style.transform = `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px)`;
    }
    if (m.naBorda !== this.marcaNaBorda) {
      this.marcaNaBorda = m.naBorda;
      this.alvo.classList.toggle('borda', m.naBorda);
    }

    // A faixa da costa e a distância (5 Hz).
    this.periodo -= dt;
    if (this.periodo > 0) return;
    this.periodo = PERIODO_DA_FAIXA_S;
    this.euNaFaixa.style.left = `${fracaoNaFaixa(q.eu.x) * 100}%`;
    let n = 0;
    for (const i of q.inimigos) {
      if (!i.alive || n >= this.pontos.length) continue;
      const dx = i.simPosition.x - q.eu.x;
      const dz = i.simPosition.z - q.eu.z;
      if (dx * dx + dz * dz > FAIXA_ALCANCE_M * FAIXA_ALCANCE_M) continue;
      const p = this.pontos[n++]!;
      p.hidden = false;
      p.style.left = `${fracaoNaFaixa(i.simPosition.x) * 100}%`;
    }
    for (; n < this.pontos.length; n++) this.pontos[n]!.hidden = true;
    const d = textoDeDistancia(Math.hypot(PRAIA_ESTACAO.x - q.eu.x, PRAIA_ESTACAO.z - q.eu.z));
    if (d !== this.distanciaMostrada) {
      this.distanciaMostrada = d;
      this.alvoDistancia.textContent = d;
    }
  }
}
