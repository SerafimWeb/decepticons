/**
 * Como o jogo abre o microfone (P229, 20/10): **um lugar só**, usado pelo chat de voz e pelo teste do microfone.
 *
 * O defeito que isto conserta (achado no PC do Comandante, com o fone Bluetooth dele): o pedido era `deviceId: { ideal }` junto de eco, ruído e ganho automático. O `ideal` **perde** para as outras
 * preferências, e o Chrome/Brave abria sempre o aparelho **padrão**, qualquer que fosse o escolhido na lista: a escolha do jogador nunca valeu (e o padrão, um fone Bluetooth, é baixinho).
 * Agora a escolha é `exact`. Só se o aparelho **sumiu** (desconectado, `OverconstrainedError` ou `NotFoundError`) o jogo cai no padrão em vez de falhar: o salvo que foi desligado não trava o chat.
 */

/** As restrições de voz do jogo: o navegador tira eco, ruído e nivela o volume; mono basta para voz. */
export const RESTRICOES_DO_MIC = Object.freeze({ echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 });

import { ehMixagemDoSistema } from './aparelhos';

type PedirAoNavegador = (restricoes: MediaStreamConstraints) => Promise<MediaStream>;
type ListarAparelhos = () => Promise<readonly { kind: string; deviceId: string; label: string }[]>;

const pedirDeVerdade: PedirAoNavegador = (restricoes) => {
  if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(new DOMException('sem microfone', 'NotFoundError'));
  return navigator.mediaDevices.getUserMedia(restricoes);
};

const listarDeVerdade: ListarAparelhos = async () => (navigator.mediaDevices?.enumerateDevices ? await navigator.mediaDevices.enumerateDevices() : []);

/** O aparelho pedido não existe mais (e só isso): vale cair no padrão. Permissão negada, aparelho em uso e o resto continuam sendo erro. */
export function aparelhoSumiu(erro: unknown): boolean {
  const nome = (erro as { name?: string } | null)?.name ?? '';
  return nome === 'OverconstrainedError' || nome === 'NotFoundError';
}

const rotuloDe = (fluxo: MediaStream): string => fluxo.getAudioTracks()[0]?.label ?? '';
const soltar = (fluxo: MediaStream): void => {
  for (const faixa of fluxo.getTracks()) faixa.stop();
};
/** Nome que parece microfone vem primeiro na busca de um substituto (os outros aparelhos de entrada ficam depois, na ordem do sistema). */
const PARECE_MICROFONE = /micro|\bmic\b|headset|auricular/i;

/** Os aparelhos que podem substituir a mixagem: entradas de verdade (nem "default", nem "communications", nem outra mixagem), as que parecem microfone primeiro. */
export function substitutosDaMixagem(todos: readonly { kind: string; deviceId: string; label: string }[]): string[] {
  const reais = todos.filter((d) => d.kind === 'audioinput' && d.deviceId !== '' && d.deviceId !== 'default' && d.deviceId !== 'communications' && !ehMixagemDoSistema(d.label));
  return [...reais.filter((d) => PARECE_MICROFONE.test(d.label)), ...reais.filter((d) => !PARECE_MICROFONE.test(d.label))].map((d) => d.deviceId);
}

async function abrirPedido(aparelho: string, pedir: PedirAoNavegador): Promise<MediaStream> {
  if (aparelho) {
    try {
      return await pedir({ audio: { ...RESTRICOES_DO_MIC, deviceId: { exact: aparelho } }, video: false });
    } catch (erro) {
      if (!aparelhoSumiu(erro)) throw erro;
    }
  }
  return pedir({ audio: { ...RESTRICOES_DO_MIC }, video: false });
}

/**
 * Abre o microfone: o `aparelho` escolhido (exato), ou o padrão se não há escolha ou se o escolhido sumiu. **Nunca devolve a "Mixagem estéreo"** (P241): se o que abriu grava o som do computador
 * (o padrão do Windows pode ser ela, ou ela pode estar salva na escolha), larga e procura um microfone de verdade; se só há a mixagem, falha com `NotFoundError` ("mixagem") em vez de mandar o som do PC
 * para os outros. `pedir` e `listar` são injetáveis para teste.
 */
export async function abrirMicrofone(aparelho: string, pedir: PedirAoNavegador = pedirDeVerdade, listar: ListarAparelhos = listarDeVerdade): Promise<MediaStream> {
  const fluxo = await abrirPedido(aparelho, pedir);
  if (!ehMixagemDoSistema(rotuloDe(fluxo))) return fluxo;
  soltar(fluxo);
  const substitutos = substitutosDaMixagem(await listar().catch(() => []));
  for (const id of substitutos) {
    try {
      const outro = await pedir({ audio: { ...RESTRICOES_DO_MIC, deviceId: { exact: id } }, video: false });
      if (!ehMixagemDoSistema(rotuloDe(outro))) return outro;
      soltar(outro);
    } catch (erro) {
      if (!aparelhoSumiu(erro)) throw erro;
    }
  }
  throw new DOMException('só há a mixagem do sistema, que grava o som do computador e não a voz', 'NotFoundError');
}
