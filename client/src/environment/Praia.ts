import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { PRAIA_EXTENSAO, praiaBlocks, type BlocoDaPraia } from './PraiaLayout';

/**
 * A **PRAIA DOS CABOS** (ordem P126, Fortaleza · CE): o construtor do cenário. Lê o **layout em dado**
 * (`PraiaLayout.ts`) e monta a cena e os colisores estáticos — o mesmo caminho do `Bunker`. Sem luz nova além da
 * identidade do fim de tarde (uma direcional baixa fazendo o papel de sol) e **sem desenho por quadro**: o mar é o
 * único que anima, e anima **na GPU** (um uniforme de tempo), sem custo de CPU (G4/G12).
 *
 * **A identidade visual (o pedido do Comandante):** fim de tarde — céu do azul ao rosado, com o **sol no horizonte**
 * se pondo sobre o mar; **areia branquinha** contra o **mar azulzinho bem clarinho**; a **cidade costeira** de prédios
 * baixos e ruas; e as **dunas** na beira. As ondas são **pequenas e contínuas**.
 */

/** As cores do fim de tarde. A ordem do contraste é a do pedido: areia clara, mar claro, cidade quente. */
const CORES: Readonly<Record<BlocoDaPraia['kind'], number>> = {
  areia: 0xf6ecd6, // areia branquinha
  duna: 0xf1e4c8,
  mar: 0x77929c, // o fundo do mar (visto na beira e por baixo da água)
  rua: 0x49525a, // asfalto da orla
  predio: 0xefe3cd, // a cidade clara do litoral
  vidro: 0x33566b, // as janelas, onde o sol bate
  aco: 0x9aa4a9,
  concreto: 0xe0d9c9,
  luz: 0xffd9a0,
  escotilha: 0x3d4c57,
};
/** Onde o sol bate direto: as janelas e as luzes acendem. */
const ACESOS: ReadonlySet<BlocoDaPraia['kind']> = new Set(['vidro', 'luz'] as const);

/** Onde o sol está (o horizonte, sobre o mar): a direção e a altura da luz-chave. */
const SOL = new THREE.Vector3(-1, 0.28, -0.35).normalize();

