import { describe, expect, it } from 'vitest';
import type { RosterEntry } from '../../../shared/net/messages';
import { Android } from '../entities/Android';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import { IMPORTED_CHASSIS } from '../entities/importedMechAssets';
import { Vector09 } from '../entities/Vector09';
import { factorySpec, loadoutKey } from '../hangar/loadout';
import { criarRemoto } from './remotoDoRoster';

const humano = (chassi: ChassisId): RosterEntry => ({ id: 7, kind: 'human', name: 'Dan', build: loadoutKey(factorySpec(chassi)) });
const semMalha = () => null;
const temMalha = (c: ChassisId) => !!IMPORTED_CHASSIS[c];

describe('o robô de outra pessoa na sala online (P214): o chassi real, não o Vector-09 amarelo', () => {
  it('cada chassi chega com os números dele (tamanho, colisão), não com os do Vector-09; os de silhueta própria usam o desenho próprio', () => {
    for (const c of Object.keys(CHASSIS) as ChassisId[]) {
      if (c === 'android') continue;
      const { mech } = criarRemoto(humano(c), semMalha, temMalha);
      expect(mech.stats, c).toBe(CHASSIS[c]);
      expect(mech instanceof Vector09, c).toBe(true); // sem a malha pronta: a silhueta do chassi
    }
    expect(CHASSIS.colossusv4.height).not.toBe(CHASSIS.vector09.height); // o teste só vale se os números diferem
  });

  it('a malha importada que ainda baixa deixa o robô PENDENTE (o jogo o refaz quando ela chega); o chassi sem malha nunca fica pendente', () => {
    expect(criarRemoto(humano('marauder'), semMalha, temMalha).pendente).toBe('marauder');
    expect(criarRemoto(humano('colossusv4'), semMalha, temMalha).pendente).toBe('colossusv4');
    expect(criarRemoto(humano('vector09'), semMalha, temMalha).pendente).toBeNull();
    expect(criarRemoto(humano('onca'), semMalha, temMalha).pendente).toBeNull();
  });

  it('montagem torta ou vazia cai no Vector-09 de fábrica (nunca lança); o andróide-piloto, os bots e o técnico seguem como sempre', () => {
    const torta = criarRemoto({ id: 7, kind: 'human', name: 'X', build: 'lixo' }, semMalha, temMalha);
    expect(torta.mech.stats).toBe(CHASSIS.vector09);
    expect(criarRemoto(humano('android'), semMalha, temMalha).mech instanceof Android).toBe(true);
    expect(criarRemoto({ id: 1, kind: 'android', name: 'A', build: '' }, semMalha, temMalha).mech instanceof Android).toBe(true);
    expect(criarRemoto({ id: 2, kind: 'technician', name: 'T', build: '' }, semMalha, temMalha).mech instanceof Android).toBe(true);
    expect(criarRemoto({ id: 3, kind: 'mech', name: 'M', build: '' }, semMalha, temMalha).mech instanceof Vector09).toBe(true);
  });
});
