import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AMOSTRA_CADA_S, type AdminAmostra, type AdminSala } from '../shared/net/admin';
import { ROOM_SIZE } from '../shared/net/constants';
import { Amostrador, Anel, avaliar, capacidadeDeSalas, CODIGO_REINICIO, fimDoArquivo, LimiteDeFalhas, lerFimDoLog, LogEmMemoria, METAS, type Trafego } from './admin';

const amostra = (extra: Partial<AdminAmostra> = {}, i = 0): AdminAmostra => ({
  t: 1_700_000_000 + i * AMOSTRA_CADA_S,
  jogadores: 0,
  salas: 0,
  tickMs: 0,
  rssMB: 120,
  cpuPct: 5,
  saidaKBs: 0,
  lacoMs: 1,
  ...extra,
});
const janela = (n: number, extra: Partial<AdminAmostra> | ((i: number) => Partial<AdminAmostra>) = {}) =>
  Array.from({ length: n }, (_, i) => amostra(typeof extra === 'function' ? extra(i) : extra, i));
const CTX = { uptimeS: 7200, recusasPorTaxa: 0 };

/** Uma pasta de teste dentro do projeto (G15: nada fora dele). */
function pasta(nome: string): string {
  const p = resolve('.tmp', 'admin-teste', nome);
  rmSync(p, { recursive: true, force: true });
  mkdirSync(p, { recursive: true });
  return p;
}

describe('o anel das amostras', () => {
  it('guarda as últimas N, da mais antiga para a mais nova, sem crescer', () => {
    const a = new Anel<number>(3);
    for (const x of [1, 2]) a.push(x);
    expect(a.paraLista()).toEqual([1, 2]);
    for (const x of [3, 4, 5]) a.push(x);
    expect(a.paraLista()).toEqual([3, 4, 5]);
    expect(a.tamanho).toBe(3);
    a.push(6);
    expect(a.paraLista()).toEqual([4, 5, 6]);
  });
});

