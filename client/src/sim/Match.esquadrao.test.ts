import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BOT_SKILLS } from '../combat/BotController';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { Android } from '../entities/Android';
import { CHASSIS, ehTita } from '../entities/chassis';
import type { MechInput } from '../entities/MechBase';
import { ImportedMech } from '../entities/ImportedMech';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import {
  armasDoBot,
  type BotSpec,
  CHASSIS_DOS_BOTS,
  ESQUADRAO_VERSAO,
  type EsquadraoSpec,
  esquadraoPadrao,
  LIMITES_DO_ESQUADRAO,
  limitesDoMapa,
  resumoDoEsquadrao,
} from './esquadrao';
import { Match, type MatchOptions } from './Match';
import { ALLY_SPAWNS, BOT_SPAWNS, PONTOS_DOS_TITAS } from './nascimentos';
import { DANO_DO_CERCO_DO_BOT, TITA_RESPAWN_S } from '../combat/titaBot';
import { weapon } from '../combat/weapons';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const mech = (extra: Partial<BotSpec> = {}): BotSpec => ({ papel: 'mech', ...extra });
const android = (extra: Partial<BotSpec> = {}): BotSpec => ({ papel: 'android', ...extra });
const tecnico = (extra: Partial<BotSpec> = {}): BotSpec => ({ papel: 'technician', ...extra });
const varios = (n: number, de: () => BotSpec): BotSpec[] => Array.from({ length: n }, de);
const esq = (inimigos: BotSpec[], aliados: BotSpec[] = []): EsquadraoSpec => ({ v: ESQUADRAO_VERSAO, inimigos, aliados });

const abertas: PhysicsWorld[] = [];

/** Uma partida de esquadrão sem tela, com o jogador parado no centro (os bots vêm atrás dele). */
async function partida(squad: EsquadraoSpec | undefined, o: Partial<MatchOptions> = {}, imortal = false) {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, ...(squad ? { squad } : {}), ...o });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate(IDLE, dt) });
  // Imortal: a vida volta a cada tick (os acertos continuam contando), para medir a distância sem o renascimento atrapalhar.
  if (imortal) match.pilots.push({ fixedUpdate: () => Object.assign(player.modules, player.stats.maxModuleHealth) });
  let acertosNoJogador = 0;
  match.onMechHit = (e) => {
    if (e.mech === player) acertosNoJogador++;
  };
  /** A que distância do jogador o primeiro inimigo começou a atacar (a distância de tiro que a IA escolheu), em metros no plano. */
  let primeiroAtaque: number | null = null;
  const run = (segundos: number): void => {
    for (let i = 0; i < Math.round(segundos / FIXED_DT); i++) {
      match.step(FIXED_DT);
      const primeiro = match.bots.mechs[0];
      if (primeiroAtaque === null && primeiro && match.bots.brainOf(primeiro)?.state === 'attack') {
        primeiroAtaque = Math.hypot(primeiro.simPosition.x - player.simPosition.x, primeiro.simPosition.z - player.simPosition.z);
      }
    }
  };
  return { match, player, run, acertos: () => acertosNoJogador, primeiroAtaque: () => primeiroAtaque };
}

const dist2 = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

