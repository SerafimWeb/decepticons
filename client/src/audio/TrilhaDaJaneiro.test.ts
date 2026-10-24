import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioSystem } from './AudioSystem';
import { TrilhaDaJaneiro } from './TrilhaDaJaneiro';

/** Um nó de áudio de mentira: só os métodos que `TrilhaDaJaneiro` chama. */
function fakeNode() {
  return { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 0 }, start: vi.fn(), stop: vi.fn(), buffer: null as unknown, onended: null as (() => void) | null };
}

/** Um `AudioSystem` de mentira cujo `output` começa `null` (antes do clique do jogador) e é ligado à mão. */
function fakeAudio() {
  const buffer = { duration: 1 };
  const ctx = { createGain: vi.fn(fakeNode), createBufferSource: vi.fn(fakeNode), decodeAudioData: vi.fn(() => Promise.resolve(buffer)) };
  const state = { output: null as { ctx: typeof ctx; out: ReturnType<typeof fakeNode> } | null };
  const audio = { get output() { return state.output; } } as unknown as AudioSystem;
  const ligar = () => { state.output = { ctx, out: fakeNode() }; };
  return { audio, ctx, ligar };
}

describe('TrilhaDaJaneiro (P248/P253): a trilha do 8 de Janeiro alterna entre as faixas, e espera o contexto de áudio nascer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sem contexto ainda (achado 24/10: a missão monta no construtor do Game, antes do clique), tenta de nada a cada 500 ms até o contexto nascer, e então toca', async () => {
    const { audio, ctx, ligar } = fakeAudio();
    const trilha = new TrilhaDaJaneiro(audio);
    trilha.tocar(['berrante.mp3', 'trompetista.mp3']);
    expect(ctx.createBufferSource).not.toHaveBeenCalled(); // ainda não há contexto: não tentou decodificar nem tocar
    await vi.advanceTimersByTimeAsync(500); // a primeira tentativa de novo, ainda sem contexto
    expect(ctx.createBufferSource).not.toHaveBeenCalled();
    ligar();
    await vi.advanceTimersByTimeAsync(500); // agora o contexto existe: esta tentativa vai até o fim
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
  });

  it('chamar tocar() de novo enquanto já espera o contexto não duplica a tentativa', async () => {
    const { ctx, audio } = fakeAudio();
    const trilha = new TrilhaDaJaneiro(audio);
    trilha.tocar(['berrante.mp3', 'trompetista.mp3']);
    trilha.tocar(['berrante.mp3', 'trompetista.mp3']);
    trilha.tocar(['berrante.mp3', 'trompetista.mp3']);
    await vi.advanceTimersByTimeAsync(500);
    // só uma tentativa pendente (os `setTimeout`s extras foram ignorados pelo guard `this.tentativa`); sem contexto, nada toca ainda.
    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it('alterna entre as duas faixas: a primeira termina (onended) e a segunda começa sozinha, sem laço por faixa', async () => {
    const { audio, ctx, ligar } = fakeAudio();
    ligar();
    const trilha = new TrilhaDaJaneiro(audio);
    trilha.tocar(['berrante.mp3', 'trompetista.mp3']);
    await vi.runAllTimersAsync();
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
    const primeira = ctx.createBufferSource.mock.results[0]!.value as ReturnType<typeof fakeNode>;
    expect(primeira.start).toHaveBeenCalledTimes(1);
    primeira.onended?.(); // a faixa 1 terminou sozinha
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(2); // a faixa 2 começou, sem precisar de laço por faixa
    const segunda = ctx.createBufferSource.mock.results[1]!.value as ReturnType<typeof fakeNode>;
    segunda.onended?.(); // a faixa 2 terminou: volta pra 1 (revezamento em ciclo)
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(3);
  });

  it('parar() cancela a tentativa pendente (nenhum setTimeout sobrevive à missão acabando antes do contexto nascer)', async () => {
    const { ctx, audio } = fakeAudio();
    const trilha = new TrilhaDaJaneiro(audio);
    trilha.tocar(['berrante.mp3', 'trompetista.mp3']);
    trilha.parar();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });
});
