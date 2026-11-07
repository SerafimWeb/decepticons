import { ajustesGen3 } from './ajustesGen3';
import type { MechRig } from './MechBase';
import { avancaMola, frequenciaDoCorpo, novaMola, type Mola } from './molejo';
import { fasePorSegundo, parametrosDaPassada, poseDaPassada, type GeometriaDaPerna, type ParametrosDaPassada, type PoseDaPassada } from './passadaGen3';
import { medirGeometriaDaPerna } from './passadaRig';

/**
 * A geração 3 do movimento dos Mechs (P321), o pedaço **sob demanda** que o `movimentoGen3.ts` carrega: a passada com o pé plantado
 * (`passadaGen3.ts`), as molas do corpo (`molejo.ts`) e os ajustes de gosto (`ajustesGen3.ts`). Só desenho: roda no render, nunca na
 * simulação (G1/G2), e não toca em dano, mira nem bocas de tiro. O `MechBase` guarda só um `Estado3` por Mech e chama este módulo.
 *
 * Custo (G4/G5): zero triângulo, draw call ou material; algumas dezenas de contas por Mech por quadro, sem alocação. Só os rigs
 * procedurais (que informam o pé, `MechRig.pe`): o robô de malha importada segue na passada de hoje até ser medido e fotografado.
 */

/** Graus para radianos (os ajustes vêm em graus). */
const GRAU = Math.PI / 180;

/** O estado de um Mech na geração 3: a perna medida, a passada, a pose e as molas. */
export interface Estado3 {
  readonly geo: GeometriaDaPerna;
  readonly passo: ParametrosDaPassada;
  readonly pose: PoseDaPassada;
  readonly molaTronco: Mola;
  readonly molaRolagem: Mola;
  readonly molaPelve: Mola;
  readonly molaRecuoD: Mola;
  readonly molaRecuoE: Mola;
  /** Frequência natural do corpo (rad/s), da altura do chassi: as molas andam nela. */
  readonly freqCorpo: number;
  /** A velocidade suavizada: a diferença para a crua, vezes a taxa, é a aceleração do Mech (sem alocar). */
  lagX: number;
  lagZ: number;
  iniciado: boolean;
  /** 0 no chão, 1 no ar (suavizado): mistura a postura de ar na passada. */
  airMix: number;
  /** O peso da passada (0 parado, 1 correndo), suavizado: a pose sai e volta ao repouso sem estalo. */
  peso: number;
  /** A queda mais forte desde que saiu do chão (m/s): o impacto que a pelve sente ao pousar. */
  quedaVel: number;
}

/** O que o módulo precisa saber do Mech (o `MechBase` já tem tudo isso em campos públicos). */
export interface Anfitriao3 {
  readonly velocity: { readonly x: number; readonly y: number; readonly z: number };
  readonly yaw: number;
  readonly grounded: boolean;
  readonly isDashing: boolean;
  readonly stats: { readonly moveSpeed: number };
}

export interface Geracao3 {
  /** Mede a perna do rig e prepara o estado; `null` se o rig não dá uma perna medível (o `.glb`): aí o Mech anda como antes. */
  criarEstado(rig: MechRig, anguloDoQuadril: number, altura: number): Estado3 | null;
  /** Quanto a fase da passada avança por segundo (rad/s) à velocidade dada: pé plantado, até o teto da cadência. */
  fasePorSegundo(e: Estado3, velocidade: number): number;
  /** Pernas, pelve e tronco deste quadro. Devolve a rolagem da pelve (rad) para somar ao roll de sempre. */
  locomocao(e: Estado3, m: Anfitriao3, rig: MechRig, fase: number, dt: number, hSpeed: number, air: number, lean: number, k: number): number;
  /** O coice de um braço como mola (recua, passa do ponto e volta); `alvo` é o coice decaído de sempre. */
  coice(e: Estado3, esquerdo: boolean, alvo: number, dt: number): number;
}

