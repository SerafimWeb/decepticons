import type { MapId } from '../environment/Bunker';
import { bunkerBlocks } from '../environment/BunkerLayout';
import { ARENA_ZONES } from '../combat/Zone';
import { SERAFIM_TOWER } from '../environment/SerafimTower';
import { escalaTipografica } from './escala';

/** Um retângulo da planta, em metros (x para a direita, z para baixo na tela: -z é o "norte", para onde o Mech olha com yaw 0). */
export interface RadarCaixa {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface RadarUnidade {
  x: number;
  z: number;
}

/** O que o radar desenha: a planta (fixa por mapa) e onde estão as unidades agora. */
export interface RadarQuadro {
  mapa: MapId;
  /** Metade do lado da área mostrada, em metros. */
  meia: number;
  caixas: readonly RadarCaixa[];
  voce: (RadarUnidade & { yaw: number }) | null;
  /** Vários pilotos de uma vez (o mural de câmeras, P88: uma sala vista de fora): triângulos verdes, sem o cone de visão. */
  jogadores?: readonly (RadarUnidade & { yaw: number })[];
  aliados: readonly RadarUnidade[];
  /** `grande`: Mech ou chefe (o andróide e o técnico são pontos menores). */
  inimigos: readonly (RadarUnidade & { grande: boolean })[];
}

/** O Banco VORCARIS é o prédio de (-28, -35) (`BANCO_VORCARIS.md`); a torre da SERAFIM tem posição própria. */
const ROTULOS_ARENA = [
  { x: SERAFIM_TOWER.x, z: SERAFIM_TOWER.z, texto: 'SERAFIM', cor: 'rgba(57, 255, 106, 0.9)' },
  { x: -28, z: -35, texto: 'VORCARIS', cor: 'rgba(0, 229, 255, 0.85)' },
] as const;

/** As paredes do térreo do Bunker (os pisos dos andares de cima tapariam tudo). */
export function plantaDoBunker(): RadarCaixa[] {
  return bunkerBlocks()
    .filter((b) => b.solid && b.y < 10 && b.h >= 3)
    .map((b) => ({ x0: b.x - b.w / 2, z0: b.z - b.d / 2, x1: b.x + b.w / 2, z1: b.z + b.d / 2 }));
}

/** A planta da Arena: os prédios e a torre, vistos de cima (a mesma que o radar do console desenha; o mural de câmeras usa para todas as salas). */
export function plantaDaArena(predios: readonly CaixaLida[]): RadarCaixa[] {
  return predios.map((o) => ({ x0: o.box.min.x, z0: o.box.min.z, x1: o.box.max.x, z1: o.box.max.z }));
}

/** O pedaço de um Mech que o radar lê (estrutural: o `Game.ts` passa os Mechs; os testes, objetos simples). */
interface UnidadeLida {
  readonly alive: boolean;
  readonly yaw: number;
  readonly simPosition: { readonly x: number; readonly z: number };
  readonly stats: { readonly name: string };
}

/** Uma caixa de oclusão da Arena (prédios e a torre): `Box3` do Three, lida só pelos cantos. */
interface CaixaLida {
  readonly box: { readonly min: { readonly x: number; readonly z: number }; readonly max: { readonly x: number; readonly z: number } };
}

/**
 * Monta o quadro do radar. A planta é calculada uma vez por mapa (a função devolvida guarda); as unidades, a cada chamada (uma vez por
 * segundo com o console à vista: alocar aqui não toca o laço do jogo, G4).
 */
export function fonteDoRadar(
  mapa: MapId,
  meia: number,
  predios: readonly CaixaLida[],
  voce: () => UnidadeLida,
  inimigos: () => readonly UnidadeLida[],
  aliados: () => readonly UnidadeLida[],
): () => RadarQuadro {
  let caixas: RadarCaixa[] | null = null;
  return () => {
    caixas ??= mapa === 'bunker' ? plantaDoBunker() : plantaDaArena(predios);
    const eu = voce();
    return {
      mapa,
      meia,
      caixas,
      voce: eu.alive ? { x: eu.simPosition.x, z: eu.simPosition.z, yaw: eu.yaw } : null,
      aliados: aliados().filter((m) => m.alive).map((m) => ({ x: m.simPosition.x, z: m.simPosition.z })),
      inimigos: inimigos()
        .filter((m) => m.alive)
        .map((m) => ({ x: m.simPosition.x, z: m.simPosition.z, grande: !m.stats.name.startsWith('ANDRÓIDE') })),
    };
  };
}

/**
 * Monitor "RADAR TÁTICO" do console: a planta do mapa aberto vista de cima, com você (triângulo verde, apontando para onde olha),
 * os aliados (ciano) e as IAs (vermelho), e as zonas de cura e de resfriamento da Arena.
 *
 * **Custo:** só com o console à vista, uma vez por segundo (online o mundo segue andando); até ~40 retângulos e ~20 pontos num
 * canvas pequeno. Fora do console, nada roda. A varredura que gira por cima é CSS.
 */
export class TacticalRadar {
  private readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D | null;
  private w = 0;
  private h = 0;
  /** O jogo ficou pronto e o radar pode desenhar (até lá, nada é desenhado). */
  private ativo = false;
  /** A escala tipográfica do console (`--k`), lida a cada mudança de tamanho. */
  private k = 1;
  private readonly observador: ResizeObserver;

