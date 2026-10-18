import { afterEach, describe, expect, it } from 'vitest';
import { Contas, diaMais, type MetricasUsuarios } from './contas';
import { diaDe } from './telemetria';

describe('Contas (SQLite embutido do Node)', () => {
  let contas: Contas;
  afterEach(() => contas?.close());
  const nova = () => (contas = new Contas(':memory:'));

  it('cria uma conta e autentica com a senha certa', async () => {
    nova();
    const r = await contas.criar('dan@x.com', 'senhasegura');
    expect(r.ok).toBe(true);
    const conta = await contas.autenticar('dan@x.com', 'senhasegura');
    expect(conta?.email).toBe('dan@x.com');
  });

  it('senha errada não autentica', async () => {
    nova();
    await contas.criar('dan@x.com', 'senhasegura');
    expect(await contas.autenticar('dan@x.com', 'senhaerrada')).toBeNull();
  });

  it('e-mail que não existe não autentica (e não lança)', async () => {
    nova();
    expect(await contas.autenticar('ninguem@x.com', 'qualquercoisa')).toBeNull();
  });

  it('não deixa criar duas contas com o mesmo e-mail', async () => {
    nova();
    await contas.criar('dan@x.com', 'senhasegura');
    const r = await contas.criar('dan@x.com', 'outrasenha');
    expect(r).toEqual({ ok: false, motivo: 'existe' });
  });

  it('a senha nunca fica em texto no banco', async () => {
    nova();
    await contas.criar('dan@x.com', 'senhasegura');
    // Acesso direto ao banco (só no teste) para confirmar que o valor gravado não é a senha crua.
    const row = (contas as unknown as { db: { prepare: (s: string) => { get: (e: string) => { hash: string } } } }).db
      .prepare('SELECT hash FROM contas WHERE email = ?')
      .get('dan@x.com');
    expect(row.hash).not.toContain('senhasegura');
    expect(row.hash).toMatch(/^[0-9a-f]+$/);
  });

  it('sessão: criar, validar e encerrar', async () => {
    nova();
    const r = await contas.criar('dan@x.com', 'senhasegura');
    if (!r.ok) throw new Error('deveria ter criado');
    const token = contas.criarSessao(r.conta.id);
    expect(contas.validarSessao(token)?.email).toBe('dan@x.com');
    contas.encerrarSessao(token);
    expect(contas.validarSessao(token)).toBeNull();
  });

  it('token inventado não valida nada', async () => {
    nova();
    expect(contas.validarSessao('token-que-nao-existe')).toBeNull();
  });

  it('encerrar uma sessão que não existe não lança (idempotente)', () => {
    nova();
    expect(() => contas.encerrarSessao('nada-aqui')).not.toThrow();
  });

  it('limparExpiradas tira só o que já venceu', async () => {
    nova();
    const r = await contas.criar('dan@x.com', 'senhasegura');
    if (!r.ok) throw new Error('deveria ter criado');
    const token = contas.criarSessao(r.conta.id);
    expect(contas.limparExpiradas()).toBe(0); // recém-criada, não venceu
    expect(contas.validarSessao(token)).not.toBeNull();
  });
});

