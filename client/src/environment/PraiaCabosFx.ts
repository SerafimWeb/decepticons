import * as THREE from 'three';
import { PONTOS_DOS_CABOS } from '../sim/CabosDeDados';

/**
 * O EFEITO DE DADOS DOS CABOS (P162): quando um andróide rebelde se liga a um ponto de conexão, **sobe do ponto um letreiro sutil** com uma caveira e um termo curto
 * ("INJETANDO FAKE NEWS", "ROBÔ DE OPINIÃO"...), legível a quem presta atenção, no mesmo espírito das faíscas dos tiros. O cabo tomado mostra "REDE COMPROMETIDA"; o
 * cortado, "CABO CORTADO". Junto vai o **brilho do cabo** (o shader de `PraiaMateriais.ts` lê a injeção e a vida e vira vermelho piscando).
 *
 * **Custo:** três `Sprite` (um por cabo, um desenho cada, só visíveis quando há o que mostrar) e seis texturas de canvas feitas **uma vez** na montagem (512 × 64, ~130 KB
 * cada). Por quadro: o estado de três cabos (opacidade e escolha da frase), **sem alocar**. A caveira é desenhada em canvas, sem depender de fonte. Sem DOM (o servidor e
 * os testes em Node) o efeito não existe e nada quebra.
 */

/** As frases da injeção, em rodízio a cada ~2,2 s (cada cabo começa numa diferente): o que um andróide ligado à rede faz de pior. */
export const FRASES_DA_INJECAO: readonly string[] = ['INJETANDO FAKE NEWS', 'DESINFORMAÇÃO EM MASSA', 'ROBÔ DE OPINIÃO', 'MANIPULANDO A REDE'];
export const FRASE_DO_TOMADO = 'REDE COMPROMETIDA';
export const FRASE_DO_CORTADO = 'CABO CORTADO';
const PERIODO_DA_FRASE_S = 2.2;

/**
 * A frase do letreiro do cabo `i` (`estado`: 0 livre, 1 injetando, 2 tomado, 3 cortado) no instante `elapsed`, ou `null` sem letreiro. Pura: o desenho e o teste leem a mesma.
 */
export function fraseDoCabo(estado: number, elapsed: number, i: number): string | null {
  if (estado === 1) return FRASES_DA_INJECAO[(Math.floor(elapsed / PERIODO_DA_FRASE_S) + i) % FRASES_DA_INJECAO.length]!;
  if (estado === 2) return FRASE_DO_TOMADO;
  if (estado === 3) return FRASE_DO_CORTADO;
  return null;
}

/** A opacidade do letreiro: sobe com a injeção (um fio no começo, o letreiro inteiro com a barra passando de 15%) e respira; tomado pulsa forte; cortado pisca. */
export function opacidadeDoLetreiro(estado: number, injecao: number, elapsed: number, i: number): number {
  if (estado === 1) {
    const t = Math.min(1, Math.max(0, (injecao - 0.02) / 0.13));
    return t * t * (3 - 2 * t) * (0.55 + 0.25 * Math.sin(elapsed * 3 + i * 2));
  }
  if (estado === 2) return 0.7 + 0.25 * Math.sin(elapsed * 6 + i);
  if (estado === 3) return Math.sin(elapsed * 9 + i * 3) > 0 ? 0.75 : 0.2;
  return 0;
}

const LARGURA = 512;
const ALTURA = 64;
/**
 * O letreiro no mundo: 11 m de largura (legível a 25 m, de onde se defende o ponto) e 3,6 m acima do chão; **cada cabo sobe 1,7 m mais que o anterior**, porque os
 * pontos ficam a 6 m um do outro e três letreiros na mesma altura se sobreporiam.
 */
const PALMOS_DE_LARGURA = 11;
const ALTURA_DO_LETREIRO = 3.6;
const DEGRAU_DO_LETREIRO = 1.7;

