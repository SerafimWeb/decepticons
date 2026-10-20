import { novoQuadroDaPraia, PraiaHud } from './PraiaHud';
import type { HudDaMissaoCarregado } from '../environment/mapasSobDemanda';

/** O HUD da missão como pedaço **sob demanda** (P228): quem importa `PraiaHud.ts` é só este arquivo, e o jogo o recebe por `mapasSobDemanda.ts`. */
export const hudDaMissao: HudDaMissaoCarregado = {
  criar: (hud, soMissao) => new PraiaHud(hud, soMissao),
  novoQuadro: novoQuadroDaPraia,
};
