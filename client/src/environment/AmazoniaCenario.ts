import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { aderecosDaAmazonia, COR_DA_PECA } from './AmazoniaAderecos';
import { geometriaDe, juntar, novoAcumulador } from './AmazoniaGeometria';

/**
 * AS ESTRUTURAS DA AMAZÔNIA, montadas (P180, parte B): todas as peças de `AmazoniaAderecos.ts` **fundidas numa malha só** (cor por vértice, UM desenho) e os colisores das peças sólidas
 * (a caixa de cada uma). Roda uma vez, na montagem; **por quadro não faz nada**.
 */
export interface CenarioMontado {
  mesh: THREE.Mesh;
  /** Quantos colisores estáticos as estruturas puseram na física. */
  colisores: number;
  /** Quantas peças e triângulos a malha tem (o teste confere o custo). */
  pecas: number;
  triangulos: number;
}

const _q = new THREE.Quaternion();
const _eixoY = new THREE.Vector3(0, 1, 0);

export function criarCenario(scene: THREE.Scene, physics: PhysicsWorld, material: THREE.Material): CenarioMontado {
  const acc = novoAcumulador();
  const lista = aderecosDaAmazonia();
  let colisores = 0;
  for (const a of lista) {
    let geo: THREE.BufferGeometry;
    if (a.forma === 'caixa') geo = new THREE.BoxGeometry(a.w, a.h, a.d);
    else if (a.forma === 'cilindro') geo = new THREE.CylinderGeometry(a.w * 0.96, a.w, a.h, 10, 1);
    else geo = new THREE.ConeGeometry(a.w, a.h, 10, 1);
    geo.rotateY(a.giro);
    geo.translate(a.x, a.y, a.z);
    juntar(acc, geo, COR_DA_PECA[a.cor], a.vida);
    geo.dispose();
    if (a.solido) {
      const tamanho = a.forma === 'caixa' ? new THREE.Vector3(a.w, a.h, a.d) : new THREE.Vector3(a.w * 2, a.h, a.d * 2);
      const gira = a.forma === 'caixa' && a.giro !== 0;
      physics.addStaticBox(new THREE.Vector3(a.x, a.y, a.z), tamanho, gira ? _q.setFromAxisAngle(_eixoY, a.giro).clone() : undefined);
      colisores++;
    }
  }
  const geometria = geometriaDe(acc);
  geometria.computeBoundingSphere();
  geometria.computeBoundingBox();
  const mesh = new THREE.Mesh(geometria, material);
  mesh.name = 'estruturas';
  mesh.matrixAutoUpdate = false;
  scene.add(mesh);
  return { mesh, colisores, pecas: lista.length, triangulos: acc.pos.length / 9 };
}
