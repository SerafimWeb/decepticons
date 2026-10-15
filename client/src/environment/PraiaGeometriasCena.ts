import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import type { TipoDeAdereco } from './PraiaAderecos';
import { hex, Montador, prisma, type Camada } from './PraiaMontador';

/**
 * AS GEOMETRIAS DA CENA da PRAIA DOS CABOS (P127, rodada de luz e de roleplay): o que conta a história do lugar. A **base da estação**
 * (refletores, torres de vigia com holofote, carretéis de cabo, barreiras HESCO e de concreto, sacos de areia, tenda de campanha, gerador,
 * caminhonete, bandeiras, câmeras de CFTV), a **praia e a calçada** (espreguiçadeiras, toalhas, rede de vôlei, bancos, lixeiras, ponto de
 * ônibus, semáforos, touceiras e algas da linha de maré), o **porto** (empilhadeira, caminhão de contêiner) e o **mar** (a lancha de
 * desembarque dos rebeldes e os dois navios do horizonte: o lançador de cabos da SERAFIM e a nau de comando rebelde).
 *
 * Mesmo contrato de `PraiaGeometrias.ts`: cada tipo devolve camadas (malha + material + se leva a cor da instância), com a cor nos vértices.
 * A paleta da SERAFIM é o cinza-ardósia com o verde neon (`IDENTITY.md`); a dos rebeldes, o cinza-chumbo com o vermelho de alerta.
 */

const ARDOSIA = hex(0.2, 0.23, 0.25);
const VERDE_SERAFIM = hex(0.22, 0.95, 0.42);
const ACO = hex(0.5, 0.53, 0.56);
const CAQUI = hex(0.62, 0.55, 0.38);
const CONCRETO = hex(0.72, 0.71, 0.68);
const AMARELO = hex(0.95, 0.75, 0.1);
const VERMELHO = hex(0.85, 0.14, 0.1);
const MADEIRA = hex(0.62, 0.45, 0.28);
const CANTOS = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;

/** Um tecido de `larg × alt` m em `n` colunas (para a bandeira ondular): o mastro em x = 0, o pano para +x. */
function pano(larg: number, alt: number, n: number, yTopo: number, cor: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = 0.08 + (larg * i) / n;
    pos.push(x, yTopo, 0, x, yTopo - alt, 0);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const geo = new Montador().malha(pos, idx, cor).build();
  // A distância de cada vértice ao mastro (a bandeira ondula mais longe dele): fica local, não muda com a fusão no mundo.
  const p = geo.attributes.position!;
  const onda = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) onda[i] = Math.max(0, p.getX(i) - 0.08);
  geo.setAttribute('aOnda', new THREE.BufferAttribute(onda, 1));
  return geo;
}

// ─── A base da estação ──────────────────────────────────────────────────────────────────────────────────────────

function refletor(): Camada[] {
  const alto = 14;
  const m = new Montador();
  for (const [sx, sz] of CANTOS) m.barra(sx * 0.85, 0, sz * 0.85, sx * 0.4, alto, sz * 0.4, 0.2, ACO);
  for (let i = 1; i <= 6; i++) {
    const t = i / 6.5;
    const y = alto * t;
    const r = 0.85 - 0.45 * t;
    for (let k = 0; k < 4; k++) {
      const [ax, az] = CANTOS[k]!;
      const [bx, bz] = CANTOS[(k + 1) % 4]!;
      m.barra(ax * r, y, az * r, bx * r, y, bz * r, 0.1, ACO);
    }
  }
  m.caixa(1.2, 0.4, 1.2, 0, alto + 0.1, 0, ACO);
  m.caixa(5.0, 2.0, 0.3, 0, alto + 1.5, 0.1, ARDOSIA); // a moldura do banco de lâmpadas (olha para +z)
  const luz = new Montador();
  for (let i = -2; i <= 2; i++) for (const j of [0, 1]) luz.caixa(0.78, 0.7, 0.18, i * 0.92, alto + 1.05 + j * 0.9, 0.3, hex(1, 0.97, 0.88));
  return [
    { geo: m.build(), material: 'padrao', tinta: false },
    { geo: luz.build(), material: 'brilho', tinta: false },
  ];
}

