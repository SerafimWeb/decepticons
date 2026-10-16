import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PONTOS_DOS_CABOS } from '../sim/CabosDeDados';
import { Praia } from './Praia';
import { FRASE_DO_CORTADO, FRASE_DO_TOMADO, FRASES_DA_INJECAO, fraseDoCabo, opacidadeDoLetreiro, PraiaCabosFx } from './PraiaCabosFx';

/** Um canvas de mentira para o Node: o efeito só precisa desenhar sem quebrar (a textura nunca vai para uma GPU aqui). */
function canvasDeMentira(): unknown {
  const contexto = new Proxy({}, { get: () => () => ({ width: 100 }), set: () => true });
  return { width: 0, height: 0, getContext: () => contexto };
}

describe('o efeito de dados dos cabos (P162): letreiro sutil com caveira e o brilho vermelho do cabo', () => {
  it('a frase de cada estado: livre não tem letreiro; injetando gira por quatro frases; tomado e cortado têm a sua', () => {
    expect(fraseDoCabo(0, 5, 0)).toBeNull();
    expect(fraseDoCabo(2, 5, 0)).toBe(FRASE_DO_TOMADO);
    expect(fraseDoCabo(3, 5, 0)).toBe(FRASE_DO_CORTADO);
    const vistas = new Set<string>();
    for (let t = 0; t < 12; t += 0.5) vistas.add(fraseDoCabo(1, t, 0)!);
    expect(vistas.size).toBe(FRASES_DA_INJECAO.length);
    for (const f of vistas) expect(FRASES_DA_INJECAO).toContain(f);
    // cada cabo começa numa frase diferente (os três letreiros não dizem a mesma coisa juntos)
    expect(new Set([0, 1, 2].map((i) => fraseDoCabo(1, 0, i))).size).toBe(3);
  });

  it('as frases são curtas e legíveis: o jogador atento lê em um olhar', () => {
    for (const f of [...FRASES_DA_INJECAO, FRASE_DO_TOMADO, FRASE_DO_CORTADO]) {
      expect(f.length).toBeLessThanOrEqual(24);
      expect(f).toBe(f.toUpperCase());
    }
    expect(FRASES_DA_INJECAO).toContain('INJETANDO FAKE NEWS');
  });

  it('a opacidade: nada de letreiro com o cabo livre; a injeção faz o letreiro surgir aos poucos; sempre entre 0 e 1', () => {
    expect(opacidadeDoLetreiro(0, 0, 3, 0)).toBe(0);
    expect(opacidadeDoLetreiro(1, 0.01, 0, 0)).toBe(0); // injeção quase nula: ainda nada
    expect(opacidadeDoLetreiro(1, 0.05, 1, 0)).toBeLessThan(opacidadeDoLetreiro(1, 0.5, 1, 0)); // a barra sobe, o letreiro aparece
    expect(opacidadeDoLetreiro(2, 1, 0, 0)).toBeGreaterThan(0.4);
    const cortado = new Set([0, 0.1, 0.2, 0.3, 0.4, 0.5].map((t) => opacidadeDoLetreiro(3, 0, t, 0)));
    expect(cortado.size).toBeGreaterThan(1); // o cabo cortado pisca
    for (const e of [0, 1, 2, 3]) {
      for (let t = 0; t < 10; t += 0.37) {
        const o = opacidadeDoLetreiro(e, 0.6, t, 1);
        expect(o).toBeGreaterThanOrEqual(0);
        expect(o).toBeLessThanOrEqual(1);
      }
    }
  });

  it('sem DOM (o servidor, os testes em Node) o efeito não existe e nada quebra', () => {
    expect(PraiaCabosFx.criar(new THREE.Scene())).toBeNull();
  });

  describe('com DOM', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function montar() {
      vi.stubGlobal('document', { createElement: () => canvasDeMentira() });
      const scene = new THREE.Scene();
      const fx = PraiaCabosFx.criar(scene)!;
      const sprites = scene.children.filter((o) => (o as THREE.Sprite).isSprite) as THREE.Sprite[];
      return { scene, fx, sprites };
    }

    it('cria um letreiro por cabo, escondido, em cima do ponto de conexão', () => {
      const { sprites } = montar();
      expect(sprites).toHaveLength(3);
      sprites.forEach((s, i) => {
        expect(s.visible).toBe(false);
        expect(s.position.x).toBe(PONTOS_DOS_CABOS[i]!.x);
        expect(s.position.z).toBe(PONTOS_DOS_CABOS[i]!.z);
        expect(s.position.y).toBeGreaterThan(3);
        expect(s.scale.x).toBeGreaterThanOrEqual(10); // legível de longe
      });
    });

    it('os três letreiros ficam em alturas diferentes: os pontos ficam a 6 m um do outro e não podem se sobrepor', () => {
      const { sprites } = montar();
      expect(new Set(sprites.map((s) => s.position.y)).size).toBe(3);
      expect(sprites[1]!.position.y - sprites[0]!.position.y).toBeGreaterThan(sprites[0]!.scale.y); // o degrau é maior que a altura do letreiro
    });

    it('só aparece o letreiro do cabo que tem o que dizer, com a textura da frase; o livre fica escondido', () => {
      const { fx, sprites } = montar();
      fx.atualiza(10, [1, 0, 2], [0.5, 0, 1]);
      expect(sprites[0]!.visible).toBe(true);
      expect((sprites[0]!.material as THREE.SpriteMaterial).map).not.toBeNull();
      expect((sprites[0]!.material as THREE.SpriteMaterial).opacity).toBeGreaterThan(0);
      expect(sprites[1]!.visible).toBe(false);
      expect(sprites[2]!.visible).toBe(true);
      // o cabo é liberado: o letreiro some
      fx.atualiza(11, [0, 0, 0], [0, 0, 0]);
      for (const s of sprites) expect(s.visible).toBe(false);
    });

    it('o letreiro da injeção troca de frase com o tempo (a textura muda) e o tomado mostra "REDE COMPROMETIDA"', () => {
      const { fx, sprites } = montar();
      fx.atualiza(0.1, [1, 0, 0], [0.8, 0, 0]);
      const antes = (sprites[0]!.material as THREE.SpriteMaterial).map;
      fx.atualiza(2.5, [1, 0, 0], [0.8, 0, 0]);
      expect((sprites[0]!.material as THREE.SpriteMaterial).map).not.toBe(antes);
      fx.atualiza(3, [2, 0, 0], [1, 0, 0]);
      const tomado = (sprites[0]!.material as THREE.SpriteMaterial).map;
      fx.atualiza(3.2, [2, 0, 0], [1, 0, 0]);
      expect((sprites[0]!.material as THREE.SpriteMaterial).map).toBe(tomado); // a mesma frase, a mesma textura: nada é refeito
    });
  });
});

