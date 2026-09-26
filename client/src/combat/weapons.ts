/**
 * Arsenal: toda arma do jogo é um dado deste arquivo, em três níveis de poder (MK I, MK II, MK III)
 * com a mesma regra para todas (dono, 25/09: "padronizar com 3 níveis de poder em cada arma, pra
 * quando tivermos upgrades; dano realista, sem apelação; a diferença vem da técnica e da customização").
 *
 * Como o equilíbrio se mantém sozinho:
 * - **Poder custa carga e calor.** Cada nível acima dá +20% de dano por tiro, mas esquenta (ou recarrega)
 *   +15% e pesa +50% na carga do Hangar. O MK III bate mais forte, mas é o que menos rende por tonelada:
 *   quem monta o Mech escolhe onde gastar, e ninguém fica só mais forte por ter subido de nível.
 * - **Todo tiro vira calor no mesmo dissipador** (o do chassi, `MechStats`): o plasma e também o disparo
 *   dos foguetes. Superaquecido, o Mech para de atirar. Por isso nenhum combo derruba um Mech de uma vez.
 * - **O plasma perde força com a distância:** dano cheio até o alcance ótimo, caindo em linha reta até
 *   `minFactor` no alcance máximo, onde o projétil se desfaz. Posicionamento conta.
 * - **Explosivo cai com a distância do centro** (`splashDamage`) e é lento: quem está longe desvia.
 * - **Arma leve não ameaça blindagem pesada** (o blaster dos andróides).
 * As metas de tempo para derrubar um Mech estão em `balance.ts` e travadas por teste.
 *
 * Sem imports em tempo de execução: o site lê este arquivo direto (landing, seção do Hangar).
 */

/** Nível de poder: 0 = MK I, 1 = MK II, 2 = MK III. */
export type Tier = 0 | 1 | 2;

export interface TierRule {
  label: 'MK I' | 'MK II' | 'MK III';
  /** Multiplica o dano por tiro. */
  damage: number;
  /** Multiplica o calor por tiro e, nas armas de munição, o tempo de recarga. */
  heat: number;
  /** Multiplica a massa (carga ocupada no Hangar). */
  mass: number;
}

export const TIERS: readonly TierRule[] = [
  { label: 'MK I', damage: 1, heat: 1, mass: 1 },
  { label: 'MK II', damage: 1.2, heat: 1.15, mass: 1.5 },
  { label: 'MK III', damage: 1.4, heat: 1.3, mass: 2 },
];

export type WeaponId = 'plasma' | 'rockets' | 'blaster' | 'chainsaw';

/** Arma pronta para o combate, já no nível escolhido. Tudo em unidades do jogo (m, s, t). */
export interface WeaponStats {
  id: WeaponId;
  /** Nome para a interface e o site. */
  name: string;
  tier: Tier;
  /**
   * Energia: tiro ilimitado, limitado só pelo calor. Munição: carregador que recarrega sozinho (e também
   * esquenta). Corpo a corpo: corta o que está encostado (alcance = distância entre as cápsulas), sem projétil.
   */
  kind: 'energy' | 'ammo' | 'melee';
  /** Dano por tiro (energia) ou no centro da explosão (munição), inteiro. */
  damage: number;
  /** Segundos entre dois tiros. */
  fireInterval: number;
  /** Calor (fração do dissipador, 0–1) que cada tiro gera. */
  heatPerShot: number;
  /** Munição: tiros no carregador. Energia: 0. */
  magazine: number;
  /** Munição: segundos para recarregar um tiro. Energia: 0. */
  reload: number;
  /** Velocidade do projétil (m/s). */
  speed: number;
  /** Dano cheio até esta distância (m). */
  optimalRange: number;
  /** O projétil some aqui (m). */
  maxRange: number;
  /** Fração do dano no alcance máximo (1 = não perde força). */
  minFactor: number;
  /** Raio da explosão (m), medido até a superfície do alvo; 0 = sem explosão. */
  blastRadius: number;
  /** Carga ocupada no Hangar (t). */
  mass: number;
}

type WeaponBase = Omit<WeaponStats, 'tier'>;

