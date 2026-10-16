import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import { armOptions, validateLoadout } from '../hangar/loadout';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { Armament, type ShotSink } from './Armament';
import { timeToKill } from './balance';
import { CruiseSystem, cruiseApex, cruisePoint, cruiseRate } from './CruiseSystem';
import { fitsMount } from './mountKinds';
import { DEFAULT_TRIGGERS, SHOULDER_TRIGGERS, type MountId, type TriggerLayout } from './mounts';
import { RocketSystem } from './RocketSystem';
import { classFor } from './weaponClass';
import { DAMAGE_TYPE, splashDamage, weapon, WEAPON_IDS, type Loadout, type Tier, type WeaponStats } from './weapons';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const V = VECTOR09_STATS;
const TORSO = V.maxModuleHealth.torso;
const LEVELS: readonly Tier[] = [0, 1, 2];
const W = weapon('cruise');
const C = W.cruise!;

describe('míssil cruzador: o que é (P152)', () => {
  it('é munição pesada e explosiva, de um tiro por carga: 90 de dano, 9 m de explosão, 120 m/s até 420 m, 6 s de recarga, 0,4 de calor, 5 t', () => {
    expect(W.kind).toBe('ammo');
    expect(DAMAGE_TYPE.cruise).toBe('explosivo');
    expect(classFor('cruise', 2)).toBe('heavy');
    expect([W.damage, W.blastRadius, W.speed, W.maxRange, W.reload, W.heatPerShot, W.mass, W.magazine]).toEqual([90, 9, 120, 420, 6, 0.4, 5, 1]);
    expect(C).toEqual({ apex: 0.14, minApex: 8, maxApex: 70 });
    for (const id of WEAPON_IDS) expect(weapon(id).cruise !== undefined, id).toBe(id === 'cruise');
  });

  it('é o maior alcance dos mísseis: mais que o foguete (225), o guiado (170) e a chuva (120); e o maior golpe e a maior explosão deles', () => {
    for (const id of ['rockets', 'seeker', 'barrage', 'swarm'] as const) expect(W.maxRange, id).toBeGreaterThan(weapon(id).maxRange);
    expect(W.blastRadius).toBeGreaterThan(weapon('rockets').blastRadius);
    expect(W.damage).toBeGreaterThan(weapon('rockets').damage);
  });

  it('os níveis sobem o dano (90, 108, 126), o calor, a recarga (6, 6,9, 7,8 s) e a carga (5, 7,5 e 10 t); o desenho do arco é o mesmo', () => {
    expect(LEVELS.map((t) => weapon('cruise', t).damage)).toEqual([90, 108, 126]);
    expect(LEVELS.map((t) => weapon('cruise', t).reload)).toEqual([6, 6.9, 7.8]);
    expect(LEVELS.map((t) => weapon('cruise', t).mass)).toEqual([5, 7.5, 10]);
    for (const t of LEVELS) expect(weapon('cruise', t).cruise).toEqual(C);
  });

  it('cabe em braço, ombro e costas; vai nos ombros do Marauder, no Ataque 2 dos pequenos e (como arma leve dele) no Colossus', () => {
    for (const kind of ['arm', 'shoulder', 'back'] as const) expect(fitsMount('cruise', kind)).toBe(true);
    expect(armOptions('shoulders', 'marauder')).toContain('cruise');
    expect(armOptions('left', 'vector09')).toContain('cruise');
    expect(armOptions('right', 'colossus01')).toContain('cruise');
    expect(armOptions('right', 'android')).not.toContain('cruise'); // pesada demais para o andróide
  });

  it('montagens: o Vector-09 leva um no braço esquerdo (5 + 3 t); o par de ombros do Marauder só aguenta o MK I (5 t x 2); o MK II (7,5 x 2) estoura a carga', () => {
    expect(validateLoadout({ v: 1, chassis: 'vector09', right: { id: 'plasma', tier: 0 }, left: { id: 'cruise', tier: 0 } })).toMatchObject({ ok: true });
    const marauder = (tier: Tier) => validateLoadout({ v: 1, chassis: 'marauder', right: { id: 'blaster', tier: 0 }, left: { id: 'blaster', tier: 0 }, shoulders: { id: 'cruise', tier } });
    expect(marauder(0)).toMatchObject({ ok: true });
    expect(marauder(1)).toMatchObject({ ok: false, error: 'carga' });
  });
});

