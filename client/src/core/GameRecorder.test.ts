import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioSystem } from '../audio/AudioSystem';
import { GameRecorder } from './GameRecorder';

/**
 * Os testes rodam no Node, sem `MediaRecorder` nem `canvas.captureStream` de verdade — o que se prova aqui
 * é que o módulo nunca lança quando os dois faltam (o boot headless do smoke, e qualquer navegador sem
 * suporte), e que a tecla escondida (F9, ver Game.ts) sempre tem algo seguro para chamar.
 */
describe('GameRecorder (gravação nativa, dono, 28/09)', () => {
  const canvasSemSuporte = {} as HTMLCanvasElement; // sem captureStream: o mesmo que um navegador antigo

  it('nasce parado', () => {
    const r = new GameRecorder(canvasSemSuporte, new AudioSystem());
    expect(r.gravando).toBe(false);
  });

  it('sem captureStream/MediaRecorder, alternar() não lança e não liga a gravação', () => {
    const r = new GameRecorder(canvasSemSuporte, new AudioSystem());
    expect(() => r.alternar()).not.toThrow();
    expect(r.gravando).toBe(false);
  });

  it('chamar alternar() várias vezes seguidas (a tecla F9 apertada repetido) nunca lança', () => {
    const r = new GameRecorder(canvasSemSuporte, new AudioSystem());
    for (let i = 0; i < 5; i++) expect(() => r.alternar()).not.toThrow();
  });
});

/** O navegador de mentira: o mínimo de MediaRecorder, canvas, áudio e documento que a gravação usa. */
function ambienteDaGravacao(opcoes: { comAudio?: boolean } = {}) {
  const comAudio = opcoes.comAudio ?? true;
  const eventos: string[] = [];
  class MediaRecorderFalso {
    static isTypeSupported = () => true;
    state: 'inactive' | 'recording' = 'inactive';
    ondataavailable: ((e: { data: { size: number; type: string } }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor(public stream: { tracks: unknown[] }) {}
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: { size: 10, type: 'video/webm' } });
      this.onstop?.();
    }
  }
  class MediaStreamFalso {
    constructor(public tracks: unknown[] = []) {}
    getTracks() {
      return this.tracks;
    }
  }
  const elementos: { tag: string; textContent: string; innerHTML: string; style: { cssText: string }; remove(): void }[] = [];
  const documento = {
    createElement: (tag: string) => {
      const el = { tag, textContent: '', innerHTML: '', style: { cssText: '' }, href: '', download: '', click: () => eventos.push('download'), remove: () => void elementos.splice(elementos.indexOf(el as never), 1) };
      return el;
    },
    body: { appendChild: (e: never) => void elementos.push(e) },
    head: { appendChild: () => {} },
    getElementById: () => null,
  };
  vi.stubGlobal('MediaRecorder', MediaRecorderFalso);
  vi.stubGlobal('MediaStream', MediaStreamFalso);
  vi.stubGlobal('document', documento);
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
  const canvas = { captureStream: () => ({ getVideoTracks: () => [{ requestFrame: () => {} }] }) } as unknown as HTMLCanvasElement;
  const destino = { stream: { getAudioTracks: () => [{ kind: 'audio-da-mistura' }] } };
  const fontes: { conectouEm: unknown[]; desconectou: boolean }[] = [];
  const ctx = {
    createMediaStreamDestination: () => destino,
    createMediaStreamSource: () => {
      const f = { conectouEm: [] as unknown[], desconectou: false, connect: (d: unknown) => void f.conectouEm.push(d), disconnect: () => void (f.desconectou = true) };
      fontes.push(f);
      return f;
    },
  };
  const audio = {
    context: comAudio ? ctx : null,
    connectRecorder: (d: unknown) => eventos.push(d === destino ? 'jogo->gravacao' : 'jogo->outro'),
    disconnectRecorder: () => eventos.push('jogo-solto'),
  } as unknown as AudioSystem;
  const microfone = () => {
    const faixa = { parada: false, stop() { faixa.parada = true; } };
    return { faixa, fluxo: { getTracks: () => [faixa] } as unknown as MediaStream };
  };
  return { canvas, audio, destino, fontes, eventos, elementos, microfone };
}

