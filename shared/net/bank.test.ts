import { expect, it } from 'vitest';
import { Writer } from './codec';
import { decodeBankCode, decodeBankReply, encodeBankCode, encodeBankReply } from './bank';
it('código e resposta do banco viajam limitados e recusam truncamento, lixo e status inválido', () => {
  const w = new Writer(100); const code = encodeBankCode(w, '134 milhões').slice(); expect(decodeBankCode(code)).toBe('134MILHOES');
  expect(decodeBankCode(code.subarray(0, code.length-1))).toBeNull(); expect(decodeBankCode(new Uint8Array([...code,0]))).toBeNull();
  const reply = encodeBankReply(w, {status:'ok',code:'TURBO'}).slice(); expect(decodeBankReply(reply)).toEqual({status:'ok',code:'TURBO'});
  reply[1]=255; expect(decodeBankReply(reply)).toBeNull();
});
