import { describe, expect, it } from 'vitest';
import type { AdminAmostra } from '../../../shared/net/admin';
import { caminhoDoGrafico, duracao, horaDaVisita, linhaDaSala, linhaDaVisita, nivelContraMeta, nomeDoMapa, num, serie, textoDoMotivo, voltou } from './serverData';

describe('janela do servidor: as contas da tela', () => {
  it('a duração em palavras: segundos, minutos, horas e dias', () => {
    expect(duracao(0)).toBe('0 s');
    expect(duracao(45)).toBe('45 s');
    expect(duracao(60)).toBe('1 min');
    expect(duracao(3599)).toBe('59 min');
    expect(duracao(3600)).toBe('1 h');
    expect(duracao(3 * 3600 + 12 * 60)).toBe('3 h 12 min');
    expect(duracao(47 * 3600)).toBe('47 h');
    expect(duracao(47 * 3600 + 59 * 60)).toBe('47 h 59 min');
    expect(duracao(48 * 3600)).toBe('2 d 0 h');
    expect(duracao(50 * 3600)).toBe('2 d 2 h');
    expect(duracao(-5)).toBe('0 s');
  });

  it('número com vírgula decimal; o que não é número vira um traço, nunca "NaN"', () => {
    expect(num(1.456)).toBe('1,5');
    expect(num(1.456, 2)).toBe('1,46');
    expect(num(12, 0)).toBe('12');
    expect(num(Number.NaN)).toBe('—');
    expect(num(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('o gráfico: a caixa, o teto do eixo, a área e a meta só quando cabe', () => {
    const g = caminhoDoGrafico([0, 5, 10], 100, 50);
    expect(g.linha).toBe('M0.0,50.0 L50.0,27.3 L100.0,4.5'); // teto = 11 (o maior vezes 1,1)
    expect(g.area).toBe(`${g.linha} L100.0,50 L0,50 Z`);
    expect(g.max).toBeCloseTo(11, 5);
    expect(g.yDaMeta).toBeNull();
    // Com meta perto do dado, o teto sobe para ela caber e a linha da meta aparece dentro da caixa.
    const m = caminhoDoGrafico([1, 1.5, 1.8], 100, 40, { meta: 2 });
    expect(m.max).toBeGreaterThanOrEqual(2);
    expect(m.yDaMeta).not.toBeNull();
    expect(m.yDaMeta!).toBeGreaterThan(0);
    expect(m.yDaMeta!).toBeLessThan(40);
    // A meta só sobe o teto quando o dado chega perto dela (a partir de 40%); longe, o eixo fica no dado e a meta não aparece.
    const longe = caminhoDoGrafico([1, 1], 100, 40, { meta: 10 });
    expect(longe.max).toBeCloseTo(1.1, 5);
    expect(longe.yDaMeta).toBeNull();
    const perto = caminhoDoGrafico([5, 5], 100, 40, { meta: 10 });
    expect(perto.max).toBeCloseTo(12, 5);
    expect(perto.yDaMeta).not.toBeNull();
    // Dado minúsculo não estica o eixo à toa: o piso segura.
    const quase = caminhoDoGrafico([0.01, 0.02], 100, 40, { piso: 4, meta: 2 });
    expect(quase.max).toBe(4);
    expect(quase.yDaMeta).toBe(20);
  });

  it('o gráfico sem dados, com um dado só ou com lixo não quebra (linha no chão)', () => {
    expect(caminhoDoGrafico([], 100, 40).linha).toBe('M0.0,40.0 L100.0,40.0');
    expect(caminhoDoGrafico([7], 100, 40).linha).toMatch(/^M100\.0,/);
    expect(caminhoDoGrafico([Number.NaN, -3, Number.POSITIVE_INFINITY], 100, 40).linha).toBe('M0.0,40.0 L50.0,40.0 L100.0,40.0');
  });

  it('as séries do histórico saem na ordem do tempo', () => {
    const a = (t: number, jogadores: number): AdminAmostra => ({ t, jogadores, salas: 1, tickMs: 0.5, rssMB: 100, cpuPct: 2, saidaKBs: 5, lacoMs: 1 });
    expect(serie([a(1, 0), a(2, 3), a(3, 1)], 'jogadores')).toEqual([0, 3, 1]);
    expect(serie([], 'tickMs')).toEqual([]);
  });

  it('cada motivo de falha tem a sua frase, e a do servidor vale quando ele deu uma', () => {
    for (const m of ['sem-servidor', 'sem-token', 'token', 'bloqueado', 'fora-do-ar', 'resposta', 'recusado'] as const) expect(textoDoMotivo(m).length, m).toBeGreaterThan(20);
    expect(textoDoMotivo('recusado', { erro: 'há 2 jogadores jogando', jogadores: 2 })).toBe('há 2 jogadores jogando');
    expect(textoDoMotivo('resposta')).toMatch(/versão sem as rotas/);
    expect(textoDoMotivo('token')).toMatch(/metricas-token\.txt/);
  });

  it('o nome do mapa de uma sala pela chave dela (a Cidade Neon não leva sufixo)', () => {
    expect(nomeDoMapa('ARENA')).toBe('CIDADE NEON');
    expect(nomeDoMapa('ARENA@praia')).toBe('ESTAÇÃO DE CABOS');
    expect(nomeDoMapa('RIO-2@amazonia')).toBe('TERRAS RARAS');
    expect(nomeDoMapa('X@janeiro')).toBe('8 DE JANEIRO');
    expect(nomeDoMapa('X@lua')).toBe('CIDADE NEON'); // chave torta não derruba o painel
  });

  it('a linha de uma sala e o nível contra a meta', () => {
    expect(linhaDaSala({ codigo: 'ARENA', jogadores: 2, bots: 5, rodada: 3, restanteS: 125, jogando: true })).toBe('ARENA · 2 jogando · 5 bots · rodada 3, 2:05');
    expect(linhaDaSala({ codigo: 'A-2', jogadores: 0, bots: 3, rodada: 1, restanteS: 0, jogando: false })).toMatch(/intervalo/);
    expect(nivelContraMeta(1.9, 2)).toBe('ok');
    expect(nivelContraMeta(2.5, 2)).toBe('atencao');
    expect(nivelContraMeta(3.1, 2)).toBe('falha');
    // As fronteiras são da meta (inclusive) e de 1,5 vezes a meta (inclusive).
    expect([nivelContraMeta(8, 8), nivelContraMeta(8.01, 8), nivelContraMeta(12, 8), nivelContraMeta(12.01, 8)]).toEqual(['ok', 'atencao', 'atencao', 'falha']);
  });

  it('voltou: só quando responde e o uptime é menor que o de antes do pedido', () => {
    expect(voltou(3600, 12)).toBe(true);
    expect(voltou(3600, 3700)).toBe(false);
    expect(voltou(3600, 3600)).toBe(false); // o mesmo uptime é o mesmo processo, não uma volta
    expect(voltou(3600, null)).toBe(false);
  });
});

describe('janela do servidor: quem entrou (P275)', () => {
  const AGORA = new Date(2026, 9, 29, 12, 0, 0).getTime(); // 29/10/2026 12:00, no fuso de quem roda o teste
  const em = (dia: number, h: number, min: number) => new Date(2026, 9, dia, h, min, 0).toISOString();

  it('a hora de hoje é só "10:21"; a de outro dia leva o dia e o mês; o que não é data vira um traço', () => {
    expect(horaDaVisita(em(29, 10, 21), AGORA)).toBe('10:21');
    expect(horaDaVisita(em(28, 21, 5), AGORA)).toBe('28/10 21:05');
    expect(horaDaVisita('ontem', AGORA)).toBe('—');
  });

  it('a linha de uma visita: quando entrou, o apelido, a conta com o e-mail mascarado, onde (a sala e o mapa) e quanto ficou; quem está dentro diz "na sala agora"', () => {
    const base = { apelido: 'ALFA', conta: { id: 7, rotulo: 'p***@x.com' }, sala: 'ARENA', mapa: 'arena', entrouEm: em(29, 10, 21), saiuEm: em(29, 10, 55) };
    expect(linhaDaVisita(base, AGORA)).toEqual({ quando: '10:21', quem: 'ALFA', conta: 'p***@x.com (conta 7)', onde: 'ARENA · CIDADE NEON', ficou: '34 min' });
    const convidado = linhaDaVisita({ ...base, conta: null, saiuEm: null, mapa: 'praia' }, AGORA);
    expect(convidado.conta).toBeNull();
    expect(convidado.ficou).toBe('na sala agora');
    expect(convidado.onde).toMatch(/^ARENA · /);
  });
});
