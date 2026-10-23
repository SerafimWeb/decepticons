import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { COLOSSUS_BOSS_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import { PhysicsWorld, type PhysicsHit } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { FLINCH_DECAY, FLINCH_MAX, FLINCH_PER_DAMAGE, HIT_PUSH_MAX, hitFlinch, hitPush, PUSH_PER_DAMAGE } from './reaction';
import { DAMAGE_TYPE, weapon, WEAPON_IDS, type DamageType, type WeaponStats } from './weapons';

const NO_FX = { burst: () => {} } as never;
/** O torso do rig (protegido no `MechBase`): o teste lê o que o desenho mostra. */
const torso = (m: Vector09) => (m as unknown as { rig: { torso: { rotation: { x: number; y: number } } } }).rig.torso;
const TIPOS: DamageType[] = ['termico', 'laser', 'balistico', 'explosivo', 'pulso', 'sonico', 'toxico', 'corte', 'eletrico', 'criogenico'];

/**
 * Dono, 11/10 (P69): *"melhorar impactos, local onde eles batem, reação nos inimigos"*. Todo acerto que passa pela defesa empurra o alvo e dá um tranco no torso dele, na medida do
 * que bateu: o canhão pesado joga o robô para trás, a rotatória só o incomoda, o grande resiste.
 */
describe('a conta da reação (combat/reaction): quanto cada acerto empurra e treme', () => {
  it('toda natureza de dano tem o seu valor; pulso, som, gás, corte e choque não empurram (o som e o gás têm o empurrão deles)', () => {
    expect(Object.keys(PUSH_PER_DAMAGE).sort()).toEqual([...TIPOS].sort());
    for (const t of ['pulso', 'sonico', 'toxico', 'corte', 'eletrico'] as const) expect(PUSH_PER_DAMAGE[t], t).toBe(0);
    for (const t of ['balistico', 'explosivo', 'laser', 'termico', 'criogenico'] as const) expect(PUSH_PER_DAMAGE[t], t).toBeGreaterThan(0);
  });

  it('o aço empurra mais que o fogo por ponto de dano (balístico > explosivo > laser > térmico > gelo)', () => {
    const p = PUSH_PER_DAMAGE;
    expect(p.balistico).toBeGreaterThan(p.explosivo);
    expect(p.explosivo).toBeGreaterThan(p.laser);
    expect(p.laser).toBeGreaterThan(p.termico);
    expect(p.termico).toBeGreaterThan(p.criogenico);
  });

  it('o canhão pesado (90) bate no teto de 4,5 m/s; o plasma empurra o que o dano dele vale (~0,5 m/s); o dano que passou é o que conta (escudo que absorveu tudo: zero)', () => {
    expect(hitPush(weapon('cannon'), 90)).toBe(HIT_PUSH_MAX);
    expect(hitPush(weapon('cannon'), 500)).toBe(HIT_PUSH_MAX); // o teto vale também para dano exagerado
    const plasma = weapon('plasma');
    expect(hitPush(plasma, plasma.damage)).toBeCloseTo(plasma.damage * PUSH_PER_DAMAGE.termico, 9);
    expect(hitPush(plasma, plasma.damage)).toBeLessThan(1);
    expect(hitPush(weapon('cannon'), 0)).toBe(0);
    expect(hitPush(weapon('cannon'), -5)).toBe(0);
  });

  it('o lança-chamas e a onda sônica ficam de fora (têm a regra própria), e arma de pulso, som, corte e choque não empurra nem com dano alto', () => {
    expect(hitPush(weapon('flamer'), 50)).toBe(0);
    expect(hitPush(weapon('sonic'), 50)).toBe(0);
    for (const id of WEAPON_IDS) {
      const w = weapon(id);
      if (['pulso', 'sonico', 'corte', 'eletrico'].includes(DAMAGE_TYPE[id])) expect(hitPush(w, 100), id).toBe(0);
    }
  });

  it('a rotatória só incomoda: cada acerto empurra pouco e a rajada inteira soma menos de 2,5 m/s em regime (empurrão por segundo ÷ decaimento)', () => {
    const w: WeaponStats = weapon('rotary');
    const porAcerto = hitPush(w, w.damage);
    expect(porAcerto).toBeLessThan(0.6);
    const regime = (porAcerto / w.fireInterval) / 3.5; // m/s médios com o gatilho apertado
    expect(regime).toBeLessThan(2.5);
    expect(regime).toBeGreaterThan(0.2); // mas dá para sentir
  });

  it('os dois obuseiros de aço empurram no teto por acerto direto (o canhão dos Mechs e o canhão de cerco do titã), e nenhuma outra arma chega lá', () => {
    const porAcerto = WEAPON_IDS.map((id) => ({ id, push: hitPush(weapon(id), weapon(id).damage) }));
    const noTeto = porAcerto.filter((x) => x.push >= HIT_PUSH_MAX).map((x) => x.id).sort();
    expect(noTeto).toEqual(['cannon', 'siege']);
    for (const x of porAcerto.filter((y) => y.id !== 'cannon' && y.id !== 'siege')) expect(x.push, x.id).toBeLessThan(HIT_PUSH_MAX);
  });

  it('o tranco do torso sobe com o dano, nunca passa de FLINCH_MAX e é zero sem dano', () => {
    expect(hitFlinch(0)).toBe(0);
    expect(hitFlinch(-3)).toBe(0);
    expect(hitFlinch(10)).toBeCloseTo(10 * FLINCH_PER_DAMAGE, 9);
    expect(hitFlinch(10)).toBeLessThan(hitFlinch(40));
    expect(hitFlinch(5000)).toBe(FLINCH_MAX);
    expect(FLINCH_MAX).toBeLessThan(0.2); // menos de ~11°: um tranco, não uma queda
  });
});

describe('a reação com física de verdade (CombatSystem): o acerto empurra e dá o tranco; a explosão empurra para longe do centro', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  async function palco() {
    const physics = await PhysicsWorld.create();
    const foes = { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false };
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false });
    const atirador = new Vector09();
    match.addPlayer(atirador, 'Atirador');
    atirador.respawn(new THREE.Vector3(0, 0, 25));
    const alvos: Vector09[] = [];
    const alvo = (x: number, z: number, stats?: typeof COLOSSUS_BOSS_STATS): Vector09 => {
      const m = new Vector09(stats ? { stats } : undefined);
      match.addPlayer(m, `Alvo${alvos.length}`);
      m.respawn(new THREE.Vector3(x, 0, z));
      alvos.push(m);
      return m;
    };
    physics.step();
    physics.step();
    const acerta = (m: Vector09, dano: number, w: WeaponStats, dir = new THREE.Vector3(0, 0, -1), altura = 3) => {
      const hit: PhysicsHit = { point: new THREE.Vector3(m.simPosition.x, altura, m.simPosition.z), normal: new THREE.Vector3(0, 0, 1), distance: 5, collider: m.collider };
      match.combat.onProjectileHit(hit, dir, dano, atirador.collider, w, 5);
    };
    return { match, physics, atirador, alvo, acerta };
  }

  it('um tiro de canhão pesado empurra o alvo para onde o tiro andava (-Z) com ~4,5 m/s, e o robô pequeno (Vector-09) não resiste', async () => {
    const { alvo, acerta } = await palco();
    const a = alvo(0, 5);
    acerta(a, 90, weapon('cannon'));
    expect(a.shove.z).toBeLessThan(-3);
    expect(Math.abs(a.shove.x)).toBeLessThan(1e-9);
    expect(a.shove.length()).toBeLessThanOrEqual(HIT_PUSH_MAX + 1e-9);
  });

  it('o que conta é o dano que PASSOU: uma perna com 10 de vida só perde 10 do canhão de 90, e o empurrão é o de 10 (0,5 m/s), não o de 90',  async () => {
    const { alvo, acerta } = await palco();
    const a = alvo(0, 5);
    a.modules.leftLeg = 10; // as duas pernas: o ponto do acerto é no meio do corpo e pode cair em qualquer uma
    a.modules.rightLeg = 10;
    acerta(a, 90, weapon('cannon'), new THREE.Vector3(0, 0, -1), 0.6);
    expect(a.alive).toBe(true);
    expect(Math.abs(a.shove.z)).toBeGreaterThan(0.3);
    expect(Math.abs(a.shove.z)).toBeLessThan(1); // 10 × 0,05 = 0,5; o dano cheio daria 4,5
  });

  it('o gigante resiste: o mesmo canhão empurra o Colossus bem menos (a resistência de 1,3 m ÷ raio)', async () => {
    const { alvo, acerta } = await palco();
    const pequeno = alvo(-8, 5);
    const gigante = alvo(8, 5, COLOSSUS_BOSS_STATS);
    acerta(pequeno, 90, weapon('cannon'));
    acerta(gigante, 90, weapon('cannon'));
    expect(gigante.shove.length()).toBeLessThan(pequeno.shove.length() * 0.5);
    expect(gigante.shove.length()).toBeGreaterThan(0.5); // mas não é zero
  });

  it('um tiro fraco empurra pouco e um forte, muito: a ordem do dano vale (laser < plasma < canhão)', async () => {
    const { alvo, acerta } = await palco();
    const a = alvo(-6, 5);
    const b = alvo(0, 5);
    const c = alvo(6, 5);
    acerta(a, weapon('blaster').damage, weapon('blaster'));
    acerta(b, weapon('plasma').damage, weapon('plasma'));
    acerta(c, 90, weapon('cannon'));
    expect(a.shove.length()).toBeLessThan(b.shove.length());
    expect(b.shove.length()).toBeLessThan(c.shove.length());
  });

  it('o lança-chamas, o gelo do aliado e o choque não empurram (o fogo é um fluxo; a onda sônica tem o empurrão dela)', async () => {
    const { alvo, acerta } = await palco();
    const a = alvo(0, 5);
    acerta(a, 40, weapon('flamer'));
    expect(a.shove.length()).toBe(0);
    acerta(a, 40, weapon('arc'));
    acerta(a, 40, weapon('emp'));
    expect(a.shove.length()).toBe(0);
  });

  it('a explosão empurra para LONGE do centro: um alvo a leste é jogado para +X, um a oeste para -X; quem disparou não sai do lugar', async () => {
    const { match, atirador, alvo } = await palco();
    const leste = alvo(4, 0);
    const oeste = alvo(-4, 0);
    match.combat.explode(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), atirador.collider, weapon('rockets'));
    expect(leste.shove.x).toBeGreaterThan(0.2);
    expect(oeste.shove.x).toBeLessThan(-0.2);
    expect(Math.abs(leste.shove.x + oeste.shove.x)).toBeLessThan(1e-6); // a mesma força nos dois lados
    expect(atirador.shove.length()).toBe(0);
  });

  it('quanto mais perto do centro da explosão, mais forte: o dano cai com a distância e o empurrão cai junto', async () => {
    const { match, atirador, alvo } = await palco();
    const perto = alvo(2.5, 0);
    const longe = alvo(-6, 0);
    match.combat.explode(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), atirador.collider, weapon('rockets'));
    expect(Math.abs(perto.shove.x)).toBeGreaterThan(Math.abs(longe.shove.x));
    expect(Math.abs(longe.shove.x)).toBeGreaterThan(0);
  });

  it('morto não é empurrado nem treme', async () => {
    const { alvo, acerta } = await palco();
    const a = alvo(0, 5);
    acerta(a, 9999, weapon('cannon')); // derruba
    expect(a.alive).toBe(false);
    const antes = a.shove.clone();
    acerta(a, 90, weapon('cannon'));
    expect(a.shove.equals(antes)).toBe(true);
    a.flinch(0, 1, 0.1);
    expect(a.flinchAmount).toBe(0);
  });

  it('o tranco do torso: tiro de frente inclina o torso para trás, de lado o torce, e ele volta sozinho em ~0,5 s', async () => {
    const { alvo, acerta } = await palco();
    const a = alvo(0, 5);
    a.applyFacing(0, 0); // olhando para -Z
    const base = torso(a).rotation.x;
    acerta(a, 90, weapon('cannon'), new THREE.Vector3(0, 0, 1)); // o tiro anda para +Z: bate no peito do Mech que olha para -Z
    a.render(1 / 60, 1);
    expect(torso(a).rotation.x).toBeGreaterThan(base + 0.05); // para trás
    expect(a.flinchAmount).toBeGreaterThan(0.05);
    for (let i = 0; i < 40; i++) a.render(1 / 60, 1); // 0,67 s
    expect(a.flinchAmount).toBeLessThan(0.01);
    expect(torso(a).rotation.x).toBeCloseTo(base, 1);

    const b = alvo(10, 5);
    b.applyFacing(0, 0);
    acerta(b, 90, weapon('cannon'), new THREE.Vector3(-1, 0, 0)); // o tiro anda para a esquerda do Mech (-X): pega na direita dele
    b.render(1 / 60, 1);
    expect(torso(b).rotation.y).toBeGreaterThan(0.05); // o tiro vindo da esquerda do Mech torce o torso para o lado de cá (y positivo)
    for (let i = 0; i < 40; i++) b.render(1 / 60, 1);
    expect(Math.abs(torso(b).rotation.y)).toBeLessThan(0.01); // e a torção também volta sozinha
  });

  it('o tranco nunca passa de FLINCH_MAX, nem com várias pancadas seguidas, e o aplicado na mira (applyFacing) soma por cima', async () => {
    const { alvo } = await palco();
    const a = alvo(0, 5);
    a.applyFacing(0, 0);
    for (let i = 0; i < 20; i++) a.flinch(0, 1, 0.1);
    a.applyFacing(0, 0.4); // a mira roda no render: o tranco não pode sumir quando ela escreve o torso
    expect(torso(a).rotation.x).toBeCloseTo(0.4 * 0.25 + FLINCH_MAX, 6);
    expect(a.flinchAmount).toBeLessThanOrEqual(FLINCH_MAX + 1e-12);
  });

  it('o decaimento é exponencial (FLINCH_DECAY por segundo): meio segundo de render come mais de 98% do tranco', async () => {
    const { alvo } = await palco();
    const a = alvo(0, 5);
    a.flinch(0, 1, FLINCH_MAX);
    const antes = a.flinchAmount;
    for (let i = 0; i < 30; i++) a.render(1 / 60, 1);
    expect(a.flinchAmount / antes).toBeLessThan(Math.exp(-FLINCH_DECAY * 0.5) * 1.5);
  });

  it('direção zero (a explosão exatamente sobre o robô) não dá NaN: nem empurra nem treme', async () => {
    const { alvo } = await palco();
    const a = alvo(0, 5);
    a.push(0, 0, 3);
    a.flinch(0, 0, 0.1);
    expect(a.shove.length()).toBe(0);
    expect(a.flinchAmount).toBe(0);
  });
});
