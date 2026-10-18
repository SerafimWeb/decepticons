import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ALCANCE_DA_CAMERA, Amazonia, RAIO_DO_CEU } from './Amazonia';
import { ALCANCE_DA_FLORESTA } from './AmazoniaFloresta';
import { aderecosDaAmazonia } from './AmazoniaAderecos';
import { AMAZONIA_DRAGA_INICIO_X, AMAZONIA_LIMITES } from './AmazoniaLayout';
import { PEDACOS_X, PEDACOS_Z } from './AmazoniaMalha';
import { GLSL_LIMPEZA } from './AmazoniaMateriais';
import { BANDA_DA_FRENTE, limpezaDoRio } from './AmazoniaRio';

const abertas: PhysicsWorld[] = [];
afterEach(() => {
  while (abertas.length) abertas.pop()!.world.free();
});

async function montar() {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const scene = new THREE.Scene();
  const t0 = performance.now();
  const mapa = new Amazonia(scene, physics);
  return { mapa, scene, physics, ms: performance.now() - t0 };
}

const malhas = (s: THREE.Scene): THREE.Mesh[] => {
  const l: THREE.Mesh[] = [];
  s.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) l.push(o as THREE.Mesh);
  });
  return l;
};
const triangulos = (m: THREE.Mesh): number => {
  const g = m.geometry;
  const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  return (m as THREE.InstancedMesh).isInstancedMesh ? n * (m as THREE.InstancedMesh).count : n;
};

