import { describe, expect, it, vi } from 'vitest';
import { MONTAGEM_MAX } from '../../../shared/net/auth';
import { HANGAR_STORAGE_KEY } from '../hangar/Hangar';
import { DailyChallenges } from '../ui/DailyChallenges';
import { CHAVE_APELIDO, progressoLocalDoJogo } from './progressoLocal';
import type { Armazem } from './sessao';

class Mem implements Armazem {
  readonly d = new Map<string, string>();
  getItem(k: string): string | null {
    return this.d.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.d.set(k, v);
  }
  removeItem(k: string): void {
    this.d.delete(k);
  }
}

const daily = (n = 2, xp = 100, c = 500) => {
  const estado = { nivel: n, xp, creditos: c, aplicados: [] as unknown[] };
  return {
    estado,
    snapshot: () => ({ nivel: estado.nivel, xp: estado.xp, creditos: estado.creditos }),
    restore: (p: { nivel: number; xp: number; creditos: number }) => {
      estado.aplicados.push(p);
      Object.assign(estado, p);
    },
  };
};

describe('progressoLocalDoJogo: o que o navegador já guardava, sem copiar para outro lugar', () => {
  it('lê nível, XP e créditos do jogo, o apelido e a montagem das chaves de sempre, e a data que a sessão passar', () => {
    const arm = new Mem();
    arm.setItem(CHAVE_APELIDO, 'Ana Maria');
    arm.setItem(HANGAR_STORAGE_KEY, '{"chassis":"marauder"}');
    const p = progressoLocalDoJogo({ daily: daily(3, 250, 900), armazem: arm }).ler(1234);
    expect(p).toEqual({ apelido: 'Ana Maria', nivel: 3, xp: 250, creditos: 900, montagem: '{"chassis":"marauder"}', atualizadoEm: 1234 });
  });

  it('apelido passa pelo filtro da sala online (o que vai é o que volta), e vazio fica vazio (não vira "PILOTO")', () => {
    const arm = new Mem();
    arm.setItem(CHAVE_APELIDO, '<b>Rex</b>');
    expect(progressoLocalDoJogo({ daily: daily(), armazem: arm }).ler(0)!.apelido).toBe('bRexb');
    arm.setItem(CHAVE_APELIDO, '   ');
    expect(progressoLocalDoJogo({ daily: daily(), armazem: arm }).ler(0)!.apelido).toBe('');
    expect(progressoLocalDoJogo({ daily: daily(), armazem: new Mem() }).ler(0)!.apelido).toBe('');
  });

  it('montagem maior que o teto da conta não vai (e o Hangar do navegador não é tocado)', () => {
    const arm = new Mem();
    arm.setItem(HANGAR_STORAGE_KEY, 'x'.repeat(MONTAGEM_MAX + 1));
    expect(progressoLocalDoJogo({ daily: daily(), armazem: arm }).ler(0)!.montagem).toBe('');
    expect(arm.getItem(HANGAR_STORAGE_KEY)).toHaveLength(MONTAGEM_MAX + 1);
  });

  it('aplicar: o jogo recebe nível, XP e créditos; o apelido e a montagem vão para as chaves de sempre e a montagem é entregue ao Hangar', () => {
    const arm = new Mem();
    const d = daily(1, 0, 500);
    const aplicarMontagem = vi.fn();
    progressoLocalDoJogo({ daily: d, armazem: arm, aplicarMontagem }).aplicar({ apelido: 'ANA', nivel: 7, xp: 40, creditos: 9000, montagem: '{"chassis":"onca"}', atualizadoEm: 9 });
    expect(d.estado).toMatchObject({ nivel: 7, xp: 40, creditos: 9000 });
    expect(arm.getItem(CHAVE_APELIDO)).toBe('ANA');
    expect(arm.getItem(HANGAR_STORAGE_KEY)).toBe('{"chassis":"onca"}');
    expect(aplicarMontagem).toHaveBeenCalledWith('{"chassis":"onca"}');
  });

  it('aplicar sem apelido ou sem montagem na conta não apaga os do navegador', () => {
    const arm = new Mem();
    arm.setItem(CHAVE_APELIDO, 'EU');
    arm.setItem(HANGAR_STORAGE_KEY, '{"chassis":"vector09"}');
    const aplicarMontagem = vi.fn();
    progressoLocalDoJogo({ daily: daily(), armazem: arm, aplicarMontagem }).aplicar({ apelido: '', nivel: 5, xp: 0, creditos: 1, montagem: '', atualizadoEm: 9 });
    expect(arm.getItem(CHAVE_APELIDO)).toBe('EU');
    expect(arm.getItem(HANGAR_STORAGE_KEY)).toBe('{"chassis":"vector09"}');
    expect(aplicarMontagem).not.toHaveBeenCalled();
  });

  it('sem armazenamento (aba anônima) lê vazio e aplica o que dá, sem lançar', () => {
    const l = progressoLocalDoJogo({ daily: daily(4, 1, 2), armazem: null });
    expect(l.ler(0)).toMatchObject({ apelido: '', montagem: '', nivel: 4 });
    expect(() => l.aplicar({ apelido: 'ANA', nivel: 9, xp: 0, creditos: 0, montagem: '{}', atualizadoEm: 1 })).not.toThrow();
  });
});

describe('DailyChallenges: snapshot, restore e onSave (a ponte com a conta)', () => {
  it('snapshot devolve nível, XP e créditos; restore aplica e limita (nível >= 1, XP < 1000, créditos >= 0)', () => {
    const dc = new DailyChallenges();
    dc.restore({ nivel: 6, xp: 250, creditos: 1234 });
    // P305: o snapshot leva também as cores compradas (nenhuma, aqui: a de fábrica não conta).
    expect(dc.snapshot()).toEqual({ nivel: 6, xp: 250, creditos: 1234, pinturas: 0 });
    dc.restore({ nivel: 0, xp: 99999, creditos: -50 });
    expect(dc.snapshot()).toEqual({ nivel: 1, xp: 999, creditos: 0, pinturas: 0 });
  });

  it('onSave dispara quando o jogador ganha XP ou créditos, e NÃO quando a conta restaura (não é mudança do jogador)', () => {
    const dc = new DailyChallenges();
    const avisos = vi.fn();
    dc.onSave = avisos;
    dc.addXp(10);
    dc.addCredits(5);
    expect(avisos).toHaveBeenCalledTimes(2);
    avisos.mockClear();
    dc.restore({ nivel: 3, xp: 1, creditos: 1 });
    expect(avisos).not.toHaveBeenCalled();
  });
});
