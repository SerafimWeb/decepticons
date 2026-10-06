import * as THREE from 'three';
import { describe,expect,it } from 'vitest';
import { Vector09 } from '../entities/Vector09';
import { CombatSystem } from './CombatSystem';
import { applyEmp } from './EmpEffect';
import { weapon } from './weapons';
const FX={burst:()=>{}};
const props={damage:()=>{},damageInRadius:()=>{}};
const debris={shatter:()=>{}};
describe('EMP autoritativo no impacto',()=>{
  it('aquece conforme distância sem causar dano no efeito isolado',()=>{
    const m=new Vector09();const hp=m.modules.torso;
    applyEmp(m,weapon('emp'),10);expect(m.heat).toBeCloseTo(0.2);expect(m.modules.torso).toBe(hp);
    const far=new Vector09();applyEmp(far,weapon('emp'),110);expect(far.heat).toBeCloseTo(0.1);
    applyEmp(far,weapon('plasma'),0);expect(far.heat).toBeCloseTo(0.1);
  });
  it('um alvo frio continua podendo disparar; calor normal volta por ventilação',()=>{
    const m=new Vector09();applyEmp(m,weapon('emp'),0);expect(m.canFirePrimary).toBe(true);
    m.vent(0.2);expect(m.heat).toBe(0);
    m.absorbEmp(0.95);applyEmp(m,weapon('emp'),0);expect(m.overheated).toBe(true);
    m.vent(1);expect(m.overheated).toBe(false);
  });
  it('cliente online com dano desligado não aplica nem calor nem vida',()=>{
    const combat=new CombatSystem(props as never,debris as never,FX as never);
    const m=new Vector09();const collider={handle:123};Object.defineProperty(m,'collider',{value:collider});
    combat.register(m);combat.damageEnabled=false;
    combat.onProjectileHit({collider,point:new THREE.Vector3(0,2.4,0)} as never,new THREE.Vector3(0,0,-1),9,undefined,weapon('emp'),0);
    expect(m.heat).toBe(0);expect(m.modules.torso).toBe(m.stats.maxModuleHealth.torso);
    combat.damageEnabled=true;
    combat.onProjectileHit({collider,point:new THREE.Vector3(0,2.4,0)} as never,new THREE.Vector3(0,0,-1),9,undefined,weapon('emp'),0);
    expect(m.heat).toBeGreaterThanOrEqual(0.2);expect(m.modules.torso).toBeLessThan(m.stats.maxModuleHealth.torso);
  });
});
