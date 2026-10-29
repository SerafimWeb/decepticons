import { describe, expect, it } from 'vitest';
import { ROOM_SIZE, ROOM_UNITS } from '../../../shared/net/constants';
import { REGRAS_PADRAO } from '../../../shared/regras';
import { WEAPON_IDS } from '../combat/weapons';
import { armasDoBot, ESQUADRAO_VERSAO, type BotSpec, type EsquadraoSpec } from './esquadrao';
import { chaveDoEsquadraoOnline, esquadraoDasRegras, esquadraoParaOnline, esquadraoValeNoMapa, lerRespostaDoEsquadrao, LIMITES_ONLINE, limitesOnline, montagemDoBot, pareceEsquadrao } from './esquadraoOnline';
import { factorySpec, loadoutKey, parseLoadoutKey, validateLoadout } from '../hangar/loadout';

const esquadrao = (inimigos: BotSpec[], aliados: BotSpec[] = []): EsquadraoSpec => ({ v: ESQUADRAO_VERSAO, inimigos, aliados });
const mech = (extra: Partial<BotSpec> = {}): BotSpec => ({ papel: 'mech', ...extra });
const papeis = (e: EsquadraoSpec) => e.inimigos.map((b) => b.papel);

describe('o esquadrão das salas online (P270): o que a sala aceita', () => {
  it('o teto é o da sala que já se mede: 3 Mechs, 3 andróides e 1 técnico, dentro das unidades de uma sala cheia (G11)', () => {
    expect(LIMITES_ONLINE).toEqual({ mech: 3, android: 3, technician: 1 });
    // Os Mechs de IA dividem as vagas dos humanos (ROOM_SIZE); só os andróides e o técnico são unidades a mais.
    expect(LIMITES_ONLINE.mech).toBeLessThanOrEqual(ROOM_SIZE);
    expect(ROOM_SIZE + LIMITES_ONLINE.android + LIMITES_ONLINE.technician).toBeLessThanOrEqual(ROOM_UNITS);
  });

  it('o que passa do teto sai do fim da lista, papel por papel, e a ordem dos que ficam é a que veio', () => {
    const lista = esquadrao([
      mech({ nome: 'UM' }), { papel: 'android' }, mech({ nome: 'DOIS' }), { papel: 'technician' }, mech({ nome: 'TRES' }), mech({ nome: 'QUATRO' }), { papel: 'technician' },
      { papel: 'android' }, { papel: 'android' }, { papel: 'android' },
    ]);
    const online = esquadraoParaOnline(lista);
    expect(online.inimigos.filter((b) => b.papel === 'mech').map((b) => b.nome)).toEqual(['UM', 'DOIS', 'TRES']);
    expect(papeis(online).filter((p) => p === 'android')).toHaveLength(3);
    expect(papeis(online).filter((p) => p === 'technician')).toHaveLength(1);
    expect(papeis(online).slice(0, 4)).toEqual(['mech', 'android', 'mech', 'technician']);
  });

  it('não há aliados nem titãs online: os aliados somem e o titã sai sem gastar a vaga de um Mech', () => {
    const online = esquadraoParaOnline(esquadrao([mech({ chassi: 'colossus01' }), mech({ nome: 'A' }), mech({ chassi: 'colossusv4' }), mech({ nome: 'B' }), mech({ nome: 'C' })], [mech(), { papel: 'android' }]));
    expect(online.aliados).toEqual([]);
    expect(online.inimigos.map((b) => b.nome)).toEqual(['A', 'B', 'C']);
    expect(online.inimigos.some((b) => b.chassi === 'colossus01' || b.chassi === 'colossusv4')).toBe(false);
  });

  it('o chassi, a arma, o nome e o jeito do robô passam; arma que o chassi não aceita e nome com tag são limpos', () => {
    const arma = armasDoBot('marauder')[0]!;
    const naoServe = WEAPON_IDS.find((id) => !(armasDoBot('marauder') as readonly string[]).includes(id))!;
    expect(naoServe).toBeDefined();
    const online = esquadraoParaOnline(esquadrao([
      mech({ chassi: 'marauder', nome: 'Mão<b>Pesada', persona: 'brabo', dificuldade: 'dificil', arma: { id: arma, tier: 2 } }),
      mech({ chassi: 'marauder', arma: { id: naoServe, tier: 0 } }),
    ]));
    const [bom, torto] = online.inimigos as [BotSpec, BotSpec];
    expect(bom).toMatchObject({ papel: 'mech', chassi: 'marauder', persona: 'brabo', dificuldade: 'dificil', arma: { id: arma, tier: 2 } });
    expect(bom.nome).not.toContain('<');
    expect(torto.chassi).toBe('marauder');
    expect(torto.arma).toBeUndefined(); // a arma que o chassi não aceita sai; o robô fica com a de fábrica
  });

  it('o que vem da rede nunca lança: lixo vira um esquadrão que cabe (sem aliados), e o formato ruim é reconhecido antes de gravar', () => {
    for (const lixo of [null, undefined, 7, 'x', [], {}, { v: 99 }, { v: ESQUADRAO_VERSAO, inimigos: 'não' }]) {
      const online = esquadraoParaOnline(lixo);
      expect(online.aliados).toEqual([]);
      expect(papeis(online).filter((p) => p === 'mech').length).toBeLessThanOrEqual(LIMITES_ONLINE.mech);
    }
    expect(pareceEsquadrao(esquadrao([]))).toBe(true);
    for (const ruim of [null, 3, 'x', {}, { v: 2, inimigos: [] }, { v: ESQUADRAO_VERSAO }, { v: ESQUADRAO_VERSAO, inimigos: {} }]) expect(pareceEsquadrao(ruim), JSON.stringify(ruim)).toBe(false);
  });

  it('sem esquadrão salvo valem as regras: os Mechs e os andróides delas, o técnico e as personalidades de fábrica (o jogo online de sempre)', () => {
    const padrao = esquadraoDasRegras(REGRAS_PADRAO);
    expect(papeis(padrao).filter((p) => p === 'mech')).toHaveLength(REGRAS_PADRAO.mechs);
    expect(papeis(padrao).filter((p) => p === 'android')).toHaveLength(REGRAS_PADRAO.androides);
    expect(papeis(padrao).filter((p) => p === 'technician')).toHaveLength(1);
    expect(padrao.aliados).toEqual([]);
    expect(papeis(esquadraoDasRegras({ ...REGRAS_PADRAO, mechs: 0, androides: 3 })).filter((p) => p === 'mech')).toHaveLength(0);
    expect(papeis(esquadraoDasRegras({ ...REGRAS_PADRAO, mechs: 3, androides: 3 })).filter((p) => p === 'android')).toHaveLength(3);
  });

  it('o esquadrão só vale na Cidade Neon e na Estação dos Cabos (o combate livre do lançamento)', () => {
    expect(esquadraoValeNoMapa('arena')).toBe(true);
    expect(esquadraoValeNoMapa('praia')).toBe(true);
    for (const outro of ['bunker', 'amazonia', 'janeiro'] as const) expect(esquadraoValeNoMapa(outro), outro).toBe(false);
  });

  it('a resposta do servidor só vale inteira: o esquadrão vem limpo para o online, e o que não é resposta vira null', () => {
    const boa = lerRespostaDoEsquadrao({ salvo: true, esquadrao: esquadrao([mech(), mech(), mech(), mech()], [mech()]) });
    expect(boa?.salvo).toBe(true);
    expect(boa?.esquadrao.inimigos).toHaveLength(3);
    expect(boa?.esquadrao.aliados).toEqual([]);
    for (const ruim of [null, {}, { salvo: 'sim', esquadrao: esquadrao([]) }, { salvo: true }, { salvo: true, esquadrao: { v: 5, inimigos: [] } }]) expect(lerRespostaDoEsquadrao(ruim), JSON.stringify(ruim)).toBeNull();
  });
});

