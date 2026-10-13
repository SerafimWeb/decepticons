import { describe, expect, it } from 'vitest';
import { mapFromSearch } from '../environment/Bunker';
import { TEATROS } from '../ui/theater';
import {
  campanhaDoLink,
  campanhaPadrao,
  campanhasDeFabrica,
  CAMPANHA_VERSAO,
  chaveDaCampanha,
  ehACampanhaPadrao,
  FATOS_ZERADOS,
  LIMITES_DA_CAMPANHA,
  lerChaveDaCampanha,
  linkDaEtapa,
  MODOS,
  MODOS_DO_MAPA,
  objetivoDaEtapa,
  proximaEtapa,
  resultadoDaEtapa,
  sanearAbates,
  sanearCampanha,
  sanearEtapa,
  tituloDaEtapa,
  type CampanhaSpec,
  type EtapaDaCampanha,
} from './campanha';
import { chaveDoEsquadrao, esquadraoDoLink, esquadraoPadrao, excessosDoEsquadrao, type EsquadraoSpec } from './esquadrao';
import { gameModeFromSearch } from './gameMode';

const etapa = (parcial: Partial<EtapaDaCampanha> = {}): EtapaDaCampanha => ({ mapa: 'arena', modo: 'survival', esquadrao: esquadraoPadrao(), ...parcial });
const sem = (c: CampanhaSpec) => JSON.parse(JSON.stringify(c)) as CampanhaSpec;

describe('a campanha padrão é a Sobrevivência de hoje', () => {
  it('uma etapa só: Cidade Neon, Sobrevivência e o esquadrão de fábrica', () => {
    const c = campanhaPadrao();
    expect(c.etapas).toHaveLength(1);
    expect(c.etapas[0]).toEqual({ mapa: 'arena', modo: 'survival', esquadrao: esquadraoPadrao() });
    expect(ehACampanhaPadrao(c)).toBe(true);
    expect(ehACampanhaPadrao({ ...c, etapas: [{ ...c.etapas[0]!, mapa: 'arena', modo: 'deathmatch' }] })).toBe(false);
  });

  it('o que não é campanha, ou ficou sem etapa nenhuma, vira a padrão (nunca lança)', () => {
    for (const ruim of [null, undefined, 42, 'texto', [], {}, { v: 2, etapas: [etapa()] }, { v: CAMPANHA_VERSAO }, { v: CAMPANHA_VERSAO, etapas: [] }, { v: CAMPANHA_VERSAO, etapas: [null, 1, 'x'] }]) {
      expect(sanearCampanha(ruim), JSON.stringify(ruim)).toEqual(campanhaPadrao());
    }
  });
});

