import { describe, expect, it } from 'vitest';
import { MONTAGEM_MAX, mesclarProgresso, progressoIgual, validarProgresso, type ProgressoPiloto } from './auth';

const base = (over: Partial<ProgressoPiloto> = {}): ProgressoPiloto => ({ apelido: 'PILOTO-4F2A', nivel: 3, xp: 250, creditos: 400, montagem: '{"chassis":"vector09"}', atualizadoEm: 1000, ...over });

describe('validarProgresso: o contrato do que a conta guarda', () => {
  it('aceita um progresso inteiro e devolve a forma normalizada', () => {
    expect(validarProgresso(base())).toEqual(base());
  });

  it('o apelido passa pelo filtro que o chamador der (o servidor usa o da sala online); apelido vazio fica vazio', () => {
    expect(validarProgresso(base({ apelido: 'abc' }), (a) => a.toUpperCase())!.apelido).toBe('ABC');
    expect(validarProgresso(base({ apelido: '' }), () => 'PILOTO')!.apelido).toBe('');
  });

  it('recusa o que não é objeto', () => {
    for (const x of [null, undefined, 3, 'x', []]) expect(validarProgresso(x), String(x)).toBeNull();
  });

  it('recusa nível, XP e créditos fora da faixa ou não inteiros (nada é "arredondado" em silêncio)', () => {
    for (const ruim of [{ nivel: 0 }, { nivel: 1000 }, { nivel: 2.5 }, { nivel: NaN }, { nivel: '3' }, { xp: -1 }, { xp: 1000 }, { xp: 0.5 }, { creditos: -1 }, { creditos: 1_000_000_001 }, { creditos: Infinity }]) {
      expect(validarProgresso({ ...base(), ...ruim }), JSON.stringify(ruim)).toBeNull();
    }
  });

  it('os limites exatos valem: nível 1 e 999, XP 0 e 999, créditos 0 e 1 bilhão', () => {
    expect(validarProgresso(base({ nivel: 1, xp: 0, creditos: 0 }))).not.toBeNull();
    expect(validarProgresso(base({ nivel: 999, xp: 999, creditos: 1_000_000_000 }))).not.toBeNull();
  });

  it('a montagem é texto de até 4096 caracteres; mais que isso, ou outro tipo, recusa', () => {
    expect(validarProgresso(base({ montagem: 'x'.repeat(MONTAGEM_MAX) }))).not.toBeNull();
    expect(validarProgresso(base({ montagem: 'x'.repeat(MONTAGEM_MAX + 1) }))).toBeNull();
    expect(validarProgresso({ ...base(), montagem: { chassis: 'x' } })).toBeNull();
  });

  it('exige todos os campos (apelido, montagem, nível, XP, créditos, data)', () => {
    for (const campo of ['apelido', 'montagem', 'nivel', 'xp', 'creditos', 'atualizadoEm'] as const) {
      const sem: Record<string, unknown> = { ...base() };
      delete sem[campo];
      expect(validarProgresso(sem), campo).toBeNull();
    }
  });

  it('a data é número finito não negativo (e vira inteiro)', () => {
    expect(validarProgresso(base({ atualizadoEm: 1500.9 }))!.atualizadoEm).toBe(1500);
    expect(validarProgresso(base({ atualizadoEm: -1 }))).toBeNull();
    expect(validarProgresso({ ...base(), atualizadoEm: 'ontem' })).toBeNull();
  });

  it('campo a mais do cliente é descartado (não entra no que o servidor guarda)', () => {
    const lido = validarProgresso({ ...base(), is_admin: true, lixo: 'x' }) as unknown as Record<string, unknown>;
    expect(Object.keys(lido).sort()).toEqual(['apelido', 'atualizadoEm', 'creditos', 'montagem', 'nivel', 'xp']);
  });
});

describe('mesclarProgresso: o convidado vira conta sem perder nada', () => {
  it('só um lado: devolve esse lado (conta nova guarda o do navegador; aparelho novo recebe o da conta)', () => {
    const p = base();
    expect(mesclarProgresso(p, null)).toBe(p);
    expect(mesclarProgresso(null, p)).toBe(p);
    expect(mesclarProgresso(null, null)).toBeNull();
  });

  it('quem tem mais nível vence por inteiro (créditos juntos), mesmo com menos XP ou créditos', () => {
    const local = base({ nivel: 5, xp: 10, creditos: 50 });
    const remoto = base({ nivel: 3, xp: 900, creditos: 9000 });
    expect(mesclarProgresso(local, remoto)).toMatchObject({ nivel: 5, xp: 10, creditos: 50 });
    expect(mesclarProgresso(remoto, local)).toMatchObject({ nivel: 5, xp: 10, creditos: 50 });
  });

  it('no mesmo nível, mais XP vence', () => {
    const a = base({ nivel: 4, xp: 100 });
    const b = base({ nivel: 4, xp: 600, creditos: 7 });
    expect(mesclarProgresso(a, b)!.xp).toBe(600);
    expect(mesclarProgresso(b, a)!.creditos).toBe(7);
  });

  it('empate de nível e XP: o gravado por último; empate de tudo: o da conta (remoto)', () => {
    const velho = base({ creditos: 1, atualizadoEm: 10 });
    const novo = base({ creditos: 2, atualizadoEm: 20 });
    expect(mesclarProgresso(velho, novo)!.creditos).toBe(2);
    expect(mesclarProgresso(novo, velho)!.creditos).toBe(2);
    const a = base({ creditos: 1, atualizadoEm: 10 });
    const b = base({ creditos: 2, atualizadoEm: 10 });
    expect(mesclarProgresso(a, b)!.creditos).toBe(2); // o remoto
  });

  it('o apelido e a montagem do outro cobrem o que o vencedor não tem; a data é a mais nova das duas', () => {
    const local = base({ nivel: 9, apelido: '', montagem: '', atualizadoEm: 5 });
    const remoto = base({ nivel: 2, apelido: 'ANA', montagem: '{"x":1}', atualizadoEm: 99 });
    expect(mesclarProgresso(local, remoto)).toMatchObject({ nivel: 9, apelido: 'ANA', montagem: '{"x":1}', atualizadoEm: 99 });
  });

  it('o apelido do vencedor não é trocado pelo do perdedor', () => {
    expect(mesclarProgresso(base({ nivel: 9, apelido: 'EU' }), base({ nivel: 2, apelido: 'ANA' }))!.apelido).toBe('EU');
  });

  it('é pura: não muda os argumentos', () => {
    const a = base({ nivel: 9 });
    const b = base({ nivel: 2 });
    const antes = JSON.stringify([a, b]);
    mesclarProgresso(a, b);
    expect(JSON.stringify([a, b])).toBe(antes);
  });
});

describe('progressoIgual', () => {
  it('compara o conteúdo, sem a data', () => {
    expect(progressoIgual(base(), base({ atualizadoEm: 9999 }))).toBe(true);
    expect(progressoIgual(base(), base({ creditos: 401 }))).toBe(false);
    expect(progressoIgual(base(), base({ apelido: 'OUTRO' }))).toBe(false);
    expect(progressoIgual(base(), base({ montagem: '' }))).toBe(false);
    expect(progressoIgual(null, null)).toBe(true);
    expect(progressoIgual(base(), null)).toBe(false);
  });
});
