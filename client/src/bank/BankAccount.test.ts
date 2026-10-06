import { describe, expect, it } from 'vitest';
import { BANK_DOOR, bankReward, nearBank, normalizeBankCode } from '../../../shared/bank/codes';
import { Vector09 } from '../entities/Vector09';
import { BankAccount } from './BankAccount';
import { CombatBoost } from '../combat/CombatBoost';
const mechAtDoor = () => { const m = new Vector09(); m.simPosition.set(BANK_DOOR.x, 0, BANK_DOOR.z); return m; };
describe('Banco Vorcaris: regra compartilhada', () => {
  it('normaliza os códigos configurados sem aceitar propriedades herdadas ou texto longo', () => {
    expect(normalizeBankCode('134 milhões')).toBe('134MILHOES');
    expect(bankReward('134 milhões')?.credits).toBe(134_000_000);
    expect(bankReward('constructor')).toBeUndefined(); expect(bankReward('134milhoes' + ' '.repeat(70))).toBeUndefined();
  });
  it('exige porta, robô vivo e código válido antes de conceder reforço', () => {
    const a = new BankAccount(), m = mechAtDoor(); m.simPosition.set(0, 0, 25);
    expect(a.redeem('TURBO', m, 0).status).toBe('far'); expect(m.combatBoost.damageMultiplier).toBe(1);
    m.simPosition.set(BANK_DOOR.x, 10, BANK_DOOR.z); expect(nearBank(m.simPosition)).toBe(false);
    m.simPosition.set(BANK_DOOR.x, 0, BANK_DOOR.z); expect(a.redeem('<script>', m, 0).status).toBe('unknown');
    m.modules.torso = 0; expect(a.redeem('TURBO', m, 0).status).toBe('dead');
  });
  it('repara partes existentes, resfria e limita resgates pelo relógio de simulação', () => {
    const a = new BankAccount(), m = mechAtDoor(); m.modules.torso -= 35; m.modules.leftArm = 0; m.absorbEmp(0.7);
    expect(a.redeem('OFICINA', m, 0).status).toBe('ok'); expect(m.modules.torso).toBe(m.stats.maxModuleHealth.torso); expect(m.modules.leftArm).toBe(0); expect(m.heat).toBe(0);
    expect(a.redeem('OFICINA', m, 299).status).toBe('wait'); expect(m.combatBoost.damageMultiplier).toBe(1);
    expect(a.redeem('TURBO', m, 300).status).toBe('ok'); expect(m.combatBoost.damageMultiplier).toBe(1.25);
    expect(a.redeem('134 milhões', m, 600).status).toBe('ok');
  });
  it('não acumula o bônus; expira em 30 segundos e recusa valores inválidos', () => {
    const boost = new CombatBoost(); boost.activate(1.25, 30); for (let i=0;i<1800;i++) boost.fixedUpdate(1/60);
    expect(boost.damageMultiplier).toBe(1); boost.activate(1.25, 30); boost.activate(1.25, 30); expect(boost.damageMultiplier).toBe(1.25);
    boost.activate(Number.NaN, 30); expect(boost.damageMultiplier).toBe(1.25);
    const m = mechAtDoor(); m.combatBoost.activate(1.25, 30);
    // Sem mundo físico, o reset da regra é verificado diretamente; respawn é coberto na simulação do Mech.
    m.combatBoost.reset(); expect(m.combatBoost.secondsLeft).toBe(0);
  });
});
