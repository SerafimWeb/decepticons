import { describe, expect, it } from 'vitest';
import { WEAPON_IDS } from '../combat/weapons';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../core/Settings';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import {
  armaServeAoBot,
  armasDoBot,
  type BotSpec,
  CHASSIS_DOS_BOTS,
  chaveDoEsquadrao,
  ehChassiDoBot,
  ehOEsquadraoPadrao,
  ESQUADRAO_VERSAO,
  type EsquadraoSpec,
  esquadraoDeFoes,
  esquadraoDoLink,
  esquadraoPadrao,
  excessosDoEsquadrao,
  lerChaveDoEsquadrao,
  LIMITES_DO_ESQUADRAO,
  limitesDoMapa,
  limparNome,
  nomePadraoDoBot,
  PESO_DO_PAPEL,
  planejarEsquadrao,
  resumoDoEsquadrao,
  sanearBot,
  sanearEsquadrao,
} from './esquadrao';
import { ALLY_SPAWNS, ANDROID_SPAWNS, BOT_SPAWNS, EXTRAS_ALIADOS, EXTRAS_INIMIGOS, TECHNICIAN_SPAWNS } from './nascimentos';

const mech = (extra: Partial<BotSpec> = {}): BotSpec => ({ papel: 'mech', ...extra });
const android = (extra: Partial<BotSpec> = {}): BotSpec => ({ papel: 'android', ...extra });
const tecnico = (extra: Partial<BotSpec> = {}): BotSpec => ({ papel: 'technician', ...extra });
const esq = (inimigos: BotSpec[], aliados: BotSpec[] = []): EsquadraoSpec => ({ v: ESQUADRAO_VERSAO, inimigos, aliados });

describe('o esquadrão padrão é o jogo de hoje', () => {
  it('1 Mech brabo, 2 andróides e o técnico contra o jogador e 2 aliados (o segundo com EMP)', () => {
    expect(esquadraoPadrao()).toEqual(esq([mech({ persona: 'brabo' }), android(), android(), tecnico()], [mech(), mech({ arma: { id: 'emp', tier: 0 } })]));
  });

  it('o link do padrão é curto e estável', () => {
    expect(chaveDoEsquadrao(esquadraoPadrao())).toBe('q1.m:pb,a,a,t.m,m:wemp-0');
    expect(ehOEsquadraoPadrao(esquadraoPadrao())).toBe(true);
    expect(ehOEsquadraoPadrao(esq([mech()]))).toBe(false);
  });

  it('a conta antiga: o pool de Mechs menos as vagas dos aliados (G11), a lista de personalidades e o técnico', () => {
    // O servidor: sem aliados, os 3 Mechs do pool, cada um com a sua personalidade.
    const servidor = esquadraoDeFoes({ ...DEFAULT_SETTINGS, enemyMechs: 3, enemyAndroids: 3, technician: false, enemyPersonas: ['brabo', 'manso', 'soldado'] }, 0);
    expect(servidor).toEqual(esq([mech({ persona: 'brabo' }), mech({ persona: 'manso' }), mech(), android(), android(), android()]));
    // Com 2 aliados, 3 Mechs de pool viram 1; menos que as vagas dos aliados, nenhum (e nunca negativo).
    expect(esquadraoDeFoes({ ...DEFAULT_SETTINGS, enemyMechs: 1 }, 2).inimigos.filter((b) => b.papel === 'mech')).toHaveLength(0);
    expect(esquadraoDeFoes({ ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false }, 2).inimigos).toEqual([]);
  });

  it('os aliados alternam plasma e EMP (o supressor é o de índice ímpar), como o jogo sempre fez', () => {
    const quatro = esquadraoDeFoes(DEFAULT_SETTINGS, 4).aliados;
    expect(quatro.map((b) => b.arma?.id)).toEqual([undefined, 'emp', undefined, 'emp']);
  });
});

