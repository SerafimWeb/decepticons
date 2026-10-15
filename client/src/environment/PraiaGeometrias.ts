import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { LAMPADAS_DA_BARRACA, type TipoDeAdereco } from './PraiaAderecos';
import { CONSTRUTORES_DE_CENA } from './PraiaGeometriasCena';
import { hex, Montador, pinta, prisma, type Camada, type MaterialDaCamada } from './PraiaMontador';

export type { Camada, MaterialDaCamada };

/**
 * As GEOMETRIAS BASE dos adereços da PRAIA DOS CABOS (P127): coqueiro, guarda-sol, jangada, barraca, torre, quiosque, poste, carro, ônibus,
 * boia, rocha, guindaste, farol, antena, parabólica, domo e navio — cada tipo uma malha mesclada por camada, com a **cor nos vértices**. A
 * cena (a base da estação, a praia, a calçada, o porto) está em `PraiaGeometriasCena.ts`. Montadas na carga; rodam no Node também (sem GL),
 * então os testes conferem as peças. Veja `PraiaMontador.ts` para o que é uma camada.
 */

// ─── As peças de cada tipo ──────────────────────────────────────────────────────────────────────────────────────

function palmeira(): Camada[] {
  const rand = mulberry32(99);
  const aneis = 7;
  const altura = 10.5;
  const centros: THREE.Vector3[] = [];
  const raios: number[] = [];
  const cores: number[] = [];
  for (let i = 0; i < aneis; i++) {
    const t = i / (aneis - 1);
    centros.push(new THREE.Vector3(1.7 * t * t, altura * t, 0.3 * Math.sin(t * 3)));
    raios.push(0.44 - 0.21 * t);
    cores.push(i % 2 === 0 ? hex(0.42, 0.31, 0.21) : hex(0.34, 0.25, 0.17));
  }
  const tronco = new Montador().tubo(centros, raios, 6, cores);
  const topo = centros[aneis - 1]!;
  tronco.esfera(0.4, 5, topo.x, topo.y - 0.2, topo.z, hex(0.3, 0.22, 0.1)); // o cacho de cocos no pé da copa
  // As folhas: 8 palmas em arco (abrem do alto da copa e caem), cada uma com dobra em V para o sombreado.
  const pos: number[] = [];
  const cor: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  const segs = 4;
  for (let f = 0; f < 7; f++) {
    const giro = (f / 7) * Math.PI * 2 + rand() * 0.5;
    const comp = 4.6 + rand();
    const dx = Math.cos(giro);
    const dz = Math.sin(giro);
    const base = pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const corre = comp * t;
      const sobe = 1.5 * t - 3.1 * t * t;
      const larg = 0.95 * Math.sin(Math.PI * (0.12 + 0.82 * t)) * (1 - 0.35 * t);
      const cx = topo.x + dx * corre;
      const cy = topo.y + 0.2 + sobe;
      const cz = topo.z + dz * corre;
      pos.push(cx - dz * larg, cy - 0.12, cz + dx * larg, cx, cy + 0.1, cz, cx + dz * larg, cy - 0.12, cz - dx * larg);
      const borda = t < 0.5 ? hex(0.1, 0.26, 0.09) : hex(0.22, 0.46, 0.14);
      const nervura = t < 0.5 ? hex(0.17, 0.38, 0.12) : hex(0.34, 0.56, 0.18);
      for (const k of [borda, nervura, borda]) {
        c.set(k);
        cor.push(c.r, c.g, c.b);
      }
    }
    for (let s = 0; s < segs; s++) {
      const a = base + s * 3;
      const b = a + 3;
      idx.push(a, a + 1, b, b, a + 1, b + 1, a + 1, a + 2, b + 1, b + 1, a + 2, b + 2);
    }
  }
  const copa = new THREE.BufferGeometry();
  copa.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  copa.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  copa.setIndex(idx);
  copa.computeVertexNormals();
  return [
    { geo: tronco.build(), material: 'padrao', tinta: false },
    { geo: new Montador().pronta(copa).build(), material: 'folha', tinta: false },
  ];
}

