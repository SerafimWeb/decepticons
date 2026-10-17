import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { AMAZONIA_LIMITES } from './AmazoniaLayout';
import { criarLagoa, criarRio, criarTerreno, type PedacoDoTerreno } from './AmazoniaMalha';
import { criarCenario, type CenarioMontado } from './AmazoniaCenario';
import { Floresta } from './AmazoniaFloresta';
import { criarUniformes, materialDaAgua, materialDaFloresta, materialDoCenario, materialDoCeu, materialDosRejeitos, materialDoTerreno, type UniformesDaAmazonia } from './AmazoniaMateriais';
import { gradeDoMapa } from './AmazoniaTerreno';

/**
 * A **AMAZÔNIA** (ordem P180, `AMAZONIA.md` § 5; contrato da missão em `fichas/cenario-amazonas.md`): o construtor do cenário do rio. Lê o **layout em dado** (`AmazoniaLayout.ts`,
 * `AmazoniaTerreno.ts`) e monta a cena e os colisores estáticos: o terreno em pedaços, o rio, a lagoa de rejeitos, o céu e a névoa. **O rio é o termômetro da fase** (`setFrente`): um
 * número que o shader lê.
 *
 * **Custo** (o teto do `AMAZONIA.md` § 5: ≤ 70 desenhos, ≤ 250 mil triângulos, ≤ 400 colisores estáticos): o terreno são 24 pedaços de 300 m que a câmera descarta por inteiro; o rio é UMA
 * malha e UM shader; **por quadro** o `update` escreve **um número** (o tempo); nada mais se calcula além da posição do observador (o céu a acompanha).
 */

/** A névoa: o mapa tem 2.400 m, e o que passa de ~700 m some no ar úmido (o horizonte barato). */
const DENSIDADE_DA_NEVOA = 0.0013;
const COR_DA_NEVOA = 0xc4d4c2;
/** Até onde a câmera enxerga (m): a névoa já escondeu o mapa (menos de 5% visível). A câmera padrão do jogo vai a 800 m e cortaria o mapa de 2.400 m ainda visível. */
export const ALCANCE_DA_CAMERA = 1500;
/** O raio do domo do céu (m): tem de caber DENTRO do alcance da câmera (o domo acompanha a câmera; passando dele o céu some e fica o preto). */
export const RAIO_DO_CEU = 1200;

export class Amazonia {
  /** Os uniformes que o mapa inteiro divide: o tempo e a frente do rio. */
  readonly u: UniformesDaAmazonia = criarUniformes();
  readonly pedacos: PedacoDoTerreno[];
  /** As árvores: uma malha instanciada por pedaço e nível de detalhe (`AmazoniaFloresta.ts`). */
  readonly floresta: Floresta;
  /** As estruturas (a aldeia, a planta, as torres da margem, as máquinas da cava), fundidas numa malha só, e o que pesaram na física. */
  readonly cenario: CenarioMontado;
  readonly alcanceDaCamera = ALCANCE_DA_CAMERA;
  private readonly ceu: THREE.Mesh;
  private readonly cena: THREE.Scene;

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.cena = scene;
    scene.fog = new THREE.FogExp2(COR_DA_NEVOA, DENSIDADE_DA_NEVOA);
    scene.add(new THREE.HemisphereLight(0xdfeee0, 0x4a4030, 0.5));
    const sol = new THREE.DirectionalLight(0xfff0d0, 1.25);
    sol.position.set(260, 360, -380);
    scene.add(sol);
    this.ceu = new THREE.Mesh(new THREE.SphereGeometry(RAIO_DO_CEU, 24, 12), materialDoCeu());
    this.ceu.name = 'ceu';
    this.ceu.frustumCulled = false;
    this.ceu.renderOrder = -10;
    scene.add(this.ceu);
    this.pedacos = criarTerreno(scene, materialDoTerreno(this.u));
    this.floresta = new Floresta(scene, materialDaFloresta(this.u));
    criarRio(scene, materialDaAgua(this.u));
    criarLagoa(scene, materialDosRejeitos(this.u));
    this.fisica(physics);
    this.cenario = criarCenario(scene, physics, materialDoCenario(this.u));
  }

  /** A física: o chão (UM colisor de altura para o mapa todo) e as paredes do limite. */
  private fisica(physics: PhysicsWorld): void {
    const { minX, maxX, minZ, maxZ } = AMAZONIA_LIMITES;
    const g = gradeDoMapa();
    physics.addStaticHeightfield(g.celulasX, g.celulasZ, g.alturas, { x: maxX - minX, z: maxZ - minZ }, { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 });
    const t = 3;
    const h = 120;
    const comp = maxX - minX;
    const larg = maxZ - minZ;
    for (const [x, z, w, d] of [
      [0, minZ - t / 2, comp + t * 2, t],
      [0, maxZ + t / 2, comp + t * 2, t],
      [minX - t / 2, 0, t, larg],
      [maxX + t / 2, 0, t, larg],
    ] as const) physics.addStaticBox(new THREE.Vector3(x, h / 2, z), new THREE.Vector3(w, h, d));
  }

  /** Por quadro: só o tempo (um número). Chamado pelo `Arena.update`. */
  update(elapsed: number): void {
    this.u.tempo.value = elapsed;
  }

  /** A frente do rio (x): a montante é limpo, a jusante é morto. A água, o chão e a folhagem leem este número. */
  setFrente(x: number): void {
    this.u.frente.value = Number.isFinite(x) ? x : this.u.frente.value;
  }

  get frente(): number {
    return this.u.frente.value;
  }

  /** Onde a câmera está: o céu a acompanha (o domo não pode ficar para trás num mapa de 2.400 m). */
  observar(x: number, y: number, z: number): void {
    this.ceu.position.set(x, y, z);
    this.floresta.observar(x, z); // o detalhe das árvores segue a câmera
  }

  get cenaDoMapa(): THREE.Scene {
    return this.cena;
  }
}
