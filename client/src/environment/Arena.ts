import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA_ZONES } from '../combat/Zone';
import { PALETTE } from '../core/palette';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { buildFloorTexture, buildSkyTexture, FLOOR_TILE_METERS } from './Atmosphere';
import { WINDOWS, windowedBuildingMaterial, type JanelasDoPredio } from './BuildingWindows';
import { ArenaQuadro } from './ArenaQuadro';
import { caixaDaRampa, MOBILIARIO_URBANO, PREDIOS_URBANOS, QUIOSQUES_URBANOS, RAMPAS_URBANAS, type BlocoUrbano, type RampaUrbana } from './ArenaUrbana';
import { ArenaTelao } from './ArenaTelao';
import { buildingBands } from './BuildingBands';
import type { DestructibleDef, Destructibles, EstiloDeBarricada } from './Destructibles';
import { SerafimTower } from './SerafimTower';
import { Bunker, type MapId } from './Bunker';
import { exigirMapa, exigirPraia, type ArenaDoCenario, type InstanciaDaPraia, type InstanciaDoMapa } from './mapasSobDemanda';

export interface BlockDef {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  accent: number;
}

/** Algo que pode tapar a visão da câmera tática (fica translúcido) e que o radar desenha na planta. */
export interface Occluder {
  box: THREE.Box3;
  /** O material que fica translúcido; `null` = só entra na planta do radar e não some (o mobiliário fixo da praça urbana: contêineres, degraus, jardineiras). */
  material: THREE.MeshStandardMaterial | null;
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

/**
 * Os obstáculos da Cidade Neon, só para ler (o layout e os testes conferem as folgas: o armário do transformador do banco não pode encostar em nenhum). **Incluem a praça urbana** (P268,
 * `ArenaUrbana.ts`): os prédios pequenos e médios depois dos três de sempre, os quiosques que quebram depois das seis barricadas (**os ids das barricadas antigas não mudam**: o id é a posição
 * na lista, e viaja pela rede) e o mobiliário fixo (contêineres, playground, jardineiras).
 */
export const BUILDINGS_DA_ARENA: readonly BlockDef[] = [...BUILDINGS, ...PREDIOS_URBANOS];
export const BARRICADES_DA_ARENA: readonly DestructibleDef[] = [...BARRICADES, ...QUIOSQUES_URBANOS];
export const MOBILIARIO_DA_ARENA: readonly BlocoUrbano[] = MOBILIARIO_URBANO;
export const PLATAFORMA_DA_ARENA = PLATFORM;

/** O mínimo de luz que a cidade mantém sem energia (o jogador ainda lê os prédios e as arestas; a ordem é "no escuro", não "cego"). */
export const PISO_DA_LUZ_DA_CIDADE = 0.12;
/** O mínimo de luz que a cidade mantém na **fase escura** no apagão total (P282: "todas as luzes da cidade se apagando, só as dos robôs e dos tiros"): quase nada (as torres e os letreiros são HDR: a 3% ainda apareciam). */
export const PISO_DA_LUZ_NO_ESCURO = 0.005;

/** Uma cor neon da cidade e a cor de fábrica dela: a energia do transformador escala a primeira a partir da segunda. */
interface LuzDaCidade {
  cor: THREE.Color;
  base: THREE.Color;
}

/** Cor HDR (>1) para as linhas neon passarem do limiar do bloom. */
const neon = (hex: number, intensity = 2.5) => new THREE.Color(hex).multiplyScalar(intensity);

/** O brilho (HDR) das arestas dos contêineres e do playground (P277): eram ×3, e uma linha de 1 px a ×3 forma um halo que lava o corpo e anda de pixel em pixel com a câmera (ver `BRILHO_DO_CONTORNO`). */
export const BRILHO_DAS_ARESTAS_DO_MOBILIARIO = 1.8;

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

export class Arena implements ArenaDoCenario {
  readonly halfSize = 100;
  /** O piso e a grade Tron da Cidade Neon (`null` nos outros mapas): o entorno da cidade (P264, `CidadeNeonCenario.ts`) troca o piso pela rua desenhada e esconde a grade. */
  readonly chao: THREE.Mesh | null = null;
  readonly grade: THREE.Object3D | null = null;
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
  /** A escuridão da fase escura (0 a 1, P282): derruba as luzes neon da cidade abaixo do piso do transformador, em qualquer modo. */
  private escuridaoDaFase = 0;
  /** As luzes neon que só a fase escura apaga (as zonas de cura e de resfriamento e a borda da plataforma): a energia do transformador não mexe nelas. */
  private readonly neonDaFase: LuzDaCidade[] = [];

