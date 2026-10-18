import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SHAPE } from '../fx/particleShapes';
import { ESCUDO_DO_DRAGA } from '../sim/EscudoDoDraga';
import type { AlvoExterno, CaixaAlvo, EfeitosDoAlvo } from './Destructibles';
import { pontoDaTorre, TORRES_DA_MARGEM } from './AmazoniaAderecos';
import { AMAZONIA_GERADORES, AMAZONIA_GUARDA } from './AmazoniaLayout';
import { alturaDoTerreno } from './AmazoniaTerreno';
import type { DefesaCarregada } from './mapasSobDemanda';

/**
 * OS GERADORES DO ESCUDO DO DRAGA-01 (ordem P180, parte D; regra em `sim/EscudoDoDraga.ts`): três torres de força espalhadas pela margem e pela mina (`AMAZONIA_GERADORES`). Cada uma é um **alvo
 * destrutível** (`Destructibles.addExterno`, o mesmo dos coqueiros da praia, P138): a caixa-alvo é um **sensor** (o tiro e a explosão a acertam, o Mech atravessa), a vida é `vidaDoGerador`, e quebrar
 * uma esconde o desenho, solta os destroços e avisa a regra. Quando a última cai, o escudo cai.
 *
 * Desenho barato: **uma malha por gerador** (a base, o tambor, as bobinas e a antena fundidas, cor por vértice) mais **um brilho** (as bobinas acesas, em ciano). Seis desenhos no total,
 * nenhum por quadro além do pulso do brilho. Este módulo é do pedaço do mapa (carrega sob demanda com a missão, `mapasSobDemanda.ts`): o pacote de partida não o enxerga.
 */

const CORES = {
  concreto: new THREE.Color(0.42, 0.43, 0.42),
  metal: new THREE.Color(0.3, 0.32, 0.35),
  amarelo: new THREE.Color(0.85, 0.65, 0.1),
  escuro: new THREE.Color(0.1, 0.11, 0.12),
} as const;
const BRILHO = new THREE.Color(0.2, 1.0, 1.1);
const FAISCA = new THREE.Color(1.0, 2.3, 1.2);
const CIMA = new THREE.Vector3(0, 1, 0);

