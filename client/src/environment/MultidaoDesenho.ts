import * as THREE from 'three';
import { CARECA, Multidao, NUNCA, PERUCA, PNEU, PORCO, TICKS_DO_TOMBO, TIPOS } from '../sim/Multidao';
import { hex, Montador } from './PraiaMontador';

/**
 * O DESENHO DA MULTIDÃO DO 8 DE JANEIRO (passo 3 da ficha `fichas/cenario-8-de-janeiro.md`): milhares de figurantes em **um desenho por tipo** (`TIPOS`), sem CPU por figurante por quadro (G4/G5).
 *
 * Do jeito da gente da praia (`PraiaGente.ts`): cada pessoa é uma instância de malha estática e **a posição é conta da vertex shader**, a partir de números por instância e do tick
 * compartilhado (`uTick`). É a mesma conta de `sim/Multidao.ts` (a posição como função do tempo), escrita em GLSL: o desenho e a simulação nunca divergem porque saem da mesma fórmula
 * e dos mesmos vetores. O balanço do andar, o gingado ao parar na fachada, o tombo de quem morre e a correria de quem foge também saem do tick.
 *
 * Só o que o jogador causa muda os atributos por instância (`aFim`, `aFuga`): a simulação avisa (`aoMorrer`, `aoFugir`), o desenho copia aquele figurante e marca o buffer; o envio à GPU
 * é de um buffer pequeno e só nos quadros em que alguém morre ou foge. Sem sombra própria. Nenhuma tem corpo físico (a simulação decide os acertos com um cilindro).
 *
 * **O que cada tipo é** (caricaturas de TIPOS, nunca de pessoas: nenhum nome, marca ou texto de pessoa real identificável): o GADO tem a cabeça de gado (focinho e chifres; "é o mod deles"), o
 * CARECA é o idoso careca de colete, a PERUCA é o rapaz de peruca loira, a BANDEIRA é o invasor genérico erguendo um mastro com um pano liso (sem símbolo nenhum), o TIO_SAM usa a cartola
 * estrelada e a barba branca de cavanhaque (símbolo político de domínio público, já aceito no P243), o PORCO tem o focinho e as orelhas, e o PNEU troca a cabeça por um pneu — os três últimos
 * confirmados como tipos genéricos pelo Comandante (P246), sem referência a pessoa real. Cada tipo tem **botão de desligar** (`mascaras`): desligada, a cabeça volta a ser uma cabeça comum (ou
 * as mãos da BANDEIRA ficam vazias) e a camisa verde e amarela fica.
 */

export interface MascarasDaMultidao {
  /** A cabeça de gado do GADO. */
  gado: boolean;
  /** O colete e o bigode do CARECA. */
  careca: boolean;
  /** A peruca loira da PERUCA. */
  peruca: boolean;
  /** O mastro e o pano da BANDEIRA. */
  bandeira: boolean;
  /** A cartola estrelada e a barba do TIO_SAM. */
  tioSam: boolean;
  /** O focinho e as orelhas do PORCO. */
  porco: boolean;
  /** A cabeça de pneu do PNEU. */
  pneu: boolean;
  /** O gorro e os chifres rosa do BARBARO. */
  barbaro: boolean;
}
export const MASCARAS_LIGADAS: MascarasDaMultidao = { gado: true, careca: true, peruca: true, bandeira: true, tioSam: true, porco: true, pneu: true, barbaro: true };

const CAMISAS = [0x1f8a3b, 0x2faa4a, 0xf2c200, 0xffd21f, 0x17703a, 0xe6e6c8];
const CALCAS = [0x24304a, 0x3b4a6b, 0x3a3a3a, 0x6b5b45, 0xb9a98a];
const PELES = [0xf1c9a5, 0xd9a273, 0xb07a52, 0x8a5a3c, 0xf3d2b5];
const PELOS_DO_GADO = [0xf2efe6, 0x3a2a1e, 0x8a5a36, 0x1f1b18, 0xc9b79a];
const SEM_COR = hex(1, 1, 1);

/** O RGB (já linear, como o three o guarda) em 8 bits por canal, num float só: o shader desempacota (`desempacota`). Os 24 bits cabem exatos num float de 32. */
export function empacota(c: THREE.Color): number {
  const b = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 255)));
  return b(c.r) * 65536 + b(c.g) * 256 + b(c.b);
}

