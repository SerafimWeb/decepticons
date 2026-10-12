import * as THREE from 'three';
import { expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { DebrisSystem } from './DebrisSystem';

/**
 * O three.js só cria o buffer de cor por instância no primeiro `setColorAt`, e ter ou não `instanceColor` muda a variante do
 * shader (`USE_INSTANCING_COLOR`). Quando o buffer nascia no primeiro destroço, o programa novo compilava no meio da partida e
 * congelava o jogo ~1,5 s na GPU integrada, e a pré-compilação do carregamento só enxergava a variante sem cor.
 */
it('o buffer de cor já existe ao construir e o primeiro destroço não o troca (a variante do shader não muda em jogo)', async () => {
  const physics = await PhysicsWorld.create();
  const debris = new DebrisSystem(new THREE.Scene(), physics);
  const antes = debris.mesh.instanceColor;
  expect(antes).not.toBeNull();
  expect(debris.mesh.count).toBe(0); // nada é desenhado até haver destroço
  expect(antes!.count).toBeGreaterThanOrEqual(240); // um por peça possível (o teto é MAX_PIECES)

  debris.shatter(new THREE.Vector3(0, 3, 0), new THREE.Vector3(4, 2, 4), new THREE.Vector3(1, 0, 0));
  expect(debris.mesh.count).toBeGreaterThan(0);
  expect(debris.mesh.instanceColor).toBe(antes); // o mesmo atributo: nenhuma variante nova a compilar
  physics.world.free();
});
