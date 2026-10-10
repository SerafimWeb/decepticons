import { SHOULDER_TRIGGERS } from '../combat/mounts';
import { weapon, type WeaponId } from '../combat/weapons';
import type { MechStats } from './MechBase';

/**
 * Chassis: os números de cada robô, sem modelo 3D nem física (só dados). É o que a simulação, o Hangar,
 * o site e, no multiplayer, o servidor leem; o visual de cada um fica no arquivo do modelo
 * (`Vector09.ts`, `Android.ts`). Sem Three.js aqui: o servidor vai importar este arquivo.
 */

/**
 * Vector-09: assalto ágil, pulo duplo, dash curto; sem compartimento de sucata.
 * Calibrado em 24/09 (dono: "muito rápido; o tiro precisa de um respiro"): menos velocidade e calor na arma.
 * Armas em 25/09 (arsenal em `combat/weapons.ts`): plasma MK I no braço direito, foguetes MK I no esquerdo.
 * Carga de armas de 11 t (Hangar, 25/09): cabe MK III num braço e MK I no outro, nunca os dois no máximo.
 * Peso (dono, 25/09: "os Mechs ainda estão rápidos para o peso e a massa deles"): 12 → 9 m/s, arrancada e
 * freada em ~0,3 s (aceleração 70 → 30: sente-se a inércia), dash 42 → 34 m/s. O andróide (10,5 m/s)
 * passou a correr mais que o Mech: o pequeno escapa, o grande esmaga.
 */
export const VECTOR09_STATS: MechStats = {
  name: 'VECTOR-09',
  moveSpeed: 9,
  groundAccel: 30,
  airAccel: 14,
  jumpVelocity: 13,
  maxJumps: 2,
  dashSpeed: 34,
  dashDuration: 0.18,
  dashCooldown: 3,
  radius: 1.3,
  height: 5.3,
  stepHeight: 0.9,
  demolishOnDash: false,
  maxScrapSlots: 0,
  loadout: { primary: weapon('plasma'), secondary: weapon('rockets') },
  weaponCapacity: 11,
  heatCooling: 0.7,
  heatCoolDelay: 0.25,
  heatRecover: 0.4,
  heatIdleCooling: 2,
  heatRun: 0.06,
  heatJump: 0.03,
  heatDash: 0.07,
  heatPerDamage: 0.002,
  maxModuleHealth: {
    torso: 300,
    head: 100,
    leftArm: 120,
    rightArm: 120,
    leftLeg: 150,
    rightLeg: 150,
  },
};

/**
 * Andróide rebelde, escala 1: um robô autônomo do tamanho de um humano (1,6 m; era 2 m até o dono achar grande
 * perto do Mech de 5,3 m), uma IA
 * rebelde a pé. Mais chato do que perigoso (dono, 25/09: "rápido, mas fraco"): cai com 2 tiros de
 * plasma ou com 2 pisões de Mech; a arma dele é uma motosserra que só corta encostado (as pernas do Mech), mas arranca na hora, pula duas vezes e desvia com dash
 * a cada 1,4 s. Alvo pequeno: acertar exige mira de verdade (no toque, a mira assistida ajuda).
 * O mesmo corpo serve ao técnico (visor amarelo), que conserta os Mechs em vez de atirar.
 */
export const ANDROID_STATS: MechStats = {
  name: 'ANDRÓIDE A-1',
  statusResist: 1.5, // pequeno: fogo, choque e gelo duram uma vez e meia (`combat/StatusEffects.ts`)
  moveSpeed: 10.5,
  groundAccel: 120,
  airAccel: 40,
  jumpVelocity: 10,
  maxJumps: 2,
  dashSpeed: 30,
  dashDuration: 0.14,
  dashCooldown: 1.4,
  radius: 0.36,
  height: 1.6,
  stepHeight: 0.36,
  demolishOnDash: false,
  maxScrapSlots: 0,
  loadout: { primary: weapon('chainsaw'), secondary: null },
  weaponCapacity: 1.5,
  heatCooling: 0.7,
  heatCoolDelay: 0.2,
  heatRecover: 0.3,
  heatIdleCooling: 2,
  heatRun: 0.08,
  heatJump: 0.02,
  heatDash: 0.05,
  heatPerDamage: 0.002,
  maxModuleHealth: {
    torso: 32,
    head: 13,
    leftArm: 16,
    rightArm: 16,
    leftLeg: 19,
    rightLeg: 19,
  },
};

