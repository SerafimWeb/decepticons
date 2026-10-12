import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { CHASSIS, COLOSSUS_BOSS_STATS, VECTOR09_STATS } from '../entities/chassis';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { armOptions } from '../hangar/loadout';
import type { BurstOptions, ParticleSystem } from '../fx/ParticleSystem';
import { SHAPE } from '../fx/particleShapes';
import { drawWave } from '../fx/WaveVisuals';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { Armament, type ShotSink } from './Armament';
import { timeToKill } from './balance';
import { SHOULDER_TRIGGERS, type MountId } from './mounts';
import { DAMAGE_TYPE, hitDamage, rangeFactor, weapon, WEAPON_IDS, type Loadout, type Tier, type WeaponStats } from './weapons';

const V = VECTOR09_STATS;
const TORSO = V.maxModuleHealth.torso;
const SONIC = weapon('sonic');
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;

/**
 * Dono, 11/10: *"as armas de som combinam em ficar nos ombros"* e *"temos que pensar as armas pro botão 2, nos ombros, costas, peitoral, vamos VARIAR as armas e tecnologias"*.
 * O canhão sônico é a primeira arma só de ombro: um cone de onda que **empurra** (o tranco que o jogo ainda não tinha) e fura pouca vida.
 */
describe('canhão sônico: o que é', () => {
  it('é de energia, sem projétil, natureza sônica, com onda em cone e empurrão; pesa 3 / 4,5 / 6 t por boca e bate 20 / 24 / 28', () => {
    expect(SONIC.kind).toBe('energy');
    expect(SONIC.speed).toBe(0);
    expect(SONIC.wave).toBeDefined();
    expect(DAMAGE_TYPE.sonic).toBe('sonico');
    expect(([0, 1, 2] as const).map((t) => weapon('sonic', t).mass)).toEqual([3, 4.5, 6]);
    expect(([0, 1, 2] as const).map((t) => weapon('sonic', t).damage)).toEqual([20, 24, 28]);
    expect((SONIC.wave!.halfAngle * 2 * 180) / Math.PI).toBeCloseTo(51.6, 0);
  });

  it('o nível dá mais alcance (+25% por nível: 22 / 27,5 / 33 m) e nada mais muda na onda (cadência e empurrão são da arma)', () => {
    const [a, b, c] = ([0, 1, 2] as const).map((t) => weapon('sonic', t));
    expect([a!.maxRange, b!.maxRange, c!.maxRange]).toEqual([22, 27.5, 33]);
    expect([a!.optimalRange, b!.optimalRange, c!.optimalRange]).toEqual([10, 12.5, 15]);
    expect(b!.fireInterval).toBe(a!.fireInterval);
    expect(c!.wave).toEqual(a!.wave);
  });

  it('é arma SÓ de ombro: o Marauder a oferece nos ombros e nenhum chassi a oferece nas mãos', () => {
    expect(armOptions('shoulders', 'marauder')).toContain('sonic');
    for (const id of Object.keys(CHASSIS) as Array<keyof typeof CHASSIS>) {
      expect(armOptions('right', id), id).not.toContain('sonic');
      expect(armOptions('left', id), id).not.toContain('sonic');
      if (id !== 'marauder') expect(armOptions('shoulders', id), id).toEqual([]);
    }
  });

  it('só ela tem onda; o resto do arsenal segue sem o campo', () => {
    for (const id of WEAPON_IDS) expect(weapon(id).wave !== undefined, id).toBe(id === 'sonic');
  });
});

