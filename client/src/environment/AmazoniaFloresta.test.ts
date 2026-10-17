import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  AMAZONIA_ALDEIA,
  AMAZONIA_LIMITES,
  AMAZONIA_MINA,
  AMAZONIA_NASCIMENTO_JOGADOR,
  AMAZONIA_PLANTA,
  AMAZONIA_REJEITOS,
  estaNoRio,
  larguraDoRio,
  NIVEL_DA_AGUA,
  rioEmX,
} from './AmazoniaLayout';
import { ALCANCE_DA_ARVORE, ALCANCE_DA_FLORESTA, arvoresDaAmazonia, densidadeDaFloresta, Floresta, geometriaDaArvore, geometriaDoCartao, pedacoDe } from './AmazoniaFloresta';
import { PEDACOS_X, PEDACOS_Z } from './AmazoniaMalha';
import { criarUniformes, materialDaFloresta } from './AmazoniaMateriais';
import { alturaDoTerreno } from './AmazoniaTerreno';

const triangulos = (g: THREE.BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

describe('as árvores da Amazônia (P180, parte B): onde a floresta pode e não pode estar', () => {
  const arvores = arvoresDaAmazonia();

  it('são determinísticas (a mesma lista a cada chamada) e numerosas: milhares de árvores, mas dentro do orçamento', () => {
    expect(arvoresDaAmazonia()).toBe(arvores);
    expect(arvores.length).toBeGreaterThan(5000);
    expect(arvores.length).toBeLessThan(14000);
  });

  it('nenhuma árvore está na água, na beira lamacenta, nem num baixio alagado', () => {
    for (const a of arvores) {
      expect(estaNoRio(a.x, a.z), `árvore em ${a.x.toFixed(0)},${a.z.toFixed(0)} no rio`).toBe(false);
      expect(Math.abs(a.z - rioEmX(a.x)), 'beira').toBeGreaterThan(larguraDoRio(a.x) / 2 + 8);
      expect(alturaDoTerreno(a.x, a.z)).toBeGreaterThan(NIVEL_DA_AGUA + 0.5);
    }
  });

  it('nenhuma árvore na aldeia, no pátio da planta, na cava, na lagoa de rejeitos, nem em cima do nascimento do jogador', () => {
    const al = AMAZONIA_ALDEIA;
    const pl = AMAZONIA_PLANTA;
    const mi = AMAZONIA_MINA;
    const rj = AMAZONIA_REJEITOS;
    const nj = AMAZONIA_NASCIMENTO_JOGADOR;
    for (const a of arvores) {
      expect(Math.hypot(a.x - al.x, a.z - al.z), 'aldeia').toBeGreaterThan(al.raio);
      expect(Math.abs(a.x - pl.x) < pl.comprimento / 2 && Math.abs(a.z - pl.z) < pl.largura / 2, 'planta').toBe(false);
      expect(Math.hypot(a.x - mi.x, a.z - mi.z), 'cava').toBeGreaterThan(mi.raio * 1.2);
      expect(Math.hypot((a.x - rj.x) / rj.rx, (a.z - rj.z) / rj.rz), 'lagoa').toBeGreaterThan(1.5);
      expect(Math.hypot(a.x - nj.x, a.z - nj.z), 'nascimento').toBeGreaterThan(28);
    }
  });

  it('todas ficam dentro do mapa e nenhuma em encosta íngreme (a copa não gruda na parede da cava)', () => {
    for (const a of arvores) {
      expect(a.x).toBeGreaterThan(AMAZONIA_LIMITES.minX);
      expect(a.x).toBeLessThan(AMAZONIA_LIMITES.maxX);
      expect(a.z).toBeGreaterThan(AMAZONIA_LIMITES.minZ);
      expect(a.z).toBeLessThan(AMAZONIA_LIMITES.maxZ);
      const dhdx = (alturaDoTerreno(a.x + 6, a.z) - alturaDoTerreno(a.x - 6, a.z)) / 12;
      const dhdz = (alturaDoTerreno(a.x, a.z + 6) - alturaDoTerreno(a.x, a.z - 6)) / 12;
      expect(Math.hypot(dhdx, dhdz)).toBeLessThan(0.51);
      expect(a.escala).toBeGreaterThan(0.7);
      expect(a.escala).toBeLessThan(1.65);
      expect(a.tom).toBeGreaterThan(0.84);
      expect(a.tom).toBeLessThan(1.16);
    }
  });

  it('o desmatamento: a floresta rareia em volta da mina e da planta (a história da fase), e é mais cheia longe delas', () => {
    const m = AMAZONIA_MINA;
    const contar = (r0: number, r1: number): number => arvores.filter((a) => {
      const d = Math.hypot(a.x - m.x, a.z - m.z);
      return d >= r0 && d < r1;
    }).length;
    const area = (r0: number, r1: number): number => Math.PI * (r1 * r1 - r0 * r0);
    // a densidade (árvores por hectare) no anel logo depois da cava é bem menor que a do anel mais distante
    const perto = contar(m.raio * 1.25, m.raio * 1.6) / area(m.raio * 1.25, m.raio * 1.6);
    const longe = contar(m.raio * 2.6, m.raio * 3.4) / area(m.raio * 2.6, m.raio * 3.4);
    expect(longe).toBeGreaterThan(0);
    expect(perto).toBeLessThan(longe * 0.6);
  });

  it('a floresta rareia também junto da planta (a faixa de 28 a 118 m do pátio) e fecha a densidade cheia de 118 m em diante', () => {
    const p = AMAZONIA_PLANTA;
    const oeste = (m: number): number => densidadeDaFloresta(p.x - p.comprimento / 2 - m, p.z);
    expect(oeste(10), 'dentro da faixa de segurança').toBe(0);
    expect(oeste(40)).toBeLessThan(0.12);
    expect(oeste(40)).toBeGreaterThan(0.05);
    expect(oeste(130)).toBeGreaterThan(0.8);
    expect(oeste(130)).toBeLessThanOrEqual(0.82 + 1e-9);
  });

  it('a densidade é 0 onde a floresta não pode estar e cai a zero na encosta mais íngreme (e nunca passa de 1)', () => {
    expect(densidadeDaFloresta(AMAZONIA_ALDEIA.x, AMAZONIA_ALDEIA.z)).toBe(0);
    expect(densidadeDaFloresta(AMAZONIA_PLANTA.x, AMAZONIA_PLANTA.z)).toBe(0);
    expect(densidadeDaFloresta(AMAZONIA_MINA.x, AMAZONIA_MINA.z)).toBe(0);
    expect(densidadeDaFloresta(100, rioEmX(100))).toBe(0);
    for (let x = -1100; x <= 1100; x += 111) for (let z = -400; z <= 400; z += 97) {
      const d = densidadeDaFloresta(x, z);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it('o pedaço de 300 m de uma árvore é o que a contém (e nunca fora da grade, mesmo na borda)', () => {
    expect(pedacoDe(AMAZONIA_LIMITES.minX + 1, AMAZONIA_LIMITES.minZ + 1)).toEqual({ ix: 0, iz: 0 });
    expect(pedacoDe(AMAZONIA_LIMITES.maxX - 1, AMAZONIA_LIMITES.maxZ - 1)).toEqual({ ix: PEDACOS_X - 1, iz: PEDACOS_Z - 1 });
    expect(pedacoDe(AMAZONIA_LIMITES.maxX + 500, 0).ix).toBe(PEDACOS_X - 1);
    expect(pedacoDe(0, AMAZONIA_LIMITES.minZ - 500).iz).toBe(0);
    expect(pedacoDe(0, 0)).toEqual({ ix: 4, iz: 1 });
  });
});

describe('a árvore de perto e a de longe (P180, parte B): o custo por árvore', () => {
  it('a de perto tem ~50 triângulos e a de longe 10: a diferença é o que paga a floresta inteira', () => {
    const perto = triangulos(geometriaDaArvore());
    const longe = triangulos(geometriaDoCartao());
    expect(perto).toBeGreaterThan(40);
    expect(perto).toBeLessThan(70);
    expect(longe).toBeLessThanOrEqual(12);
    expect(perto).toBeGreaterThan(longe * 4);
  });

  it('as duas têm cor por vértice e a vida de cada parte (a copa seca com a frente; o tronco quase não), e a mesma altura', () => {
    for (const g of [geometriaDaArvore(), geometriaDoCartao()]) {
      expect(g.getAttribute('color')).toBeDefined();
      const vida = g.getAttribute('aVida');
      let vegetacao = 0;
      let tronco = 0;
      for (let i = 0; i < vida.count; i++) {
        if (vida.getX(i) === 1) vegetacao++;
        else tronco++;
      }
      expect(vegetacao, 'copa').toBeGreaterThan(0);
      expect(tronco, 'tronco').toBeGreaterThan(0);
    }
    const alturaDe = (g: THREE.BufferGeometry): number => {
      g.computeBoundingBox();
      return g.boundingBox!.max.y;
    };
    expect(alturaDe(geometriaDaArvore())).toBeGreaterThan(16);
    expect(alturaDe(geometriaDaArvore())).toBeLessThan(21);
    expect(Math.abs(alturaDe(geometriaDoCartao()) - alturaDe(geometriaDaArvore()))).toBeLessThan(3);
  });
});

describe('a malha da floresta (P180, parte B): um desenho por pedaço e nível, o detalhe pela distância', () => {
  const f = new Floresta(new THREE.Scene(), materialDaFloresta(criarUniformes()));

  it('cada pedaço com árvore tem duas malhas instanciadas (perto e longe) com todas as árvores dele, e as duas nascem escondidas', () => {
    expect(f.pedacos.length).toBeGreaterThan(15);
    let total = 0;
    for (const p of f.pedacos) {
      expect(p.perto.count).toBe(p.arvores);
      expect(p.longe.count).toBe(p.arvores);
      expect(p.perto.visible).toBe(false);
      expect(p.longe.visible).toBe(false);
      total += p.arvores;
    }
    expect(total).toBe(arvoresDaAmazonia().length);
  });

  it('observar escolhe, por pedaço, a árvore de perto, o detalhe de longe ou nada, e nunca os dois ao mesmo tempo', () => {
    for (const [x, z] of [[-1000, -200], [0, 0], [700, 100], [1150, 400], [-500, 300]] as const) {
      f.observar(x, z);
      for (const p of f.pedacos) {
        const d = Math.hypot(p.centroX - x, p.centroZ - z);
        expect(p.perto.visible, `perto ${p.ix},${p.iz} a ${d.toFixed(0)} m`).toBe(d < ALCANCE_DA_ARVORE);
        expect(p.longe.visible).toBe(d >= ALCANCE_DA_ARVORE && d < ALCANCE_DA_FLORESTA);
        expect(p.perto.visible && p.longe.visible).toBe(false);
      }
    }
  });

  it('no pior lugar (uma emenda de pedaços) no máximo 9 pedaços usam a árvore de perto, e o total de desenhos de árvore fica no teto', () => {
    let maiorPerto = 0;
    let maiorDesenhos = 0;
    for (let x = -1100; x <= 1100; x += 150) for (let z = -400; z <= 400; z += 100) {
      f.observar(x, z);
      const perto = f.pedacos.filter((p) => p.perto.visible).length;
      const longe = f.pedacos.filter((p) => p.longe.visible).length;
      maiorPerto = Math.max(maiorPerto, perto);
      maiorDesenhos = Math.max(maiorDesenhos, perto + longe);
    }
    expect(maiorPerto).toBeLessThanOrEqual(9);
    expect(maiorDesenhos).toBeLessThanOrEqual(24);
  });

  it('as instâncias assentam no chão (a base da árvore enterra 0,4 m no relevo) e no x e z certos, na ordem da lista', () => {
    const m = new THREE.Matrix4();
    const porPedaco = new Map<string, ReturnType<typeof arvoresDaAmazonia>[number][]>();
    for (const a of arvoresDaAmazonia()) {
      const { ix, iz } = pedacoDe(a.x, a.z);
      const k = `${ix},${iz}`;
      if (!porPedaco.has(k)) porPedaco.set(k, []);
      porPedaco.get(k)!.push(a);
    }
    for (const p of f.pedacos) {
      const lista = porPedaco.get(`${p.ix},${p.iz}`)!;
      for (const i of [0, Math.floor(lista.length / 2), lista.length - 1]) {
        const a = lista[i]!;
        for (const malha of [p.perto, p.longe]) {
          malha.getMatrixAt(i, m);
          expect(m.elements[12]).toBeCloseTo(a.x, 3);
          expect(m.elements[14]).toBeCloseTo(a.z, 3);
          expect(m.elements[13]).toBeCloseTo(alturaDoTerreno(a.x, a.z) - 0.4, 3);
        }
      }
    }
  });

  it('a esfera de culling é a do pedaço (a câmera descarta a malha inteira fora da vista) e as instâncias não se mexem', () => {
    for (const p of f.pedacos) {
      expect(p.perto.frustumCulled).toBe(true);
      expect(p.perto.boundingSphere!.center.x).toBeCloseTo(p.centroX, 6);
      expect(p.perto.boundingSphere!.radius).toBeGreaterThan(200);
      expect(p.perto.matrixAutoUpdate).toBe(false);
    }
  });
});
