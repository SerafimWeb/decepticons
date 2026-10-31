import { ehModulo, massaDoModulo, type ModuloId } from '../combat/modulos';
import { isMetalShieldId, metalShieldMass, METAL_SHIELDS, type MetalShieldId } from '../combat/MetalShield';
import { weapon, WEAPON_IDS, type Loadout, type Tier, type WeaponId, type WeaponStats } from '../combat/weapons';
import { ARM_SLOTS, CHASSIS, CHASSIS_SIZE, METAL_SHIELD_CHASSIS, type ChassisId } from '../entities/chassis';
import { triggersOf } from '../entities/MechBase';
import { attackOf, shoulderMounts, type Attack, type MountId } from '../combat/mounts';
import { classFor, WEAPON_CLASSES, type WeaponClass } from '../combat/weaponClass';
import { EXTRA_SLOTS, MOUNT_DO_EXTRA, type ExtraSlot } from '../combat/encaixesExtras';

/**
 * Contrato do Hangar (AGENTS, regra 5: o contrato entra antes da tela). Uma montagem é só ids e níveis
 * (`LoadoutSpec`): é o que se salva no aparelho, o que vai num link de build e, no multiplayer, o que o
 * cliente manda ao servidor. Os números (dano, calor, massa) nunca viajam: quem valida lê do próprio
 * catálogo (`combat/weapons.ts`) e do chassi (`entities/chassis.ts`), e o servidor faz a mesma conta.
 *
 * Regras (especificação em `.decepticons/HANGAR.md`):
 * - cada chassi diz o que vai em cada braço (`ARM_SLOTS`): no Vector-09, energia no direito e munição no
 *   esquerdo; no andróide, blaster no direito e motosserra no esquerdo; o esquerdo pode ficar vazio. O Marauder tem um
 *   terceiro encaixe, os ombros (um lançador em cada), e as duas mãos dele atiram no botão principal;
 * - a soma das massas cabe na **carga** do chassi (`weaponCapacity`): poder custa carga;
 * - nível bloqueado (progressão, quando existir) é recusado.
 * Sem Three.js nem DOM: roda igual no navegador, nos testes e no servidor.
 */

/** Versão do formato. Mudou o formato? Nova versão, e a antiga continua sendo lida ou vira a de fábrica. */
export const LOADOUT_VERSION = 1;

export interface ArmSpec {
  /** Uma arma, ou um escudo físico (`METAL_SHIELD_IDS`), que só vai na mão esquerda dos chassis compatíveis. */
  id: WeaponId | MetalShieldId;
  tier: Tier;
}

export interface LoadoutSpec {
  v: 1 | 2 | 3;
  /** O módulo extra: um gerador de energia ou os óculos de visão noturna (`visao`, P282). */
  module?: ModuloId | null;
  chassis: ChassisId;
  /** Braço direito (Vector-09: energia; andróide: blaster). */
  right: ArmSpec;
  /** Braço esquerdo (Vector-09: munição; andróide: motosserra; Marauder: a segunda arma do botão principal), ou nada. */
  left: ArmSpec | null;
  /** Ombros: o lançador dos dois ombros, ou nada. Só existe nos chassis que têm o encaixe (`ARM_SLOTS`); ausente = vazio. */
  shoulders?: ArmSpec | null;
  /** Os encaixes extras (P282): as costas e cada ombro. Ausente ou `null` = vazio; só existem nos chassis que os têm (`ARM_SLOTS`). Com algum deles cheio, a chave vai na versão 3. */
  back?: ArmSpec | null;
  rightShoulder?: ArmSpec | null;
  leftShoulder?: ArmSpec | null;
  /**
   * Qual layout de gatilhos o chassi usa (`MechStats.layouts`, P95): como os encaixes se dividem entre o Ataque 1 e o Ataque 2. Ausente ou 0 = o padrão. **Só na versão 2** (a chave de texto
   * leva um último grupo `L<n>` quando é diferente de 0). Só os chassis com mais de um layout aceitam um valor diferente de 0.
   */
  layout?: number;
}
export type LoadoutError = 'formato' | 'chassi' | 'arma' | 'nível' | 'encaixe' | 'carga' | 'bloqueado';

export type LoadoutCheck =
  | { ok: true; loadout: Loadout; mass: number; capacity: number }
  | { ok: false; error: LoadoutError; detail: string; mass: number; capacity: number };

