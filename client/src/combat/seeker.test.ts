import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import { armGroups, armOptions } from '../hangar/loadout';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { NET_WEAPONS } from '../../../shared/net/events';
import { Armament, type ShotSink } from './Armament';
import { classFor } from './weaponClass';
import { fitsMount } from './mountKinds';
import { SHOULDER_TRIGGERS, type MountId } from './mounts';
import { RocketSystem, type GuideTarget } from './RocketSystem';
import { DAMAGE_TYPE, weapon, WEAPON_IDS, type Loadout, type Tier } from './weapons';

const SEEKER = weapon('seeker');
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;

/**
 * Dono, 11/10: *"temos que fazer melhor aproveitamento dos slots nos ombros... vamos VARIAR as armas e tecnologias"*. O míssil teleguiado é o segundo tipo de arma de
 * ombro que **não é só mais foguete**: trava no inimigo mais centrado à frente e curva até ele.
 */
describe('míssil teleguiado: o que é', () => {
  it('é de munição (passa pelo RocketSystem), explosivo, com trava e curva; só ele tem `guide`', () => {
    expect(SEEKER.kind).toBe('ammo');
    expect(DAMAGE_TYPE.seeker).toBe('explosivo');
    expect(SEEKER.guide).toEqual({ turnRate: 2.2, lockRange: 90, lockHalfAngle: 0.5 });
    for (const id of WEAPON_IDS) expect(weapon(id).guide !== undefined, id).toBe(id === 'seeker');
  });

  it('55 de dano, explosão de 4,5 m (menor que a dos foguetes), 2 no carregador, recarga de 3,2 s, 48 m/s até 140 m, 4 t por lançador', () => {
    expect([SEEKER.damage, SEEKER.blastRadius, SEEKER.magazine, SEEKER.reload, SEEKER.speed, SEEKER.maxRange, SEEKER.mass]).toEqual([55, 4.5, 2, 3.2, 48, 140, 4]);
    expect(SEEKER.blastRadius).toBeLessThan(weapon('rockets').blastRadius);
    expect(SEEKER.speed).toBeLessThan(weapon('rockets').speed); // quem corre percebe e desvia
  });

  it('os níveis sobem o dano e a carga (66 e 77; 6 e 8 t) e a trava é a mesma em todos', () => {
    expect(([0, 1, 2] as const).map((t) => weapon('seeker', t).damage)).toEqual([55, 66, 77]);
    expect(([0, 1, 2] as const).map((t) => weapon('seeker', t).mass)).toEqual([4, 6, 8]);
    for (const t of [1, 2] as const) expect(weapon('seeker', t).guide).toEqual(SEEKER.guide);
  });

  it('é arma média de ombro e de costas: cabe só nos ombros do Marauder, não em mão nenhuma, e a rede o conhece (protocolo 16)', () => {
    expect(classFor('seeker', 2)).toBe('medium');
    expect(fitsMount('seeker', 'shoulder')).toBe(true);
    expect(fitsMount('seeker', 'back')).toBe(true);
    expect(fitsMount('seeker', 'arm')).toBe(false);
    expect(armOptions('shoulders', 'marauder')).toContain('seeker');
    for (const slot of ['right', 'left'] as const) expect(armOptions(slot, 'marauder')).not.toContain('seeker');
    expect(armGroups('shoulders', 'marauder').find((g) => g.cls === 'medium')!.ids).toContain('seeker');
    expect(NET_WEAPONS.at(-1)).toBe('seeker');
  });
});

