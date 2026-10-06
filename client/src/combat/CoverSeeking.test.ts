import * as THREE from 'three';
import { expect,it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Vector09 } from '../entities/Vector09';
import { CoverSeeking } from './CoverSeeking';

it('busca proteção atrás de parede, sem inventar cobertura em campo aberto',async()=>{
  const physics=await PhysicsWorld.create();
  try {
    physics.addStaticBox(new THREE.Vector3(0,-1,0),new THREE.Vector3(100,2,100));
    const mech=new Vector09(),threat=new Vector09();
    mech.spawn(physics,new THREE.Vector3(0,0,0));threat.spawn(physics,new THREE.Vector3(0,0,-25));
    physics.step();
    const cover=new CoverSeeking(physics,mech);
    expect(cover.find(1,threat)).toBe(false);
    const wall=physics.addStaticBox(new THREE.Vector3(8,5,0),new THREE.Vector3(4,10,14));
    physics.step();
    expect(cover.find(1,threat)).toBe(true);
    const eye=threat.simPosition.clone().add(new THREE.Vector3(0,threat.stats.height*.7,0));
    const point=cover.goal.clone().add(new THREE.Vector3(0,mech.stats.height*.55,0));
    const ray=point.clone().sub(eye);const distance=ray.length();ray.normalize();
    expect(physics.firstColliderOnRay(eye,ray,distance,threat.collider)?.handle).toBe(wall.handle);
  } finally {physics.world.free();}
});