describe('o que um robô pode ser', () => {
  it('os chassis dos bots são os Mechs: sem o andróide e sem o Colossus', () => {
    expect(CHASSIS_DOS_BOTS).toContain('vector09');
    expect(CHASSIS_DOS_BOTS).toContain('marauder');
    expect(CHASSIS_DOS_BOTS).not.toContain('android');
    expect(CHASSIS_DOS_BOTS).not.toContain('colossus01');
    expect(CHASSIS_DOS_BOTS.length).toBeGreaterThanOrEqual(8);
    for (const id of CHASSIS_DOS_BOTS) expect(CHASSIS[id].maxJumps, id).toBeGreaterThan(0);
    expect(ehChassiDoBot('onca')).toBe(true);
    expect(ehChassiDoBot('android')).toBe(false);
    expect(ehChassiDoBot('naoexiste')).toBe(false);
    expect(ehChassiDoBot(7)).toBe(false);
  });

  it('o bot atira o projétil comum: fora a rotatória, o lança-chamas, o sônico, o teleguiado, o trilho, os foguetes e a motosserra', () => {
    const serve = WEAPON_IDS.filter(armaServeAoBot);
    expect(serve).toEqual(expect.arrayContaining(['plasma', 'blaster', 'emp']));
    for (const fora of ['rotary', 'flamer', 'sonic', 'seeker', 'railgun', 'rockets', 'barrage', 'chainsaw'] as const) expect(serve, fora).not.toContain(fora);
  });

  it('cada chassi tem pelo menos uma arma que cabe na mão principal e que o bot sabe usar', () => {
    for (const id of CHASSIS_DOS_BOTS) {
      const armas = armasDoBot(id);
      expect(armas.length, id).toBeGreaterThan(0);
      for (const a of armas) expect(armaServeAoBot(a), `${id}:${a}`).toBe(true);
    }
  });
});

describe('limpar um robô (nada vindo de fora é confiado)', () => {
  it('o robô de fábrica é só o papel: nenhum campo no valor padrão sobra', () => {
    expect(sanearBot({ papel: 'mech', persona: 'soldado', chassi: 'vector09' })).toEqual({ papel: 'mech' });
    expect(sanearBot({ papel: 'mech', persona: 'brabo', chassi: 'onca', dificuldade: 'dificil', nome: ' ZÉ ' })).toEqual({
      papel: 'mech', persona: 'brabo', chassi: 'onca', dificuldade: 'dificil', nome: 'ZÉ',
    });
  });

  it('só o Mech tem personalidade, chassi e arma; o técnico não tem dificuldade (não atira)', () => {
    expect(sanearBot({ papel: 'android', persona: 'brabo', chassi: 'onca', arma: { id: 'plasma', tier: 1 }, dificuldade: 'facil' })).toEqual({ papel: 'android', dificuldade: 'facil' });
    expect(sanearBot({ papel: 'technician', persona: 'manso', dificuldade: 'dificil', nome: 'FIXA' })).toEqual({ papel: 'technician', nome: 'FIXA' });
  });

  it('o aliado não tem técnico', () => {
    expect(sanearBot({ papel: 'technician' }, 'aliado')).toBeNull();
    expect(sanearBot({ papel: 'technician' }, 'inimigo')).toEqual({ papel: 'technician' });
  });

  it('lixo vira nada (ou o padrão do campo), nunca uma exceção', () => {
    for (const lixo of [null, undefined, 7, 'mech', [], { papel: 'tanque' }, { papel: 3 }, {}]) expect(sanearBot(lixo), JSON.stringify(lixo)).toBeNull();
    expect(sanearBot({ papel: 'mech', persona: 'bravo', chassi: 'android', arma: 'plasma', dificuldade: 'impossivel' })).toEqual({ papel: 'mech' });
    expect(sanearBot({ papel: 'mech', chassi: 'colossus01' })).toEqual({ papel: 'mech' });
  });

  it('arma que o bot não sabe usar, ou que não cabe no chassi, ou de nível que não existe, é descartada', () => {
    expect(sanearBot({ papel: 'mech', arma: { id: 'rotary', tier: 0 } })).toEqual({ papel: 'mech' });
    expect(sanearBot({ papel: 'mech', arma: { id: 'plasma', tier: 3 } })).toEqual({ papel: 'mech' });
    expect(sanearBot({ papel: 'mech', arma: { id: 'chainsaw', tier: 0 } })).toEqual({ papel: 'mech' });
    expect(sanearBot({ papel: 'mech', arma: { id: 'plasma', tier: 2 } })).toEqual({ papel: 'mech', arma: { id: 'plasma', tier: 2 } });
  });

  it('o nome é limpo como o de Configurações: sem tag nem quebra, até o tamanho da etiqueta', () => {
    for (const nome of ['  ZÉ   DO  PÃO  ', '<b>x</b>', 'a'.repeat(40), '"aspas"', 'quebra\nde linha', 'ESCOLTA·PLASMA', '   ', '', 'ok'])
      expect(limparNome(nome) ?? 'CLAWD', nome).toBe(sanitizeSettings({ names: { mechs: [nome] } }).names.mechs[0]);
    expect(limparNome(42)).toBeUndefined();
    expect(limparNome('x'.repeat(40))).toHaveLength(16);
  });
});

