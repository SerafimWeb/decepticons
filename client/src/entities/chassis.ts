import { fitsMount, type MountKind } from '../combat/mountKinds';
import { SHOULDER_TRIGGERS, SPLIT_SHOULDER_TRIGGERS, TRIGGERS_COM_COSTAS, TRIGGERS_COM_OMBROS } from '../combat/mounts';
import { armasDoEncaixeExtra } from '../combat/encaixesExtras';
import { fitsSize, type RobotSize } from '../combat/weaponClass';
import { WEAPON_IDS, weapon, type WeaponId } from '../combat/weapons';
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
  visaoNoturna: true, // P282: os andróides enxergam no escuro de fábrica (o técnico e o manifestante também)
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
 * O **MANIFESTANTE** (P163/P166, capítulo 1): o vândalo humano que invade a estação junto com as máquinas, no elenco dos **eventos reais** que o Comandante pediu (a invasão
 * do Capitólio, 6/1/2021; a das sedes dos Três Poderes, 8/1/2023): **camisa amarela, boné e bandeira**, **sem arma de fogo**. Corpo de andróide, mas **mais fraco e mais lento**
 * (cai com um tiro certeiro no tronco), e a "arma" é a pancada de bandeira, **metade da motosserra** (10 de dano por segundo, só encostado). **O que ele faz de errado é o número:**
 * chega em grupo, **depreda os cabos** e **arromba as portas** da estação (`PortasDaEstacao.ts`). O nome vem do piloto (`MANIFESTANTE`), e é por ele que as regras o reconhecem.
 */
export const MANIFESTANTE_STATS: MechStats = {
  ...ANDROID_STATS,
  name: 'MANIFESTANTE',
  moveSpeed: 7.2,
  groundAccel: 70,
  maxJumps: 1,
  dashCooldown: 3.2,
  radius: 0.4,
  height: 1.75,
  loadout: { primary: { ...weapon('chainsaw'), name: 'Pancada de bandeira', damage: 2 }, secondary: null },
  maxModuleHealth: {
    torso: 22,
    head: 9,
    leftArm: 11,
    rightArm: 11,
    leftLeg: 13,
    rightLeg: 13,
  },
};

/** O piloto é um manifestante? O nome é `MANIFESTANTE` (o pool da missão em ondas e as regras do cabo e da porta leem daqui). */
export function ehManifestante(nome: string): boolean {
  return nome.startsWith('MANIFESTANTE');
}

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
 * Arara-B1: chassi leve e ágil, batedor (um Mech de tamanho 2, o mais leve deles; "escala 1" é o andróide) — primeiro modelo da **Arara Foundry** (Manaus, ver
 * `.decepticons/VISAO.md` § fabricantes). Pernas longas, pouca blindagem, dash curto e rápido: sente-se
 * frágil de propósito — vence pela mobilidade, cai fácil se ficar parado. Usa o blueprint visual próprio
 * (`LIGHT_MECH_BLUEPRINT`, já existia, nunca tinha sido ligado a um chassi pilotável).
 */
export const ARARA_B1_STATS: MechStats = {
  ...VECTOR09_STATS,
  name: 'ARARA-B1',
  visaoNoturna: true, // P282: o batedor enxerga no escuro de fábrica
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
  // P282: o Onça tem dois encaixes extras, um em cada ombro (de peso: armas pesadas, médias e leves; o cerco é tamanho 3 e não cabe nele). Sem arma de fábrica.
  triggers: TRIGGERS_COM_OMBROS,
  loadout: { ...VECTOR09_STATS.loadout, rightShoulder: null, leftShoulder: null },
  // Bocas dos ombros medidas no rig procedural (30/10): em metros a partir dos pés, virado para -Z.
  muzzles: { rightShoulder: [0.99, 4.95, 0], leftShoulder: [-0.99, 4.95, 0] },
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
  // P302 (31/10, o Comandante): 32 t para equipar o Colossus à altura do corpo.
  weaponCapacity: 32,
  maxModuleHealth: { torso: 1200, head: 260, leftArm: 380, rightArm: 380, leftLeg: 450, rightLeg: 450 },
};

/**
 * O Colossus que o jogador escolhe no Hangar (P82, 11/10): o corpo do chefe, com o armamento de fábrica do tamanho dele.
 * Num gigante (tamanho 3) as armas pesadas dos Mechs comuns são as leves (`combat/weaponClass.ts`), e só elas cabem nos encaixes
 * dele (`ARM_SLOTS`): canhão pesado na mão principal e chuva de mísseis na outra. **O chefe da missão segue com plasma e foguetes**
 * (`COLOSSUS_BOSS_STATS` intacto): trocar a arma do encontro mexe no equilíbrio dele, e isso fica para quando o dono pedir.
 */
