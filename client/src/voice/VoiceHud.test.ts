import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { carregarDicionario, IDIOMAS, traduzir, type Dicionario } from '../i18n/i18n';
import { estadoDoBotao, GLIFO_DO_BOTAO, textoDeEstado, textoDeRede, type VozParaHud } from './VoiceHud';

const RAIZ = resolve(__dirname, '../..');

const voz = (o: { estadoMic?: VozParaHud['estadoMic']; mode?: 'sempre' | 'ptt'; mudo?: boolean; apertada?: boolean; semConexao?: number; colegas?: number } = {}): VozParaHud => ({
  ativa: true,
  estadoMic: o.estadoMic ?? 'ativo',
  ligados: 0,
  semConexao: o.semConexao ?? 0,
  colegas: o.colegas ?? 1,
  falando: () => new Set<number>(),
  aoBotao: () => {},
  mic: { mode: o.mode ?? 'sempre', mudo: o.mudo ?? false, apertada: o.apertada ?? false, transmitindo: false },
});

describe('VoiceHud: o que o jogador lê (P205)', () => {
  it('cada estado do microfone tem o seu texto, com o nome da tecla', () => {
    expect(textoDeEstado(voz({ estadoMic: 'pedindo' }), 'T')).toBe('PEDINDO O MICROFONE…');
    expect(textoDeEstado(voz({ estadoMic: 'negado' }), 'T')).toBe('SÓ OUVINDO: MICROFONE RECUSADO');
    expect(textoDeEstado(voz({ estadoMic: 'sem' }), 'T')).toBe('SÓ OUVINDO: SEM MICROFONE');
    expect(textoDeEstado(voz({ mode: 'sempre' }), 'T')).toBe('MICROFONE ABERTO: [T] MUDA');
    expect(textoDeEstado(voz({ mode: 'sempre', mudo: true }), 'V')).toBe('MUDO: [V] ABRE');
    expect(textoDeEstado(voz({ mode: 'ptt' }), 'T')).toBe('SEGURE [T] PARA FALAR');
    expect(textoDeEstado(voz({ mode: 'ptt', apertada: true }), 'T')).toBe('FALANDO');
  });

  it('no toque o texto fala do botão da tela (sem tecla), em cada modo (P209)', () => {
    expect(textoDeEstado(voz({ mode: 'sempre' }), 'T', true)).toBe('MICROFONE ABERTO');
    expect(textoDeEstado(voz({ mode: 'sempre', mudo: true }), 'T', true)).toBe('MUDO');
    expect(textoDeEstado(voz({ mode: 'ptt' }), 'T', true)).toBe('SEGURE O BOTÃO PARA FALAR');
    expect(textoDeEstado(voz({ mode: 'ptt', apertada: true }), 'T', true)).toBe('FALANDO');
    // sem microfone o texto é o do aparelho, no toque ou fora dele
    expect(textoDeEstado(voz({ estadoMic: 'negado' }), 'T', true)).toBe('SÓ OUVINDO: MICROFONE RECUSADO');
    expect(textoDeEstado(voz({ estadoMic: 'pedindo' }), 'T', true)).toBe('PEDINDO O MICROFONE…');
    // nenhum texto do toque cita uma tecla
    for (const o of [{ mode: 'sempre' as const }, { mode: 'sempre' as const, mudo: true }, { mode: 'ptt' as const }]) expect(textoDeEstado(voz(o), 'T', true)).not.toContain('[');
  });

  it('o botão de microfone da tela: no ar, mudo, em espera (segurar solto), pedindo e sem microfone, cada um com o seu símbolo (P209)', () => {
    expect(estadoDoBotao(voz({ mode: 'sempre' }))).toBe('no-ar');
    expect(estadoDoBotao(voz({ mode: 'sempre', mudo: true }))).toBe('mudo');
    expect(estadoDoBotao(voz({ mode: 'ptt' }))).toBe('espera');
    expect(estadoDoBotao(voz({ mode: 'ptt', apertada: true }))).toBe('no-ar');
    expect(estadoDoBotao(voz({ estadoMic: 'pedindo' }))).toBe('pedindo');
    expect(estadoDoBotao(voz({ estadoMic: 'negado' }))).toBe('sem');
    expect(estadoDoBotao(voz({ estadoMic: 'sem', mode: 'ptt', apertada: true }))).toBe('sem');
    expect(new Set(Object.values(GLIFO_DO_BOTAO)).size).toBeGreaterThanOrEqual(4);
    expect(GLIFO_DO_BOTAO.mudo).not.toBe(GLIFO_DO_BOTAO['no-ar']);
  });

  it('o aviso de rede só aparece quando alguém não conectou', () => {
    expect(textoDeRede(voz())).toBe('');
    expect(textoDeRede(voz({ semConexao: 2 }))).toBe('2 SEM CONEXÃO');
  });

  it('sozinho na voz o indicador avisa que ninguém vai ouvir e manda testar o microfone (P212: o "MICROFONE ABERTO" sozinho enganava)', () => {
    expect(textoDeRede(voz({ colegas: 0 }))).toBe('NINGUÉM MAIS NA VOZ: TESTE O MICROFONE EM CONFIGURAÇÕES');
    expect(textoDeRede(voz({ colegas: 1 }))).toBe('');
    // a falha de rede tem prioridade sobre o aviso de estar sozinho
    expect(textoDeRede(voz({ colegas: 2, semConexao: 1 }))).toBe('1 SEM CONEXÃO');
  });

  it('sem microfone o modo e o mudo não importam: o estado é o do aparelho', () => {
    expect(textoDeEstado(voz({ estadoMic: 'negado', mode: 'ptt', apertada: true }), 'T')).toBe('SÓ OUVINDO: MICROFONE RECUSADO');
    expect(textoDeEstado(voz({ estadoMic: 'sem', mudo: true }), 'T')).toBe('SÓ OUVINDO: SEM MICROFONE');
  });
});

describe('o chat de voz nas seis línguas (P205)', () => {
  afterEach(() => carregarDicionario(null));

  const textosDoHud = [
    textoDeEstado(voz({ estadoMic: 'pedindo' }), 'T'),
    textoDeEstado(voz({ estadoMic: 'negado' }), 'T'),
    textoDeEstado(voz({ estadoMic: 'sem' }), 'T'),
    textoDeEstado(voz({ mode: 'sempre' }), 'T'),
    textoDeEstado(voz({ mode: 'sempre', mudo: true }), 'T'),
    textoDeEstado(voz({ mode: 'ptt' }), 'T'),
    textoDeEstado(voz({ mode: 'ptt', apertada: true }), 'T'),
    textoDeEstado(voz({ mode: 'sempre' }), 'T', true),
    textoDeEstado(voz({ mode: 'sempre', mudo: true }), 'T', true),
    textoDeEstado(voz({ mode: 'ptt' }), 'T', true),
    textoDeRede(voz({ semConexao: 3 })),
    textoDeRede(voz({ colegas: 0 })),
  ];

  for (const { id } of IDIOMAS.filter((i) => i.id !== 'pt')) {
    it(`${id}: todo texto do indicador está traduzido, e a tecla entra na frase`, () => {
      carregarDicionario(JSON.parse(readFileSync(resolve(RAIZ, `public/locales/${id}.json`), 'utf8')) as Dicionario);
      for (const texto of textosDoHud) expect(traduzir(texto), `${id}: "${texto}"`).not.toBe(texto);
      expect(traduzir('SEGURE [Y] PARA FALAR')).toContain('[Y]');
      expect(traduzir('3 SEM CONEXÃO')).toContain('3');
    });
  }
});
