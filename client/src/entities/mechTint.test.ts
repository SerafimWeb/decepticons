import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Android } from './Android';
import { Vector09 } from './Vector09';

/**
 * A ligação do estado com o casco: `MechBase.render` soma a cor do estado ao flash de dano e a entrega ao material do casco, e só
 * escreve quando a cor muda. Sem este teste, quebrar a fiação (a cor sai certa em `statusTint`, mas nunca chega ao robô) passaria despercebido.
 */
describe('o casco do Mech mostra o estado', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  async function palco(AndroidOuVector: 'vector' | 'android' = 'vector') {
    const physics = await PhysicsWorld.create();
    physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(100, 2, 100));
    const mech = AndroidOuVector === 'vector' ? new Vector09() : new Android();
    mech.spawn(physics, new THREE.Vector3(0, 0, 0));
    const escritas: Array<[number, number, number]> = [];
    // O rig é protegido no MechBase: o teste só quer trocar o setter do material do casco por um espião.
    for (const m of (mech as unknown as { rig: { hullMaterials: THREE.Material[] } }).rig.hullMaterials) m.userData.setTint = (r: number, g: number, b: number) => escritas.push([r, g, b]);
    return { mech, escritas, quadro: (n = 1) => { for (let i = 0; i < n; i++) mech.render(1 / 60, 1); } };
  }

  it('sem estado e sem dano, o casco nunca é escrito (o Mech comum não paga nada)', async () => {
    const { escritas, quadro } = await palco();
    quadro(30);
    expect(escritas).toHaveLength(0);
  });

  it('congelado, o casco recebe o azul-gelo; depois que o gelo passa, volta ao zero (a última escrita é preta)', async () => {
    const { mech, escritas, quadro } = await palco();
    for (let i = 0; i < 3; i++) mech.status.chillUp();
    expect(mech.status.isFrozen).toBe(true);
    quadro(5);
    expect(escritas.length).toBeGreaterThan(0);
    const [r, g, b] = escritas.at(-1)!;
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
    mech.status.reset();
    quadro(2);
    expect(escritas.at(-1)).toEqual([0, 0, 0]);
  });

  it('queimando, a cor tremula (várias escritas diferentes) e é laranja', async () => {
    const { mech, escritas, quadro } = await palco();
    mech.status.burnUp();
    quadro(60);
    const distintas = new Set(escritas.map((e) => e[0].toFixed(3)));
    expect(distintas.size).toBeGreaterThan(5);
    for (const [r, g, b] of escritas) {
      expect(r).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
    }
  });

  it('o flash de dano e o estado se somam (o vermelho do flash entra por cima do azul do gelo) e o flash ainda acaba sozinho', async () => {
    const { mech, escritas, quadro } = await palco();
    for (let i = 0; i < 3; i++) mech.status.chillUp();
    quadro(3);
    const semFlash = escritas.at(-1)!;
    mech.damagePart('torso', 5);
    quadro(1);
    const comFlash = escritas.at(-1)!;
    expect(comFlash[0]).toBeGreaterThan(semFlash[0] + 0.5); // o vermelho do flash
    quadro(30); // 0,5 s: o flash (1/6 s) já acabou
    const depois = escritas.at(-1)!;
    expect(depois[0]).toBeLessThan(0.2);
  });

  it('o andróide (outro tipo de Mech) também mostra o estado', async () => {
    const { mech, escritas, quadro } = await palco('android');
    mech.status.burnUp();
    quadro(10);
    expect(escritas.length).toBeGreaterThan(0);
  });
});