/** A montagem de fábrica do Vector-09 (a que todo mundo tem sem mexer no Hangar). */
export const FACTORY_LOADOUT: LoadoutSpec = {
  v: LOADOUT_VERSION,
  chassis: 'vector09',
  right: { id: 'plasma', tier: 0 },
  left: { id: 'rockets', tier: 0 },
};

export type ArmSlot = 'right' | 'left' | 'shoulders' | ExtraSlot;

/** O encaixe que representa cada ranhura do Hangar (os dois ombros contam pelo direito: sempre atiram no mesmo ataque). */
export const SLOT_MOUNT: Readonly<Record<ArmSlot, MountId>> = { right: 'rightHand', left: 'leftHand', shoulders: 'rightShoulder', ...MOUNT_DO_EXTRA };

/** O ataque (1, o clique; 2, o clique direito) que aciona a ranhura neste chassi, pelo layout de gatilhos dele (`combat/mounts.ts`). */
export function slotAttack(slot: ArmSlot, chassis: ChassisId, layout = 0): Attack | null {
  return attackOf(triggersOf(CHASSIS[chassis], layout), SLOT_MOUNT[slot]);
}

/** Quantos layouts de gatilho o chassi oferece (1 = não há o que escolher). */
export const layoutCount = (chassis: ChassisId): number => CHASSIS[chassis].layouts?.length ?? 1;

/** Armas que cabem num encaixe do chassi (padrão: Vector-09), na ordem do catálogo. Sem o encaixe, nenhuma. */
export function armOptions(slot: ArmSlot, chassis: ChassisId = 'vector09'): readonly WeaponId[] {
  return ARM_SLOTS[chassis][slot] ?? [];
}

/** O chassi tem este encaixe extra (P282: as costas ou um ombro de peso)? */
export const temEncaixeExtra = (chassis: ChassisId, slot: ExtraSlot): boolean => ARM_SLOTS[chassis][slot] !== undefined;

/** Os encaixes extras que o chassi tem, na ordem da lista do Hangar (vazia para quem não tem nenhum). */
export const extrasDoChassi = (chassis: ChassisId): readonly ExtraSlot[] => EXTRA_SLOTS.filter((slot) => temEncaixeExtra(chassis, slot));

/**
 * As armas do encaixe agrupadas pela classe que o **chassi** enxerga (leves, médias, pesadas; grupo vazio não existe), cada grupo na
 * ordem do catálogo (`armOptions`). Num gigante as pesadas dos Mechs vêm como leves (`combat/weaponClass.ts`). É a ordem da lista do Hangar.
 */
export function armGroups(slot: ArmSlot, chassis: ChassisId = 'vector09'): ReadonlyArray<{ cls: WeaponClass; ids: readonly WeaponId[] }> {
  const size = CHASSIS_SIZE[chassis];
  const options = armOptions(slot, chassis);
  return WEAPON_CLASSES.map((cls) => ({ cls, ids: options.filter((id) => classFor(id, size) === cls) })).filter((g) => g.ids.length > 0);
}

/** O chassi aceita o escudo metálico na mão esquerda? */
export function acceptsMetalShield(chassis: ChassisId): boolean {
  return METAL_SHIELD_CHASSIS.includes(chassis);
}

/** O encaixe leva o escudo metálico? */
export const isMetalShield = (a: ArmSpec | null | undefined): a is ArmSpec & { id: MetalShieldId } => isMetalShieldId(a?.id);

/** O chassi tem o encaixe dos ombros (e, com ele, as duas mãos no botão principal)? */
export function hasShoulderSlot(chassis: ChassisId): boolean {
  return ARM_SLOTS[chassis].shoulders !== undefined;
}

const armOf = (w: WeaponStats | null | undefined): ArmSpec | null => (w ? { id: w.id, tier: w.tier } : null);

/** A montagem de fábrica de um chassi (as armas com que ele sai da fábrica, no nível delas). */
export function factorySpec(chassis: ChassisId): LoadoutSpec {
  const base = factorySpecDoBraco(chassis);
  const extras = EXTRA_SLOTS.filter((slot) => CHASSIS[chassis].loadout[slot]);
  if (extras.length === 0) return base;
  // Com encaixe extra de fábrica (P294: a chuva nas costas do Colossus-01) a montagem vai na versão 3, completa: a chave e o texto têm todos os campos e voltam iguais.
  const spec: LoadoutSpec = { v: 3, chassis, right: base.right, left: base.left ?? null, shoulders: base.shoulders ?? null, module: null, back: null, rightShoulder: null, leftShoulder: null };
  for (const slot of extras) spec[slot] = armOf(CHASSIS[chassis].loadout[slot]!);
  return spec;
}

