import { describe, expect, it } from 'vitest';
import { AMAZONIA_LIMITES } from '../environment/AmazoniaLayout';
import { carregarMapaSeFor, exigirMapa } from '../environment/mapasSobDemanda';
import { plantaDaAmazoniaNoMinimapa } from './Minimapa';
import { fonteDoRadar } from './TacticalRadar';

const eu = { alive: true, yaw: 0, simPosition: { x: -960, z: -180 }, stats: { name: 'VECTOR-09' } };
const bot = { alive: true, yaw: 0, simPosition: { x: -790, z: -160 }, stats: { name: 'ANDRÓIDE A-1' } };

describe('o radar e o minimapa conhecem a Amazônia (P180, parte B)', () => {
  it('antes de o mapa carregar, o minimapa não acusa nem lança: a planta vem vazia (o jogo só chega nele depois de carregar)', () => {
    expect(plantaDaAmazoniaNoMinimapa()).toEqual({ caixas: [], zonas: [] });
  });

  it('o radar do console recebe o mapa retangular de 2,4 km com as estruturas e os marcos (aldeia, planta, mina, rejeitos), sem zonas nem mar', async () => {
    await carregarMapaSeFor('amazonia');
    const quadro = fonteDoRadar('amazonia', 100, [], () => eu, () => [bot], () => [])();
    expect(quadro.mapa).toBe('amazonia');
    expect(quadro.meia).toBe(AMAZONIA_LIMITES.maxX); // metade do comprimento, não os 100 m da Arena
    expect(quadro.meiaZ).toBe(AMAZONIA_LIMITES.maxZ);
    expect(quadro.caixas.length).toBeGreaterThan(30);
    expect(quadro.zonas).toEqual([]);
    expect(quadro.mar).toBeUndefined();
    expect(quadro.rotulos).toBe(exigirMapa('amazonia').rotulos);
    expect(quadro.voce).toEqual({ x: -960, z: -180, yaw: 0 });
    expect(quadro.inimigos).toEqual([{ x: -790, z: -160, grande: false }]);
  });

  it('a planta é calculada uma vez por radar (a mesma lista a cada quadro: G4), e os outros mapas não ganham o rótulo da Amazônia', async () => {
    await carregarMapaSeFor('amazonia');
    const fonte = fonteDoRadar('amazonia', 100, [], () => eu, () => [], () => []);
    expect(fonte().caixas).toBe(fonte().caixas);
    const arena = fonteDoRadar('arena', 100, [], () => eu, () => [], () => [])();
    expect(arena.meia).toBe(100);
    expect(arena.meiaZ).toBeUndefined();
    expect(arena.rotulos).toBeUndefined();
  });

  it('o minimapa da partida leva as estruturas sólidas da Amazônia, sem zonas de cura, e é a mesma planta do radar', async () => {
    await carregarMapaSeFor('amazonia');
    const planta = plantaDaAmazoniaNoMinimapa();
    expect(planta.caixas.length).toBeGreaterThan(30);
    expect(planta.zonas).toEqual([]);
    expect(planta.caixas).toEqual([...exigirMapa('amazonia').caixasDaPlanta()]);
  });
});
