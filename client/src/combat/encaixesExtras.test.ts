import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ARM_SLOTS, CHASSIS, SLOT_KIND } from '../entities/chassis';
import { COLOSSUS_01_BLUEPRINT } from '../entities/mechBlueprint';
import { Vector09 } from '../entities/Vector09';
import { FIXED_DT } from '../physics/PhysicsWorld';
import { factorySpec, loadoutKey, parseLoadoutKey, validateLoadout, type LoadoutSpec } from '../hangar/loadout';
import { Armament, type ShotSink } from './Armament';
import { EXTRA_SLOTS, armasDoEncaixeExtra, extraDaMontagem, fitsExtraSlot } from './encaixesExtras';
import { TRIGGERS_COM_COSTAS, TRIGGERS_COM_OMBROS, weaponAt, type MountId, type TriggerLayout } from './mounts';
import { weapon, type Loadout, type WeaponId, type WeaponStats } from './weapons';

describe('o teto de classe de cada encaixe extra (P282): o pesado aceita pesada, média e leve; o médio, média e leve; o leve, só leve', () => {
  it('um encaixe pesado num robô de tamanho 3 aceita canhão, trilho e o cerco; o médio, o plasma; o leve, o blaster', () => {
    expect(fitsExtraSlot('cannon', 'heavy', 3)).toBe(true); // pesada
    expect(fitsExtraSlot('railgun', 'heavy', 3)).toBe(true); // pesada
    expect(fitsExtraSlot('plasma', 'heavy', 3)).toBe(true); // média
    expect(fitsExtraSlot('blaster', 'heavy', 3)).toBe(true); // leve
    expect(fitsExtraSlot('siege', 'heavy', 3)).toBe(true); // pesada, tamanho 3
  });

  it('o teto médio não aceita pesada; o leve não aceita média nem pesada', () => {
    expect(fitsExtraSlot('cannon', 'medium', 2)).toBe(false);
    expect(fitsExtraSlot('plasma', 'medium', 2)).toBe(true);
    expect(fitsExtraSlot('blaster', 'medium', 2)).toBe(true);
    expect(fitsExtraSlot('plasma', 'light', 2)).toBe(false);
    expect(fitsExtraSlot('blaster', 'light', 2)).toBe(true);
  });

  it('o cerco (tamanho 3) não cabe num robô de tamanho 2, mesmo num encaixe pesado (o Onça não o leva)', () => {
    expect(fitsExtraSlot('siege', 'heavy', 2)).toBe(false);
    expect(armasDoEncaixeExtra(2, 'heavy')).not.toContain('siege');
  });

  it('o que gira, acende, solta chuva, salva, feixe, onda, arpão ou corte fica de fora (tem gatilho próprio, não é um tiro simples)', () => {
    const fora: WeaponId[] = ['rockets', 'cruise', 'flamer', 'rotary', 'sonic', 'chainsaw', 'seeker', 'laser', 'harpoon', 'grenade'];
    for (const id of fora) expect(fitsExtraSlot(id, 'heavy', 3), id).toBe(false);
  });

  it('o canhão e o trilho estão entre as armas que o Onça pode levar nos ombros', () => {
    const onca = armasDoEncaixeExtra(2, 'heavy');
    expect(onca).toContain('cannon');
    expect(onca).toContain('railgun');
    expect(onca).toContain('plasma');
  });

  it('o Colossus-01 e o Onça têm os encaixes extras nas listas de cada chassi; os outros chassis não têm nenhum', () => {
    for (const slot of EXTRA_SLOTS) expect(ARM_SLOTS.colossus01[slot], slot).toBeDefined();
    expect(ARM_SLOTS.onca.rightShoulder).toBeDefined();
    expect(ARM_SLOTS.onca.back).toBeUndefined(); // o Onça tem dois ombros, sem costas
    for (const id of Object.keys(CHASSIS) as (keyof typeof CHASSIS)[]) {
      if (id === 'colossus01' || id === 'onca') continue;
      expect(ARM_SLOTS[id].back, id).toBeUndefined();
      expect(ARM_SLOTS[id].rightShoulder, id).toBeUndefined();
    }
    expect(SLOT_KIND.back).toBe('back');
  });
});

describe('quem é extra numa montagem: as costas sempre, um ombro só quando a montagem tem o campo dele (o lançador duplo do Marauder segue igual)', () => {
  const base = (): Loadout => ({ primary: weapon('plasma'), secondary: weapon('rockets') });
  it('o ombro do Marauder (sem campo de extra) segue no secundário; o do Colossus (com campo, vazio) é um encaixe próprio', () => {
    expect(extraDaMontagem(base(), 'rightShoulder')).toBeNull();
    expect(weaponAt(base(), 'rightShoulder')?.id).toBe('rockets');
    const colossus: Loadout = { ...base(), rightShoulder: null };
    expect(extraDaMontagem(colossus, 'rightShoulder')).toBe('rightShoulder');
    expect(weaponAt(colossus, 'rightShoulder')).toBeNull(); // vazio: não atira o foguete do secundário
  });

  it('as costas são sempre extras, e a arma delas é o campo `back`', () => {
    expect(extraDaMontagem(base(), 'back')).toBe('back');
    expect(weaponAt({ ...base(), back: weapon('cannon') }, 'back')?.id).toBe('cannon');
    expect(weaponAt(base(), 'back')).toBeNull();
  });
});

