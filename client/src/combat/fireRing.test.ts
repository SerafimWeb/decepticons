import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { EnergyShield, FIRE_RING, SHIELDS } from './EnergyShield';
import { STATUS } from './StatusEffects';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;

/**
 * Dono, 11/10: *"o fogo também pode ser um tipo de escudo, que solta um círculo de fogo ao redor do Mech, queimando tudo ao redor durante alguns segundos, e
 * aumentando o calor geral de tudo (inclusive do próprio robô que o soltou); assim podemos fazer combos: congelar [o inimigo] e soltar o anel no meio de uma
 * rushada ou tankada"*. O anel é um módulo de escudo (`fire`): mesma tecla, mesma energia, mesmo HUD; não segura tiro, queima em volta.
 */
describe('anel de fogo: o módulo e os números', () => {
  it('é um terceiro módulo de escudo, com 3 t, 100 de energia a 20 por segundo (5 s ligado) e raio de 7 m', () => {
    expect(Object.keys(SHIELDS)).toEqual(['frontal', 'sphere', 'fire']);
    expect(SHIELDS.fire).toBe(FIRE_RING);
    expect(FIRE_RING.mass).toBe(3);
    expect(FIRE_RING.capacity / FIRE_RING.drain).toBe(5);
    expect(FIRE_RING.radius).toBe(7);
    expect(FIRE_RING.pulse).toBe(0.25);
  });

  it('o calor é para todos e dói: 0,16 por segundo (ferve em ~6 s) e o dano do pulso é de 12 por segundo, mais o queimando (6 por segundo)', () => {
    expect(FIRE_RING.heat / FIRE_RING.pulse).toBeCloseTo(0.16, 5);
    expect(1 / (FIRE_RING.heat / FIRE_RING.pulse)).toBeGreaterThan(5.5); // o dono não ferve antes dos 5 s de anel
    expect(FIRE_RING.damage / FIRE_RING.pulse).toBe(12);
    expect(STATUS.burnDps).toBeGreaterThanOrEqual(6);
    expect(FIRE_RING.melt).toBeGreaterThan(FIRE_RING.damage * 10);
  });

  it('a recarga é lenta (8 por segundo, depois de 4 s desligado): é golpe de equipe, não escudo para andar ligado', () => {
    expect(FIRE_RING.regen).toBeLessThan(10);
    expect(FIRE_RING.recovery).toBeGreaterThanOrEqual(4);
    expect(FIRE_RING.minStart).toBeGreaterThanOrEqual(40);
    const cheio = FIRE_RING.capacity / FIRE_RING.regen;
    expect(cheio).toBeGreaterThan(10); // de vazio a cheio, mais de 10 s
  });
});

describe('anel de fogo: o gerador (EnergyShield)', () => {
  const ligado = (kind: 'fire' | 'frontal' = 'fire') => {
    const s = new EnergyShield();
    s.equip(kind);
    return s;
  };
  const segura = (s: EnergyShield, segundos: number, held = true): number => {
    let pulsos = 0;
    for (let i = 0, n = Math.round(segundos / FIXED_DT); i < n; i++) {
      s.step(FIXED_DT, held);
      if (s.consumePulse()) pulsos++;
    }
    return pulsos;
  };

  it('pulsa ao ligar e a cada 0,25 s enquanto está ligado: 8 pulsos em 2 s', () => {
    expect(segura(ligado(), 2)).toBe(8);
  });

  it('desligado não pulsa, e o gerador de barreira ligado também não (o pulso é do anel)', () => {
    expect(segura(ligado(), 2, false)).toBe(0);
    expect(segura(ligado('frontal'), 2)).toBe(0);
  });

  it('dura 5 s (100 de energia a 20 por segundo) e depois desliga mesmo com a tecla apertada; sem soltar a tecla, não religa', () => {
    const s = ligado();
    segura(s, 4.9);
    expect(s.active).toBe(true);
    segura(s, 0.3);
    expect(s.active).toBe(false);
    expect(s.energy).toBe(0);
    expect(segura(s, 2)).toBe(0); // tecla ainda apertada: precisa soltar
    expect(s.active).toBe(false);
  });

  it('só liga com 40 de energia ou mais', () => {
    const s = ligado();
    s.energy = 39;
    segura(s, 0.1);
    expect(s.active).toBe(false);
    s.energy = 41;
    segura(s, 0.1);
    expect(s.active).toBe(true);
  });

  it('não segura tiro: absorve zero e não gasta energia com o impacto (a barreira, sim)', () => {
    const anel = ligado();
    segura(anel, 0.1);
    const antes = anel.energy;
    expect(anel.absorb(50, 0, 0, -1, 0, 0)).toBe(50);
    expect(anel.energy).toBe(antes);
    const barreira = ligado('frontal');
    segura(barreira, 0.1);
    expect(barreira.absorb(50, 0, 0, -1, 0, 0)).toBeLessThan(50);
  });

  it('recarrega devagar: 4 s depois de desligado, a 8 por segundo', () => {
    const s = ligado();
    segura(s, 3);
    segura(s, 0.05, false);
    const depois = s.energy;
    segura(s, 3.5, false); // dentro dos 4 s de espera: não enche
    expect(s.energy).toBe(depois);
    segura(s, 2, false);
    expect(s.energy).toBeGreaterThan(depois + 4);
    expect(s.energy - depois).toBeLessThan(FIRE_RING.regen * 2.2);
  });

  it('reiniciar (renascer) zera o relógio do pulso: o anel novo pulsa ao ligar de novo', () => {
    const s = ligado();
    segura(s, 0.1);
    s.reset();
    expect(s.consumePulse()).toBe(false);
    expect(segura(s, 0.05)).toBe(1);
  });
});