/**
 * Andróide pilotado pelo jogador (dono, 25/09: "também quero poder jogar com andróides menores e ter a
 * impressão de que estou combatendo um Mech bem maior"). O mesmo corpo de 1,6 m e a mesma agilidade do
 * rebelde, mas 3× a vida (o jogador não pode cair com 2 tiros de plasma). Blaster no braço direito e
 * motosserra no esquerdo: de longe incomoda; colado, serra as pernas do Mech. Continua pequeno: um Mech
 * rebelde que anda para cima dele encostado esmaga em 2 passos, como qualquer pequeno.
 */
export const PILOT_ANDROID_STATS: MechStats = {
  ...ANDROID_STATS,
  name: 'ANDRÓIDE',
  loadout: { primary: weapon('blaster'), secondary: weapon('chainsaw') },
  weaponCapacity: 3,
  maxModuleHealth: {
    torso: 96,
    head: 40,
    leftArm: 48,
    rightArm: 48,
    leftLeg: 57,
    rightLeg: 57,
  },
};

/**
 * Arara-B1: chassi leve e ágil de escala 1, batedor — primeiro modelo da **Arara Foundry** (Manaus, ver
 * `.decepticons/VISAO.md` § fabricantes). Pernas longas, pouca blindagem, dash curto e rápido: sente-se
 * frágil de propósito — vence pela mobilidade, cai fácil se ficar parado. Usa o blueprint visual próprio
 * (`LIGHT_MECH_BLUEPRINT`, já existia, nunca tinha sido ligado a um chassi pilotável).
 */
export const ARARA_B1_STATS: MechStats = {
  ...VECTOR09_STATS,
  name: 'ARARA-B1',
  moveSpeed: 13,
  groundAccel: 40,
  dashSpeed: 42,
  dashCooldown: 2,
  height: 4.5,
  radius: 1.0,
  weaponCapacity: 8,
  maxModuleHealth: {
    torso: 200,
    head: 70,
    leftArm: 80,
    rightArm: 80,
    leftLeg: 100,
    rightLeg: 100,
  },
};

/**
 * Onça-B2: chassi pesado de escala 2, resistente e lento — segundo modelo da Arara Foundry. Blindagem
 * grossa e carga alta, sem a velocidade do Arara-B1; não é o Colossus (escala 3, máquina de cerco de
 * 14 m) — este é o "pesado" de tamanho normal, do porte de um Mech grande, não de um boss. Usa o
 * blueprint visual próprio (`HEAVY_MECH_BLUEPRINT`, idem, nunca tinha sido ligado).
 */
export const ONCA_B2_STATS: MechStats = {
  ...VECTOR09_STATS,
  name: 'ONÇA-B2',
  moveSpeed: 6,
  groundAccel: 20,
  dashSpeed: 25,
  dashCooldown: 4,
  height: 6.5,
  radius: 1.6,
  weaponCapacity: 16,
  maxModuleHealth: {
    torso: 450,
    head: 150,
    leftArm: 180,
    rightArm: 180,
    leftLeg: 220,
    rightLeg: 220,
  },
};

/**
 * Colossus-01: **máquina de cerco de escala 3 (14 m)**. Nasce como boss da missão (`Vector09` do pool de
 * bots, com o blueprint de 14 m e perfil de cerco) e, desde 29/09, também entra em `CHASSIS` como chassi
 * solo pilotável — os mesmos números, sem cópia.
 *
 * O peso está nas partes, não numa barra de vida única: **as duas pernas (600) caem antes do torso (1 600)**,
 * então derrubar o Colossus é derrubar as pernas primeiro — o que dá sentido às metas da ficha ("giro lento,
 * flanco exposto") e usa o dano por parte que o jogo já tem. Números de partida: o primeiro corte do encontro;
 * o equilíbrio fino fica com `combat/balance.ts` e os testes.
 */
