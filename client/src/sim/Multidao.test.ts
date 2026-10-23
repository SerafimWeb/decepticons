import { describe, expect, it } from 'vitest';
import { BANDEIRA, CARECA, GADO, Multidao, PASSO_DO_SUSTO, PERUCA, RAZAO_DA_FUGA, senoParabolico, VELOCIDADE, type CausaDaFuga, type ConfigDaMultidao } from './Multidao';

/** Uma Praça de mentira, só para a regra: dois ônibus e quatro bueiros no oeste, três lixeiras, três prédios no leste, duas saídas. */
const PRACA: ConfigDaMultidao = {
  semente: 1234,
  fontes: [
    { tipo: 'onibus', x: -200, z: 0 },
    { tipo: 'onibus', x: -160, z: 30 },
    { tipo: 'bueiro', x: -90, z: -25 },
    { tipo: 'bueiro', x: -70, z: 20 },
    { tipo: 'bueiro', x: -50, z: -5 },
    { tipo: 'bueiro', x: -30, z: 35 },
    { tipo: 'lixeira', x: -20, z: -30 },
    { tipo: 'lixeira', x: -10, z: 10 },
    { tipo: 'lixeira', x: -40, z: 0 },
  ],
  predios: [
    { x: 40, z: -30, meia: 12 },
    { x: 40, z: 0, meia: 12 },
    { x: 40, z: 30, meia: 12 },
  ],
  saidas: [
    { x: -400, z: 0 },
    { x: 0, z: 220 },
  ],
  cota: 600,
  duracaoTicks: 18_000,
};
const SO_UMA: ConfigDaMultidao = { ...PRACA, cota: 1, pAndroide: 0, fontes: [{ tipo: 'onibus', x: -100, z: 0 }], partes: { onibus: 1, bueiro: 0, lixeira: 0 } };

const lista = (a: ArrayLike<number>) => Array.from(a);
const p = { x: 0, z: 0 };

describe('o cronograma: a mesma semente é a mesma multidão (G2)', () => {
  it('determinístico: a mesma configuração dá os mesmos vetores; outra semente dá outra multidão; a cota fecha (figurantes + androides rebeldes)', () => {
    const a = new Multidao(PRACA);
    const b = new Multidao(PRACA);
    for (const campo of ['nasce', 'tipo', 'alvo', 'origemX', 'destinoX', 'chegaEm', 'velocidade'] as const) expect(lista(a[campo]), campo).toEqual(lista(b[campo]));
    expect(a.androides).toEqual(b.androides);
    expect(lista(new Multidao({ ...PRACA, semente: 99 }).nasce)).not.toEqual(lista(a.nasce));
    expect(a.total + a.androides.length).toBe(PRACA.cota);
  });

  it('os ids seguem o nascimento; ninguém nasce antes da primeira chegada (5 s) nem depois do fim do despejo; as três fontes entram e a mistura tem cerca de 60 / 12 / 8 / 20 por cento', () => {
    const m = new Multidao({ ...PRACA, cota: 3000 });
    for (let i = 1; i < m.total; i++) expect(m.nasce[i]!).toBeGreaterThanOrEqual(m.nasce[i - 1]!);
    expect(m.nasce[0]!).toBeGreaterThanOrEqual(300);
    expect(m.nasce[m.total - 1]!).toBeLessThan(18_000);
    const por = [0, 0, 0, 0];
    for (let i = 0; i < m.total; i++) por[m.tipo[i]!]!++;
    const parte = (n: number) => n / m.total;
    expect(parte(por[GADO]!)).toBeGreaterThan(0.55);
    expect(parte(por[GADO]!)).toBeLessThan(0.65);
    expect(parte(por[CARECA]!)).toBeGreaterThan(0.08);
    expect(parte(por[PERUCA]!)).toBeGreaterThan(0.05);
    expect(parte(por[BANDEIRA]!)).toBeGreaterThan(0.15);
    expect(parte(por[BANDEIRA]!)).toBeLessThan(0.25);
    // cada figurante nasce junto de uma fonte, e as três famílias de fonte despejam
    const usadas = new Set<string>();
    for (let i = 0; i < m.total; i++) {
      const f = PRACA.fontes.find((s) => Math.abs(s.x - m.origemX[i]!) <= 1.6 && Math.abs(s.z - m.origemZ[i]!) <= 1.6);
      expect(f, `figurante ${i}`).toBeDefined();
      usadas.add(f!.tipo);
    }
    expect([...usadas].sort()).toEqual(['bueiro', 'lixeira', 'onibus']);
  });

  it('o mapa sem uma família de fonte (sem bueiro) passa a parte dela para as outras: a cota continua inteira', () => {
    const m = new Multidao({ ...PRACA, fontes: PRACA.fontes.filter((f) => f.tipo !== 'bueiro') });
    expect(m.total + m.androides.length).toBe(PRACA.cota);
    expect(() => new Multidao({ ...PRACA, fontes: [] })).toThrow(/fonte/);
    expect(() => new Multidao({ ...PRACA, predios: [] })).toThrow(/prédio/);
  });
});

