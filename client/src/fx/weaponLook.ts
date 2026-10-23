import * as THREE from 'three';
import type { WeaponId } from '../combat/weapons';
import { GLOW } from '../core/palette';
import { BILL, type BillShape } from './Billboards';
import { MARK, type MarkKind } from './Marks';
import type { TrailKind } from './Ribbons';

/**
 * A cara de cada arma (P160): o que o tiro **parece**, separado do que ele **faz** (`combat/weapons.ts`). Antes todo tiro de energia era a mesma
 * risca verde, sem brilho na cabeça, sem clarão na boca e sem marca onde batia; agora cada família tem o seu desenho completo:
 *
 * | família | cabeça do tiro | boca | onde bate | rastro |
 * |---|---|---|---|---|
 * | plasma / blaster | bola de luz verde com núcleo branco | estrela verde | furo com aro verde que esfria | — |
 * | escopeta | balins quentes pequenos | estrela grande + língua de fogo | furos de metal | — |
 * | rotatória / automático / canhão | brasa alaranjada (o corpo de aço já existe) | estrela + língua de pólvora | furo com aro em brasa | obus: fumaça |
 * | trilho | ponto branco-azulado | estrela + anel | furo azul fundo | o **raio iônico** (feixe grosso que apaga) |
 * | elétrica | estrela azul que pisca | estrela azul | — (os raios do impacto) | — |
 * | gelo | bola branca-gelo | estrela pálida | **geada** de seis braços | — |
 * | EMP | anel azul | anel | — | — |
 * | foguetes e mísseis | o brilho do motor (azul-frio no teleguiado) | estrela de fogo | (a explosão) | **fumaça e fogo do motor** |
 *
 * A cor segue a regra de leitura do combate (`core/palette.ts`): o tiro do jogador na cor da família, o do inimigo puxado para o vermelho, o
 * laranja ou o violeta (o aviso). É dado, não código: o Estúdio (aba TIROS E ARMAS, P157) vai editar esta tabela.
 */

/** Um cartaz com cor de jogador e de inimigo. */
export interface LookGlow {
  shape: BillShape;
  /** Diâmetro (m). */
  size: number;
  friendly: THREE.Color;
  hostile: THREE.Color;
}

export interface LookMuzzle extends LookGlow {
  /** Segundos de clarão. */
  life: number;
  /** Uma língua de fogo deitada na direção do tiro, além da estrela (pólvora). */
  tongue: boolean;
}

export interface LookMark {
  kind: MarkKind;
  /** Diâmetro (m). */
  size: number;
  /** Segundos até sumir. */
  life: number;
  friendly: THREE.Color;
  hostile: THREE.Color;
  /** Uma marca a cada N acertos (a rotatória acerta 20 por segundo). */
  every: number;
}

export interface WeaponLook {
  /** O brilho que acompanha a cabeça do projétil em voo (`null` = o desenho do tiro basta). */
  glow: LookGlow | null;
  muzzle: LookMuzzle | null;
  /** O clarão no ponto do acerto (além das partículas de `impactFx.ts`). */
  hit: LookGlow | null;
  /** A marca que fica na parede ou no chão (só em superfície parada: num Mech ela sairia andando). */
  mark: LookMark | null;
  trail: TrailKind | null;
  /** O tiro acerta e **explode** com a bola de fogo (o obus do canhão de cerco), além do dano em área da regra. */
  blast: boolean;
  /** O trilho deixa um raio iônico do cano ao ponto do acerto. */
  rail: boolean;
}

const c = (r: number, g: number, b: number): THREE.Color => new THREE.Color(r, g, b);

const GREEN_CORE = c(1.6, 3.4, 1.9);
const RED_CORE = c(4.2, 1.0, 0.8);
const POWDER = c(2.6, 1.5, 0.5);
const POWDER_HOSTILE = c(4.0, 1.2, 0.4);
const STEEL_HOT = c(3.0, 1.5, 0.45);
const STEEL_HOT_HOSTILE = c(3.6, 0.8, 0.3);
const RAIL = c(1.8, 2.6, 3.6);
const RAIL_HOSTILE = c(3.6, 1.2, 2.4);
const NONE = null;