describe('canhão sônico: equilíbrio (Vector-09, torso de 300)', () => {
  it('é arma de apoio: sozinha (as duas bocas) leva mais de 4,5 s em qualquer nível; com outra arma, mais de 2,5 s', () => {
    for (const t of [0, 1, 2] as const) {
      const w = weapon('sonic', t);
      expect(timeToKill([w, w], V, TORSO), `MK ${t + 1}`).toBeGreaterThan(4.5);
      for (const o of ['plasma', 'railgun', 'cannon', 'autocannon', 'flamer'] as const) { // armas de mão que o Marauder leva
        for (const ot of [0, 1, 2] as const) expect(timeToKill([w, w, weapon(o, ot)], V, TORSO), `${o} ${ot} + sônico ${t}`).toBeGreaterThan(2.5);
      }
    }
  });

  it('esquenta pouco: as duas bocas a cada 1,2 s põem 0,2 de calor por segundo, bem abaixo do que o Mech dissipa', () => {
    expect((2 * SONIC.heatPerShot) / SONIC.fireInterval).toBeLessThan(0.25);
  });

  it('o dano cai com a distância como um tiro direto: cheio até 10 m, 35% aos 22 m', () => {
    expect(hitDamage(SONIC, 5)).toBe(20);
    expect(hitDamage(SONIC, 10)).toBe(20);
    expect(hitDamage(SONIC, 22)).toBe(7);
    expect(rangeFactor(SONIC, 16)).toBeCloseTo(0.675, 3);
  });
});

describe('a regra de tiro (Armament): as duas bocas dos ombros disparam juntas no botão 2', () => {
  interface Onda {
    t: number;
    mount: MountId;
  }
  function bench(loadout: Loadout) {
    const mech = new Vector09({ stats: { ...VECTOR09_STATS, triggers: SHOULDER_TRIGGERS, loadout }, loadout });
    const armament = new Armament(mech);
    const ondas: Onda[] = [];
    const outros: string[] = [];
    let t = 0;
    const sink: ShotSink = {
      projectile: () => outros.push('projectile'),
      rocket: () => outros.push('rocket'),
      melee: () => outros.push('melee'),
      flame: () => outros.push('flame'),
      wave: (mount) => ondas.push({ t, mount }),
    };
    const hold = (seconds: number, fire: boolean, secondary: boolean) => {
      for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++, t += FIXED_DT) armament.fixedUpdate(FIXED_DT, fire, secondary, sink);
    };
    return { mech, ondas, outros, hold };
  }
  const marauder = (tier: Tier = 0): Loadout => ({ primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('sonic', tier) });

  it('um aperto solta uma onda de CADA ombro no mesmo tick, e nenhum projétil', () => {
    const { ondas, outros, hold } = bench(marauder());
    hold(0.1, false, true);
    expect(ondas.map((o) => o.mount).sort()).toEqual(['leftShoulder', 'rightShoulder']);
    expect(new Set(ondas.map((o) => o.t)).size).toBe(1);
    expect(outros).toEqual([]);
  });

  it('segurando o botão, repete a cada 1,2 s (3 apertos em 2,5 s) e para quando solta', () => {
    const { ondas, hold } = bench(marauder());
    hold(2.5, false, true);
    expect(ondas).toHaveLength(6); // 0, 1,2 e 2,4 s, duas bocas
    const n = ondas.length;
    hold(2, false, false);
    expect(ondas).toHaveLength(n);
  });

  it('cada boca soma o calor dela: 0,24 por aperto (2 x 0,12)', () => {
    const { mech, hold } = bench(marauder());
    hold(0.02, false, true);
    expect(mech.heat).toBeCloseTo(2 * SONIC.heatPerShot, 3);
  });

  it('o botão principal segue atirando as mãos enquanto o secundário solta a onda (não se atrapalham)', () => {
    const { ondas, outros, hold } = bench(marauder());
    hold(0.5, true, true);
    expect(ondas.length).toBeGreaterThanOrEqual(2);
    expect(outros.filter((o) => o === 'projectile').length).toBeGreaterThanOrEqual(2);
  });

  it('um ombro perdido (torso é a parte dos ombros): sem torso, nenhuma onda; com o braço perdido, a onda segue (ela é do ombro, não da mão)', () => {
    const a = bench(marauder());
    a.mech.modules.leftArm = 0;
    a.hold(0.1, false, true);
    expect(a.ondas).toHaveLength(2);
    const b = bench(marauder());
    b.mech.modules.torso = 0;
    b.hold(0.1, false, true);
    expect(b.ondas).toHaveLength(0);
  });
});