describe('a partida monta o esquadrão pedido', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    for (const p of abertas.splice(0)) p.world.free();
  });

  it('o chassi de malha importada (Marauder, Lancer) nasce com o corpo dele quando o cliente tem o arquivo; sem ele (o servidor), segue Vector-09 com os números do chassi (achado do Comandante, 13/10)', async () => {
    const pedido = esq([mech({ chassi: 'marauder' }), mech({ chassi: 'lancerL1' }), mech({ chassi: 'arara' }), mech()], [mech({ chassi: 'marauder' })]);
    const pedidos: string[] = [];
    // O rig de mentira: o do Vector-09 (a prova é qual classe nasce e para quais chassis o cliente foi perguntado).
    const rigDe = (id: string) => {
      pedidos.push(id);
      return id === 'marauder' || id === 'lancerL1' ? (new Vector09() as unknown as { rig: never }).rig : null;
    };
    const cliente = await partida(pedido, { rigDoChassi: rigDe as never });
    const corpos = cliente.match.bots.mechs.map((m) => (m instanceof ImportedMech ? 'importado' : 'vector'));
    expect(corpos.slice(0, 4)).toEqual(['importado', 'importado', 'vector', 'vector']); // arara é procedural; sem chassi, o padrão
    expect(cliente.match.allies!.mechs[0]).toBeInstanceOf(ImportedMech); // o aliado Marauder também
    expect(pedidos).toEqual(expect.arrayContaining(['marauder', 'lancerL1', 'arara']));
    // Os números são os do chassi, com ou sem o corpo importado.
    expect(cliente.match.bots.mechs[0]!.stats.name).toBe(CHASSIS.marauder.name);
    // O servidor não passa `rigDoChassi`: o corpo é só física e números, e nada quebra.
    const servidor = await partida(pedido);
    expect(servidor.match.bots.mechs.slice(0, 4).every((m) => m instanceof Vector09)).toBe(true);
    expect(servidor.match.bots.mechs[0]!.stats.name).toBe(CHASSIS.marauder.name);
  });

  it('quantos pedir, tantos nascem, cada um no seu ponto, com o nome pedido e no placar', async () => {
    const pedido = esq(
      [mech({ nome: 'ALFA' }), mech({ nome: 'BRAVO', persona: 'manso' }), mech(), android({ nome: 'CHARLIE' }), android(), tecnico({ nome: 'FIXA' })],
      [mech({ nome: 'ESCUDO' }), mech(), mech({ nome: 'TERCEIRO' }), android({ nome: 'PEQUENO' })],
    );
    const { match } = await partida(pedido);
    expect(match.bots.mechs).toHaveLength(6);
    expect(match.allies!.mechs).toHaveLength(4);
    const nomes = match.bots.mechs.map((m) => match.bots.nameOf(m));
    // Quem não tem nome leva o da lista de Configurações na posição dele entre os do mesmo papel (o 3º Mech é CHAD-GPT, o 2º andróide é DIPSIK).
    expect(nomes).toEqual(['ALFA', 'BRAVO·MANSO', 'CHAD-GPT', 'CHARLIE', 'DIPSIK', 'FIXA']);
    expect(match.allies!.mechs.map((m) => match.allies!.nameOf(m))).toEqual(['ESCUDO', 'SUPRESSOR·EMP', 'TERCEIRO', 'PEQUENO']);
    expect(match.round.standings()).toHaveLength(1 + 6 + 4);
    // Nascem onde o plano manda: os fixos de hoje primeiro.
    expect(match.bots.mechs[0]!.simPosition.x).toBeCloseTo(BOT_SPAWNS[0]![0], 0);
    expect(match.bots.mechs[0]!.simPosition.z).toBeCloseTo(BOT_SPAWNS[0]![1], 0);
    expect(match.allies!.mechs[0]!.simPosition.x).toBeCloseTo(ALLY_SPAWNS[0]![0], 0);
  });

  it('sem pedir nada, a partida sai das configurações: o esquadrão de hoje', async () => {
    const { match } = await partida(undefined);
    const r = resumoDoEsquadrao(esquadraoPadrao());
    expect(match.bots.mechs).toHaveLength(r.inimigos);
    expect(match.allies!.mechs).toHaveLength(r.aliados);
    expect(match.allies!.mechs.map((m) => match.allies!.nameOf(m))).toEqual(['ESCOLTA·PLASMA', 'SUPRESSOR·EMP']);
  });

  it('o aliado de EMP é escolha do esquadrão: três aliados sem arma pedida atiram plasma', async () => {
    const { match } = await partida(esq([], varios(3, () => mech())));
    expect(match.allies!.mechs.map((m) => m.loadout.primary.id)).toEqual(['plasma', 'plasma', 'plasma']);
    const { match: padrao } = await partida(undefined);
    expect(padrao.allies!.mechs.map((m) => m.loadout.primary.id)).toEqual(['plasma', 'emp']);
  });

  it('com `allies: false` (o servidor, o online) os aliados do esquadrão ficam de fora, e nem os drones nascem', async () => {
    const { match } = await partida(esq([mech()], varios(4, () => mech())), { allies: false });
    expect(match.allies).toBeNull();
    expect(match.drones).toBeNull();
    expect(match.bots.mechs).toHaveLength(1);
  });

  it('o que passa do teto é cortado (aliados primeiro), e o esquadrão vazio deixa só o jogador', async () => {
    const lim = limitesDoMapa('arena');
    const { match } = await partida(esq(varios(60, () => mech()), varios(60, () => mech())));
    expect(match.bots.mechs.length).toBeLessThanOrEqual(lim.inimigos);
    expect(match.bots.mechs.length + match.allies!.mechs.length).toBe(lim.total);
    const { match: vazio } = await partida(esq([], []));
    expect(vazio.bots.mechs).toHaveLength(0);
    expect(vazio.allies).toBeNull();
    expect(vazio.round.standings()).toHaveLength(1);
  });

  it('o Bunker comporta os 11 pontos livres, cada corpo num ponto só', async () => {
    const { match } = await partida(esq([...varios(5, () => mech()), ...varios(3, () => android())], varios(3, () => mech())), { map: 'bunker' });
    const todos = [...match.bots.mechs, ...match.allies!.mechs];
    expect(todos).toHaveLength(11);
    const lugares = new Set(todos.map((m) => `${Math.round(m.simPosition.x)},${Math.round(m.simPosition.z)}`));
    expect(lugares.size).toBe(11);
  });
});

