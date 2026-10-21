import { describe, expect, it } from 'vitest';
import { canalDe, permite, proximoAlvo, type RegrasDoCanal } from './canais';

const regras = (o: Partial<RegrasDoCanal> & { times?: Record<number, number> } = {}): RegrasDoCanal => ({
  meuTime: o.meuTime === undefined ? 1 : o.meuTime,
  alvo: o.alvo === undefined ? null : o.alvo,
  timeDe: o.timeDe ?? ((id) => o.times?.[id] ?? null),
});

describe('canalDe (P237 PR 3): em qual canal estou falando agora', () => {
  it('a tabela inteira: o privado vale mais que o do time, e o do time mais que o de todos; nada apertado = calado', () => {
    const esperado = (todos: boolean, time: boolean, privado: boolean) => (privado ? 'privado' : time ? 'time' : todos ? 'todos' : null);
    for (const todos of [true, false])
      for (const time of [true, false])
        for (const privado of [true, false]) expect(canalDe(todos, time, privado), `todos=${todos} time=${time} privado=${privado}`).toBe(esperado(todos, time, privado));
  });
});

describe('permite (P237 PR 3): quem ouve o que sai agora (falha fechada)', () => {
  const times = { 3: 1, 4: 1, 5: 2 }; // eu sou do time 1: o 3 e o 4 são meus, o 5 é do outro

  it('"todos" (e calado) deixa todas as portas abertas', () => {
    for (const canal of ['todos', null] as const) for (const id of [3, 4, 5, 99]) expect(permite(canal, id, regras({ times })), `${canal}/${id}`).toBe(true);
  });

  it('"time": só quem é do meu time ouve; o do outro time e o desconhecido não', () => {
    const r = regras({ times });
    expect(permite('time', 3, r)).toBe(true);
    expect(permite('time', 4, r)).toBe(true);
    expect(permite('time', 5, r)).toBe(false);
    expect(permite('time', 99, r), 'um colega sem time conhecido').toBe(false);
  });

  it('"time" numa sala SEM times (ninguém tem time): ninguém ouve, nunca vira "todos"', () => {
    const r = regras({ meuTime: null, times: {} });
    for (const id of [3, 4, 5]) expect(permite('time', id, r), String(id)).toBe(false);
  });

  it('"time" quando eu não tenho time mas os outros têm: ninguém ouve (o "mesmo time" de dois sem-time não vale)', () => {
    const r = regras({ meuTime: null, times });
    for (const id of [3, 4, 5]) expect(permite('time', id, r), String(id)).toBe(false);
  });

  it('"privado": só o jogador escolhido ouve', () => {
    const r = regras({ times, alvo: 4 });
    expect(permite('privado', 4, r)).toBe(true);
    expect(permite('privado', 3, r)).toBe(false);
    expect(permite('privado', 5, r)).toBe(false);
  });

  it('"privado" sem jogador escolhido: ninguém ouve', () => {
    const r = regras({ times, alvo: null });
    for (const id of [3, 4, 5]) expect(permite('privado', id, r), String(id)).toBe(false);
  });

  it('o time 0 conta como time (um zero não é "sem time")', () => {
    const r = regras({ meuTime: 0, times: { 3: 0, 4: 1 } });
    expect(permite('time', 3, r)).toBe(true);
    expect(permite('time', 4, r)).toBe(false);
  });
});

describe('proximoAlvo (P237 PR 3): trocar o jogador do canal privado', () => {
  it('sem escolha, o primeiro (em ordem de id); depois cada um, e volta ao primeiro', () => {
    expect(proximoAlvo([7, 3, 5], null)).toBe(3);
    expect(proximoAlvo([7, 3, 5], 3)).toBe(5);
    expect(proximoAlvo([7, 3, 5], 5)).toBe(7);
    expect(proximoAlvo([7, 3, 5], 7)).toBe(3);
  });

  it('o escolhido que saiu da lista cai no primeiro; ninguém na voz, nenhum alvo; um só colega é sempre ele', () => {
    expect(proximoAlvo([3, 5], 9)).toBe(3);
    expect(proximoAlvo([], 3)).toBeNull();
    expect(proximoAlvo([4], null)).toBe(4);
    expect(proximoAlvo([4], 4)).toBe(4);
  });

  it('não mexe na lista que recebeu', () => {
    const ids = [7, 3, 5];
    proximoAlvo(ids, null);
    expect(ids).toEqual([7, 3, 5]);
  });
});
