import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { praiaAderecos } from './PraiaAderecos';
import { hex, Montador } from './PraiaMontador';
import { costaEm } from './PraiaTerreno';

/**
 * A GENTE DA PRAIA (P127, rodada de vida): quem anda, pedala, nada e solta pipa na orla. Uma praia vazia lê como mapa de teste; com gente
 * ela lê como lugar — e a gente evacuada é a **história** da missão (`setCivis(false)`: na missão em ondas a orla está vazia, os rebeldes
 * desembarcam numa praia abandonada).
 *
 * **Tudo na GPU, CPU por quadro zero (G4/G5):** cada pessoa é uma instância de malha estática; o caminho (vai e volta num trecho), o
 * passo (os braços e as pernas balançando em oposição), o giro para o lado em que caminha e a altura do chão (a face molhada da praia, a
 * superfície do mar) são **contas do vertex shader** a partir de quatro números por instância e do tempo compartilhado. Nenhuma tem corpo
 * físico: são cenário (o Mech e o tiro atravessam, como numa palmeira), e ficam fora do alcance da simulação (nada de G6/G14).
 *
 * **Custo:** quatro desenhos (passantes, ciclistas, nadadores, pipas), ~9 mil triângulos no total. A lista é **dado puro** (`gentesDaPraia`,
 * `pipasDaPraia`): os testes conferem que ninguém atravessa quiosque, banco ou o complexo da estação.
 */

export type FaixaDeGente = 'calcadao' | 'beira' | 'nadador' | 'ciclovia';

/** O que o shader lê de cada faixa (o `aInfo.y`). */
const CODIGO_DA_FAIXA: Readonly<Record<FaixaDeGente, number>> = { calcadao: 0, beira: 1, nadador: 2, ciclovia: 3 };

export interface Passante {
  faixa: FaixaDeGente;
  /** Onde o trecho começa (x, m) e o comprimento com sinal (o sentido da ida: + para leste, − para oeste). */
  x0: number;
  comprimento: number;
  /** Calçadão e ciclovia: o z fixo da pista. Beira e nadador: o afastamento da linha d'água (m), para a areia e para o mar. */
  z: number;
  velocidade: number;
  /** Onde ele está no ciclo (0 a 1), para ninguém andar sincronizado. */
  fase: number;
  camisa: number;
  calca: number;
  escala: number;
}

const CAMISAS = [0xe8453c, 0x2f9fd8, 0xf2c43b, 0x3fbf7f, 0xe86fa8, 0xf5f2ea, 0x8e5aa8, 0xf28a2e, 0x2a3a6a];
const CALCAS = [0x2a3342, 0xc9b78a, 0x3a3f4a, 0xe9e4d6, 0x1f6f8b, 0x6a4a34, 0xd9534f, 0x4a6a3a];

/** As pistas do calçadão e da ciclovia: longe dos quiosques (z < 9), dos bancos (8,6) e dos postes (4,8). */
export const PISTAS_DO_CALCADAO: readonly number[] = [10.1, 10.9, 11.7];
export const PISTAS_DA_CICLOVIA: readonly number[] = [13.4, 14.2, 15.0];
/** A orla das pessoas: o calçadão e a praia vão de lado a lado do mapa, mas **a estação é uma base**: ninguém passeia dentro do complexo. */
export const GENTE_X = { min: -214, max: 228 } as const;

/** Quantos de cada (os desenhos têm um teto de instâncias fixo, G5). */
export const GENTE = { passantes: 34, ciclistas: 6, nadadores: 16, beira: 10 } as const;

/** Os vãos da areia onde dá para caminhar na beira: entre as lanchas de desembarque (que têm corpo), com folga de 6 m de cada lado. */
function vaosDaBeira(): (readonly [number, number])[] {
  const xs = praiaAderecos().filter((a) => a.tipo === 'lancha').map((a) => a.x).sort((a, b) => a - b);
  const out: (readonly [number, number])[] = [];
  let ini = GENTE_X.min;
  for (const x of xs) {
    if (x - 6 - ini > 25) out.push([ini, x - 6]);
    ini = x + 6;
  }
  if (GENTE_X.max - ini > 25) out.push([ini, GENTE_X.max]);
  return out;
}