function vigia(): Camada[] {
  const m = new Montador();
  for (const [sx, sz] of CANTOS) m.barra(sx * 1.55, 0, sz * 1.55, sx * 1.9, 6.4, sz * 1.9, 0.3, ARDOSIA);
  for (const y of [2.4, 4.6]) {
    const r = 1.55 + (1.9 - 1.55) * (y / 6.4);
    for (let k = 0; k < 4; k++) {
      const [ax, az] = CANTOS[k]!;
      const [bx, bz] = CANTOS[(k + 1) % 4]!;
      m.barra(ax * r, y, az * r, bx * r, y, bz * r, 0.14, ARDOSIA);
    }
  }
  m.caixa(4.4, 0.3, 4.4, 0, 6.55, 0, ARDOSIA); // o piso da guarita
  for (const [x, z, w, d] of [[0, -2.1, 4.4, 0.14], [0, 2.1, 4.4, 0.14], [-2.1, 0, 0.14, 4.0], [2.1, 0, 0.14, 4.0]] as const) {
    m.caixa(w, 1.0, d, x, 7.2, z, ARDOSIA).caixa(w + 0.02, 0.12, d + 0.02, x, 7.74, z, VERDE_SERAFIM); // o parapeito e a faixa verde
  }
  for (const [sx, sz] of CANTOS) m.cilindro(0.08, 0.08, 1.7, 5, sx * 2.0, 8.2, sz * 2.0, ACO);
  m.cilindro(0.1, 3.4, 1.1, 4, 0, 9.4, 0, ARDOSIA, 0, Math.PI / 4); // o teto em pirâmide
  m.cilindro(0.38, 0.45, 0.8, 8, 0, 7.5, 0, ACO); // o pino do holofote
  m.cilindro(0.72, 0.72, 1.3, 10, 0, 8.0, 0.55, ARDOSIA, Math.PI / 2); // o corpo do holofote (aponta para +z)
  for (let k = 0; k < 7; k++) m.caixa(0.1, 0.1, 0.5, 2.1, 0.4 + k * 0.7, -0.35, ACO).caixa(0.1, 0.1, 0.5, 2.1, 0.4 + k * 0.7, 0.35, ACO); // a escada
  const luz = new Montador().cilindro(0.64, 0.64, 0.14, 10, 0, 8.0, 1.22, hex(1, 0.96, 0.85), Math.PI / 2);
  return [
    { geo: m.build(), material: 'padrao', tinta: false },
    { geo: luz.build(), material: 'brilho', tinta: false },
  ];
}

function carretel(): Camada[] {
  // O carretel de cabo submarino (eixo ao longo de x): flanges de madeira, o cabo enrolado e duas cintas amarelas.
  const m = new Montador();
  for (const x of [-0.82, 0.82]) m.cilindro(1.6, 1.6, 0.14, 18, x, 1.6, 0, MADEIRA, 0, 0, Math.PI / 2);
  m.cilindro(0.5, 0.5, 1.8, 10, 0, 1.6, 0, hex(0.5, 0.36, 0.22), 0, 0, Math.PI / 2);
  m.cilindro(1.28, 1.28, 1.5, 18, 0, 1.6, 0, hex(0.07, 0.07, 0.09), 0, 0, Math.PI / 2);
  for (const x of [-0.45, 0.45]) m.cilindro(1.3, 1.3, 0.16, 18, x, 1.6, 0, AMARELO, 0, 0, Math.PI / 2);
  m.caixa(1.9, 0.12, 0.3, 0, 0.06, 1.2, hex(0.4, 0.3, 0.2)).caixa(1.9, 0.12, 0.3, 0, 0.06, -1.2, hex(0.4, 0.3, 0.2)); // os calços
  return [{ geo: m.build(), material: 'padrao', tinta: false }];
}

