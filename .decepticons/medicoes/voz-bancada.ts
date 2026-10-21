import { NetClient } from '../../client/src/net/NetClient';
import { AMBIENTE_DO_NAVEGADOR, VoiceChat, type Ambiente } from '../../client/src/voice/VoiceChat';
import type { ModoMic } from '../../client/src/voice/MicController';

/**
 * Parâmetros da URL: `servidor` (ws://…), `sala`, `nome`, `modo` (sempre | ptt), `mic` (normal | negar | tarde: o microfone só chega 8 s depois),
 * `token` (a sessão de uma conta: o servidor só admite na voz conta de maior de idade, P211; sem ele a bancada nem pede a voz ao servidor... ele nega), `dsp` (0 = sem cancelamento de eco, supressão de ruído e ganho automático: o tom puro do arquivo de teste seria "ruído" para o navegador).
 */
const q = new URLSearchParams(location.search);
const modo = (q.get('modo') ?? 'sempre') as ModoMic;
const micModo = q.get('mic') ?? 'normal';
const dsp = q.get('dsp') !== '0';
/** O ganho do microfone (P237): 1 = sem mexer. A bancada o muda ao vivo por `__voz.mudarGanho`. */
let ganho = Number(q.get('ganho') ?? 1);

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
  // O envio por Web Audio (ganho, nível, portas): a bancada usa o mesmo do jogo, então todas as provas de voz passam por ele.
  ...(q.get('envio') === 'cru' ? {} : { novoContextoDeEnvio: AMBIENTE_DO_NAVEGADOR.novoContextoDeEnvio }),
  pedirMicrofone: async () => {
    if (micModo === 'negar') throw new DOMException('recusado', 'NotAllowedError');
    if (micModo === 'tarde') await new Promise((r) => setTimeout(r, 8000));
    if (dsp) return AMBIENTE_DO_NAVEGADOR.pedirMicrofone();
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }, video: false });
  },
};

let meuId = -1;
/** Os times da sala (P237 PR 3): a bancada não tem servidor que os atribua; o teste diz quem é de qual time (id da unidade → time). Vazio = a sala não tem times. */
const times: Record<number, number> = {};
const chat = new VoiceChat({ enviar: (b) => cliente.enviarVoz(b), saida: () => ({ ctx, out }), ambiente, timeDe: (id) => times[id] ?? null, ...(q.has('token') ? { token: () => q.get('token') } : {}) });
const cliente: NetClient = new NetClient(`${q.get('servidor')}/?sala=${q.get('sala') ?? 'VOZBANCADA'}`, {
  welcome: (m) => {
    meuId = m.id;
    chat.entrouNaSala(m.id);
  },
  voz: (b) => chat.receber(b),
  closed: () => chat.saiuDaSala(),
});
cliente.join(q.get('nome') ?? 'BANCADA', 'v1.vector09.plasma-0.rockets-0');
chat.configurar(true, modo, 0.8, '', ganho);
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
  mudarModo: (m: ModoMic) => chat.configurar(true, m, 0.8, '', ganho),
  desligar: (ligada: boolean) => chat.configurar(ligada, modo, 0.8, '', ganho),
  /** P237: o ganho do microfone muda ao vivo. */
  mudarGanho: (g: number) => {
    ganho = g;
    chat.configurar(true, modo, 0.8, '', ganho);
  },
  /** P237: a saúde do microfone e o nível que sai (o que o HUD lê a 10 Hz). */
  saude: () => chat.saudeDoMic(performance.now()),
  nivelDoMic: () => chat.nivelDoMic,
  diagnostico: () => chat.diagnostico(),
  /** P237: o microfone "cai" (o fone Bluetooth some): a faixa para e o navegador avisa que terminou. O jogo tem de reabrir sozinho. */
  derrubarMic: () => {
    const fluxo = (chat as unknown as { fluxo: MediaStream | null }).fluxo;
    for (const f of fluxo?.getAudioTracks() ?? []) {
      f.stop();
      f.dispatchEvent(new Event('ended')); // `stop()` não dispara `ended`; o aparelho que some dispara
    }
    return !!fluxo;
  },
  estadoMic: () => chat.estadoMic,
  /** P237 PR 3: os canais. */
  definirTimes: (novos: Record<number, number>) => {
    for (const k of Object.keys(times)) delete times[Number(k)];
    Object.assign(times, novos);
    chat.reavaliarCanais();
  },
  canal: (canal: 'time' | 'privado', down: boolean) => chat.aoCanal(canal, down),
  escolherAlvo: (id: number | null) => chat.definirAlvo(id),
  trocarAlvo: () => chat.trocarAlvo(),
  canalAtual: () => ({ canal: chat.canal, alvo: chat.alvo, temTimes: chat.temTimes, disponiveis: chat.canaisDisponiveis }),
};
