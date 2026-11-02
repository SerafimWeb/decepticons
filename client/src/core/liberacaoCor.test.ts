import { describe, expect, it } from 'vitest';
import { padraoDe } from './funcionalidades';
import { Visibilidade } from './Visibilidade';

// P308 (02/11): a cor do casco sai do restrito. Sem escolha do Comandante gravada, o público vê a seção do Hangar;
// com o modo Comandante ou uma exceção gravada, o interruptor continua valendo (o que o Comandante decide, vale).
describe('a cor do casco liberada ao público (P308)', () => {
  it('o padrão do código é público: quem nunca mexeu no painel vê a seção COR DO CASCO', () => {
    expect(padraoDe('robo:pintura')).toBe('publico');
  });

  it('um jogador comum (sem o modo Comandante e sem exceção gravada) enxerga a seção', () => {
    const jogador = new Visibilidade(false, null);
    expect(jogador.estado('robo:pintura')).toBe('publico');
    expect(jogador.visivel('robo:pintura')).toBe(true);
  });

  it('uma exceção do Comandante (restrito) continua valendo sobre o padrão', () => {
    const armazem = { getItem: () => JSON.stringify({ itens: { 'robo:pintura': 'restrito' } }), setItem: () => {} };
    const jogador = new Visibilidade(false, armazem);
    expect(jogador.estado('robo:pintura')).toBe('restrito');
    expect(jogador.visivel('robo:pintura')).toBe(false);
  });
});