describe('limpar um esquadrão inteiro', () => {
  it('o que não é esquadrão vira o padrão', () => {
    for (const lixo of [null, undefined, 3, 'q1', [], {}, { v: 2, inimigos: [], aliados: [] }]) expect(sanearEsquadrao(lixo), JSON.stringify(lixo)).toEqual(esquadraoPadrao());
  });

  it('esquadrão vazio é válido (a Arena fica só com o jogador)', () => {
    expect(sanearEsquadrao({ v: 1, inimigos: [], aliados: [] })).toEqual(esq([], []));
    expect(sanearEsquadrao({ v: 1 })).toEqual(esq([], []));
  });

  it('descarta o robô inválido e mantém os outros, na ordem', () => {
    const s = sanearEsquadrao({ v: 1, inimigos: [mech(), { papel: 'tanque' }, android(), null], aliados: [tecnico(), mech()] });
    expect(s).toEqual(esq([mech(), android()], [mech()]));
  });

  it('corta o que passa do teto: os técnicos, depois cada lado, depois o total (aliados primeiro)', () => {
    const lim = limitesDoMapa('arena');
    const muitos = sanearEsquadrao({ v: 1, inimigos: Array.from({ length: 40 }, () => mech()), aliados: Array.from({ length: 40 }, () => mech()) });
    expect(resumoDoEsquadrao(muitos).total).toBe(lim.total);
    expect(muitos.inimigos.length).toBeLessThanOrEqual(lim.inimigos);
    expect(muitos.aliados.length).toBeLessThanOrEqual(lim.aliados);
    expect(excessosDoEsquadrao(muitos)).toEqual([]);
    const tecnicos = sanearEsquadrao({ v: 1, inimigos: [tecnico(), tecnico(), tecnico(), mech()], aliados: [] });
    expect(tecnicos.inimigos.filter((b) => b.papel === 'technician')).toHaveLength(lim.tecnicos);
    expect(tecnicos.inimigos).toContainEqual(mech());
  });

  it('o Bunker só tem 11 pontos livres: o que passa é cortado', () => {
    const cheio = sanearEsquadrao({ v: 1, inimigos: Array.from({ length: 12 }, () => mech()), aliados: [mech(), mech()] }, 'bunker');
    expect(resumoDoEsquadrao(cheio).total).toBe(11);
    expect(limitesDoMapa('bunker').total).toBe(11);
    expect(limitesDoMapa('arena').total).toBe(LIMITES_DO_ESQUADRAO.total);
  });

  it('é idempotente: limpar de novo não muda nada', () => {
    const uma = sanearEsquadrao({ v: 1, inimigos: [mech({ persona: 'fujao', nome: 'A·B' }), android({ dificuldade: 'dificil' })], aliados: [mech({ chassi: 'arara' })] });
    expect(sanearEsquadrao(uma)).toEqual(uma);
  });
});

