import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { Armament, type ShotSink } from './Armament';
import { drill, timeToKill } from './balance';
import { FuelTank } from './trigger';
import { SHOULDER_TRIGGERS } from './mounts';
import { DAMAGE_TYPE, hitDamage, weapon, WEAPON_IDS, type WeaponStats } from './weapons';
import { STATUS } from './StatusEffects';

const V = VECTOR09_STATS;
const TORSO = V.maxModuleHealth.torso;
const FLAMER = weapon('flamer');
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;

describe('lança-chamas: números e equilíbrio', () => {
  it('é de energia, sem projétil, aplica queimando e tem natureza térmica; pesa 3,5 / 5,25 / 7 t e bate 10 / 12 / 14 por pulso', () => {
    expect(FLAMER.kind).toBe('energy');
    expect(FLAMER.speed).toBe(0); // não solta projétil: o dano é do cone
    expect(FLAMER.inflicts).toBe('burn');
    expect(DAMAGE_TYPE.flamer).toBe('termico');
    expect(FLAMER.fireInterval).toBe(0.2);
    expect(([0, 1, 2] as const).map((t) => weapon('flamer', t).mass)).toEqual([3.5, 5.25, 7]);
    expect(([0, 1, 2] as const).map((t) => weapon('flamer', t).damage)).toEqual([10, 12, 14]);
  });

  it('o cone e o tanque são os do pedido (dono, 11/10: "muito fraco e curto", e depois "bem mais longe"): 30 m no MK I, 34° de abertura, 6 s de combustível e 4 s de recarga (o tanque e o cone não mudam com o nível)', () => {
    expect(FLAMER.maxRange).toBe(30);
    expect((FLAMER.flame!.halfAngle * 2 * 180) / Math.PI).toBeCloseTo(34, 0);
    expect(FLAMER.flame!.fuel).toBe(6);
    expect(FLAMER.flame!.reload).toBe(4);
    for (const t of [1, 2] as const) expect(weapon('flamer', t).flame).toEqual(FLAMER.flame);
  });

  it('dá 50 de dano por segundo até 14 m (10 por pulso a 5 pulsos/s) e cai à metade no alcance máximo de 30 m', () => {
    expect(FLAMER.damage / FLAMER.fireInterval).toBe(50);
    expect(FLAMER.optimalRange).toBe(14);
    expect(hitDamage(FLAMER, 3)).toBe(10);
    expect(hitDamage(FLAMER, FLAMER.optimalRange)).toBe(10);
    expect(hitDamage(FLAMER, FLAMER.maxRange)).toBe(Math.round(10 * FLAMER.minFactor));
    expect(hitDamage(FLAMER, 22)).toBeLessThan(10);
    expect(hitDamage(FLAMER, 22)).toBeGreaterThan(5);
  });

  /**
   * Dono, 11/10: "o lança-chamas continua muito fraco, muito curto o alcance, deveria ir bem mais longe e ainda poder ser upado no MK II e ir mais longe e
   * com mais pressão". O nível sobe o alcance (+30% por nível) e a cadência (+15% por nível), além do dano (+20% por nível).
   */
  it('o nível dá mais alcance e mais pressão: 30 / 39 / 48 m, 5 / 5,75 / 6,5 pulsos por segundo e 10 / 12 / 14 de dano por pulso', () => {
    const [a, b, c] = ([0, 1, 2] as const).map((t) => weapon('flamer', t));
    expect([a!.maxRange, b!.maxRange, c!.maxRange]).toEqual([30, 39, 48]);
    expect([a!.optimalRange, b!.optimalRange, c!.optimalRange]).toEqual([14, 18, 22.5]);
    const porSegundo = [a!, b!, c!].map((w) => 1 / w.fireInterval);
    expect(porSegundo[0]).toBeCloseTo(5, 5);
    expect(porSegundo[1]).toBeCloseTo(5.75, 1);
    expect(porSegundo[2]).toBeCloseTo(6.5, 1);
    expect([a!.damage, b!.damage, c!.damage]).toEqual([10, 12, 14]);
    // Pressão por segundo (dano x pulsos): +38% no MK II e +82% no MK III.
    const dps = [a!, b!, c!].map((w) => w.damage / w.fireInterval);
    expect(dps[2]! / dps[0]!).toBeGreaterThan(1.75);
    // O tanque, o cone e o resto não mudam: o calor por segundo é que sobe junto (mais pulsos, e cada um esquenta mais).
    expect(b!.flame).toEqual(a!.flame);
    expect(c!.flame).toEqual(a!.flame);
    const calor = [a!, b!, c!].map((w) => w.heatPerShot / w.fireInterval);
    expect(calor[2]!).toBeGreaterThan(calor[0]! * 1.6);
  });

  it('só quem declara tierRange/tierRate muda de alcance e de cadência com o nível (o lança-chamas e o canhão sônico, o alcance): as outras armas mantêm os do MK I', () => {
    for (const id of WEAPON_IDS) {
      if (id === 'flamer' || id === 'sonic') continue;
      const a = weapon(id, 0);
      for (const t of [1, 2] as const) {
        expect(weapon(id, t).maxRange, id).toBe(a.maxRange);
        expect(weapon(id, t).optimalRange, id).toBe(a.optimalRange);
        expect(weapon(id, t).fireInterval, id).toBe(a.fireInterval);
      }
    }
  });

  it('o fogo ficou mais forte, mais longo e mais grosso que o primeiro desenho (6 de dano, 14 m, 25°): +67% de dano, +43% de alcance, cone 36% mais aberto', () => {
    expect(FLAMER.damage).toBeGreaterThanOrEqual(6 * 1.5);
    expect(FLAMER.maxRange).toBeGreaterThanOrEqual(14 * 1.4);
    expect(FLAMER.flame!.halfAngle).toBeGreaterThan(0.218 * 1.3);
    expect(STATUS.burnDps).toBeGreaterThanOrEqual(6); // queimar também dói mais (eram 4 por segundo)
  });

  it('em um alvo só é arma de peso médio: sozinha, em nenhum nível derruba um torso em menos de 4,5 s (a meta de todas) nem em mais de 8 s; o valor extra dela é o cone, e o nível a faz derrubar mais rápido (7,5 / 6,0 / 5,0 s)', () => {
    const tempos = ([0, 1, 2] as const).map((t) => timeToKill([weapon('flamer', t)], V, TORSO));
    expect(tempos[1]!).toBeLessThan(tempos[0]!);
    expect(tempos[2]!).toBeLessThan(tempos[1]!);
    for (const t of [0, 1, 2] as const) {
      const tempo = timeToKill([weapon('flamer', t)], V, TORSO);
      expect(tempo, `MK ${t + 1}`).toBeGreaterThan(4.5);
      expect(tempo, `MK ${t + 1}`).toBeLessThan(8);
    }
    // Era arma lenta (13,3 s no MK I, o dobro do plasma): agora fica perto do plasma (5,7 s), com a vantagem de acertar todos no cone.
    expect(timeToKill([FLAMER], V, TORSO)).toBeLessThan(timeToKill([weapon('plasma')], V, TORSO) * 1.5);
    expect(timeToKill([FLAMER], V, TORSO)).toBeGreaterThan(timeToKill([weapon('plasma')], V, TORSO));
  });

  it('dois lança-chamas juntos (Marauder) levam mais de 3,3 s, e com o canhão pesado ou os foguetes MK III, mais de 2,5 s: o calor do Mech segura', () => {
    for (const a of [0, 1, 2] as const) {
      for (const b of [0, 1, 2] as const) {
        expect(timeToKill([weapon('flamer', a), weapon('flamer', b)], V, TORSO), `${a}+${b}`).toBeGreaterThan(3.3);
        expect(timeToKill([weapon('flamer', a), weapon('cannon', b)], V, TORSO), `canhão ${a}+${b}`).toBeGreaterThan(2.5);
        expect(timeToKill([weapon('flamer', a), weapon('rockets', b)], V, TORSO), `foguetes ${a}+${b}`).toBeGreaterThan(2.5);
      }
    }
  });

  it('esquenta quem atira: parado, com a chama contínua, o Mech ferve entre 4 e 6 s (antes de o tanque de 6 s acabar)', () => {
    const r = drill(V, { speed: 0, fire: [FLAMER] }, 30, Infinity);
    expect(r.overheatAt).not.toBeNull();
    expect(r.overheatAt!).toBeGreaterThan(4);
    expect(r.overheatAt!).toBeLessThan(6);
  });

  it('com a outra mão, nenhum combo derruba em menos de 2,5 s', () => {
    for (const a of [0, 1, 2] as const) for (const r of [0, 1, 2] as const) {
      expect(timeToKill([weapon('flamer', a), weapon('plasma', r)], V, TORSO)).toBeGreaterThan(2.5);
    }
  });
});

