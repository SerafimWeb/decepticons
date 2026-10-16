import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEAPON_IDS, weapon, type WeaponId } from '../combat/weapons';
import { AMOSTRAS_DAS_ARMAS, ARQUIVOS_DAS_ARMAS } from './armasSom';

const mapa = JSON.parse(readFileSync(resolve('scripts/sons-armas.json'), 'utf8')) as { sons: { destino: string; ate: number; de: number }[] };

describe('sons de arma de referência (P146)', () => {
  it('toda arma da tabela existe no catálogo de armas', () => {
    for (const id of Object.keys(AMOSTRAS_DAS_ARMAS)) expect(WEAPON_IDS, id).toContain(id as WeaponId);
  });

  it('os arquivos que o jogo carrega são exatamente os que o `npm run sons` produz (sem som órfão nem som faltando)', () => {
    const produzidos = mapa.sons.map((s) => s.destino.replace(/\.mp3$/, '')).sort();
    expect([...ARQUIVOS_DAS_ARMAS].sort()).toEqual(produzidos);
  });

  it('o jogo não repete o carregamento: o canhão de cerco e o pesado dividem um arquivo', () => {
    expect(new Set(ARQUIVOS_DAS_ARMAS).size).toBe(ARQUIVOS_DAS_ARMAS.length);
    expect(AMOSTRAS_DAS_ARMAS.siege!.nome).toBe(AMOSTRAS_DAS_ARMAS.cannon!.nome);
    expect(AMOSTRAS_DAS_ARMAS.siege!.pitch).toBeLessThan(1); // mais grave
  });

  it('ganho, altura e duração são plausíveis, e a duração máxima cabe no arquivo (na altura dada)', () => {
    for (const [id, a] of Object.entries(AMOSTRAS_DAS_ARMAS)) {
      expect(a.ganho, id).toBeGreaterThan(0);
      expect(a.ganho, id).toBeLessThanOrEqual(1.2);
      expect(a.pitch, id).toBeGreaterThanOrEqual(0.5);
      expect(a.pitch, id).toBeLessThanOrEqual(2);
      const corte = mapa.sons.find((s) => `${a.nome}.mp3` === s.destino)!;
      // com a altura menor o arquivo toca mais devagar: dura (duração / altura); a duração máxima não deve passar disso
      expect(a.maxS, id).toBeLessThanOrEqual((corte.ate - corte.de) / a.pitch + 0.01);
      expect(a.maxS, id).toBeGreaterThan(0.2);
    }
  });

  it('o som não passa muito do intervalo entre tiros das armas de tiro rápido (senão um tiro cobre o seguinte)', () => {
    for (const id of ['plasma', 'blaster'] as const) {
      const a = AMOSTRAS_DAS_ARMAS[id]!;
      const intervalo = weapon(id).fireInterval;
      expect(a.maxS, id).toBeLessThanOrEqual(intervalo * 2.5); // o rabo pode cobrir um pouco: é o que dá corpo ao tiro; mais que isso vira borra
    }
  });
});
