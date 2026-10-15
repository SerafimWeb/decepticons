import { ARENA_ZONES } from '../combat/Zone';
import { PRAIA_ESTACAO, PRAIA_ZONES } from '../environment/PraiaLayout';
import { pontosDaCosta } from '../environment/PraiaTerreno';
import { caixasDaPraia, type RadarCaixa } from './TacticalRadar';

/** Quantos metros do mundo cabem do centro do minimapa até a borda (o campo de visão do radar do Mech). */
export const RAIO_M = 75;
/** O minimapa se redesenha este tanto de vezes por segundo (12 Hz: o ponto anda macio e o canvas pequeno custa quase nada). */
const QUADROS_POR_S = 12;
/** Fração da largura do canvas até onde o ponto de uma unidade pode ir: dentro do hexágono da moldura (o círculo inscrito tem 0,447). */
const RAIO_UTIL = 0.42;

export interface PontoMapa {
  /** Pixels a partir do centro: x para a direita, y para baixo (a frente do Mech é y negativo, o alto da tela). */
  x: number;
  y: number;
  /** A unidade está além do alcance: o ponto foi preso na borda, só para mostrar a direção. */
  borda: boolean;
}

/**
 * Onde uma unidade cai no minimapa de frente-para-cima. `dx`, `dz` são metros a partir de quem joga (x para a direita do mundo, z para
 * "trás"); `yaw` é para onde ele olha (a frente é (−sen yaw, −cos yaw), a convenção do jogo inteiro); `pxPorM` é a escala; `raioPx` é o
 * quanto o ponto pode se afastar do centro. Escreve em `fora` (sem alocar: G4).
 */
export function paraMinimapa(dx: number, dz: number, yaw: number, pxPorM: number, raioPx: number, fora: PontoMapa): void {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  // A mesma rotação do canvas (`rotate(yaw)`): o que está à frente do Mech sobe, o que está à direita dele vai para a direita.
  let x = (dx * cos - dz * sin) * pxPorM;
  let y = (dx * sin + dz * cos) * pxPorM;
  const d = Math.hypot(x, y);
  fora.borda = d > raioPx;
  if (fora.borda && d > 0) {
    x = (x / d) * raioPx;
    y = (y / d) * raioPx;
  }
  fora.x = x;
  fora.y = y;
}

/** O que o minimapa lê de cada robô (estrutural: o `Game.ts` passa os Mechs; os testes, objetos simples). */
export interface UnidadeMapa {
  readonly alive: boolean;
  readonly simPosition: { readonly x: number; readonly z: number };
  readonly stats: { readonly name: string };
}

/** Um ponto de controle como o minimapa o lê (estrutural: o estado vivo do `Dominio`). */
export interface PontoDoMapa {
  readonly def: { readonly letra: string; readonly x: number; readonly z: number };
  readonly control: number;
  readonly disputado: boolean;
}

/** A planta do mapa (fixa) que o minimapa desenha por baixo: paredes e as zonas de cura e resfriamento. */
export interface PlantaMinimapa {
  readonly caixas: readonly RadarCaixa[];
  readonly zonas: readonly { readonly x: number; readonly z: number; readonly radius: number; readonly kind: 'heal' | 'cool' }[];
  /** A linha d'água (a praia), de oeste a leste: o mar é pintado do lado de z negativo dela. */
  readonly mar?: readonly (readonly [number, number])[];
}

/** Planta da Arena: os prédios e as duas zonas. O Bunker não tem zonas e usa a planta térrea. */
export function plantaComZonas(caixas: readonly RadarCaixa[], arena: boolean): PlantaMinimapa {
  return { caixas, zonas: arena ? ARENA_ZONES : [] };
}

/** A planta da praia (P127): o que bloqueia o Mech, as zonas e o mar. */
export function plantaDaPraiaNoMinimapa(): PlantaMinimapa {
  return { caixas: caixasDaPraia(), zonas: PRAIA_ZONES, mar: pontosDaCosta() };
}

/** A estação como um "ponto" do minimapa (a letra E, em ciano): fora do alcance, fica presa na borda e mostra a direção do objetivo. */
export function pontoDaEstacao(): readonly PontoDoMapa[] {
  return [{ def: { letra: 'E', x: PRAIA_ESTACAO.x, z: PRAIA_ESTACAO.z }, control: 1, disputado: false }];
}

