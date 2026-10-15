import * as THREE from 'three';
import { DOMINIO_RAIO, type Dominio } from '../sim/Dominio';

const NEUTRO = new THREE.Color(0xcfd8dc);
const AZUL = new THREE.Color(0x00e5ff);
const VERMELHO = new THREE.Color(0xff2d3d);
const ALERTA = new THREE.Color(0xffb300);
/** Altura do feixe de luz (m): sobe acima dos prédios mais baixos para o ponto ser visto de longe. */
const FEIXE_ALTURA = 70;

/** Textura do chão do ponto: anel e preenchimento fraco, em branco (a cor vem do material). Uma só para todos os pontos. */
function texturaDoChao(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.beginPath();
  g.arc(128, 128, 120, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(128, 128, 118, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.arc(128, 128, 86, 0, Math.PI * 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A letra do ponto, em branco com contorno escuro (tingida pelo material). */
function texturaDaLetra(letra: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.font = '700 96px "Share Tech Mono", Consolas, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText(letra, 64, 70);
  g.fillStyle = '#fff';
  g.fillText(letra, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Marca {
  readonly feixe: THREE.MeshBasicMaterial;
  readonly chao: THREE.MeshBasicMaterial;
  readonly letra: THREE.SpriteMaterial;
}

/**
 * Os pontos de controle do Domínio no mundo: um disco com anel no chão (do tamanho do raio de captura), um **feixe de luz** que sobe e a
 * letra flutuando acima. A cor é a do dono (ciano é o seu lado, vermelho o dos rebeldes, branco neutro) e vai enchendo com a captura; o
 * ponto disputado pisca em âmbar. Sem colisor: a regra é por distância (`sim/Dominio.ts`).
 *
 * **Custo de GPU:** 3 objetos por ponto (chão, feixe, letra), 15 para os cinco; geometrias e texturas compartilhadas; só as cores mudam
 * por quadro (um `Color` reaproveitado, nada alocado). Não projeta sombra, não lê a cena.
 */
export class DominioPontos {
  private readonly marcas: Marca[] = [];
  private readonly cor = new THREE.Color();
  private t = 0;

  constructor(scene: THREE.Scene, private readonly regra: Dominio) {
    const chaoGeo = new THREE.PlaneGeometry(DOMINIO_RAIO * 2, DOMINIO_RAIO * 2);
    const feixeGeo = new THREE.CylinderGeometry(0.7, 0.7, FEIXE_ALTURA, 14, 1, true);
    const chaoTex = texturaDoChao();
    for (const p of regra.pontos) {
      const chao = new THREE.MeshBasicMaterial({ map: chaoTex, transparent: true, depthWrite: false, toneMapped: false });
      const disco = new THREE.Mesh(chaoGeo, chao);
      disco.rotation.x = -Math.PI / 2;
      disco.position.set(p.def.x, 0.08, p.def.z);
      scene.add(disco);

      const feixeMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const feixe = new THREE.Mesh(feixeGeo, feixeMat);
      feixe.position.set(p.def.x, FEIXE_ALTURA / 2, p.def.z);
      scene.add(feixe);

      const letraMat = new THREE.SpriteMaterial({ map: texturaDaLetra(p.def.letra), transparent: true, depthWrite: false, toneMapped: false });
      const letra = new THREE.Sprite(letraMat);
      letra.position.set(p.def.x, 16, p.def.z);
      letra.scale.set(7, 7, 1);
      scene.add(letra);
      this.marcas.push({ feixe: feixeMat, chao, letra: letraMat });
    }
  }

  /** Por quadro: pinta cada ponto pela captura. */
  update(dt: number): void {
    this.t += dt;
    for (let i = 0; i < this.marcas.length; i++) {
      const p = this.regra.pontos[i]!;
      const m = this.marcas[i]!;
      this.cor.copy(NEUTRO).lerp(p.control > 0 ? AZUL : VERMELHO, Math.abs(p.control));
      let pulso = 1;
      if (p.disputado) {
        this.cor.lerp(ALERTA, 0.55);
        pulso = 0.65 + 0.35 * Math.sin(this.t * 9);
      }
      m.chao.color.copy(this.cor);
      m.chao.opacity = 0.9 * pulso;
      m.feixe.color.copy(this.cor);
      m.feixe.opacity = (0.22 + 0.1 * Math.sin(this.t * 2 + i)) * pulso;
      m.letra.color.copy(this.cor);
    }
  }
}