describe('a posição é função do tempo', () => {
  it('antes de nascer não está na Praça; anda sem saltos (no máximo a velocidade mais o balanço por tick); chega ao destino no tick marcado; chamar de novo dá o mesmo número', () => {
    const m = new Multidao(SO_UMA);
    const i = 0;
    const nasce = m.nasce[i]!;
    expect(m.posicao(i, nasce - 1, p)).toBe(false);
    expect(m.posicao(i, nasce, p)).toBe(true);
    const v = m.velocidade[i]!;
    let ax = p.x;
    let az = p.z;
    for (let t = nasce + 1; t <= m.chegaEm[i]!; t++) {
      m.posicao(i, t, p);
      const passo = Math.hypot(p.x - ax, p.z - az);
      expect(passo, `tick ${t}`).toBeLessThanOrEqual(v / 60 + 0.02);
      ax = p.x;
      az = p.z;
    }
    expect(Math.hypot(p.x - m.destinoX[i]!, p.z - m.destinoZ[i]!)).toBeLessThan(0.01);
    const x = p.x;
    m.posicao(i, m.chegaEm[i]!, p);
    expect(p.x).toBe(x);
  });

  it('o seno em parábolas por partes é periódico, limitado a [-1, 1] e só usa as quatro contas', () => {
    expect(senoParabolico(0)).toBe(0);
    expect(senoParabolico(0.25)).toBe(1);
    expect(senoParabolico(0.75)).toBe(-1);
    expect(senoParabolico(1.25)).toBe(senoParabolico(0.25));
    for (let u = -2; u <= 2; u += 0.013) expect(Math.abs(senoParabolico(u))).toBeLessThanOrEqual(1);
  });
});

