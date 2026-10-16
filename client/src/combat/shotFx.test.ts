import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ShotFx } from '../fx/WeaponFx';
import { BarrageSystem } from './BarrageSystem';
import { CruiseSystem } from './CruiseSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { RocketSystem } from './RocketSystem';
import { weapon } from './weapons';

/**
 * O contrato entre a simulação de tiro e quem desenha (P160, `ShotFx`): cada tiro avisa a saída (`fired`), cada quadro a posição (`flying`), o acerto
 * (`impact`, dizendo se a superfície é parada) e o fim (`landed`, com o número do rastro que ele recebeu). Sem `fx` (o servidor), nada muda e nada é
 * chamado; com ele, o rastro de partículas antigo do míssil sai (a fita o substitui).
 */

/** Um `ShotFx` que só anota o que recebeu. */
function gravador(): ShotFx & { log: string[]; estatico: boolean[] } {
  let id = 40;
  const log: string[] = [];
  const estatico: boolean[] = [];
  return {
    log,
    estatico,
    fired: (_o, _d, w) => { const t = id++; log.push(`fired:${w.id}:${t}`); return t; },
    flying: (t, _a, w) => { if (!log.includes(`flying:${w.id}:${t}`)) log.push(`flying:${w.id}:${t}`); },
    impact: (_a, _n, w, _h, onStatic) => { log.push(`impact:${w.id}`); estatico.push(onStatic); },
    landed: (t, _f, _to, w) => { log.push(`landed:${w.id}:${t}`); },
    trail: (kind) => { log.push(`trail:${kind}`); return id++; },
  };
}

const PARTICULAS = () => {
  const n = { bursts: 0 };
  return { n, ps: { burst: () => { n.bursts++; } } };
};

describe('o contrato ShotFx da simulação de tiro (P160)', () => {
  it('projétil: saída, voo, acerto e fim com o mesmo rastro; o acerto diz se a superfície é parada (parede) ou não (Mech)', () => {
    const corpo = {};
    let alvo: object | null = null;
    const physics = {
      raycast: (_p: THREE.Vector3, _d: THREE.Vector3, max: number) =>
        max >= 2 ? { distance: 2, point: new THREE.Vector3(0, 0, -2), normal: new THREE.Vector3(0, 0, 1), collider: { parent: () => alvo } } : null,
    };
    const { ps } = PARTICULAS();
    const p = new ProjectileSystem(new THREE.Scene(), physics as never, ps as never, 4);
    const fx = gravador();
    p.fx = fx;
    p.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, weapon('cannon'));
    p.render(0.5);
    p.fixedUpdate(1 / 60);
    expect(fx.log).toEqual(['fired:cannon:40', 'flying:cannon:40', 'impact:cannon', 'landed:cannon:40']);
    alvo = corpo; // agora o tiro bate num corpo (um Mech)
    p.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, weapon('plasma'));
    p.fixedUpdate(1 / 60);
    expect(fx.estatico).toEqual([true, false]);
  });

  it('foguete: com fx, o rastro é a fita (sem partículas de rastro) e solta na explosão; sem fx (servidor), as partículas de sempre e nada chamado', () => {
    const longe = { raycast: () => null };
    const comFx = PARTICULAS();
    const r = new RocketSystem(new THREE.Scene(), longe as never, comFx.ps as never, 2);
    const fx = gravador();
    r.fx = fx;
    const w = { ...weapon('rockets'), maxRange: 3 };
    r.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, w);
    for (let i = 0; i < 4; i++) { r.fixedUpdate(1 / 60); r.render(1); }
    expect(comFx.n.bursts).toBe(0);
    expect(fx.log).toEqual(['fired:rockets:40', 'flying:rockets:40', 'landed:rockets:40']);
    const semFx = PARTICULAS();
    const s = new RocketSystem(new THREE.Scene(), longe as never, semFx.ps as never, 2);
    s.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, w);
    for (let i = 0; i < 4; i++) s.fixedUpdate(1 / 60);
    expect(semFx.n.bursts).toBeGreaterThan(0);
  });

  it('míssil leve: o pool cheio reaproveita o mais velho e solta o rastro dele antes', () => {
    const longe = { raycast: () => null };
    const r = new RocketSystem(new THREE.Scene(), longe as never, PARTICULAS().ps as never, 1);
    const fx = gravador();
    r.fx = fx;
    const w = weapon('swarm', 2);
    for (let i = 0; i < 129; i++) r.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, w);
    expect(fx.log.filter((l) => l.startsWith('landed')).length).toBe(1);
    expect(fx.log.includes('landed:swarm:40')).toBe(true);
  });

  it('cruzador: o rastro nasce no disparo e solta na chegada', () => {
    const physics = { raycast: () => null, terrainY: () => 0 };
    const c = new CruiseSystem(new THREE.Scene(), physics as never, PARTICULAS().ps as never);
    const fx = gravador();
    c.fx = fx;
    c.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(30, 0, 0), undefined, weapon('cruise'));
    c.render(0);
    for (let i = 0; i < 120 && c.active > 0; i++) c.fixedUpdate(1 / 60);
    expect(c.active).toBe(0);
    expect(fx.log).toEqual(['fired:cruise:40', 'flying:cruise:40', 'landed:cruise:40']);
  });

  it('chuva de mísseis: o lançamento ganha rastro, cada bomba que cai ganha o dela, e todos soltam', () => {
    const physics = { raycast: () => null, terrainY: () => 0 };
    const b = new BarrageSystem(new THREE.Scene(), physics as never);
    const fx = gravador();
    b.fx = fx;
    const w = weapon('barrage');
    b.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -40), undefined, w);
    for (let i = 0; i < 400 && b.active > 0; i++) { b.fixedUpdate(1 / 60); b.render(0); }
    expect(b.active).toBe(0);
    const trilhas = fx.log.filter((l) => l.startsWith('trail:')).length;
    expect(trilhas).toBe(w.barrage!.bombs);
    // o lançamento + cada bomba: todo rastro aberto foi solto
    expect(fx.log.filter((l) => l.startsWith('landed:')).length).toBe(1 + trilhas);
  });
});
