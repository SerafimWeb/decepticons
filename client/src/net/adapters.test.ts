import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { Writer } from '../../../shared/net/codec';
import { newNetInput } from '../../../shared/net/input';
import { decodeInputs, decodeSnapshot, encodeInputs, encodeSnapshot, newInputPacket, newSnapshot } from '../../../shared/net/messages';
import { NET_PARTS } from '../../../shared/net/state';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { mechInputFromNet, netInputFromMech, netWeaponIndex, unitFromMech, weaponFromNet } from './adapters';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const angleDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe('rede: a partida de verdade passa pelo codec', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('estado de todas as unidades de uma luta real vai e volta: posição em 0,5 cm, mira, vida de cada parte, vivo ou não', async () => {
    const physics = await PhysicsWorld.create();
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false });
    const player = new Vector09();
    match.addPlayer(player, 'VOCÊ');
    const walk: MechInput = { moveX: 0.3, moveZ: 1, moveYaw: 0.4, yaw: 0.4, jump: false, dash: false };
    match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(walk, dt) });
    const units = [player, ...match.bots.mechs];
    const w = new Writer();
    const sent = newSnapshot();
    const got = newSnapshot();
    // 6 s de luta, um estado a cada 3 ticks (20 Hz), como o servidor vai mandar.
    for (let t = 1; t <= 360; t++) {
      match.step(FIXED_DT);
      if (t % 3) continue;
      sent.tick = t;
      sent.count = units.length;
      units.forEach((m, i) => unitFromMech(m, i, sent.units[i]!));
      expect(decodeSnapshot(encodeSnapshot(w, sent), got)).toBe(true);
    }
    // A luta aconteceu: alguém se mexeu e levou dano.
    expect(units.some((m) => NET_PARTS.some((p) => m.modules[p] < m.stats.maxModuleHealth[p]))).toBe(true);
    units.forEach((m, i) => {
      const u = got.units[i]!;
      const p = m.simPosition;
      expect(Math.hypot(u.x - p.x, u.y - p.y, u.z - p.z)).toBeLessThan(0.01);
      expect(angleDiff(u.yaw, m.yaw)).toBeLessThan(0.001);
      for (const part of NET_PARTS) {
        expect(Math.abs(u.parts[part] * m.stats.maxModuleHealth[part] - m.modules[part])).toBeLessThanOrEqual(m.stats.maxModuleHealth[part] / 255);
        expect(u.parts[part] > 0).toBe(m.modules[part] > 0);
      }
      expect(u.alive).toBe(m.alive);
    });
  });

  it('comando do jogador vira comando de rede e volta igual para a simulação (com a mira e os gatilhos)', () => {
    const cmd: MechInput = { moveX: -1, moveZ: 0.5, moveYaw: 1.1, yaw: -2.2, jump: true, dash: false };
    const w = new Writer();
    const a = netInputFromMech(70, cmd, 0.3, true, false, newNetInput());
    const b = netInputFromMech(71, { ...cmd, jump: false, dash: true }, -0.2, false, true, newNetInput());
    const packet = newInputPacket();
    expect(decodeInputs(encodeInputs(w, [a, b], 2), packet)).toBe(true);
    const back = mechInputFromNet(packet.inputs[0]!, { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false });
    expect(back.moveX).toBe(-1);
    expect(back.moveZ).toBeCloseTo(0.5, 2);
    expect(angleDiff(back.yaw, cmd.yaw)).toBeLessThan(0.001);
    expect(back.jump).toBe(true);
    expect(packet.inputs[0]!.fire).toBe(true);
    expect(packet.inputs[1]!.secondary).toBe(true);
    expect(packet.inputs[1]!.tick).toBe(71);
    expect(packet.inputs[1]!.pitch).toBeCloseTo(-0.2, 3);
  });

  it('as armas do jogo têm lugar na lista da rede', () => {
    for (const id of ['plasma', 'rockets', 'blaster', 'chainsaw'] as const) expect(weaponFromNet(netWeaponIndex(id))).toBe(id);
  });
});