describe('o cone da onda (Match.waveCone), com física de verdade', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  const sonic = (tier: Tier = 0) => weapon('sonic', tier);

  /** Uma partida com o atirador em (0, 0, 25), olhando para -Z; os alvos entram pela frente. `particles` é a espiã do desenho. */
  async function palco(particles: ParticleSystem = NO_FX, enemyMechs = 0) {
    const physics = await PhysicsWorld.create();
    const foes = { ...DEFAULT_SETTINGS, enemyMechs, enemyAndroids: 0, technician: false };
    const match = new Match({ physics, scene: new THREE.Scene(), particles, foes, debris: false });
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
    const onda = (w: WeaponStats = sonic()) => {
      physics.step();
      physics.step();
      match.waveCone(atirador, origem, frente, w);
    };
    const vida = (m: Vector09) => m.modules.torso + m.modules.head + m.modules.leftArm + m.modules.rightArm + m.modules.leftLeg + m.modules.rightLeg;
    return { match, physics, atirador, alvo, onda, vida, origem, frente };
  }

  it('um alvo no cone, de perto, leva o dano e é EMPURRADO para longe da boca (para -Z, a direção do tiro)', async () => {
    const { alvo, onda, vida } = await palco();
    const a = alvo(0, 20); // ~4,5 m da boca
    const antes = vida(a);
    onda();
    expect(antes - vida(a)).toBeGreaterThan(0);
    expect(a.shove.z).toBeLessThan(-7); // ~8 m/s a queima-roupa
    expect(Math.abs(a.shove.x)).toBeLessThan(0.5);
  });

  it('o dano e o empurrão caem com a distância: o mais longe leva menos das duas coisas', async () => {
    const { alvo, onda, vida } = await palco();
    const perto = alvo(0, 20);
    const longe = alvo(0, 6); // ~18 m da boca (superfície a ~16,7)
    const v0 = vida(perto);
    const v1 = vida(longe);
    onda();
    expect(v0 - vida(perto)).toBeGreaterThan(v1 - vida(longe));
    expect(v1 - vida(longe)).toBeGreaterThan(0);
    expect(Math.abs(perto.shove.z)).toBeGreaterThan(Math.abs(longe.shove.z));
    expect(Math.abs(longe.shove.z)).toBeGreaterThan(0);
  });

  it('o empurrão sai radial da boca: quem está um pouco à direita é empurrado também para a direita', async () => {
    const { alvo, onda } = await palco();
    const a = alvo(3, 17); // ~8 m à frente e 3 m para o lado (x positivo)
    onda();
    expect(a.shove.x).toBeGreaterThan(0.5);
    expect(a.shove.z).toBeLessThan(-3);
  });

  it('fora do alcance ou fora do cone, nada: o que está além dos 22 m, ou a 70° do eixo, não leva nada', async () => {
    const { alvo, onda, vida } = await palco();
    const alem = alvo(0, 1); // ~23,5 m, mais o raio do corpo (fora dos 22 m + 1,3)
    const lado = alvo(10, 22); // quase de lado
    const a0 = vida(alem);
    const l0 = vida(lado);
    onda();
    expect(vida(alem)).toBe(a0);
    expect(vida(lado)).toBe(l0);
    expect(alem.shove.length()).toBe(0);
    expect(lado.shove.length()).toBe(0);
  });

  it('o nível alcança mais: um alvo a ~26 m só é pego pelo MK II (27,5 m) e pelo MK III, não pelo MK I', async () => {
    for (const [tier, pego] of [[0, false], [1, true], [2, true]] as const) {
      const { alvo, onda } = await palco();
      const a = alvo(0, -1.5); // ~26 m da boca
      onda(sonic(tier));
      expect(a.shove.length() > 0, `MK ${tier + 1}`).toBe(pego);
    }
  });

  it('uma parede no meio segura a onda (sem linha de visão): o alvo atrás não leva nada nem se mexe', async () => {
    const { alvo, physics, onda, vida } = await palco();
    physics.addStaticBox(new THREE.Vector3(0, 4, 20), new THREE.Vector3(10, 8, 0.5));
    const atras = alvo(0, 15);
    const v0 = vida(atras);
    onda();
    expect(vida(atras)).toBe(v0);
    expect(atras.shove.length()).toBe(0);
  });

  it('atinge TODOS no cone, e quem atira nunca se empurra nem se machuca', async () => {
    const { alvo, atirador, onda, vida } = await palco();
    const a = alvo(0, 20);
    const b = alvo(-1.5, 14);
    const dono0 = vida(atirador);
    onda();
    expect(a.shove.length()).toBeGreaterThan(0);
    expect(b.shove.length()).toBeGreaterThan(0);
    expect(vida(atirador)).toBe(dono0);
    expect(atirador.shove.length()).toBe(0);
  });

  it('o aliado do jogador (Arena offline) no meio do cone NÃO é atingido nem empurrado, e o rebelde ao lado dele, sim', async () => {
    const { match, atirador, onda, vida } = await palco(NO_FX, 6); // 6 Mechs na Arena: os aliados tiram vaga dos rebeldes e sobram alguns
    const aliado = match.allies!.mechs[0]!;
    aliado.respawn(new THREE.Vector3(0, 0, 20));
    const rebelde = match.bots.mechs[0]!;
    rebelde.respawn(new THREE.Vector3(1, 0, 19));
    const a0 = vida(aliado);
    const r0 = vida(rebelde);
    expect(match.sameSide(atirador, aliado)).toBe(true);
    onda();
    expect(vida(aliado)).toBe(a0);
    expect(aliado.shove.length()).toBe(0);
    expect(vida(rebelde)).toBeLessThan(r0);
    expect(rebelde.shove.length()).toBeGreaterThan(0);
  });

  it('quem atira nunca se empurra, nem com o corpo dele dentro do cone (a boca atrás do corpo)', async () => {
    const { match, atirador, physics, vida } = await palco();
    physics.step();
    physics.step();
    const dono0 = vida(atirador);
    match.waveCone(atirador, new THREE.Vector3(0, 3.3, 29), new THREE.Vector3(0, 0, -1), sonic()); // o atirador (z = 25) fica no meio do cone
    expect(vida(atirador)).toBe(dono0);
    expect(atirador.shove.length()).toBe(0);
  });

  it('as duas bocas dos ombros somam, mas o empurrão tem teto de 12 m/s (dois ombros não viram arremesso)', async () => {
    const { alvo, onda } = await palco();
    const a = alvo(0, 21);
    onda();
    onda();
    expect(a.shove.length()).toBeLessThanOrEqual(12 + 1e-6);
    expect(a.shove.length()).toBeGreaterThan(10);
  });

  it('o robô grande empurra menos: o Colossus (raio 3,6) sai bem menos que o Vector-09 (raio 1,3), e o Vector-09 leva o empurrão cheio', async () => {
    const leve = await palco();
    const a = leve.alvo(0, 20);
    leve.onda();
    const pesado = await palco();
    const g = new Vector09({ stats: COLOSSUS_BOSS_STATS });
    pesado.match.addPlayer(g, 'Gigante');
    g.respawn(new THREE.Vector3(0, 0, 18));
    pesado.onda();
    expect(a.shove.length()).toBeGreaterThan(7);
    expect(g.shove.length()).toBeLessThan(a.shove.length() * 0.4);
    expect(g.shove.length()).toBeGreaterThan(0);
  });

  it('a natureza é sônica: a chapa Amortecedor (90%) segura a onda e a chapa de aço, não; o empurrão vale nos dois casos', async () => {
    const arm = VECTOR09_STATS.maxModuleHealth.leftArm;
    const amortecedor = await palco();
    const a = amortecedor.alvo(0, 20);
    a.applyFacing(Math.PI, 0);
    a.metalShield.equip({ id: 'amortecedor', tier: 0 }, arm);
    a.guard(true);
    const a0 = amortecedor.vida(a);
    amortecedor.onda();
    const comAmortecedor = a0 - amortecedor.vida(a);

    const aco = await palco();
    const b = aco.alvo(0, 20);
    b.applyFacing(Math.PI, 0);
    b.metalShield.equip({ id: 'muralha', tier: 0 }, arm);
    b.guard(true);
    const b0 = aco.vida(b);
    aco.onda();
    const comMuralha = b0 - aco.vida(b);
    expect(comAmortecedor).toBeLessThan(comMuralha);
    expect(a.shove.length()).toBeGreaterThan(5);
    expect(b.shove.length()).toBeGreaterThan(5);
  });

  it('o cliente online (dano desligado) só desenha: nenhum dano, nenhum empurrão, mas o desenho e o aviso de onda saem', async () => {
    const chamadas: BurstOptions[] = [];
    const espia = { burst: (_o: THREE.Vector3, _n: THREE.Vector3, o: BurstOptions) => chamadas.push(o) } as unknown as ParticleSystem;
    const { match, atirador, alvo, onda, vida } = await palco(espia);
    match.combat.damageEnabled = false;
    const avisos: unknown[] = [];
    match.onWave = (_o, _d, dono, w) => avisos.push({ dono, id: w.id });
    const a = alvo(0, 20);
    const v0 = vida(a);
    onda();
    expect(vida(a)).toBe(v0);
    expect(a.shove.length()).toBe(0);
    expect(chamadas.length).toBeGreaterThan(0);
    expect(avisos).toEqual([{ dono: atirador.collider, id: 'sonic' }]);
  });

  it('o servidor é avisado de cada onda (para mandar o evento de tiro): um aviso por boca, com o dono e a arma', async () => {
    const { match, atirador, onda } = await palco();
    const avisos: string[] = [];
    match.onWave = (_o, _d, dono, w) => avisos.push(`${dono === atirador.collider}:${w.id}`);
    onda();
    onda();
    expect(avisos).toEqual(['true:sonic', 'true:sonic']);
  });

  it('um Mech morto é ignorado, e a onda sem a arma certa (arma sem campo wave) não faz nada', async () => {
    const { match, atirador, alvo, onda, origem, frente } = await palco();
    const a = alvo(0, 20);
    a.damagePart('torso', 1e6);
    expect(a.alive).toBe(false);
    onda();
    expect(a.shove.length()).toBe(0);
    const b = alvo(0, 19);
    match.waveCone(atirador, origem, frente, weapon('plasma'));
    expect(b.shove.length()).toBe(0);
  });
});