describe('o caminho: uma parábola do lançamento ao ponto, função pura (G1/G2)', () => {
  const de = new THREE.Vector3(0, 4, 0);
  const para = new THREE.Vector3(0, 0, -300);
  const p = new THREE.Vector3();

  it('começa no lançamento, termina no ponto, e o ápice fica `apex` metros acima do meio da reta entre os dois', () => {
    expect(cruisePoint(de, para, 40, 0, p).toArray()).toEqual([0, 4, 0]);
    expect(cruisePoint(de, para, 40, 1, p).toArray()).toEqual([0, 0, -300]);
    cruisePoint(de, para, 40, 0.5, p);
    expect(p.z).toBeCloseTo(-150, 9);
    expect(p.y).toBeCloseTo(2 + 40, 9); // o meio da reta (y = 2) mais os 40 m do arco
  });

  it('é simétrico (sobe como desce) e nunca fica abaixo da reta entre os dois pontos', () => {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (const u of [0.1, 0.25, 0.4]) {
      cruisePoint(de, para, 40, u, a);
      cruisePoint(de, para, 40, 1 - u, b);
      expect(a.y - (4 + (0 - 4) * u)).toBeCloseTo(b.y - (4 + (0 - 4) * (1 - u)), 9);
      expect(a.y).toBeGreaterThan(4 + (0 - 4) * u);
    }
  });

  it('a velocidade do parâmetro (`cruiseRate`) é a tangente de verdade: bate com a diferença finita em todo o caminho', () => {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const h = 1e-6;
    for (const u of [0, 0.2, 0.5, 0.8, 1]) {
      cruisePoint(de, para, 40, u, a);
      cruisePoint(de, para, 40, u + h, b);
      expect(cruiseRate(de, para, 40, u)).toBeCloseTo(a.distanceTo(b) / h, 2);
    }
  });

  it('a altura do ápice é 14% da distância, entre o piso de 8 m e o teto de 70 m', () => {
    expect(cruiseApex(100, C.apex, C.minApex, C.maxApex)).toBeCloseTo(14, 9);
    expect(cruiseApex(300, C.apex, C.minApex, C.maxApex)).toBeCloseTo(42, 9);
    expect(cruiseApex(20, C.apex, C.minApex, C.maxApex)).toBe(8);
    expect(cruiseApex(2000, C.apex, C.minApex, C.maxApex)).toBe(70);
  });
});

