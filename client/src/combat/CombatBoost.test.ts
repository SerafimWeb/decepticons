import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { Vector09 } from '../entities/Vector09';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CombatSystem } from './CombatSystem';
import { weapon } from './weapons';
it('bônus usa o tick do Mech e não sobrevive ao respawn', async () => {
  const physics = await PhysicsWorld.create(); const m = new Vector09(); m.spawn(physics,new THREE.Vector3(0,0,0));
  try { m.combatBoost.activate(1.25,1); m.fixedUpdate({moveX:0,moveZ:0,moveYaw:0,yaw:0,jump:false,dash:false},1/60); expect(m.combatBoost.secondsLeft).toBeCloseTo(1-1/60); m.damagePart("torso",m.modules.torso); expect(m.combatBoost.damageMultiplier).toBe(1); m.combatBoost.activate(1.25,30); m.respawn(new THREE.Vector3(0,0,0)); expect(m.combatBoost.damageMultiplier).toBe(1); }
  finally { physics.world.free(); }
});
it('dano aumentado chega ao impacto autoritativo e ao cenário, sem amplificar EMP ou simular dano no cliente', () => {
  const props = {damage:vi.fn(),damageInRadius:vi.fn()}, debris = {shatter:()=>{}}, fx = {burst:()=>{}};
  const combat = new CombatSystem(props as never,debris as never,fx as never);
  const shooter = new Vector09(), target = new Vector09(); const a = {handle:1},b={handle:2};
  Object.defineProperty(shooter,'collider',{value:a}); Object.defineProperty(target,'collider',{value:b}); combat.register(shooter);combat.register(target);
  shooter.combatBoost.activate(1.25,30); const hit = {collider:b,point:new THREE.Vector3(0,2.4,0)};
  const hp=target.modules.torso; combat.onProjectileHit(hit as never,new THREE.Vector3(0,0,-1),20,a as never,weapon('plasma')); expect(hp-target.modules.torso).toBeCloseTo(25);
  combat.onProjectileHit({collider:{handle:999},point:new THREE.Vector3()} as never,new THREE.Vector3(),20,a as never); expect(props.damage).toHaveBeenLastCalledWith(expect.anything(),25,expect.anything());
  combat.damageEnabled=false; const after=target.modules.torso; combat.onProjectileHit(hit as never,new THREE.Vector3(),20,a as never);expect(target.modules.torso).toBe(after);
});
