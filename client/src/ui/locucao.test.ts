import { describe, expect, it } from 'vitest';
import { Locucao, type OpcoesDaLocucao } from './locucao';

function montar(parcial: Partial<OpcoesDaLocucao> = {}) {
  const falas: { texto: string; lang: string; volume: number }[] = [];
  let cancelou = 0;
  const l = new Locucao({
    sintetizador: { speak: (u) => falas.push(u as never), cancel: () => cancelou++ },
    criar: (texto) => ({ texto, lang: '', volume: 0, rate: 0 }) as never,
    ligada: () => true,
    volume: () => 0.8,
    ...parcial,
  });
  return { l, falas, cancelou: () => cancelou };
}

describe('a locução da abertura', () => {
  it('fala em português, no volume do jogo, cortando a frase anterior', () => {
    const { l, falas, cancelou } = montar();
    expect(l.falar('Rodada 2')).toBe(true);
    expect(l.falar('Combate!')).toBe(true);
    expect(falas.map((f) => f.texto)).toEqual(['Rodada 2', 'Combate!']);
    expect(falas[0]).toMatchObject({ lang: 'pt-BR', volume: 0.8 });
    expect(cancelou()).toBe(2);
  });

  it('sem sintetizador, com o som desligado, no volume zero ou sem texto: não fala e não falha', () => {
    expect(montar({ sintetizador: null }).l.falar('Combate!')).toBe(false);
    const m = montar({ ligada: () => false });
    expect(m.l.falar('Combate!')).toBe(false);
    expect(m.falas).toHaveLength(0);
    expect(montar({ volume: () => 0 }).l.falar('Combate!')).toBe(false);
    expect(montar().l.falar('   ')).toBe(false);
  });

  it('o volume do jogo é limitado a 0..1', () => {
    const { l, falas } = montar({ volume: () => 7 });
    l.falar('Combate!');
    expect(falas[0]!.volume).toBe(1);
  });

  it('um navegador que lança ao falar não derruba a partida', () => {
    const { l } = montar({
      sintetizador: {
        speak: () => {
          throw new Error('sem voz');
        },
        cancel: () => undefined,
      },
    });
    expect(l.falar('Combate!')).toBe(false);
  });
});
