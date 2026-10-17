import { describe, expect, it } from 'vitest';
import { ARM_SLOTS, CHASSIS_SIZE, SLOT_KIND, type ChassisId } from '../entities/chassis';
import { fitsMount, KIND_MAX_CLASS, LIVE_KINDS, MOUNT_KIND_LABEL, MOUNT_KINDS, WEAPON_MOUNTS } from './mountKinds';
import { classFor, WEAPON_CLASSES } from './weaponClass';
import { WEAPON_IDS, weapon, type WeaponId } from './weapons';

const rank = (c: (typeof WEAPON_CLASSES)[number]): number => WEAPON_CLASSES.indexOf(c);

describe('tipos de encaixe: braço, ombro, costas, peito e cabeça (ordem P84 do Comandante)', () => {
  it('toda arma do catálogo declara em quais tipos de encaixe cabe (pelo menos um, sem repetir)', () => {
    expect(Object.keys(WEAPON_MOUNTS).sort()).toEqual([...WEAPON_IDS].sort());
    for (const id of WEAPON_IDS) {
      const tipos = WEAPON_MOUNTS[id];
      expect(tipos.length, id).toBeGreaterThan(0);
      expect(new Set(tipos).size, id).toBe(tipos.length);
      for (const k of tipos) expect(MOUNT_KINDS, `${id}: ${k}`).toContain(k);
    }
  });

  it('a tabela: arma de mão cabe só no braço; foguetes e chuva cabem em braço, ombro e costas; o sônico, só no ombro', () => {
    expect(WEAPON_MOUNTS.sonic).toEqual(['shoulder']);
    expect(WEAPON_MOUNTS.rockets).toEqual(['arm', 'shoulder', 'back']);
    expect(WEAPON_MOUNTS.barrage).toEqual(['arm', 'shoulder', 'back']);
    // Os mísseis novos (P152) são lançadores como os foguetes; o guiado também cabe no braço; o laser é arma de mão (feixe).
    for (const id of ['swarm', 'cruise', 'seeker'] as const) expect(WEAPON_MOUNTS[id], id).toEqual(['arm', 'shoulder', 'back']);
    expect(WEAPON_MOUNTS.laser).toEqual(['arm']);
    const soBraco = WEAPON_IDS.filter((id) => WEAPON_MOUNTS[id].length === 1 && WEAPON_MOUNTS[id][0] === 'arm').sort();
    expect(soBraco).toEqual(['arc', 'autocannon', 'blaster', 'cannon', 'chainsaw', 'cryo', 'emp', 'flamer', 'laser', 'plasma', 'railgun', 'rotary', 'shotgun', 'siege']);
  });

  it('arma de corte (a motosserra) só vai no braço: não existe motosserra de ombro, de costas, de peito nem de cabeça', () => {
    for (const id of WEAPON_IDS.filter((x) => weapon(x).kind === 'melee')) expect(WEAPON_MOUNTS[id], id).toEqual(['arm']);
  });

  it('os tipos têm nome de tela e a ordem é a do corpo', () => {
    expect(MOUNT_KINDS).toEqual(['arm', 'shoulder', 'back', 'chest', 'head']);
    expect(MOUNT_KINDS.map((k) => MOUNT_KIND_LABEL[k])).toEqual(['BRAÇO', 'OMBROS', 'COSTAS', 'PEITO', 'CABEÇA']);
  });

  it('cada tipo aceita até uma classe: braço, ombro e costas até pesada; peito até média; cabeça só leve', () => {
    expect(KIND_MAX_CLASS).toEqual({ arm: 'heavy', shoulder: 'heavy', back: 'heavy', chest: 'medium', head: 'light' });
  });

  it('cada ranhura do Hangar tem um tipo: as duas mãos são braço, os lançadores, ombro', () => {
    expect(SLOT_KIND).toEqual({ right: 'arm', left: 'arm', shoulders: 'shoulder' });
  });

  it('só braço e ombro existem de verdade; costas, peito e cabeça são reservados e nenhum chassi tem encaixe deles (mudar isto é mexer em MOUNTS, na rede e no desenho)', () => {
    expect(LIVE_KINDS).toEqual(['arm', 'shoulder']);
    for (const k of Object.values(SLOT_KIND)) expect(LIVE_KINDS, k).toContain(k);
  });
});

describe('as listas de cada chassi obedecem ao contrato (ARM_SLOTS conferido contra os tipos e as classes)', () => {
  const entradas: Array<{ chassi: ChassisId; ranhura: keyof typeof SLOT_KIND; id: WeaponId }> = [];
  for (const chassi of Object.keys(ARM_SLOTS) as ChassisId[]) {
    for (const ranhura of ['right', 'left', 'shoulders'] as const) {
      for (const id of ARM_SLOTS[chassi][ranhura] ?? []) entradas.push({ chassi, ranhura, id });
    }
  }

  it('toda arma de toda ranhura de todo chassi cabe no tipo de encaixe daquela ranhura', () => {
    expect(entradas.length).toBeGreaterThan(100);
    for (const e of entradas) expect(fitsMount(e.id, SLOT_KIND[e.ranhura]), `${e.chassi}.${e.ranhura}: ${e.id}`).toBe(true);
  });

  it('e a classe dela, na visão do chassi, não passa do que o tipo aceita', () => {
    for (const e of entradas) {
      const cls = classFor(e.id, CHASSIS_SIZE[e.chassi]);
      expect(cls, `${e.chassi}.${e.ranhura}: ${e.id}`).not.toBeNull();
      expect(rank(cls!), `${e.chassi}.${e.ranhura}: ${e.id}`).toBeLessThanOrEqual(rank(KIND_MAX_CLASS[SLOT_KIND[e.ranhura]]));
    }
  });

  it('arma só de ombro não aparece em mão nenhuma, e os ombros só oferecem armas que cabem em ombro', () => {
    for (const e of entradas) {
      if (e.ranhura === 'shoulders') expect(WEAPON_MOUNTS[e.id], e.id).toContain('shoulder');
      else expect(WEAPON_MOUNTS[e.id], `${e.chassi}.${e.ranhura}: ${e.id}`).toContain('arm');
    }
    expect(entradas.filter((e) => e.id === 'sonic').every((e) => e.ranhura === 'shoulders')).toBe(true);
  });

  it('o Marauder, o único com ombros, oferece nos ombros tudo o que cabe em ombro e já tem uma arma do tipo (foguetes, chuva, sônico, guiado, os mísseis novos, a granada e o arpão)', () => {
    expect(ARM_SLOTS.marauder.shoulders).toEqual(['rockets', 'barrage', 'sonic', 'seeker', 'swarm', 'cruise', 'grenade', 'harpoon']);
    for (const id of WEAPON_IDS.filter((x) => fitsMount(x, 'shoulder'))) expect(ARM_SLOTS.marauder.shoulders, id).toContain(id);
  });
});