describe('a montagem com os encaixes extras: valida, pesa, e vai ao texto (a chave) sem mudar a de quem não os tem', () => {
  const colossus = (extra: Partial<LoadoutSpec>): LoadoutSpec => ({ ...factorySpec('colossus01'), v: 3, module: null, ...extra } as LoadoutSpec); // P294: a fábrica do Colossus já é a versão 3 (a chuva nas costas)

  it('o Colossus-01 de fábrica segue igual: a chave não ganha nada e o texto de sempre continua valendo', () => {
    // P294: a chuva foi para as costas (era o braço esquerdo): a fábrica vai na versão 3 com o encaixe das costas.
    expect(loadoutKey(factorySpec('colossus01'))).toBe('v3.colossus01.cannon-0.-.-.-.barrage-0.-.-');
    expect(parseLoadoutKey('v3.colossus01.cannon-0.-.-.-.barrage-0.-.-')).not.toBeNull();
  });

  it('um canhão nas costas e um trilho no ombro direito validam, somam carga e vão na chave da versão 3', () => {
    const spec = colossus({ back: { id: 'cannon', tier: 0 }, rightShoulder: { id: 'railgun', tier: 0 } });
    const r = validateLoadout(spec);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.loadout.back?.id).toBe('cannon');
    expect(r.loadout.rightShoulder?.id).toBe('railgun');
    expect(r.loadout.leftShoulder).toBeNull();
    const base = validateLoadout(colossus({ back: null })); // sem a chuva de fábrica nas costas: o canhão entra no lugar dela
    if (!base.ok) throw new Error('a base tem que validar');
    expect(r.mass).toBeCloseTo(base.mass + weapon('cannon').mass + weapon('railgun').mass, 9);
    const chave = loadoutKey(spec);
    expect(chave.startsWith('v3.colossus01.cannon-0.-.-.-.cannon-0.railgun-0.-')).toBe(true);
    const lida = parseLoadoutKey(chave);
    expect(lida?.back).toEqual({ id: 'cannon', tier: 0 });
    expect(lida?.rightShoulder).toEqual({ id: 'railgun', tier: 0 });
    expect(lida?.leftShoulder).toBeNull();
  });

  it('o cerco nas costas do Colossus-01 cabe (tamanho 3); no ombro do Onça não', () => {
    expect(validateLoadout(colossus({ back: { id: 'siege', tier: 0 } })).ok).toBe(true);
    const onca: LoadoutSpec = { v: 2, chassis: 'onca', right: { id: 'plasma', tier: 0 }, left: { id: 'rockets', tier: 0 }, module: null, rightShoulder: { id: 'siege', tier: 0 } };
    const r = validateLoadout(onca);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('encaixe');
  });

  it('o extra de um chassi que não o tem é recusado (o Vector-09 não tem costas; o Marauder não tem o ombro extra)', () => {
    const vector: LoadoutSpec = { v: 2, chassis: 'vector09', right: { id: 'plasma', tier: 0 }, left: { id: 'rockets', tier: 0 }, module: null, back: { id: 'cannon', tier: 0 } };
    const r = validateLoadout(vector);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('encaixe');
  });

  it('uma montagem com costas carregadas acima da carga do chassi é recusada pela carga, como as outras', () => {
    // P302: a carga do Colossus é 32 t; aqui a soma passa disso (cerco de 12 t nas costas e na mão esquerda, canhões nos ombros)
    const pesada = colossus({ left: { id: 'siege', tier: 0 }, back: { id: 'siege', tier: 0 }, rightShoulder: { id: 'cannon', tier: 0 }, leftShoulder: { id: 'cannon', tier: 0 } });
    const r = validateLoadout(pesada);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('carga');
  });
});

/** Um Colossus-01 de verdade (o corpo procedural), com o gatilho dos encaixes extras e um sink que anota cada tiro. */
function bench(loadout: Loadout, triggers: TriggerLayout = TRIGGERS_COM_COSTAS, chassi: 'colossus01' | 'onca' = 'colossus01') {
  const stats = { ...CHASSIS[chassi], triggers, loadout };
  const mech = new Vector09({ stats, blueprint: COLOSSUS_01_BLUEPRINT, loadout });
  const armament = new Armament(mech);
  const shots: { mount: MountId; w: WeaponStats }[] = [];
  const foguetes: { mount: MountId; w: WeaponStats }[] = []; // P294: a chuva das costas sai por aqui (o caminho do foguete)
  const sink: ShotSink = {
    projectile: (mount, w) => shots.push({ mount, w }),
    rocket: (mount, w) => foguetes.push({ mount, w }),
    melee: () => {},
    flame: () => {},
    wave: () => {},
  };
  const hold = (seconds: number, fire: boolean, secondary: boolean): void => {
    for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++) armament.fixedUpdate(FIXED_DT, fire, secondary, sink);
  };
  const de = (mount: MountId) => shots.filter((s) => s.mount === mount);
  return { mech, armament, shots, foguetes, hold, de };
}

