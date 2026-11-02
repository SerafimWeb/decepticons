import { describe, expect, it } from 'vitest';
import { DURACAO_SEGMENTO_S, INICIO_DE_CADA_SEGMENTO_S, ehHoraDeNovoSegmento, escolherSegmento } from './segmentos';

describe('o trecho do clipe (P309)', () => {
  it('escolhe a gravação que começou entre 5 e 10 s atrás (o clipe tem essa duração)', () => {
    // Aberturas a cada 5 s: 0, 5, 10. Em t = 12, a de 5 (7 s atrás) é a mais antiga dentro da faixa.
    expect(escolherSegmento([0, 5, 10], 12)).toBe(1);
    // Em t = 16, a de 10 (6 s atrás).
    expect(escolherSegmento([0, 5, 10], 16)).toBe(2);
  });

  it('entre as que cabem na faixa, pega a mais antiga (clipe mais longo, até 10 s)', () => {
    // Em t = 20: as de 10 e 15 estão na faixa (10 s e 5 s atrás); a mais antiga é a de 10.
    expect(escolherSegmento([0, 5, 10, 15], 20)).toBe(2);
  });

  it('logo depois de ligar, sem nenhuma na faixa, usa a mais antiga ainda gravando (clipe mais curto)', () => {
    expect(escolherSegmento([0], 3)).toBe(0);
  });

  it('sem gravação, ou com todas antigas demais, não escolhe nada', () => {
    expect(escolherSegmento([], 10)).toBe(-1);
    expect(escolherSegmento([0], 50)).toBe(-1);
  });

  it('a faixa é a da constante: 5 a 10 s', () => {
    expect(INICIO_DE_CADA_SEGMENTO_S).toBe(5);
    expect(DURACAO_SEGMENTO_S).toBe(10);
  });

  it('abre gravação nova na primeira vez e a cada 5 s, nunca antes', () => {
    expect(ehHoraDeNovoSegmento(Number.NEGATIVE_INFINITY, 0)).toBe(true);
    expect(ehHoraDeNovoSegmento(0, 4.9)).toBe(false);
    expect(ehHoraDeNovoSegmento(0, 5)).toBe(true);
  });
});
