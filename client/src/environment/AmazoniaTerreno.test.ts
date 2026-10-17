import { describe, expect, it } from 'vitest';
import {
  AMAZONIA_ALDEIA,
  AMAZONIA_CELULA,
  AMAZONIA_EXTENSAO,
  AMAZONIA_LIMITES,
  AMAZONIA_MINA,
  AMAZONIA_NASCIMENTO_JOGADOR,
  AMAZONIA_PLANTA,
  AMAZONIA_REJEITOS,
  distanciaAoEixoDoRio,
  estaNoRio,
  FUNDURA_DO_RIO,
  larguraDoRio,
  NIVEL_DA_AGUA,
  rioEmX,
} from './AmazoniaLayout';
import { alturaDoTerreno, gradeDoMapa, gradeDoTerreno } from './AmazoniaTerreno';

describe('o rio da Amazônia (P180, parte B): o desenho em dado', () => {
  it('o mapa tem 2.400 × 900 m (14 vezes a praia) e o eixo do rio serpenteia dentro do vale, sem sair do mapa nem encostar nas bordas', () => {
    expect(AMAZONIA_EXTENSAO.comprimento * AMAZONIA_EXTENSAO.largura / (640 * 240)).toBeGreaterThan(13);
    let menor = Infinity;
    let maior = -Infinity;
    for (let x = AMAZONIA_LIMITES.minX; x <= AMAZONIA_LIMITES.maxX; x += 6) {
      const z = rioEmX(x);
      menor = Math.min(menor, z - larguraDoRio(x) / 2);
      maior = Math.max(maior, z + larguraDoRio(x) / 2);
    }
    expect(menor).toBeGreaterThan(AMAZONIA_LIMITES.minZ + 200);
    expect(maior).toBeLessThan(AMAZONIA_LIMITES.maxZ - 200);
  });

  it('o rio é estreito a montante (a aldeia) e largo a jusante (o leito do Draga), sempre entre 65 e 155 m', () => {
    expect(larguraDoRio(AMAZONIA_LIMITES.minX)).toBeLessThan(larguraDoRio(AMAZONIA_LIMITES.maxX));
    for (let x = AMAZONIA_LIMITES.minX; x <= AMAZONIA_LIMITES.maxX; x += 20) {
      expect(larguraDoRio(x)).toBeGreaterThan(65);
      expect(larguraDoRio(x)).toBeLessThan(155);
    }
  });

  it('a aldeia, a planta, a cava e a lagoa de rejeitos ficam em terra firme: nenhuma encosta na água', () => {
    const aldeia = AMAZONIA_ALDEIA;
    expect(distanciaAoEixoDoRio(aldeia.x, aldeia.z) - larguraDoRio(aldeia.x) / 2, 'a aldeia, da margem').toBeGreaterThan(aldeia.raio * 0.5);
    const p = AMAZONIA_PLANTA;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = p.x + (dx * p.comprimento) / 2;
      const z = p.z + (dz * p.largura) / 2;
      expect(estaNoRio(x, z), `canto da planta ${dx},${dz}`).toBe(false);
      expect(distanciaAoEixoDoRio(x, z) - larguraDoRio(x) / 2, `canto da planta ${dx},${dz}`).toBeGreaterThan(20);
    }
    const m = AMAZONIA_MINA;
    // a borda mais perto do rio, com o entulho: no ponto da cava voltado para o eixo do rio
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const x = m.x + Math.cos(a) * m.raio * 1.5;
      const z = m.z + Math.sin(a) * m.raio * 1.5;
      expect(estaNoRio(x, z), `borda da cava a ${a.toFixed(1)} rad`).toBe(false);
    }
    const r = AMAZONIA_REJEITOS;
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      expect(estaNoRio(r.x + Math.cos(a) * r.rx * 1.7, r.z + Math.sin(a) * r.rz * 1.7)).toBe(false);
    }
  });
});