/** A caveira do letreiro, desenhada em traços (sem fonte): o crânio, as órbitas, o nariz e a fileira de dentes. */
function desenharCaveira(g: CanvasRenderingContext2D, x: number, y: number, r: number, cor: string): void {
  g.fillStyle = cor;
  g.beginPath();
  g.ellipse(x, y - r * 0.15, r, r * 0.9, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x - r * 0.55, y + r * 0.5, r * 1.1, r * 0.65); // a mandíbula
  g.fillStyle = 'rgba(8, 4, 10, 0.95)';
  for (const lado of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + lado * r * 0.42, y - r * 0.2, r * 0.26, r * 0.3, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath(); // o nariz
  g.moveTo(x, y + r * 0.08);
  g.lineTo(x - r * 0.1, y + r * 0.34);
  g.lineTo(x + r * 0.1, y + r * 0.34);
  g.fill();
  for (let d = -1; d <= 1; d++) g.fillRect(x + d * r * 0.3 - r * 0.04, y + r * 0.62, r * 0.08, r * 0.5); // os dentes
}

function texturaDoLetreiro(texto: string, cor: string, brilho: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, LARGURA, ALTURA);
  g.shadowColor = brilho;
  g.shadowBlur = 10;
  desenharCaveira(g, 38, 32, 21, cor);
  g.font = 'bold 30px Consolas, "Courier New", monospace';
  g.textBaseline = 'middle';
  g.fillStyle = cor;
  g.fillText(texto, 74, 34, LARGURA - 90);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

export class PraiaCabosFx {
  private readonly sprites: THREE.Sprite[] = [];
  private readonly texturas = new Map<string, THREE.CanvasTexture>();
  /** O que cada sprite mostra agora (para só trocar a textura quando a frase muda). */
  private readonly mostrando: (string | null)[] = [];

  private constructor(scene: THREE.Scene) {
    for (const f of FRASES_DA_INJECAO) this.texturas.set(f, texturaDoLetreiro(f, 'rgb(255, 80, 70)', 'rgba(255, 30, 30, 0.9)'));
    this.texturas.set(FRASE_DO_TOMADO, texturaDoLetreiro(FRASE_DO_TOMADO, 'rgb(255, 40, 55)', 'rgba(255, 0, 20, 1)'));
    this.texturas.set(FRASE_DO_CORTADO, texturaDoLetreiro(FRASE_DO_CORTADO, 'rgb(255, 190, 70)', 'rgba(255, 120, 0, 0.9)'));
    PONTOS_DOS_CABOS.forEach((p, i) => {
      const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false, opacity: 0 });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(PALMOS_DE_LARGURA, PALMOS_DE_LARGURA * (ALTURA / LARGURA), 1);
      sprite.position.set(p.x, ALTURA_DO_LETREIRO + i * DEGRAU_DO_LETREIRO, p.z);
      sprite.visible = false;
      sprite.renderOrder = 6;
      scene.add(sprite);
      this.sprites.push(sprite);
      this.mostrando.push(null);
    });
  }

  /** Cria o efeito, ou devolve `null` sem DOM (servidor, testes em Node): o canvas das frases só existe no navegador. */
  static criar(scene: THREE.Scene): PraiaCabosFx | null {
    return typeof document === 'undefined' ? null : new PraiaCabosFx(scene);
  }

  /** Por quadro: o estado (0 a 3) e a injeção (0 a 1) de cada cabo e o tempo. Só troca a textura quando a frase muda; sem alocar. */
  atualiza(elapsed: number, estado: ArrayLike<number>, injecao: ArrayLike<number>): void {
    for (let i = 0; i < this.sprites.length; i++) {
      const sprite = this.sprites[i]!;
      const e = estado[i] ?? 0;
      const opacidade = opacidadeDoLetreiro(e, injecao[i] ?? 0, elapsed, i);
      if (opacidade <= 0.004) {
        if (sprite.visible) sprite.visible = false;
        continue;
      }
      const frase = fraseDoCabo(e, elapsed, i);
      if (frase !== this.mostrando[i]) {
        this.mostrando[i] = frase;
        const material = sprite.material as THREE.SpriteMaterial;
        const tinhaMapa = material.map !== null;
        material.map = frase ? this.texturas.get(frase) ?? null : null;
        if (!tinhaMapa && material.map) material.needsUpdate = true; // o shader muda com o mapa presente (uma vez por sprite)
      }
      (sprite.material as THREE.SpriteMaterial).opacity = opacidade;
      sprite.position.y = ALTURA_DO_LETREIRO + i * DEGRAU_DO_LETREIRO + 0.25 * Math.sin(elapsed * 1.6 + i); // sobe e desce de leve
      sprite.visible = true;
    }
  }
}
