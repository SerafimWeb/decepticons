import { describe, expect, it } from 'vitest';
import { CHASSIS, COLOSSUS_BOSS_STATS, ehTita } from '../entities/chassis';
import { VECTOR09_STATS } from '../entities/chassis';
import { armaDoBot, DANO_DO_CERCO_DO_BOT, statsDoBot, TITA_RESPAWN_S } from './titaBot';
import { weapon } from './weapons';

describe('o titã como bot', () => {
  it('quem é titã: os dois Colossus, e só eles', () => {
    expect((Object.keys(CHASSIS) as (keyof typeof CHASSIS)[]).filter(ehTita).sort()).toEqual(['colossus01', 'colossusv4']);
  });

  it('o Colossus-01 bot é o chefe da Sobrevivência (plasma e foguetes), não o Colossus do Hangar (canhão e chuva)', () => {
    expect(statsDoBot('colossus01')).toBe(COLOSSUS_BOSS_STATS);
    expect(statsDoBot('colossus01').loadout.primary.id).toBe('plasma');
    expect(CHASSIS.colossus01.loadout.primary.id).toBe('cannon'); // o do jogador segue como era
  });

  it('o Colossus-V4 bot atira o canhão de cerco com dano reduzido: o primeiro tiro não derruba um Vector-09 inteiro, o segundo derruba', () => {
    const v4 = statsDoBot('colossusv4');
    expect(v4.loadout.primary.id).toBe('siege');
    expect(v4.loadout.primary.damage).toBeCloseTo(weapon('siege').damage * DANO_DO_CERCO_DO_BOT);
    expect(v4.loadout.primary.fireInterval).toBe(weapon('siege').fireInterval); // a cadência é a da arma
    const torso = VECTOR09_STATS.maxModuleHealth.torso;
    expect(v4.loadout.primary.damage).toBeLessThan(torso);
    expect(v4.loadout.primary.damage * 2).toBeGreaterThanOrEqual(torso);
    // O do jogador (CHASSIS) não muda: a regra é só do bot.
    expect(CHASSIS.colossusv4.loadout.primary.damage).toBe(weapon('siege').damage);
  });

  it('só o canhão de cerco do titã é reduzido: a arma escolhida de um Mech comum e as outras armas saem intactas', () => {
    expect(armaDoBot('siege', 0, 'colossusv4').damage).toBeCloseTo(weapon('siege').damage * DANO_DO_CERCO_DO_BOT);
    expect(armaDoBot('plasma', 0, 'colossus01')).toEqual(weapon('plasma'));
    expect(armaDoBot('plasma', 2, 'vector09')).toEqual(weapon('plasma', 2));
    expect(armaDoBot('siege', 0, 'vector09')).toEqual(weapon('siege')); // (não existe na prática; a regra é do titã)
    expect(statsDoBot('vector09')).toBe(CHASSIS.vector09);
    expect(statsDoBot('marauder')).toBe(CHASSIS.marauder);
  });

  it('o titã volta devagar: é um evento, não um respawn de 4 s', () => {
    expect(TITA_RESPAWN_S).toBeGreaterThanOrEqual(30);
  });
});
