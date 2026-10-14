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

import type { StatusInflict } from './StatusEffects';

export type WeaponId = 'plasma' | 'rockets' | 'blaster' | 'shotgun' | 'chainsaw' | 'barrage' | 'railgun' | 'emp' | 'rotary' | 'arc' | 'cryo' | 'flamer' | 'cannon' | 'autocannon' | 'sonic' | 'seeker' | 'siege';

/**
 * Chuva de mísseis: um lançamento sobe, e depois as bombas caem em volta do ponto da mira (`combat/BarrageSystem.ts`).
 * Tudo no tick fixo e sem sorteio: o lugar de cada bomba é função só do ponto da mira e da direção de quem atirou, então
 * o servidor e o cliente chegam ao mesmo desenho (o jogador remoto vê as bombas onde o servidor as joga).
 */
export interface Barrage {
  /** Bombas por lançamento. */
  bombs: number;
  /** Raio do círculo onde elas caem (m), centrado no ponto da mira. */
  spread: number;
  /** Segundos subindo antes de a primeira bomba começar a cair. */
  ascent: number;
  /** Segundos entre uma bomba e a seguinte começarem a cair. */
  stagger: number;
  /** Segundos que cada bomba leva caindo, do alto até o chão. */
  fall: number;
  /**
   * Quantas bombas contam em cheio num alvo parado no centro da chuva, na bancada de equilíbrio (`balance.ts`, o teto
   * teórico). As outras caem em volta e pegam só a borda da explosão.
   */
  onTarget: number;
}

/** Arma pronta para o combate, já no nível escolhido. Tudo em unidades do jogo (m, s, t). */
/**
 * Metralhadora rotatória: o cano gira, e a cadência **sobe segurando o gatilho** (de `minRate` × a cadência máxima, parada, até a cadência
 * máxima, com o cano em plena rotação) e cai ao soltar. O espalhamento abre junto com a rotação. Regra no tick fixo, sem sorteio
 * (`combat/trigger.ts` `SpinUp`, `combat/spread.ts`). `fireInterval` da arma é o intervalo **com o cano em plena rotação**.
 */
export interface Spin {
  /** Segundos de gatilho apertado para o cano chegar à rotação máxima, de parado. */
  up: number;
  /** Segundos para parar de girar depois de soltar o gatilho. */
  down: number;
  /** Fração da cadência máxima com o cano parado (0,15 = 3 de 20 tiros/s). */
  minRate: number;
  /** Abertura do cone de tiro (rad) com a rotação máxima; com o cano parado o tiro vai reto. */
  spread: number;
}

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
  /** Só na chuva de mísseis: o desenho da chuva. `damage` e `blastRadius` são os de CADA bomba. */
  barrage?: Barrage;
  /** Carga contínua antes do tiro; soltar, perder braço ou superaquecer cancela (o trilho). */
  chargeTime?: number;
  /**
   * A arma **segura a carga** (o canhão de cerco, ordem P124): completar não dispara — fica pronta, e o tiro sai ao
   * **soltar** o gatilho. Sem isto, a carga dispara na hora do completo e soltar cancela.
   */
  chargeHold?: boolean;
  /**
   * Perfil de mira (ordem P121): tempo (s) para a mira **assentar** com esta arma na mão. Sem declarar, vale a conta por
   * faixa (`combat/aim.ts`: a arma de linha assenta mais devagar, a de perto quase na hora). Corpo a corpo, chama e o giro
   * de cano não assentam (0).
   */
  aimTime?: number;
  /**
   * Amplitude da mira **aberta**, em radianos (ordem P121): a dispersão máxima antes de assentar, que fecha a zero com a
   * mira firme. **Hoje toda arma está em 0** — a mira assenta só no desenho, sem mexer no acerto validado; ligar é uma
   * linha por arma.
   */
  aimSpread?: number;
  /** Sobrecarga térmica adicional no impacto, sem atrasar o resfriamento. */
  empHeat?: number;
  /** Silhueta visual do tiro, sem alterar colisão. */
  tracer?: 'rail' | 'pulse' | 'arc' | 'ice' | 'shell' | 'slug';
  /** Só na rotatória: a rotação do cano (cadência que sobe, espalhamento que abre). */
  spin?: Spin;
  /** Estado que o acerto aplica no alvo (`combat/StatusEffects.ts`): fogo, choque ou gelo. Sem escudo na frente, o acerto vale. */
  inflicts?: StatusInflict;
  /** Só no lança-chamas: o cone e o tanque de combustível (`FuelTank` em `combat/trigger.ts`). */
  flame?: Flame;
  /** Só nas armas sônicas: a onda (cone de uma vez só, com empurrão). */
  wave?: Wave;
  /** Só no míssil teleguiado: a trava de alvo e a curva (`Guide`). */
  guide?: Guide;
  /**
   * Quanto o **alcance** cresce a cada nível, em fração do MK I (0,3 = +30% no MK II e +60% no MK III; vale para o alcance ótimo e o máximo). Sem este
   * campo o alcance é da arma, não do nível. Quem declara: o lança-chamas (dono, 11/10: "tem que poder ser upado no MK II e ir mais longe").
   */
  tierRange?: number;
  /**
   * Quanto a **cadência** cresce a cada nível, em fração do MK I (0,15 = +15% de tiros por segundo no MK II e +30% no MK III): mais pressão. Sem este
   * campo a cadência é da arma, não do nível. O calor por segundo cresce junto (mais tiros, e cada um esquenta mais).
   */
  tierRate?: number;
}

