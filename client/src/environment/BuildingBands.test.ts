import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildingBands } from './BuildingBands';

describe('faixas estáticas dos prédios', () => {
  it.each([[16,30,16,5],[12,20,22,3],[24,42,12,8]])('preserva cada faixa de %s × %s × %s em uma malha', (w,h,d,count) => {
    const geometry = new THREE.BoxGeometry(1,1,1);
    const material = new THREE.MeshBasicMaterial();
    const mesh = buildingBands(w,h,d,5,geometry,material)!;
    expect(mesh.count).toBe(count);
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.material).toBe(material);
    const matrix = new THREE.Matrix4();
    for(let i=0;i<count;i++) {
      mesh.getMatrixAt(i,matrix);
      // Contrato anterior: caixa unitária escalada e movida dentro do grupo do prédio.
      const old = new THREE.Mesh(geometry,material);
      old.scale.set(w+0.12,0.18,d+0.12);
      old.position.y=(i+1)*5-h/2;
      old.updateMatrix();
      matrix.elements.forEach((v,j)=>expect(v).toBeCloseTo(old.matrix.elements[j]!,5));
      const bounds = new THREE.Box3().setFromObject(old);
      expect(mesh.boundingBox!.min.x).toBeLessThanOrEqual(bounds.min.x+0.00001);
      expect(mesh.boundingBox!.max.x).toBeGreaterThanOrEqual(bounds.max.x-0.00001);
      expect(mesh.boundingBox!.min.y).toBeLessThanOrEqual(bounds.min.y+0.00001);
      expect(mesh.boundingBox!.max.y).toBeGreaterThanOrEqual(bounds.max.y-0.00001);
      const corners=[bounds.min,bounds.max];
      for(const p of corners) expect(mesh.boundingSphere!.center.distanceTo(p)).toBeLessThanOrEqual(mesh.boundingSphere!.radius+0.00001);
    }
    // Nada pede atualização por frame; a mesma geometria/material serve a todos os andares.
    expect(mesh.instanceMatrix.usage).toBe(THREE.StaticDrawUsage);
    mesh.dispose();geometry.dispose();material.dispose();
  });

  it('não cria desenho para um prédio sem andar com faixa',()=> {
    const geometry=new THREE.BoxGeometry();const material=new THREE.MeshBasicMaterial();
    expect(buildingBands(4,6,4,5,geometry,material)).toBeNull();
    geometry.dispose();material.dispose();
  });

  it('recusa intervalo que impediria a montagem terminar',()=> {
    const geometry=new THREE.BoxGeometry();const material=new THREE.MeshBasicMaterial();
    for(const floor of [0,-1,Infinity,NaN]) expect(()=>buildingBands(4,30,4,floor,geometry,material)).toThrow(RangeError);
    geometry.dispose();material.dispose();
  });
});