describe('métricas dos pilotos com conta (P185): quem entra, quem joga, por quanto tempo, quem volta', () => {
  let contas: Contas;
  afterEach(() => contas?.close());
  /** "Hoje" é 18/10/2026, meio-dia em Brasília (15:00 UTC): os dias contam no horário de Brasília, como o resto do servidor. */
  const HOJE = Date.UTC(2026, 9, 18, 15, 0);
  const em = (dia: string, horaUtc = 12) => Date.parse(`${dia}T${String(horaUtc).padStart(2, '0')}:00:00Z`);
  async function conta(email: string, quando: number, comSessao = true): Promise<number> {
    const r = await contas.criar(email, 'senhasegura', quando);
    if (!r.ok) throw new Error('deveria ter criado');
    if (comSessao) contas.criarSessao(r.conta.id, quando);
    return r.conta.id;
  }

  /**
   * O cenário: A criou a conta em 10/10, voltou em 11/10 e em 17/10 e jogou em 17 e 18; B criou em 10/10 e nunca voltou; C criou em 16/10 e voltou em 17/10; D criou às 23h30 de Brasília de 17/10
   * (02:30 UTC de 18/10: a virada do dia no fuso) e voltou hoje; E é uma conta recente mas de antes da medição (25/09, sem nenhuma atividade: não pode entrar na retenção) e V uma conta velha (agosto, fora das janelas de 30 dias).
   */
  async function cenario(): Promise<MetricasUsuarios> {
    contas = new Contas(':memory:');
    await conta('v@x.com', em('2026-08-01'), false);
    await conta('e@x.com', em('2026-09-25'), false);
    const a = await conta('a@x.com', em('2026-10-10'));
    await conta('b@x.com', em('2026-10-10'));
    const c = await conta('c@x.com', em('2026-10-16'));
    const d = await conta('d@x.com', Date.UTC(2026, 9, 18, 2, 30));
    contas.registrarVisita(a, em('2026-10-11'));
    contas.registrarPartida(a, { segundos: 600, abates: 3, mortes: 1 }, em('2026-10-17', 20));
    contas.registrarPartida(a, { segundos: 300, abates: 2, mortes: 0 }, HOJE);
    contas.registrarVisita(c, em('2026-10-17'));
    contas.registrarVisita(d, HOJE);
    return contas.metricasUsuarios(HOJE);
  }

  it('conta quem abriu o jogo e quem jogou de fato, hoje, em 7 e em 30 dias (entrar sem jogar não é jogar)', async () => {
    const m = await cenario();
    expect(m.contas).toBe(6);
    expect(m.ativos).toEqual({ dia: 2, semana: 3, mes: 4 }); // hoje: A e D; 7 dias: + C; 30 dias: + B
    expect(m.jogaram).toEqual({ dia: 1, semana: 1, mes: 1 }); // só A tem rodada
  });

  it('os minutos por piloto são dos que jogaram (não de quem só entrou) e o dia a dia soma abates, mortes e rodadas', async () => {
    const m = await cenario();
    expect(m.minutosPorJogador).toBe(15); // 900 s de A = 15 min, divididos por 1 piloto que jogou
    const dia17 = m.porDia.find((d) => d.dia === '2026-10-17')!;
    expect(dia17).toEqual({ dia: '2026-10-17', ativos: 3, jogaram: 1, minutos: 10, partidas: 1, abates: 3, mortes: 1 }); // A, C e D (D nasceu às 23h30 daquele dia)
    const hoje = m.porDia.find((d) => d.dia === '2026-10-18')!;
    expect(hoje).toEqual({ dia: '2026-10-18', ativos: 2, jogaram: 1, minutos: 5, partidas: 1, abates: 2, mortes: 0 });
    expect(m.porDia.map((d) => d.dia)).toEqual([...m.porDia.map((d) => d.dia)].sort());
  });

  it('a retenção D1 e D7: das contas criadas depois de a medição começar, quantas abriram o jogo de novo N dias depois (só coortes cujo dia já passou)', async () => {
    const m = await cenario();
    expect(m.desde).toBe('2026-10-10');
    // D1: A (voltou 11/10), B (não), C (voltou 17/10), D (voltou hoje) = 3 de 4. E (25/09), criada antes de a medição começar, fica de fora: sem atividade registrada ela contaria como "não voltou".
    expect(m.retencao.d1).toEqual({ coorte: 4, voltaram: 3 });
    // D7: só entram as criadas até 11/10 (a de 16/10 ainda não fez 7 dias): A voltou em 17/10, B não.
    expect(m.retencao.d7).toEqual({ coorte: 2, voltaram: 1 });
  });

  it('a retenção é do dia exato (D1 = o dia seguinte, D7 = o sétimo), não de "voltou algum dia depois"', async () => {
    contas = new Contas(':memory:');
    const criada = em('2026-10-10');
    const x = await conta('x@x.com', criada); // voltou só no 7º dia
    const y = await conta('y@x.com', criada); // voltou no dia seguinte e no 4º dia
    const z = await conta('z@x.com', criada); // voltou só no 3º dia
    contas.registrarVisita(x, em('2026-10-17'));
    contas.registrarVisita(y, em('2026-10-11'));
    contas.registrarVisita(y, em('2026-10-14'));
    contas.registrarVisita(z, em('2026-10-13'));
    const m = contas.metricasUsuarios(HOJE);
    expect(m.retencao.d1).toEqual({ coorte: 3, voltaram: 1 }); // só y
    expect(m.retencao.d7).toEqual({ coorte: 3, voltaram: 1 }); // só x
  });

  it('as contas novas por dia caem no dia de Brasília, inclusive na virada às 03:00 UTC', async () => {
    const m = await cenario();
    expect(m.novasPorDia).toEqual({ '2026-09-25': 1, '2026-10-10': 2, '2026-10-16': 1, '2026-10-17': 1 }); // D (02:30 UTC de 18/10) é de 17/10; V (agosto) está fora dos 30 dias
    contas.close();
    contas = new Contas(':memory:');
    await conta('antes@x.com', Date.parse('2026-10-18T02:59:59.999Z'));
    await conta('depois@x.com', Date.parse('2026-10-18T03:00:00.000Z'));
    expect(contas.metricasUsuarios(HOJE).novasPorDia).toEqual({ '2026-10-17': 1, '2026-10-18': 1 });
    // o mesmo recorte que o resto do servidor usa (a telemetria): o SQL e o código não podem discordar de dia
    expect(diaDe(Date.parse('2026-10-18T02:59:59.999Z'))).toBe('2026-10-17');
    expect(diaDe(Date.parse('2026-10-18T03:00:00.000Z'))).toBe('2026-10-18');
  });

  it('registrar a visita de novo no mesmo dia não muda nada, e cada rodada soma ao dia (a visita do dia nasce junto)', async () => {
    contas = new Contas(':memory:');
    const id = await conta('x@x.com', HOJE, false);
    contas.registrarVisita(id, HOJE);
    contas.registrarVisita(id, HOJE + 1000);
    expect(contas.metricasUsuarios(HOJE).porDia).toEqual([{ dia: '2026-10-18', ativos: 1, jogaram: 0, minutos: 0, partidas: 0, abates: 0, mortes: 0 }]);
    contas.registrarPartida(id, { segundos: 90, abates: 1, mortes: 2 }, HOJE);
    contas.registrarPartida(id, { segundos: 30, abates: 4, mortes: 0 }, HOJE);
    expect(contas.metricasUsuarios(HOJE).porDia).toEqual([{ dia: '2026-10-18', ativos: 1, jogaram: 1, minutos: 2, partidas: 2, abates: 5, mortes: 2 }]);
    contas.registrarVisita(id, HOJE + 5000); // o piloto recarrega a página depois de jogar: a visita não apaga o que o dia já tem
    expect(contas.metricasUsuarios(HOJE).porDia).toEqual([{ dia: '2026-10-18', ativos: 1, jogaram: 1, minutos: 2, partidas: 2, abates: 5, mortes: 2 }]);
    // e uma rodada de uma conta que ainda não tinha visita do dia cria a linha sozinha
    const outra = await conta('y@x.com', HOJE, false);
    contas.registrarPartida(outra, { segundos: 60, abates: 0, mortes: 1 }, HOJE);
    expect(contas.metricasUsuarios(HOJE).ativos.dia).toBe(2);
  });

  it('o banco vazio responde com zeros, sem lançar e sem inventar retenção', () => {
    contas = new Contas(':memory:');
    const m = contas.metricasUsuarios(HOJE);
    expect(m).toEqual({
      desde: null,
      contas: 0,
      novasPorDia: {},
      ativos: { dia: 0, semana: 0, mes: 0 },
      jogaram: { dia: 0, semana: 0, mes: 0 },
      minutosPorJogador: 0,
      retencao: { d1: { coorte: 0, voltaram: 0 }, d7: { coorte: 0, voltaram: 0 } },
      porDia: [],
    });
  });

  it('a faxina leva a atividade de mais de 400 dias e guarda a recente (a tabela não cresce para sempre)', async () => {
    contas = new Contas(':memory:');
    const id = await conta('x@x.com', HOJE, false);
    contas.registrarVisita(id, HOJE - 401 * 86_400_000);
    contas.registrarVisita(id, HOJE - 86_400_000);
    expect(contas.metricasUsuarios(HOJE).desde).toBe(diaMais(diaDe(HOJE), -401));
    contas.limparExpiradas(HOJE);
    expect(contas.metricasUsuarios(HOJE).desde).toBe('2026-10-17');
  });
});