  constructor(
    root: HTMLElement,
    private readonly quadro: () => RadarQuadro,
  ) {
    this.canvas = root.querySelector('canvas')!;
    // Canvas por CPU (`willReadFrequently`): pequeno e redesenhado só uma vez por segundo; fora do processo de GPU não disputa a CPU do boot.
    this.g = this.canvas.getContext('2d', { willReadFrequently: true });
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(this.canvas.parentElement!);
  }

  /** Desliga o radar (o mural de câmeras cria um por sala e tira quando a sala fecha): para de medir e de desenhar. */
  dispose(): void {
    this.observador.disconnect();
    this.ativo = false;
  }

  /** Liga o desenho (o console chama quando o jogo fica pronto). */
  acender(): void {
    if (this.ativo) return;
    this.ativo = true;
    this.w = 0;
    this.h = 0;
    this.medir();
  }

  private medir(): void {
    if (!this.ativo) return;
    const r = this.canvas.parentElement!.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (!w || !h || (w === this.w && h === this.h)) return;
    this.w = w;
    this.h = h;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.g?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.k = escalaTipografica(this.canvas);
    this.desenhar();
  }

  desenhar(): void {
    if (!this.ativo) return;
    const { g, w, h } = this;
    if (!g || !w || !h) return;
    const q = this.quadro();
    const lado = Math.min(w, h) - 16;
    const k = lado / (q.meia * 2);
    const ox = w / 2;
    const oy = h / 2;
    const X = (x: number) => ox + x * k;
    const Y = (z: number) => oy + z * k;
    g.clearRect(0, 0, w, h);

    // Anéis de distância (de 25 em 25 m) e a cruz do centro.
    g.strokeStyle = 'rgba(0, 229, 255, 0.10)';
    g.lineWidth = 1;
    for (let r = 25; r <= q.meia * 1.42; r += 25) {
      g.beginPath();
      g.arc(ox, oy, r * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(ox - lado / 2, oy);
    g.lineTo(ox + lado / 2, oy);
    g.moveTo(ox, oy - lado / 2);
    g.lineTo(ox, oy + lado / 2);
    g.stroke();
    // Borda da área de jogo, a distância de dois anéis e o norte (a frente do Mech com yaw 0 é -z: o alto da tela).
    g.strokeStyle = 'rgba(0, 229, 255, 0.35)';
    g.strokeRect(X(-q.meia) + 0.5, Y(-q.meia) + 0.5, q.meia * 2 * k, q.meia * 2 * k);
    g.font = `${9 * this.k}px Consolas, "Courier New", monospace`;
    g.textAlign = 'left';
    g.fillStyle = 'rgba(0, 229, 255, 0.45)';
    // Só o anel de 50 m ganha número (o de 100 m cairia em cima da zona de cura, no canto).
    g.fillText('50 m', ox + 50 * k * 0.707 + 3, oy - 50 * k * 0.707 - 3);
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0, 229, 255, 0.85)';
    g.fillText('N', ox, Y(-q.meia) - 4 > 10 ? Y(-q.meia) - 4 : Y(-q.meia) + 11);

    if (q.mapa === 'arena') {
      for (const z of ARENA_ZONES) {
        g.fillStyle = z.kind === 'heal' ? 'rgba(57, 255, 106, 0.12)' : 'rgba(0, 229, 255, 0.12)';
        g.strokeStyle = z.kind === 'heal' ? 'rgba(57, 255, 106, 0.55)' : 'rgba(0, 229, 255, 0.55)';
        g.beginPath();
        g.arc(X(z.x), Y(z.z), z.radius * k, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    }

    g.fillStyle = 'rgba(0, 229, 255, 0.10)';
    g.strokeStyle = 'rgba(0, 229, 255, 0.6)';
    for (const c of q.caixas) {
      const x = X(c.x0);
      const y = Y(c.z0);
      g.fillRect(x, y, (c.x1 - c.x0) * k, (c.z1 - c.z0) * k);
      g.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round((c.x1 - c.x0) * k), Math.round((c.z1 - c.z0) * k));
    }

    if (q.mapa === 'arena') {
      g.font = `700 ${9 * this.k}px Consolas, "Courier New", monospace`;
      g.textAlign = 'center';
      for (const r of ROTULOS_ARENA) {
        g.fillStyle = r.cor;
        g.fillText(r.texto, X(r.x), Y(r.z) - 2);
      }
    }

    for (const a of q.aliados) this.ponto(X(a.x), Y(a.z), 3, '#00e5ff');
    for (const i of q.inimigos) this.ponto(X(i.x), Y(i.z), i.grande ? 3.6 : 2.4, '#ff2d3d');
    if (q.jogadores) for (const j of q.jogadores) this.piloto(X(j.x), Y(j.z), -Math.sin(j.yaw), -Math.cos(j.yaw));
    if (q.voce) {
      // Triângulo apontando para onde o Mech olha: a frente é (-sen yaw, -cos yaw).
      const x = X(q.voce.x);
      const y = Y(q.voce.z);
      const fx = -Math.sin(q.voce.yaw);
      const fz = -Math.cos(q.voce.yaw);
      // O cone de visão: 70° e 45 m na frente do Mech, esmaecendo.
      const alcance = 45 * k;
      const rumo = Math.atan2(fz, fx);
      const cone = g.createRadialGradient(x, y, 0, x, y, alcance);
      cone.addColorStop(0, 'rgba(57, 255, 106, 0.28)');
      cone.addColorStop(1, 'rgba(57, 255, 106, 0)');
      g.fillStyle = cone;
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, alcance, rumo - 0.61, rumo + 0.61);
      g.closePath();
      g.fill();
      g.fillStyle = '#39ff6a';
      g.shadowColor = '#39ff6a';
      g.shadowBlur = 8;
      g.beginPath();
      g.moveTo(x + fx * 8, y + fz * 8);
      g.lineTo(x - fx * 4 - fz * 4.5, y - fz * 4 + fx * 4.5);
      g.lineTo(x - fx * 4 + fz * 4.5, y - fz * 4 - fx * 4.5);
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
    }
  }

  /** Um piloto visto de fora: o triângulo verde apontando para onde olha (sem o cone de visão, que é só de quem joga). */
  private piloto(x: number, y: number, fx: number, fz: number): void {
    const g = this.g!;
    g.fillStyle = '#39ff6a';
    g.shadowColor = '#39ff6a';
    g.shadowBlur = 8;
    g.beginPath();
    g.moveTo(x + fx * 8, y + fz * 8);
    g.lineTo(x - fx * 4 - fz * 4.5, y - fz * 4 + fx * 4.5);
    g.lineTo(x - fx * 4 + fz * 4.5, y - fz * 4 - fx * 4.5);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
  }

  private ponto(x: number, y: number, r: number, cor: string): void {
    const g = this.g!;
    g.fillStyle = cor;
    g.shadowColor = cor;
    g.shadowBlur = 6;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
  }
}