describe('a regra de tiro (Armament): os dois ombros soltam um míssil cada, no botão 2', () => {
  function bench(loadout: Loadout) {
    const mech = new Vector09({ stats: { ...VECTOR09_STATS, triggers: SHOULDER_TRIGGERS, loadout }, loadout });
    const armament = new Armament(mech);
    const mísseis: Array<{ t: number; mount: MountId }> = [];
    let t = 0;
    const sink: ShotSink = {
      projectile: () => {},
      rocket: (mount) => mísseis.push({ t, mount }),
      melee: () => {},
      flame: () => {},
      wave: () => {},
    };
    const hold = (seconds: number, secondary: boolean) => {
      for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++, t += FIXED_DT) armament.fixedUpdate(FIXED_DT, false, secondary, sink);
    };
    return { mech, mísseis, hold };
  }
  const marauder = (tier: Tier = 0): Loadout => ({ primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('seeker', tier) });

  it('um aperto solta um míssil de CADA ombro no mesmo tick (dois por aperto)', () => {
    const { mísseis, hold } = bench(marauder());
    hold(0.1, true);
    expect(mísseis.map((m) => m.mount).sort()).toEqual(['leftShoulder', 'rightShoulder']);
    expect(new Set(mísseis.map((m) => m.t)).size).toBe(1);
  });

  it('o carregador é de 2 apertos (4 mísseis): nada sai até a recarga de 3,2 s; o calor de 0,2 por míssil é o mesmo dos foguetes (0,18)', () => {
    const { mísseis, hold } = bench(marauder());
    hold(2.4, true);
    expect(mísseis).toHaveLength(4); // dois apertos (um a cada 0,5 s) esvaziam o carregador
    expect(mísseis.map((m) => m.t.toFixed(1))).toEqual(['0.0', '0.0', '0.5', '0.5']);
    hold(0.7, true); // 3,1 s: ainda recarregando
    expect(mísseis).toHaveLength(4);
    hold(0.4, true); // passou dos 3,2 s: um aperto de volta
    expect(mísseis.length).toBeGreaterThan(4);
    for (const m of mísseis.slice(4)) expect(m.t).toBeGreaterThanOrEqual(3.2 - 1e-6);
  });

  it('cada míssil soma 0,2 de calor: um aperto soma 0,4 (2 x 0,2)', () => {
    const { mech, hold } = bench(marauder());
    hold(0.02, true);
    expect(mech.heat).toBeCloseTo(2 * SEEKER.heatPerShot, 3);
  });
});

