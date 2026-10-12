/** Configuração do BANCO VORCARIS. Recompensas virtuais; o dono pode ampliar esta tabela. */
export const BANK_DOOR = { x: -28, y: 0, z: -25, radius: 4 } as const;
export interface BankReward { credits: number; repair: number; cooling: number; damage: number; seconds: number }
export const BANK_CODES: Readonly<Record<string, Readonly<BankReward>>> = {
  '134MILHOES': { credits: 134_000_000, repair: 0, cooling: 0, damage: 1, seconds: 0 },
  OFICINA: { credits: 0, repair: 300, cooling: 1, damage: 1, seconds: 0 },
  TURBO: { credits: 0, repair: 0, cooling: 0, damage: 1.25, seconds: 30 },
};
export const BANK_STATUSES = ['ok', 'unknown', 'far', 'dead', 'wait'] as const;
export type BankStatus = typeof BANK_STATUSES[number];
export interface BankReply { status: BankStatus; code: string }
export function normalizeBankCode(code: string): string {
  if (code.length > 64) return '';
  return code.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
export function bankReward(code: string): Readonly<BankReward> | undefined {
  const key = normalizeBankCode(code);
  return Object.hasOwn(BANK_CODES, key) ? BANK_CODES[key] : undefined;
}
export function nearBank(position: Readonly<{ x: number; y: number; z: number }>): boolean {
  const dx = position.x - BANK_DOOR.x, dz = position.z - BANK_DOOR.z;
  return Number.isFinite(position.y) && Math.abs(position.y - BANK_DOOR.y) < 3 && dx * dx + dz * dz <= BANK_DOOR.radius ** 2;
}
export function bankReplyText(reply: BankReply): string {
  switch (reply.status) {
    case 'unknown': return 'Código não reconhecido.';
    case 'far': return 'Chegue à porta do banco para resgatar.';
    case 'dead': return 'O robô precisa estar ativo.';
    case 'wait': return 'Aguarde 5 segundos de jogo antes de repetir o mesmo código.';
    case 'ok': {
      const reward = bankReward(reply.code);
      if (!reward) return 'Código não reconhecido.';
      const parts: string[] = [];
      if (reward.credits) parts.push('+' + reward.credits.toLocaleString('pt-BR') + ' créditos');
      if (reward.repair) parts.push('até ' + reward.repair + ' de reparo nas partes presentes');
      if (reward.cooling) parts.push('calor removido');
      if (reward.seconds) parts.push('+' + Math.round((reward.damage - 1) * 100) + '% de dano por ' + reward.seconds + ' s');
      return 'AUTORIZADO · ' + parts.join(' · ');
    }
  }
}
