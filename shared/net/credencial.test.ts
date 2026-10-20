import { describe, expect, it } from 'vitest';
import { CREDENCIAL, CREDENCIAL_TOKEN_MAX, codificarCredencial, ehCredencial, lerCredencial } from './credencial';

describe('a credencial da conexão (P226, A0)', () => {
  it('o token vai e volta inteiro, com o tipo no primeiro byte', () => {
    const bytes = codificarCredencial('token-da-sessao-0123456789')!;
    expect(bytes[0]).toBe(CREDENCIAL);
    expect(ehCredencial(bytes)).toBe(true);
    expect(lerCredencial(bytes)).toBe('token-da-sessao-0123456789');
  });

  it('não manda o que não pode ser um token (curto ou grande demais) e não lê mensagem torta', () => {
    expect(codificarCredencial('curto')).toBeNull();
    expect(codificarCredencial('x'.repeat(CREDENCIAL_TOKEN_MAX + 1))).toBeNull();
    expect(codificarCredencial('x'.repeat(CREDENCIAL_TOKEN_MAX))).not.toBeNull();
    expect(lerCredencial(new Uint8Array([CREDENCIAL]))).toBeNull();
    expect(lerCredencial(new Uint8Array([1, ...new TextEncoder().encode('token-de-outro-tipo-123')]))).toBeNull();
    expect(lerCredencial(new Uint8Array([CREDENCIAL, ...new Array(CREDENCIAL_TOKEN_MAX + 1).fill(97)]))).toBeNull();
    expect(lerCredencial(new Uint8Array([CREDENCIAL, 0xff, 0xfe, 0xfd, 0xfc, 0xfb, 0xfa, 0xf9, 0xf8]))).toBeNull(); // UTF-8 inválido
    expect(ehCredencial(new Uint8Array(0))).toBe(false);
  });

  it('o tipo não colide com nenhuma outra mensagem do jogo (MSG até 18, voz 30 a 32, texto 33 e 34)', () => {
    expect(CREDENCIAL).toBeGreaterThan(34);
  });
});