/** Um céu de fim de tarde: do azul profundo no alto ao rosado no horizonte (uma textura esticada na tela). */
function ceuDoFimDeTarde(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1f4f8f'); // azul do alto
  grad.addColorStop(0.42, '#6f8fc0');
  grad.addColorStop(0.62, '#e6a07a'); // a virada para o rosado
  grad.addColorStop(0.78, '#f7c79a');
  grad.addColorStop(1, '#ffe6c0'); // o brilho do horizonte
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Praia {
  /** O uniforme de tempo das ondas (só ele muda por quadro). */
  private readonly ondas = { value: 0 };

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    scene.background = ceuDoFimDeTarde();
    scene.fog = new THREE.FogExp2(0xe9b489, 0.0026); // névoa quente: o sol poente come o fundo
    scene.add(new THREE.HemisphereLight(0xffd7ae, 0xb98f63, 1.05));
    const sol = new THREE.DirectionalLight(0xffb066, 1.5);
    sol.position.copy(SOL).multiplyScalar(180);
    scene.add(sol);
    const contra = new THREE.DirectionalLight(0x9fb8e0, 0.35); // a luz do céu, do lado oposto
    contra.position.set(60, 40, 40);
    scene.add(contra);

    this.buildBlocos(scene, physics);
    this.buildMar(scene);
    this.buildSolDesenhado(scene);
  }

  /** O bloco de cenário: malha instanciada + colisor estático (o mesmo desenho do `Bunker`). */
  private buildBlocos(scene: THREE.Scene, physics: PhysicsWorld): void {
    const blocos = praiaBlocks();
    const solidos = blocos.filter((b) => b.solid === true);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.02 });
    const malha = new THREE.InstancedMesh(geo, mat, blocos.length);
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const escala = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const rx = new THREE.Quaternion();
    const rz = new THREE.Quaternion();
    const eixoX = new THREE.Vector3(1, 0, 0);
    const eixoZ = new THREE.Vector3(0, 0, 1);

    blocos.forEach((b, i) => {
      pos.set(b.x, b.y, b.z);
      escala.set(b.w, b.h, b.d);
      rx.setFromAxisAngle(eixoX, b.rx ?? 0);
      rz.setFromAxisAngle(eixoZ, b.rz ?? 0);
      quat.copy(rz).multiply(rx);
      malha.setMatrixAt(i, matrix.compose(pos, quat, escala));
      const cor = new THREE.Color(CORES[b.kind]);
      if (ACESOS.has(b.kind)) cor.multiplyScalar(1.7);
      malha.setColorAt(i, cor);
    });
    malha.computeBoundingSphere();
    scene.add(malha);
    // Só o que é sólido ganha colisor (os detalhes — rua, janela, luz — são só desenho).
    for (const b of solidos) {
      if (!b.rx && !b.rz) physics.addStaticBox(new THREE.Vector3(b.x, b.y, b.z), new THREE.Vector3(b.w, b.h, b.d));
      else {
        rx.setFromAxisAngle(eixoX, b.rx ?? 0);
        rz.setFromAxisAngle(eixoZ, b.rz ?? 0);
        quat.copy(rz).multiply(rx);
        physics.addStaticBox(new THREE.Vector3(b.x, b.y, b.z), new THREE.Vector3(b.w, b.h, b.d), quat);
      }
    }
    // As paredes do mapa: o limite de 480 × 140 m (a praia é comprida, e o jogador não cai fora dela).
    const { comprimento, largura } = PRAIA_EXTENSAO;
    const t = 3;
    const h = 70;
    for (const [x, z, w, d] of [
      [0, -largura / 2 - t / 2, comprimento + t * 2, t],
      [0, largura / 2 + t / 2, comprimento + t * 2, t],
      [-comprimento / 2 - t / 2, 0, t, largura],
      [comprimento / 2 + t / 2, 0, t, largura],
    ]) physics.addStaticBox(new THREE.Vector3(x, h / 2, z), new THREE.Vector3(w, h, d));
  }

  /** O mar: um plano claro com **ondas pequenas**, deslocadas na GPU (o custo de CPU é zero; só o tempo muda). */
  private buildMar(scene: THREE.Scene): void {
    const { comprimento, largura } = PRAIA_EXTENSAO;
    const mat = new THREE.MeshStandardMaterial({ color: 0x8fdcef, roughness: 0.18, metalness: 0.06 });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uOnda = this.ondas;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uOnda;\nfloat ondaAltura(vec2 p, float t){ return sin(p.x * 0.2 + t * 1.25) * 0.13 + sin(p.y * 0.29 - t * 0.95) * 0.09; }')
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          { const float e = 0.7; float h0 = ondaAltura(position.xy, uOnda);
            float hx = ondaAltura(position.xy + vec2(e, 0.0), uOnda); float hy = ondaAltura(position.xy + vec2(0.0, e), uOnda);
            objectNormal = normalize(vec3(-(hx - h0) / e, -(hy - h0) / e, 1.0)); }`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed.z += ondaAltura(position.xy, uOnda);');
    };
    const mar = new THREE.Mesh(new THREE.PlaneGeometry(comprimento / 2, largura, 60, 40), mat);
    mar.rotation.x = -Math.PI / 2;
    mar.position.set(-comprimento / 4, 0, 0); // cobre a metade do mar (o retângulo da água)
    scene.add(mar);
  }

  /** O sol desenhado: um disco quente no horizonte, sobre o mar (some no fundo rosado do céu). */
  private buildSolDesenhado(scene: THREE.Scene): void {
    const sol = new THREE.Mesh(
      new THREE.CircleGeometry(26, 40),
      new THREE.MeshBasicMaterial({ color: 0xffdca0, transparent: true, opacity: 0.85, depthWrite: false, fog: false }),
    );
    sol.position.copy(SOL).multiplyScalar(430);
    sol.lookAt(0, 8, 0);
    scene.add(sol);
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(70, 40),
      new THREE.MeshBasicMaterial({ color: 0xffb877, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    halo.position.copy(SOL).multiplyScalar(450);
    halo.lookAt(0, 8, 0);
    scene.add(halo);
  }

  /** Por quadro: só o tempo das ondas (um número). Chamado pelo `Arena.update`. */
  update(elapsed: number): void {
    this.ondas.value = elapsed;
  }
}