it('o diaMais atravessa mês e ano', () => {
  expect(diaMais('2026-10-31', 1)).toBe('2026-11-01');
  expect(diaMais('2026-01-01', -1)).toBe('2025-12-31');
  expect(diaMais('2026-10-18', -30)).toBe('2026-09-18');
});

describe('direitos do titular no banco (P187, LGPD art. 18)', () => {
  let contas: Contas;
  afterEach(() => contas?.close());
  const NOW = Date.UTC(2026, 9, 18, 15, 0);
  async function conta(email: string, aceite: string | null = '2026-10-18'): Promise<number> {
    const r = await contas.criar(email, 'senhasegura', NOW, aceite);
    if (!r.ok) throw new Error('deveria ter criado');
    contas.criarSessao(r.conta.id, NOW);
    return r.conta.id;
  }

  it('o aceite grava a data e a versão; conta sem aceite (de antes da política) fica nula e medida', async () => {
    contas = new Contas(':memory:');
    const a = await conta('a@x.com');
    const b = await conta('b@x.com', null);
    const da = contas.exportarDados(a, NOW)!;
    expect(da.conta).toMatchObject({ aceiteVersao: '2026-10-18', aceiteEm: new Date(NOW).toISOString(), medirAtividade: true });
    expect(contas.exportarDados(b, NOW)!.conta).toMatchObject({ aceiteVersao: null, aceiteEm: null, medirAtividade: true });
  });

  it('exportar traz tudo da conta e nada de segredo; conta que não existe devolve nulo', async () => {
    contas = new Contas(':memory:');
    const id = await conta('dados@x.com');
    contas.gravarProgresso(id, JSON.stringify({ apelido: 'ANA', nivel: 3 }));
    contas.registrarPartida(id, { segundos: 90, abates: 2, mortes: 1 }, NOW);
    const d = contas.exportarDados(id, NOW)!;
    expect(d.v).toBe(1);
    expect(d.geradoEm).toBe(new Date(NOW).toISOString());
    expect(d.progresso).toEqual({ apelido: 'ANA', nivel: 3 });
    expect(d.atividade).toEqual([{ dia: '2026-10-18', segundos: 90, partidas: 1, abates: 2, mortes: 1 }]);
    expect(d.sessoes).toHaveLength(1);
    expect(Object.keys(d.conta).sort()).toEqual(['aceiteEm', 'aceiteVersao', 'administrador', 'criadaEm', 'email', 'medirAtividade']);
    expect(contas.exportarDados(9999, NOW)).toBeNull();
  });

  it('apagar leva a conta, o progresso, a atividade e as sessões, só dessa conta; apagar de novo diz que não havia', async () => {
    contas = new Contas(':memory:');
    const a = await conta('apaga@x.com');
    const b = await conta('fica@x.com');
    contas.gravarProgresso(a, '{"x":1}');
    contas.gravarProgresso(b, '{"y":2}');
    contas.registrarPartida(a, { segundos: 10, abates: 0, mortes: 0 }, NOW);
    expect(contas.apagarConta(a)).toBe(true);
    expect(contas.exportarDados(a, NOW)).toBeNull();
    expect(contas.lerProgresso(a)).toBeNull();
    expect(contas.total()).toBe(1);
    expect(contas.exportarDados(b, NOW)!.progresso).toEqual({ y: 2 });
    expect(contas.exportarDados(b, NOW)!.sessoes).toHaveLength(1);
    expect(contas.apagarConta(a)).toBe(false);
    expect(contas.metricasUsuarios(NOW).contas).toBe(1);
  });

  it('desligar a medição apaga o que havia e impede o registro (visita e rodada); ligar de novo recomeça do zero', async () => {
    contas = new Contas(':memory:');
    const id = await conta('mede@x.com');
    contas.registrarPartida(id, { segundos: 60, abates: 1, mortes: 0 }, NOW);
    expect(contas.metricasUsuarios(NOW).jogaram.dia).toBe(1);
    contas.definirMedicao(id, false);
    expect(contas.metricasUsuarios(NOW).ativos.dia).toBe(0);
    contas.registrarVisita(id, NOW);
    contas.registrarPartida(id, { segundos: 60, abates: 1, mortes: 0 }, NOW);
    expect(contas.metricasUsuarios(NOW).ativos.dia).toBe(0);
    expect(contas.validarSessao(contas.criarSessao(id, NOW))!.medir).toBe(false);
    contas.definirMedicao(id, true);
    contas.registrarVisita(id, NOW);
    const m = contas.metricasUsuarios(NOW);
    expect(m.ativos.dia).toBe(1);
    expect(m.jogaram.dia).toBe(0); // recomeçou do zero: a rodada de antes não voltou
  });
});
