import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Vector09 } from '../entities/Vector09';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { BarrageSystem, bombOffset } from './BarrageSystem';
import { weapon } from './weapons';

const W = weapon('barrage');
const B = W.barrage!;
const FRENTE = new THREE.Vector3(0, 0, -1); // yaw 0

interface Pouso {
  at: THREE.Vector3;
  t: number;
  owner: unknown;
}

async function mundo() {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(600, 2, 600)); // o chão, com o topo em y = 0
  physics.step();
  const scene = new THREE.Scene();
  const barrage = new BarrageSystem(scene, physics);
  const pousos: Pouso[] = [];
  let t = 0;
  barrage.onExplode = (at, _dir, owner) => pousos.push({ at: at.clone(), t, owner });
  const run = (seconds: number): void => {
    for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++, t += FIXED_DT) {
      barrage.fixedUpdate(FIXED_DT);
      physics.step();
    }
  };
  return { physics, barrage, pousos, run, now: () => t };
}

describe('bombOffset: o desenho da chuva é uma conta, sem sorteio', () => {
  const out = { x: 0, z: 0 };

  it('todas as bombas ficam dentro do círculo, em raios crescentes, e longe umas das outras', () => {
    const pts: { x: number; z: number }[] = [];
    for (let i = 0; i < B.bombs; i++) {
      bombOffset(i, B.bombs, B.spread, 0, 0, out);
      pts.push({ ...out });
      expect(Math.hypot(out.x, out.z)).toBeLessThanOrEqual(B.spread);
    }
    const r = pts.map((p) => Math.hypot(p.x, p.z));
    for (let i = 1; i < r.length; i++) expect(r[i]!).toBeGreaterThan(r[i - 1]!);
    let menor = Infinity;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) menor = Math.min(menor, Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.z - pts[j]!.z));
    expect(menor).toBeGreaterThan(1.5); // não empilha duas bombas no mesmo lugar
  });

  it('é determinística; o yaw gira o desenho sem mudar os raios; outro lançador (volley) cai em outros lugares', () => {
    const a = { x: 0, z: 0 };
    const b = { x: 0, z: 0 };
    bombOffset(3, B.bombs, B.spread, 0.7, 0, a);
    bombOffset(3, B.bombs, B.spread, 0.7, 0, b);
    expect(a).toEqual(b);
    bombOffset(3, B.bombs, B.spread, 0.7 + 1.1, 0, b);
    expect(Math.hypot(b.x, b.z)).toBeCloseTo(Math.hypot(a.x, a.z), 9);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(1);
    bombOffset(3, B.bombs, B.spread, 0.7, 1, b);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(1);
  });

  it('é contínua: uma mira quase igual (servidor e cliente) dá bombas quase iguais', () => {
    const a = { x: 0, z: 0 };
    const b = { x: 0, z: 0 };
    for (let i = 0; i < B.bombs; i++) {
      bombOffset(i, B.bombs, B.spread, 0.5, 0, a);
      bombOffset(i, B.bombs, B.spread, 0.5 + 0.001, 0, b);
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.02);
    }
  });
});

