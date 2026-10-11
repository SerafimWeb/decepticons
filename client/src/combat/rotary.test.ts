import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { Armament, type ShotSink } from './Armament';
import { drill, sustainedDps, timeToKill } from './balance';
import { SHOULDER_TRIGGERS, type MountId, type TriggerLayout } from './mounts';
import { applySpread, NO_SPREAD, spreadAt, type Spread } from './spread';
import { SpinUp } from './trigger';
import { hitDamage, TIERS, weapon, type Loadout, type WeaponStats } from './weapons';

const V = VECTOR09_STATS;
const TORSO = V.maxModuleHealth.torso;
const ROTARY = weapon('rotary');
const SPIN = ROTARY.spin!;

interface Shot {
  t: number;
  mount: MountId;
  w: WeaponStats;
  spread: Spread;
}

/** Um Mech de verdade (corpo procedural, sem física) com o gatilho ligado e um sink que anota cada tiro e o desvio dele. */
function bench(loadout: Loadout, triggers?: TriggerLayout) {
  const stats = triggers ? { ...VECTOR09_STATS, triggers, loadout } : { ...VECTOR09_STATS, loadout };
  const mech = new Vector09({ stats, loadout });
  const armament = new Armament(mech);
  const shots: Shot[] = [];
  let t = 0;
  const sink: ShotSink = {
    projectile: (mount, w, spread) => shots.push({ t, mount, w, spread: { x: spread.x, y: spread.y } }),
    rocket: () => {},
    melee: () => {},
    flame: () => {},
  };
  const hold = (seconds: number, fire: boolean): void => {
    for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++, t += FIXED_DT) armament.fixedUpdate(FIXED_DT, fire, false, sink);
  };
  const between = (a: number, b: number) => shots.filter((s) => s.t >= a && s.t < b).length;
  return { mech, armament, shots, hold, between };
}

describe('metralhadora rotatória: números e equilíbrio', () => {
  it('é de energia, sem carregador, e pesa 4/6/8 t nos três níveis; cada nível bate mais forte', () => {
    expect(ROTARY.kind).toBe('energy');
    expect(ROTARY.magazine).toBe(0);
    expect([0, 1, 2].map((t) => weapon('rotary', t as 0 | 1 | 2).mass)).toEqual([4, 6, 8]);
    expect([0, 1, 2].map((t) => weapon('rotary', t as 0 | 1 | 2).damage)).toEqual([5, 6, 7]);
    expect(TIERS).toHaveLength(3);
  });

  it('sozinha, em nenhum nível derruba um torso em menos de 4,5 s (a meta de todas as armas)', () => {
    for (const t of [0, 1, 2] as const) expect(timeToKill([weapon('rotary', t)], V, TORSO)).toBeGreaterThan(4.5);
  });

  it('o MK I derruba o torso em 5 a 7,5 s, como o plasma: a rotatória não é mais letal, é mais constante', () => {
    const t = timeToKill([ROTARY], V, TORSO);
    expect(t).toBeGreaterThan(5);
    expect(t).toBeLessThan(7.5);
    expect(sustainedDps(ROTARY, V) / sustainedDps(weapon('plasma'), V)).toBeGreaterThan(0.8);
    expect(sustainedDps(ROTARY, V) / sustainedDps(weapon('plasma'), V)).toBeLessThan(1.25);
  });

  it('subir de nível se sente, mas não decide: o MK III derruba de 10% a 40% mais rápido que o MK I', () => {
    const ratio = timeToKill([weapon('rotary', 2)], V, TORSO) / timeToKill([ROTARY], V, TORSO);
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(0.9);
  });

  it('com os foguetes, nenhum nível derruba em menos de 2,5 s: o calor do Mech segura os dois braços', () => {
    for (const p of [0, 1, 2] as const) for (const r of [0, 1, 2] as const) expect(timeToKill([weapon('rotary', p), weapon('rockets', r)], V, TORSO)).toBeGreaterThan(2.5);
  });

  it('o calor é o freio: o Mech ferve em 2,5 a 4 s de rajada contínua (a rampa de rotação faz parte)', () => {
    const r = drill(V, { speed: 0, fire: [ROTARY] }, 30, Infinity);
    expect(r.overheatAt).not.toBeNull();
    expect(r.overheatAt!).toBeGreaterThan(2.5);
    expect(r.overheatAt!).toBeLessThan(4);
  });

  it('a rampa de cadência na bancada: rajada cresce e depois estabiliza em 10 tiros por 0,5 s', () => {
    const tiros: number[] = [];
    drill(V, { speed: 0, fire: [ROTARY], onShot: (t) => tiros.push(t) }, 6, Infinity);
    const por = (a: number, b: number) => tiros.filter((t) => t >= a && t < b).length;
    expect(por(0, 0.5)).toBeLessThan(por(0.5, 1));
    expect(por(0.5, 1)).toBeLessThan(por(1, 1.5));
    expect(por(1.5, 2)).toBeLessThanOrEqual(10);
    expect(por(1.5, 2)).toBeGreaterThanOrEqual(9);
  });

  it('de perto bate cheio; a 95 m (alcance máximo) cai a 35% do dano: o dano por bala é pequeno', () => {
    expect(hitDamage(ROTARY, 10)).toBe(ROTARY.damage);
    expect(hitDamage(ROTARY, ROTARY.maxRange)).toBeLessThanOrEqual(Math.round(ROTARY.damage * 0.4));
  });
});

