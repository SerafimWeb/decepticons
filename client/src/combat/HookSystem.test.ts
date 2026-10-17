import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SHOVE_DECAY, type MechBase } from '../entities/MechBase';
import { HOOK_POOL, HookSystem, pesoDe, SNAP_RANGE, type HookEnd } from './HookSystem';
import { weapon } from './weapons';

const W = weapon('harpoon');
const HOOK = W.hook!;
const DT = 1 / 60;

/** Um robô de mentira com só o que o cabo lê: posição, raio, vida, dash e o empurrão (registrado). */
interface Fake {
  alive: boolean;
  isDashing: boolean;
  simPosition: THREE.Vector3;
  stats: { radius: number; height: number };
  pushes: number[][];
  push(dx: number, dz: number, speed: number): void;
}
function fake(x: number, z: number, radius = 1.3): Fake & MechBase {
  const f: Fake = {
    alive: true,
    isDashing: false,
    simPosition: new THREE.Vector3(x, 0, z),
    stats: { radius, height: 4 },
    pushes: [],
    push(dx, dz, speed) {
      f.pushes.push([dx, dz, speed]);
    },
  };
  return f as unknown as Fake & MechBase;
}

/** Um sistema com a parede (`sight`) e o dano (`pull`) controláveis, e o registro de por que cada cabo soltou. */
function sistema(sight = true, pull = true) {
  const estado = { sight, pull };
  const motivos: HookEnd[] = [];
  let prendeu = 0;
  const hooks = new HookSystem(
    () => estado.sight,
    () => estado.pull,
  );
  hooks.onEnd = (_h, why) => motivos.push(why);
  hooks.onAttach = () => prendeu++;
  const ticks = (n: number) => {
    for (let i = 0; i < n; i++) hooks.fixedUpdate(DT);
  };
  return { hooks, estado, motivos, ticks, prendeu: () => prendeu };
}

