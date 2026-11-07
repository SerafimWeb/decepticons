import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O CONTRATO DE PEÇA (a Prova Blender, P329; `MODELADOR.md` § 12): o que uma peça feita no Blender tem de ter para entrar no rig do jogo. Lê o `.glb` direto (o cabeçalho JSON e o binário), sem
 * Three.js e sem navegador. As peças moram em `.decepticons/pecas/` e `npm run mech:pecas` as regera; se o formato mudar, este teste e o `MODELADOR.md` mudam primeiro.
 *
 * O contrato: (1) só quatro materiais, com os nomes do jogo (`armor`, `frame`, `paint`, `visor`): o jogo põe a cor, o metal e a rugosidade dele; (2) normais e a cor do vértice em CINZA
 * (1 = sem sombra), que é a oclusão de ambiente e o desgaste gravados no Blender; (3) a origem é a junta onde a peça se encaixa, Y para cima e a FRENTE em -Z, em metros; (4) um teto de triângulos.
 */
interface Acessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
  normalized?: boolean;
}
interface Primitiva {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
}
interface Glb {
  json: { accessors: Acessor[]; bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[]; meshes: { primitives: Primitiva[] }[]; materials: { name: string }[] };
  bin: Buffer;
}

function lerGlb(arquivo: string): Glb {
  const b = readFileSync(resolve('.decepticons', 'pecas', arquivo));
  expect(b.toString('ascii', 0, 4), `${arquivo}: cabeçalho glTF`).toBe('glTF');
  const tamJson = b.readUInt32LE(12);
  expect(b.toString('ascii', 16, 20)).toBe('JSON');
  const json = JSON.parse(b.toString('utf8', 20, 20 + tamJson)) as Glb['json'];
  const iBin = 20 + tamJson;
  expect(b.toString('ascii', iBin + 4, iBin + 8)).toBe('BIN\0');
  const tamBin = b.readUInt32LE(iBin);
  return { json, bin: b.subarray(iBin + 8, iBin + 8 + tamBin) };
}

const primitivas = (g: Glb): { material: string; p: Primitiva }[] => g.json.meshes.flatMap((m) => m.primitives.map((p) => ({ material: g.json.materials[p.material ?? 0]?.name ?? '?', p })));
const triangulos = (g: Glb, p: Primitiva): number => (p.indices !== undefined ? g.json.accessors[p.indices]!.count : g.json.accessors[p.attributes.POSITION!]!.count) / 3;
const total = (g: Glb): number => primitivas(g).reduce((s, { p }) => s + triangulos(g, p), 0);
const caixa = (g: Glb, material?: string): { min: number[]; max: number[] } => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const { material: nome, p } of primitivas(g)) {
    if (material && nome !== material) continue;
    const a = g.json.accessors[p.attributes.POSITION!]!;
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, a.min![i]!);
      max[i] = Math.max(max[i]!, a.max![i]!);
    }
  }
  return { min, max };
};

