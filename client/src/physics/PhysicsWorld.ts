import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';

/** Passo fixo da simulação (mesmo tick que o servidor vai usar). */
export const FIXED_DT = 1 / 60;
export const WORLD_GRAVITY = 25;

/** O filtro de quase toda consulta: sem destroços (corpos dinâmicos) e sem caixas-alvo (sensores): só o cenário que de fato bloqueia. */
const EXCLUI_DINAMICOS_E_ALVOS = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;

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
  /** Resultado do raycast, reaproveitado a cada chamada (G4: a mira e cada projétil chamam todo quadro/tick). */
  private readonly hit: PhysicsHit = { point: new THREE.Vector3(), normal: new THREE.Vector3(), distance: 0, collider: null as unknown as RAPIER.Collider };

  /** A inicialização do wasm, uma só para todos (ver `create`). */
  private static iniciando: Promise<void> | null = null;

  static async create(): Promise<PhysicsWorld> {
    // O pacote compat (Node) exige init(); no browser o alias do vite.config aponta
    // para o build com .wasm separado, que já chega inicializado e não tem init().
    // O `init()` do Rapier NÃO é reentrante: duas chamadas ao mesmo tempo (duas salas nascendo juntas no servidor, 19/10) instanciam o wasm duas vezes e corrompem os mundos
    // ("unreachable" e "attempted to take ownership of Rust value while it was borrowed", em metade das vezes): uma única promessa serve a todas as chamadas.
    PhysicsWorld.iniciando ??= Promise.resolve(RAPIER.init?.());
    await PhysicsWorld.iniciando;
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

  /**
   * Caixa-ALVO: um colisor **sensor** (P138: os coqueiros e os adereços pequenos que se quebram a tiro). O tiro (`raycast` com
   * `incluiAlvos`) e a explosão o acertam; **o Mech não esbarra nele** (o controlador de personagem ignora sensores), e a câmera, a mira,
   * a rota e a visão da IA também não: a praia segue com as vias livres que o `PraiaLayout.test` garante para um Colossus.
   */
  addStaticSensorBox(center: THREE.Vector3, size: THREE.Vector3, rotation?: THREE.Quaternion): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setTranslation(center.x, center.y, center.z).setSensor(true);
    if (rotation) desc.setRotation(rotation);
    return this.world.createCollider(desc);
  }

  /**
   * Terreno de altura (a praia, P127): UM colisor estático para o chão inteiro, em vez de centenas de caixas. A grade tem
   * `celulasX` × `celulasZ` células e `(celulasX + 1) × (celulasZ + 1)` alturas, na ordem do Rapier: **`alturas[ix * (celulasZ + 1) + iz]`**
   * (a coluna é o X, a linha é o Z; medido em `PhysicsWorld.test.ts`). `centro` é o meio da grade em planta, e `tamanho` a extensão
   * dela em X e Z. As alturas valem em metros (a escala vertical é 1).
   */
  addStaticHeightfield(celulasX: number, celulasZ: number, alturas: Float32Array, tamanho: { x: number; z: number }, centro: { x: number; z: number }): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.heightfield(celulasZ, celulasX, alturas, { x: tamanho.x, y: 1, z: tamanho.z }).setTranslation(centro.x, 0, centro.z);
    return this.world.createCollider(desc);
  }

  removeCollider(collider: RAPIER.Collider): void {
    this.world.removeCollider(collider, true);
  }

  /**
   * Raycast de jogo (tiro, mira, câmera). `dir` precisa estar normalizado.
   * Ignora corpos dinâmicos: destroços são só cosméticos e nunca bloqueiam tiro nem mira
   * (o servidor nem terá destroços). **As caixas-alvo (sensores, `addStaticSensorBox`) só contam com `incluiAlvos`**: o tiro e o míssil as
   * acertam; a câmera, a mira, a rota e a visão da IA seguem sem vê-las.
   */
  raycast(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
    exclude?: RAPIER.Collider,
    incluiAlvos = false,
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
      incluiAlvos ? RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC : EXCLUI_DINAMICOS_E_ALVOS,
      undefined,
      exclude,
    );
    if (!hit) return null;
    // O mesmo objeto volta em todas as chamadas: quem precisar guardar, copie antes do próximo raycast.
    const out = this.hit;
    out.point.copy(origin).addScaledVector(dir, hit.timeOfImpact);
    out.normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
    out.distance = hit.timeOfImpact;
    out.collider = hit.collider;
    return out;
  }

  /**
   * Altura do terreno (chão, parede, telhado) em (x, z), olhando de `fromY` para baixo até `maxDist`; `null` se não há nada.
   * Mech (corpo cinemático) e destroço não contam: o terreno é o que fica parado quando o Mech sai de cima. Serve ao aviso no
   * chão da chuva de mísseis.
   */
  terrainY(x: number, z: number, fromY: number, maxDist: number): number | null {
    this.rayOrigin.x = x;
    this.rayOrigin.y = fromY;
    this.rayOrigin.z = z;
    this.rayDir.x = 0;
    this.rayDir.y = -1;
    this.rayDir.z = 0;
    const hit = this.world.castRay(this.ray, maxDist, true, EXCLUI_DINAMICOS_E_ALVOS | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC);
    return hit ? fromY - hit.timeOfImpact : null;
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
    const hit = this.world.castRay(this.ray, maxDist, true, EXCLUI_DINAMICOS_E_ALVOS, undefined, exclude);
    return hit?.collider ?? null;
  }

  step(): void {
    this.world.step();
  }
}