describe('BarrageSystem: a chuva no tempo', () => {
  const ORIGEM = new THREE.Vector3(0, 3, 0);
  const ALVO = new THREE.Vector3(20, 0, 0);

  it('nada cai enquanto sobe; depois as 8 bombas explodem uma a cada 0,1 s, cada uma no lugar da conta, no chão', async () => {
    const { barrage, pousos, run } = await mundo();
    barrage.fire(ORIGEM, FRENTE, ALVO, undefined, W);
    run(B.ascent + B.fall - 0.1);
    expect(pousos).toHaveLength(0); // ainda não deu tempo da primeira
    run(1.2);
    expect(pousos).toHaveLength(B.bombs);
    expect(barrage.active).toBe(0);
    const tempos = pousos.map((p) => p.t).sort((x, y) => x - y);
    expect(tempos[0]!).toBeCloseTo(B.ascent + B.fall, 1);
    expect(tempos.at(-1)!).toBeCloseTo(B.ascent + (B.bombs - 1) * B.stagger + B.fall, 1);
    const off = { x: 0, z: 0 };
    pousos.forEach((p, i) => {
      bombOffset(i, B.bombs, B.spread, 0, 0, off);
      expect(p.at.x).toBeCloseTo(ALVO.x + off.x, 2);
      expect(p.at.z).toBeCloseTo(ALVO.z + off.z, 2);
      expect(p.at.y).toBeCloseTo(0.2, 1); // um palmo acima do chão, como o foguete
    });
  });

  it('é a mesma chuva toda vez: dois mundos, mesma mira, mesmos pousos', async () => {
    const a = await mundo();
    const b = await mundo();
    for (const m of [a, b]) {
      m.barrage.fire(ORIGEM, FRENTE, ALVO, undefined, W);
      m.run(4);
    }
    expect(a.pousos.map((p) => p.at.toArray())).toEqual(b.pousos.map((p) => p.at.toArray()));
    expect(a.pousos.map((p) => +p.t.toFixed(4))).toEqual(b.pousos.map((p) => +p.t.toFixed(4)));
  });

  it('mira além do alcance: a chuva cai no limite do alcance, na mesma direção', async () => {
    const { barrage, pousos, run } = await mundo();
    barrage.fire(ORIGEM, FRENTE, new THREE.Vector3(500, 0, 0), undefined, W);
    run(4);
    expect(pousos).toHaveLength(B.bombs);
    for (const p of pousos) {
      expect(Math.abs(p.at.x - W.maxRange)).toBeLessThanOrEqual(B.spread + 0.01);
      expect(Math.abs(p.at.z)).toBeLessThanOrEqual(B.spread + 0.01);
    }
    const mx = pousos.reduce((s, p) => s + p.at.x, 0) / pousos.length;
    expect(mx).toBeGreaterThan(W.maxRange - 5);
  });

  it('a bomba explode no telhado, não no chão embaixo dele', async () => {
    const { physics, barrage, pousos, run } = await mundo();
    physics.addStaticBox(new THREE.Vector3(20, 5, 0), new THREE.Vector3(40, 10, 40)); // topo em y = 10
    physics.step();
    barrage.fire(ORIGEM, FRENTE, new THREE.Vector3(20, 10, 0), undefined, W);
    run(4);
    expect(pousos).toHaveLength(B.bombs);
    for (const p of pousos) expect(p.at.y).toBeCloseTo(10.2, 1);
  });

  it('um Mech no caminho leva a bomba em cima; o dono não: a bomba passa por ele e cai no chão', async () => {
    const { physics, barrage, pousos, run } = await mundo();
    const alvo = new Vector09();
    const dono = new Vector09();
    const off = { x: 0, z: 0 };
    bombOffset(0, B.bombs, B.spread, 0, 0, off); // a primeira bomba cai neste ponto
    alvo.spawn(physics, new THREE.Vector3(ALVO.x + off.x, 0, ALVO.z + off.z));
    bombOffset(1, B.bombs, B.spread, 0, 0, off);
    dono.spawn(physics, new THREE.Vector3(ALVO.x + off.x, 0, ALVO.z + off.z));
    physics.step();
    barrage.fire(ORIGEM, FRENTE, ALVO, dono.collider, W);
    run(4);
    expect(pousos).toHaveLength(B.bombs);
    expect(pousos[0]!.at.y).toBeGreaterThan(2); // explodiu no alto do Mech, não no chão
    expect(pousos[1]!.at.y).toBeCloseTo(0.2, 1); // o dono não bloqueia a própria bomba
    expect(pousos[1]!.owner).toBe(dono.collider); // e quem explode sabe de quem é (o dano não ferir o dono é do CombatSystem)
  });

  it('clear() apaga tudo o que estava no ar, sem explodir', async () => {
    const { barrage, pousos, run } = await mundo();
    barrage.fire(ORIGEM, FRENTE, ALVO, undefined, W);
    run(1);
    expect(barrage.active).toBe(1);
    barrage.clear();
    expect(barrage.active).toBe(0);
    run(4);
    expect(pousos).toHaveLength(0);
  });

  it('o pool é fixo: sete lançamentos juntos não estouram, o mais velho é reaproveitado', async () => {
    const { barrage, run } = await mundo();
    for (let i = 0; i < 7; i++) {
      barrage.fire(ORIGEM, FRENTE, ALVO, undefined, W);
      run(0.05);
    }
    expect(barrage.active).toBe(6);
  });

  it('arma sem desenho de chuva (foguete comum) é ignorada: nada no ar e nenhum evento de tiro', async () => {
    const { barrage } = await mundo();
    let tiros = 0;
    barrage.onFired = () => tiros++;
    barrage.fire(ORIGEM, FRENTE, ALVO, undefined, weapon('rockets'));
    expect(barrage.active).toBe(0);
    expect(tiros).toBe(0);
    barrage.fire(ORIGEM, FRENTE, ALVO, undefined, W);
    expect(tiros).toBe(1); // o servidor transforma isto em um evento de tiro (SHOT)
  });

  it('o desenho do quadro: um aviso no chão por bomba que ainda não explodiu, e a bomba só depois que começa a cair', async () => {
    const { barrage, run } = await mundo();
    const marks = (barrage as unknown as { markMesh: THREE.InstancedMesh }).markMesh;
    const bombs = (barrage as unknown as { bombMesh: THREE.InstancedMesh }).bombMesh;
    barrage.fire(ORIGEM, FRENTE, ALVO, undefined, W);
    barrage.render(0);
    expect(marks.count).toBe(B.bombs); // o aviso aparece no lançamento
    expect(bombs.count).toBe(0);
    run(B.ascent + 0.35); // as bombas 0 a 3 já começaram a cair
    barrage.render(0);
    expect(bombs.count).toBe(4);
    expect(marks.count).toBe(B.bombs);
    run(2);
    barrage.render(0);
    expect(marks.count + bombs.count).toBe(0); // tudo explodiu: sem aviso nem bomba
  });
});