type Parte = 0 | 1 | 2 | 3; // 0 cor fixa · 1 camisa · 2 calça · 3 pelagem (a instância)
type Peso = (x: number, y: number, z: number) => readonly [number, number];
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const lado = (z: number): number => (z < 0 ? -1 : 1);

/** Põe nos vértices (`aVert`: parte, peso, lado) de que parte do corpo são (a cor da instância) e quanto balançam (e para que lado). */
function marca(g: THREE.BufferGeometry, parte: Parte, peso: Peso | null): THREE.BufferGeometry {
  const pos = g.attributes.position!;
  const n = pos.count;
  const aVert = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    aVert[i * 3] = parte;
    if (peso) {
      const [w, l] = peso(pos.getX(i), pos.getY(i), pos.getZ(i));
      aVert[i * 3 + 1] = w;
      aVert[i * 3 + 2] = l;
    }
  }
  g.setAttribute('aVert', new THREE.BufferAttribute(aVert, 3));
  return g;
}

function junta(partes: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const p of partes) total += p.attributes.position!.count;
  const g = new THREE.BufferGeometry();
  const nomes: [string, number][] = [['position', 3], ['normal', 3], ['color', 3], ['aVert', 3]];
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
  g.computeBoundingSphere();
  return g;
}

/** O corpo em pé, de frente para +x (1,75 m): tronco (camisa), pernas (calça, balançam) e braços (pele, balançam em oposição). A cabeça é de cada tipo. */
function corpo(pele: number): THREE.BufferGeometry[] {
  const perna: Peso = (_x, y, z) => [clamp01((0.84 - y) / 0.84), lado(z)];
  const braco: Peso = (_x, y, z) => [clamp01((1.54 - y) / 0.54), -lado(z)];
  const camisa = new Montador().caixa(0.24, 0.56, 0.44, 0, 1.24, 0, SEM_COR).build();
  const calca = new Montador().caixa(0.17, 0.8, 0.17, 0, 0.42, -0.1, SEM_COR).caixa(0.17, 0.8, 0.17, 0, 0.42, 0.1, SEM_COR).build();
  const bracos = new Montador().caixa(0.1, 0.5, 0.1, 0, 1.28, -0.27, pele).caixa(0.1, 0.5, 0.1, 0, 1.28, 0.27, pele).build();
  return [marca(camisa, 1, null), marca(calca, 2, perna), marca(bracos, 0, braco)];
}

/** O GADO: a cabeça de gado (cabeça na pelagem da instância, focinho claro e chifres). Sem a máscara, uma cabeça comum. */
export function geometriaDoGado(mascara = true): THREE.BufferGeometry {
  const pele = PELES[0]!;
  const partes = corpo(pele);
  if (mascara) {
    const cabeca = new Montador().caixa(0.27, 0.27, 0.25, 0.01, 1.72, 0, SEM_COR).build();
    const focinho = new Montador().caixa(0.15, 0.13, 0.2, 0.18, 1.66, 0, hex(0.93, 0.78, 0.72)).build();
    const chifres = new Montador().barra(0, 1.84, -0.1, -0.03, 2.0, -0.24, 0.045, hex(0.93, 0.9, 0.78)).barra(0, 1.84, 0.1, -0.03, 2.0, 0.24, 0.045, hex(0.93, 0.9, 0.78)).build();
    partes.push(marca(cabeca, 3, null), marca(focinho, 0, null), marca(chifres, 0, null));
  } else {
    partes.push(marca(new Montador().esfera(0.115, 5, 0.01, 1.66, 0, pele).esfera(0.12, 5, -0.015, 1.71, 0, hex(0.16, 0.12, 0.09), 1, 0.62, 1).build(), 0, null));
  }
  return junta(partes);
}

