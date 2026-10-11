import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import type { HeatSink } from './heat';
import { IMPACT_FX, SHELL_TRAIL_EVERY } from '../fx/impactFx';
import { buildSlugGeometry, KINETIC, SLUG_TAIL, STEEL } from '../fx/kineticShot';
import { MUZZLE_FX } from '../fx/muzzleFx';
import type { BurstOptions } from '../fx/ParticleSystem';
import { SHAPE } from '../fx/particleShapes';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { Armament, type ShotSink } from './Armament';
import { drill, sustainedDps, timeToKill } from './balance';
import { fireKick, FIRE_KICK } from './fireFeel';
import { ProjectileSystem } from './ProjectileSystem';
import { hitDamage, rangeFactor, DAMAGE_TYPE, weapon, type Loadout, type Tier, type WeaponId, type WeaponStats } from './weapons';

const V = VECTOR09_STATS;
const TORSO = V.maxModuleHealth.torso;
const LEVELS: readonly Tier[] = [0, 1, 2];
const CANNON = weapon('cannon');
const AUTO = weapon('autocannon');

/**
 * Dono, 11/10: *"quero um canhão grande, um tiro só, e também armas de tiros menores e sequenciais de metal"* e *"sinto falta do tiro de aço, pois
 * aparentemente todas as armas são de luz"*. Duas armas de aço (`balistico`): o canhão pesado (um obus, 90 de dano, a cada 2,6 s) e o canhão
 * automático (projéteis de 10 de dano, 5 por segundo), cada um com corpo sólido de metal, clarão de pólvora e impacto de faíscas e poeira.
 */
describe('canhão pesado e canhão automático: o que são', () => {
  it('as duas são de aço (natureza balística, que os escudos físicos resistem como bala) e de energia no sentido do calor: sem carregador, só o calor segura', () => {
    expect(DAMAGE_TYPE.cannon).toBe('balistico');
    expect(DAMAGE_TYPE.autocannon).toBe('balistico');
    for (const w of [CANNON, AUTO]) {
      expect(w.kind).toBe('energy');
      expect(w.magazine).toBe(0);
      expect(w.spin).toBeUndefined();
      expect(w.flame).toBeUndefined();
      expect(w.chargeTime).toBeUndefined();
    }
  });

  it('o desenho é de metal: o canhão pesado voa como obus (shell) e o automático como projétil fino (slug), e nenhuma outra arma usa esses desenhos', () => {
    expect(CANNON.tracer).toBe('shell');
    expect(AUTO.tracer).toBe('slug');
    for (const id of ['plasma', 'blaster', 'shotgun', 'railgun', 'emp', 'arc', 'cryo', 'rotary'] as const) expect(['shell', 'slug']).not.toContain(weapon(id).tracer);
  });

  it('o canhão pesado é o tiro grande: o maior dano por tiro, o mais lento e o mais pesado dos projéteis diretos; o automático, o contrário em tudo', () => {
    for (const id of ['plasma', 'blaster', 'shotgun', 'railgun', 'emp', 'arc', 'cryo', 'rotary', 'autocannon'] as const) {
      expect(CANNON.damage, id).toBeGreaterThan(weapon(id).damage);
      expect(CANNON.fireInterval, id).toBeGreaterThan(weapon(id).fireInterval);
    }
    expect(CANNON.speed).toBeLessThan(weapon('railgun').speed);
    expect(CANNON.speed).toBeLessThan(AUTO.speed);
    expect(CANNON.mass).toBeGreaterThan(weapon('railgun').mass);
    expect(AUTO.fireInterval).toBeLessThan(CANNON.fireInterval / 5);
    expect(AUTO.damage).toBeLessThan(CANNON.damage / 5);
  });

  it('o automático é "sequencial e de metal", não uma rotatória: cadência fixa de 5 tiros/s, sem rotação e sem espalhamento; bate mais por tiro que a rotatória', () => {
    expect(1 / AUTO.fireInterval).toBeCloseTo(5, 5);
    expect(AUTO.damage).toBeGreaterThan(weapon('rotary').damage);
    expect(AUTO.fireInterval).toBeGreaterThan(weapon('rotary').fireInterval);
    expect(AUTO.speed).toBeGreaterThan(weapon('plasma').speed);
  });

  it('nos três níveis o dano sobe e o resto (cadência, alcance, velocidade) é da arma', () => {
    for (const id of ['cannon', 'autocannon'] as const) {
      const [a, b, c] = LEVELS.map((t) => weapon(id, t));
      expect(b!.damage).toBeGreaterThan(a!.damage);
      expect(c!.damage).toBeGreaterThan(b!.damage);
      expect(c!.fireInterval).toBe(a!.fireInterval);
      expect(c!.speed).toBe(a!.speed);
      expect(c!.maxRange).toBe(a!.maxRange);
    }
    expect(LEVELS.map((t) => weapon('cannon', t).damage)).toEqual([90, 108, 126]);
    expect(LEVELS.map((t) => weapon('autocannon', t).damage)).toEqual([10, 12, 14]);
    expect(LEVELS.map((t) => weapon('cannon', t).mass)).toEqual([6, 9, 12]);
    expect(LEVELS.map((t) => weapon('autocannon', t).mass)).toEqual([3.5, 5.25, 7]);
  });

  it('a queda com a distância é a de um tiro direto: cheio no alcance ótimo, cai em linha reta e some no máximo', () => {
    expect(hitDamage(CANNON, 90)).toBe(90);
    expect(hitDamage(CANNON, 260)).toBe(54);
    expect(rangeFactor(CANNON, 175)).toBeCloseTo(0.8, 5);
    expect(hitDamage(AUTO, 50)).toBe(10);
    expect(hitDamage(AUTO, 140)).toBe(Math.round(10 * 0.45));
  });
});

