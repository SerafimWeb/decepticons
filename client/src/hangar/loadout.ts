import { FRONTAL_SHIELD } from '../combat/EnergyShield';
import { weapon, WEAPON_IDS, type Loadout, type Tier, type WeaponId, type WeaponStats } from '../combat/weapons';
import { ARM_SLOTS, CHASSIS, type ChassisId } from '../entities/chassis';

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
  id: WeaponId;
  tier: Tier;
}

export interface LoadoutSpec {
  v: 1 | 2;
  module?: 'frontal' | null;
  chassis: ChassisId;
  /** Braço direito (Vector-09: energia; andróide: blaster). */
  right: ArmSpec;
  /** Braço esquerdo (Vector-09: munição; andróide: motosserra; Marauder: a segunda arma do botão principal), ou nada. */
  left: ArmSpec | null;
  /** Ombros: o lançador dos dois ombros, ou nada. Só existe nos chassis que têm o encaixe (`ARM_SLOTS`); ausente = vazio. */
  shoulders?: ArmSpec | null;
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

export type ArmSlot = 'right' | 'left' | 'shoulders';

/** Armas que cabem num encaixe do chassi (padrão: Vector-09), na ordem do catálogo. Sem o encaixe, nenhuma. */
export function armOptions(slot: ArmSlot, chassis: ChassisId = 'vector09'): readonly WeaponId[] {
  return ARM_SLOTS[chassis][slot] ?? [];
}

/** O chassi tem o encaixe dos ombros (e, com ele, as duas mãos no botão principal)? */
export function hasShoulderSlot(chassis: ChassisId): boolean {
  return ARM_SLOTS[chassis].shoulders !== undefined;
}

const armOf = (w: WeaponStats | null | undefined): ArmSpec | null => (w ? { id: w.id, tier: w.tier } : null);

/** A montagem de fábrica de um chassi (as armas com que ele sai da fábrica, no nível delas). */
export function factorySpec(chassis: ChassisId): LoadoutSpec {
  const l = CHASSIS[chassis].loadout;
  const right = armOf(l.primary)!;
  // Com ombros, o gatilho secundário é dos ombros e a mão esquerda leva a segunda arma do principal.
  if (hasShoulderSlot(chassis)) return { v: LOADOUT_VERSION, chassis, right, left: armOf(l.offhand), shoulders: armOf(l.secondary) };
  return { v: LOADOUT_VERSION, chassis, right, left: armOf(l.secondary) };
}

/** Cada arma da montagem que atira, uma por encaixe (o lançador dos ombros vale dois): carga, calor e dano se somam daqui. */
export function specWeapons(spec: LoadoutSpec): WeaponStats[] {
  const chassis = CHASSIS[spec.chassis];
  const out = [spec.right, spec.left];
  if (spec.shoulders) for (let i = 0; i < chassis.triggers!.secondary.length; i++) out.push(spec.shoulders);
  return out.filter((a): a is ArmSpec => a !== null).map((a) => weapon(a.id, a.tier));
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
  if (s.v !== 1 && (s.v !== 2 || s.module === undefined)) return fail('formato', `versão ${String(s.v)} desconhecida`);
  if (typeof s.chassis !== 'string' || !Object.hasOwn(CHASSIS, s.chassis)) return fail('chassi', `chassi ${String(s.chassis)} não existe`);
  const chassis = CHASSIS[s.chassis];
  const capacity = chassis.weaponCapacity;
  if (!isArm(s.right)) return fail('formato', 'braço direito vazio', 0, capacity);
  if (s.left !== null && !isArm(s.left)) return fail('formato', 'braço esquerdo inválido', 0, capacity);
  const shoulders = s.shoulders ?? null;
  if (shoulders !== null && !isArm(shoulders)) return fail('formato', 'ombros inválidos', 0, capacity);
  if (shoulders !== null && !hasShoulderSlot(s.chassis)) return fail('encaixe', `o ${chassis.name} não tem lançadores nos ombros`, 0, capacity);
  const arms: [ArmSlot, ArmSpec][] = [['right', s.right]];
  if (s.left) arms.push(['left', s.left]);
  if (shoulders) arms.push(['shoulders', shoulders]);
  const where = { right: 'braço direito', left: 'braço esquerdo', shoulders: 'ombros' } as const;
  for (const [slot, arm] of arms) {
    if (!(WEAPON_IDS as readonly string[]).includes(arm.id)) return fail('arma', `arma ${String(arm.id)} não existe`, 0, capacity);
    if (!isTier(arm.tier)) return fail('nível', `nível ${String(arm.tier)} não existe`, 0, capacity);
    if (!armOptions(slot, s.chassis).includes(arm.id)) return fail('encaixe', `${weapon(arm.id).name} não vai no ${where[slot]} do ${chassis.name}`, 0, capacity);
    if (!unlocked(arm.id, arm.tier)) return fail('bloqueado', `${weapon(arm.id, arm.tier).name} ainda bloqueado`, 0, capacity);
  }
  const spec2 = { v: LOADOUT_VERSION, chassis: s.chassis, right: s.right, left: s.left ?? null, shoulders } satisfies LoadoutSpec;
  // Carga: cada arma conta uma vez por encaixe em que atira (o lançador dos ombros vale dois).
  const module = s.module ?? null;
  if (module !== null && (s.v !== 2 || module !== 'frontal')) return fail('formato', 'módulo inválido ou versão incompatível', 0, capacity);
  if (module && s.chassis === 'android') return fail('encaixe', 'Andróide não possui encaixe de gerador', 0, capacity);
  const mass = specWeapons(spec2).reduce((sum, w) => sum + w.mass, 0) + (module ? FRONTAL_SHIELD.mass : 0);
  if (mass > capacity + 1e-9) return fail('carga', `${mass} t de armas numa carga de ${capacity} t`, mass, capacity);
  // Com ombros, o gatilho secundário é deles e a mão esquerda leva a segunda arma do principal.
  const loadout: Loadout = hasShoulderSlot(s.chassis)
    ? { primary: weapon(s.right.id, s.right.tier), offhand: s.left ? weapon(s.left.id, s.left.tier) : null, secondary: shoulders ? weapon(shoulders.id, shoulders.tier) : null }
    : { primary: weapon(s.right.id, s.right.tier), secondary: s.left ? weapon(s.left.id, s.left.tier) : null };
  if (s.v === 2) loadout.module = module;
  return { ok: true, loadout, mass, capacity };
}

/**
 * Montagem em texto curto, para link de build e para o multiplayer: `v1.vector09.plasma-2.rockets-0`
 * (encaixe vazio = `-`). Os chassis com ombros levam um terceiro grupo: `v1.marauder.blaster-0.blaster-0.rockets-0`.
 * `parseLoadoutKey` devolve null se o texto não for uma montagem.
 */
export function loadoutKey(spec: LoadoutSpec): string {
  const arm = (a: ArmSpec | null | undefined) => (a ? `${a.id}-${a.tier}` : '-');
  const base = `v${spec.v}.${spec.chassis}.${arm(spec.right)}.${arm(spec.left)}`;
  if (spec.v === 2) return `${base}.${arm(spec.shoulders)}.${spec.module ?? '-'}`;
  return hasShoulderSlot(spec.chassis) ? `${base}.${arm(spec.shoulders)}` : base;
}

export function parseLoadoutKey(key: string): LoadoutSpec | null {
  if (key.trim().startsWith('v2.')) {
    const parts = key.trim().split('.');
    if(parts.length !== 6) return null;
    const a=(x:string|undefined):unknown => x==='-'?null:(/^([a-z]+)-([0-2])$/.test(x??'')?{id:x!.slice(0,-2),tier:Number(x!.at(-1))}:undefined);
    if (a(parts[2]) === undefined || a(parts[3]) === undefined || a(parts[4]) === undefined) return null;
    const spec={v:2,chassis:parts[1],right:a(parts[2]),left:a(parts[3]),shoulders:a(parts[4]),module:parts[5]==='-'?null:parts[5]};
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
