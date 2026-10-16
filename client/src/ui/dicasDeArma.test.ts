import { describe, expect, it } from 'vitest';
import { weapon, WEAPON_IDS } from '../combat/weapons';
import { DICA_DA_ARMA, DicasVistas, dicaDaArma, todasAsDicas, type Memoria } from './dicasDeArma';

/**
 * A dica de primeiro uso de cada arma (P160 parte 5). O defeito que isto trava: uma dica só, "FOGUETES: DANO EM ÁREA", aparecia para toda arma de
 * munição, então a granada, o enxame e o cruzador pareciam o foguete (o Comandante, 15/10: "parece que são armas antigas").
 */

/** Um armazenamento falso (o `localStorage` do navegador não existe no Node). */
function memoria(inicial: Record<string, string> = {}): Memoria & { dados: Record<string, string> } {
  const dados = { ...inicial };
  return { dados, getItem: (k) => dados[k] ?? null, setItem: (k, v) => void (dados[k] = v) };
}

describe('uma frase por arma', () => {
  it('toda arma do catálogo tem a sua, curta, e nenhuma se repete (a granada não diz "foguetes")', () => {
    const dicas = todasAsDicas();
    expect(dicas.map((d) => d.id).sort()).toEqual([...WEAPON_IDS].sort());
    const textos = dicas.map((d) => d.texto);
    expect(new Set(textos).size).toBe(textos.length);
    for (const d of dicas) {
      expect(d.texto.length, d.id).toBeGreaterThan(20);
      expect(d.texto.length, d.id).toBeLessThanOrEqual(95); // cabe em duas linhas no celular
      expect(d.texto, d.id).toBe(d.texto.toUpperCase()); // o tom das outras dicas
    }
    expect(dicaDaArma(weapon('grenade'))).not.toMatch(/FOGUETE/);
    expect(dicaDaArma(weapon('swarm'))).not.toMatch(/FOGUETE/);
    expect(dicaDaArma(weapon('cruise'))).not.toMatch(/FOGUETE/);
  });

  it('os números da dica saem da arma: o lançador leve diz quantos mísseis o nível leva, a granada o alcance, o trilho a carga', () => {
    expect(dicaDaArma(weapon('swarm', 0))).toContain('8 MÍSSEIS');
    expect(dicaDaArma(weapon('swarm', 2))).toContain('32 MÍSSEIS');
    expect(dicaDaArma(weapon('grenade'))).toContain('80 M');
    expect(dicaDaArma(weapon('railgun'))).toContain('0,85 S');
    expect(dicaDaArma(weapon('siege'))).toContain('2,4 S');
    expect(dicaDaArma(weapon('seeker'))).toContain('110 M');
    expect(dicaDaArma(weapon('shotgun'))).toContain('9 BALINS');
    expect(dicaDaArma(weapon('barrage'))).toContain('8 BOMBAS');
  });

  it('o `Record` é de funções que recebem a arma: o nível dela muda o texto', () => {
    expect(DICA_DA_ARMA.swarm(weapon('swarm', 1))).not.toBe(DICA_DA_ARMA.swarm(weapon('swarm', 0)));
  });
});

describe('a memória das dicas vistas', () => {
  it('mostra uma vez só: depois de marcada, a dica não volta, nem numa visita nova', () => {
    const m = memoria();
    const a = new DicasVistas(m);
    const g = weapon('grenade');
    expect(a.pendente(g)).toBe(dicaDaArma(g));
    a.marcar(g);
    expect(a.pendente(g)).toBeNull();
    expect(a.pendente(weapon('swarm'))).not.toBeNull(); // as outras armas seguem pendentes
    const b = new DicasVistas(m); // outra visita: lê do armazenamento
    expect(b.pendente(g)).toBeNull();
    expect(b.pendente(weapon('laser'))).not.toBeNull();
  });

  it('o nível não importa: a dica é da arma (o MK III da granada não repete a do MK I)', () => {
    const a = new DicasVistas(memoria());
    a.marcar(weapon('grenade', 0));
    expect(a.pendente(weapon('grenade', 2))).toBeNull();
  });

  it('armazenamento ausente, quebrado ou ilegível não quebra nada: a dica vale uma vez por abertura', () => {
    const semMemoria = new DicasVistas(null);
    semMemoria.marcar(weapon('cruise'));
    expect(semMemoria.pendente(weapon('cruise'))).toBeNull();

    const lixo = new DicasVistas(memoria({ [DicasVistas.CHAVE]: '{não é uma lista' }));
    expect(lixo.pendente(weapon('laser'))).not.toBeNull();
    const estranho = new DicasVistas(memoria({ [DicasVistas.CHAVE]: JSON.stringify([1, null, 'laser']) }));
    expect(estranho.pendente(weapon('laser'))).toBeNull();
    expect(estranho.pendente(weapon('cruise'))).not.toBeNull();

    const cheio: Memoria = { getItem: () => null, setItem: () => { throw new Error('cheio'); } };
    const c = new DicasVistas(cheio);
    expect(() => c.marcar(weapon('laser'))).not.toThrow();
    expect(c.pendente(weapon('laser'))).toBeNull();
  });
});
