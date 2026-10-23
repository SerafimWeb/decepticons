import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Montador, pinta } from './PraiaMontador';

/** Modelos da prancha do Comandante (P250). Frente +X; cores de vértice, uma malha por figurante. */
export const JANEIRO_CORES = { roxo: 0x982dff, luz: 0xdcbaff, ouro: 0xe8b431, osso: 0xf4edda, azul: 0x134ea1, preto: 0x151e30, pele: 0xe3b980 } as const;
const olho = 0x15161a;
export type TipoJaneiro = 'gado' | 'careca' | 'peruca' | 'bandeira' | 'sam' | 'porco' | 'pneu' | 'viking' | 'trampado' | 'evil';

function chanfro(m: Montador, w: number, h: number, d: number, x: number, y: number, z: number, cor: number): void {
  const g = new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.1);
  g.translate(x, y, z); pinta(g, cor); m.pronta(g);
}

function olhos(m: Montador, x: number, y: number, largura: number, cor = olho): void {
  for (const s of [-1, 1]) {
    m.caixa(0.022, 0.065, 0.06, x, y, s * largura, cor);
    m.caixa(0.026, 0.018, 0.018, x + 0.014, y + 0.013, s * largura - 0.01, 0xffffff);
  }
}

function cabeca(tipo: TipoJaneiro): THREE.BufferGeometry {
  const m = new Montador();
  const pele = tipo === 'trampado' ? JANEIRO_CORES.osso : JANEIRO_CORES.pele;
  if (tipo === 'gado') {
    m.esfera(0.19, 8, 0.02, 1.74, 0, 0xf1eee5, 0.9, 1.18, 0.95)
      .esfera(0.13, 6, 0.15, 1.75, -0.085, 0x202121, 0.48, 1.2, 0.7)
      .esfera(0.12, 8, 0.19, 1.62, 0, 0xe4a3a1, 0.65, 0.6, 1.22);
    for (const s of [-1, 1]) {
      m.esfera(0.095, 6, 0, 1.81, s * 0.21, 0x333533, 0.65, 0.45, 1)
        .barra(-0.02, 1.87, s * 0.13, -0.04, 2.02, s * 0.21, 0.053, 0xc6b188)
        .barra(-0.04, 2.02, s * 0.21, 0.01, 2.10, s * 0.19, 0.028, 0xf2dfb4)
        .esfera(0.022, 6, 0.267, 1.635, s * 0.065, 0x654448);
    }
    olhos(m, 0.185, 1.79, 0.103);
  } else if (tipo === 'porco') {
    m.esfera(0.235, 10, 0.035, 1.62, 0, 0xf0b99a, 0.9, 0.95, 1.1)
      .cilindro(0.09, 0.10, 0.085, 8, 0.25, 1.57, 0, 0xe89e91, 0, 0, Math.PI / 2);
    for (const s of [-1, 1]) {
      m.esfera(0.085, 5, 0.02, 1.84, s * 0.19, 0xdf9a86, 0.6, 1.1, 0.85)
        .caixa(0.025, 0.027, 0.025, 0.3, 1.57, s * 0.044, 0x70463e)
        .barra(0.208, 1.733, s * 0.07, 0.20, 1.715, s * 0.15, 0.027, 0x785344);
    }
    olhos(m, 0.231, 1.68, 0.1);
  } else if (tipo !== 'pneu') {
    chanfro(m, 0.31, 0.38, 0.34, 0.015, 1.72, 0, pele);
    if (tipo === 'trampado') {
      for (const s of [-1, 1]) {
        m.caixa(0.03, 0.13, 0.10, 0.162, 1.77, s * 0.088, olho, s * 0.1, 0, 0)
          .barra(0.18, 1.69, s * 0.16, 0.18, 1.65, s * 0.07, 0.045, 0xcac2b1);
      }
      m.cilindro(0, 0.043, 0.09, 3, 0.185, 1.69, 0, olho)
        .caixa(0.036, 0.07, 0.23, 0.17, 1.59, 0, olho);
      for (let k = 0; k < 7; k++) m.caixa(0.04, 0.061, 0.024, 0.191, 1.591, (k - 3) * 0.031, 0xfaf5e5);
    } else {
      if (tipo === 'evil') {
        for (const s of [-1, 1]) {
          m.caixa(0.018, 0.03, 0.086, 0.18, 1.755, s * 0.085, 0xe8e2d4)
            .caixa(0.021, 0.027, 0.029, 0.191, 1.755, s * 0.077, olho)
            .barra(0.185, 1.718, s * 0.04, 0.18, 1.713, s * 0.13, 0.012, 0xb59975)
            .esfera(0.067, 5, 0.158, 1.66, s * 0.118, 0xd3ad78, 0.6, 0.8, 0.7);
        }
        m.malha([0.17,1.79,-0.027, 0.17,1.79,0.027, 0.265,1.65,0, 0.17,1.64,-0.043, 0.17,1.64,0.043], [0,1,2,0,2,3,1,4,2,3,2,4], 0xd3ac74);
      } else {
        olhos(m, 0.188, 1.755, 0.084);
        m.esfera(0.047, 5, 0.195, 1.69, 0, pele, 1.05, 1.35, 0.7);
      }
      m.caixa(0.018, 0.018, 0.11, 0.188, 1.605, 0, 0x795244);
    }
    if (tipo === 'trampado' || tipo === 'peruca') {
      m.esfera(0.22, 8, 0.035, 1.94, -0.025, 0xefc246, 1.22, 0.5, 1)
        .esfera(0.13, 6, -0.13, 1.77, 0, 0xb38320, 0.6, 1.65, 1.3);
      for (const s of [-1, 1]) m.esfera(0.13, 6, -0.04, 1.82, s * 0.17, 0xd6a22b, 0.8, 1.25, 0.5);
      for (let k = 0; k < 5; k++) m.esfera(0.125, 5, 0.07 - k * 0.045, 1.98 - k * 0.008, -0.12 + k * 0.055, 0xf3ca56, 1.18, 0.34, 0.65);
    } else if (tipo === 'evil') {
      m.esfera(0.19, 7, -0.035, 1.89, 0, 0xa1a5ae, 0.94, 0.45, 1)
        .caixa(0.08, 0.23, 0.32, -0.13, 1.77, 0, 0x858991);
      for (const s of [-1, 1]) {
        m.caixa(0.12, 0.18, 0.045, -0.01, 1.8, s * 0.167, 0x9c9fa5)
          .barra(0.19, 1.799, s * 0.035, 0.18, 1.82, s * 0.13, 0.03, 0x858580)
          .barra(0.19, 1.665, s * 0.08, 0.17, 1.625, s * 0.13, 0.012, 0xa4845c);
      }
    } else if (tipo === 'sam') {
      m.cilindro(0.18, 0.18, 0.32, 10, 0, 2.08, 0, 0x12478f)
        .cilindro(0.245, 0.245, 0.035, 10, 0, 1.91, 0, 0x163b77)
        .cilindro(0.182, 0.182, 0.07, 10, 0, 1.96, 0, 0xeae8df)
        .cilindro(0.10, 0.015, 0.23, 5, 0.18, 1.56, 0, 0xf4f0e5);
      for (const s of [-1, 1]) m.esfera(0.11, 6, 0.145, 1.65, s * 0.07, 0xf5f0e4, 0.5, 0.35, 1);
      for (let k = -1; k <= 1; k++) m.caixa(0.02, 0.035, 0.035, 0.184, 2.015, k * 0.085, 0xffffff, Math.PI / 4);
    } else if (tipo === 'viking') {
      m.esfera(0.205, 8, -0.015, 1.93, 0, 0x765336, 1, 0.58, 1.1)
        .cilindro(0.145, 0.015, 0.38, 6, 0.16, 1.48, 0, 0x9e3e1f);
      for (const s of [-1, 1]) {
        m.barra(0, 1.95, s * 0.18, -0.02, 2.08, s * 0.29, 0.075, 0x8b7353)
          .barra(-0.02, 2.08, s * 0.29, 0.025, 2.24, s * 0.27, 0.043, 0xe2d2ad)
          .caixa(0.024, 0.09, 0.055, 0.178, 1.69, s * 0.11, s < 0 ? 0x244685 : 0xb83b2c)
          .barra(0.08, 1.9, s * 0.19, 0.10, 1.51, s * 0.2, 0.075, 0x9e3e1f);
      }
    } else {
      m.esfera(0.17, 6, -0.04, 1.85, 0, tipo === 'careca' ? 0xd9d4c3 : 0x3e2c23, 0.9, 0.35, 1);
    }
  }
  const geo = m.build();
  if (tipo === 'trampado' || tipo === 'evil') { geo.translate(0, -1.52, 0); geo.scale(1.48, 1.38, 1.45); geo.translate(0, 1.52, 0); }
  return geo;
}

