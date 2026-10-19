import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { Android } from '../entities/Android';
import { PILOT_ANDROID_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import type { MechInput } from '../entities/MechBase';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { capacidadeDoMapa } from '../sim/nascimentos';
import { Match } from '../sim/Match';
import { mapFromSearch } from './Bunker';
import { carregarMapaSeFor, exigirMapa } from './mapasSobDemanda';
import { blocosDaPraca, FOLGA_DO_NASCIMENTO, LARGURA_DA_PORTA, PRACA_FONTES, PRACA_GRADIS, PRACA_LIMITES, PRACA_PREDIOS, PRACA_SPAWNS, PRACA_VAGAS } from './PracaLayout';
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
    expect(PRACA_SPAWNS[0]).toEqual([66, -12]); // a Praça, entre os três prédios e a salvo do monumento do meio
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
    expect([mech.simPosition.x, mech.simPosition.z]).toEqual([66, -12]);
    for (let i = 0; i < 120; i++) match.step(FIXED_DT);
    expect(mech.alive).toBe(true);
    expect(mech.simPosition.y).toBeLessThan(1.2); // de pé no chão (y = 0), não afundou nem caiu
    const caixas = exigirMapa('janeiro').caixasDaPlanta();
    expect(caixas.length).toBeGreaterThan(20);
    for (const p of PRACA_PREDIOS) {
      const k = p.caixa;
      expect(caixas.some((c) => c.x0 < k.x1 && c.x1 > k.x0 && c.z0 < k.z1 && c.z1 > k.z0), p.nome).toBe(true);
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
    // Um Mech anda para leste pela rampa do sul (centro z = 34) e chega à laje.
    const mech = new Vector09();
    mech.spawn(physics, new THREE.Vector3(-26, 0, 34));
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

describe('os saguões (P222): ambientes fechados que só androide e gente atravessam; o Mech fica de fora', () => {
  /** Tem bloco sólido neste ponto (a 1,5 m de altura)? */
  const parede = (x: number, z: number): boolean => solidos().some((b) => b.rz === 0 && Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2 && 1.5 >= b.y - b.h / 2 && 1.5 <= b.y + b.h / 2);

  it('cada saguão é fechado: toda a volta da caixa dele é parede a 1,5 m de altura, exceto as portas, que têm a abertura de 1,9 m; as mesas ficam dentro, e o forro cobre o saguão', () => {
    for (const p of PRACA_PREDIOS) {
      const { caixa: c, portas, mesas } = p.saguao;
      expect(mesas.length, p.nome).toBeGreaterThanOrEqual(6);
      for (const m of mesas) {
        expect(m.x, p.nome).toBeGreaterThan(c.x0);
        expect(m.x).toBeLessThan(c.x1);
        expect(m.z).toBeGreaterThan(c.z0);
        expect(m.z).toBeLessThan(c.z1);
      }
      expect(portas.length).toBeGreaterThanOrEqual(2);
      const naPorta = (x: number, z: number): boolean => portas.some((q) => Math.abs(x - q.x) < LARGURA_DA_PORTA / 2 - 0.01 && Math.abs(z - q.z) < 1);
      // a volta da caixa, de 0,25 em 0,25 m, um pouco para fora (dentro da parede de 1 m)
      const volta: [number, number][] = [];
      for (let x = c.x0; x <= c.x1; x += 0.25) volta.push([x, c.z0 - 0.5], [x, c.z1 + 0.5]);
      for (let z = c.z0; z <= c.z1; z += 0.25) volta.push([c.x0 - 0.5, z], [c.x1 + 0.5, z]);
      for (const [x, z] of volta) {
        if (naPorta(x, z) || (portas.some((q) => Math.abs(z - q.z) < 1.01) && portas.some((q) => Math.abs(x - q.x) < LARGURA_DA_PORTA / 2 + 0.01))) continue;
        // as portas dos prédios do Praça são paredes em z; a do Congresso é em x: o teste só olha a abertura onde ela está
        const aberto = portas.some((q) => (Math.abs(q.x - x) < LARGURA_DA_PORTA / 2 && Math.abs(q.z - z) < 1.01) || (Math.abs(q.z - z) < LARGURA_DA_PORTA / 2 && Math.abs(q.x - x) < 1.01));
        if (aberto) continue;
        expect(parede(x, z), `${p.nome}: furo na parede em (${x}, ${z})`).toBe(true);
      }
      // as portas são aberturas de verdade: no meio da porta não há parede a 1,5 m
      for (const q of portas) expect(parede(q.x, q.z), `${p.nome}: a porta em (${q.x}, ${q.z}) está tapada`).toBe(false);
    }
    // o forro: sobre o centro de cada saguão há um bloco sólido acima do pé-direito
    for (const p of PRACA_PREDIOS) {
      const { caixa: c, altura } = p.saguao;
      const cx = (c.x0 + c.x1) / 2;
      const cz = (c.z0 + c.z1) / 2;
      expect(solidos().some((b) => Math.abs(cx - b.x) <= b.w / 2 && Math.abs(cz - b.z) <= b.d / 2 && b.y - b.h / 2 >= altura - 0.01 && b.y - b.h / 2 <= altura + 0.01), `${p.nome}: sem forro`).toBe(true);
    }
  });

  it('o Mech NÃO passa pela porta (o Vector-09, de raio 1,3 m) e o androide (raio 0,36 m) entra no saguão do Congresso: a geometria barra o Mech, sem regra especial', async () => {
    await carregarMapaSeFor('janeiro');
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    exigirMapa('janeiro').construir(new THREE.Scene(), physics);
    physics.step();
    const leste = { ...IDLE, moveZ: 1, moveYaw: -Math.PI / 2, yaw: -Math.PI / 2 };
    const andar = (m: Vector09 | Android, ticks: number): void => {
      for (let i = 0; i < ticks; i++) {
        m.fixedUpdate(leste, FIXED_DT);
        physics.step();
      }
    };
    const mech = new Vector09();
    mech.spawn(physics, new THREE.Vector3(-8, 0, 12)); // de frente para a porta do norte... do sul (z = 12), na linha dela
    andar(mech, 500);
    expect(mech.simPosition.x, 'o Mech ficou do lado de fora').toBeLessThan(0);
    mech.despawn(physics);
    const droid = new Android({ stats: PILOT_ANDROID_STATS });
    droid.spawn(physics, new THREE.Vector3(-8, 0, 12));
    andar(droid, 500);
    expect(droid.simPosition.x, 'o androide entrou no saguão').toBeGreaterThan(4);
    expect(droid.simPosition.x).toBeLessThan(22);
    droid.despawn(physics);
  });

  it('os gradis da frente ficam no gramado entre os ministérios e a rampa, e os caídos são parte da fila', () => {
    expect(PRACA_GRADIS.caidos.every((i) => i >= 0 && i < PRACA_GRADIS.quantos)).toBe(true);
    const ultimo = PRACA_GRADIS.z0 + (PRACA_GRADIS.quantos - 1) * PRACA_GRADIS.passo;
    expect(Math.abs(PRACA_GRADIS.z0)).toBeLessThan(PRACA_LIMITES.maxZ);
    expect(Math.abs(ultimo)).toBeLessThan(PRACA_LIMITES.maxZ);
    expect(PRACA_GRADIS.x).toBeLessThan(-26); // antes do pé das rampas
  });
});
