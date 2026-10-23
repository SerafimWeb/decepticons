/**
 * O `?cutscene=` do link (P245): liga uma cutscene pré-definida (câmera por trajetória, sem controle do jogador) para ser
 * gravada em vídeo. **Fica num arquivo pequeno à parte de propósito** (como o `multidaoLink.ts`): o `Game` o lê no começo
 * e a cutscene em si (`CutsceneJaneiro.ts`, a `CameraPath`) é **carregada sob demanda**, então não pesa no download de
 * quem joga sem o link.
 *
 * **Tocar sozinha ao abrir a missão (pedido do Comandante, P246) ficou para depois:** achei um bug de ciclo de vida
 * (o `Game` parece recriar a instância ou zerar o campo `cutscene` pouco depois de tocar `start()`, ainda não
 * investigado até o fim) e preferi não publicar o automático pela metade. `?cutscene=janeiro-abertura` continua
 * funcionando (provado de ponta a ponta, com vídeo gravado).
 */
export type CutsceneId = 'janeiro-abertura';

const IDS_CONHECIDOS: readonly CutsceneId[] = ['janeiro-abertura'];

export function cutsceneFromSearch(search: string): CutsceneId | null {
  const q = new URLSearchParams(search);
  const pedido = q.get('cutscene');
  if (pedido === null) return null;
  return (IDS_CONHECIDOS as readonly string[]).includes(pedido) ? (pedido as CutsceneId) : null;
}