describe('o corpo, a arma e a dificuldade de cada robô', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    for (const p of abertas.splice(0)) p.world.free();
  });

  it('cada chassi vira o corpo do bot: vida, passo e nome do chassi, e o robô continua um Vector09 para o jogo', async () => {
    const { match } = await partida(esq(CHASSIS_DOS_BOTS.slice(0, 8).map((chassi) => mech({ chassi }))));
    for (const [i, m] of match.bots.mechs.entries()) {
      const id = CHASSIS_DOS_BOTS[i]!;
      expect(m, id).toBeInstanceOf(Vector09);
      expect(m.stats.name, id).toBe(CHASSIS[id].name);
      expect(m.stats.maxModuleHealth.torso, id).toBe(CHASSIS[id].maxModuleHealth.torso);
      expect(m.stats.moveSpeed, id).toBe(CHASSIS[id].moveSpeed);
    }
  });

  it('a arma pedida troca a principal (e a secundária sai); o escudo de metal do chassi fica', async () => {
    const { match } = await partida(esq([mech({ chassi: 'onca', arma: { id: 'cannon', tier: 2 } }), mech({ chassi: 'lancerL1', arma: { id: 'arc', tier: 1 } }), mech({ chassi: 'lancerL1' })]));
    const [canhao, lancerComArma, lancerDeFabrica] = match.bots.mechs as [Vector09, Vector09, Vector09];
    expect(canhao.loadout.primary).toMatchObject({ id: 'cannon', tier: 2 });
    expect(canhao.loadout.secondary).toBeNull();
    expect(lancerComArma.loadout.primary).toMatchObject({ id: 'arc', tier: 1 });
    expect(lancerComArma.loadout.metalShield).toEqual(CHASSIS.lancerL1.loadout.metalShield);
    expect(lancerDeFabrica.loadout.primary.id).toBe(CHASSIS.lancerL1.loadout.primary.id);
  });

  it('dificuldade própria resiste à das configurações; as outras seguem a das configurações', async () => {
    const { match } = await partida(esq([mech({ dificuldade: 'dificil' }), mech(), android({ dificuldade: 'facil' }), android()]));
    const [proprio, comum, androideProprio, androideComum] = match.bots.mechs.map((m) => match.bots.brainOf(m)!);
    match.bots.setSkill(BOT_SKILLS.facil);
    expect(proprio!.skill).toBe(BOT_SKILLS.dificil);
    expect(comum!.skill).toBe(BOT_SKILLS.facil);
    expect(androideProprio!.skill).toBe(BOT_SKILLS.facil);
    expect(androideComum!.skill).toBe(BOT_SKILLS.facil);
    match.bots.setSkill(BOT_SKILLS.normal);
    expect(proprio!.skill).toBe(BOT_SKILLS.dificil);
    expect(androideProprio!.skill).toBe(BOT_SKILLS.facil);
    expect(comum!.skill).toBe(BOT_SKILLS.normal);
  });

  it('a personalidade vai para a IA e para o nome da etiqueta', async () => {
    const { match } = await partida(esq([mech({ persona: 'fujao', nome: 'SOMBRA' }), mech({ persona: 'brabo' })]));
    const [a, b] = match.bots.mechs;
    expect(match.bots.brainOf(a!)!.persona.id).toBe('fujao');
    expect(match.bots.nameOf(a!)).toBe('SOMBRA·FUJÃO');
    expect(match.bots.brainOf(b!)!.persona.id).toBe('brabo');
    expect(match.bots.nameOf(b!)).toBe('GEMINAI·BRABO');
  });

  it('cada arma que o bot sabe usar machuca o jogador de verdade (a que ele escolhe, atira e acerta)', async () => {
    // Os titãs têm o teste deles (adiante): nascem nos cantos e levam mais de 30 s para chegar ao alcance.
    const mechs = CHASSIS_DOS_BOTS.filter((c) => !ehTita(c));
    const ids = [...new Set(mechs.flatMap((c) => armasDoBot(c)))];
    expect(ids.length).toBeGreaterThanOrEqual(6);
    for (const id of ids) {
      const chassi = mechs.find((c) => armasDoBot(c).includes(id))!;
      const { match, run, acertos } = await partida(esq([mech({ chassi, arma: { id, tier: 0 } })], []), {}, true);
      run(30);
      expect(match.bots.mechs[0]!.loadout.primary.id, `${id} no ${chassi}`).toBe(id);
      expect(acertos(), `${id} (${chassi}) não acertou o jogador em 30 s`).toBeGreaterThan(0);
    }
  }, 120_000);

  it('a arma decide a distância de tiro: a escopeta (8 m de alcance ótimo) vem para junto, o gelo chega perto, o plasma atira de longe', async () => {
    const distancia = async (bot: BotSpec) => {
      const p = await partida(esq([bot], []), {}, true);
      p.run(20);
      const cerebro = p.match.bots.brainOf(p.match.bots.mechs[0]!)!;
      // O "perto demais" também encolhe, na mesma proporção, senão o bot de escopeta recuaria dos 10 m onde ele quer estar.
      return { atacou: p.primeiroAtaque(), alcance: cerebro.attackRange, recua: (cerebro as unknown as { keepMinRange: number }).keepMinRange };
    };
    const plasma = await distancia(mech());
    const escopeta = await distancia(mech({ chassi: 'lancerL1', arma: { id: 'shotgun', tier: 0 } }));
    const gelo = await distancia(mech({ arma: { id: 'cryo', tier: 0 } }));
    // A distância de ataque é a do tipo de robô (38 m) até onde a arma rende; a escopeta e o gelo a encurtam, o plasma e o resto não.
    expect(plasma.alcance).toBe(38);
    expect(escopeta.alcance).toBe(10);
    expect(gelo.alcance).toBe(25);
    expect(plasma.recua).toBe(14);
    expect(escopeta.recua).toBeLessThan(escopeta.alcance / 2);
    expect(gelo.recua).toBeLessThan(plasma.recua);
    for (const id of ['emp', 'arc', 'autocannon'] as const) {
      const outra = await distancia(mech({ arma: { id, tier: 0 } }));
      expect(outra.alcance, id).toBe(38);
    }
    // E o bot vai até lá: começa a atacar perto da distância dele, não da do plasma.
    expect(plasma.atacou).toBeGreaterThan(30);
    expect(gelo.atacou).toBeLessThan(plasma.atacou! - 4);
    expect(escopeta.atacou).toBeLessThan(18);
  }, 60_000);

  it('o andróide aliado escolta o jogador (o escudeiro pequeno vai atrás e luta com a motosserra)', async () => {
    const { match, player, run } = await partida(esq([], [android()]));
    const escudeiro = match.allies!.mechs[0]!;
    expect(escudeiro).toBeInstanceOf(Android);
    run(12);
    expect(escudeiro.alive).toBe(true);
    expect(dist2(escudeiro.simPosition, player.simPosition)).toBeLessThan(25);
  });
});