export const COLOSSUS_BOSS_STATS: MechStats = {
  ...VECTOR09_STATS,
  name: 'COLOSSUS-01',
  statusResist: 0.5, // máquina de cerco: fogo, choque e gelo duram metade (decisão do dono, 09/10)
  height: 14,
  radius: 3.6, // < height/2: a cápsula do Rapier não aceita raio maior que a metade da altura
  stepHeight: 2.4,
  moveSpeed: 5, // metade de um Vector-09: dá tempo de circular, e é o que a ficha promete
  groundAccel: 10,
  airAccel: 3,
  jumpVelocity: 0,
  maxJumps: 0,
  dashSpeed: 0,
  dashDuration: 0,
  dashCooldown: 1,
  demolishOnDash: false,
  weaponCapacity: 24,
  maxModuleHealth: { torso: 1200, head: 260, leftArm: 380, rightArm: 380, leftLeg: 450, rightLeg: 450 },
};

/**
 * Gênesis-01: primeiro chassi de malha importada (pipeline híbrido, 30/09 — ver `HISTORICO_DE_DECISOES.md`),
 * não mais primitiva em código. Números emprestados do Vector-09 (mesma classe visual: bípede médio de
 * assalto) — ainda não passou por uma rodada de equilíbrio própria; nome e ficha são provisórios até o dono
 * decidir a identidade de verdade dele.
 */
export const GENESIS01_STATS: MechStats = {
  ...VECTOR09_STATS,
  name: 'GÊNESIS-01',
  // Papel (10/10, proposta do Claude; o dono ajusta aqui ou em Configurações → Potências): ASSALTO MÉDIO, um degrau acima do Vector-09 em vida e
  // um passo mais lento. Só vida e mobilidade mudam: calor, carga e tamanho ficam os do Vector-09 (as metas de equilíbrio das armas dependem deles).
  moveSpeed: 8.5,
  groundAccel: 28,
  maxModuleHealth: { torso: 350, head: 110, leftArm: 130, rightArm: 130, leftLeg: 160, rightLeg: 160 },
};

/**
 * Lancer-L1: bípede médio importado, malha da Forge Systems. Dono, 03/10: o braço esquerdo leva um **escudo**, então
 * não tem lança-mísseis; a arma dele é a **escopeta** (alcance curto, dano alto de perto). O escudo ainda é só
 * desenho: não bloqueia dano (a aba "blindagem" do Hangar está em breve).
 */
export const LANCER_L1_STATS: MechStats = {
  ...VECTOR09_STATS,
  name: 'LANCER-L1',
  // Papel: DUELISTA de curta distância (a escopeta só vale de perto). Ágil, com dash que volta mais cedo, menos vida no tronco, e o braço do
  // escudo é o mais forte (a chapa protege o flanco e o braço é a primeira coisa que ele põe na frente).
  moveSpeed: 9.8,
  groundAccel: 34,
  airAccel: 16,
  dashSpeed: 36,
  dashCooldown: 2.6,
  maxModuleHealth: { torso: 270, head: 95, leftArm: 170, rightArm: 120, leftLeg: 140, rightLeg: 140 },
  loadout: { primary: weapon('shotgun'), secondary: null, metalShield: { id: 'muralha', tier: 0 } },
};

/** LR-7L Bastion: chassi importado, Cybermech Industries. */
export const LR7L_BASTION_STATS: MechStats = {
  ...VECTOR09_STATS,
  name: 'LR-7L BASTION',
  // Papel: TANQUE. O mais resistente dos médios, e paga com passo lento, arrancada pesada e dash curto e demorado. Segura a posição.
  moveSpeed: 7.5,
  groundAccel: 24,
  airAccel: 12,
  dashSpeed: 30,
  dashCooldown: 3.6,
  jumpVelocity: 11.5,
  maxModuleHealth: { torso: 460, head: 130, leftArm: 160, rightArm: 160, leftLeg: 210, rightLeg: 210 },
};

