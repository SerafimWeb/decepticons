import { describe, expect, it } from 'vitest';
import { dataDoBuild, rotuloDoBuild } from './buildInfo';

describe('o rótulo do build no rodapé (P278)', () => {
  it('a data e a hora saem do instante UTC, no fuso de quem olha (aqui o de Brasília, UTC−3)', () => {
    expect(dataDoBuild('2026-10-29T13:25:00.000Z', 'America/Sao_Paulo')).toBe('29/10 10:25');
    expect(dataDoBuild('2026-10-29T13:25:00.000Z', 'UTC')).toBe('29/10 13:25');
    expect(dataDoBuild('2026-01-02T03:04:00.000Z', 'UTC')).toBe('02/01 03:04'); // dois dígitos sempre
    expect(dataDoBuild('2026-10-29T00:05:00.000Z', 'UTC')).toBe('29/10 00:05'); // meia-noite é 00, não 24
  });

  it('sem instante, ou com um instante que não é data, não há data no rodapé (nunca "Invalid Date")', () => {
    expect(dataDoBuild(undefined)).toBeNull();
    expect(dataDoBuild('')).toBeNull();
    expect(dataDoBuild('ontem')).toBeNull();
  });

  it('o rodapé: build, hash, a data e a hora e a assinatura; sem data fica como era; o de desenvolvimento não ganha data', () => {
    expect(rotuloDoBuild('build 1284 · 634d80d', '2026-10-29T13:25:00.000Z', 2026, 'America/Sao_Paulo')).toBe('CYBERMECH build 1284 · 634d80d · 29/10 10:25 · © 2026 SERAFIM WEB');
    expect(rotuloDoBuild('build 1284 · 634d80d', undefined, 2026)).toBe('CYBERMECH build 1284 · 634d80d · © 2026 SERAFIM WEB');
    expect(rotuloDoBuild(undefined, '2026-10-29T13:25:00.000Z', 2026)).toBe('CYBERMECH dev · © 2026 SERAFIM WEB');
  });
});