/**
 * Onda sônica (dono, 11/10: "as armas de som combinam em ficar nos ombros"): **um pulso em cone, de uma vez**, que atinge todos os que estão nele e à vista (como um
 * pulso do lança-chamas, mas de um tiro só) e **empurra** quem pega (`MechBase.push`). O dano cai com a distância como o de um tiro direto (`optimalRange` a `maxRange`);
 * o empurrão cai junto. Sem projétil: não há o que desviar nem parar no meio, só a parede (cone sem linha de visão não acerta).
 */
/**
 * Míssil teleguiado (dono, 11/10: "VARIAR as armas e tecnologias" nos ombros): um foguete que **trava no inimigo mais centrado à frente** na hora do disparo
 * (cone de `lockHalfAngle`, até `lockRange`, à vista) e **curva em direção a ele** a cada tick, no máximo `turnRate` rad/s: quem se mexe e se abriga ainda desvia, mas
 * quem corre em linha reta é perseguido. Sem alvo à frente, voa reto como um foguete. Tem `kind: 'ammo'`, então passa pelo mesmo `RocketSystem` (explosão em área,
 * carregador e recarga). Só a simulação (posição e altura do alvo), sem rig: roda igual no servidor.
 */
export interface Guide {
  /** O quanto o míssil pode virar por segundo (rad/s): o raio de curva é a velocidade dividida por isto. */
  turnRate: number;
  /** Até onde a trava enxerga um alvo (m), contado da boca. */
  lockRange: number;
  /** Meio ângulo do cone da trava (rad). */
  lockHalfAngle: number;
}

export interface Wave {
  /** Meio ângulo do cone (rad). */
  halfAngle: number;
  /** Velocidade do empurrão (m/s) a queima-roupa; cai com a distância junto com o dano e é dividida pela resistência do alvo (o grande empurra menos). */
  shove: number;
}

/**
 * O lança-chamas não solta projétil: a cada `fireInterval` do gatilho apertado, um pulso de dano em **todos** os que estão no cone
 * (até `maxRange` da arma, com meio ângulo `halfAngle`) e à vista, sem parede no meio. O combustível dura `fuel` s de gatilho; seco, trava
 * por `reload` s e volta cheio; solto, enche no mesmo ritmo.
 */
export interface Flame {
  /** Meio ângulo do cone (rad). */
  halfAngle: number;
  /** Segundos de chama por tanque cheio. */
  fuel: number;
  /** Segundos para recarregar o tanque seco (e, solto, o ritmo em que enche). */
  reload: number;
}

type WeaponBase = Omit<WeaponStats, 'tier'>;

