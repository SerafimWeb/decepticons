import * as THREE from 'three';
import { PALETTE } from '../core/palette';
import { mulberry32 } from '../core/rng';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { DestructibleDef, Destructibles } from './Destructibles';

interface BlockDef {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  accent: number;
}

/** Algo que pode tapar a visão da câmera tática (fica translúcido). */
export interface Occluder {
  box: THREE.Box3;
  material: THREE.MeshStandardMaterial;
}

const BUILDINGS: BlockDef[] = [
  { x: -28, z: -35, w: 16, d: 16, h: 30, accent: PALETTE.green },
  { x: 32, z: -15, w: 12, d: 22, h: 20, accent: PALETTE.yellow },
  { x: 4, z: -70, w: 24, d: 12, h: 42, accent: PALETTE.bone },
];

// Barricadas destrutíveis (cobertura que vira destroço).
const BARRICADES: DestructibleDef[] = [
  { x: -8, z: 0, w: 8, d: 2, h: 2.2, accent: PALETTE.sodium, hp: 400 },
  { x: 14, z: 8, w: 2, d: 8, h: 2.2, accent: PALETTE.sodium, hp: 400 },
  { x: -30, z: 10, w: 6, d: 6, h: 3.5, accent: PALETTE.sodium, hp: 700 },
  { x: 10, z: -38, w: 10, d: 2, h: 2.2, accent: PALETTE.sodium, hp: 400 },
  { x: 22, z: 30, w: 3, d: 3, h: 6, accent: PALETTE.sodium, hp: 500 },
  { x: -14, z: 32, w: 12, d: 1.5, h: 4, accent: PALETTE.sodium, hp: 600 },
];

// Plataforma elevada + rampa (testa subida de rampa e pulo de cima).
const PLATFORM = { x: -50, z: 35, w: 16, d: 16, h: 6 };
const RAMP_RUN = 14;
const RAMP_WIDTH = 8;

/** Cor HDR (>1) para as linhas neon passarem do limiar do bloom. */
const neon = (hex: number, intensity = 2.5) => new THREE.Color(hex).multiplyScalar(intensity);

/**
 * Pontos de nascimento e de patrulha: chão livre, longe de prédios, barricadas e da plataforma.
 * O primeiro é o nascimento do jogador. Os bots também usam a lista como rota de patrulha.
 */
export const SPAWN_POINTS: readonly (readonly [number, number])[] = [
  [0, 25],
  [-18, -8],
  [6, -18],
  [24, 12],
  [45, -45],
  [-60, -60],
  [60, 20],
  [0, 55],
  [-40, -5],
  [-65, 60],
  [70, 70],
  [-75, 15],
];

export class Arena {
  readonly halfSize = 100;
  readonly occluders: Occluder[] = [];