const abertas: PhysicsWorld[] = [];

describe('a praia leva os cabos ao shader: o brilho do cabo lê o MESMO uniforme que o setCabos escreve', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('setCabos muda a injeção e a vida que o material do cabo lê, e o shader pinta de vermelho com a injeção', async () => {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const scene = new THREE.Scene();
    const praia = new Praia(scene, physics);
    let material: THREE.MeshBasicMaterial | undefined;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && m.customProgramCacheKey().includes('cabo')) material = m as THREE.MeshBasicMaterial;
    });
    expect(material, 'o material do cabo').toBeDefined();
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
    material!.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, null as unknown as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain('uCaboInj');
    expect(shader.fragmentShader).toContain('infectado'); // o vermelho da injeção
    const inj = shader.uniforms.uCaboInj!.value as THREE.Vector3;
    const vida = shader.uniforms.uCaboVida!.value as THREE.Vector3;
    expect(inj.toArray()).toEqual([0, 0, 0]);
    expect(vida.toArray()).toEqual([1, 1, 1]);
    praia.setCabos([1, 2, 3], [0.9, 0.5, 0], [0.4, 1, 0]);
    expect(inj.toArray()).toEqual([0.4, 1, 0]);
    expect(vida.toArray()).toEqual([0.9, 0.5, 0]);
    praia.setCabos([], [], []); // entrada curta não quebra: vale o padrão (inteiro, sem injeção)
    expect(inj.toArray()).toEqual([0, 0, 0]);
    expect(vida.toArray()).toEqual([1, 1, 1]);
  });
});
