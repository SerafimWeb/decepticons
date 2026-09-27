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
  /** Id estável (posição em `defs`): mesmo no cliente e no servidor, para o evento de rede. */
  id: number;
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

const REMOTE_DIR = new THREE.Vector3(0, 1, 0);

const DAMAGED = new THREE.Color(3, 0.15, 0.1);
const SPARK = new THREE.Color(3.0, 1.2, 0.2);
const DUST = GLOW.dust;

/**
 * Estruturas quebráveis: um colisor estático simples enquanto intactas;
 * ao zerar a vida viram destroços físicos (DebrisSystem).
 * No multiplayer, só o servidor decide a quebra e envia WALL_FRACTURED(id).
 */
export class Destructibles {
  /** Uma barricada quebrou: `id` estável (posição em `defs`), `center` onde ela estava. No multiplayer, o servidor
   * envia `PROP_BROKEN(id)` para os clientes desenharem o mesmo. */
  onBreak?: (id: number, center: THREE.Vector3) => void;

  private readonly byCollider = new Map<number, Prop>();
  private readonly byId = new Map<number, Prop>();
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
    const id = this.defs.length;
    this.defs.push(def);
    this.build(def, id);
  }

  /**
   * Rodada nova: quebradas voltam, inteiras perdem o dano. Chame com os Mechs já nos pontos de
   * nascimento (livres de estruturas) e sem destroços, senão um colisor pode nascer dentro de algo.
   */
  restoreAll(): void {
    const standing = new Set<number>();
    for (const prop of this.byCollider.values()) {
      standing.add(prop.id);
      prop.hp = prop.maxHp;
      prop.edgeMat.color.copy(prop.accent);
    }
    for (let id = 0; id < this.defs.length; id++) if (!standing.has(id)) this.build(this.defs[id]!, id);
  }

  /** Os ids das barricadas ainda em pé (para teste e diagnóstico). */
  standingIds(): number[] {
    return [...this.byId.keys()].sort((a, b) => a - b);
  }

  /**
   * Multiplayer: o servidor mandou `PROP_BROKEN(id)` — quebra a mesma barricada no cliente, sem calcular dano.
   * Se ela já não existe (evento chegou repetido), não faz nada.
   */
  breakById(id: number): void {
    const prop = this.byId.get(id);
    if (prop) this.shatter(prop, REMOTE_DIR, 10);
  }

  private build(def: DestructibleDef, id: number): void {
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
    const prop: Prop = { id, def, group, collider, edgeMat, accent, center, size, hp: def.hp, maxHp: def.hp };
    this.byCollider.set(collider.handle, prop);
    this.byId.set(id, prop);
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
    this.byId.delete(prop.id);
    this.physics.removeCollider(prop.collider);
    this.scene.remove(prop.group);
    prop.edgeMat.dispose();

    this.debris.shatter(prop.center, prop.size, dir, force);
    const up = new THREE.Vector3(0, 1, 0);
    this.particles.burst(prop.center, up, { count: 90, color: SPARK, speed: 26, life: 0.9, size: 1.35, expansion: -0.35, spread: 1.6 });
    this.particles.burst(prop.center, up, { count: 60, color: DUST, speed: 10, life: 1.6, size: 2.2, expansion: 1.35, spread: 2.5, gravity: 2 });
    this.onBreak?.(prop.id, prop.center);
  }
}
