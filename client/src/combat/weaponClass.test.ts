import { describe, expect, it } from 'vitest';
import { ARM_SLOTS, CHASSIS, CHASSIS_SIZE, COLOSSUS_BOSS_STATS, type ChassisId } from '../entities/chassis';
import { armGroups, armOptions, factorySpec, validateLoadout } from '../hangar/loadout';
import { classAt, classFor, CLASS_LABEL, CLASS_LABEL_PLURAL, fitsSize, WEAPON_CLASSES, WEAPON_FIT, type WeaponClass } from './weaponClass';
import { WEAPON_IDS, weapon, type WeaponId } from './weapons';

const ids = (cls: WeaponClass): WeaponId[] => WEAPON_IDS.filter((id) => WEAPON_FIT[id].class === cls);

describe('classes de arma: leve, média e pesada (ordem P82 do Comandante)', () => {
  it('toda arma do catálogo declara a classe e o tamanho de robô para o qual foi feita (hoje, só o canhão de cerco é do tamanho 3)', () => {
    expect(Object.keys(WEAPON_FIT).sort()).toEqual([...WEAPON_IDS].sort());
    for (const id of WEAPON_IDS) {
      expect(WEAPON_CLASSES, id).toContain(WEAPON_FIT[id].class);
      expect(WEAPON_FIT[id].size, id).toBe(id === 'siege' ? 3 : 2);
    }
  });

  it('a tabela: leves, médias e pesadas (mudar uma arma de grupo é mudar uma linha e esta lista)', () => {
    expect(ids('light').sort()).toEqual(['arc', 'blaster', 'chainsaw', 'emp', 'shotgun', 'swarm']);
    expect(ids('medium').sort()).toEqual(['autocannon', 'cryo', 'grenade', 'harpoon', 'laser', 'plasma', 'rockets', 'rotary', 'seeker', 'sonic']);
    expect(ids('heavy').sort()).toEqual(['barrage', 'cannon', 'cruise', 'flamer', 'railgun', 'siege']);
  });

  it('as três classes têm nome de tela, no singular e no plural', () => {
    expect(WEAPON_CLASSES.map((c) => CLASS_LABEL[c])).toEqual(['LEVE', 'MÉDIA', 'PESADA']);
    expect(WEAPON_CLASSES.map((c) => CLASS_LABEL_PLURAL[c])).toEqual(['LEVES', 'MÉDIAS', 'PESADAS']);
  });

  it('as armas dos Mechs mais pesadas em média: leves < médias < pesadas na carga do nível I (a classe não é o peso, mas anda junto)', () => {
    const media = (cls: WeaponClass): number => ids(cls).reduce((s, id) => s + weapon(id).mass, 0) / ids(cls).length;
    expect(media('light')).toBeLessThan(media('medium'));
    expect(media('medium')).toBeLessThan(media('heavy'));
  });

  it('no tamanho 2 (o padrão do jogo) cada arma é da própria classe', () => {
    for (const id of WEAPON_IDS) expect(classFor(id, 2), id).toBe(WEAPON_FIT[id].size === 2 ? WEAPON_FIT[id].class : null);
  });

  it('num gigante (tamanho 3) a pesada dos Mechs é a leve dele; a média e a leve dos Mechs são pequenas demais', () => {
    for (const id of ids('heavy').filter((x) => WEAPON_FIT[x].size === 2)) expect(classFor(id, 3), id).toBe('light');
    for (const id of [...ids('medium'), ...ids('light')]) {
      expect(classFor(id, 3), id).toBeNull();
      expect(fitsSize(id, 3), id).toBe(false);
    }
  });

  it('no tamanho 4 só a pesada do tamanho 3 serve (e ela é a leve dele): as outras versões ainda não existem', () => {
    for (const id of WEAPON_IDS) {
      const fit = WEAPON_FIT[id];
      const esperado = fit.size === 3 && fit.class === 'heavy' ? 'light' : null;
      expect(classFor(id, 4), id).toBe(esperado);
    }
  });

  it('no andróide (tamanho 1) a conta desce: a leve dos Mechs é a pesada dele; média e pesada dos Mechs são grandes demais', () => {
    for (const id of ids('light')) expect(classFor(id, 1), id).toBe('heavy');
    for (const id of [...ids('medium'), ...ids('heavy')]) expect(classFor(id, 1), id).toBeNull();
  });

  it('a regra para as armas futuras: a pesada do tamanho N é a leve do N+1, e um Mech não carrega a média nem a pesada do tamanho 3', () => {
    const pesada3 = { class: 'heavy', size: 3 } as const;
    const media3 = { class: 'medium', size: 3 } as const;
    const leve3 = { class: 'light', size: 3 } as const;
    expect(classAt(leve3, 3)).toBe('light');
    expect(classAt(media3, 3)).toBe('medium');
    expect(classAt(pesada3, 3)).toBe('heavy');
    expect(classAt(pesada3, 4)).toBe('light'); // a pesada do 3 é a leve do 4
    expect(classAt(media3, 4)).toBeNull();
    expect(classAt(leve3, 2)).toBe('heavy'); // a leve do tamanho 3 é a pesada do 2: a mesma arma vista dos dois lados
    expect(classAt(media3, 2)).toBeNull(); // grande demais para um Mech
    expect(classAt(pesada3, 2)).toBeNull();
    expect(classAt({ class: 'heavy', size: 2 }, 3)).toBe('light'); // o caso do Comandante, pela mesma conta
  });

  it('nenhuma arma declara a classe leve num tamanho acima do 2: a leve do tamanho N+1 já existe, é a pesada do N (as versões de tamanho 3 e 4 são médias e pesadas)', () => {
    for (const id of WEAPON_IDS) {
      if (WEAPON_FIT[id].size > 2) expect(WEAPON_FIT[id].class, id).not.toBe('light');
    }
  });
});

