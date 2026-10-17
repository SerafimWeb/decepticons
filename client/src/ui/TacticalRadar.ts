import type { MapId } from '../environment/Bunker';
import { bunkerBlocks } from '../environment/BunkerLayout';
import { mapaCarregado } from '../environment/mapasSobDemanda';
import { pegada, praiaColisores } from '../environment/PraiaColisores';
import { PRAIA_ESTACAO, PRAIA_PIER, PRAIA_ZONES } from '../environment/PraiaLayout';
import { pontosDaCosta, PRAIA_LIMITES } from '../environment/PraiaTerreno';
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
  /** Metade do lado da área mostrada (em x), em metros. */
  meia: number;
  /** Metade da área em z, para um mapa retangular (a praia, 640 × 240 m); sem isto, o mapa é quadrado. */
  meiaZ?: number;
  /** As zonas de cura e de resfriamento do mapa (sem isto, a Arena usa as dela). */
  zonas?: readonly { x: number; z: number; radius: number; kind: 'heal' | 'cool' }[];
  /** A linha d'água, de oeste a leste (a praia): o mar é pintado do lado de z negativo dela. */
  mar?: readonly (readonly [number, number])[];
  /** Os marcos do mapa com nome (o porto, a ponte, a estação). */
  rotulos?: readonly { x: number; z: number; texto: string; cor: string }[];
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

/**
 * A planta da praia (P127): tudo que bloqueia o Mech de pé — prédios, muros, contêineres, barracas, o navio, os guindastes — visto de cima.
 * O tabuleiro alto do píer (que se anda por cima) e o que é muito baixo ficam de fora: a planta mostra o que fecha caminho.
 */
export function caixasDaPraia(): RadarCaixa[] {
  return praiaColisores()
    .filter((c) => c.y - c.h / 2 < 7 && c.h >= 1.4 && !c.rx)
    .map((c) => {
      const [x0, z0, x1, z1] = pegada(c);
      return { x0, z0, x1, z1 };
    });
}