/** Quadra-V2: chassi importado, Vanta Works. */
export const QUADRA_V2_STATS: MechStats = {
  ...VECTOR09_STATS,
  name: 'QUADRA-V2',
  // Papel: ESCARAMUÇADOR. Corre mais que todos os médios, dash que volta cedo e pulo alto; cai rápido (pouca vida em tudo). Bate e some.
  moveSpeed: 11.5,
  groundAccel: 38,
  airAccel: 18,
  dashSpeed: 38,
  dashCooldown: 2.2,
  jumpVelocity: 14.5,
  maxModuleHealth: { torso: 210, head: 80, leftArm: 90, rightArm: 90, leftLeg: 120, rightLeg: 120 },
};

/**
 * MARAUDER: chassi importado do Tripo3D. Dono, 03/10: "duas armas iguais nas mãos (o blaster) e dois lança-mísseis nos
 * ombros". As duas mãos atiram no botão principal e os dois ombros lançam juntos no secundário (`SHOULDER_TRIGGERS`);
 * os dois lançadores contam na carga (`firingWeapons`).
 */
export const MARAUDER_STATS: MechStats = {
  ...VECTOR09_STATS,
  name: 'MARAUDER',
  // Papel: PLATAFORMA DE FOGO (quatro canos: duas mãos e dois ombros). Vida alta e passo lento: é um canhão que anda, não um corredor.
  moveSpeed: 7.8,
  groundAccel: 26,
  airAccel: 12,
  dashSpeed: 31,
  dashCooldown: 3.4,
  jumpVelocity: 12,
  maxModuleHealth: { torso: 380, head: 110, leftArm: 140, rightArm: 140, leftLeg: 180, rightLeg: 180 },
  loadout: { primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('rockets') },
  triggers: SHOULDER_TRIGGERS,
  // Bocas medidas no desenho (`npm run mech:bocas -- marauder`), em metros a partir dos pés, virado para -Z: o servidor atira
  // daqui, e o corpo dele é outro (G14). Mudou o rig, a pose ou o módulo de uma arma? Meça de novo.
  muzzles: {
    rightHand: [1.57, 3.82, -1.54],
    leftHand: [-1.59, 3.84, -1.55],
    rightShoulder: [1.08, 4.82, 0.04],
    leftShoulder: [-1.08, 4.82, 0.04],
  },
};

/**
 * Chassis que o jogador pode pilotar (o andróide rebelde e o técnico são só das IAs).
 * **Colossus-01 (dono, 29/09: "quero poder escolher o colossus pra ver como é jogar com ele"):** entrou como
 * chassi solo, pilotado por 1 jogador só, com todas as armas — a mesma máquina que já existe como boss
 * (`COLOSSUS_BOSS_STATS`), sem números novos. **Não balanceado contra os bots**: 1200 de torso e 24 t de
 * carga são os do encontro; jogar com ele contra Mechs normais é claramente mais forte, de propósito, para o
 * dono sentir a escala antes de qualquer ajuste. O Mech de tripulação (piloto + artilheiros nas armas
 * direcionais, pedido na mesma mensagem) é a próxima etapa — este PR entrega só o solo.
 */
export const CHASSIS = {
  vector09: VECTOR09_STATS,
  android: PILOT_ANDROID_STATS,
  colossus01: COLOSSUS_BOSS_STATS,
  arara: ARARA_B1_STATS,
  onca: ONCA_B2_STATS,
  genesis01: GENESIS01_STATS,
  lancerL1: LANCER_L1_STATS,
  lr7lBastion: LR7L_BASTION_STATS,
  quadraV2: QUADRA_V2_STATS,
  marauder: MARAUDER_STATS,
} as const satisfies Record<string, MechStats>;
export type ChassisId = keyof typeof CHASSIS;

/**
 * O papel de cada chassi em uma frase: o que ele faz bem e o que paga por isso. Os números moram em cada `*_STATS` acima; mexer num papel
 * é mexer ali (e em `ChassisPapeis.test.ts`, que garante que nenhum chassi é melhor que outro em tudo).
 */
