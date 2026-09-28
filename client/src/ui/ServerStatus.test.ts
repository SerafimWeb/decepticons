import { describe, expect, it } from 'vitest';
import { ServerStatus } from './ServerStatus';

/**
 * Os testes rodam no Node, sem DOM: o que se prova aqui é que o módulo é inerte quando não há onde
 * desenhar nem servidor para perguntar — as duas situações do boot headless e do jogo sem multiplayer.
 * A regra do texto em si está em `client/src/net/serverStatus.test.ts` (função pura).
 */
describe('ServerStatus (linha do servidor na pausa)', () => {
  it('sem servidor configurado, não desenha nem pergunta nada', () => {
    const s = new ServerStatus(undefined);
    expect(() => s.stop()).not.toThrow();
  });

  it('endereço inválido é o mesmo que não ter servidor', () => {
    expect(() => new ServerStatus('jogo.selvamkt.com.br').stop()).not.toThrow();
  });

  it('com servidor mas sem DOM (boot headless, teste), não quebra', () => {
    expect(() => new ServerStatus('wss://jogo.selvamkt.com.br').stop()).not.toThrow();
  });
});
