import { describe, expect, it, vi } from 'vitest';
import {
  BRIEFING_DA_MISSAO_S,
  MISSAO_MAX_ANDROIDS,
  MISSAO_MAX_MECHS,
  MISSOES_DE_COMBATE,
  MissaoDeCombate,
  type DesfechoDaMissao,
  type EstatisticasDaMissao,
  type PlanoDeMissao,
} from './MissaoDeCombate';

const DT = 1 / 60;

/** Uma missão com o `onRoster` e os avisos espionados. */
function missao(tipo: keyof typeof MISSOES_DE_COMBATE) {
  const onRoster = vi.fn();
  const onStart = vi.fn();
  const onProgresso = vi.fn();
  const onFim = vi.fn<(desfecho: DesfechoDaMissao, stats: EstatisticasDaMissao) => void>();
  const m = new MissaoDeCombate(MISSOES_DE_COMBATE[tipo], { onRoster, onStart, onProgresso, onFim });
  /** Anda o relógio `s` segundos, com o jogador vivo. */
  const passa = (s: number, vivo = true) => {
    for (let i = 0; i < Math.round(s / DT); i++) m.fixedUpdate(DT, vivo);
  };
  /** Passa o briefing: a missão larga e o elenco entra. */
  const larga = () => passa(BRIEFING_DA_MISSAO_S + DT);
  return { m, onRoster, onStart, onProgresso, onFim, passa, larga };
}

describe('os planos da missão de combate (P314)', () => {
  it('cabem no pool de inimigos: até 3 Mechs e 3 andróides, e os alvos marcados são Mechs do elenco', () => {
    for (const plano of Object.values(MISSOES_DE_COMBATE) as PlanoDeMissao[]) {
      expect(plano.mechs).toBeLessThanOrEqual(MISSAO_MAX_MECHS);
      expect(plano.androids).toBeLessThanOrEqual(MISSAO_MAX_ANDROIDS);
      expect(plano.limiteS).toBeGreaterThan(0);
      if (!plano.exterminio) expect(plano.alvos).toBeLessThanOrEqual(plano.mechs);
    }
  });

  it('a aniquilação exige todo o elenco; a caça um alvo; a destruição três Mechs', () => {
    expect(MISSOES_DE_COMBATE.caca.alvos).toBe(1);
    expect(MISSOES_DE_COMBATE.destruicao.alvos).toBe(3);
    expect(MISSOES_DE_COMBATE.aniquilacao.alvos).toBe(MISSOES_DE_COMBATE.aniquilacao.mechs + MISSOES_DE_COMBATE.aniquilacao.androids);
  });
});