/** Cacetete de poder: silicone violeta, ponta arredondada, cabo e anéis luminosos. Frente do golpe +X. */
export function geometriaCacetete(): THREE.BufferGeometry {
  const c = JANEIRO_CORES;
  return new Montador().cilindro(0.09, 0.085, 0.35, 10, 0, 0, 0, 0x321854)
    .cilindro(0.15, 0.10, 1.05, 12, 0, 0.69, 0, c.roxo)
    .esfera(0.15, 10, 0, 1.22, 0, 0xb157f1, 1, 1.3, 1)
    .cilindro(0.145, 0.145, 0.045, 12, 0, 0.20, 0, c.luz)
    .cilindro(0.155, 0.155, 0.035, 12, 0, 0.87, 0, c.luz).build();
}

function torso(tipo: TipoJaneiro): THREE.BufferGeometry {
  const m = new Montador();
  const terno = tipo === 'trampado' || tipo === 'evil' || tipo === 'sam';
  const cor = tipo === 'trampado' || tipo === 'sam' ? JANEIRO_CORES.azul : tipo === 'evil' ? JANEIRO_CORES.preto : tipo === 'viking' ? 0xe5b482 : tipo === 'gado' ? 0xf2ce26 : 0x268844;
  if (tipo === 'porco') m.esfera(0.42, 10, 0, 1.08, 0, cor, 0.72, 0.95, 1.05);
  else chanfro(m, 0.30, 0.55, 0.49, 0, 1.18, 0, cor);
  if (terno) {
    m.caixa(0.014, 0.37, 0.18, 0.159, 1.31, 0, 0xf4eee3)
      .barra(0.18, 1.43, 0, 0.20, 1.0, 0, 0.065, 0xc9252b);
    for (const s of [-1, 1]) m.barra(0.175, 1.47, s * 0.18, 0.175, 1.15, s * 0.08, 0.09, cor);
    for (let k = 0; k < 2; k++) m.esfera(0.018, 5, 0.171, 1.0 + k * 0.12, 0.04, 0x172d4c);
    if (tipo === 'evil') m.caixa(0.018, 0.085, 0.075, 0.177, 1.32, -0.145, 0xe8ebec)
      .caixa(0.022, 0.017, 0.066, 0.189, 1.345, -0.145, 0x254d9e)
      .caixa(0.022, 0.017, 0.066, 0.189, 1.295, -0.145, 0x254d9e);
  } else if (tipo === 'gado') {
    m.caixa(0.24, 0.60, 0.49, -0.26, 1.21, 0, 0xb6272b)
      .caixa(0.08, 0.23, 0.34, -0.415, 1.09, 0, 0xdf3435)
      .caixa(0.10, 0.07, 0.36, -0.40, 1.49, 0, 0xf29180);
    for (const s of [-1, 1]) m.caixa(0.032, 0.5, 0.05, 0.17, 1.21, s * 0.16, 0x9d2427);
  } else if (tipo === 'porco') {
    for (const s of [-1, 1]) m.barra(0.2, 1.44, 0, 0.22, 1.31, s * 0.15, 0.09, 0xf1c832);
    m.caixa(0.02, 0.10, 0.10, 0.296, 1.24, -0.2, 0xecc436);
  } else if (tipo === 'viking') {
    m.caixa(0.32, 0.23, 0.52, 0, 0.87, 0, 0x79502f);
    for (let k = 0; k < 4; k++) m.barra(0.163, 1.34 - k * 0.045, -0.15, 0.163, 1.32 - k * 0.045, -0.05, 0.013, 0x694c36);
  }
  return m.build();
}

