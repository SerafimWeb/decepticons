import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEAPON_IDS, type WeaponId } from '../combat/weapons';
import { AMOSTRAS_DAS_ARMAS, ARQUIVOS_DAS_ARMAS } from './armasSom';

const mapa = JSON.parse(readFileSync(resolve('scripts/sons-armas.json'), 'utf8')) as { sons: { destino: string; ate: number; de: number; efeitos?: { velocidade?: number } }[] };

/**
 * A tabela é um DADO que o Estúdio de Sons edita (`armasSom.json`): estes testes cobram só a estrutura (o jogo não quebra nem fica mudo), nunca o gosto
 * (qual clipe, que ganho, que altura): isso é do ouvido do Comandante e não pode travar o `npm run check`.
 */
describe('sons de arma de referência (P146)', () => {
  it('toda arma da tabela existe no catálogo de armas', () => {
    for (const id of Object.keys(AMOSTRAS_DAS_ARMAS)) expect(WEAPON_IDS, id).toContain(id as WeaponId);
  });

  it('todo clipe que uma arma usa é produzido pelo `npm run sons` (senão o jogo carregaria um arquivo que não existe)', () => {
    const produzidos = new Set(mapa.sons.map((s) => s.destino.replace(/\.mp3$/, '')));
    for (const [id, a] of Object.entries(AMOSTRAS_DAS_ARMAS)) expect(produzidos.has(a.nome), `${id} → ${a.nome}`).toBe(true);
  });

  it('o jogo carrega cada arquivo uma vez só, mesmo que duas armas o dividam', () => {
    expect(new Set(ARQUIVOS_DAS_ARMAS).size).toBe(ARQUIVOS_DAS_ARMAS.length);
    expect(ARQUIVOS_DAS_ARMAS.length).toBeLessThanOrEqual(Object.keys(AMOSTRAS_DAS_ARMAS).length);
  });

  it('ganho, altura e duração estão em faixas seguras, e a duração máxima cabe no clipe (na altura dada)', () => {
    for (const [id, a] of Object.entries(AMOSTRAS_DAS_ARMAS)) {
      expect(a.ganho, id).toBeGreaterThan(0);
      expect(a.ganho, id).toBeLessThanOrEqual(1.5);
      expect(a.pitch, id).toBeGreaterThanOrEqual(0.5);
      expect(a.pitch, id).toBeLessThanOrEqual(2);
      const corte = mapa.sons.find((s) => `${a.nome}.mp3` === s.destino)!;
      // a duração do clipe é a de DEPOIS dos efeitos (a velocidade a muda), e a altura da arma a muda de novo
      expect(a.maxS, id).toBeLessThanOrEqual((corte.ate - corte.de) / (corte.efeitos?.velocidade ?? 1) / a.pitch + 0.01);
      expect(a.maxS, id).toBeGreaterThanOrEqual(0.1);
    }
  });
});
