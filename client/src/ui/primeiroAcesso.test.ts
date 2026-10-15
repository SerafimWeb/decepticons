import { describe, expect, it } from 'vitest';
import { ehPrimeiroAcesso, PRIMEIRA_KEY, SINAIS_DE_JOGO_ANTERIOR, type Armazem } from './primeiroAcesso';

const armazem = (dados: Record<string, string> = {}): Armazem => ({ getItem: (k) => dados[k] ?? null });

describe('o primeiro acesso (P133, decisão do Comandante em 15/10)', () => {
  it('quem não tem nada guardado é primeira visita', () => {
    expect(ehPrimeiroAcesso('', armazem())).toBe(true);
    expect(ehPrimeiroAcesso('?mapa=praia&modo=survival', armazem())).toBe(true); // um link de divulgação também cai na tela enxuta
  });

  it('as configurações NÃO contam como jogo anterior: o SettingsStore as grava em todo boot, todo visitante as tem', () => {
    expect(SINAIS_DE_JOGO_ANTERIOR).not.toContain('cybermech.settings.v1');
    expect(ehPrimeiroAcesso('', armazem({ 'cybermech.settings.v1': '{}' }))).toBe(true);
  });

  it('a marca de "já começou uma partida aqui" tira da tela enxuta', () => {
    expect(ehPrimeiroAcesso('', armazem({ [PRIMEIRA_KEY]: '1' }))).toBe(false);
  });

  it('cada sinal de quem já jogou ou mexeu (progressão, dicas, Hangar, nome, campanha, esquadrão, potências, Comandante) basta sozinho', () => {
    for (const sinal of SINAIS_DE_JOGO_ANTERIOR) {
      expect(ehPrimeiroAcesso('', armazem({ [sinal]: 'x' })), sinal).toBe(false);
    }
    expect(SINAIS_DE_JOGO_ANTERIOR).toEqual(expect.arrayContaining(['cybermech_pilot_progression', 'cybermech.hangar.v1', 'cybermech.comandante']));
  });

  it('?console força o console completo, e ?primeira força a tela enxuta (para os links de teste e para fotografar)', () => {
    expect(ehPrimeiroAcesso('?console', armazem())).toBe(false);
    expect(ehPrimeiroAcesso('?console=1&mapa=praia', armazem())).toBe(false);
    expect(ehPrimeiroAcesso('?primeira', armazem({ cybermech_pilot_progression: '{}', [PRIMEIRA_KEY]: '1' }))).toBe(true);
    // O ?console vence o ?primeira (o dono que pede o completo recebe o completo).
    expect(ehPrimeiroAcesso('?console&primeira', armazem())).toBe(false);
  });

  it('navegador sem armazenamento (bloqueado) conta como primeira visita, e um armazenamento que lança erro também', () => {
    expect(ehPrimeiroAcesso('', null)).toBe(true);
    const quebrado: Armazem = { getItem: () => { throw new Error('SecurityError'); } };
    expect(ehPrimeiroAcesso('', quebrado)).toBe(true);
  });
});
