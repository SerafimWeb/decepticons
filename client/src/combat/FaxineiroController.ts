import * as THREE from 'three';
import type { MechBase, MechInput } from '../entities/MechBase';
import { setLocalMove, turnToward, yawOf } from './steer';

/** O que o cérebro do faxineiro precisa saber da missão (P243, passo seguinte da ficha): qual mesa suja do prédio dele ainda não tem ninguém indo, e avisar quando limpou. Interface mínima (G3): não importa `sim/MissaoJaneiro.ts`, só o que usa — a mesma decisão de `TechnicianController`, que não conhece `Match`. */
export interface FaxineiroMissao {
  /** Reserva a primeira mesa suja e livre do prédio para este faxineiro (ele vai andar até ela); -1 sem nenhuma livre. */
  reservarMesa(predio: number): number;
  /** Desiste da mesa sem limpar (hoje só chamado pelo `reset`; mantém a conta certa se um dia o faxineiro for interrompido). */
  liberarMesa(predio: number, mesa: number): void;
  /** Terminou de limpar: a mesa `mesa` do prédio `predio` fica limpa. */
  limparMesa(predio: number, mesa: number): void;
}

/** Quanto leva para limpar uma mesa, parado nela (s). O mesmo número que a conta abstrata usava antes de virar agente de verdade. */
export const TEMPO_DE_LIMPEZA_S = 3;
/** A que distância da mesa (ou do posto) o faxineiro já chegou: a mesa tem colisor sólido (`environment/PracaLayout.ts`, função `mesas`, meia-largura até 1,2 m) — menos que isto e ele nunca encosta, fica para sempre "indo", empurrado contra o tampo. */
const CHEGOU_M = 2;
const TURN_RATE = 5;

export type FaxineiroState = 'indo' | 'limpando' | 'posto';

const _move = new THREE.Vector3();
const _from = new THREE.Vector3();

/**
 * Cérebro do andróide faxineiro (escala 1, apoio, P243): limpa as mesas sujas do saguão do seu prédio, uma de cada vez. Sem
 * alvo nenhum: ele não luta, não foge (o saguão é fechado — nenhum Mech entra, `LARGURA_DA_PORTA`) e não é alcançado pela
 * multidão. **Mesma interface do BotController/TechnicianController** (o `BotSystem` trata os três igual): `wantsToFire` é
 * sempre falso. Determinístico e sem alocar por tick (G1/G2/G4/G5): a única decisão por tick é "tenho mesa? adianto; não
 * tenho? peço uma".
 */
export class FaxineiroController {
  readonly input: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
  readonly wantsToFire = false;
  readonly shotDir = new THREE.Vector3();
  state: FaxineiroState = 'posto';
  /** A mesa que está limpando ou indo limpar agora, ou -1 sem nenhuma. */
  mesaAlvo = -1;
  private progresso = 0;
  private yaw: number;

  constructor(
    private readonly mech: MechBase,
    /** O prédio deste faxineiro (a ordem de `PracaLayout.PRACA_PREDIOS`). */
    private readonly predio: number,
    /** As mesas do prédio dele (x, z), na mesma ordem que `MissaoJaneiro` usa. */
    private readonly mesas: readonly { x: number; z: number }[],
    /** Para onde volta sem mesa para limpar (a porta onde nasceu). */
    private readonly posto: { x: number; z: number },
    private readonly missao: FaxineiroMissao,
  ) {
    this.yaw = mech.yaw;
  }

  reset(): void {
    if (this.mesaAlvo >= 0) this.missao.liberarMesa(this.predio, this.mesaAlvo);
    this.mesaAlvo = -1;
    this.state = 'posto';
    this.progresso = 0;
  }

  /** A interface comum com o `BotController`/`TechnicianController` (o `BotSystem` chama por cima de qualquer cérebro, com a mesma assinatura); `targets` não importa aqui. */
  think(dt: number, _targets: readonly MechBase[]): MechInput {
    const cmd = this.input;
    cmd.jump = false;
    cmd.dash = false;
    const me = this.mech.simPosition;

    if (this.state === 'limpando') {
      _move.set(0, 0, 0);
      this.progresso += dt;
      if (this.progresso >= TEMPO_DE_LIMPEZA_S) {
        this.missao.limparMesa(this.predio, this.mesaAlvo);
        this.mesaAlvo = -1;
        this.state = 'posto';
      }
      setLocalMove(cmd, 0, 0, this.yaw);
      return cmd;
    }

    if (this.mesaAlvo < 0) {
      const m = this.missao.reservarMesa(this.predio);
      if (m >= 0) {
        this.mesaAlvo = m;
        this.state = 'indo';
        this.progresso = 0;
      }
    }
    const alvo = this.mesaAlvo >= 0 ? this.mesas[this.mesaAlvo]! : this.posto;
    _from.set(alvo.x - me.x, 0, alvo.z - me.z);
    const dist = _from.length();
    let faceYaw = this.yaw;
    if (dist > CHEGOU_M) {
      _move.copy(_from).divideScalar(dist);
      faceYaw = yawOf(_from.x, _from.z);
    } else {
      _move.set(0, 0, 0);
      if (this.mesaAlvo >= 0) {
        this.state = 'limpando';
        this.progresso = 0;
      } else this.state = 'posto';
    }
    this.yaw = turnToward(this.yaw, faceYaw, TURN_RATE * dt);
    this.mech.applyFacing(this.yaw, 0);
    setLocalMove(cmd, _move.x, _move.z, this.yaw);
    return cmd;
  }
}
