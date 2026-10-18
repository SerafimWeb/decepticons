import type * as THREE from 'three';
import type { CerebroDoChefe } from '../combat/CerebroDoChefe';
import type { MechBase } from '../entities/MechBase';
import type { Destructibles } from './Destructibles';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { PowerSpec } from '../tuning/power';
import type { EstadoDosObjetivos } from './AmazoniaObjetivos';
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
  /** A frente do rio avança `metros` rio abaixo (a cura: o limpo toma o lugar do morto). Só desenho. */
  curar(metros: number): void;
  /** A escotilha do chefe (P180, parte E): `aberta` mostra o marcador (anel, disco da carga e farol) em (x, z). Só desenho. */
  setEscotilha(aberta: boolean, x: number, z: number, carga: number): void;
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
  /** A altura do terreno em (x, z), se o mapa tem relevo (a Amazônia): onde os robôs da defesa nascem. Mapas planos não declaram. */
  alturaDoTerreno?(x: number, z: number): number;
}

/** O que o chefe do mapa precisa para nascer na partida. */
export interface CriarChefe {
  physics: PhysicsWorld;
  /** O desenho do chefe, se o cliente o carregou (`criarVisual`); `null` no servidor e nos testes de regra. */
  visual: object | null;
  /** A semente do cérebro (G2: nada de `Math.random`). */
  seed: number;
  /** As potências do painel (o corpo do chefe também as lê). */
  power?: PowerSpec;
}

/** O que a partida passa para montar os geradores do escudo: a cena, o registro dos alvos destrutíveis e os dois avisos para a regra (`sim/EscudoDoDraga.ts`). */
export interface CriarGeradores {
  scene: THREE.Scene;
  destructibles: Destructibles;
  /** O gerador `i` caiu (a vida zerou). */
  aoQuebrar(i: number): void;
  /** Rodada nova: os geradores voltaram de pé. */
  aoVoltar(): void;
}

/** A defesa do chefe do mapa (P180, parte D): o que se monta na cena além do corpo dele. Hoje, os geradores que alimentam o escudo do Draga. */
export interface DefesaCarregada {
  /** Quantos geradores alimentam o escudo. */
  readonly geradores: number;
  /** A vida de cada um (o dano do tiro e da explosão tira daqui). */
  readonly vidaDoGerador: number;
  /** As bocas das torres de vigia armadas (parte D2): x, y, z em metros, na ordem das torres da margem. */
  readonly torres: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  /** Onde a força de defesa monta guarda: os Mechs e os andróides (x, z). */
  readonly guarda: { readonly mechs: readonly (readonly [number, number])[]; readonly androids: readonly (readonly [number, number])[] };
  /** Monta os geradores na cena, registrados como alvos destrutíveis. Devolve os desenhos e os ids (o teste confere). */
  criarGeradores(o: CriarGeradores): { readonly grupos: readonly THREE.Object3D[]; readonly ids: readonly number[] };
}

/** O corpo de um chefe que aceita escudo (o Draga): o multiplicador do dano que ele recebe, escrito pela partida a cada tick. */
export interface CorpoComEscudo {
  escudo: number;
}

export const temEscudo = (m: unknown): m is CorpoComEscudo => typeof (m as CorpoComEscudo | null)?.escudo === 'number';

/** O que o jogo pede ao painel de objetivos da missão (a ordem no topo, a dica e os marcadores no mundo): `environment/AmazoniaObjetivos.ts`. */
export interface ObjetivosCarregados {
  atualizar(dt: number, estado: EstadoDosObjetivos): void;
  reiniciar(): void;
}

/** O chefe de um mapa (o Draga-01 da Amazônia, P180 parte C), carregado sob demanda: o corpo, o cérebro e o desenho só baixam para quem abre a missão. */
export interface ChefeCarregado {
  /** Onde ele nasce (x, z) e para onde olha (yaw do Mech). */
  nascimento: { x: number; z: number; yaw: number };
  /** O corpo (um `MechBase`) e o cérebro que o `BotSystem` roda a cada tick. */
  criar(o: CriarChefe): { mech: MechBase; brain: CerebroDoChefe };
  /** O desenho já pronto (o `.glb` baixa aqui, só no cliente). */
  criarVisual?(): Promise<object>;
  /** A defesa da missão (os geradores do escudo), se ela tem. */
  readonly defesa?: DefesaCarregada;
  /** O objetivo na tela (TERRAS RARAS): `raiz` é o `#hud`, `aoTitulo` recebe a ordem do topo quando ela muda. */
  criarObjetivos?(raiz: HTMLElement, aoTitulo: (texto: string) => void): ObjetivosCarregados;
}

const carregados = new Map<MapId, MapaCarregado>();
const chefes = new Map<MapId, ChefeCarregado>();

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

/** O chefe do mapa, se já foi carregado. */
export function chefeCarregado(id: MapId): ChefeCarregado | undefined {
  return chefes.get(id);
}

/** Como o chefe é obrigatório para montar a missão: erro claro em vez de um `undefined` mais adiante. */
export function exigirChefe(id: MapId): ChefeCarregado {
  const c = chefes.get(id);
  if (!c) throw new Error('o chefe do mapa "' + id + '" não foi carregado: chame carregarChefeSeFor("' + id + '") antes de montar a partida');
  return c;
}

/** Baixa e registra o chefe do mapa, se ele tem um (hoje só a Amazônia). Idempotente; separado do mapa porque o Deathmatch não paga pelo Draga. */
export async function carregarChefeSeFor(id: MapId): Promise<void> {
  if (id === 'amazonia' && !chefes.has(id)) {
    const { chefeDaAmazonia } = await import('./AmazoniaChefe');
    chefes.set(id, chefeDaAmazonia);
  }
}

/** Baixa e registra o código do mapa, se ele é de carga sob demanda. Idempotente; os mapas que moram no pacote de partida não fazem nada. */
export async function carregarMapaSeFor(id: MapId): Promise<void> {
  if (id === 'amazonia' && !carregados.has(id)) {
    const { mapaDaAmazonia } = await import('./AmazoniaMapa');
    carregados.set(id, mapaDaAmazonia);
  }
}