/** A lista de gente (determinística, G2): passantes no calçadão, caminhantes na beira, ciclistas na ciclovia e nadadores. */
export function gentesDaPraia(): Passante[] {
  const rand = mulberry32(52013);
  const pick = <T,>(l: readonly T[]): T => l[Math.floor(rand() * l.length)]!;
  const out: Passante[] = [];
  const trecho = (compMin: number, compMax: number): { x0: number; comprimento: number } => {
    const comp = compMin + rand() * (compMax - compMin);
    const x0 = GENTE_X.min + rand() * (GENTE_X.max - GENTE_X.min - comp);
    return rand() < 0.5 ? { x0, comprimento: comp } : { x0: x0 + comp, comprimento: -comp };
  };
  for (let i = 0; i < GENTE.passantes; i++) {
    const corre = i % 9 === 0; // de vez em quando, alguém correndo
    out.push({ faixa: 'calcadao', ...trecho(50, 130), z: pick(PISTAS_DO_CALCADAO) + (rand() - 0.5) * 0.3, velocidade: corre ? 2.6 : 0.9 + rand() * 0.5, fase: rand(), camisa: pick(CAMISAS), calca: pick(CALCAS), escala: 0.92 + rand() * 0.16 });
  }
  const vaos = vaosDaBeira();
  for (let i = 0; i < GENTE.beira; i++) {
    const vao = vaos[i % vaos.length]!;
    const comp = Math.min(35 + rand() * 55, vao[1] - vao[0]);
    const x0 = vao[0] + rand() * (vao[1] - vao[0] - comp);
    const volta = rand() < 0.5;
    out.push({ faixa: 'beira', x0: volta ? x0 + comp : x0, comprimento: volta ? -comp : comp, z: 1.2 + rand() * 2.0, velocidade: 0.7 + rand() * 0.4, fase: rand(), camisa: pick(CAMISAS), calca: pick(CALCAS), escala: 0.92 + rand() * 0.16 });
  }
  for (let i = 0; i < GENTE.ciclistas; i++) {
    out.push({ faixa: 'ciclovia', ...trecho(120, 220), z: PISTAS_DA_CICLOVIA[i % PISTAS_DA_CICLOVIA.length]!, velocidade: 4.2 + rand() * 1.6, fase: rand(), camisa: pick(CAMISAS), calca: pick(CALCAS), escala: 1 });
  }
  for (let i = 0; i < GENTE.nadadores; i++) {
    out.push({ faixa: 'nadador', ...trecho(10, 26), z: 5.5 + rand() * 6.5, velocidade: 0.18 + rand() * 0.22, fase: rand(), camisa: pick(CAMISAS), calca: pick(CALCAS), escala: 1 });
  }
  return out;
}

/** O ponto em que `p` está no instante `t` (x e z, m): a mesma conta do vertex shader (para os testes). */
export function posicaoDoPassante(p: Passante, t: number): { x: number; z: number; sentido: number } {
  const comp = Math.max(Math.abs(p.comprimento), 1);
  const c = (((t * p.velocidade) / (2 * comp) + p.fase) % 1 + 1) % 1;
  const f = c * 2;
  const ida = f <= 1;
  const prog = ida ? f : 2 - f;
  const x = p.x0 + prog * p.comprimento;
  const sentido = (ida ? 1 : -1) * (p.comprimento < 0 ? -1 : 1);
  const z = p.faixa === 'calcadao' || p.faixa === 'ciclovia' ? p.z : p.faixa === 'beira' ? costaEm(x) + p.z : costaEm(x) - p.z;
  return { x, z, sentido };
}

// ─── As malhas ──────────────────────────────────────────────────────────────────────────────────────────────────

const PELES = [0xf1c9a5, 0xd9a273, 0xb07a52, 0x8a5a3c, 0x5e3b27];
const CABELOS = [0x2a1d14, 0x4a3020, 0x111111, 0x8a6a3a, 0xc9b27a];

type Parte = 0 | 1 | 2; // 0: cor fixa (pele, cabelo, sapato) · 1: a camisa da instância · 2: a calça da instância
type PesoDeMembro = (x: number, y: number, z: number) => readonly [number, number];

