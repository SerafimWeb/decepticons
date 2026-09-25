import type RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { GLOW, PALETTE } from '../core/palette';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { DebrisSystem } from './DebrisSystem';

export interface DestructibleDef {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  accent: number;
  hp: number;
}

interface Prop {
  def: DestructibleDef;
  group: THREE.Group;
  collider: RAPIER.Collider;
  edgeMat: THREE.LineBasicMaterial;
  accent: THREE.Color;
  center: THREE.Vector3;
  size: THREE.Vector3;
  hp: number;
  maxHp: number;
}

const DAMAGED = new THREE.Color(3, 0.15, 0.1);
const SPARK = new THREE.Color(3.0, 1.2, 0.2);
const DUST = GLOW.dust;

/**
 * Estruturas quebráveis: um colisor estático simples enquanto intactas;
 * ao zerar a vida viram destroços físicos (DebrisSystem).
 * No multiplayer, só o servidor decide a quebra e envia WALL_FRACTURED(id).
 */
export class Destructibles {
  onBreak?: (center: THREE.Vector3) => void;

  private readonly byCollider = new Map<number, Prop>();
  /** Todas as estruturas da arena, inteiras ou não: a rodada nova restaura as quebradas. */
  private readonly defs: DestructibleDef[] = [];
  private readonly geo = new THREE.BoxGeometry(1, 1, 1);
  /** Arestas do cubo unitário, compartilhadas (escala por prop); só o material é por prop. */
  private readonly edgeGeo = new THREE.EdgesGeometry(this.geo);
  private readonly mat = new THREE.MeshStandardMaterial({ color: PALETTE.steel, metalness: 0.3, roughness: 0.8 });

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly debris: DebrisSystem,
    private readonly particles: ParticleSystem,
  ) {}

  add(def: DestructibleDef): void {
    this.defs.push(def);
    this.build(def);
  }

  /**
   * Rodada nova: quebradas voltam, inteiras perdem o dano. Chame com os Mechs já nos pontos de
   * nascimento (livres de estruturas) e sem destroços, senão um colisor pode nascer dentro de algo.
   */
  restoreAll(): void {
    const standing = new Set<DestructibleDef>();
    for (const prop of this.byCollider.values()) {
      standing.add(prop.def);
      prop.hp = prop.maxHp;
      prop.edgeMat.color.copy(prop.accent);
    }
    for (const def of this.defs) if (!standing.has(def)) this.build(def);
  }

  private build(def: DestructibleDef): void {
    const center = new THREE.Vector3(def.x, def.h / 2, def.z);
    const size = new THREE.Vector3(def.w, def.h, def.d);
    const accent = new THREE.Color(def.accent).multiplyScalar(3);

    const group = new THREE.Group();
    group.position.copy(center);
    const body = new THREE.Mesh(this.geo, this.mat);
    body.scale.copy(size);
    group.add(body);
    const edgeMat = new THREE.LineBasicMaterial({ color: accent.clone() });
    const edges = new THREE.LineSegments(this.edgeGeo, edgeMat);
    edges.scale.copy(size);
    group.add(edges);
    this.scene.add(group);

    const collider = this.physics.addStaticBox(center, size);
    this.byCollider.set(collider.handle, { def, group, collider, edgeMat, accent, center, size, hp: def.hp, maxHp: def.hp });
  }

  /** Aplica dano se o colisor for destrutível. Retorna true se era. */
  damage(collider: RAPIER.Collider, amount: number, dir: THREE.Vector3): boolean {
    const prop = this.byCollider.get(collider.handle);
    if (!prop) return false;
    prop.hp -= amount;
    // Arestas vão do neon original ao vermelho conforme o dano.
    prop.edgeMat.color.lerpColors(prop.accent, DAMAGED, 1 - Math.max(0, prop.hp) / prop.maxHp);
    if (prop.hp <= 0) this.shatter(prop, dir, 10);
    return true;
  }

  /**
   * Explosão: cada destrutível a menos de `radius` da caixa leva dano que cai com a distância
   * (máximo no centro, zero na borda). Poucos destrutíveis por arena: um laço simples basta.
   */
  damageInRadius(at: THREE.Vector3, radius: number, maxDamage: number, dir: THREE.Vector3): void {
    for (const prop of [...this.byCollider.values()]) {
      const c = prop.center;
      const h = prop.size;
      // Distância do ponto até a caixa (0 se dentro).
      const dx = Math.max(0, Math.abs(at.x - c.x) - h.x / 2);
      const dy = Math.max(0, Math.abs(at.y - c.y) - h.y / 2);
      const dz = Math.max(0, Math.abs(at.z - c.z) - h.z / 2);
      const d = Math.hypot(dx, dy, dz);
      if (d < radius) this.damage(prop.collider, Math.round(maxDamage * (1 - d / radius)), dir);
    }
  }

  /** Quebra instantânea (ex.: dash do Colossus-01). */
  demolish(collider: RAPIER.Collider, dir: THREE.Vector3): boolean {
    const prop = this.byCollider.get(collider.handle);
    if (!prop) return false;
    this.shatter(prop, dir, 22);
    return true;
  }

  private shatter(prop: Prop, dir: THREE.Vector3, force: number): void {
    this.byCollider.delete(prop.collider.handle);
    this.physics.removeCollider(prop.collider);
    this.scene.remove(prop.group);
    prop.edgeMat.dispose();

    this.debris.shatter(prop.center, prop.size, dir, force);
    const up = new THREE.Vector3(0, 1, 0);
    this.particles.burst(prop.center, up, { count: 90, color: SPARK, speed: 26, life: 0.9, spread: 1.6 });
    this.particles.burst(prop.center, up, { count: 60, color: DUST, speed: 10, life: 1.6, spread: 2.5, gravity: 2 });
    this.onBreak?.(prop.center);
  }
}
