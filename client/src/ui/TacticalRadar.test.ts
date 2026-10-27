import { describe, expect, it } from 'vitest';
import { transformeDoRadar } from './TacticalRadar';

describe('transformeDoRadar (P262: a conta que o clique do WARGAME inverte)', () => {
  it('ida e volta: paraMundo desfaz X/Y para qualquer ponto dentro do mapa (ponto flutuante: perto, não exato)', () => {
    const t = transformeDoRadar(800, 600, 100, 100);
    for (const [x, z] of [[0, 0], [50, -30], [-99, 99], [-100, -100]] as const) {
      const p = t.paraMundo(t.X(x), t.Y(z));
      expect(p.x).toBeCloseTo(x, 6);
      expect(p.z).toBeCloseTo(z, 6);
    }
  });

  it('o centro do mapa cai no centro do canvas', () => {
    const t = transformeDoRadar(800, 600, 100, 100);
    expect(t.X(0)).toBe(400);
    expect(t.Y(0)).toBe(300);
    expect(t.paraMundo(400, 300)).toEqual({ x: 0, z: 0 });
  });

  it('mapa retangular (a praia, 640 × 240): a escala vale o lado que aperta, nunca estoura a tela', () => {
    const t = transformeDoRadar(800, 600, 320, 120);
    // A escala do lado mais apertado (altura) decide k; a largura do mapa cabe com folga.
    expect(t.k).toBeCloseTo(Math.min((800 - 16) / 640, (600 - 16) / 240), 6);
    const p = t.paraMundo(t.X(-320), t.Y(120));
    expect(p.x).toBeCloseTo(-320, 6);
    expect(p.z).toBeCloseTo(120, 6);
  });

  it('canvas pequeno ou mapa grande: a conta não lança nem devolve algo fora do normal', () => {
    const t = transformeDoRadar(200, 150, 500, 500);
    expect(Number.isFinite(t.k)).toBe(true);
    expect(t.paraMundo(100, 75)).toEqual({ x: 0, z: 0 });
  });
});