/** Põe nos vértices o que o shader precisa: de que parte do corpo é (a cor da instância) e quanto balança (e para que lado). */
function marca(g: THREE.BufferGeometry, parte: Parte, peso: PesoDeMembro | null): THREE.BufferGeometry {
  const pos = g.attributes.position!;
  const n = pos.count;
  const aParte = new Float32Array(n).fill(parte);
  const aMembro = new Float32Array(n * 2);
  if (peso) {
    for (let i = 0; i < n; i++) {
      const [w, lado] = peso(pos.getX(i), pos.getY(i), pos.getZ(i));
      aMembro[i * 2] = w;
      aMembro[i * 2 + 1] = lado;
    }
  }
  g.setAttribute('aParte', new THREE.BufferAttribute(aParte, 1));
  g.setAttribute('aMembro', new THREE.BufferAttribute(aMembro, 2));
  return g;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const lado = (z: number): number => (z < 0 ? -1 : 1);
const SEM_BRILHO = hex(1, 1, 1);
const PARADO: readonly [number, number] = [0, 0];

/** A pessoa de pé, de frente para +x (1,75 m): tronco (camisa), pernas (calça, balançam), braços e cabeça (pele), cabelo e tênis. */
function geometriaDaPessoa(): THREE.BufferGeometry {
  const rand = mulberry32(31);
  const pele = PELES[Math.floor(rand() * PELES.length)]!;
  const camisa = new Montador().caixa(0.24, 0.56, 0.44, 0, 1.24, 0, SEM_BRILHO).build();
  const calca = new Montador().caixa(0.17, 0.8, 0.17, 0, 0.42, -0.1, SEM_BRILHO).caixa(0.17, 0.8, 0.17, 0, 0.42, 0.1, SEM_BRILHO).build();
  const corpo = new Montador()
    .esfera(0.115, 7, 0.01, 1.66, 0, pele)
    .caixa(0.1, 0.5, 0.1, 0, 1.28, -0.27, pele)
    .caixa(0.1, 0.5, 0.1, 0, 1.28, 0.27, pele)
    .esfera(0.12, 7, -0.015, 1.71, 0, CABELOS[Math.floor(rand() * CABELOS.length)]!, 1, 0.62, 1)
    .build();
  const tenis = new Montador().caixa(0.27, 0.07, 0.13, 0.05, 0.035, -0.1, hex(0.93, 0.93, 0.93)).caixa(0.27, 0.07, 0.13, 0.05, 0.035, 0.1, hex(0.93, 0.93, 0.93)).build();
  // As pernas balançam mais embaixo (o pé); os braços, em oposição às pernas do mesmo lado, mais embaixo também.
  const perna: PesoDeMembro = (_x, y, z) => [clamp01((0.84 - y) / 0.84), lado(z)];
  const braco: PesoDeMembro = (_x, y, z) => [clamp01((1.54 - y) / 0.54), -lado(z)];
  const partes = [marca(camisa, 1, null), marca(calca, 2, perna), marca(corpo, 0, (x, y, z) => (Math.abs(z) > 0.2 ? braco(x, y, z) : PARADO)), marca(tenis, 0, perna)];
  return junta(partes);
}

/** O ciclista: a bicicleta (rodas, quadro, guidão) com a pessoa inclinada para a frente, as pernas pedalando. */
function geometriaDoCiclista(): THREE.BufferGeometry {
  const pneu = hex(0.08, 0.08, 0.09);
  const bici = new Montador()
    .cilindro(0.34, 0.34, 0.05, 12, -0.55, 0.34, 0, pneu, Math.PI / 2)
    .cilindro(0.34, 0.34, 0.05, 12, 0.55, 0.34, 0, pneu, Math.PI / 2)
    .barra(-0.55, 0.34, 0, -0.1, 0.62, 0, 0.035, hex(0.7, 0.7, 0.72))
    .barra(-0.1, 0.62, 0, 0.5, 0.74, 0, 0.035, hex(0.7, 0.7, 0.72))
    .barra(0.5, 0.74, 0, 0.55, 0.34, 0, 0.035, hex(0.7, 0.7, 0.72))
    .barra(0.5, 0.74, 0, 0.42, 1.0, 0, 0.035, hex(0.3, 0.3, 0.32))
    .caixa(0.05, 0.05, 0.5, 0.42, 1.02, 0, hex(0.3, 0.3, 0.32))
    .build();
  const camisa = new Montador().caixa(0.22, 0.58, 0.42, 0.04, 1.2, 0, SEM_BRILHO, 0, 0, -0.42).build();
  const calca = new Montador().caixa(0.5, 0.15, 0.15, -0.05, 0.82, -0.1, SEM_BRILHO, 0, 0, -0.1).caixa(0.5, 0.15, 0.15, -0.05, 0.82, 0.1, SEM_BRILHO, 0, 0, -0.1).build();
  const pele = PELES[1]!;
  const corpo = new Montador().esfera(0.115, 7, 0.27, 1.5, 0, pele).caixa(0.5, 0.09, 0.09, 0.28, 1.18, -0.2, pele, 0, 0, -0.2).caixa(0.5, 0.09, 0.09, 0.28, 1.18, 0.2, pele, 0, 0, -0.2).esfera(0.13, 7, 0.26, 1.55, 0, hex(0.9, 0.15, 0.15), 1, 0.7, 1).build();
  const pedal: PesoDeMembro = (x, _y, z) => [clamp01(0.6 + (x + 0.3) * 0.5), lado(z)];
  return junta([marca(bici, 0, null), marca(camisa, 1, null), marca(calca, 2, pedal), marca(corpo, 0, null)]);
}

/** O nadador: só a cabeça, os ombros e os braços fora d'água (a origem é a superfície); os braços fazem o nado crawl. */
function geometriaDoNadador(): THREE.BufferGeometry {
  const pele = PELES[0]!;
  const camisa = new Montador().caixa(0.26, 0.2, 0.46, 0, -0.04, 0, SEM_BRILHO).build();
  const corpo = new Montador().esfera(0.11, 7, 0.18, 0.09, 0, pele).esfera(0.115, 7, 0.17, 0.12, 0, hex(0.12, 0.12, 0.14), 1, 0.6, 1).build();
  const bracos = new Montador().caixa(0.5, 0.08, 0.08, 0.28, 0.02, -0.3, pele).caixa(0.5, 0.08, 0.08, 0.28, 0.02, 0.3, pele).build();
  const crawl: PesoDeMembro = (x, _y, z) => [clamp01((x + 0.0) / 0.55), lado(z)];
  return junta([marca(camisa, 1, null), marca(corpo, 0, null), marca(bracos, 0, crawl)]);
}

function junta(partes: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeAtributos(partes);
  g.computeBoundingSphere();
  return g;
}

function mergeAtributos(partes: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // As peças vêm do `Montador` (posição, normal, cor) mais `aParte` e `aMembro`: o mesmo conjunto, então a fusão é direta.
  let total = 0;
  for (const p of partes) total += p.attributes.position!.count;
  const nomes: [string, number][] = [['position', 3], ['normal', 3], ['color', 3], ['aParte', 1], ['aMembro', 2]];
  const g = new THREE.BufferGeometry();
  for (const [nome, tam] of nomes) {
    const dados = new Float32Array(total * tam);
    let o = 0;
    for (const p of partes) {
      const a = p.attributes[nome]!;
      dados.set(a.array as Float32Array, o);
      o += a.count * tam;
    }
    g.setAttribute(nome, new THREE.BufferAttribute(dados, tam));
  }
  return g;
}

// ─── Os shaders ─────────────────────────────────────────────────────────────────────────────────────────────────

const DECLARA = /* glsl */ `
uniform float uTempo;
attribute vec4 aRota;     // x0, z (ou afastamento), comprimento com sinal, velocidade
attribute vec4 aInfo;     // fase, faixa (0 calçadão, 1 beira, 2 nadador, 3 ciclovia), escala, passo
attribute vec3 aCamisa;
attribute vec3 aCalca;
attribute float aParte;   // 0 cor fixa, 1 camisa, 2 calça
attribute vec2 aMembro;   // peso do balanço, lado
float costaDaPraia(float x) { return -36.0 + 6.5 * sin(x / 61.0 + 0.8) + 3.2 * sin(x / 23.0 + 2.1); }
float faceDaPraia(float afasta) { float t = clamp((4.0 - afasta) / 4.0, 0.0, 1.0); return -0.35 * t * t * (3.0 - 2.0 * t); }
// O ponto do trecho (0 a 1) e o sentido em que anda (+1 leste, -1 oeste): vai e volta.
void marcha(out float p, out float sentido) {
  float comp = max(abs(aRota.z), 1.0);
  float f = fract(uTempo * aRota.w / (2.0 * comp) + aInfo.x) * 2.0;
  float ida = step(f, 1.0);
  p = mix(2.0 - f, f, ida);
  sentido = mix(-1.0, 1.0, ida) * (aRota.z < 0.0 ? -1.0 : 1.0);
}
`;

const NORMAL = /* glsl */ `
{ float mp; float ms; marcha(mp, ms); objectNormal.xz *= ms; }
`;

const COR = /* glsl */ `
vColor.rgb = aParte < 0.5 ? vColor.rgb : (aParte < 1.5 ? aCamisa : aCalca); // (o vColor do three é vec4)
`;

const POSICAO = /* glsl */ `
{
  float mp; float ms; marcha(mp, ms);
  float faixa = aInfo.y;
  float x = aRota.x + mp * aRota.z;
  float z = aRota.y;
  float y = faixa > 2.5 ? 0.13 : 0.1;
  if (faixa > 0.5 && faixa < 1.5) { z = costaDaPraia(x) + aRota.y; y = faceDaPraia(aRota.y); }
  else if (faixa > 1.5 && faixa < 2.5) { z = costaDaPraia(x) - aRota.y; y = -0.35 + sin(uTempo * 1.3 + aInfo.x * 9.0) * 0.05; }
  float ciclo = uTempo * aRota.w * aInfo.w + aInfo.x * 31.0;
  float balanco = sin(ciclo) * aMembro.y * aMembro.x;
  if (faixa > 1.5 && faixa < 2.5) {
    // O nado crawl: cada braço sobe e passa por cima da cabeça, em oposição ao outro.
    transformed.y += max(0.0, cos(ciclo) * aMembro.y) * aMembro.x * 0.34;
    transformed.x += balanco * 0.3;
  } else {
    transformed.x += balanco * 0.3;
    transformed.y += abs(sin(ciclo)) * 0.03 * (faixa > 2.5 ? 0.0 : 1.0);
  }
  transformed *= aInfo.z;
  transformed.xz *= ms; // vira o corpo para o lado em que anda (meia-volta em torno de Y)
  transformed += vec3(x, y, z);
}
`;

function materialDaGente(tempo: { value: number }, chave: string): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTempo = tempo;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${DECLARA}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${NORMAL}`)
      .replace('#include <color_vertex>', `#include <color_vertex>\n${COR}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${POSICAO}`);
  };
  m.customProgramCacheKey = () => `cybermech-praia-gente-${chave}`;
  return m;
}