describe('CruiseSystem: o voo, com física de verdade', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  const ORIGEM = new THREE.Vector3(0, 4, 0);
  const FRENTE = new THREE.Vector3(0, 0, -1);

  async function mundo() {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(1200, 2, 1200)); // o chão, com o topo em y = 0
    physics.step();
    const scene = new THREE.Scene();
    const sys = new CruiseSystem(scene, physics, NO_FX);
    const pousos: Array<{ at: THREE.Vector3; t: number; w: WeaponStats; owner: unknown }> = [];
    const disparados: WeaponStats[] = [];
    let t = 0;
    sys.onExplode = (at, _d, owner, w) => pousos.push({ at: at.clone(), t, w, owner });
    sys.onFired = (_o, _d, _ow, w) => disparados.push(w);
    const voa = (seconds: number, ate = (): boolean => false): void => {
      for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n && !ate(); i++, t += FIXED_DT) {
        sys.fixedUpdate(FIXED_DT);
        physics.step();
      }
    };
    const instancias = () => (sys as unknown as { bodyMesh: THREE.InstancedMesh; markMesh: THREE.InstancedMesh });
    return { physics, sys, pousos, disparados, voa, now: () => t, instancias, scene };
  }

  it('sobe, cruza e mergulha no ponto da mira: a 300 m explode em cima do ponto (a 1,5 m), no tempo do caminho (~315 m a 120 m/s = 2,6 s)', async () => {
    const { sys, pousos, voa } = await mundo();
    sys.fire(ORIGEM, FRENTE, new THREE.Vector3(0, 0, -300), undefined, W);
    expect(sys.active).toBe(1);
    voa(4, () => pousos.length > 0);
    expect(pousos).toHaveLength(1);
    expect(pousos[0]!.at.distanceTo(new THREE.Vector3(0, 0.3, -300))).toBeLessThan(1.5);
    expect(pousos[0]!.t).toBeGreaterThan(2.4);
    expect(pousos[0]!.t).toBeLessThan(2.9);
    expect(pousos[0]!.w.id).toBe('cruise');
    expect(sys.active).toBe(0);
  });

  it('o arco passa por cima do que é mais baixo que ele: um muro de 12 m a meio caminho (o foguete reto bate nele; o cruzador chega ao alvo)', async () => {
    const mundoA = await mundo();
    mundoA.physics.addStaticBox(new THREE.Vector3(0, 6, -150), new THREE.Vector3(80, 12, 1));
    mundoA.physics.step();
    mundoA.sys.fire(ORIGEM, FRENTE, new THREE.Vector3(0, 0, -300), undefined, W);
    mundoA.voa(4, () => mundoA.pousos.length > 0);
    expect(mundoA.pousos[0]!.at.z).toBeLessThan(-298); // chegou ao alvo, por cima do muro (o ápice ali tem ~46 m)

    // O contraste: o foguete reto, da mesma boca, para no muro.
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(1200, 2, 1200));
    physics.addStaticBox(new THREE.Vector3(0, 6, -150), new THREE.Vector3(80, 12, 1));
    physics.step();
    const rockets = new RocketSystem(new THREE.Scene(), physics, NO_FX);
    const batidas: THREE.Vector3[] = [];
    rockets.onExplode = (at) => batidas.push(at.clone());
    rockets.fire(new THREE.Vector3(0, 6, 0), FRENTE, undefined, weapon('rockets'));
    for (let t = 0; t < 4 && batidas.length === 0; t += FIXED_DT) {
      rockets.fixedUpdate(FIXED_DT);
      physics.step();
    }
    expect(batidas[0]!.z).toBeGreaterThan(-152); // o muro, a 150 m
  });

  it('bate no que for mais alto que o arco: uma torre de 90 m a meio caminho segura o míssil (explode na face dela, a ~150 m, não no alvo a 300 m)', async () => {
    const m = await mundo();
    m.physics.addStaticBox(new THREE.Vector3(0, 45, -150), new THREE.Vector3(80, 90, 2));
    m.physics.step();
    m.sys.fire(ORIGEM, FRENTE, new THREE.Vector3(0, 0, -300), undefined, W);
    m.voa(4, () => m.pousos.length > 0);
    expect(m.pousos).toHaveLength(1);
    expect(m.pousos[0]!.at.z).toBeGreaterThan(-152);
    expect(m.pousos[0]!.at.z).toBeLessThan(-148);
  });

  it('mira além do alcance: cai no limite de 420 m, na mesma direção (só no plano do chão)', async () => {
    const { sys, pousos, voa } = await mundo();
    sys.fire(ORIGEM, FRENTE, new THREE.Vector3(0, 0, -700), undefined, W);
    voa(6, () => pousos.length > 0);
    expect(pousos[0]!.at.z).toBeGreaterThan(-422);
    expect(pousos[0]!.at.z).toBeLessThan(-418);
    expect(Math.abs(pousos[0]!.at.x)).toBeLessThan(0.5);
  });

  it('mira no céu (o ponto da mira está no ar): cai no chão embaixo dele, não explode a 50 m de altura', async () => {
    const { sys, pousos, voa } = await mundo();
    sys.fire(ORIGEM, FRENTE, new THREE.Vector3(10, 50, -200), undefined, W);
    voa(5, () => pousos.length > 0);
    expect(pousos[0]!.at.y).toBeLessThan(1);
    expect(pousos[0]!.at.distanceTo(new THREE.Vector3(10, 0.3, -200))).toBeLessThan(1.6);
  });

  it('mira no telhado: o ponto de chegada é o telhado (12 m), não o chão embaixo dele', async () => {
    const { physics, sys, pousos, voa } = await mundo();
    physics.addStaticBox(new THREE.Vector3(0, 6, -120), new THREE.Vector3(30, 12, 30)); // um prédio de 12 m, de z = -135 a -105
    physics.step();
    sys.fire(ORIGEM, FRENTE, new THREE.Vector3(0, 12, -120), undefined, W);
    voa(4, () => pousos.length > 0);
    expect(pousos[0]!.at.y).toBeGreaterThan(11);
    expect(pousos[0]!.at.y).toBeLessThan(13);
  });

  it('determinístico: o mesmo disparo cai no mesmo ponto e no mesmo tick, sempre (o servidor e o cliente concordam)', async () => {
    const corre = async () => {
      const m = await mundo();
      m.sys.fire(ORIGEM, FRENTE, new THREE.Vector3(37, 0, -251), undefined, W);
      m.voa(6, () => m.pousos.length > 0);
      return { at: m.pousos[0]!.at.toArray(), t: m.pousos[0]!.t };
    };
    expect(await corre()).toEqual(await corre());
  });

  it('o aviso no chão e o corpo se desenham em lote (uma instância cada por míssil), o aviso fecha com a chegada e tudo zera com o `clear`', async () => {
    const m = await mundo();
    m.sys.fire(ORIGEM, FRENTE, new THREE.Vector3(0, 0, -200), undefined, W);
    m.sys.fire(ORIGEM, FRENTE, new THREE.Vector3(40, 0, -200), undefined, W);
    m.voa(0.5);
    m.sys.render(0.5);
    const { bodyMesh, markMesh } = m.instancias();
    expect(bodyMesh.count).toBe(2);
    expect(markMesh.count).toBe(2);
    expect(m.scene.children).toContain(bodyMesh);
    // o aviso está no ponto de chegada, e o míssil andou para a frente
    const mat = new THREE.Matrix4();
    markMesh.getMatrixAt(0, mat);
    const aviso = new THREE.Vector3().setFromMatrixPosition(mat);
    expect(aviso.x).toBeCloseTo(0, 6);
    expect(aviso.z).toBeCloseTo(-200, 6);
    bodyMesh.getMatrixAt(0, mat);
    expect(new THREE.Vector3().setFromMatrixPosition(mat).z).toBeLessThan(-40);
    m.sys.clear();
    m.sys.render(0);
    expect(m.sys.active).toBe(0);
    expect(bodyMesh.count).toBe(0);
  });

  it('o pool é de 6: o sétimo toma o lugar do que está mais adiantado, e o evento de tiro sai dos sete', async () => {
    const m = await mundo();
    for (let i = 0; i < 7; i++) {
      m.sys.fire(ORIGEM, FRENTE, new THREE.Vector3(i * 5, 0, -200), undefined, W);
      m.voa(0.1);
    }
    expect(m.sys.active).toBe(6);
    expect(m.disparados).toHaveLength(7);
  });

  it('sem `cruise` na arma, o sistema ignora o pedido (nenhum evento, nenhum míssil)', async () => {
    const m = await mundo();
    m.sys.fire(ORIGEM, FRENTE, new THREE.Vector3(0, 0, -100), undefined, weapon('rockets'));
    expect(m.sys.active).toBe(0);
    expect(m.disparados).toHaveLength(0);
  });
});

