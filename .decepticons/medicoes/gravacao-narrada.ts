import { GameRecorder } from '../../client/src/core/GameRecorder';
import { criarCadeiaDeVoz } from '../../client/src/voice/EfeitosDeVoz';
import type { VozEfeito } from '../../client/src/core/Settings';
import type { AudioSystem } from '../../client/src/audio/AudioSystem';

/**
 * A página da bancada `gravacao-narrada.mjs`: o `GameRecorder` **de verdade** gravando um canvas animado, com dois tons conhecidos: o **jogo** (300 Hz, na saída principal, como o `masterGain` do
 * `AudioSystem`) e a **voz** (1000 Hz, o "microfone": um fluxo que só existe para a bancada). A bancada de fora mede o arquivo gravado e confere que a voz só entrou na gravação.
 * Um analisador na saída do jogo mede o que o alto-falante receberia: a voz **nunca** pode aparecer ali (quem narra não se ouve em eco).
 */
const FREQ_JOGO = 300;
const FREQ_VOZ = 1000;
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Resultado {
  gravando: boolean;
  faixaDoMic: string | null;
  vozNaSaidaDb: number;
  jogoNaSaidaDb: number;
  quadros: number;
  baixou: boolean;
}

(window as unknown as { __gravar: unknown }).__gravar = async (comVoz: boolean, segundos: number, efeito: VozEfeito = 'normal'): Promise<Resultado> => {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  document.body.appendChild(canvas);
  const c2 = canvas.getContext('2d')!;

  const ctx = new AudioContext();
  await ctx.resume();
  const saida = ctx.createGain(); // o "masterGain" do jogo
  saida.gain.value = 0.2;
  const tomJogo = ctx.createOscillator();
  tomJogo.frequency.value = FREQ_JOGO;
  tomJogo.connect(saida);
  tomJogo.start();
  const analisador = ctx.createAnalyser();
  analisador.fftSize = 8192;
  saida.connect(analisador);
  analisador.connect(ctx.destination);

  const audio = {
    context: ctx,
    connectRecorder: (dest: AudioNode) => saida.connect(dest),
    disconnectRecorder: (dest: AudioNode) => saida.disconnect(dest),
  } as unknown as AudioSystem;

  // o "microfone": um tom de 1000 Hz num fluxo (a faixa termina quando o gravador a solta, como a do microfone de verdade)
  const origemMic = ctx.createMediaStreamDestination();
  const tomVoz = ctx.createOscillator();
  tomVoz.frequency.value = FREQ_VOZ;
  const ganhoVoz = ctx.createGain();
  ganhoVoz.gain.value = 0.3;
  tomVoz.connect(ganhoVoz).connect(origemMic);
  tomVoz.start();
  const faixaMic = origemMic.stream.getAudioTracks()[0]!;

  const gravador = new GameRecorder(canvas, audio);
  let quadros = 0;
  let rodando = true;
  const desenhar = () => {
    if (!rodando) return;
    const t = performance.now() / 1000;
    c2.fillStyle = `hsl(${(t * 60) % 360} 60% 25%)`;
    c2.fillRect(0, 0, 640, 360);
    c2.fillStyle = '#fff';
    c2.fillRect(40 + ((t * 120) % 500), 150 + Math.sin(t * 4) * 80, 60, 60);
    gravador.capturarQuadro();
    quadros++;
    requestAnimationFrame(desenhar);
  };
  requestAnimationFrame(desenhar);

  const bin = (hz: number) => Math.round((hz / (ctx.sampleRate / 2)) * (analisador.frequencyBinCount - 1));
  let vozMax = -Infinity;
  let jogoMax = -Infinity;
  const buf = new Float32Array(analisador.frequencyBinCount);
  const medir = () => {
    analisador.getFloatFrequencyData(buf);
    vozMax = Math.max(vozMax, buf[bin(FREQ_VOZ)]!);
    jogoMax = Math.max(jogoMax, buf[bin(FREQ_JOGO)]!);
  };

  gravador.alternar(comVoz ? origemMic.stream : null, efeito === 'normal' ? null : (c) => criarCadeiaDeVoz(c, efeito));
  const gravando = gravador.gravando;
  const t0 = performance.now();
  while (performance.now() - t0 < segundos * 1000) {
    await dorme(100);
    medir();
  }
  // o gravador baixa o arquivo ao terminar de parar: a página espera esse clique antes de fechar o áudio (o contexto fechado antes de o `MediaRecorder` entregar encerra a faixa no meio)
  let baixou = false;
  const clicar = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    baixou = true;
    clicar.call(this);
  };
  gravador.alternar(); // o gesto de parar (o arquivo baixa sozinho)
  const t1 = performance.now();
  while (!baixou && performance.now() - t1 < 30_000) await dorme(100);
  HTMLAnchorElement.prototype.click = clicar;
  rodando = false;
  const faixaDoMic = comVoz ? faixaMic.readyState : null;
  tomJogo.stop();
  tomVoz.stop();
  await ctx.close();
  return { gravando, faixaDoMic, vozNaSaidaDb: vozMax, jogoNaSaidaDb: jogoMax, quadros, baixou };
};