describe('peso e teto', () => {
  it('o peso soma o papel de cada robô (Mech 1, andróide e técnico menos)', () => {
    const r = resumoDoEsquadrao(esquadraoPadrao());
    expect(r).toMatchObject({ mechs: 1, androids: 2, tecnicos: 1, aliadosMechs: 2, aliadosAndroids: 0, inimigos: 4, aliados: 2, total: 6 });
    expect(r.peso).toBeCloseTo(1 + 2 * PESO_DO_PAPEL.android + PESO_DO_PAPEL.technician + 2, 5);
  });

  it('diz o que passou do limite, lado a lado', () => {
    expect(excessosDoEsquadrao(esquadraoPadrao())).toEqual([]);
    const lim = limitesDoMapa('arena');
    const demais = esq(Array.from({ length: lim.inimigos + 1 }, () => mech()), Array.from({ length: lim.aliados + 1 }, () => mech()));
    const texto = excessosDoEsquadrao(demais).join(' | ');
    expect(texto).toContain('inimigos');
    expect(texto).toContain('aliados');
    expect(texto).toContain('total');
    expect(excessosDoEsquadrao(esq([tecnico(), tecnico(), tecnico()]))).toEqual([`técnicos: 3 de no máximo ${lim.tecnicos}`]);
  });

  it('o teto cabe nos pontos do mapa (a Arena não fica sem chão antes de ficar sem CPU)', () => {
    const lim = limitesDoMapa('arena');
    expect(lim.inimigos).toBe(LIMITES_DO_ESQUADRAO.inimigos);
    expect(lim.aliados).toBe(LIMITES_DO_ESQUADRAO.aliados);
    expect(LIMITES_DO_ESQUADRAO.inimigos).toBeGreaterThan(esquadraoPadrao().inimigos.length);
    expect(LIMITES_DO_ESQUADRAO.aliados).toBeGreaterThan(esquadraoPadrao().aliados.length);
  });
});