describe('equilíbrio: sem apelação (Vector-09, torso de 300, todos os tiros no alvo)', () => {
  it('nenhuma das duas, em nenhum nível, derruba um torso sozinha em menos de 4,5 s (a meta de todas as armas)', () => {
    for (const id of ['cannon', 'autocannon'] as const) for (const t of LEVELS) expect(timeToKill([weapon(id, t)], V, TORSO), `${id} MK ${t + 1}`).toBeGreaterThan(4.5);
  });

  it('o canhão pesado: quatro acertos derrubam um torso no MK I e três no MK II e no MK III; dois tiros nunca bastam, nem no MK III', () => {
    const acertos = LEVELS.map((t) => Math.ceil(TORSO / weapon('cannon', t).damage));
    expect(acertos).toEqual([4, 3, 3]);
    for (const t of LEVELS) expect(weapon('cannon', t).damage * 2, `MK ${t + 1}`).toBeLessThan(TORSO);
  });

  it('subir do MK I ao MK II tira um acerto do canhão pesado: o nível se sente (de 7,8 s para 5,2 s sozinho), sem passar de 5,2 s no MK III', () => {
    expect(timeToKill([weapon('cannon', 0)], V, TORSO)).toBeCloseTo(7.8, 0);
    expect(timeToKill([weapon('cannon', 1)], V, TORSO)).toBeCloseTo(5.2, 0);
    expect(timeToKill([weapon('cannon', 2)], V, TORSO)).toBeCloseTo(5.2, 0);
  });

  it('com outra arma, nenhum combo derruba em menos de 2,5 s: o calor do Mech segura', () => {
    for (const a of LEVELS) {
      for (const b of LEVELS) {
        expect(timeToKill([weapon('cannon', a), weapon('plasma', b)], V, TORSO), `canhão ${a} + plasma ${b}`).toBeGreaterThan(2.5);
        expect(timeToKill([weapon('autocannon', a), weapon('plasma', b)], V, TORSO), `automático ${a} + plasma ${b}`).toBeGreaterThan(2.5);
        expect(timeToKill([weapon('cannon', a), weapon('autocannon', b)], V, TORSO), `canhão ${a} + automático ${b}`).toBeGreaterThan(2.5);
        expect(timeToKill([weapon('cannon', a), weapon('rockets', b)], V, TORSO), `canhão ${a} + foguetes ${b}`).toBeGreaterThan(2.5);
        expect(timeToKill([weapon('cannon', a), weapon('cannon', b)], V, TORSO), `canhão ${a} + canhão ${b}`).toBeGreaterThan(2.5);
        expect(timeToKill([weapon('autocannon', a), weapon('autocannon', b)], V, TORSO), `automático ${a} + automático ${b}`).toBeGreaterThan(2.5);
      }
    }
  });

  it('subir de nível custa carga: o dano por tonelada cai do MK I ao MK III', () => {
    for (const id of ['cannon', 'autocannon'] as const) {
      const porTon = LEVELS.map((t) => sustainedDps(weapon(id, t), V) / weapon(id, t).mass);
      expect(porTon[1], id).toBeLessThan(porTon[0]!);
      expect(porTon[2], id).toBeLessThan(porTon[1]!);
    }
  });

  it('o automático esquenta menos que o plasma por segundo: sustenta a rajada por mais tempo (esse é o jeito de ele valer o peso)', () => {
    const calorPorSegundo = (w: WeaponStats) => w.heatPerShot / w.fireInterval;
    expect(calorPorSegundo(AUTO)).toBeLessThan(calorPorSegundo(weapon('plasma')) * 0.75);
    expect(AUTO.heatPerShot).toBeLessThan(weapon('plasma').heatPerShot);
  });

  it('dois automáticos juntos (Marauder) levam mais de 3,5 s para derrubar um torso, como dois plasmas: o calor do Mech segura', () => {
    for (const a of LEVELS) for (const b of LEVELS) expect(timeToKill([weapon('autocannon', a), weapon('autocannon', b)], V, TORSO), `${a}+${b}`).toBeGreaterThan(3.5);
  });

  it('o canhão pesado esquenta muito por tiro (60% do dissipador), mas um Mech parado ou correndo esfria entre os tiros e nunca trava só com ele, em nenhum nível', () => {
    expect(CANNON.heatPerShot).toBeGreaterThanOrEqual(0.5);
    for (const t of LEVELS) {
      for (const speed of [0, 1]) {
        const r = drill(V, { speed, fire: [weapon('cannon', t)] }, 30);
        expect(r.lockedShare, `MK ${t + 1} a ${speed}`).toBe(0);
        expect(r.overheatAt).toBeNull();
      }
    }
  });
});