/** Os marcos com nome da praia no radar do console. */
export const ROTULOS_DA_PRAIA = [
  { x: -270, z: -30, texto: 'PORTO', cor: 'rgba(255, 138, 31, 0.9)' },
  { x: PRAIA_PIER.x, z: -92, texto: 'PONTE', cor: 'rgba(0, 229, 255, 0.85)' },
  { x: PRAIA_ESTACAO.x - 8, z: PRAIA_ESTACAO.z, texto: 'ESTAÇÃO', cor: 'rgba(57, 255, 106, 0.95)' },
] as const;

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
  const praia = mapa === 'praia';
  const amazonia = mapa === 'amazonia' ? mapaCarregado('amazonia') : undefined; // a Amazônia (P180) vem do registro de mapas sob demanda
  const mar = praia ? pontosDaCosta() : undefined;
  return () => {
    caixas ??= praia ? caixasDaPraia() : amazonia ? [...amazonia.caixasDaPlanta()] : mapa === 'bunker' ? plantaDoBunker() : plantaDaArena(predios);
    const eu = voce();
    return {
      mapa,
      meia: praia ? PRAIA_LIMITES.maxX : amazonia ? amazonia.meia.x : meia,
      ...(praia ? { meiaZ: PRAIA_LIMITES.maxZ, zonas: PRAIA_ZONES, mar, rotulos: ROTULOS_DA_PRAIA } : {}),
      ...(amazonia ? { meiaZ: amazonia.meia.z, zonas: [], rotulos: amazonia.rotulos } : {}),
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
    // O mapa cabe inteiro na tela: quadrado (Arena, Bunker) ou retangular (a praia, 640 × 240 m): vale a escala do lado que aperta.
    const meiaZ = q.meiaZ ?? q.meia;
    const k = Math.min((w - 16) / (q.meia * 2), (h - 16) / (meiaZ * 2));
    const larguraDoMapa = q.meia * 2 * k;
    const alturaDoMapa = meiaZ * 2 * k;
    const ox = w / 2;
    const oy = h / 2;
    const X = (x: number) => ox + x * k;
    const Y = (z: number) => oy + z * k;
    g.clearRect(0, 0, w, h);

    // O mar (a praia): pintado do lado de z negativo da linha d'água, com a linha mais viva por cima.
    if (q.mar && q.mar.length > 1) {
      g.fillStyle = 'rgba(0, 150, 220, 0.2)';
      g.beginPath();
      g.moveTo(X(q.mar[0]![0]), Y(-meiaZ));
      for (const [mx, mz] of q.mar) g.lineTo(X(mx), Y(mz));
      g.lineTo(X(q.mar[q.mar.length - 1]![0]), Y(-meiaZ));
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(120, 220, 255, 0.65)';
      g.lineWidth = 1;
      g.beginPath();
      q.mar.forEach(([mx, mz], i) => (i === 0 ? g.moveTo(X(mx), Y(mz)) : g.lineTo(X(mx), Y(mz))));
      g.stroke();
    }

    // Anéis de distância (de 25 em 25 m; num mapa grande, de 100 em 100) e a cruz do centro.
    const passoDoAnel = q.meia > 150 ? 100 : 25;
    g.strokeStyle = 'rgba(0, 229, 255, 0.10)';
    g.lineWidth = 1;
    for (let r = passoDoAnel; r <= q.meia * 1.42; r += passoDoAnel) {
      g.beginPath();
      g.arc(ox, oy, r * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(ox - larguraDoMapa / 2, oy);
    g.lineTo(ox + larguraDoMapa / 2, oy);
    g.moveTo(ox, oy - alturaDoMapa / 2);
    g.lineTo(ox, oy + alturaDoMapa / 2);
    g.stroke();
    // Borda da área de jogo, a distância de dois anéis e o norte (a frente do Mech com yaw 0 é -z: o alto da tela).
    g.strokeStyle = 'rgba(0, 229, 255, 0.35)';
    g.strokeRect(X(-q.meia) + 0.5, Y(-meiaZ) + 0.5, larguraDoMapa, alturaDoMapa);
    g.font = `${9 * this.k}px Consolas, "Courier New", monospace`;
    g.textAlign = 'left';
    g.fillStyle = 'rgba(0, 229, 255, 0.45)';
    // Só o anel de 50 m ganha número (o de 100 m cairia em cima da zona de cura, no canto).
    if (q.mapa === 'arena') g.fillText('50 m', ox + 50 * k * 0.707 + 3, oy - 50 * k * 0.707 - 3);
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0, 229, 255, 0.85)';
    g.fillText('N', ox, Y(-meiaZ) - 4 > 10 ? Y(-meiaZ) - 4 : Y(-meiaZ) + 11);

    const zonas = q.zonas ?? (q.mapa === 'arena' ? ARENA_ZONES : []);
    for (const z of zonas) {
      g.fillStyle = z.kind === 'heal' ? 'rgba(57, 255, 106, 0.12)' : 'rgba(0, 229, 255, 0.12)';
      g.strokeStyle = z.kind === 'heal' ? 'rgba(57, 255, 106, 0.55)' : 'rgba(0, 229, 255, 0.55)';
      g.beginPath();
      g.arc(X(z.x), Y(z.z), z.radius * k, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }

    g.fillStyle = 'rgba(0, 229, 255, 0.10)';
    g.strokeStyle = 'rgba(0, 229, 255, 0.6)';
    for (const c of q.caixas) {
      const x = X(c.x0);
      const y = Y(c.z0);
      g.fillRect(x, y, (c.x1 - c.x0) * k, (c.z1 - c.z0) * k);
      g.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round((c.x1 - c.x0) * k), Math.round((c.z1 - c.z0) * k));
    }

    const rotulos = q.rotulos ?? (q.mapa === 'arena' ? ROTULOS_ARENA : []);
    if (rotulos.length > 0) {
      g.font = `700 ${9 * this.k}px Consolas, "Courier New", monospace`;
      g.textAlign = 'center';
      for (const r of rotulos) {
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
