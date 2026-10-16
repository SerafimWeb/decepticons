import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { weapon, WEAPON_IDS } from '../combat/weapons';
import { BILL, Billboards, MAX_BILLBOARDS, MAX_TIMED } from './Billboards';
import { explosionCounts, Explosions, MAX_CHUNKS, MAX_FIRE, MAX_SMOKE } from './Explosions';
import { explosionShake } from './explosionScale';
import { MARK, Marks, MAX_DARK_MARKS } from './Marks';
import type { ParticleSystem } from './ParticleSystem';
import { RibbonPool, Trails, TRAIL_STYLE } from './Ribbons';
import { WEAPON_LOOK } from './weaponLook';
import { WeaponFx } from './WeaponFx';

/**
 * Os efeitos de arma do P160 (só desenho, mas com teto e vida certos: G4/G5). O que estes testes travam: os pools nunca passam do teto, tudo o que
 * acende apaga sozinho, nenhum número vira NaN no que vai para a placa de vídeo, a fita de fumaça fica de lado para a câmera e cada arma tem a sua cara
 * com a cor de aviso no tiro inimigo.
 */

const UP = new THREE.Vector3(0, 1, 0);
const W = new THREE.Color(1, 1, 1);
const anda = (f: (dt: number) => void, s: number): void => {
  for (let t = 0; t < s - 1e-9; t += 1 / 60) f(1 / 60);
};
const semNaN = (a: ArrayLike<number>): boolean => {
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i]!)) return false;
  return true;
};
/** As partículas de verdade pedem o `document` (o atlas de formas); aqui só importa que a explosão as peça. */
const PARTICULAS = { burst: () => {} } as unknown as ParticleSystem;
const camera = (): THREE.PerspectiveCamera => {
  const c = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
  c.position.set(0, 5, 20);
  c.lookAt(0, 2, 0);
  c.updateMatrixWorld();
  return c;
};

describe('cartazes de luz (fx/Billboards): clarão da boca, brilho do tiro, clarão da explosão', () => {
  it('o clarão com vida acende, cresce e apaga sozinho; o do quadro vale só para o quadro', () => {
    const b = new Billboards();
    b.flash(new THREE.Vector3(), W, BILL.star, 1, 3, 0.1);
    b.update(0.016);
    expect(b.active).toBe(1);
    b.beginFrame();
    b.put(new THREE.Vector3(5, 0, 0), W, BILL.glow, 1);
    b.update(0.016);
    expect(b.active).toBe(2);
    b.beginFrame();
    b.update(0.016);
    expect(b.active).toBe(1); // o do quadro sumiu; o com vida segue
    anda((dt) => b.update(dt), 0.1);
    expect(b.active).toBe(0);
    expect(b.mesh.visible).toBe(false);
  });

  it('nunca passa do teto: os com vida reaproveitam o mais velho e os do quadro param no que sobra', () => {
    const b = new Billboards();
    for (let i = 0; i < MAX_TIMED * 2; i++) b.flash(new THREE.Vector3(i, 0, 0), W, BILL.glow, 1, 1, 5);
    b.beginFrame();
    for (let i = 0; i < MAX_BILLBOARDS * 2; i++) b.put(new THREE.Vector3(0, i, 0), W, BILL.glow, 1);
    b.update(0.016);
    expect(b.timed).toBe(MAX_TIMED);
    expect(b.active).toBe(MAX_BILLBOARDS);
  });
});

describe('marcas no cenário (fx/Marks): queimado, furo quente, geada, clarão no chão e onda de choque', () => {
  it('a marca escura dura a vida dela e some; a de luz (clarão, anel) vai para a camada que soma luz', () => {
    const m = new Marks();
    m.add(MARK.scorch, new THREE.Vector3(), UP, 4, 4, 1, W);
    m.add(MARK.ring, new THREE.Vector3(), UP, 1, 8, 0.4, W);
    expect(m.dark.active + m.light.active).toBe(0); // conta no primeiro update
    m.update(0.016);
    expect(m.dark.active).toBe(1);
    expect(m.light.active).toBe(1);
    anda((dt) => m.update(dt), 0.5);
    expect(m.light.active).toBe(0);
    expect(m.dark.active).toBe(1);
    anda((dt) => m.update(dt), 0.6);
    expect(m.active).toBe(0);
  });

  it('cheia, a mais velha cede a vaga (a parede crivada pela rotatória não estoura o pool)', () => {
    const m = new Marks();
    for (let i = 0; i < MAX_DARK_MARKS + 50; i++) m.add(MARK.hole, new THREE.Vector3(i, 0, 0), UP, 1, 1, 30, W);
    m.update(0.016);
    expect(m.dark.active).toBe(MAX_DARK_MARKS);
  });
});

