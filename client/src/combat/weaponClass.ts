import type { WeaponId } from './weapons';

/**
 * Classes de arma: leve, média e pesada (dono, 11/10: "as armas devem ter 3 diferentes tamanhos; robôs gigantes usam
 * armas pesadas como leves (pra eles), mas é a arma pesada normal dos outros robôs, os do tamanho 2, padrão principal
 * do jogo; futuramente faremos versões das armas para o tamanho 3 e 4").
 *
 * Duas coisas separadas, de propósito:
 * - **Classe** é o porte da arma, o tamanho do encaixe que ela pede. Não é o peso: o peso em toneladas sobe com o nível
 *   (MK III pesa o dobro), a classe não muda com o nível.
 * - **Tamanho** é o do robô para o qual a arma foi feita (o `RobotSize` do chassi: 1 andróide, 2 Mechs, 3 e 4 gigantes).
 *
 * **A regra, uma conta só:** a classe é relativa ao tamanho de quem carrega, e cada passo de tamanho sobe duas classes,
 * então **a pesada do tamanho N é a leve do tamanho N+1**. Num gigante (3) as armas pesadas dos Mechs comuns são as leves
 * dele; as médias e leves dos Mechs são pequenas demais para ele (`classFor` devolve `null`), e as médias e pesadas dele
 * ainda não existem (as versões de tamanho 3 e 4 entram como armas novas, com `size: 3`, sem mexer nesta regra).
 * A conta vale nos dois sentidos: o andróide (1) vê a leve dos Mechs como a pesada dele, e as médias e pesadas dos Mechs
 * são grandes demais para ele. Quais armas cada chassi oferece continua sendo a lista dele (`ARM_SLOTS`); a regra é o
 * limite que um teste confere em cada encaixe.
 *
 * Sem dependência do cliente: o servidor e o site importam este arquivo. Custo de CPU: nenhum (tabela e uma conta de
 * índice, usadas só ao montar o Hangar e ao validar a montagem).
 */
export type WeaponClass = 'light' | 'medium' | 'heavy';

/** Tamanho de robô: 1 andróide, 2 Mechs (o padrão do jogo), 3 e 4 gigantes (o 4 ainda não tem robô nem arma). */
export type RobotSize = 1 | 2 | 3 | 4;

/** Da menor para a maior: a posição aqui é a conta da regra. */
export const WEAPON_CLASSES: readonly WeaponClass[] = ['light', 'medium', 'heavy'];

export const CLASS_LABEL: Readonly<Record<WeaponClass, string>> = { light: 'LEVE', medium: 'MÉDIA', heavy: 'PESADA' };
export const CLASS_LABEL_PLURAL: Readonly<Record<WeaponClass, string>> = { light: 'LEVES', medium: 'MÉDIAS', heavy: 'PESADAS' };

/** Quantas classes sobe cada passo de tamanho (a pesada de um tamanho é a leve do seguinte). */
export const CLASSES_PER_SIZE_STEP = 2;

export interface WeaponFit {
  /** O porte da arma, no tamanho para o qual foi feita. */
  readonly class: WeaponClass;
  /** O tamanho de robô para o qual a arma foi feita. */
  readonly size: RobotSize;
}

/**
 * A classe de cada arma. `Record` de propósito: arma nova que não declara a classe não compila.
 * Leves (blaster, serra, escopeta, arco, EMP): armas ágeis de pouca carga; médias (plasma, gelo, sônico, automático,
 * rotatória, foguetes): o armamento de fábrica dos Mechs; pesadas: as que já eram dos chassis pesados por decisão do
 * dono (canhão pesado e lança-chamas) e as duas que mais pesam depois do canhão (trilho e chuva de mísseis).
 * Mudar a classe de uma arma é mudar uma linha aqui (e ela muda de grupo no Hangar sozinha).
 */
export const WEAPON_FIT: Readonly<Record<WeaponId, WeaponFit>> = {
  blaster: { class: 'light', size: 2 },
  chainsaw: { class: 'light', size: 2 },
  shotgun: { class: 'light', size: 2 },
  arc: { class: 'light', size: 2 },
  emp: { class: 'light', size: 2 },
  plasma: { class: 'medium', size: 2 },
  cryo: { class: 'medium', size: 2 },
  sonic: { class: 'medium', size: 2 },
  autocannon: { class: 'medium', size: 2 },
  rotary: { class: 'medium', size: 2 },
  rockets: { class: 'medium', size: 2 },
  seeker: { class: 'medium', size: 2 },
  flamer: { class: 'heavy', size: 2 },
  railgun: { class: 'heavy', size: 2 },
  barrage: { class: 'heavy', size: 2 },
  cannon: { class: 'heavy', size: 2 },
};

/**
 * A conta da regra sobre qualquer par classe/tamanho: a classe vista por um robô de `size`, ou `null` se a arma não cabe no
 * tamanho dele: pequena demais (num gigante, tudo abaixo da pesada dos Mechs) ou grande demais (a média e a pesada dos
 * Mechs no andróide, ou a de um tamanho acima do robô). Separada da tabela para testar tamanhos que ainda não têm arma.
 */
export function classAt(fit: WeaponFit, size: RobotSize): WeaponClass | null {
  const rank = WEAPON_CLASSES.indexOf(fit.class) - (size - fit.size) * CLASSES_PER_SIZE_STEP;
  return WEAPON_CLASSES[rank] ?? null;
}

/** A classe da arma vista por um robô de `size` (`null` = não cabe nele; ver `classAt`). */
export const classFor = (id: WeaponId, size: RobotSize): WeaponClass | null => classAt(WEAPON_FIT[id], size);

/** O robô de `size` sabe carregar esta arma? */
export const fitsSize = (id: WeaponId, size: RobotSize): boolean => classFor(id, size) !== null;
