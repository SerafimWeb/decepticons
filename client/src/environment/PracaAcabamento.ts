import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { Montador } from './PraiaMontador';
import { blocosDaPraca, PRACA_FONTES, PRACA_LIMITES } from './PracaLayout';

/** Detalhe estático da Praça: geometrias combinadas, sem colisores nem trabalho por tick. */
export function acabamentoDaPraca(scene: THREE.Scene): void {
  const pedra = new Montador(), metal = new Montador(), verde = new Montador();
  const sombras = new Montador();
  const rng = mulberry32(8012023);
  // Base distante sob o horizonte: as silhuetas assentam no terreno, além da cerca jogável.
  pedra.caixa(1000, 0.1, 1000, 0, -0.7, 0, 0x7b8d6b);
  // Juntas do calçamento e faixas da via: geometria rente ao piso, sem textura repetindo nas fachadas.
  for (let x = 42; x < 101; x += 4) for (const s of [-1, 1]) pedra.caixa(0.025, 0.01, 54, x, 0.08, s * 51, 0x969c98);
  for (let z = -78; z < 80; z += 4) if (Math.abs(z) > 23) pedra.caixa(59, 0.01, 0.025, 71.5, 0.08, z, 0x969c98);
  for (let x = -116; x < -8; x += 10) {
    pedra.caixa(4, 0.016, 0.19, x, 0.095, 0.5, 0xe3d6ac).caixa(4, 0.016, 0.19, x, 0.095, -0.5, 0xe3d6ac);
  }
  // Torres e ministérios: montantes metálicos e ritmo horizontal nas fachadas.
  for (const z of [-15, 15]) {
    for (let y = 7; y < 52; y += 2.5) {
      metal.caixa(9.4, 0.11, 28.3, 30, y, z, 0xa4b5bb);
    }
    for (let k = -12; k <= 12; k += 3) for (const x of [25.43, 34.57]) metal.caixa(0.09, 46, 0.10, x, 28, z + k, 0xc4cecd);
  }
  for (const s of [-1, 1]) for (const x of [-100, -72, -44]) {
    for (let k = -6; k <= 6; k += 3) metal.caixa(0.12, 4.6, 0.10, x + k, 9, s * 45.35, 0x9aabae);
  }
  // Ônibus deixam de ser caixas amarelas: janelas, rodas, para-choques e portas.
  for (const f of PRACA_FONTES) if (f.tipo === 'onibus') {
    for (const s of [-1, 1]) {
      for (let k = -4; k <= 4; k += 1.65) metal.caixa(1.35, 1.05, 0.045, f.x + k, 2.33, f.z + s * 1.62, 0x203c4c);
      for (const x of [-3.8, 3.8]) metal.cilindro(0.72, 0.72, 0.25, 10, f.x + x, 0.72, f.z + s * 1.63, 0x272b2e, Math.PI / 2);
      metal.caixa(11.8, 0.15, 0.05, f.x, 1.5, f.z + s * 1.63, 0xe7e2ce);
    }
    metal.caixa(0.10, 1.3, 2.7, f.x + 6.03, 2.22, f.z, 0x294854)
      .caixa(0.1, 0.3, 3.25, f.x + 6.07, 0.55, f.z, 0xbcc0b9);
  }
  // Árvores nas bordas e nos gramados da Esplanada; troncos/copa num único lote cada.
  const arvore = (x: number, z: number, escala: number): void => {
    sombras.cilindro(2.8 * escala, 2.8 * escala, 0.008, 16, x + 1.1, 0.14, z - 0.6, 0x192c23);
    metal.cilindro(0.16 * escala, 0.28 * escala, 3.2 * escala, 6, x, 1.6 * escala, z, 0x76644a);
    for (let k = 0; k < 4; k++) {
      const a = k * 2.4;
      verde.esfera(1.55 * escala, 7, x + Math.cos(a) * escala, (3.6 + (k % 2) * 0.6) * escala, z + Math.sin(a) * escala, [0x46794b, 0x5f8b50, 0x779a56, 0x3d6a45][k]!, 1.1, 0.75, 1);
    }
  };
  for (const s of [-1, 1]) for (let x = -112; x < -15; x += 16) arvore(x, s * (30 + rng() * 6), 0.85 + rng() * 0.4);
  for (const z of [-66, -47, 48, 66]) arvore(96, z, 1.05);
  // A antiga parede opaca de 5 m escondia todo o horizonte. O mesmo limite físico ganha grade visível.
  for (let x = PRACA_LIMITES.minX; x <= PRACA_LIMITES.maxX; x += 4) for (const s of [-1, 1]) {
    metal.caixa(0.12, 5, 0.12, x, 2.5, s * 80, 0x768487);
  }
  for (let z = -80; z <= 80; z += 4) for (const x of [PRACA_LIMITES.minX, PRACA_LIMITES.maxX]) metal.caixa(0.12, 5, 0.12, x, 2.5, z, 0x768487);
  for (const y of [1.5, 3.2, 4.9]) {
    for (const z of [-80, 80]) metal.caixa(224, 0.075, 0.075, -10, y, z, 0x788b8d);
    for (const x of [-122, 102]) metal.caixa(0.075, 0.075, 160, x, y, 0, 0x788b8d);
  }
  // Silhueta distante da cidade e vegetação do lago: fora da área jogável, só cor e profundidade.
  for (let k = 0; k < 45; k++) {
    const a = k / 45 * Math.PI * 2, distancia = 240 + rng() * 90;
    const h = 8 + rng() * 25;
    pedra.caixa(10 + rng() * 14, h, 10 + rng() * 14, Math.cos(a) * distancia, h / 2 - 3, Math.sin(a) * distancia, 0x9fadb1);
    verde.esfera(18, 6, Math.cos(a) * 210, -1, Math.sin(a) * 210, 0x7c9880, 1.4, 0.35, 1);
  }
  // Arbustos apenas sobre os quatro canteiros existentes; nenhuma cobertura física nova.
  for (const b of blocosDaPraca()) if (b.kind === 'pedra' && b.w === 8 && b.d === 2.6) {
    for (let k = -3; k <= 3; k += 1.5) verde.esfera(1, 6, b.x + k, 1.65, b.z, k < 0 ? 0x62834e : 0x7f9650, 1, 0.55, 0.85);
  }
  // Entulho miúdo e papéis caídos nas frentes, deterministas e sem física por peça.
  for (let k = 0; k < 110; k++) {
    const x = k < 55 ? -18 + rng() * 15 : 45 + rng() * 42;
    const z = k < 55 ? -30 + rng() * 60 : (k % 2 ? -47 : 51) + (rng() - 0.5) * 5;
    pedra.caixa(0.15 + rng() * 0.32, 0.015, 0.24 + rng() * 0.24, x, 0.13, z, k % 4 === 0 ? 0x8badaa : 0xe2dfcd, 0, rng() * 6);
  }
  for (const [montador, roughness] of [[pedra, 0.9], [metal, 0.55], [verde, 0.85]] as const) {
    const mesh = new THREE.Mesh(montador.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: montador === metal ? 0.18 : 0 }));
    scene.add(mesh);
  }
  // Contato com o chão sem shadow map nem renderização extra da cena por quadro.
  scene.add(new THREE.Mesh(sombras.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false })));
  // Sol estilizado no horizonte (sem luz extra por árvore ou partícula).
  const sol = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffebbe, fog: false }));
  sol.position.set(-380, 190, -420); scene.add(sol);
  const ceu = new THREE.SphereGeometry(500, 32, 20);
  const pos = ceu.getAttribute('position'), cores = new Float32Array(pos.count * 3);
  const baixo = new THREE.Color(0xe3daca), alto = new THREE.Color(0x508cb8), cor = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    cor.copy(baixo).lerp(alto, Math.max(0, Math.min(1, pos.getY(k) / 350)));
    cores[k * 3] = cor.r; cores[k * 3 + 1] = cor.g; cores[k * 3 + 2] = cor.b;
  }
  ceu.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  const fundo = new THREE.Mesh(ceu, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, depthTest: false }));
  fundo.renderOrder = -100; scene.add(fundo);
}

/** Textura mineral gerada uma vez; não depende de rede e usa semente fixa. */
export function texturaDaPraca(): THREE.DataTexture {
  const n = 64, pixels = new Uint8Array(n * n * 4), rng = mulberry32(801);
  for (let i = 0; i < n * n; i++) {
    const v = Math.floor(240 + rng() * 15);
    pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = v; pixels[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(pixels, n, n); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