/** O CARECA: o idoso careca de colete, mais baixo e largo, com o bigode branco. Sem a máscara, só a cabeça. */
export function geometriaDoCareca(mascara = true): THREE.BufferGeometry {
  const pele = PELES[4]!;
  const partes = corpo(pele);
  partes.push(marca(new Montador().esfera(0.125, 5, 0.01, 1.62, 0, pele).build(), 0, null));
  if (mascara) {
    const colete = new Montador().caixa(0.27, 0.46, 0.48, 0.005, 1.27, 0, hex(0.36, 0.42, 0.22)).caixa(0.28, 0.12, 0.2, 0.12, 1.2, 0, hex(0.36, 0.42, 0.22), 0, 0, 0).build();
    const bigode = new Montador().caixa(0.04, 0.035, 0.14, 0.115, 1.585, 0, hex(0.94, 0.94, 0.92)).build();
    partes.push(marca(colete, 0, null), marca(bigode, 0, null));
  }
  return junta(partes);
}

/** A PERUCA: o rapaz de peruca loira (a cabeleira cai pelas costas). Sem a máscara, cabelo escuro curto. */
export function geometriaDaPeruca(mascara = true): THREE.BufferGeometry {
  const pele = PELES[1]!;
  const partes = corpo(pele);
  partes.push(marca(new Montador().esfera(0.115, 5, 0.01, 1.66, 0, pele).build(), 0, null));
  const cor = mascara ? hex(0.94, 0.8, 0.38) : hex(0.16, 0.12, 0.09);
  if (mascara) {
    const peruca = new Montador().esfera(0.135, 5, -0.02, 1.7, 0, cor, 1, 0.75, 1.05).caixa(0.07, 0.4, 0.26, -0.13, 1.5, 0, cor).build();
    partes.push(marca(peruca, 0, null));
  } else partes.push(marca(new Montador().esfera(0.12, 5, -0.015, 1.71, 0, cor, 1, 0.62, 1).build(), 0, null));
  return junta(partes);
}

/**
 * A BANDEIRA (P243, ordem do Comandante): o invasor genérico — o corpo e a cabeça comuns, erguendo um mastro com um pano liso (a cor da camisa daquela instância: nenhum símbolo, nenhuma
 * marca, nenhum time). Sem a máscara, as mãos ficam vazias.
 */
export function geometriaDaBandeira(mascara = true): THREE.BufferGeometry {
  const pele = PELES[2]!;
  const partes = corpo(pele);
  partes.push(marca(new Montador().esfera(0.115, 5, 0.01, 1.66, 0, pele).build(), 0, null));
  if (mascara) {
    const mastro = new Montador().barra(0.08, 1.3, 0.27, 0.18, 2.3, 0.2, 0.028, hex(0.55, 0.42, 0.28)).build();
    const pano = new Montador().caixa(0.34, 0.22, 0.015, 0.33, 2.18, 0.19, SEM_COR).build();
    partes.push(marca(mastro, 0, null), marca(pano, 1, null));
  }
  return junta(partes);
}

/**
 * O TIO SAM (P245/P246, modelo do Comandante): a cartola azul estrelada com a aba branca e a barba branca de cavanhaque — símbolo político de domínio público, não uma pessoa (já aceito no
 * P243). Sem a máscara, só a cabeça comum.
 */
export function geometriaDoTioSam(mascara = true): THREE.BufferGeometry {
  const pele = PELES[3]!;
  const partes = corpo(pele);
  partes.push(marca(new Montador().esfera(0.115, 5, 0.01, 1.66, 0, pele).build(), 0, null));
  if (mascara) {
    const azul = hex(0.1, 0.14, 0.4);
    const branco = hex(0.95, 0.95, 0.93);
    const cartola = new Montador()
      .cilindro(0.11, 0.11, 0.24, 8, 0.01, 1.93, 0, azul)
      .cilindro(0.16, 0.16, 0.025, 8, 0.01, 1.805, 0, azul)
      .cilindro(0.111, 0.111, 0.03, 8, 0.01, 1.845, 0, branco)
      .build();
    const barba = new Montador().caixa(0.1, 0.12, 0.09, 0.12, 1.575, 0, branco).build();
    partes.push(marca(cartola, 0, null), marca(barba, 0, null));
  }
  return junta(partes);
}

