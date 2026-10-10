import type { DamageType, Tier } from './weapons';

/**
 * Escudo físico removível: ocupa a mão esquerda no lugar da arma (dono, 06/10) e o **botão 2** (mouse direito, o
 * gatilho que sobrou) **levanta** a chapa. Levantado, cobre a frente com a resistência cheia do modelo e o Mech anda
 * mais devagar; abaixado, protege só o flanco esquerdo e com metade da força. Sem energia: a chapa tem integridade, que
 * não regenera sozinha (volta com conserto e no renascimento). Braço esquerdo destruído = sem escudo.
 *
 * Cada modelo resiste melhor a uma natureza de dano (`DAMAGE_TYPE` em `weapons.ts`): o refratário segura plasma e
 * laser, o reativo segura bala e explosão, o amortecedor segura pulso e som, a muralha é o meio-termo.
 * Sem Three.js nem DOM: a mesma regra no cliente e no servidor (G14).
 */
export const METAL_SHIELD_IDS = ['muralha', 'refratario', 'reativo', 'amortecedor'] as const;
export type MetalShieldId = (typeof METAL_SHIELD_IDS)[number];

export interface MetalShieldModel {
  id: MetalShieldId;
  name: string;
  /** Uma linha para o Hangar: contra o que é bom e contra o que falha. */
  hint: string;
  /** Massa do MK I, em t (o lança-foguetes MK I tem 2). */
  mass: number;
  /** Integridade do MK I em múltiplos da vida do braço esquerdo: escala sozinha do Vector ao Colossus. */
  integrity: number;
  /** Fração do dano que a chapa levantada segura, por natureza; o resto passa para o corpo. */
  resist: Readonly<Record<DamageType, number>>;
}

export const METAL_SHIELDS: Readonly<Record<MetalShieldId, MetalShieldModel>> = {
  muralha: {
    id: 'muralha', name: 'Escudo Muralha', mass: 2, integrity: 1.5,
    hint: 'aço maciço: segura um pouco de tudo, nada muito bem; conduz a descarga elétrica',
    resist: { termico: 0.6, laser: 0.6, balistico: 0.7, explosivo: 0.6, pulso: 0.4, sonico: 0.4, corte: 0.5, eletrico: 0.35 },
  },
  refratario: {
    id: 'refratario', name: 'Escudo Refratário', mass: 1.75, integrity: 1.2,
    hint: 'cerâmica: segura plasma, laser e descarga elétrica (isola); bala e explosão a racham',
    resist: { termico: 0.9, laser: 0.85, balistico: 0.35, explosivo: 0.4, pulso: 0.5, sonico: 0.3, corte: 0.3, eletrico: 0.9 },
  },
  reativo: {
    id: 'reativo', name: 'Escudo Reativo', mass: 2.5, integrity: 1.6,
    hint: 'placas reativas: seguram bala, trilho e explosão; o calor atravessa',
    resist: { termico: 0.35, laser: 0.3, balistico: 0.9, explosivo: 0.85, pulso: 0.3, sonico: 0.4, corte: 0.6, eletrico: 0.3 },
  },
  amortecedor: {
    id: 'amortecedor', name: 'Escudo Amortecedor', mass: 2, integrity: 1.4,
    hint: 'malha amortecedora: segura pulso EMP e onda sônica; fraco contra lâmina',
    resist: { termico: 0.45, laser: 0.45, balistico: 0.5, explosivo: 0.5, pulso: 0.9, sonico: 0.9, corte: 0.35, eletrico: 0.55 },
  },
};

/** O que cada nível soma ao modelo: mais chapa, um pouco mais de resistência e de massa. */
export const METAL_SHIELD_TIERS = [
  { label: 'MK I', mass: 0, integrity: 1, resist: 0 },
  { label: 'MK II', mass: 0.5, integrity: 1.3, resist: 0.05 },
  { label: 'MK III', mass: 1, integrity: 1.6, resist: 0.1 },
] as const;

export const isMetalShieldId = (id: unknown): id is MetalShieldId => (METAL_SHIELD_IDS as readonly unknown[]).includes(id);

