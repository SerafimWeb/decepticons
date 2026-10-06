import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DroneRole, DroneSystem } from '../combat/DroneSystem';

/**
 * Desenho dos drones da base Serafim (só leitura da simulação, `combat/DroneSystem.ts`). Modelo procedural: casco
 * hexagonal preto com quatro braços, quatro hélices girando e uma luz embaixo na cor do papel (verde patrulha, vermelho
 * kamikaze, ciano conserto, âmbar recarga). Feixe de serviço do drone até o Mech atendido.
 * 4 draw calls para a esquadrilha inteira (casco, hélices, luzes, feixes); nada alocado por quadro.
 */
const ROLE_COLOR: Record<DroneRole, number> = {
  patrulha: 0x19ff5a,
  kamikaze: 0xff3b1a,
  conserto: 0x22d3ee,
  recarga: 0xffc21a,
};
const ARM = 0.95;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _tilt = new THREE.Quaternion();
const _p = new THREE.Vector3();
/** Escala do desenho: o drone tem ~3 m de envergadura, legível ao lado de um Mech de 5,3 m. */
const SCALE = 1.6;
const _s = new THREE.Vector3(SCALE, SCALE, SCALE);
const _up = new THREE.Vector3(0, 1, 0);
const _off = new THREE.Vector3();
const _c = new THREE.Color();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export class DroneVisuals {
  private readonly hulls: THREE.InstancedMesh;
  private readonly rotors: THREE.InstancedMesh;
  private readonly lights: THREE.InstancedMesh;
  private readonly beams: THREE.LineSegments;
  private spin = 0;

  constructor(scene: THREE.Scene, private readonly system: DroneSystem) {
    const n = system.drones.length;
    const body = new THREE.CylinderGeometry(0.55, 0.6, 0.28, 6);
    const parts: THREE.BufferGeometry[] = [body];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      parts.push(new THREE.BoxGeometry(ARM, 0.08, 0.12).rotateY(-a).translate(Math.cos(a) * ARM * 0.55, 0.02, Math.sin(a) * ARM * 0.55));
      parts.push(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 6).translate(Math.cos(a) * ARM, 0.1, Math.sin(a) * ARM));
    }
    // Lâmina sob o casco (sensor/carga): dá silhueta de máquina, não de disco.
    parts.push(new THREE.BoxGeometry(0.32, 0.18, 0.7).translate(0, -0.2, 0));
    const hullGeo = mergeGeometries(parts)!;
    for (const g of parts) g.dispose();
    this.hulls = new THREE.InstancedMesh(hullGeo, new THREE.MeshStandardMaterial({ color: 0x101216, metalness: 0.6, roughness: 0.45 }), n);
    this.rotors = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.02, 10),
      new THREE.MeshBasicMaterial({ color: 0x8a96a3, transparent: true, opacity: 0.35, depthWrite: false }),
      n * 4,
    );
    this.lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), n);
    for (const d of system.drones) this.lights.setColorAt(d.index, _c.setHex(ROLE_COLOR[d.role]).multiplyScalar(4));
    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    beamGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    this.beams = new THREE.LineSegments(beamGeo, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: 0.85 }));
    for (const o of [this.hulls, this.rotors, this.lights, this.beams]) {
      o.frustumCulled = false;
      scene.add(o);
    }
  }

  render(dt: number, alpha: number): void {
    this.spin += dt * 40;
    const pos = this.beams.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = this.beams.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (const d of this.system.drones) {
      const i = d.index;
      if (d.state === 'abatido') {
        this.hulls.setMatrixAt(i, HIDDEN);
        this.lights.setMatrixAt(i, HIDDEN);
        for (let r = 0; r < 4; r++) this.rotors.setMatrixAt(i * 4 + r, HIDDEN);
        pos.setXYZ(i * 2, 0, -100, 0);
        pos.setXYZ(i * 2 + 1, 0, -100, 0);
        continue;
      }
      _p.lerpVectors(d.prev, d.pos, alpha);
      // Inclina na direção do movimento (até ~17°): lê como voo, não como deslize.
      const tilt = Math.min(0.3, Math.hypot(d.vel.x, d.vel.z) * 0.015);
      _q.setFromAxisAngle(_up, d.yaw);
      _off.set(1, 0, 0).applyQuaternion(_q);
      _q.premultiply(_tilt.setFromAxisAngle(_off, -tilt));
      this.hulls.setMatrixAt(i, _m.compose(_p, _q, _s));
      this.lights.setMatrixAt(i, _m.compose(_off.set(0, -0.32 * SCALE, 0).applyQuaternion(_q).add(_p), _q, _s));
      for (let r = 0; r < 4; r++) {
        const a = Math.PI / 4 + (r * Math.PI) / 2;
        _off.set(Math.cos(a) * ARM, 0.2, Math.sin(a) * ARM).multiplyScalar(SCALE).applyQuaternion(_q).add(_p);
        this.rotors.setMatrixAt(i * 4 + r, _m.makeRotationY(this.spin + r).scale(_s).setPosition(_off));
      }
      if (d.servicing && d.target) {
        const t = d.target.position;
        _c.setHex(ROLE_COLOR[d.role]).multiplyScalar(3);
        pos.setXYZ(i * 2, _p.x, _p.y - 0.3, _p.z);
        pos.setXYZ(i * 2 + 1, t.x, t.y + d.target.stats.height * 0.7, t.z);
        col.setXYZ(i * 2, _c.r, _c.g, _c.b);
        col.setXYZ(i * 2 + 1, _c.r, _c.g, _c.b);
      } else {
        pos.setXYZ(i * 2, 0, -100, 0);
        pos.setXYZ(i * 2 + 1, 0, -100, 0);
      }
    }
    pos.needsUpdate = col.needsUpdate = true;
    this.hulls.instanceMatrix.needsUpdate = true;
    this.rotors.instanceMatrix.needsUpdate = true;
    this.lights.instanceMatrix.needsUpdate = true;
  }
}
