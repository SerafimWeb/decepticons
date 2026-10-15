import { describe, expect, it } from 'vitest';
import { PRAIA_BARRACAS_X, praiaAderecos } from './PraiaAderecos';
import { pegada, praiaColisores, TETO_DE_COLISORES, type Colisor } from './PraiaColisores';
import {
  localEm,
  PRAIA_AGUA,
  PRAIA_ASSALTO,
  PRAIA_CABOS_X,
  PRAIA_COMPLEXO,
  PRAIA_ESCOTILHA,
  PRAIA_ESTACAO,
  PRAIA_INIMIGOS,
  PRAIA_PIER,
  PRAIA_RUA_LARGURA,
  PRAIA_RUAS_X,
  PRAIA_SPAWNS,
  PRAIA_TITA,
  PRAIA_ZONES,
  praiaBlocks,
  quadrasDaCidade,
} from './PraiaLayout';
import { alturaDoChao, costaEm, faixaEm, PRAIA_LIMITES } from './PraiaTerreno';

const blocos = praiaBlocks();
const colisores = praiaColisores();

/** Distância (m) de um ponto à pegada de um colisor (0 se está dentro dela). */
function distancia(x: number, z: number, c: Colisor): number {
  const [x0, z0, x1, z1] = pegada(c);
  return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
}
const maisPerto = (x: number, z: number): number => Math.min(...colisores.map((c) => distancia(x, z, c)));

/** O corredor [zA, zB] está livre de colisor ao longo de [xA, xB]? (Só conta o que bloqueia a altura de um Mech.) */
function corredorLivre(xA: number, xB: number, zA: number, zB: number): Colisor | null {
  for (const c of colisores) {
    if (c.y - c.h / 2 > 7) continue; // acima da cabeça de um Vector (o tabuleiro alto do píer, o teto): não fecha a passagem de baixo
    const [x0, z0, x1, z1] = pegada(c);
    if (x1 > xA && x0 < xB && z1 > zA && z0 < zB) return c;
  }
  return null;
}

