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
});
