import * as THREE from 'three';
import { describe,expect,it } from 'vitest';
import { ProjectileSystem } from './ProjectileSystem';
import { weapon } from './weapons';
const FX={burst:()=>{}};
describe('projéteis rápidos e distância real do EMP',()=>{
  it('raycast percorre o segmento e limita ao alcance mesmo quando um tick passaria dele',()=>{
    const lengths:number[]=[];
    const physics={raycast:(_p:THREE.Vector3,_d:THREE.Vector3,max:number)=>{lengths.push(max);return null;}};
    const scene=new THREE.Scene();const p=new ProjectileSystem(scene,physics as never,FX as never,1);
    p.fire(new THREE.Vector3(),new THREE.Vector3(0,0,-1),undefined,false,{...weapon('railgun'),maxRange:10});
    p.fixedUpdate(1/60);p.fixedUpdate(1/60);
    expect(lengths).toEqual([10]);
    expect(scene.children.some(n=>n.visible)).toBe(true); // traço ainda dura 0,12 s
    p.clear();expect(scene.children.every(n=>!n.visible)).toBe(true);
  });
  it('impacto entrega a arma e distância exatas, inclusive no disparo muito rápido',()=>{
    const hit={distance:5,point:new THREE.Vector3(0,0,-5),normal:new THREE.Vector3(0,0,1),collider:{handle:9}};
    const physics={raycast:(_p:THREE.Vector3,_d:THREE.Vector3,max:number)=>max>=5?hit:null};
    const p=new ProjectileSystem(new THREE.Scene(),physics as never,FX as never,1);
    let count=0;let distance=0;let id='';
    p.onHit=(_hit,_dir,_damage,_owner,w,d)=>{count++;distance=d!;id=w!.id;};
    p.fire(new THREE.Vector3(),new THREE.Vector3(0,0,-1),undefined,false,weapon('railgun'));
    p.fixedUpdate(1/60);p.fixedUpdate(1/60);
    expect(count).toBe(1);expect(distance).toBe(5);expect(id).toBe('railgun');
  });
});
