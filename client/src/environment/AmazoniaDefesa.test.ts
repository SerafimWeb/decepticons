import { describe, expect, it } from 'vitest';
import { INVASAO } from '../sim/InvasaoDoDraga';
import { aderecosDaAmazonia } from './AmazoniaAderecos';
import { bocasDasTorres } from './AmazoniaGeradores';
import { AMAZONIA_GERADORES, AMAZONIA_GUARDA, AMAZONIA_POSTO_AVANCADO, AMAZONIA_RESISTENCIA, estaNoRio } from './AmazoniaLayout';
import { TORRES_DE_VIGIA } from '../sim/TorresDeVigia';

const solidas = aderecosDaAmazonia().filter((a) => a.solido);
const dentroDeEstrutura = (x: number, z: number, folga: number): string | null => {
  for (const a of solidas) {
    const raio = a.forma === 'caixa' ? Math.hypot(a.w, a.d) / 2 : a.w;
    if (Math.hypot(a.x - x, a.z - z) < raio + folga) return `(${a.x.toFixed(0)}, ${a.z.toFixed(0)})`;
  }
  return null;
};

describe('os pontos de nascimento da defesa e da Resistência na Amazônia (P180, partes D2 e E)', () => {
  it('a guarda (3 Mechs e 6 androides) não nasce no rio nem dentro de uma estrutura sólida', () => {
    for (const [x, z] of [...AMAZONIA_GUARDA.mechs, ...AMAZONIA_GUARDA.androids]) {
      expect(estaNoRio(x, z), `guarda em (${x}, ${z}) no rio`).toBe(false);
      expect(dentroDeEstrutura(x, z, 3), `guarda em (${x}, ${z}) dentro de uma estrutura`).toBeNull();
    }
  });

  it('o posto avançado (onde o jogador nasce na missão) fica em terra firme, fora do alcance das torres e a menos de 450 m da cerca: a corrida até o primeiro gerador dura menos de um minuto', () => {
    const { x, z } = AMAZONIA_POSTO_AVANCADO;
    expect(estaNoRio(x, z)).toBe(false);
    expect(dentroDeEstrutura(x, z, 3)).toBeNull();
    for (const t of bocasDasTorres()) expect(Math.hypot(t.x - x, t.z - z), `torre em (${t.x.toFixed(0)}, ${t.z.toFixed(0)}) alcança o posto`).toBeGreaterThan(TORRES_DE_VIGIA.alcanceM + 20);
    const cerca = AMAZONIA_GERADORES[0]!;
    const corrida = Math.hypot(cerca.x - x, cerca.z - z);
    expect(corrida).toBeLessThan(450);
    expect(corrida / 9, 'segundos até a cerca a 9 m/s').toBeLessThan(55);
  });

  it('a Resistência tem um ponto por andróide da invasão, junto do posto avançado (menos de 40 m), fora do rio e de estrutura, e sem ninguém por cima de ninguém', () => {
    expect(AMAZONIA_RESISTENCIA).toHaveLength(INVASAO.androides);
    const pontos = [[AMAZONIA_POSTO_AVANCADO.x, AMAZONIA_POSTO_AVANCADO.z] as const, ...AMAZONIA_RESISTENCIA];
    for (const [x, z] of AMAZONIA_RESISTENCIA) {
      expect(Math.hypot(x - AMAZONIA_POSTO_AVANCADO.x, z - AMAZONIA_POSTO_AVANCADO.z), `(${x}, ${z}) longe do posto`).toBeLessThan(40);
      expect(estaNoRio(x, z)).toBe(false);
      expect(dentroDeEstrutura(x, z, 3), `Resistência em (${x}, ${z}) dentro de uma estrutura`).toBeNull();
    }
    for (let i = 0; i < pontos.length; i++) {
      for (let j = i + 1; j < pontos.length; j++) expect(Math.hypot(pontos[i]![0] - pontos[j]![0], pontos[i]![1] - pontos[j]![1])).toBeGreaterThan(8);
    }
  });
});