  private readonly boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private readonly solidMat = new THREE.MeshStandardMaterial({ color: PALETTE.steel, metalness: 0.3, roughness: 0.8 });

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    destructibles: Destructibles,
  ) {
    scene.background = new THREE.Color(PALETTE.sky);
    scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0095);

    scene.add(new THREE.HemisphereLight(PALETTE.skyLight, PALETTE.groundLight, 0.9));
    const key = new THREE.DirectionalLight(PALETTE.keyLight, 1.2);
    key.position.set(40, 80, 30);
    scene.add(key);
    const rim = new THREE.DirectionalLight(PALETTE.rimLight, 0.6);
    rim.position.set(-60, 40, -40);
    scene.add(rim);

    this.buildFloorAndBounds();
    for (const b of BUILDINGS) this.addBuilding(b);
    for (const b of BARRICADES) destructibles.add(b);
    this.buildPlatform();
    this.buildSkyline();
  }

  private buildFloorAndBounds(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshStandardMaterial({ color: PALETTE.ground, metalness: 0.4, roughness: 0.7 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    this.physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(800, 2, 800));

    const h = this.halfSize;
    const grid = new THREE.GridHelper(h * 2, (h * 2) / 4, PALETTE.gridMain, PALETTE.gridSub);
    grid.position.y = 0.02;
    (grid.material as THREE.LineBasicMaterial).color.setScalar(1.4);
    this.scene.add(grid);

    const border = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-h, 0.05, -h),
        new THREE.Vector3(h, 0.05, -h),
        new THREE.Vector3(h, 0.05, h),
        new THREE.Vector3(-h, 0.05, h),
      ]),
      new THREE.LineBasicMaterial({ color: neon(PALETTE.green, 3) }),
    );
    this.scene.add(border);

    // Paredes invisíveis nos limites da arena.
    const t = 2;
    const wallH = 60;
    for (const [x, z, w, d] of [
      [0, -h - t / 2, h * 2 + t * 2, t],
      [0, h + t / 2, h * 2 + t * 2, t],
      [-h - t / 2, 0, t, h * 2],
      [h + t / 2, 0, t, h * 2],
    ]) {
      this.physics.addStaticBox(new THREE.Vector3(x, wallH / 2, z), new THREE.Vector3(w, wallH, d));
    }
  }

  /** Prédio sólido com arestas neon e faixas emissivas a cada 5 m. */
  private addBuilding(b: BlockDef): void {
    const material = this.solidMat.clone();
    material.transparent = true;
    const g = this.addSolid(new THREE.Vector3(b.x, b.h / 2, b.z), new THREE.Vector3(b.w, b.h, b.d), b.accent, material);

    const stripMat = new THREE.MeshBasicMaterial({ color: neon(b.accent, 2) });
    for (let y = 5; y < b.h - 1; y += 5) {
      const strip = new THREE.Mesh(this.boxGeo, stripMat);
      strip.scale.set(b.w + 0.12, 0.18, b.d + 0.12);
      strip.position.y = y - b.h / 2;
      g.add(strip);
    }

    this.occluders.push({
      box: new THREE.Box3(
        new THREE.Vector3(b.x - b.w / 2, 0, b.z - b.d / 2),
        new THREE.Vector3(b.x + b.w / 2, b.h, b.z + b.d / 2),
      ),
      material,
    });
  }

  private buildPlatform(): void {
    const p = PLATFORM;
    this.addSolid(new THREE.Vector3(p.x, p.h / 2, p.z), new THREE.Vector3(p.w, p.h, p.d), PALETTE.green);

    // Rampa descendo da borda +X da plataforma até o chão.
    const angle = Math.atan2(p.h, RAMP_RUN);
    const length = RAMP_RUN / Math.cos(angle);
    const thickness = 1;
    const topMidX = p.x + p.w / 2 + RAMP_RUN / 2;
    const center = new THREE.Vector3(
      topMidX - Math.sin(angle) * (thickness / 2),
      p.h / 2 - Math.cos(angle) * (thickness / 2),
      p.z,
    );
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle);
    this.addSolid(center, new THREE.Vector3(length, thickness, RAMP_WIDTH), PALETTE.green, undefined, rot);
  }

  private addSolid(
    center: THREE.Vector3,
    size: THREE.Vector3,
    accent: number,
    material: THREE.Material = this.solidMat,
    rotation?: THREE.Quaternion,
  ): THREE.Group {
    const g = new THREE.Group();
    g.position.copy(center);
    if (rotation) g.quaternion.copy(rotation);

    const body = new THREE.Mesh(this.boxGeo, material);
    body.scale.copy(size);
    g.add(body);
    g.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
        new THREE.LineBasicMaterial({ color: neon(accent, 3) }),
      ),
    );
    this.scene.add(g);
    this.physics.addStaticBox(center, size, rotation);
    return g;
  }

  /** Silhuetas de megaprédios fora da arena (sem colisão, 2 draw calls). */
  private buildSkyline(): void {
    const rand = mulberry32(1337);
    const count = 80;
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const towers = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ color: PALETTE.steelDark, metalness: 0.2, roughness: 0.9 }),
      count,
    );
    const beacons = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.8, 8, 6),
      new THREE.MeshBasicMaterial({ color: neon(PALETTE.signal, 4) }),
      count,
    );

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 140 + rand() * 140;
      const w = 12 + rand() * 22;
      const h = 30 + rand() * 130;
      p.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      s.set(w, h, 10 + rand() * 22);
      towers.setMatrixAt(i, m.compose(p, q, s));
      p.y = h + 1;
      beacons.setMatrixAt(i, m.compose(p, q, s.set(1, 1, 1)));
    }
    this.scene.add(towers, beacons);
  }
}