describe('sanear: o que vale e o que é cortado', () => {
  it('o Bunker só tem Deathmatch: a etapa de Sobrevivência ou Bandeira no Bunker é descartada', () => {
    expect(sanearEtapa(etapa({ mapa: 'bunker', modo: 'survival' }))).toBeNull();
    expect(sanearEtapa(etapa({ mapa: 'bunker', modo: 'ctf' }))).toBeNull();
    expect(sanearEtapa(etapa({ mapa: 'bunker', modo: 'deathmatch' }))).not.toBeNull();
    expect(sanearEtapa({ mapa: 'lua', modo: 'survival', esquadrao: esquadraoPadrao() })).toBeNull();
    expect(sanearEtapa({ mapa: 'arena', modo: 'xadrez', esquadrao: esquadraoPadrao() })).toBeNull();
    expect(sanearEtapa(null)).toBeNull();
  });

  it('a meta de abates só existe no Deathmatch, vai para os limites e o que não é número vira o padrão', () => {
    expect(sanearEtapa(etapa({ modo: 'survival', abates: 30 }))!.abates).toBeUndefined();
    expect(sanearEtapa(etapa({ modo: 'ctf', abates: 30 }))!.abates).toBeUndefined();
    expect(sanearEtapa(etapa({ modo: 'deathmatch', abates: 1 }))!.abates).toBe(LIMITES_DA_CAMPANHA.abatesMin);
    expect(sanearEtapa(etapa({ modo: 'deathmatch', abates: 9999 }))!.abates).toBe(LIMITES_DA_CAMPANHA.abatesMax);
    expect(sanearEtapa(etapa({ modo: 'deathmatch', abates: 12.9 }))!.abates).toBe(12);
    for (const ruim of [undefined, NaN, Infinity, '12', null]) expect(sanearAbates(ruim)).toBe(LIMITES_DA_CAMPANHA.abatesPadrao);
  });

  it('o esquadrão da etapa é limpo contra o mapa dela: o do Bunker é cortado para caber nos 11 pontos livres', () => {
    const grande: EsquadraoSpec = { v: 1, inimigos: Array.from({ length: 24 }, () => ({ papel: 'android' as const })), aliados: [] };
    const e = sanearEtapa({ mapa: 'bunker', modo: 'deathmatch', esquadrao: grande })!;
    expect(excessosDoEsquadrao(e.esquadrao, 'bunker')).toEqual([]);
    expect(e.esquadrao.inimigos.length).toBeLessThan(24);
    expect(sanearEtapa({ mapa: 'arena', modo: 'survival', esquadrao: 'lixo' })!.esquadrao).toEqual(esquadraoPadrao());
  });

  it('mais de oito etapas: as demais caem do fim; etapa torta no meio some e as outras ficam; o nome é limpo', () => {
    const muitas = Array.from({ length: 12 }, () => etapa());
    expect(sanearCampanha({ v: 1, etapas: muitas }).etapas).toHaveLength(LIMITES_DA_CAMPANHA.etapas);
    const c = sanearCampanha({ v: 1, nome: '  <b>Neon</b>   1  ', etapas: [etapa(), { mapa: 'bunker', modo: 'ctf' }, etapa({ modo: 'ctf' })] });
    expect(c.etapas.map((e) => e.modo)).toEqual(['survival', 'ctf']);
    expect(c.nome).toBe('bNeon/b 1');
  });

  it('é canônica: sanear duas vezes dá o mesmo, e etapas iguais saem iguais', () => {
    for (const c of campanhasDeFabrica()) expect(sanearCampanha(sem(c))).toEqual(c);
  });
});

describe('as campanhas de fábrica', () => {
  it('são válidas por inteiro: cada etapa passa no saneamento sem mudar e o esquadrão cabe no mapa dela', () => {
    for (const c of campanhasDeFabrica()) {
      expect(c.etapas.length).toBeGreaterThan(0);
      expect(c.etapas.length).toBeLessThanOrEqual(LIMITES_DA_CAMPANHA.etapas);
      for (const e of c.etapas) {
        expect(sanearEtapa(sem({ ...c, etapas: [e] }).etapas[0]), `${c.nome} ${tituloDaEtapa(e)}`).toEqual(e);
        expect(excessosDoEsquadrao(e.esquadrao, e.mapa)).toEqual([]);
      }
    }
  });

  it('a Operação Neon sobe de nível: Bunker, depois Marauder e Lancer na Cidade Neon, a Bandeira e a Sobrevivência', () => {
    const op = campanhasDeFabrica().find((c) => c.nome === 'OPERAÇÃO NEON')!;
    expect(op.etapas.map(tituloDaEtapa)).toEqual(['BUNKER · DEATHMATCH', 'CIDADE NEON · DEATHMATCH', 'CIDADE NEON · CAPTURAR A BANDEIRA', 'CIDADE NEON · SOBREVIVÊNCIA']);
    const chassis = op.etapas[1]!.esquadrao.inimigos.map((b) => b.chassi);
    expect(chassis).toContain('marauder');
    expect(chassis).toContain('lancerL1');
  });
});