describe('rastros em fita (fx/Ribbons): a fumaça e o fogo do motor', () => {
  it('a fita cresce com o caminho (um ponto a cada `spacing` m), fica de lado para a câmera e se desfaz sozinha depois que o míssil acaba', () => {
    const pool = new RibbonPool(4, 16, false);
    const st = TRAIL_STYLE.rocket.smoke;
    const id = pool.start(st, new THREE.Vector3(0, 2, 0));
    expect(id).toBeGreaterThanOrEqual(0);
    const eye = new THREE.Vector3(0, 2, 30); // a câmera olha a fita de lado (a fita anda em x)
    for (let k = 1; k <= 10; k++) {
      pool.head(id, new THREE.Vector3(k * st.spacing, 2, 0));
      pool.update(1 / 60, eye);
    }
    const pos = pool.mesh.geometry.getAttribute('position').array as Float32Array;
    expect(semNaN(pos)).toBe(true);
    // Os dois vértices de um ponto do meio se afastam em y (perpendicular ao caminho em x e à câmera em z), não em z.
    const v = 4 * 2;
    const dy = Math.abs(pos[v * 3 + 1]! - pos[v * 3 + 4]!);
    expect(dy).toBeGreaterThan(0.05);
    expect(Math.abs(pos[v * 3 + 2]! - pos[v * 3 + 5]!)).toBeLessThan(dy * 0.05); // a fumaça sobe um pouco: quase só em y
    pool.end(id);
    expect(pool.active).toBe(1);
    anda((dt) => pool.update(dt, eye), st.life + 0.1);
    expect(pool.active).toBe(0);
    expect(pool.mesh.visible).toBe(false);
  });

  it('pool cheio de fitas presas: o tiro novo fica sem fita (-1) em vez de roubar a de um míssil em voo; uma fita solta cede a vaga', () => {
    const pool = new RibbonPool(2, 8, false);
    const st = TRAIL_STYLE.micro.smoke;
    const a = pool.start(st, new THREE.Vector3());
    const b = pool.start(st, new THREE.Vector3());
    expect([a, b].sort()).toEqual([0, 1]);
    expect(pool.start(st, new THREE.Vector3())).toBe(-1);
    pool.end(a);
    expect(pool.start(st, new THREE.Vector3())).toBe(a);
  });

  it('o foguete leva fumaça e fogo; o míssil leve, só uma fita fina; o número do míssil leve não colide com o da fumaça grossa', () => {
    const t = new Trails();
    const rocket = t.start('rocket', new THREE.Vector3());
    const micro = t.start('micro', new THREE.Vector3());
    expect(rocket).toBeGreaterThanOrEqual(0);
    expect(micro).toBeGreaterThanOrEqual(1000);
    t.update(0.016, new THREE.Vector3(0, 0, 10));
    expect(t.smoke.active).toBe(1);
    expect(t.fire.active).toBe(1);
    expect(t.thin.active).toBe(1);
    t.end(rocket);
    t.end(micro);
    anda((dt) => t.update(dt, new THREE.Vector3(0, 0, 10)), 3);
    expect(t.active).toBe(0);
  });
});

