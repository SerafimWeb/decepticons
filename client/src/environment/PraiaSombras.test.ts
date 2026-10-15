import { afterEach, describe, expect, it } from 'vitest';
import { chaveDoAdereco, praiaAderecos } from './PraiaAderecos';
import { PRAIA_ESTACAO, PRAIA_COMPLEXO, praiaBlocks } from './PraiaLayout';
import {
  cantos,
  casco,
  COMPRIMENTO_DA_SOMBRA,
  DIRECAO_DA_SOMBRA,
  dadosCompletos,
  dadosDeSombra,
  mostrarSombrasDe,
  oclusoresDaPraia,
  ocultarSombrasDe,
  restaurarSombras,
  SOMBRA_ALTURA,
  SOMBRA_AREA,
  SOMBRA_LARGURA,
  SOMBRA_RES_M,
  sombrasOcultas,
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

describe('a sombra some junto com o coqueiro quebrado (P138)', () => {
  // Um coqueiro do meio do calçadão, longe dos outros e de qualquer sólido.
  const palma = praiaAderecos().find((a) => a.tipo === 'palmeira' && Math.abs(a.x) < 40 && a.z > 5 && a.z < 6)!;

  afterEach(() => restaurarSombras());

  it('há um coqueiro de teste, e a sombra e a oclusão dele existem no chão', () => {
    expect(palma).toBeDefined();
    const c = dadosDeSombra().dados;
    const copa = copaDaSombra(palma);
    const k = (Math.floor((copa[1] - SOMBRA_AREA.minZ) / SOMBRA_RES_M) * SOMBRA_LARGURA + Math.floor((copa[0] - SOMBRA_AREA.minX) / SOMBRA_RES_M)) * 2;
    expect(c[k]!, 'a copa joga sombra').toBeGreaterThan(40);
  });

  it('ocultar apaga a sombra e a oclusão dele (só nele) e mostrar as devolve', () => {
    const antes = dadosDeSombra().dados.slice();
    const copa = copaDaSombra(palma);
    const sombraAntes = sombraEm(copa[0], copa[1]).sol;
    ocultarSombrasDe(palma);
    expect(sombrasOcultas()).toBe(1);
    // (Os coqueiros vizinhos também sombreiam esse ponto: some a parte dele, não a de todos.)
    expect(sombraEm(copa[0], copa[1]).sol, 'a sombra da copa diminui').toBeLessThan(sombraAntes - 0.1);
    expect(sombraEm(palma.x, palma.z).ao, 'a oclusão do pé some').toBeLessThan(0.1);
    // Mudou algo, e só perto dele.
    const depois = dadosDeSombra().dados;
    let mudou = 0;
    let longe = 0;
    for (let k = 0; k < depois.length; k += 2) {
      if (depois[k] === antes[k] && depois[k + 1] === antes[k + 1]) continue;
      mudou++;
      const i = (k / 2) % SOMBRA_LARGURA;
      const j = Math.floor(k / 2 / SOMBRA_LARGURA);
      const x = SOMBRA_AREA.minX + i * SOMBRA_RES_M;
      const z = SOMBRA_AREA.minZ + j * SOMBRA_RES_M;
      if (Math.hypot(x - palma.x, z - palma.z) > 45) longe++; // a sombra do coqueiro tem ~35 m
    }
    expect(mudou).toBeGreaterThan(30);
    expect(longe, 'nada muda a mais de 45 m do coqueiro').toBe(0);
    mostrarSombrasDe(palma);
    expect(sombrasOcultas()).toBe(0);
    const volta = dadosDeSombra().dados;
    let maior = 0;
    for (let k = 0; k < volta.length; k++) maior = Math.max(maior, Math.abs(volta[k]! - antes[k]!));
    expect(maior, 'voltou ao do carregamento (no máximo 1 de diferença de arredondamento)').toBeLessThanOrEqual(1);
  });

  it('a janela local dá o mesmo número do cálculo completo sem o coqueiro (no máximo 1 de arredondamento)', () => {
    ocultarSombrasDe(palma);
    const incremental = dadosDeSombra().dados;
    const completo = dadosCompletos(new Set([chaveDoAdereco(palma)]));
    let maior = 0;
    for (let k = 0; k < completo.length; k++) maior = Math.max(maior, Math.abs(incremental[k]! - completo[k]!));
    expect(maior).toBeLessThanOrEqual(1);
  });

  it('dois coqueiros vizinhos quebrados não se atrapalham, e restaurar tudo devolve o chão do carregamento', () => {
    const vizinha = praiaAderecos().find((a) => a.tipo === 'palmeira' && a !== palma && Math.hypot(a.x - palma.x, a.z - palma.z) < 40)!;
    expect(vizinha).toBeDefined();
    const antes = dadosDeSombra().dados.slice();
    ocultarSombrasDe(palma);
    ocultarSombrasDe(vizinha);
    const completo = dadosCompletos(new Set([chaveDoAdereco(palma), chaveDoAdereco(vizinha)]));
    let maior = 0;
    for (let k = 0; k < completo.length; k++) maior = Math.max(maior, Math.abs(dadosDeSombra().dados[k]! - completo[k]!));
    expect(maior).toBeLessThanOrEqual(1);
    restaurarSombras();
    expect(sombrasOcultas()).toBe(0);
    expect(Array.from(dadosDeSombra().dados)).toEqual(Array.from(antes));
  });

  it('quebrar duas vezes ou mostrar sem ter quebrado não faz nada', () => {
    const antes = dadosDeSombra().dados.slice();
    mostrarSombrasDe(palma);
    expect(Array.from(dadosDeSombra().dados)).toEqual(Array.from(antes));
    ocultarSombrasDe(palma);
    const uma = dadosDeSombra().dados.slice();
    ocultarSombrasDe(palma);
    expect(Array.from(dadosDeSombra().dados)).toEqual(Array.from(uma));
    expect(sombrasOcultas()).toBe(1);
  });

  it('a textura é a mesma lista de bytes: o que muda no dado chega à GPU no próximo quadro', () => {
    const t = texturaDeSombras();
    expect(t.image.data).toBe(dadosDeSombra().dados);
    const v = t.version;
    ocultarSombrasDe(palma);
    expect(t.version).toBeGreaterThan(v);
  });
});

/** O ponto (x, z) do chão onde a copa de `a` joga a sombra (o fim da sombra do tronco): o mesmo cálculo de `sombrasDoAdereco`. */
function copaDaSombra(a: { x: number; z: number; giro: number; escala?: number }): [number, number] {
  const e = a.escala ?? 1;
  const [dx, dz] = DIRECAO_DA_SOMBRA;
  const topoX = a.x + 1.7 * e * Math.cos(a.giro);
  const topoZ = a.z - 1.7 * e * Math.sin(a.giro);
  const d = COMPRIMENTO_DA_SOMBRA * 10.5 * e;
  return [topoX + dx * d + dx * 0.4, topoZ + dz * d + dz * 0.4];
}
