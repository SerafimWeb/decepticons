import { describe, expect, it } from 'vitest';
import { LimiteLogin } from './login';

describe('LimiteLogin', () => {
  it('permite até o teto e recusa depois, por IP', () => {
    const l = new LimiteLogin();
    let ok = 0;
    for (let i = 0; i < 10; i++) if (l.permitir('9.9.9.9', 0)) ok++;
    expect(ok).toBe(8);
    expect(l.permitir('9.9.9.9', 0)).toBe(false);
  });

  it('IPs diferentes têm baldes independentes', () => {
    const l = new LimiteLogin();
    for (let i = 0; i < 8; i++) l.permitir('1.1.1.1', 0);
    expect(l.permitir('1.1.1.1', 0)).toBe(false);
    expect(l.permitir('2.2.2.2', 0)).toBe(true);
  });

  it('a janela vira e libera de novo', () => {
    const l = new LimiteLogin();
    for (let i = 0; i < 8; i++) l.permitir('9.9.9.9', 0);
    expect(l.permitir('9.9.9.9', 0)).toBe(false);
    expect(l.permitir('9.9.9.9', 10 * 60 * 1000 + 1)).toBe(true);
  });
});