describe('tanque de combustível', () => {
  /** Segura o gatilho por `seconds` e conta quantos ticks a chama acendeu. */
  const queimar = (tank: FuelTank, seconds: number, held = true): number => {
    let lit = 0;
    for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++) if (tank.step(FIXED_DT, held)) lit++;
    return lit * FIXED_DT;
  };

  it('queima 6 s e seca: depois disso a chama não acende, mesmo com o gatilho apertado', () => {
    const t = new FuelTank(6, 4);
    expect(queimar(t, 6.5)).toBeCloseTo(6, 1);
    expect(t.locked).toBe(true);
    expect(queimar(t, 3)).toBe(0);
  });

  it('seco, trava por 4 s e volta cheio, pronto para queimar de novo', () => {
    const t = new FuelTank(6, 4);
    queimar(t, 6.2); // seca aos 6 s: sobram ~3,8 s de trava
    queimar(t, 3.5); // ainda travado
    expect(t.locked).toBe(true);
    queimar(t, 0.5);
    expect(t.locked).toBe(false);
    expect(t.fuel).toBeGreaterThan(5.5); // voltou cheio (e já gastou o pedaço do meio segundo em que ficou apertado)
    expect(queimar(t, 1)).toBeCloseTo(1, 1);
  });

  it('o medidor mostra o tanque e, na trava, o quanto da recarga já passou (sobe de 0 a 1)', () => {
    const t = new FuelTank(6, 4);
    queimar(t, 3);
    expect(t.level).toBeCloseTo(0.5, 1);
    queimar(t, 3.5);
    expect(t.locked).toBe(true);
    const comeco = t.level;
    queimar(t, 2);
    expect(t.level).toBeGreaterThan(comeco);
    expect(t.level).toBeLessThan(1);
  });

  it('solto, o tanque enche no ritmo da recarga (cheio em 4 s) e nunca passa da capacidade', () => {
    const t = new FuelTank(6, 4);
    queimar(t, 4); // sobram 2 s
    queimar(t, 1, false);
    expect(t.fuel).toBeGreaterThan(3);
    queimar(t, 10, false);
    expect(t.fuel).toBe(6);
  });

  it('rodada nova ou renascimento: tanque cheio e destravado', () => {
    const t = new FuelTank(6, 4);
    queimar(t, 6.2);
    t.refill();
    expect([t.fuel, t.locked]).toEqual([6, false]);
  });
});