describe('o peso do tiro na câmera', () => {
  it('o canhão pesado dá o maior solavanco do arsenal (e o MK III chega perto do teto de 0,6); o automático, uma trepidação leve', () => {
    for (const id of ['plasma', 'blaster', 'shotgun', 'railgun', 'emp', 'arc', 'cryo', 'rockets', 'barrage'] as const) expect(FIRE_KICK.cannon, id).toBeGreaterThan(FIRE_KICK[id]);
    expect(fireKick(weapon('cannon', 2))).toBeLessThanOrEqual(0.6);
    expect(fireKick(weapon('cannon', 2))).toBeGreaterThan(0.55);
    expect(FIRE_KICK.autocannon).toBeLessThan(FIRE_KICK.plasma);
    expect(FIRE_KICK.autocannon).toBeGreaterThan(0);
  });
});

interface Tiro {
  t: number;
  mount: string;
  w: WeaponStats;
  spread: { x: number; y: number };
}

/** Um Mech de verdade (corpo procedural, sem física) com o gatilho ligado e um sink que anota cada tiro e o desvio dele. */
function bench(loadout: Loadout) {
  const stats = { ...VECTOR09_STATS, loadout };
  const mech = new Vector09({ stats, loadout });
  const armament = new Armament(mech);
  const shots: Tiro[] = [];
  let t = 0;
  const sink: ShotSink = {
    projectile: (mount, w, spread) => shots.push({ t, mount, w, spread: { x: spread.x, y: spread.y } }),
    rocket: () => {},
    melee: () => {},
    flame: () => {},
    wave: () => {},
  };
  /** O dissipador do Mech (privado): o jogo o roda a cada tick, antes do tiro; sem ele o calor só sobe. */
  const heatSink = (mech as unknown as { heatSink: HeatSink }).heatSink;
  const hold = (seconds: number, fire: boolean, secondary = false): void => {
    for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++, t += FIXED_DT) {
      heatSink.fixedUpdate(FIXED_DT, 0);
      armament.fixedUpdate(FIXED_DT, fire, secondary, sink);
    }
  };
  return { mech, armament, shots, hold };
}

