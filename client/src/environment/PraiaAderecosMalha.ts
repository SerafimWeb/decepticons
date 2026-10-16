import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TIPOS_QUE_FLUTUAM, type Adereco, type TipoDeAdereco } from './PraiaAderecos';
import { camadasDoTipo, type Camada, type MaterialDaCamada } from './PraiaGeometrias';
import { NIVEL_DO_MAR } from './PraiaTerreno';
import type { UniformesDaPraia } from './PraiaUniformes';
import { materialDaCamada } from './PraiaVida';

/**
 * A MALHA DOS ADEREÇOS DA PRAIA (P127, rodada de luz): todos os adereços — coqueiros, guarda-sóis, jangadas, barracas, postes, carros,
 * guindastes, o farol... — viram **malhas estáticas fundidas por material**, não uma malha instanciada por tipo. O mapa não muda, então
 * a fusão custa a mesma geometria (o instanciamento também desenha tudo, pois a caixa de cada instanciada cobre o mapa inteiro) e **corta
 * os desenhos de ~30 para 6** (um por material: `padrao`, `duplo`, `folha`, `vela` e os dois `brilho`): sobra orçamento de desenho para
 * o resto da rodada (luzes, gente, pipas, placas) sem passar do teto da ficha.
 *
 * A cor da instância (guarda-sol, carro, vela) entra **na cor de vértice**, e a fase do balanço (para as palmas não balançarem juntas)
 * vai num atributo `aFase`, calculado do lugar do adereço — a mesma conta que o instanciamento fazia.
 *
 * **Custo:** a fusão roda uma vez, no carregamento (~20 ms); depois são 6 desenhos, sem CPU por quadro.
 */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const EIXO_Y = new THREE.Vector3(0, 1, 0);

/** Os tipos cujo brilho liga e desliga (o aviso vermelho da antena e das boias). */
const PISCAM: ReadonlySet<TipoDeAdereco> = new Set<TipoDeAdereco>(['antena', 'boia', 'cftv', 'navioRebelde', 'lancha']);

/** Põe uma instância (`a`) da camada na posição e na cor dela: devolve uma geometria nova, em coordenadas do mundo. */
function instancia(camada: Camada, a: Adereco): THREE.BufferGeometry {
  const g = camada.geo.clone();
  const e = a.escala ?? 1;
  _m.compose(_p.set(a.x, (a.y ?? 0) + (TIPOS_QUE_FLUTUAM.has(a.tipo) ? NIVEL_DO_MAR : 0), a.z), _q.setFromAxisAngle(EIXO_Y, a.giro), _s.set(e, e, e));
  g.applyMatrix4(_m);
  const n = g.attributes.position!.count;
  if (camada.tinta) {
    // A cor da instância multiplica a cor de vértice (guarda-sol vermelho, carro azul...).
    _c.set(a.cor ?? 0xffffff);
    const cor = g.attributes.color!;
    for (let i = 0; i < n; i++) cor.setXYZ(i, cor.getX(i) * _c.r, cor.getY(i) * _c.g, cor.getZ(i) * _c.b);
  }
  // A fase do balanço, do lugar do adereço (palmas e velas não balançam juntas).
  g.setAttribute('aFase', new THREE.BufferAttribute(new Float32Array(n).fill(a.x * 0.21 + a.z * 0.13), 1));
  return g;
}

/**
 * Onde, numa malha fundida, ficam os vértices de UM adereço (P138): é o que deixa um coqueiro **sumir sem refazer a malha**. `esconderFaixa`
 * joga esses vértices para baixo do mundo (o triângulo some, sem custo de desenho) e `mostrarFaixa` os devolve exatamente.
 */
export interface FaixaDeVertices {
  malha: THREE.Mesh;
  inicio: number;
  quantidade: number;
  escondida?: boolean;
  original?: Float32Array;
}

export interface AderecosMontados {
  malhas: THREE.Mesh[];
  /** As faixas de cada adereço pedido em `registrar` (vazio para os demais). */
  faixas: Map<Adereco, FaixaDeVertices[]>;
}

/** O quanto `esconderFaixa` desce os vértices (m): bem abaixo do fundo do mar mais fundo. */
const ABAIXO_DO_MUNDO = 3000;

