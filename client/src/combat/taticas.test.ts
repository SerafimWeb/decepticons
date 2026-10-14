import { describe, expect, it } from 'vitest';
import { PARAM_DA_TATICA, TATICA_PADRAO, TATICAS, parametrosDaTatica, taticaDeTexto, type TaticaId } from './taticas';

describe('táticas pré-selecionadas (P122)', () => {
  describe('o catálogo', () => {
    it('cada tática tem nome, descrição e parâmetros, e o id bate com a chave', () => {
      for (const id of Object.keys(TATICAS) as TaticaId[]) {
        const t = TATICAS[id];
        expect(t.id, id).toBe(id);
        expect(t.nome.length, id).toBeGreaterThan(0);
        expect(t.descricao.length, id).toBeGreaterThan(0);
        expect(t.formacaoLargura, id).toBeGreaterThan(0);
        expect(t.leash, id).toBeGreaterThan(0);
      }
    });

    it('as três prontas abrem a formação (flanco) ou apertam (proteger) em relação ao centro', () => {
      expect(TATICAS.flanco.formacaoLargura).toBeGreaterThan(TATICAS.centro.formacaoLargura);
      expect(TATICAS.flanco.leash).toBeGreaterThan(TATICAS.centro.leash);
      expect(TATICAS.proteger.formacaoLargura).toBeLessThan(TATICAS.centro.formacaoLargura);
      expect(TATICAS.proteger.leash).toBeLessThan(TATICAS.centro.leash);
      for (const id of ['centro', 'flanco', 'proteger'] as const) expect(TATICAS[id].pronta, id).toBe(true);
    });

    it('as reservadas existem na lista mas se declaram não prontas', () => {
      for (const id of ['recuar', 'distrair'] as const) expect(TATICAS[id].pronta, id).toBe(false);
    });
  });

  describe('taticaDeTexto (o link ?tatica=)', () => {
    it('aceita só os ids do catálogo', () => {
      expect(taticaDeTexto('flanco')).toBe('flanco');
      expect(taticaDeTexto('proteger')).toBe('proteger');
      expect(taticaDeTexto('recuar')).toBe('recuar');
    });

    it('recusa o que não é tática: vazio, desconhecido, maiúsculas e chave de protótipo', () => {
      expect(taticaDeTexto(null)).toBeNull();
      expect(taticaDeTexto('')).toBeNull();
      expect(taticaDeTexto(undefined)).toBeNull();
      expect(taticaDeTexto('FLANCO')).toBeNull();
      expect(taticaDeTexto('xpto')).toBeNull();
      expect(taticaDeTexto('constructor')).toBeNull();
      expect(taticaDeTexto('toString')).toBeNull();
    });

    it('o parâmetro do link é o declarado', () => {
      expect(PARAM_DA_TATICA).toBe('tatica');
    });
  });

  describe('parametrosDaTatica (o que o esquadrão obedece)', () => {
    it('devolve os parâmetros da tática pronta', () => {
      expect(parametrosDaTatica('flanco')).toBe(TATICAS.flanco);
      expect(parametrosDaTatica('proteger')).toBe(TATICAS.proteger);
    });

    it('ausente ou reservada cai no padrão: uma tática não pronta não muda o jogo', () => {
      expect(parametrosDaTatica(null)).toBe(TATICAS[TATICA_PADRAO]);
      expect(parametrosDaTatica(undefined)).toBe(TATICAS[TATICA_PADRAO]);
      for (const id of ['recuar', 'distrair'] as const) expect(parametrosDaTatica(id), id).toBe(TATICAS[TATICA_PADRAO]);
    });
  });
});