describe('um esquadrão grande aguenta', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    for (const p of abertas.splice(0)) p.world.free();
  });

  const cheio = (): EsquadraoSpec => esq(
    [...varios(16, () => mech()), ...varios(6, () => android()), ...varios(2, () => tecnico())],
    [...varios(6, () => mech()), ...varios(2, () => android())],
  );

  it('o teto cabe: 24 inimigos e 8 aliados (32 robôs) nascem inteiros e no chão, cada um no seu ponto, sem ser jogado para fora', async () => {
    const { match, run } = await partida(cheio());
    const todos = [...match.bots.mechs, ...match.allies!.mechs];
    expect(todos).toHaveLength(32);
    const antes = todos.map((m) => m.simPosition.clone());
    run(0.1);
    for (const [i, m] of todos.entries()) {
      expect(Number.isFinite(m.simPosition.x + m.simPosition.y + m.simPosition.z), `${i}`).toBe(true);
      expect(m.simPosition.y, `${i}`).toBeGreaterThan(-0.3);
      expect(m.simPosition.y, `${i}`).toBeLessThan(1.2);
      // Em 6 ticks nenhum anda mais que alguns passos: quem fosse expulso de dentro de uma parede iria longe.
      expect(dist2(m.simPosition, antes[i]!), `${i}`).toBeLessThan(2);
    }
    const lugares = new Set(todos.map((m) => `${Math.round(m.simPosition.x / 2)},${Math.round(m.simPosition.z / 2)}`));
    expect(lugares.size).toBe(32);
  });

  it('é determinístico: o mesmo esquadrão grande, duas vezes, dá a mesma partida', async () => {
    const foto = async () => {
      const { match, run } = await partida(cheio());
      run(12);
      return [...match.bots.mechs, ...match.allies!.mechs].map((m) => `${m.simPosition.x.toFixed(2)},${m.simPosition.z.toFixed(2)},${Math.round(m.modules.torso)}`).join('|');
    };
    expect(await foto()).toBe(await foto());
  }, 60_000);

  it('o pool de tiros cresce com os Mechs que atiram (senão o tiro some): 64 no jogo de hoje, mais 4 por Mech a partir do quarto', async () => {
    const pool = (m: Match) => (m.projectiles as unknown as { pool: unknown[] }).pool.length;
    expect(pool((await partida(undefined)).match)).toBe(64);
    expect(pool((await partida(esq(varios(3, () => mech())), { allies: false })).match)).toBe(64);
    expect(pool((await partida(cheio())).match)).toBe(64 + 4 * (16 + 6 - 3));
  });

  it('o tick fica dentro do orçamento (G14): o teto inteiro, no Node, em 8 ms por tick no pior caso medido na média', async () => {
    const { match, run } = await partida(cheio());
    run(2);
    const t0 = performance.now();
    run(10);
    const mediaMs = (performance.now() - t0) / Math.round(10 / FIXED_DT);
    // Medido: 1,3 a 1,9 ms no PC do dono; o CI é 2 a 3 vezes mais lento. Quatro vezes a medida pega o que explode (um laço N²), não o ruído.
    expect(mediaMs).toBeLessThan(8);
    expect(match.bots.mechs.length + match.allies!.mechs.length).toBe(LIMITES_DO_ESQUADRAO.total);
  }, 60_000);

  it('o tick com dois titãs na sala cheia (o teto de 32 corpos, dois deles Colossus) continua dentro do orçamento (P108)', async () => {
    const pedido = cheio();
    pedido.inimigos[0] = mech({ chassi: 'colossusv4' });
    pedido.inimigos[1] = mech({ chassi: 'colossus01' });
    const { match, run } = await partida(pedido);
    run(2);
    const t0 = performance.now();
    run(10);
    const mediaMs = (performance.now() - t0) / Math.round(10 / FIXED_DT);
    // Medido (13/10, máquina carregada): 1,7 ms por tick a sala cheia de Mechs e 2,05 ms com dois deles trocados por titãs (+0,3 ms).
    expect(mediaMs).toBeLessThan(8);
    expect(match.bots.mechs.filter((m) => m.stats.height >= 14)).toHaveLength(2);
    expect(match.bots.mechs.length + match.allies!.mechs.length).toBe(LIMITES_DO_ESQUADRAO.total);
  }, 90_000);
});