describe('o lança-chamas no Armament (a regra de tiro de cada Mech)', () => {
  /** Um Mech com a arma na mão direita, o calor sempre ventilado (esta parte do teste é do tanque, não do calor) e o gatilho principal. */
  function palco(loadout: { primary: WeaponStats; offhand?: WeaponStats }) {
    const mech = new Vector09({ loadout: { primary: loadout.primary, offhand: loadout.offhand, secondary: null } });
    const armament = new Armament(mech);
    const pulsos: Array<{ t: number; mount: string }> = [];
    let t = 0;
    const sink: ShotSink = { projectile: () => {}, rocket: () => {}, melee: () => {}, flame: (mount) => pulsos.push({ t, mount }), wave: () => {} };
    const run = (seconds: number, fire: boolean, ventilar = true): void => {
      for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++, t += FIXED_DT) {
        if (ventilar) mech.vent(10);
        armament.fixedUpdate(FIXED_DT, fire, false, sink);
      }
    };
    return { mech, armament, pulsos, run };
  }
  const entre = (p: Array<{ t: number }>, a: number, b: number) => p.filter((x) => x.t >= a && x.t < b).length;

  it('segurando o gatilho, solta um pulso a cada 0,2 s (5 por segundo) pela boca da mão direita, e a bandeira da rede liga', () => {
    const { mech, armament, pulsos, run } = palco({ primary: FLAMER });
    run(2, true);
    expect(pulsos.length).toBeGreaterThanOrEqual(9);
    expect(pulsos.length).toBeLessThanOrEqual(11);
    expect(pulsos.every((p) => p.mount === 'rightHand')).toBe(true);
    expect(mech.status.flaming).toBe(true);
    expect(armament.fuelLevel).toBeGreaterThan(0);
  });

  /** Dono, 11/10: no Marauder "os tiros saíam só pela mão direita". A regra de tiro sempre atirou as duas; o que faltava era desenhar. */
  it('com lança-chamas nas duas mãos (Marauder), solta pulsos pelas DUAS bocas: a direita e a esquerda', () => {
    const mech = new Vector09({ loadout: { primary: FLAMER, offhand: FLAMER, secondary: null }, stats: { ...VECTOR09_STATS, triggers: SHOULDER_TRIGGERS } });
    const armament = new Armament(mech);
    const pulsos: string[] = [];
    const sink: ShotSink = { projectile: () => {}, rocket: () => {}, melee: () => {}, flame: (mount) => pulsos.push(mount), wave: () => {} };
    for (let i = 0; i < 60; i++) {
      mech.vent(10);
      armament.fixedUpdate(FIXED_DT, true, false, sink);
    }
    expect(pulsos.filter((m) => m === 'rightHand').length).toBeGreaterThanOrEqual(4);
    expect(pulsos.filter((m) => m === 'leftHand').length).toBeGreaterThanOrEqual(4);
    expect(new Set(pulsos)).toEqual(new Set(['rightHand', 'leftHand']));
  });

  it('soltando o gatilho, para na hora: sem pulsos e a bandeira desliga', () => {
    const { mech, pulsos, run } = palco({ primary: FLAMER });
    run(1, true);
    const antes = pulsos.length;
    run(1, false);
    expect(pulsos.length).toBe(antes);
    expect(mech.status.flaming).toBe(false);
  });

  it('com o tanque de 6 s: 30 pulsos, depois 4 s sem chama (trava), depois volta a queimar', () => {
    const { mech, pulsos, run } = palco({ primary: FLAMER });
    run(10.5, true);
    expect(entre(pulsos, 0, 6.05)).toBeGreaterThanOrEqual(29);
    expect(entre(pulsos, 0, 6.05)).toBeLessThanOrEqual(31);
    expect(entre(pulsos, 6.3, 9.9)).toBe(0); // travado, mesmo com o gatilho apertado
    expect(mech.status.flaming).toBe(true); // já destravou e está queimando de novo no fim
    expect(entre(pulsos, 10.1, 10.6)).toBeGreaterThan(0);
  });

  it('Mech superaquecido não acende a chama (o calor trava todas as armas)', () => {
    const { mech, pulsos, run } = palco({ primary: FLAMER });
    run(8, true, false); // sem ventilar: ferve em ~4,8 s
    expect(mech.overheated).toBe(true);
    const ate = pulsos.at(-1)!.t;
    expect(ate).toBeLessThan(5.2);
    expect(mech.status.flaming).toBe(false);
  });

  it('cada pulso soma calor no Mech que atira (esquenta quem atira)', () => {
    const { mech, run } = palco({ primary: FLAMER });
    run(2, true, false);
    expect(mech.heat).toBeGreaterThan(0.3);
  });

  it('as outras armas não têm tanque: medidor zerado e bandeira desligada', () => {
    const { mech, armament, run } = palco({ primary: weapon('plasma') });
    run(1, true);
    expect(armament.fuelLevel).toBe(0);
    expect(mech.status.flaming).toBe(false);
  });

  it('trocar de armas no Hangar enche um tanque novo', () => {
    const { mech, armament, run } = palco({ primary: FLAMER });
    run(5, true);
    expect(armament.fuelLevel).toBeGreaterThan(0); // gastou: o tanque não está cheio
    expect(armament.fuelLevel).toBeLessThan(0.5);
    armament.rearm();
    expect(armament.fuelLevel).toBe(0);
    expect(mech.status.flaming).toBe(false);
  });

  it('com lança-chamas nas duas mãos (Marauder), cada mão tem o seu tanque e pulsa pela sua boca', () => {
    const { pulsos, run } = palco({ primary: FLAMER, offhand: FLAMER });
    run(1, true);
    const bocas = new Set(pulsos.map((p) => p.mount));
    expect(bocas.has('rightHand')).toBe(true);
  });
});