describe('o empurrão no corpo (MechBase.push): velocidade externa que decai e anda por cima do input', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  const parado: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };

  async function chao() {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(800, 2, 800));
    const mech = new Vector09();
    mech.spawn(physics, new THREE.Vector3(0, 0, 0));
    for (let i = 0; i < 5; i++) {
      mech.fixedUpdate(parado, FIXED_DT);
      physics.step();
    }
    return { physics, mech };
  }
  const anda = (c: Awaited<ReturnType<typeof chao>>, ticks: number, input: MechInput = parado) => {
    for (let i = 0; i < ticks; i++) {
      c.mech.fixedUpdate(input, FIXED_DT);
      c.physics.step();
    }
  };

  it('empurrado a 8 m/s, desliza ~1,9 m em 0,5 s e ~2,3 m no total (8 / 3,5), e para sozinho', async () => {
    const c = await chao();
    const z0 = c.mech.simPosition.z;
    c.mech.push(0, -1, 8);
    expect(c.mech.shove.z).toBeCloseTo(-8, 5);
    anda(c, 30);
    expect(z0 - c.mech.simPosition.z).toBeGreaterThan(1.6);
    expect(z0 - c.mech.simPosition.z).toBeLessThan(2.2);
    anda(c, 240);
    expect(z0 - c.mech.simPosition.z).toBeGreaterThan(2.0);
    expect(z0 - c.mech.simPosition.z).toBeLessThan(2.6);
    expect(c.mech.shove.length()).toBe(0); // zerou de vez (nada de resto vivo)
  });

  it('o piloto não cancela o empurrão: parado, andando a favor ou andando contra, o empurrão soma os mesmos ~2,3 m ao deslocamento', async () => {
    const extra = async (input: MechInput): Promise<number> => {
      const sem = await chao();
      anda(sem, 90, input);
      const com = await chao();
      com.mech.push(0, -1, 8);
      anda(com, 90, input);
      return sem.mech.simPosition.z - com.mech.simPosition.z;
    };
    // moveZ = 1 anda para a frente (-Z, a favor do empurrão); moveZ = -1, para trás (contra).
    for (const [nome, input] of [['parado', parado], ['a favor', { ...parado, moveZ: 1 }], ['contra', { ...parado, moveZ: -1 }]] as const) {
      const d = await extra(input);
      expect(d, nome).toBeGreaterThan(2.0);
      expect(d, nome).toBeLessThan(2.6);
    }
  });

  it('o empurrão para o lado (eixo X) também desloca o Mech: ~2,3 m a 8 m/s, e a direção diagonal soma os dois eixos', async () => {
    const c = await chao();
    const x0 = c.mech.simPosition.x;
    c.mech.push(1, 0, 8);
    anda(c, 240);
    expect(c.mech.simPosition.x - x0).toBeGreaterThan(2.0);
    expect(c.mech.simPosition.x - x0).toBeLessThan(2.6);
    const d = await chao();
    const dz0 = d.mech.simPosition.z;
    d.mech.push(1, 1, 8);
    anda(d, 240);
    expect(d.mech.simPosition.x).toBeGreaterThan(1.2);
    expect(d.mech.simPosition.z - dz0).toBeGreaterThan(1.2);
  });

  it('o teto de 12 m/s vale para vários empurrões juntos, em qualquer direção', async () => {
    const { mech } = await chao();
    for (let i = 0; i < 5; i++) mech.push(1, 0, 8);
    expect(mech.shove.length()).toBeCloseTo(12, 5);
    mech.push(-1, 0, 8); // contra: cancela parte
    expect(mech.shove.length()).toBeLessThan(12);
  });

  it('a direção não precisa ser unitária, e uma direção nula ou uma velocidade nula não fazem nada', async () => {
    const { mech } = await chao();
    mech.push(0, -50, 4);
    expect(mech.shove.z).toBeCloseTo(-4, 5);
    mech.push(0, 0, 8);
    mech.push(1, 0, 0);
    mech.push(1, 0, -3);
    expect(mech.shove.z).toBeCloseTo(-4, 5);
    expect(mech.shove.x).toBe(0);
  });

  it('a resistência: o raio 1,3 (Vector-09) leva 100%, o 3,6 (Colossus) leva 36% e o piso é 25%', async () => {
    const { physics, mech } = await chao();
    mech.push(1, 0, 10);
    expect(mech.shove.x).toBeCloseTo(10, 5);
    const g = new Vector09({ stats: COLOSSUS_BOSS_STATS });
    g.spawn(physics, new THREE.Vector3(30, 0, 0));
    g.push(1, 0, 10);
    expect(g.shove.x).toBeCloseTo((10 * 1.3) / 3.6, 3);
    const enorme = new Vector09({ stats: { ...COLOSSUS_BOSS_STATS, radius: 9, height: 20 } });
    enorme.spawn(physics, new THREE.Vector3(60, 0, 0));
    enorme.push(1, 0, 10);
    expect(enorme.shove.x).toBeCloseTo(2.5, 5);
  });

  it('o morto não é empurrado, e renascer zera o empurrão que sobrou', async () => {
    const { mech } = await chao();
    mech.push(1, 0, 8);
    expect(mech.shove.x).toBeGreaterThan(0);
    mech.respawn(new THREE.Vector3(0, 0, 0));
    expect(mech.shove.length()).toBe(0);
    mech.damagePart('torso', 1e6);
    expect(mech.alive).toBe(false);
    mech.push(1, 0, 8);
    expect(mech.shove.length()).toBe(0);
  });

  it('o empurrão não atravessa parede: o Mech empurrado contra um muro para nele', async () => {
    const c = await chao();
    c.physics.addStaticBox(new THREE.Vector3(0, 5, -3), new THREE.Vector3(20, 10, 1));
    c.mech.push(0, -1, 12);
    anda(c, 120);
    expect(c.mech.simPosition.z).toBeGreaterThan(-3 + 0.5 + 1.3 - 0.4); // a face do muro é z = -2,5; a cápsula (raio 1,3) fica de fora
  });
});

