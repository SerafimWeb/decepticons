import { describe, expect, it } from 'vitest';
import { linkDoStreamer, pedeModoStreamer, SALA_DO_STREAMER } from './modoStreamer';

describe('o modo streamer (P310): ?stream=1 leva à sala fixa AO-VIVO', () => {
  it('só ?stream=1 pede o modo; outro valor, ou nenhum, é o jogo de sempre', () => {
    expect(pedeModoStreamer('?stream=1')).toBe(true);
    expect(pedeModoStreamer('?mapa=praia&stream=1')).toBe(true);
    expect(pedeModoStreamer('?stream=0')).toBe(false);
    expect(pedeModoStreamer('?stream=true')).toBe(false);
    expect(pedeModoStreamer('?streaming=1')).toBe(false);
    expect(pedeModoStreamer('')).toBe(false);
  });

  it('a sala fixa cabe no padrão de código de sala do servidor (letras, números e hífen, até 12)', () => {
    expect(SALA_DO_STREAMER).toMatch(/^[A-Z0-9-]{1,12}$/);
  });

  it('o link que o streamer copia leva ?stream=1, mantém a sala e o servidor, e deixa de fora o nome e o resto', () => {
    expect(linkDoStreamer('https://cybermech.online/jogar/?sala=casa&nome=Dan&mapa=praia&servidor=wss%3A%2F%2Fjogo.cybermech.online')).toBe(
      'https://cybermech.online/jogar/?stream=1&sala=casa&servidor=wss%3A%2F%2Fjogo.cybermech.online',
    );
    // Sem sala no link, quem abre cai na sala fixa.
    expect(linkDoStreamer('https://cybermech.online/jogar/?modo=survival&stream=1')).toBe('https://cybermech.online/jogar/?stream=1');
    expect(linkDoStreamer('http://localhost:5173/?stream=1')).toBe('http://localhost:5173/?stream=1');
  });
});
