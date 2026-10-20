/**
 * Como o jogo abre o microfone (P229, 20/10): **um lugar só**, usado pelo chat de voz e pelo teste do microfone.
 *
 * O defeito que isto conserta (achado no PC do Comandante, com o fone Bluetooth dele): o pedido era `deviceId: { ideal }` junto de eco, ruído e ganho automático. O `ideal` **perde** para as outras
 * preferências, e o Chrome/Brave abria sempre o aparelho **padrão**, qualquer que fosse o escolhido na lista: a escolha do jogador nunca valeu (e o padrão, um fone Bluetooth, é baixinho).
 * Agora a escolha é `exact`. Só se o aparelho **sumiu** (desconectado, `OverconstrainedError` ou `NotFoundError`) o jogo cai no padrão em vez de falhar: o salvo que foi desligado não trava o chat.
 */

/** As restrições de voz do jogo: o navegador tira eco, ruído e nivela o volume; mono basta para voz. */
export const RESTRICOES_DO_MIC = Object.freeze({ echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 });

type PedirAoNavegador = (restricoes: MediaStreamConstraints) => Promise<MediaStream>;

const pedirDeVerdade: PedirAoNavegador = (restricoes) => {
  if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(new DOMException('sem microfone', 'NotFoundError'));
  return navigator.mediaDevices.getUserMedia(restricoes);
};

/** O aparelho pedido não existe mais (e só isso): vale cair no padrão. Permissão negada, aparelho em uso e o resto continuam sendo erro. */
export function aparelhoSumiu(erro: unknown): boolean {
  const nome = (erro as { name?: string } | null)?.name ?? '';
  return nome === 'OverconstrainedError' || nome === 'NotFoundError';
}

/** Abre o microfone: o `aparelho` escolhido (exato), ou o padrão se não há escolha ou se o escolhido sumiu. `pedir` é injetável para teste. */
export async function abrirMicrofone(aparelho: string, pedir: PedirAoNavegador = pedirDeVerdade): Promise<MediaStream> {
  if (aparelho) {
    try {
      return await pedir({ audio: { ...RESTRICOES_DO_MIC, deviceId: { exact: aparelho } }, video: false });
    } catch (erro) {
      if (!aparelhoSumiu(erro)) throw erro;
    }
  }
  return pedir({ audio: { ...RESTRICOES_DO_MIC }, video: false });
}
