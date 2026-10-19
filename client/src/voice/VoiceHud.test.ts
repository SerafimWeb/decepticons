import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { carregarDicionario, IDIOMAS, traduzir, type Dicionario } from '../i18n/i18n';
import { textoDeEstado, textoDeRede, type VozParaHud } from './VoiceHud';

const RAIZ = resolve(__dirname, '../..');

const voz = (o: { estadoMic?: VozParaHud['estadoMic']; mode?: 'sempre' | 'ptt'; mudo?: boolean; apertada?: boolean; semConexao?: number } = {}): VozParaHud => ({
  ativa: true,
  estadoMic: o.estadoMic ?? 'ativo',
  ligados: 0,
  semConexao: o.semConexao ?? 0,
  falando: () => new Set<number>(),
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

  it('o aviso de rede só aparece quando alguém não conectou', () => {
    expect(textoDeRede(voz())).toBe('');
    expect(textoDeRede(voz({ semConexao: 2 }))).toBe('2 SEM CONEXÃO');
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
    textoDeRede(voz({ semConexao: 3 })),
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
