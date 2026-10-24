import { describe, expect, it } from 'vitest';
import { BRASIL_CONTORNO, BRASIL_CONTORNO_ESCALA } from './brasilContorno';
import { MAPS } from './MapLinks';
import { nomeVaiParaEsquerda } from './WorldMap';
import {
  BRASIL,
  decodificarMascara,
  deltaLon,
  ENQUADRAMENTOS,
  enquadrar,
  estadoDoTeatro,
  formatarCoordenada,
  interpolarVista,
  MAR,
  passoDaGrade,
  projetar,
  RECURSO_NOME,
  TEATROS,
  TERRA,
  type Vista,
} from './theater';
import { WORLD_MASK } from './worldMask';

const grade = decodificarMascara();
const celula = (lat: number, lon: number) => {
  const r = Math.floor((WORLD_MASK.lat0 - lat) / WORLD_MASK.step);
  const c = Math.floor((lon - WORLD_MASK.lon0) / WORLD_MASK.step);
  return grade[r * WORLD_MASK.cols + c];
};
/** No Brasil ou colado nele: cidade de litoral (Fortaleza) cai numa célula de 1° que já é mar. */
const noBrasil = (lat: number, lon: number) => [-1, 0, 1].some((i) => [-1, 0, 1].some((j) => celula(lat + i, lon + j) === BRASIL));

describe('a grade do mapa-múndi (worldMask.ts)', () => {
  it('abre inteira: toda linha tem as 360 colunas', () => {
    expect(grade.length).toBe(WORLD_MASK.rows * WORLD_MASK.cols);
  });

  it('tem o Brasil do tamanho certo (~8,5 milhões de km², ~700 células de 1°) e a terra do resto do mundo', () => {
    const brasil = grade.filter((v) => v === BRASIL).length;
    const terra = grade.filter((v) => v === TERRA).length;
    expect(brasil).toBeGreaterThan(600);
    expect(brasil).toBeLessThan(800);
    expect(terra).toBeGreaterThan(10 * brasil);
  });

  it('põe as cidades no lugar: São Paulo e Manaus são Brasil, Madri é terra, o meio do Atlântico é mar', () => {
    expect(celula(-23.55, -46.63)).toBe(BRASIL);
    expect(celula(-3.12, -60.02)).toBe(BRASIL);
    expect(celula(40.42, -3.7)).toBe(TERRA);
    expect(celula(0, -25)).toBe(MAR);
  });

  it('recusa uma linha com o número errado de células', () => {
    expect(() => decodificarMascara(['.10'], 360)).toThrow(/linha 0/);
  });
});