describe('avaliar: o veredito sobre a última hora', () => {
  it('um servidor tranquilo, com gente jogando dentro das metas, está APTO', () => {
    const r = avaliar(janela(100, { jogadores: 4, salas: 1, tickMs: 0.8, cpuPct: 12, saidaKBs: 4 * 6, lacoMs: 3, rssMB: 140 }), CTX);
    expect(r.veredito).toBe('apto');
    expect(r.checagens.every((c) => c.resultado === 'ok')).toBe(true);
    expect(r.resumo).toMatch(/dentro das metas/);
    expect(r.janelaS).toBeGreaterThanOrEqual(99 * AMOSTRA_CADA_S);
  });

  it('cada meta tem o seu limite: o tick passa de 2 ms (atenção) e de 4 ms (problema)', () => {
    const base = { jogadores: 2, salas: 1, saidaKBs: 10 };
    expect(avaliar(janela(100, { ...base, tickMs: 1.9 }), CTX).veredito).toBe('apto');
    const atencao = avaliar(janela(100, { ...base, tickMs: 3 }), CTX);
    expect(atencao.veredito).toBe('atencao');
    expect(atencao.checagens.find((c) => c.nome.startsWith('Tempo do tick'))).toMatchObject({ resultado: 'atencao' });
    expect(atencao.checagens.find((c) => c.nome.startsWith('Tempo do tick'))!.dica).toBeTruthy();
    const problema = avaliar(janela(100, { ...base, tickMs: 6 }), CTX);
    expect(problema.veredito).toBe('problema');
    expect(problema.resumo).toMatch(/Fora da meta/);
  });

  it('no limite exato da meta ainda é ok, e um pouco acima já é atenção; no limite da falha ainda é atenção', () => {
    const base = { jogadores: 2, salas: 1, saidaKBs: 10 };
    const tick = (ms: number) => avaliar(janela(100, { ...base, tickMs: ms }), CTX).veredito;
    expect([tick(2), tick(2.01), tick(4), tick(4.01)]).toEqual(['apto', 'atencao', 'atencao', 'problema']);
    const laco = (ms: number) => avaliar(janela(100, { lacoMs: ms }), CTX).veredito;
    expect([laco(20), laco(20.5), laco(50), laco(50.5)]).toEqual(['apto', 'atencao', 'atencao', 'problema']);
  });

  it('o tick só conta amostras com sala aberta: uma hora quase toda vazia não esconde o tick de quem jogou', () => {
    // 4 amostras com sala (tick de 3 ms) no meio de 96 vazias: o p95 das salas é 3 ms (atenção); misturadas com as vazias daria 0.
    const r = avaliar(janela(100, (i) => (i < 4 ? { jogadores: 1, salas: 1, tickMs: 3, saidaKBs: 4 } : {})), CTX);
    expect(r.checagens.find((c) => c.nome.startsWith('Tempo do tick'))).toMatchObject({ resultado: 'atencao' });
  });

  it('o atraso do laço, a CPU e a memória também reprovam', () => {
    expect(avaliar(janela(100, { lacoMs: 30 }), CTX).veredito).toBe('atencao');
    expect(avaliar(janela(100, { lacoMs: 80 }), CTX).veredito).toBe('problema');
    expect(avaliar(janela(100, { cpuPct: 65 }), CTX).veredito).toBe('atencao');
    expect(avaliar(janela(100, { cpuPct: 95 }), CTX).veredito).toBe('problema');
    expect(avaliar(janela(100, { rssMB: 400 }), CTX).veredito).toBe('atencao');
    expect(avaliar(janela(100, { rssMB: 700 }), CTX).veredito).toBe('problema');
  });

  it('o download por jogador usa a meta do G11 (8 KB/s): 10 é atenção, 20 é problema; sem jogador, não há o que medir', () => {
    expect(avaliar(janela(100, { jogadores: 4, salas: 1, saidaKBs: 4 * 7 }), CTX).veredito).toBe('apto');
    expect(avaliar(janela(100, { jogadores: 4, salas: 1, saidaKBs: 4 * 10 }), CTX).veredito).toBe('atencao');
    expect(avaliar(janela(100, { jogadores: 4, salas: 1, saidaKBs: 4 * 20 }), CTX).veredito).toBe('problema');
    const vazio = avaliar(janela(100, { jogadores: 0, saidaKBs: 0 }), CTX);
    expect(vazio.checagens.find((c) => c.nome === 'Download por jogador')!.valor).toMatch(/ninguém/);
    expect(vazio.veredito).toBe('apto');
  });

  it('a memória que só sobe é apontada como crescimento por hora (e uma estável não)', () => {
    const sobe = avaliar(janela(240, (i) => ({ rssMB: 100 + i * 2 })), CTX); // +2 MB a cada 5 s = 1.440 MB/h
    expect(sobe.checagens.find((c) => c.nome === 'Crescimento da memória')).toMatchObject({ resultado: 'falha' });
    const estavel = avaliar(janela(240, (i) => ({ rssMB: 150 + (i % 2) })), CTX);
    expect(estavel.checagens.find((c) => c.nome === 'Crescimento da memória')).toMatchObject({ resultado: 'ok' });
    // Janela curta demais: sem conclusão sobre tendência.
    expect(avaliar(janela(15), CTX).checagens.some((c) => c.nome === 'Crescimento da memória')).toBe(false);
  });

  it('logo depois de subir, avisa que ainda é cedo (poucas amostras) em vez de dar um veredito de confiança', () => {
    const r = avaliar(janela(3), { uptimeS: 15, recusasPorTaxa: 0 });
    expect(r.veredito).toBe('atencao');
    expect(r.checagens[0]).toMatchObject({ nome: 'Tempo de observação', resultado: 'atencao' });
    expect(avaliar([], { uptimeS: 1, recusasPorTaxa: 0 }).veredito).toBe('atencao');
  });

  it('quem foi cortado por taxa alta aparece como atenção', () => {
    const r = avaliar(janela(100), { uptimeS: 7200, recusasPorTaxa: 3 });
    expect(r.checagens.find((c) => c.nome === 'Cortes por taxa alta')).toMatchObject({ valor: '3', resultado: 'atencao' });
    expect(r.veredito).toBe('atencao');
  });

  it('os limites estão num lugar só (METAS) e a ordem faz sentido: ok antes de falha', () => {
    for (const k of ['tickMs', 'lacoMs', 'cpuPct', 'rssMB', 'crescimentoMBh', 'kbsPorJogador'] as const) expect(METAS[k].ok, k).toBeLessThan(METAS[k].falha);
    expect(METAS.tickMs.ok).toBe(2); // G14
    expect(METAS.kbsPorJogador.ok).toBe(8); // G11
  });
});

