import type { MechRig } from './MechBase';
import type { ChassisId } from './chassis';
import { instantiateImportedMechRig, preloadImportedMechAsset, type ImportedMechAsset } from './importedMechRig';

/**
 * Quais chassis usam malha importada em vez de blueprint procedural, e de onde. O carregamento é
 * caro (fetch + parse do `.glb`) e acontece uma vez só, cedo (`Game.ts` dispara no boot, sem
 * esperar); cada Mech novo desse chassi só clona o protótipo já pronto (`instantiateImportedMechRig`,
 * síncrono). Adicionar um chassi novo aqui é o único passo pra ligar o arquivo — `Game.ts` e
 * `HangarScene.ts` leem este mapa, não sabem o nome do arquivo.
 */
export const IMPORTED_CHASSIS: Partial<Record<ChassisId, string>> = {
  genesis01: `${import.meta.env.BASE_URL}models/mech-robot-01.glb`,
};

const cache = new Map<string, ImportedMechAsset>();
const pending = new Map<string, Promise<ImportedMechAsset>>();
const key = (url: string, targetHeight: number) => `${url}@${targetHeight}`;

/** Dispara o carregamento sem esperar (chame cedo — boot do jogo — pra já estar pronto quando alguém pedir). */
export function preloadMechAsset(url: string, targetHeight: number): void {
  const k = key(url, targetHeight);
  if (cache.has(k) || pending.has(k)) return;
  const p = preloadImportedMechAsset(url, { targetHeight });
  pending.set(k, p);
  p.then((asset) => { cache.set(k, asset); pending.delete(k); })
    .catch((err) => { pending.delete(k); console.error(`falha ao carregar rig importado (${url}):`, err); });
}

/** Rig pronto na hora, se o preload já terminou; `null` se ainda não (chame `preloadMechAsset` e tente de novo). */
export function tryInstantiateMechRig(url: string, targetHeight: number): MechRig | null {
  const asset = cache.get(key(url, targetHeight));
  return asset ? instantiateImportedMechRig(asset) : null;
}

/** Espera o preload terminar (dispara se ainda não tiver disparado) — só onde dá pra esperar (abrir o Hangar). */
export async function whenMechAssetReady(url: string, targetHeight: number): Promise<void> {
  const k = key(url, targetHeight);
  if (cache.has(k)) return;
  preloadMechAsset(url, targetHeight);
  await pending.get(k);
}