function hesco(): Camada[] {
  // A barreira HESCO: cesto de arame e tecido cheio de terra, 2,4 m de cada lado.
  const escuro = hex(0.38, 0.33, 0.22);
  const m = new Montador().caixa(2.4, 2.4, 1.1, 0, 1.2, 0, CAQUI).caixa(2.3, 0.08, 1.0, 0, 2.42, 0, hex(0.84, 0.76, 0.58));
  for (const z of [-0.555, 0.555]) {
    for (const x of [-0.9, -0.3, 0.3, 0.9]) m.caixa(0.06, 2.4, 0.02, x, 1.2, z, escuro);
    for (const y of [0.6, 1.2, 1.8]) m.caixa(2.4, 0.05, 0.02, 0, y, z, escuro);
  }
  return [{ geo: m.build(), material: 'padrao', tinta: false }];
}

function barreira(): Camada[] {
  // A barreira de concreto de perfil "New Jersey" (3,2 m), com a faixa reflexiva vermelha e branca no topo.
  const m = new Montador().caixa(3.2, 0.5, 0.8, 0, 0.25, 0, CONCRETO).caixa(3.2, 0.45, 0.52, 0, 0.72, 0, CONCRETO).caixa(3.2, 0.2, 0.3, 0, 1.05, 0, CONCRETO);
  for (let i = 0; i < 4; i++) m.caixa(0.78, 0.08, 0.32, -1.2 + i * 0.8, 1.17, 0, i % 2 === 0 ? VERMELHO : hex(0.95, 0.95, 0.93));
  return [{ geo: m.build(), material: 'padrao', tinta: false }];
}

function saco(): Camada[] {
  const m = new Montador()
    .caixa(4.0, 0.32, 0.8, 0, 0.16, 0, CAQUI)
    .caixa(3.8, 0.32, 0.72, 0, 0.48, 0, hex(0.58, 0.51, 0.35))
    .caixa(3.5, 0.3, 0.64, 0, 0.79, 0, hex(0.66, 0.58, 0.4));
  for (let i = -3; i <= 3; i++) m.caixa(0.04, 0.9, 0.82, i * 0.55, 0.45, 0, hex(0.42, 0.36, 0.24)); // as costuras dos sacos
  return [{ geo: m.build(), material: 'padrao', tinta: false }];
}

function tenda(): Camada[] {
  // A tenda de campanha da SERAFIM: lona clara, a faixa verde no beiral, a porta escura no fim (+x) e o mastro com a bandeirinha.
  const lona = hex(0.9, 0.88, 0.8);
  const paredes = new Montador();
  for (const z of [-3, 3]) paredes.caixa(8, 2.2, 0.08, 0, 1.1, z, lona);
  for (const x of [-4, 4]) paredes.caixa(0.08, 2.2, 6, x, 1.1, 0, lona);
  for (const z of [-3.32, 3.32]) paredes.caixa(8.7, 0.22, 0.1, 0, 2.18, z, VERDE_SERAFIM);
  paredes.caixa(0.1, 1.8, 1.6, 4.04, 0.9, 0, ARDOSIA).cilindro(0.04, 0.05, 1.3, 5, 0, 4.55, 0, ACO);
  const teto = new Montador();
  teto.malha([-4.3, 2.2, -3.3, 4.3, 2.2, -3.3, 4.3, 3.9, 0, -4.3, 3.9, 0], [0, 2, 1, 0, 3, 2], lona);
  teto.malha([-4.3, 2.2, 3.3, 4.3, 2.2, 3.3, 4.3, 3.9, 0, -4.3, 3.9, 0], [0, 1, 2, 0, 2, 3], lona);
  teto.malha([4.3, 2.2, -3.3, 4.3, 2.2, 3.3, 4.3, 3.9, 0], [0, 1, 2], hex(0.82, 0.8, 0.72));
  teto.malha([-4.3, 2.2, -3.3, -4.3, 2.2, 3.3, -4.3, 3.9, 0], [0, 2, 1], hex(0.82, 0.8, 0.72));
  return [
    { geo: paredes.build(), material: 'padrao', tinta: false },
    { geo: teto.build(), material: 'duplo', tinta: false },
  ];
}

