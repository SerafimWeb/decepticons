import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PORTAS_DA_ESTACAO } from '../sim/PortasDaEstacao';
import { avisoDasPortas } from '../ui/praiaHudData';
import { Praia } from './Praia';
import { aparenciaDaPorta, PraiaPortas } from './PraiaPortas';

describe('as duas portas do prédio desenhadas (P163): fechada, forçada e arrombada', () => {
  it('fechada: chapa de aço com a luz ciano da estação, sem abrir', () => {
    const a = aparenciaDaPorta(0, 1, 5, 0);
    expect(a.abertura).toBe(0);
    expect(a.emissiva).toBe(0x18d8ff);
    expect(a.intensidade).toBeLessThan(0.6);
  });

  it('forçada: vai para o laranja e a luz cresce conforme a vida cai; abre só uma fresta', () => {
    const quase = aparenciaDaPorta(1, 0.95, 2, 0);
    const ruim = aparenciaDaPorta(1, 0.1, 2, 0);
    expect(ruim.emissiva).toBe(0xff8a1a);
    expect(ruim.intensidade).toBeGreaterThan(quase.intensidade);
    expect(ruim.abertura).toBeGreaterThan(quase.abertura);
    expect(ruim.abertura).toBeLessThan(0.1);
  });

  it('arrombada: escura, aberta de lado e piscando em vermelho (a luz alterna forte e fraca)', () => {
    const luzes = new Set<number>();
    for (let t = 0; t < 2; t += 0.1) {
      const a = aparenciaDaPorta(2, 0, t, 1);
      expect(a.abertura).toBeGreaterThan(0.5);
      expect(a.emissiva).toBe(0xff2030);
      luzes.add(a.intensidade);
    }
    expect(luzes.size).toBe(2);
  });

  it('as duas portas são duas malhas: uma em cada fachada do prédio, encostadas nela e para fora', () => {
    const scene = new THREE.Scene();
    new PraiaPortas(scene);
    const malhas = scene.children.filter((o) => (o as THREE.Mesh).isMesh) as THREE.Mesh[];
    expect(malhas).toHaveLength(2);
    // a principal fica no lado sul do prédio (z < 50) e a dos fundos no norte (z > 78)
    expect(malhas[0]!.position.z).toBeLessThanOrEqual(50);
    expect(malhas[0]!.position.z).toBeGreaterThan(49);
    expect(malhas[1]!.position.z).toBeGreaterThanOrEqual(78);
    expect(malhas[1]!.position.z).toBeLessThan(79);
    malhas.forEach((m, i) => expect(m.position.x).toBe(PORTAS_DA_ESTACAO[i]!.x));
  });

  it('o estado muda a malha: arrombada encolhe e abre; fechada volta ao tamanho inteiro e à posição de antes', () => {
    const scene = new THREE.Scene();
    const portas = new PraiaPortas(scene);
    const [frente, fundos] = scene.children as THREE.Mesh[];
    portas.atualiza(1, [2, 0], [0, 1]);
    expect(frente!.scale.x).toBeLessThan(0.4);
    expect(frente!.position.x).toBeLessThan(PORTAS_DA_ESTACAO[0]!.x); // encolhe para a borda esquerda
    expect(fundos!.scale.x).toBe(1);
    expect((frente!.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0xff2030);
    portas.atualiza(2, [0, 0], [1, 1]);
    expect(frente!.scale.x).toBe(1);
    expect(frente!.position.x).toBe(PORTAS_DA_ESTACAO[0]!.x);
    expect((frente!.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x18d8ff);
  });
});

describe('os avisos das portas no topo da tela (P163)', () => {
  const nomes = PORTAS_DA_ESTACAO.map((p) => p.nome);

  it('nada mudou, nada de aviso; cada mudança tem a sua linha com o nome da porta', () => {
    expect(avisoDasPortas([0, 0], [0, 0], nomes)).toBeNull();
    expect(avisoDasPortas([1, 2], [1, 2], nomes)).toBeNull();
    expect(avisoDasPortas([0, 0], [1, 0], nomes)).toBe('ENTRADA PRINCIPAL SOB ATAQUE');
    expect(avisoDasPortas([1, 1], [1, 2], nomes)).toBe('ENTRADA DOS FUNDOS ARROMBADA · INVASORES DENTRO');
    expect(avisoDasPortas([2, 0], [1, 0], nomes)).toBe('ENTRADA PRINCIPAL RECUPERADA');
  });

  it('manda a mais grave: arrombada, depois recuperada, depois sob ataque; e a vida que só cai (forçada → forçada) não avisa de novo', () => {
    expect(avisoDasPortas([0, 2], [2, 1], nomes)).toBe('ENTRADA PRINCIPAL ARROMBADA · INVASORES DENTRO');
    expect(avisoDasPortas([0, 2], [1, 1], nomes)).toBe('ENTRADA DOS FUNDOS RECUPERADA');
    expect(avisoDasPortas([1, 1], [1, 1], nomes)).toBeNull();
  });
});

const abertas: PhysicsWorld[] = [];

describe('a praia pinta as portas pelo setPortas', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('setPortas + update mudam a malha da porta na cena da praia, e a cena segue dentro do teto de desenhos', async () => {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const scene = new THREE.Scene();
    const praia = new Praia(scene, physics);
    const portas: THREE.Mesh[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry instanceof THREE.BoxGeometry && m.geometry.parameters.width === 5 && m.geometry.parameters.height === 4) portas.push(m);
    });
    expect(portas).toHaveLength(2);
    praia.setPortas([2, 1], [0, 0.4]);
    praia.update(3);
    expect(portas[0]!.scale.x).toBeLessThan(0.5); // a principal arrombada
    expect(portas[1]!.scale.x).toBeGreaterThan(0.9); // a dos fundos só forçada
    let desenhos = 0;
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) desenhos++;
    });
    expect(desenhos).toBeLessThanOrEqual(67); // o teto da ficha (Praia.test.ts)
  });
});
