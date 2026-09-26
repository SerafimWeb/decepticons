import { weapon, WEAPON_IDS, type Loadout, type Tier, type WeaponId } from '../combat/weapons';
import { ARM_SLOTS, CHASSIS, type ChassisId } from '../entities/chassis';

/**
 * Contrato do Hangar (AGENTS, regra 5: o contrato entra antes da tela). Uma montagem é só ids e níveis
 * (`LoadoutSpec`): é o que se salva no aparelho, o que vai num link de build e, no multiplayer, o que o
 * cliente manda ao servidor. Os números (dano, calor, massa) nunca viajam: quem valida lê do próprio
 * catálogo (`combat/weapons.ts`) e do chassi (`entities/chassis.ts`), e o servidor faz a mesma conta.
 *
 * Regras (especificação em `.decepticons/HANGAR.md`):
 * - cada chassi diz o que vai em cada braço (`ARM_SLOTS`): no Vector-09, energia no direito e munição no
 *   esquerdo; no andróide, blaster no direito e motosserra no esquerdo; o esquerdo pode ficar vazio;
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
  v: typeof LOADOUT_VERSION;
  chassis: ChassisId;
  /** Braço direito (Vector-09: energia; andróide: blaster). */
  right: ArmSpec;
  /** Braço esquerdo (Vector-09: munição; andróide: motosserra), ou nada. */
  left: ArmSpec | null;
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

export type ArmSlot = 'right' | 'left';

/** Armas que cabem num braço do chassi (padrão: Vector-09), na ordem do catálogo. */
export function armOptions(slot: ArmSlot, chassis: ChassisId = 'vector09'): readonly WeaponId[] {
  return ARM_SLOTS[chassis][slot];
}

/** A montagem de fábrica de um chassi (as armas com que ele sai da fábrica, no nível delas). */
export function factorySpec(chassis: ChassisId): LoadoutSpec {
  const l = CHASSIS[chassis].loadout;
  return { v: LOADOUT_VERSION, chassis, right: { id: l.primary.id, tier: l.primary.tier }, left: l.secondary ? { id: l.secondary.id, tier: l.secondary.tier } : null };
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
  if (s.v !== LOADOUT_VERSION) return fail('formato', `versão ${String(s.v)} desconhecida`);
  if (typeof s.chassis !== 'string' || !Object.hasOwn(CHASSIS, s.chassis)) return fail('chassi', `chassi ${String(s.chassis)} não existe`);
  const chassis = CHASSIS[s.chassis];
  const capacity = chassis.weaponCapacity;
  if (!isArm(s.right)) return fail('formato', 'braço direito vazio', 0, capacity);
  if (s.left !== null && !isArm(s.left)) return fail('formato', 'braço esquerdo inválido', 0, capacity);
  const arms: [ArmSlot, ArmSpec][] = [['right', s.right]];
  if (s.left) arms.push(['left', s.left]);
  let mass = 0;
  for (const [slot, arm] of arms) {
    if (!(WEAPON_IDS as readonly string[]).includes(arm.id)) return fail('arma', `arma ${String(arm.id)} não existe`, 0, capacity);
    if (!isTier(arm.tier)) return fail('nível', `nível ${String(arm.tier)} não existe`, 0, capacity);
    if (!armOptions(slot, s.chassis).includes(arm.id)) return fail('encaixe', `${weapon(arm.id).name} não vai no braço ${slot === 'right' ? 'direito' : 'esquerdo'} do ${chassis.name}`, 0, capacity);
    if (!unlocked(arm.id, arm.tier)) return fail('bloqueado', `${weapon(arm.id, arm.tier).name} ainda bloqueado`, 0, capacity);
    mass += weapon(arm.id, arm.tier).mass;
  }
  if (mass > capacity + 1e-9) return fail('carga', `${mass} t de armas numa carga de ${capacity} t`, mass, capacity);
  return {
    ok: true,
    loadout: { primary: weapon(s.right.id, s.right.tier), secondary: s.left ? weapon(s.left.id, s.left.tier) : null },
    mass,
    capacity,
  };
}

/**
 * Montagem em texto curto, para link de build e para o multiplayer: `v1.vector09.plasma-2.rockets-0`
 * (braço esquerdo vazio = `-`). `parseLoadoutKey` devolve null se o texto não for uma montagem.
 */
export function loadoutKey(spec: LoadoutSpec): string {
  const arm = (a: ArmSpec | null) => (a ? `${a.id}-${a.tier}` : '-');
  return `v${spec.v}.${spec.chassis}.${arm(spec.right)}.${arm(spec.left)}`;
}

export function parseLoadoutKey(key: string): LoadoutSpec | null {
  const m = /^v(\d+)\.([a-z0-9]+)\.([a-z]+)-(\d)\.(?:([a-z]+)-(\d)|-)$/.exec(key.trim());
  if (!m) return null;
  const spec = {
    v: Number(m[1]),
    chassis: m[2],
    right: { id: m[3], tier: Number(m[4]) },
    left: m[5] ? { id: m[5], tier: Number(m[6]) } : null,
  };
  return validateLoadout(spec).ok ? (spec as LoadoutSpec) : null;
}
