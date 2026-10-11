import { describe, expect, it } from 'vitest';
import { StatusSet, STATUS, type StatusKind } from '../combat/StatusEffects';
import type { StatusView } from '../ui/status';
import { StatusHud, type StatusHudSink } from './statusHud';

/** Um destino de mentira que anota o que a tela e o som receberiam. */
function destino() {
  const entradas: StatusKind[] = [];
  const lacos: Array<StatusKind | null> = [];
  const listas: Array<readonly StatusView[]> = [];
  const copias: string[][] = [];
  const sink: StatusHudSink = {
    badges: (list) => {
      listas.push(list);
      copias.push(list.map((v) => v.kind));
    },
    entered: (kind) => entradas.push(kind),
    loop: (kind) => lacos.push(kind),
  };
  return { sink, entradas, lacos, listas, copias };
}

describe('StatusHud: a ponte entre os estados do jogador e a tela e o som do Gemini', () => {
  it('sem estado nenhum: lista vazia, nenhum som', () => {
    const d = destino();
    const hud = new StatusHud(d.sink);
    hud.update(new StatusSet(), true);
    expect(d.copias).toEqual([[]]);
    expect(d.entradas).toEqual([]);
    expect(d.lacos).toEqual([]);
  });

  it('o choque aparece com o tempo que falta; o som de entrada toca uma vez só e o laço liga uma vez só', () => {
    const d = destino();
    const hud = new StatusHud(d.sink);
    const s = new StatusSet();
    s.shockUp(false);
    for (let i = 0; i < 30; i++) {
      hud.update(s, true);
      s.step(1 / 60);
    }
    expect(d.copias.every((c) => c.length === 1 && c[0] === 'chocado')).toBe(true);
    const ultima = d.listas.at(-1)![0]!;
    expect(ultima.left).toBeLessThan(STATUS.shockTime);
    expect(ultima.left).toBeGreaterThan(STATUS.shockTime - 0.6);
    expect(d.entradas).toEqual(['chocado']);
    expect(d.lacos).toEqual(['chocado']);
  });

  it('um estado novo por cima toca o som dele e manda no laço (o atordoamento vence o choque); ao acabar, o laço volta ao choque e depois a nenhum', () => {
    const d = destino();
    const hud = new StatusHud(d.sink);
    const s = new StatusSet();
    s.shockUp(false);
    hud.update(s, true);
    s.shockUp(true); // tiro na cabeça: atordoa
    hud.update(s, true);
    expect(d.entradas).toEqual(['chocado', 'atordoado']);
    expect(d.lacos).toEqual(['chocado', 'atordoado']);
    for (let i = 0; i < Math.round((STATUS.stunTime + 0.1) * 60); i++) s.step(1 / 60);
    hud.update(s, true);
    expect(d.lacos.at(-1)).toBe('chocado');
    for (let i = 0; i < Math.round((STATUS.shockTime + 0.1) * 60); i++) s.step(1 / 60);
    hud.update(s, true);
    expect(d.lacos.at(-1)).toBeNull();
    expect(d.copias.at(-1)).toEqual([]);
  });

  it('o congelado manda no laço sobre o fogo e o gelo; o gelado leva o nível dos acúmulos', () => {
    const d = destino();
    const hud = new StatusHud(d.sink);
    const s = new StatusSet();
    s.chillUp();
    hud.update(s, true);
    expect(d.listas.at(-1)![0]).toMatchObject({ kind: 'gelado' });
    expect(d.listas.at(-1)![0]!.level).toBeCloseTo(1 / STATUS.chillMax, 5);
    s.chillUp();
    s.chillUp(); // 3 acúmulos congelam
    hud.update(s, true);
    expect(d.copias.at(-1)).toContain('congelado');
    expect(d.lacos.at(-1)).toBe('congelado');
  });

  it('morrer apaga tudo (tela e laço) e, ao voltar com o mesmo estado, o som de entrada toca de novo', () => {
    const d = destino();
    const hud = new StatusHud(d.sink);
    const s = new StatusSet();
    s.burnUp();
    hud.update(s, true);
    hud.update(s, false); // morto
    expect(d.copias.at(-1)).toEqual([]);
    expect(d.lacos).toEqual(['queimando', null]);
    hud.update(s, true); // renasceu ainda queimando (o teste não limpa o estado)
    expect(d.entradas).toEqual(['queimando', 'queimando']);
  });

  it('nada é alocado por quadro: a lista e cada StatusView são sempre os mesmos objetos', () => {
    const d = destino();
    const hud = new StatusHud(d.sink);
    const s = new StatusSet();
    s.shockUp(false);
    hud.update(s, true);
    const lista = d.listas[0]!;
    const view = lista[0]!;
    for (let i = 0; i < 20; i++) {
      s.step(1 / 60);
      hud.update(s, true);
    }
    expect(d.listas.every((l) => l === lista)).toBe(true);
    expect(d.listas.at(-1)![0]).toBe(view);
  });

  it('os cinco estados ao mesmo tempo cabem sem estourar a reserva', () => {
    const d = destino();
    const hud = new StatusHud(d.sink);
    const todos = { forEachActive: (fn: (kind: StatusKind, left: number, level: number) => void) => {
      for (const k of ['queimando', 'chocado', 'atordoado', 'gelado', 'congelado'] as const) fn(k, 1, 1);
    } } as unknown as StatusSet;
    hud.update(todos, true);
    expect(d.copias[0]).toEqual(['queimando', 'chocado', 'atordoado', 'gelado', 'congelado']);
    expect(d.entradas).toHaveLength(5);
  });
});

describe('MechBase.statuses e StatusSet.kinds: o que o painel do alvo lê', () => {
  it('lista os estados ligados na ordem de sempre, sempre no mesmo objeto, e esvazia quando acabam', () => {
    const s = new StatusSet();
    const lista = s.kinds();
    expect(lista).toEqual([]);
    s.burnUp();
    s.shockUp(false);
    expect(s.kinds()).toEqual(['queimando', 'chocado']);
    expect(s.kinds()).toBe(lista);
    for (let i = 0; i < Math.round((STATUS.burnTime + STATUS.shockTime) * 60); i++) s.step(1 / 60);
    expect(s.kinds()).toEqual([]);
  });
});
