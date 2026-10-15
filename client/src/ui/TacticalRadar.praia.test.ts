import { describe, expect, it } from 'vitest';
import { PRAIA_ESTACAO, PRAIA_PIER, PRAIA_ZONES } from '../environment/PraiaLayout';
import { PRAIA_LIMITES } from '../environment/PraiaTerreno';
import { paraMinimapa, plantaDaPraiaNoMinimapa, pontoDaEstacao, type PontoMapa } from './Minimapa';
import { caixasDaPraia, fonteDoRadar, ROTULOS_DA_PRAIA } from './TacticalRadar';

const eu = { alive: true, yaw: 0, simPosition: { x: 262, z: 16 }, stats: { name: 'VECTOR-09' } };
const bot = { alive: true, yaw: 0, simPosition: { x: 100, z: 20 }, stats: { name: 'ANDRÓIDE A-1' } };

describe('o radar e o minimapa conhecem a praia (P127)', () => {
  it('a planta da praia mostra o que fecha caminho (prédios, muros, contêineres), tudo dentro do mapa, sem o tabuleiro do píer', () => {
    const caixas = caixasDaPraia();
    expect(caixas.length).toBeGreaterThan(60);
    for (const c of caixas) {
      expect(c.x0).toBeLessThan(c.x1);
      expect(c.z0).toBeLessThan(c.z1);
      expect(c.x0).toBeGreaterThanOrEqual(PRAIA_LIMITES.minX - 1);
      expect(c.x1).toBeLessThanOrEqual(PRAIA_LIMITES.maxX + 1);
    }
    // O prédio da estação está lá.
    expect(caixas.some((c) => c.x0 < PRAIA_ESTACAO.x && c.x1 > PRAIA_ESTACAO.x && c.z0 < PRAIA_ESTACAO.z && c.z1 > PRAIA_ESTACAO.z)).toBe(true);
    // O tabuleiro do píer (comprido e baixo, 0,7 m) se anda por cima, não fecha caminho: não entra na planta.
    expect(caixas.some((c) => c.x0 > PRAIA_PIER.x - 6 && c.x1 < PRAIA_PIER.x + 6 && c.z1 - c.z0 > 40)).toBe(false);
  });

  it('o radar do console recebe o mapa retangular da praia, com o mar, as zonas e os marcos (antes desenhava a planta vazia da Arena)', () => {
    const quadro = fonteDoRadar('praia', 100, [], () => eu, () => [bot], () => [])();
    expect(quadro.mapa).toBe('praia');
    expect(quadro.meia).toBe(PRAIA_LIMITES.maxX); // metade do comprimento, não os 100 m da Arena
    expect(quadro.meiaZ).toBe(PRAIA_LIMITES.maxZ);
    expect(quadro.caixas.length).toBeGreaterThan(60);
    expect(quadro.zonas).toBe(PRAIA_ZONES);
    expect(quadro.mar!.length).toBeGreaterThan(30);
    expect(quadro.rotulos).toBe(ROTULOS_DA_PRAIA);
    expect(quadro.voce).toEqual({ x: 262, z: 16, yaw: 0 });
    expect(quadro.inimigos).toEqual([{ x: 100, z: 20, grande: false }]); // o andróide é o ponto pequeno
  });

  it('na Arena nada muda: o quadro continua quadrado, sem mar nem marcos', () => {
    const quadro = fonteDoRadar('arena', 100, [], () => eu, () => [], () => [])();
    expect(quadro.meia).toBe(100);
    expect(quadro.meiaZ).toBeUndefined();
    expect(quadro.mar).toBeUndefined();
    expect(quadro.zonas).toBeUndefined();
  });

  it('o minimapa da partida leva o mar (a linha d’água de ponta a ponta), as zonas e as caixas', () => {
    const planta = plantaDaPraiaNoMinimapa();
    expect(planta.caixas.length).toBeGreaterThan(60);
    expect(planta.zonas).toHaveLength(PRAIA_ZONES.length);
    expect(planta.mar![0]![0]).toBe(PRAIA_LIMITES.minX);
    expect(planta.mar![planta.mar!.length - 1]![0]).toBe(PRAIA_LIMITES.maxX);
  });

  it('a estação é o ponto E do minimapa: longe, fica presa na borda e aponta a direção do objetivo', () => {
    const [ponto] = pontoDaEstacao();
    expect(ponto!.def).toEqual({ letra: 'E', x: PRAIA_ESTACAO.x, z: PRAIA_ESTACAO.z });
    const fora: PontoMapa = { x: 0, y: 0, borda: false };
    // De oeste, olhando para o norte (yaw 0), a estação (a leste) está à direita e longe: presa na borda direita.
    paraMinimapa(PRAIA_ESTACAO.x - -150, PRAIA_ESTACAO.z - 27, 0, 1, 50, fora);
    expect(fora.borda).toBe(true);
    expect(fora.x).toBeGreaterThan(0);
    // Dentro do alcance, o ponto fica onde está (sem borda).
    paraMinimapa(10, -10, 0, 1, 50, fora);
    expect(fora.borda).toBe(false);
  });
});
