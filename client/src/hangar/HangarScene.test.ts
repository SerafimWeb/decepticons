import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHASSIS } from '../entities/chassis';
import { HangarScene } from './HangarScene';

const assets = vi.hoisted(() => ({ ready: vi.fn(), rig: vi.fn() }));
vi.mock('../entities/importedMechAssets', () => ({
  IMPORTED_CHASSIS: { genesis01: { url: '/genesis.glb' } },
  tryInstantiateMechRig: assets.rig,
  whenMechAssetReady: assets.ready,
}));

/** Sem construir o galpão/canvas: exercita a corrida de seleção com modelos já conhecidos. */
function fixture() {
  const model = () => ({ root: new THREE.Group(), stats: { height: 5 }, equip: vi.fn() });
  const vector = model();
  const genesis = model();
  const displays = new Map<string, ReturnType<typeof model>>([['vector09', vector]]);
  const scene = Object.create(HangarScene.prototype) as HangarScene;
  Object.assign(scene, {
    showVersion: 0, displays, turntable: new THREE.Group(), shown: null, frame: vi.fn(),
  });
  let resolve!: () => void;
  assets.ready.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
  assets.rig.mockReturnValue(null);
  return { scene, vector, genesis, displays, resolve };
}

describe('seleção assíncrona do pedestal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('carregamento antigo não substitui o chassi escolhido depois', async () => {
    const f = fixture();
    f.scene.show('genesis01', CHASSIS.genesis01.loadout);
    f.scene.show('vector09', CHASSIS.vector09.loadout);
    f.displays.set('genesis01', f.genesis);
    f.resolve();
    await Promise.resolve();
    expect(f.genesis.equip).not.toHaveBeenCalled();
    expect(f.vector.equip).toHaveBeenCalledTimes(1);
  });

  it('durante a carga, a montagem mais recente prevalece sobre a antiga', async () => {
    const f = fixture();
    const latest = CHASSIS.vector09.loadout;
    f.scene.show('genesis01', CHASSIS.genesis01.loadout);
    f.scene.show('genesis01', latest);
    f.displays.set('genesis01', f.genesis);
    f.resolve();
    await Promise.resolve();
    expect(f.genesis.equip).toHaveBeenCalledTimes(1);
    expect(f.genesis.equip).toHaveBeenCalledWith(latest);
  });

  it('carga recusada termina sem repetir a seleção ou gerar rejeição não tratada', async () => {
    const f = fixture();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    assets.ready.mockRejectedValueOnce(new Error('rede indisponível'));
    f.scene.show('genesis01', CHASSIS.genesis01.loadout);
    await Promise.resolve();
    await Promise.resolve();
    expect(assets.ready).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalled();
    warning.mockRestore();
  });
});