/** O PORCO (P246, modelo do Comandante; confirmado tipo genérico, sem pessoa real): o focinho e as orelhas rosadas. Sem a máscara, cabeça comum. */
export function geometriaDoPorco(mascara = true): THREE.BufferGeometry {
  const pele = PELES[0]!;
  const partes = corpo(pele);
  if (mascara) {
    const rosa = hex(0.93, 0.68, 0.7);
    const cabeca = new Montador().esfera(0.135, 5, 0.01, 1.68, 0, rosa, 1.1, 0.95, 1).build();
    const focinho = new Montador().cilindro(0.06, 0.065, 0.06, 8, 0.2, 1.65, 0, hex(0.97, 0.76, 0.78), 0, 0, Math.PI / 2).build();
    const orelhas = new Montador().caixa(0.1, 0.12, 0.02, 0.02, 1.82, -0.12, rosa, 0, 0, -0.3).caixa(0.1, 0.12, 0.02, 0.02, 1.82, 0.12, rosa, 0, 0, 0.3).build();
    partes.push(marca(cabeca, 0, null), marca(focinho, 0, null), marca(orelhas, 0, null));
  } else {
    partes.push(marca(new Montador().esfera(0.115, 5, 0.01, 1.66, 0, pele).build(), 0, null));
  }
  return junta(partes);
}

/** O PNEU (P246, modelo do Comandante; confirmado tipo genérico e fictício, sem pessoa real): a cabeça vira um pneu (o aro cinza visível). Sem a máscara, cabeça comum. */
export function geometriaDoPneu(mascara = true): THREE.BufferGeometry {
  const pele = PELES[0]!;
  const partes = corpo(pele);
  if (mascara) {
    const preto = hex(0.07, 0.07, 0.07);
    const cinza = hex(0.5, 0.5, 0.5);
    const cabeca = new Montador()
      .cilindro(0.16, 0.16, 0.16, 10, 0.01, 1.68, 0, preto, 0, 0, Math.PI / 2)
      .cilindro(0.07, 0.07, 0.17, 8, 0.01, 1.68, 0, cinza, 0, 0, Math.PI / 2)
      .build();
    partes.push(marca(cabeca, 0, null));
  } else {
    partes.push(marca(new Montador().esfera(0.115, 5, 0.01, 1.66, 0, pele).build(), 0, null));
  }
  return junta(partes);
}

/**
 * O BÁRBARO (P246): a ideia original (o traje do invasor do Capitólio americano, 7/1/2021) foi recusada por identificar uma pessoa real tão bem quanto o nome dela — o chifre de viking
 * isolado é clichê genérico, mas a combinação com a pintura facial da bandeira americana e as tatuagens não era. **Esta versão, a pedido do Comandante:** o gorro de couro e os chifres —
 * agora ROSA e bem maiores — ficam; a pintura facial, as cores da bandeira e as tatuagens saem; o corpo usa a mesma camisa verde e amarela aleatória de todo mundo. Sem pessoa real, sem
 * revisão jurídica pendente. Sem a máscara, cabeça comum.
 */
export function geometriaDoBarbaro(mascara = true): THREE.BufferGeometry {
  const pele = PELES[1]!;
  const partes = corpo(pele);
  partes.push(marca(new Montador().esfera(0.115, 5, 0.01, 1.66, 0, pele).build(), 0, null));
  if (mascara) {
    const rosa = hex(0.98, 0.42, 0.74);
    const couro = hex(0.4, 0.28, 0.18);
    const gorro = new Montador().esfera(0.135, 6, 0.01, 1.72, 0, couro, 1.05, 0.7, 1.05).build();
    const chifres = new Montador()
      .barra(0.03, 1.78, -0.12, -0.14, 2.18, -0.42, 0.06, rosa)
      .barra(0.03, 1.78, 0.12, -0.14, 2.18, 0.42, 0.06, rosa)
      .build();
    partes.push(marca(gorro, 0, null), marca(chifres, 0, null));
  }
  return junta(partes);
}

// ─── O shader ────────────────────────────────────────────────────────────────────

