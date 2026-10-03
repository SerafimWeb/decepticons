import type { MechRig } from './MechBase';
import type { ChassisId } from './chassis';
import { instantiateImportedMechRig, preloadImportedMechAsset, type ImportedMechAsset, type ImportedRigOptions } from './importedMechRig';

/**
 * Quais chassis usam malha importada em vez de blueprint procedural, e de onde. O carregamento é
 * caro (fetch + parse do `.glb`) e acontece uma vez só, cedo (`Game.ts` dispara no boot, sem
 * esperar); cada Mech novo desse chassi só clona o protótipo já pronto (`instantiateImportedMechRig`,
 * síncrono). Adicionar um chassi novo aqui é o único passo pra ligar o arquivo — `Game.ts` e
 * `HangarScene.ts` leem este mapa, não sabem o nome do arquivo.
 */
export interface ImportedChassisConfig {
  url: string;
  rotationY?: number;
  boneNames?: ImportedRigOptions['boneNames'];
  /** Só para malha em T-pose (ver `ImportedRigOptions.armRest`). */
  armRest?: ImportedRigOptions['armRest'];
  /** Mão e dedos somem e as armas da montagem se encaixam nos pulsos (ver `ImportedRigOptions.weaponMounts`). */
  weaponMounts?: boolean;
}

/** O que o carregamento precisa além do arquivo e da altura: o próprio `ImportedChassisConfig` serve. */
type PreloadOptions = Pick<ImportedChassisConfig, 'rotationY' | 'boneNames' | 'armRest' | 'weaponMounts'>;

export const IMPORTED_CHASSIS: Partial<Record<ChassisId, ImportedChassisConfig>> = {
  genesis01: {
    url: `${import.meta.env.BASE_URL}models/mech-robot-01.glb`,
    rotationY: Math.PI,
  },
  lancerL1: {
    url: `${import.meta.env.BASE_URL}models/TZLA1.glb`,
    rotationY: Math.PI,
    boneNames: {
      hips: 'Hip',
      head: 'Head',
      torso: 'Spine01',
      leftArm: 'L_Upperarm',
      rightArm: 'R_Upperarm',
      leftUpLeg: 'L_Thigh',
      leftLowerLeg: 'L_Calf',
      rightUpLeg: 'R_Thigh',
      rightLowerLeg: 'R_Calf',
      leftHand: 'L_Hand',
      rightHand: 'R_Hand',
    },
  },
  lr7lBastion: {
    url: `${import.meta.env.BASE_URL}models/LR7L.glb`,
    rotationY: Math.PI,
    boneNames: {
      hips: 'Hip',
      head: 'Head',
      torso: 'Spine01',
      leftArm: 'L_Upperarm',
      rightArm: 'R_Upperarm',
      leftUpLeg: 'L_Thigh',
      leftLowerLeg: 'L_Calf',
      rightUpLeg: 'R_Thigh',
      rightLowerLeg: 'R_Calf',
      leftHand: 'L_Hand',
      rightHand: 'R_Hand',
    },
  },
  // quadraV2: {
  //   url: `${import.meta.env.BASE_URL}models/ZEROCIRCUIT.glb`,
  //   rotationY: Math.PI,
  //   boneNames: {
  //     hips: 'mixamorigHips',
  //     leftUpLeg: 'mixamorigLeftUpLeg',
  //     leftLowerLeg: 'mixamorigLeftLeg',
  //     rightUpLeg: 'mixamorigRightUpLeg',
  //     rightLowerLeg: 'mixamorigRightLeg',
  //     torso: 'mixamorigSpine1',
  //     leftArm: 'mixamorigLeftArm',
  //     rightArm: 'mixamorigRightArm',
  //   },
  // },
  marauder: {
    url: `${import.meta.env.BASE_URL}models/marauder.glb`,
    rotationY: Math.PI,
    // O .glb vem em T-pose (braços abertos a 90°). Pose de arma em punho por direção: braço 50° abaixo da horizontal e um
    // pouco à frente, antebraço na horizontal para a frente. Mais baixo que isso a ombreira, presa ao osso do braço, gira junto
    // e a junta parece quebrada (FINDINGS.md).
    armRest: { upper: [0.62, -0.77, -0.15], fore: [0.1, 0, -1] },
    // Sem arma no modelo: as mãos somem e a arma da montagem se encaixa no pulso (weaponMount.ts).
    weaponMounts: true,
    boneNames: {
      hips: 'mixamorigHips',
      head: 'mixamorigNeck',
      leftUpLeg: 'mixamorigLeftUpLeg',
      leftLowerLeg: 'mixamorigLeftLeg',
      rightUpLeg: 'mixamorigRightUpLeg',
      rightLowerLeg: 'mixamorigRightLeg',
      torso: 'mixamorigSpine1',
      leftArm: 'mixamorigLeftArm',
      rightArm: 'mixamorigRightArm',
    },
  },
};

const cache = new Map<string, ImportedMechAsset>();
const pending = new Map<string, Promise<ImportedMechAsset>>();
const key = (url: string, targetHeight: number) => `${url}@${targetHeight}`;

/** Dispara o carregamento sem esperar (chame cedo — boot do jogo — pra já estar pronto quando alguém pedir). */
export function preloadMechAsset(url: string, targetHeight: number, options: PreloadOptions = {}): void {
  const k = key(url, targetHeight);
  if (cache.has(k) || pending.has(k)) return;
  const p = preloadImportedMechAsset(url, { targetHeight, rotationY: options.rotationY, boneNames: options.boneNames, armRest: options.armRest, weaponMounts: options.weaponMounts });
  pending.set(k, p);
  p.then((asset) => { cache.set(k, asset); pending.delete(k); })
    .catch((err) => { pending.delete(k); console.error(`falha ao carregar rig importado (${url}):`, err); });
}

/** Rig pronto na hora, se o preload já terminou; `null` se ainda não (chame `preloadMechAsset` e tente de novo). */
export function tryInstantiateMechRig(url: string, targetHeight: number): MechRig | null {
  const asset = cache.get(key(url, targetHeight));
  return asset ? instantiateImportedMechRig(asset, targetHeight) : null;
}

/** Espera o preload terminar (dispara se ainda não tiver disparado) — só onde dá pra esperar (abrir o Hangar). */
export async function whenMechAssetReady(url: string, targetHeight: number, options: PreloadOptions = {}): Promise<void> {
  const k = key(url, targetHeight);
  if (cache.has(k)) return;
  preloadMechAsset(url, targetHeight, options);
  await pending.get(k);
}