function gerador(): Camada[] {
  const m = new Montador()
    .caixa(3.6, 0.2, 1.7, 0, 0.1, 0, ARDOSIA)
    .caixa(3.4, 2.0, 1.5, 0, 1.2, 0, hex(0.17, 0.27, 0.2))
    .caixa(3.42, 0.2, 1.52, 0, 0.5, 0, AMARELO)
    .caixa(0.9, 0.7, 0.06, -0.9, 1.5, 0.78, ARDOSIA)
    .cilindro(0.12, 0.12, 1.4, 6, 1.2, 2.9, 0.3, ACO);
  for (let i = 0; i < 5; i++) m.caixa(0.7, 0.05, 0.04, 0.8, 1.0 + i * 0.16, 0.77, hex(0.1, 0.16, 0.12)); // as venezianas
  const led = new Montador();
  for (let i = 0; i < 3; i++) led.caixa(0.09, 0.09, 0.04, -1.2 + i * 0.3, 1.7, 0.82, VERDE_SERAFIM);
  return [
    { geo: m.build(), material: 'padrao', tinta: false },
    { geo: led.build(), material: 'brilho', tinta: false },
  ];
}

function caminhonete(): Camada[] {
  // A picape da base (cor da instância): cabine à frente (+x), caçamba aberta atrás.
  const corpo = new Montador().caixa(2.4, 0.85, 2.1, 1.3, 0.95, 0, hex(1, 1, 1)).caixa(1.9, 0.75, 1.85, 1.0, 1.7, 0, hex(1, 1, 1));
  corpo.caixa(2.6, 0.12, 2.1, -1.4, 1.0, 0, hex(1, 1, 1)); // o piso da caçamba
  for (const z of [-1.0, 1.0]) corpo.caixa(2.6, 0.5, 0.1, -1.4, 1.35, z, hex(1, 1, 1));
  corpo.caixa(0.1, 0.5, 2.1, -2.7, 1.35, 0, hex(1, 1, 1));
  const resto = new Montador();
  resto.caixa(1.7, 0.55, 1.9, 1.0, 1.72, 0, hex(0.1, 0.17, 0.24)); // o vidro
  for (const [x, z] of [[-2.0, -1.1], [-2.0, 1.1], [2.0, -1.1], [2.0, 1.1]] as const) resto.cilindro(0.52, 0.52, 0.36, 10, x, 0.52, z, hex(0.07, 0.07, 0.08), Math.PI / 2);
  resto.caixa(0.1, 0.22, 0.6, 2.52, 0.95, -0.7, hex(1, 0.95, 0.8)).caixa(0.1, 0.22, 0.6, 2.52, 0.95, 0.7, hex(1, 0.95, 0.8));
  resto.caixa(1.5, 0.1, 0.1, 1.0, 2.2, 0, ARDOSIA); // a barra de luz do teto (apagada)
  return [
    { geo: corpo.build(), material: 'padrao', tinta: true },
    { geo: resto.build(), material: 'padrao', tinta: false },
  ];
}

function bandeira(): Camada[] {
  const mastro = new Montador().cilindro(0.07, 0.1, 9, 6, 0, 4.5, 0, hex(0.75, 0.77, 0.8)).esfera(0.16, 6, 0, 9.1, 0, hex(0.9, 0.8, 0.3));
  return [
    { geo: mastro.build(), material: 'padrao', tinta: false },
    { geo: pano(2.8, 1.7, 8, 8.95, hex(1, 1, 1)), material: 'bandeira', tinta: true },
  ];
}

function cftv(): Camada[] {
  const m = new Montador().cilindro(0.07, 0.1, 4.4, 6, 0, 2.2, 0, ACO).barra(0, 4.3, 0, 0.7, 4.35, 0, 0.08, ACO).caixa(0.6, 0.28, 0.3, 0.95, 4.2, 0, ARDOSIA);
  const led = new Montador().caixa(0.08, 0.08, 0.04, 1.2, 4.2, 0.17, VERMELHO);
  return [
    { geo: m.build(), material: 'padrao', tinta: false },
    { geo: led.build(), material: 'brilho', tinta: false },
  ];
}

