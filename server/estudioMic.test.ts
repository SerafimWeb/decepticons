import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * As contas do microfone do Estúdio (P286, 30/10: "ficou mudo o microfone"). O script roda no navegador; aqui ele roda num contexto sem DOM, só para exercitar o que não
 * depende de Web Audio: o filtro dos aparelhos (nunca a mixagem), o veredito em palavras e o ganho sugerido. A parte que abre o microfone de verdade é provada no Chrome
 * (`.decepticons/medicoes/estudio.mjs`).
 */
interface Aparelho { id: string; nome: string }
interface Veredito { estado: 'mudo' | 'baixo' | 'ok' | 'alto'; texto: string }
interface Mic {
  ehMixagem: (r: string) => boolean;
  aparelhosDe: (todos: { kind: string; deviceId: string; label: string }[]) => Aparelho[];
  barra: (v: number) => number;
  veredito: (pico: number, rms: number) => Veredito;
  sugerirGanho: (rms: number, ganho: number) => number | null;
  melhorDe: (achados: { id: string; estado: string; rms: number; pico: number }[]) => { id: string } | null;
}

function carregar(): Mic {
  const janela: { EstudioMic?: Mic } = {};
  runInNewContext(readFileSync(resolve('scripts/estudio/microfone.js'), 'utf8'), { window: janela });
  return janela.EstudioMic!;
}
const mic = carregar();
const entrada = (deviceId: string, label: string, kind = 'audioinput') => ({ kind, deviceId, label });

describe('Estúdio, o microfone (P286): a lista de aparelhos', () => {
  it('lista só os microfones de verdade: sem os apelidos do navegador, sem saída de som e sem a mixagem do sistema', () => {
    const lista = mic.aparelhosDe([
      entrada('default', 'Padrão - Microfone (Captain 300)'),
      entrada('communications', 'Comunicações - Headset (Captain 300 Hands-Free AG Audio)'),
      entrada('a1', 'Microfone (Captain 300) (4c4a:3158)'),
      entrada('a2', 'Mixagem estéreo (Realtek(R) Audio)'),
      entrada('a3', 'Headset (Captain 300 Hands-Free AG Audio) (Bluetooth)'),
      entrada('s1', 'Alto-falantes', 'audiooutput'),
      entrada('a4', 'Stereo Mix (Realtek)'),
    ]);
    expect(lista).toEqual([
      { id: 'a1', nome: 'Microfone (Captain 300) (4c4a:3158)' },
      { id: 'a3', nome: 'Headset (Captain 300 Hands-Free AG Audio) (Bluetooth)' },
    ]);
  });

  it('sem permissão os nomes vêm vazios: vira "Microfone N" pela posição na lista, e uma lista vazia continua vazia', () => {
    expect(mic.aparelhosDe([entrada('x', ''), entrada('y', '  ')])).toEqual([{ id: 'x', nome: 'Microfone 1' }, { id: 'y', nome: 'Microfone 2' }]);
    expect(mic.aparelhosDe([])).toEqual([]);
    expect(mic.aparelhosDe(undefined as never)).toEqual([]);
  });

  it('reconhece a mixagem do sistema em português, inglês e espanhol', () => {
    for (const r of ['Mixagem estéreo', 'Stereo Mix', 'Mezcla estéreo', 'What U Hear', 'Wave Out Mix']) expect(mic.ehMixagem(r)).toBe(true);
    for (const r of ['Microfone (Captain 300)', 'Headset', '']) expect(mic.ehMixagem(r)).toBe(false);
  });
});

describe('Estúdio, o microfone (P286): o veredito', () => {
  it('zero absoluto é SILÊNCIO TOTAL e diz o que fazer, e o chiado mais fraco que existe já é "há sinal"', () => {
    const v = mic.veredito(0, 0);
    expect(v.estado).toBe('mudo');
    expect(v.texto).toContain('SILÊNCIO TOTAL');
    expect(v.texto).toContain('PROCURAR O QUE FUNCIONA');
    expect(mic.veredito(0.0002, 0.0001).estado).toBe('baixo');
  });

  it('sinal sem voz é "baixo"; voz de fala comum é "ok"; encostar no teto é "alto"', () => {
    expect(mic.veredito(0.05, 0.005).estado).toBe('baixo');
    expect(mic.veredito(0.4, 0.08).estado).toBe('ok');
    expect(mic.veredito(0.99, 0.3).estado).toBe('alto');
    expect(mic.veredito(0.4, 0.08).texto).toContain('dB');
  });

  it('a barra é em decibéis (−60 dBFS vazio, 0 cheio): a voz de um fone baixinho ainda aparece', () => {
    expect(mic.barra(0)).toBe(0);
    expect(mic.barra(1)).toBe(100);
    expect(mic.barra(0.1)).toBe(67); // −20 dBFS
    expect(mic.barra(0.01)).toBeGreaterThan(30); // numa barra linear daria 1%
  });
});

describe('Estúdio, o microfone (P286): ganho e escolha', () => {
  it('sugere o ganho que leva a voz ao alvo, arredondado a 0,5 e nunca acima de ×8', () => {
    expect(mic.sugerirGanho(0.02, 1)).toBe(5); // voz a −34 dB: ×5 leva a ≈ −20 dB
    expect(mic.sugerirGanho(0.005, 1)).toBe(8); // o teto
    expect(mic.sugerirGanho(0.02, 2)).toBe(8); // quem já subiu o ganho parte dele
  });

  it('não sugere nada quando não houve voz (só chiado), quando a voz já está boa ou quando o ganho já está no máximo', () => {
    expect(mic.sugerirGanho(0.001, 1)).toBeNull();
    expect(mic.sugerirGanho(0.09, 1)).toBeNull();
    expect(mic.sugerirGanho(0.02, 8)).toBeNull();
  });

  it('a busca escolhe o aparelho com sinal de maior nível e nunca um mudo ou um que nem abriu', () => {
    const achados = [
      { id: 'usb', estado: 'mudo', rms: 0, pico: 0 },
      { id: 'quebrado', estado: 'erro', rms: 0, pico: 0 },
      { id: 'bt', estado: 'baixo', rms: 0.004, pico: 0.02 },
      { id: 'cam', estado: 'ok', rms: 0.05, pico: 0.3 },
    ];
    expect(mic.melhorDe(achados)?.id).toBe('cam');
    expect(mic.melhorDe(achados.slice(0, 2))).toBeNull(); // todos mudos: ninguém é escolhido (a tela diz o que fazer no Windows)
  });
});