describe('o link da campanha (nada é aplicado pela metade)', () => {
  it('cada campanha de fábrica sobrevive ao ir e voltar pelo texto, com nome, etapas, metas e esquadrões', () => {
    for (const c of campanhasDeFabrica()) {
      const chave = chaveDaCampanha(c);
      expect(chave.startsWith('c1~')).toBe(true);
      expect(chave).toMatch(/^[A-Za-z0-9._~!,:\-]+$/); // só o que vai sem escape em um link
      expect(lerChaveDaCampanha(chave)).toEqual(c);
    }
  });

  it('o nome com acento e sem nome nenhum viajam; um nome torto na chave recusa a chave inteira', () => {
    const comNome: CampanhaSpec = { v: 1, nome: 'Noite São João', etapas: [etapa()] };
    expect(lerChaveDaCampanha(chaveDaCampanha(comNome))).toEqual(comNome);
    const semNome: CampanhaSpec = { v: 1, etapas: [etapa()] };
    expect(lerChaveDaCampanha(chaveDaCampanha(semNome))).toEqual(semNome);
    expect(lerChaveDaCampanha('c1~@@@~as!q1.m.m')).toBeNull();
  });

  it('chave torta, de outra versão, sem etapa, com etapa a mais, meta fora dos limites ou modo que o mapa não tem: null', () => {
    const boa = chaveDaCampanha(campanhaPadrao());
    expect(lerChaveDaCampanha(boa)).not.toBeNull();
    const esq = chaveDoEsquadrao(esquadraoPadrao());
    const ruins = [
      '',
      'lixo',
      'c2~-~as!' + esq, // outra versão
      'c1~-', // sem etapa
      'c1~-~xs!' + esq, // mapa que não existe
      'c1~-~aw!' + esq, // modo que não existe
      'c1~-~bs!' + esq, // Bunker não tem Sobrevivência
      'c1~-~ad!' + esq, // Deathmatch sem meta
      'c1~-~as5!' + esq, // Sobrevivência com meta
      'c1~-~ad2!' + esq, // meta abaixo do mínimo
      'c1~-~ad99!' + esq, // meta acima do máximo
      'c1~-~as!q1.m.m.m', // esquadrão torto
      'c1~-~as!',
      ['c1', '-', ...Array.from({ length: 9 }, () => 'as!' + esq)].join('~'), // nove etapas
      boa + '~', // etapa vazia no fim
    ];
    for (const r of ruins) expect(lerChaveDaCampanha(r), r).toBeNull();
  });

  it('esquadrão grande demais para o Bunker, escrito à mão na chave, recusa a chave inteira (não vira esquadrão cortado em silêncio)', () => {
    const inimigos = Array.from({ length: 20 }, () => 'a').join(',');
    expect(lerChaveDaCampanha(`c1~-~bd6!q1.${inimigos}.-`)).toBeNull();
    expect(lerChaveDaCampanha(`c1~-~ad6!q1.${inimigos}.-`)).not.toBeNull(); // na Cidade Neon cabe
  });

  it('?campanha=&etapa= devolve a campanha e a etapa; falta um, etapa fora da campanha ou chave ruim: null', () => {
    const op = campanhasDeFabrica()[1]!;
    const q = (e: string, k = chaveDaCampanha(op)) => `?campanha=${encodeURIComponent(k)}&etapa=${e}`;
    expect(campanhaDoLink(q('3'))).toEqual({ campanha: op, etapa: 3 });
    for (const ruim of [q('0'), q('5'), q('-1'), q('1.5'), q('abc'), q('', 'lixo'), `?etapa=1`, `?campanha=${chaveDaCampanha(op)}`, '']) expect(campanhaDoLink(ruim), ruim).toBeNull();
    expect(campanhaDoLink(q('1', 'lixo'))).toBeNull();
  });
});

