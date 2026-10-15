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
 * Monta os adereços de `lista` na `scene`: uma malha por material. Devolve as malhas (os testes contam os desenhos).
 * Os materiais compartilham o tempo (`u.tempo`): as palmas, as velas e os brilhos leem dele.
 */
export function montarAderecos(scene: THREE.Scene, u: UniformesDaPraia, lista: readonly Adereco[]): THREE.Mesh[] {
  const camadasDoTipoMemo = new Map<TipoDeAdereco, Camada[]>();
  const grupos = new Map<string, { material: MaterialDaCamada; pisca: boolean; geos: THREE.BufferGeometry[] }>();
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
        grupo = { material: camada.material, pisca, geos: [] };
        grupos.set(chave, grupo);
      }
      grupo.geos.push(instancia(camada, a));
    }
  }
  const malhas: THREE.Mesh[] = [];
  for (const { material, pisca, geos } of grupos.values()) {
    const g = mergeGeometries(geos, false);
    if (!g) throw new Error('PraiaAderecosMalha: as peças de um material não têm os mesmos atributos');
    for (const peca of geos) peca.dispose();
    g.computeBoundingSphere();
    const malha = new THREE.Mesh(g, materialDaCamada(material, u.tempo, pisca));
    scene.add(malha);
    malhas.push(malha);
  }
  return malhas;
}