const DECLARA = /* glsl */ `
uniform float uTick;
attribute vec4 aA;      // origem x, origem z, destino x, destino z
attribute vec4 aB;      // nasce, velocidade, fase, período
attribute vec4 aC;      // comprimento, escala, direção x, direção z
attribute vec4 aFim;    // morreu em, fugiu em, saiu em, velocidade da fuga  (1e9 = nunca)
attribute vec4 aFuga;   // de onde fugiu x, z; para onde corre dx, dz
attribute vec3 aCores;  // camisa, calça e pelagem: cada uma um RGB de 8 bits por canal empacotado num float (24 bits cabem exatos)
attribute vec3 aVert;   // por vértice: parte (0 cor fixa, 1 camisa, 2 calça, 3 pelagem), peso do balanço, lado
// O limite é de 16 atributos por vértice (o InstancedMesh já gasta 4 na matriz): daí as cores empacotadas e os três números do vértice juntos.
vec3 desempacota(float c) {
  float r = floor((c + 0.5) / 65536.0);
  float resto = c - r * 65536.0;
  float g = floor((resto + 0.5) / 256.0);
  return vec3(r, g, resto - g * 256.0) / 255.0;
}
// O mesmo seno em parábolas por partes de sim/Multidao.ts.
float senoP(float u) { float f = u - floor(u); float h = f < 0.5 ? f * 2.0 : f * 2.0 - 1.0; float y = 4.0 * h * (1.0 - h); return f < 0.5 ? y : -y; }
// O tick em que a posição vale: quem morreu fica onde caiu.
float tickDoCorpo() { return min(uTick, aFim.x); }
bool correndo() { return tickDoCorpo() >= aFim.y; }
vec2 sentido() { return correndo() ? aFuga.zw : aC.zw; }
`;

const NORMAL = /* glsl */ `
{ vec2 d = sentido(); objectNormal.xz = vec2(objectNormal.x * d.x - objectNormal.z * d.y, objectNormal.x * d.y + objectNormal.z * d.x); }
`;

const COR = /* glsl */ `
vColor.rgb = aVert.x < 0.5 ? vColor.rgb : desempacota(aVert.x < 1.5 ? aCores.x : (aVert.x < 2.5 ? aCores.y : aCores.z));
`;

const POSICAO = /* glsl */ `
{
  float t = tickDoCorpo();
  float dt = t - aB.x;
  bool fora = dt < 0.0 || uTick - aFim.x > ${TICKS_DO_TOMBO.toFixed(1)} || uTick >= aFim.z;
  float px; float pz; float vel; vec2 d = sentido();
  if (correndo()) {
    float s = (t - aFim.y) / 60.0 * aFim.w;
    px = aFuga.x + d.x * s; pz = aFuga.y + d.y * s; vel = aFim.w;
  } else {
    float L = aC.x;
    float andou = min(dt / 60.0 * aB.y, L);
    float falta = L - andou;
    float amp = 0.18 * (falta >= 2.0 ? 1.0 : falta / 2.0);
    float lat = amp * senoP(aB.z + dt / aB.w);
    px = aA.x + d.x * andou - d.y * lat; pz = aA.y + d.y * andou + d.x * lat;
    vel = falta > 0.0 ? aB.y : 0.0;
  }
  // o passo (andando e correndo) ou o gingado de quem chegou e grita na fachada
  float ciclo = vel > 0.0 ? t / 60.0 * vel * 4.3 + aB.z * 31.0 : t / 60.0 * 7.0 + aB.z * 31.0;
  float agita = vel > 0.0 ? 1.0 : 1.6;
  float balanco = sin(ciclo) * aVert.z * aVert.y * agita;
  transformed.x += balanco * 0.3;
  transformed.y += abs(sin(ciclo)) * 0.03 + (vel > 0.0 ? 0.0 : abs(sin(ciclo * 0.5)) * 0.07);
  // o tombo: de frente, em meio segundo
  float queda = clamp((uTick - aFim.x) / 18.0, 0.0, 1.0);
  if (queda > 0.0) {
    float a = -queda * 1.5708;
    float c = cos(a); float sn = sin(a);
    transformed.xy = vec2(transformed.x * c - transformed.y * sn, transformed.x * sn + transformed.y * c);
    transformed.y += queda * 0.12;
  }
  transformed *= aC.y;
  transformed.xz = vec2(transformed.x * d.x - transformed.z * d.y, transformed.x * d.y + transformed.z * d.x);
  transformed += vec3(px, 0.0, pz);
  if (fora) transformed = vec3(0.0, -1000.0, 0.0);
}
`;

