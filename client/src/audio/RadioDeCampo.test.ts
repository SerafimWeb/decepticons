import { describe, expect, it } from 'vitest';
import { FALA_TEXTO } from '../combat/radioFalas';
import { ABERTURA_MS, CHAMADAS_DO_CEREBRO, FOLGA_DEPOIS_DA_FALA_S, INTERVALO_MINIMO_S, RadioDeCampo, type OpcoesDoRadio } from './RadioDeCampo';
import { falasDoGatilho, FALAS_DE_RADIO } from './radio';
import geradas from './vozesGeradas.json';

/** Um player de mentira: guarda o que foi pedido e tocado; `prontos` diz o que já "baixou". */
function montar(extra: Partial<OpcoesDoRadio> = {}, gravadas: readonly string[] = FALAS_DE_RADIO.map((f) => f.chave)) {
  const eventos: string[] = [];
  const prontos = new Set<string>(gravadas.map((c) => `br/${c}`));
  const agendados: { fn: () => void; ms: number }[] = [];
  let agora = 100;
  let duracao = 2;
  const radio = new RadioDeCampo({
    player: {
      pronto: (n) => prontos.has(n),
      pedir: (n, url) => eventos.push(`pedir ${n} ${url}`),
      tocar: (n) => (eventos.push(`tocar ${n}`), duracao),
    },
    gravada: (c) => gravadas.includes(c),
    base: '/jogar/',
    agora: () => agora,
    bipe: (a) => eventos.push(a ? 'bipe-abrir' : 'bipe-fechar'),
    agendar: (fn, ms) => agendados.push({ fn, ms }),
    ...extra,
  });
  const correr = () => { while (agendados.length) agendados.shift()!.fn(); };
  return { radio, eventos, prontos, agendados, correr, avancar: (s: number) => { agora += s; }, definirDuracao: (d: number) => { duracao = d; } };
}

