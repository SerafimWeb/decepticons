import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { DebrisSystem } from './DebrisSystem';
import { Destructibles } from './Destructibles';
import { Praia } from './Praia';
import { caixasDoAdereco, DESTRUTIVEIS, praiaAderecos } from './PraiaAderecos';
import { ehDestrutivel } from './PraiaDestrutiveis';
import { dadosDeSombra, restaurarSombras, sombrasOcultas } from './PraiaSombras';

/** O coqueiro de teste: no calçadão, perto do meio do mapa. */
const palma = praiaAderecos().find((a) => a.tipo === 'palmeira' && Math.abs(a.x) < 40 && a.z > 5 && a.z < 6)!;

async function monta(comDestrutiveis = true) {
  const physics = await PhysicsWorld.create();
  const scene = new THREE.Scene();
  const debris = { shatter: vi.fn() };
  const particles = { burst: vi.fn() };
  const destructibles = new Destructibles(scene, physics, debris as unknown as DebrisSystem, particles as unknown as ParticleSystem);
  const praia = new Praia(scene, physics, comDestrutiveis ? destructibles : undefined);
  physics.step();
  return { physics, scene, debris, particles, destructibles, praia };
}

/** A posição de todos os vértices de todas as malhas da cena (para ver o que mudou). */
function fotografia(scene: THREE.Scene): Float32Array[] {
  const out: Float32Array[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh)) out.push((o.geometry.attributes.position!.array as Float32Array).slice());
  });
  return out;
}

/** O primeiro tiro que acerta o tronco do coqueiro de teste (de 6 m, do lado do mar, na altura do meio do tronco). */
function atira(physics: PhysicsWorld, d: Destructibles, dano: number): boolean {
  const tronco = caixasDoAdereco(palma)[0]!;
  const hit = physics.raycast(new THREE.Vector3(tronco.x, tronco.y, tronco.z - 6), new THREE.Vector3(0, 0, 1), 20, undefined, true);
  return !!hit && d.damage(hit.collider, dano, new THREE.Vector3(0, 0, 1));
}