describe('os titãs como bots inimigos (P108)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    for (const p of abertas.splice(0)) p.world.free();
  });

  const titas = () => esq([mech({ chassi: 'colossusv4', nome: 'GOLIAS' }), mech({ chassi: 'colossus01' }), mech()], []);

  it('nascem nos pontos deles, com a altura de titã, o nome pedido e o perfil de cerco (longe, sem correr)', async () => {
    const { match } = await partida(titas());
    const [v4, c1, comum] = match.bots.mechs;
    expect(v4!.stats.height).toBe(20);
    expect(c1!.stats.height).toBe(14);
    expect(comum!.stats.height).toBeLessThan(6);
    expect(v4!.simPosition.x).toBeCloseTo(PONTOS_DOS_TITAS[0]![0], 0);
    expect(v4!.simPosition.z).toBeCloseTo(PONTOS_DOS_TITAS[0]![1], 0);
    expect(c1!.simPosition.x).toBeCloseTo(PONTOS_DOS_TITAS[1]![0], 0);
    expect(comum!.simPosition.x).toBeCloseTo(BOT_SPAWNS[0]![0], 0); // o Mech comum segue no ponto de sempre
    expect(match.bots.nameOf(v4!)).toBe('GOLIAS');
    expect(match.bots.nameOf(c1!)).toBe('COLOSSUS-01');
    // O perfil de cerco: ataca de 46 m (o do chefe); o Mech comum, de 38.
    expect(match.bots.brainOf(v4!)!.attackRange).toBe(46);
    expect(match.bots.brainOf(c1!)!.attackRange).toBe(46);
    expect(match.bots.brainOf(comum!)!.attackRange).toBe(38);
  });

  it('o canhão de cerco do bot sai com o dano limitado e o chefe segue com plasma', async () => {
    const { match } = await partida(titas());
    const [v4, c1] = match.bots.mechs;
    expect(v4!.loadout.primary.id).toBe('siege');
    expect(v4!.loadout.primary.damage).toBeCloseTo(weapon('siege').damage * DANO_DO_CERCO_DO_BOT);
    expect(c1!.loadout.primary.id).toBe('plasma');
  });

  it('o titã vem para cima e acerta o jogador (o canhão sai sem a carga do jogador)', async () => {
    const { match, acertos, run } = await partida(esq([mech({ chassi: 'colossusv4' })], []), {}, true);
    const v4 = match.bots.mechs[0]!;
    const antes = Math.hypot(v4.simPosition.x, v4.simPosition.z);
    run(90);
    expect(Math.hypot(v4.simPosition.x, v4.simPosition.z), 'o titã não se aproximou').toBeLessThan(antes - 30);
    expect(acertos(), 'o titã não acertou o jogador em 90 s').toBeGreaterThan(0);
  }, 120_000);

  it('abatido, o titã demora para voltar (e o Mech comum volta em 4 s)', async () => {
    const { match, run } = await partida(esq([mech({ chassi: 'colossus01' }), mech()], []));
    const [c1, comum] = match.bots.mechs;
    c1!.modules.torso = 0;
    comum!.modules.torso = 0;
    run(10);
    expect(c1!.alive, 'o titã voltou cedo demais').toBe(false);
    expect(comum!.alive, 'o Mech comum deveria ter voltado').toBe(true);
    run(TITA_RESPAWN_S);
    expect(c1!.alive, 'o titã não voltou').toBe(true);
  }, 120_000);

  it('titã do lado aliado vira Vector-09 e o excedente (mais de dois) é cortado antes de nascer', async () => {
    const { match } = await partida(esq([mech({ chassi: 'colossusv4' }), mech({ chassi: 'colossusv4' }), mech({ chassi: 'colossus01' })], [mech({ chassi: 'colossusv4' })]));
    expect(match.bots.mechs.filter((m) => m.stats.height >= 14)).toHaveLength(2);
    expect(match.allies!.mechs[0]!.stats.height).toBeLessThan(6);
  });
});

