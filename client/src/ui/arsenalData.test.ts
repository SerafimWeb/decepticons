import { describe, expect, it } from 'vitest';
import { WEAPON_CLASSES } from '../combat/weaponClass';
import { DAMAGE_TYPE, weapon, WEAPON_IDS } from '../combat/weapons';
import { CHASSIS, CHASSIS_SIZE, type ChassisId } from '../entities/chassis';
import { CHASSIS_DOS_BOTS } from '../sim/esquadrao';
import { classeNoTamanho, fichasDasArmas, fichasDosChassis, notasDaArma, NATUREZA_ROTULO, rotuloDaClasse } from './arsenalData';

describe('as fichas das armas (a janela ARSENAL)', () => {
  const fichas = fichasDasArmas();

  it('há uma ficha por arma do catálogo, nenhuma a mais nem a menos', () => {
    expect(fichas.map((f) => f.id).sort()).toEqual([...WEAPON_IDS].sort());
  });

  it('os números são os do catálogo (nada copiado): dano, alcance, calor, carga, cadência e natureza', () => {
    for (const f of fichas) {
      const w = weapon(f.id);
      expect(f.nome, f.id).toBe(w.name);
      expect(f.dano, f.id).toBe(w.damage);
      expect(f.alcanceOtimo, f.id).toBe(w.optimalRange);
      expect(f.alcanceMaximo, f.id).toBe(w.maxRange);
      expect(f.calorPorTiro, f.id).toBe(w.heatPerShot);
      expect(f.massa, f.id).toBe(w.mass);
      expect(f.tirosPorSegundo, f.id).toBeCloseTo(1 / w.fireInterval, 1);
      expect(f.natureza, f.id).toBe(DAMAGE_TYPE[f.id]);
      expect(NATUREZA_ROTULO[f.natureza], f.id).toBeTruthy();
    }
  });

  it('o DPS só existe para o tiro simples (dano ÷ intervalo); chuva, chamas, onda, rotatória e teleguiado não têm essa conta', () => {
    const plasma = fichas.find((f) => f.id === 'plasma')!;
    expect(plasma.danoPorSegundo).toBeCloseTo(weapon('plasma').damage / weapon('plasma').fireInterval, 0);
    for (const id of ['barrage', 'flamer', 'sonic', 'rotary', 'seeker'] as const) {
      if (WEAPON_IDS.includes(id)) expect(fichas.find((f) => f.id === id)!.danoPorSegundo, id).toBeNull();
    }
  });

  it('vêm da classe leve para a pesada, e cada ficha tem classe válida e pelo menos um chassi que a leva', () => {
    const ordem = fichas.map((f) => WEAPON_CLASSES.indexOf(f.classe));
    expect(ordem).toEqual([...ordem].sort((a, b) => a - b));
    for (const f of fichas) {
      expect(WEAPON_CLASSES).toContain(f.classe);
      expect(f.chassis.length, `${f.id} não é carregada por nenhum chassi`).toBeGreaterThan(0);
    }
  });

  it('o canhão de cerco é só dos titãs, com a carga de 3 s anotada', () => {
    const cerco = fichas.find((f) => f.id === 'siege')!;
    expect(cerco.chassis).toEqual(['colossusv4']);
    expect(cerco.notas.join(' ')).toMatch(/carrega 3 s/);
  });

  it('as notas dizem só o que a arma tem de próprio', () => {
    expect(notasDaArma(weapon('plasma'))).toEqual([]);
    expect(notasDaArma(weapon('rotary')).join(' ')).toMatch(/gira o cano/);
    expect(notasDaArma(weapon('flamer')).join(' ')).toMatch(/cone de fogo/);
    expect(notasDaArma(weapon('rockets')).join(' ')).toMatch(/munição/);
    expect(notasDaArma(weapon('barrage')).join(' ')).toMatch(/chuva de/);
    expect(notasDaArma(weapon('arc')).join(' ')).toMatch(/chocado/);
    expect(notasDaArma(weapon('cryo')).join(' ')).toMatch(/gelado/);
    expect(notasDaArma(weapon('flamer')).join(' ')).toMatch(/queimando/);
  });

  it('a classe depende do tamanho de quem carrega: a pesada dos Mechs é a leve do gigante, e a leve dos Mechs não cabe nele', () => {
    expect(classeNoTamanho('cannon', 3)).toBe('light');
    expect(classeNoTamanho('blaster', 3)).toBeNull();
    expect(rotuloDaClasse('medium')).toBe('MÉDIA');
  });
});

describe('as fichas dos chassis', () => {
  const fichas = fichasDosChassis(CHASSIS_DOS_BOTS);

  it('há uma ficha por chassi, do menor para o maior, com os números do catálogo', () => {
    expect(fichas.map((f) => f.id).sort()).toEqual((Object.keys(CHASSIS) as ChassisId[]).sort());
    expect(fichas.map((f) => f.tamanho)).toEqual([...fichas.map((f) => f.tamanho)].sort((a, b) => a - b));
    for (const f of fichas) {
      const c = CHASSIS[f.id];
      expect(f.tamanho, f.id).toBe(CHASSIS_SIZE[f.id]);
      expect(f.vidaDoTorso, f.id).toBe(c.maxModuleHealth.torso);
      expect(f.vidaTotal, f.id).toBeGreaterThanOrEqual(f.vidaDoTorso);
      expect(f.velocidade, f.id).toBe(c.moveSpeed);
      expect(f.carga, f.id).toBe(c.weaponCapacity);
      expect(f.papel.length, f.id).toBeGreaterThan(10);
    }
  });

  it('o andróide é o menor, os Colossus os maiores, e só o Mech sem peso de titã pula', () => {
    expect(fichas[0]!.id).toBe('android');
    expect(fichas.slice(-2).map((f) => f.id).sort()).toEqual(['colossus01', 'colossusv4']);
    expect(fichas.find((f) => f.id === 'colossusv4')!.pula).toBe(false);
    expect(fichas.find((f) => f.id === 'vector09')!.pula).toBe(true);
  });

  it('a coluna BOT é a lista do esquadrão: todos menos o andróide, e vazia quando ninguém é passado', () => {
    expect(fichas.filter((f) => f.bot).length).toBe(CHASSIS_DOS_BOTS.length);
    expect(fichas.find((f) => f.id === 'android')!.bot).toBe(false);
    expect(fichas.find((f) => f.id === 'colossusv4')!.bot).toBe(true);
    expect(fichasDosChassis().every((f) => !f.bot)).toBe(true);
  });

  it('os encaixes contam as armas de cada mão: o Vector-09 tem mais na direita que o andróide', () => {
    const v = fichas.find((f) => f.id === 'vector09')!;
    const a = fichas.find((f) => f.id === 'android')!;
    expect(v.direita.length).toBeGreaterThan(a.direita.length);
    expect(a.esquerda).toEqual([weapon('chainsaw').name]);
  });
});