describe('a regra de tiro (Armament, a mesma do jogador e do servidor)', () => {
  it('canhão pesado: segurando o gatilho sai um tiro a cada 2,6 s, sempre reto (sem espalhamento)', () => {
    const b = bench({ primary: CANNON, secondary: weapon('rockets') });
    b.hold(8, true);
    expect(b.shots).toHaveLength(4); // 0, 2,6, 5,2 e 7,8 s
    for (let i = 1; i < b.shots.length; i++) expect(b.shots[i]!.t - b.shots[i - 1]!.t).toBeGreaterThan(2.55);
    for (const s of b.shots) expect(s.spread).toEqual({ x: 0, y: 0 });
    expect(b.shots.every((s) => s.w.id === 'cannon' && s.mount === 'rightHand')).toBe(true);
  });

  it('canhão automático: 5 tiros por segundo, em sequência firme e sem desvio, e para quando o gatilho solta', () => {
    const b = bench({ primary: AUTO, secondary: weapon('rockets') });
    b.hold(1, true);
    expect(b.shots.length).toBeGreaterThanOrEqual(5);
    expect(b.shots.length).toBeLessThanOrEqual(6);
    for (let i = 1; i < b.shots.length; i++) expect(b.shots[i]!.t - b.shots[i - 1]!.t).toBeCloseTo(AUTO.fireInterval, 1);
    for (const s of b.shots) expect(s.spread).toEqual({ x: 0, y: 0 });
    const n = b.shots.length;
    b.hold(1, false);
    expect(b.shots).toHaveLength(n);
  });

  it('o canhão pesado no braço esquerdo atira no botão 2, como qualquer arma de energia', () => {
    const b = bench({ primary: weapon('plasma'), secondary: CANNON });
    b.hold(0.5, false, true);
    expect(b.shots.filter((s) => s.w.id === 'cannon')).toHaveLength(1);
    expect(b.shots.find((s) => s.w.id === 'cannon')!.mount).toBe('leftHand');
  });

  it('cada tiro aquece o Mech pelo calor da arma: 0,6 o do canhão pesado e 0,04 o do automático', () => {
    const pesado = bench({ primary: CANNON, secondary: null });
    pesado.hold(0.02, true);
    expect(pesado.shots).toHaveLength(1);
    expect(pesado.mech.heat).toBeCloseTo(CANNON.heatPerShot, 2);
    const auto = bench({ primary: AUTO, secondary: null });
    auto.hold(0.02, true);
    expect(auto.shots).toHaveLength(1);
    expect(auto.mech.heat).toBeCloseTo(AUTO.heatPerShot, 2);
  });
});

/** O `ProjectileSystem` com a física e as partículas trocadas por espiões, para ver o que o tiro de metal desenha. */
function palco(acerta = false) {
  const rajadas: Array<{ at: THREE.Vector3; normal: THREE.Vector3; o: BurstOptions }> = [];
  const particles = { burst: (at: THREE.Vector3, normal: THREE.Vector3, o: BurstOptions) => rajadas.push({ at: at.clone(), normal: normal.clone(), o }) };
  let primeiro = true;
  const fisica = {
    raycast: (origem: THREE.Vector3, _d: THREE.Vector3, dist: number) =>
      acerta && primeiro && ((primeiro = false), true)
        ? { point: origem.clone(), normal: new THREE.Vector3(0, 1, 0), distance: Math.min(dist, 0.5), collider: {} }
        : null,
  };
  const scene = new THREE.Scene();
  const system = new ProjectileSystem(scene, fisica as never, particles as never, 2);
  system.onHit = () => {};
  const meshes = scene.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
  /** O corpo de aço do primeiro projétil do pool: o único mesh com a geometria da bala. */
  const corpo = (): THREE.Mesh => meshes.find((m) => m.geometry.getAttribute('position').count === buildSlugGeometry().getAttribute('position').count && (m.material as THREE.MeshBasicMaterial).vertexColors !== true)!;
  const cauda = (): THREE.Mesh => meshes.find((m) => (m.material as THREE.MeshBasicMaterial).vertexColors === true && m.visible)!;
  return { system, scene, rajadas, corpo, cauda, meshes };
}
const atira = (system: ProjectileSystem, id: WeaponId, hostile = false, dir = new THREE.Vector3(0, 0, -1)) =>
  system.fire(new THREE.Vector3(), dir, undefined, hostile, weapon(id));