// ─── A praia e a calçada ────────────────────────────────────────────────────────────────────────────────────────

function cadeira(): Camada[] {
  const corpo = new Montador().caixa(0.7, 0.07, 1.0, 0, 0.36, 0.3, hex(1, 1, 1)).caixa(0.7, 0.07, 0.95, 0, 0.66, -0.4, hex(0.86, 0.86, 0.86), -0.85);
  const pes = new Montador();
  for (const [x, z] of [[-0.3, 0.7], [0.3, 0.7], [-0.3, -0.1], [0.3, -0.1]] as const) pes.caixa(0.05, 0.34, 0.05, x, 0.17, z, hex(0.75, 0.76, 0.78));
  return [
    { geo: corpo.build(), material: 'padrao', tinta: true },
    { geo: pes.build(), material: 'padrao', tinta: false },
  ];
}

function toalha(): Camada[] {
  const m = new Montador().caixa(1.0, 0.04, 2.0, 0, 0.02, 0, hex(1, 1, 1));
  for (const z of [-0.6, 0, 0.6]) m.caixa(1.0, 0.045, 0.22, 0, 0.022, z, hex(0.55, 0.55, 0.55));
  return [{ geo: m.build(), material: 'padrao', tinta: true }];
}

function rede(): Camada[] {
  // A rede de vôlei de praia: dois postes a 8,6 m, a fita de cima, a de baixo e os fios verticais.
  const m = new Montador().cilindro(0.06, 0.07, 2.5, 6, -4.3, 1.25, 0, hex(0.85, 0.85, 0.82)).cilindro(0.06, 0.07, 2.5, 6, 4.3, 1.25, 0, hex(0.85, 0.85, 0.82));
  m.caixa(8.6, 0.1, 0.03, 0, 2.4, 0, hex(0.96, 0.96, 0.94)).caixa(8.6, 0.05, 0.03, 0, 1.52, 0, hex(0.9, 0.9, 0.88));
  for (let i = -8; i <= 8; i++) m.caixa(0.02, 0.9, 0.02, i * 0.5, 1.95, 0, hex(0.9, 0.9, 0.88));
  for (let k = 0; k < 3; k++) m.caixa(8.6, 0.02, 0.02, 0, 1.7 + k * 0.28, 0, hex(0.88, 0.88, 0.86));
  return [{ geo: m.build(), material: 'padrao', tinta: false }];
}

function banco(): Camada[] {
  const m = new Montador().caixa(1.9, 0.08, 0.5, 0, 0.5, 0, MADEIRA).caixa(1.9, 0.45, 0.06, 0, 0.85, -0.22, MADEIRA, -0.15);
  for (const x of [-0.8, 0.8]) m.caixa(0.08, 0.5, 0.5, x, 0.25, 0, ARDOSIA);
  return [{ geo: m.build(), material: 'padrao', tinta: false }];
}

function lixeira(): Camada[] {
  const m = new Montador().cilindro(0.38, 0.34, 0.9, 8, 0, 0.45, 0, hex(0.2, 0.5, 0.35)).cilindro(0.4, 0.4, 0.08, 8, 0, 0.94, 0, ARDOSIA);
  return [{ geo: m.build(), material: 'padrao', tinta: false }];
}

function ponto(): Camada[] {
  // O ponto de ônibus: teto, quatro postes, banco e o painel luminoso.
  const m = new Montador().caixa(4.2, 0.14, 1.8, 0, 2.7, 0, hex(0.24, 0.62, 0.72)).caixa(3.6, 0.08, 0.6, 0, 0.5, -0.4, MADEIRA);
  for (const [x, z] of [[-1.9, -0.8], [1.9, -0.8], [-1.9, 0.8], [1.9, 0.8]] as const) m.cilindro(0.06, 0.06, 2.7, 6, x, 1.35, z, ACO);
  m.caixa(3.9, 1.9, 0.05, 0, 1.5, 0.85, hex(0.62, 0.78, 0.86)); // o vidro do fundo
  const luz = new Montador().caixa(1.0, 1.3, 0.08, 1.7, 1.55, 0.78, hex(0.5, 1, 0.75));
  return [
    { geo: m.build(), material: 'padrao', tinta: false },
    { geo: luz.build(), material: 'brilho', tinta: false },
  ];
}