describe('arpão: prender', () => {
  it('prende o inimigo, avisa uma vez e conta um cabo', () => {
    const { hooks, prendeu } = sistema();
    const dono = fake(0, 0);
    const alvo = fake(0, -30);
    expect(hooks.attach(dono, alvo, W, 'rightShoulder')).toBe(true);
    expect(hooks.count).toBe(1);
    expect(prendeu()).toBe(1);
  });

  it('o robô mais leve não puxa o mais pesado (dono, 17/10): alvo de raio maior que o do atirador não é preso; igual e mais leve são', () => {
    const { hooks } = sistema();
    const dono = fake(0, 0, 1.3); // um Mech médio
    expect(hooks.attach(dono, fake(0, -30, 1.6), W, 'rightShoulder'), 'mais pesado (Onça)').toBe(false);
    expect(hooks.attach(dono, fake(0, -30, 3.6), W, 'rightShoulder'), 'titã').toBe(false);
    expect(hooks.count).toBe(0);
    expect(hooks.attach(dono, fake(0, -30, 1.3), W, 'rightShoulder'), 'do mesmo peso').toBe(true);
    expect(hooks.attach(dono, fake(5, -30, 1.0), W, 'rightShoulder'), 'mais leve (Arara)').toBe(true);
    expect(hooks.attach(dono, fake(9, -30, 0.36), W, 'rightShoulder'), 'andróide').toBe(true);
  });

  it('o grande puxa o pequeno, mas o pequeno não puxa o grande (a assimetria que faz o arpão render só nas mãos de um robô pesado)', () => {
    const { hooks } = sistema();
    const titã = fake(0, 0, 3.6);
    const mech = fake(0, -30, 1.3);
    expect(hooks.attach(titã, mech, W, 'rightShoulder')).toBe(true);
    expect(hooks.attach(mech, titã, W, 'rightShoulder')).toBe(false);
  });

  it('o peso é o raio da cápsula', () => {
    expect(pesoDe(fake(0, 0, 1.6))).toBe(1.6);
  });

  it('ninguém prende a si mesmo, nem prende ou é preso morto', () => {
    const { hooks } = sistema();
    const a = fake(0, 0);
    const morto = fake(0, -30);
    morto.alive = false;
    expect(hooks.attach(a, a, W, 'rightShoulder')).toBe(false);
    expect(hooks.attach(a, morto, W, 'rightShoulder')).toBe(false);
    a.alive = false;
    expect(hooks.attach(a, fake(0, -30), W, 'rightShoulder')).toBe(false);
    expect(hooks.count).toBe(0);
  });

  it('o segundo ombro no mesmo alvo divide o cabo (um só, renova o tempo) e o puxão não dobra', () => {
    const { hooks, ticks, prendeu } = sistema();
    const dono = fake(0, 0);
    const alvo = fake(0, -30);
    hooks.attach(dono, alvo, W, 'rightShoulder');
    ticks(30);
    const antes = hooks.pool.find((h) => h.active)!.left;
    expect(hooks.attach(dono, alvo, W, 'leftShoulder')).toBe(true);
    const h = hooks.pool.find((x) => x.active)!;
    expect(hooks.count).toBe(1);
    expect(prendeu()).toBe(1);
    expect(h.mountA).toBe('rightShoulder');
    expect(h.mountB).toBe('leftShoulder');
    expect(h.left).toBeGreaterThan(antes);
    alvo.pushes.length = 0;
    ticks(1);
    expect(alvo.pushes).toHaveLength(1);
  });

  it('o mesmo ombro de novo só renova o tempo (não vira segundo cabo)', () => {
    const { hooks } = sistema();
    const dono = fake(0, 0);
    const alvo = fake(0, -30);
    hooks.attach(dono, alvo, W, 'rightShoulder');
    hooks.attach(dono, alvo, W, 'rightShoulder');
    expect(hooks.pool.find((h) => h.active)!.mountB).toBeNull();
  });

  it('o pool tem teto: o nono alvo não prende, e solta um cabo libera a vaga', () => {
    const { hooks, ticks } = sistema();
    const dono = fake(0, 0);
    const alvos = Array.from({ length: HOOK_POOL + 1 }, (_, i) => fake(i, -30));
    for (let i = 0; i < HOOK_POOL; i++) expect(hooks.attach(dono, alvos[i]!, W, 'rightShoulder'), `alvo ${i}`).toBe(true);
    expect(hooks.attach(dono, alvos[HOOK_POOL]!, W, 'rightShoulder')).toBe(false);
    alvos[0]!.alive = false;
    ticks(1);
    expect(hooks.attach(dono, alvos[HOOK_POOL]!, W, 'rightShoulder')).toBe(true);
  });
});

describe('arpão: puxar', () => {
  it('cada tick empurra o alvo em direção ao dono, na velocidade do cabo (a conta do decaimento do empurrão)', () => {
    const { hooks, ticks } = sistema();
    const dono = fake(10, 20);
    const alvo = fake(0, -30);
    hooks.attach(dono, alvo, W, 'rightShoulder');
    ticks(1);
    expect(alvo.pushes).toHaveLength(1);
    const [dx, dz, speed] = alvo.pushes[0]!;
    expect(dx).toBeCloseTo(10, 6); // do alvo para o dono
    expect(dz).toBeCloseTo(50, 6);
    expect(speed).toBeCloseTo(HOOK.pullSpeed * SHOVE_DECAY * DT, 9);
  });

  it('sem o dano ligado (o cliente online) o cabo não puxa, mas o tempo corre e ele solta', () => {
    const { hooks, estado, ticks, motivos } = sistema(true, false);
    const alvo = fake(0, -30);
    hooks.attach(fake(0, 0), alvo, W, 'rightShoulder');
    ticks(Math.ceil(HOOK.hold / DT) + 1);
    expect(alvo.pushes).toHaveLength(0);
    expect(motivos).toEqual(['timeout']);
    expect(estado.pull).toBe(false);
  });
});