describe('o terreno da Amazônia (P180, parte B): função pura, contínua e transitável', () => {
  it('é determinístico e finito em todo o mapa', () => {
    for (let x = AMAZONIA_LIMITES.minX; x <= AMAZONIA_LIMITES.maxX; x += 37) {
      for (let z = AMAZONIA_LIMITES.minZ; z <= AMAZONIA_LIMITES.maxZ; z += 41) {
        const h = alturaDoTerreno(x, z);
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBe(alturaDoTerreno(x, z));
        expect(h).toBeGreaterThan(-AMAZONIA_MINA.fundura - 3); // o ponto mais fundo do mapa é o fundo da cava
        expect(h).toBeLessThan(55);
      }
    }
  });

  it('o leito do rio desce até a fundura no meio e sobe até a margem em 0, e a água (abaixo do nível) cobre quase a largura toda', () => {
    for (let x = -1000; x <= 1000; x += 90) {
      const z0 = rioEmX(x);
      const meia = larguraDoRio(x) / 2;
      expect(alturaDoTerreno(x, z0), `meio do rio em ${x}`).toBeLessThan(-FUNDURA_DO_RIO + 0.8);
      expect(alturaDoTerreno(x, z0)).toBeGreaterThan(-FUNDURA_DO_RIO - 0.2);
      // a margem (1 m para fora da largura): firme, em torno de zero
      expect(Math.abs(alturaDoTerreno(x, z0 + meia + 1)), `margem em ${x}`).toBeLessThan(1.2);
      // 85% do caminho do meio até a margem ainda está debaixo da água
      expect(alturaDoTerreno(x, z0 + meia * 0.85), `perto da margem em ${x}`).toBeLessThan(NIVEL_DA_AGUA);
    }
  });

  it('a aldeia, o nascimento do jogador e o pátio da planta são planos e secos (acima da água)', () => {
    const { x, z } = AMAZONIA_NASCIMENTO_JOGADOR;
    expect(alturaDoTerreno(x, z)).toBeGreaterThan(NIVEL_DA_AGUA + 1);
    expect(Math.abs(alturaDoTerreno(x, z) - alturaDoTerreno(x + 6, z))).toBeLessThan(0.05);
    const a = AMAZONIA_ALDEIA;
    for (let t = 0; t < Math.PI * 2; t += 0.5) {
      expect(alturaDoTerreno(a.x + Math.cos(t) * a.raio * 0.6, a.z + Math.sin(t) * a.raio * 0.6)).toBeCloseTo(0.5, 1);
    }
    const p = AMAZONIA_PLANTA;
    for (const f of [-0.4, 0, 0.4]) expect(alturaDoTerreno(p.x + f * p.comprimento, p.z)).toBeCloseTo(1.4, 1);
  });

  it('a cava da mina é uma bacia funda no meio (~30 m) com o entulho no alto da borda', () => {
    const m = AMAZONIA_MINA;
    expect(alturaDoTerreno(m.x, m.z)).toBeLessThan(-m.fundura + 2);
    expect(alturaDoTerreno(m.x, m.z)).toBeGreaterThan(-m.fundura - 2);
    // o entulho: um calombo acima do chão ao redor, perto de 1,08 do raio
    const entulho = alturaDoTerreno(m.x + m.raio * 1.08, m.z);
    expect(entulho).toBeGreaterThan(0.6);
    // a parede desce de forma contínua do alto ao fundo
    let anterior = alturaDoTerreno(m.x + m.raio, m.z);
    for (let d = m.raio; d >= 0; d -= 3) {
      const h = alturaDoTerreno(m.x + d, m.z);
      expect(Math.abs(h - anterior), `parede a ${d} m do centro`).toBeLessThan(3.2);
      anterior = h;
    }
  });

  it('a lagoa de rejeitos é uma bacia rasa cercada por um dique', () => {
    const r = AMAZONIA_REJEITOS;
    expect(alturaDoTerreno(r.x, r.z)).toBeLessThan(-r.fundura + 1.5);
    expect(alturaDoTerreno(r.x + r.rx * 1.08, r.z)).toBeGreaterThan(0.8);
  });

  it('o chão é transitável: nenhuma encosta passa de ~32° entre células vizinhas (o Mech anda sem pular), no mapa inteiro', () => {
    const g = gradeDoMapa();
    const passo = AMAZONIA_CELULA;
    let maior = 0;
    for (let ix = 0; ix <= g.celulasX; ix++) {
      for (let iz = 0; iz <= g.celulasZ; iz++) {
        const h = g.alturas[ix * (g.celulasZ + 1) + iz]!;
        if (ix < g.celulasX) maior = Math.max(maior, Math.abs(g.alturas[(ix + 1) * (g.celulasZ + 1) + iz]! - h) / passo);
        if (iz < g.celulasZ) maior = Math.max(maior, Math.abs(g.alturas[ix * (g.celulasZ + 1) + iz + 1]! - h) / passo);
      }
    }
    expect(maior, `maior declive ${maior.toFixed(3)}`).toBeLessThan(Math.tan((32 * Math.PI) / 180));
  });
});

