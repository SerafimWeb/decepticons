import { describe, expect, it } from 'vitest';
import { mesclarProgresso, progressoComPinturas, progressoIgual, validarProgresso, type ProgressoPiloto } from './auth';
import { MASCARA_PINTURAS } from '../pinturas';

const base = (over: Partial<ProgressoPiloto> = {}): ProgressoPiloto => ({
  apelido: 'ANA',
  nivel: 3,
  xp: 200,
  creditos: 400,
  montagem: '',
  atualizadoEm: 1_700_000_000_000,
  ...over,
});

describe('as cores do casco no progresso da conta (P305)', () => {
  it('validar: sem o campo, o progresso sai sem o campo (um navegador antigo continua válido)', () => {
    const v = validarProgresso(base());
    expect(v).not.toBeNull();
    expect('pinturas' in (v as object)).toBe(false);
  });

  it('validar: aceita a máscara de posse; recusa o que não é inteiro, é negativo ou passa do catálogo', () => {
    expect(validarProgresso({ ...base(), pinturas: 0b101 })?.pinturas).toBe(0b101);
    expect(validarProgresso({ ...base(), pinturas: MASCARA_PINTURAS })?.pinturas).toBe(MASCARA_PINTURAS);
    expect(validarProgresso({ ...base(), pinturas: -1 })).toBeNull();
    expect(validarProgresso({ ...base(), pinturas: MASCARA_PINTURAS + 1 })).toBeNull();
    expect(validarProgresso({ ...base(), pinturas: 1.5 })).toBeNull();
  });

  it('mesclar: a união dos bits vale mesmo quando quem venceu é o outro aparelho', () => {
    const local = base({ nivel: 5, pinturas: 0b001 }); // este aparelho venceu (mais nível) e comprou a 0
    const remoto = base({ nivel: 2, pinturas: 0b100 }); // o outro comprou a 2
    expect(mesclarProgresso(local, remoto)?.pinturas).toBe(0b101);
    expect(mesclarProgresso(remoto, local)?.pinturas).toBe(0b101);
  });

  it('mesclar: sem campo nos dois lados, o resultado continua sem o campo', () => {
    expect('pinturas' in (mesclarProgresso(base(), base({ nivel: 9 })) as object)).toBe(false);
  });

  it('igualdade: duas posses diferentes são progressos diferentes (o que vai ao servidor não se perde)', () => {
    expect(progressoIgual(base({ pinturas: 0b1 }), base({ pinturas: 0b11 }))).toBe(false);
    expect(progressoIgual(base({ pinturas: 0b1 }), base({ pinturas: 0b1 }))).toBe(true);
    expect(progressoIgual(base(), base({ pinturas: 0 }))).toBe(true);
  });

  it('o servidor não deixa uma cor comprada sumir: sem o campo, fica o que a conta já tinha', () => {
    const guardado = base({ pinturas: 0b10 });
    expect(progressoComPinturas(base(), guardado).pinturas).toBe(0b10);
  });

  it('o servidor soma: o que chega e o que já estava, sempre a união', () => {
    expect(progressoComPinturas(base({ pinturas: 0b100 }), base({ pinturas: 0b10 })).pinturas).toBe(0b110);
  });

  it('sem campo nenhum (nem chegando nem guardado), devolve o mesmo progresso, sem acrescentar o campo', () => {
    const novo = base();
    expect(progressoComPinturas(novo, base())).toBe(novo);
  });
});
