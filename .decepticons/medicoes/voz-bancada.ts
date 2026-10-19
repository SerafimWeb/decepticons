import { NetClient } from '../../client/src/net/NetClient';
import { AMBIENTE_DO_NAVEGADOR, VoiceChat, type Ambiente } from '../../client/src/voice/VoiceChat';
import type { ModoMic } from '../../client/src/voice/MicController';

/**
 * Parâmetros da URL: `servidor` (ws://…), `sala`, `nome`, `modo` (sempre | ptt), `mic` (normal | negar | tarde: o microfone só chega 8 s depois),
 * `dsp` (0 = sem cancelamento de eco, supressão de ruído e ganho automático: o tom puro do arquivo de teste seria "ruído" para o navegador).
 */
const q = new URLSearchParams(location.search);
const modo = (q.get('modo') ?? 'sempre') as ModoMic;
const micModo = q.get('mic') ?? 'normal';
const dsp = q.get('dsp') !== '0';

const ctx = new AudioContext();
const out = ctx.createGain();
out.connect(ctx.destination);
// A régua do que sai de verdade pelo "alto-falante" (depois do áudio espacial): o RMS de pico numa janela.
const medidor = ctx.createAnalyser();
medidor.fftSize = 2048;
out.connect(medidor);
const buf = new Float32Array(medidor.fftSize);
let pico = 0;
setInterval(() => {
  medidor.getFloatTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i]! * buf[i]!;
  const r = Math.sqrt(s / buf.length);
  if (r > pico) pico = r;
}, 40);

const ambiente: Ambiente = {
  novaConexao: AMBIENTE_DO_NAVEGADOR.novaConexao,
  pedirMicrofone: async () => {
    if (micModo === 'negar') throw new DOMException('recusado', 'NotAllowedError');
    if (micModo === 'tarde') await new Promise((r) => setTimeout(r, 8000));
    if (dsp) return AMBIENTE_DO_NAVEGADOR.pedirMicrofone();
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }, video: false });
  },
};

let meuId = -1;
const chat = new VoiceChat({ enviar: (b) => cliente.enviarVoz(b), saida: () => ({ ctx, out }), ambiente });
const cliente: NetClient = new NetClient(`${q.get('servidor')}/?sala=${q.get('sala') ?? 'VOZBANCADA'}`, {
  welcome: (m) => {
    meuId = m.id;
    chat.entrouNaSala(m.id);
  },
  voz: (b) => chat.receber(b),
  closed: () => chat.saiuDaSala(),
});
cliente.join(q.get('nome') ?? 'BANCADA', 'v1.vector09.plasma-0.rockets-0');
chat.configurar(true, modo, 0.8);
chat.ligarTeclas(() => 'KeyT');

/** Onde eu estou e onde os outros estão (a bancada não tem mundo: o teste diz). */
const mundo = { meu: { x: 0, y: 0, z: 0, yaw: 0 }, outros: {} as Record<number, { x: number; y: number; z: number }> };
setInterval(() => chat.atualizar(mundo.meu.x, mundo.meu.y, mundo.meu.z, mundo.meu.yaw, (id) => mundo.outros[id]), 16);

/** O que o `outbound-rtp` mandou até agora (somado das ligações): pacotes e bytes de áudio. */
async function enviado(): Promise<{ pacotes: number; bytes: number }> {
  let pacotes = 0;
  let bytes = 0;
  const ligacoes = (chat as unknown as { ligacoes: Map<number, { pc: RTCPeerConnection }> }).ligacoes;
  for (const { pc } of ligacoes.values()) {
    for (const r of (await pc.getStats()).values()) {
      if (r.type === 'outbound-rtp' && r.kind === 'audio') {
        pacotes += r.packetsSent ?? 0;
        bytes += (r.bytesSent ?? 0) + (r.headerBytesSent ?? 0);
      }
    }
  }
  return { pacotes, bytes };
}

(window as unknown as { __voz: unknown }).__voz = {
  estado: () => ({
    id: meuId,
    ativa: chat.ativa,
    mic: chat.estadoMic,
    ligados: chat.ligados,
    semConexao: chat.semConexao,
    transmitindo: chat.mic.transmitindo,
    ouvindo: chat.spatial.quantos,
    falando: [...chat.falando(performance.now())],
  }),
  mundo,
  enviado,
  zerarPico: () => (pico = 0),
  pico: () => pico,
  contexto: () => ctx.state,
  mudarModo: (m: ModoMic) => chat.configurar(true, m, 0.8),
  desligar: (ligada: boolean) => chat.configurar(ligada, modo, 0.8),
};
