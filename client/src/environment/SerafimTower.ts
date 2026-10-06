import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

/**
 * Prédio Serafim (dono, 06/10): monólito preto e brutalista, quatro blocos empilhados e desalinhados, uma faixa vertical
 * de LED segmentada na face voltada para a arena e, no topo, a base dos drones. Fica no canto oposto ao Banco VORCARIS
 * (times opostos). Referência: `.decepticons/arte/predio-serafim-referencia.png`.
 *
 * A forma e a colisão entram na simulação (o servidor monta a mesma arena: G14). A cor do LED é só desenho: verde com
 * tudo em ordem, vermelho pulsando em emergência (inimigo perto da base), e um modo que gira as cores. Custo: 4 draw calls
 * (casco fundido, arestas, LED instanciado, marcações do topo), tudo estático; o pulso troca uma cor por quadro.
 */
export const SERAFIM_TOWER = Object.freeze({ x: 80, z: 40, height: 56 });

export type SerafimLedMode = 'ok' | 'emergencia' | 'festa';

interface Block {
  /** Deslocamento do centro em relação ao prédio (m). A face oeste (−X, a do LED) fica alinhada em todos. */
  dz: number;
  w: number;
  d: number;
  h: number;
}

/** De baixo para cima; a face oeste de todos fica em x = 80 − 7 (o LED corre reto por ela). */
const BLOCKS: readonly Block[] = [
  { dz: 0, w: 14, d: 14, h: 16 },
  { dz: 0.6, w: 13.2, d: 14.6, h: 14 },
  { dz: -0.5, w: 14.6, d: 13.2, h: 14 },
  { dz: 0.3, w: 13.6, d: 13.8, h: 12 },
];
const WEST = SERAFIM_TOWER.x - 7;
const LED_SEGMENTS = 64;
const LED_GREEN = new THREE.Color(0x19ff5a).multiplyScalar(3.2);
const LED_RED = new THREE.Color(0xff1a1a).multiplyScalar(3.4);

