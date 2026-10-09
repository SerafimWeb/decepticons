import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GLOW } from '../core/palette';
import { growingLength, STREAK_HEAD_WIDTH, streakLength } from '../fx/ShotStreak';
import { ProjectileSystem } from './ProjectileSystem';
import { weapon, type WeaponId } from './weapons';

const FX = { burst: () => {} };
const NO_HIT = { raycast: () => null };

/** Um sistema de um projétil só: devolve o desenho dele (o primeiro `Mesh` da cena). */
function sistema() {
  const scene = new THREE.Scene();
  const system = new ProjectileSystem(scene, NO_HIT as never, FX as never, 1);
  const mesh = scene.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh)!;
  return { system, mesh };
}

describe('cauda dos tiros de energia', () => {
  it('plasma, blaster e escopeta usam a faixa, com a cauda do tamanho da velocidade deles', () => {
    for (const id of ['plasma', 'blaster', 'shotgun'] as WeaponId[]) {
      const { system, mesh } = sistema();
      system.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, weapon(id));
      expect(mesh.geometry.getAttribute('color')?.itemSize, id).toBe(4); // a faixa tem alfa por vértice; a esfera não
      expect(mesh.scale.x).toBe(STREAK_HEAD_WIDTH);
      expect(mesh.scale.z).toBe(growingLength(streakLength(weapon(id).speed), 0)); // na boca, cauda curta
      expect(mesh.scale.z).toBeLessThan(streakLength(weapon(id).speed));
      expect(mesh.visible).toBe(true);
    }
  });

  it('a cauda cresce com o caminho andado até o comprimento cheio e para de crescer', () => {
    const { system, mesh } = sistema();
    const w = weapon('plasma');
    system.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, w);
    const full = streakLength(w.speed);
    let previous = mesh.scale.z;
    for (let i = 0; i < 12; i++) {
      system.fixedUpdate(1 / 60);
      system.render(1);
      expect(mesh.scale.z).toBeGreaterThanOrEqual(previous);
      previous = mesh.scale.z;
    }
    expect(mesh.scale.z).toBe(full); // 12 ticks a 140 m/s = 28 m, bem mais que a cauda
    expect(mesh.position.z).toBeLessThan(-20); // a cabeça é a que anda; a cauda fica para trás (+Z, atrás do tiro)
  });

  it('a cauda fica ATRÁS da cabeça, em qualquer direção de tiro (a ponta do desenho é a que vai na frente)', () => {
    const dirs = [new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0.4, 0.3), new THREE.Vector3(0, 1, 0.05), new THREE.Vector3(0.3, -0.5, -1)];
    for (const raw of dirs) {
      const dir = raw.clone().normalize();
      const { system, mesh } = sistema();
      system.fire(new THREE.Vector3(5, 3, -2), dir, undefined, false, weapon('plasma'));
      for (let i = 0; i < 6; i++) { system.fixedUpdate(1 / 60); system.render(1); }
      mesh.updateMatrixWorld(true);
      const geometry = mesh.geometry.getAttribute('position');
      // O vértice com alfa 0 é a ponta da cauda; o de alfa 1, a cabeça.
      const alpha = mesh.geometry.getAttribute('color');
      const world = (i: number) => new THREE.Vector3().fromBufferAttribute(geometry, i).applyMatrix4(mesh.matrixWorld);
      const head = [0, 1].map(world);
      const tail = [2, 3].map(world);
      expect([0, 1].every((i) => alpha.getW(i) === 1) && [2, 3].every((i) => alpha.getW(i) === 0)).toBe(true);
      const headMid = head[0]!.clone().add(head[1]!).multiplyScalar(0.5);
      const tailMid = tail[0]!.clone().add(tail[1]!).multiplyScalar(0.5);
      const along = headMid.sub(tailMid); // da ponta da cauda para a cabeça
      expect(along.length()).toBeCloseTo(mesh.scale.z, 4); // o comprimento é o da escala
      expect(along.normalize().dot(dir), `${raw.toArray()}`).toBeGreaterThan(0.9999); // aponta para onde o tiro vai
    }
  });

  it('o canhão de trilho e o EMP mantêm o desenho próprio (pílula longa e esfera), sem cauda', () => {
    const rail = sistema();
    rail.system.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, weapon('railgun'));
    expect(rail.mesh.geometry.getAttribute('color')).toBeUndefined();
    expect(rail.mesh.scale.toArray()).toEqual([0.45, 0.45, 18]);

    const emp = sistema();
    emp.system.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, weapon('emp'));
    expect(emp.mesh.geometry.getAttribute('color')).toBeUndefined();
    expect(emp.mesh.scale.toArray()).toEqual([2.5, 2.5, 2.5]);
  });

  it('o mesmo projétil do pool volta a ser esfera depois de ter sido faixa (e vice-versa)', () => {
    const { system, mesh } = sistema();
    system.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, weapon('plasma'));
    expect(mesh.geometry.getAttribute('color')).toBeDefined();
    system.clear();
    system.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, weapon('emp'));
    expect(mesh.geometry.getAttribute('color')).toBeUndefined();
    system.clear();
    system.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, weapon('plasma'));
    expect(mesh.geometry.getAttribute('color')).toBeDefined();
    expect(mesh.scale.x).toBe(STREAK_HEAD_WIDTH); // a escala do EMP (2,5) não vaza para o plasma
    expect(mesh.scale.z).toBeLessThan(2.5);
  });

  it('o tiro do inimigo sai vermelho e o do jogador, verde, nos dois desenhos', () => {
    for (const id of ['plasma', 'emp'] as WeaponId[]) {
      const friendly = sistema();
      friendly.system.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, false, weapon(id));
      const hostile = sistema();
      hostile.system.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), undefined, true, weapon(id));
      const color = (m: THREE.Mesh) => (m.material as THREE.MeshBasicMaterial).color;
      expect(color(friendly.mesh).equals(GLOW.friendlyPlasma), id).toBe(true);
      expect(color(hostile.mesh).equals(GLOW.hostilePlasma), id).toBe(true);
    }
  });
});
