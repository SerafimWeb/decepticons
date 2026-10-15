import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { PhysicsWorld } from './PhysicsWorld';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe('as caixas-alvo (sensores): o tiro acerta, o resto do jogo atravessa (P138)', () => {
  let fisica: PhysicsWorld;
  beforeAll(async () => {
    fisica = await PhysicsWorld.create();
  });

  it('o raio de tiro (incluiAlvos) acerta o sensor; o raio comum (câmera, mira) o atravessa', () => {
    const alvo = fisica.addStaticSensorBox(V(0, 3, 10), V(1, 6, 1));
    fisica.step(); // o mundo atualiza a estrutura de consulta a cada tick
    const aFrente = V(0, 3, 0);
    const paraFrente = V(0, 0, 1);
    expect(fisica.raycast(aFrente, paraFrente, 50), 'sem incluiAlvos o raio passa').toBeNull();
    const tiro = fisica.raycast(aFrente, paraFrente, 50, undefined, true);
    expect(tiro?.collider.handle).toBe(alvo.handle);
    expect(tiro?.distance).toBeCloseTo(9.5, 3);
    fisica.removeCollider(alvo);
  });

  it('a visão da IA e a altura do chão não veem o sensor', () => {
    const alvo = fisica.addStaticSensorBox(V(20, 3, 10), V(1, 6, 1));
    fisica.step();
    expect(fisica.firstColliderOnRay(V(20, 3, 0), V(0, 0, 1), 50)).toBeNull();
    expect(fisica.terrainY(20, 10, 12, 30), 'o topo do sensor não é chão').toBeNull();
    fisica.removeCollider(alvo);
  });

  it('o sólido de verdade segue sendo visto por todos (o sensor não mudou o cenário)', () => {
    const parede = fisica.addStaticBox(V(40, 3, 10), V(4, 6, 1));
    fisica.step();
    expect(fisica.raycast(V(40, 3, 0), V(0, 0, 1), 50)?.collider.handle).toBe(parede.handle);
    expect(fisica.firstColliderOnRay(V(40, 3, 0), V(0, 0, 1), 50)?.handle).toBe(parede.handle);
    fisica.removeCollider(parede);
  });

  it('o controlador de personagem do Mech atravessa o sensor e esbarra no sólido (os mesmos filtros do MechBase)', () => {
    const filtro = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS; // o `IGNORE_DEBRIS` do MechBase
    const controlador = fisica.world.createCharacterController(0.02);
    const corpo = fisica.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(60, 2, 0));
    const capsula = fisica.world.createCollider(RAPIER.ColliderDesc.capsule(1, 1), corpo);
    const andar = (alvoZ: number): number => {
      controlador.computeColliderMovement(capsula, { x: 0, y: 0, z: alvoZ }, filtro);
      return controlador.computedMovement().z;
    };

    const sensor = fisica.addStaticSensorBox(V(60, 3, 5), V(2, 6, 2));
    fisica.step();
    expect(andar(8), 'o sensor não segura o Mech').toBeCloseTo(8, 2);
    fisica.removeCollider(sensor);

    const bloco = fisica.addStaticBox(V(60, 3, 5), V(2, 6, 2));
    fisica.world.step(); // atualiza a estrutura de consulta
    expect(andar(8), 'o sólido segura').toBeLessThan(5);
    fisica.removeCollider(bloco);

    fisica.world.removeCharacterController(controlador);
    fisica.world.removeRigidBody(corpo);
  });
});