export const GERACAO3: Geracao3 = {
  criarEstado(rig, anguloDoQuadril, altura) {
    const geo = medirGeometriaDaPerna(rig);
    if (!geo) return null;
    return {
      geo,
      passo: parametrosDaPassada(geo, anguloDoQuadril, ajustesGen3()),
      pose: { hipL: 0, kneeL: 0, hipR: 0, kneeR: 0, dPelvis: 0 },
      molaTronco: novaMola(),
      molaRolagem: novaMola(),
      molaPelve: novaMola(),
      molaRecuoD: novaMola(),
      molaRecuoE: novaMola(),
      freqCorpo: frequenciaDoCorpo(altura),
      lagX: 0,
      lagZ: 0,
      iniciado: false,
      airMix: 0,
      peso: 0,
      quedaVel: 0,
    };
  },

  fasePorSegundo: (e, velocidade) => fasePorSegundo(e.passo, velocidade),

  locomocao(e, m, rig, fase, dt, hSpeed, air, lean, k) {
    const aj = ajustesGen3();
    const geo = e.geo;
    // Os pés: a postura de ar entra suave. A passada no chão é direta, sem filtro: um filtro atrasa o pé e ele escorrega.
    // A perna avariada dá passo curto (o mancar do dano às pernas, igual à geração 2).
    e.airMix += (air - e.airMix) * k;
    // O peso cresce com a velocidade (metade da velocidade do chassi já dá a passada cheia) e é suavizado, como a geração 2 (amplitude ∝ velocidade).
    e.peso += ((1 - e.airMix) * Math.min(1, hSpeed / (0.5 * m.stats.moveSpeed)) - e.peso) * k;
    const pose = e.pose;
    poseDaPassada(fase, e.peso, geo, e.passo, pose, 1 - Math.max(0, lean) * 0.65, 1 - Math.max(0, -lean) * 0.65);
    rig.leftLeg.hip.rotation.x = pose.hipL + e.airMix * 0.55;
    rig.rightLeg.hip.rotation.x = pose.hipR - e.airMix * 0.25;
    rig.leftLeg.knee.rotation.x = pose.kneeL - e.airMix * 1.0;
    rig.rightLeg.knee.rotation.x = pose.kneeR - e.airMix * 0.4;

    // Pouso: a queda mais forte desde que saiu do chão vira um tranco na mola da pelve (ela agacha e volta).
    if (m.grounded) {
      if (e.quedaVel > 0) {
        e.molaPelve.v -= Math.min(12, e.quedaVel) * aj.amortecimentoDoPouso;
        e.quedaVel = 0;
      }
    } else if (-m.velocity.y > e.quedaVel) e.quedaVel = -m.velocity.y;
    // O agachar do dash é o alvo da mesma mola.
    const agachar = m.isDashing ? -0.12 : 0;
    const freq = e.freqCorpo * aj.rigidez;
    const pelve = avancaMola(e.molaPelve, agachar, freq, 0.45 * aj.amortecimento, dt);
    rig.pelvis.position.y = rig.hipHeight + (pose.dPelvis - geo.dRest) + pelve;

    // Inércia do tronco: a aceleração é a velocidade crua menos a suavizada, vezes a taxa (uma passagem de primeira ordem, sem alocar).
    const tau = 6;
    const vx = m.velocity.x;
    const vz = m.velocity.z;
    if (!e.iniciado) {
      // Ligada com o Mech já correndo: parte da velocidade de agora, senão a primeira conta daria uma aceleração enorme e o tronco estalaria.
      e.lagX = vx;
      e.lagZ = vz;
      e.iniciado = true;
    }
    const ax = (vx - e.lagX) * tau;
    const az = (vz - e.lagZ) * tau;
    e.lagX += (vx - e.lagX) * (1 - Math.exp(-dt * tau));
    e.lagZ += (vz - e.lagZ) * (1 - Math.exp(-dt * tau));
    const yaw = m.yaw;
    const aFrente = -(ax * Math.sin(yaw) + az * Math.cos(yaw));
    const aLado = ax * Math.cos(yaw) - az * Math.sin(yaw);
    // Arrancar para a frente inclina o tronco para a frente (rotação X negativa); frear faz o contrário e ele assenta com um tranco.
    const teto = aj.inclinacaoDoTronco * GRAU;
    const alvoTronco = Math.min(teto, Math.max(-teto, -aFrente * 0.0035));
    const alvoRolagem = Math.min(teto * 0.85, Math.max(-teto * 0.85, -aLado * 0.003));
    avancaMola(e.molaTronco, alvoTronco, freq * 1.3, 0.35 * aj.amortecimento, dt);
    return avancaMola(e.molaRolagem, alvoRolagem, freq, 0.4 * aj.amortecimento, dt);
  },

  coice(e, esquerdo, alvo, dt) {
    const aj = ajustesGen3();
    return avancaMola(esquerdo ? e.molaRecuoE : e.molaRecuoD, alvo, 14 * aj.rigidez, 0.3 * aj.amortecimento, dt);
  },
};
