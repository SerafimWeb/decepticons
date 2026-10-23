/**
 * O `?cutscene=` do link (P245): liga uma cutscene pré-definida (câmera por trajetória, sem controle do jogador) para ser
 * gravada em vídeo. **Fica num arquivo pequeno à parte de propósito** (como o `multidaoLink.ts`): o `Game` o lê no começo
 * e a cutscene em si (`CutsceneJaneiro.ts`, a `CameraPath`) é **carregada sob demanda**, então não pesa no download de
 * quem joga sem o link.
 *
 * `?cutscene=janeiro-abertura&mapa=janeiro&comandante=1` — hoje só existe essa; `cutsceneLink.ts` cresce quando houver outra.
 */
export type CutsceneId = 'janeiro-abertura';

const IDS_CONHECIDOS: readonly CutsceneId[] = ['janeiro-abertura'];

export function cutsceneFromSearch(search: string): CutsceneId | null {
  const q = new URLSearchParams(search);
  const pedido = q.get('cutscene');
  if (pedido === null) return null;
  return (IDS_CONHECIDOS as readonly string[]).includes(pedido) ? (pedido as CutsceneId) : null;
}