/** Os atributos por instância e o corpo da malha: uma instância por passante. */
function malhaDe(geo: THREE.BufferGeometry, material: THREE.Material, lista: readonly Passante[], passo: number): THREE.InstancedMesh {
  const n = lista.length;
  const rota = new Float32Array(n * 4);
  const info = new Float32Array(n * 4);
  const camisa = new Float32Array(n * 3);
  const calca = new Float32Array(n * 3);
  const c = new THREE.Color();
  lista.forEach((p, i) => {
    rota.set([p.x0, p.z, p.comprimento, p.velocidade], i * 4);
    // O passo acompanha a velocidade: quem corre balança mais depressa (a frequência é velocidade × `passo`).
    info.set([p.fase, CODIGO_DA_FAIXA[p.faixa], p.escala, passo * (p.velocidade > 2 && p.faixa === 'calcadao' ? 0.55 : 1)], i * 4);
    c.set(p.camisa);
    camisa.set([c.r, c.g, c.b], i * 3);
    c.set(p.calca);
    calca.set([c.r, c.g, c.b], i * 3);
  });
  geo.setAttribute('aRota', new THREE.InstancedBufferAttribute(rota, 4));
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
  geo.setAttribute('aCamisa', new THREE.InstancedBufferAttribute(camisa, 3));
  geo.setAttribute('aCalca', new THREE.InstancedBufferAttribute(calca, 3));
  const malha = new THREE.InstancedMesh(geo, material, n);
  malha.frustumCulled = false; // a posição vem do shader: a caixa da geometria não vale
  return malha;
}