export class SerafimTower {
  /** Material do casco: a câmera tática o deixa translúcido quando tapa o Mech. */
  readonly material = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, metalness: 0.55, roughness: 0.5, transparent: true });
  readonly bounds: THREE.Box3;
  private readonly led = new THREE.MeshBasicMaterial({ color: LED_GREEN.clone(), toneMapped: false });
  private readonly marks = new THREE.LineBasicMaterial({ color: LED_GREEN.clone(), toneMapped: false });
  private mode: SerafimLedMode = 'ok';
  private clock = 0;

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    const { x, z } = SERAFIM_TOWER;
    const parts: THREE.BufferGeometry[] = [];
    const edges: THREE.BufferGeometry[] = [];
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    const piece = (cx: number, cy: number, cz: number, w: number, h: number, d: number, solid: boolean): void => {
      const g = new THREE.BoxGeometry(w, h, d).translate(cx, cy, cz);
      parts.push(g);
      edges.push(new THREE.EdgesGeometry(g));
      if (solid) physics.addStaticBox(center.set(cx, cy, cz), size.set(w, h, d));
    };

    let y = 0;
    for (const b of BLOCKS) {
      piece(WEST + b.w / 2, y + b.h / 2, z + b.dz, b.w, b.h, b.d, true);
      // Junta funda entre blocos: uma laje um pouco recuada, a sombra que separa as peças de concreto.
      piece(WEST + b.w / 2 + 0.3, y + b.h - 0.2, z + b.dz, b.w - 0.6, 0.4, b.d - 0.6, false);
      y += b.h;
    }
    // Aletas verticais na face norte e sul (brutalismo): sem colisão própria, ficam rente ao casco.
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      piece(WEST + 3.5 + i * 3.5, 24, z + side * 7.35, 0.7, 44, 0.7, false);
    }
    // Topo: laje da base dos drones, parapeito baixo e a cabine de controle.
    const top = SERAFIM_TOWER.height;
    piece(x, top + 0.3, z, 15.4, 0.6, 15.4, true);
    for (const [px, pz, w, d] of [[x, z - 7.5, 15.4, 0.4], [x, z + 7.5, 15.4, 0.4], [x - 7.5, z, 0.4, 15.4], [x + 7.5, z, 0.4, 15.4]] as const) {
      piece(px, top + 1.1, pz, w, 1, d, false);
    }
    piece(x + 5, top + 1.85, z + 5, 3.2, 2.5, 3.2, false);
    // Mastro da antena.
    piece(x + 5, top + 5, z + 5, 0.25, 4, 0.25, false);

    const hull = new THREE.Mesh(mergeGeometries(parts)!, this.material);
    const lines = new THREE.LineSegments(mergeGeometries(edges)!, new THREE.LineBasicMaterial({ color: 0x262b33 }));
    for (const g of parts) g.dispose();
    for (const g of edges) g.dispose();
    scene.add(hull, lines);

    // Faixa de LED: segmentos instanciados descendo a face oeste perto da quina norte (como na referência).
    const seg = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.62, 0.55), this.led, LED_SEGMENTS);
    const m = new THREE.Matrix4();
    const step = (top - 3) / LED_SEGMENTS;
    for (let i = 0; i < LED_SEGMENTS; i++) seg.setMatrixAt(i, m.makeTranslation(WEST - 0.1, 2 + i * step + step / 2, z + 4.6));
    seg.instanceMatrix.needsUpdate = true;
    scene.add(seg);

    // Marcações da base de drones: anel central de pouso, quatro anéis de doca e a cruz, numa geometria só.
    const pts: number[] = [];
    const ring = (cx: number, cz: number, r: number, n: number): void => {
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        pts.push(cx + Math.cos(a0) * r, top + 0.62, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, top + 0.62, cz + Math.sin(a1) * r);
      }
    };
    ring(x - 1, z - 1, 3.6, 40);
    for (const [dx, dz] of [[-5, -5], [3.2, -5], [-5, 3.2]] as const) ring(x + dx, z + dz, 1.1, 16);
    pts.push(x - 3.5, top + 0.62, z - 1, x + 1.5, top + 0.62, z - 1, x - 1, top + 0.62, z - 3.5, x - 1, top + 0.62, z + 1.5);
    const markGeo = new THREE.BufferGeometry();
    markGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(markGeo, this.marks));

    this.bounds = new THREE.Box3(new THREE.Vector3(WEST, 0, z - 7.5), new THREE.Vector3(WEST + 15, top + 6, z + 7.5));
  }

  get ledMode(): SerafimLedMode {
    return this.mode;
  }

  setMode(mode: SerafimLedMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'ok') this.paint(LED_GREEN);
  }

  /** Por quadro (render): pulsa no vermelho, gira o matiz na festa; no verde não escreve nada. */
  update(dt: number): void {
    if (this.mode === 'ok') return;
    this.clock += dt;
    if (this.mode === 'emergencia') {
      const k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.clock * 7));
      this.led.color.copy(LED_RED).multiplyScalar(k);
      this.marks.color.copy(this.led.color);
    } else {
      this.led.color.setHSL((this.clock * 0.12) % 1, 1, 0.5).multiplyScalar(3.2);
      this.marks.color.copy(this.led.color);
    }
  }

  private paint(c: THREE.Color): void {
    this.led.color.copy(c);
    this.marks.color.copy(c);
  }
}

/**
 * Placa SERAFIM no térreo da face oeste (só no navegador: usa canvas). A cor acompanha o LED do prédio.
 */
export function addSerafimPlaque(scene: THREE.Scene): void {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#22ff66';
  ctx.font = '700 118px Arial';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '28px';
  ctx.fillText('SERAFIM', 40, 100);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.7),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, color: new THREE.Color(2.2, 2.2, 2.2), depthWrite: false, toneMapped: false }),
  );
  plate.rotation.y = -Math.PI / 2;
  plate.position.set(WEST - 0.06, 8.5, SERAFIM_TOWER.z - 1.5);
  scene.add(plate);
}
