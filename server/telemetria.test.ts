import { describe, expect, it } from 'vitest';
import { Telemetria } from './telemetria';

const HORA = 3_600_000;

describe('agregador de métricas', () => {
  it('começa zerado e cresce a cada registro', () => {
    const t = new Telemetria(0);
    expect(t.resumo(0).total.boot_ok).toBe(0);
    t.registrar('boot_ok', '1.1.1.1', 0);
    t.registrar('boot_ok', '2.2.2.2', 0);
    expect(t.resumo(0).total.boot_ok).toBe(2);
    expect(t.resumo(0).janela24h.boot_ok).toBe(2);
    expect(t.resumo(0).total.click_cockpit).toBe(0);
  });

  it('taxa por IP: além do balde, recusa sem contar', () => {
    const t = new Telemetria(0);
    let aceitos = 0;
    for (let i = 0; i < 40; i++) if (t.registrar('boot_ok', '9.9.9.9', 0) === 'ok') aceitos++;
    expect(aceitos).toBe(30); // teto do balde
    expect(t.resumo(0).total.boot_ok).toBe(30);
  });

  it('a ficha recarrega com o tempo', () => {
    const t = new Telemetria(0);
    for (let i = 0; i < 30; i++) t.registrar('boot_ok', '9.9.9.9', 0);
    expect(t.registrar('boot_ok', '9.9.9.9', 0)).toBe('taxa');
    // 2 segundos depois: recarregou 1 ficha (0,5/s).
    expect(t.registrar('boot_ok', '9.9.9.9', 2000)).toBe('ok');
  });

  it('janela de 24h cai fora depois de 25h, mas o total nunca cai', () => {
    const t = new Telemetria(0);
    t.registrar('boot_ok', '1.1.1.1', 0);
    expect(t.resumo(0).janela24h.boot_ok).toBe(1);
    expect(t.resumo(25 * HORA).janela24h.boot_ok).toBe(0);
    expect(t.resumo(25 * HORA).total.boot_ok).toBe(1);
  });

  it('um evento novo numa hora nova não apaga o das horas ainda dentro da janela', () => {
    const t = new Telemetria(0);
    t.registrar('boot_ok', '1.1.1.1', 0);
    t.registrar('boot_ok', '2.2.2.2', 5 * HORA);
    const r = t.resumo(5 * HORA);
    expect(r.janela24h.boot_ok).toBe(2);
    expect(r.total.boot_ok).toBe(2);
  });

  it('servidor "dormindo" muitas horas não trava num loop proporcional ao tempo parado', () => {
    const t = new Telemetria(0);
    t.registrar('boot_ok', '1.1.1.1', 0);
    const inicio = Date.now();
    const r = t.resumo(1000 * HORA); // ~41 dias de uma vez
    expect(Date.now() - inicio).toBeLessThan(50);
    expect(r.janela24h.boot_ok).toBe(0);
    expect(r.total.boot_ok).toBe(1);
  });
});