describe('a guiagem (RocketSystem): curva até o alvo, no máximo turnRate rad/s, e solta se o alvo morre', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  /** Um RocketSystem sozinho, com um alvo falso parado em `pos` (sem rig, sem 3D: é só a geometria da simulação). */
  async function sozinho(pos: THREE.Vector3) {
    const physics = await PhysicsWorld.create();
    const sys = new RocketSystem(new THREE.Scene(), physics, NO_FX);
    const alvo: GuideTarget & { alive: boolean } = { alive: true, simPosition: pos.clone(), stats: { height: 2 } };
    sys.acquire = () => alvo;
    const foguete = () => (sys as unknown as { pool: Array<{ velocity: THREE.Vector3; pos: THREE.Vector3; life: number; target: GuideTarget | null }> }).pool[0]!;
    const voa = (s: number) => {
      for (let t = 0; t < s - 1e-9; t += FIXED_DT) sys.fixedUpdate(FIXED_DT);
    };
    const rumo = () => foguete().velocity.clone().normalize();
    return { sys, alvo, voa, rumo, foguete };
  }
  const ORIGEM = new THREE.Vector3(0, 3, 0);
  const FRENTE = new THREE.Vector3(0, 0, -1);
  const angulo = (a: THREE.Vector3, b: THREE.Vector3) => Math.acos(Math.min(1, Math.max(-1, a.dot(b))));

  it('nunca vira mais que turnRate x tempo: em 0,5 s, no máximo 1,1 rad (63°), mesmo com o alvo a 90° do rumo', async () => {
    const { sys, voa, rumo } = await sozinho(new THREE.Vector3(60, 1, -2)); // quase de lado
    sys.fire(ORIGEM, FRENTE, undefined, SEEKER);
    voa(0.5);
    const virou = angulo(rumo(), FRENTE);
    expect(virou).toBeLessThanOrEqual(2.2 * 0.5 + 0.02);
    expect(virou).toBeGreaterThan(2.2 * 0.5 - 0.1); // e vira de fato, o máximo que pode
  });

  it('o rumo vai se fechando sobre o alvo: depois de 0,6 s (29 m de voo) ele aponta (quase) direto para o centro do corpo', async () => {
    const alvo = new THREE.Vector3(14, 0, -40);
    const { sys, voa, rumo, foguete } = await sozinho(alvo);
    sys.fire(ORIGEM, FRENTE, undefined, SEEKER);
    voa(0.6);
    expect(foguete().life).toBeGreaterThan(0); // ainda no ar (nada no caminho)
    const ate = new THREE.Vector3(alvo.x, alvo.y + 1, alvo.z).sub(foguete().pos).normalize();
    expect(angulo(rumo(), ate)).toBeLessThan(0.08);
  });

  it('a velocidade não muda ao curvar: segue 48 m/s', async () => {
    const { sys, voa, foguete } = await sozinho(new THREE.Vector3(30, 1, -20));
    sys.fire(ORIGEM, FRENTE, undefined, SEEKER);
    voa(0.7);
    expect(foguete().velocity.length()).toBeCloseTo(48, 3);
  });

  it('alvo morto: o míssil solta e segue em linha reta, sem mudar mais de rumo', async () => {
    const { sys, alvo, voa, rumo, foguete } = await sozinho(new THREE.Vector3(40, 1, -10));
    sys.fire(ORIGEM, FRENTE, undefined, SEEKER);
    voa(0.3);
    alvo.alive = false;
    voa(FIXED_DT * 2);
    expect(foguete().target).toBeNull();
    const rumoSolto = rumo();
    voa(0.5);
    expect(angulo(rumo(), rumoSolto)).toBeLessThan(1e-6);
  });

  it('alvo exatamente atrás (180°): não dá NaN e o míssil faz a volta por cima', async () => {
    const { sys, voa, foguete } = await sozinho(new THREE.Vector3(0, 2, 60)); // o centro do corpo (y 2 + 1) fica na altura da boca: o rumo do alvo é exatamente o contrário, o eixo da curva some
    sys.fire(ORIGEM, FRENTE, undefined, SEEKER);
    voa(0.4);
    for (const v of [...foguete().velocity.toArray(), ...foguete().pos.toArray()]) expect(Number.isFinite(v)).toBe(true);
    expect(angulo(foguete().velocity.clone().normalize(), FRENTE)).toBeGreaterThan(0.5);
    expect(foguete().velocity.length()).toBeCloseTo(48, 3); // a volta não rouba nem cria velocidade
  });

  it('mira o centro do corpo, não os pés: um gigante de 20 m de altura puxa o míssil para cima', async () => {
    const { sys, alvo, voa, rumo } = await sozinho(new THREE.Vector3(0, 0, -30));
    (alvo.stats as { height: number }).height = 20; // o centro do corpo fica a 10 m do chão; os pés, a 0
    sys.fire(ORIGEM, FRENTE, undefined, SEEKER);
    voa(0.25);
    expect(rumo().y).toBeGreaterThan(0.2); // sobe (a boca está a 3 m, o centro a 10)
  });

  it('foguete comum (sem guide) não curva nunca, mesmo com um acquire ligado', async () => {
    const { sys, voa, rumo, foguete } = await sozinho(new THREE.Vector3(30, 1, -20));
    sys.fire(ORIGEM, FRENTE, undefined, weapon('rockets'));
    expect(foguete().target).toBeNull();
    voa(0.5);
    expect(angulo(rumo(), FRENTE)).toBeLessThan(1e-9);
  });

  it('o míssil teleguiado se desenha frio e o foguete comum, quente (dá para saber qual curva)', async () => {
    const { sys } = await sozinho(new THREE.Vector3(0, 1, -20));
    const pool = (sys as unknown as { pool: Array<{ mesh: THREE.Mesh }> }).pool;
    sys.fire(ORIGEM, FRENTE, undefined, SEEKER);
    sys.fire(ORIGEM, FRENTE, undefined, weapon('rockets'));
    const cor = (i: number) => (pool[i]!.mesh.material as THREE.MeshBasicMaterial).color;
    expect(cor(0).b).toBeGreaterThan(cor(0).r);
    expect(cor(1).r).toBeGreaterThan(cor(1).b);
  });

  it('clear solta o alvo e apaga o míssil (rodada nova)', async () => {
    const { sys, foguete } = await sozinho(new THREE.Vector3(0, 1, -30));
    sys.fire(ORIGEM, FRENTE, undefined, SEEKER);
    expect(foguete().target).not.toBeNull();
    sys.clear();
    expect(foguete().target).toBeNull();
    expect(foguete().life).toBe(0);
  });
});

