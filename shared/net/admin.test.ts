import { describe, expect, it } from 'vitest';
import {
  ADMIN_AVALIAR_PATH,
  ADMIN_ESTADO_PATH,
  ADMIN_FECHAR_SALA_PATH,
  ADMIN_HEADER,
  ADMIN_HISTORICO_PATH,
  ADMIN_LOG_PATH,
  ADMIN_PREFIXO,
  ADMIN_REINICIAR_PATH,
  ADMIN_TESTAR_PATH,
  type AdminEstado,
  lerAvaliacao,
  lerErro,
  lerEstado,
  lerHistorico,
  lerLog,
  lerTeste,
} from './admin';
import { METRICAS_HEADER } from './telemetry';

const estado = (): AdminEstado => ({
  protocolo: 16,
  release: 'abc1234',
  iniciadoEm: '2026-10-12T14:00:00.000Z',
  uptimeS: 3600,
  node: 'v22.14.0',
  plataforma: 'win32 x64',
  porta: 2567,
  supervisionado: true,
  memoria: { rssMB: 180.5, heapMB: 60.2 },
  cpuPct: 4.5,
  lacoMs: { medio: 0.4, p99: 2, maximo: 9 },
  conexoes: 3,
  jogadores: 2,
  salas: [{ codigo: 'ARENA', jogadores: 2, bots: 5, tick: 1234, tickMs: 0.8, rodada: 3, restanteS: 120, jogando: true, nomes: ['DAN', 'ANA'] }],
  recusas: { total: 0, ip: 0, taxa: 1 },
  redeKBs: { saida: 14.2, entrada: 6.1 },
  contas: 12,
  reiniciando: false,
});

describe('contrato do painel do servidor', () => {
  it('as rotas moram todas sob /admin/ e o token é o das métricas (um segredo só, na pasta de dados)', () => {
    for (const p of [ADMIN_ESTADO_PATH, ADMIN_HISTORICO_PATH, ADMIN_LOG_PATH, ADMIN_AVALIAR_PATH, ADMIN_TESTAR_PATH, ADMIN_FECHAR_SALA_PATH, ADMIN_REINICIAR_PATH]) expect(p.startsWith(ADMIN_PREFIXO), p).toBe(true);
    expect(new Set([ADMIN_ESTADO_PATH, ADMIN_HISTORICO_PATH, ADMIN_LOG_PATH, ADMIN_AVALIAR_PATH, ADMIN_TESTAR_PATH, ADMIN_FECHAR_SALA_PATH, ADMIN_REINICIAR_PATH]).size).toBe(7);
    expect(ADMIN_HEADER).toBe(METRICAS_HEADER);
  });

  it('lê o estado completo, com o que o servidor manda', () => {
    expect(lerEstado(JSON.parse(JSON.stringify(estado())))).toEqual(estado());
  });

  it('o estado de um servidor sem banco de contas (null) e sem supervisão ainda vale', () => {
    const e = { ...estado(), contas: null, supervisionado: false };
    expect(lerEstado(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });

  it('qualquer campo fora do contrato derruba a leitura inteira: a tela diz "sem resposta", nunca inventa número', () => {
    const quebrar = (mexe: (e: Record<string, unknown>) => void) => {
      const e = JSON.parse(JSON.stringify(estado())) as Record<string, unknown>;
      mexe(e);
      return lerEstado(e);
    };
    expect(quebrar((e) => delete e.uptimeS)).toBeNull();
    expect(quebrar((e) => (e.uptimeS = '3600'))).toBeNull();
    expect(quebrar((e) => (e.cpuPct = Number.NaN))).toBeNull();
    expect(quebrar((e) => (e.memoria = { rssMB: 1 }))).toBeNull();
    expect(quebrar((e) => (e.lacoMs = null))).toBeNull();
    expect(quebrar((e) => (e.salas = 'nenhuma'))).toBeNull();
    expect(quebrar((e) => (e.salas = [{ codigo: 'X' }]))).toBeNull();
    expect(quebrar((e) => (e.salas = [{ ...estado().salas[0]!, nomes: [1] }]))).toBeNull();
    expect(quebrar((e) => (e.release = 7))).toBeNull();
    for (const lixo of [null, undefined, 3, 'estado', [], '<html>erro</html>']) expect(lerEstado(lixo)).toBeNull();
  });

  it('o histórico traz o passo e as amostras; uma amostra torta recusa o histórico inteiro', () => {
    const a = { t: 1700000000, jogadores: 2, salas: 1, tickMs: 0.8, rssMB: 180, cpuPct: 4, saidaKBs: 12, lacoMs: 2 };
    expect(lerHistorico({ passoS: 5, amostras: [a, a] })).toEqual({ passoS: 5, amostras: [a, a] });
    expect(lerHistorico({ passoS: 5, amostras: [] })).toEqual({ passoS: 5, amostras: [] });
    expect(lerHistorico({ passoS: 5, amostras: [{ ...a, tickMs: 'x' }] })).toBeNull();
    expect(lerHistorico({ amostras: [a] })).toBeNull();
    expect(lerHistorico(null)).toBeNull();
  });

  it('o log só aceita a fonte conhecida e linhas de texto', () => {
    expect(lerLog({ fonte: 'arquivo', linhas: ['a', 'b'] })).toEqual({ fonte: 'arquivo', linhas: ['a', 'b'] });
    expect(lerLog({ fonte: 'memoria', linhas: [] })).toEqual({ fonte: 'memoria', linhas: [] });
    expect(lerLog({ fonte: 'rede', linhas: [] })).toBeNull();
    expect(lerLog({ fonte: 'arquivo', linhas: [1] })).toBeNull();
  });

  it('a avaliação e o teste trazem as checagens, com a dica só quando não passou', () => {
    const ch = [{ nome: 'Tick', valor: '1 ms', limite: 'até 2 ms', resultado: 'ok' }, { nome: 'CPU', valor: '90 %', limite: 'até 50 %', resultado: 'falha', dica: 'muito' }];
    const av = { veredito: 'problema', resumo: 'Fora da meta: cpu.', janelaS: 600, checagens: ch, capacidade: { salasPorTick: 4, jogadoresPorSala: 8, jogadoresSimultaneos: 32 } };
    expect(lerAvaliacao(av)).toEqual(av);
    expect(lerAvaliacao({ ...av, veredito: 'otimo' })).toBeNull();
    expect(lerAvaliacao({ ...av, checagens: [{ nome: 'x' }] })).toBeNull();
    expect(lerAvaliacao({ ...av, capacidade: { salasPorTick: 4 } })).toBeNull();
    const t = { ok: false, duracaoS: 9.5, clientes: 4, checagens: ch };
    expect(lerTeste(t)).toEqual(t);
    expect(lerTeste({ ...t, ok: 'sim' })).toBeNull();
    expect(lerTeste({ ...t, checagens: [{ ...ch[0], resultado: 'quase' }] })).toBeNull();
  });

  it('o erro leva a frase e, quando é por haver gente jogando, quantos', () => {
    expect(lerErro({ erro: 'há 2 jogadores', jogadores: 2 })).toEqual({ erro: 'há 2 jogadores', jogadores: 2 });
    expect(lerErro({ erro: 'não' })).toEqual({ erro: 'não' });
    expect(lerErro({ jogadores: 2 })).toBeNull();
    expect(lerErro('erro')).toBeNull();
  });
});