describe('a mão esquerda do bot atira de verdade (P108 b)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    for (const p of abertas.splice(0)) p.world.free();
  });

  /** Quantos tiros de cada arma saíram da partida: o que o `ProjectileSystem` recebeu, por id. */
  async function contando(bot: BotSpec, segundos: number) {
    const p = await partida(esq([bot], []), {}, true);
    const porArma: Record<string, number> = {};
    const projeteis = p.match.projectiles as unknown as { fire: (...a: unknown[]) => unknown };
    const original = projeteis.fire.bind(projeteis);
    projeteis.fire = (...a: unknown[]) => {
      const w = a[4] as { id: string };
      porArma[w.id] = (porArma[w.id] ?? 0) + 1;
      return original(...a);
    };
    p.run(segundos);
    return { ...p, porArma };
  }

  it('com uma arma na esquerda o robô atira as duas, cada uma na cadência dela; sem ela, só a principal (o jogo de sempre)', async () => {
    const sem = await contando(mech({ arma: { id: 'plasma', tier: 0 } }), 25);
    expect(sem.porArma.plasma ?? 0).toBeGreaterThan(0);
    expect(sem.porArma.arc ?? 0, 'sem secundária não pode sair tiro da esquerda').toBe(0);
    const com = await contando(mech({ arma: { id: 'plasma', tier: 0 }, secundaria: { id: 'arc', tier: 0 } }), 25);
    expect(com.porArma.plasma ?? 0).toBeGreaterThan(0);
    expect(com.porArma.arc ?? 0).toBeGreaterThan(0);
    // A cadência é a da arma: nunca mais que um tiro a cada fireInterval (0,45 s) em 25 s.
    expect(com.porArma.arc!).toBeLessThanOrEqual(Math.ceil(25 / 0.45) + 1);
    expect(com.acertos()).toBeGreaterThan(0);
  }, 120_000);

  it('o calor da esquerda entra no Mech (quem soma armas esquenta mais)', async () => {
    const um = await partida(esq([mech({ arma: { id: 'plasma', tier: 0 } })], []), {}, true);
    const dois = await partida(esq([mech({ arma: { id: 'plasma', tier: 0 }, secundaria: { id: 'arc', tier: 0 } })], []), {}, true);
    let maximoUm = 0;
    let maximoDois = 0;
    for (let i = 0; i < Math.round(20 / FIXED_DT); i++) {
      um.match.step(FIXED_DT);
      dois.match.step(FIXED_DT);
      maximoUm = Math.max(maximoUm, um.match.bots.mechs[0]!.heat);
      maximoDois = Math.max(maximoDois, dois.match.bots.mechs[0]!.heat);
    }
    expect(maximoDois).toBeGreaterThan(maximoUm);
  }, 120_000);

  it('o esquadrão salvo com a secundária nasce com ela na mão (loadout.secondary) e o aliado também pode levar uma', async () => {
    const { match } = await partida(esq([mech({ secundaria: { id: 'arc', tier: 1 } })], [mech({ secundaria: { id: 'blaster', tier: 0 } })]));
    expect(match.bots.mechs[0]!.loadout.secondary?.id).toBe('arc');
    expect(match.bots.mechs[0]!.loadout.secondary?.tier).toBe(1);
    expect(match.allies!.mechs[0]!.loadout.secondary?.id).toBe('blaster');
  });
});
