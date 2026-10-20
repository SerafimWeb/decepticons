import { Praia } from './Praia';
import type { PraiaCarregada } from './mapasSobDemanda';

/** A Estação dos Cabos como pedaço **sob demanda** (P228): quem importa `Praia.ts` é só este arquivo, e a `Arena` o recebe por `mapasSobDemanda.ts`. */
export const praiaSobDemanda: PraiaCarregada = {
  construir: (scene, physics, destructibles) => new Praia(scene, physics, destructibles),
};
