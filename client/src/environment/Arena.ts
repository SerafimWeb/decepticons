import * as THREE from 'three';
import { ARENA_ZONES } from '../combat/Zone';
import { CITY_NEON, PALETTE } from '../core/palette';
import { mulberry32 } from '../core/rng';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { buildFloorTexture, buildSkyTexture, FLOOR_TILE_METERS } from './Atmosphere';
import { WINDOWS, windowedBuildingMaterial, type JanelasDoPredio } from './BuildingWindows';
import { ArenaQuadro } from './ArenaQuadro';
import { ArenaTelao } from './ArenaTelao';
import { buildingBands } from './BuildingBands';
import type { DestructibleDef, Destructibles } from './Destructibles';
import { SerafimTower } from './SerafimTower';
import { Bunker, type MapId } from './Bunker';
import { exigirMapa, exigirPraia, type InstanciaDaPraia, type InstanciaDoMapa } from './mapasSobDemanda';

export interface BlockDef {
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

/** Os obstáculos da Cidade Neon, só para ler (o layout e os testes conferem as folgas: o armário do transformador do banco não pode encostar em nenhum). */
export const BUILDINGS_DA_ARENA: readonly BlockDef[] = BUILDINGS;
export const BARRICADES_DA_ARENA: readonly DestructibleDef[] = BARRICADES;
export const PLATAFORMA_DA_ARENA = PLATFORM;

/** O mínimo de luz que a cidade mantém sem energia (o jogador ainda lê os prédios e as arestas; a ordem é "no escuro", não "cego"). */
export const PISO_DA_LUZ_DA_CIDADE = 0.12;

/** Uma cor neon da cidade e a cor de fábrica dela: a energia do transformador escala a primeira a partir da segunda. */
interface LuzDaCidade {
  cor: THREE.Color;
  base: THREE.Color;
}

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
  readonly serafim: SerafimTower | null;
  /** O mapa da praia (P126), quando é ele: quem anima o mar por quadro é o `update`. */
  readonly praia: InstanciaDaPraia | null = null;
  /** O mapa da Amazônia (P180), quando é ele: o rio e a floresta; o `update` anda o tempo e o `observar` segue a câmera. Vem do registro de mapas sob demanda (o código dele não mora no pacote de partida). */
  readonly amazonia: InstanciaDoMapa | null = null;
  /** A Praça dos Três Poderes (o 8 DE JANEIRO, P217), quando é ela: estática (nada anima), vem do registro de mapas sob demanda. */
  readonly praca: InstanciaDoMapa | null = null;
  /** Qual mapa este cenário é (o CFTV escolhe as câmeras por ele: `camera/camerasDoMapa.ts`). */
  readonly mapa: MapId;
  /** Tempo acumulado, só para as ondas do mar. */
  private tempo = 0;
  /** O transformador do Banco Vorcaris (P164, parte E): só na missão em ondas da Cidade Neon. */
  readonly transformador: ArenaQuadro | null = null;
  /** Os telões diegéticos (P246): só na Cidade Neon, em qualquer modo. */
  readonly telao: ArenaTelao | null = null;
  private relogioDoTransformador = 0;
  private estadoDoTransformador = 0;
  private vidaDoTransformador = 1;
  /** As luzes neon que a energia do transformador escurece: arestas, faixas e janelas dos prédios, a linha do horizonte. */
  private readonly luzesDaCidade: LuzDaCidade[] = [];
  /** O desenho das zonas de cura e de resfriamento: some quando o transformador está sem energia. */
  private readonly desenhoDasZonas: THREE.Object3D[] = [];
  private energiaDaCidade = 1;