  private readonly boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private readonly solidMat = new THREE.MeshStandardMaterial({ color: PALETTE.steel, metalness: 0.3, roughness: 0.8 });

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly destructibles: Destructibles,
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
    const piso = this.buildFloorAndBounds();
    this.chao = piso.chao;
    this.grade = piso.grade;
    for (const b of BUILDINGS) this.addBuilding(b);
    this.addPrediosUrbanos(PREDIOS_URBANOS);
    this.addMobiliario(MOBILIARIO_URBANO, RAMPAS_URBANAS);
    this.serafim = new SerafimTower(scene, physics);
    this.occluders.push({ box: this.serafim.bounds, material: this.serafim.material });
    for (const b of BARRICADES_DA_ARENA) destructibles.add(b);
    this.buildPlatform();
    this.buildZones();
    // O transformador do banco (P164, parte E): só quem joga a missão em ondas o tem (no Deathmatch, na Bandeira e no Domínio a Arena é a de sempre).
    if (opcoes.transformador) this.transformador = new ArenaQuadro(scene, physics);
    // Os telões diegéticos (P246): este ramo já é exclusivo da Cidade Neon (os outros mapas retornam antes); sem checagem de mapa extra.
    this.telao = new ArenaTelao(scene);
    // A cidade em volta (as torres, os telões de propaganda, a rua, os postes e o chão molhado, P264) é só desenho: o jogo a monta por cima,
    // num pedaço sob demanda (`CidadeNeonCenario.ts`). O servidor e os testes de regra ficam só com o que conta para a partida.
  }

  /** O cenário do navegador (a cidade em volta, P264) dá às barricadas que quebram o desenho de supercomputador (P272): só desenho, o colisor e a vida são os mesmos. */
  estilizarBarricadas(estilo: EstiloDeBarricada): void {
    this.destructibles.estilizar(estilo);
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
    this.aplicarLuzesDaCidade();
    for (const z of this.desenhoDasZonas) z.visible = energia > 0;
  }

  /**
   * A escuridão da fase escura (0 a 1, P282): as luzes neon da cidade (arestas, faixas, janelas, letreiros) caem até {@link PISO_DA_LUZ_NO_ESCURO}, **em qualquer modo** (o transformador só existe
   * na missão em ondas). Vale o menor entre a luz que a energia deixa e a que a escuridão deixa. A praia não usa (tem o ciclo do dia dela).
   */
  setEscuridao(escuridao: number): void {
    if (this.praia || this.amazonia || this.praca) return;
    const e = Math.min(1, Math.max(0, Number.isFinite(escuridao) ? escuridao : 0));
    const extremo = e === 0 || e === 1;
    if (extremo ? e === this.escuridaoDaFase : Math.abs(e - this.escuridaoDaFase) < 0.004) return;
    this.escuridaoDaFase = e;
    this.aplicarLuzesDaCidade();
  }

  /** Refaz as cores neon da cidade: o menor entre a luz da energia do transformador e a da escuridão da fase. */
  private aplicarLuzesDaCidade(): void {
    const daEnergia = PISO_DA_LUZ_DA_CIDADE + (1 - PISO_DA_LUZ_DA_CIDADE) * Math.min(1, Math.max(0, this.energiaDaCidade));
    const daFase = 1 - this.escuridaoDaFase * (1 - PISO_DA_LUZ_NO_ESCURO);
    const f = Math.min(daEnergia, daFase);
    for (const l of this.luzesDaCidade) l.cor.copy(l.base).multiplyScalar(f);
    for (const l of this.neonDaFase) l.cor.copy(l.base).multiplyScalar(daFase);
    // Os contornos das caixas e os telões seguem a luz da cidade (a fase escura os apaga; sem ela, o neon de fábrica).
    this.destructibles.setLuz(daFase);
    this.telao?.setLigado(this.escuridaoDaFase < 0.5);
  }

  /** Registra uma cor neon da cidade para a energia do transformador escurecer (guarda a de fábrica). */
  private registraLuz(cor: THREE.Color): void {
    this.luzesDaCidade.push({ cor, base: cor.clone() });
  }