describe('o link do esquadrão', () => {
  const COMPLEXO = esq(
    [
      mech({ persona: 'brabo', chassi: 'marauder', arma: { id: 'blaster', tier: 2 }, dificuldade: 'dificil', nome: 'ZÉ.DO:PÃO,1' }),
      mech({ persona: 'fujao', chassi: 'lr7lBastion' }),
      mech({ chassi: 'lancerL1', arma: { id: 'shotgun', tier: 1 } }),
      android({ nome: 'ÁGUA-VIVA', dificuldade: 'facil' }),
      tecnico({ nome: 'ENTRÓPICO' }),
    ],
    [mech({ chassi: 'arara', persona: 'manso' }), android({ dificuldade: 'normal' })],
  );

  it('vai e volta sem perder nada, inclusive nome com ponto, dois-pontos, vírgula, acento e emoji', () => {
    const chave = chaveDoEsquadrao(COMPLEXO);
    expect(lerChaveDoEsquadrao(chave)).toEqual(COMPLEXO);
    const emoji = esq([mech({ nome: 'ROBÔ 🤖' })]);
    expect(lerChaveDoEsquadrao(chaveDoEsquadrao(emoji))).toEqual(emoji);
  });

  it('a chave só tem caracteres de URL: não precisa de escape nem quebra o `URLSearchParams`', () => {
    const chave = chaveDoEsquadrao(COMPLEXO);
    expect(chave).toMatch(/^[A-Za-z0-9_.,:-]+$/);
    expect(esquadraoDoLink(`?esquadrao=${chave}&outro=1`)).toEqual(COMPLEXO);
  });

  it('esquadrão vazio de um lado é "-"', () => {
    expect(chaveDoEsquadrao(esq([], []))).toBe('q1.-.-');
    expect(lerChaveDoEsquadrao('q1.-.-')).toEqual(esq([], []));
    expect(lerChaveDoEsquadrao('q1.m,m.-')).toEqual(esq([mech(), mech()], []));
  });

  it('dois esquadrões iguais têm a mesma chave, e o campo padrão não aparece nela (m:ps é m)', () => {
    expect(chaveDoEsquadrao(esq([mech({ persona: 'soldado', chassi: 'vector09' })]))).toBe('q1.m.-');
    expect(lerChaveDoEsquadrao('q1.m:ps.-')).toEqual(esq([mech()], []));
  });

  it('texto que não é um esquadrão vira null: nada é aplicado pela metade', () => {
    const recusadas = [
      '', 'lixo', 'q1', 'q1.m', 'q1.m.m.m', 'q2.m.m', 'Q1.m.m',
      'q1.x.-', 'q1.m,.-', 'q1.,m.-', 'q1.m,,m.-',
      'q1.m:pz.-', 'q1.m:cnaoexiste.-', 'q1.m:candroid.-', 'q1.m:ccolossus01.-', 'q1.m:wnada-0.-', 'q1.m:wplasma-3.-', 'q1.m:wplasma.-',
      'q1.m:wrotary-0.-', 'q1.m:wchainsaw-0.-', 'q1.m:wrailgun-0.-',
      'q1.m:dz.-', 'q1.m:pb:pb.-', 'q1.m:q.-', 'q1.m:.-', 'q1.m:n.-', 'q1.m:n***.-', 'q1.m:n!!.-',
      'q1.a:pb.-', 'q1.a:cvector09.-', 'q1.a:wplasma-0.-', 'q1.t:dn.-',
      'q1.-.t', 'q1.-.t:nQQ',
    ];
    for (const chave of recusadas) expect(lerChaveDoEsquadrao(chave), chave).toBeNull();
  });

  it('nome com tag, ou vazio depois de limpo, ou longo demais, recusa a chave (a chave tem de ser canônica)', () => {
    const b64 = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(lerChaveDoEsquadrao(`q1.m:n${b64('<b>')}.-`)).toBeNull();
    expect(lerChaveDoEsquadrao(`q1.m:n${b64('   ')}.-`)).toBeNull();
    expect(lerChaveDoEsquadrao(`q1.m:n${b64('x'.repeat(40))}.-`)).toBeNull();
    expect(lerChaveDoEsquadrao(`q1.m:n${b64('ok')}.-`)).toEqual(esq([mech({ nome: 'ok' })]));
  });

  it('passando do teto, a chave inteira é recusada', () => {
    const lim = limitesDoMapa('arena');
    const quantos = (n: number) => Array.from({ length: n }, () => 'm').join(',');
    expect(lerChaveDoEsquadrao(`q1.${quantos(lim.inimigos)}.-`)).not.toBeNull();
    expect(lerChaveDoEsquadrao(`q1.${quantos(lim.inimigos + 1)}.-`)).toBeNull();
    expect(lerChaveDoEsquadrao(`q1.-.${quantos(lim.aliados + 1)}`)).toBeNull();
  });

  it('sem o parâmetro, ou com texto ruim, o link não traz esquadrão', () => {
    expect(esquadraoDoLink('')).toBeNull();
    expect(esquadraoDoLink('?outro=1')).toBeNull();
    expect(esquadraoDoLink('?esquadrao=lixo')).toBeNull();
    expect(esquadraoDoLink(`?esquadrao=${chaveDoEsquadrao(esquadraoPadrao())}`)).toEqual(esquadraoPadrao());
  });
});

