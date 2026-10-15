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

/** Uma caixa-alvo em coordenadas do mundo: o centro, o tamanho e, se for o caso, o giro (o coqueiro gira em Y). */
export interface CaixaAlvo {
  center: THREE.Vector3;
  size: THREE.Vector3;
  rotation?: THREE.Quaternion;
}

/** O que um alvo externo recebe para soltar os destroços e as partículas dele quando cai. */
export interface EfeitosDoAlvo {
  debris: DebrisSystem;
  particles: ParticleSystem;
}

/**
 * Um alvo destrutível cujo **desenho é de outro módulo** (os coqueiros e os adereços pequenos da praia, P138): aqui só a vida e as caixas
 * (sensores: o tiro e a explosão os acertam, o Mech não esbarra neles). Quem o desenha esconde e mostra, e solta os próprios destroços.
 * Um coqueiro tem duas caixas (o tronco e a copa); acertar qualquer uma tira da mesma vida.
 */
export interface AlvoExterno {
  caixas: readonly CaixaAlvo[];
  /** Onde ele está (para o abalo da câmera). */
  centro: THREE.Vector3;
  hp: number;
  /** Quanto o abalo da câmera conta quando ele cai (1 = uma barricada; um coqueiro é bem menos). */
  peso: number;
  /** A vida zerou: esconda o desenho e solte os destroços. `dir` é a direção do tiro; `force`, o empurrão. */
  quebrou(efeitos: EfeitosDoAlvo, dir: THREE.Vector3, force: number): void;
  /** A rodada nova trouxe o alvo de volta: mostre o desenho de novo. */
  voltou(): void;
  /** Um acerto que não quebrou (`restante` de 0 a 1 da vida): o tranco do desenho. Opcional. */
  acertou?(efeitos: EfeitosDoAlvo, restante: number, caixa: CaixaAlvo): void;
}

interface Prop {
  /** Id estável (posição em `entradas`): mesmo no cliente e no servidor, para o evento de rede. */
  id: number;
  /** Só nas barricadas: o desenho (a caixa com arestas) e a cor do neon. Os alvos externos desenham-se sozinhos. */
  group?: THREE.Group;
  edgeMat?: THREE.LineBasicMaterial;
  accent?: THREE.Color;
  externo?: AlvoExterno;
  colliders: RAPIER.Collider[];
  caixas: readonly CaixaAlvo[];
  center: THREE.Vector3;
  size: THREE.Vector3;
  hp: number;
  maxHp: number;
}

const REMOTE_DIR = new THREE.Vector3(0, 1, 0);

const DAMAGED = new THREE.Color(3, 0.15, 0.1);
const SPARK = new THREE.Color(3.0, 1.2, 0.2);
const DUST = GLOW.dust;

const ehExterno = (e: DestructibleDef | AlvoExterno): e is AlvoExterno => 'quebrou' in e;

const _local = new THREE.Vector3();
const _inversa = new THREE.Quaternion();

/** A distância de `at` até a caixa mais perto (0 se dentro): é de onde a explosão tira o dano. Respeita o giro de cada caixa. */
function distanciaAteAsCaixas(at: THREE.Vector3, caixas: readonly CaixaAlvo[]): number {
  let menor = Infinity;
  for (const { center: c, size: h, rotation } of caixas) {
    _local.copy(at).sub(c);
    if (rotation) _local.applyQuaternion(_inversa.copy(rotation).invert());
    const dx = Math.max(0, Math.abs(_local.x) - h.x / 2);
    const dy = Math.max(0, Math.abs(_local.y) - h.y / 2);
    const dz = Math.max(0, Math.abs(_local.z) - h.z / 2);
    const d = Math.hypot(dx, dy, dz);
    if (d < menor) menor = d;
  }
  return menor;
}

/**
 * Estruturas quebráveis: um colisor estático simples enquanto intactas;
 * ao zerar a vida viram destroços físicos (DebrisSystem).
 * No multiplayer, só o servidor decide a quebra e envia WALL_FRACTURED(id).
 * Os **alvos externos** (`addExterno`, P138) têm a mesma vida e o mesmo dano, mas as caixas são sensores e o desenho é de quem os registrou.
 */
export class Destructibles {
  /** Uma barricada quebrou: `id` estável (posição em `entradas`), `center` onde ela estava. No multiplayer, o servidor
   * envia `PROP_BROKEN(id)` para os clientes desenharem o mesmo. (Os alvos externos não passam por aqui: a praia é só offline.) */
  onBreak?: (id: number, center: THREE.Vector3) => void;
  /** Um alvo externo (um coqueiro...) caiu em `center`: `peso` é o tamanho do abalo (a câmera treme menos que numa barricada). */
  onAlvoQuebrado?: (center: THREE.Vector3, peso: number) => void;