describe('Armament: um míssil por carga, 6 s de recarga, o calor de cada um', () => {
  interface Tiro {
    t: number;
    mount: MountId;
    w: WeaponStats;
  }
  function bench(loadout: Loadout, triggers: TriggerLayout = DEFAULT_TRIGGERS) {
    const mech = new Vector09({ stats: { ...VECTOR09_STATS, triggers, loadout }, loadout });
    const armament = new Armament(mech);
    const tiros: Tiro[] = [];
    let t = 0;
    const sink: ShotSink = {
      projectile: () => {},
      melee: () => {},
      flame: () => {},
      wave: () => {},
      rocket: (mount, w) => tiros.push({ t, mount, w }),
    };
    const hold = (seconds: number, secondary: boolean): void => {
      for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++, t += FIXED_DT) armament.fixedUpdate(FIXED_DT, false, secondary, sink);
    };
    return { mech, armament, tiros, hold };
  }
  const frio = (t: Tier = 0): WeaponStats => Object.freeze({ ...weapon('cruise', t), heatPerShot: 0 });

  it('um aperto solta UM míssil (não é salva), esvazia o carregador de 1 e só volta com a recarga: 6, 6,9 e 7,8 s', () => {
    for (const t of LEVELS) {
      const s = bench({ primary: weapon('blaster'), secondary: frio(t) });
      s.hold(0.1, true);
      expect(s.tiros).toHaveLength(1);
      expect(s.armament.launcher.committed).toBe(false);
      s.hold(weapon('cruise', t).reload - 0.3, true);
      expect(s.tiros).toHaveLength(1); // ainda recarregando, com o botão apertado
      s.hold(0.5, true);
      expect(s.tiros).toHaveLength(2);
      expect(s.tiros[1]!.t).toBeGreaterThanOrEqual(weapon('cruise', t).reload - 1e-6);
    }
  });

  it('o calor é 0,4 por míssil (0,52 no MK III), e os dois ombros do Marauder soltam um cada com UMA carga: 0,8', () => {
    const um = bench({ primary: weapon('blaster'), secondary: weapon('cruise') });
    um.hold(0.1, true);
    expect(um.mech.heat).toBeCloseTo(0.4, 5);
    const dois = bench({ primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('cruise') }, SHOULDER_TRIGGERS);
    dois.hold(0.1, true);
    expect(dois.tiros.map((x) => x.mount).sort()).toEqual(['leftShoulder', 'rightShoulder']);
    expect(dois.mech.heat).toBeCloseTo(0.8, 5);
    expect(dois.armament.launcher.ammo).toBe(0);
    const tres = bench({ primary: weapon('blaster'), secondary: weapon('cruise', 2) });
    tres.hold(0.1, true);
    expect(tres.mech.heat).toBeCloseTo(0.52, 5);
  });

  it('também sai da mão principal (Ataque 1), como os foguetes', () => {
    const s = bench({ primary: frio(), secondary: null });
    const sink: ShotSink = { projectile: () => {}, melee: () => {}, flame: () => {}, wave: () => {}, rocket: (mount, w) => s.tiros.push({ t: 0, mount, w }) };
    s.armament.fixedUpdate(FIXED_DT, true, false, sink);
    expect(s.tiros).toHaveLength(1);
    expect(s.tiros[0]!.mount).toBe('rightHand');
  });
});