describe('os coqueiros e os adereços pequenos que se quebram a tiro (P138)', () => {
  it('há um coqueiro de teste e a lista do que se quebra tem o que o Comandante pediu (coqueiros e os elementos menores)', () => {
    expect(palma).toBeDefined();
    expect(Object.keys(DESTRUTIVEIS).sort()).toEqual(['banco', 'cadeira', 'guardasol', 'lixeira', 'palmeira']);
    // Nada com luz nem a cobertura do pátio da estação: a luz desenhada e a defesa dependem deles.
    for (const intocavel of ['poste', 'semaforo', 'refletor', 'hesco', 'barreira', 'saco', 'barraca', 'carro', 'torre', 'vigia']) {
      expect(DESTRUTIVEIS, intocavel).not.toHaveProperty(intocavel);
    }
  });

  it('cada adereço que se quebra vira um alvo, e todo alvo é um SENSOR: o tiro acerta, o Mech atravessa', async () => {
    const { physics, praia } = await monta();
    const aderecos = praiaAderecos().filter(ehDestrutivel);
    expect(praia.destrutiveis!.total).toBe(aderecos.length);
    expect(praia.destrutiveis!.porTipo.get('palmeira')!, 'os coqueiros da orla').toBeGreaterThan(100);
    const caixas = aderecos.reduce((n, a) => n + DESTRUTIVEIS[a.tipo]!.caixas.length, 0);
    let sensores = 0;
    physics.world.colliders.forEach((c) => {
      if (c.isSensor()) sensores++;
    });
    expect(sensores).toBe(caixas);
  });

  it('o mapa continua com os mesmos desenhos: nenhuma malha nova por causa dos alvos', async () => {
    const com = await monta(true);
    const sem = await monta(false);
    const malhas = (c: THREE.Scene) => {
      let n = 0;
      c.traverse((o) => {
        if (o instanceof THREE.Mesh) n++;
      });
      return n;
    };
    expect(malhas(com.scene)).toBe(malhas(sem.scene));
    expect(sem.praia.destrutiveis).toBeNull();
  });

  it('o tiro derruba o coqueiro (a vida é de 70): o desenho some da malha, a sombra some do chão, saem destroços e partículas', async () => {
    restaurarSombras();
    const { physics, scene, debris, particles, destructibles } = await monta();
    const inteiro = fotografia(scene);
    const sombraAntes = dadosDeSombra().dados.slice();

    expect(atira(physics, destructibles, 30), 'o tiro acerta o tronco').toBe(true);
    expect(debris.shatter).not.toHaveBeenCalled(); // 30 de 70: de pé
    expect(particles.burst, 'o acerto solta lascas').toHaveBeenCalled();
    expect(sombrasOcultas()).toBe(0);
    atira(physics, destructibles, 30);
    expect(debris.shatter).not.toHaveBeenCalled();
    atira(physics, destructibles, 30); // 90 ≥ 70
    expect(debris.shatter, 'o tronco e a copa viram destroços').toHaveBeenCalledTimes(2);
    expect(debris.shatter.mock.calls[0]![4], 'o tronco é de madeira').toBeDefined();
    expect(sombrasOcultas()).toBe(1);

    // O desenho: só os vértices do coqueiro desceram (todos os outros ficaram), e a sombra do chão mudou.
    const depois = fotografia(scene);
    let desceram = 0;
    let outros = 0;
    for (let m = 0; m < inteiro.length; m++) {
      for (let i = 0; i < inteiro[m]!.length; i += 3) {
        if (depois[m]![i + 1] !== inteiro[m]![i + 1]) {
          desceram++;
          expect(depois[m]![i + 1]! - inteiro[m]![i + 1]!, 'desce 3 km').toBeCloseTo(-3000, 0);
        }
        if (depois[m]![i] !== inteiro[m]![i] || depois[m]![i + 2] !== inteiro[m]![i + 2]) outros++;
      }
    }
    expect(desceram, 'as peças do coqueiro (tronco, cocos e folhas)').toBeGreaterThan(50);
    expect(outros, 'x e z não mudam').toBe(0);
    expect(Array.from(dadosDeSombra().dados)).not.toEqual(Array.from(sombraAntes));

    // O tiro agora passa onde ele estava.
    expect(atira(physics, destructibles, 30)).toBe(false);

    // Rodada nova: tudo volta como era (exatamente), inclusive a sombra.
    destructibles.restoreAll();
    physics.step();
    expect(sombrasOcultas()).toBe(0);
    const volta = fotografia(scene);
    for (let m = 0; m < inteiro.length; m++) expect(Array.from(volta[m]!), `malha ${m}`).toEqual(Array.from(inteiro[m]!));
    let maior = 0;
    const d = dadosDeSombra().dados;
    for (let k = 0; k < d.length; k++) maior = Math.max(maior, Math.abs(d[k]! - sombraAntes[k]!));
    expect(maior, 'a sombra voltou (±1 de arredondamento)').toBeLessThanOrEqual(1);
    expect(atira(physics, destructibles, 1), 'o coqueiro está de pé de novo').toBe(true);
  });

  it('um foguete (a explosão) derruba o que está no raio e poupa o que está longe', async () => {
    restaurarSombras();
    const { physics, scene, debris, destructibles } = await monta();
    const inteiro = fotografia(scene);
    const tronco = caixasDoAdereco(palma)[0]!;
    destructibles.damageInRadius(new THREE.Vector3(tronco.x, tronco.y, tronco.z - 40), 4.5, 90, new THREE.Vector3(0, 0, 1));
    expect(debris.shatter, 'longe, nada cai').not.toHaveBeenCalled();
    destructibles.damageInRadius(new THREE.Vector3(tronco.x, tronco.y, tronco.z - 1.2), 4.5, 90, new THREE.Vector3(0, 0, 1));
    expect(debris.shatter, 'perto, o coqueiro cai').toHaveBeenCalled();
    expect(sombrasOcultas()).toBeGreaterThanOrEqual(1);
    destructibles.restoreAll();
    physics.step();
    expect(sombrasOcultas()).toBe(0);
    const volta = fotografia(scene);
    for (let m = 0; m < inteiro.length; m++) expect(Array.from(volta[m]!)).toEqual(Array.from(inteiro[m]!));
  });

  it('o guarda-sol e o banco também caem, cada um com a vida e as cores dele', async () => {
    restaurarSombras();
    const { physics, debris, destructibles } = await monta();
    for (const tipo of ['guardasol', 'banco'] as const) {
      const a = praiaAderecos().find((x) => x.tipo === tipo)!;
      const caixa = caixasDoAdereco(a)[caixasDoAdereco(a).length - 1]!;
      const hit = physics.raycast(new THREE.Vector3(caixa.x, caixa.y, caixa.z - 5), new THREE.Vector3(0, 0, 1), 12, undefined, true);
      expect(hit, tipo).not.toBeNull();
      debris.shatter.mockClear();
      destructibles.damage(hit!.collider, DESTRUTIVEIS[tipo]!.vida, new THREE.Vector3(0, 0, 1));
      expect(debris.shatter, `${tipo} caiu`).toHaveBeenCalled();
    }
    destructibles.restoreAll();
    expect(sombrasOcultas()).toBe(0);
  });
});