function guardasol(): Camada[] {
  const haste = new Montador().cilindro(0.05, 0.06, 2.5, 5, 0, 1.25, 0, hex(0.62, 0.6, 0.55)).esfera(0.09, 6, 0, 2.55, 0, hex(0.85, 0.83, 0.78));
  // A copa: 8 gomos, alternando o brilho (a cor da instância tinge todos).
  const copa = new Montador();
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2;
    const a1 = ((k + 1) / 8) * Math.PI * 2;
    const r = 1.45;
    copa.malha([0, 2.95, 0, Math.cos(a0) * r, 2.35, Math.sin(a0) * r, Math.cos(a1) * r, 2.35, Math.sin(a1) * r], [0, 2, 1], k % 2 === 0 ? hex(1, 1, 1) : hex(0.78, 0.78, 0.78));
  }
  return [
    { geo: haste.build(), material: 'padrao', tinta: false },
    { geo: copa.build(), material: 'duplo', tinta: true },
  ];
}

function jangada(): Camada[] {
  const madeira = [hex(0.55, 0.4, 0.26), hex(0.5, 0.36, 0.23), hex(0.58, 0.43, 0.28)];
  const casco = new Montador();
  for (let k = -2; k <= 2; k++) {
    // Cinco troncos amarrados (os do meio mais compridos) e a proa levantada.
    const comp = 7.4 - Math.abs(k) * 0.5;
    casco.cilindro(0.2, 0.2, comp, 6, k * 0.37, 0.28, 0, madeira[(k + 2) % 3]!, Math.PI / 2);
    casco.cilindro(0.17, 0.2, 1.1, 6, k * 0.37, 0.5, comp / 2 + 0.2, madeira[(k + 2) % 3]!, Math.PI / 2 - 0.5);
  }
  casco.caixa(2.1, 0.12, 0.2, 0, 0.55, -1.7, hex(0.36, 0.26, 0.17)).caixa(2.1, 0.12, 0.2, 0, 0.55, 1.4, hex(0.36, 0.26, 0.17));
  casco.cilindro(0.06, 0.08, 4.4, 5, 0, 2.7, 0.3, hex(0.45, 0.34, 0.22)).caixa(1.0, 0.12, 0.6, 0, 0.64, -0.3, hex(0.32, 0.23, 0.15));
  // A vela latina: um triângulo (dupla face) com a cor da instância.
  const vela = new Montador().malha([0, 4.7, 0.3, 0, 1.0, -2.0, 0, 1.0, 2.6], [0, 1, 2], hex(1, 1, 1));
  return [
    { geo: casco.build(), material: 'padrao', tinta: false },
    { geo: vela.build(), material: 'vela', tinta: true },
  ];
}

function barraca(): Camada[] {
  const palha = [hex(0.78, 0.63, 0.31), hex(0.7, 0.55, 0.26)];
  const m = new Montador();
  m.caixa(9, 0.25, 6, 0, 0.13, 0, hex(0.62, 0.48, 0.32)); // o deck de madeira
  for (const [x, z] of [[-4.2, -2.7], [4.2, -2.7], [-4.2, 2.7], [4.2, 2.7]] as const) m.cilindro(0.16, 0.18, 3.3, 6, x, 1.8, z, hex(0.5, 0.38, 0.26));
  m.caixa(9, 1.5, 0.3, 0, 0.9, 2.85, hex(0.93, 0.88, 0.76)); // a parede dos fundos
  m.caixa(5.4, 1.15, 1.3, 0, 0.7, -1.4, hex(0.25, 0.62, 0.72)); // o balcão turquesa
  m.caixa(5.6, 0.14, 1.5, 0, 1.3, -1.4, hex(0.82, 0.7, 0.5));
  // O telhado de palha: duas pirâmides sobrepostas (o beiral largo) e o mastro de uma bandeirinha.
  m.cilindro(0.15, 6.6, 1.5, 4, 0, 3.8, 0, palha[0]!, 0, Math.PI / 4).cilindro(0.1, 4.6, 1.5, 4, 0, 4.9, 0, palha[1]!, 0, Math.PI / 4);
  m.cilindro(0.04, 0.05, 1.4, 4, 0, 6.2, 0, hex(0.4, 0.3, 0.2));
  for (const x of [-2.5, 2.5]) m.cilindro(0.65, 0.65, 0.07, 8, x, 1.0, 1.0, hex(0.95, 0.95, 0.92)).cilindro(0.06, 0.06, 0.98, 5, x, 0.5, 1.0, hex(0.5, 0.5, 0.5));
  // O varal de lâmpadas sob o beiral (a festa do fim de tarde): o fio entre os bulbos; cada bulbo acende na camada de brilho.
  const L = LAMPADAS_DA_BARRACA;
  const fio = hex(0.09, 0.09, 0.1);
  const cadeia = [[0, 1, 2, 3, 4, 5, 6, 7, 8], [0, 9, 10, 11, 12], [8, 13, 14, 15, 16]] as const;
  for (const c of cadeia) for (let i = 1; i < c.length; i++) m.barra(L[c[i - 1]!]![0], L[c[i - 1]!]![1] + 0.06, L[c[i - 1]!]![2], L[c[i]!]![0], L[c[i]!]![1] + 0.06, L[c[i]!]![2], 0.022, fio);
  const bulbos = new Montador();
  for (const [x, y, z] of L) bulbos.esfera(0.1, 5, x, y, z, hex(1, 0.82, 0.5));
  return [
    { geo: m.build(), material: 'padrao', tinta: false },
    { geo: bulbos.build(), material: 'brilho', tinta: false },
  ];
}