/** Pinta a geometria numa cor só (atributo `color` por vértice) para fundir tudo numa malha. */
function pintada(geo: THREE.BufferGeometry, cor: THREE.Color): THREE.BufferGeometry {
  const n = geo.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = cor.r;
    c[i * 3 + 1] = cor.g;
    c[i * 3 + 2] = cor.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

/** O corpo do gerador (sem as bobinas), com a base no chão (y = 0). */
function geometriaDoCorpo(): THREE.BufferGeometry {
  const pecas: THREE.BufferGeometry[] = [];
  pecas.push(pintada(new THREE.BoxGeometry(8, 1.2, 8).translate(0, 0.6, 0), CORES.concreto));
  pecas.push(pintada(new THREE.CylinderGeometry(2.6, 2.9, 6.4, 14).translate(0, 4.4, 0), CORES.amarelo));
  pecas.push(pintada(new THREE.CylinderGeometry(2.0, 2.0, 1.2, 14).translate(0, 8.4, 0), CORES.metal));
  for (const [x, z] of [[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]] as const) pecas.push(pintada(new THREE.BoxGeometry(0.9, 2.4, 0.9).translate(x, 2.4, z), CORES.escuro));
  pecas.push(pintada(new THREE.CylinderGeometry(0.16, 0.16, 8, 6).translate(0, 13, 0), CORES.escuro));
  return mergeGeometries(pecas, false);
}

/** As bobinas acesas: três anéis em volta do tambor. */
function geometriaDoBrilho(): THREE.BufferGeometry {
  const aneis: THREE.BufferGeometry[] = [];
  for (const y of [3.2, 5.0, 6.8]) aneis.push(new THREE.CylinderGeometry(3.05, 3.05, 0.34, 16, 1, true).translate(0, y, 0));
  aneis.push(new THREE.SphereGeometry(0.7, 8, 6).translate(0, 17.2, 0));
  return mergeGeometries(aneis, false);
}

/** A caixa que envolve o gerador (o sensor que o tiro acerta), do chão ao alto do tambor. */
function caixaDoGerador(x: number, y: number, z: number): CaixaAlvo {
  return { center: new THREE.Vector3(x, y + 4.6, z), size: new THREE.Vector3(7, 9.2, 7) };
}

export interface GeradoresMontados {
  /** Os desenhos, na ordem de `AMAZONIA_GERADORES` (o teste e o pulso do brilho leem). */
  readonly grupos: readonly THREE.Group[];
  /** Os ids que o `Destructibles` deu a cada alvo (para o teste conferir). */
  readonly ids: readonly number[];
}

/** A boca da arma de cada torre da margem: o alto da cabine (17,6 m) e 5 m para o rio, **fora** da cabine (que tem colisor de 7 m: de dentro dela todo raio bateria na própria parede). */
export function bocasDasTorres(): { x: number; y: number; z: number }[] {
  return TORRES_DA_MARGEM.map((_, i) => {
    const { x, z } = pontoDaTorre(i);
    return { x, y: alturaDoTerreno(x, z) + 17.6, z: z - 5 };
  });
}

export const defesaDaAmazonia: DefesaCarregada = {
  geradores: AMAZONIA_GERADORES.length,
  vidaDoGerador: ESCUDO_DO_DRAGA.vidaDoGerador,
  torres: bocasDasTorres(),
  guarda: AMAZONIA_GUARDA,
  criarGeradores({ scene, destructibles, aoQuebrar, aoVoltar }) {
    const corpo = geometriaDoCorpo();
    const brilho = geometriaDoBrilho();
    const materialDoCorpo = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.45 });
    const materialDoBrilho = new THREE.MeshBasicMaterial({ color: BRILHO, toneMapped: false, side: THREE.DoubleSide });
    const grupos: THREE.Group[] = [];
    const ids: number[] = [];
    AMAZONIA_GERADORES.forEach((g, i) => {
      const y = alturaDoTerreno(g.x, g.z);
      const grupo = new THREE.Group();
      grupo.name = `gerador-${g.nome.toLowerCase()}`;
      grupo.position.set(g.x, y, g.z);
      grupo.add(new THREE.Mesh(corpo, materialDoCorpo), new THREE.Mesh(brilho, materialDoBrilho));
      scene.add(grupo);
      grupos.push(grupo);
      const centro = new THREE.Vector3(g.x, y + 4.6, g.z);
      const alvo: AlvoExterno = {
        caixas: [caixaDoGerador(g.x, y, g.z)],
        centro,
        hp: ESCUDO_DO_DRAGA.vidaDoGerador,
        peso: 1.4,
        quebrou: (efeitos: EfeitosDoAlvo, dir: THREE.Vector3, force: number) => {
          grupo.visible = false;
          efeitos.debris.shatter(centro.clone(), new THREE.Vector3(7, 9, 7), dir, force, [CORES.amarelo, CORES.metal, CORES.concreto]);
          efeitos.particles.burst(centro, CIMA, { count: 70, color: FAISCA, speed: 22, life: 0.9, size: 1.3, expansion: -0.3, spread: 1.7, shape: SHAPE.streak });
          efeitos.particles.burst(centro, CIMA, { count: 30, color: BRILHO, speed: 14, life: 1.1, size: 1.6, expansion: 0.8, spread: 2 });
          aoQuebrar(i);
        },
        voltou: () => {
          grupo.visible = true;
          aoVoltar();
        },
        acertou: (efeitos: EfeitosDoAlvo, restante: number, caixa: CaixaAlvo) => {
          efeitos.particles.burst(caixa.center, CIMA, { count: Math.max(4, Math.round(10 * (1.2 - restante))), color: FAISCA, speed: 9, life: 0.5, size: 0.8, spread: 1.3, gravity: 6, shape: SHAPE.streak });
        },
      };
      ids.push(destructibles.addExterno(alvo));
    });
    return { grupos, ids } satisfies GeradoresMontados;
  },
};
