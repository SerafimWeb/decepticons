import type { WeaponClass } from './weaponClass';
import type { WeaponId } from './weapons';

/**
 * Tipos de encaixe: **onde no corpo** uma arma pode ficar (dono, 11/10, P84: "armas para braços / ombros / costas / peitoral... os slots padrão nos
 * mechs é geralmente isso: braços, ombros, cabeça"). Três coisas separadas, e este arquivo é a primeira:
 *
 * 1. **O tipo de encaixe** (aqui): braço, ombro, costas, peito, cabeça. Cada arma diz em quais tipos cabe (`WEAPON_MOUNTS`); cada encaixe de cada
 *    chassi tem um tipo (`SLOT_KIND` em `entities/chassis.ts`).
 * 2. **O tamanho que o encaixe aceita** (`KIND_MAX_CLASS`): até que classe de arma (`combat/weaponClass.ts`) cabe nele, na visão do chassi.
 * 3. **O botão que atira** (`combat/mounts.ts`, `TriggerLayout`): quem decide é o chassi, não o tipo.
 *
 * Hoje só **braço** e **ombro** existem como encaixe de verdade (`LIVE_KINDS`). Costas, peito e cabeça são **reservados**: a arma já pode dizer que cabe
 * neles, mas nenhum chassi os tem, e um teste trava essa lista (criar um encaixe novo é mexer aqui, em `MOUNTS`, na boca de cada robô e no desenho:
 * `ARMAS_DE_BOTAO_2.md` § 7). Dado puro, sem 3D: o servidor e o site leem o mesmo arquivo.
 */
export type MountKind = 'arm' | 'shoulder' | 'back' | 'chest' | 'head';

/** Todos os tipos, na ordem do corpo de cima para baixo e dos lados para o meio (a ordem das listas de tela). */
export const MOUNT_KINDS: readonly MountKind[] = ['arm', 'shoulder', 'back', 'chest', 'head'];

export const MOUNT_KIND_LABEL: Readonly<Record<MountKind, string>> = {
  arm: 'BRAÇO',
  shoulder: 'OMBROS',
  back: 'COSTAS',
  chest: 'PEITO',
  head: 'CABEÇA',
};

/** Os tipos que algum chassi já tem de verdade; os outros são reservados (a arma pode caber neles, mas não há onde pôr). */
export const LIVE_KINDS: readonly MountKind[] = ['arm', 'shoulder'];

/**
 * A maior classe de arma que cada tipo aceita, **na visão do chassi** (um gigante enxerga as pesadas dos Mechs como leves, então o mesmo encaixe dele aceita o que
 * para um Mech seria pesado). Braço, ombro e costas levam o que há de mais pesado; o peito, até a média; a cabeça, só leve.
 */
export const KIND_MAX_CLASS: Readonly<Record<MountKind, WeaponClass>> = {
  arm: 'heavy',
  shoulder: 'heavy',
  back: 'heavy',
  chest: 'medium',
  head: 'light',
};

/**
 * Em quais tipos de encaixe cada arma cabe. `Record` de propósito: arma nova que não declara onde cabe não compila.
 * O lançador de foguetes e a chuva de mísseis cabem em ombro e em costas (e no braço esquerdo, onde a chuva vira morteiro nas costas); o canhão sônico é
 * de ombro (dono: "as armas de som combinam em ficar nos ombros"); o resto é arma de mão.
 */
export const WEAPON_MOUNTS: Readonly<Record<WeaponId, readonly MountKind[]>> = {
  blaster: ['arm'],
  chainsaw: ['arm'],
  shotgun: ['arm'],
  arc: ['arm'],
  emp: ['arm'],
  plasma: ['arm'],
  cryo: ['arm'],
  autocannon: ['arm'],
  rotary: ['arm'],
  flamer: ['arm'],
  railgun: ['arm'],
  cannon: ['arm'],
  siege: ['arm'],
  rockets: ['arm', 'shoulder', 'back'],
  barrage: ['arm', 'shoulder', 'back'],
  sonic: ['shoulder'],
  // O guiado também cabe no braço (P152): é o Ataque 2 dos robôs pequenos, que não têm ombros; o encaixe de ombro e de costas segue sendo o dele no Marauder.
  seeker: ['arm', 'shoulder', 'back'],
  // Os mísseis novos (P152) são lançadores como os foguetes: braço, ombro e costas. O laser é arma de mão (feixe).
  swarm: ['arm', 'shoulder', 'back'],
  cruise: ['arm', 'shoulder', 'back'],
  laser: ['arm'],
};

/** A arma cabe num encaixe deste tipo? */
export const fitsMount = (id: WeaponId, kind: MountKind): boolean => WEAPON_MOUNTS[id].includes(kind);