describe('o tamanho de cada chassi e o que cada encaixe oferece', () => {
  it('todo chassi declara o tamanho: andróide 1, Colossus 3, o titã 4 e o resto dos Mechs 2', () => {
    const chassis = Object.keys(CHASSIS) as ChassisId[];
    expect(Object.keys(CHASSIS_SIZE).sort()).toEqual([...chassis].sort());
    expect(CHASSIS_SIZE.android).toBe(1);
    expect(CHASSIS_SIZE.colossus01).toBe(3);
    expect(CHASSIS_SIZE.colossusv4).toBe(4);
    for (const c of chassis.filter((x) => x !== 'android' && x !== 'colossus01' && x !== 'colossusv4')) expect(CHASSIS_SIZE[c], c).toBe(2);
  });

  it('nenhum encaixe de nenhum chassi oferece uma arma que o tamanho do chassi não carrega', () => {
    for (const c of Object.keys(ARM_SLOTS) as ChassisId[]) {
      const slots = ARM_SLOTS[c];
      for (const lista of [slots.right, slots.left, slots.shoulders ?? []]) {
        for (const id of lista) expect(fitsSize(id, CHASSIS_SIZE[c]), `${c}: ${id}`).toBe(true);
      }
    }
  });

  it('o gigante oferece as pesadas dos Mechs (que para ele são leves) e o canhão de cerco, o pesado do tamanho dele', () => {
    expect(armOptions('right', 'colossus01')).toEqual(['flamer', 'cannon', 'siege', 'railgun', 'cruise']);
    expect(armOptions('left', 'colossus01')).toEqual(['cannon', 'siege', 'railgun', 'barrage', 'cruise']);
    for (const slot of ['right', 'left'] as const) {
      // As armas dos Mechs são leves para ele; o canhão de cerco (tamanho 3) é a pesada dele.
      for (const id of armOptions(slot, 'colossus01')) expect(classFor(id, CHASSIS_SIZE.colossus01), id).toBe(id === 'siege' ? 'heavy' : 'light');
    }
  });

  it('os Mechs (tamanho 2) seguem com todas as classes: nada que eles já levavam saiu', () => {
    expect(armOptions('right', 'vector09')).toEqual(expect.arrayContaining(['plasma', 'rotary', 'railgun', 'blaster']));
    expect(armOptions('left', 'vector09')).toEqual(expect.arrayContaining(['rockets', 'barrage', 'plasma']));
    expect(armOptions('right', 'onca')).toEqual(expect.arrayContaining(['flamer', 'cannon', 'rockets', 'plasma']));
    expect(armOptions('shoulders', 'marauder')).toEqual(['rockets', 'barrage', 'sonic', 'seeker', 'swarm', 'cruise', 'grenade', 'harpoon']);
  });

  it('o Colossus do jogador sai da fábrica com as armas do tamanho dele (canhão pesado e chuva) e a montagem vale; o chefe segue com plasma e foguetes', () => {
    const fabrica = factorySpec('colossus01');
    expect(fabrica.right?.id).toBe('cannon');
    expect(fabrica.left?.id).toBe('barrage');
    expect(validateLoadout(fabrica).ok).toBe(true);
    expect(COLOSSUS_BOSS_STATS.loadout.primary?.id).toBe('plasma');
    expect(COLOSSUS_BOSS_STATS.loadout.secondary?.id).toBe('rockets');
  });

  it('a montagem antiga do Colossus (plasma e foguetes) é recusada: são armas médias, pequenas para um gigante', () => {
    const antiga = { v: 1 as const, chassis: 'colossus01' as const, right: { id: 'plasma' as const, tier: 0 as const }, left: { id: 'rockets' as const, tier: 0 as const } };
    expect(validateLoadout(antiga)).toMatchObject({ ok: false, error: 'encaixe' });
  });
});

