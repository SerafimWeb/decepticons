import { describe, expect, it } from 'vitest';
import { PRAIA_ESTACAO, PRAIA_COMPLEXO, praiaBlocks } from './PraiaLayout';
import {
  cantos,
  casco,
  COMPRIMENTO_DA_SOMBRA,
  DIRECAO_DA_SOMBRA,
  dadosDeSombra,
  oclusoresDaPraia,
  SOMBRA_ALTURA,
  SOMBRA_LARGURA,
  sombraDoPrisma,
  sombraEm,
  texturaDeSombras,
} from './PraiaSombras';
import { PRAIA_LIMITES } from './PraiaTerreno';

describe('as sombras assadas da praia (P127, rodada de luz)', () => {
  it('a sombra cai para dentro da cidade (oposta ao sol, que está sobre o mar): +z, e um pouco para leste', () => {
    const [dx, dz] = DIRECAO_DA_SOMBRA;
    expect(Math.hypot(dx, dz)).toBeCloseTo(1, 6);
    expect(dz).toBeGreaterThan(0.6); // para o lado da cidade
    expect(dx).toBeGreaterThan(0); // o sol está a oeste: a sombra vai para leste
  });

  it('o casco convexo e a sombra do prisma: um bloco de 10 × 10 m e 20 m de altura joga a sombra ~44 m adiante, e a base fica dentro dela', () => {
    const c = casco([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5]]);
    expect(c).toHaveLength(4); // o ponto do meio sai
    const base = cantos(0, 0, 10, 10, 0);
    const p = sombraDoPrisma(base, 0, 20, 1);
    const [dx, dz] = DIRECAO_DA_SOMBRA;
    const fim = COMPRIMENTO_DA_SOMBRA * 20;
    // O ponto mais longe da sombra está a ~44 m da base, na direção da sombra.
    const longe = Math.max(...p.pontos.map(([x, z]) => x * dx + z * dz));
    expect(longe).toBeGreaterThan(fim - 1);
    expect(longe).toBeLessThan(fim + 8); // a pegada soma o meio-lado
  });

  it('a textura tem o tamanho do mapa (0,5 m por texel) e duas camadas bem formadas', () => {
    const d = dadosDeSombra();
    expect(d.largura).toBe(SOMBRA_LARGURA);
    expect(d.altura).toBe(SOMBRA_ALTURA);
    expect(SOMBRA_LARGURA).toBe(1280);
    expect(SOMBRA_ALTURA).toBe(480);
    expect(d.dados.length).toBe(SOMBRA_LARGURA * SOMBRA_ALTURA * 2);
    const t = texturaDeSombras();
    expect(t.image.width).toBe(SOMBRA_LARGURA);
    expect(texturaDeSombras()).toBe(t); // memorizada: o mapa é estático
  });

  it('atrás de um hotel da frente da cidade há sombra forte; na frente dele (o lado do mar), luz cheia', () => {
    const hoteis = praiaBlocks()
      .filter((b) => b.kind === 'predio' && b.h >= 28 && b.z < 60)
      .sort((a, b) => b.h - a.h);
    const h = hoteis[0]!;
    // Logo atrás da fachada de trás (z + d/2), na direção da sombra: dentro da sombra do prédio mais alto.
    const [dx, dz] = DIRECAO_DA_SOMBRA;
    const atras = sombraEm(h.x + dx * 12, h.z + h.d / 2 + dz * 12);
    expect(atras.sol, 'sombra do hotel').toBeGreaterThan(0.5);
    // Do lado do mar o hotel não joga sombra nenhuma: a areia na frente dele (a ~60 m) está ao sol, bem mais clara que o fundo.
    let soma = 0;
    for (let k = -10; k <= 10; k++) soma += sombraEm(h.x + k, -20).sol;
    expect(soma / 21, 'a areia na frente está mais clara').toBeLessThan(0.35); // (guarda-sóis e coqueiros riscam a areia)
    expect(atras.sol).toBeGreaterThan(soma / 21 + 0.3);
    // E a faixa de areia do meio da praia está quase toda ao sol (só as sombrinhas pequenas dos guarda-sóis e das jangadas riscam).
    let escuros = 0;
    let amostras = 0;
    for (let x = -200; x <= 200; x += 4) {
      amostras++;
      if (sombraEm(x, -28).sol > 0.5) escuros++;
    }
    expect(escuros / amostras, 'a areia está ao sol').toBeLessThan(0.12);
  });

  it('o coqueiro sombreia o calçadão e a avenida; o guarda-sol, a areia (sombras pequenas, em fileira)', () => {
    const { sombras } = oclusoresDaPraia();
    expect(sombras.length).toBeGreaterThan(400); // muitos polígonos: prédios, palmas, guarda-sóis, postes
    // Há sombra de palmeira no calçadão (z ~ 5..17) e na avenida (z ~ 17..37) em algum ponto de cada.
    let calcada = 0;
    let avenida = 0;
    for (let x = -200; x < 200; x += 1) {
      if (sombraEm(x, 8).sol > 0.3) calcada++;
      if (sombraEm(x, 24).sol > 0.3) avenida++;
    }
    expect(calcada, 'o calçadão listrado de sombra').toBeGreaterThan(20);
    expect(avenida, 'a avenida listrada de sombra').toBeGreaterThan(20);
  });

  it('a sombra não toma o mapa: o mar e a praia ficam ao sol, e só o lado da cidade, atrás dos prédios, fica na sombra (menos da metade do mapa)', () => {
    const d = dadosDeSombra();
    let escuro = 0;
    for (let i = 0; i < d.dados.length; i += 2) if (d.dados[i]! > 128) escuro++;
    const fracao = escuro / (d.largura * d.altura);
    expect(fracao).toBeGreaterThan(0.04);
    expect(fracao).toBeLessThan(0.5);
    // O mar e a praia (z < 0) quase não têm sombra forte: só a dos coqueiros, das barracas e do píer.
    let nasAreias = 0;
    let total = 0;
    for (let z = PRAIA_LIMITES.minZ; z < 0; z += 2) {
      for (let x = PRAIA_LIMITES.minX + 100; x < PRAIA_LIMITES.maxX - 100; x += 2) {
        total++;
        if (sombraEm(x, z).sol > 0.5) nasAreias++;
      }
    }
    expect(nasAreias / total).toBeLessThan(0.15); // só coqueiros, barracas, guarda-sóis e o píer
  });

  it('a oclusão de ambiente escurece o pé das construções e some a poucos metros delas', () => {
    // O pé do muro do complexo, do lado de fora (z = minZ - 1): oclusão; 8 m para lá, nenhuma.
    const perto = sombraEm(PRAIA_COMPLEXO.minX + 5, PRAIA_COMPLEXO.minZ - 1.2);
    const longe = sombraEm(PRAIA_COMPLEXO.minX + 5, PRAIA_COMPLEXO.minZ - 9);
    expect(perto.ao).toBeGreaterThan(0.15);
    expect(longe.ao).toBeLessThan(perto.ao);
    expect(longe.ao).toBeLessThan(0.05);
  });

  it('fora do mapa não há sombra, e dentro do pátio da estação o prédio central deixa a dele', () => {
    expect(sombraEm(PRAIA_LIMITES.maxX + 50, 0)).toEqual({ sol: 0, ao: 0 });
    expect(sombraEm(0, PRAIA_LIMITES.minZ - 50)).toEqual({ sol: 0, ao: 0 });
    const [dx, dz] = DIRECAO_DA_SOMBRA;
    // 10 m atrás da fachada de trás do prédio central (z = 64 + 14), na direção da sombra: dentro dela.
    const s = sombraEm(PRAIA_ESTACAO.x + dx * 10, PRAIA_ESTACAO.z + 14 + dz * 10);
    expect(s.sol).toBeGreaterThan(0.3);
  });
});
