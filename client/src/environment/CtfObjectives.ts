import * as THREE from 'three';
import { PALETTE } from '../core/palette';
import { CTF_BASES, type CaptureTheFlag, type CtfTeam } from '../sim/CaptureTheFlag';

const BLUE = new THREE.Color(PALETTE.cyan);
const RED = new THREE.Color(PALETTE.signal);
const COLORS: readonly THREE.Color[] = [BLUE, RED];
const GLOW_COLORS: readonly THREE.Color[] = [BLUE.clone().multiplyScalar(1.8), RED.clone().multiplyScalar(1.8)];
const TEAMS: readonly CtfTeam[] = ['blue', 'red'];
const IDENTITY = new THREE.Quaternion();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);
const _matrix = new THREE.Matrix4();
const _flagPosition = { x: 0, y: 0, z: 0 };

/**
 * Leitura 3D barata do CTF: duas bases holográficas e duas bandeiras. São quatro InstancedMesh e
 * uma malha de dois quads (cinco draw calls fixos), sem luz, sombra, física ou alocação por quadro. O bloom só aproveita o
 * emissive que já existe na qualidade alta; na GPU integrada o material continua legível sozinho.
 */
export class CtfObjectives {
  readonly group = new THREE.Group();
  private readonly pads: THREE.InstancedMesh;
  private readonly rings: THREE.InstancedMesh;
  private readonly shells: THREE.InstancedMesh;
  private readonly poles: THREE.InstancedMesh;
  private readonly cloths: THREE.Mesh;
  private readonly clothPositions = new Float32Array(24);
  private pulse = 0;
  private capturePulse = 0;

  constructor(scene: THREE.Scene) {
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x18232a,
      emissive: 0x000000,
      metalness: 0.7,
      roughness: 0.35,
      vertexColors: true,
    });
    const neonMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const shellMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const poleMaterial = new THREE.MeshBasicMaterial({ color: 0x626d72 });
    const clothMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      toneMapped: false,
      side: THREE.DoubleSide,
    });

    this.pads = new THREE.InstancedMesh(new THREE.CylinderGeometry(7, 7.6, 0.38, 24), baseMaterial, 2);
    this.rings = new THREE.InstancedMesh(new THREE.TorusGeometry(7.2, 0.16, 6, 36), neonMaterial, 2);
    this.shells = new THREE.InstancedMesh(new THREE.CylinderGeometry(6.8, 7.1, 1.8, 24, 1, true), shellMaterial, 2);
    this.poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 4.7, 8), poleMaterial, 2);
    const clothGeometry = new THREE.BufferGeometry();
    clothGeometry.setAttribute('position', new THREE.BufferAttribute(this.clothPositions, 3));
    clothGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(24), 3));
    clothGeometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    this.cloths = new THREE.Mesh(clothGeometry, clothMaterial);
    this.pads.frustumCulled = this.rings.frustumCulled = this.shells.frustumCulled = false;
    this.poles.frustumCulled = this.cloths.frustumCulled = false;

    for (let i = 0; i < 2; i++) {
      const team = TEAMS[i]!;
      const base = CTF_BASES[team];
      const color = COLORS[i]!;
      const glow = GLOW_COLORS[i]!;
      this.setInstance(this.pads, i, base.x, 0.18, base.z);
      _position.set(base.x, 0.42, base.z);
      _matrix.makeRotationX(Math.PI / 2).setPosition(_position);
      this.rings.setMatrixAt(i, _matrix);
      this.setInstance(this.shells, i, base.x, 0.95, base.z);
      this.pads.setColorAt(i, color);
      this.rings.setColorAt(i, glow);
      this.shells.setColorAt(i, glow);
      const colors = clothGeometry.getAttribute('color') as THREE.BufferAttribute;
      for (let vertex = 0; vertex < 4; vertex++) colors.setXYZ(i * 4 + vertex, color.r, color.g, color.b);
      this.setCloth(i, base.x, 0, base.z, 0);
    }
    this.pads.instanceMatrix.needsUpdate = this.rings.instanceMatrix.needsUpdate = true;
    this.shells.instanceMatrix.needsUpdate = true;
    this.pads.instanceColor!.needsUpdate = this.rings.instanceColor!.needsUpdate = true;
    this.shells.instanceColor!.needsUpdate = true;
    (clothGeometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    this.group.add(this.pads, this.rings, this.shells, this.poles, this.cloths);
    scene.add(this.group);
  }

  flashCapture(): void {
    this.capturePulse = 1;
  }

  update(dt: number, ctf: CaptureTheFlag): void {
    this.pulse += dt;
    this.capturePulse = Math.max(0, this.capturePulse - dt * 1.4);
    const shellScale = 1 + Math.sin(this.pulse * 2.8) * 0.035 + this.capturePulse * 0.12;
    for (let i = 0; i < 2; i++) {
      const team = TEAMS[i]!;
      const base = CTF_BASES[team];
      _position.set(base.x, 0.95, base.z);
      _scale.set(shellScale, 1 + this.capturePulse * 0.8, shellScale);
      _matrix.compose(_position, IDENTITY, _scale);
      this.shells.setMatrixAt(i, _matrix);

      ctf.flagPosition(team, _flagPosition);
      this.setInstance(this.poles, i, _flagPosition.x, _flagPosition.y + 2.35, _flagPosition.z);
      this.setCloth(i, _flagPosition.x, _flagPosition.y, _flagPosition.z, Math.sin(this.pulse * 5 + i * Math.PI) * 0.08);
    }
    this.shells.instanceMatrix.needsUpdate = true;
    this.poles.instanceMatrix.needsUpdate = true;
    (this.cloths.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private setInstance(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number): void {
    _position.set(x, y, z);
    _scale.set(1, 1, 1);
    _matrix.compose(_position, IDENTITY, _scale);
    mesh.setMatrixAt(index, _matrix);
  }

  private setCloth(index: number, x: number, y: number, z: number, wave: number): void {
    const offset = index * 12;
    const p = this.clothPositions;
    p[offset] = x + 0.12;
    p[offset + 1] = y + 4.35;
    p[offset + 2] = z;
    p[offset + 3] = x + 1.95;
    p[offset + 4] = y + 4.27 + wave;
    p[offset + 5] = z;
    p[offset + 6] = x + 1.95;
    p[offset + 7] = y + 3.15 - wave;
    p[offset + 8] = z;
    p[offset + 9] = x + 0.12;
    p[offset + 10] = y + 3.2;
    p[offset + 11] = z;
  }
}