const ENERGY = (size: number, muzzle: number, mark: number): Pick<WeaponLook, 'glow' | 'muzzle' | 'hit' | 'mark'> => ({
  glow: { shape: BILL.glow, size, friendly: GREEN_CORE, hostile: RED_CORE },
  muzzle: { shape: BILL.star, size: muzzle, life: 0.07, friendly: GLOW.friendlyPlasma, hostile: GLOW.hostilePlasma, tongue: false },
  hit: { shape: BILL.glow, size: size * 2.2, friendly: GLOW.friendlyPlasma, hostile: GLOW.hostilePlasma },
  mark: { kind: MARK.hole, size: mark, life: 5, friendly: GLOW.friendlyPlasma, hostile: GLOW.hostilePlasma, every: 1 },
});

const KINETIC = (glow: number, muzzle: number, mark: number, every = 1): Pick<WeaponLook, 'glow' | 'muzzle' | 'hit' | 'mark'> => ({
  glow: glow > 0 ? { shape: BILL.glow, size: glow, friendly: STEEL_HOT, hostile: STEEL_HOT_HOSTILE } : NONE,
  muzzle: { shape: BILL.star, size: muzzle, life: 0.06, friendly: POWDER, hostile: POWDER_HOSTILE, tongue: true },
  hit: { shape: BILL.star, size: muzzle * 0.8, friendly: STEEL_HOT, hostile: STEEL_HOT_HOSTILE },
  mark: { kind: MARK.hole, size: mark, life: 7, friendly: STEEL_HOT, hostile: STEEL_HOT_HOSTILE, every },
});

const ROCKET_MUZZLE: LookMuzzle = { shape: BILL.star, size: 2.4, life: 0.08, friendly: POWDER, hostile: POWDER_HOSTILE, tongue: false };
const MOTOR = c(3.6, 1.6, 0.45);
const MOTOR_GUIDED = c(1.4, 2.2, 3.6);
/** O míssil: o brilho do motor (`size` m) no corpo, a fumaça e o fogo em fita (`trail`) e o clarão do lançamento. */
const MISSILE = (trail: TrailKind, size: number, muzzle: LookMuzzle | null = ROCKET_MUZZLE, motor = MOTOR): WeaponLook => ({
  glow: { shape: BILL.glow, size, friendly: motor, hostile: motor },
  muzzle, hit: NONE, mark: NONE, trail, blast: false, rail: false,
});
const QUIET: WeaponLook = { glow: NONE, muzzle: NONE, hit: NONE, mark: NONE, trail: NONE, blast: false, rail: false };