describe('o ciclo sem jogador: chegam, sujam, fogem e saem', () => {
  it('cada um chega uma vez (antes de fugir), foge uma vez depois do tempo na fachada e sai pelo limite; no fim a Praça está vazia e a cota despejada', () => {
    const m = new Multidao(PRACA);
    const chegou: number[] = [];
    const fugiu: Array<[number, CausaDaFuga]> = [];
    const saiu: number[] = [];
    m.aoChegar = (i, predio) => {
      expect(predio).toBe(m.alvo[i]);
      chegou.push(i);
    };
    m.aoFugir = (i, causa) => fugiu.push([i, causa]);
    m.aoSair = (i) => saiu.push(i);
    let picoNaFachada = 0;
    let anterior = m.total;
    // até o último a nascer (tick 18.000) andar a Praça inteira e fugir: o careca de um ônibus de longe leva uns 3,5 min
    const FIM = 45_000;
    for (let t = 0; t <= FIM; t++) {
      m.avancar(t);
      if (t % 60 === 0) {
        picoNaFachada = Math.max(picoNaFachada, m.contarNaFachada(t).reduce((a, b) => a + b, 0));
        expect(m.faltamChegar).toBeLessThanOrEqual(anterior);
        anterior = m.faltamChegar;
      }
    }
    expect(chegou).toHaveLength(m.total);
    expect(new Set(chegou).size).toBe(m.total);
    expect(fugiu).toHaveLength(m.total);
    expect(fugiu.every(([, causa]) => causa === 'cumpriu')).toBe(true);
    expect(saiu).toHaveLength(m.total);
    expect(picoNaFachada).toBeGreaterThan(0);
    expect(m.contarNaFachada(FIM).reduce((a, b) => a + b, 0)).toBe(0);
    expect(m.faltamChegar).toBe(0);
    expect(m.presentes).toBe(0);
    expect(m.expulsos).toBe(m.total);
    expect(m.eliminados).toBe(0);
    expect(m.terminou).toBe(true);
    // a fuga vem depois da chegada, pelo tempo na fachada
    for (const [i] of fugiu.slice(0, 20)) expect(m.fugiuNoTick(i)).toBe(m.chegaEm[i]! + 240);
  });

  it('pular ticks (o quadro atrasou) dá o mesmo resultado que andar um a um', () => {
    const a = new Multidao(PRACA);
    const b = new Multidao(PRACA);
    for (let t = 0; t <= 9000; t++) a.avancar(t);
    for (let t = 0; t <= 9000; t += 977) b.avancar(t);
    b.avancar(9000);
    expect([a.nasceram, a.presentes, a.expulsos]).toEqual([b.nasceram, b.presentes, b.expulsos]);
    expect(lista(a.contarNaFachada(9000))).toEqual(lista(b.contarNaFachada(9000)));
  });
});

/** Acha, no tick `t`, um figurante na Praça e devolve o id. */
function algumPresente(m: Multidao, t: number, depoisDe = 0): number {
  m.calcularPosicoes(t);
  for (let i = depoisDe; i < m.total; i++) if (m.presente[i] === 1) return i;
  throw new Error('ninguém na Praça');
}