/** Esconde os vértices da faixa (os joga para baixo do mundo). Guarda a altura de cada um para `mostrarFaixa`. */
export function esconderFaixa(f: FaixaDeVertices): void {
  if (f.escondida) return;
  const posicao = f.malha.geometry.attributes.position as THREE.BufferAttribute;
  const v = posicao.array as Float32Array;
  f.original = v.slice(f.inicio * 3, (f.inicio + f.quantidade) * 3);
  for (let i = 0; i < f.quantidade; i++) v[(f.inicio + i) * 3 + 1]! -= ABAIXO_DO_MUNDO;
  posicao.addUpdateRange(f.inicio * 3, f.quantidade * 3);
  posicao.needsUpdate = true;
  f.escondida = true;
}

/** Devolve os vértices ao lugar de fábrica (exatamente: usa a cópia guardada, não soma de volta). */
export function mostrarFaixa(f: FaixaDeVertices): void {
  if (!f.escondida || !f.original) return;
  const posicao = f.malha.geometry.attributes.position as THREE.BufferAttribute;
  (posicao.array as Float32Array).set(f.original, f.inicio * 3);
  posicao.addUpdateRange(f.inicio * 3, f.quantidade * 3);
  posicao.needsUpdate = true;
  f.escondida = false;
  f.original = undefined;
}

/**
 * Monta os adereços de `lista` na `scene`: uma malha por material. Devolve as malhas (os testes contam os desenhos).
 * Os materiais compartilham o tempo (`u.tempo`): as palmas, as velas e os brilhos leem dele.
 */
export function montarAderecos(scene: THREE.Scene, u: UniformesDaPraia, lista: readonly Adereco[]): THREE.Mesh[] {
  return montarAderecosComFaixas(scene, u, lista).malhas;
}

/** Como `montarAderecos`, e guarda onde ficam os vértices dos adereços para os quais `registrar` devolve `true` (os que se quebram). */
export function montarAderecosComFaixas(scene: THREE.Scene, u: UniformesDaPraia, lista: readonly Adereco[], registrar?: (a: Adereco) => boolean): AderecosMontados {
  const camadasDoTipoMemo = new Map<TipoDeAdereco, Camada[]>();
  const grupos = new Map<string, { material: MaterialDaCamada; pisca: boolean; geos: THREE.BufferGeometry[]; vertices: number; pedidos: { a: Adereco; inicio: number; quantidade: number }[] }>();
  for (const a of lista) {
    let camadas = camadasDoTipoMemo.get(a.tipo);
    if (!camadas) {
      camadas = camadasDoTipo(a.tipo);
      camadasDoTipoMemo.set(a.tipo, camadas);
    }
    for (const camada of camadas) {
      const pisca = camada.material === 'brilho' && PISCAM.has(a.tipo);
      const chave = pisca ? 'brilho-pisca' : camada.material;
      let grupo = grupos.get(chave);
      if (!grupo) {
        grupo = { material: camada.material, pisca, geos: [], vertices: 0, pedidos: [] };
        grupos.set(chave, grupo);
      }
      const peca = instancia(camada, a);
      const n = peca.attributes.position!.count;
      if (registrar?.(a)) grupo.pedidos.push({ a, inicio: grupo.vertices, quantidade: n });
      grupo.vertices += n;
      grupo.geos.push(peca);
    }
  }
  const malhas: THREE.Mesh[] = [];
  const faixas = new Map<Adereco, FaixaDeVertices[]>();
  for (const { material, pisca, geos, pedidos } of grupos.values()) {
    const g = mergeGeometries(geos, false);
    if (!g) throw new Error('PraiaAderecosMalha: as peças de um material não têm os mesmos atributos');
    for (const peca of geos) peca.dispose();
    g.computeBoundingSphere();
    const malha = new THREE.Mesh(g, materialDaCamada(material, u.tempo, pisca));
    scene.add(malha);
    malhas.push(malha);
    for (const p of pedidos) {
      const lista = faixas.get(p.a) ?? [];
      lista.push({ malha, inicio: p.inicio, quantidade: p.quantidade });
      faixas.set(p.a, lista);
    }
  }
  return { malhas, faixas };
}