/** Os valores da cor do vértice (0 a 1) de uma primitiva: float, ou inteiro normalizado. */
function cores(g: Glb, p: Primitiva): number[][] {
  const a = g.json.accessors[p.attributes.COLOR_0!]!;
  const vista = g.json.bufferViews[a.bufferView]!;
  const comps = a.type === 'VEC4' ? 4 : 3;
  const tam = a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 1;
  const passo = vista.byteStride ?? comps * tam;
  const base = (vista.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const lido = (o: number): number => (a.componentType === 5126 ? g.bin.readFloatLE(o) : a.componentType === 5123 ? g.bin.readUInt16LE(o) / 65535 : g.bin[o]! / 255);
  const out: number[][] = [];
  for (let i = 0; i < a.count; i++) out.push([0, 1, 2].map((c) => lido(base + i * passo + c * tam)));
  return out;
}

const NOMES_DO_JOGO = ['armor', 'frame', 'paint', 'visor'];
const PECAS: readonly { arquivo: string; tetoDeTriangulos: number }[] = [
  { arquivo: 'gaviao-peito.glb', tetoDeTriangulos: 3000 },
  { arquivo: 'gaviao-capacete.glb', tetoDeTriangulos: 1800 },
  { arquivo: 'gaviao-ombreira.glb', tetoDeTriangulos: 1500 },
];

describe.each(PECAS)('a peça do Blender $arquivo cumpre o contrato de peça', ({ arquivo, tetoDeTriangulos }) => {
  const g = lerGlb(arquivo);

  it('só tem materiais com os nomes do jogo (armor, frame, paint, visor), um por primitiva', () => {
    const nomes = primitivas(g).map((x) => x.material);
    for (const n of nomes) expect(NOMES_DO_JOGO, `${arquivo}: material ${n}`).toContain(n);
    expect(new Set(nomes).size, 'um material por primitiva (um draw call por material)').toBe(nomes.length);
  });

  it('traz normais e a cor do vértice em cinza, com sombra de ambiente de verdade (nada preto, nada sem sombra nenhuma)', () => {
    let menor = 1;
    let maior = 0;
    for (const { p } of primitivas(g)) {
      expect(p.attributes.NORMAL, `${arquivo}: NORMAL`).toBeDefined();
      expect(p.attributes.COLOR_0, `${arquivo}: COLOR_0`).toBeDefined();
      for (const [r, gr, b] of cores(g, p)) {
        expect(Math.abs(r! - gr!) + Math.abs(gr! - b!), 'cinza: R = G = B').toBeLessThan(1e-3);
        menor = Math.min(menor, r!);
        maior = Math.max(maior, r!);
      }
    }
    expect(menor, `${arquivo}: há sombra (o vértice mais escuro)`).toBeLessThan(0.85);
    expect(menor, `${arquivo}: a sombra não passa de ~metade (nada preto)`).toBeGreaterThan(0.45);
    expect(maior, `${arquivo}: os vértices expostos ficam em 1`).toBeGreaterThan(0.97);
    expect(maior).toBeLessThanOrEqual(1.0001);
  });

  it(`fica no orçamento de ${tetoDeTriangulos} triângulos`, () => {
    expect(total(g)).toBeLessThanOrEqual(tetoDeTriangulos);
    expect(total(g)).toBeGreaterThan(300);
  });
});

describe('a orientação e a origem de cada peça (a origem é a junta; Y para cima; a frente em -Z)', () => {
  it('o peito (origem no pivô do tronco): do diafragma ao pescoço, com os peitorais na frente (-Z) e as costas atrás', () => {
    const c = caixa(lerGlb('gaviao-peito.glb'));
    expect(c.min[1]).toBeGreaterThan(0.4); // o diafragma começa acima do cinto (0,3)
    expect(c.max[1]).toBeLessThan(1.7); // o pescoço, abaixo do pivô da cabeça (1,75)
    expect(c.max[0]).toBeLessThan(0.7);
    expect(c.min[0]).toBeGreaterThan(-0.7);
    expect(c.min[2], 'a frente (os peitorais) passa de 0,45 em -Z').toBeLessThan(-0.45);
    expect(c.max[2], 'as costas ficam atrás, mas a frente é mais funda').toBeLessThan(-c.min[2]);
  });

  it('o capacete (origem no pivô da cabeça): o visor fica na frente (todo em -Z) e a base do crânio, 0,25 abaixo da origem', () => {
    const g = lerGlb('gaviao-capacete.glb');
    const visor = caixa(g, 'visor');
    expect(visor.max[2], 'o visor está todo em -Z').toBeLessThan(-0.3);
    const c = caixa(g);
    expect(c.min[1]).toBeGreaterThan(-0.35);
    expect(c.min[1]).toBeLessThan(-0.2);
    expect(c.max[1]).toBeLessThan(0.45);
    expect(Math.max(c.max[0], -c.min[0])).toBeLessThan(0.45);
  });

  it('a ombreira (origem na junta do ombro, a DIREITA: para fora é +X); a esquerda é a mesma peça espelhada em x no jogo', () => {
    const g = lerGlb('gaviao-ombreira.glb');
    const c = caixa(g);
    expect(c.max[0], 'a peça se estende para fora (+X)').toBeGreaterThan(0.4);
    expect(c.min[0], 'e quase nada para dentro').toBeGreaterThan(-0.3);
    expect(caixa(g, 'paint').max[2], 'os riscos de perigo ficam na frente (-Z)').toBeLessThan(-0.35);
  });
});