describe('SpinUp: a rotação do cano', () => {
  it('sobe de 0 a 1 em `up` s com o gatilho apertado e cai em `down` s ao soltar', () => {
    const s = new SpinUp();
    for (let i = 0; i < Math.round(SPIN.up / FIXED_DT / 2); i++) s.step(FIXED_DT, true, SPIN);
    expect(s.level).toBeCloseTo(0.5, 1);
    for (let i = 0; i < Math.round(SPIN.up / FIXED_DT) + 5; i++) s.step(FIXED_DT, true, SPIN);
    expect(s.level).toBe(1);
    for (let i = 0; i < Math.round(SPIN.down / FIXED_DT / 2); i++) s.step(FIXED_DT, false, SPIN);
    expect(s.level).toBeCloseTo(0.5, 1);
    for (let i = 0; i < Math.round(SPIN.down / FIXED_DT) + 5; i++) s.step(FIXED_DT, false, SPIN);
    expect(s.level).toBe(0);
  });

  it('o intervalo vai de fireInterval/minRate (parado) até o fireInterval (plena rotação); arma sem rotação não muda', () => {
    const s = new SpinUp();
    expect(s.interval(ROTARY)).toBeCloseTo(ROTARY.fireInterval / SPIN.minRate, 6);
    s.level = 1;
    expect(s.interval(ROTARY)).toBeCloseTo(ROTARY.fireInterval, 6);
    expect(s.interval(weapon('plasma'))).toBe(weapon('plasma').fireInterval);
  });

  it('reset zera a rotação', () => {
    const s = new SpinUp();
    s.level = 0.8;
    s.reset();
    expect(s.level).toBe(0);
  });
});