function torre(): Camada[] {
  const m = new Montador();
  const branco = hex(0.96, 0.95, 0.9);
  const vermelho = hex(0.84, 0.16, 0.12);
  for (const [x, z] of [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]] as const) m.cilindro(0.14, 0.16, 3.2, 6, x, 1.6, z, hex(0.6, 0.45, 0.3));
  m.caixa(3.4, 0.2, 3.4, 0, 3.2, 0, hex(0.62, 0.48, 0.32)); // o piso da cabine
  m.caixa(3.0, 1.9, 3.0, 0, 4.2, 0, branco).caixa(3.04, 0.45, 3.04, 0, 4.2, 0, vermelho).caixa(3.1, 0.7, 0.06, 0, 4.6, -1.52, hex(0.12, 0.2, 0.28));
  m.cilindro(0.1, 3.0, 1.0, 4, 0, 5.65, 0, vermelho, 0, Math.PI / 4); // o telhado em pirâmide
  m.cilindro(0.04, 0.04, 1.8, 4, 1.7, 5.4, 1.7, hex(0.7, 0.7, 0.7)).malha([1.7, 6.3, 1.7, 2.9, 6.0, 1.7, 1.7, 5.7, 1.7], [0, 1, 2], hex(0.9, 0.2, 0.15)); // a bandeira
  for (let k = 0; k < 5; k++) m.caixa(1.0, 0.1, 0.5, 0, 0.3 + k * 0.6, -2.1, hex(0.62, 0.48, 0.32)); // os degraus
  return [{ geo: m.build(), material: 'padrao', tinta: false }];
}

function quiosque(): Camada[] {
  const m = new Montador();
  m.caixa(6.2, 3.0, 4.6, 0, 1.5, 0, hex(0.95, 0.86, 0.66)).caixa(6.3, 0.35, 4.7, 0, 3.15, 0, hex(0.24, 0.62, 0.72));
  m.caixa(4.6, 1.5, 0.15, 0, 1.7, -2.34, hex(0.2, 0.3, 0.38)); // o balcão aberto
  m.cilindro(0.1, 4.4, 1.2, 4, 0, 4.1, 0, hex(0.76, 0.6, 0.3), 0, Math.PI / 4);
  m.caixa(5.6, 0.25, 1.4, 0, 2.7, -2.5, hex(0.9, 0.34, 0.24)); // o toldo
  return [{ geo: m.build(), material: 'padrao', tinta: false }];
}

function poste(): Camada[] {
  const haste = new Montador().cilindro(0.1, 0.16, 7.2, 6, 0, 3.6, 0, hex(0.32, 0.34, 0.36)).caixa(1.5, 0.1, 0.12, 0.65, 7.2, 0, hex(0.32, 0.34, 0.36));
  const cabeca = new Montador().caixa(0.7, 0.16, 0.32, 1.3, 7.1, 0, hex(1, 0.9, 0.7));
  return [
    { geo: haste.build(), material: 'padrao', tinta: false },
    { geo: cabeca.build(), material: 'brilho', tinta: false },
  ];
}

