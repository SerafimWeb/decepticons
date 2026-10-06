import { bankReward, nearBank, normalizeBankCode, type BankReply } from '../../../shared/bank/codes';
import type { MechBase } from '../entities/MechBase';
/** Regra comum offline/online: posição real, vida e intervalo no relógio fixo da partida. */
export class BankAccount {
  private readonly lastRedeemedTicks = new Map<string, number>();
  redeem(raw: string, mech: MechBase, tick: number): BankReply {
    const code = normalizeBankCode(raw);
    if (!mech.alive) return { status: 'dead', code };
    if (!nearBank(mech.simPosition)) return { status: 'far', code };
    const reward = bankReward(code);
    if (!reward) return { status: 'unknown', code };
    if (tick - (this.lastRedeemedTicks.get(code) ?? -300) < 300) return { status: 'wait', code };
    this.lastRedeemedTicks.set(code, tick);
    if (reward.repair) mech.repair(reward.repair);
    if (reward.cooling) mech.vent(reward.cooling);
    if (reward.seconds) mech.combatBoost.activate(reward.damage, reward.seconds);
    return { status: 'ok', code };
  }
}
