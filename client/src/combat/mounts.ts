import type { MechPart } from '../entities/MechBase';
import type { Loadout, WeaponStats } from './weapons';
import { extraDaMontagem } from './encaixesExtras';

/**
 * Encaixes de arma do corpo: os lugares de onde uma arma atira. Dado puro, sem 3D (G14: o servidor lê o mesmo).
 *
 * O encaixe diz **de onde** o tiro sai e **de que parte do corpo ele depende**; o gatilho (`TriggerLayout`) diz
 * **quais** encaixes atiram quando o jogador aperta cada botão. O lado do corpo não diz que tipo de arma vai ali.
 *
 * A ordem de `MOUNTS` é estável (ela pode ir para a rede um dia): encaixe novo entra no fim.
 */
export const MOUNTS = ['rightHand', 'leftHand', 'rightShoulder', 'leftShoulder', 'back'] as const;
export type MountId = (typeof MOUNTS)[number];

/** Direção ou posição em três números: x (direita), y (cima), z (trás). */
export type Vec3 = readonly [number, number, number];

/** A parte do corpo de que o encaixe depende: destruída, o encaixe para de atirar. O ombro é do torso. */
export const MOUNT_PART: Readonly<Record<MountId, MechPart>> = {
  rightHand: 'rightArm',
  leftHand: 'leftArm',
  rightShoulder: 'torso',
  leftShoulder: 'torso',
  back: 'torso',
};

/** Quais encaixes atiram em cada botão. Todos os de um botão atiram juntos (a segunda mão entra meio intervalo depois). */
export interface TriggerLayout {
  /** Botão principal (mouse esquerdo): o 1º leva `Loadout.primary`, o 2º (se houver) leva `Loadout.offhand`. */
  readonly primary: readonly MountId[];
  /** Botão secundário (mouse direito ou Q): todos levam `Loadout.secondary`. */
  readonly secondary: readonly MountId[];
}

/** Como todo chassi atira, salvo dito em contrário: principal na mão direita, secundário na esquerda. */
export const DEFAULT_TRIGGERS: TriggerLayout = { primary: ['rightHand'], secondary: ['leftHand'] };

/**
 * O Marauder: as duas mãos levam o gatilho principal (armas iguais, uma em cada mão) e os dois ombros levam o
 * secundário (um lançador em cada ombro, saem juntos e gastam um tiro do carregador).
 */
export const SHOULDER_TRIGGERS: TriggerLayout = { primary: ['rightHand', 'leftHand'], secondary: ['rightShoulder', 'leftShoulder'] };

/**
 * O Marauder no layout **dividido** (dono, 12/10, P95: "o ataque 2 podendo ser configurado"): só a mão direita fica no Ataque 1; a **mão esquerda vai para o Ataque 2**, junto dos
 * dois ombros. A mão esquerda segue com a `offhand` dela e os ombros com a `secondary`: **armas diferentes no mesmo ataque**, cada uma no seu ritmo, carregador e calor.
 */
export const SPLIT_SHOULDER_TRIGGERS: TriggerLayout = { primary: ['rightHand'], secondary: ['leftHand', 'rightShoulder', 'leftShoulder'] };

/**
 * Os robôs com encaixes extras (P282: Colossus-01, Onça) atiram os extras no **Ataque 2**, junto com a mão esquerda: as costas e os dois ombros são o botão secundário, cada um com a sua arma
 * (`combat/encaixesExtras.ts`). Sem a costa, o Onça não tem o encaixe dela: o gatilho só inclui o que o chassi tem.
 */
export const TRIGGERS_COM_COSTAS: TriggerLayout = { primary: ['rightHand'], secondary: ['leftHand', 'back', 'rightShoulder', 'leftShoulder'] };
export const TRIGGERS_COM_OMBROS: TriggerLayout = { primary: ['rightHand'], secondary: ['leftHand', 'rightShoulder', 'leftShoulder'] };

/** Um layout de gatilhos com nome, para o Hangar oferecer a escolha (o primeiro de cada chassi é o padrão). */
export interface NamedLayout {
  /** O nome inteiro (a dica do botão e os textos). */
  readonly name: string;
  /** O rótulo curto do botão do Hangar (cabe em meia linha). */
  readonly short: string;
  readonly triggers: TriggerLayout;
}

/** Os encaixes de ombro de um layout (os dois lançadores contam para a carga e atiram juntos). */
export const shoulderMounts = (t: TriggerLayout): readonly MountId[] => [...t.primary, ...t.secondary].filter((m) => m === 'rightShoulder' || m === 'leftShoulder');

/**
 * A arma que este encaixe leva na montagem: a mão direita, a `primary`; a esquerda, a `offhand` nos chassis de duas mãos armadas (Marauder) e a `secondary` nos outros; os ombros, a `secondary`.
 * Quem desenha o tiro (carga, chama) e quem atira perguntam isto, em vez de supor "índice 0 é a primary, índice 1 é a offhand".
 */
export function weaponAt(l: Loadout, mount: MountId): WeaponStats | null {
  if (mount === 'rightHand') return l.primary;
  if (mount === 'leftHand') return l.offhand !== undefined ? l.offhand : l.secondary;
  // Os encaixes extras (P282) levam a arma do próprio encaixe; o ombro sem extra é o lançador duplo do `secondary` (Marauder).
  const extra = extraDaMontagem(l, mount);
  if (extra !== null) return l[extra] ?? null;
  return l.secondary;
}

/** Os dois ataques do jogador: o **1** (o clique) e o **2** (o clique direito, ou Q). */
export type Attack = 1 | 2;

/**
 * Qual ataque aciona este encaixe neste layout de gatilhos (`null`: nenhum, o chassi não atira dali). Vocabulário do dono (12/10, P95): **Ataque 1** é o clique e **Ataque 2**, o clique direito.
 * Nos robôs pequenos de entrada, o braço direito é o Ataque 1 e o esquerdo, o Ataque 2 (cada braço com o seu botão, para combinar). Nos grandes, os braços são o Ataque 1 e os ombros (e,
 * um dia, costas e peito), o Ataque 2. É o que o Hangar, o HUD e as dicas dizem ao jogador.
 */
export function attackOf(triggers: TriggerLayout, mount: MountId): Attack | null {
  if (triggers.primary.includes(mount)) return 1;
  if (triggers.secondary.includes(mount)) return 2;
  return null;
}