describe('o layout da PRAIA DOS CABOS (P127): a praia ao longo do mapa', () => {
  it('as três âncoras do mapa: o porto a oeste, a Ponte Metálica no meio e a estação a leste (a orla inteira entre elas)', () => {
    expect(PRAIA_ESTACAO.x).toBeGreaterThan(PRAIA_COMPLEXO.minX);
    expect(PRAIA_ESTACAO.x).toBeLessThan(PRAIA_COMPLEXO.maxX);
    expect(PRAIA_ESTACAO.z).toBeGreaterThan(PRAIA_COMPLEXO.minZ);
    expect(PRAIA_ESTACAO.z).toBeLessThan(PRAIA_COMPLEXO.maxZ);
    expect(PRAIA_ESCOTILHA.x).toBeGreaterThan(PRAIA_COMPLEXO.minX);
    expect(PRAIA_PIER.x).toBeGreaterThan(-200);
    expect(PRAIA_PIER.x).toBeLessThan(0);
    expect(localEm(-300, -20)).toBe('PORTO DE MUCURIPE');
    expect(localEm(PRAIA_PIER.x, -60)).toBe('PONTE METÁLICA');
    expect(localEm(PRAIA_ESTACAO.x, PRAIA_ESTACAO.z)).toBe('ESTAÇÃO DE CABOS');
    for (const x of [-150, 0, 120]) {
      expect(localEm(x, costaEm(x) - 50)).toBe('MAR ABERTO');
      expect(localEm(x, costaEm(x) + 10)).toBe('PRAIA DOS CABOS');
      expect(localEm(x, 10)).toBe('CALÇADÃO');
      expect(localEm(x, 27)).toBe('AV. BEIRA-MAR');
      expect(localEm(x, 80)).toBe('CIDADE COSTEIRA');
    }
  });

  it('todo bloco e todo adereço cabe no mapa (nada vaza dos 640 × 240 m)', () => {
    for (const b of blocos) {
      expect(b.x - b.w / 2, `x0 de ${b.kind}`).toBeGreaterThanOrEqual(PRAIA_LIMITES.minX - 1);
      expect(b.x + b.w / 2, `x1 de ${b.kind}`).toBeLessThanOrEqual(PRAIA_LIMITES.maxX + 1);
      expect(b.z - b.d / 2, `z0 de ${b.kind}`).toBeGreaterThanOrEqual(PRAIA_LIMITES.minZ - 1);
      expect(b.z + b.d / 2, `z1 de ${b.kind}`).toBeLessThanOrEqual(PRAIA_LIMITES.maxZ + 1);
    }
    for (const a of praiaAderecos()) {
      if (a.solido === false) continue; // o navio ao longe, além do mapa, é só horizonte
      expect(a.x, a.tipo).toBeGreaterThanOrEqual(PRAIA_LIMITES.minX);
      expect(a.x, a.tipo).toBeLessThanOrEqual(PRAIA_LIMITES.maxX);
      expect(a.z, a.tipo).toBeGreaterThanOrEqual(PRAIA_LIMITES.minZ);
      expect(a.z, a.tipo).toBeLessThanOrEqual(PRAIA_LIMITES.maxZ);
    }
  });

  it('os colisores cabem no teto da ficha (< 310), contando as quatro paredes e o chão', () => {
    const total = colisores.length + 4 /* paredes */ + 1; /* o colisor de altura */
    expect(total).toBeLessThan(TETO_DE_COLISORES);
    expect(colisores.length).toBeGreaterThan(80); // é um mapa cheio, não um deserto
  });

  it('a água é o mar todo, com a superfície abaixo da areia, e só o fundo afoga (o raso é uma via lenta)', () => {
    expect(PRAIA_AGUA.superficie).toBeLessThan(0);
    expect(PRAIA_AGUA.minZ).toBe(PRAIA_LIMITES.minZ);
    expect(PRAIA_AGUA.minX).toBe(PRAIA_LIMITES.minX);
    expect(PRAIA_AGUA.maxX).toBe(PRAIA_LIMITES.maxX); // a água corre o comprimento todo
    expect(PRAIA_AGUA.afogaDesde).toBeGreaterThan(0.5);
    expect(PRAIA_AGUA.afogaDesde).toBeLessThan(3);
  });

  it('a cidade tem quadras entre as ruas, e as ruas ficam livres para a passagem do maior Mech (Colossus, raio 3,6 m)', () => {
    expect(quadrasDaCidade().length).toBe(PRAIA_RUAS_X.length + 1);
    for (const x of PRAIA_RUAS_X) {
      const meia = PRAIA_RUA_LARGURA / 2 - 3;
      expect(corredorLivre(x - meia, x + meia, 41, 118), `rua em x=${x}`).toBeNull();
    }
    const predios = blocos.filter((b) => b.kind === 'predio');
    expect(predios.length).toBeGreaterThanOrEqual(24);
    // A frente da cidade é de hotéis altos; o fundo, de prédios baixos.
    expect(Math.max(...predios.map((p) => p.h))).toBeGreaterThanOrEqual(28);
    expect(Math.min(...predios.map((p) => p.h))).toBeLessThanOrEqual(12);
  });

  it('as três vias da orla (a areia, o calçadão e a avenida) correm livres o comprimento todo para um Colossus', () => {
    // A avenida: a faixa do meio, 8 m de largura (os carros ficam nas bordas).
    expect(corredorLivre(-226, PRAIA_COMPLEXO.minX - 2, 23, 31)).toBeNull();
    // O calçadão: o corredor de 6 m entre os quiosques e a ciclovia.
    expect(corredorLivre(-226, PRAIA_COMPLEXO.minX - 2, 10, 16)).toBeNull();
  });

  it('a areia tem duas vias na altura do Mech: a de trás (livre) e a da beira d’água; só a Ponte Metálica e a rampa dela as cortam', () => {
    // O fundo da praia (o limite do calçadão): livre de ponta a ponta entre o porto e a estação (barracas ficam mais para o mar).
    expect(corredorLivre(-226, PRAIA_COMPLEXO.minX - 2, 0, 4)).toBeNull();
  });

  it('o píer nasce na água e a rampa dele sobe sem degrau (menos de 8°), deixando a faixa de trás da praia livre', () => {
    const rampa = blocos.find((b) => b.kind === 'deque' && b.rx !== undefined)!;
    expect(rampa).toBeDefined();
    expect((rampa.rx! * 180) / Math.PI).toBeLessThan(8);
    const tabuleiro = blocos.find((b) => b.kind === 'deque' && b.d > 50 && b.w === PRAIA_PIER.largura)!;
    expect(tabuleiro.y + tabuleiro.h / 2).toBeCloseTo(PRAIA_PIER.topo, 5);
    // O fim do tabuleiro entra no mar (o píer é a via alta SOBRE a água).
    expect(faixaEm(PRAIA_PIER.x, PRAIA_PIER.zFim)).toBe('mar');
    // A rampa e o tabuleiro ficam do lado do mar do fundo da praia: o calçadão e o fundo da areia seguem livres.
    expect(PRAIA_PIER.zRampa).toBeLessThan(-8);
  });

  it('a estação é um complexo murado com portões largos para a avenida e para a praia (por onde a escolta e as ondas entram)', () => {
    // O portão da avenida (oeste): 22 m, na altura da avenida. O do mar (norte): 24 m, onde chegam os cabos. O de trás: 22 m.
    expect(corredorLivre(PRAIA_COMPLEXO.minX - 3, PRAIA_COMPLEXO.minX + 3, 17, 37)).toBeNull();
    expect(corredorLivre(247, 269, PRAIA_COMPLEXO.minZ - 3, PRAIA_COMPLEXO.minZ + 3)).toBeNull();
    expect(corredorLivre(271, 291, PRAIA_COMPLEXO.maxZ - 3, PRAIA_COMPLEXO.maxZ + 3)).toBeNull();
    // E há muro: o complexo é fechado fora dos portões.
    expect(corredorLivre(PRAIA_COMPLEXO.minX - 1, PRAIA_COMPLEXO.minX + 1, 60, 70)).not.toBeNull();
    // Os cabos passam pelo portão do mar.
    for (const cx of PRAIA_CABOS_X) {
      expect(cx).toBeGreaterThan(247);
      expect(cx).toBeLessThan(269);
    }
    // O pátio tem cobertura de verdade (a defesa se abriga).
    const cobertura = colisores.filter((c) => c.x > PRAIA_COMPLEXO.minX + 4 && c.x < PRAIA_COMPLEXO.maxX - 4 && c.z > PRAIA_COMPLEXO.minZ + 4 && c.z < PRAIA_COMPLEXO.maxZ - 4);
    expect(cobertura.length).toBeGreaterThanOrEqual(12);
  });

  it('os nascimentos ficam em chão firme, plano e livre (com folga para o Colossus), dentro do mapa e sem repetir', () => {
    expect(PRAIA_SPAWNS.length).toBeGreaterThanOrEqual(12);
    expect(PRAIA_SPAWNS[0]).toEqual([PRAIA_ESCOTILHA.x, PRAIA_ESCOTILHA.z]); // a escotilha: o jogador sai dela (P123)
    const vistos = new Set(PRAIA_SPAWNS.map(([x, z]) => `${x},${z}`));
    expect(vistos.size, 'nenhum ponto serve a dois corpos').toBe(PRAIA_SPAWNS.length);
    for (const [x, z] of PRAIA_SPAWNS) {
      expect(faixaEm(x, z), `spawn ${x},${z} não nasce no mar`).not.toBe('mar');
      expect(Math.abs(alturaDoChao(x, z)), `spawn ${x},${z} em chão plano`).toBeLessThan(0.05);
      expect(maisPerto(x, z), `spawn ${x},${z} livre`).toBeGreaterThan(4.5);
      expect(Math.abs(x)).toBeLessThanOrEqual(PRAIA_LIMITES.maxX - 6);
    }
  });

  it('as ondas rebeldes e o Colossus nascem em chão livre, longe da estação que o jogador defende', () => {
    expect(PRAIA_INIMIGOS.length).toBeGreaterThanOrEqual(6); // os Mechs (3 da onda cheia) + os andróides (3)
    for (const [x, z] of PRAIA_INIMIGOS) {
      expect(Math.abs(alturaDoChao(x, z))).toBeLessThan(0.05);
      expect(faixaEm(x, z)).not.toBe('mar');
      expect(maisPerto(x, z), `onda em ${x},${z} livre`).toBeGreaterThan(4.5);
      expect(Math.hypot(x - PRAIA_ESTACAO.x, z - PRAIA_ESTACAO.z), 'longe da estação').toBeGreaterThan(120);
    }
    const [tx, tz] = PRAIA_TITA;
    expect(Math.abs(alturaDoChao(tx, tz))).toBeLessThan(0.05);
    expect(maisPerto(tx, tz), 'folga do titã (raio 3,6 m)').toBeGreaterThan(5.5);
    expect(Math.hypot(tx - PRAIA_ESTACAO.x, tz - PRAIA_ESTACAO.z)).toBeGreaterThan(120);
  });

  it('o assalto: a rota dos rebeldes termina nos portões da estação, em chão livre', () => {
    expect(PRAIA_ASSALTO.length).toBeGreaterThanOrEqual(3);
    for (const [x, z] of PRAIA_ASSALTO) {
      expect(Math.abs(alturaDoChao(x, z))).toBeLessThan(0.05);
      expect(maisPerto(x, z), `ponto de assalto ${x},${z} livre`).toBeGreaterThan(4);
      expect(Math.hypot(x - PRAIA_ESTACAO.x, z - PRAIA_ESTACAO.z), 'perto da estação').toBeLessThan(80);
    }
  });

  it('as zonas de cura e de resfriamento ficam em chão firme, plano e livre — uma no pátio da estação', () => {
    expect(PRAIA_ZONES.some((z) => z.kind === 'heal')).toBe(true);
    expect(PRAIA_ZONES.some((z) => z.kind === 'cool')).toBe(true);
    expect(PRAIA_ZONES.some((z) => z.x > PRAIA_COMPLEXO.minX && z.z > PRAIA_COMPLEXO.minZ)).toBe(true);
    for (const z of PRAIA_ZONES) {
      expect(faixaEm(z.x, z.z)).not.toBe('mar');
      expect(Math.abs(alturaDoChao(z.x, z.z))).toBeLessThan(0.05);
      expect(maisPerto(z.x, z.z), `zona ${z.kind} em ${z.x},${z.z}`).toBeGreaterThan(z.radius * 0.5);
    }
  });

  it('as barracas ficam no fundo da areia, entre o mar e o calçadão', () => {
    expect(PRAIA_BARRACAS_X.length).toBeGreaterThanOrEqual(8);
    for (const x of PRAIA_BARRACAS_X) expect(faixaEm(x, -13)).toBe('praia');
  });

  it('só desenho não tem colisor (pistas, marcas, luzes, cabos); a escotilha é uma placa no chão', () => {
    const soDesenho = new Set(['asfalto', 'calcada', 'patio', 'ciclovia', 'marca', 'luz', 'escotilha', 'cabo']);
    for (const b of blocos) {
      if (soDesenho.has(b.kind)) expect(b.solid, b.kind).not.toBe(true);
    }
    // E o que tem corpo é sólido: prédio, muro, contêiner do pátio, o cais.
    for (const b of blocos) {
      if (['predio', 'muro', 'cais'].includes(b.kind)) expect(b.solid, b.kind).toBe(true);
    }
  });
});
