import { describe, expect, it } from 'vitest';
import { COMPRESSORES, duracaoFinal, filtrosDeEfeitos, filtroDeTempoETom, LIMITES, passosDeAtempo, resumoDosEfeitos, validarEfeitos } from '../scripts/efeitosLib.mjs';
import { argsDaMedicao, argsDoFfmpeg, cadeiaBase, validarMapa, type MapaDeSons, type SomDeArma } from '../scripts/sonsLib.mjs';

const ALVO = { media_db: -18, pico_db: -1 };
const som = (parcial: Partial<SomDeArma> = {}): SomDeArma => ({ destino: 'arma_x.mp3', fonte: 'x.mp3', de: 0, ate: 1, fade_ms: 100, ...parcial });
const mapa = (s: SomDeArma): MapaDeSons => ({ alvo: ALVO, sons: [s] });
const filtroDe = (args: string[]) => args[args.indexOf('-af') + 1]!;

describe('efeitos do estúdio (P155): a validação', () => {
  it('sem efeitos (ou objeto vazio) é válido; campos dentro dos limites também', () => {
    expect(validarEfeitos(undefined)).toEqual([]);
    expect(validarEfeitos({})).toEqual([]);
    expect(validarEfeitos({ velocidade: 0.8, pitch_st: -3, graves_db: 4, compressor: 'forte', eco_ms: 120, eco_decay: 0.4, saturacao: 0.3, reverso: true, passa_alta_hz: 300, passa_baixa_hz: 3400, ruido_db: 12, fade_in_ms: 20 })).toEqual([]);
  });

  it('recusa cada campo fora do limite, nos dois lados, e o que não é número', () => {
    for (const [campo, [min, max]] of Object.entries(LIMITES)) {
      if (campo === 'passa_alta_hz' || campo === 'passa_baixa_hz' || campo === 'eco_ms') continue; // têm regra própria de "0 = desligado" e piso
      expect(validarEfeitos({ [campo]: max + 0.5 }).join(), `${campo} acima`).toContain(campo);
      expect(validarEfeitos({ [campo]: min - 0.5 }).join(), `${campo} abaixo`).toContain(campo);
    }
    expect(validarEfeitos({ velocidade: '1' }).join()).toContain('velocidade');
    expect(validarEfeitos({ velocidade: NaN }).join()).toContain('velocidade');
    expect(validarEfeitos({ pitch_st: Infinity }).join()).toContain('pitch_st');
  });

  it('recusa efeito desconhecido, compressor inventado, reverso que não é booleano, "efeitos" que não é objeto, e os pisos de filtro e eco', () => {
    expect(validarEfeitos({ chorus: 3 }).join()).toContain('desconhecido');
    expect(validarEfeitos({ compressor: 'extremo' }).join()).toContain('compressor');
    expect(validarEfeitos({ compressor: 0 })).toEqual([]);
    expect(validarEfeitos({ reverso: 1 }).join()).toContain('reverso');
    for (const ruim of [null, 3, 'x', []]) expect(validarEfeitos(ruim).join(), String(ruim)).toContain('"efeitos" tem de ser um objeto');
    expect(validarEfeitos({ passa_alta_hz: 10 }).join()).toContain('passa_alta_hz');
    expect(validarEfeitos({ passa_baixa_hz: 500 }).join()).toContain('passa_baixa_hz');
    expect(validarEfeitos({ eco_ms: 5 }).join()).toContain('eco_ms');
    expect(validarEfeitos({ passa_alta_hz: 0, passa_baixa_hz: 0, eco_ms: 0 })).toEqual([]);
  });
});