const BASE: Record<WeaponId, WeaponBase> = {
  plasma: {
    id: 'plasma',
    name: 'Canhão de plasma',
    kind: 'energy',
    damage: 16,
    fireInterval: 0.22,
    heatPerShot: 0.07,
    magazine: 0,
    reload: 0,
    speed: 140,
    optimalRange: 60,
    maxRange: 200,
    minFactor: 0.4,
    blastRadius: 0,
    mass: 3,
  },
  rockets: {
    id: 'rockets',
    name: 'Casulo de foguetes',
    kind: 'ammo',
    damage: 40,
    fireInterval: 0.3,
    heatPerShot: 0.18,
    magazine: 4,
    reload: 2.2,
    speed: 75,
    optimalRange: 225,
    maxRange: 225,
    minFactor: 1,
    blastRadius: 6,
    mass: 4,
  },
  blaster: {
    id: 'blaster',
    name: 'Blaster leve',
    kind: 'energy',
    damage: 4,
    fireInterval: 0.4,
    heatPerShot: 0.12,
    magazine: 0,
    reload: 0,
    speed: 120,
    optimalRange: 25,
    maxRange: 120,
    minFactor: 0.5,
    blastRadius: 0,
    mass: 0.5,
  },
  /**
   * Motosserra dos andróides (dono, 25/09: "ele tem que ficar perto de nós pra usar"): corta o que está
   * encostado, na altura do andróide (num Mech, as pernas). 5 cortes por segundo, 20 de dano/s: sozinha,
   * arranca uma perna do Vector-09 em ~7,5 s; em dupla, na metade. Chato, não mortal: o jogador pisa.
   */
  chainsaw: {
    id: 'chainsaw',
    name: 'Motosserra',
    kind: 'melee',
    damage: 4,
    fireInterval: 0.2,
    heatPerShot: 0.012,
    magazine: 0,
    reload: 0,
    speed: 0,
    optimalRange: 1.2,
    maxRange: 1.2,
    minFactor: 1,
    blastRadius: 0,
    mass: 1.5,
  },
};

const round = (x: number, step: number) => Math.round(x / step) * step;

function atTier(b: WeaponBase, tier: Tier): WeaponStats {
  const t = TIERS[tier]!;
  return Object.freeze({
    ...b,
    tier,
    damage: Math.round(b.damage * t.damage),
    heatPerShot: round(b.heatPerShot * t.heat, 0.001),
    reload: round(b.reload * t.heat, 0.01),
    mass: round(b.mass * t.mass, 0.25),
  });
}

/** Tabela pronta (montada uma vez ao carregar): pedir uma arma no jogo não aloca nada. */
export const WEAPON_IDS = Object.keys(BASE) as readonly WeaponId[];

const TABLE = {} as Record<WeaponId, readonly WeaponStats[]>;
for (const id of WEAPON_IDS) TABLE[id] = ([0, 1, 2] as const).map((t) => atTier(BASE[id], t));

/** A arma `id` no nível `tier`. Sempre o mesmo objeto (congelado) para o mesmo par. */
export function weapon(id: WeaponId, tier: Tier = 0): WeaponStats {
  return TABLE[id][tier]!;
}

/** Fração do dano a `dist` metros de quem atirou: 1 até o alcance ótimo, cai até `minFactor` no máximo. */
export function rangeFactor(w: WeaponStats, dist: number): number {
  if (dist <= w.optimalRange) return 1;
  if (dist >= w.maxRange) return w.minFactor;
  return 1 - ((1 - w.minFactor) * (dist - w.optimalRange)) / (w.maxRange - w.optimalRange);
}

/** Dano de um tiro direto a `dist` metros, inteiro (os módulos mostram números redondos). */
export function hitDamage(w: WeaponStats, dist: number): number {
  return Math.round(w.damage * rangeFactor(w, dist));
}

/**
 * Dano da explosão a `dist` metros da superfície do alvo: máximo no centro, zero na borda do raio.
 * Inteiro, como o dano do plasma.
 */
export function splashDamage(w: WeaponStats, dist: number): number {
  if (dist >= w.blastRadius) return 0;
  return Math.round(w.damage * (1 - Math.max(0, dist) / w.blastRadius));
}

/** O que um Mech leva nos braços. O Hangar vai trocar isto; hoje cada chassi vem com o de fábrica. */
export interface Loadout {
  /** Braço direito: arma de energia (tiro principal). */
  primary: WeaponStats;
  /** Braço esquerdo: arma de munição (secundária), se houver. */
  secondary: WeaponStats | null;
}
