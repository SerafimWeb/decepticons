import * as THREE from 'three';
import { PRAIA_COMPLEXO, PRAIA_ESTACAO } from '../environment/PraiaLayout';
import { AnunciadorDeLugar, avisoDeAgua, CARTAO_DA_MISSAO, FAIXA_ALCANCE_M, fracaoNaFaixa, MARCOS_DA_FAIXA, marcadorNaTela, textoDeDistancia, type AvisoDeAgua, type MargensDaTela, type MarcadorNaTela } from './praiaHudData';

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

const MARGENS: MargensDaTela = { topo: 118, base: 175, esq: 28, dir: 44 };
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
  camera: THREE.Camera;
  largura: number;
  altura: number;
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
  private periodo = 0;
  private zonaS = 0;
  private cartaoS = 0;
  private mostradoCartao = false;
  private textoDaAgua = '';
  private nivelDaAgua = '';
  private distanciaMostrada = '';
  private visivel = true;
  /** Objetos reaproveitados a cada quadro (G4): o lugar do marcador, o aviso da água e a última posição escrita no DOM. */
  private readonly marca: MarcadorNaTela = { x: 0, y: 0, naBorda: false };
  private readonly aviso: AvisoDeAgua = { nivel: 'seco', progresso: 0, texto: '' };
  private marcaX = -1e9;
  private marcaY = -1e9;
  private marcaNaBorda = false;

  constructor(hud: HTMLElement) {
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
    el('b', '', this.alvo, 'ESTAÇÃO');
    this.alvoDistancia = el('span', '', this.alvo);
  }

  /** Mostra ou esconde o HUD inteiro (a partida pausada, o Hangar, morto). */
  setVisivel(v: boolean): void {
    if (v === this.visivel) return;
    this.visivel = v;
    this.raiz.hidden = !v;
  }

  /** Uma partida nova: o anúncio do lugar e o cartão da missão voltam a valer. */
  reset(): void {
    this.anunciador.reset();
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

    // O anúncio do lugar: aparece e some sozinho (a animação é do CSS; aqui só o texto e o relógio).
    const novo = this.anunciador.atualiza(q.eu.x, q.eu.z, dt);
    if (novo) {
      this.zona.textContent = novo;
      this.zona.classList.remove('on');
      void this.zona.offsetWidth; // reinicia a animação de entrada
      this.zona.classList.add('on');
      this.zonaS = 3.2;
    } else if (this.zonaS > 0) {
      this.zonaS -= dt;
      if (this.zonaS <= 0) this.zona.classList.remove('on');
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
