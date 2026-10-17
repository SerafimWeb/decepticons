import type * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { MapId } from './Bunker';

/**
 * OS MAPAS SOB DEMANDA (P180, parte B): o código de um mapa grande (terreno, floresta, shaders) **só baixa para quem o escolhe**. O `Game.create` pede `carregarMapaSeFor` antes de montar
 * a partida (já era assíncrono: a física e os robôs importados também são pré-carregados ali) e a `Arena`, o radar e o minimapa leem o mapa **daqui**, sem importá-lo: o pacote de partida
 * (o teto de 500 KB gzip, `scripts/orcamentoDeJs.mjs`) não carrega a Amazônia de quem joga a Cidade Neon.
 *
 * Este módulo é minúsculo e sem dependência pesada (só tipos): é o único que o pacote de partida enxerga.
 */

/** O que a Arena e o jogo precisam de um mapa montado: o relógio, a câmera e a frente do rio. */
export interface InstanciaDoMapa {
  update(elapsed: number): void;
  observar(x: number, y: number, z: number): void;
  setFrente(x: number): void;
  readonly frente: number;
  /** Até onde a câmera do jogo enxerga neste mapa (m): a névoa do mapa já escondeu tudo muito antes. */
  readonly alcanceDaCamera: number;
}

/** Um retângulo da planta de cima (o radar e o minimapa). */
export interface CaixaDaPlanta {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** O que o jogo lê de um mapa carregado sob demanda. */
export interface MapaCarregado {
  construir(scene: THREE.Scene, physics: PhysicsWorld): InstanciaDoMapa;
  /** As estruturas sólidas vistas de cima. */
  caixasDaPlanta(): readonly CaixaDaPlanta[];
  /** Os marcos do mapa com nome no radar do console. */
  rotulos: readonly { x: number; z: number; texto: string; cor: string }[];
  /** Metade do mapa em x e em z (m): a escala do radar. */
  meia: { x: number; z: number };
}

const carregados = new Map<MapId, MapaCarregado>();

/** O mapa, se já foi carregado (`undefined` se não: quem pede sem carregar antes errou o roteiro). */
export function mapaCarregado(id: MapId): MapaCarregado | undefined {
  return carregados.get(id);
}

/** Como o mapa é obrigatório para montar a partida: erro claro em vez de um `undefined` mais adiante. */
export function exigirMapa(id: MapId): MapaCarregado {
  const m = carregados.get(id);
  if (!m) throw new Error(`o mapa "${id}" não foi carregado: chame carregarMapaSeFor("${id}") antes de montar a partida`);
  return m;
}

/** Baixa e registra o código do mapa, se ele é de carga sob demanda. Idempotente; os mapas que moram no pacote de partida não fazem nada. */
export async function carregarMapaSeFor(id: MapId): Promise<void> {
  if (id === 'amazonia' && !carregados.has(id)) {
    const { mapaDaAmazonia } = await import('./AmazoniaMapa');
    carregados.set(id, mapaDaAmazonia);
  }
}
