import { weapon } from '../combat/weapons';
import { VELOCIDADE_DA_MARCHA_MS } from '../sim/DragaMarcha';
import { COLOSSUS_BOSS_STATS } from './chassis';
import type { MechStats } from './MechBase';

/**
 * O DRAGA-01 como **corpo da simulação** (ordem P180, parte C): os números do chefe da Amazônia, sem 3D nem física (só dados), como o `COLOSSUS_BOSS_STATS`. **Não entra em `CHASSIS`**: ninguém
 * o escolhe no Hangar (é a máquina da mineradora), então ele não aparece na lista de robôs, no equilíbrio por chassi nem nas ordens de esquadrão.
 *
 * **As medidas são as do desenho** (`draga-01.glb`, medidas no rig): 38 m com o mastro do radar, ~20 m de largura e ~39 m de comprimento. A cápsula da física é vertical (36 m por 10 m de raio: o
 * Rapier só aceita raio até a metade da altura), e é o que os tiros acertam: o corpo é mais comprido que largo, então de lado e de frente a pontaria acha o casco no mesmo lugar.
 *
 * **O peso está nas partes** (a regra do Colossus, `sim/FasesDoChefe.ts`): os dois módulos de perna (cada um é **um lado**, duas pernas do desenho) caem antes do tronco, e cada lado caído tira metade
 * da velocidade; com os dois caídos ele rasteja a 30% (`crawls`). **Números de partida, não validados contra jogadores** (o equilíbrio fino fica com os testes de partida e com o Comandante): tronco de
 * 4.800 (2,5 vezes o do Colossus V4), pernas de 1.600, e o canhão de cerco no convés (360 de dano a cada 4,5 s).
 */
export const DRAGA_STATS: MechStats = {
  ...COLOSSUS_BOSS_STATS,
  name: 'DRAGA-01',
  statusResist: 0.4, // máquina de cerco: fogo, choque e gelo duram menos de metade
  height: 36,
  radius: 10,
  stepHeight: 4,
  moveSpeed: VELOCIDADE_DA_MARCHA_MS,
  groundAccel: 4,
  airAccel: 1,
  weaponCapacity: 40,
  maxModuleHealth: { torso: 4800, head: 600, leftArm: 900, rightArm: 900, leftLeg: 1600, rightLeg: 1600 },
  loadout: { primary: weapon('siege'), secondary: weapon('siege') },
  // As bocas do convés (o desenho: o convés fica a 17 m, o radar na frente): o servidor atira daqui e o corpo dele é outro (G14).
  muzzles: { rightHand: [3, 20, -12], leftHand: [-3, 20, -12] },
};
