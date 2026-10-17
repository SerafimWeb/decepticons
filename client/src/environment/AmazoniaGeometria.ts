import * as THREE from 'three';

/**
 * Os ajudantes de geometria do mapa da Amazônia (P180, parte B): juntar várias formas pintadas (cor por vértice e a **vida** de cada parte, que a frente do rio mata) numa geometria só. Só roda
 * na montagem, uma vez; o jogo desenha o resultado em UM desenho.
 */
export interface Acumulador {
  pos: number[];
  nor: number[];
  cor: number[];
  vida: number[];
}

export const novoAcumulador = (): Acumulador => ({ pos: [], nor: [], cor: [], vida: [] });

/** Acrescenta ao `acumulador` os triângulos de `geo` (já transformada), pintados de `cor`, com a `vida` dada (0 pedra e metal, 1 vegetação). */
export function juntar(acumulador: Acumulador, geo: THREE.BufferGeometry, cor: readonly [number, number, number], vida: number): void {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  for (let i = 0; i < p.count; i++) {
    acumulador.pos.push(p.getX(i), p.getY(i), p.getZ(i));
    acumulador.nor.push(n.getX(i), n.getY(i), n.getZ(i));
    acumulador.cor.push(cor[0], cor[1], cor[2]);
    acumulador.vida.push(vida);
  }
}

export function geometriaDe(a: Acumulador): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(a.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(a.cor, 3));
  g.setAttribute('aVida', new THREE.Float32BufferAttribute(a.vida, 1));
  return g;
}
