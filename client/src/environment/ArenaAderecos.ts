import * as THREE from 'three';
import { CITY_NEON, PALETTE } from '../core/palette';
import { mulberry32 } from '../core/rng';
import { SHAPE, type BurstOptions, type ParticleSystem } from '../fx/ParticleSystem';

/**
 * A ATMOSFERA CYBERPUNK DA CIDADE NEON (P264): a Arena tinha ~12 objetos contra 150–300 da Praia/Praça (achado do
 * P255, "o mapa ta muito vazio") — o pedido do Comandante ("gases saindo do underground... poste piscando
 * falhando... neons... chinatown... getto... scifi") é a decisão de escopo que aquele achado esperava. Três peças,
 * cada uma **sem nenhum draw call por quadro de custo real** (G4/G5): letreiros e postes são `InstancedMesh`
 * estáticos (a cor do bulbo do poste é a única coisa escrita por quadro, numa instância só por poste); os bueiros
 * só chamam o `ParticleSystem` que já existe na cena (o mesmo pool de 3000 que todo tiro e explosão usa).
 *
 * **Decisão de propósito:** sem texto nem glifo de verdade nos letreiros (barras e blocos abstratos, só cor e
 * forma) — a referência do Comandante (Chinatown/gueto) é lida pela densidade e pela paleta neon já aprovada
 * (`palette.ts`), nunca copiando um idioma ou logotipo real. Sem luz dinâmica nova (nenhum `THREE.PointLight`): o
 * brilho do poste é emissivo com bloom, o mesmo jeito que toda aresta e janela neon deste jogo já ilumina "de
 * mentirinha" — um poste de verdade custaria uma luz por instância (G12 não paga isso por um detalhe de cenário).
 * Sem colisor: são enfeites finos (poste, placa, grelha), no espírito sem-greeble de `ESTILO_ROBOS.md`.
 */

/** Um círculo a evitar (prédio, barricada, plataforma, ponto de nascimento): o espalhamento rejeita qualquer ponto dentro do raio + a folga. */
export interface Obstaculo {
  readonly x: number;
  readonly z: number;
  readonly raio: number;
}

const neon = (hex: number, intensity = 2.5): THREE.Color => new THREE.Color(hex).multiplyScalar(intensity);

/**
 * Sorteia `quantidade` pontos dentro de `±half`, rejeitando os que caem perto demais de um obstáculo ou de um
 * ponto já sorteado (até 20 tentativas cada — um layout apertado aceita ficar com menos pontos em vez de travar).
 * Só roda na montagem da cena (uma vez por partida), nunca por quadro: alocar aqui não fere G4.
 */
function espalhar(
  rand: () => number,
  quantidade: number,
  half: number,
  obstaculos: readonly Obstaculo[],
  folga: number,
  minEntreSi: number,
): { x: number; z: number; giro: number }[] {
  const pontos: { x: number; z: number; giro: number }[] = [];
  for (let n = 0; n < quantidade; n++) {
    for (let tentativa = 0; tentativa < 20; tentativa++) {
      const x = (rand() * 2 - 1) * half;
      const z = (rand() * 2 - 1) * half;
      const livre =
        obstaculos.every((o) => (x - o.x) ** 2 + (z - o.z) ** 2 > (o.raio + folga) ** 2) &&
        pontos.every((p) => (x - p.x) ** 2 + (z - p.z) ** 2 > minEntreSi ** 2);
      if (livre) {
        pontos.push({ x, z, giro: rand() * Math.PI * 2 });
        break;
      }
    }
  }
  return pontos;
}

const QTD_LETREIROS = 26;
const PAINEIS_POR_LETREIRO = [1, 2, 2, 3] as const; // sorteado por índice: a maioria com 2, alguns com 1 ou 3
const QTD_POSTES = 13;
const QTD_BUEIROS = 6;

/** O vapor do bueiro (P264): mais lento e mais duradouro que a fumaça de combate (`fx/DamageVisuals.ts`), para ler como respiro do underground, não como dano. */
const VAPOR: BurstOptions = {
  count: 3,
  color: new THREE.Color(PALETTE.bone).multiplyScalar(0.22),
  speed: 1.3,
  life: 3.4,
  size: 2.8,
  expansion: 2.6,
  spread: 0.22,
  gravity: -0.55,
  shape: SHAPE.puff,
};
/** De quanto em quanto tempo cada bueiro solta uma baforada (s); um pouco variado por bueiro para não respirarem juntos. */
const PERIODO_DO_VAPOR_S = 1.8;

const UP = new THREE.Vector3(0, 1, 0);