describe('o reinício pelo painel', () => {
  it('sai com um código de erro: é o que faz a tarefa do Windows religar (o código 0 é parar de verdade)', () => {
    expect(CODIGO_REINICIO).toBeGreaterThan(0);
    expect(CODIGO_REINICIO).toBeLessThanOrEqual(255);
    expect(CODIGO_REINICIO).toBe(75);
  });
});

describe('a capacidade (estimativa de CPU)', () => {
  it('quantas salas cabem em metade do tick de 16,7 ms, pelo p95 do tick da pior sala', () => {
    expect(capacidadeDeSalas([1, 1, 1, 1])).toBe(8);
    expect(capacidadeDeSalas([2, 2, 2])).toBe(4);
    expect(capacidadeDeSalas([4])).toBe(2);
    expect(capacidadeDeSalas([9])).toBe(1); // nunca menos de uma
    // Sem medida (sem sala aberta), vale a meta de 2 ms do G14.
    expect(capacidadeDeSalas([])).toBe(4);
    expect(capacidadeDeSalas([0, 0.01])).toBe(4);
  });

  it('vai para o cartão: salas, jogadores por sala e o total', () => {
    const r = avaliar(janela(100, { jogadores: 3, salas: 1, tickMs: 1, saidaKBs: 18 }), CTX);
    expect(r.capacidade).toEqual({ salasPorTick: 8, jogadoresPorSala: ROOM_SIZE, jogadoresSimultaneos: 8 * ROOM_SIZE });
  });
});

describe('o fim do log', () => {
  it('lê só o fim de um arquivo grande e começa numa linha inteira', () => {
    const dir = pasta('fim');
    const arq = join(dir, 'grande.log');
    const linhas = Array.from({ length: 5000 }, (_, i) => `linha ${String(i).padStart(5, '0')} com algum texto para encher`);
    writeFileSync(arq, linhas.join('\n') + '\n');
    const fim = fimDoArquivo(arq, 2000)!;
    expect(fim.length).toBeLessThanOrEqual(2000);
    expect(fim.startsWith('linha ')).toBe(true);
    expect(fim.trimEnd().endsWith('linha 04999 com algum texto para encher')).toBe(true);
    expect(fimDoArquivo(join(dir, 'nao-existe.log'))).toBeNull();
    writeFileSync(join(dir, 'curto.log'), 'só isto\n');
    expect(fimDoArquivo(join(dir, 'curto.log'))).toBe('só isto\n');
  });

  it('usa o servidor.log da tarefa (com \\r\\n do Windows, sem o ruído do SQLite) ou, sem ele, a memória', () => {
    const dir = pasta('log');
    writeFileSync(join(dir, 'servidor.log'), '(node:1) ExperimentalWarning: SQLite is an experimental feature and might change at any time\r\n(Use `node --trace-warnings ...` to show where the warning was created)\r\n[servidor] sala ARENA aberta\r\n[sala ARENA] 2 jogador(es)\r\n');
    const l = lerFimDoLog(dir, ['da memória']);
    expect(l.fonte).toBe('arquivo');
    expect(l.linhas).toEqual(['[servidor] sala ARENA aberta', '[sala ARENA] 2 jogador(es)']);
    const m = lerFimDoLog(join(dir, 'outra'), ['a', 'b']);
    expect(m).toEqual({ fonte: 'memoria', linhas: ['a', 'b'] });
    expect(lerFimDoLog(null, ['x']).fonte).toBe('memoria');
  });

  it('o log em memória guarda as últimas 300 linhas, com a hora', () => {
    const m = new LogEmMemoria();
    for (let i = 0; i < 350; i++) m.registrar(`linha ${i}`);
    const l = m.linhas();
    expect(l).toHaveLength(300);
    expect(l[0]).toMatch(/^\d\d:\d\d:\d\d linha 50$/);
    expect(l.at(-1)).toMatch(/linha 349$/);
  });

  it('a hora do log é a do relógio da máquina, com dois dígitos (não o UTC)', () => {
    const m = new LogEmMemoria();
    m.registrar('de manhã', new Date(2026, 9, 12, 7, 5, 9));
    m.registrar('à noite', new Date(2026, 9, 12, 20, 1, 31));
    expect(m.linhas()).toEqual(['07:05:09 de manhã', '20:01:31 à noite']);
  });
});