describe('as caixas-alvo seguem o desenho (P138)', () => {
  it('o tronco-alvo do coqueiro vai do pé (0, 0) ao alto (1,7; 10,5), inclinado como o tubo da malha, e a copa fica no miolo das palmas', () => {
    const modelo = { tipo: 'palmeira' as const, x: 0, z: 0, giro: 0, escala: 1 };
    const [tronco, copa] = caixasDoAdereco(modelo);
    expect(tronco!.inclina).toBeCloseTo(Math.atan2(1.7, 10.5), 6);
    // As pontas do eixo da caixa: o centro ± metade do comprimento ao longo de (sen θ, cos θ).
    const meio = tronco!.h / 2;
    const topo = [tronco!.x + Math.sin(tronco!.inclina) * meio, tronco!.y + Math.cos(tronco!.inclina) * meio];
    const pe = [tronco!.x - Math.sin(tronco!.inclina) * meio, tronco!.y - Math.cos(tronco!.inclina) * meio];
    expect(topo[0]).toBeCloseTo(1.7, 2);
    expect(topo[1]).toBeCloseTo(10.5, 2);
    expect(pe[0]).toBeCloseTo(0, 2);
    expect(pe[1]).toBeCloseTo(0, 2);
    expect(tronco!.w, 'fina como o tronco (0,9 m), não uma parede').toBeLessThan(1.5);
    // A copa está no alto, sobre o topo do tronco, e cabe no círculo das palmas (raio de 4,6 m).
    expect(copa!.y).toBeGreaterThan(9);
    expect(copa!.x).toBeCloseTo(1.7, 2);
    expect(Math.hypot(copa!.w, copa!.d) / 2, 'a quina da caixa não passa do círculo das palmas').toBeLessThan(4.8);
  });

  it('o giro e a escala do coqueiro levam as caixas junto (o mesmo cálculo dos colisores sólidos)', () => {
    const girado = { tipo: 'palmeira' as const, x: 100, z: 20, giro: Math.PI / 2, escala: 1.2 };
    const [tronco] = caixasDoAdereco(girado);
    // O +x local, girado 90° em torno de Y, aponta para −z: o centro do tronco (0,85 m local) sai 1,02 m para −z.
    expect(tronco!.x).toBeCloseTo(100, 6);
    expect(tronco!.z).toBeCloseTo(20 - 0.85 * 1.2, 6);
    expect(tronco!.y).toBeCloseTo(5.25 * 1.2, 6);
    expect(tronco!.h).toBeCloseTo(Math.hypot(1.7, 10.5) * 1.2, 6);
  });
});