describe('o alcance do cone cresce com o nível (Match.flameCone, com física de verdade)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  async function ate(tier: 0 | 1 | 2, z: number): Promise<boolean> {
    const physics = await PhysicsWorld.create();
    const foes = { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false };
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false });
    const atirador = new Vector09();
    match.addPlayer(atirador, 'Atirador');
    atirador.respawn(new THREE.Vector3(0, 0, 60));
    const alvo = new Vector09();
    match.addPlayer(alvo, 'Alvo');
    alvo.respawn(new THREE.Vector3(0, 0, z));
    physics.step();
    physics.step();
    match.flameCone(atirador, new THREE.Vector3(0, 3.3, 59.5), new THREE.Vector3(0, 0, -1), weapon('flamer', tier));
    return alvo.status.burning;
  }

  it('um alvo a ~40 m (z = 20) só é pego pelo MK II (39 m) e pelo MK III (48 m), não pelo MK I (30 m)', async () => {
    expect(await ate(0, 20)).toBe(false);
    expect(await ate(1, 20)).toBe(true);
    expect(await ate(2, 20)).toBe(true);
  });

  it('um alvo a ~47 m (z = 12) só o MK III alcança (48 m); e um a ~55 m (z = 5) nenhum nível alcança', async () => {
    expect(await ate(1, 12)).toBe(false);
    expect(await ate(2, 12)).toBe(true);
    expect(await ate(2, 5)).toBe(false);
  });

  it('um alvo a ~25 m (z = 35) é pego por todos os níveis', async () => {
    for (const t of [0, 1, 2] as const) expect(await ate(t, 35), `MK ${t + 1}`).toBe(true);
  });
});