export const WEAPON_LOOK: Readonly<Record<WeaponId, WeaponLook>> = {
  plasma: { ...ENERGY(1.15, 1.7, 1.1), trail: NONE, blast: false, rail: false },
  blaster: { ...ENERGY(0.8, 1.2, 0.75), trail: NONE, blast: false, rail: false },
  shotgun: { ...KINETIC(0.42, 3.0, 0.6), trail: NONE, blast: false, rail: false },
  rotary: { ...KINETIC(0.36, 1.3, 0.5, 3), trail: NONE, blast: false, rail: false },
  autocannon: { ...KINETIC(0.6, 1.9, 0.85), trail: NONE, blast: false, rail: false },
  cannon: { ...KINETIC(1.3, 2.4, 2.2), trail: 'shell', blast: false, rail: false },
  siege: { ...KINETIC(1.8, 3.6, 2.8), trail: 'shell', blast: true, rail: false },
  railgun: {
    glow: { shape: BILL.glow, size: 1.0, friendly: RAIL, hostile: RAIL_HOSTILE },
    muzzle: { shape: BILL.star, size: 3.2, life: 0.1, friendly: RAIL, hostile: RAIL_HOSTILE, tongue: false },
    hit: { shape: BILL.star, size: 3.0, friendly: RAIL, hostile: RAIL_HOSTILE },
    mark: { kind: MARK.hole, size: 1.4, life: 8, friendly: RAIL, hostile: RAIL_HOSTILE, every: 1 },
    trail: NONE, blast: false, rail: true,
  },
  arc: {
    glow: { shape: BILL.star, size: 1.3, friendly: GLOW.friendlyArc, hostile: GLOW.hostileArc },
    muzzle: { shape: BILL.star, size: 1.6, life: 0.08, friendly: GLOW.friendlyArc, hostile: GLOW.hostileArc, tongue: false },
    hit: { shape: BILL.glow, size: 2.2, friendly: GLOW.friendlyArc, hostile: GLOW.hostileArc },
    mark: NONE, trail: NONE, blast: false, rail: false,
  },
  cryo: {
    glow: { shape: BILL.glow, size: 1.0, friendly: GLOW.friendlyIce, hostile: GLOW.hostileIce },
    muzzle: { shape: BILL.star, size: 1.4, life: 0.08, friendly: GLOW.friendlyIce, hostile: GLOW.hostileIce, tongue: false },
    hit: NONE,
    mark: { kind: MARK.frost, size: 1.5, life: 6, friendly: c(0.75, 0.9, 1.0), hostile: c(0.9, 0.78, 1.0), every: 1 },
    trail: NONE, blast: false, rail: false,
  },
  emp: {
    glow: { shape: BILL.ring, size: 1.6, friendly: GLOW.friendlyArc, hostile: GLOW.hostileArc },
    muzzle: { shape: BILL.ring, size: 1.8, life: 0.12, friendly: GLOW.friendlyArc, hostile: GLOW.hostileArc, tongue: false },
    hit: NONE, mark: NONE, trail: NONE, blast: false, rail: false,
  },
  laser: {
    glow: NONE,
    muzzle: { shape: BILL.glow, size: 0.9, life: 0.1, friendly: GLOW.friendlyLaser, hostile: GLOW.hostileLaser, tongue: false },
    hit: { shape: BILL.glow, size: 1.2, friendly: GLOW.friendlyLaser, hostile: GLOW.hostileLaser },
    mark: { kind: MARK.hole, size: 0.65, life: 3, friendly: GLOW.friendlyLaser, hostile: GLOW.hostileLaser, every: 2 },
    trail: NONE, blast: false, rail: false,
  },
  rockets: MISSILE('rocket', 1.1),
  seeker: MISSILE('guided', 1.1, ROCKET_MUZZLE, MOTOR_GUIDED),
  swarm: MISSILE('micro', 0.55, NONE),
  cruise: MISSILE('cruise', 1.8, { ...ROCKET_MUZZLE, size: 3.4, life: 0.12 }),
  // O arpão (P77): o disparo é um raio (o `BeamVisuals`) e o cabo preso é o `HookVisuals`; aqui só o clarão da boca, em ciano-magnético (o inimigo em vermelho).
  harpoon: {
    glow: NONE,
    muzzle: { shape: BILL.star, size: 1.6, life: 0.1, friendly: c(0.6, 2.2, 3.2), hostile: c(3.4, 0.7, 0.5), tongue: false },
    hit: NONE, mark: NONE, trail: NONE, blast: false, rail: false,
  },
  // A granada (P160 parte 2b): a luz que pisca no corpo (verde-limão do jogador, vermelha do inimigo), a fita fina de fumaça e o "tum" do lançamento.
  grenade: {
    glow: { shape: BILL.star, size: 0.9, friendly: c(1.6, 2.6, 0.4), hostile: c(3.6, 0.6, 0.3) },
    muzzle: { shape: BILL.star, size: 2.0, life: 0.08, friendly: POWDER, hostile: POWDER_HOSTILE, tongue: false },
    hit: NONE, mark: NONE, trail: 'micro', blast: false, rail: false,
  },
  barrage: MISSILE('rocket', 0.9),
  sonic: QUIET,
  gas: QUIET,
  flamer: QUIET,
  chainsaw: QUIET,
};