describe('efeitos do estúdio: a cadeia de filtros', () => {
  it('sem efeitos não acrescenta filtro nenhum', () => {
    expect(filtrosDeEfeitos({})).toEqual([]);
    expect(filtrosDeEfeitos(undefined)).toEqual([]);
  });

  it('cada efeito liga o filtro certo, e só ele', () => {
    expect(filtrosDeEfeitos({ reverso: true })).toEqual(['areverse']);
    expect(filtrosDeEfeitos({ passa_alta_hz: 300 })).toEqual(['highpass=f=300']);
    expect(filtrosDeEfeitos({ passa_baixa_hz: 3400 })).toEqual(['lowpass=f=3400']);
    expect(filtrosDeEfeitos({ ruido_db: 12 })).toEqual(['afftdn=nr=12:nf=-35']);
    expect(filtrosDeEfeitos({ graves_db: 4 })).toEqual(['bass=g=4:f=110:w=0.7']);
    expect(filtrosDeEfeitos({ agudos_db: -3 })).toEqual(['treble=g=-3:f=3200:w=0.7']);
    expect(filtrosDeEfeitos({ compressor: 'forte' })).toEqual([COMPRESSORES.forte]);
    expect(filtrosDeEfeitos({ eco_ms: 120, eco_decay: 0.4 })).toEqual(['aecho=0.8:0.7:120:0.40']);
    expect(filtrosDeEfeitos({ saturacao: 0.5 }).join()).toContain('asoftclip=type=tanh');
  });

  it('a ordem soa bem: limpeza, tom e velocidade, equalização, saturação, compressor e eco por último', () => {
    const f = filtrosDeEfeitos({ reverso: true, passa_alta_hz: 300, pitch_st: 2, graves_db: 3, saturacao: 0.3, compressor: 'leve', eco_ms: 100 }, { rubberband: true }).join('|');
    const pos = (txt: string) => f.indexOf(txt);
    expect(pos('areverse')).toBeLessThan(pos('highpass'));
    expect(pos('highpass')).toBeLessThan(pos('rubberband'));
    expect(pos('rubberband')).toBeLessThan(pos('bass='));
    expect(pos('bass=')).toBeLessThan(pos('asoftclip'));
    expect(pos('asoftclip')).toBeLessThan(pos('acompressor'));
    expect(pos('acompressor')).toBeLessThan(pos('aecho'));
  });

  it('tom e velocidade: com o rubberband é um filtro só; sem ele, asetrate + atempo corrigindo a velocidade', () => {
    expect(filtroDeTempoETom(0.8, 0, true)).toEqual(['rubberband=tempo=0.8000:pitch=1.0000']);
    expect(filtroDeTempoETom(1, 12, true)).toEqual(['rubberband=tempo=1.0000:pitch=2.0000']); // uma oitava = o dobro da frequência
    expect(filtroDeTempoETom(1, 0, false)).toEqual([]);
    expect(filtroDeTempoETom(0.8, 0, false)).toEqual(['atempo=0.8000']);
    // tom +12 st sem mudar a duração: o asetrate dobra a taxa e o atempo corrige pela metade
    expect(filtroDeTempoETom(1, 12, false)).toEqual(['asetrate=88200', 'aresample=44100', 'atempo=0.5000']);
  });

  it('o atempo só aceita de 0,5 a 2: fatores fora disso viram passos que multiplicam de volta ao fator', () => {
    for (const fator of [0.25, 0.3, 0.5, 1, 1.7, 2, 3.5, 4]) {
      const passos = passosDeAtempo(fator);
      for (const p of passos) { expect(p).toBeGreaterThanOrEqual(0.5 - 1e-9); expect(p).toBeLessThanOrEqual(2 + 1e-9); }
      expect(passos.reduce((a, b) => a * b, 1)).toBeCloseTo(fator, 9);
    }
  });

  it('o resumo diz só o que está ligado', () => {
    expect(resumoDosEfeitos({})).toEqual([]);
    expect(resumoDosEfeitos({ pitch_st: -3, compressor: 'forte', eco_ms: 90, velocidade: 1 })).toEqual(['tom -3 st', 'compressor forte', 'eco 90 ms']);
  });
});