// ─── As pipas ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface Pipa {
  /** Onde a linha está presa na areia. */
  x: number;
  z: number;
  /** A altura da pipa (m) e o quanto ela se afasta, para o mar (dx, dz em m). */
  altura: number;
  dx: number;
  dz: number;
  cor: number;
  fase: number;
}

const CORES_DE_PIPA = [0xe8453c, 0xf2c43b, 0x2f9fd8, 0xe86fa8, 0x3fbf7f, 0xf28a2e, 0x8e5aa8];

/** As pipas do céu da praia (da altura que o vento dá, sobre a areia, de frente para o mar). */
export function pipasDaPraia(): Pipa[] {
  const rand = mulberry32(9911);
  const out: Pipa[] = [];
  for (let i = 0; i < 8; i++) {
    const x = -190 + i * 48 + (rand() - 0.5) * 30;
    out.push({ x, z: costaEm(x) + 9 + rand() * 12, altura: 34 + rand() * 40, dx: (rand() - 0.5) * 18, dz: -(8 + rand() * 20), cor: CORES_DE_PIPA[i % CORES_DE_PIPA.length]!, fase: rand() * 6.28 });
  }
  return out;
}

/**
 * A pipa: o losango (de duas cores da instância), a cauda de laços e a linha — tudo num desenho. Os vértices dizem o que são (`aTipo`:
 * 0 linha, 1 corpo, 2 cauda). O ponto (0, 0, 0) da instância é a ponta da linha, na areia; o shader leva o corpo até (dx, altura, dz), balança
 * e inclina, e estica a linha (duas fitas finas cruzadas, para não sumir de lado) do chão até ele.
 */
