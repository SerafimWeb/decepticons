import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { weapon } from '../combat/weapons';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { ANDROID_STATS, MARAUDER_STATS, VECTOR09_STATS } from '../entities/chassis';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { defaultPower, parsePowerKey, poweredLoadout, POWER_GOALS, powerChanges, poweredStats, poweredWeapon, powerKey, powerReport, sanitizePower } from './power';
import { withoutParam } from '../core/url';
import { POWER_STORAGE_KEY, PowerStore } from './PowerStore';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), data };
}

describe('potências: o contrato', () => {
  it('em 100%, nada muda: os mesmos objetos do jogo (nada é criado nem alocado)', () => {
    const p = defaultPower();
    expect(powerChanges(p)).toBe(0);
    expect(poweredStats(VECTOR09_STATS, p, 'mechs')).toBe(VECTOR09_STATS);
    expect(poweredWeapon(weapon('plasma'), p, 'player')).toBe(weapon('plasma'));
  });

  it('arma × clã: dano multiplica, cadência encurta o intervalo, alcance estica; a arma nova é congelada', () => {
    const p = defaultPower();
    p.weapons.plasma.damage = 1.5;
    p.weapons.plasma.rate = 2;
    p.weapons.plasma.range = 0.5;
    p.clans.player.damage = 2;
    const w = poweredWeapon(weapon('plasma'), p, 'player');
    expect(w.damage).toBe(weapon('plasma').damage * 3);
    expect(w.fireInterval).toBeCloseTo(weapon('plasma').fireInterval / 2, 6);
    expect(w.maxRange).toBe(weapon('plasma').maxRange / 2);
    expect(Object.isFrozen(w)).toBe(true);
    // O clã dos rebeldes não ganha o dano do jogador.
    expect(poweredWeapon(weapon('plasma'), p, 'mechs').damage).toBe(weapon('plasma').damage * 1.5);
  });

  it('a segunda arma do botão principal (mão esquerda do Marauder) leva a potência da arma dela, igual à da direita; em 100% é o mesmo objeto', () => {
    const p = defaultPower();
    expect(poweredLoadout(MARAUDER_STATS.loadout, p, 'player')).toBe(MARAUDER_STATS.loadout);
    p.weapons.blaster.damage = 2;
    const l = poweredLoadout(MARAUDER_STATS.loadout, p, 'player');
    expect(l.primary.damage).toBe(weapon('blaster').damage * 2);
    expect(l.offhand!.damage).toBe(weapon('blaster').damage * 2);
    expect(l.secondary).toBe(weapon('rockets')); // outra arma, outro botão: não muda
    // Quem não tem segunda arma continua sem a chave (o formato do Loadout antigo não muda).
    expect('offhand' in poweredLoadout(VECTOR09_STATS.loadout, p, 'player')).toBe(false);
  });

  it('clã: vida de cada parte, velocidade (o tempo de arrancada não muda) e calor', () => {
    const p = defaultPower();
    p.clans.androids.health = 2;
    p.clans.androids.speed = 0.5;
    p.clans.androids.heat = 3;
    const s = poweredStats(ANDROID_STATS, p, 'androids');
    expect(s.maxModuleHealth.torso).toBe(ANDROID_STATS.maxModuleHealth.torso * 2);
    expect(s.moveSpeed).toBe(ANDROID_STATS.moveSpeed / 2);
    expect(s.moveSpeed / s.groundAccel).toBeCloseTo(ANDROID_STATS.moveSpeed / ANDROID_STATS.groundAccel, 9);
    expect(s.heatRun).toBeCloseTo(ANDROID_STATS.heatRun * 3, 9);
    expect(s.height).toBe(ANDROID_STATS.height);
  });

  it('nada é confiado: lixo vira 100%, fora da faixa vai para 25% ou 400%, campo desconhecido é ignorado', () => {
    expect(powerChanges(sanitizePower(null))).toBe(0);
    expect(powerChanges(sanitizePower('p1'))).toBe(0);
    const s = sanitizePower({ weapons: { plasma: { damage: 99, rate: -1, heat: 'x' }, raiox: { damage: 2 } }, clans: { mechs: { health: 0.5 }, __proto__: { speed: 3 } } });
    expect(s.weapons.plasma.damage).toBe(4);
    expect(s.weapons.plasma.rate).toBe(0.25);
    expect(s.weapons.plasma.heat).toBe(1);
    expect(s.clans.mechs.health).toBe(0.5);
    expect(powerChanges(s)).toBe(3);
  });

  it('link: ida e volta só com o que mudou; texto que não é de potências vira null', () => {
    const p = defaultPower();
    p.weapons.rockets.heat = 0.8;
    p.clans.technician.damage = 2;
    expect(powerKey(defaultPower())).toBe('p1');
    expect(powerKey(p)).toBe('p1.rockets-c80.technician-d200');
    expect(parsePowerKey(powerKey(p))).toEqual(p);
    expect(parsePowerKey('p1')).toEqual(defaultPower());
    expect(parsePowerKey('p1.raiox-d200')).toBeNull();
    expect(parsePowerKey('p1.plasma-z100')).toBeNull();
    expect(parsePowerKey('<script>')).toBeNull();
    expect(parsePowerKey('')).toBeNull();
  });

  it('a tela mostra o que o ajuste faz com a luta, pela mesma simulação das metas', () => {
    const base = powerReport(defaultPower());
    expect(base.yourPlasma).toBeGreaterThan(POWER_GOALS.singleMin);
    expect(base.yourCombo).toBeGreaterThan(POWER_GOALS.comboMin);
    expect(base.theirPlasma).toBeCloseTo(base.yourPlasma, 6); // mesmo chassi, mesmas armas
    const strong = defaultPower();
    strong.clans.player.damage = 2;
    const r = powerReport(strong);
    expect(r.yourCombo).toBeLessThan(base.yourCombo);
    expect(r.yourCombo).toBeLessThan(POWER_GOALS.comboMin); // o painel avisa: fora da meta
    expect(r.theirPlasma).toBe(base.theirPlasma);
  });
});

