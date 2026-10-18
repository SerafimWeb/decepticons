import type * as THREE from 'three';
import type { MechBase, MechInput } from '../entities/MechBase';

/**
 * O cérebro de um **chefe de mapa** (o Draga-01 da Amazônia, P180 parte C): o mínimo que o `BotSystem` pede de quem comanda um robô. Cada tick o `BotSystem` chama `think` (o chefe decide por onde anda e
 * se atira), passa o `MechInput` ao corpo e, se `wantsToFire`, sai um tiro da boca do corpo na direção de `shotDir`. Só tipos: o código do chefe mora no pedaço sob demanda do mapa
 * (`environment/mapasSobDemanda.ts`), não no pacote de partida.
 */
export interface CerebroDoChefe {
  /** Decide o tick: o comando de movimento do corpo. `targets` são os alvos vivos que ele pode caçar (os jogadores e os aliados). */
  think(dt: number, targets: readonly MechBase[]): MechInput;
  /** Quer atirar a arma principal neste tick (o disparo sai na direção de `shotDir`). */
  readonly wantsToFire: boolean;
  /** A direção do tiro deste tick, válida quando `wantsToFire`. */
  readonly shotDir: THREE.Vector3;
  /** Volta ao estado de partida (a missão recomeça). */
  reset(): void;
}
