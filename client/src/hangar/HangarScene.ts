import * as THREE from 'three';
import type { Loadout } from '../combat/weapons';
import { PALETTE } from '../core/palette';
import { Android } from '../entities/Android';
import { PILOT_ANDROID_STATS, type ChassisId } from '../entities/chassis';
import type { MechBase } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';

const CYAN = 0x5ce1ff;
const WARM = 0xffb05a;
const STEEL = 0x151c22;
/** Altura do topo do pedestal (m). */
const PEDESTAL_TOP = 0.7;
/** Raio do pedestal e da coluna de holograma (m). */
const PEDESTAL_R = 4.6;
const COLUMN_H = 15;
/** Volta completa da plataforma, girando sozinha (s). */
const TURN_S = 28;
/** Depois de girar com o dedo ou o mouse, a plataforma espera este tanto e volta a girar sozinha (s). */
const IDLE_AFTER_DRAG_S = 3;
/** Robô pequeno (o andróide, 1,6 m) aparece ampliado no pedestal, como num holograma de montagem: dá para ver as peças. */
const MIN_SHOWN_HEIGHT = 3.2;

const _arm = new THREE.Vector3();

/** Piso de placas de grade: bordas ciano e grade fina (canvas, feito uma vez). */
function floorTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(92,225,255,0.18)';
  g.lineWidth = 1;
  for (let i = 20; i < 240; i += 12) {
    g.beginPath();
    g.moveTo(i, 12);
    g.lineTo(i, 244);
    g.moveTo(12, i);
    g.lineTo(244, i);
    g.stroke();
  }
  g.strokeStyle = 'rgba(92,225,255,0.95)';
  g.lineWidth = 3;
  g.strokeRect(6, 6, 244, 244);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Linhas de varredura do holograma: forte embaixo, some em cima, com faixas mais claras (canvas). */
function holoTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 512; y += 4) {
    const fade = 1 - y / 512;
    const band = y % 64 < 6 ? 0.5 : 0;
    g.fillStyle = `rgba(160,240,255,${(0.1 + band) * fade})`;
    g.fillRect(0, 511 - y, 128, 2);
  }
  // Colunas de "dados" subindo: pontos em linhas verticais.
  for (let x = 4; x < 128; x += 16) {
    for (let y = 0; y < 512; y += 10) {
      if ((x * 7 + y * 13) % 29 > 11) continue;
      g.fillStyle = `rgba(200,250,255,${0.35 * (1 - y / 512)})`;
      g.fillRect(x, 511 - y, 2, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Disco do pedestal: anéis concêntricos e marcas de régua, como uma mira de montagem (canvas). */
function discTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.translate(256, 256);
  g.strokeStyle = 'rgba(120,235,255,0.9)';
  for (const [r, w] of [
    [250, 3],
    [214, 1.5],
    [150, 2],
    [96, 1],
  ] as const) {
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  }
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    g.lineWidth = long ? 3 : 1;
    g.beginPath();
    g.moveTo(Math.cos(a) * (long ? 190 : 202), Math.sin(a) * (long ? 190 : 202));
    g.lineTo(Math.cos(a) * 212, Math.sin(a) * 212);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Tela de holograma do fundo: a planta de um Mech em linhas (canvas). */
function blueprintTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(20,90,110,0.35)';
  g.fillRect(0, 0, 256, 320);
  g.strokeStyle = 'rgba(140,240,255,0.95)';
  g.lineWidth = 2;
  g.strokeRect(4, 4, 248, 312);
  const box = (x: number, y: number, w: number, h: number) => g.strokeRect(x, y, w, h);
  box(108, 40, 40, 34); // cabeça
  box(84, 80, 88, 80); // torso
  box(52, 86, 26, 70); // braço E
  box(178, 86, 26, 70); // braço D
  box(92, 166, 30, 90); // perna E
  box(134, 166, 30, 90); // perna D
  g.lineWidth = 1;
  g.globalAlpha = 0.6;
  for (let y = 270; y < 310; y += 8) {
    g.beginPath();
    g.moveTo(16, y);
    g.lineTo(16 + ((y * 37) % 200), y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * O galpão do Hangar (dono, 26/09: a imagem de referência em \`.tmp/arte/hangar-referencia.png\`): uma cena 3D só
 * dele, desenhada no lugar da arena enquanto o Hangar está aberto (o jogo fica pausado). Piso de placas com bordas
 * ciano, pedestal com anéis e uma coluna de holograma com linhas de varredura, anel de varredura subindo e descendo,
 * lâmpadas quentes penduradas, passarelas e Mechs escuros no fundo, telas de holograma e névoa. O Mech do jogador fica
 * no pedestal, girando devagar; arrastar gira.
 *
 * Tudo feito por código (texturas em canvas, geometria simples): nada para baixar. Custo só com o Hangar aberto.
 */
export class HangarScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);
  private readonly turntable = new THREE.Group();
  private readonly holo: THREE.Texture;
  private readonly holoInner: THREE.Texture;
  private readonly scanner: THREE.Mesh;
  private readonly lampLights: THREE.PointLight[] = [];
  private readonly displays = new Map<ChassisId, MechBase>();
  private shown: MechBase | null = null;
  private height = 5.3;
  private time = 0;
  private sinceDrag = IDLE_AFTER_DRAG_S;
  /** Fração da largura que o painel da direita cobre: o Mech fica no espaço que sobra (0 no celular). */
  private shift = 0;

  constructor() {
    const s = this.scene;
    s.background = new THREE.Color(0x05080b);
    s.fog = new THREE.Fog(0x05080b, 22, 75);
    s.add(new THREE.HemisphereLight(0x5f9fbf, 0x0a0c0e, 0.7));

    // Piso de placas de grade.
    const floorTex = floorTexture();
    floorTex.repeat.set(22, 22);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({ color: 0x0a1015, roughness: 0.75, metalness: 0.45, emissive: CYAN, emissiveMap: floorTex, emissiveIntensity: 0.5 }),
    );
    floor.rotation.x = -Math.PI / 2;
    s.add(floor);

    // Pedestal: base de aço, anel aceso na borda e o disco de montagem.
    const steel = new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.5, metalness: 0.8 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(PEDESTAL_R, PEDESTAL_R + 0.5, PEDESTAL_TOP, 64), steel);
    base.position.y = PEDESTAL_TOP / 2;
    s.add(base);
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(CYAN).multiplyScalar(1.6) });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(PEDESTAL_R - 0.15, 0.06, 8, 96), glow);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = PEDESTAL_TOP + 0.01;
    s.add(rim);
    const foot = new THREE.Mesh(new THREE.TorusGeometry(PEDESTAL_R + 0.55, 0.05, 8, 96), glow);
    foot.rotation.x = Math.PI / 2;
    foot.position.y = 0.05;
    s.add(foot);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(PEDESTAL_R - 0.3, 64),
      new THREE.MeshBasicMaterial({ map: discTexture(), color: CYAN, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = PEDESTAL_TOP + 0.02;
    s.add(disc);

    // Coluna de holograma: dois cilindros abertos com linhas de varredura correndo em sentidos opostos.
    this.holo = holoTexture();
    this.holo.repeat.set(6, 1);
    this.holoInner = this.holo.clone();
    this.holoInner.repeat.set(4, 1);
    const column = (r: number, map: THREE.Texture, opacity: number) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, COLUMN_H, 64, 1, true),
        new THREE.MeshBasicMaterial({ map, color: CYAN, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      m.position.y = PEDESTAL_TOP + COLUMN_H / 2;
      s.add(m);
    };
    column(PEDESTAL_R - 0.25, this.holo, 0.2);
    column(PEDESTAL_R - 0.9, this.holoInner, 0.1);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(PEDESTAL_R - 0.25, 0.04, 6, 96), glow);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = PEDESTAL_TOP + COLUMN_H;
    s.add(halo);
    // Anel de varredura: sobe e desce pelo Mech.
    this.scanner = new THREE.Mesh(
      new THREE.TorusGeometry(PEDESTAL_R - 0.6, 0.035, 6, 96),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbff6ff).multiplyScalar(2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.scanner.rotation.x = Math.PI / 2;
    s.add(this.scanner);
    const baseGlow = new THREE.PointLight(CYAN, 18, 14, 2);
    baseGlow.position.set(0, PEDESTAL_TOP + 2.2, 3);
    s.add(baseGlow);

    // Luz principal quente de cima (o Mech lido de longe) e um contraluz frio.
    const key = new THREE.SpotLight(WARM, 900, 60, Math.PI / 6, 0.5, 2);
    key.position.set(4, 24, 8);
    key.target.position.set(0, 3, 0);
    s.add(key, key.target);
    // Luz de frente, branca quente, do lado da câmera: o Mech do jogador é o que mais aparece no galpão.
    const front = new THREE.SpotLight(0xfff1dc, 700, 70, Math.PI / 7, 0.6, 2);
    front.position.set(7, 11, 20);
    front.target.position.set(0, 3, 0);
    s.add(front, front.target);
    const rimLight = new THREE.DirectionalLight(0x6fd8ff, 0.8);
    rimLight.position.set(-6, 8, -10);
    s.add(rimLight);

    this.buildHall();
    this.turntable.position.y = PEDESTAL_TOP;
    s.add(this.turntable);
  }

  /** Galpão: paredes com colunas, passarela com guarda-corpo, lâmpadas penduradas, Mechs e telas no fundo. */
  private buildHall(): void {
    const s = this.scene;
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c1116, roughness: 0.9, metalness: 0.3 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x1b242b, roughness: 0.6, metalness: 0.7 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 32), dark);
    back.position.set(0, 16, -26);
    s.add(back);
    for (const x of [-38, 38]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(60, 32), dark);
      side.position.set(x, 16, 4);
      side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      s.add(side);
    }
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = metal) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      s.add(b);
      return b;
    };
    // Colunas da parede do fundo e vigas do teto.
    for (let x = -36; x <= 36; x += 12) box(1.2, 32, 1.2, x, 16, -25.4);
    for (let z = -24; z <= 12; z += 12) box(78, 0.9, 0.9, 0, 26, z);
    // Passarela no fundo e nas laterais, com guarda-corpo aceso fraco.
    const rail = new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(0.22) });
    box(76, 0.4, 3, 0, 8, -23);
    box(76, 0.08, 0.08, 0, 9.1, -21.6, rail);
    for (const x of [-35, 35]) {
      box(3, 0.4, 36, x, 8, -5);
      box(0.08, 0.08, 36, x > 0 ? x - 1.4 : x + 1.4, 9.1, -5, rail);
    }
    // Lâmpadas penduradas: cúpula escura, bulbo quente (o brilho acende no bloom) e luz de verdade em algumas.
    const shade = new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide });
    const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(WARM).multiplyScalar(3) });
    const cone = new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.018, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    [
      [-12, -8],
      [12, -8],
      [-20, 6],
      [20, 6],
      [0, -16],
    ].forEach(([x, z], i) => {
      box(0.06, 6, 0.06, x!, 23, z!);
      const hood = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.9, 20, 1, true), shade);
      hood.position.set(x!, 19.6, z!);
      s.add(hood);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), bulb);
      b.position.set(x!, 19.2, z!);
      s.add(b);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(3.2, 17, 24, 1, true), cone);
      beam.position.set(x!, 10.7, z!);
      s.add(beam);
      if (i < 3) {
        const l = new THREE.PointLight(WARM, 120, 30, 2);
        l.position.set(x!, 18.8, z!);
        s.add(l);
        this.lampLights.push(l);
      }
    });
    // Mechs parados no fundo, escuros (o do jogador é o único aceso).
    const parked: [number, number, number, number][] = [
      [-16, 0, -17, 0.5],
      [16, 0, -17, -0.5],
      [-26, 0, -10, 0.9],
      [26, 8.2, -22, -0.3],
    ];
    for (const [x, y, z, yaw] of parked) {
      const m = new Vector09({ paint: 0x2b3238, visor: 0x1c3a44 });
      m.root.position.set(x, y, z);
      m.root.rotation.y = yaw;
      s.add(m.root);
    }
    for (const [x, z] of [
      [-8, -21],
      [9, -21.5],
    ] as const) {
      const a = new Android({ paint: 0x3a4248, visor: 0x1c3a44 });
      a.root.position.set(x, 8.2, z);
      s.add(a.root);
    }
    // Telas de holograma soltas no ar, com a planta de um Mech.
    const screen = new THREE.MeshBasicMaterial({ map: blueprintTexture(), color: CYAN, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const [x, y, z, yaw] of [
      [-11, 5.5, -3, 0.55],
      [-21, 12, -18, 0.2],
      [22, 12.5, -16, -0.3],
    ] as const) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), screen);
      p.position.set(x, y, z);
      p.rotation.y = yaw;
      s.add(p);
    }
  }

  /** O Mech do pedestal: o chassi e as armas da montagem (um modelo por chassi, feito na primeira vez). */
  show(chassis: ChassisId, loadout: Loadout): void {
    let m = this.displays.get(chassis);
    if (!m) {
      m =
        chassis === 'android'
          ? new Android({ stats: PILOT_ANDROID_STATS, paint: PALETTE.playerPaint, visor: PALETTE.green, tool: 'pilot', loadout })
          : new Vector09({ loadout });
      this.displays.set(chassis, m);
    }
    m.equip(loadout);
    if (m !== this.shown) {
      if (this.shown) this.turntable.remove(this.shown.root);
      this.turntable.add(m.root);
      this.shown = m;
      const scale = Math.max(1, MIN_SHOWN_HEIGHT / m.stats.height);
      this.turntable.scale.setScalar(scale);
      this.height = m.stats.height * scale;
      this.frame();
    }
  }

  /**
   * Onde um braço do Mech do pedestal está na tela (px), para os marcadores da interface. Falso se o braço não existe
   * ou está atrás da câmera. Nada alocado.
   */
  armScreen(part: 'rightArm' | 'leftArm', width: number, height: number, out: { x: number; y: number }): boolean {
    const m = this.shown;
    if (!m || m.modules[part] <= 0) return false;
    m.partWorldPosition(part, _arm).project(this.camera);
    if (_arm.z > 1) return false;
    out.x = (_arm.x * 0.5 + 0.5) * width;
    out.y = (-_arm.y * 0.5 + 0.5) * height;
    return true;
  }

  /** Gira a plataforma (arrastar o dedo ou o mouse); a volta sozinha espera um pouco. */
  rotate(dx: number): void {
    this.turntable.rotation.y += dx * 0.008;
    this.sinceDrag = 0;
  }

  /** Tamanho da tela e quanto dela o painel da direita cobre (o Mech fica centrado no que sobra). */
  resize(width: number, height: number, coveredRight: number): void {
    this.camera.aspect = width / height;
    this.shift = coveredRight;
    this.frame(width, height);
  }

  private frame(width = 0, height = 0): void {
    const h = this.height;
    // Mais perto do andróide (1,6 m) que do Mech (5,3 m), sempre um pouco de baixo: o robô parece grande.
    const dist = 4 + h * 3.2;
    this.camera.position.set(dist * 0.26, PEDESTAL_TOP + h * 0.5, dist);
    this.camera.lookAt(0, PEDESTAL_TOP + h * 0.48, 0);
    if (width > 0 && this.shift > 0) this.camera.setViewOffset(width, height, (width * this.shift) / 2, 0, width, height);
    else if (width > 0) this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  /** Por quadro, com o Hangar aberto. */
  update(dt: number): void {
    this.time += dt;
    this.sinceDrag += dt;
    if (this.sinceDrag > IDLE_AFTER_DRAG_S) this.turntable.rotation.y += (dt * Math.PI * 2) / TURN_S;
    this.holo.offset.y -= dt * 0.08;
    this.holoInner.offset.y += dt * 0.05;
    this.holoInner.offset.x += dt * 0.01;
    const h = this.height;
    this.scanner.position.y = PEDESTAL_TOP + 0.2 + (0.5 + 0.5 * Math.sin(this.time * 0.9)) * h * 1.05;
    // Lâmpadas de galpão: um tremor leve na intensidade.
    this.lampLights.forEach((l, i) => (l.intensity = 120 * (0.93 + 0.07 * Math.sin(this.time * (7 + i * 3.1)))));
    this.shown?.render(dt, 1);
  }
}