  private readonly boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private readonly solidMat = new THREE.MeshStandardMaterial({ color: PALETTE.steel, metalness: 0.3, roughness: 0.8 });

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    destructibles: Destructibles,
    map: MapId = 'arena',
    opcoes: { transformador?: boolean } = {},
  ) {
    this.mapa = map;
    if (map === 'praia') {
      // A praia traz o céu do fim de tarde, a luz do sol poente e o cenário dela (`environment/Praia.ts`): nada daqui.
      this.serafim = null;
      this.praia = exigirPraia().construir(scene, physics, destructibles);
      return;
    }
    if (map === 'amazonia') {
      // A Amazônia traz o céu, a névoa, o rio e a floresta (`environment/Amazonia.ts`): nada daqui.
      this.serafim = null;
      this.amazonia = exigirMapa('amazonia').construir(scene, physics);
      return;
    }

    if (map === 'janeiro') {
      // A Praça traz o céu, a névoa, a luz e o chão (`environment/PracaMapa.ts`): nada daqui.
      this.serafim = null;
      this.praca = exigirMapa('janeiro').construir(scene, physics);
      return;
    }

    scene.background = buildSkyTexture();
    scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0095);

    scene.add(new THREE.HemisphereLight(PALETTE.skyLight, PALETTE.groundLight, 0.9));
    const key = new THREE.DirectionalLight(PALETTE.keyLight, 1.2);
    key.position.set(40, 80, 30);
    scene.add(key);
    const rim = new THREE.DirectionalLight(PALETTE.rimLight, 0.6);
    rim.position.set(-60, 40, -40);
    scene.add(rim);

    if (map === 'bunker') {
      this.serafim = null;
      new Bunker(scene, physics);
      return;
    }
    this.buildFloorAndBounds();
    for (const b of BUILDINGS) this.addBuilding(b);
    this.serafim = new SerafimTower(scene, physics);
    this.occluders.push({ box: this.serafim.bounds, material: this.serafim.material });
    for (const b of BARRICADES) destructibles.add(b);
    this.buildPlatform();
    this.buildSkyline();
    this.buildZones();
    // O transformador do banco (P164, parte E): só quem joga a missão em ondas o tem (no Deathmatch, na Bandeira e no Domínio a Arena é a de sempre).
    if (opcoes.transformador) this.transformador = new ArenaQuadro(scene, physics);
    // Os telões diegéticos (P246): este ramo já é exclusivo da Cidade Neon (os outros mapas retornam antes); sem checagem de mapa extra.
    this.telao = new ArenaTelao(scene);
  }

  /** O relógio visual do mapa (s, desde que foi montado): só a praia o conta. É o que o ciclo do dia usa quando a partida não traz outro (`CicloDoDia.progressoDaPartida`). */
  get relogioVisualS(): number {
    return this.tempo;
  }

  /** O ciclo do dia da praia (P161): 0 = o pôr do sol, 1 = a noite fechada. Nos outros mapas não faz nada. */
  setProgressoDoDia(progresso: number): void {
    this.praia?.setProgressoDoDia(progresso);
  }

  /** Onde a câmera está (a Amazônia, P180): o céu a acompanha e o detalhe da floresta segue a distância. Nos outros mapas não faz nada. */
  observar(x: number, y: number, z: number): void {
    this.amazonia?.observar(x, y, z);
  }

  /** O painel do quadro de luz (P164): o estado (0 ligado, 1 sabotado, 2 apagado) e a vida (0 a 1). Na praia é o armário do porto; na Cidade Neon, o transformador do banco. */
  setQuadro(estado: number, vida: number): void {
    if (this.praia) this.praia.setQuadro(estado, vida);
    this.estadoDoTransformador = estado;
    this.vidaDoTransformador = vida;
  }

  /**
   * A energia da cidade (0 a 1), a vida do quadro: na praia as luzes públicas viram o ciclo do dia vezes ela; **na Cidade Neon** as arestas, as faixas e as janelas dos prédios e a linha do
   * horizonte caem junto (até `PISO_DA_LUZ_DA_CIDADE`), e **o desenho das zonas some** com o transformador apagado. Só mexe nas cores quando a energia muda (a cada quadro é uma comparação).
   */
  setEnergia(energia: number): void {
    if (this.praia) {
      this.praia.setEnergia(energia);
      return;
    }
    if (!this.transformador || Math.abs(energia - this.energiaDaCidade) < 0.004) return;
    this.energiaDaCidade = energia;
    const f = PISO_DA_LUZ_DA_CIDADE + (1 - PISO_DA_LUZ_DA_CIDADE) * Math.min(1, Math.max(0, energia));
    for (const l of this.luzesDaCidade) l.cor.copy(l.base).multiplyScalar(f);
    for (const z of this.desenhoDasZonas) z.visible = energia > 0;
  }

  /** Registra uma cor neon da cidade para a energia do transformador escurecer (guarda a de fábrica). */
  private registraLuz(cor: THREE.Color): void {
    this.luzesDaCidade.push({ cor, base: cor.clone() });
  }

  /** Registra as cores de algo aceso fora da Arena (a placa do banco, que é de quem monta a cena) para a energia do transformador escurecer junto. Chamar antes da primeira `setEnergia`. */
  registraLuzes(cores: readonly THREE.Color[]): void {
    for (const c of cores) this.registraLuz(c);
  }

  /** Por quadro: só o mapa que anima faz algo (o mar da praia, o painel do transformador); os outros são estáticos e não custam nada. */
  update(dt: number): void {
    if (this.transformador) {
      this.relogioDoTransformador += dt;
      this.transformador.atualiza(this.relogioDoTransformador, this.estadoDoTransformador, this.vidaDoTransformador);
    }
    if (this.amazonia) {
      this.tempo += dt;
      this.amazonia.update(this.tempo);
      return;
    }
    if (!this.praia) return;
    this.tempo += dt;
    this.praia.update(this.tempo);
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
      this.desenhoDasZonas.push(disc);

      const ringPts: THREE.Vector3[] = [];
      const segs = 48;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(z.x + Math.cos(a) * z.radius, 0.05, z.z + Math.sin(a) * z.radius));
      }
      const anel = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: neon(accent, 3) }));
      this.scene.add(anel);
      this.desenhoDasZonas.push(anel);
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

  /** Prédio sólido com arestas neon, faixas emissivas a cada 5 m e janelas acesas entre elas (`BuildingWindows.ts`). */
  private addBuilding(b: BlockDef): void {
    const material = windowedBuildingMaterial(this.solidMat.clone(), b.accent);
    material.transparent = true;
    const janelas = material.userData.janelas as JanelasDoPredio;
    this.registraLuz(janelas.windowColor.value);
    this.registraLuz(janelas.windowSodium.value);
    const g = this.addSolid(new THREE.Vector3(b.x, b.h / 2, b.z), new THREE.Vector3(b.w, b.h, b.d), b.accent, material);

    const stripMat = new THREE.MeshBasicMaterial({ color: neon(b.accent, 2) });
    this.registraLuz(stripMat.color);
    // O andar das janelas é o intervalo entre duas faixas: a mesma medida, para as duas não saírem de compasso.
    const bands = buildingBands(b.w, b.h, b.d, WINDOWS.floor, this.boxGeo, stripMat);
    if (bands) g.add(bands);

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
    const bordas = new THREE.LineBasicMaterial({ color: neon(accent, 3) });
    this.registraLuz(bordas.color);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)), bordas));
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
    // A faixa e a luz do topo das torres do horizonte: o material é branco e a cor de cada torre vem da instância, então escalar o material escurece todas de uma vez.
    this.registraLuz((bands.material as THREE.MeshBasicMaterial).color);
    this.registraLuz((beacons.material as THREE.MeshBasicMaterial).color);
    this.scene.add(towers, bands, beacons, this.buildStars(rand));
  }
}