describe('o Hangar agrupa as armas pela classe que o chassi enxerga', () => {
  it('no Vector-09: leves, médias e pesadas, nessa ordem, e os grupos são a lista inteira sem repetir nada', () => {
    for (const slot of ['right', 'left'] as const) {
      const grupos = armGroups(slot, 'vector09');
      expect(grupos.map((g) => g.cls)).toEqual(['light', 'medium', 'heavy']);
      const todos = grupos.flatMap((g) => g.ids);
      expect([...todos].sort()).toEqual([...armOptions(slot, 'vector09')].sort());
      expect(new Set(todos).size).toBe(todos.length);
      for (const g of grupos) for (const id of g.ids) expect(WEAPON_FIT[id].class, id).toBe(g.cls);
    }
  });

  it('cada grupo segue a ordem do catálogo do encaixe', () => {
    const lista = armOptions('right', 'vector09');
    for (const g of armGroups('right', 'vector09')) {
      const posicoes = g.ids.map((id) => lista.indexOf(id));
      expect(posicoes, g.cls).toEqual([...posicoes].sort((a, b) => a - b));
    }
  });

  it('no Colossus as pesadas dos Mechs vêm como LEVE (e o cerco, tamanho 3, como PESADA); grupo vazio não aparece', () => {
    expect(armGroups('right', 'colossus01')).toEqual([
      { cls: 'light', ids: ['flamer', 'cannon', 'railgun', 'cruise'] },
      { cls: 'heavy', ids: ['siege'] },
    ]);
    expect(armGroups('shoulders', 'vector09')).toEqual([]); // sem ombros, sem grupo
  });

  it('o Marauder agrupa os ombros: o lançador leve é leve; o sônico, os foguetes e o míssil teleguiado são médios; a chuva e o cruzador são pesados', () => {
    expect(armGroups('shoulders', 'marauder')).toEqual([
      { cls: 'light', ids: ['swarm'] },
      { cls: 'medium', ids: ['rockets', 'sonic', 'seeker', 'grenade', 'harpoon'] },
      { cls: 'heavy', ids: ['barrage', 'cruise'] },
    ]);
  });
});