describe('a explosão com corpo (fx/Explosions)', () => {
  it('escala com o raio da arma e tem teto: o míssil leve é pequeno, o cruzador grande, nada passa do teto', () => {
    const micro = explosionCounts(2.2, true);
    const foguete = explosionCounts(6, true);
    const cruzador = explosionCounts(9, true);
    expect(micro.fire).toBeLessThan(foguete.fire);
    expect(foguete.fire).toBeLessThan(cruzador.fire);
    expect(micro.chunks).toBe(0); // estilhaço só a partir de 3 m de raio
    expect(foguete.chunks).toBeGreaterThan(0);
    const enorme = explosionCounts(500, true);
    expect(enorme.fire).toBeLessThanOrEqual(9);
    expect(enorme.smoke).toBeLessThanOrEqual(11);
    expect(enorme.chunks).toBeLessThanOrEqual(14);
  });

  it('no chão marca o chão (queimado, clarão, onda) e solta estilhaço; no ar, nada de marca nem estilhaço; tudo apaga sozinho e sem NaN', () => {
    const bill = new Billboards();
    const marks = new Marks();
    const e = new Explosions(bill, marks, PARTICULAS);
    e.spawn(new THREE.Vector3(0, 1, 0), 6, 0);
    e.update(0.016);
    marks.update(0.016);
    expect(marks.dark.active).toBe(1);
    expect(marks.light.active).toBe(2);
    const counts = explosionCounts(6, true);
    expect(e.active).toBe(counts.fire + counts.smoke + counts.chunks);
    e.spawn(new THREE.Vector3(50, 40, 0), 6, null);
    e.update(0.016);
    marks.update(0.016);
    expect(marks.dark.active).toBe(1); // a do ar não marcou nada
    expect(e.active).toBe(2 * (counts.fire + counts.smoke) + counts.chunks);
    for (const o of e.objects) {
      const mesh = o as THREE.InstancedMesh;
      expect(semNaN(mesh.instanceMatrix.array)).toBe(true);
    }
    anda((dt) => e.update(dt), 4);
    expect(e.active).toBe(0);
  });

  it('uma salva enorme não passa do teto dos pools (o mais velho cede a vaga)', () => {
    const e = new Explosions(new Billboards(), new Marks(), PARTICULAS);
    for (let i = 0; i < 200; i++) e.spawn(new THREE.Vector3(i, 1, 0), 9, 0);
    e.update(0.016);
    expect(e.active).toBeLessThanOrEqual(MAX_FIRE + MAX_SMOKE + MAX_CHUNKS);
  });

  it('o tranco de câmera cresce com a explosão e cai com a distância; a grande alcança mais longe', () => {
    expect(explosionShake(0, 1)).toBeGreaterThan(explosionShake(20, 1));
    expect(explosionShake(20, 1)).toBeGreaterThan(explosionShake(20, 0.37));
    expect(explosionShake(70, 1)).toBe(0);
    expect(explosionShake(70, 1.5)).toBeGreaterThan(0); // o cruzador a 70 m ainda sacode
    expect(explosionShake(0, 99)).toBeLessThanOrEqual(0.9);
  });
});

describe('a cara de cada arma (fx/weaponLook) e o maestro (fx/WeaponFx)', () => {
  it('toda arma tem a sua cara; o tiro inimigo tem cor de aviso diferente da do jogador (a leitura do combate)', () => {
    for (const id of WEAPON_IDS) {
      const look = WEAPON_LOOK[id];
      expect(look).toBeDefined();
      for (const part of [look.glow, look.muzzle, look.hit, look.mark]) {
        if (!part || id === 'rockets' || id === 'seeker' || id === 'swarm' || id === 'cruise' || id === 'barrage') continue;
        expect(part.hostile.equals(part.friendly), `${id}: a cor do inimigo igual à do jogador`).toBe(false);
      }
    }
  });

  it('mísseis e obus ganham rastro; tiro de energia não; a marca só fica em superfície parada, e a da rotatória a cada 3 acertos', () => {
    const fx = new WeaponFx(PARTICULAS, camera(), () => 0);
    const o = new THREE.Vector3(0, 2, 0);
    const d = new THREE.Vector3(0, 0, -1);
    expect(fx.fired(o, d, weapon('rockets'), false)).toBeGreaterThanOrEqual(0);
    expect(fx.fired(o, d, weapon('cannon'), false)).toBeGreaterThanOrEqual(0);
    expect(fx.fired(o, d, weapon('plasma'), false)).toBe(-1);
    fx.impact(o, UP, weapon('plasma'), false, false);
    fx.update(0.016);
    expect(fx.marks.dark.active).toBe(0); // no Mech, sem marca
    fx.impact(o, UP, weapon('plasma'), false, true);
    for (let i = 0; i < 3; i++) fx.impact(o, UP, weapon('rotary'), false, true);
    fx.update(0.016);
    expect(fx.marks.dark.active).toBe(2);
  });

  it('o trilho deixa o raio iônico no pool de feixes; a explosão pergunta o chão; o Mech destruído explode', () => {
    const feixes: number[] = [];
    const beams = { spawn: (_f: THREE.Vector3, _t: THREE.Vector3, _h: boolean, _g: number, _c?: THREE.Color, w?: number) => feixes.push(w ?? 1) };
    const chao: number[] = [];
    const fx = new WeaponFx(PARTICULAS, camera(), (_x, y) => (chao.push(y), 0), beams as never);
    fx.landed(-1, new THREE.Vector3(), new THREE.Vector3(0, 0, -50), weapon('railgun'), false);
    fx.landed(-1, new THREE.Vector3(), new THREE.Vector3(0, 0, -50), weapon('plasma'), false);
    expect(feixes).toHaveLength(1);
    expect(feixes[0]).toBeGreaterThan(1); // mais grosso que o laser
    fx.explosion(new THREE.Vector3(0, 3, 0), weapon('rockets'));
    expect(chao).toEqual([3]);
    fx.wreck(new THREE.Vector3(10, 0, 0), 6);
    fx.update(0.016);
    expect(fx.explosions.active).toBeGreaterThan(0);
    anda((dt) => fx.update(dt), 30);
    expect(fx.active).toBe(0);
  });
});