function carro(): Camada[] {
  const corpo = new Montador().caixa(4.5, 0.75, 1.9, 0, 0.65, 0, hex(1, 1, 1)).caixa(2.3, 0.55, 1.75, -0.2, 1.3, 0, hex(1, 1, 1));
  const resto = new Montador();
  resto.caixa(2.0, 0.42, 1.8, -0.2, 1.3, 0, hex(0.12, 0.2, 0.28)); // o vidro
  for (const [x, z] of [[-1.5, -0.95], [1.5, -0.95], [-1.5, 0.95], [1.5, 0.95]] as const) resto.cilindro(0.38, 0.38, 0.28, 8, x, 0.38, z, hex(0.08, 0.08, 0.09), Math.PI / 2);
  resto.caixa(0.1, 0.2, 0.5, 2.27, 0.75, -0.6, hex(1, 0.95, 0.8)).caixa(0.1, 0.2, 0.5, 2.27, 0.75, 0.6, hex(1, 0.95, 0.8));
  resto.caixa(0.1, 0.2, 0.5, -2.27, 0.75, -0.6, hex(0.8, 0.1, 0.1)).caixa(0.1, 0.2, 0.5, -2.27, 0.75, 0.6, hex(0.8, 0.1, 0.1));
  return [
    { geo: corpo.build(), material: 'padrao', tinta: true },
    { geo: resto.build(), material: 'padrao', tinta: false },
  ];
}

function onibus(): Camada[] {
  const corpo = new Montador().caixa(11.6, 2.9, 2.6, 0, 1.9, 0, hex(1, 1, 1));
  const resto = new Montador();
  resto.caixa(11.0, 0.95, 2.66, 0, 2.55, 0, hex(0.12, 0.2, 0.28)); // a faixa de janelas
  for (const x of [-3.9, 3.9]) for (const z of [-1.2, 1.2]) resto.cilindro(0.55, 0.55, 0.4, 8, x, 0.55, z, hex(0.08, 0.08, 0.09), Math.PI / 2);
  resto.caixa(0.1, 0.3, 2.2, 5.85, 0.8, 0, hex(1, 0.95, 0.8)).caixa(0.1, 0.3, 2.2, -5.85, 0.8, 0, hex(0.8, 0.1, 0.1));
  return [
    { geo: corpo.build(), material: 'padrao', tinta: true },
    { geo: resto.build(), material: 'padrao', tinta: false },
  ];
}

function boia(): Camada[] {
  const corpo = new Montador()
    .cilindro(0.75, 0.9, 1.0, 10, 0, 0.3, 0, hex(0.9, 0.18, 0.12))
    .cilindro(0.7, 0.75, 0.5, 10, 0, 0.85, 0, hex(0.96, 0.96, 0.94))
    .cilindro(0.1, 0.55, 1.2, 8, 0, 1.7, 0, hex(0.9, 0.18, 0.12))
    .cilindro(0.06, 0.06, 1.2, 5, 0, 2.9, 0, hex(0.3, 0.3, 0.32));
  const luz = new Montador().esfera(0.22, 6, 0, 3.6, 0, hex(1, 0.35, 0.25));
  return [
    { geo: corpo.build(), material: 'padrao', tinta: false },
    { geo: luz.build(), material: 'brilho', tinta: false },
  ];
}