function semaforo(): Camada[] {
  const m = new Montador().cilindro(0.08, 0.1, 5, 6, 0, 2.5, 0, ARDOSIA).barra(0, 4.9, 0, 2.5, 4.9, 0, 0.1, ARDOSIA).caixa(0.42, 1.15, 0.36, 2.4, 4.45, 0, hex(0.12, 0.13, 0.14));
  for (const y of [4.14, 4.45]) m.esfera(0.12, 6, 2.4, y, 0.2, hex(0.18, 0.18, 0.18));
  const luz = new Montador().esfera(0.13, 6, 2.4, 4.76, 0.2, hex(1, 0.12, 0.08));
  return [
    { geo: m.build(), material: 'padrao', tinta: false },
    { geo: luz.build(), material: 'brilho', tinta: false },
  ];
}

function touceira(): Camada[] {
  // Uma touceira de capim da restinga: seis lâminas inclinadas, do verde escuro na base ao dourado na ponta.
  const rand = mulberry32(606);
  const pos: number[] = [];
  const cor: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand() * 0.6;
    const alt = 0.7 + rand() * 0.55;
    const inc = 0.25 + rand() * 0.3;
    const base = pos.length / 3;
    const tx = Math.cos(a) * inc * alt;
    const tz = Math.sin(a) * inc * alt;
    const px = -Math.sin(a) * 0.07;
    const pz = Math.cos(a) * 0.07;
    pos.push(-px, 0, -pz, px, 0, pz, tx + px * 0.2, alt, tz + pz * 0.2);
    for (const k of [hex(0.22, 0.34, 0.1), hex(0.22, 0.34, 0.1), hex(0.66, 0.7, 0.32)]) {
      c.set(k);
      cor.push(c.r, c.g, c.b);
    }
    idx.push(base, base + 1, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return [{ geo: new Montador().pronta(g).build(), material: 'folha', tinta: false }];
}

function alga(): Camada[] {
  // A linha de maré: um tufo achatado de alga e conchas, verde-oliva escuro e marrom.
  const rand = mulberry32(1818);
  const g = new THREE.IcosahedronGeometry(0.3, 0);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1.2 + rand() * 0.5), p.getY(i) * 0.28, p.getZ(i) * (0.9 + rand() * 0.4));
  g.translate(0, 0.08, 0);
  const ng = g.toNonIndexed();
  ng.deleteAttribute('uv');
  ng.computeVertexNormals();
  const cores = new Float32Array(ng.attributes.position!.count * 3);
  const c = new THREE.Color();
  for (let f = 0; f < ng.attributes.position!.count; f += 3) {
    c.setRGB(0.2 + rand() * 0.14, 0.24 + rand() * 0.1, 0.12 + rand() * 0.06);
    for (let k = 0; k < 3; k++) cores.set([c.r, c.g, c.b], (f + k) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  return [{ geo: new Montador().pronta(ng).build(), material: 'padrao', tinta: false }];
}

// ─── O porto e o mar ────────────────────────────────────────────────────────────────────────────────────────────

function empilhadeira(): Camada[] {
  const corpo = new Montador().caixa(1.5, 0.8, 2.3, 0, 0.9, -0.2, hex(1, 1, 1)).caixa(1.4, 0.5, 0.7, 0, 1.0, -1.45, hex(1, 1, 1)); // o corpo e o contrapeso
  const resto = new Montador();
  for (const [x, z] of [[-0.7, 0.6], [0.7, 0.6], [-0.7, -1.0], [0.7, -1.0]] as const) resto.cilindro(0.36, 0.36, 0.3, 8, x, 0.36, z, hex(0.07, 0.07, 0.08), 0, 0, Math.PI / 2);
  for (const x of [-0.65, 0.65]) resto.caixa(0.08, 2.3, 0.1, x, 1.25, 1.05, ACO).caixa(0.14, 0.06, 1.3, x * 0.8, 0.2, 1.65, ACO); // o mastro e os garfos
  for (const [x, z] of [[-0.65, -0.4], [0.65, -0.4], [-0.65, 0.5], [0.65, 0.5]] as const) resto.caixa(0.06, 1.2, 0.06, x, 2.0, z, ARDOSIA); // a gaiola do operador
  resto.caixa(1.5, 0.06, 1.1, 0, 2.62, 0.05, ARDOSIA);
  return [
    { geo: corpo.build(), material: 'padrao', tinta: true },
    { geo: resto.build(), material: 'padrao', tinta: false },
  ];
}

function caminhao(): Camada[] {
  // O caminhão-cegonha do porto (eixo ao longo de x): cabine à frente (+x), chassi e o contêiner de 12 m (cor da instância).
  const conteiner = new Montador().caixa(12.0, 2.6, 2.44, -0.4, 2.55, 0, hex(1, 1, 1));
  for (let i = -5; i <= 5; i++) conteiner.caixa(0.06, 2.4, 2.5, -0.4 + i * 1.0, 2.55, 0, hex(0.82, 0.82, 0.82)); // as nervuras
  const resto = new Montador();
  resto.caixa(2.2, 2.2, 2.4, 6.9, 1.9, 0, hex(0.93, 0.93, 0.9)).caixa(0.1, 0.8, 2.0, 8.02, 2.3, 0, hex(0.1, 0.17, 0.24)); // a cabine e o parabrisa
  resto.caixa(12.6, 0.3, 2.3, 0.3, 1.05, 0, ARDOSIA); // o chassi
  for (const x of [-4.8, -3.6, -2.4, 5.8]) for (const z of [-1.1, 1.1]) resto.cilindro(0.55, 0.55, 0.4, 10, x, 0.55, z, hex(0.07, 0.07, 0.08), Math.PI / 2);
  return [
    { geo: conteiner.build(), material: 'padrao', tinta: true },
    { geo: resto.build(), material: 'padrao', tinta: false },
  ];
}

function lancha(): Camada[] {
  // A lancha de desembarque dos rebeldes (a proa a +x): casco chumbo com a faixa vermelha, rampa baixada e a cabine atrás.
  const chumbo = hex(0.2, 0.23, 0.22);
  const contorno = [[-3.6, -1.35], [2.4, -1.35], [3.6, -0.5], [3.6, 0.5], [2.4, 1.35], [-3.6, 1.35]] as const;
  const m = new Montador();
  m.pronta(prisma(contorno, 0, 1.4, chumbo)).pronta(prisma(contorno.map(([x, z]) => [x * 0.99, z * 0.99] as const), 1.4, 1.62, hex(0.14, 0.16, 0.15)));
  m.caixa(7.1, 0.16, 2.8, -0.0, 1.0, 0, VERMELHO).caixa(1.9, 1.5, 2.0, -2.2, 2.4, 0, hex(0.28, 0.31, 0.3)).caixa(0.1, 0.5, 1.7, -1.2, 2.7, 0, hex(0.1, 0.12, 0.14));
  m.caixa(2.4, 0.12, 2.3, 4.7, 0.65, 0, hex(0.3, 0.33, 0.32), 0, 0, -0.42); // a rampa baixada na areia
  const luz = new Montador().esfera(0.14, 6, -2.2, 3.4, 0, VERMELHO);
  return [
    { geo: m.build(), material: 'padrao', tinta: false },
    { geo: luz.build(), material: 'brilho', tinta: false },
  ];
}

function navioDeCabos(): Camada[] {
  // O navio lançador de cabos da SERAFIM: casco branco, faixa verde, ponte à frente e, na popa, o pórtico em A e o tanque de cabo.
  const contorno = [[-45, -11], [26, -11], [45, 0], [26, 11], [-45, 11]] as const;
  const m = new Montador();
  m.pronta(prisma(contorno, -5, 1, hex(0.12, 0.17, 0.26))).pronta(prisma(contorno.map(([x, z]) => [x * 0.995, z * 0.995] as const), 1, 7, hex(0.94, 0.94, 0.92)));
  m.caixa(89, 0.3, 21.6, 0, 7.1, 0, hex(0.36, 0.38, 0.38)).caixa(88.6, 0.9, 21.8, 0, 2.2, 0, VERDE_SERAFIM);
  m.caixa(16, 10, 18, 14, 12.2, 0, hex(0.95, 0.95, 0.93)).caixa(16.2, 1.8, 18.2, 14, 14.8, 0, hex(0.1, 0.18, 0.26)); // a ponte
  m.caixa(4, 5, 4, 8, 19.5, 0, hex(0.95, 0.95, 0.93));
  // O pórtico em A da popa (dois pés inclinados e a travessa) e o tanque de cabo no convés.
  for (const z of [-7, 7]) m.barra(-42, 7, z, -36, 23, z * 0.55, 0.9, hex(0.95, 0.5, 0.1));
  m.caixa(1.1, 1.1, 8, -36.8, 23, 0, hex(0.95, 0.5, 0.1));
  m.cilindro(7.5, 7.5, 4.2, 18, -18, 9.3, 0, hex(0.18, 0.2, 0.24));
  m.cilindro(0.35, 0.4, 16, 6, 12, 28, 0, hex(0.8, 0.8, 0.82)); // o mastro
  const luz = new Montador().esfera(0.55, 6, 12, 36.5, 0, hex(1, 0.96, 0.9)).esfera(0.4, 6, 14, 18.8, 7.9, hex(0.2, 1, 0.3)).esfera(0.4, 6, 14, 18.8, -7.9, hex(1, 0.15, 0.1));
  return [
    { geo: m.build(), material: 'padrao', tinta: false },
    { geo: luz.build(), material: 'brilho', tinta: false },
  ];
}

function navioRebelde(): Camada[] {
  // A nau de comando rebelde (o C2 das IAs): casco chumbo, antenas e um prato grande; luzes vermelhas que piscam.
  const contorno = [[-40, -9], [24, -9], [40, 0], [24, 9], [-40, 9]] as const;
  const m = new Montador();
  m.pronta(prisma(contorno, -5, 1, hex(0.1, 0.1, 0.12))).pronta(prisma(contorno.map(([x, z]) => [x * 0.995, z * 0.995] as const), 1, 6, hex(0.17, 0.18, 0.2)));
  m.caixa(79, 0.3, 17.6, 0, 6.1, 0, hex(0.12, 0.13, 0.14));
  m.caixa(14, 11, 12, -6, 12, 0, hex(0.2, 0.21, 0.23)).caixa(14.2, 1.6, 12.2, -6, 15, 0, hex(0.3, 0.05, 0.05));
  for (const [x, z] of [[-14, -4], [-14, 4], [-2, 0]] as const) m.barra(x, 17, z, x, 34, z, 0.5, hex(0.45, 0.46, 0.5)); // as antenas
  m.esfera(5, 12, 10, 18, 0, hex(0.55, 0.56, 0.6), 1, 0.6, 1); // o prato
  const luz = new Montador();
  for (const [x, y, z] of [[-14, 34.5, -4], [-14, 34.5, 4], [-2, 34.5, 0], [10, 21.5, 0], [30, 7, 0]] as const) luz.esfera(0.6, 6, x, y, z, VERMELHO);
  return [
    { geo: m.build(), material: 'padrao', tinta: false },
    { geo: luz.build(), material: 'brilho', tinta: false },
  ];
}

/** Os tipos desta cena (o restante, a base, está em `PraiaGeometrias.ts`). */
export const CONSTRUTORES_DE_CENA: Readonly<Partial<Record<TipoDeAdereco, () => Camada[]>>> = {
  refletor,
  vigia,
  carretel,
  hesco,
  barreira,
  saco,
  tenda,
  gerador,
  caminhonete,
  bandeira,
  cftv,
  cadeira,
  toalha,
  rede,
  banco,
  lixeira,
  ponto,
  semaforo,
  touceira,
  alga,
  empilhadeira,
  caminhao,
  lancha,
  navioDeCabos,
  navioRebelde,
};