export const CHASSIS_PAPEL: Readonly<Record<ChassisId, string>> = {
  vector09: 'Equilibrado: a referência. Nada excelente, nada fraco.',
  genesis01: 'Assalto médio: mais vida que o Vector-09, um passo mais lento.',
  lancerL1: 'Duelista de curta distância: ágil, dash que volta cedo, braço do escudo forte, menos vida no tronco.',
  lr7lBastion: 'Tanque: o mais resistente dos médios; passo lento, arrancada pesada e dash curto e demorado.',
  quadraV2: 'Escaramuçador: o mais rápido dos médios, dash que volta cedo e pulo alto; cai com poucos tiros.',
  marauder: 'Plataforma de fogo: quatro canos (duas mãos e dois ombros), vida alta e passo lento.',
  arara: 'Escoteiro leve: o mais rápido de todos e o mais frágil; carga pequena.',
  onca: 'Pesado: muita vida e muita carga; lento, com o dash mais demorado.',
  colossus01: 'Máquina de cerco (escala 3): vida enorme, quase não anda, sem dash.',
  android: 'Andróide: pequeno, muito rápido e frágil; arma leve e motosserra.',
};

/**
 * O que cada encaixe aceita em cada chassi: o Hangar só oferece e só valida estas armas. `shoulders` só existe nos
 * chassis com lançadores nos ombros (`SHOULDER_TRIGGERS`); nesses, o braço esquerdo leva uma segunda arma do botão
 * principal e o secundário sai dos ombros.
 */
export interface ArmSlots {
  right: readonly WeaponId[];
  left: readonly WeaponId[];
  shoulders?: readonly WeaponId[];
}
/** Engate de energia compartilhado; massa/nível ainda limitam cada montagem. */
const ENERGY_ARMS: readonly WeaponId[] = ['plasma', 'blaster', 'shotgun', 'railgun', 'emp', 'arc'];
const SUPPORT_ARMS: readonly WeaponId[] = [...ENERGY_ARMS, 'rockets', 'barrage'];
/** Armas do gatilho principal, mão direita (e a esquerda nos chassis de duas mãos no gatilho): a rotatória gira o cano e só existe aí. */
const PRIMARY_ARMS: readonly WeaponId[] = [...ENERGY_ARMS, 'rotary'];
export const ARM_SLOTS: Record<ChassisId, ArmSlots> = {
  vector09: { right: PRIMARY_ARMS, left: SUPPORT_ARMS },
  android: { right: ['blaster'], left: ['chainsaw'] },
  colossus01: { right: PRIMARY_ARMS, left: SUPPORT_ARMS },
  arara: { right: PRIMARY_ARMS, left: SUPPORT_ARMS },
  onca: { right: [...PRIMARY_ARMS, 'rockets'], left: SUPPORT_ARMS },
  genesis01: { right: PRIMARY_ARMS, left: SUPPORT_ARMS },
  lancerL1: { right: ENERGY_ARMS, left: [] },
  lr7lBastion: { right: PRIMARY_ARMS, left: SUPPORT_ARMS },
  quadraV2: { right: PRIMARY_ARMS, left: SUPPORT_ARMS },
  marauder: { right: PRIMARY_ARMS, left: PRIMARY_ARMS, shoulders: ['rockets', 'barrage'] },
};

/** Chassis cujo braço esquerdo leva um escudo (sem arma): o Hangar escreve ESCUDO onde os outros escrevem VAZIO. */
export const SHIELD_ARM: readonly ChassisId[] = ['lancerL1'];

/**
 * Chassis com suporte para o escudo metálico removível na mão esquerda (dono, 06/10: só chassis compatíveis, incluindo o
 * Lancer). Os procedurais desenham a chapa no antebraço; o Lancer já traz a dele na malha. Importados sem chapa ficam fora.
 */
export const METAL_SHIELD_CHASSIS: readonly ChassisId[] = ['vector09', 'onca', 'colossus01', 'lancerL1'];