function rocha(): Camada[] {
  const rand = mulberry32(2024);
  const g = new THREE.IcosahedronGeometry(1.5, 1);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const k = 0.78 + rand() * 0.45;
    p.setXYZ(i, p.getX(i) * k * 1.25, p.getY(i) * k * 0.72, p.getZ(i) * k);
  }
  g.translate(0, 0.3, 0);
  const ng = g;
  ng.deleteAttribute('uv');
  ng.computeVertexNormals();
  // Cada face de um tom: pedra com manchas.
  const cores = new Float32Array(ng.attributes.position!.count * 3);
  const c = new THREE.Color();
  for (let f = 0; f < ng.attributes.position!.count; f += 3) {
    c.setRGB(0.42 + rand() * 0.14, 0.4 + rand() * 0.12, 0.37 + rand() * 0.1);
    for (let k = 0; k < 3; k++) cores.set([c.r, c.g, c.b], (f + k) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  return [{ geo: new Montador().pronta(ng).build(), material: 'padrao', tinta: false }];
}

function guindaste(): Camada[] {
  const laranja = hex(0.86, 0.3, 0.12);
  const cinza = hex(0.55, 0.58, 0.6);
  const m = new Montador();
  for (const [x, z] of [[-9, -5], [9, -5], [-9, 5], [9, 5]] as const) m.caixa(2.6, 34, 2.6, x, 17, z, laranja);
  // Os portais (vigas entre os pés), a lança sobre o navio (de -37 a +25) e as diagonais dos pés.
  m.caixa(21, 2.6, 2.6, 0, 33, -5, laranja).caixa(21, 2.6, 2.6, 0, 33, 5, laranja).caixa(21, 1.6, 2.2, 0, 14, -5, laranja).caixa(21, 1.6, 2.2, 0, 14, 5, laranja);
  m.caixa(3.4, 3.6, 62, 0, 36.2, -6, laranja);
  m.caixa(6, 5, 9, 0, 40, 8, cinza).caixa(5, 4, 5, 0, 38, -26, cinza);
  for (const x of [-9, 9]) {
    m.barra(x, 2, -5, x, 33, 5, 0.5, cinza).barra(x, 2, 5, x, 33, -5, 0.5, cinza);
  }
  for (const z of [-26, -20]) m.caixa(0.16, 20, 0.16, 0, 26, z, hex(0.2, 0.2, 0.22)); // os cabos de içar
  m.caixa(3.2, 1.2, 3.4, 0, 14, -26, hex(0.3, 0.3, 0.32)); // o espalhador de contêiner
  return [{ geo: m.build(), material: 'padrao', tinta: false }];
}

function farol(): Camada[] {
  const m = new Montador();
  const branco = hex(0.97, 0.96, 0.92);
  const vermelho = hex(0.85, 0.14, 0.1);
  m.caixa(8.5, 3, 8.5, 0, 1.5, 0, hex(0.78, 0.74, 0.66)); // a base de pedra
  const faixas = 5;
  for (let i = 0; i < faixas; i++) {
    const r0 = 4.0 - (1.5 * i) / faixas;
    const r1 = 4.0 - (1.5 * (i + 1)) / faixas;
    m.cilindro(r1, r0, 6.2, 14, 0, 3 + 6.2 * i + 3.1, 0, i % 2 === 0 ? branco : vermelho);
  }
  m.cilindro(3.9, 3.9, 0.5, 14, 0, 34.2, 0, hex(0.3, 0.3, 0.32)).cilindro(2.4, 2.9, 0.6, 14, 0, 33.9, 0, hex(0.3, 0.3, 0.32)); // a galeria
  m.cilindro(0.2, 3.0, 2.6, 14, 0, 38.0, 0, vermelho).esfera(0.4, 6, 0, 39.5, 0, hex(0.7, 0.7, 0.72)); // o teto da lanterna
  const luz = new Montador().cilindro(2.0, 2.0, 3.0, 12, 0, 35.9, 0, hex(1, 0.86, 0.5));
  return [
    { geo: m.build(), material: 'padrao', tinta: false },
    { geo: luz.build(), material: 'brilho', tinta: false },
  ];
}

function antena(): Camada[] {
  const m = new Montador();
  const aco = hex(0.78, 0.8, 0.82);
  const vermelho = hex(0.86, 0.2, 0.14);
  const alto = 46;
  const base = 2.0;
  const topo = 0.6;
  const trechos = 8;
  const raio = (i: number): number => base + ((topo - base) * i) / trechos;
  const cantos = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
  // As quatro pernas (afunilam para cima), os anéis e as diagonais em X de cada painel.
  for (const [sx, sz] of cantos) m.barra(sx * base, 0, sz * base, sx * topo, alto, sz * topo, 0.42, aco);
  for (let i = 0; i <= trechos; i++) {
    const r = raio(i);
    const y = (alto * i) / trechos;
    for (let k = 0; k < 4; k++) {
      const [ax, az] = cantos[k]!;
      const [bx, bz] = cantos[(k + 1) % 4]!;
      m.barra(ax * r, y, az * r, bx * r, y, bz * r, 0.16, i % 2 === 0 ? vermelho : aco);
      if (i < trechos) {
        const r2 = raio(i + 1);
        const y2 = (alto * (i + 1)) / trechos;
        m.barra(ax * r, y, az * r, bx * r2, y2, bz * r2, 0.1, aco);
      }
    }
  }
  m.caixa(1.2, 2.2, 1.2, 0, alto + 1.1, 0, vermelho); // o cabeçote
  const luz = new Montador().esfera(0.5, 6, 0, alto + 2.6, 0, hex(1, 0.2, 0.15));
  return [
    { geo: m.build(), material: 'padrao', tinta: false },
    { geo: luz.build(), material: 'brilho', tinta: false },
  ];
}

function parabolica(): Camada[] {
  const pedestal = new Montador();
  pedestal.cilindro(0.3, 0.45, 3.2, 8, 0, 1.6, 0, hex(0.7, 0.72, 0.74)).caixa(1.8, 0.5, 1.8, 0, 0.25, 0, hex(0.55, 0.57, 0.6));
  pedestal.cilindro(0.06, 0.06, 2.6, 5, 0.9, 5.2, 0, hex(0.4, 0.4, 0.42), 0, 0, -0.35).caixa(0.4, 0.4, 0.4, 1.7, 6.3, 0, hex(0.25, 0.25, 0.28)); // o alimentador no foco
  // O prato: uma calota de esfera com a concavidade para cima, inclinada para o céu (dupla face).
  const prato = new THREE.SphereGeometry(2.7, 18, 6, 0, Math.PI * 2, Math.PI - Math.PI / 3.1, Math.PI / 3.1);
  prato.rotateZ(0.5);
  prato.translate(0, 4.4 + 2.6, 0);
  const ng = prato.toNonIndexed();
  ng.deleteAttribute('uv');
  pinta(ng, hex(0.94, 0.94, 0.92));
  return [
    { geo: pedestal.build(), material: 'padrao', tinta: false },
    { geo: new Montador().pronta(ng).build(), material: 'duplo', tinta: false },
  ];
}

function radome(): Camada[] {
  const rand = mulberry32(8);
  const ng = new THREE.IcosahedronGeometry(5.2, 1);
  ng.deleteAttribute('uv');
  const cores = new Float32Array(ng.attributes.position!.count * 3);
  for (let f = 0; f < ng.attributes.position!.count; f += 3) {
    const v = 0.88 + rand() * 0.1; // cada gomo geodésico, um branco
    for (let k = 0; k < 3; k++) cores.set([v, v, v * 0.98], (f + k) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  ng.translate(0, 2.2, 0);
  ng.computeVertexNormals();
  return [{ geo: new Montador().pronta(ng).build(), material: 'padrao', tinta: false }];
}

function navio(): Camada[] {
  const contorno = [[-52, -13], [30, -13], [52, 0], [30, 13], [-52, 13]] as const;
  const m = new Montador();
  m.pronta(prisma(contorno, -6, 1, hex(0.5, 0.1, 0.09))).pronta(prisma(contorno.map(([x, z]) => [x * 0.995, z * 0.995] as const), 1, 8, hex(0.1, 0.14, 0.2)));
  m.caixa(103, 0.3, 25.4, 0, 8.1, 0, hex(0.36, 0.38, 0.38)); // o convés
  m.caixa(18, 24, 22, -36, 20, 0, hex(0.94, 0.94, 0.92)).caixa(18.2, 2.2, 22.2, -36, 28.5, 0, hex(0.1, 0.18, 0.26)).caixa(18.2, 2.2, 22.2, -36, 24.0, 0, hex(0.1, 0.18, 0.26)); // a ponte
  m.caixa(5, 8, 5, -44, 36, 0, hex(0.86, 0.2, 0.12)).caixa(5.2, 1.2, 5.2, -44, 39.8, 0, hex(0.1, 0.1, 0.12)).cilindro(0.25, 0.3, 12, 6, -34, 38, 0, hex(0.8, 0.8, 0.82)); // a chaminé e o mastro
  return [{ geo: m.build(), material: 'padrao', tinta: false }];
}

const CONSTRUTORES_BASE: Readonly<Partial<Record<TipoDeAdereco, () => Camada[]>>> = {
  palmeira,
  guardasol,
  jangada,
  barco: jangada,
  barraca,
  torre,
  quiosque,
  poste,
  carro,
  onibus,
  boia,
  rocha,
  guindaste,
  farol,
  antena,
  parabolica,
  radome,
  navio,
};

const CONSTRUTORES: Readonly<Record<TipoDeAdereco, () => Camada[]>> = { ...CONSTRUTORES_BASE, ...CONSTRUTORES_DE_CENA } as Readonly<Record<TipoDeAdereco, () => Camada[]>>;

/** As camadas de um tipo (cada chamada monta de novo: o construtor guarda o resultado e usa a mesma geometria para todas as instâncias). */
export function camadasDoTipo(tipo: TipoDeAdereco): Camada[] {
  return CONSTRUTORES[tipo]();
}

export const TIPOS_COM_GEOMETRIA = Object.keys(CONSTRUTORES) as TipoDeAdereco[];