describe('o tiro, a explosão e o susto (a autoridade)', () => {
  it('o tiro acerta o corpo na linha da mira e só ele: de lado acerta, para o lado errado ou por cima da cabeça erra; de cima acerta; o alcance corta', () => {
    const m = new Multidao(SO_UMA);
    const t = m.nasce[0]! + 30;
    m.avancar(t);
    const i = algumPresente(m, t);
    m.posicao(i, t, p);
    const { x, z } = p;
    expect(m.atirar(x + 8, 1.2, z, -1, 0, 0, 50, 1, t)).toBeGreaterThanOrEqual(0); // de lado, na altura do peito
    expect(m.atirar(x + 8, 1.2, z, 1, 0, 0, 50, 1, t)).toBe(-1); // para o outro lado
    expect(m.atirar(x + 8, 3.5, z, -1, 0, 0, 50, 1, t)).toBe(-1); // por cima da cabeça
    expect(m.atirar(x + 8, 1.2, z + 6, -1, 0, 0, 50, 1, t)).toBe(-1); // desviado 6 m
    expect(m.atirar(x + 8, 1.2, z, -1, 0, 0, 3, 1, t)).toBe(-1); // curto demais
    expect(m.atirar(x, 6, z, 0, -1, 0, 50, 1, t)).toBeGreaterThanOrEqual(0); // de cima para baixo
  });

  it('o gado cai com dois golpes, o careca aguenta mais; o ferido foge e o morto some, uma vez só', () => {
    const m = new Multidao({ ...SO_UMA, mistura: [1, 0, 0, 0] });
    const mortos: number[] = [];
    const fugas: Array<[number, CausaDaFuga]> = [];
    m.aoMorrer = (i) => mortos.push(i);
    m.aoFugir = (i, causa) => fugas.push([i, causa]);
    const t = m.nasce[0]! + 30;
    m.avancar(t);
    const i = algumPresente(m, t);
    m.posicao(i, t, p);
    const { x, z } = p;
    expect(m.atirar(x + 8, 1.2, z, -1, 0, 0, 50, 7, t)).toBe(i); // 12 de vida, 7 de dano: ferido
    expect(fugas).toEqual([[i, 'tiro']]);
    expect(m.eliminados).toBe(0);
    m.avancar(t + 1);
    m.posicao(i, t + 1, p);
    expect(m.atirar(p.x + 8, 1.2, p.z, -1, 0, 0, 50, 7, t + 1)).toBe(i); // o segundo golpe mata
    expect(mortos).toEqual([i]);
    expect(m.eliminados).toBe(1);
    expect(m.estaMorto(i)).toBe(true);
    expect(m.posicao(i, t + 2, p)).toBe(false);
    m.calcularPosicoes(t + 2);
    expect(m.atirar(p.x + 8, 1.2, p.z, -1, 0, 0, 50, 7, t + 2)).not.toBe(i);
    expect(mortos).toEqual([i]); // o morto não morre de novo
    expect(m.presentes).toBe(m.nasceram - 1 - m.expulsos);
  });

  it('a explosão mata quem está no raio, assusta quem está até o dobro dele e deixa o resto em paz', () => {
    const m = new Multidao({ ...PRACA, cota: 300, pAndroide: 0 });
    const t = 4000;
    m.avancar(t);
    m.calcularPosicoes(t);
    const alvo = algumPresente(m, t);
    m.posicao(alvo, t, p);
    const cx = p.x;
    const cz = p.z;
    const dentro: number[] = [];
    const meio: number[] = [];
    const longe: number[] = [];
    for (let i = 0; i < m.total; i++) {
      if (m.presente[i] === 0) continue;
      const d = Math.hypot(m.posX[i]! - cx, m.posZ[i]! - cz);
      (d <= 5 ? dentro : d <= 10 ? meio : longe).push(i);
    }
    expect(dentro.length).toBeGreaterThan(0);
    const fugas: number[] = [];
    m.aoFugir = (i) => fugas.push(i);
    const mortos = m.explodir(cx, 0.5, cz, 5, 100, t);
    expect(mortos).toBe(dentro.length);
    for (const i of dentro) expect(m.estaMorto(i)).toBe(true);
    for (const i of meio) expect(m.fugiuNoTick(i), `a ${Math.hypot(m.posX[i]! - cx, m.posZ[i]! - cz).toFixed(1)} m`).toBe(t);
    for (const i of longe) expect(m.fugiuNoTick(i) === t).toBe(false);
    expect(fugas.length).toBeGreaterThanOrEqual(meio.length);
  });

  it('o susto por perto: o jogador a poucos metros faz fugir, mas só de 6 em 6 ticks; longe não assusta', () => {
    const m = new Multidao(SO_UMA);
    const t = Math.ceil((m.nasce[0]! + 40) / PASSO_DO_SUSTO) * PASSO_DO_SUSTO;
    m.avancar(t);
    const i = algumPresente(m, t);
    m.posicao(i, t, p);
    const jogador = { x: p.x + 3, z: p.z };
    expect(m.assustarPorPerto([{ x: p.x + 100, z: p.z }], 8, t)).toBe(0);
    expect(m.assustarPorPerto([jogador], 8, t + 1)).toBe(0); // fora do passo
    expect(m.assustarPorPerto([jogador], 8, t)).toBeGreaterThanOrEqual(1);
    expect(m.fugiuNoTick(i)).toBe(t);
    // a fuga é para a saída mais perto, mais depressa que o andar
    m.posicao(i, t + 60, p);
    const x1 = p.x;
    const z1 = p.z;
    m.posicao(i, t + 120, p);
    expect(Math.hypot(p.x - x1, p.z - z1)).toBeCloseTo(m.velocidade[i]! * RAZAO_DA_FUGA, 1);
  });

  it('a onda em cone (P242, canhão sônico): quem está no ângulo e no alcance foge sem perder vida; fora do cone ou longe demais, ninguém', () => {
    const m = new Multidao(SO_UMA);
    const fugas: Array<[number, CausaDaFuga]> = [];
    m.aoFugir = (i, causa) => fugas.push([i, causa]);
    const t = Math.ceil((m.nasce[0]! + 40) / PASSO_DO_SUSTO) * PASSO_DO_SUSTO;
    m.avancar(t);
    const i = algumPresente(m, t);
    m.posicao(i, t, p);
    // a boca aponta para +x, a 10 m de distância do figurante (dentro do alcance de 22 m, dentro do meio ângulo de 0,45 rad do sonic.ts)
    expect(m.assustarEmCone(p.x - 10, p.z, 1, 0, 0.45, 22, t)).toBeGreaterThanOrEqual(1);
    expect(m.fugiuNoTick(i)).toBe(t);
    expect(fugas).toContainEqual([i, 'susto']); // empurra (a mesma causa do susto por perto), não é um tiro que fere
    expect(m.estaMorto(i)).toBe(false);
  });

  it('a onda em cone erra quem está fora do ângulo ou do alcance, e respeita o mesmo passo do susto por perto', () => {
    const m = new Multidao(SO_UMA);
    const t = Math.ceil((m.nasce[0]! + 40) / PASSO_DO_SUSTO) * PASSO_DO_SUSTO;
    m.avancar(t);
    const i = algumPresente(m, t);
    m.posicao(i, t, p);
    expect(m.assustarEmCone(p.x - 10, p.z, -1, 0, 0.45, 22, t)).toBe(0); // boca apontando para o lado errado
    expect(m.assustarEmCone(p.x - 10, p.z, 1, 0, 0.45, 5, t)).toBe(0); // alcance curto demais
    expect(m.assustarEmCone(p.x - 10, p.z, 1, 0, 0.45, 22, t + 1)).toBe(0); // fora do passo do susto
    expect(m.fugiuNoTick(i)).not.toBe(t);
  });
});