describe('o plano que a partida monta', () => {
  const NOMES = DEFAULT_SETTINGS.names;

  it('o esquadrão padrão nasce nos pontos de sempre, com os nomes e as personalidades de sempre', () => {
    const p = planejarEsquadrao(esquadraoPadrao(), 'arena', NOMES);
    expect(p.inimigos.mechs).toEqual([{ ponto: BOT_SPAWNS[0], nome: 'CLAWD', persona: 'brabo', chassi: 'vector09', arma: null, dificuldade: null }]);
    expect(p.inimigos.androids.map((s) => [s.ponto, s.nome])).toEqual([[ANDROID_SPAWNS[0], 'KUEN'], [ANDROID_SPAWNS[1], 'DIPSIK']]);
    expect(p.inimigos.tecnicos.map((s) => [s.ponto, s.nome])).toEqual([[TECHNICIAN_SPAWNS[0], 'ENTRÓPICO']]);
    expect(p.aliados.mechs.map((s) => [s.ponto, s.nome, s.arma?.id])).toEqual([[ALLY_SPAWNS[0], 'ESCOLTA·PLASMA', undefined], [ALLY_SPAWNS[1], 'SUPRESSOR·EMP', 'emp']]);
    expect(p.aliados.androids).toEqual([]);
  });

  it('os nomes que o jogador pôs em Configurações continuam valendo para quem não tem nome próprio', () => {
    const nomes = { ...NOMES, mechs: ['LEÃO', 'TIGRE', 'ONÇA'], androids: ['A1', 'A2', 'A3'] };
    const p = planejarEsquadrao(esq([mech(), mech({ nome: 'MEU' }), mech(), android()]), 'arena', nomes);
    expect(p.inimigos.mechs.map((s) => s.nome)).toEqual(['LEÃO', 'MEU', 'ONÇA']);
    expect(p.inimigos.androids.map((s) => s.nome)).toEqual(['A1']);
  });

  it('passando das listas de nomes, o robô ganha um número (REBELDE-04, ANDRÓIDE-04, ALIADO-03…)', () => {
    expect(nomePadraoDoBot('inimigo', 'mech', 3, NOMES)).toBe('REBELDE-04');
    expect(nomePadraoDoBot('inimigo', 'android', 3, NOMES)).toBe('ANDRÓIDE-04');
    expect(nomePadraoDoBot('inimigo', 'technician', 1, NOMES)).toBe('TÉCNICO-02');
    expect(nomePadraoDoBot('aliado', 'mech', 2, NOMES)).toBe('ALIADO-03');
    expect(nomePadraoDoBot('aliado', 'android', 0, NOMES)).toBe('ESCUDEIRO-01');
    expect(nomePadraoDoBot('inimigo', 'mech', 0, NOMES)).toBe('CLAWD');
    for (const lado of ['inimigo', 'aliado'] as const) for (const papel of ['mech', 'android', 'technician'] as const) expect(nomePadraoDoBot(lado, papel, 98, NOMES).length).toBeLessThanOrEqual(16);
  });

  it('um esquadrão grande usa os fixos e depois os extras, sem repetir ponto', () => {
    const grande = esq(
      [...Array.from({ length: 5 }, () => mech()), ...Array.from({ length: 4 }, () => android()), tecnico(), tecnico()],
      [...Array.from({ length: 4 }, () => mech()), android(), android()],
    );
    const p = planejarEsquadrao(grande, 'arena', NOMES);
    const pontos = [...p.inimigos.mechs, ...p.inimigos.androids, ...p.inimigos.tecnicos, ...p.aliados.mechs, ...p.aliados.androids].map((s) => s.ponto.join(','));
    expect(pontos).toHaveLength(17);
    expect(new Set(pontos).size).toBe(17);
    expect(p.inimigos.mechs.slice(3).map((s) => s.ponto)).toEqual([EXTRAS_INIMIGOS[0], EXTRAS_INIMIGOS[1]]);
    expect(p.aliados.mechs.slice(2).map((s) => s.ponto)).toEqual([EXTRAS_ALIADOS[0], EXTRAS_ALIADOS[1]]);
  });

  it('o que o robô tem de próprio vai para o plano; o que não tem fica no padrão', () => {
    const p = planejarEsquadrao(esq([mech({ persona: 'manso', chassi: 'onca', arma: { id: 'cannon', tier: 1 }, dificuldade: 'facil' })]), 'arena', NOMES);
    expect(p.inimigos.mechs[0]).toMatchObject({ persona: 'manso', chassi: 'onca', arma: { id: 'cannon', tier: 1 }, dificuldade: 'facil' });
  });

  it('esquadrão que não cabe no mapa não vira plano (quem chama limpa antes)', () => {
    const demais = esq(Array.from({ length: 12 }, () => mech()), [mech(), mech()]);
    expect(() => planejarEsquadrao(demais, 'bunker', NOMES)).toThrow(/não cabe/);
    expect(() => planejarEsquadrao(sanearEsquadrao(demais, 'bunker'), 'bunker', NOMES)).not.toThrow();
  });

  it('chassis de todos os tipos entram no plano', () => {
    const todos: ChassisId[] = [...CHASSIS_DOS_BOTS];
    const p = planejarEsquadrao(esq(todos.map((chassi) => mech({ chassi }))), 'arena', NOMES);
    expect(p.inimigos.mechs.map((s) => s.chassi)).toEqual(todos);
  });
});