describe('o tiro de metal tem corpo sólido de aço e cauda quente (e o de luz continua só de luz)', () => {
  it('o obus do canhão pesado aparece com o corpo de aço do tamanho dele e a cauda quente; o projétil do automático, menor', () => {
    const a = palco();
    atira(a.system, 'cannon');
    const obus = a.corpo();
    expect(obus.visible).toBe(true);
    expect(obus.scale.x).toBeCloseTo(KINETIC.shell.radius, 5);
    expect(obus.scale.z).toBeCloseTo(KINETIC.shell.length, 5);
    expect(a.cauda().scale.x).toBeCloseTo(KINETIC.shell.tailWidth, 5);

    const b = palco();
    atira(b.system, 'autocannon');
    const bala = b.corpo();
    expect(bala.visible).toBe(true);
    expect(bala.scale.x).toBeCloseTo(KINETIC.slug.radius, 5);
    expect(bala.scale.z).toBeLessThan(obus.scale.z);
    expect(bala.scale.x).toBeLessThan(obus.scale.x);
    expect(b.cauda().scale.x).toBeLessThan(a.cauda().scale.x);
  });

  it('o corpo é de aço (cor sem luz, abaixo de 1: não acende o bloom) e o do inimigo é avermelhado; a cauda é o brilho quente (acima de 1)', () => {
    const amigo = palco();
    atira(amigo.system, 'cannon', false);
    const aco = (amigo.corpo().material as THREE.MeshBasicMaterial).color;
    expect(Math.max(aco.r, aco.g, aco.b)).toBeLessThan(1);
    expect(aco.equals(STEEL.friendly)).toBe(true);
    expect(aco.b).toBeGreaterThan(aco.r); // aço frio

    const inimigo = palco();
    atira(inimigo.system, 'cannon', true);
    const ferro = (inimigo.corpo().material as THREE.MeshBasicMaterial).color;
    expect(ferro.equals(STEEL.hostile)).toBe(true);
    expect(ferro.r).toBeGreaterThan(ferro.b); // aço avermelhado

    const cauda = (amigo.cauda().material as THREE.MeshBasicMaterial).color;
    expect(cauda.equals(SLUG_TAIL.friendly)).toBe(true);
    expect(Math.max(cauda.r, cauda.g, cauda.b)).toBeGreaterThan(1);
    expect(cauda.r).toBeGreaterThan(cauda.b); // quente, nunca o verde do plasma
  });

  it('o corpo aponta para onde o tiro vai (a ponta em +Z do desenho) e acompanha a cabeça da cauda a cada quadro', () => {
    const { system, corpo, cauda } = palco();
    const dir = new THREE.Vector3(0.4, 0.2, -1).normalize();
    atira(system, 'cannon', false, dir);
    for (let i = 0; i < 5; i++) { system.fixedUpdate(1 / 60); system.render(1); }
    const body = corpo();
    body.updateMatrixWorld(true);
    const nariz = new THREE.Vector3(0, 0, 1).applyQuaternion(body.quaternion);
    expect(nariz.dot(dir)).toBeGreaterThan(0.9999);
    expect(body.position.distanceTo(cauda().position)).toBeLessThan(1e-6);
    expect(body.position.z).toBeLessThan(-3); // andou
  });

  it('a geometria da bala tem o nariz em +Z e a base em -Z, com raio 1 e comprimento 1 (o Mesh escala)', () => {
    const g = buildSlugGeometry();
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.max.z).toBeCloseTo(0.5, 5);
    expect(box.min.z).toBeCloseTo(-0.5, 5);
    expect(box.max.x).toBeCloseTo(1, 5);
    expect(box.max.y).toBeCloseTo(1, 5);
    // O raio na ponta é menor que na base: é uma bala, não um cilindro.
    let raioNaPonta = 0;
    let raioNaBase = 0;
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      if (pos.getZ(i) > 0.45) raioNaPonta = Math.max(raioNaPonta, r);
      if (pos.getZ(i) < -0.45) raioNaBase = Math.max(raioNaBase, r);
    }
    expect(raioNaPonta).toBeLessThan(raioNaBase);
  });

  it('o tiro de luz (plasma, gelo, elétrica) não ganha corpo de aço: o corpo fica escondido', () => {
    for (const id of ['plasma', 'blaster', 'cryo', 'arc', 'railgun', 'shotgun', 'emp'] as const) {
      const { system, corpo } = palco();
      atira(system, id);
      expect(corpo().visible, id).toBe(false);
    }
  });

  it('o corpo some quando o tiro bate, quando morre de alcance e quando a rodada reinicia', () => {
    const bate = palco(true);
    atira(bate.system, 'cannon');
    bate.system.fixedUpdate(1 / 60);
    expect(bate.corpo().visible).toBe(false);

    const alcance = palco();
    atira(alcance.system, 'autocannon');
    for (let i = 0; i < 60; i++) alcance.system.fixedUpdate(1 / 60); // 1 s a 190 m/s passa dos 140 m
    expect(alcance.corpo().visible).toBe(false);

    const limpa = palco();
    atira(limpa.system, 'cannon');
    expect(limpa.corpo().visible).toBe(true);
    limpa.system.clear();
    expect(limpa.corpo().visible).toBe(false);
  });

  it('o primeiro tiro de luz depois de um de metal esconde o corpo (o projétil do pool é reaproveitado)', () => {
    const { system, corpo } = palco();
    atira(system, 'cannon');
    for (let i = 0; i < 200; i++) system.fixedUpdate(1 / 60); // some por alcance
    atira(system, 'plasma');
    expect(corpo().visible).toBe(false);
  });
});