describe('potências: salvas no aparelho e por link', () => {
  it('sem nada salvo, 100%; o link entra e fica salvo; voltar a 100% apaga', () => {
    expect(new PowerStore(memory(), '').changes).toBe(0);
    const store = memory();
    const fromLink = new PowerStore(store, '?potencias=p1.mechs-v50');
    expect(fromLink.current.clans.mechs.health).toBe(0.5);
    expect(new PowerStore(store, '').current.clans.mechs.health).toBe(0.5);
    fromLink.save(defaultPower());
    expect(store.data.has(POWER_STORAGE_KEY)).toBe(false);
  });

  it('salvo adulterado vira 100%; link inválido é ignorado', () => {
    expect(new PowerStore(memory({ [POWER_STORAGE_KEY]: '{quebrado' }), '').changes).toBe(0);
    expect(new PowerStore(memory(), '?potencias=hack').changes).toBe(0);
  });

  it('recarregar sem o parâmetro do link (senão o link reaplicaria o que acabou de mudar)', () => {
    expect(withoutParam('https://x.dev/cybermech/jogar/?potencias=p1.mechs-v50&build=v1', 'potencias')).toBe('https://x.dev/cybermech/jogar/?build=v1');
  });
});

describe('potências na partida', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('os rebeldes nascem com as potências do clã deles; o técnico conserta no ritmo do clã', async () => {
    const power = defaultPower();
    power.clans.mechs.health = 2;
    power.weapons.plasma.damage = 1.5;
    power.clans.androids.speed = 0.5;
    const physics = await PhysicsWorld.create();
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, power });
    const [mech] = match.bots.mechs;
    expect(mech!.stats.maxModuleHealth.torso).toBe(VECTOR09_STATS.maxModuleHealth.torso * 2);
    expect(mech!.loadout.primary.damage).toBe(Math.round(weapon('plasma').damage * 1.5));
    const android = match.bots.mechs.find((m) => m.stats.name === ANDROID_STATS.name)!;
    expect(android.stats.moveSpeed).toBe(ANDROID_STATS.moveSpeed / 2);
    expect(android.stats.maxModuleHealth.torso).toBe(ANDROID_STATS.maxModuleHealth.torso);
  });
});