export function metalShieldMass(id: MetalShieldId, tier: Tier): number {
  return METAL_SHIELDS[id].mass + METAL_SHIELD_TIERS[tier].mass;
}

/** Levantado: cone de 150° à frente da mira. Abaixado: cone de 100° centrado 60° à esquerda, com metade da força. */
export const RAISED_CONE_COS = Math.cos((75 * Math.PI) / 180);
const LOWERED_CENTER = Math.PI / 3;
export const LOWERED_CONE_COS = Math.cos((50 * Math.PI) / 180);
export const LOWERED_FACTOR = 0.5;
const MAX_RESIST = 0.95;
/** Velocidade do Mech com a chapa levantada. */
export const RAISED_SPEED = 0.75;

export class MetalShield {
  model: MetalShieldModel | null = null;
  tier: Tier = 0;
  integrity = 0;
  maxIntegrity = 0;
  /** Chapa levantada neste tick (botão 2 apertado, braço inteiro, chapa inteira). */
  raised = false;

  get equipped(): boolean {
    return this.model !== null;
  }

  get intact(): boolean {
    return this.model !== null && this.integrity > 0;
  }

  get fraction(): number {
    return this.maxIntegrity > 0 ? this.integrity / this.maxIntegrity : 0;
  }

  /** Fração do dano `type` que a chapa levantada segura (com o bônus do nível). */
  resistTo(type: DamageType): number {
    return this.model ? Math.min(MAX_RESIST, this.model.resist[type] + METAL_SHIELD_TIERS[this.tier].resist) : 0;
  }

  /** `armHealth`: vida máxima do braço esquerdo do chassi. Trocar no meio da partida (`preserve`) não conserta a chapa. */
  equip(spec: { id: MetalShieldId; tier: Tier } | null | undefined, armHealth: number, preserve = false): void {
    const before = this.fraction;
    this.model = spec ? METAL_SHIELDS[spec.id] : null;
    this.tier = spec?.tier ?? 0;
    this.maxIntegrity = this.model ? armHealth * this.model.integrity * METAL_SHIELD_TIERS[this.tier].integrity : 0;
    this.integrity = preserve ? before * this.maxIntegrity : this.maxIntegrity;
    this.raised = false;
  }

  reset(): void {
    this.integrity = this.maxIntegrity;
    this.raised = false;
  }

  /** Tick fixo: `held` = botão 2; `armAlive` = braço esquerdo inteiro. */
  step(held: boolean, armAlive: boolean): void {
    this.raised = held && armAlive && this.intact;
  }

  /** Conserto: devolve integridade; retorna quanto usou. */
  restore(amount: number): number {
    if (!this.equipped || amount <= 0) return 0;
    const used = Math.min(amount, this.maxIntegrity - this.integrity);
    this.integrity += used;
    return used;
  }

  /**
   * (x, z): do centro do robô para a fonte do impacto, em mundo (tiro: -direção do projétil). Só o plano horizontal
   * conta: a chapa cobre do pé à cabeça daquele lado. Devolve o dano que passa. Quem chama confere o braço.
   */
  absorb(damage: number, type: DamageType, x: number, z: number, yaw: number): number {
    if (!this.intact || damage <= 0) return damage;
    const length = Math.hypot(x, z);
    if (length < 1e-6) return damage;
    // Frente = (-sen yaw, -cos yaw); girar para a esquerda soma ao yaw.
    const a = this.raised ? yaw : yaw + LOWERED_CENTER;
    const dot = (-Math.sin(a) * x - Math.cos(a) * z) / length;
    if (dot < (this.raised ? RAISED_CONE_COS : LOWERED_CONE_COS)) return damage;
    const resist = this.resistTo(type) * (this.raised ? 1 : LOWERED_FACTOR);
    const held = Math.min(damage * resist, this.integrity);
    this.integrity -= held;
    if (this.integrity <= 1e-8) {
      this.integrity = 0;
      this.raised = false;
    }
    return damage - held;
  }
}