describe('o rádio de campo no jogo (P316)', () => {
  it('as chamadas do cérebro são as do rádio de texto (a mesma lista da simulação)', () => {
    expect([...CHAMADAS_DO_CEREBRO].sort()).toEqual(Object.keys(FALA_TEXTO).sort());
  });

  it('o lado decide o canal: o time aliado fala pelo piloto e o inimigo pelo rádio interceptado', () => {
    const a = montar();
    expect(a.radio.chamada(true, 'pinca')).toBe(true);
    a.correr();
    const aliada = a.eventos.find((e) => e.startsWith('tocar'))!.slice('tocar br/'.length);
    expect(falasDoGatilho('piloto', 'cerebro:pinca').map((f) => f.chave)).toContain(aliada);

    const b = montar();
    expect(b.radio.chamada(false, 'pinca')).toBe(true);
    b.correr();
    const inimiga = b.eventos.find((e) => e.startsWith('tocar'))!.slice('tocar br/'.length);
    expect(falasDoGatilho('intercepto', 'cerebro:pinca').map((f) => f.chave)).toContain(inimiga);
  });

  it('sem nenhuma fala gravada daquela chamada, fica mudo e não pede nada', () => {
    const m = montar({}, []);
    expect(m.radio.chamada(false, 'vai')).toBe(false);
    expect(m.eventos).toEqual([]);
    // só uma gravada, de outra chamada: continua mudo
    const so = montar({}, ['rd_intercepto_vai_1']);
    expect(so.radio.chamada(false, 'pinca')).toBe(false);
    expect(so.radio.chamada(true, 'vai')).toBe(false); // gravada do lado inimigo não toca no aliado
  });

  it('a fala ainda baixando não toca: pede o clipe uma vez e na próxima vez sai com a voz', () => {
    const m = montar({}, ['rd_intercepto_vai_1']);
    m.prontos.clear();
    expect(m.radio.chamada(false, 'vai')).toBe(false);
    expect(m.eventos).toEqual(['pedir br/rd_intercepto_vai_1 /jogar/audio/vozes/br/rd_intercepto_vai_1.mp3']);
    m.prontos.add('br/rd_intercepto_vai_1');
    expect(m.radio.chamada(false, 'vai')).toBe(true);
    m.correr();
    expect(m.eventos).toContain('tocar br/rd_intercepto_vai_1');
  });

  it('gira por todas as variações gravadas antes de repetir a mesma', () => {
    const m = montar();
    const todas = falasDoGatilho('intercepto', 'cerebro:vai').map((f) => f.chave);
    expect(todas.length).toBeGreaterThanOrEqual(2);
    const tocadas: string[] = [];
    for (let k = 0; k < todas.length * 2; k++) {
      m.eventos.length = 0;
      expect(m.radio.chamada(false, 'vai')).toBe(true);
      m.correr();
      tocadas.push(m.eventos.find((e) => e.startsWith('tocar'))!.slice('tocar br/'.length));
      m.avancar(INTERVALO_MINIMO_S + 5);
    }
    expect(tocadas.slice(0, todas.length)).toEqual(todas); // a primeira volta é a ordem do catálogo
    expect(tocadas.slice(todas.length)).toEqual(todas); // e a segunda recomeça: nunca a mesma duas vezes seguidas
    expect(new Set(tocadas.slice(0, todas.length)).size).toBe(todas.length);
  });

  it('não vira tagarelice: duas chamadas seguidas tocam uma só, e só depois do intervalo e da fala a próxima passa', () => {
    const m = montar();
    m.definirDuracao(4);
    expect(m.radio.chamada(false, 'pinca')).toBe(true);
    m.correr();
    expect(m.radio.chamada(true, 'posicao')).toBe(false); // logo em seguida: o rádio está ocupado
    m.avancar(4 + FOLGA_DEPOIS_DA_FALA_S - 0.1);
    expect(m.radio.chamada(true, 'posicao')).toBe(false); // a fala de 4 s mais a folga ainda não passaram
    m.avancar(0.2);
    expect(m.radio.chamada(true, 'posicao')).toBe(true);
  });

  it('o piso do intervalo vale também para fala curta', () => {
    const m = montar();
    m.definirDuracao(0.5);
    expect(m.radio.chamada(false, 'pinca')).toBe(true);
    m.correr();
    m.avancar(INTERVALO_MINIMO_S - 0.1);
    expect(m.radio.chamada(false, 'vai')).toBe(false);
    m.avancar(0.2);
    expect(m.radio.chamada(false, 'vai')).toBe(true);
  });

  it('nunca fala por cima do narrador (ou de outra voz): enquanto está ocupado, fica mudo e não gasta a vez', () => {
    let ocupado = true;
    const m = montar({ ocupado: () => ocupado });
    expect(m.radio.chamada(false, 'pinca')).toBe(false);
    expect(m.eventos).toEqual([]);
    ocupado = false;
    const todas = falasDoGatilho('intercepto', 'cerebro:pinca').map((f) => f.chave);
    expect(m.radio.chamada(false, 'pinca')).toBe(true);
    m.correr();
    expect(m.eventos).toContain(`tocar br/${todas[0]}`); // a primeira variação ainda era a da vez
  });

  it('o bipe abre o canal antes da voz e fecha depois dela: bipe, ~130 ms, voz, a duração da voz, bipe', () => {
    const m = montar();
    m.definirDuracao(1.8);
    expect(m.radio.chamada(true, 'reagrupar')).toBe(true);
    expect(m.eventos).toEqual(['bipe-abrir']); // a voz ainda não começou
    expect(m.agendados).toHaveLength(1);
    expect(m.agendados[0]!.ms).toBe(ABERTURA_MS);
    m.agendados.shift()!.fn(); // passaram os 130 ms: a voz sai
    expect(m.eventos.map((e) => e.split(' ')[0])).toEqual(['bipe-abrir', 'tocar']);
    expect(m.agendados).toHaveLength(1);
    expect(m.agendados[0]!.ms).toBeCloseTo(1800, 5); // o bipe de fechar vem quando a fala acaba
    m.agendados.shift()!.fn();
    expect(m.eventos.map((e) => e.split(' ')[0])).toEqual(['bipe-abrir', 'tocar', 'bipe-fechar']);
  });

  it('sem bipe configurado, a voz toca direto, sem agendar nada', () => {
    const m = montar({ bipe: undefined });
    expect(m.radio.chamada(false, 'vai')).toBe(true);
    expect(m.agendados).toHaveLength(0);
    expect(m.eventos.filter((e) => e.startsWith('tocar'))).toHaveLength(1);
  });

  it('um clipe que não toca (duração 0) não deixa bipe de fechar pendurado nem trava o rádio para sempre', () => {
    const m = montar();
    m.definirDuracao(0);
    expect(m.radio.chamada(false, 'vai')).toBe(true);
    m.correr();
    expect(m.eventos).not.toContain('bipe-fechar');
    m.avancar(INTERVALO_MINIMO_S + 0.1);
    m.definirDuracao(2);
    expect(m.radio.chamada(false, 'vai')).toBe(true); // passado o piso do intervalo, o rádio volta
  });

  it('preparar pede só os clipes gravados das chamadas do cérebro, dos dois lados, sem repetir e sem pedir o que não existe', () => {
    const gravadas = ['rd_piloto_pinca_1', 'rd_intercepto_vai_2', 'rd_intercepto_vai_3', 'rd_controle_abertura_1', 'rd_grito_ataque_1'];
    const m = montar({}, gravadas);
    m.radio.preparar();
    expect(m.eventos.sort()).toEqual([
      'pedir br/rd_intercepto_vai_2 /jogar/audio/vozes/br/rd_intercepto_vai_2.mp3',
      'pedir br/rd_intercepto_vai_3 /jogar/audio/vozes/br/rd_intercepto_vai_3.mp3',
      'pedir br/rd_piloto_pinca_1 /jogar/audio/vozes/br/rd_piloto_pinca_1.mp3',
    ]); // as de controle e de grito não têm gancho do cérebro: ficam fora
    expect(montar({}, []).eventos).toEqual([]);
  });

  it('sem a opção `gravada`, vale o manifesto de verdade (vozesGeradas.json): só pede e só toca o que ele lista, seja o que o Comandante gravar (nada de 404 por fala sem arquivo; e gravar nunca trava este teste)', () => {
    const noManifesto = new Set<string>(geradas.br);
    const novo = () => {
      const pedidos: string[] = [];
      const tocados: string[] = [];
      const radio = new RadioDeCampo({
        player: { pronto: () => true, pedir: (n) => pedidos.push(n), tocar: (n) => (tocados.push(n), 2) },
        base: '/jogar/',
        agora: () => 100,
      });
      return { radio, pedidos, tocados };
    };
    const preparo = novo();
    preparo.radio.preparar();
    for (const n of preparo.pedidos) expect(noManifesto.has(n.replace(/^br\//, '')), `${n} foi pedido mas o manifesto não o lista`).toBe(true);
    for (const fala of CHAMADAS_DO_CEREBRO) {
      for (const aliado of [true, false]) {
        const quem = `${aliado ? 'aliado' : 'inimigo'}/${fala}`;
        const temGravada = falasDoGatilho(aliado ? 'piloto' : 'intercepto', `cerebro:${fala}`).some((f) => noManifesto.has(f.chave));
        const r = novo(); // um rádio novo por par: o intervalo entre falas é estado de cada rádio
        expect(r.radio.chamada(aliado, fala), quem).toBe(temGravada);
        expect(r.tocados.length, quem).toBe(temGravada ? 1 : 0);
        for (const n of r.tocados) expect(noManifesto.has(n.replace(/^br\//, '')), `${quem}: tocou ${n}, que o manifesto não lista`).toBe(true);
      }
    }
  });
});