function materialDaMultidao(tick: { value: number }, chave: string): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTick = tick;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${DECLARA}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${NORMAL}`)
      .replace('#include <color_vertex>', `#include <color_vertex>\n${COR}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${POSICAO}`);
  };
  m.customProgramCacheKey = () => `cybermech-multidao-${chave}`;
  return m;
}

/** Os buffers por instância de uma malha e o trecho que mudou neste quadro (para o envio à GPU ser só dele). */
interface DadosDaMalha {
  aA: Float32Array;
  aB: Float32Array;
  aC: Float32Array;
  aFim: Float32Array;
  aFuga: Float32Array;
  aCores: Float32Array;
  atributos: THREE.InstancedBufferAttribute[];
  /** O menor e o maior slot escritos desde o último envio (`min > max`: nada). */
  min: number;
  max: number;
}

/**
 * A multidão desenhada: três malhas instanciadas ligadas à simulação. **O custo na GPU segue quem está PRESENTE, não quem já nasceu:** cada figurante ganha uma vaga de instância ao nascer e a
 * devolve ao cair (depois do tombo) ou ao sair pelo limite do mapa; a contagem desenhada é a marca d'água das vagas em uso (o máximo de gente ao mesmo tempo), e a vaga solta fica escondida
 * (`aB.x` = nunca) até outro nascer nela. Cada nascimento escreve 23 números numa vaga e só esse trecho do buffer vai à GPU.
 */
export class MultidaoDesenho {
  readonly grupo = new THREE.Group();
  private readonly tick = { value: 0 };
  private readonly malhaDe: Uint8Array;
  /** A vaga de cada figurante na malha dele (-1: não tem: ainda não nasceu, já saiu ou ficou fora do teto da qualidade). */
  private readonly slotDe: Int32Array;
  private readonly malhas: THREE.InstancedMesh[] = [];
  private readonly dados: DadosDaMalha[] = [];
  // Do tamanho de TIPOS, nunca um literal fixo: um tipo a mais com um array curto demais virou NaN silencioso da última vez (P243/P246).
  private readonly capacidade: number[] = new Array(TIPOS).fill(0);
  private readonly livres: Int32Array[] = [];
  private readonly nLivres: number[] = new Array(TIPOS).fill(0);
  private readonly marca: number[] = new Array(TIPOS).fill(0);
  private readonly emUso: number[] = new Array(TIPOS).fill(0);
  private proximo = 0;
  /** Quem vai soltar a vaga e quando (o corpo caído some `TICKS_DO_TOMBO` depois): poucos por vez, varrido a cada quadro. */
  private readonly filaId: Int32Array;
  private readonly filaTick: Float64Array;
  private nFila = 0;
  private fracao = 1;
  private readonly _c = new THREE.Color();

  constructor(
    private readonly multidao: Multidao,
    mascaras: MascarasDaMultidao = MASCARAS_LIGADAS,
  ) {
    const n = multidao.total;
    this.malhaDe = new Uint8Array(n);
    this.slotDe = new Int32Array(n).fill(-1);
    this.filaId = new Int32Array(n);
    this.filaTick = new Float64Array(n);
    for (let i = 0; i < n; i++) this.capacidade[multidao.tipo[i]!]!++;
    for (let i = 0; i < n; i++) this.malhaDe[i] = multidao.tipo[i]!;
    const geos = [
      geometriaDoGado(mascaras.gado),
      geometriaDoCareca(mascaras.careca),
      geometriaDaPeruca(mascaras.peruca),
      geometriaDaBandeira(mascaras.bandeira),
      geometriaDoTioSam(mascaras.tioSam),
      geometriaDoPorco(mascaras.porco),
      geometriaDoPneu(mascaras.pneu),
      geometriaDoBarbaro(mascaras.barbaro),
    ];
    const nomes = ['gado', 'careca', 'peruca', 'bandeira', 'tioSam', 'porco', 'pneu', 'barbaro'];
    for (let t = 0; t < TIPOS; t++) {
      const k = Math.max(1, this.capacidade[t]!);
      const d: DadosDaMalha = {
        aA: new Float32Array(k * 4),
        aB: new Float32Array(k * 4).fill(NUNCA), // toda vaga nasce escondida
        aC: new Float32Array(k * 4),
        aFim: new Float32Array(k * 4).fill(NUNCA),
        aFuga: new Float32Array(k * 4),
        aCores: new Float32Array(k * 3),
        atributos: [],
        min: 1,
        max: 0,
      };
      const geo = geos[t]!;
      for (const [nome, dados, tam] of [['aA', d.aA, 4], ['aB', d.aB, 4], ['aC', d.aC, 4], ['aFim', d.aFim, 4], ['aFuga', d.aFuga, 4], ['aCores', d.aCores, 3]] as const) {
        const a = new THREE.InstancedBufferAttribute(dados, tam);
        a.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute(nome, a);
        d.atributos.push(a);
      }
      const malha = new THREE.InstancedMesh(geo, materialDaMultidao(this.tick, nomes[t]!), k);
      malha.count = 0; // nenhuma vaga em uso ainda
      malha.frustumCulled = false; // a posição vem do shader: a caixa da geometria não vale
      malha.castShadow = false;
      malha.receiveShadow = false;
      this.grupo.add(malha);
      this.malhas.push(malha);
      this.dados.push(d);
      this.livres.push(new Int32Array(k));
    }
  }

