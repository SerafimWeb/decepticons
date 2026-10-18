import { describe, expect, it } from 'vitest';
import type { OnlineStatus } from '../net/OnlineSession';
import { OFFLINE_DEPOIS_DE_MS, relogioProgressivo, relogioRegressivo, textoDoAviso } from './avisoDeConexao';

/** As frases da tela de "servidor reiniciando / conexão perdida" (P204): cada situação diz a verdade que o jogador precisa e conta o tempo certo. */
const AGORA = 1_000_000;
const base = (o: Partial<OnlineStatus>): OnlineStatus => ({ state: 'na sala', room: 'ARENA', rttMs: 20, players: 1, ...o });

describe('os relógios', () => {
  it('a contagem regressiva arredonda para cima (o último segundo é 0:01) e a progressiva para baixo', () => {
    expect(relogioRegressivo(59_001)).toBe('1:00');
    expect(relogioRegressivo(1)).toBe('0:01');
    expect(relogioRegressivo(0)).toBe('0:00');
    expect(relogioRegressivo(-5000)).toBe('0:00');
    expect(relogioProgressivo(61_999)).toBe('1:01');
    expect(relogioProgressivo(999)).toBe('0:00');
  });
});

describe('o aviso de reinício (ainda conectado)', () => {
  it('conta até o corte e diz em quantos minutos volta (arredondado para cima, no mínimo 1)', () => {
    const a = textoDoAviso(base({ aviso: { cortaEm: AGORA + 8_400, voltaEmS: 60 } }), AGORA)!;
    expect(a.tom).toBe('aviso');
    expect(a.contador).toBe('0:09');
    expect(a.linha).toContain('1 min');
    expect(textoDoAviso(base({ aviso: { cortaEm: AGORA + 1000, voltaEmS: 100 } }), AGORA)!.linha).toContain('2 min');
    expect(textoDoAviso(base({ aviso: { cortaEm: AGORA + 1000, voltaEmS: 5 } }), AGORA)!.linha).toContain('1 min');
    expect(a.podeJogarOffline).toBe(false);
  });

  it('sem aviso e conectado, a tela não aparece', () => {
    expect(textoDoAviso(base({}), AGORA)).toBeNull();
  });
});

describe('o reinício que já cortou (previsão de volta)', () => {
  const queda = (previsto: number | null, desde = AGORA - 10_000) => base({ state: 'reconectando', tentativa: 3, de: 6, queda: { desde, previsto } });

  it('antes da previsão: "servidor reiniciando" com o contador descendo', () => {
    const a = textoDoAviso(queda(AGORA + 42_000), AGORA)!;
    expect(a.tom).toBe('espera');
    expect(a.titulo).toBe('SERVIDOR REINICIANDO');
    expect(a.contador).toBe('0:42');
    expect(a.podeJogarOffline).toBe(false);
  });

  it('passou da previsão: "demorando mais que o previsto", conta o tempo fora e, depois de 30 s fora, oferece o offline', () => {
    const cedo = textoDoAviso(queda(AGORA - 1, AGORA - 20_000), AGORA)!;
    expect(cedo.titulo).toBe('DEMORANDO MAIS QUE O PREVISTO');
    expect(cedo.contador).toBe('0:20');
    expect(cedo.podeJogarOffline).toBe(false);
    const tarde = textoDoAviso(queda(AGORA - 1, AGORA - OFFLINE_DEPOIS_DE_MS), AGORA)!;
    expect(tarde.podeJogarOffline).toBe(true);
  });
});

describe('a queda sem aviso (sem previsão)', () => {
  const queda = (foraMs: number) => base({ state: 'reconectando', queda: { desde: AGORA - foraMs, previsto: null } });

  it('nos primeiros segundos é só "tentando reconectar"; depois diz que não há previsão; o contador sobe', () => {
    const a = textoDoAviso(queda(5_000), AGORA)!;
    expect(a.tom).toBe('queda');
    expect(a.linha).toBe('Tentando reconectar…');
    expect(a.contador).toBe('0:05');
    expect(a.podeJogarOffline).toBe(false);
    const b = textoDoAviso(queda(45_000), AGORA)!;
    expect(b.linha).toContain('sem previsão');
    expect(b.contador).toBe('0:45');
    expect(b.podeJogarOffline).toBe(true);
  });
});

describe('quando a insistência acaba', () => {
  it('"caiu" depois de ter jogado: só resta recarregar (e o offline está à mão)', () => {
    const a = textoDoAviso(base({ state: 'caiu', queda: { desde: AGORA - 600_000, previsto: null } }), AGORA)!;
    expect(a.tom).toBe('fim');
    expect(a.contador).toBeNull();
    expect(a.podeJogarOffline).toBe(true);
  });

  it('"caiu" de quem nunca entrou (sem queda) não ganha esta tela: o jogo volta ao offline sozinho', () => {
    expect(textoDoAviso(base({ state: 'caiu' }), AGORA)).toBeNull();
  });

  it('conectando, recusado e reconectando sem queda (nunca entrou) também não', () => {
    for (const state of ['conectando', 'recusado', 'reconectando'] as const) expect(textoDoAviso(base({ state }), AGORA)).toBeNull();
  });
});
