import { timeToKill } from '../combat/balance';
import { WEAPON_IDS, type Loadout, type WeaponId, type WeaponStats } from '../combat/weapons';
import { ANDROID_STATS, VECTOR09_STATS } from '../entities/chassis';
import type { MechModules, MechStats } from '../entities/MechBase';

/**
 * Potências (dono, 25/09: "um painel de controle para configurar as potências das armas, dos robôs, por arma,
 * por clã"): multiplicadores sobre o padrão do jogo (1 = 100%), por arma e por clã. Regra pura, sem DOM nem 3D.
 *
 * - A partida monta os robôs e as armas já multiplicados, uma vez, ao começar: nada muda nem é criado no tick.
 * - O padrão continua sendo o que os testes de equilíbrio travam. As potências são o laboratório do dono: valem
 *   neste aparelho (ou para quem abrir o link) e mostram, na hora, se o ajuste sai das metas.
 * - No multiplayer, a sala usa o padrão do servidor (cliente não escolhe o dano dos outros).
 */

/** Clãs: quem recebe o multiplicador. O jogador, os Mechs rebeldes, os andróides rebeldes e o técnico. */
export type Clan = 'player' | 'mechs' | 'androids' | 'technician';
export const CLANS: readonly Clan[] = ['player', 'mechs', 'androids', 'technician'];

/** Por arma: dano por tiro, cadência (tiros por segundo e recarga), calor por tiro, alcance. */
export interface WeaponPower {
  damage: number;
  rate: number;
  heat: number;
  range: number;
}

/** Por clã: dano das armas, vida de cada parte, velocidade (andar e dash), calor (tiro, corrida, pulo, dash, dano). */
export interface ClanPower {
  /** No técnico, que não atira, é o ritmo do conserto. */
  damage: number;
  health: number;
  speed: number;
  heat: number;
}

export interface PowerSpec {
  v: 1;
  weapons: Record<WeaponId, WeaponPower>;
  clans: Record<Clan, ClanPower>;
}

export const WEAPON_FIELDS = ['damage', 'rate', 'heat', 'range'] as const;
export const CLAN_FIELDS = ['damage', 'health', 'speed', 'heat'] as const;
/** De 25% a 400% do padrão. */
export const POWER_MIN = 0.25;
export const POWER_MAX = 4;

/** Tudo em 100%: o jogo como os testes travam. Sempre um objeto novo (quem edita não mexe no de ninguém). */
export function defaultPower(): PowerSpec {
  const weapons = {} as Record<WeaponId, WeaponPower>;
  for (const id of WEAPON_IDS) weapons[id] = { damage: 1, rate: 1, heat: 1, range: 1 };
  const clans = {} as Record<Clan, ClanPower>;
  for (const c of CLANS) clans[c] = { damage: 1, health: 1, speed: 1, heat: 1 };
  return { v: 1, weapons, clans };
}

/** Número de fora vira multiplicador válido: de 25% a 400%, em centésimos; o resto vira 100%. */
export const clampPower = (x: unknown): number =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(POWER_MAX, Math.max(POWER_MIN, Math.round(x * 100) / 100)) : 1;
const field = (o: unknown, k: string): unknown => (o && typeof o === 'object' && Object.hasOwn(o, k) ? (o as Record<string, unknown>)[k] : undefined);

/** Nada é confiado (armazenamento, link): campo por campo, só as armas, clãs e campos conhecidos. */
export function sanitizePower(raw: unknown): PowerSpec {
  const out = defaultPower();
  const weapons = field(raw, 'weapons');
  const clans = field(raw, 'clans');
  for (const id of WEAPON_IDS) for (const f of WEAPON_FIELDS) out.weapons[id][f] = clampPower(field(field(weapons, id), f));
  for (const c of CLANS) for (const f of CLAN_FIELDS) out.clans[c][f] = clampPower(field(field(clans, c), f));
  return out;
}

