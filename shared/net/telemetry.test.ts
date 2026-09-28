import { describe, expect, it } from 'vitest';
import { EVENTOS, parseEvento, parseResumo, resumoVazio } from './telemetry';

describe('telemetria de produto: só a lista fechada passa', () => {
  it('aceita um evento conhecido com aba válida', () => {
    expect(parseEvento({ nome: 'click_cockpit', aba: 'a1b2c3d4' })).toEqual({ nome: 'click_cockpit', aba: 'a1b2c3d4' });
  });

  it('recusa nome fora da lista — ninguém injeta contagem inventada no painel', () => {
    expect(parseEvento({ nome: 'coisa_qualquer', aba: 'a1b2c3d4' })).toBeNull();
    expect(parseEvento({ nome: '__proto__', aba: 'a1b2c3d4' })).toBeNull();
  });

  it('recusa aba ausente, curta demais, longa demais ou com caractere estranho', () => {
    expect(parseEvento({ nome: 'boot_ok' })).toBeNull();
    expect(parseEvento({ nome: 'boot_ok', aba: 'abc' })).toBeNull();
    expect(parseEvento({ nome: 'boot_ok', aba: 'x'.repeat(41) })).toBeNull();
    expect(parseEvento({ nome: 'boot_ok', aba: 'tem espaço' })).toBeNull();
    expect(parseEvento({ nome: 'boot_ok', aba: '<script>' })).toBeNull();
  });

  it('recusa lixo estrutural sem lançar', () => {
    expect(parseEvento(null)).toBeNull();
    expect(parseEvento('texto')).toBeNull();
    expect(parseEvento(42)).toBeNull();
    expect(parseEvento([])).toBeNull();
  });

  it('a lista de eventos não tem duplicata (cada um é um contador só)', () => {
    expect(new Set(EVENTOS).size).toBe(EVENTOS.length);
  });
});

describe('resumo público: só números agregados', () => {
  it('o resumo vazio tem todo evento zerado', () => {
    const r = resumoVazio('2026-09-28T00:00:00.000Z');
    for (const nome of EVENTOS) {
      expect(r.janela24h[nome]).toBe(0);
      expect(r.total[nome]).toBe(0);
    }
  });

  it('lê de volta o que foi mandado', () => {
    const r = resumoVazio('2026-09-28T00:00:00.000Z');
    r.total.boot_ok = 12;
    expect(parseResumo(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });

  it('recusa resumo fora do contrato: campo faltando, evento faltando, número negativo', () => {
    expect(parseResumo(null)).toBeNull();
    expect(parseResumo({})).toBeNull();
    const incompleto = { desde: 'x', janela24h: { boot_ok: 1 }, total: resumoVazio('x').total };
    expect(parseResumo(incompleto)).toBeNull();
    const negativo = resumoVazio('x');
    (negativo.total as Record<string, number>).boot_ok = -1;
    expect(parseResumo(negativo)).toBeNull();
  });
});