describe('anel de fogo: o que o pulso faz em volta (Match, com física)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  /** Uma partida sem bots, só com os Mechs que o teste põe. O dono fica em (0, 0, 25) com o anel ligado; os alvos entram por perto. */
  async function palco() {
    const physics = await PhysicsWorld.create();
    const foes = { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false };
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false });
    const dono = new Vector09();
    match.addPlayer(dono, 'Dono');
    dono.respawn(new THREE.Vector3(0, 0, 25));
    dono.energyShield.equip('fire');
    const outros: Vector09[] = [];
    const alvo = (x: number, z: number, y = 0): Vector09 => {
      const m = new Vector09();
      match.addPlayer(m, `Alvo${outros.length}`);
      m.respawn(new THREE.Vector3(x, y, z));
      outros.push(m);
      return m;
    };
    const cmd = (shield: boolean): MechInput => ({ moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false, shield });
    /** Um segundo (ou o tempo dado) com a tecla do anel apertada: o Mech passo a passo e a partida, como o servidor. */
    const liga = (segundos: number, shield = true) => {
      for (let i = 0, n = Math.round(segundos / FIXED_DT); i < n; i++) {
        dono.fixedUpdate(cmd(shield), FIXED_DT);
        match.step(FIXED_DT);
      }
    };
    const vida = (m: Vector09) => m.modules.torso + m.modules.head + m.modules.leftArm + m.modules.rightArm + m.modules.leftLeg + m.modules.rightLeg;
    return { match, physics, dono, alvo, liga, vida, cmd };
  }

  it('um inimigo dentro do raio pega fogo e perde vida; o que está fora, não', async () => {
    const { dono, alvo, liga, vida } = await palco();
    const perto = alvo(0, 20); // 5 m
    const longe = alvo(0, 6); // 19 m
    const vidaPerto = vida(perto);
    const vidaLonge = vida(longe);
    liga(1);
    expect(dono.energyShield.active).toBe(true);
    expect(perto.status.burning).toBe(true);
    expect(vida(perto)).toBeLessThan(vidaPerto - 12); // 4 pulsos de 3 e o queimando
    expect(longe.status.burning).toBe(false);
    expect(vida(longe)).toBe(vidaLonge);
  });

  it('o raio é medido até a superfície do corpo: um alvo com o centro a 8 m (superfície a 6,7 m) é pego, e a 8,6 m (7,3 m), não', async () => {
    const { alvo, liga } = await palco();
    const dentro = alvo(0, 17); // centro a 8,0 m; raio 1,3
    const fora = alvo(5, 25 - Math.sqrt(8.6 ** 2 - 25)); // centro a 8,6 m
    liga(0.3);
    expect(dentro.status.burning).toBe(true);
    expect(fora.status.burning).toBe(false);
  });

  it('o anel só alcança 4 m acima e abaixo: quem está num andar de cima não é pego', async () => {
    const { match, dono, alvo } = await palco();
    const alto = alvo(0, 20, 8);
    const normal = alvo(2, 20);
    match.fireRing.pulse(dono, { foes: [[alto, normal]], friends: [] });
    expect(alto.status.burning).toBe(false);
    expect(normal.status.burning).toBe(true);
  });

  it('o calor é para todos: o inimigo, o aliado e o próprio dono esquentam (o dono não se queima nem leva dano)', async () => {
    const { match, dono, alvo, vida } = await palco();
    const inimigo = alvo(0, 20);
    const aliado = new Vector09();
    match.addPlayer(aliado, 'Aliado');
    aliado.respawn(new THREE.Vector3(3, 0, 22));
    const vidaDono = vida(dono);
    const vidaAliado = vida(aliado);
    const sides = { foes: [[inimigo]], friends: [[aliado]] };
    for (let i = 0; i < 4; i++) match.fireRing.pulse(dono, sides); // 1 s de anel, sem esfriar entre os pulsos
    expect(inimigo.heat).toBeGreaterThanOrEqual(4 * FIRE_RING.heat - 1e-9); // e ainda o calor do dano que levou (a blindagem esquenta)
    expect(inimigo.heat).toBeLessThan(0.25);
    expect(aliado.heat).toBeCloseTo(4 * FIRE_RING.heat, 2);
    expect(dono.heat).toBeCloseTo(4 * FIRE_RING.heat, 2);
    expect(vida(dono)).toBe(vidaDono);
    expect(dono.status.burning).toBe(false);
    expect(aliado.status.burning).toBe(false); // aliado só esquenta
    expect(vida(aliado)).toBe(vidaAliado); // e não leva dano
  });

  it('com o anel ligado pelo tick do Mech, o calor do dono sobe ~0,16 por segundo (não esfria enquanto pulsa)', async () => {
    const { dono, alvo, liga } = await palco();
    alvo(0, 20);
    liga(1);
    expect(dono.heat).toBeGreaterThan(0.12);
    expect(dono.heat).toBeLessThan(0.2);
  });

  it('o dano é pelo mesmo caminho do lança-chamas: o abate é de quem soltou o anel', async () => {
    const { match, dono, alvo, liga } = await palco();
    const frágil = alvo(0, 20);
    const feridas: Array<{ shooter?: unknown; killed: boolean }> = [];
    match.combat.onMechHit = (e) => feridas.push({ shooter: e.shooter, killed: e.result.killed });
    for (const k of Object.keys(frágil.modules) as Array<keyof typeof frágil.modules>) frágil.modules[k] = 1;
    liga(0.3);
    expect(frágil.alive).toBe(false);
    const abate = feridas.find((f) => f.killed);
    expect(abate?.shooter).toBe(dono);
  });

  it('a chapa cerâmica levantada isola o fogo do anel (térmico): o alvo não pega fogo; a reativa deixa passar', async () => {
    const arm = VECTOR09_STATS.maxModuleHealth.leftArm;
    const ceramica = await palco();
    const a = ceramica.alvo(0, 20);
    a.applyFacing(Math.PI, 0); // de frente para o dono
    a.metalShield.equip({ id: 'refratario', tier: 0 }, arm);
    a.guard(true);
    ceramica.liga(0.3);
    expect(a.status.burning).toBe(false);

    const reativa = await palco();
    const b = reativa.alvo(0, 20);
    b.applyFacing(Math.PI, 0);
    b.metalShield.equip({ id: 'reativo', tier: 0 }, arm);
    b.guard(true);
    reativa.liga(0.3);
    expect(b.status.burning).toBe(true);
  });

  it('o combo gelo + fogo: o congelado que o anel pega derrete (leva o dano extra, já com o +20% do gelo) e o gelo some', async () => {
    const livre = await palco();
    const a = livre.alvo(0, 20);
    const vidaA = livre.vida(a);
    livre.match.fireRing.pulse(livre.dono, { foes: [[a]], friends: [] });
    const sem = vidaA - livre.vida(a);

    const gelo = await palco();
    const b = gelo.alvo(0, 20);
    for (let i = 0; i < 3; i++) b.status.chillUp();
    expect(b.status.isFrozen).toBe(true);
    const vidaB = gelo.vida(b);
    gelo.match.fireRing.pulse(gelo.dono, { foes: [[b]], friends: [] });
    const com = vidaB - gelo.vida(b);
    expect(b.status.isFrozen).toBe(false); // derreteu
    expect(b.status.burning).toBe(true);
    expect(com).toBeGreaterThanOrEqual(sem + FIRE_RING.melt - 1);
    expect(com).toBeGreaterThanOrEqual((FIRE_RING.damage + FIRE_RING.melt) * STATUS.frozenDamage - 2); // o +20% do congelado entra
  });

  it('o estouro do derretimento é uma vez só: no pulso seguinte o alvo (já descongelado) leva só o pulso normal', async () => {
    const { match, dono, alvo, vida } = await palco();
    const b = alvo(0, 20);
    for (let i = 0; i < 3; i++) b.status.chillUp();
    const sides = { foes: [[b]], friends: [] };
    match.fireRing.pulse(dono, sides);
    const depoisDoPrimeiro = vida(b);
    match.fireRing.pulse(dono, sides);
    expect(depoisDoPrimeiro - vida(b)).toBeLessThanOrEqual(FIRE_RING.damage + 1);
  });

  it('Mech morto é ignorado e o dono morto não pulsa', async () => {
    const { match, dono, alvo } = await palco();
    const a = alvo(0, 20);
    a.damagePart('torso', 1e6);
    expect(a.alive).toBe(false);
    expect(match.fireRing.pulse(dono, { foes: [[a]], friends: [] })).toBe(0);
    expect(a.status.burning).toBe(false);
    const b = alvo(0, 21);
    dono.damagePart('torso', 1e6);
    expect(match.fireRing.pulse(dono, { foes: [[b]], friends: [] })).toBe(0);
    expect(b.status.burning).toBe(false);
  });

  it('o cliente online (dano desligado) não aplica nada: o servidor decide e o cliente só desenha', async () => {
    const { match, dono, alvo } = await palco();
    const a = alvo(0, 20);
    match.combat.damageEnabled = false;
    expect(match.fireRing.pulse(dono, { foes: [[a]], friends: [] })).toBe(0);
    expect(a.status.burning).toBe(false);
    expect(a.heat).toBe(0);
    expect(dono.heat).toBe(0);
  });

  it('sem o módulo (ou com a barreira) a partida não solta anel: segurar a tecla não queima ninguém', async () => {
    const { dono, alvo, liga } = await palco();
    const a = alvo(0, 20);
    dono.energyShield.equip('frontal');
    liga(1);
    expect(a.status.burning).toBe(false);
    dono.energyShield.equip(null);
    liga(0.5);
    expect(a.status.burning).toBe(false);
  });

  it('parar de apertar a tecla para o anel: depois de soltar, nenhum pulso novo', async () => {
    const { dono, alvo, liga, vida } = await palco();
    const a = alvo(0, 20);
    liga(0.5);
    liga(0.1, false);
    expect(dono.energyShield.active).toBe(false);
    a.status.reset(); // apaga o queimando que já estava
    const antes = vida(a);
    liga(1, false);
    expect(vida(a)).toBe(antes);
    expect(a.status.burning).toBe(false);
  });

  it('o anel dura 5 s: depois disso o inimigo parado dentro dele para de tomar pulsos (só o queimando acaba de correr)', async () => {
    const { dono, alvo, liga, vida } = await palco();
    const a = alvo(0, 20);
    const inicial = vida(a);
    liga(5.2);
    expect(dono.energyShield.active).toBe(false);
    const aos5 = vida(a);
    // 5 s de anel: ~20 pulsos de 3 (60) e o queimando contínuo (6 por segundo, 30): ~90 de dano no total.
    expect(inicial - aos5).toBeGreaterThan(80);
    expect(inicial - aos5).toBeLessThan(120);
    liga(6, true); // tecla ainda apertada: não religa sem soltar
    const depois = vida(a);
    expect(aos5 - depois).toBeLessThanOrEqual(STATUS.burnDps * STATUS.burnTime + 1); // só o queimando que restava
  });
});
