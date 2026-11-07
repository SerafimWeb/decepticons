import { afterEach, describe, expect, it } from 'vitest';
import { ajustesGen3, definirAjustesGen3, FAIXAS, PADRAO_GEN3, validarAjustes } from './ajustesGen3';
import dados from './movimentoGen3.json';

// Estrutura, nunca gosto: o que o Comandante escolher no Estúdio não pode quebrar o `npm run check`.
describe('ajustes da geração 3 do movimento', () => {
  afterEach(() => definirAjustesGen3(PADRAO_GEN3));

  it('o arquivo de dados tem todas as chaves, todas em faixa segura (nada foi preso pelo validador)', () => {
    for (const [chave, [min, max]] of Object.entries(FAIXAS)) {
      const v = (dados as Record<string, unknown>)[chave];
      expect(typeof v, `${chave} falta no movimentoGen3.json`).toBe('number');
      expect(v as number, chave).toBeGreaterThanOrEqual(min);
      expect(v as number, chave).toBeLessThanOrEqual(max);
    }
    expect(validarAjustes(dados)).toEqual(dados);
  });

  it('o padrão de projeto também está em faixa', () => {
    for (const [chave, [min, max]] of Object.entries(FAIXAS)) {
      const v = PADRAO_GEN3[chave as keyof typeof PADRAO_GEN3];
      expect(v, chave).toBeGreaterThanOrEqual(min);
      expect(v, chave).toBeLessThanOrEqual(max);
    }
  });

  it('valor fora da faixa é preso; o que não é número, ou falta, vira o padrão', () => {
    const a = validarAjustes({ ciclosMax: 99, agachamento: -1, rigidez: 'rápido', amortecimento: Number.NaN });
    expect(a.ciclosMax).toBe(FAIXAS.ciclosMax[1]);
    expect(a.agachamento).toBe(FAIXAS.agachamento[0]);
    expect(a.rigidez).toBe(PADRAO_GEN3.rigidez);
    expect(a.amortecimento).toBe(PADRAO_GEN3.amortecimento);
    expect(a.molejoDoPasso).toBe(PADRAO_GEN3.molejoDoPasso);
  });

  it('entrada que não é objeto devolve o padrão inteiro (arquivo corrompido não derruba o jogo)', () => {
    for (const lixo of [null, undefined, 3, 'texto', []]) expect(validarAjustes(lixo)).toEqual(PADRAO_GEN3);
  });

  it('a prévia troca os ajustes pelo `definirAjustesGen3`, preso na faixa', () => {
    definirAjustesGen3({ ciclosMax: 2, rigidez: 100 });
    expect(ajustesGen3().ciclosMax).toBe(2);
    expect(ajustesGen3().rigidez).toBe(FAIXAS.rigidez[1]);
    expect(ajustesGen3().agachamento).toBe(PADRAO_GEN3.agachamento);
  });
});