describe('jogar uma etapa é abrir o jogo com o link dela', () => {
  it('o link da etapa carrega o modo, o mapa e o esquadrão pelos parâmetros que o jogo já lê, mais a campanha e a etapa', () => {
    const op = campanhasDeFabrica()[1]!;
    op.etapas.forEach((e, i) => {
      const busca = linkDaEtapa(op, i + 1);
      expect(busca.startsWith('?')).toBe(true);
      expect(gameModeFromSearch(busca), tituloDaEtapa(e)).toBe(e.modo);
      expect(mapFromSearch(busca, false, e.modo), tituloDaEtapa(e)).toBe(e.mapa);
      expect(esquadraoDoLink(busca), tituloDaEtapa(e)).toEqual(e.esquadrao);
      expect(campanhaDoLink(busca)).toEqual({ campanha: op, etapa: i + 1 });
    });
  });

  it('etapa que não existe devolve texto vazio (nenhum link a abrir)', () => {
    const c = campanhaPadrao();
    expect(linkDaEtapa(c, 0)).toBe('');
    expect(linkDaEtapa(c, 2)).toBe('');
  });

  it('a próxima etapa vai até a última; depois dela a campanha acabou', () => {
    const op = campanhasDeFabrica()[1]!;
    expect(proximaEtapa(op, 1)).toBe(2);
    expect(proximaEtapa(op, 3)).toBe(4);
    expect(proximaEtapa(op, 4)).toBeNull();
    expect(proximaEtapa(campanhaPadrao(), 1)).toBeNull();
  });

  it('os modos de cada mapa concordam com o teatro do console (um lugar só diz onde roda o quê)', () => {
    for (const t of TEATROS) {
      if (!t.mapa) continue;
      expect([...MODOS_DO_MAPA[t.mapa]].sort(), t.nome).toEqual([...t.modos].sort());
    }
    expect(new Set(Object.values(MODOS_DO_MAPA).flat())).toEqual(new Set(MODOS));
  });
});

describe('quem venceu: o fim natural de cada modo', () => {
  const dm = etapa({ modo: 'deathmatch', abates: 5 });
  const sv = etapa({ modo: 'survival' });
  const ctf = etapa({ modo: 'ctf' });

  it('Deathmatch: vence ao chegar na meta de abates e nunca perde (o jogador renasce)', () => {
    expect(resultadoDaEtapa(dm, FATOS_ZERADOS)).toBe('em-curso');
    expect(resultadoDaEtapa(dm, { ...FATOS_ZERADOS, abates: 4 })).toBe('em-curso');
    expect(resultadoDaEtapa(dm, { ...FATOS_ZERADOS, abates: 5 })).toBe('vencida');
    expect(resultadoDaEtapa(dm, { ...FATOS_ZERADOS, abates: 9 })).toBe('vencida');
    expect(resultadoDaEtapa(etapa({ modo: 'deathmatch' }), { ...FATOS_ZERADOS, abates: LIMITES_DA_CAMPANHA.abatesPadrao })).toBe('vencida'); // sem meta: a padrão
  });

  it('Sobrevivência: limpar as ondas vence, cair perde, e os abates não contam', () => {
    expect(resultadoDaEtapa(sv, { ...FATOS_ZERADOS, abates: 99 })).toBe('em-curso');
    expect(resultadoDaEtapa(sv, { ...FATOS_ZERADOS, sobrevivencia: 'completed' })).toBe('vencida');
    expect(resultadoDaEtapa(sv, { ...FATOS_ZERADOS, sobrevivencia: 'failed' })).toBe('perdida');
  });

  it('Bandeira: vitória vence; derrota e empate perdem; o resto não conta', () => {
    expect(resultadoDaEtapa(ctf, { ...FATOS_ZERADOS, abates: 99, sobrevivencia: 'completed' })).toBe('em-curso');
    expect(resultadoDaEtapa(ctf, { ...FATOS_ZERADOS, ctf: 'vitoria' })).toBe('vencida');
    expect(resultadoDaEtapa(ctf, { ...FATOS_ZERADOS, ctf: 'derrota' })).toBe('perdida');
    expect(resultadoDaEtapa(ctf, { ...FATOS_ZERADOS, ctf: 'empate' })).toBe('perdida');
  });

  it('a frase do objetivo diz o que vence', () => {
    expect(objetivoDaEtapa(dm)).toBe('Abata 5 robôs');
    expect(objetivoDaEtapa(etapa({ modo: 'deathmatch' }))).toBe(`Abata ${LIMITES_DA_CAMPANHA.abatesPadrao} robôs`);
    expect(objetivoDaEtapa(sv)).toMatch(/ondas/);
    expect(objetivoDaEtapa(ctf)).toMatch(/bandeira/i);
  });
});
