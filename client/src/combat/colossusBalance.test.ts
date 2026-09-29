import { describe, expect, it } from 'vitest';
import { COLOSSUS_BOSS_STATS, VECTOR09_STATS } from '../entities/chassis';
import { sustainedDps, timeToKill } from './balance';

/**
 * Metas de equilíbrio do Colossus-01, medidas com as ferramentas da oficina (`balance.ts`) — que rodam as
 * mesmas regras do tick: cadência, carregador de foguetes e o dissipador de calor do Mech. É a resposta
 * numérica ao pedido do dono (29/09): *"ele não pode ser absurdamente forte... pra que possamos ter combates
 * épicos e com inteligência, conseguirmos superar eles"*.
 *
 * As metas são deliberadamente frouxas em relação ao resultado: elas travam a **faixa** (nem saco de
 * pancadas, nem parede), e qualquer mudança de número que saia da faixa reprova o teste.
 */
const PLAYER = [VECTOR09_STATS.loadout.primary, VECTOR09_STATS.loadout.secondary!];

describe('Colossus-01: alvo durável, não parede', () => {
  it('as pernas caem bem antes do torso — é o caminho da vitória', () => {
    const leg = timeToKill(PLAYER, VECTOR09_STATS, COLOSSUS_BOSS_STATS.maxModuleHealth.leftLeg);
    const torso = timeToKill(PLAYER, VECTOR09_STATS, COLOSSUS_BOSS_STATS.maxModuleHealth.torso);
    expect(leg).toBeLessThanOrEqual(10);
    expect(torso).toBeLessThanOrEqual(30);
    expect(leg * 2).toBeLessThan(torso);
  });

  it('não é um saco de pancadas: o torso aguenta mais de dez segundos de gatilho apertado', () => {
    const torso = timeToKill(PLAYER, VECTOR09_STATS, COLOSSUS_BOSS_STATS.maxModuleHealth.torso);
    expect(torso).toBeGreaterThanOrEqual(10);
  });

  it('não tem arma melhor que um rebelde comum — nada de "um tiro mata o Mech"', () => {
    const bossDps = sustainedDps(VECTOR09_STATS.loadout.primary, COLOSSUS_BOSS_STATS, 30);
    const rebelDps = sustainedDps(VECTOR09_STATS.loadout.primary, VECTOR09_STATS, 30);
    // O que o Colossus tem de diferente é vida e espaço, não peso de fogo: a arma é a mesma dos rebeldes.
    expect(bossDps).toBeLessThanOrEqual(rebelDps * 1.05);
  });
});