function membro(tipo: TipoJaneiro, perna: boolean, s: number): THREE.BufferGeometry {
  const m = new Montador();
  const pele = tipo === 'trampado' ? JANEIRO_CORES.osso : JANEIRO_CORES.pele;
  const terno = ['trampado', 'evil', 'sam'].includes(tipo);
  const cor = tipo === 'evil' ? JANEIRO_CORES.preto : terno ? JANEIRO_CORES.azul : tipo === 'porco' ? 0x987c49 : tipo === 'viking' ? 0x805735 : 0x365675;
  if (perna) {
    m.caixa(0.22, 0.69, 0.20, 0, 0.46, s * 0.14, cor)
      .caixa(0.32, 0.14, 0.23, 0.055, 0.09, s * 0.14, tipo === 'gado' ? 0xece9dc : 0x29282a);
    if (tipo === 'sam') {
      m.caixa(0.025, 0.68, 0.18, 0.115, 0.46, s * 0.14, 0xbf2e37);
      for (const d of [-0.06, 0.06]) m.caixa(0.025, 0.68, 0.035, 0.13, 0.46, s * 0.14 + d, 0xeee8db);
    }
    if (tipo === 'viking') m.esfera(0.16, 6, 0, 0.35, s * 0.14, 0xac8d62, 0.9, 0.55, 0.9);
  } else {
    const z = s * (tipo === 'porco' ? 0.43 : 0.34);
    m.caixa(0.23, 0.25, 0.22, 0, 1.34, z, terno ? cor : tipo === 'viking' ? pele : tipo === 'gado' ? 0xeac323 : 0x298e47)
      .caixa(0.19, 0.28, 0.18, 0.035, 1.09, z, terno ? cor : pele)
      .caixa(0.20, 0.16, 0.18, 0.06, 0.88, z, pele);
    if (terno) m.caixa(0.2, 0.045, 0.185, 0.035, 0.965, z, 0xece7d9);
  }
  return m.build();
}