/**
 * Minimapa da partida, no canto de cima à esquerda: a planta do mapa vista de cima e **girada para onde você olha** (o que está na frente
 * sobe), com os inimigos em vermelho, os aliados em ciano e a sua posição no centro. Quem está além do alcance (75 m) vira um ponto
 * preso na borda, para dar a direção. É o que o MechArena e todo jogo de arena têm (`REFERENCIA_VISUAL.md` § 6) e o que faltava para
 * saber, de relance, de onde vem a luta.
 *
 * **Informação:** mostra todos os robôs dentro do alcance, atrás de parede ou não (um radar). Se isso tirar o jogo furtivo (P23), o
 * ajuste é uma linha em `desenhar` (filtrar por visão).
 *
 * **Custo de CPU/GPU:** um canvas 2D pequeno (~150 px) redesenhado a 12 Hz, só com a partida em andamento: ~40 retângulos de planta e
 * até ~40 pontos, sem alocação por quadro. Fora da partida, a moldura está escondida e nada roda.
 */
export class Minimapa {
  private readonly canvas = document.createElement('canvas');
  private readonly g = this.canvas.getContext('2d');
  private readonly ponto: PontoMapa = { x: 0, y: 0, borda: false };
  private w = 0;
  private dpr = 1;
  private acumulado = 0;
  private planta: PlantaMinimapa = { caixas: [], zonas: [] };
  private cone: CanvasGradient | null = null;
  /** Domínio: os pontos A–E, desenhados com a cor de quem os leva (os além do alcance ficam presos na borda, como bússola). */
  private pontosDeControle: readonly PontoDoMapa[] | null = null;

  /** `root`: a moldura (hexágono) onde o canvas entra; o CSS dá o tamanho. */
  constructor(private readonly root: HTMLElement) {
    this.canvas.className = 'mm-canvas';
    root.prepend(this.canvas);
  }

  /** O mapa mudou (Arena ou Bunker, ou uma nova partida): troca a planta de baixo. */
  setPlanta(planta: PlantaMinimapa): void {
    this.planta = planta;
    this.acumulado = 1;
  }

  /** Liga os pontos de controle do Domínio (ou desliga, com `null`). */
  setPontos(pontos: readonly PontoDoMapa[] | null): void {
    this.pontosDeControle = pontos;
  }

  /** Mostra ou esconde a moldura inteira (fora da partida, no Hangar, morto ou cego, ela some). */
  setVisivel(visivel: boolean): void {
    this.root.hidden = !visivel;
  }