describe('a trava (Match.seekTarget), com física de verdade: o inimigo mais centrado à frente, à vista', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  async function palco(enemyMechs = 0) {
    const physics = await PhysicsWorld.create();
    const foes = { ...DEFAULT_SETTINGS, enemyMechs, enemyAndroids: 0, technician: false };
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
    const explosoes: THREE.Vector3[] = [];
    const original = match.rockets.onExplode;
    match.rockets.onExplode = (at, dir, owner, w) => {
      explosoes.push(at.clone());
      original?.(at, dir, owner, w);
    };
    const origem = new THREE.Vector3(0, 3.3, 24.5);
    const frente = new THREE.Vector3(0, 0, -1);
    const dispara = (w = SEEKER, segundos = 4) => {
      physics.step();
      physics.step();
      match.rockets.fire(origem, frente, atirador.collider, w);
      for (let t = 0; t < segundos && explosoes.length === 0; t += FIXED_DT) {
        physics.step();
        match.rockets.fixedUpdate(FIXED_DT);
      }
    };
    const vida = (m: Vector09) => m.modules.torso + m.modules.head + m.modules.leftArm + m.modules.rightArm + m.modules.leftLeg + m.modules.rightLeg;
    return { match, physics, atirador, alvo, dispara, vida, explosoes };
  }

  it('um alvo fora do eixo, dentro do cone, é perseguido e levado: o teleguiado o acerta onde o foguete comum passa reto', async () => {
    const guiado = await palco();
    const a = guiado.alvo(7, 2); // ~23 m à frente e 7 m ao lado (17°: dentro dos 29°)
    const v0 = guiado.vida(a);
    guiado.dispara(SEEKER);
    expect(v0 - guiado.vida(a)).toBeGreaterThan(0);
    expect(guiado.explosoes[0]!.distanceTo(new THREE.Vector3(7, 1.5, 2))).toBeLessThan(4.5 + 1.3);

    const comum = await palco();
    const b = comum.alvo(7, 2);
    const w0 = comum.vida(b);
    comum.dispara(weapon('rockets'));
    expect(comum.vida(b)).toBe(w0); // o foguete sem guiagem passa pelo lado: o alvo nem é arranhado
  });

  it('sem ninguém no cone o míssil voa reto: nenhum desvio lateral até explodir', async () => {
    const { dispara, explosoes } = await palco();
    dispara(SEEKER);
    expect(explosoes).toHaveLength(1);
    expect(Math.abs(explosoes[0]!.x)).toBeLessThan(1e-6);
  });

  it('fora do cone (50° do eixo) ou além da trava (100 m), não trava: voa reto e o alvo não é tocado', async () => {
    const lado = await palco();
    const a = lado.alvo(25, 5); // ~51° do eixo
    const a0 = lado.vida(a);
    lado.dispara(SEEKER);
    expect(lado.vida(a)).toBe(a0);
    expect(Math.abs(lado.explosoes[0]!.x)).toBeLessThan(1e-6);

    const longe = await palco();
    const b = longe.alvo(4, -80); // ~105 m
    const b0 = longe.vida(b);
    longe.dispara(SEEKER);
    expect(longe.vida(b)).toBe(b0);
    expect(Math.abs(longe.explosoes[0]!.x)).toBeLessThan(1e-6);
  });

  it('uma parede no meio segura a trava (sem linha de visão): o míssil voa reto e bate na parede', async () => {
    const { alvo, physics, dispara, vida, explosoes } = await palco();
    physics.addStaticBox(new THREE.Vector3(0, 4, 15), new THREE.Vector3(14, 8, 0.5));
    const atras = alvo(6, 2);
    const v0 = vida(atras);
    dispara(SEEKER);
    expect(vida(atras)).toBe(v0);
    expect(explosoes[0]!.z).toBeGreaterThan(14); // parou na parede, na frente dela
    expect(Math.abs(explosoes[0]!.x)).toBeLessThan(1e-6);
  });

  it('com dois no cone, vai no mais centrado (o mais perto do eixo, não o mais perto da boca)', async () => {
    const { alvo, dispara, vida } = await palco();
    const lateral = alvo(9, 12); // mais perto da boca, mas a ~35° do eixo... fora: usa um ângulo menor
    lateral.respawn(new THREE.Vector3(6, 0, 4)); // ~16° do eixo, ~21 m
    const centrado = alvo(1.5, -12); // ~2° do eixo, ~37 m
    const l0 = vida(lateral);
    const c0 = vida(centrado);
    dispara(SEEKER);
    expect(c0 - vida(centrado)).toBeGreaterThan(0);
    expect(vida(lateral)).toBe(l0);
  });

  it('o aliado do jogador (Arena offline) no centro do cone NÃO é travado: o míssil vai no rebelde, ao lado', async () => {
    const { match, atirador, dispara, vida, explosoes } = await palco(6);
    const aliado = match.allies!.mechs[0]!;
    aliado.respawn(new THREE.Vector3(0, 0, 4)); // no meio do cone
    const rebeldes = match.bots.mechs.filter((m) => m.alive);
    expect(rebeldes.length).toBeGreaterThan(0);
    for (const m of rebeldes) m.respawn(new THREE.Vector3(300, 0, 300)); // todos longe, menos um
    const rebelde = rebeldes[0]!;
    rebelde.respawn(new THREE.Vector3(8, 0, 2));
    const a0 = vida(aliado as Vector09);
    dispara(SEEKER);
    expect(explosoes.length).toBe(1);
    expect(explosoes[0]!.distanceTo(new THREE.Vector3(8, 1.5, 2))).toBeLessThan(4.5 + 1.3); // foi no rebelde
    expect(vida(aliado as Vector09)).toBe(a0);
    expect(atirador.alive).toBe(true);
  });

  /** O alvo que o último míssil lançado travou (nulo: voa reto). Só olha o estado do míssil, sem voar. */
  const travado = (match: Match): unknown => (match.rockets as unknown as { pool: Array<{ life: number; target: unknown }> }).pool.find((q) => q.life > 0)?.target ?? null;

  it('a trava tem alcance próprio (lockRange): com 30 m, um alvo a 25 m trava e outro a 40 m não, mesmo dentro do cone e à vista', async () => {
    const curto = { ...SEEKER, guide: { ...SEEKER.guide!, lockRange: 30 } };
    const { match, atirador, alvo, physics } = await palco();
    const origem = new THREE.Vector3(0, 3.3, 24.5);
    const frente = new THREE.Vector3(0, 0, -1);
    const a = alvo(2, -0.5); // ~25 m da boca
    physics.step();
    physics.step();
    match.rockets.fire(origem, frente, atirador.collider, curto);
    expect(travado(match)).toBe(a);
    match.rockets.clear();
    a.respawn(new THREE.Vector3(2, 0, -15.5)); // ~40 m
    physics.step();
    physics.step();
    match.rockets.fire(origem, frente, atirador.collider, curto);
    expect(travado(match)).toBeNull();
    // E o alcance de série (90 m) trava o mesmo alvo a 40 m: o corte é da arma, não da cena.
    match.rockets.clear();
    match.rockets.fire(origem, frente, atirador.collider, SEEKER);
    expect(travado(match)).toBe(a);
  });
  it('quem atira nunca trava em si mesmo, nem com o próprio corpo dentro do cone (a boca mira de volta para ele)', async () => {
    const { match, atirador, physics } = await palco();
    physics.step();
    physics.step();
    // O atirador está em (0, 0, 25); da boca em (-6, 3,3, 10) olhando para +Z, ele fica a ~22° do eixo, dentro do cone de 29°.
    match.rockets.fire(new THREE.Vector3(-6, 3.3, 10), new THREE.Vector3(0, 0, 1), atirador.collider, SEEKER);
    expect(travado(match)).toBeNull();
  });

  it('o jogador nunca trava em si mesmo: sozinho na partida, o míssil voa reto', async () => {
    const { dispara, explosoes, atirador, vida } = await palco();
    const antes = vida(atirador);
    dispara(SEEKER);
    expect(Math.abs(explosoes[0]!.x)).toBeLessThan(1e-6);
    expect(vida(atirador)).toBe(antes);
  });
});