describe('a montagem com que os outros jogadores veem o robô do esquadrão', () => {
  it('sem chassi e sem arma é o Vector-09 de fábrica; o chassi e as armas dados entram na chave que o roster leva e voltam dela', () => {
    expect(montagemDoBot({}).chassis).toBe('vector09');
    // O Marauder de fábrica leva blaster nível 0: o nível 1 é uma arma pedida que o Hangar aceita (a maioria não cabe na carga dele, ver o teste abaixo).
    const arma = 'blaster' as const;
    expect(armasDoBot('marauder')).toContain(arma);
    const spec = montagemDoBot({ chassi: 'marauder', arma: { id: arma, tier: 1 } });
    expect(spec.chassis).toBe('marauder');
    expect(spec.right).toMatchObject({ id: arma, tier: 1 });
    expect(parseLoadoutKey(loadoutKey(spec))).toMatchObject({ chassis: 'marauder', right: { id: arma, tier: 1 } });
  });

  it('a mão esquerda que não cabe na carga cai primeiro (o corpo e a arma principal ficam); sem solução, cai na de fábrica (só desenho: nunca lança e nunca manda uma chave que o cliente não lê)', () => {
    // Marauder: o blaster 1 cabe, o canhão (mão esquerda) não: a esquerda cai e a principal que o esquadrão deu fica.
    const semEsquerda = montagemDoBot({ chassi: 'marauder', arma: { id: 'blaster', tier: 1 }, secundaria: { id: 'cannon', tier: 2 } });
    expect(semEsquerda.right).toMatchObject({ id: 'blaster', tier: 1 });
    expect(semEsquerda.left).toEqual(factorySpec('marauder').left);
    const torta = montagemDoBot({ chassi: 'marauder', arma: { id: 'nao-existe' as never, tier: 0 } });
    expect(torta).toEqual(factorySpec('marauder'));
    expect(validateLoadout(torta).ok).toBe(true);
    expect(parseLoadoutKey(loadoutKey(torta))).not.toBeNull();
  });
});

describe('a chave do esquadrão de uma sala e os limites do editor online', () => {
  it('a chave é a do esquadrão que vale no mapa; sem esquadrão, ou num mapa onde ele não vale, é vazia (valem as regras)', () => {
    const a = esquadrao([mech({ nome: 'A' })]);
    const b = esquadrao([mech({ nome: 'B' })]);
    expect(chaveDoEsquadraoOnline(null, 'arena')).toBe('');
    expect(chaveDoEsquadraoOnline(a, 'janeiro')).toBe('');
    expect(chaveDoEsquadraoOnline(a, 'arena')).not.toBe('');
    expect(chaveDoEsquadraoOnline(a, 'arena')).not.toBe(chaveDoEsquadraoOnline(b, 'arena'));
    expect(chaveDoEsquadraoOnline(a, 'praia')).toBe(chaveDoEsquadraoOnline(a, 'arena'));
    // O que o servidor guarda já é o limpo, e a sala o limpa de novo: as duas chaves são a mesma.
    expect(chaveDoEsquadraoOnline(esquadraoParaOnline(a), 'arena')).toBe(chaveDoEsquadraoOnline(a, 'arena'));
  });

  it('os limites do editor online são o teto da sala (sem aliados nem titãs) e batem com o que o servidor corta', () => {
    const l = limitesOnline();
    expect(l.porPapel).toEqual(LIMITES_ONLINE);
    expect(l).toMatchObject({ aliados: 0, titas: 0, tecnicos: 1, inimigos: 7, total: 7 });
  });
});