  /** A vaga de `i` na malha dele (para o teste e a bancada); -1 se não tem. */
  vagaDe(i: number): number {
    return this.slotDe[i]!;
  }

  /** Quantos figurantes ocupam vaga agora (por tipo). */
  get presentes(): number {
    return this.emUso.reduce((a, b) => a + b, 0);
  }

  private marcar(t: number, slot: number): void {
    const d = this.dados[t]!;
    if (slot < d.min) d.min = slot;
    if (slot > d.max) d.max = slot;
  }

  /** Dá uma vaga a `i` (no nascimento) e escreve nela o que não muda: a origem, o destino, o andar, a escala e as cores. `false` se não há vaga (o teto da qualidade). */
  private nascer(i: number, tick: number): void {
    const m = this.multidao;
    if (m.foraDaPraca(i, tick)) return; // quem entra no meio da fase não desenha os que já foram embora
    const t = this.malhaDe[i]!;
    const teto = Math.ceil(this.capacidade[t]! * this.fracao);
    if (this.emUso[t]! >= teto) return;
    const slot = this.nLivres[t]! > 0 ? this.livres[t]![--this.nLivres[t]!]! : this.marca[t]!++;
    this.slotDe[i] = slot;
    this.emUso[t]!++;
    const d = this.dados[t]!;
    d.aA.set([m.origemX[i]!, m.origemZ[i]!, m.destinoX[i]!, m.destinoZ[i]!], slot * 4);
    d.aB.set([m.nasce[i]!, m.velocidade[i]!, m.fase[i]!, m.periodo[i]!], slot * 4);
    const escala =
      t === CARECA ? 0.94
      : t === PERUCA ? 1.02
      : t === PORCO ? 1.08
      : t === PNEU ? 0.92
      : 0.96 + (((i * 2654435761) >>> 0) % 1000) / 1000 * 0.1;
    d.aC.set([m.comprimento[i]!, escala, m.dirX[i]!, m.dirZ[i]!], slot * 4);
    // a cor sai do id (determinística, igual em todo cliente): a mistura de verdes e amarelos, as calças e as pelagens
    const h = (i * 2654435761) >>> 0;
    const c = this._c;
    d.aCores.set([empacota(c.set(CAMISAS[h % CAMISAS.length]!)), empacota(c.set(CALCAS[(h >>> 7) % CALCAS.length]!)), empacota(c.set(PELOS_DO_GADO[(h >>> 13) % PELOS_DO_GADO.length]!))], slot * 3);
    m.copiarEstado(i, d.aFim, d.aFuga, slot * 4);
    this.marcar(t, slot);
    this.malhas[t]!.count = this.marca[t]!;
  }

  /** Devolve a vaga de `i`: a instância fica escondida até outro nascer nela. */
  private soltar(i: number): void {
    const slot = this.slotDe[i]!;
    if (slot < 0) return;
    const t = this.malhaDe[i]!;
    this.slotDe[i] = -1;
    this.emUso[t]!--;
    this.dados[t]!.aB[slot * 4] = NUNCA;
    this.livres[t]![this.nLivres[t]!++] = slot;
    this.marcar(t, slot);
  }