describe('efeitos do estúdio: a duração e a montagem do ffmpeg', () => {
  it('a duração final é a do corte dividida pela velocidade (esticar = mais longo, comprimir = mais curto)', () => {
    expect(duracaoFinal(som({ de: 0.5, ate: 1.5 }))).toBe(1);
    expect(duracaoFinal(som({ de: 0, ate: 1, efeitos: { velocidade: 0.5 } }))).toBe(2);
    expect(duracaoFinal(som({ de: 0, ate: 1, efeitos: { velocidade: 2 } }))).toBe(0.5);
  });

  it('a prévia e o arquivo final usam a MESMA cadeia: a medição e a gravação partem de cadeiaBase', () => {
    const s = som({ de: 0.1, ate: 0.9, efeitos: { pitch_st: -3, compressor: 'medio', eco_ms: 80, graves_db: 4 } });
    const base = cadeiaBase(s, { rubberband: true });
    const medicao = filtroDe(argsDaMedicao(s, 'e.mp3', { rubberband: true }));
    const gravacao = filtroDe(argsDoFfmpeg(s, 'e.mp3', 's.mp3', -5, ALVO, { rubberband: true }));
    expect(medicao.startsWith(base.join(','))).toBe(true);
    expect(gravacao.startsWith(base.join(','))).toBe(true);
    expect(medicao.endsWith('volumedetect')).toBe(true);
    expect(base[0]).toBe('atrim=start=0.1:end=0.9');
    expect(base).toContain('aresample=44100');
    // os efeitos entram antes do volume e dos fades (o ganho é medido DEPOIS deles)
    expect(gravacao.indexOf('rubberband')).toBeLessThan(gravacao.indexOf('volume=-5.00dB'));
    expect(gravacao.indexOf('aecho')).toBeLessThan(gravacao.indexOf('volume=-5.00dB'));
  });

  it('o som termina na duração final (a cauda do eco e do tempo é cortada) e o fade de saída conta dela, não do corte', () => {
    const s = som({ de: 0, ate: 1, fade_ms: 200, efeitos: { velocidade: 0.5 } }); // 1 s de corte viram 2 s
    const f = filtroDe(argsDoFfmpeg(s, 'e.mp3', 's.mp3', 0, ALVO));
    expect(f).toContain('atrim=end=2.000');
    expect(f).toContain('afade=t=out:st=1.800:d=0.200');
  });

  it('o fade de entrada dos efeitos vale; sem ele, são 3 ms contra clique', () => {
    expect(filtroDe(argsDoFfmpeg(som(), 'e', 's', 0, ALVO))).toContain('afade=t=in:st=0:d=0.003');
    expect(filtroDe(argsDoFfmpeg(som({ efeitos: { fade_in_ms: 50 } }), 'e', 's', 0, ALVO))).toContain('afade=t=in:st=0:d=0.050');
  });

  it('o mapa valida os efeitos do clipe e a duração DEPOIS deles: esticar um corte de 3 s para 6 s passa do limite de 4 s', () => {
    expect(validarMapa(mapa(som({ de: 0, ate: 3, fade_ms: 100 })))).toEqual([]);
    expect(validarMapa(mapa(som({ de: 0, ate: 3, efeitos: { velocidade: 0.5 } }))).join()).toContain('mais de 4 s');
    expect(validarMapa(mapa(som({ de: 0, ate: 4, efeitos: { velocidade: 2 } })))).toEqual([]); // comprimir encurta: 2 s
    expect(validarMapa(mapa(som({ efeitos: { pitch_st: 99 } }))).join()).toContain('pitch_st');
    expect(validarMapa(mapa(som({ efeitos: { chorus: 1 } as never }))).join()).toContain('desconhecido');
  });

  it('o fade vale contra a duração depois dos efeitos: comprimir pela metade encurta o que o fade pode ter', () => {
    expect(validarMapa(mapa(som({ de: 0, ate: 1, fade_ms: 400 })))).toEqual([]);
    expect(validarMapa(mapa(som({ de: 0, ate: 1, fade_ms: 400, efeitos: { velocidade: 2 } }))).join()).toContain('fade');
    expect(validarMapa(mapa(som({ de: 0, ate: 1, efeitos: { fade_in_ms: 600 } }))).join()).toContain('fade de entrada');
  });
});