const BASE: Record<WeaponId, WeaponBase> = {
  /**
   * Metralhadora rotatória (dono, 09/10): muita bala, pouco dano por bala, e o calor é o freio. 5 de dano por tiro; a 20 tiros/s com o
   * cano em plena rotação são ~100 de dano/s no pico, mas a cadência só chega lá depois de 1,2 s de gatilho e o calor trava em ~3 s de
   * rajada (medido na bancada: derruba o torso do Vector-09 em 5,9 s contra 5,7 s do plasma, dano sustentado igual). Precisão cai com a
   * rotação (cone de 3,5°); alcance médio. Limitada pelo calor, sem carregador.
   */
  rotary: {
    id: 'rotary', name: 'Metralhadora rotatória', kind: 'energy',
    damage: 5, fireInterval: 0.05, heatPerShot: 0.02,
    magazine: 0, reload: 0, speed: 170,
    optimalRange: 35, maxRange: 95, minFactor: 0.35,
    blastRadius: 0, mass: 4,
    spin: { up: 1.2, down: 1.5, minRate: 0.15, spread: 0.06 },
  },
  /**
   * Lança-chamas (dono, 09/10 e 11/10: "faça o lança-chamas"; e 11/10, depois de jogar: "o fogo está muito fraco e curto"). **Fluxo contínuo em cone
   * de 20 m e 34° que atinge todos os que estão nele**, 6 s de combustível e 4 s de recarga. Um pulso a cada 0,2 s: **10 de dano (50/s)** a 9 m ou
   * menos, caindo à metade aos 20 m, e cada pulso deixa o alvo **queimando** (6 de dano/s e calor no alvo, renova a cada contato; o gelo apaga).
   * Esquenta quem atira (0,2 de calor por segundo: ferve em ~4,8 s de chama contínua, que é o freio). Sozinho derruba um torso em 7,5 s (MK I) a
   * 5,9 s (MK III); eram 13,3 e 10,9 s com 6 de dano e 14 m. Natureza `termico`. Sem projétil e sem evento de rede por pulso: o servidor aplica o
   * cone e o dono liga a bandeira `flaming`, que os outros jogadores leem para desenhar o fluxo.
   */
  flamer: {
    id: 'flamer', name: 'Lança-chamas', kind: 'energy',
    damage: 10, fireInterval: 0.2, heatPerShot: 0.04,
    magazine: 0, reload: 0, speed: 0,
    optimalRange: 17, maxRange: 36, minFactor: 0.5,
    blastRadius: 0, mass: 3.5, inflicts: 'burn',
    flame: { halfAngle: 0.3, fuel: 6, reload: 4 },
    tierRange: 0.3, tierRate: 0.15,
  },
  /**
   * Canhão sônico (dono, 11/10: "as armas de som combinam em ficar nos ombros"; "variar as armas e tecnologias para o botão 2"). **Arma de ombro**: só no encaixe dos ombros (o
   * Marauder), no botão 2, e **as duas bocas disparam juntas**. Um pulso em cone de 52° (`Wave`) que bate 20 a queima-roupa (cheio até 10 m, 35% aos 22 m) e **empurra** (8 m/s,
   * menos longe e menos num robô grande). Natureza `sonico`: a chapa Amortecedor segura 90%, o reativo e a cerâmica deixam passar mais. Não tira vida suficiente para derrubar sozinha
   * (as duas bocas somam 40 por aperto a cada 1,2 s: ~9 s para um torso) e esquenta pouco; o ponto dela é **tirar o inimigo do lugar** (da cobertura, de cima de um aliado, do alcance do
   * lança-chamas dele). Sobe de nível ganhando alcance (+25% por nível).
   */
  sonic: {
    id: 'sonic', name: 'Canhão sônico', kind: 'energy',
    damage: 20, fireInterval: 1.2, heatPerShot: 0.12,
    magazine: 0, reload: 0, speed: 0,
    optimalRange: 10, maxRange: 22, minFactor: 0.35,
    blastRadius: 0, mass: 3,
    wave: { halfAngle: 0.45, shove: 8 }, tierRange: 0.25,
  },
  /**
   * Míssil teleguiado (dono, 11/10): o segundo tipo de arma de ombro que **não é só mais foguete**. 55 de dano e explosão de 4,5 m (menor que a dos foguetes: ele erra menos), 2 no
   * carregador, recarga de 3,2 s; voa a 48 m/s (devagar o bastante para quem corre perceber e desviar) até 140 m. Trava no inimigo mais centrado à frente (cone de 29° até 90 m, à
   * vista) e curva até 2,2 rad/s: o raio de curva é de ~22 m, então um dash ou uma quina de parede ainda o enganam. Os dois ombros do Marauder soltam um cada.
   */
  seeker: {
    id: 'seeker', name: 'Míssil teleguiado', kind: 'ammo',
    damage: 55, fireInterval: 0.5, heatPerShot: 0.2,
    magazine: 2, reload: 3.2, speed: 48,
    optimalRange: 140, maxRange: 140, minFactor: 1,
    blastRadius: 4.5, mass: 4,
    guide: { turnRate: 2.2, lockRange: 90, lockHalfAngle: 0.5 },
  },
  /**
   * Canhão pesado (dono, 11/10: "quero um canhão grande, um tiro só"). **Um projétil de aço, grande e lento, que bate como um caminhão**: 90 de
   * dano num tiro, um a cada 2,6 s, com 0,6 de calor. Derruba um torso de 300 com **quatro acertos no MK I e três no MK II e no MK III** (dois acertos
   * nunca bastam, nem no MK III: 252), então não decide uma luta sozinho. Vai a 150 m/s (quem está longe vê o tiro chegar e desvia), cheio até 90 m e
   * cai a 60% aos 260 m. Os 90 de dano e os 2,6 s vêm da bancada: com 100 e 2,4 s, o MK III com os foguetes MK III derrubava um torso em 2,25 s.
   * Peso de 6 t: só os chassis pesados o carregam. Natureza `balistico`. O desenho é de metal (casco de aço com cauda quente e fumaça), não de luz
   * (`tracer: 'shell'`).
   */
  cannon: {
    id: 'cannon', name: 'Canhão pesado', kind: 'energy',
    damage: 90, fireInterval: 2.6, heatPerShot: 0.6,
    magazine: 0, reload: 0, speed: 150,
    optimalRange: 90, maxRange: 260, minFactor: 0.6,
    blastRadius: 0, mass: 6, tracer: 'shell',
  },
  /**
   * Canhão de cerco (dono, 12/10: "futuramente faremos versões das armas para o tamanho 3 e 4" — a primeira delas; e
   * no mesmo dia: "crie a arma dele, uma arma poderosa, de tiro único, que demora pra carregar, mas é um tremendo tiro").
   * **A versão de tamanho 3 do canhão pesado, agora de CARGA:** segura o gatilho **2,4 s** (`chargeTime`) e solta **um obus de
   * 360**, com 5 m de explosão, a 240 m/s. **Com espera** (`chargeHold`, ordem P124 do Comandante): completar a carga **não
   * dispara** — a arma fica carregada e pronta, e o tiro sai ao **soltar o gatilho**, no momento escolhido (era 3 s e
   * disparava sozinha ao completar).
   * Derruba um torso de Mech (300) **num tiro só**, e um Colossus-01 (1 200) em quatro; o ciclo é de ~6,9 s (2,4 s de carga
   * + 4,5 s entre tiros) e o calor de um tiro é 0,9 do dissipador: é arma de um tiro por vez, não de pressão. Para um robô
   * de tamanho 4 ela é uma arma **leve** (a pesada do tamanho N é a leve do N+1, a conta do weaponClass.ts); para um de
   * tamanho 3 é **pesada**; um Mech comum (tamanho 2) não a carrega. Natureza balistica, o mesmo aço.
   */
  siege: {
    id: 'siege', name: 'Canhão de cerco', kind: 'energy',
    damage: 360, fireInterval: 4.5, heatPerShot: 0.9,
    magazine: 0, reload: 0, speed: 240,
    optimalRange: 140, maxRange: 400, minFactor: 0.7,
    blastRadius: 5, mass: 12, tracer: 'shell',
    chargeTime: 2.4, chargeHold: true,
  },
  /**
   * Canhão automático (dono, 11/10: "armas de tiros menores e sequenciais de metal"). **Projéteis de aço em sequência firme, sem esperar o cano
   * girar**: 10 de dano a 5 tiros/s (50/s), cadência fixa, tiro reto e preciso, rápido (190 m/s) e de bom alcance (cheio até 50 m, some aos 140 m).
   * Esquenta menos que o plasma por segundo (0,20 contra 0,32), então sustenta a rajada por mais tempo; em compensação bate menos por tiro que o
   * canhão pesado e não tem o espalhamento nem a rotação da rotatória. Sozinho derruba um torso em 7,5 s no MK I e 5,9 s no MK III; dois automáticos
   * juntos, em mais de 3,7 s (o calor do Mech segura). Natureza `balistico`. O desenho é de metal (projétil de aço com cauda curta), e cada tiro
   * solta um estojo (`tracer: 'slug'`).
   */
  autocannon: {
    id: 'autocannon', name: 'Canhão automático', kind: 'energy',
    damage: 10, fireInterval: 0.2, heatPerShot: 0.04,
    magazine: 0, reload: 0, speed: 190,
    optimalRange: 50, maxRange: 140, minFactor: 0.45,
    blastRadius: 0, mass: 3.5, tracer: 'slug',
  },
  /**
   * Arma elétrica (dono, 09/10: "tiros elétricos, que deixam o oponente tomando choque, lento e sem funcionar temporariamente caso
   * tome um tiro bem dado"). Dano pequeno, o estado é o ponto: cada acerto que chega ao corpo deixa o alvo **chocado** (−35% de
   * velocidade e 2 de dano por segundo por 3 s) e o **tiro bem dado** (na cabeça, ou 3 acertos seguidos em 1,4 s) o **atordoa** por
   * 0,8 s, sem encadear (`combat/StatusEffects.ts`). Cadência lenta e projétil rápido: é arma de apoio, derruba um torso em mais de
   * 15 s sozinha. Natureza `eletrico`: o escudo cerâmico isola, a chapa de aço conduz.
   */
  arc: {
    id: 'arc', name: 'Arma elétrica', kind: 'energy',
    damage: 7, fireInterval: 0.45, heatPerShot: 0.06,
    magazine: 0, reload: 0, speed: 90,
    optimalRange: 50, maxRange: 130, minFactor: 0.5,
    blastRadius: 0, mass: 2.5, tracer: 'arc', inflicts: 'shock',
  },
  /**
   * Arma de gelo (dono, 09/10: "lança-chamas e arma de gelo"). Dano pequeno, o estado é o ponto: cada acerto que chega ao corpo soma um
   * acúmulo de **gelado** (−15% de velocidade por acúmulo, até 3, por 4 s desde o último tiro); o **terceiro acúmulo congela** o alvo por
   * 1,5 s (parado, sem atirar, levando +20% de dano), com 5 s de imunidade para não encadear (`combat/StatusEffects.ts`). Projétil mais lento
   * que o da elétrica (70 contra 90 m/s) e cadência de 0,6 s: três acertos levam 1,2 s, dentro dos 4 s do gelado. **Alcance curto** (dono, 11/10: "o gelo
   * está indo muito longe"): cheio até 20 m e some aos 55 m (eram 45 e 110 m); o frio é arma de perto e de meia distância, o plasma e o aço é que alcançam longe. Natureza `criogenico`:
   * a cerâmica isola o frio, o aço e a malha seguram menos, o reativo deixa passar. Fogo e gelo se anulam (`StatusSet`).
   */
  cryo: {
    id: 'cryo', name: 'Arma de gelo', kind: 'energy',
    damage: 5, fireInterval: 0.6, heatPerShot: 0.05,
    magazine: 0, reload: 0, speed: 70,
    optimalRange: 20, maxRange: 55, minFactor: 0.5,
    blastRadius: 0, mass: 3, tracer: 'ice', inflicts: 'chill',
  },
  railgun: {
    id: 'railgun', name: 'Canhão de trilho', kind: 'energy',
    damage: 72, fireInterval: 1.4, heatPerShot: 0.32,
    magazine: 0, reload: 0, speed: 1200,
    optimalRange: 140, maxRange: 320, minFactor: 0.65,
    blastRadius: 0, mass: 5, chargeTime: 0.85, tracer: 'rail',
  },
  emp: {
    id: 'emp', name: 'Lançador EMP', kind: 'energy',
    damage: 9, fireInterval: 1.3, heatPerShot: 0.09,
    magazine: 0, reload: 0, speed: 65,
    optimalRange: 45, maxRange: 110, minFactor: 0.5,
    blastRadius: 0, mass: 2.5, empHeat: 0.2, tracer: 'pulse',
  },
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
   * Escopeta (dono, 03/10, para o Lancer: "o alcance do tiro é mais curto que o blaster e tira mais vida se estiver
   * pertinho do inimigo"). Um projétil só, sem balins: o custo é o de um tiro de plasma. A queima-roupa (até 8 m)
   * bate 52; cai em linha reta até 8% aos 45 m, onde o blaster ainda alcança 120 m. Sozinha derruba o torso de um
   * Mech em ~4 s de perto (o plasma leva ~5,7 s), mas só de perto. Números de partida: o dono ajusta em
   * Configurações > Potências.
   */
  shotgun: {
    id: 'shotgun',
    name: 'Escopeta',
    kind: 'energy',
    damage: 52,
    fireInterval: 0.8,
    heatPerShot: 0.18,
    magazine: 0,
    reload: 0,
    speed: 120,
    optimalRange: 8,
    maxRange: 45,
    minFactor: 0.08,
    blastRadius: 0,
    mass: 2,
  },
  /**
   * Chuva de mísseis (dono, 04/10: "míssil que vai lançado pra cima e cai tipo uma chuva"). É arma de área, não de ponto:
   * o lançamento sobe 1,2 s e 8 bombas caem em volta do ponto da mira, num círculo de 9 m, uma a cada 0,1 s. De 120 m ela
   * ainda alcança, mas o aviso no chão deixa quem está embaixo sair. Cada bomba bate 30 no centro e cai a zero a 5 m;
   * num Mech parado no meio pegam umas quatro, ~60 de dano no total, e quem se mexe leva pouco. Carregador de 2, recarga de
   * 6 s e muito calor (25%): serve para cobrir terreno e tirar o inimigo de trás de cobertura, não para derrubar. Números
   * de partida: o dono ajusta em Configurações > Potências.
   */
  barrage: {
    id: 'barrage',
    name: 'Chuva de mísseis',
    kind: 'ammo',
    damage: 30,
    fireInterval: 1,
    heatPerShot: 0.25,
    magazine: 2,
    reload: 6,
    speed: 40,
    optimalRange: 120,
    maxRange: 120,
    minFactor: 1,
    blastRadius: 5,
    mass: 5,
    barrage: { bombs: 8, spread: 9, ascent: 1.2, stagger: 0.1, fall: 0.9, onTarget: 2 },
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
  // Arma que declara `tierRange` / `tierRate` ganha alcance e cadência a cada nível; as outras mantêm os do MK I (o teste de arsenal confere).
  const reach = 1 + (b.tierRange ?? 0) * tier;
  const rate = 1 + (b.tierRate ?? 0) * tier;
  return Object.freeze({
    ...b,
    tier,
    ...(b.tierRange ? { optimalRange: round(b.optimalRange * reach, 0.5), maxRange: round(b.maxRange * reach, 0.5) } : {}),
    ...(b.tierRate ? { fireInterval: round(b.fireInterval / rate, 0.001) } : {}),
    damage: Math.round(b.damage * t.damage),
    heatPerShot: round(b.heatPerShot * t.heat, 0.001),
    reload: round(b.reload * t.heat, 0.01),
    mass: round(b.mass * t.mass, 0.25),
  });
}

/**
 * Natureza do dano: escudos físicos seguram cada uma de um jeito (`MetalShield.ts`). Arma nova declara a sua aqui
 * (o `Record` obriga). `sonico` ainda não tem arma: o escudo amortecedor já está pronto para ela.
 */
export type DamageType = 'termico' | 'laser' | 'balistico' | 'explosivo' | 'pulso' | 'sonico' | 'corte' | 'eletrico' | 'criogenico';
export const DAMAGE_TYPE: Readonly<Record<WeaponId, DamageType>> = {
  plasma: 'termico',
  blaster: 'laser',
  shotgun: 'balistico',
  railgun: 'balistico',
  rockets: 'explosivo',
  barrage: 'explosivo',
  emp: 'pulso',
  rotary: 'balistico',
  arc: 'eletrico',
  cryo: 'criogenico',
  flamer: 'termico',
  cannon: 'balistico',
  siege: 'balistico',
  autocannon: 'balistico',
  sonic: 'sonico',
  seeker: 'explosivo',
  chainsaw: 'corte',
};

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

/**
 * O que um Mech leva. Cada campo é um **gatilho**, não um lado do corpo: onde a arma está (mão, ombro) vem do chassi
 * (`MechStats.triggers`, `combat/mounts.ts`). No padrão, `primary` é da mão direita e `secondary` da esquerda.
 */
export interface Loadout {
  module?: import('./EnergyShield').ShieldId | null;
  /** Escudo físico na mão esquerda, no lugar da arma dela: `secondary` fica vazio e o botão 2 levanta a chapa. */
  metalShield?: { id: import('./MetalShield').MetalShieldId; tier: Tier } | null;
  /** Gatilho principal (mouse esquerdo): a arma da mão direita. */
  primary: WeaponStats;
  /** Gatilho secundário (mouse direito, Q): a arma da mão esquerda; nos chassis com lançadores, a dos ombros. */
  secondary: WeaponStats | null;
  /** Só nos chassis com duas mãos no gatilho principal (Marauder): a arma da mão esquerda, que atira junto com a `primary`. */
  offhand?: WeaponStats | null;
  /** Qual dos layouts de gatilho do chassi (`MechStats.layouts`) vale; ausente = o primeiro, o padrão. */
  layout?: number;
}