const COLOSSUS_PLAYER_STATS: MechStats = {
  ...COLOSSUS_BOSS_STATS,
  // P282: três encaixes extras, um nas costas e um em cada ombro, de peso (armas pesadas, médias e leves). Saem vazios: o Comandante monta no Hangar.
  // P294 (31/10, o Comandante): a chuva de mísseis vai nas COSTAS (o morteiro das costas); o braço esquerdo fica livre.
  loadout: { primary: weapon('cannon'), secondary: null, back: weapon('barrage'), rightShoulder: null, leftShoulder: null },
  triggers: TRIGGERS_COM_COSTAS,
  // Bocas dos encaixes extras medidas no rig procedural (um zz-medir de Vector09, 30/10): em metros a partir dos pés, virado para -Z. Mudou o desenho do Colossus? Meça de novo.
  // P296: as três bocas do Colossus-01 ficam na parte de cima do chassi, alinhadas para a frente (a cabeça saiu): a das costas no centro, as dos ombros nos lados.
  muzzles: { back: [0, 11.25, -1.3], rightShoulder: [2.0, 11.25, -1.3], leftShoulder: [-2.0, 11.25, -1.3] },
};

/**
 * Colossus-V4: **o titã de escala 4** (dono, 12/10: "ele é do tamanho 4, bem maior que o colossus v3"). É a primeira máquina de
 * tamanho 4 do jogo e a primeira deste chassi com malha importada (o .glb do dono, re-rigado com o esqueleto Mixamo; ver
 * MECHS_IMPORTADOS.md §8). **Anda como o peso que é**: passo curto e joelho bem dobrado (MechStats.gait), 4 m/s (o Colossus-01
 * anda a 5), sem dash e sem salto. O armamento é o **canhão de cerco** (a primeira arma de tamanho 3, em combat/weapons.ts),
 * que num titã é a arma **leve** dele. **A altura de 20 m é proposta minha** — a P11 falava em "10× e 20× maiores" e o
 * Comandante ajusta nesta linha; o equilíbrio fino das armas fica com combat/balance.ts.
 */