describe('GameRecorder: a narração, F10 (P230)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('com o microfone, a voz entra na MISTURA DA GRAVAÇÃO (o destino da gravação) e em nenhum outro lugar', () => {
    const a = ambienteDaGravacao();
    const r = new GameRecorder(a.canvas, a.audio);
    const mic = a.microfone();
    r.alternar(mic.fluxo);
    expect(r.gravando).toBe(true);
    expect(a.fontes).toHaveLength(1);
    expect(a.fontes[0]!.conectouEm, 'o microfone vai só ao destino da gravação, não à saída do jogo').toEqual([a.destino]);
    expect(a.eventos).toContain('jogo->gravacao');
    expect(mic.faixa.parada, 'o microfone fica aberto enquanto grava').toBe(false);
  });

  it('o indicador diz que é com narração; sem microfone diz só REC', () => {
    const a = ambienteDaGravacao();
    const com = new GameRecorder(a.canvas, a.audio);
    com.alternar(a.microfone().fluxo);
    expect(a.elementos.at(-1)!.innerHTML).toContain('REC · NARRAÇÃO');
    com.alternar();
    const b = ambienteDaGravacao();
    const sem = new GameRecorder(b.canvas, b.audio);
    sem.alternar();
    expect(b.elementos.at(-1)!.innerHTML).toContain('REC');
    expect(b.elementos.at(-1)!.innerHTML).not.toContain('NARRAÇÃO');
  });

  it('parar solta o microfone (a faixa termina), desconecta a voz da mistura e baixa o arquivo', () => {
    const a = ambienteDaGravacao();
    const r = new GameRecorder(a.canvas, a.audio);
    const mic = a.microfone();
    r.alternar(mic.fluxo);
    r.alternar();
    expect(r.gravando).toBe(false);
    expect(mic.faixa.parada).toBe(true);
    expect(a.fontes[0]!.desconectou).toBe(true);
    expect(a.eventos).toContain('download');
  });

  it('F9 (sem microfone) não cria nenhuma fonte de voz: grava só o jogo, como sempre', () => {
    const a = ambienteDaGravacao();
    const r = new GameRecorder(a.canvas, a.audio);
    r.alternar();
    expect(r.gravando).toBe(true);
    expect(a.fontes).toHaveLength(0);
    r.alternar();
  });

  it('sem áudio do jogo ainda (sem contexto), a narração NÃO começa (uma gravação sem a voz enganaria), solta o microfone e avisa', () => {
    const a = ambienteDaGravacao({ comAudio: false });
    const r = new GameRecorder(a.canvas, a.audio);
    const mic = a.microfone();
    r.alternar(mic.fluxo);
    expect(r.gravando).toBe(false);
    expect(a.fontes).toHaveLength(0);
    expect(mic.faixa.parada, 'o microfone aberto à toa é solto na hora').toBe(true);
    expect(a.elementos.at(-1)!.textContent).toContain('o áudio do jogo ainda não começou');
  });

  it('sem áudio do jogo, F9 (sem microfone) continua gravando só o vídeo, como antes', () => {
    const a = ambienteDaGravacao({ comAudio: false });
    const r = new GameRecorder(a.canvas, a.audio);
    r.alternar();
    expect(r.gravando).toBe(true);
    r.alternar();
  });

  it('um microfone que chega tarde, com a gravação já ligada (o navegador demorou a perguntar), é solto na hora e não troca nada', () => {
    const a = ambienteDaGravacao();
    const r = new GameRecorder(a.canvas, a.audio);
    r.alternar(); // já gravando, sem voz
    const atrasado = a.microfone();
    r.alternar(atrasado.fluxo); // a tecla faz o papel de parar
    expect(atrasado.faixa.parada).toBe(true);
    expect(r.gravando).toBe(false);
    expect(a.fontes).toHaveLength(0);
  });

  it('sem suporte do navegador (canvas sem captureStream), com áudio e microfone: não lança, não grava e não deixa o microfone aberto', () => {
    const a = ambienteDaGravacao(); // com áudio: é o ramo de reserva, não a guarda "sem áudio"
    const r = new GameRecorder({} as HTMLCanvasElement, a.audio);
    const mic = a.microfone();
    expect(() => r.alternar(mic.fluxo)).not.toThrow();
    expect(r.gravando).toBe(false);
    expect(a.fontes, 'nada foi ligado').toHaveLength(0);
    expect(mic.faixa.parada).toBe(true);
  });

  it('avisar mostra a frase no canto e some em 4 s; outra frase troca a anterior', () => {
    vi.useFakeTimers();
    try {
      const a = ambienteDaGravacao();
      const r = new GameRecorder(a.canvas, a.audio);
      r.avisar('primeira');
      expect(a.elementos).toHaveLength(1);
      expect(a.elementos[0]!.textContent).toBe('primeira');
      r.avisar('segunda');
      expect(a.elementos).toHaveLength(1);
      expect(a.elementos[0]!.textContent).toBe('segunda');
      vi.advanceTimersByTime(3999);
      expect(a.elementos).toHaveLength(1);
      vi.advanceTimersByTime(2);
      expect(a.elementos).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
