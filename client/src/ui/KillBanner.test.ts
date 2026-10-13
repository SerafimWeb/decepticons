import { describe, expect, it } from 'vitest';
import { KillBanner } from './KillBanner';

describe('KillBanner (aviso de abate e sequências)', () => {
  it('nasce sem texto ativo', () => {
    const banner = new KillBanner();
    expect(banner.currentText).toBe('');
  });

  it('exibe o nome da vítima no abate simples', () => {
    const banner = new KillBanner();
    banner.showKill('CLAWD', 1);
    expect(banner.currentText).toContain('ABATE: CLAWD');
  });

  it('exibe DUPLO ABATE no segundo abate em sequência', () => {
    const banner = new KillBanner();
    banner.showKill('GEMINAI', 2);
    expect(banner.currentText).toContain('DUPLO ABATE · GEMINAI');
  });

  it('avisa quem toca o som com a sequência (o banner não cria áudio próprio)', () => {
    const banner = new KillBanner();
    const sons: number[] = [];
    banner.som = (n) => sons.push(n);
    banner.showKill('CLAWD', 1);
    banner.showKill('GEMINAI', 2);
    banner.showKill('CHAD-GPT', 3);
    banner.showKill('X', 5);
    expect(sons).toEqual([1, 2, 3, 5]);
    expect(banner.currentText).toBe('IMPARÁVEL (5x) · X');
  });

  it('o mesmo aviso repetido enquanto está na tela só renova o tempo, sem tocar de novo', () => {
    const banner = new KillBanner();
    let toques = 0;
    banner.som = () => toques++;
    banner.showKill('CLAWD', 1);
    banner.showKill('CLAWD', 1);
    expect(toques).toBe(1);
  });

  it('sem quem toque, mostra do mesmo jeito', () => {
    const banner = new KillBanner();
    expect(() => banner.showKill('CLAWD', 2)).not.toThrow();
    expect(banner.currentText).toBe('DUPLO ABATE · CLAWD');
  });
});