describe('o cone de dano (Match.flameCone), com física de verdade', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  /** Uma partida sem bots, só com os Mechs que o teste põe. O atirador fica em (0, 0, 25) olhando para -Z; os alvos entram pela frente. */
  async function palco() {
    const physics = await PhysicsWorld.create();
    const foes = { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false };
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false });
    const atirador = new Vector09();
    match.addPlayer(atirador, 'Atirador');
    atirador.respawn(new THREE.Vector3(0, 0, 25));
    const alvos: Vector09[] = [];
    const alvo = (x: number, z: number): Vector09 => {
      const m = new Vector09();
      match.addPlayer(m, `Alvo${alvos.length}`);
      m.respawn(new THREE.Vector3(x, 0, z));
      alvos.push(m);
      return m;
    };
    const origem = new THREE.Vector3(0, 3.3, 24.5);
    const frente = new THREE.Vector3(0, 0, -1);
    const pulso = (w: WeaponStats = FLAMER, dir: THREE.Vector3 = frente) => {
      physics.step();
      physics.step();
      match.flameCone(atirador, origem, dir, w);
    };
    return { match, physics, atirador, alvo, origem, frente, pulso };
  }

  it('um alvo no cone, de perto, leva o dano cheio, pega fogo, e o atirador não se queima', async () => {
    const { atirador, alvo, pulso } = await palco();
    const a = alvo(0, 20); // ~4 m da boca
    const vidaA = a.modules.torso + a.modules.head;
    const vidaAtirador = atirador.modules.torso;
    pulso();
    expect(a.status.burning).toBe(true);
    expect(vidaA - (a.modules.torso + a.modules.head)).toBe(hitDamage(FLAMER, 0.5 + 4 - a.stats.radius)); // 6, no alcance ótimo
    expect(atirador.modules.torso).toBe(vidaAtirador);
    expect(atirador.status.active).toBe(false);
  });

  it('o atirador nunca se queima, nem com ele mesmo dentro do cone (a boca atrás do corpo)', async () => {
    const { atirador, physics, match, frente } = await palco();
    physics.step();
    physics.step();
    const atras = new THREE.Vector3(0, 3.3, 29); // atrás do atirador (que está em z=25): o corpo dele fica no meio do cone
    const vida = atirador.modules.torso;
    match.flameCone(atirador, atras, frente, FLAMER);
    expect(atirador.modules.torso).toBe(vida);
    expect(atirador.status.burning).toBe(false);
  });

  it('o mais longe leva menos (o dano cai com a distância) e o que está além dos 30 m não leva nada', async () => {
    const { alvo, pulso } = await palco();
    const perto = alvo(0, 20);
    const longe = alvo(1.5, 3); // ~21,5 m da boca, a ~4° do eixo: dentro do cone e do alcance, com o dano já caindo
    const fora = alvo(0, -8); // ~32,5 m da boca: passa dos 30 m de alcance mais o raio do corpo
    const tira = (m: Vector09) => m.stats.maxModuleHealth.torso + m.stats.maxModuleHealth.head - (m.modules.torso + m.modules.head);
    pulso();
    expect(tira(perto)).toBeGreaterThan(tira(longe));
    expect(tira(longe)).toBeGreaterThan(0);
    expect(tira(fora)).toBe(0);
    expect(fora.status.burning).toBe(false);
  });

  it('o que está fora da abertura do cone não é atingido; dentro dela, sim', async () => {
    const { alvo, pulso } = await palco();
    const lado = alvo(9, 19); // ~54° para o lado: bem fora
    const dentro = alvo(-1.5, 17); // ~12° no limite do cone, mas o corpo largo entra
    pulso();
    expect(lado.status.burning).toBe(false);
    expect(dentro.status.burning).toBe(true);
  });

  it('atinge TODOS no cone: o de trás não fica protegido pelo da frente', async () => {
    const { alvo, pulso } = await palco();
    const frente = alvo(0, 20);
    const tras = alvo(0, 14);
    pulso();
    expect(frente.status.burning).toBe(true);
    expect(tras.status.burning).toBe(true);
  });

  it('uma parede no meio segura a chama', async () => {
    const { alvo, physics, pulso } = await palco();
    physics.addStaticBox(new THREE.Vector3(0, 4, 20), new THREE.Vector3(8, 8, 0.5));
    const atras = alvo(0, 15);
    pulso();
    expect(atras.status.burning).toBe(false);
    expect(atras.modules.torso).toBe(atras.stats.maxModuleHealth.torso);
  });

  it('Mech morto é ignorado', async () => {
    const { alvo, pulso } = await palco();
    const a = alvo(0, 20);
    a.damagePart('torso', 1e6);
    expect(a.alive).toBe(false);
    pulso();
    expect(a.status.burning).toBe(false);
  });

  it('a chapa cerâmica levantada isola o fogo (térmico): quase não passa dano e o alvo não pega fogo; a reativa deixa passar', async () => {
    const arm = VECTOR09_STATS.maxModuleHealth.leftArm;
    const ceramica = await palco();
    const a = ceramica.alvo(0, 20);
    a.applyFacing(0, 0); // olha para -Z: de frente para o atirador, que fica atrás dele em z=25... a chapa cobre o lado de quem olha
    a.applyFacing(Math.PI, 0); // vira para +Z, de frente para o atirador
    a.metalShield.equip({ id: 'refratario', tier: 0 }, arm);
    a.guard(true);
    expect(a.metalShield.raised).toBe(true);
    ceramica.pulso();
    expect(a.status.burning).toBe(false);

    const reativa = await palco();
    const b = reativa.alvo(0, 20);
    b.applyFacing(Math.PI, 0);
    b.metalShield.equip({ id: 'reativo', tier: 0 }, arm);
    b.guard(true);
    reativa.pulso();
    expect(b.status.burning).toBe(true);
  });

  it('só quem leva fogo pelos próprios méritos queima: o fogo apaga o gelo que o alvo já tinha', async () => {
    const { alvo, pulso } = await palco();
    const a = alvo(0, 20);
    for (let i = 0; i < 2; i++) a.status.chillUp();
    expect(a.status.stacks).toBe(2);
    pulso();
    expect(a.status.stacks).toBe(0);
    expect(a.status.burning).toBe(true);
  });

  it('o abate por chama é do atirador (o crédito do estado vai para quem acendeu)', async () => {
    const { match, atirador, alvo, pulso } = await palco();
    const a = alvo(0, 20);
    const abates: Array<{ mech: unknown; killer: unknown }> = [];
    match.combat.onMechKilled = (mech, _at, killer) => abates.push({ mech, killer });
    a.damagePart('torso', a.modules.torso - 2); // sobra quase nada
    pulso();
    expect(a.alive).toBe(false);
    expect(abates).toHaveLength(1);
    expect(abates[0]!.killer).toBe(atirador);
  });
});