describe('o tiro dos encaixes extras (P282): cada um atira a sua arma pelo botão do seu ataque', () => {
  it('a chuva de mísseis nas costas (P294) sai pelo caminho do foguete no Ataque 2, e não como projétil', () => {
    const b = bench({ primary: weapon('cannon'), secondary: null, back: weapon('barrage'), rightShoulder: null, leftShoulder: null });
    b.hold(0.2, false, true);
    expect(b.foguetes.filter((f) => f.mount === 'back').map((f) => f.w.id)).toEqual(['barrage']);
    expect(b.de('back')).toHaveLength(0);
  });

  it('a arma das costas sai no Ataque 2 (o clique direito), e só ela: o lançador da mão esquerda não atira pelas costas', () => {
    const b = bench({ primary: weapon('cannon'), secondary: weapon('barrage'), back: weapon('cannon'), rightShoulder: null, leftShoulder: null });
    b.hold(0.1, false, true);
    expect(b.de('back')).toHaveLength(1);
    expect(b.de('back')[0]!.w.id).toBe('cannon');
    expect(b.shots.filter((s) => s.mount === 'leftHand' && s.w.id === 'cannon')).toHaveLength(0);
  });

  it('o Ataque 1 (o clique esquerdo) não dispara as costas: elas são do secundário', () => {
    const b = bench({ primary: weapon('cannon'), secondary: null, back: weapon('cannon'), rightShoulder: null, leftShoulder: null });
    b.hold(0.5, true, false);
    expect(b.de('back')).toHaveLength(0);
  });

  it('o cerco no ombro esquerdo carrega com o botão segurado e sai ao soltar, um tiro só (o conserto do P284 vale também aqui)', () => {
    const b = bench({ primary: weapon('cannon'), secondary: null, rightShoulder: null, leftShoulder: weapon('siege') });
    b.hold(2.6, false, true);
    expect(b.de('leftShoulder')).toHaveLength(0);
    b.hold(0.1, false, false);
    expect(b.de('leftShoulder')).toHaveLength(1);
    b.hold(0.5, false, false);
    expect(b.de('leftShoulder')).toHaveLength(1);
  });

  it('um ombro vazio não atira: o encaixe existe, a arma não', () => {
    const b = bench({ primary: weapon('cannon'), secondary: null, back: null, rightShoulder: null, leftShoulder: null });
    b.hold(0.5, false, true);
    expect(b.shots).toHaveLength(0);
  });

  it('o torso destruído cala as costas e os ombros (eles são do torso)', () => {
    const b = bench({ primary: weapon('cannon'), secondary: null, back: weapon('cannon'), rightShoulder: null, leftShoulder: null });
    b.mech.modules.torso = 0; // o torso zerado cala o encaixe (sem matar o robô: o teste não tem colisor)
    b.hold(0.5, false, true);
    expect(b.de('back')).toHaveLength(0);
  });

  it('o Onça tem os dois ombros e não tem costas: o ombro direito dispara o trilho no Ataque 2', () => {
    const b = bench({ primary: weapon('plasma'), secondary: weapon('rockets'), rightShoulder: weapon('railgun'), leftShoulder: null }, TRIGGERS_COM_OMBROS, 'onca');
    b.hold(1, false, true); // o trilho carrega 0,85 s antes do tiro
    expect(b.de('rightShoulder').some((s) => s.w.id === 'railgun')).toBe(true);
  });
});

describe('a arma de um encaixe extra aparece no robô (o desenho pendura no nó dele, não na mão)', () => {
  it('com uma arma nas costas o desenho tem a peça dela preso ao nó das costas; sem ela, não tem', () => {
    const com = new Vector09({ stats: { ...CHASSIS.colossus01, triggers: TRIGGERS_COM_COSTAS }, blueprint: COLOSSUS_01_BLUEPRINT, loadout: { primary: weapon('cannon'), secondary: null, back: weapon('siege') } });
    const peca = com.root.getObjectByName('weapon-siege');
    expect(peca).toBeDefined();
    const sem = new Vector09({ stats: { ...CHASSIS.colossus01, triggers: TRIGGERS_COM_COSTAS }, blueprint: COLOSSUS_01_BLUEPRINT, loadout: { primary: weapon('cannon'), secondary: null, back: null } });
    expect(sem.root.getObjectByName('weapon-siege')).toBeUndefined();
    // a boca fixa (`muzzles.back`) é a da simulação: o desenho não a move
    const boca = new THREE.Vector3();
    com.mountWorldPosition('back', boca);
    expect(boca.y).toBeGreaterThan(5);
  });
});