describe('o mapa da Amazônia montado (P180, parte B): o orçamento de custo do AMAZONIA.md § 5', () => {
  it('o terreno são 24 pedaços de 300 m (8 × 3), cada um uma malha que a câmera descarta por inteiro', async () => {
    const { mapa } = await montar();
    expect(PEDACOS_X * PEDACOS_Z).toBe(24);
    expect(mapa.pedacos.length).toBe(24);
    for (const p of mapa.pedacos) {
      expect(p.mesh.frustumCulled).toBe(true);
      expect(p.mesh.geometry.boundingSphere).not.toBeNull();
      expect(triangulos(p.mesh)).toBe(50 * 50 * 2); // 300 m a 6 m a célula
    }
  });

  it('no pior caso (tudo visível, sem corte de câmera) o mapa fica em ≤ 70 desenhos: o céu, 24 de terreno, o rio, a lagoa, as estruturas e uma malha de árvores por pedaço', async () => {
    const { mapa, scene } = await montar();
    // a pior câmera: no meio do mapa, onde o maior número de pedaços usa o detalhe de perto; as duas malhas de árvore de um pedaço nunca estão acesas juntas
    let maior = 0;
    for (let x = -1100; x <= 1100; x += 200) for (let z = -400; z <= 400; z += 200) {
      mapa.observar(x, 20, z);
      maior = Math.max(maior, malhas(scene).filter((m) => m.visible).length);
    }
    expect(maior).toBeLessThanOrEqual(70);
    // sem a floresta são 28 (céu, 24 de terreno, rio, lagoa e estruturas): o resto é a floresta, que o observar acende
    expect(maior).toBeGreaterThan(38);
  });

  it('antes do primeiro observar a floresta está apagada (nada de árvore sem saber de onde a câmera olha), e o observar a acende por perto', async () => {
    const { mapa } = await montar();
    expect(mapa.floresta.pedacos.every((p) => !p.perto.visible && !p.longe.visible)).toBe(true);
    mapa.observar(0, 20, 0);
    expect(mapa.floresta.pedacos.some((p) => p.perto.visible)).toBe(true);
    expect(mapa.floresta.pedacos.some((p) => p.longe.visible)).toBe(true);
  });

  it('o terreno inteiro tem ≤ 125 mil triângulos, e o rio e as estruturas pesam pouco', async () => {
    const { mapa, scene } = await montar();
    let terreno = 0;
    for (const p of mapa.pedacos) terreno += triangulos(p.mesh);
    expect(terreno).toBeLessThanOrEqual(125_000);
    const rio = malhas(scene).find((m) => m.name === 'rio')!;
    expect(triangulos(rio)).toBeLessThan(10_000);
    expect(triangulos(mapa.cenario.mesh)).toBeLessThan(8_000);
  });

  it('os colisores estáticos ficam muito abaixo do teto de 400: o chão é UM colisor de altura, as paredes são quatro e as estruturas só as sólidas', async () => {
    const vazio = await PhysicsWorld.create();
    abertas.push(vazio);
    const antes = vazio.world.colliders.len();
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const mapa = new Amazonia(new THREE.Scene(), physics);
    const total = physics.world.colliders.len() - antes;
    expect(total).toBe(1 + 4 + mapa.cenario.colisores);
    // as peças sólidas do catálogo viram colisor, uma a uma (nenhuma estrutura é só de enfeite: a cabana, o silo e a torre se pisam e se batem)
    expect(mapa.cenario.colisores).toBe(aderecosDaAmazonia().filter((p) => p.solido).length);
    expect(mapa.cenario.colisores).toBeGreaterThan(30);
    expect(total).toBeLessThan(250);
  });

  it('a névoa é a do ar úmido do rio: exponencial, de modo que ao redor de 700 m o mapa some no ar (o horizonte barato)', async () => {
    const { scene } = await montar();
    expect(scene.fog).toBeInstanceOf(THREE.FogExp2);
    const densidade = (scene.fog as THREE.FogExp2).density;
    const visivelA700 = Math.exp(-((densidade * 700) ** 2));
    expect(visivelA700).toBeGreaterThan(0.2);
    expect(visivelA700).toBeLessThan(0.7);
    // no alcance da câmera a névoa já escondeu quase tudo (nenhum corte duro no fim do mapa)
    expect(Math.exp(-((densidade * ALCANCE_DA_CAMERA) ** 2))).toBeLessThan(0.05);
  });

  it('a câmera enxerga o domo do céu e a floresta inteira (o céu dentro do alcance: senão o fundo do mapa sai preto; o bug de 17/10, achado no jogo e não na bancada)', async () => {
    const { mapa, scene } = await montar();
    expect(mapa.alcanceDaCamera).toBe(ALCANCE_DA_CAMERA);
    expect(RAIO_DO_CEU).toBeLessThan(ALCANCE_DA_CAMERA);
    expect(ALCANCE_DA_FLORESTA).toBeLessThan(ALCANCE_DA_CAMERA);
    // o domo mede o raio do teste: se alguém aumentar a esfera sem mexer no alcance, isto acusa
    const ceu = malhas(scene).find((m) => m.name === 'ceu')!;
    ceu.geometry.computeBoundingSphere();
    expect(ceu.geometry.boundingSphere!.radius).toBeCloseTo(RAIO_DO_CEU, 3);
  });

  it('monta em tempo razoável (uma vez, no carregamento): menos de 4 s mesmo com a máquina cheia', async () => {
    const { ms } = await montar();
    expect(ms).toBeLessThan(4000);
  });
});