describe('a régua de erros de token', () => {
  it('só os erros contam: depois de 10 em 10 min o IP é barrado, e outro IP não é afetado', () => {
    const l = new LimiteDeFalhas(10, 600_000);
    for (let i = 0; i < 9; i++) l.falhou('1.1.1.1', 1000 + i);
    expect(l.bloqueado('1.1.1.1', 2000)).toBe(false);
    l.falhou('1.1.1.1', 2001);
    expect(l.bloqueado('1.1.1.1', 2002)).toBe(true);
    expect(l.bloqueado('2.2.2.2', 2002)).toBe(false);
    // Passada a janela, volta a poder tentar.
    expect(l.bloqueado('1.1.1.1', 1000 + 600_001)).toBe(false);
  });
});

describe('o amostrador', () => {
  const sala = (jogadores: number, tickMs: number): { resumo(): AdminSala; humanCount: number } => ({
    humanCount: jogadores,
    resumo: () => ({ codigo: 'X', jogadores, bots: 3, tick: 1, tickMs, rodada: 1, restanteS: 100, jogando: true, nomes: [] }),
  });

  it('uma amostra soma os jogadores, pega o pior tick, converte os bytes em KB/s e zera os contadores', () => {
    const trafego: Trafego = { saidaBytes: 0, entradaBytes: 0 };
    const a = new Amostrador({ salas: () => [sala(2, 0.6), sala(1, 1.4)] }, trafego, () => 1_700_000_000_000);
    try {
      a.amostrar(); // abre o intervalo
      trafego.saidaBytes = 50_000;
      trafego.entradaBytes = 10_000;
      const m = a.amostrar();
      expect(m).toMatchObject({ t: 1_700_000_000, jogadores: 3, salas: 2, tickMs: 1.4 });
      expect(m.saidaKBs).toBeGreaterThan(0);
      expect(m.rssMB).toBeGreaterThan(10);
      expect(m.cpuPct).toBeGreaterThanOrEqual(0);
      expect(trafego).toEqual({ saidaBytes: 0, entradaBytes: 0 });
      expect(a.redeKBs.saida).toBeGreaterThan(a.redeKBs.entrada);
      const h = a.historico();
      expect(h.passoS).toBe(AMOSTRA_CADA_S);
      expect(h.amostras).toHaveLength(2);
    } finally {
      a.parar();
    }
  });

  it('guarda uma hora (720 amostras) e descarta as mais velhas', () => {
    const a = new Amostrador({ salas: () => [] }, { saidaBytes: 0, entradaBytes: 0 });
    try {
      for (let i = 0; i < 730; i++) a.amostrar();
      expect(a.historico().amostras).toHaveLength(720);
    } finally {
      a.parar();
    }
  });
});