/**
 * O brilho do bulbo de um poste no instante `t` (s desde que a cena nasceu): uma respiração suave (duas sinas
 * incomensuráveis — nunca repete de um jeito perceptível) e uma falha curta e rara ("mau contato"), defasada por
 * `fase` para os postes não piscarem em coro. Pura função de `(t, fase)`: sem estado, sem `Math.random` por
 * quadro, zero alocação — o `update()` só lê isto para escrever a cor de cada instância.
 */
function brilhoDoPoste(t: number, fase: number): number {
  const respira = 0.86 + 0.14 * Math.sin(t * 2.1 + fase);
  const batimento = Math.sin(t * 11.3 + fase * 3.1) * Math.sin(t * 3.7 + fase * 1.7);
  const falha = batimento > 0.9 ? 0.1 : batimento > 0.8 ? 0.55 : 1;
  return respira * falha;
}

export class ArenaAderecos {
  private readonly particles: ParticleSystem | null;
  private readonly bulbos: THREE.InstancedMesh | null = null;
  private readonly fasesDosPostes: Float32Array;
  private readonly coresBaseDosPostes: THREE.Color[];
  private readonly ventos: { pos: THREE.Vector3; relogio: number; periodo: number }[] = [];
  private tempo = 0;
  private readonly _cor = new THREE.Color();

  constructor(scene: THREE.Scene, obstaculos: readonly Obstaculo[], halfSize: number, particles: ParticleSystem | null) {
    this.particles = particles;
    // Semente fixa: a cidade não muda de layout entre partidas (o mesmo espírito do `buildSkyline` em `Arena.ts`) — só a paisagem, nunca a simulação (G1/G2 intocados, isto é puro desenho).
    const rand = mulberry32(0x4e656f6e); // "Neon" em hex, só para a semente ser legível no código
    this.buildLetreiros(scene, rand, obstaculos, halfSize);
    const postes = this.buildPostes(scene, rand, obstaculos, halfSize);
    this.bulbos = postes.bulbos;
    this.fasesDosPostes = postes.fases;
    this.coresBaseDosPostes = postes.cores;
    this.buildBueiros(scene, rand, obstaculos, halfSize);
  }