function factorySpecDoBraco(chassis: ChassisId): LoadoutSpec {
  const l = CHASSIS[chassis].loadout;
  const right = armOf(l.primary)!;
  if (l.metalShield != null) return { v: LOADOUT_VERSION, chassis, right, left: { ...l.metalShield } };
  // Com ombros, o gatilho secundário é dos ombros e a mão esquerda leva a segunda arma do principal.
  if (hasShoulderSlot(chassis)) return { v: LOADOUT_VERSION, chassis, right, left: armOf(l.offhand), shoulders: armOf(l.secondary) };
  return { v: LOADOUT_VERSION, chassis, right, left: armOf(l.secondary) };
}

/** Cada arma da montagem que atira, uma por encaixe (o lançador dos ombros vale dois): carga, calor e dano se somam daqui. */
export function specWeapons(spec: LoadoutSpec): WeaponStats[] {
  const chassis = CHASSIS[spec.chassis];
  const out: (ArmSpec | null)[] = [spec.right, spec.left];
  for (const slot of EXTRA_SLOTS) out.push(spec[slot] ?? null);
  if (spec.shoulders) for (let i = 0; i < shoulderMounts(triggersOf(chassis, spec.layout)).length; i++) out.push(spec.shoulders);
  return out.filter((a): a is ArmSpec => a !== null && !isMetalShield(a)).map((a) => weapon(a.id as WeaponId, a.tier));
}

const isTier = (t: unknown): t is Tier => t === 0 || t === 1 || t === 2;
const isArm = (a: unknown): a is ArmSpec =>
  typeof a === 'object' && a !== null && typeof (a as ArmSpec).id === 'string' && 'tier' in a;

/**
 * Valida uma montagem vinda de qualquer lugar (armazenamento, link, rede): nada é confiado. Devolve as
 * armas prontas para o Mech, ou o motivo da recusa. `unlocked(id, tier)`: nível liberado? (padrão: tudo).
 */