export const COLOSSUS_V4_STATS: MechStats = {
  ...COLOSSUS_BOSS_STATS,
  name: 'COLOSSUS-V4',
  height: 20,
  radius: 5, // < height/2: a cápsula do Rapier não aceita raio maior que a metade da altura
  stepHeight: 3.2,
  moveSpeed: 4,
  groundAccel: 8,
  airAccel: 2.5,
  gait: { hip: 0.42, knee: 1.5 },
  weaponCapacity: 30,
  maxModuleHealth: { torso: 1900, head: 380, leftArm: 520, rightArm: 520, leftLeg: 700, rightLeg: 700 },
  loadout: { primary: weapon('siege'), secondary: weapon('siege') },
  // Bocas medidas no desenho (npm run mech:bocas -- colossusv4), em metros a partir dos pés, virado para -Z: o servidor
  // atira daqui e o corpo dele é outro (G14). Só as mãos — o titã não tem encaixe de ombro. Mudou o rig, a pose (armRest)
  // ou o módulo da arma? Meça de novo.
  muzzles: {
    rightHand: [8.55, 13.51, -9.18],
    leftHand: [-8.55, 13.51, -9.18],
  },
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
  visaoNoturna: true, // P282: o duelista enxerga no escuro de fábrica
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
  // Dois jeitos de dividir os encaixes entre o Ataque 1 e o Ataque 2 (dono, 12/10, P95: "podendo ser configurado assim"); o Hangar oferece a escolha e o primeiro é o padrão.
  layouts: [
    { name: 'BRAÇOS NO ATAQUE 1 · OMBROS NO ATAQUE 2', short: 'BRAÇOS 1 · OMBROS 2', triggers: SHOULDER_TRIGGERS },
    { name: 'DIREITO NO ATAQUE 1 · ESQUERDO E OMBROS NO ATAQUE 2', short: 'DIREITO 1 · ESQ. + OMBROS 2', triggers: SPLIT_SHOULDER_TRIGGERS },
  ],
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
 * (`COLOSSUS_BOSS_STATS`), sem números novos (só o armamento de fábrica, `COLOSSUS_PLAYER_STATS`). **Não balanceado contra os bots**: 1200 de torso e 24 t de
 * carga são os do encontro; jogar com ele contra Mechs normais é claramente mais forte, de propósito, para o
 * dono sentir a escala antes de qualquer ajuste. O Mech de tripulação (piloto + artilheiros nas armas
 * direcionais, pedido na mesma mensagem) é a próxima etapa — este PR entrega só o solo.
 */
export const CHASSIS = {
  vector09: VECTOR09_STATS,
  android: PILOT_ANDROID_STATS,
  colossus01: COLOSSUS_PLAYER_STATS,
  colossusv4: COLOSSUS_V4_STATS,
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
  colossusv4: 'Titã (escala 4): o maior do jogo; passo curto, joelho bem dobrado e o canhão de cerco.',
  android: 'Andróide: pequeno, muito rápido e frágil; arma leve e motosserra.',
};

/**
 * O tamanho de cada robô (`RobotSize`, a "escala" do `GAME_DESIGN.md`): 1 andróide, **2 Mechs (o padrão do jogo)**, 3 e 4 gigantes.
 * É o que decide como o chassi vê as classes de arma (`combat/weaponClass.ts`): num gigante as pesadas dos Mechs são as leves.
 * `Record` de propósito: chassi novo que não declara o tamanho não compila. Ninguém é de tamanho 4 ainda.
 */
/** O chassi é um titã (tamanho 3 ou 4: os Colossus)? Os titãs têm regras próprias de bot (`sim/esquadrao.ts`, `combat/titaBot.ts`). */
export const ehTita = (id: ChassisId): boolean => CHASSIS_SIZE[id] >= 3;

export const CHASSIS_SIZE: Readonly<Record<ChassisId, RobotSize>> = {
  android: 1,
  vector09: 2,
  arara: 2,
  onca: 2,
  genesis01: 2,
  lancerL1: 2,
  lr7lBastion: 2,
  quadraV2: 2,
  marauder: 2,
  colossus01: 3,
  colossusv4: 4,
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
  /** Os encaixes extras (P282, `combat/encaixesExtras.ts`): as costas e cada ombro, uma arma cada. Ausente = o chassi não tem o encaixe. */
  back?: readonly WeaponId[];
  rightShoulder?: readonly WeaponId[];
  leftShoulder?: readonly WeaponId[];
}
/** O tipo de encaixe de cada ranhura do Hangar (`combat/mountKinds.ts`): as duas mãos são braço, os dois lançadores são ombro. */
export const SLOT_KIND: Readonly<Record<keyof ArmSlots, MountKind>> = { right: 'arm', left: 'arm', shoulders: 'shoulder', back: 'back', rightShoulder: 'shoulder', leftShoulder: 'shoulder' };
/**
 * **A curadoria saiu; entrou o contrato** (ordem P120, 14/10/2026: "é só das que sejam possíveis mesmo, não precisa
 * inventar nova regra que estrague algo mais correto anterior"). Antes cada chassi tinha uma lista escolhida a dedo;
 * agora o Hangar oferece, em cada braço, **toda** arma que o **contrato** já permite — o tipo de encaixe (`fitsMount`) e o
 * tamanho do chassi (`fitsSize`) — menos as regras de **disparo** que já são do jogo (`combat/Armament.ts`) e não mudam:
 * o braço direito é o gatilho **principal** (energia, munição e a chama do lança-chamas) e o esquerdo, nos chassis comuns,
 * é o **secundário** (mísseis, corte e onda, mas **não** a chama nem o giro de cano da rotatória). O que **não** cabe
 * continua fora: o canhão sônico é só de ombro (e só o Marauder tem ombros) e o escudo do Lancer fica no lugar do braço.
 * A regra de quem leva o quê (P77, P19, P82) **não mudou** — mudou só quem é *oferecido*.
 */
const ENERGY_ARMS: readonly WeaponId[] = ['plasma', 'blaster', 'shotgun', 'railgun', 'emp', 'arc', 'cryo', 'autocannon'];
/** A arma é de corte (corpo a corpo): só o gatilho **secundário** sabe aplicá-la; no principal, viraria um projétil. */
const ehCorte = (id: WeaponId) => weapon(id).kind === 'melee';
/** A arma acende chama: o fluxo mora no gatilho principal (`combat/Armament.ts`). */
const ehChama = (id: WeaponId) => weapon(id).flame !== undefined;
/** A arma gira o cano: o desvio da rajada mora no gatilho principal. */
const ehGiro = (id: WeaponId) => weapon(id).spin !== undefined;
/** A chuva de mísseis é do gatilho **secundário** (a salva e o aviso no chão saem dele): não vai no principal. */
const ehChuva = (id: WeaponId) => weapon(id).barrage !== undefined;

/** O braço **direito** (gatilho principal): tudo o que caiba no encaixe e no tamanho, menos o que o principal não dispara. */
const armasDoBracoDireito = (size: RobotSize): readonly WeaponId[] =>
  WEAPON_IDS.filter((id) => fitsMount(id, 'arm') && fitsSize(id, size) && !ehCorte(id) && !ehChuva(id));

/**
 * O braço **esquerdo**: nos chassis de duas mãos armadas (`SPLIT_SHOULDER_TRIGGERS`, o Marauder) é um segundo gatilho
 * principal e vale o mesmo do direito; nos outros é o gatilho **secundário** — que sabe cortar e lançar a chuva, mas não
 * acende chama nem gira cano.
 */
const armasDoBracoEsquerdo = (size: RobotSize, primarioDuplo: boolean): readonly WeaponId[] =>
  WEAPON_IDS.filter((id) => {
    if (!fitsMount(id, 'arm') || !fitsSize(id, size)) return false;
    if (primarioDuplo) return !ehCorte(id) && !ehChuva(id);
    return ehCorte(id) || (!ehChama(id) && !ehGiro(id));
  });
export const ARM_SLOTS: Record<ChassisId, ArmSlots> = {
  vector09: { right: armasDoBracoDireito(CHASSIS_SIZE.vector09), left: armasDoBracoEsquerdo(CHASSIS_SIZE.vector09, false) },
  android: { right: armasDoBracoDireito(CHASSIS_SIZE.android), left: armasDoBracoEsquerdo(CHASSIS_SIZE.android, false) },
  // Os três encaixes extras de peso (P282): costas e os dois ombros, com teto de classe pesada (aceitam pesada, média e leve).
  colossus01: {
    right: armasDoBracoDireito(CHASSIS_SIZE.colossus01),
    left: armasDoBracoEsquerdo(CHASSIS_SIZE.colossus01, false),
    back: armasDoEncaixeExtra(CHASSIS_SIZE.colossus01, 'heavy'),
    rightShoulder: armasDoEncaixeExtra(CHASSIS_SIZE.colossus01, 'heavy'),
    leftShoulder: armasDoEncaixeExtra(CHASSIS_SIZE.colossus01, 'heavy'),
  },
  // O titã só tem as armas de tamanho 3 (o canhão de cerco, nas duas mãos): as dos Mechs não cabem nele.
  colossusv4: { right: armasDoBracoDireito(CHASSIS_SIZE.colossusv4), left: armasDoBracoEsquerdo(CHASSIS_SIZE.colossusv4, false) },
  arara: { right: armasDoBracoDireito(CHASSIS_SIZE.arara), left: armasDoBracoEsquerdo(CHASSIS_SIZE.arara, false) },
  // Os dois ombros de peso do Onça (P282), teto de classe pesada.
  onca: {
    right: armasDoBracoDireito(CHASSIS_SIZE.onca),
    left: armasDoBracoEsquerdo(CHASSIS_SIZE.onca, false),
    rightShoulder: armasDoEncaixeExtra(CHASSIS_SIZE.onca, 'heavy'),
    leftShoulder: armasDoEncaixeExtra(CHASSIS_SIZE.onca, 'heavy'),
  },
  genesis01: { right: armasDoBracoDireito(CHASSIS_SIZE.genesis01), left: armasDoBracoEsquerdo(CHASSIS_SIZE.genesis01, false) },
  // O Lancer-L1 traz a arma na própria malha e o escudo no braço esquerdo: a curadoria dele é da MALHA, não da regra.
  lancerL1: { right: ENERGY_ARMS, left: [] },
  lr7lBastion: { right: armasDoBracoDireito(CHASSIS_SIZE.lr7lBastion), left: armasDoBracoEsquerdo(CHASSIS_SIZE.lr7lBastion, false) },
  quadraV2: { right: armasDoBracoDireito(CHASSIS_SIZE.quadraV2), left: armasDoBracoEsquerdo(CHASSIS_SIZE.quadraV2, false) },
  marauder: { right: armasDoBracoDireito(CHASSIS_SIZE.marauder), left: armasDoBracoEsquerdo(CHASSIS_SIZE.marauder, true), shoulders: ['rockets', 'barrage', 'sonic', 'gas', 'seeker', 'swarm', 'cruise', 'grenade', 'harpoon'] },
};

/** Chassis cujo braço esquerdo leva um escudo (sem arma): o Hangar escreve ESCUDO onde os outros escrevem VAZIO. */
export const SHIELD_ARM: readonly ChassisId[] = ['lancerL1'];

/**
 * Chassis com suporte para o escudo metálico removível na mão esquerda (dono, 06/10: só chassis compatíveis, incluindo o
 * Lancer). Os procedurais desenham a chapa no antebraço; o Lancer já traz a dele na malha. Importados sem chapa ficam fora.
 */
export const METAL_SHIELD_CHASSIS: readonly ChassisId[] = ['vector09', 'onca', 'colossus01', 'lancerL1'];
