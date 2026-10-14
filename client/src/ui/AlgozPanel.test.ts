import { describe, expect, it } from 'vitest';
import { algozViewOf, type AlgozMechLike } from './AlgozPanel';

function mech(loadout: AlgozMechLike['loadout'], torso = 300, torsoMax = 350): AlgozMechLike {
  return { stats: { name: 'COLOSSUS-01', maxModuleHealth: { torso: torsoMax } }, modules: { torso }, loadout };
}

describe('painel do algoz (frente 3 da P109)', () => {
  it('lê nome, chassi, a vida do torso e as armas com o dano', () => {
    const v = algozViewOf(mech({ primary: { name: 'Canhão pesado', damage: 90 }, secondary: { name: 'Chuva de mísseis', damage: 22 } }), 'clawd');
    expect(v.nome).toBe('CLAWD');
    expect(v.chassi).toBe('COLOSSUS-01');
    expect(v.torso).toBe(300);
    expect(v.torsoMax).toBe(350);
    expect(v.armas).toEqual(['CANHÃO PESADO · 90', 'CHUVA DE MÍSSEIS · 22']);
  });

  it('não repete a arma das duas mãos (o Marauder com o mesmo blaster nas duas)', () => {
    const blaster = { name: 'Blaster leve', damage: 12 };
    const v = algozViewOf(mech({ primary: blaster, offhand: { ...blaster } }), 'X');
    expect(v.armas).toEqual(['BLASTER LEVE · 12']);
  });

  it('mostra as três armas na ordem do gatilho (principal, segunda mão, secundária) e o escudo por último', () => {
    const v = algozViewOf(mech({
      primary: { name: 'Plasma', damage: 16 },
      offhand: { name: 'Canhão automático', damage: 10 },
      secondary: { name: 'Foguetes', damage: 30 },
      metalShield: {},
    }), 'Y');
    expect(v.armas).toEqual(['PLASMA · 16', 'CANHÃO AUTOMÁTICO · 10', 'FOGUETES · 30', 'ESCUDO FÍSICO']);
  });

  it('aguenta arma sem dano declarado, vida zerada e máximo inválido', () => {
    const v = algozViewOf(mech({ primary: { name: 'Motosserra' }, secondary: null }, 0, 0), 'z');
    expect(v.armas).toEqual(['MOTOSSERRA · 0']);
    expect(v.torso).toBe(0);
    expect(v.torsoMax).toBe(1); // zero não divide a barra
  });
});