  private readonly byCollider = new Map<number, Prop>();
  private readonly byId = new Map<number, Prop>();
  /** Os que estão em pé (um por prop: o alvo de duas caixas aparece duas vezes em `byCollider`). */
  private readonly vivos = new Set<Prop>();
  /** Tudo o que a arena tem, inteiro ou não: a rodada nova restaura o quebrado. */
  private readonly entradas: (DestructibleDef | AlvoExterno)[] = [];
  /** Os atingidos por uma explosão, reaproveitado (G4: sem alocar a cada explosão). */
  private readonly atingidos: Prop[] = [];
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
    const id = this.entradas.length;
    this.entradas.push(def);
    this.build(def, id);
  }

  /** Registra um alvo cujo desenho é de quem chama (ver `AlvoExterno`). Devolve o id estável. */
  addExterno(alvo: AlvoExterno): number {
    const id = this.entradas.length;
    this.entradas.push(alvo);
    this.build(alvo, id);
    return id;
  }

  /**
   * Rodada nova: quebradas voltam, inteiras perdem o dano. Chame com os Mechs já nos pontos de
   * nascimento (livres de estruturas) e sem destroços, senão um colisor pode nascer dentro de algo.
   */
  restoreAll(): void {
    const standing = new Set<number>();
    for (const prop of this.vivos) {
      standing.add(prop.id);
      prop.hp = prop.maxHp;
      prop.edgeMat?.color.copy(prop.accent!);
    }
    for (let id = 0; id < this.entradas.length; id++) {
      if (standing.has(id)) continue;
      const entrada = this.entradas[id]!;
      this.build(entrada, id);
      if (ehExterno(entrada)) entrada.voltou();
    }
  }

  /** Os ids ainda em pé (para teste e diagnóstico). */
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

  private registra(prop: Prop): void {
    for (const c of prop.colliders) this.byCollider.set(c.handle, prop);
    this.byId.set(prop.id, prop);
    this.vivos.add(prop);
  }

  private build(entrada: DestructibleDef | AlvoExterno, id: number): void {
    if (ehExterno(entrada)) {
      const colliders = entrada.caixas.map((c) => this.physics.addStaticSensorBox(c.center, c.size, c.rotation));
      this.registra({ id, externo: entrada, colliders, caixas: entrada.caixas, center: entrada.centro, size: entrada.caixas[0]!.size, hp: entrada.hp, maxHp: entrada.hp });
      return;
    }
    const def = entrada;
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
    this.registra({ id, group, colliders: [collider], caixas: [{ center, size }], edgeMat, accent, center, size, hp: def.hp, maxHp: def.hp });
  }

  /** Aplica dano se o colisor for destrutível. Retorna true se era. */
  damage(collider: RAPIER.Collider, amount: number, dir: THREE.Vector3): boolean {
    const prop = this.byCollider.get(collider.handle);
    if (!prop) return false;
    prop.hp -= amount;
    if (prop.hp <= 0) {
      this.shatter(prop, dir, 10);
      return true;
    }
    // Arestas vão do neon original ao vermelho conforme o dano; um alvo externo sacode o próprio desenho.
    if (prop.edgeMat) prop.edgeMat.color.lerpColors(prop.accent!, DAMAGED, 1 - Math.max(0, prop.hp) / prop.maxHp);
    else if (prop.externo?.acertou) {
      const i = Math.max(0, prop.colliders.indexOf(collider));
      prop.externo.acertou({ debris: this.debris, particles: this.particles }, prop.hp / prop.maxHp, prop.caixas[i]!);
    }
    return true;
  }

  /**
   * Explosão: cada destrutível a menos de `radius` da caixa (de qualquer uma das caixas) leva dano que cai com a distância
   * (máximo no centro, zero na borda). Um laço simples basta (dezenas de barricadas, ~200 alvos na praia); a lista de atingidos é
   * reaproveitada (G4) e o dano vem depois do laço, porque quebrar tira o alvo do mapa.
   */
  damageInRadius(at: THREE.Vector3, radius: number, maxDamage: number, dir: THREE.Vector3): void {
    this.atingidos.length = 0;
    for (const prop of this.vivos) {
      if (distanciaAteAsCaixas(at, prop.caixas) < radius) this.atingidos.push(prop);
    }
    for (const prop of this.atingidos) {
      const d = distanciaAteAsCaixas(at, prop.caixas);
      this.damage(prop.colliders[0]!, Math.round(maxDamage * (1 - d / radius)), dir);
    }
    this.atingidos.length = 0;
  }

  /** Quebra instantânea (ex.: dash do Colossus-01). */
  demolish(collider: RAPIER.Collider, dir: THREE.Vector3): boolean {
    const prop = this.byCollider.get(collider.handle);
    if (!prop) return false;
    this.shatter(prop, dir, 22);
    return true;
  }

  private shatter(prop: Prop, dir: THREE.Vector3, force: number): void {
    for (const c of prop.colliders) {
      this.byCollider.delete(c.handle);
      this.physics.removeCollider(c);
    }
    this.byId.delete(prop.id);
    this.vivos.delete(prop);

    if (prop.externo) {
      // O desenho e os destroços são de quem registrou o alvo; aqui só a vida e o abalo.
      prop.externo.quebrou({ debris: this.debris, particles: this.particles }, dir, force);
      this.onAlvoQuebrado?.(prop.center, prop.externo.peso);
      return;
    }
    this.scene.remove(prop.group!);
    prop.edgeMat!.dispose();

    this.debris.shatter(prop.center, prop.size, dir, force);
    const up = new THREE.Vector3(0, 1, 0);
    this.particles.burst(prop.center, up, { count: 90, color: SPARK, speed: 26, life: 0.9, size: 1.35, expansion: -0.35, spread: 1.6 });
    this.particles.burst(prop.center, up, { count: 60, color: DUST, speed: 10, life: 1.6, size: 2.2, expansion: 1.35, spread: 2.5, gravity: 2 });
    this.onBreak?.(prop.id, prop.center);
  }
}