export function validateLoadout(spec: unknown, unlocked: (id: WeaponId, tier: Tier) => boolean = () => true): LoadoutCheck {
  const fail = (error: LoadoutError, detail: string, mass = 0, capacity = 0): LoadoutCheck => ({ ok: false, error, detail, mass, capacity });
  if (typeof spec !== 'object' || spec === null) return fail('formato', 'montagem vazia');
  const s = spec as Partial<LoadoutSpec>;
  if (s.v !== 1 && ((s.v !== 2 && s.v !== 3) || s.module === undefined)) return fail('formato', `versão ${String(s.v)} desconhecida`);
  if (typeof s.chassis !== 'string' || !Object.hasOwn(CHASSIS, s.chassis)) return fail('chassi', `chassi ${String(s.chassis)} não existe`);
  const chassis = CHASSIS[s.chassis];
  const capacity = chassis.weaponCapacity;
  if (!isArm(s.right)) return fail('formato', 'braço direito vazio', 0, capacity);
  if (s.left !== null && !isArm(s.left)) return fail('formato', 'braço esquerdo inválido', 0, capacity);
  const layout = s.layout ?? 0;
  if (!Number.isInteger(layout) || layout < 0 || layout >= layoutCount(s.chassis)) return fail('encaixe', `o ${chassis.name} não tem o layout ${String(s.layout)}`, 0, capacity);
  if (layout > 0 && s.v === 1) return fail('formato', 'layout só nas versões 2 e 3', 0, capacity);
  const shoulders = s.shoulders ?? null;
  if (shoulders !== null && !isArm(shoulders)) return fail('formato', 'ombros inválidos', 0, capacity);
  if (shoulders !== null && !hasShoulderSlot(s.chassis)) return fail('encaixe', `o ${chassis.name} não tem lançadores nos ombros`, 0, capacity);
  for (const slot of EXTRA_SLOTS) {
    const arm = s[slot] ?? null;
    if (arm !== null && !isArm(arm)) return fail('formato', 'encaixe extra inválido', 0, capacity);
    if (arm !== null && !temEncaixeExtra(s.chassis, slot)) return fail('encaixe', `o ${chassis.name} não tem esse encaixe`, 0, capacity);
  }
  const arms: [ArmSlot, ArmSpec][] = [['right', s.right]];
  if (s.left) arms.push(['left', s.left]);
  if (shoulders) arms.push(['shoulders', shoulders]);
  for (const slot of EXTRA_SLOTS) {
    const arm = s[slot];
    if (arm) arms.push([slot, arm]);
  }
  const where = { right: 'braço direito', left: 'braço esquerdo', shoulders: 'ombros', back: 'costas', rightShoulder: 'ombro direito', leftShoulder: 'ombro esquerdo' } as const;
  for (const [slot, arm] of arms) {
    if (isMetalShield(arm)) {
      if (slot !== 'left' || !acceptsMetalShield(s.chassis)) return fail('encaixe', `o ${chassis.name} não tem suporte para o ${METAL_SHIELDS[arm.id].name}`, 0, capacity);
      if (!isTier(arm.tier)) return fail('nível', `nível ${String(arm.tier)} não existe`, 0, capacity);
      continue;
    }
    if (!(WEAPON_IDS as readonly string[]).includes(arm.id)) return fail('arma', `arma ${String(arm.id)} não existe`, 0, capacity);
    if (!isTier(arm.tier)) return fail('nível', `nível ${String(arm.tier)} não existe`, 0, capacity);
    if (!armOptions(slot, s.chassis).includes(arm.id as WeaponId)) return fail('encaixe', `${weapon(arm.id as WeaponId).name} não vai no ${where[slot]} do ${chassis.name}`, 0, capacity);
    if (!unlocked(arm.id as WeaponId, arm.tier)) return fail('bloqueado', `${weapon(arm.id as WeaponId, arm.tier).name} ainda bloqueado`, 0, capacity);
  }
  // Só os extras que o chassi tem entram na montagem (os outros não existem para ele).
  const extrasSpec: Partial<Record<ExtraSlot, ArmSpec | null>> = {};
  for (const slot of EXTRA_SLOTS) if (temEncaixeExtra(s.chassis, slot)) extrasSpec[slot] = s[slot] ?? null;
  const spec2 = { v: LOADOUT_VERSION, chassis: s.chassis, right: s.right, left: s.left ?? null, shoulders, ...extrasSpec, ...(layout > 0 ? { layout } : {}) } satisfies LoadoutSpec;
  // Carga: cada arma conta uma vez por encaixe em que atira (o lançador dos ombros vale dois).
  const module = s.module ?? null;
  if (module !== null && (s.v === 1 || !ehModulo(module))) return fail('formato', 'módulo inválido ou versão incompatível', 0, capacity);
  if (module && s.chassis === 'android') return fail('encaixe', 'Andróide não possui encaixe de módulo', 0, capacity);
  // Quem já enxerga no escuro de fábrica (o Arara, o Lancer) não leva os óculos: o módulo existe para os outros (P282).
  if (module === 'visao' && chassis.visaoNoturna) return fail('encaixe', `o ${chassis.name} já enxerga no escuro de fábrica`, 0, capacity);
  const plate = isMetalShield(s.left) ? s.left : null;
  const mass = specWeapons(spec2).reduce((sum, w) => sum + w.mass, 0) + (module ? massaDoModulo(module) : 0) + (plate ? metalShieldMass(plate.id, plate.tier) : 0);
  if (mass > capacity + 1e-9) return fail('carga', `${mass} t de armas numa carga de ${capacity} t`, mass, capacity);
  // Com ombros, o gatilho secundário é deles e a mão esquerda leva a segunda arma do principal.
  const left = s.left && !plate ? weapon(s.left.id as WeaponId, s.left.tier) : null;
  const primary = weapon(s.right.id as WeaponId, s.right.tier);
  const loadout: Loadout = hasShoulderSlot(s.chassis)
    ? { primary, offhand: left, secondary: shoulders ? weapon(shoulders.id as WeaponId, shoulders.tier) : null }
    : { primary, secondary: left };
  for (const slot of EXTRA_SLOTS) {
    if (!(slot in extrasSpec)) continue;
    const arm = extrasSpec[slot];
    loadout[slot] = arm ? weapon(arm.id as WeaponId, arm.tier) : null;
  }
  if (s.v !== 1) loadout.module = module;
  if (layout > 0) loadout.layout = layout;
  if (plate) loadout.metalShield = { id: plate.id, tier: plate.tier };
  return { ok: true, loadout, mass, capacity };
}

/**
 * Montagem em texto curto, para link de build e para o multiplayer: `v1.vector09.plasma-2.rockets-0`
 * (encaixe vazio = `-`). Os chassis com ombros levam um terceiro grupo: `v1.marauder.blaster-0.blaster-0.rockets-0`.
 * `parseLoadoutKey` devolve null se o texto não for uma montagem.
 */