describe('o clarão da boca do tiro de metal', () => {
  it('o canhão pesado solta a língua de fogo, o clarão, a fumaça do cano e uma onda; nenhum estojo', () => {
    const { system, rajadas } = palco();
    atira(system, 'cannon');
    expect(rajadas.map((r) => r.o)).toEqual(MUZZLE_FX.cannon!.flash);
    expect(MUZZLE_FX.cannon!.casing).toBeUndefined();
    const formas = new Set(rajadas.map((r) => r.o.shape ?? SHAPE.glow));
    expect([...formas].sort()).toEqual([SHAPE.glow, SHAPE.streak, SHAPE.ring, SHAPE.puff].sort());
  });

  it('o automático solta um clarão curto e um estojo de metal que salta para o lado e para cima do cano, a cada tiro', () => {
    const { system, rajadas } = palco();
    atira(system, 'autocannon');
    const estojo = rajadas.find((r) => r.o.shape === SHAPE.casing)!;
    expect(estojo).toBeDefined();
    expect(estojo.o.gravity).toBeGreaterThan(0); // cai
    expect(estojo.o.spin).toBeGreaterThan(0); // gira
    expect(estojo.normal.y).toBeGreaterThan(0); // salta para cima
    expect(Math.abs(estojo.normal.x)).toBeGreaterThan(0.5); // e para o lado (o tiro vai em -Z)
    expect(Math.abs(estojo.normal.z)).toBeLessThan(1e-6); // nunca para a frente nem para trás
    expect(rajadas.filter((r) => r.o.shape !== SHAPE.casing).map((r) => r.o)).toEqual(MUZZLE_FX.autocannon!.flash);
    system.clear();
  });

  it('atirando reto para cima ou para baixo o estojo ainda tem direção (sem vetor nulo)', () => {
    for (const y of [1, -1]) {
      const { system, rajadas } = palco();
      atira(system, 'autocannon', false, new THREE.Vector3(0, y, 0));
      const estojo = rajadas.find((r) => r.o.shape === SHAPE.casing)!;
      expect(Number.isFinite(estojo.normal.length())).toBe(true);
      expect(estojo.normal.length()).toBeGreaterThan(0.5);
    }
  });

  it('as armas de luz não ganham o clarão de metal: o ProjectileSystem não solta nada na boca delas', () => {
    for (const id of ['plasma', 'blaster', 'cryo', 'arc', 'emp', 'railgun', 'shotgun'] as const) {
      const { system, rajadas } = palco();
      atira(system, id);
      expect(rajadas, id).toHaveLength(0);
      expect(MUZZLE_FX[id], id).toBeNull();
    }
  });

  it('o custo é pequeno e conhecido: 16 partículas por tiro do canhão pesado (1 a cada 2,6 s) e 6 por tiro do automático (30 por segundo)', () => {
    const conta = (id: 'cannon' | 'autocannon') => {
      const fx = MUZZLE_FX[id]!;
      return fx.flash.reduce((a, o) => a + o.count, 0) + (fx.casing?.count ?? 0);
    };
    expect(conta('cannon')).toBe(16);
    expect(conta('autocannon')).toBe(6);
    expect(conta('autocannon') / AUTO.fireInterval).toBeLessThanOrEqual(30);
  });

  it('o brilho não volta: nenhuma cor do clarão passa de 3 (o dono achava que os tiros ofuscavam)', () => {
    for (const id of ['cannon', 'autocannon'] as const) {
      const fx = MUZZLE_FX[id]!;
      for (const o of [...fx.flash, ...(fx.casing ? [fx.casing] : [])]) expect(Math.max(o.color.r, o.color.g, o.color.b), id).toBeLessThanOrEqual(3);
    }
  });
});

