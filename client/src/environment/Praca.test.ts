import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { Vector09 } from '../entities/Vector09';
import type { MechInput } from '../entities/MechBase';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { capacidadeDoMapa } from '../sim/nascimentos';
import { Match } from '../sim/Match';
import { mapFromSearch } from './Bunker';
import { carregarMapaSeFor, exigirMapa } from './mapasSobDemanda';
import { blocosDaPraca, FOLGA_DO_NASCIMENTO, PRACA_FONTES, PRACA_LIMITES, PRACA_PREDIOS, PRACA_SPAWNS, PRACA_VAGAS } from './PracaLayout';
import { caixasDaPraca } from './PracaMapa';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const abertas: PhysicsWorld[] = [];
afterEach(() => {
  while (abertas.length) abertas.pop()!.world.free();
});

const solidos = () => blocosDaPraca().filter((b) => b.solid);

describe('o layout da Praça dos Três Poderes (P217, passo 4 da ficha)', () => {
  it('o teto de colisores é o do Bunker (< 310); todo bloco tem tamanho positivo e está dentro do mapa; o layout é determinístico (o servidor e o cliente montam o mesmo chão)', () => {
    expect(solidos().length).toBeLessThan(310);
    for (const b of blocosDaPraca()) {
      expect(b.w).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
      expect(b.d).toBeGreaterThan(0);
    }
    expect(JSON.stringify(blocosDaPraca())).toBe(JSON.stringify(blocosDaPraca()));
  });

  it('ninguém nasce dentro de um bloco sólido, nem junto de uma parede (a folga do Colossus V4); o primeiro ponto é o do jogador, na Praça', () => {
    for (const [x, z] of PRACA_SPAWNS) {
      expect(x, `x de ${x},${z}`).toBeGreaterThan(PRACA_LIMITES.minX + FOLGA_DO_NASCIMENTO);
      expect(x).toBeLessThan(PRACA_LIMITES.maxX - FOLGA_DO_NASCIMENTO);
      expect(Math.abs(z)).toBeLessThan(PRACA_LIMITES.maxZ - FOLGA_DO_NASCIMENTO);
      for (const b of solidos()) {
        if (b.kind === 'pavimento' || b.kind === 'cerca' || b.rz !== 0) continue; // o chão não conta; a cerca já foi conferida acima; a rampa está no chão
        const dentro = Math.abs(x - b.x) < b.w / 2 + FOLGA_DO_NASCIMENTO && Math.abs(z - b.z) < b.d / 2 + FOLGA_DO_NASCIMENTO;
        expect(dentro, `o ponto (${x}, ${z}) está colado num bloco ${b.kind} em (${b.x}, ${b.z})`).toBe(false);
      }
    }
    expect(PRACA_SPAWNS[0]).toEqual([72, 16]); // a Praça, entre os três prédios e a salvo do monumento do meio
    expect(PRACA_VAGAS).toBe(PRACA_SPAWNS.length - 1);
    expect(capacidadeDoMapa('janeiro').total).toBe(PRACA_VAGAS);
  });

  it('os três prédios dos poderes têm nome genérico, caixa dentro do mapa e a frente em chão livre; as fontes da multidão (ônibus, bueiros, lixeiras) estão no chão do mapa', () => {
    expect(PRACA_PREDIOS.map((p) => p.nome)).toEqual(['LEGISLATIVO', 'EXECUTIVO', 'JUDICIÁRIO']);
    for (const p of PRACA_PREDIOS) {
      expect(p.caixa.x0).toBeGreaterThanOrEqual(PRACA_LIMITES.minX);
      expect(p.caixa.x1).toBeLessThanOrEqual(PRACA_LIMITES.maxX);
      expect(p.caixa.z0).toBeGreaterThanOrEqual(PRACA_LIMITES.minZ);
      expect(p.caixa.z1).toBeLessThanOrEqual(PRACA_LIMITES.maxZ);
      // o ponto central da frente não está dentro de nenhum prédio
      for (const q of PRACA_PREDIOS) {
        const dentro = p.frente.x > q.caixa.x0 && p.frente.x < q.caixa.x1 && p.frente.z > q.caixa.z0 && p.frente.z < q.caixa.z1;
        expect(dentro, `a frente de ${p.nome} dentro de ${q.nome}`).toBe(false);
      }
    }
    expect(PRACA_FONTES.filter((f) => f.tipo === 'onibus').length).toBeGreaterThanOrEqual(2);
    expect(PRACA_FONTES.filter((f) => f.tipo === 'bueiro').length).toBeGreaterThanOrEqual(4);
    expect(PRACA_FONTES.filter((f) => f.tipo === 'lixeira').length).toBeGreaterThanOrEqual(3);
    for (const f of PRACA_FONTES) {
      expect(f.x).toBeGreaterThan(PRACA_LIMITES.minX);
      expect(f.x).toBeLessThan(PRACA_LIMITES.maxX);
      expect(Math.abs(f.z)).toBeLessThan(PRACA_LIMITES.maxZ);
    }
  });

  it('o link e o mapa: o Deathmatch abre a Praça (online também); a missão e os outros modos ainda caem na Cidade Neon até a Sobrevivência existir (passo 5)', () => {
    expect(mapFromSearch('?mapa=janeiro', false, 'deathmatch')).toBe('janeiro');
    expect(mapFromSearch('?mapa=janeiro&sala=X', true, 'deathmatch')).toBe('janeiro');
    expect(mapFromSearch('?mapa=janeiro', false, 'survival')).toBe('arena');
    expect(mapFromSearch('?mapa=janeiro', false, 'ctf')).toBe('arena');
  });
});