describe('as missões do teatro de operações', () => {
  it('todas ficam em solo brasileiro (o UNIVERSO.md põe o Brasil no centro do mapa)', () => {
    for (const t of TEATROS) expect(noBrasil(t.lat, t.lon), `${t.nome} fora do Brasil`).toBe(true);
  });

  it('nenhum par de missões a menos de 6°: no zoom BRASIL os marcadores e os nomes não se encostam', () => {
    for (const a of TEATROS) {
      for (const b of TEATROS) {
        if (a === b) continue;
        expect(Math.hypot(a.lat - b.lat, a.lon - b.lon), `${a.nome} × ${b.nome}`).toBeGreaterThan(6);
      }
    }
  });

  it('todo mapa jogável tem a sua missão, e só eles acendem', () => {
    const jogaveis = TEATROS.filter((t) => t.mapa).map((t) => t.mapa);
    expect(jogaveis.sort()).toEqual(MAPS.map((m) => m.id).sort());
    for (const t of TEATROS) expect(!!t.mapa, t.nome).toBe(t.modos.length > 0);
  });

  it('só a estação de cabos (Fortaleza, registrada no UNIVERSO.md) e o 8 DE JANEIRO (Brasília, mandado pelo Comandante em 19/10) têm o lugar confirmado; o resto é proposta', () => {
    expect(TEATROS.filter((t) => !t.proposta).map((t) => t.id).sort()).toEqual(['cabos', 'janeiro']);
  });

  it('o 8 DE JANEIRO (P217) ocupa Brasília, onde era o Bunker, e o Bunker foi para o Mato Grosso do Sul', () => {
    const janeiro = TEATROS.find((x) => x.id === 'janeiro')!;
    const bunker = TEATROS.find((x) => x.id === 'bunker')!;
    expect(janeiro.lugar).toMatch(/Brasília/);
    expect(janeiro.recurso).toBe('poder');
    expect(RECURSO_NOME.poder).toBe('SEDE DOS PODERES');
    expect(janeiro.mapa).toBe('janeiro');
    expect(janeiro.modos).toEqual(['deathmatch', 'survival']); // a missão (a Sobrevivência: a multidão contra os três prédios) é o passo 5 da ficha
    expect(bunker.lugar).toMatch(/MS$/);
    expect(bunker.lat).toBeLessThan(-18); // o Mato Grosso do Sul fica ao sul do paralelo 17 e a oeste de Goiás
    expect(bunker.lon).toBeLessThan(-52);
    expect(Math.hypot(bunker.lat - janeiro.lat, bunker.lon - janeiro.lon)).toBeGreaterThan(6);
  });

  it('o estado de cada missão segue o mapa e o modo da partida aberta', () => {
    const t = (id: string) => TEATROS.find((x) => x.id === id)!;
    expect(estadoDoTeatro(t('arena'), 'arena', 'deathmatch')).toBe('aqui');
    expect(estadoDoTeatro(t('bunker'), 'arena', 'deathmatch')).toBe('disponivel');
    expect(estadoDoTeatro(t('bunker'), 'arena', 'survival')).toBe('outro-modo');
    expect(estadoDoTeatro(t('arena'), 'bunker', 'deathmatch')).toBe('disponivel');
    // A ESTAÇÃO DE CABOS abre o mapa da praia (P126): a missão saiu do "EM BREVE".
    expect(estadoDoTeatro(t('cabos'), 'arena', 'deathmatch')).toBe('disponivel');
    expect(estadoDoTeatro(t('cabos'), 'praia', 'deathmatch')).toBe('aqui');
    // TERRAS RARAS abre o mapa da Amazônia (P180): o Deathmatch e a missão do rio (a Sobrevivência); a Bandeira não existe lá.
    expect(estadoDoTeatro(t('rio'), 'arena', 'deathmatch')).toBe('disponivel');
    expect(estadoDoTeatro(t('rio'), 'arena', 'survival')).toBe('disponivel');
    expect(estadoDoTeatro(t('rio'), 'arena', 'ctf')).toBe('outro-modo');
    expect(estadoDoTeatro(t('rio'), 'amazonia', 'deathmatch')).toBe('aqui');
    expect(estadoDoTeatro(t('arena'), 'amazonia', 'deathmatch')).toBe('disponivel');
  });

  it('TERRAS RARAS (P180) é a missão da água: no Pará, longe de todas as outras, com o mapa e o modo certos', () => {
    const rio = TEATROS.find((x) => x.id === 'rio')!;
    expect(rio.mapa).toBe('amazonia');
    expect(rio.modos).toEqual(['deathmatch', 'survival']);
    expect(rio.recurso).toBe('agua');
    expect(RECURSO_NOME.agua).toBe('ÁGUA');
    expect(rio.proposta, 'o lugar ainda é proposta até o Comandante confirmar').toBe(true);
    expect(rio.lat).toBeLessThan(0);
    expect(rio.lon).toBeLessThan(-50);
  });
});

describe('a projeção do mapa', () => {
  const p = { x: 0, y: 0 };

  it('no zoom BRASIL, todas as missões cabem na tela, do celular ao 1080p', () => {
    for (const [w, h] of [[563, 236], [348, 210], [855, 490], [824, 230]] as const) {
      const v = enquadrar(ENQUADRAMENTOS.brasil, w, h);
      for (const t of TEATROS) {
        projetar(v, w, h, t.lon, t.lat, p);
        expect(p.x, `${t.nome} em ${w}×${h}`).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(w);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(h);
      }
    }
  });

  it('no zoom MUNDO o Brasil fica no centro e o mapa dá a volta no Pacífico', () => {
    const v = enquadrar(ENQUADRAMENTOS.mundo, 720, 300);
    expect(v.lon).toBe(-50);
    projetar(v, 720, 300, -50, 0, p);
    expect(p.x).toBeCloseTo(360);
    // O corte fica em 130° L: Pequim (116° L) é a ponta direita; Tóquio (140° L) dá a volta e aparece na esquerda, ao lado do Alasca.
    projetar(v, 720, 300, 116.4, 39.9, p);
    expect(p.x).toBeGreaterThan(600);
    projetar(v, 720, 300, 139.7, 35.7, p);
    expect(p.x).toBeLessThan(120);
  });

  it('deltaLon dá a volta: 170° L está a -20° de 170° O... visto de -170°', () => {
    expect(deltaLon(170, -170)).toBe(-20);
    expect(deltaLon(-170, 170)).toBe(20);
    expect(deltaLon(-46, -50)).toBe(4);
    // O mapa MUNDO passa dos 180° (vai a -230°): o rótulo do meridiano volta para dentro de ±180° (-210° é 150° L).
    expect(deltaLon(-210, 0)).toBe(150);
    expect(deltaLon(-240, 0)).toBe(120);
  });

  it('o zoom animado começa numa vista e termina na outra', () => {
    const a: Vista = { lon: -54, lat: -14, escala: 6 };
    const b: Vista = { lon: -50, lat: 13, escala: 1.5 };
    const out: Vista = { lon: 0, lat: 0, escala: 0 };
    expect(interpolarVista(a, b, 0, out)).toEqual(a);
    expect(interpolarVista(a, b, 1, out)).toEqual(b);
    expect(interpolarVista(a, b, 0.5, out).escala).toBeCloseTo(3);
  });

  it('com o mapa longe, desenha uma célula a cada tantas (os pontos nunca ficam a menos de 3 px)', () => {
    expect(passoDaGrade(6)).toBe(1);
    expect(passoDaGrade(1.6)).toBe(2);
    expect(passoDaGrade(0.8)).toBe(4);
    for (const escala of [0.5, 1, 1.5, 2, 3, 5, 8]) expect(passoDaGrade(escala) * escala).toBeGreaterThanOrEqual(3.2);
  });
});