  /** Registra as cores de algo aceso fora da Arena (a placa do banco, que é de quem monta a cena) para a energia do transformador escurecer junto. Chamar antes da primeira `setEnergia`. */
  registraLuzes(cores: readonly THREE.Color[]): void {
    for (const c of cores) this.registraLuz(c);
  }

  /** Por quadro: o mar da praia e o painel do transformador; os outros mapas são estáticos e não custam nada aqui (a cidade em volta da Cidade Neon anda sozinha, `CidadeNeonCenario.update`). */
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
      const discoMat = new THREE.MeshBasicMaterial({ color: neon(accent, 0.9), transparent: true, opacity: 0.18, depthWrite: false });
      this.neonDaFase.push({ cor: discoMat.color, base: discoMat.color.clone() });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(z.radius, 32), discoMat);
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
      const anelMat = new THREE.LineBasicMaterial({ color: neon(accent, 3) });
      this.neonDaFase.push({ cor: anelMat.color, base: anelMat.color.clone() });
      const anel = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), anelMat);
      this.scene.add(anel);
      this.desenhoDasZonas.push(anel);
    }
  }

  /** O piso, a grade, o contorno da praça e as paredes invisíveis. Devolve o piso e a grade (o entorno da cidade os troca, P264). */
  private buildFloorAndBounds(): { chao: THREE.Mesh; grade: THREE.Object3D } {
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
    this.neonDaFase.push({ cor: (grid.material as THREE.LineBasicMaterial).color, base: (grid.material as THREE.LineBasicMaterial).color.clone() });
    this.scene.add(grid);

    const bordaMat = new THREE.LineBasicMaterial({ color: neon(PALETTE.pink, 3) });
    this.neonDaFase.push({ cor: bordaMat.color, base: bordaMat.color.clone() });
    const border = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-h, 0.05, -h),
        new THREE.Vector3(h, 0.05, -h),
        new THREE.Vector3(h, 0.05, h),
        new THREE.Vector3(-h, 0.05, h),
      ]),
      bordaMat,
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
    return { chao: floor, grade: grid };
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

  /**
   * Os prédios pequenos e médios da praça urbana (P268). Cada um tem o corpo e o material **próprios** (a câmera tática o torna translúcido atrás do Mech, como os de sempre), mas as **arestas
   * neon e as faixas de todos vão numa malha só cada** (uma de linhas e uma instanciada): 9 prédios custam 11 chamadas de desenho, não 27.
   */
  private addPrediosUrbanos(defs: readonly BlocoUrbano[]): void {
    if (!defs.length) return;
    const arestas: THREE.BufferGeometry[] = [];
    const faixas: { x: number; y: number; z: number; w: number; d: number; accent: number }[] = [];
    for (const b of defs) {
      const material = windowedBuildingMaterial(this.solidMat.clone(), b.accent);
      material.transparent = true;
      const janelas = material.userData.janelas as JanelasDoPredio;
      this.registraLuz(janelas.windowColor.value);
      this.registraLuz(janelas.windowSodium.value);
      const corpo = new THREE.Mesh(this.boxGeo, material);
      corpo.scale.set(b.w, b.h, b.d);
      corpo.position.set(b.x, b.h / 2, b.z);
      corpo.name = `praca-predio-${b.nome}`;
      this.scene.add(corpo);
      this.physics.addStaticBox(new THREE.Vector3(b.x, b.h / 2, b.z), new THREE.Vector3(b.w, b.h, b.d));
      arestas.push(this.arestasColoridas(b));
      // O andar das janelas é o intervalo entre duas faixas: a mesma medida (`WINDOWS.floor`), para as duas não saírem de compasso.
      for (let y = WINDOWS.floor; y < b.h - 1; y += WINDOWS.floor) faixas.push({ x: b.x, y, z: b.z, w: b.w + 0.12, d: b.d + 0.12, accent: b.accent });
      this.occluders.push({ box: this.caixaDe(b), material });
    }
    this.scene.add(this.linhasNeon(arestas, 'praca-predios-arestas', 3));
    if (faixas.length) {
      const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2) });
      this.registraLuz(material.color);
      const malha = new THREE.InstancedMesh(this.boxGeo, material, faixas.length);
      const m = new THREE.Matrix4();
      const cor = new THREE.Color();
      faixas.forEach((f, i) => {
        malha.setMatrixAt(i, m.makeScale(f.w, 0.18, f.d).setPosition(f.x, f.y, f.z));
        malha.setColorAt(i, cor.setHex(f.accent));
      });
      malha.name = 'praca-predios-faixas';
      malha.computeBoundingBox();
      malha.computeBoundingSphere();
      this.scene.add(malha);
    }
  }

  /**
   * O mobiliário fixo da praça urbana (P268: contêineres, o playground, jardineiras): **uma malha de corpos e uma de arestas** para todos, um colisor por peça. Entram na planta do radar mas
   * não ficam translúcidos (`material: null`): são baixos demais para tapar a câmera.
   */
  private addMobiliario(defs: readonly BlocoUrbano[], rampas: readonly RampaUrbana[] = []): void {
    if (!defs.length && !rampas.length) return;
    const corpos: THREE.BufferGeometry[] = [];
    const arestas: THREE.BufferGeometry[] = [];
    for (const b of defs) {
      corpos.push(new THREE.BoxGeometry(b.w, b.h, b.d).translate(b.x, b.h / 2, b.z));
      arestas.push(this.arestasColoridas(b));
      this.physics.addStaticBox(new THREE.Vector3(b.x, b.h / 2, b.z), new THREE.Vector3(b.w, b.h, b.d));
      this.occluders.push({ box: this.caixaDe(b), material: null });
    }
    for (const r of rampas) {
      const c = caixaDaRampa(r);
      const giro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), c.angulo);
      const caixa = new THREE.BoxGeometry(c.tamanho.x, c.tamanho.y, c.tamanho.z).applyQuaternion(giro).translate(c.centro.x, c.centro.y, c.centro.z);
      corpos.push(caixa);
      // As arestas da rampa: o mesmo corpo inclinado, com a cor dela.
      arestas.push(this.colorirArestas(new THREE.EdgesGeometry(caixa), r.accent));
      this.physics.addStaticBox(new THREE.Vector3(c.centro.x, c.centro.y, c.centro.z), new THREE.Vector3(c.tamanho.x, c.tamanho.y, c.tamanho.z), giro);
      this.occluders.push({ box: new THREE.Box3(new THREE.Vector3(r.x, 0, r.z - r.largura / 2), new THREE.Vector3(r.x + r.run, r.h, r.z + r.largura / 2)), material: null });
    }
    const malha = new THREE.Mesh(mergeGeometries(corpos, false), this.solidMat);
    malha.name = 'praca-mobiliario';
    this.scene.add(malha, this.linhasNeon(arestas, 'praca-mobiliario-arestas', BRILHO_DAS_ARESTAS_DO_MOBILIARIO));
    for (const g of corpos) g.dispose();
  }

  /** A caixa de oclusão de um bloco (do chão ao topo). */
  private caixaDe(b: BlocoUrbano): THREE.Box3 {
    return new THREE.Box3(new THREE.Vector3(b.x - b.w / 2, 0, b.z - b.d / 2), new THREE.Vector3(b.x + b.w / 2, b.h, b.z + b.d / 2));
  }

  /** As arestas de um bloco, já no lugar dele, com a cor do neon dele em cada vértice (para juntar caixas de cores diferentes numa malha de linhas só). */
  private arestasColoridas(b: BlocoUrbano): THREE.BufferGeometry {
    return this.colorirArestas(new THREE.EdgesGeometry(new THREE.BoxGeometry(b.w, b.h, b.d)).translate(b.x, b.h / 2, b.z), b.accent);
  }

  /** Põe a cor do neon em cada vértice de uma geometria de arestas (já no lugar dela). */
  private colorirArestas(g: THREE.BufferGeometry, accent: number): THREE.BufferGeometry {
    const n = g.getAttribute('position').count;
    const cor = new THREE.Color(accent);
    const cores = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) cores.set([cor.r, cor.g, cor.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    return g;
  }

  /** Junta as arestas coloridas numa malha de linhas só; o material branco com a intensidade do neon (>1: passa do limiar do bloom) é o que a energia do transformador escurece. */
  private linhasNeon(partes: THREE.BufferGeometry[], nome: string, intensidade: number): THREE.LineSegments {
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color(intensidade, intensidade, intensidade), vertexColors: true });
    this.registraLuz(material.color);
    const linhas = new THREE.LineSegments(mergeGeometries(partes, false), material);
    linhas.name = nome;
    for (const g of partes) g.dispose();
    return linhas;
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
}