describe('a explosão e a partida de verdade (Match + física): a regra dos 4,5 s do Comandante', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('90 no centro, metade a 4,5 m, zero a 9 m (o MK III, 126): a explosão é grande, o golpe não', () => {
    expect(splashDamage(W, 0)).toBe(90);
    expect(splashDamage(W, 4.5)).toBe(45);
    expect(splashDamage(W, 9)).toBe(0);
    expect(splashDamage(weapon('cruise', 2), 0)).toBe(126);
  });

  it('dois acertos nunca bastam para um torso (252 no MK III, como o canhão pesado); três derrubam do MK II em diante e quatro no MK I', () => {
    for (const t of LEVELS) expect(2 * weapon('cruise', t).damage, `MK ${t + 1}`).toBeLessThan(TORSO);
    expect(Math.ceil(TORSO / weapon('cruise', 0).damage)).toBe(4);
    expect(Math.ceil(TORSO / weapon('cruise', 1).damage)).toBe(3);
    expect(Math.ceil(TORSO / weapon('cruise', 2).damage)).toBe(3);
    expect(2 * weapon('cruise', 2).damage).toBe(2 * weapon('cannon', 2).damage); // o mesmo golpe do canhão pesado
  });

  it('com o plasma, nenhum nível derruba o torso em menos de 2,5 s (a bancada), e sozinho leva mais de 10 s: arma de apoio', () => {
    for (const t of LEVELS) {
      expect(timeToKill([weapon('cruise', t)], V, TORSO), `sozinho MK ${t + 1}`).toBeGreaterThan(10);
      expect(timeToKill([weapon('plasma', t), weapon('cruise', t)], V, TORSO), `com plasma MK ${t + 1}`).toBeGreaterThan(2.5);
    }
  });

  /** O cruzador contra um Vector-09 parado: lança de uma boca a 100 m, mirando `mira` (o ponto da mira), e devolve o dano que o alvo levou. */
  async function lanca(mira: THREE.Vector3, alvoEm: THREE.Vector3, w: WeaponStats = W) {
    const physics = await PhysicsWorld.create();
    const foes = { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false };
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false });
    const atirador = new Vector09();
    match.addPlayer(atirador, 'Atirador');
    atirador.respawn(new THREE.Vector3(0, 0, 55));
    const alvo = new Vector09();
    match.addPlayer(alvo, 'Alvo');
    alvo.respawn(alvoEm);
    physics.step();
    physics.step();
    const vida = (m: Vector09): number => m.modules.torso + m.modules.head + m.modules.leftArm + m.modules.rightArm + m.modules.leftLeg + m.modules.rightLeg;
    const antes = vida(alvo);
    const pousos: THREE.Vector3[] = [];
    const original = match.cruise.onExplode;
    match.cruise.onExplode = (at, dir, owner, ww) => {
      pousos.push(at.clone());
      original?.(at, dir, owner, ww);
    };
    match.cruise.fire(new THREE.Vector3(0, 4, 54.5), new THREE.Vector3(0, 0, -1), mira, atirador.collider, w);
    for (let t = 0; t < 6 && pousos.length === 0; t += FIXED_DT) {
      match.cruise.fixedUpdate(FIXED_DT);
      physics.step();
    }
    return { dano: antes - vida(alvo), pousos, alvo };
  }

  it('mirado no corpo de um Mech parado a 100 m: acerta em cheio (60 a 90 de dano) e o aviso deu 1,3 s ao alvo (a conta do voo)', async () => {
    const { dano, pousos } = await lanca(new THREE.Vector3(0, 1.5, -45), new THREE.Vector3(0, 0, -45));
    expect(pousos).toHaveLength(1);
    expect(dano).toBeGreaterThanOrEqual(60);
    expect(dano).toBeLessThanOrEqual(90);
  });

  it('a explosão cai com a distância do centro: a 6 m do ponto o alvo leva bem menos (≤ 45), e a mais de 10 m, nada', async () => {
    const meio = await lanca(new THREE.Vector3(0, 0, -45), new THREE.Vector3(6, 0, -45));
    expect(meio.dano).toBeGreaterThan(0);
    expect(meio.dano).toBeLessThanOrEqual(45);
    const longe = await lanca(new THREE.Vector3(0, 0, -45), new THREE.Vector3(14, 0, -45));
    expect(longe.dano).toBe(0);
  });

  it('o MK III bate mais (126) que o MK I (90) no mesmo ponto', async () => {
    const a = await lanca(new THREE.Vector3(0, 1.5, -45), new THREE.Vector3(0, 0, -45), weapon('cruise', 0));
    const c = await lanca(new THREE.Vector3(0, 1.5, -45), new THREE.Vector3(0, 0, -45), weapon('cruise', 2));
    expect(c.dano).toBeGreaterThan(a.dano);
  });

  it('quem atira nunca é ferido pela explosão: um míssil lançado aos pés do dono (a 3 m) não o machuca', async () => {
    const physics = await PhysicsWorld.create();
    const foes = { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false };
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false });
    const atirador = new Vector09();
    match.addPlayer(atirador, 'Atirador');
    atirador.respawn(new THREE.Vector3(0, 0, 55));
    physics.step();
    physics.step();
    const antes = atirador.modules.torso;
    const pousos: THREE.Vector3[] = [];
    const original = match.cruise.onExplode;
    match.cruise.onExplode = (at, dir, owner, w) => {
      pousos.push(at.clone());
      original?.(at, dir, owner, w);
    };
    match.cruise.fire(new THREE.Vector3(0, 4, 54.5), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 52), atirador.collider, W);
    for (let t = 0; t < 3 && pousos.length === 0; t += FIXED_DT) {
      match.cruise.fixedUpdate(FIXED_DT);
      physics.step();
    }
    expect(pousos).toHaveLength(1);
    expect(atirador.modules.torso).toBe(antes);
  });
});