function geometriaDaPipa(): THREE.BufferGeometry {
  const pos: number[] = [];
  const cor: number[] = [];
  const tipo: number[] = [];
  const alt: number[] = [];
  const cauda: number[] = [];
  const K = 1.5; // a pipa e a cauda: a 40 a 70 m de altura, 1,4 m de largura é um ponto; a linha fica fina
  const v = (x: number, y: number, z: number, c: readonly [number, number, number], t: number, a: number, w: number): void => {
    const e = t === 0 ? 1 : K;
    pos.push(x * e, y * e, z * e);
    cor.push(c[0], c[1], c[2]);
    tipo.push(t);
    alt.push(a);
    cauda.push(w);
  };
  // O losango: dois triângulos (a cor da instância multiplica o branco; o de baixo é um pouco mais escuro).
  for (const [x, y] of [[0, 1.1], [-0.7, 0], [0.7, 0]] as const) v(x, y, 0, [1, 1, 1], 1, 1, 0);
  for (const [x, y] of [[-0.7, 0], [0, -1.5], [0.7, 0]] as const) v(x, y, 0, [0.8, 0.8, 0.8], 1, 1, 0);
  // A cauda: cinco laços pendurados, cada vez mais soltos (o peso é quanto balançam).
  for (let k = 0; k < 5; k++) {
    const y = -1.7 - k * 0.8;
    const w = (k + 1) / 5;
    const c: readonly [number, number, number] = k % 2 === 0 ? [1, 0.95, 0.4] : [0.95, 0.35, 0.3];
    v(-0.2, y, 0, c, 2, 1, w);
    v(0.2, y, 0, c, 2, 1, w);
    v(0, y - 0.38, 0, c, 2, 1, w);
  }
  // A linha: duas fitas finas (uma de largura em x, outra em z) que vão do chão (alt 0) até a pipa (alt 1).
  const fio: readonly [number, number, number] = [0.92, 0.92, 0.86];
  for (const [wx, wz] of [[0.014, 0], [0, 0.014]] as const) {
    v(-wx, 0, -wz, fio, 0, 0, 0);
    v(wx, 0, wz, fio, 0, 0, 0);
    v(wx, 0, wz, fio, 0, 1, 0);
    v(-wx, 0, -wz, fio, 0, 0, 0);
    v(wx, 0, wz, fio, 0, 1, 0);
    v(-wx, 0, -wz, fio, 0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setAttribute('aTipo', new THREE.Float32BufferAttribute(tipo, 1));
  g.setAttribute('aAlt', new THREE.Float32BufferAttribute(alt, 1));
  g.setAttribute('aCauda', new THREE.Float32BufferAttribute(cauda, 1));
  return g;
}

function criarPipas(scene: THREE.Scene, tempo: { value: number }): THREE.Mesh | null {
  const lista = pipasDaPraia();
  if (lista.length === 0) return null;
  const g = geometriaDaPipa();
  const destino = new Float32Array(lista.length * 4);
  const tinta = new Float32Array(lista.length * 3);
  const c = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTempo = tempo;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTempo;\nattribute float aTipo;\nattribute float aAlt;\nattribute float aCauda;\nattribute vec4 aPipa;\nattribute vec3 aTinta;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb *= (aTipo > 0.5 && aTipo < 1.5) ? aTinta : vec3(1.0);')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float f = aPipa.w;
          // Onde a pipa está (relativo à ponta da linha): vai de um lado a outro e sobe e desce um pouco.
          vec3 alto = vec3(aPipa.x + sin(uTempo * 0.5 + f) * 2.4, aPipa.y + sin(uTempo * 0.37 + f * 1.7) * 1.6, aPipa.z + cos(uTempo * 0.43 + f) * 2.2);
          if (aTipo < 0.5) {
            // A linha: do chão até a pipa, com uma barriga que o vento mexe.
            transformed = position + alto * aAlt;
            transformed.x += sin(aAlt * 3.14159) * 0.5 * sin(uTempo * 0.9 + f);
          } else {
            vec3 p = position;
            p.x += sin(uTempo * 3.1 + position.y * 2.0 + f) * 0.35 * aCauda; // a cauda tremula
            float ang = sin(uTempo * 1.3 + f) * 0.22;                        // a pipa inclina para os lados
            float ci = cos(ang);
            float si = sin(ang);
            p.xy = vec2(p.x * ci - p.y * si, p.x * si + p.y * ci);
            transformed = p + alto;
          }
        }`,
      );
  };
  material.customProgramCacheKey = () => 'cybermech-praia-pipa';
  const malha = new THREE.InstancedMesh(g, material, lista.length);
  lista.forEach((p, i) => {
    malha.setMatrixAt(i, m4.makeTranslation(p.x, 0, p.z));
    destino.set([p.dx, p.altura, p.dz, p.fase], i * 4);
    c.set(p.cor);
    tinta.set([c.r, c.g, c.b], i * 3);
  });
  g.setAttribute('aPipa', new THREE.InstancedBufferAttribute(destino, 4));
  g.setAttribute('aTinta', new THREE.InstancedBufferAttribute(tinta, 3));
  malha.frustumCulled = false;
  scene.add(malha);
  return malha;
}

// ─── A cena ─────────────────────────────────────────────────────────────────────────────────────────────────────

export class PraiaGente {
  private readonly malhas: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, tempo: { value: number }) {
    const gente = gentesDaPraia();
    const aPe = gente.filter((p) => p.faixa === 'calcadao' || p.faixa === 'beira');
    const nadando = gente.filter((p) => p.faixa === 'nadador');
    const pedalando = gente.filter((p) => p.faixa === 'ciclovia');
    const pessoas = malhaDe(geometriaDaPessoa(), materialDaGente(tempo, 'pessoa'), aPe, 6.2);
    const ciclistas = malhaDe(geometriaDoCiclista(), materialDaGente(tempo, 'ciclista'), pedalando, 1.6);
    const nadadores = malhaDe(geometriaDoNadador(), materialDaGente(tempo, 'nadador'), nadando, 14);
    for (const m of [pessoas, ciclistas, nadadores]) {
      scene.add(m);
      this.malhas.push(m);
    }
    const pipas = criarPipas(scene, tempo);
    if (pipas) this.malhas.push(pipas);
  }

  /** `false`: a orla está evacuada (a missão em ondas da praia): ninguém passeia, pedala ou nada, e o céu fica sem pipa. */
  setCivis(visivel: boolean): void {
    for (const m of this.malhas) m.visible = visivel;
  }
}