  /**
   * Letreiros verticais em blocos e barras (sem texto nem glifo real — ver o comentário do arquivo): um poste fino
   * e, subindo por ele, de 1 a 3 placas de cor e largura sorteadas da paleta neon da cidade.
   * **Limite de propósito:** ainda não escurecem com o transformador do banco (`Arena.setEnergia`) — isso exigiria
   * reescrever a cor instanciada de cada placa a cada mudança de energia, não só registrar um `THREE.Color` (o
   * jeito que funciona para material de malha comum); como a missão em ondas é só um dos modos da Arena, fica para
   * se o Comandante achar falta jogando aquele modo, em vez de resolver às cegas agora.
   */
  private buildLetreiros(scene: THREE.Scene, rand: () => number, obstaculos: readonly Obstaculo[], halfSize: number): void {
    const pontos = espalhar(rand, QTD_LETREIROS, halfSize * 0.92, obstaculos, 3, 6);
    let totalPaineis = 0;
    for (let i = 0; i < pontos.length; i++) totalPaineis += PAINEIS_POR_LETREIRO[i % PAINEIS_POR_LETREIRO.length]!;

    const postes = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.08, 0.1, 1, 6),
      new THREE.MeshStandardMaterial({ color: PALETTE.steelDark, metalness: 0.3, roughness: 0.85 }),
      pontos.length,
    );
    const paineis = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }), totalPaineis);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const tint = new THREE.Color();
    let painelIndex = 0;
    for (let i = 0; i < pontos.length; i++) {
      const { x, z, giro } = pontos[i]!;
      const altura = 3.2 + rand() * 2.4;
      // O poste é um cilindro liso: girar em torno do próprio eixo Y não muda nada dele, só das placas penduradas (abaixo).
      postes.setMatrixAt(i, m.compose(p.set(x, altura / 2, z), q.identity(), s.set(1, altura, 1)));

      const qtd = PAINEIS_POR_LETREIRO[i % PAINEIS_POR_LETREIRO.length]!;
      let y = altura * 0.42;
      for (let k = 0; k < qtd; k++) {
        const w = 0.7 + rand() * 1.5;
        const h = 0.35 + rand() * 0.55;
        // A placa sai um pouco do poste (como um letreiro pendurado), virada para fora em ±(giro, giro + π).
        const ladoGiro = giro + (rand() < 0.5 ? 0 : Math.PI);
        p.set(x + Math.sin(ladoGiro) * (w * 0.4 + 0.1), y, z + Math.cos(ladoGiro) * (w * 0.4 + 0.1));
        q.setFromAxisAngle(UP, ladoGiro);
        paineis.setMatrixAt(painelIndex, m.compose(p, q, s.set(w, h, 1)));
        const cor = CITY_NEON[Math.floor(rand() * CITY_NEON.length)]!;
        paineis.setColorAt(painelIndex, tint.copy(neon(cor, 2.4)));
        painelIndex++;
        y += h + 0.25 + rand() * 0.3;
      }
    }
    scene.add(postes, paineis);
  }

  /** Postes de luz (fino, mais baixo que os letreiros) com um bulbo emissivo instanciado — o único que muda de cor por quadro, para a falha/piscar (G4: uma instância, não uma luz nova). */
  private buildPostes(
    scene: THREE.Scene,
    rand: () => number,
    obstaculos: readonly Obstaculo[],
    halfSize: number,
  ): { bulbos: THREE.InstancedMesh; fases: Float32Array; cores: THREE.Color[] } {
    const pontos = espalhar(rand, QTD_POSTES, halfSize * 0.85, obstaculos, 2.5, 9);
    const postes = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.06, 0.09, 1, 6),
      new THREE.MeshStandardMaterial({ color: PALETTE.steel, metalness: 0.4, roughness: 0.7 }),
      pontos.length,
    );
    const bulbos = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), pontos.length);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    const fases = new Float32Array(pontos.length);
    const cores: THREE.Color[] = [];
    const paleta = [PALETTE.cyan, PALETTE.fluo, PALETTE.amber] as const; // postes de rua: luz "branca" de sódio/fluorescente, não as cores vivas dos letreiros
    for (let i = 0; i < pontos.length; i++) {
      const { x, z } = pontos[i]!;
      const altura = 4.4 + rand() * 0.6;
      postes.setMatrixAt(i, m.compose(p.set(x, altura / 2, z), q.identity(), s.set(1, altura, 1)));
      bulbos.setMatrixAt(i, m.compose(p.set(x, altura + 0.05, z), q.identity(), s.set(1, 1, 1)));
      const cor = neon(paleta[i % paleta.length]!, 3);
      bulbos.setColorAt(i, cor);
      cores.push(cor);
      fases[i] = rand() * Math.PI * 2;
    }
    bulbos.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    scene.add(postes, bulbos);
    return { bulbos, fases, cores };
  }

  /** Grelhas do underground: uma placa escura com aresta neon, quase no chão, que solta vapor de quando em quando. Poucas de propósito (P255: "poucos, pra nao poluir o cenario" valeu para o motoboy, e vale igual aqui). */
  private buildBueiros(scene: THREE.Scene, rand: () => number, obstaculos: readonly Obstaculo[], halfSize: number): void {
    const pontos = espalhar(rand, QTD_BUEIROS, halfSize * 0.6, obstaculos, 2, 14);
    const geo = new THREE.PlaneGeometry(1.6, 1.0);
    geo.rotateX(-Math.PI / 2);
    // EdgesGeometry é um feixe de segmentos soltos (um par de vértices por aresta), não um caminho fechado: LineSegments os desenha
    // cada um por si (o mesmo jeito de `Arena.ts:addSolid`); um LineLoop os leria como um caminho só e desenharia diagonais cruzando a grelha.
    const arestaGeo = new THREE.EdgesGeometry(geo);
    for (const { x, z, giro } of pontos) {
      const grelha = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x05060a, metalness: 0.5, roughness: 0.6 }));
      grelha.position.set(x, 0.015, z);
      grelha.rotation.y = giro;
      scene.add(grelha);
      const aresta = new THREE.LineSegments(arestaGeo, new THREE.LineBasicMaterial({ color: neon(PALETTE.sodium, 1.6) }));
      aresta.position.set(x, 0.02, z);
      aresta.rotation.y = giro;
      scene.add(aresta);
      this.ventos.push({ pos: new THREE.Vector3(x, 0.1, z), relogio: rand() * PERIODO_DO_VAPOR_S, periodo: PERIODO_DO_VAPOR_S * (0.8 + rand() * 0.4) });
    }
  }

  /** Por quadro: a cor dos bulbos dos postes (piscar/falhar) e o relógio de cada bueiro (solta vapor quando vence) — nada aqui aloca (G4). */
  update(dt: number): void {
    this.tempo += dt;
    if (this.bulbos) {
      for (let i = 0; i < this.fasesDosPostes.length; i++) {
        const brilho = brilhoDoPoste(this.tempo, this.fasesDosPostes[i]!);
        this.bulbos.setColorAt(i, this._cor.copy(this.coresBaseDosPostes[i]!).multiplyScalar(brilho));
      }
      this.bulbos.instanceColor!.needsUpdate = true;
    }
    if (this.particles) {
      for (const v of this.ventos) {
        v.relogio -= dt;
        if (v.relogio <= 0) {
          v.relogio += v.periodo;
          this.particles.burst(v.pos, UP, VAPOR);
        }
      }
    }
  }
}