describe('a largada e o briefing', () => {
  it('antes da largada nada conta: o elenco não entra e um abate não vale', () => {
    const { m, onRoster, onStart, passa } = missao('caca');
    expect(m.fase).toBe('briefing');
    expect(m.recordEnemyKilled(true)).toBe(false);
    expect(m.abates).toBe(0);
    passa(BRIEFING_DA_MISSAO_S / 2);
    expect(onRoster).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });

  it('depois do briefing a missão larga: o elenco do plano entra e o aviso de largada sai uma vez', () => {
    const { m, onRoster, onStart, larga } = missao('destruicao');
    larga();
    expect(m.fase).toBe('ativa');
    expect(onRoster).toHaveBeenCalledWith(MISSOES_DE_COMBATE.destruicao);
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe('caça: derrube o alvo marcado', () => {
  it('um escolta caído não cumpre a caça', () => {
    const { m, larga } = missao('caca');
    larga();
    expect(m.recordEnemyKilled(false)).toBe(false);
    expect(m.fase).toBe('ativa');
    expect(m.alvosCaidos).toBe(0);
  });

  it('o alvo marcado caído cumpre a missão, com o desfecho "cumprida"', () => {
    const { m, onFim, larga, passa } = missao('caca');
    larga();
    passa(20);
    expect(m.recordEnemyKilled(true)).toBe(true);
    expect(m.fase).toBe('cumprida');
    expect(onFim).toHaveBeenCalledTimes(1);
    const [desfecho, stats] = onFim.mock.calls[0]!;
    expect(desfecho).toBe('cumprida');
    expect(stats.segundos).toBeCloseTo(20, 1);
    expect(stats.alvosCaidos).toBe(1);
  });
});

describe('destruição: os três Mechs marcados', () => {
  it('dois alvos caídos ainda não bastam; o terceiro cumpre, e os andróides nunca contam', () => {
    const { m, larga } = missao('destruicao');
    larga();
    expect(m.recordEnemyKilled(false)).toBe(false); // andróide: não é alvo
    expect(m.recordEnemyKilled(true)).toBe(false);
    expect(m.recordEnemyKilled(true)).toBe(false);
    expect(m.fase).toBe('ativa');
    expect(m.recordEnemyKilled(true)).toBe(true);
    expect(m.fase).toBe('cumprida');
    expect(m.abates).toBe(4);
  });
});

describe('aniquilação: nenhum inimigo de pé', () => {
  it('qualquer inimigo conta, e a missão só cumpre quando o elenco inteiro cai', () => {
    const { m, larga } = missao('aniquilacao');
    larga();
    for (let i = 0; i < MISSOES_DE_COMBATE.aniquilacao.alvos - 1; i++) {
      expect(m.ehAlvo(i)).toBe(true);
      expect(m.recordEnemyKilled(true)).toBe(false);
    }
    expect(m.fase).toBe('ativa');
    expect(m.recordEnemyKilled(true)).toBe(true);
    expect(m.fase).toBe('cumprida');
  });
});

describe('quem é alvo marcado (ehAlvo)', () => {
  it('a caça marca só o primeiro Mech; a destruição, os três primeiros; a aniquilação, todos', () => {
    const caca = missao('caca').m;
    expect([caca.ehAlvo(0), caca.ehAlvo(1), caca.ehAlvo(-1)]).toEqual([true, false, false]);
    const destruicao = missao('destruicao').m;
    expect([destruicao.ehAlvo(2), destruicao.ehAlvo(3)]).toEqual([true, false]);
    const aniquilacao = missao('aniquilacao').m;
    expect(aniquilacao.ehAlvo(5)).toBe(true);
  });
});

describe('o prazo e a derrota', () => {
  it('o prazo acaba antes do objetivo: derrota por tempo, com o elenco desligado', () => {
    const { m, onRoster, onFim, larga, passa } = missao('caca');
    larga();
    passa(MISSOES_DE_COMBATE.caca.limiteS + 1);
    expect(m.fase).toBe('falhou');
    expect(onFim.mock.calls[0]![0]).toBe('tempo');
    expect(onRoster).toHaveBeenLastCalledWith(null);
  });

  it('o jogador cai no meio da missão: derrota por morte', () => {
    const { m, onFim, larga, passa } = missao('destruicao');
    larga();
    passa(5);
    passa(DT, false);
    expect(m.fase).toBe('falhou');
    expect(onFim.mock.calls[0]![0]).toBe('morte');
  });

  it('o restante conta para baixo e o aviso de progresso sai durante a ação', () => {
    const { m, onProgresso, larga, passa } = missao('caca');
    larga();
    passa(30);
    expect(m.restanteS).toBeCloseTo(MISSOES_DE_COMBATE.caca.limiteS - 30, 1);
    expect(onProgresso).toHaveBeenCalled();
    const ultimo = onProgresso.mock.calls.at(-1)!;
    expect(ultimo[1]).toBe(MISSOES_DE_COMBATE.caca.alvos);
  });
});

describe('depois do fim, nada mais conta', () => {
  it('um abate ou um tick depois de acabar não muda o desfecho nem avisa de novo', () => {
    const { m, onFim, larga, passa } = missao('caca');
    larga();
    m.recordEnemyKilled(true);
    passa(10);
    m.recordEnemyKilled(true);
    m.recordDamage(500);
    expect(onFim).toHaveBeenCalledTimes(1);
    expect(m.danoCausado).toBe(0);
    expect(m.terminou).toBe(true);
  });
});

describe('o dano e o recomeço', () => {
  it('o dano só conta durante a ação', () => {
    const { m, larga } = missao('caca');
    m.recordDamage(100); // no briefing
    larga();
    m.recordDamage(250);
    m.recordDamage(-40);
    expect(m.danoCausado).toBe(250);
  });

  it('reset devolve a missão ao briefing, zera o que foi contado e tira o elenco', () => {
    const { m, onRoster, larga, passa } = missao('destruicao');
    larga();
    passa(10);
    m.recordEnemyKilled(true);
    m.recordDamage(300);
    m.reset();
    expect(m.fase).toBe('briefing');
    expect([m.abates, m.alvosCaidos, m.danoCausado, m.segundos]).toEqual([0, 0, 0, 0]);
    expect(onRoster).toHaveBeenLastCalledWith(null);
  });
});