describe('a onda desenhada, parte das partículas (fx/WaveVisuals): só as moléculas; a onda são os anéis (WaveRings.test.ts)', () => {
  const coleta = (w: WeaponStats) => {
    const out: Array<{ at: THREE.Vector3; o: BurstOptions }> = [];
    const n = drawWave({ burst: (at: THREE.Vector3, _n: THREE.Vector3, o: BurstOptions) => out.push({ at: at.clone(), o }) }, new THREE.Vector3(1, 4, 2), new THREE.Vector3(0, 0, -1), w);
    return { out, n };
  };

  it('são pontinhos de ar (nada de arco colorido, anel de partícula nem faixa de luz): 6 moléculas por boca, todas saindo da boca', () => {
    const { out, n } = coleta(SONIC);
    expect(n).toBe(6);
    expect(out.map((x) => x.o.shape)).toEqual([SHAPE.dot]);
    expect(out.reduce((a, x) => a + x.o.count, 0)).toBe(6);
    for (const x of out) expect(x.at.toArray()).toEqual([1, 4, 2]);
  });

  it('as moléculas cobrem 95% do alcance da arma (22 m no nível I) e o alcance cresce com o nível', () => {
    const alcance = (w: WeaponStats) => coleta(w).out.map((x) => x.o.speed * x.o.life)[0]!;
    expect(alcance(SONIC)).toBeCloseTo(22 * 0.95, 3);
    expect(alcance(weapon('sonic', 2))).toBeCloseTo(33 * 0.95, 3);
  });

  it('o cone das moléculas acompanha o da arma e a cor é fria e pálida: o azul manda, não há laranja nem verde e o bloom não acende', () => {
    const { out } = coleta(SONIC);
    const half = SONIC.wave!.halfAngle;
    for (const x of out) {
      expect(x.o.spread!).toBeLessThanOrEqual(half * 1.2);
      const { r, g, b } = x.o.color;
      expect(b).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(r);
      expect(Math.max(r, g, b)).toBeLessThanOrEqual(1.2);
    }
  });

  it('arma sem onda não desenha nada, e as opções são criadas uma vez (os mesmos objetos a cada tiro)', () => {
    expect(coleta(weapon('plasma')).n).toBe(0);
    const a = coleta(SONIC).out.map((x) => x.o);
    const b = coleta(SONIC).out.map((x) => x.o);
    for (let i = 0; i < a.length; i++) expect(b[i]).toBe(a[i]);
  });

  it('a partida avisa o desenho dos anéis a cada onda (o cliente liga o gancho; o servidor não tem)', async () => {
    const calls: Array<{ origin: number[]; dir: number[]; id: string }> = [];
    const m = (await import('../sim/Match')).Match.prototype;
    const fake = { fx: { burst: () => undefined }, onWaveFx: (o: THREE.Vector3, d: THREE.Vector3, w: WeaponStats) => calls.push({ origin: o.toArray(), dir: d.toArray(), id: w.id }) };
    m.drawWave.call(fake as never, new THREE.Vector3(1, 2, 3), new THREE.Vector3(0, 0, -1), SONIC);
    expect(calls).toEqual([{ origin: [1, 2, 3], dir: [0, 0, -1], id: 'sonic' }]);
    // Sem o gancho (servidor), desenha as partículas e segue.
    expect(() => m.drawWave.call({ fx: { burst: () => undefined } } as never, new THREE.Vector3(), new THREE.Vector3(0, 0, -1), SONIC)).not.toThrow();
  });
});