describe('o vale e as margens (P180, parte B): o desenho do relevo em volta do rio', () => {
  it('o vale se fecha nas bordas de z: a 445 m do eixo do mapa o chão sobe a mais de 12 m (a parede do vale), e no meio do vale não', () => {
    for (let x = -1000; x <= 1000; x += 250) {
      for (const z of [-445, 445]) expect(alturaDoTerreno(x, z), `parede em ${x},${z}`).toBeGreaterThan(12);
    }
    expect(alturaDoTerreno(-500, 40)).toBeLessThan(12);
  });

  it('a margem é lisa: do pé da água até 25 m para dentro da terra o chão firme só treme (±0,36 m onde nada mais mexe nele, ±1 m perto da planta e da cava)', () => {
    let tremor = 0;
    let geral = 0;
    for (let x = -880; x <= 1000; x += 7) {
      for (const lado of [-1, 1]) {
        const margem = rioEmX(x) + (lado * larguraDoRio(x)) / 2;
        for (const d of [0, 5, 12, 25]) {
          const h = Math.abs(alturaDoTerreno(x, margem + lado * d));
          geral = Math.max(geral, h);
          if (x >= 520) tremor = Math.max(tremor, h); // a jusante da cava: só a ondulação miúda
        }
      }
    }
    expect(tremor, `tremor ${tremor.toFixed(3)}`).toBeLessThan(0.36);
    expect(geral, `maior altura na margem ${geral.toFixed(3)}`).toBeLessThan(1);
  });
});

describe('a grade do terreno (P180, parte B): a mesma para a malha e para o colisor', () => {
  it('cobre o mapa inteiro (400 × 150 células de 6 m) e a ordem do Rapier é alturas[ix * (celulasZ + 1) + iz]', () => {
    const g = gradeDoMapa();
    expect(g.celulasX).toBe(AMAZONIA_EXTENSAO.comprimento / AMAZONIA_CELULA);
    expect(g.celulasZ).toBe(AMAZONIA_EXTENSAO.largura / AMAZONIA_CELULA);
    expect(g.alturas.length).toBe((g.celulasX + 1) * (g.celulasZ + 1));
    for (const [ix, iz] of [[0, 0], [10, 3], [200, 75], [400, 150], [123, 99]] as const) {
      expect(g.alturas[ix * (g.celulasZ + 1) + iz]).toBeCloseTo(alturaDoTerreno(g.minX + ix * g.celula, g.minZ + iz * g.celula), 4);
    }
  });

  it('uma região (um pedaço) lê a mesma função: as emendas entre pedaços não dão degrau', () => {
    const a = gradeDoTerreno(0, -300, 50, 100); // x de 0 a 300
    const b = gradeDoTerreno(300, -300, 50, 100); // x de 300 a 600
    for (let iz = 0; iz <= 100; iz++) {
      expect(a.alturas[50 * 101 + iz]).toBeCloseTo(b.alturas[0 * 101 + iz]!, 6); // a última coluna de A é a primeira de B
    }
  });
});
