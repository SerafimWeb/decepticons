import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ZoneDef } from '../combat/Zone';
import { PRAIA_ZONES } from './PraiaLayout';
import { alturaDoChao } from './PraiaTerreno';
import type { UniformesDaPraia } from './PraiaUniformes';

/**
 * AS ZONAS DE VANTAGEM da PRAIA DOS CABOS (P127, rodada de luz): a **cura** (verde) e o **resfriamento** (ciano) existem na simulação
 * (`combat/Zone.ts`, as mesmas da Arena), mas na praia ninguém as via: o jogador entrava numa e não sabia. Agora cada zona é **um
 * chão que diz o que faz**, com o raio exato da regra (12 m: quem está dentro recebe o efeito):
 *  - o **aro** no limite de 12 m e um segundo aro interno, para o jogador ler onde começa e onde acaba;
 *  - **ondas** que saem do centro (cura: a energia se espalha) ou que **entram** nele (resfriamento: o calor é sugado);
 *  - o **símbolo** no meio: uma cruz (cura) ou uma estrela de seis pontas (resfriamento, um floco);
 *  - uma **cortina** de luz baixa em volta, com faíscas que sobem, para a zona aparecer de longe (do calçadão se vê a próxima).
 *
 * **Custo:** dois desenhos para as quatro zonas (o chão num quadro instanciado, as cortinas num só cilindro mesclado), tudo calculado na
 * GPU pelo tempo compartilhado; CPU por quadro: zero. A qualidade baixa desliga as cortinas (o chão fica, é a informação).
 */

export const COR_DA_CURA: readonly [number, number, number] = [0.25, 1.7, 0.55];
export const COR_DO_RESFRIAMENTO: readonly [number, number, number] = [0.25, 1.25, 1.75];
/** A altura da cortina de luz (m). */
const ALTURA_DA_CORTINA = 6.5;

const VERTICE_DO_CHAO = /* glsl */ `
attribute vec3 iCentro;
attribute vec3 iInfo; // raio, tipo (0 cura, 1 resfriamento), fase
varying vec2 vP;
varying float vTipo;
varying float vFase;
void main() {
  // O quadro cobre o raio e uma folga de 8% (o aro fica inteiro); vP está em "raios" (1 = a borda da zona).
  vP = position.xy * 1.08;
  vTipo = iInfo.y;
  vFase = iInfo.z;
  vec3 mundo = iCentro + vec3(position.x * iInfo.x * 1.08, 0.0, position.y * iInfo.x * 1.08);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(mundo, 1.0);
}
`;

const FRAGMENTO_DO_CHAO = /* glsl */ `
uniform float uTempo;
uniform vec3 uCura;
uniform vec3 uFrio;
varying vec2 vP;
varying float vTipo;
varying float vFase;

float barra(float d, float meia) { return smoothstep(meia, meia * 0.6, d); }

void main() {
  float r = length(vP);
  if (r > 1.045) discard;
  float t = uTempo;
  vec3 cor = mix(uCura, uFrio, vTipo);

  // O aro de fora (o limite da regra), o aro de dentro e o disco leve.
  float aro = smoothstep(0.028, 0.0, abs(r - 0.985));
  float aroDentro = smoothstep(0.012, 0.0, abs(r - 0.9)) * 0.55;
  float disco = 0.13 + 0.05 * smoothstep(0.5, 1.0, r);

  // Ondas: cura sai do centro, resfriamento entra. Cada anel nasce forte e some no caminho.
  float sentido = mix(-1.0, 1.0, vTipo);
  float f = fract(r * 0.85 + sentido * t * 0.26 + vFase);
  float onda = smoothstep(0.12, 0.0, f) * smoothstep(1.0, 0.25, r) * smoothstep(0.16, 0.3, r);

  // O símbolo no meio: cruz (cura) ou floco de seis pontas (resfriamento).
  float cruz = max(barra(abs(vP.x), 0.075) * smoothstep(0.30, 0.26, abs(vP.y)), barra(abs(vP.y), 0.075) * smoothstep(0.30, 0.26, abs(vP.x)));
  float a = atan(vP.y, vP.x);
  float floco = smoothstep(0.075, 0.02, abs(sin(a * 3.0)) * r) * smoothstep(0.32, 0.27, r) + smoothstep(0.018, 0.0, abs(r - 0.34)) * 0.7;
  float simbolo = mix(cruz, floco, vTipo) * (0.8 + 0.2 * sin(t * 2.4 + vFase * 6.0));

  float forca = clamp(aro + aroDentro + onda * 0.55 + simbolo, 0.0, 1.0);
  float alfa = clamp(disco + forca * 0.85, 0.0, 0.95);
  // O disco é translúcido; o aro, a onda e o símbolo passam do limiar do realce (bloom).
  vec3 saida = cor * (0.5 + forca * 1.1);
  gl_FragColor = vec4(saida, alfa);
}
`;