  /** A simulação avisou que algo mudou em `i` (fugiu ou morreu): copia o estado dele para a vaga. */
  aoMudar(i: number): void {
    const slot = this.slotDe[i]!;
    if (slot < 0) return;
    const t = this.malhaDe[i]!;
    const d = this.dados[t]!;
    this.multidao.copiarEstado(i, d.aFim, d.aFuga, slot * 4);
    this.marcar(t, slot);
  }

  /** A simulação avisou que `i` morreu: o corpo fica caído `TICKS_DO_TOMBO` e então a vaga é devolvida. */
  aoMorrer(i: number): void {
    this.aoMudar(i);
    if (this.slotDe[i]! < 0) return;
    this.filaId[this.nFila] = i;
    this.filaTick[this.nFila++] = Math.max(0, this.multidao.morreuNoTick(i)) + TICKS_DO_TOMBO;
  }

  /** A simulação avisou que `i` saiu pelo limite do mapa: a vaga volta já. */
  aoSair(i: number): void {
    this.soltar(i);
  }

  /** A missão recomeçou (a multidão voltou ao zero): todas as vagas se soltam e ficam escondidas, e os nascimentos recomeçam do primeiro. */
  recomecar(): void {
    this.slotDe.fill(-1);
    this.proximo = 0;
    this.nFila = 0;
    for (let t = 0; t < this.dados.length; t++) {
      const d = this.dados[t]!;
      d.aB.fill(NUNCA);
      d.aFim.fill(NUNCA);
      this.emUso[t] = 0;
      this.nLivres[t] = 0;
      this.marca[t] = 0;
      this.malhas[t]!.count = 0;
      d.min = 0;
      d.max = Math.max(0, this.capacidade[t]! - 1);
    }
    this.enviar();
  }

  /** O que mudou neste quadro vai à GPU: só o trecho de vagas escrito, em cada buffer. */
  private enviar(): void {
    for (const d of this.dados) {
      if (d.min > d.max) continue;
      for (const a of d.atributos) {
        a.addUpdateRange(d.min * a.itemSize, (d.max - d.min + 1) * a.itemSize);
        a.needsUpdate = true;
      }
      d.min = 1;
      d.max = 0;
    }
  }

  /**
   * Uma vez por quadro: o tick (com a fração entre dois ticks, para andar liso a mais de 60 quadros por segundo), os nascimentos que o tempo trouxe (cada um ganha uma vaga), os corpos caídos
   * que já podem sair e o envio do que mudou.
   */
  atualizar(tick: number): void {
    this.tick.value = tick;
    const m = this.multidao;
    while (this.proximo < m.total && m.nasce[this.proximo]! <= tick) this.nascer(this.proximo++, tick);
    for (let k = 0; k < this.nFila; ) {
      if (this.filaTick[k]! <= tick) {
        this.soltar(this.filaId[k]!);
        this.nFila--;
        this.filaId[k] = this.filaId[this.nFila]!;
        this.filaTick[k] = this.filaTick[this.nFila]!;
      } else k++;
    }
    this.enviar();
  }

  /** O teto da qualidade (G12): no máximo a `fracao` de cada tipo ocupa vaga ao mesmo tempo (os que nascem com tudo cheio não aparecem). A simulação não muda. */
  limitar(fracao: number): void {
    this.fracao = Math.max(0, Math.min(1, fracao));
  }

  /** Quantos desenhos e triângulos a multidão custa **agora** (a marca d'água das vagas: o máximo de gente ao mesmo tempo; para a bancada e os testes). */
  get custo(): { desenhos: number; triangulos: number } {
    let triangulos = 0;
    this.malhas.forEach((malha) => {
      triangulos += (malha.geometry.attributes.position!.count / 3) * malha.count;
    });
    return { desenhos: this.malhas.length, triangulos };
  }

  dispose(): void {
    for (const malha of this.malhas) {
      malha.geometry.dispose();
      (malha.material as THREE.Material).dispose();
      malha.dispose();
    }
  }
}