describe('arpão: soltar', () => {
  it('o tempo acaba (`hold`): solta por timeout', () => {
    const { hooks, ticks, motivos } = sistema();
    hooks.attach(fake(0, 0), fake(0, -30), W, 'rightShoulder');
    ticks(Math.floor(HOOK.hold / DT) - 2);
    expect(hooks.count).toBe(1);
    ticks(4);
    expect(hooks.count).toBe(0);
    expect(motivos).toEqual(['timeout']);
  });

  it('o alvo chega perto (`arrive`, de superfície a superfície): solta por arrived', () => {
    const { hooks, ticks, motivos } = sistema();
    // 5 m entre os centros − 1,3 − 1,3 = 2,4 m de vão, dentro dos 3 m.
    hooks.attach(fake(0, 0), fake(0, -5), W, 'rightShoulder');
    ticks(1);
    expect(motivos).toEqual(['arrived']);
    expect(hooks.count).toBe(0);
  });

  it('um pouco acima do `arrive` ainda segura', () => {
    const { hooks, ticks } = sistema();
    hooks.attach(fake(0, 0), fake(0, -(HOOK.arrive + 2.6 + 0.2)), W, 'rightShoulder');
    ticks(1);
    expect(hooks.count).toBe(1);
  });

  it('o dash do alvo corta o cabo (o contra-ataque)', () => {
    const { hooks, ticks, motivos } = sistema();
    const alvo = fake(0, -30);
    hooks.attach(fake(0, 0), alvo, W, 'rightShoulder');
    ticks(10);
    alvo.isDashing = true;
    ticks(1);
    expect(motivos).toEqual(['dash']);
  });

  it('o dono ou o alvo morre: solta por dead', () => {
    const a = sistema();
    const alvo = fake(0, -30);
    a.hooks.attach(fake(0, 0), alvo, W, 'rightShoulder');
    alvo.alive = false;
    a.ticks(1);
    expect(a.motivos).toEqual(['dead']);
    const b = sistema();
    const dono = fake(0, 0);
    b.hooks.attach(dono, fake(0, -30), W, 'rightShoulder');
    dono.alive = false;
    b.ticks(1);
    expect(b.motivos).toEqual(['dead']);
  });

  it('o alvo foge além de 125% do alcance: o cabo estoura (snapped)', () => {
    const { hooks, ticks, motivos } = sistema();
    const alvo = fake(0, -(W.maxRange * SNAP_RANGE + 2.6 + 1));
    hooks.attach(fake(0, 0), alvo, W, 'rightShoulder');
    ticks(1);
    expect(motivos).toEqual(['snapped']);
  });

  it('uma parede no meio solta o cabo (conferida a cada poucos ticks, não a cada um)', () => {
    const { hooks, estado, ticks, motivos } = sistema();
    hooks.attach(fake(0, 0), fake(0, -30), W, 'rightShoulder');
    ticks(30);
    expect(hooks.count).toBe(1); // à vista: segura
    estado.sight = false;
    ticks(1);
    expect(hooks.count).toBe(1); // ainda não conferiu
    ticks(6);
    expect(motivos).toEqual(['wall']);
  });

  it('clear() solta tudo sem avisar (rodada nova)', () => {
    const { hooks, motivos } = sistema();
    hooks.attach(fake(0, 0), fake(0, -30), W, 'rightShoulder');
    hooks.attach(fake(0, 0), fake(5, -30), W, 'leftShoulder');
    hooks.clear();
    expect(hooks.count).toBe(0);
    expect(motivos).toEqual([]);
  });

  it('é determinístico: duas execuções iguais empurram igual (G1)', () => {
    const roda = () => {
      const { hooks, ticks } = sistema();
      const alvo = fake(3, -40);
      hooks.attach(fake(0, 0), alvo, W, 'rightShoulder');
      ticks(90);
      return JSON.stringify(alvo.pushes);
    };
    expect(roda()).toBe(roda());
  });
});
