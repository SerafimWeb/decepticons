import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../core/Settings';
import { criarCadeiaDeVoz, criarDeslocadorDeTom, curvaDeDistorcao, PREDEFINICOES_DE_VOZ, type PredefinicaoDeVoz, razaoDeSemitons, ruidoDaReverberacao } from './EfeitosDeVoz';

const NOMES = Object.keys(PREDEFINICOES_DE_VOZ) as PredefinicaoDeVoz[];

/** Um nó de áudio de mentira que anota o que o teste precisa saber: o tipo, o que foi ligado a quê, e se foi solto. */
class NoFalso {
  destinos: NoFalso[] = [];
  solto = false;
  iniciadoEm: number | null = null;
  parado = false;
  buffer: unknown = null;
  loop = false;
  constructor(public tipo: string) {}
  connect(d: unknown): unknown {
    this.destinos.push(d as NoFalso);
    return d;
  }
  disconnect(): void {
    this.solto = true;
  }
  start(t: number): void {
    this.iniciadoEm = t;
  }
  stop(): void {
    this.parado = true;
  }
  // parâmetros de áudio e propriedades dos nós reais
  gain = { value: 1 };
  frequency = { value: 0 };
  Q = { value: 0 };
  threshold = { value: 0 };
  knee = { value: 0 };
  ratio = { value: 0 };
  attack = { value: 0 };
  release = { value: 0 };
  delayTime = { value: 0 };
  type = '';
  curve: Float32Array | null = null;
  oversample = 'none';
}

function contextoFalso() {
  const nos: NoFalso[] = [];
  const novo = (tipo: string) => {
    const n = new NoFalso(tipo);
    nos.push(n);
    return n;
  };
  const buffers: { canais: number; amostras: number; dados: Float32Array[] }[] = [];
  const ctx = {
    sampleRate: 48000,
    currentTime: 0,
    createGain: () => novo('gain'),
    createBiquadFilter: () => novo('biquad'),
    createWaveShaper: () => novo('waveshaper'),
    createDynamicsCompressor: () => novo('compressor'),
    createDelay: () => novo('delay'),
    createConvolver: () => novo('convolver'),
    createBufferSource: () => novo('fonte'),
    createBuffer: (canais: number, amostras: number) => {
      const b = { canais, amostras, dados: Array.from({ length: canais }, () => new Float32Array(amostras)) };
      buffers.push(b);
      return { ...b, getChannelData: (c: number) => b.dados[c]! };
    },
  };
  return { ctx: ctx as unknown as BaseAudioContext, nos, buffers };
}

describe('as predefinições de voz (P231): dados', () => {
  it('são as três do Comandante, e cada número está numa faixa que faz sentido', () => {
    expect(NOMES.sort()).toEqual(['irmao', 'locutor', 'sombrio']);
    for (const nome of NOMES) {
      const p = PREDEFINICOES_DE_VOZ[nome];
      expect(p.semitons, nome).toBeLessThanOrEqual(0); // só mais grave ou igual: nenhuma vira voz de desenho animado
      expect(p.semitons, nome).toBeGreaterThanOrEqual(-12);
      if (p.passaAltas > 0 && p.passaBaixas > 0) expect(p.passaAltas, nome).toBeLessThan(p.passaBaixas);
      expect(p.compressor.limiar, nome).toBeLessThan(0);
      expect(p.compressor.razao, nome).toBeGreaterThanOrEqual(1);
      expect(p.compressor.ataque, nome).toBeGreaterThan(0);
      expect(p.compressor.soltura, nome).toBeGreaterThan(0);
      if (p.reverb) {
        expect(p.reverb.duracao, nome).toBeGreaterThan(0.1);
        expect(p.reverb.duracao, nome).toBeLessThanOrEqual(2); // a convolução é a parte cara: teto de 2 s
        expect(p.reverb.mistura, nome).toBeGreaterThan(0);
        expect(p.reverb.mistura, nome).toBeLessThan(1);
      }
      if (p.eco) {
        expect(p.eco.atraso, nome).toBeGreaterThan(0);
        expect(p.eco.ganho, nome).toBeLessThan(1); // eco que volta mais alto que a voz é microfonia
      }
    }
  });

  it('o locutor não mexe no tom (é rádio, não grave); o sombrio é o mais grave dos três', () => {
    expect(PREDEFINICOES_DE_VOZ.locutor.semitons).toBe(0);
    expect(PREDEFINICOES_DE_VOZ.sombrio.semitons).toBeLessThan(PREDEFINICOES_DE_VOZ.irmao.semitons);
  });

  it('as configurações aceitam só os quatro nomes; o resto cai em "sem efeito"', () => {
    expect(DEFAULT_SETTINGS.vozEfeito).toBe('normal');
    for (const nome of ['normal', ...NOMES] as const) expect(sanitizeSettings({ vozEfeito: nome }).vozEfeito).toBe(nome);
    for (const lixo of ['vader', 'Locutor', '', 5, null, undefined, {}]) expect(sanitizeSettings({ vozEfeito: lixo }).vozEfeito, String(lixo)).toBe('normal');
  });
});