describe('spread: o desvio sem sorteio (G1/G2)', () => {
  it('o mesmo número de tiro dá sempre o mesmo desvio, e tudo cai dentro do cone', () => {
    const a: Spread = { x: 0, y: 0 };
    const b: Spread = { x: 0, y: 0 };
    for (let i = 0; i < 500; i++) {
      spreadAt(i, 0.05, a);
      spreadAt(i, 0.05, b);
      expect(a).toEqual(b);
      expect(Math.hypot(a.x, a.y)).toBeLessThanOrEqual(0.05 + 1e-12);
    }
  });

  it('preenche o cone por igual: nenhum quadrante vazio e nenhum lugar repetido em 200 tiros', () => {
    const quadrantes = [0, 0, 0, 0];
    const vistos = new Set<string>();
    const s: Spread = { x: 0, y: 0 };
    for (let i = 0; i < 200; i++) {
      spreadAt(i, 1, s);
      quadrantes[(s.x >= 0 ? 0 : 1) + (s.y >= 0 ? 0 : 2)]!++;
      vistos.add(`${s.x.toFixed(6)},${s.y.toFixed(6)}`);
    }
    for (const q of quadrantes) expect(q).toBeGreaterThan(30);
    expect(vistos.size).toBe(200);
  });

  it('cone zero não desvia: o tiro vai na mira', () => {
    const s = spreadAt(37, 0, { x: 1, y: 1 });
    expect(s.x === 0 && s.y === 0).toBe(true);
    const dir = new THREE.Vector3(0.3, 0.2, 0.9).normalize();
    const antes = dir.clone();
    expect(applySpread(dir, NO_SPREAD)).toBe(dir);
    expect(dir.equals(antes)).toBe(true);
  });

  it('applySpread devolve um vetor unitário, desviado pelo ângulo pedido, em qualquer direção (inclusive reto para cima)', () => {
    for (const d of [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.2, -0.6, 0.77)]) {
      d.normalize();
      const dir = d.clone();
      applySpread(dir, { x: 0.03, y: -0.02 });
      expect(dir.length()).toBeCloseTo(1, 9);
      expect(dir.angleTo(d)).toBeCloseTo(Math.atan(Math.hypot(0.03, 0.02)), 3);
    }
  });
});