/** Quantos multiplicadores saem de 100%. */
export function powerChanges(spec: PowerSpec): number {
  let n = 0;
  for (const id of WEAPON_IDS) for (const f of WEAPON_FIELDS) if (spec.weapons[id][f] !== 1) n++;
  for (const c of CLANS) for (const f of CLAN_FIELDS) if (spec.clans[c][f] !== 1) n++;
  return n;
}

// ---------- link: ?potencias=p1.plasma-d120.mechs-v80 ----------

const WEAPON_CODE: Record<(typeof WEAPON_FIELDS)[number], string> = { damage: 'd', rate: 'r', heat: 'c', range: 'a' };
const CLAN_CODE: Record<(typeof CLAN_FIELDS)[number], string> = { damage: 'd', health: 'v', speed: 's', heat: 'c' };

/** Texto curto para link: só o que saiu de 100%, em porcentagem (`plasma-d120` = dano do plasma em 120%). */
export function powerKey(spec: PowerSpec): string {
  const parts = ['p1'];
  const pct = (v: number) => String(Math.round(v * 100));
  for (const id of WEAPON_IDS) for (const f of WEAPON_FIELDS) if (spec.weapons[id][f] !== 1) parts.push(`${id}-${WEAPON_CODE[f]}${pct(spec.weapons[id][f])}`);
  for (const c of CLANS) for (const f of CLAN_FIELDS) if (spec.clans[c][f] !== 1) parts.push(`${c}-${CLAN_CODE[f]}${pct(spec.clans[c][f])}`);
  return parts.join('.');
}

/** O contrário de `powerKey`. Texto que não é de potências vira null (nada é aplicado pela metade). */
export function parsePowerKey(key: string): PowerSpec | null {
  const parts = key.split('.');
  if (parts[0] !== 'p1' || parts.length > 1 + WEAPON_IDS.length * 4 + CLANS.length * 4) return null;
  const out = defaultPower();
  for (const p of parts.slice(1)) {
    const m = /^([a-z]+)-([a-z])(\d{1,3})$/.exec(p);
    if (!m) return null;
    const [, target, code, n] = m as unknown as [string, string, string, string];
    const value = clampPower(Number(n) / 100);
    if ((WEAPON_IDS as readonly string[]).includes(target)) {
      const f = WEAPON_FIELDS.find((k) => WEAPON_CODE[k] === code);
      if (!f) return null;
      out.weapons[target as WeaponId][f] = value;
    } else if ((CLANS as readonly string[]).includes(target)) {
      const f = CLAN_FIELDS.find((k) => CLAN_CODE[k] === code);
      if (!f) return null;
      out.clans[target as Clan][f] = value;
    } else return null;
  }
  return out;
}

// ---------- aplicar ----------

const allOnes = (o: object) => Object.values(o).every((v) => v === 1);

/**
 * A arma com a potência dela e a do clã de quem a carrega (dano × dano, calor × calor). Em 100%, a mesma arma
 * da tabela (mesmo objeto). Senão, um objeto novo e congelado, feito ao montar o robô, nunca no tick.
 */
export function poweredWeapon(w: WeaponStats, spec: PowerSpec, clan: Clan): WeaponStats {
  const wp = spec.weapons[w.id];
  const cp = spec.clans[clan];
  if (allOnes(wp) && cp.damage === 1 && cp.heat === 1) return w;
  return Object.freeze({
    ...w,
    damage: Math.max(1, Math.round(w.damage * wp.damage * cp.damage)),
    fireInterval: w.fireInterval / wp.rate,
    reload: w.reload / wp.rate,
    heatPerShot: w.heatPerShot * wp.heat * cp.heat,
    optimalRange: w.optimalRange * wp.range,
    maxRange: w.maxRange * wp.range,
  });
}

export function poweredLoadout(l: Loadout, spec: PowerSpec, clan: Clan): Loadout {
  const primary = poweredWeapon(l.primary, spec, clan);
  const secondary = l.secondary && poweredWeapon(l.secondary, spec, clan);
  const offhand = l.offhand && poweredWeapon(l.offhand, spec, clan);
  if (primary === l.primary && secondary === l.secondary && offhand === l.offhand) return l;
  return { ...l, primary, secondary, ...(l.offhand === undefined ? {} : { offhand }) };
}

