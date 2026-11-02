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
    showVersion: 0, displays, coresDosDisplays: new Map(), turntable: new THREE.Group(), shown: null, frame: vi.fn(),
    prepared: new WeakSet(), pendingPreparation: null, preparing: false,
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

  it('prepara o novo chassi antes de trocar o pedestal e reutiliza o que já preparou', async () => {
    const f = fixture(); f.displays.set('genesis01', f.genesis);
    f.scene.show('vector09', CHASSIS.vector09.loadout);
    let finish!: (ready: boolean) => void;
    f.scene.prepareModel = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    f.scene.show('genesis01', CHASSIS.genesis01.loadout);
    expect(f.scene.graphicsPreparing).toBe(true);
    expect(f.genesis.root.parent).toBeNull();
    expect(f.vector.root.parent).not.toBeNull();
    finish(true); await Promise.resolve();
    expect(f.vector.root.parent).toBeNull();
    expect(f.genesis.root.parent).not.toBeNull();
    expect(f.scene.graphicsPreparing).toBe(false);
    f.scene.show('vector09', CHASSIS.vector09.loadout);
    // Vector também passou pela preparação; ao resolver, Genesis continua no pedestal até lá.
    finish(true); await Promise.resolve();
    f.scene.show('genesis01', CHASSIS.genesis01.loadout);
    expect(f.scene.prepareModel).toHaveBeenCalledTimes(2);
  });

  it('preparação atrasada não sobrescreve a seleção atual', async () => {
    const f = fixture(); f.displays.set('genesis01', f.genesis);
    f.scene.show('vector09', CHASSIS.vector09.loadout);
    let finish!: (ready: boolean) => void;
    f.scene.prepareModel = () => new Promise(resolve => { finish = resolve; });
    f.scene.show('genesis01', CHASSIS.genesis01.loadout);
    f.scene.show('vector09', CHASSIS.vector09.loadout);
    finish(true); await Promise.resolve();
    expect(f.vector.root.parent).not.toBeNull();
    expect(f.genesis.root.parent).toBeNull();
  });

  it('mantém só a última preparação pendente, sem compilar os cliques intermediários', async () => {
    const f = fixture(); f.displays.set('genesis01', f.genesis);
    const middle = { ...f.genesis, root: new THREE.Group() };
    const latest = { ...f.genesis, root: new THREE.Group() };
    f.displays.set('onca', middle); f.displays.set('arara', latest);
    f.scene.show('vector09', CHASSIS.vector09.loadout);
    const finish: ((ready: boolean) => void)[] = [];
    f.scene.prepareModel = vi.fn(() => new Promise<boolean>(resolve => { finish.push(resolve); }));
    f.scene.show('genesis01', CHASSIS.genesis01.loadout);
    f.scene.show('onca', CHASSIS.onca.loadout);
    f.scene.show('arara', CHASSIS.arara.loadout);
    expect(f.scene.prepareModel).toHaveBeenCalledTimes(1);
    finish[0]!(true); await Promise.resolve();
    expect(f.scene.prepareModel).toHaveBeenCalledTimes(2);
    expect(f.scene.prepareModel).toHaveBeenLastCalledWith(latest.root);
    finish[1]!(true); await Promise.resolve();
    expect(middle.root.parent).toBeNull();
    expect(latest.root.parent).not.toBeNull();
  });

  it('falha da preparação libera a montagem atual pelo fallback', async () => {
    const f = fixture(); f.displays.set('genesis01', f.genesis);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    f.scene.prepareModel = vi.fn(() => Promise.reject(new Error('contexto perdido')));
    f.scene.show('genesis01', CHASSIS.genesis01.loadout);
    await Promise.resolve();
    expect(f.genesis.root.parent).not.toBeNull();
    expect(f.scene.graphicsPreparing).toBe(false);
    expect(warning).toHaveBeenCalledOnce(); warning.mockRestore();
  });
});