describe('a matemática dos efeitos', () => {
  it('razaoDeSemitons: 0 não muda, −12 é a metade, +12 é o dobro', () => {
    expect(razaoDeSemitons(0)).toBe(1);
    expect(razaoDeSemitons(-12)).toBeCloseTo(0.5, 12);
    expect(razaoDeSemitons(12)).toBeCloseTo(2, 12);
    expect(razaoDeSemitons(-5)).toBeCloseTo(0.7492, 4);
  });

  it('curvaDeDistorcao: sem força é a reta; com força é ímpar, passa por zero, termina em ±1 e cresce sempre', () => {
    const reta = curvaDeDistorcao(0, 9);
    expect([...reta]).toEqual([-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]);
    const c = curvaDeDistorcao(1.5, 1025);
    expect(c[0]).toBeCloseTo(-1, 6);
    expect(c[1024]).toBeCloseTo(1, 6);
    expect(c[512]).toBeCloseTo(0, 6);
    for (let i = 0; i < 1025; i++) expect(c[i]! + c[1024 - i]!).toBeCloseTo(0, 5); // ímpar
    for (let i = 1; i < 1025; i++) expect(c[i]!).toBeGreaterThan(c[i - 1]!); // nunca desce
    // com força, o meio é mais íngreme (sobe antes) e as pontas achatam: é o que "distorce"
    expect(c[768]!).toBeGreaterThan(reta[6]!);
  });

  it('ruidoDaReverberacao: o mesmo ruído para a mesma semente, outro para outra, nunca passa de ±1 e a cauda cai pelo menos o combinado', () => {
    const a = ruidoDaReverberacao(48000, 40, 123);
    const b = ruidoDaReverberacao(48000, 40, 123);
    const c = ruidoDaReverberacao(48000, 40, 124);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(1);
    const energia = (v: Float32Array, de: number, ate: number) => v.slice(de, ate).reduce((s, x) => s + x * x, 0) / (ate - de);
    const inicio = energia(a, 0, 4800); // os primeiros 10%
    const fim = energia(a, 43200, 48000); // os últimos 10%
    expect(10 * Math.log10(inicio / fim), 'a cauda cai de 40 dB ao fim (o meio dos últimos 10% fica ~38 dB abaixo, no mínimo)').toBeGreaterThan(30);
  });
});

