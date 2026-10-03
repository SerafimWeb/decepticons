import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CameraRig } from '../camera/CameraRig';
import { SHOULDER_TRIGGERS } from '../combat/mounts';
import type { ProjectileSystem } from '../combat/ProjectileSystem';
import type { RocketSystem } from '../combat/RocketSystem';
import { weapon, type Loadout, type WeaponStats } from '../combat/weapons';
import type { InputManager } from '../core/InputManager';
import { MechBase, type MechStats } from '../entities/MechBase';
import { buildMechBlueprintRig, MEDIUM_MECH_BLUEPRINT } from '../entities/mechBlueprint';
import { VECTOR09_STATS } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { PlayerController } from './PlayerController';

interface Shot {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  w: WeaponStats;
}

/**
 * Um Mech com lançadores nos ombros: o corpo procedural mais dois nós de boca nos ombros (o que o rig do Marauder importado
 * traz). Sem os nós, a boca do ombro cai no torso e os dois lançamentos nascem no mesmo ponto.
 */
class ShoulderMech extends MechBase {
  constructor(stats: MechStats, loadout: Loadout) {
    const rig = buildMechBlueprintRig(MEDIUM_MECH_BLUEPRINT, { scaleToHeight: stats.height / MEDIUM_MECH_BLUEPRINT.referenceHeight });
    const side = (x: number) => {
      const node = new THREE.Object3D();
      node.position.set(x, 4.8, -0.2);
      rig.model.add(node);
      return node;
    };
    rig.shoulderMuzzles = { right: side(1.08), left: side(-1.08) };
    super(stats, rig, loadout);
  }
}

/** O jogador local de verdade (regra, controle, Mech), com teclado, câmera e sistemas de tiro de mentira que só anotam. */
async function jogador(loadout: Loadout, triggers = VECTOR09_STATS.triggers) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(200, 2, 200));
  const stats = { ...VECTOR09_STATS, loadout, triggers };
  const mech = new ShoulderMech(stats, loadout);
  mech.spawn(physics, new THREE.Vector3(0, 0, 0));
  physics.step();
  const input = {
    mouseDown: false,
    mouseDown2: false,
    virtualFire: false,
    virtualRocket: false,
    autoFire: false,
    virtualMoveX: 0,
    virtualMoveZ: 0,
    virtualJump: false,
    virtualDash: false,
    isDown: () => false,
    axis: () => 0,
    wasPressed: () => false,
  };
  const aim = { yaw: 0, pitch: 0, moveYaw: 0, point: new THREE.Vector3(0, 2.5, -30) };
  const bolts: Shot[] = [];
  const rockets: Shot[] = [];
  const projectiles = { fire: (origin: THREE.Vector3, dir: THREE.Vector3, _o: unknown, _h: boolean, w: WeaponStats) => bolts.push({ origin: origin.clone(), dir: dir.clone(), w }) };
  const rocketSys = { fire: (origin: THREE.Vector3, dir: THREE.Vector3, _o: unknown, w: WeaponStats) => rockets.push({ origin: origin.clone(), dir: dir.clone(), w }) };
  const particles = { burst: () => {} };
  const player = new PlayerController(
    mech,
    input as unknown as InputManager,
    { aim } as unknown as CameraRig,
    projectiles as unknown as ProjectileSystem,
    particles as unknown as ParticleSystem,
    rocketSys as unknown as RocketSystem,
  );
  player.active = true;
  let sounds = 0;
  let rocketSounds = 0;
  player.onShot = () => sounds++;
  player.onRocket = () => rocketSounds++;
  const run = (seconds: number) => {
    for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++) {
      player.fixedUpdate(FIXED_DT);
      physics.step();
    }
  };
  return { mech, input, aim, bolts, rockets, run, sounds: () => sounds, rocketSounds: () => rocketSounds };
}

/** O tiro sai apontando para a mira? */
const aimedAt = (s: Shot, point: THREE.Vector3): number => s.dir.dot(point.clone().sub(s.origin).normalize());

describe('PlayerController: o tiro do jogador local, ligado à regra de Armament', () => {
  it('o Vector-09 de fábrica atira da mão direita e lança foguetes da esquerda, em direção à mira', async () => {
    const { input, aim, bolts, rockets, run, sounds, rocketSounds, mech } = await jogador({ primary: weapon('plasma'), secondary: weapon('rockets') });
    input.mouseDown = true;
    run(0.5);
    input.mouseDown = false;
    expect(bolts.length).toBeGreaterThanOrEqual(2);
    expect(bolts.every((s) => s.w.id === 'plasma' && s.origin.x > 0)).toBe(true); // a direita do Mech é +X
    expect(bolts.every((s) => aimedAt(s, aim.point) > 0.9999)).toBe(true);
    expect(sounds()).toBe(bolts.length);
    expect(mech.heat).toBeGreaterThan(0);

    input.mouseDown2 = true;
    run(0.1);
    expect(rockets).toHaveLength(1);
    expect(rockets[0]!.origin.x).toBeLessThan(0); // a esquerda
    expect(rocketSounds()).toBe(1);
  });

  it('o Marauder atira com as DUAS mãos, cada boca apontando para a mira (as balas se cruzam no alvo)', async () => {
    const loadout: Loadout = { primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('rockets') };
    const { input, aim, bolts, run, sounds } = await jogador(loadout, SHOULDER_TRIGGERS);
    input.mouseDown = true;
    run(0.5);
    const right = bolts.filter((s) => s.origin.x > 0);
    const left = bolts.filter((s) => s.origin.x < 0);
    expect(right.length).toBeGreaterThanOrEqual(1);
    expect(left.length).toBeGreaterThanOrEqual(1);
    expect(Math.abs(right[0]!.origin.x - left[0]!.origin.x)).toBeGreaterThan(1.5); // bocas bem afastadas
    expect(bolts.every((s) => aimedAt(s, aim.point) > 0.9999)).toBe(true); // mas as duas miram no mesmo ponto
    expect(sounds()).toBe(bolts.length); // um som por tiro
  });

  it('o botão secundário do Marauder lança um foguete de cada ombro, com um som só, em direção à mira', async () => {
    const loadout: Loadout = { primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('rockets') };
    const { input, aim, rockets, run, rocketSounds, bolts } = await jogador(loadout, SHOULDER_TRIGGERS);
    input.mouseDown2 = true;
    run(0.05);
    input.mouseDown2 = false;
    expect(rockets).toHaveLength(2);
    expect(rockets.map((r) => Math.sign(r.origin.x)).sort()).toEqual([-1, 1]);
    expect(rockets.every((r) => Math.abs(r.origin.y - 4.8) < 0.5)).toBe(true); // na altura dos ombros
    expect(rockets.every((r) => aimedAt(r, aim.point) > 0.9999)).toBe(true);
    expect(rocketSounds()).toBe(1); // a salva faz um estrondo, não dois por cima um do outro
    expect(bolts).toHaveLength(0);
  });
});
