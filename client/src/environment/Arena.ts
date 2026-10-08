import * as THREE from 'three';
import { ARENA_ZONES } from '../combat/Zone';
import { CITY_NEON, PALETTE } from '../core/palette';
import { mulberry32 } from '../core/rng';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { buildFloorTexture, buildSkyTexture, FLOOR_TILE_METERS } from './Atmosphere';
import type { DestructibleDef, Destructibles } from './Destructibles';
import { SerafimTower } from './SerafimTower';

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
  { x: -28, z: -35, w: 16, d: 16, h: 30, accent: PALETTE.cyan },
  { x: 32, z: -15, w: 12, d: 22, h: 20, accent: PALETTE.pink },
  { x: 4, z: -70, w: 24, d: 12, h: 42, accent: PALETTE.fluo },
];

// Barricadas destrutíveis (cobertura que vira destroço).
const BARRICADES: DestructibleDef[] = [
  { x: -8, z: 0, w: 8, d: 2, h: 2.2, accent: PALETTE.fluo, hp: 400 },
  { x: 14, z: 8, w: 2, d: 8, h: 2.2, accent: PALETTE.cyan, hp: 400 },
  { x: -30, z: 10, w: 6, d: 6, h: 3.5, accent: PALETTE.pink, hp: 700 },
  { x: 10, z: -38, w: 10, d: 2, h: 2.2, accent: PALETTE.sodium, hp: 400 },
  { x: 22, z: 30, w: 3, d: 3, h: 6, accent: PALETTE.green, hp: 500 },
  { x: -14, z: 32, w: 12, d: 1.5, h: 4, accent: PALETTE.fluo, hp: 600 },
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
  /** Prédio Serafim: a base do time, no canto oposto ao Banco VORCARIS. */
  readonly serafim: SerafimTower;

  private readonly boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private readonly solidMat = new THREE.MeshStandardMaterial({ color: PALETTE.steel, metalness: 0.3, roughness: 0.8 });

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    destructibles: Destructibles,
  ) {
    scene.background = buildSkyTexture();
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
    this.serafim = new SerafimTower(scene, physics);
    this.occluders.push({ box: this.serafim.bounds, material: this.serafim.material });
    for (const b of BARRICADES) destructibles.add(b);
    this.buildPlatform();
    this.buildSkyline();
    this.buildZones();
  }

  /**
   * Disco no chão + anel de cada zona (`combat/Zone.ts`, sem colisor: a regra é por distância, não
   * física). Verde = cura, ciano = resfriamento, mesma leitura de cor do resto do jogo. Visual provisório
   * (2 draw calls por zona, estático); Codex pode substituir por algo mais elaborado depois.
   */
  private buildZones(): void {
    for (const z of ARENA_ZONES) {
      const accent = z.kind === 'heal' ? PALETTE.green : PALETTE.cyan;
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(z.radius, 32),
        new THREE.MeshBasicMaterial({ color: neon(accent, 0.9), transparent: true, opacity: 0.18, depthWrite: false }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(z.x, 0.03, z.z);
      this.scene.add(disc);

      const ringPts: THREE.Vector3[] = [];
      const segs = 48;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(z.x + Math.cos(a) * z.radius, 0.05, z.z + Math.sin(a) * z.radius));
      }
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: neon(accent, 3) })));
    }
  }

  private buildFloorAndBounds(): void {
    // 704 m = 88 ladrilhos de 8 m: a origem cai numa junta e as placas casam com as células de 4 m da grade.
    const FLOOR_SIZE = 704;
    const map = buildFloorTexture();
    map.repeat.set(FLOOR_SIZE / FLOOR_TILE_METERS, FLOOR_SIZE / FLOOR_TILE_METERS);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
      new THREE.MeshStandardMaterial({ color: PALETTE.ground, map, metalness: 0.4, roughness: 0.7 }),
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
      new THREE.LineBasicMaterial({ color: neon(PALETTE.pink, 3) }),
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
    this.addSolid(new THREE.Vector3(p.x, p.h / 2, p.z), new THREE.Vector3(p.w, p.h, p.d), PALETTE.pink);

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
    this.addSolid(center, new THREE.Vector3(length, thickness, RAMP_WIDTH), PALETTE.pink, undefined, rot);
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

  /**
   * Horizonte fora da arena, sem colisão: torres escuras com uma faixa neon cada e uma luz no topo,
   * em cores sorteadas da cidade (semente fixa), mais um céu de estrelas. 4 draw calls no total
   * (instâncias + pontos), estático: nada por quadro.
   */
  /** Céu estrelado (espacial): pontos numa casca bem longe, na metade de cima. 1 draw call, estático. */
  private buildStars(rand: () => number): THREE.Points {
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const up = 0.08 + rand() * 0.92; // só acima do horizonte
      const r = 600;
      const flat = Math.sqrt(1 - up * up);
      pos.set([Math.cos(a) * flat * r, up * r, Math.sin(a) * flat * r], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
    stars.frustumCulled = false;
    return stars;
  }

  private buildSkyline(): void {
    const rand = mulberry32(1337);
    const count = 80;
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const towers = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ color: PALETTE.steelDark, metalness: 0.2, roughness: 0.9 }),
      count,
    );
    // Cor por instância (HDR, para o bloom): a luz do topo e a faixa de cada torre.
    const beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), count);
    const bands = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), count);
    const tint = new THREE.Color();

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const bandPos = new THREE.Vector3();
    const bandSize = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 140 + rand() * 140;
      const w = 12 + rand() * 22;
      const h = 30 + rand() * 130;
      p.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      s.set(w, h, 10 + rand() * 22);
      towers.setMatrixAt(i, m.compose(p, q, s));
      const color = CITY_NEON[Math.floor(rand() * CITY_NEON.length)]!;
      // Faixa luminosa numa altura sorteada, um pouco maior que a torre (aparece por fora).
      const bandY = h * (0.35 + rand() * 0.55);
      bands.setMatrixAt(i, m.compose(bandPos.set(p.x, bandY, p.z), q, bandSize.set(s.x + 0.3, 0.6, s.z + 0.3)));
      bands.setColorAt(i, tint.setHex(color).multiplyScalar(2.2));
      p.y = h + 1;
      beacons.setMatrixAt(i, m.compose(p, q, s.set(1, 1, 1)));
      beacons.setColorAt(i, tint.setHex(color).multiplyScalar(4));
    }
    this.scene.add(towers, bands, beacons, this.buildStars(rand));
  }
}
