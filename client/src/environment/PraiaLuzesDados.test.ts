import { describe, expect, it } from 'vitest';
import { LAMPADAS_DA_BARRACA, praiaAderecos, TIPOS_QUE_FLUTUAM, type Adereco, type TipoDeAdereco } from './PraiaAderecos';
import { camadasDoTipo } from './PraiaGeometrias';
import {
  CENTRO_DO_PATIO,
  feixesDosRefletores,
  holofotesDaEstacao,
  LUZ_PISCA,
  luzesDaPraia,
  pocasDeLuz,
  pontoDoAdereco,
} from './PraiaLuzesDados';
import { PRAIA_COMPLEXO } from './PraiaLayout';
import { alturaDoChao, NIVEL_DO_MAR } from './PraiaTerreno';

const contar = (tipo: TipoDeAdereco): number => praiaAderecos().filter((a) => a.tipo === tipo).length;

describe('as luzes da praia (P127, rodada de luz): dado puro', () => {
  const luzes = luzesDaPraia();

  it('há luz para o varal de cada barraca, para cada poste e para os avisos; o total cabe no teto de um desenho', () => {
    const barracas = contar('barraca') * LAMPADAS_DA_BARRACA.length;
    const postes = contar('poste');
    expect(luzes.length).toBeGreaterThan(barracas + postes);
    expect(luzes.length, 'um desenho só: poucas centenas de halos').toBeLessThanOrEqual(600);
    expect(barracas).toBeGreaterThan(100);
  });

  it('nenhuma luz tem número inválido, e as cores passam de 1 (o realce pega) sem estourar', () => {
    for (const l of luzes) {
      for (const v of [l.x, l.y, l.z, l.raio, l.r, l.g, l.b, l.fase]) expect(Number.isFinite(v)).toBe(true);
      expect(l.raio).toBeGreaterThan(0.5);
      expect(l.raio).toBeLessThan(20);
      expect(Math.max(l.r, l.g, l.b)).toBeLessThanOrEqual(2);
      expect(Math.max(l.r, l.g, l.b)).toBeGreaterThan(0.9);
    }
  });

  it('só os avisos piscam: antena, boia, lancha rebelde e a nau de comando (nada de poste piscando)', () => {
    const esperado = contar('antena') + contar('boia') + contar('lancha') + contar('navioRebelde') * 5;
    expect(luzes.filter((l) => l.modo === LUZ_PISCA).length).toBe(esperado);
  });

  it('o halo fica junto da camada de brilho da geometria (a luz e o bulbo nunca se desencontram)', () => {
    const tipos: TipoDeAdereco[] = ['poste', 'refletor', 'vigia', 'semaforo', 'ponto', 'boia', 'antena', 'farol', 'lancha', 'navioDeCabos', 'navioRebelde'];
    for (const tipo of tipos) {
      const brilho = camadasDoTipo(tipo).filter((c) => c.material === 'brilho');
      expect(brilho.length, `${tipo} tem camada de brilho`).toBeGreaterThan(0);
      const pos = brilho.flatMap((c) => {
        const p = c.geo.attributes.position!;
        return Array.from({ length: p.count }, (_, i) => [p.getX(i), p.getY(i), p.getZ(i)] as const);
      });
      const modelo: Adereco = { tipo, x: 0, z: 0, giro: 0 };
      const luzesDoTipo = luzesDaPraia([modelo]);
      expect(luzesDoTipo.length, `${tipo} acende`).toBeGreaterThan(0);
      const base = TIPOS_QUE_FLUTUAM.has(tipo) ? NIVEL_DO_MAR : 0; // o navio e a boia flutuam: a luz sobe do nível do mar
      for (const l of luzesDoTipo) {
        const perto = Math.min(...pos.map(([x, y, z]) => Math.hypot(x - l.x, y - (l.y - base), z - l.z)));
        expect(perto, tipo + ': o halo está a ' + perto.toFixed(2) + ' m do brilho').toBeLessThan(2.6);
      }
    }
  });

  it('o giro leva o ponto local para o lugar certo (o braço +x do semáforo vira para -z com 90 graus)', () => {
    const [x, y, z] = pontoDoAdereco({ tipo: 'semaforo', x: 10, z: 20, giro: Math.PI / 2 }, 2.4, 4.76, 0);
    expect(x).toBeCloseTo(10, 5);
    expect(z).toBeCloseTo(20 - 2.4, 5);
    expect(y).toBeCloseTo(4.76, 5);
    const [, yNavio] = pontoDoAdereco({ tipo: 'navioRebelde', x: 0, z: 0, giro: 0, escala: 2 }, 0, 10, 0);
    expect(yNavio, 'o navio flutua: base no nível do mar, escala aplicada').toBeCloseTo(-0.35 + 20, 5);
  });
});

describe('as poças, os feixes e os holofotes', () => {
  it('há uma poça sob cada poste da rua (o do píer não), uma na frente de cada barraca e a grande dos refletores no pátio', () => {
    const pocas = pocasDeLuz();
    const postesDaRua = praiaAderecos().filter((a) => a.tipo === 'poste' && (a.y ?? 0) <= 0.5).length;
    expect(pocas.length).toBe(postesDaRua + contar('barraca') + 1);
    for (const p of pocas) {
      expect(p.raio).toBeGreaterThan(5);
      expect(p.raio).toBeLessThan(20);
      expect(p.forca).toBeGreaterThan(0);
      expect(p.forca).toBeLessThan(1);
      expect(p.y, 'a poça fica sobre o chão').toBeGreaterThanOrEqual(alturaDoChao(p.x, p.z) - 0.001);
      expect(p.y, 'e rente a ele').toBeLessThan(Math.max(alturaDoChao(p.x, p.z), 0.12) + 0.2);
    }
    const grande = pocas[pocas.length - 1]!;
    expect(grande.x).toBe(CENTRO_DO_PATIO.x);
    expect(grande.raio).toBeGreaterThan(14);
  });

  it('os cinco refletores apontam para o pátio da estação, de um banco a ~14 m de altura, a uma distância razoável', () => {
    const feixes = feixesDosRefletores();
    expect(feixes.length).toBe(contar('refletor'));
    expect(feixes.length).toBe(5);
    for (const f of feixes) {
      expect(f.de[1]).toBeGreaterThan(13);
      expect(f.de[1]).toBeLessThan(17);
      expect(f.para[0]).toBeGreaterThan(PRAIA_COMPLEXO.minX);
      expect(f.para[0]).toBeLessThan(PRAIA_COMPLEXO.maxX);
      const comprimento = Math.hypot(f.para[0] - f.de[0], f.para[1] - f.de[1], f.para[2] - f.de[2]);
      expect(comprimento).toBeGreaterThan(25);
      expect(comprimento).toBeLessThan(75);
    }
  });

  it('as duas torres de vigia da estação têm holofote, girando em sentidos opostos', () => {
    const h = holofotesDaEstacao();
    expect(h.length).toBe(2);
    expect(Math.sign(h[0]!.velocidade)).not.toBe(Math.sign(h[1]!.velocidade));
    for (const x of h) {
      expect(x.y).toBeCloseTo(8, 0);
      expect(x.alcance).toBeGreaterThan(60);
      expect(x.x).toBeGreaterThan(PRAIA_COMPLEXO.minX);
      expect(x.x).toBeLessThan(PRAIA_COMPLEXO.maxX);
    }
  });
});