describe('criarCadeiaDeVoz: a cadeia de áudio', () => {
  it('"normal" não monta nada (o chamador liga a fonte direto)', () => {
    const { ctx, nos } = contextoFalso();
    expect(criarCadeiaDeVoz(ctx, 'normal')).toBeNull();
    expect(nos).toHaveLength(0);
  });

  it('cada efeito tem entrada, saída, e a saída é o limitador (o teto que impede de estourar)', () => {
    for (const nome of NOMES) {
      const { ctx } = contextoFalso();
      const cadeia = criarCadeiaDeVoz(ctx, nome)!;
      expect(cadeia, nome).not.toBeNull();
      const saida = cadeia.saida as unknown as NoFalso;
      expect(saida.tipo, nome).toBe('compressor');
      expect(saida.threshold.value, `${nome}: limitador perto do teto`).toBe(-3);
      expect(saida.ratio.value).toBe(20);
      expect(cadeia.entrada).not.toBe(cadeia.saida);
    }
  });

  it('o deslocador de tom (quatro geradores em loop) só entra onde há mudança de tom; o locutor não tem nenhum', () => {
    for (const nome of NOMES) {
      const { ctx, nos } = contextoFalso();
      criarCadeiaDeVoz(ctx, nome);
      const fontes = nos.filter((n) => n.tipo === 'fonte');
      expect(fontes.length, nome).toBe(PREDEFINICOES_DE_VOZ[nome].semitons === 0 ? 0 : 4);
      for (const f of fontes) {
        expect(f.loop, nome).toBe(true);
        expect(f.iniciadoEm, `${nome}: todo gerador foi ligado`).not.toBeNull();
      }
    }
  });

  it('a profundidade da rampa é a do tom pedido (|1 − razão| × 0,1 s): é o que decide o tom', () => {
    const { ctx, nos } = contextoFalso();
    criarCadeiaDeVoz(ctx, 'sombrio');
    const esperada = Math.abs(1 - razaoDeSemitons(PREDEFINICOES_DE_VOZ.sombrio.semitons)) * 0.1;
    // os ganhos que alimentam o TEMPO do atraso (o parâmetro `delayTime` de cada atraso): um por voz, e são duas vozes
    const atrasos = nos.filter((n) => n.tipo === 'delay');
    const profundidades = nos.filter((n) => n.tipo === 'gain' && atrasos.some((a) => n.destinos.includes(a.delayTime as never))).map((n) => n.gain.value);
    expect(profundidades).toHaveLength(2);
    for (const p of profundidades) expect(p).toBeCloseTo(esperada, 9);
  });

  it('a rampa do deslocador SOBE para o tom mais grave e DESCE para o mais agudo (o sentido é o que decide o tom); o cruzamento começa e termina em zero e vale 1 no meio', () => {
    for (const [semitons, sobe] of [[-5, true], [-12, true], [-1, true], [3, false], [12, false]] as const) {
      const { ctx, buffers } = contextoFalso();
      criarDeslocadorDeTom(ctx, semitons, { nos: [], fontes: [] });
      const rampa = buffers[0]!.dados[0]!;
      expect(rampa[0], `${semitons}: a rampa começa em ${sobe ? 0 : 1}`).toBe(sobe ? 0 : 1);
      expect(rampa[rampa.length - 1]!, `${semitons}: e termina em ${sobe ? 1 : 0}`).toBeCloseTo(sobe ? 1 : 0, 2);
      const fade = buffers[1]!.dados[0]!;
      expect(fade[0]).toBe(0);
      expect(fade[fade.length >> 1]!).toBeCloseTo(1, 2);
      expect(fade[fade.length - 1]!).toBeCloseTo(0, 1);
    }
  });

  it('o eco (atraso curto) é só do locutor e a reverberação (convolução) só do sombrio e do irmão', () => {
    const tem = (nome: PredefinicaoDeVoz, tipo: string) => {
      const { ctx, nos } = contextoFalso();
      criarCadeiaDeVoz(ctx, nome);
      return nos.some((n) => n.tipo === tipo && (tipo !== 'delay' || (n.delayTime.value > 0 && n.delayTime.value < 0.1 && nos.filter((m) => m.tipo === 'delay').length >= 1)));
    };
    expect(tem('locutor', 'delay')).toBe(true);
    expect(tem('locutor', 'convolver')).toBe(false);
    expect(tem('sombrio', 'convolver')).toBe(true);
    expect(tem('irmao', 'convolver')).toBe(true);
    const { ctx, nos } = contextoFalso();
    criarCadeiaDeVoz(ctx, 'irmao');
    expect(nos.some((n) => n.tipo === 'waveshaper'), 'o irmão não distorce').toBe(false);
  });

  it('os filtros e o compressor recebem os números da predefinição', () => {
    const { ctx, nos } = contextoFalso();
    criarCadeiaDeVoz(ctx, 'locutor');
    const p = PREDEFINICOES_DE_VOZ.locutor;
    const filtro = (tipo: string) => nos.find((n) => n.tipo === 'biquad' && n.type === tipo);
    expect(filtro('highpass')!.frequency.value).toBe(p.passaAltas);
    expect(filtro('lowpass')!.frequency.value).toBe(p.passaBaixas);
    expect(filtro('peaking')!.frequency.value).toBe(p.presenca!.hz);
    expect(filtro('peaking')!.gain.value).toBe(p.presenca!.db);
    expect(filtro('lowshelf')).toBeUndefined();
    const compressor = nos.find((n) => n.tipo === 'compressor')!;
    expect(compressor.threshold.value).toBe(p.compressor.limiar);
    expect(compressor.ratio.value).toBe(p.compressor.razao);
    expect(nos.find((n) => n.tipo === 'waveshaper')!.curve).not.toBeNull();
  });

  it('desligar para todos os geradores, solta todos os nós e pode ser chamado duas vezes', () => {
    for (const nome of NOMES) {
      const { ctx, nos } = contextoFalso();
      const cadeia = criarCadeiaDeVoz(ctx, nome)!;
      cadeia.desligar();
      for (const n of nos) {
        expect(n.solto, `${nome}: ${n.tipo} solto`).toBe(true);
        if (n.tipo === 'fonte') expect(n.parado, `${nome}: gerador parado`).toBe(true);
      }
      expect(() => cadeia.desligar()).not.toThrow();
    }
  });
});
