import { DragaController } from '../combat/DragaController';
import { DragaMech, type VisualDoDraga } from '../entities/DragaMech';
import { DRAGA_STATS } from '../entities/dragaStats';
import { loadWalkerAsset, WalkerVisual } from '../entities/WalkerVisual';
import { defaultPower, poweredStats } from '../tuning/power';
import { defesaDaAmazonia } from './AmazoniaGeradores';
import { AMAZONIA_DRAGA_INICIO_X, rioEmX } from './AmazoniaLayout';
import type { ChefeCarregado } from './mapasSobDemanda';

/**
 * O CHEFE DA AMAZÔNIA (P180, parte C): o **Draga-01 com corpo na simulação**, registrado como pedaço sob demanda (`mapasSobDemanda.ts`): o corpo (`DragaMech`), o cérebro (`DragaController`) e o
 * desenho (o `.glb` de 984 KB) só baixam para quem abre a missão (`?mapa=amazonia&modo=survival`); o Deathmatch da Amazônia e a Cidade Neon não pagam por ele.
 */

/** O desenho de verdade do Draga: o `WalkerVisual`. Qualquer outra coisa que o chamador passe é ignorada (o corpo nasce sem desenho). */
function ehVisualDoDraga(v: object | null): v is VisualDoDraga {
  return v instanceof WalkerVisual;
}

export const chefeDaAmazonia: ChefeCarregado = {
  // Nasce no leito, na largada da marcha (o rio abaixo da aldeia), olhando para o oeste (rio acima).
  nascimento: { x: AMAZONIA_DRAGA_INICIO_X, z: rioEmX(AMAZONIA_DRAGA_INICIO_X), yaw: Math.PI / 2 },
  criar: ({ physics, visual, seed, power }) => {
    const mech = new DragaMech(poweredStats(DRAGA_STATS, power ?? defaultPower(), 'mechs'), visual && ehVisualDoDraga(visual) ? visual : null);
    return { mech, brain: new DragaController(mech, physics, seed) };
  },
  criarVisual: async () => new WalkerVisual(await loadWalkerAsset()),
  // A defesa (parte D): os geradores do escudo, no mesmo pedaço sob demanda do Draga.
  defesa: defesaDaAmazonia,
};