describe('o rastro e o impacto do tiro de metal', () => {
  it('o obus deixa um fiapo de fumaça cinza a cada 3 m do caminho; o projétil do automático e os tiros de luz não deixam nenhum', () => {
    const obus = palco();
    atira(obus.system, 'cannon');
    obus.rajadas.length = 0; // descarta o clarão da boca
    for (let i = 0; i < 60; i++) obus.system.fixedUpdate(1 / 60); // 1 s a 150 m/s
    const fumaca = obus.rajadas.filter((r) => r.o.shape === SHAPE.puff);
    expect(fumaca.length).toBe(Math.floor(150 / SHELL_TRAIL_EVERY));
    expect(obus.rajadas).toHaveLength(fumaca.length);
    for (const f of fumaca) expect(f.o.color.r).toBeLessThan(0.5); // cinza
    for (const id of ['autocannon', 'plasma', 'railgun'] as const) {
      const p = palco();
      atira(p.system, id);
      p.rajadas.length = 0;
      for (let i = 0; i < 30; i++) p.system.fixedUpdate(1 / 60);
      expect(p.rajadas, id).toHaveLength(0);
    }
  });

  it('cada um bate com o impacto da família dele: o canhão pesado, o maior; o automático, uma pancada seca', () => {
    for (const id of ['cannon', 'autocannon'] as const) {
      const { system, rajadas } = palco(true);
      atira(system, id);
      rajadas.length = 0;
      system.fixedUpdate(1 / 60);
      expect(rajadas.map((r) => r.o), id).toEqual(IMPACT_FX[id]);
    }
    const total = (id: WeaponId) => IMPACT_FX[id].reduce((a, o) => a + o.count, 0);
    expect(total('cannon')).toBeGreaterThan(total('autocannon'));
    expect(total('cannon')).toBeGreaterThan(total('railgun'));
    expect(total('cannon')).toBeLessThanOrEqual(24);
    expect(total('autocannon')).toBeLessThanOrEqual(20);
    expect(total('autocannon')).toBeLessThan(total('rotary'));
  });

  it('o impacto é de metal: faíscas de aço alaranjadas (o vermelho manda), brasas, poeira cinza e, no canhão, a onda de choque e o clarão', () => {
    for (const id of ['cannon', 'autocannon'] as const) {
      const formas = new Set(IMPACT_FX[id].map((o) => o.shape ?? SHAPE.glow));
      expect(formas.has(SHAPE.streak), id).toBe(true);
      expect(formas.has(SHAPE.dot), id).toBe(true);
      expect(formas.has(SHAPE.puff), id).toBe(true);
      for (const o of IMPACT_FX[id].filter((x) => x.shape === SHAPE.streak)) {
        expect(o.color.r, id).toBeGreaterThan(o.color.g);
        expect(o.color.g, id).toBeGreaterThan(o.color.b);
      }
    }
    const canhao = new Set(IMPACT_FX.cannon.map((o) => o.shape ?? SHAPE.glow));
    expect(canhao.has(SHAPE.ring)).toBe(true);
    expect(canhao.has(SHAPE.glow)).toBe(true);
    for (const id of ['cannon', 'autocannon'] as const) for (const o of IMPACT_FX[id]) expect(Math.max(o.color.r, o.color.g, o.color.b), id).toBeLessThanOrEqual(3);
  });
});
