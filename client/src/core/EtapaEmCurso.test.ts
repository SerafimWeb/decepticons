import { describe, expect, it } from 'vitest';
import { campanhasDeFabrica, linkDaEtapa } from '../sim/campanha';
import { EtapaEmCurso } from './EtapaEmCurso';

const op = campanhasDeFabrica()[1]!; // 1 Bunker DM (6) · 2 Cidade Neon DM (12) · 3 Bandeira · 4 Sobrevivência

describe('a etapa em curso', () => {
  it('Deathmatch: conta os abates, vence na meta e depois disso a etapa não muda mais', () => {
    const r = new EtapaEmCurso(op, 1);
    expect(r.meta).toBe(6);
    for (let i = 0; i < 5; i++) expect(r.abate()).toBe('em-curso');
    expect(r.abate()).toBe('vencida');
    expect(r.abate()).toBe('vencida');
    expect(r.abates).toBe(6); // o abate depois da vitória não entra na conta
    expect(r.proxima).toBe(2);
  });

  it('Sobrevivência: o fim com o jogador vivo vence, o outro perde; a decisão não se desfaz', () => {
    const vence = new EtapaEmCurso(op, 4);
    expect(vence.meta).toBeNull();
    expect(vence.abate()).toBe('em-curso'); // abates não decidem a Sobrevivência
    expect(vence.fimDaSobrevivencia(true)).toBe('vencida');
    expect(vence.fimDaSobrevivencia(false)).toBe('vencida');
    expect(new EtapaEmCurso(op, 4).fimDaSobrevivencia(false)).toBe('perdida');
    expect(vence.proxima).toBeNull(); // a última
  });

  it('Bandeira: o azul (o jogador) vence; o vermelho e o empate perdem', () => {
    expect(new EtapaEmCurso(op, 3).fimDaBandeira('blue')).toBe('vencida');
    expect(new EtapaEmCurso(op, 3).fimDaBandeira('red')).toBe('perdida');
    expect(new EtapaEmCurso(op, 3).fimDaBandeira(null)).toBe('perdida');
    const r = new EtapaEmCurso(op, 3);
    r.fimDaBandeira('red');
    expect(r.fimDaBandeira('blue')).toBe('perdida');
  });

  it('etapa que a campanha não tem é erro de quem chamou (nunca uma etapa fantasma)', () => {
    expect(() => new EtapaEmCurso(op, 0)).toThrow();
    expect(() => new EtapaEmCurso(op, 5)).toThrow();
  });

  it('o título e o objetivo vêm do contrato', () => {
    const r = new EtapaEmCurso(op, 2);
    expect(r.titulo).toBe('CIDADE NEON · DEATHMATCH');
    expect(r.objetivo).toBe('Abata 12 robôs');
    expect(r.total).toBe(4);
  });
});

describe('a etapa do link só vale se é a partida que está aberta', () => {
  it('o link da etapa abre o jogo no modo e no mapa dela, e então a etapa é reconhecida', () => {
    op.etapas.forEach((e, i) => {
      const r = EtapaEmCurso.doLink(linkDaEtapa(op, i + 1), e.mapa, e.modo, false);
      expect(r?.n, e.modo).toBe(i + 1);
    });
  });

  it('quem trocou o modo ou o mapa pelo menu mantém o ?campanha= mas sai da campanha; online também', () => {
    const busca = linkDaEtapa(op, 4); // Sobrevivência na Cidade Neon
    expect(EtapaEmCurso.doLink(busca, 'arena', 'deathmatch', false)).toBeNull();
    expect(EtapaEmCurso.doLink(busca, 'bunker', 'survival', false)).toBeNull();
    expect(EtapaEmCurso.doLink(busca, 'arena', 'survival', true)).toBeNull();
    expect(EtapaEmCurso.doLink('?modo=survival', 'arena', 'survival', false)).toBeNull();
    expect(EtapaEmCurso.doLink('?campanha=lixo&etapa=1', 'arena', 'survival', false)).toBeNull();
  });
});
