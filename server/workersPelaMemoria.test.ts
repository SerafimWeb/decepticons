import { describe, expect, it } from 'vitest';
import { FOLGA_DA_MEMORIA_VIRTUAL, MB_POR_WORKER, WORKERS_MAXIMO, memoriaVirtualLivre, workersForcados, workersPelaMemoria } from '../scripts/workersPelaMemoria.mjs';

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

describe('a memória virtual do Windows quase no teto (19/10: seis sessões do Claude Code abertas, 2 GB livres de 24, workers mortos com 0xC0000409)', () => {
  const virtualPara = (workers: number) => Math.ceil((workers * MB_POR_WORKER * MB) / FOLGA_DA_MEMORIA_VIRTUAL) + 1;

  it('sem saber a memória virtual (Linux, o CI) nada muda', () => {
    expect(workersPelaMemoria(16_000 * MB, 8, null)).toBeNull();
    expect(workersPelaMemoria(3 * MB_POR_WORKER * MB, 8, null)).toBe(3);
    expect(workersPelaMemoria(430 * MB, 8, null)).toBe(2);
  });

  it('com a memória virtual de sobra, vale a regra da memória física', () => {
    expect(workersPelaMemoria(16_000 * MB, 8, 50_000 * MB)).toBeNull();
    expect(workersPelaMemoria(430 * MB, 8, 50_000 * MB)).toBe(2);
  });

  it('o teto virtual limita os workers mesmo com memória física sobrando', () => {
    expect(workersPelaMemoria(16_000 * MB, 8, virtualPara(3))).toBe(3);
    expect(workersPelaMemoria(16_000 * MB, 8, virtualPara(2))).toBe(2);
  });

  it('com a memória virtual quase no teto (o caso de 19/10: 1.983 MB livres), um worker só', () => {
    expect(workersPelaMemoria(612 * MB, 8, 1983 * MB)).toBe(1);
    expect(workersPelaMemoria(16_000 * MB, 8, 1983 * MB)).toBe(1);
    expect(workersPelaMemoria(16_000 * MB, 8, 0)).toBe(1);
    // e sem aperto no teto, o piso de 2 continua valendo
    expect(workersPelaMemoria(430 * MB, 8, virtualPara(2))).toBe(2);
  });

  it('CYBERMECH_WORKERS: só inteiro de 1 ao teto; o resto é ignorado', () => {
    expect(workersForcados('1')).toBe(1);
    expect(workersForcados(' 4 ')).toBe(4);
    expect(workersForcados(String(WORKERS_MAXIMO))).toBe(WORKERS_MAXIMO);
    for (const v of ['0', String(WORKERS_MAXIMO + 1), '-2', '1.5', 'dois', '', '  ', undefined, null, 3]) expect(workersForcados(v), String(v)).toBeNull();
  });

  it('memoriaVirtualLivre devolve bytes (Windows) ou null (outros), nunca lança', () => {
    const v = memoriaVirtualLivre();
    expect(v === null || (typeof v === 'number' && v >= 0)).toBe(true);
    if (process.platform !== 'win32') expect(v).toBeNull();
  });

  it('fora do Windows (o CI) não consulta o PowerShell: devolve null', () => {
    const original = Object.getOwnPropertyDescriptor(process, 'platform')!;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    try {
      expect(memoriaVirtualLivre()).toBeNull();
    } finally {
      Object.defineProperty(process, 'platform', original);
    }
  });
});