export function loadoutKey(spec: LoadoutSpec): string {
  const arm = (a: ArmSpec | null | undefined) => (a ? `${a.id}-${a.tier}` : '-');
  // Com algum encaixe extra cheio, a chave vai na versão 3 (as montagens antigas seguem iguais, e um cliente antigo lê a sua como antes).
  if (EXTRA_SLOTS.some((slot) => spec[slot])) return `v3.${spec.chassis}.${arm(spec.right)}.${arm(spec.left)}.${arm(spec.shoulders)}.${spec.module ?? '-'}.${arm(spec.back)}.${arm(spec.rightShoulder)}.${arm(spec.leftShoulder)}${spec.layout ? `.L${spec.layout}` : ''}`;
  const base = `v${spec.v}.${spec.chassis}.${arm(spec.right)}.${arm(spec.left)}`;
  if (spec.v === 2) return `${base}.${arm(spec.shoulders)}.${spec.module ?? '-'}${spec.layout ? `.L${spec.layout}` : ''}`;
  return hasShoulderSlot(spec.chassis) ? `${base}.${arm(spec.shoulders)}` : base;
}

export function parseLoadoutKey(key: string): LoadoutSpec | null {
  if (key.trim().startsWith('v3.')) {
    const parts = key.trim().split('.');
    // v3.<chassi>.<direito>.<esquerdo>.<ombros>.<módulo>.<costas>.<ombro D>.<ombro E>[.L<n>]: nove grupos, o décimo é o layout.
    if (parts.length !== 9 && !(parts.length === 10 && /^L[1-9]$/.test(parts[9]!))) return null;
    const a = (x: string | undefined): unknown => (x === '-' ? null : /^([a-z]+)-([0-2])$/.test(x ?? '') ? { id: x!.slice(0, -2), tier: Number(x!.at(-1)) } : undefined);
    const [right, left, shoulders, back, rightShoulder, leftShoulder] = [a(parts[2]), a(parts[3]), a(parts[4]), a(parts[6]), a(parts[7]), a(parts[8])];
    if ([right, left, shoulders, back, rightShoulder, leftShoulder].includes(undefined)) return null;
    const spec = {
      v: 3,
      chassis: parts[1],
      right,
      left,
      shoulders,
      module: parts[5] === '-' ? null : parts[5],
      back,
      rightShoulder,
      leftShoulder,
      ...(parts.length === 10 ? { layout: Number(parts[9]!.slice(1)) } : {}),
    };
    return validateLoadout(spec).ok ? (spec as LoadoutSpec) : null;
  }
  if (key.trim().startsWith('v2.')) {
    const parts = key.trim().split('.');
    // O 7º grupo (`L1`...) é o layout de gatilhos, só quando não é o padrão.
    if (parts.length !== 6 && !(parts.length === 7 && /^L[1-9]$/.test(parts[6]!))) return null;
    const a=(x:string|undefined):unknown => x==='-'?null:(/^([a-z]+)-([0-2])$/.test(x??'')?{id:x!.slice(0,-2),tier:Number(x!.at(-1))}:undefined);
    if (a(parts[2]) === undefined || a(parts[3]) === undefined || a(parts[4]) === undefined) return null;
    const spec={v:2,chassis:parts[1],right:a(parts[2]),left:a(parts[3]),shoulders:a(parts[4]),module:parts[5]==='-'?null:parts[5],...(parts.length === 7 ? { layout: Number(parts[6]!.slice(1)) } : {})};
    return validateLoadout(spec).ok ? spec as LoadoutSpec : null;
  }
  // O id do chassi leva maiúscula (`lancerL1`, `lr7lBastion`): com [a-z0-9] esses chassis não voltavam do texto do link nem da rede.
  const m = /^v(\d+)\.([a-zA-Z0-9]+)\.([a-z]+)-(\d)\.(?:([a-z]+)-(\d)|-)(\.(?:([a-z]+)-(\d)|-))?$/.exec(key.trim());
  if (!m) return null;
  const spec = {
    v: Number(m[1]),
    chassis: m[2],
    right: { id: m[3], tier: Number(m[4]) },
    left: m[5] ? { id: m[5], tier: Number(m[6]) } : null,
    // O terceiro grupo (ombros) só existe no texto dos chassis que têm o encaixe; sem ele, a chave não leva a chave `shoulders`.
    ...(m[7] === undefined ? {} : { shoulders: m[8] ? { id: m[8], tier: Number(m[9]) } : null }),
  };
  return validateLoadout(spec).ok ? (spec as LoadoutSpec) : null;
}