const VERTICE_DA_CORTINA = /* glsl */ `
attribute float aTipo;
attribute float aFase;
attribute vec3 aLocal; // a posição no cilindro, antes de ir para o lugar da zona
varying float vAlt;
varying float vTipo;
varying float vAng;
varying float vFase;
varying float vDist;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  vAlt = aLocal.y / ${ALTURA_DA_CORTINA.toFixed(1)} + 0.5;
  vTipo = aTipo;
  vFase = aFase;
  vAng = atan(aLocal.z, aLocal.x);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENTO_DA_CORTINA = /* glsl */ `
uniform float uTempo;
uniform vec3 uCura;
uniform vec3 uFrio;
varying float vAlt;
varying float vTipo;
varying float vAng;
varying float vFase;
varying float vDist;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec3 cor = mix(uCura, uFrio, vTipo);
  float base = pow(1.0 - vAlt, 2.2) * 0.22;
  // Faíscas: 36 fios ao redor; cada um tem a sua fase e sobe (cura) ou desce (resfriamento) com o tempo.
  float fio = floor((vAng + 3.14159) / 6.28318 * 36.0);
  float sobe = mix(1.0, -1.0, vTipo);
  float faisca = smoothstep(0.86, 1.0, sin(vAlt * 7.0 * 6.28318 * 0.25 + hash(fio + vFase * 31.0) * 40.0 - sobe * uTempo * 1.7));
  float a = (base + faisca * (1.0 - vAlt) * 0.5) * smoothstep(3.0, 16.0, vDist); // de dentro da zona, a cortina não cobre a tela
  gl_FragColor = vec4(cor * a, 1.0);
}
`;

/** As zonas da praia com o y do chão (o mais alto entre o terreno e o piso do calçadão: o desenho fica sobre os dois). */
export interface ZonaDesenhada extends ZoneDef {
  y: number;
}

export function zonasDaPraia(zonas: readonly ZoneDef[] = PRAIA_ZONES): ZonaDesenhada[] {
  return zonas.map((z) => ({ ...z, y: Math.max(alturaDoChao(z.x, z.z), 0.1) + 0.05 }));
}

export class PraiaZonas {
  private readonly cortina: THREE.Mesh | null;

  constructor(scene: THREE.Scene, u: UniformesDaPraia, zonas: readonly ZoneDef[] = PRAIA_ZONES) {
    const lista = zonasDaPraia(zonas);
    const n = lista.length;
    const cores = { uTempo: u.tempo, uCura: { value: new THREE.Color(...COR_DA_CURA) }, uFrio: { value: new THREE.Color(...COR_DO_RESFRIAMENTO) } };

    // O chão: um quadro instanciado por zona, um desenho.
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const centro = new Float32Array(n * 3);
    const info = new Float32Array(n * 3);
    lista.forEach((z, i) => {
      centro.set([z.x, z.y, z.z], i * 3);
      info.set([z.radius, z.kind === 'heal' ? 0 : 1, (i * 0.37) % 1], i * 3);
    });
    g.setAttribute('iCentro', new THREE.InstancedBufferAttribute(centro, 3));
    g.setAttribute('iInfo', new THREE.InstancedBufferAttribute(info, 3));
    g.instanceCount = n;
    const chao = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({
        uniforms: cores,
        vertexShader: VERTICE_DO_CHAO,
        fragmentShader: FRAGMENTO_DO_CHAO,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide, // o quadro está no plano do chão: com a face de baixo para cima, a de frente seria cortada
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
    );
    chao.frustumCulled = false;
    chao.renderOrder = 2;
    scene.add(chao);

    // As cortinas: um cilindro aberto por zona, mesclado num desenho aditivo.
    const partes: THREE.BufferGeometry[] = [];
    lista.forEach((z, i) => {
      const c = new THREE.CylinderGeometry(z.radius, z.radius, ALTURA_DA_CORTINA, 40, 1, true);
      c.setAttribute('aLocal', c.attributes.position!.clone()); // o ângulo e a altura da faísca saem da posição no cilindro, não do mundo
      c.translate(z.x, z.y + ALTURA_DA_CORTINA / 2 - 0.05, z.z);
      const nv = c.attributes.position!.count;
      c.setAttribute('aTipo', new THREE.BufferAttribute(new Float32Array(nv).fill(z.kind === 'heal' ? 0 : 1), 1));
      c.setAttribute('aFase', new THREE.BufferAttribute(new Float32Array(nv).fill((i * 0.37) % 1), 1));
      partes.push(c);
    });
    const merged = mergeGeometries(partes, false);
    for (const p of partes) p.dispose();
    if (merged) {
      this.cortina = new THREE.Mesh(
        merged,
        new THREE.ShaderMaterial({
          uniforms: cores,
          vertexShader: VERTICE_DA_CORTINA,
          fragmentShader: FRAGMENTO_DA_CORTINA,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          fog: false,
        }),
      );
      this.cortina.frustumCulled = false;
      this.cortina.renderOrder = 3;
      scene.add(this.cortina);
    } else {
      this.cortina = null;
    }
  }

  /** A qualidade baixa desliga as cortinas (o chão fica: é a informação do jogo). */
  setDetalhe(alto: boolean): void {
    if (this.cortina) this.cortina.visible = alto;
  }
}
