import * as THREE from 'three';
import type { ChefePneu } from '../sim/ChefePneu';
import { hex, Montador } from './PraiaMontador';

/**
 * O DESENHO DO CHEFÃO PNEU (P248): um pneu gigante, sem pernas — gira em torno do próprio eixo conforme rola (ângulo = distância ÷ raio, sem derrapar). Um objeto só (não é a multidão:
 * não precisa de instância), então a posição é escrita direto no `Object3D` a cada quadro — barato o bastante para um único chefe (G4/G5: nada de `new` depois da construção).
 *
 * A barra de vida é um pedacinho de DOM próprio (como `CutsceneJaneiro.ts`), à parte do painel dos três prédios: aparece quando o chefe nasce, some quando ele morre.
 */

const RAIO_VISUAL = 4;

const CSS = `
#chefe-pneu-barra { position: absolute; top: 250px; left: 50%; transform: translateX(-50%); width: min(380px, 86vw); padding: 7px 14px; background: rgba(6, 8, 10, 0.8);
  border: 1px solid rgba(255, 138, 31, 0.55); font-size: 11px; letter-spacing: 1.6px; color: var(--ink, #eef2e8); text-align: center; text-shadow: 0 1px 2px #000; }
#chefe-pneu-barra[hidden] { display: none; }
#chefe-pneu-barra .cp-rotulo { margin-bottom: 5px; color: var(--warn, #ffe14d); }
#chefe-pneu-barra .cp-fundo { height: 8px; background: rgba(255, 255, 255, 0.14); }
#chefe-pneu-barra .cp-fundo i { display: block; height: 100%; width: 100%; background: var(--quente, #ff8a1f); transform-origin: left; }
`;

function geometriaDoPneuGigante(): THREE.BufferGeometry {
  const preto = hex(0.06, 0.06, 0.06);
  const cinza = hex(0.42, 0.42, 0.42);
  const cinzaClaro = hex(0.62, 0.62, 0.62);
  return new Montador()
    .cilindro(RAIO_VISUAL, RAIO_VISUAL, 2.6, 16, 0, 0, 0, preto, Math.PI / 2, 0, 0)
    .cilindro(RAIO_VISUAL * 0.55, RAIO_VISUAL * 0.55, 2.72, 12, 0, 0, 0, cinza, Math.PI / 2, 0, 0)
    .cilindro(RAIO_VISUAL * 0.16, RAIO_VISUAL * 0.16, 2.84, 8, 0, 0, 0, cinzaClaro, Math.PI / 2, 0, 0)
    .build();
}

export class ChefePneuDesenho {
  readonly grupo = new THREE.Group();
  private readonly malha: THREE.Mesh;
  private readonly root: HTMLDivElement;
  private readonly estilo: HTMLStyleElement;
  private readonly barraFundo: HTMLDivElement;
  private readonly barraEnchimento: HTMLElement;

  constructor(private readonly chefe: ChefePneu) {
    const geo = geometriaDoPneuGigante();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1 });
    this.malha = new THREE.Mesh(geo, mat);
    this.malha.castShadow = false;
    this.malha.receiveShadow = false;
    this.grupo.add(this.malha);

    this.estilo = document.createElement('style');
    this.estilo.textContent = CSS;
    document.head.appendChild(this.estilo);
    this.root = document.createElement('div');
    this.root.id = 'chefe-pneu-barra';
    const rotulo = document.createElement('div');
    rotulo.className = 'cp-rotulo';
    rotulo.textContent = 'PNEU GIGANTE';
    this.barraFundo = document.createElement('div');
    this.barraFundo.className = 'cp-fundo';
    this.barraEnchimento = document.createElement('i');
    this.barraFundo.appendChild(this.barraEnchimento);
    this.root.append(rotulo, this.barraFundo);
    document.body.appendChild(this.root);
  }

  /** Uma vez por quadro: a posição, o giro (sem derrapar) e a barra de vida. */
  atualizar(): void {
    this.malha.position.set(this.chefe.x, RAIO_VISUAL, this.chefe.z);
    this.malha.rotation.z = this.chefe.distanciaRolada / RAIO_VISUAL;
    this.grupo.visible = !this.chefe.morto;
    this.root.hidden = this.chefe.morto;
    const fracao = this.chefe.vidaMax > 0 ? this.chefe.vida / this.chefe.vidaMax : 0;
    this.barraEnchimento.style.transform = `scaleX(${fracao})`;
  }

  dispose(): void {
    this.malha.geometry.dispose();
    (this.malha.material as THREE.Material).dispose();
    this.root.remove();
    this.estilo.remove();
  }
}
