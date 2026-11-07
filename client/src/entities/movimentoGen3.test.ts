import { afterEach, describe, expect, it } from 'vitest';
import { carregarGeracao3, geracao3, setMovimentoGen3 } from './movimentoGen3';

describe('o interruptor da geração 3 e o carregador do código dela', () => {
  afterEach(() => setMovimentoGen3(false));

  it('desligada, o código não é entregue mesmo carregado: o Mech anda como antes', async () => {
    await carregarGeracao3();
    setMovimentoGen3(false);
    expect(geracao3()).toBeNull();
  });

  it('ligada e carregada, entrega o código; desligar volta ao nada', async () => {
    const modulo = await carregarGeracao3();
    setMovimentoGen3(true);
    expect(geracao3()).toBe(modulo);
    expect(typeof modulo.locomocao).toBe('function');
    setMovimentoGen3(false);
    expect(geracao3()).toBeNull();
  });

  it('carregar duas vezes devolve o mesmo código (um pedaço só)', async () => {
    expect(await carregarGeracao3()).toBe(await carregarGeracao3());
  });
});