/**
 * Os números do chassi com a potência do clã: vida de cada parte, velocidade (andar, arrancar e dash: o tempo
 * para chegar na velocidade máxima não muda), calor de corrida, pulo, dash e dano, e as armas de fábrica.
 * O pulo e o tamanho não mudam (o cenário foi feito para eles). Em 100%, o mesmo objeto.
 */
export function poweredStats(s: MechStats, spec: PowerSpec, clan: Clan): MechStats {
  const c = spec.clans[clan];
  const loadout = poweredLoadout(s.loadout, spec, clan);
  if (c.health === 1 && c.speed === 1 && c.heat === 1 && loadout === s.loadout) return s;
  const hp = (x: number) => Math.max(1, Math.round(x * c.health));
  const m = s.maxModuleHealth;
  const maxModuleHealth: MechModules = { torso: hp(m.torso), head: hp(m.head), leftArm: hp(m.leftArm), rightArm: hp(m.rightArm), leftLeg: hp(m.leftLeg), rightLeg: hp(m.rightLeg) };
  return {
    ...s,
    moveSpeed: s.moveSpeed * c.speed,
    groundAccel: s.groundAccel * c.speed,
    airAccel: s.airAccel * c.speed,
    dashSpeed: s.dashSpeed * c.speed,
    heatRun: s.heatRun * c.heat,
    heatJump: s.heatJump * c.heat,
    heatDash: s.heatDash * c.heat,
    heatPerDamage: s.heatPerDamage * c.heat,
    maxModuleHealth,
    loadout,
  };
}

// ---------- o que o ajuste faz com a luta (a mesma simulação das metas de equilíbrio) ----------

/** Metas travadas pelos testes do padrão (`weapons.test.ts`): o painel avisa quando o ajuste sai delas. */
export const POWER_GOALS = { comboMin: 2.5, singleMin: 4.5 } as const;

export interface PowerReport {
  /** Seu plasma (Vector-09) derruba o torso de um Mech rebelde em (s), com todos os tiros no alvo. */
  yourPlasma: number;
  /** Seus dois braços juntos derrubam o torso de um Mech rebelde em (s). */
  yourCombo: number;
  /** O plasma de um Mech rebelde derruba o seu torso em (s). */
  theirPlasma: number;
  /** Os dois braços de um Mech rebelde derrubam o seu torso em (s). */
  theirCombo: number;
  /** A motosserra de um andróide rebelde arranca uma perna sua em (s). */
  sawLeg: number;
  /** Tiros do seu plasma para derrubar um andróide rebelde. */
  androidShots: number;
}

/** Os números do ajuste, pela simulação de equilíbrio (teto teórico, sem errar tiro). Roda na tela, não no jogo. */
export function powerReport(spec: PowerSpec): PowerReport {
  const you = poweredStats(VECTOR09_STATS, spec, 'player');
  const rebel = poweredStats(VECTOR09_STATS, spec, 'mechs');
  const android = poweredStats(ANDROID_STATS, spec, 'androids');
  const arms = (s: MechStats) => (s.loadout.secondary ? [s.loadout.primary, s.loadout.secondary] : [s.loadout.primary]);
  return {
    yourPlasma: timeToKill([you.loadout.primary], you, rebel.maxModuleHealth.torso),
    yourCombo: timeToKill(arms(you), you, rebel.maxModuleHealth.torso),
    theirPlasma: timeToKill([rebel.loadout.primary], rebel, you.maxModuleHealth.torso),
    theirCombo: timeToKill(arms(rebel), rebel, you.maxModuleHealth.torso),
    sawLeg: timeToKill([android.loadout.primary], android, you.maxModuleHealth.leftLeg),
    androidShots: Math.ceil(android.maxModuleHealth.torso / you.loadout.primary.damage),
  };
}
