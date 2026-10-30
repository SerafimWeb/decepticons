import { SHIELDS, type ShieldId } from './EnergyShield';
import { MASSA_DO_MODULO_VISAO } from './visaoNoturna';

/**
 * O MÓDULO EXTRA do Hangar (não ocupa os braços): um dos geradores de energia (a barreira, a esfera, o anel de fogo) **ou os óculos de visão noturna** (P282: o Arara, o Lancer e os andróides a
 * trazem de fábrica; os outros chassis a levam aqui, no lugar do gerador: é a escolha que o Comandante quer que custe alguma coisa). O texto da montagem (`hangar/loadout.ts`) já leva o módulo
 * como uma palavra, então `visao` viaja no mesmo lugar, sem formato novo. Dado puro (G14): o servidor valida com a mesma conta.
 */
export type ModuloId = ShieldId | 'visao';

/** Todos os módulos que o Hangar oferece, na ordem da lista. */
export const MODULOS: readonly ModuloId[] = [...(Object.keys(SHIELDS) as ShieldId[]), 'visao'];

export const ehModulo = (m: unknown): m is ModuloId => typeof m === 'string' && (Object.hasOwn(SHIELDS, m) || m === 'visao');

/** O módulo é o de visão noturna (e não um gerador)? */
export const ehVisaoNoturna = (m: ModuloId | null | undefined): boolean => m === 'visao';

/** O gerador de energia que este módulo põe no Mech (`null`: o módulo não é um gerador, ou não há módulo). */
export const geradorDoModulo = (m: ModuloId | null | undefined): ShieldId | null => (m === 'visao' || m == null ? null : m);

/** O peso do módulo na carga do chassi (t). */
export const massaDoModulo = (m: ModuloId): number => (m === 'visao' ? MASSA_DO_MODULO_VISAO : SHIELDS[m].mass);