describe('o rio como termômetro (P180, parte B): a frente que os shaders leem', () => {
  it('a frente começa onde o Draga começa e se muda com setFrente; número torto é ignorado', async () => {
    const { mapa } = await montar();
    expect(mapa.frente).toBe(AMAZONIA_DRAGA_INICIO_X);
    mapa.setFrente(250);
    expect(mapa.frente).toBe(250);
    expect(mapa.u.frente.value).toBe(250);
    mapa.setFrente(NaN);
    expect(mapa.frente).toBe(250);
    mapa.setFrente(Infinity);
    expect(mapa.frente, 'infinito não é frente').toBe(250);
  });

  it('update escreve só o tempo, e o tempo é o que a água e a lagoa leem', async () => {
    const { mapa } = await montar();
    mapa.update(12.5);
    expect(mapa.u.tempo.value).toBe(12.5);
    const agua = malhas(mapa.cenaDoMapa).find((m) => m.name === 'rio')!.material as THREE.ShaderMaterial;
    expect(agua.uniforms.uTempo).toBe(mapa.u.tempo);
    expect(agua.uniforms.uFrente).toBe(mapa.u.frente);
    expect(agua.uniforms.uBanda).toBe(mapa.u.banda);
  });

  it('observar leva o céu junto (o domo acompanha a câmera) e o terreno e a floresta compartilham o MESMO uniforme da frente', async () => {
    const { mapa, scene } = await montar();
    mapa.observar(321, 55, -77);
    const ceu = malhas(scene).find((m) => m.name === 'ceu')!;
    expect(ceu.position.toArray()).toEqual([321, 55, -77]);
    // o chão e as árvores: o mesmo número, lido por shaders diferentes
    const terreno = mapa.pedacos[0]!.mesh.material as THREE.MeshStandardMaterial;
    const compila = (m: THREE.Material): { uniforms: Record<string, { value: number }>; vertexShader: string; fragmentShader: string } => {
      const sh = { uniforms: {} as Record<string, { value: number }>, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
      m.onBeforeCompile!(sh as never, null as never);
      return sh;
    };
    const t = compila(terreno);
    expect(t.uniforms.uFrente).toBe(mapa.u.frente);
    expect(t.fragmentShader).toContain('limpezaDoRio(vMundoX)');
    const arvore = mapa.floresta.pedacos[0]!.perto.material as THREE.MeshStandardMaterial;
    expect(compila(arvore).uniforms.uFrente).toBe(mapa.u.frente);
  });

  it('curar anda a frente rio abaixo (só avança, nunca recua) e para quando o rio inteiro está limpo, passando do fim do mapa com a banda', async () => {
    const { mapa } = await montar();
    mapa.setFrente(0);
    mapa.curar(100);
    expect(mapa.frente).toBe(100);
    mapa.curar(-50);
    mapa.curar(0);
    mapa.curar(NaN);
    expect(mapa.frente, 'cura negativa, zero e torta não mexem').toBe(100);
    mapa.curar(1e9);
    expect(mapa.frente).toBe(AMAZONIA_LIMITES.maxX + BANDA_DA_FRENTE);
    expect(limpezaDoRio(AMAZONIA_LIMITES.maxX, mapa.frente)).toBe(1); // o fim do rio está todo limpo
    expect(mapa.u.frente.value, 'o shader lê a frente nova').toBe(mapa.frente);
  });

  it('o GLSL tem a mesma curva da função de JS: a conta do shader é a do teste (se uma mudar, esta acusa)', () => {
    expect(GLSL_LIMPEZA).toContain('float t = clamp((x - (uFrente - uBanda)) / (2.0 * uBanda), 0.0, 1.0);');
    expect(GLSL_LIMPEZA).toContain('return 1.0 - t * t * (3.0 - 2.0 * t);');
    // e a função de JS dá o que a conta dá: 1 limpo, 0 morto, meio na frente
    expect(limpezaDoRio(0, 0)).toBeCloseTo(0.5, 9);
    expect(limpezaDoRio(-BANDA_DA_FRENTE, 0)).toBe(1);
    expect(limpezaDoRio(BANDA_DA_FRENTE, 0)).toBe(0);
  });

  it('a água é transparente e não escreve profundidade (o leito aparece por baixo), e a lagoa nunca lê a frente: é sempre morta', async () => {
    const { scene } = await montar();
    const rio = malhas(scene).find((m) => m.name === 'rio')!.material as THREE.ShaderMaterial;
    expect(rio.transparent).toBe(true);
    expect(rio.depthWrite).toBe(false);
    const lagoa = malhas(scene).find((m) => m.name === 'lagoa-de-rejeitos')!.material as THREE.ShaderMaterial;
    expect(lagoa.uniforms.uFrente).toBeUndefined();
    expect(lagoa.fragmentShader).not.toContain('limpezaDoRio');
  });
});