  /** Quando o `HUD` muda de tamanho (o CSS mexe no minimapa por tela e por escala): remede o canvas. */
  medir(): void {
    const r = this.root.getBoundingClientRect();
    const w = Math.round(r.width);
    if (!w || w === this.w) return;
    this.w = w;
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(w * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${w}px`;
    this.cone = null;
    this.acumulado = 1;
  }

  /** Conta o tempo; devolve true quando é hora de redesenhar (12 Hz). Barato: uma soma e uma comparação por quadro. */
  pronto(dt: number): boolean {
    this.acumulado += dt;
    if (this.acumulado < 1 / QUADROS_POR_S) return false;
    this.acumulado = 0;
    return !this.root.hidden;
  }

  desenhar(yaw: number, eu: UnidadeMapa, inimigos: readonly UnidadeMapa[], aliados: readonly UnidadeMapa[]): void {
    if (!this.w) this.medir();
    const { g, w } = this;
    if (!g || !w) return;
    const raioUtil = w * RAIO_UTIL;
    const k = raioUtil / RAIO_M;
    const centro = w / 2;
    const ex = eu.simPosition.x;
    const ez = eu.simPosition.z;

    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, w, w);

    // Anéis de distância fixos em volta de quem joga (25, 50 e 75 m), e a cruz.
    g.strokeStyle = 'rgba(0, 229, 255, 0.14)';
    g.lineWidth = 1;
    for (let r = 25; r <= RAIO_M; r += 25) {
      g.beginPath();
      g.arc(centro, centro, r * k, 0, Math.PI * 2);
      g.stroke();
    }

    // O mundo, girado: o que está na frente do Mech sobe.
    g.save();
    g.translate(centro, centro);
    g.rotate(yaw);
    g.scale(k, k);
    g.translate(-ex, -ez);
    const mar = this.planta.mar;
    if (mar && mar.length > 1) {
      // O mar: do lado de z negativo da linha d'água até 200 m além dela (basta para a janela de 120 m do radar).
      g.fillStyle = 'rgba(0, 150, 220, 0.2)';
      g.beginPath();
      g.moveTo(mar[0]![0], mar[0]![1] - 200);
      for (const [mx, mz] of mar) g.lineTo(mx, mz);
      g.lineTo(mar[mar.length - 1]![0], mar[mar.length - 1]![1] - 200);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(120, 220, 255, 0.7)';
      g.lineWidth = 1 / k;
      g.beginPath();
      mar.forEach(([mx, mz], i) => (i === 0 ? g.moveTo(mx, mz) : g.lineTo(mx, mz)));
      g.stroke();
    }
    for (const z of this.planta.zonas) {
      g.fillStyle = z.kind === 'heal' ? 'rgba(57, 255, 106, 0.16)' : 'rgba(0, 229, 255, 0.16)';
      g.strokeStyle = z.kind === 'heal' ? 'rgba(57, 255, 106, 0.6)' : 'rgba(0, 229, 255, 0.6)';
      g.lineWidth = 1 / k;
      g.beginPath();
      g.arc(z.x, z.z, z.radius, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.fillStyle = 'rgba(0, 229, 255, 0.16)';
    g.strokeStyle = 'rgba(0, 229, 255, 0.75)';
    g.lineWidth = 1 / k;
    const corte = RAIO_M * 1.6;
    for (const c of this.planta.caixas) {
      // Fora da vista (ainda que girada, o círculo de 75 m cabe num quadrado de 120 m): nem entra no desenho.
      if (c.x1 < ex - corte || c.x0 > ex + corte || c.z1 < ez - corte || c.z0 > ez + corte) continue;
      g.fillRect(c.x0, c.z0, c.x1 - c.x0, c.z1 - c.z0);
      g.strokeRect(c.x0, c.z0, c.x1 - c.x0, c.z1 - c.z0);
    }
    g.restore();

    if (this.pontosDeControle) this.desenharPontos(this.pontosDeControle, ex, ez, yaw, k, raioUtil, centro);
    for (const a of aliados) this.desenharUnidade(a, ex, ez, yaw, k, raioUtil, centro, '#00e5ff', 3);
    for (const i of inimigos) this.desenharUnidade(i, ex, ez, yaw, k, raioUtil, centro, '#ff2d3d', i.stats.name.startsWith('ANDRÓIDE') ? 2.4 : 3.6);

    // Você: o cone de visão (60° para cima) e o triângulo verde no centro, sempre apontando para o alto.
    if (!this.cone) {
      // O cone não gira (o mapa é que gira) e o centro não anda: o degradê nasce uma vez por tamanho de canvas.
      this.cone = g.createRadialGradient(centro, centro, 0, centro, centro, raioUtil);
      this.cone.addColorStop(0, 'rgba(57, 255, 106, 0.30)');
      this.cone.addColorStop(1, 'rgba(57, 255, 106, 0)');
    }
    g.fillStyle = this.cone;
    g.beginPath();
    g.moveTo(centro, centro);
    g.arc(centro, centro, raioUtil, -Math.PI / 2 - 0.52, -Math.PI / 2 + 0.52);
    g.closePath();
    g.fill();
    g.fillStyle = '#39ff6a';
    g.beginPath();
    g.moveTo(centro, centro - 7);
    g.lineTo(centro - 4.5, centro + 4);
    g.lineTo(centro + 4.5, centro + 4);
    g.closePath();
    g.fill();
  }

  private desenharPontos(pontos: readonly PontoDoMapa[], ex: number, ez: number, yaw: number, k: number, raioUtil: number, centro: number): void {
    const g = this.g!;
    const p = this.ponto;
    g.font = '700 10px Consolas, "Courier New", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const c of pontos) {
      paraMinimapa(c.def.x - ex, c.def.z - ez, yaw, k, raioUtil, p);
      const cor = c.control > 0.001 ? '#00e5ff' : c.control < -0.001 ? '#ff2d3d' : '#cfd8dc';
      const r = p.borda ? 6 : 8;
      g.globalAlpha = p.borda ? 0.75 : 1;
      g.fillStyle = 'rgba(5, 14, 18, 0.85)';
      g.strokeStyle = c.disputado ? '#ffb300' : cor;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(centro + p.x, centro + p.y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = cor;
      g.fillText(c.def.letra, centro + p.x, centro + p.y + 0.5);
    }
    g.globalAlpha = 1;
    g.lineWidth = 1;
  }

  private desenharUnidade(u: UnidadeMapa, ex: number, ez: number, yaw: number, k: number, raioUtil: number, centro: number, cor: string, r: number): void {
    if (!u.alive) return;
    const p = this.ponto;
    paraMinimapa(u.simPosition.x - ex, u.simPosition.z - ez, yaw, k, raioUtil, p);
    const g = this.g!;
    g.fillStyle = cor;
    g.globalAlpha = p.borda ? 0.5 : 1;
    g.beginPath();
    g.arc(centro + p.x, centro + p.y, p.borda ? r * 0.75 : r, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
}