describe('o espelho do cliente online: só os eventos do servidor, o resto sai do tempo', () => {
  /** Roda a autoridade tirando e assustando, e devolve o que ela mandaria pela rede. */
  function partidaDaAutoridade(ate: number) {
    const a = new Multidao(PRACA);
    const eventos: Array<{ t: number; tipo: 'morte' | 'fuga'; i: number }> = [];
    let agora = 0;
    a.aoMorrer = (i) => eventos.push({ t: agora, tipo: 'morte', i });
    a.aoFugir = (i, causa) => causa !== 'cumpriu' && eventos.push({ t: agora, tipo: 'fuga', i });
    for (let t = 0; t <= ate; t++) {
      agora = t;
      a.avancar(t);
      if (t > 1500 && t % 40 === 0) {
        a.calcularPosicoes(t);
        const i = algumPresenteOuNada(a);
        if (i >= 0) a.atirar(a.posX[i]! + 6, 1.1, a.posZ[i]!, -1, 0, 0, 60, t % 80 === 0 ? 100 : 7, t);
      }
      if (t % 700 === 0 && t > 1500) a.explodir(-60, 0.5, 0, 6, 100, t);
    }
    return { a, eventos };
  }
  const algumPresenteOuNada = (m: Multidao): number => {
    for (let i = 0; i < m.total; i++) if (m.presente[i] === 1) return i;
    return -1;
  };

  it('com os mesmos eventos nos mesmos ticks, o espelho chega ao mesmo lugar: contagens e posições iguais', () => {
    const { a, eventos } = partidaDaAutoridade(5000);
    expect(a.eliminados).toBeGreaterThan(0);
    expect(eventos.some((e) => e.tipo === 'fuga')).toBe(true);
    const b = new Multidao({ ...PRACA, autoridade: false });
    let k = 0;
    for (let t = 0; t <= 5000; t++) {
      b.avancar(t);
      while (k < eventos.length && eventos[k]!.t === t) {
        const e = eventos[k++]!;
        if (e.tipo === 'morte') b.aplicarMorte(e.i, t);
        else b.aplicarFuga(e.i, t);
      }
    }
    expect([b.eliminados, b.expulsos, b.presentes, b.nasceram]).toEqual([a.eliminados, a.expulsos, a.presentes, a.nasceram]);
    const pa = { x: 0, z: 0 };
    for (let i = 0; i < a.total; i += 7) {
      const ea = a.posicao(i, 5000, pa);
      const eb = b.posicao(i, 5000, p);
      expect(eb, `presença de ${i}`).toBe(ea);
      if (ea) {
        expect(Math.abs(p.x - pa.x)).toBeLessThan(1e-4);
        expect(Math.abs(p.z - pa.z)).toBeLessThan(1e-4);
      }
    }
    expect(b.atirar(0, 1, 0, 1, 0, 0, 50, 1, 5000)).toBe(-1); // o espelho não atira
    expect(b.explodir(0, 0, 0, 50, 100, 5000)).toBe(0);
  });

  it('quem entra no meio da fase recebe o estado compacto e fica igual à autoridade, agora e dali em diante', () => {
    const { a, eventos } = partidaDaAutoridade(5000);
    expect(eventos.length).toBeGreaterThan(0);
    const estado = a.exportarEstado();
    expect(estado.mortos.length).toBe((a.total + 7) >> 3); // um bit por figurante
    const c = new Multidao({ ...PRACA, autoridade: false });
    let avisos = 0;
    c.aoChegar = () => avisos++;
    c.aoFugir = () => avisos++;
    c.aplicarEstado(estado);
    c.avancar(5000, true);
    expect(avisos, 'refazer o passado não repete os avisos da missão').toBe(0);
    expect([c.eliminados, c.expulsos, c.presentes, c.nasceram]).toEqual([a.eliminados, a.expulsos, a.presentes, a.nasceram]);
    for (let t = 5001; t <= 9000; t++) {
      a.avancar(t);
      c.avancar(t);
    }
    expect([c.eliminados, c.expulsos, c.presentes]).toEqual([a.eliminados, a.expulsos, a.presentes]);
    expect(lista(c.contarNaFachada(9000))).toEqual(lista(a.contarNaFachada(9000)));
    expect(a.terminou).toBe(c.terminou);
  });
});

