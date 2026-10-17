import * as THREE from 'three';
import { PALETTE } from '../core/palette';
/**
 * Desenho estático sobre a fachada existente. Criado só no navegador, fora da simulação. Devolve as cores que acendem a placa e o contorno da porta: o **transformador do banco**
 * (P164, parte E) as escurece com a energia (`Arena.registraLuzes`).
 */
export function addBankSign(scene: THREE.Scene): THREE.Color[] {
  const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#438cff'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(44, 88); ctx.lineTo(86, 208); ctx.lineTo(128, 88); ctx.lineTo(169, 208); ctx.lineTo(210, 88); ctx.stroke();
  ctx.fillStyle = '#5098ff'; ctx.font = '700 122px Arial'; ctx.textBaseline = 'middle';
  ctx.fillText('BANCO VORCARIS', 245, 146);
  ctx.font = '32px Arial'; ctx.fillText('TERMINAL DE CRÉDITOS  /  ACESSO NO TÉRREO', 250, 263);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const light = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.bankBlue).multiplyScalar(2.5) });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: texture, transparent: true, color: new THREE.Color(2, 2, 2), depthWrite: false }));
  const backing = new THREE.Mesh(new THREE.BoxGeometry(14.4, 3.9, 0.1), new THREE.MeshBasicMaterial({ color: 0x030912 }));
  backing.position.set(-28, 24, -26.7); scene.add(backing);
  plate.position.set(-28, 24, -26.61); scene.add(plate);
  const box = (w: number, h: number, x: number, y: number, z: number) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), light); mesh.position.set(x, y, z); scene.add(mesh); };
  box(14, 0.06, -28, 22, -26.59);
  box(0.1, 6, -30, 3, -26.85); box(0.1, 6, -26, 3, -26.85); box(4, 0.1, -28, 6, -26.85);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 5.8), new THREE.MeshBasicMaterial({ color: PALETTE.bankBlue, transparent: true, opacity: 0.15, depthWrite: false }));
  door.position.set(-28, 3, -26.8); scene.add(door);
  box(4, 0.08, -28, 0.12, -25);
  return [light.color, (plate.material as THREE.MeshBasicMaterial).color];
}
