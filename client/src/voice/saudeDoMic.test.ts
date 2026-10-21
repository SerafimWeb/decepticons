import { describe, expect, it } from 'vitest';
import { barraDoNivel, GANHO_MAX, nivelDaOnda, RMS_ALVO, SEM_SOM_MS, sugestaoDeGanho, VigiaDoMic } from './saudeDoMic';

describe('VigiaDoMic (P237): o microfone abre mas não chega som', () => {
  it('só acusa "sem-som" depois de SEM_SOM_MS de zero absoluto com o microfone aberto', () => {
    const v = new VigiaDoMic();
    expect(v.ler(0, 0, true, true)).toBe('ok');
    expect(v.ler(SEM_SOM_MS - 1, 0, true, true)).toBe('ok');
    expect(v.ler(SEM_SOM_MS, 0, true, true)).toBe('sem-som');
    expect(v.ler(SEM_SOM_MS * 3, 0, true, true), 'continua acusando').toBe('sem-som');
  });

  it('qualquer som zera na hora (um chiado de 0,000001 já é um microfone vivo), e o relógio recomeça do zero', () => {
    const v = new VigiaDoMic();
    v.ler(0, 0, true, true);
    expect(v.ler(SEM_SOM_MS, 0, true, true)).toBe('sem-som');
    expect(v.ler(SEM_SOM_MS + 100, 1e-6, true, true)).toBe('ok');
    expect(v.ler(SEM_SOM_MS + 200, 0, true, true), 'o silêncio recomeça a contar: ainda cedo').toBe('ok');
    expect(v.ler(SEM_SOM_MS + 200 + SEM_SOM_MS, 0, true, true)).toBe('sem-som');
  });

  it('com o microfone fechado (mudo, ou "segurar para falar" solto) o silêncio é o esperado: nunca acusa, e o relógio zera', () => {
    const v = new VigiaDoMic();
    v.ler(0, 0, true, true);
    expect(v.ler(SEM_SOM_MS * 2, 0, true, false)).toBe('ok');
    expect(v.ler(SEM_SOM_MS * 2 + 10, 0, true, true), 'abriu agora: o relógio começa de novo').toBe('ok');
  });

  it('a faixa que o navegador diz parada vale "sem-entrega" na hora, mesmo mudo, e some quando ela volta', () => {
    const v = new VigiaDoMic();
    expect(v.ler(0, 0.1, false, true)).toBe('sem-entrega');
    expect(v.ler(10, 0, false, false), 'mesmo com o microfone fechado').toBe('sem-entrega');
    expect(v.ler(20, 0.1, true, true)).toBe('ok');
    expect(v.estado).toBe('ok');
  });

  it('reiniciar zera o estado e o relógio (um microfone novo, depois da reabertura)', () => {
    const v = new VigiaDoMic();
    v.ler(0, 0, true, true);
    expect(v.ler(SEM_SOM_MS, 0, true, true)).toBe('sem-som');
    v.reiniciar();
    expect(v.estado).toBe('ok');
    expect(v.ler(SEM_SOM_MS + 1, 0, true, true)).toBe('ok');
  });
});

describe('sugestaoDeGanho (P237): o Captain 300 pede ganho, e o teste diz quanto', () => {
  it('voz captada mas baixa: sugere ganho × (alvo ÷ nível), arredondado a 0,1', () => {
    expect(sugestaoDeGanho(0.04, 1)).toBe(2.5);
    expect(sugestaoDeGanho(0.05, 1)).toBe(2);
    expect(sugestaoDeGanho(0.02, 2)).toBe(4); // 2 × 0,1 ÷ 0,02 = 10, limitado ao máximo
    expect(sugestaoDeGanho(0.03, 1.5)).toBe(4); // 1,5 × 0,1 ÷ 0,03 = 5
    expect(sugestaoDeGanho(0.06, 1.2)).toBe(2); // 1,2 × 0,1 ÷ 0,06
  });

  it('nunca passa do máximo, e no máximo já não há o que sugerir', () => {
    expect(sugestaoDeGanho(0.01, 1)).toBe(GANHO_MAX);
    expect(sugestaoDeGanho(0.01, GANHO_MAX)).toBeNull();
    expect(sugestaoDeGanho(0.01, 5)).toBeNull();
  });

  it('sem voz (só o chiado, abaixo de 0,008) não há o que sugerir', () => {
    expect(sugestaoDeGanho(0, 1)).toBeNull();
    expect(sugestaoDeGanho(0.0079, 1)).toBeNull();
    expect(sugestaoDeGanho(0.008, 1)).toBe(GANHO_MAX);
  });

  it('voz já boa (menos de 25% abaixo do alvo) não vira conversa', () => {
    expect(sugestaoDeGanho(RMS_ALVO, 1)).toBeNull();
    expect(sugestaoDeGanho(0.09, 1)).toBeNull(); // 0,1 ÷ 0,09 = 1,11
    expect(sugestaoDeGanho(0.085, 1)).toBeNull(); // 1,18: ainda não passa de 25%
    expect(sugestaoDeGanho(0.07, 1)).toBe(1.4); // 1,43: já vale sugerir
    expect(sugestaoDeGanho(0.2, 1)).toBeNull();
  });
});

describe('barraDoNivel e nivelDaOnda (P237: agora moram em saudeDoMic.ts, o HUD do chat os usa)', () => {
  it('a barra: −60 dBFS é 0, 0 dBFS é 100, e a fala normal fica no meio', () => {
    expect(barraDoNivel(0)).toBe(0);
    expect(barraDoNivel(0.001)).toBe(0);
    expect(barraDoNivel(1)).toBe(100);
    expect(barraDoNivel(0.1)).toBe(67);
    expect(barraDoNivel(0.01)).toBe(33);
    expect(barraDoNivel(5)).toBe(100);
  });

  it('o nível da onda: silêncio é 0; uma onda cheia tem RMS ~0,7 e pico 1; vazio não divide por zero', () => {
    expect(nivelDaOnda(new Float32Array(8))).toEqual({ rms: 0, pico: 0 });
    expect(nivelDaOnda(new Float32Array(0))).toEqual({ rms: 0, pico: 0 });
    const cheia = Float32Array.from({ length: 1024 }, (_, i) => Math.sin(i / 3));
    expect(nivelDaOnda(cheia).rms).toBeGreaterThan(0.69);
    expect(nivelDaOnda(cheia).pico).toBeGreaterThan(0.99);
    expect(nivelDaOnda(Float32Array.from([-0.5, 0.25])).pico).toBe(0.5);
  });
});