describe('as coordenadas na ficha da missão', () => {
  it('escreve graus e minutos, S e N, O e L (São Paulo e Fortaleza são do hemisfério sul e do lado oeste)', () => {
    expect(formatarCoordenada(-23.55, -46.63)).toBe('23°33′S 46°38′O');
    expect(formatarCoordenada(-3.73, -38.52)).toBe('3°44′S 38°31′O');
    expect(formatarCoordenada(35.68, 139.69)).toBe('35°41′N 139°41′L');
  });

  it('o minuto fecha em 60 sem estourar (59,99° vira 60′ do grau seguinte, nunca "59°60′")', () => {
    expect(formatarCoordenada(-10.9999, 0)).toBe('11°00′S 0°00′L');
  });
});

/** Área de um polígono em graus quadrados (fórmula do cadarço) e "está dentro" (raio horizontal). */
function areaDoContorno(pts: [number, number][]): number {
  let soma = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) soma += pts[j]![0] * pts[i]![1] - pts[i]![0] * pts[j]![1];
  return Math.abs(soma) / 2;
}
function dentro(pts: [number, number][], lon: number, lat: number): boolean {
  let impar = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) impar = !impar;
  }
  return impar;
}
const contorno: [number, number][] = [];
for (let i = 0; i < BRASIL_CONTORNO.length; i += 2) contorno.push([BRASIL_CONTORNO[i]! / BRASIL_CONTORNO_ESCALA, BRASIL_CONTORNO[i + 1]! / BRASIL_CONTORNO_ESCALA]);

describe('o contorno do Brasil por cima dos pontos (brasilContorno.ts)', () => {
  it('é uma linha de centenas de pontos (não os 1.600 do original) e cabe na caixa do país', () => {
    expect(BRASIL_CONTORNO.length % 2).toBe(0);
    expect(contorno.length).toBeGreaterThan(150);
    expect(contorno.length).toBeLessThan(500);
    for (const [lon, lat] of contorno) {
      expect(lon).toBeGreaterThan(-75);
      expect(lon).toBeLessThan(-34);
      expect(lat).toBeGreaterThan(-34);
      expect(lat).toBeLessThan(6);
    }
  });

  it('tem o tamanho do Brasil da grade: a área do contorno bate com as células marcadas (±8%)', () => {
    const celulas = grade.filter((v) => v === BRASIL).length;
    // Cada célula vale 1° × 1°; a grade marca o centro da célula, então a área do polígono tem que cair perto da contagem.
    expect(Math.abs(areaDoContorno(contorno) - celulas) / celulas).toBeLessThan(0.08);
  });

  it('as cinco missões ficam dentro do país (ou a menos de 0,3° da costa: Fortaleza fica no litoral)', () => {
    for (const t of TEATROS) {
      const folga = [0, 0.3, -0.3].flatMap((dx) => [0, 0.3, -0.3].map((dy) => dentro(contorno, t.lon + dx, t.lat + dy)));
      expect(folga.some(Boolean), `${t.nome} fora do contorno`).toBe(true);
    }
    expect(dentro(contorno, -46.63, -23.55)).toBe(true);
    expect(dentro(contorno, -58.4, -34.6), 'Buenos Aires não é Brasil').toBe(false);
    expect(dentro(contorno, -66, 5.5 + 10), 'o Caribe não é Brasil').toBe(false);
  });
});

describe('de que lado do marcador fica o nome', () => {
  it('quem prefere a direita fica na direita enquanto cabe, e vira para a esquerda quando passaria da borda', () => {
    expect(nomeVaiParaEsquerda('direita', 100, 120, 560)).toBe(false);
    expect(nomeVaiParaEsquerda('direita', 480, 150, 560)).toBe(true);
  });

  it('quem prefere a esquerda fica na esquerda enquanto cabe, e vira para a direita quando passaria da borda', () => {
    expect(nomeVaiParaEsquerda('esquerda', 300, 120, 560)).toBe(true);
    expect(nomeVaiParaEsquerda('esquerda', 60, 120, 560)).toBe(false);
  });

  it('se não cabe em lado nenhum, fica no lado preferido (o mapa corta, mas o nome não pula de um lado para o outro)', () => {
    expect(nomeVaiParaEsquerda('direita', 100, 700, 560)).toBe(false);
    expect(nomeVaiParaEsquerda('esquerda', 100, 700, 560)).toBe(true);
  });
});
