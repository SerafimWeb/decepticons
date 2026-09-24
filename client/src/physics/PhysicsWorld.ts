import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';

/** Passo fixo da simulação (mesmo tick que o servidor vai usar). */
export const FIXED_DT = 1 / 60;
export const WORLD_GRAVITY = 25;

export interface PhysicsHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  collider: RAPIER.Collider;
}

/**
 * Wrapper fino sobre o Rapier3D (Wasm + SIMD).
 * - Colisores estáticos não têm rigid body (custo zero na integração).
 * - Corpos dinâmicos (destroços) dormem sozinhos quando param.
 */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  private readonly rayOrigin = { x: 0, y: 0, z: 0 };
  private readonly rayDir = { x: 0, y: 0, z: 1 };
  private readonly ray: RAPIER.Ray;

  static async create(): Promise<PhysicsWorld> {
    // O pacote compat (Node) exige init(); no browser o alias do vite.config aponta
    // para o build com .wasm separado, que já chega inicializado e não tem init().
    await RAPIER.init?.();
    return new PhysicsWorld();
  }

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -WORLD_GRAVITY, z: 0 });
    this.world.timestep = FIXED_DT;
    this.ray = new RAPIER.Ray(this.rayOrigin, this.rayDir);
  }

  addStaticBox(center: THREE.Vector3, size: THREE.Vector3, rotation?: THREE.Quaternion): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setTranslation(
      center.x,
      center.y,
      center.z,
    );
    if (rotation) desc.setRotation(rotation);
    return this.world.createCollider(desc);
  }

  removeCollider(collider: RAPIER.Collider): void {
    this.world.removeCollider(collider, true);
  }

  /**
   * Raycast de jogo (tiro, mira, câmera). `dir` precisa estar normalizado.
   * Ignora corpos dinâmicos: destroços são só cosméticos e nunca bloqueiam tiro nem mira
   * (o servidor nem terá destroços).
   */
  raycast(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
    exclude?: RAPIER.Collider,
  ): PhysicsHit | null {
    this.rayOrigin.x = origin.x;
    this.rayOrigin.y = origin.y;
    this.rayOrigin.z = origin.z;
    this.rayDir.x = dir.x;
    this.rayDir.y = dir.y;
    this.rayDir.z = dir.z;
    const hit = this.world.castRayAndGetNormal(
      this.ray,
      maxDist,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC,
      undefined,
      exclude,
    );
    if (!hit) return null;
    return {
      point: origin.clone().addScaledVector(dir, hit.timeOfImpact),
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      distance: hit.timeOfImpact,
      collider: hit.collider,
    };
  }

  /**
   * Primeiro colisor no caminho do raio (linha de visão da IA). Mais barato que `raycast`:
   * sem normal e sem alocar resultado. Ignora destroços, como o `raycast`.
   */
  firstColliderOnRay(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
    exclude?: RAPIER.Collider,
  ): RAPIER.Collider | null {
    this.rayOrigin.x = origin.x;
    this.rayOrigin.y = origin.y;
    this.rayOrigin.z = origin.z;
    this.rayDir.x = dir.x;
    this.rayDir.y = dir.y;
    this.rayDir.z = dir.z;
    const hit = this.world.castRay(this.ray, maxDist, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, exclude);
    return hit?.collider ?? null;
  }

  step(): void {
    this.world.step();
  }
}
