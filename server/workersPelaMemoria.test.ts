import { describe, expect, it } from 'vitest';
import { MB_POR_WORKER, workersPelaMemoria } from '../scripts/workersPelaMemoria.mjs';

const MB = 1024 * 1024;

describe('o gate de testes na máquina de pouca memória (13/10: "Fatal process out of memory: Zone")', () => {
  it('com memória de sobra o Vitest escolhe sozinho (o CI e as máquinas folgadas não mudam)', () => {
    expect(workersPelaMemoria(16_000 * MB, 8)).toBeNull();
    expect(workersPelaMemoria(7 * MB_POR_WORKER * MB, 8)).toBeNull(); // cabem os 7 do padrão (8 núcleos − 1)
  });

  it('com pouca memória, limita os workers ao que cabe, nunca abaixo de 2 e nunca acima do padrão', () => {
    expect(workersPelaMemoria(3 * MB_POR_WORKER * MB, 8)).toBe(3);
    expect(workersPelaMemoria(5 * MB_POR_WORKER * MB + 10, 8)).toBe(5);
    expect(workersPelaMemoria(430 * MB, 8)).toBe(2); // o que a máquina do dono tinha livre
    expect(workersPelaMemoria(0, 8)).toBe(2);
    expect(workersPelaMemoria(6 * MB_POR_WORKER * MB, 8)).toBe(6); // um a menos que o padrão: ainda limita
  });

  it('em máquina de poucos núcleos, o padrão é o que o Vitest já usaria e o piso de 2 vale', () => {
    expect(workersPelaMemoria(2000 * MB, 2)).toBeNull(); // padrão 1: cabe
    expect(workersPelaMemoria(100 * MB, 4)).toBe(2);
    expect(workersPelaMemoria(MB_POR_WORKER * MB * 3, 4)).toBeNull(); // 3 cabem, o padrão é 3
  });
});
