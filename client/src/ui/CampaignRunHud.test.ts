import { describe, expect, it } from 'vitest';
import { EtapaEmCurso } from '../core/EtapaEmCurso';
import { campanhaPadrao, campanhasDeFabrica } from '../sim/campanha';
import { painelDeFim, textoDaFaixa } from './CampaignRunHud';

const op = campanhasDeFabrica()[1]!; // 1 Bunker DM (6) · 2 Cidade Neon DM (12) · 3 Bandeira · 4 Sobrevivência

describe('a faixa da campanha na partida', () => {
  it('diz a campanha, a etapa, o objetivo e, no Deathmatch, o andamento da meta', () => {
    const r = new EtapaEmCurso(op, 2);
    expect(textoDaFaixa(r)).toBe('OPERAÇÃO NEON · ETAPA 2/4 · ABATA 12 ROBÔS · 0/12');
    r.abate();
    r.abate();
    expect(textoDaFaixa(r)).toBe('OPERAÇÃO NEON · ETAPA 2/4 · ABATA 12 ROBÔS · 2/12');
  });

  it('sem meta nos outros modos, e a campanha sem nome usa o título automático', () => {
    expect(textoDaFaixa(new EtapaEmCurso(op, 4))).toBe('OPERAÇÃO NEON · ETAPA 4/4 · LIMPE TODAS AS ONDAS');
    expect(textoDaFaixa(new EtapaEmCurso(op, 3))).toBe('OPERAÇÃO NEON · ETAPA 3/4 · VENÇA A PARTIDA DE BANDEIRA');
    const semNome = { ...op, nome: undefined };
    delete semNome.nome;
    expect(textoDaFaixa(new EtapaEmCurso(semNome, 1))).toBe('CAMPANHA · 4 ETAPAS · ETAPA 1/4 · ABATA 6 ROBÔS · 0/6');
  });

  it('o contador não passa da meta', () => {
    const r = new EtapaEmCurso(op, 1);
    for (let i = 0; i < 10; i++) r.abate();
    expect(textoDaFaixa(r)).toMatch(/6\/6$/);
  });
});

describe('o painel do fim da etapa', () => {
  it('enquanto a etapa segue não há painel', () => {
    expect(painelDeFim(new EtapaEmCurso(op, 1))).toBeNull();
  });

  it('etapa vencida com outra pela frente: a próxima é a ação principal e dá para sair', () => {
    const r = new EtapaEmCurso(op, 3);
    r.fimDaBandeira('blue');
    const p = painelDeFim(r)!;
    expect(p.classe).toBe('vencida');
    expect(p.titulo).toBe('ETAPA CONCLUÍDA');
    expect(p.acoes.map((a) => [a.id, a.primaria])).toEqual([['proxima', true], ['sair', false]]);
    expect(p.acoes[0]!.rotulo).toContain('ETAPA 4');
  });

  it('a última etapa vencida fecha a campanha: uma ação só, voltar ao console', () => {
    const r = new EtapaEmCurso(op, 4);
    r.fimDaSobrevivencia(true);
    const p = painelDeFim(r)!;
    expect(p.classe).toBe('completa');
    expect(p.titulo).toBe('CAMPANHA CONCLUÍDA');
    expect(p.subtitulo).toBe('OPERAÇÃO NEON · 4 ETAPAS');
    expect(p.acoes.map((a) => a.id)).toEqual(['sair']);
    // A campanha de uma etapa só também termina ali.
    const unica = new EtapaEmCurso(campanhaPadrao(), 1);
    unica.fimDaSobrevivencia(true);
    expect(painelDeFim(unica)!.classe).toBe('completa');
  });

  it('etapa perdida: tentar de novo é a principal e nunca oferece a próxima', () => {
    const r = new EtapaEmCurso(op, 4);
    r.fimDaSobrevivencia(false);
    const p = painelDeFim(r)!;
    expect(p.classe).toBe('perdida');
    expect(p.titulo).toBe('ETAPA PERDIDA');
    expect(p.acoes.map((a) => [a.id, a.primaria])).toEqual([['repetir', true], ['sair', false]]);
  });
});
