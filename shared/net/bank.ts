import { BANK_STATUSES, normalizeBankCode, type BankReply } from '../bank/codes';
import { Reader, type Writer } from './codec';
import { MSG } from './messages';
const reader = new Reader();
/** Códigos e respostas raros; não alteram os 19 bytes do snapshot. */
export function encodeBankCode(w: Writer, code: string): Uint8Array { return w.reset().u8(MSG.BANK).str(normalizeBankCode(code), 64).done(); }
export function decodeBankCode(bytes: Uint8Array): string | null {
  const r = reader.set(bytes); if (r.u8() !== MSG.BANK) return null;
  const code = r.str(64); return r.clean && /^[A-Z0-9]{0,64}$/.test(code) ? code : null;
}
export function encodeBankReply(w: Writer, reply: BankReply): Uint8Array { return w.reset().u8(MSG.BANK_REPLY).u8(BANK_STATUSES.indexOf(reply.status)).str(reply.code, 64).done(); }
export function decodeBankReply(bytes: Uint8Array): BankReply | null {
  const r = reader.set(bytes); if (r.u8() !== MSG.BANK_REPLY) return null;
  const status = BANK_STATUSES[r.u8()]; const code = r.str(64);
  return r.clean && status && /^[A-Z0-9]{0,64}$/.test(code) ? { status, code } : null;
}