export function geometriaFigurante(tipo: TipoJaneiro): THREE.BufferGeometry {
  const m = new Montador();
  if (tipo === 'pneu') {
    const torus = new THREE.TorusGeometry(0.43, 0.19, 6, 16);
    torus.rotateY(Math.PI / 2); torus.translate(0, 1.28, 0); pinta(torus, 0x242629);
    m.pronta(torus);
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2;
      m.caixa(0.36, 0.08, 0.15, 0, 1.28 + Math.cos(a) * 0.61, Math.sin(a) * 0.61, 0x36383a, -a);
    }
    for (const s of [-1, 1]) m.pronta(membro('evil', true, s));
  } else {
    m.pronta(torso(tipo)).pronta(cabeca(tipo));
    for (const s of [-1, 1]) m.pronta(membro(tipo, true, s)).pronta(membro(tipo, false, s));
    if (tipo === 'bandeira' || tipo === 'viking') m.barra(0.09, 0.02, -0.48, 0.09, 2.65, -0.48, 0.033, 0x90744a)
      .caixa(0.03, 0.53, 0.38, 0.09, 2.32, -0.68, 0xf0c930);
  }
  const g = m.build();
  const p = g.getAttribute('position');
  const a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i);
    // Tecido/pele mantêm as cores da referência; só os membros balançam.
    a[i * 3 + 1] = y < 0.8 ? (0.8 - y) / 0.8 : Math.abs(z) > 0.25 && y < 1.4 ? (1.4 - y) / 0.6 : 0;
    a[i * 3 + 2] = (z < 0 ? -1 : 1) * (y < 0.8 ? 1 : -1);
  }
  g.setAttribute('aVert', new THREE.BufferAttribute(a, 3));
  return g;
}

export function modeloChefe(tipo: 'trampado' | 'evil') {
  const grupo = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.08 });
  grupo.add(new THREE.Mesh(torso(tipo), material), new THREE.Mesh(cabeca(tipo), material));
  const pernas: THREE.Group[] = [];
  const bracos: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const perna = new THREE.Group(); perna.position.set(0, 0.8, s * 0.14);
    const pg = membro(tipo, true, s); pg.translate(0, -0.8, -s * 0.14);
    perna.add(new THREE.Mesh(pg, material)); grupo.add(perna); pernas.push(perna);
    const braco = new THREE.Group(); braco.position.set(0, 1.44, s * 0.34);
    const bg = membro(tipo, false, s); bg.translate(0, -1.44, -s * 0.34);
    braco.add(new THREE.Mesh(bg, material)); grupo.add(braco); bracos.push(braco);
  }
  const arma = new THREE.Mesh(geometriaCacetete(), material);
  arma.rotation.z = -1.35; arma.position.set(0.1, -0.53, 0); arma.scale.setScalar(0.85);
  bracos[0]!.add(arma);
  return { grupo, pernas, bracos, material };
}