describe('Armament: a rotatória no gatilho principal', () => {
  it('a cadência sobe com a rotação: o primeiro 0,5 s solta bem menos tiros que depois de 2 s de gatilho', () => {
    const { hold, between } = bench({ primary: ROTARY, secondary: null });
    hold(3, true);
    const arranque = between(0, 0.5);
    const cheia = between(2, 2.5);
    expect(arranque).toBeGreaterThanOrEqual(2);
    expect(arranque).toBeLessThanOrEqual(4);
    expect(cheia).toBeGreaterThanOrEqual(9);
    expect(cheia).toBeLessThanOrEqual(10);
    expect(between(0.5, 1)).toBeGreaterThan(arranque);
  });

  it('o primeiro tiro sai no mesmo tick do gatilho, sem espera, e vai reto na mira (cone zero com o cano parado)', () => {
    const { hold, shots } = bench({ primary: ROTARY, secondary: null });
    hold(FIXED_DT * 2, true);
    expect(shots[0]!.t).toBe(0);
    expect(Math.hypot(shots[0]!.spread.x, shots[0]!.spread.y)).toBeLessThan(SPIN.spread * 0.2);
  });

  it('o desvio abre com a rotação: depois de 2 s o desvio vai até o cone cheio; a partida (cano parado) vai bem mais fechada', () => {
    const { hold, shots } = bench({ primary: ROTARY, secondary: null });
    hold(2.4, true);
    const maior = (a: number, b: number) => Math.max(...shots.filter((s) => s.t >= a && s.t < b).map((s) => Math.hypot(s.spread.x, s.spread.y)));
    // Nos primeiros 0,5 s saem o tiro 0 e mais uns dois (cano a 30% ou menos): bem dentro de metade do cone. Sem o cone crescer com a rotação o 2º já passaria de 78%.
    expect(maior(0, 0.5)).toBeLessThan(SPIN.spread * 0.5);
    expect(maior(1.2, 2.4)).toBeGreaterThan(SPIN.spread * 0.8);
    expect(maior(1.2, 2.4)).toBeLessThanOrEqual(SPIN.spread + 1e-9);
  });

  it('é determinística: duas bancadas iguais dão exatamente os mesmos tiros, instante e desvio (G1/G2)', () => {
    const a = bench({ primary: ROTARY, secondary: null });
    const b = bench({ primary: ROTARY, secondary: null });
    a.hold(2, true);
    b.hold(2, true);
    expect(a.shots.length).toBe(b.shots.length);
    expect(a.shots.map((s) => [s.t, s.spread.x, s.spread.y])).toEqual(b.shots.map((s) => [s.t, s.spread.x, s.spread.y]));
  });

  it('cada tiro soma o calor dela e o Mech trava ferver em ~3 s: depois disso nenhum tiro sai', () => {
    const { hold, shots, mech, between } = bench({ primary: ROTARY, secondary: null });
    hold(5, true);
    expect(mech.overheated).toBe(true);
    const ultimo = shots[shots.length - 1]!.t;
    expect(ultimo).toBeGreaterThan(2.5);
    expect(ultimo).toBeLessThan(4);
    expect(between(ultimo + FIXED_DT, 5)).toBe(0);
  });

  it('a bandeira de rotação (status.spinning) liga com o cano girando e apagado ao soltar o gatilho, sem tiro nenhum', () => {
    const { hold, mech, shots } = bench({ primary: ROTARY, secondary: null });
    expect(mech.status.spinning).toBe(false);
    hold(0.1, true);
    expect(mech.status.spinning).toBe(false); // cano ainda lento: não vale desenhar o fluxo
    hold(0.8, true);
    expect(mech.status.spinning).toBe(true);
    const tiros = shots.length;
    hold(0.1, false);
    expect(mech.status.spinning).toBe(false);
    expect(shots.length).toBe(tiros);
  });

  it('soltar o gatilho não zera: o cano vai parando (1,5 s) e voltar a apertar parte da rotação que sobrou', () => {
    const { hold, armament, between } = bench({ primary: ROTARY, secondary: null });
    hold(1.5, true);
    expect(armament.spinLevel).toBe(1);
    hold(0.5, false);
    expect(armament.spinLevel).toBeGreaterThan(0.5);
    expect(armament.spinLevel).toBeLessThan(0.8);
    hold(0.5, true);
    expect(between(2, 2.5)).toBeGreaterThanOrEqual(7); // já voltou quase à cadência cheia (o 1º 0,5 s do zero soltaria ~3)
    hold(2, false);
    expect(armament.spinLevel).toBe(0);
  });

  it('perder o braço direito para o cano: sem tiro e a rotação cai (não gira à toa)', () => {
    const { hold, mech, shots, armament } = bench({ primary: ROTARY, secondary: null });
    hold(1.5, true);
    mech.damagePart('rightArm', mech.stats.maxModuleHealth.rightArm);
    const tiros = shots.length;
    hold(1.5, true);
    expect(shots.length).toBe(tiros);
    expect(armament.spinLevel).toBeLessThan(1e-9);
    expect(mech.status.spinning).toBe(false);
  });

  it('rearm (trocar a montagem) zera a rotação e a bandeira', () => {
    const { hold, mech, armament } = bench({ primary: ROTARY, secondary: null });
    hold(1.5, true);
    expect(mech.status.spinning).toBe(true);
    armament.rearm();
    expect(armament.spinLevel).toBe(0);
    expect(mech.status.spinning).toBe(false);
  });

  it('outras armas não giram, não desviam e não ligam a bandeira', () => {
    const { hold, shots, mech, armament } = bench({ primary: weapon('plasma'), secondary: null });
    hold(2, true);
    expect(shots.length).toBeGreaterThan(5);
    expect(shots.every((s) => s.spread.x === 0 && s.spread.y === 0)).toBe(true);
    expect(armament.spinLevel).toBe(0);
    expect(mech.status.spinning).toBe(false);
  });

  it('o Marauder com uma rotatória em cada mão: as duas giram e atiram, uma meio intervalo depois da outra, no mesmo dissipador de calor', () => {
    const loadout: Loadout = { primary: ROTARY, offhand: ROTARY, secondary: null };
    const { hold, shots, mech } = bench(loadout, SHOULDER_TRIGGERS);
    hold(1.5, true);
    expect(shots.some((s) => s.mount === 'rightHand')).toBe(true);
    expect(shots.some((s) => s.mount === 'leftHand')).toBe(true);
    expect(mech.heat).toBeCloseTo(shots.length * ROTARY.heatPerShot, 5);
    // Duas mãos esquentam o dobro: ferve bem antes dos ~3 s de uma só.
    const dupla = bench(loadout, SHOULDER_TRIGGERS);
    dupla.hold(5, true);
    const solo = bench({ primary: ROTARY, secondary: null });
    solo.hold(5, true);
    expect(dupla.shots[dupla.shots.length - 1]!.t).toBeLessThan(solo.shots[solo.shots.length - 1]!.t);
  });
});
