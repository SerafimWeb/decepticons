import * as THREE from 'three';
import { expect, it } from 'vitest';
import { Vector09 } from '../entities/Vector09';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { BotSystem } from './BotSystem';
import { CombatSystem } from './CombatSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { Respawner } from './Respawner';

async function squad(wall = false) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0,-1,0),new THREE.Vector3(200,2,200));
  if(wall) physics.addStaticBox(new THREE.Vector3(0,8,-30),new THREE.Vector3(30,16,2));
  const scene = new THREE.Scene();
  const particles = {burst:()=>{}} as never;
  const combat = new CombatSystem({damage:()=>false} as never,{} as never,particles);
  const projectiles = new ProjectileSystem(scene,physics,particles);
  projectiles.onHit=(hit,dir,dmg,owner,w)=>combat.onProjectileHit(hit,dir,dmg,owner,w);
  const player = new Vector09(); player.spawn(physics,new THREE.Vector3(0,0,-60)); combat.register(player);
  const bots = new BotSystem({physics,scene,combat,projectiles,particles,respawner:new Respawner([[0,0]]),
    spawns:[[-3,0],[3,0]], waypoints:[[0,60]],escort:[player],seed:7});
  const run=(seconds:number)=>{
    for(let i=0;i<Math.round(seconds/FIXED_DT);i++){
      bots.fixedUpdate(FIXED_DT); projectiles.fixedUpdate(FIXED_DT); physics.step();
    }
  };
  physics.step();
  return {physics,bots,player,combat,projectiles,run};
}

it('aliados saem do spawn, acompanham o jogador e renderizam onde a física está',async()=>{
  const s=await squad();
  try {
    const starts=s.bots.mechs.map(m=>m.simPosition.clone());
    s.run(10);
    s.bots.render(1/60,1);
    for(const [i,m] of s.bots.mechs.entries()) {
      expect(m.simPosition.distanceTo(starts[i]!)).toBeGreaterThan(35);
      expect(m.simPosition.distanceTo(s.player.simPosition)).toBeLessThan(18);
      expect(m.position.distanceTo(m.simPosition)).toBeLessThan(0.1);
    }
    s.player.respawn(new THREE.Vector3(40,0,-60));
    s.run(10);
    for(const m of s.bots.mechs) expect(m.simPosition.distanceTo(s.player.simPosition)).toBeLessThan(20);
  } finally {s.physics.world.free();}
});

it('escolta contorna parede entre ela e o jogador em vez de girar encalhada',async()=>{
  const s=await squad(true);
  try {
    s.run(18);
    for(const m of s.bots.mechs) {
      expect(m.simPosition.z).toBeLessThan(-35);
      expect(m.simPosition.distanceTo(s.player.simPosition)).toBeLessThan(22);
    }
  } finally {s.physics.world.free();}
});

it('pedido de ajuda provoca reação e apoio real com plasma e EMP, sem mirar no aliado',async()=>{
  const s=await squad();
  try {
    s.player.respawn(new THREE.Vector3(0,0,5));
    const enemy=new Vector09();enemy.spawn(s.physics,new THREE.Vector3(0,0,-28));s.combat.register(enemy);
    s.bots.targets=[enemy];
    s.bots.defend(s.player,enemy);
    for(const m of s.bots.mechs) expect(s.bots.brainOf(m)?.currentTarget).toBe(enemy);
    const fired=new Set<string>();
    const fire=s.projectiles.fire.bind(s.projectiles);
    s.projectiles.fire=(...args)=>{fired.add(args[4]?.id??'');fire(...args);};
    const hp=enemy.modules.torso;
    s.run(5);
    expect(fired.has('plasma')).toBe(true);expect(fired.has('emp')).toBe(true);
    expect(enemy.modules.torso).toBeLessThan(hp);
    expect(enemy.heat).toBeGreaterThan(0);
    for(const m of s.bots.mechs) expect(s.bots.brainOf(m)?.currentTarget).not.toBe(s.player);
  } finally {s.physics.world.free();}
});

it('ordens são aplicadas no tick: defender não segue o líder, acompanhar libera a posição',async()=>{
  const s=await squad();
  try {
    const post=new THREE.Vector3(0,0,-15);
    expect(s.bots.queueOrder('hold',post)).toBe(true);
    expect(s.bots.order).toBe('follow');
    s.run(8);
    expect(s.bots.order).toBe('hold');
    for(const m of s.bots.mechs) expect(m.simPosition.distanceTo(post)).toBeLessThan(12);
    expect(s.bots.queueOrder('focus',post,s.player)).toBe(false);
    s.bots.queueOrder('follow',post);s.run(9);
    for(const m of s.bots.mechs) expect(m.simPosition.distanceTo(s.player.simPosition)).toBeLessThan(20);
  } finally {s.physics.world.free();}
});

it('foco troca o alvo prioritário; alvo destruído devolve a escolta',async()=>{
  const s=await squad();
  try {
    const a=new Vector09(), b=new Vector09();
    a.spawn(s.physics,new THREE.Vector3(-10,0,-25));b.spawn(s.physics,new THREE.Vector3(10,0,-30));
    s.bots.targets=[a,b];
    expect(s.bots.queueOrder('focus',s.player.simPosition,b)).toBe(true);
    s.run(0.1);
    for(const m of s.bots.mechs) expect(s.bots.brainOf(m)?.currentTarget).toBe(b);
    b.deactivate();s.run(0.1);
    expect(s.bots.order).toBe('follow');
  } finally {s.physics.world.free();}
});
