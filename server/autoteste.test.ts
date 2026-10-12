import { describe, expect, it } from 'vitest';
import type { Checagem } from '../shared/net/admin';
import { SNAPSHOT_HZ } from '../shared/net/constants';
import { ehSalaDeTeste, passou, PREFIXO_DE_TESTE, resultadoDosEstados } from './autoteste';

const checagem = (resultado: Checagem['resultado']): Checagem => ({ nome: 'x', valor: '1', limite: '2', resultado });

describe('a bateria do painel: como o resultado é julgado', () => {
  it('os estados por segundo: até 2 abaixo do ritmo é ok, até 6 abaixo é atenção, abaixo disso falha', () => {
    expect(resultadoDosEstados(SNAPSHOT_HZ)).toBe('ok');
    expect(resultadoDosEstados(SNAPSHOT_HZ - 2)).toBe('ok');
    expect(resultadoDosEstados(SNAPSHOT_HZ - 2.1)).toBe('atencao');
    expect(resultadoDosEstados(SNAPSHOT_HZ - 6)).toBe('atencao');
    expect(resultadoDosEstados(SNAPSHOT_HZ - 6.1)).toBe('falha');
    expect(resultadoDosEstados(0)).toBe('falha');
  });

  it('o teste passa com ok e atenção, e reprova com uma falha só', () => {
    expect(passou([checagem('ok'), checagem('atencao')])).toBe(true);
    expect(passou([checagem('ok'), checagem('falha'), checagem('ok')])).toBe(false);
    expect(passou([])).toBe(true);
  });

  it('a sala de teste se reconhece pelo prefixo (o servidor não conta nada dela)', () => {
    expect(ehSalaDeTeste(`${PREFIXO_DE_TESTE}AB12`)).toBe(true);
    expect(ehSalaDeTeste('ARENA')).toBe(false);
    expect(ehSalaDeTeste('MEU-TESTE-1')).toBe(false);
  });
});