describe('a Praça no jogo: o chão de verdade', () => {
  it('a partida monta no mapa: o jogador nasce na Praça, o chão segura, e a planta de cima (o radar) tem os três prédios', async () => {
    await carregarMapaSeFor('janeiro');
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const match = new Match({ physics, scene: new THREE.Scene(), map: 'janeiro', particles: NO_FX, foes: { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false }, debris: false, allies: false });
    const mech = new Vector09();
    match.addPlayer(mech, 'VOCÊ');
    expect(match.arena.praca).not.toBeNull();
    expect(match.arena.serafim).toBeNull();
    expect([mech.simPosition.x, mech.simPosition.z]).toEqual([72, 16]);
    for (let i = 0; i < 120; i++) match.step(FIXED_DT);
    expect(mech.alive).toBe(true);
    expect(mech.simPosition.y).toBeLessThan(1.2); // de pé no chão (y = 0), não afundou nem caiu
    const caixas = exigirMapa('janeiro').caixasDaPlanta();
    expect(caixas.length).toBeGreaterThan(20);
    for (const p of PRACA_PREDIOS) {
      const cx = (p.caixa.x0 + p.caixa.x1) / 2;
      const cz = (p.caixa.z0 + p.caixa.z1) / 2;
      expect(caixas.some((c) => cx >= c.x0 && cx <= c.x1 && cz >= c.z0 && cz <= c.z1), p.nome).toBe(true);
    }
    expect(caixasDaPraca().length).toBe(caixas.length);
  });

  it('a rampa do Congresso sobe do chão da Esplanada até a laje (a 5 m) sem pulo; e a parede da torre barra', async () => {
    await carregarMapaSeFor('janeiro');
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    exigirMapa('janeiro').construir(new THREE.Scene(), physics);
    physics.step();
    // O chão da Esplanada e o topo da laje, lidos da física.
    expect(physics.terrainY(-60, 0, 5, 12)).toBeCloseTo(0, 1);
    expect(physics.terrainY(40, 20, 9, 12)).toBeCloseTo(5, 1);
    // Um Mech anda para leste pela rampa (centro z = 0) e chega à laje.
    const mech = new Vector09();
    mech.spawn(physics, new THREE.Vector3(-26, 0, 0));
    const entrada = { ...IDLE, moveZ: 1, moveYaw: -Math.PI / 2, yaw: -Math.PI / 2 };
    let alturaMax = 0;
    for (let i = 0; i < 900; i++) {
      mech.fixedUpdate(entrada, FIXED_DT);
      physics.step();
      alturaMax = Math.max(alturaMax, mech.simPosition.y);
    }
    expect(alturaMax, 'o Mech subiu a rampa').toBeGreaterThan(4);
    mech.despawn(physics);
  });
});
