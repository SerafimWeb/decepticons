import { describe, expect, it } from 'vitest';
import { PRAIA_AGUA, PRAIA_ESTACAO, PRAIA_EXTENSAO, PRAIA_FUNDURA_MAXIMA, PRAIA_INIMIGOS, PRAIA_SPAWNS, PRAIA_TITA, PRAIA_ZONES, praiaBlocks, praiaChao, praiaEstruturas } from './PraiaLayout';

describe('o layout da PRAIA DOS CABOS (P126)', () => {
  const blocos = praiaBlocks();
  const metadeX = PRAIA_EXTENSAO.comprimento / 2;
  const metadeZ = PRAIA_EXTENSAO.largura / 2;

  it('o mapa é comprido: bem maior que a Arena (200 m) — a fase maior que cabe sem streaming', () => {
    expect(PRAIA_EXTENSAO.comprimento).toBe(480);
    expect(PRAIA_EXTENSAO.comprimento).toBeGreaterThan(200 * 2); // mais que o dobro da Arena
    // Todo bloco cabe nos limites declarados (nada vaza do mapa).
    for (const b of blocos) {
      expect(Math.abs(b.x) + b.w / 2, `x de ${b.kind}`).toBeLessThanOrEqual(metadeX + 1);
      expect(Math.abs(b.z) + b.d / 2, `z de ${b.kind}`).toBeLessThanOrEqual(metadeZ + 1);
    }
  });

  it('a água é a metade do mar, com a superfície no nível da areia e dentro do mapa', () => {
    expect(PRAIA_AGUA.superficie).toBe(0);
    expect(PRAIA_AGUA.minX).toBe(-metadeX);
    expect(PRAIA_AGUA.maxX).toBe(0); // do meio para o lado do mar
    expect(PRAIA_AGUA.minZ).toBe(-metadeZ);
    expect(PRAIA_AGUA.maxZ).toBe(metadeZ);
    expect(PRAIA_AGUA.afogarS).toBeGreaterThan(0);
    expect(PRAIA_AGUA.danoPorSegundo).toBeGreaterThan(0);
  });

  it('o fundo do mar DESCE em degraus: cada um mais fundo que o anterior (é o que faz o Mech afundar)', () => {
    const mar = praiaChao().filter((b) => b.kind === 'mar');
    expect(mar.length).toBeGreaterThanOrEqual(3);
    // Do lado do mar (x negativo) para o largo: o topo de cada degrau é mais baixo que o do anterior.
    const ordenados = [...mar].sort((a, b) => b.x - a.x); // do x maior (perto da areia) para o menor (alto-mar)
    let topoAnterior = Infinity;
    for (const degrau of ordenados) {
      const topo = degrau.y + degrau.h / 2;
      expect(topo, `degrau em x=${degrau.x}`).toBeLessThan(topoAnterior);
      topoAnterior = topo;
    }
    // O degrau mais fundo chega à meta do mar.
    const maisFundo = Math.min(...ordenados.map((b) => b.y + b.h / 2));
    expect(maisFundo).toBeLessThanOrEqual(-PRAIA_FUNDURA_MAXIMA + 0.001);
  });

  it('a areia seca começa no meio do mapa, com o topo no nível da água (a praia)', () => {
    const areia = praiaChao().find((b) => b.kind === 'areia')!;
    expect(areia.y + areia.h / 2).toBe(0); // topo no nível 0
    expect(areia.x - areia.w / 2).toBeGreaterThanOrEqual(0); // só a metade seca
  });

  it('as duas vias: a areia (baixa) e a passarela alta que corre a praia inteira', () => {
    const passarela = praiaEstruturas().find((b) => b.y >= 6 && b.w >= 150)!;
    expect(passarela, 'a via alta').toBeDefined();
    expect(passarela.kind).toBe('aco');
    // A via alta fica acima de qualquer cobertura da areia (a segunda rota é para quem quer cobertura).
    const coberturas = praiaEstruturas().filter((b) => b.kind === 'aco' && b.y < 6);
    for (const c of coberturas) expect(c.y).toBeLessThan(passarela.y);
  });

  it('a ESTAÇÃO DE CABOS fica na ponta seca, com a escotilha no pé (a saída do P123)', () => {
    const predio = praiaEstruturas().find((b) => b.x === PRAIA_ESTACAO.x && b.kind === 'concreto');
    expect(predio).toBeDefined();
    expect(predio!.h).toBeGreaterThanOrEqual(14); // alto: é o marco da ponta
    const escotilha = praiaEstruturas().find((b) => b.kind === 'escotilha');
    expect(escotilha).toBeDefined();
    // A escotilha fica no pé do prédio (baixa) e perto dele (é por onde o Mech sai).
    expect(escotilha!.y).toBeLessThan(2);
    expect(Math.abs(escotilha!.x - PRAIA_ESTACAO.x)).toBeLessThan(40);
  });

  it('só desenho não tem colisor: as ruas, as janelas e a luz; todo o resto é sólido', () => {
    const soDesenho = new Set(['luz', 'rua', 'vidro']);
    for (const b of praiaBlocks()) {
      if (soDesenho.has(b.kind)) expect(b.solid, b.kind).not.toBe(true);
      else expect(b.solid, b.kind).toBe(true);
    }
  });

  it('a cidade costeira: quadras baixas (até 4 andares), ruas correndo ao longo da praia e as janelas voltadas para o mar', () => {
    const predios = praiaBlocks().filter((b) => b.kind === 'predio');
    expect(predios.length).toBeGreaterThanOrEqual(6);
    for (const p of predios) expect(p.h, 'prédio baixo').toBeLessThanOrEqual(16); // 2 a 4 andares
    const ruas = praiaBlocks().filter((b) => b.kind === 'rua');
    expect(ruas.length).toBeGreaterThanOrEqual(2);
    for (const r of ruas) expect(r.d, 'a rua corre ao longo da praia').toBeGreaterThan(r.w);
    // Cada prédio tem a janela na fachada voltada para o mar (x menor: o lado do sol).
    for (const p of predios) {
      const janela = praiaBlocks().find((b) => b.kind === 'vidro' && b.z === p.z && b.x < p.x);
      expect(janela, `janela do prédio em x=${p.x}`).toBeDefined();
    }
  });

  it('os nascimentos ficam na parte SECA (fora da água) e dentro do mapa', () => {
    expect(PRAIA_SPAWNS.length).toBeGreaterThanOrEqual(4);
    for (const [x, z] of PRAIA_SPAWNS) {
      expect(x, 'não nasce no mar').toBeGreaterThan(PRAIA_AGUA.maxX);
      expect(Math.abs(x)).toBeLessThanOrEqual(metadeX - 10);
      expect(Math.abs(z)).toBeLessThanOrEqual(metadeZ - 5);
    }
    // A boca da escotilha é o primeiro ponto (onde o jogador sai — P123).
    expect(PRAIA_SPAWNS[0]![0]).toBeLessThan(PRAIA_ESTACAO.x);
    expect(Math.abs(PRAIA_SPAWNS[0]![1])).toBeLessThan(4);
  });

  it('nenhum ponto de nascimento serve a dois corpos (a regra dos nascimentos)', () => {
    const vistos = new Set(PRAIA_SPAWNS.map(([x, z]) => `${x},${z}`));
    expect(vistos.size).toBe(PRAIA_SPAWNS.length);
  });

  it('as zonas de cura e resfriamento ficam em areia seca e livre (fora de prédio, contêiner e dunas)', () => {
    expect(PRAIA_ZONES.length).toBeGreaterThanOrEqual(2);
    expect(PRAIA_ZONES.some((z) => z.kind === 'heal')).toBe(true);
    expect(PRAIA_ZONES.some((z) => z.kind === 'cool')).toBe(true);
    // Sólidos que uma zona não pode ter no meio (o chão de areia e o mar ficam de fora: é onde elas ficam).
    const construcoes = new Set(['predio', 'concreto', 'aco', 'escotilha', 'duna']);
    for (const z of PRAIA_ZONES) {
      expect(z.x, 'seca: fora do mar').toBeGreaterThan(PRAIA_AGUA.maxX);
      expect(Math.abs(z.x)).toBeLessThanOrEqual(metadeX - z.radius);
      expect(Math.abs(z.z)).toBeLessThanOrEqual(metadeZ - z.radius);
      for (const b of praiaBlocks()) {
        if (!construcoes.has(b.kind)) continue;
        const dentro =
          Math.abs(z.x - b.x) <= b.w / 2 && Math.abs(z.z - b.z) <= b.d / 2;
        expect(dentro, `zona ${z.kind} em ${z.x},${z.z} dentro de ${b.kind} em ${b.x},${b.z}`).toBe(false);
      }
    }
  });

  it('as ondas rebeldes nascem na areia seca e livre, longe da estação que o jogador defende', () => {
    expect(PRAIA_INIMIGOS.length).toBeGreaterThanOrEqual(6); // os Mechs (3 da onda cheia) + os andróides (3)
    const construcoes = new Set(['predio', 'concreto', 'aco', 'escotilha', 'duna']);
    for (const [x, z] of [...PRAIA_INIMIGOS, PRAIA_TITA]) {
      expect(x, 'seca: fora do mar').toBeGreaterThan(PRAIA_AGUA.maxX);
      expect(Math.abs(x) + 10).toBeLessThanOrEqual(metadeX);
      expect(Math.abs(z) + 5).toBeLessThanOrEqual(metadeZ);
      expect(Math.hypot(x - PRAIA_ESTACAO.x, z - PRAIA_ESTACAO.z), 'longe da estação').toBeGreaterThan(40);
      for (const b of praiaBlocks()) {
        if (!construcoes.has(b.kind)) continue;
        const fora = Math.abs(x - b.x) > b.w / 2 + 2 || Math.abs(z - b.z) > b.d / 2 + 2;
        expect(fora, `spawn ${x},${z} perto de ${b.kind} em ${b.x},${b.z}`).toBe(true);
      }
    }
  });
});