describe('o custo (a conta da ficha, § 3 e § 4)', () => {
  it('3.000 figurantes por 5 minutos, com posições calculadas a cada tick e um tiro a cada 6: bem abaixo do tick de 16,7 ms (a medida fica no relatório)', () => {
    const m = new Multidao({ ...PRACA, cota: 3000 });
    const t0 = performance.now();
    let maxPresentes = 0;
    for (let t = 0; t <= 18_000; t++) {
      m.avancar(t);
      m.calcularPosicoes(t);
      if (t % 6 === 0 && t > 1200) m.atirar(-100, 1.2, 0, 1, 0, 0, 120, 1, t);
      maxPresentes = Math.max(maxPresentes, m.presentes);
    }
    const porTickMs = (performance.now() - t0) / 18_000;
    console.info(`Multidão: ${m.total} figurantes, pico de ${maxPresentes} na Praça, ${porTickMs.toFixed(3)} ms por tick (posições todo tick + 10 tiros/s)`);
    expect(maxPresentes).toBeGreaterThan(500);
    expect(porTickMs).toBeLessThan(2);
  });

  it('as velocidades do desenho: o careca é o mais lento e a peruca a mais rápida', () => {
    expect(VELOCIDADE[CARECA]).toBeLessThan(VELOCIDADE[GADO]);
    expect(VELOCIDADE[GADO]).toBeLessThan(VELOCIDADE[PERUCA]);
  });
});
