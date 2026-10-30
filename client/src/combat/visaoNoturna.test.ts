import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { DebrisSystem } from '../environment/DebrisSystem';
import type { Destructibles } from '../environment/Destructibles';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { loadoutKey, parseLoadoutKey, validateLoadout, type LoadoutSpec } from '../hangar/loadout';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { QUADRO } from '../sim/QuadroDeLuz';
import { BotSystem } from './BotSystem';
import { CombatSystem } from './CombatSystem';
import { ehModulo, geradorDoModulo, massaDoModulo, MODULOS } from './modulos';
import { ProjectileSystem } from './ProjectileSystem';
import { Respawner } from './Respawner';
import { alcanceDeVisao, ALCANCE_NO_ESCURO, DENUNCIA_DO_TIRO_S, escuridaoDaEnergia, faseEscura, MASSA_DO_MODULO_VISAO } from './visaoNoturna';
import { weapon } from './weapons';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };

describe('a conta da visão noturna (combat/visaoNoturna): a escuridão e o alcance de quem não enxerga no escuro', () => {
  it('a escuridão é o que falta de energia à cidade: dia com o quadro inteiro, escuro total com ele apagado; valor torto cai no dia', () => {
    expect(escuridaoDaEnergia(1)).toBe(0);
    expect(escuridaoDaEnergia(0)).toBe(1);
    expect(escuridaoDaEnergia(0.25)).toBeCloseTo(0.75, 9);
    expect(escuridaoDaEnergia(2)).toBe(0);
    expect(escuridaoDaEnergia(-1)).toBe(1);
    expect(escuridaoDaEnergia(Number.NaN)).toBe(0);
  });

  it('sem visão noturna o alcance cai junto com a luz, até 30% do de sempre; com ela, ou com o clarão do tiro, fica inteiro', () => {
    expect(alcanceDeVisao(90, 0, false, false)).toBe(90);
    expect(alcanceDeVisao(90, 1, false, false)).toBeCloseTo(90 * ALCANCE_NO_ESCURO, 9);
    expect(alcanceDeVisao(90, 0.5, false, false)).toBeCloseTo(90 * (1 - 0.5 * (1 - ALCANCE_NO_ESCURO)), 9);
    expect(alcanceDeVisao(90, 1, true, false)).toBe(90);
    expect(alcanceDeVisao(90, 1, false, true)).toBe(90);
    // monotônico: escurecer nunca devolve alcance a quem não enxerga
    let anterior = Infinity;
    for (let e = 0; e <= 1.0001; e += 0.1) {
      const a = alcanceDeVisao(90, e, false, false);
      expect(a).toBeLessThanOrEqual(anterior);
      anterior = a;
    }
    // escuridão torta não passa dos limites
    expect(alcanceDeVisao(90, 5, false, false)).toBeCloseTo(90 * ALCANCE_NO_ESCURO, 9);
    expect(alcanceDeVisao(90, -3, false, false)).toBe(90);
  });

  it('a fase conta como escura para a tela a partir da metade', () => {
    expect(faseEscura(0.49)).toBe(false);
    expect(faseEscura(0.5)).toBe(true);
    expect(faseEscura(1)).toBe(true);
  });
});

describe('quem enxerga no escuro de fábrica: o Arara, o Lancer e os andróides (ordem do Comandante, 29/10)', () => {
  const NATIVOS: ChassisId[] = ['arara', 'lancerL1', 'android'];

  it('só esses três chassis têm a visão noturna nativa; os outros precisam do módulo', () => {
    const com = (Object.keys(CHASSIS) as ChassisId[]).filter((id) => CHASSIS[id].visaoNoturna === true);
    expect(com.sort()).toEqual([...NATIVOS].sort());
  });

  it('o Mech criado de um chassi nativo enxerga no escuro; o Vector-09 de fábrica não', () => {
    expect(new Vector09({ stats: CHASSIS.arara }).visaoNoturna).toBe(true);
    expect(new Vector09({ stats: CHASSIS.lancerL1 }).visaoNoturna).toBe(true);
    expect(new Vector09({ stats: CHASSIS.android }).visaoNoturna).toBe(true);
    expect(new Vector09().visaoNoturna).toBe(false);
    expect(new Vector09({ stats: CHASSIS.onca }).visaoNoturna).toBe(false);
  });

  it('o técnico e o manifestante (corpos de andróide) também enxergam no escuro', async () => {
    const { ANDROID_STATS, MANIFESTANTE_STATS } = await import('../entities/chassis');
    expect(ANDROID_STATS.visaoNoturna).toBe(true);
    expect(MANIFESTANTE_STATS.visaoNoturna).toBe(true);
  });
});

describe('o módulo de visão noturna no Hangar: os outros chassis o levam no lugar do gerador', () => {
  const spec = (chassis: ChassisId, module: LoadoutSpec['module']): LoadoutSpec => ({
    v: 2,
    chassis,
    right: { id: chassis === 'android' ? 'blaster' : 'plasma', tier: 0 },
    left: chassis === 'lancerL1' ? null : { id: chassis === 'android' ? 'chainsaw' : 'rockets', tier: 0 },
    module,
  });

  it('é um módulo válido, que pesa 0,5 t e não é um gerador de energia', () => {
    expect(ehModulo('visao')).toBe(true);
    expect(ehModulo('fusao')).toBe(false);
    expect(MODULOS).toContain('visao');
    expect(massaDoModulo('visao')).toBe(MASSA_DO_MODULO_VISAO);
    expect(geradorDoModulo('visao')).toBeNull();
    expect(geradorDoModulo('frontal')).toBe('frontal');
    expect(geradorDoModulo(null)).toBeNull();
  });

  it('o Vector-09 monta com a visão noturna: a carga sobe 0,5 t e o Mech enxerga no escuro, sem gerador de energia', () => {
    const sem = validateLoadout(spec('vector09', null));
    const com = validateLoadout(spec('vector09', 'visao'));
    expect(sem.ok && com.ok).toBe(true);
    if (!sem.ok || !com.ok) return;
    expect(com.mass).toBeCloseTo(sem.mass + MASSA_DO_MODULO_VISAO, 9);
    expect(com.loadout.module).toBe('visao');
    const mech = new Vector09({ loadout: com.loadout });
    expect(mech.visaoNoturna).toBe(true);
    expect(mech.energyShield.equipped).toBe(false);
  });

  it('o gerador de energia segue funcionando: o módulo de escudo não dá visão noturna', () => {
    const r = validateLoadout(spec('vector09', 'frontal'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const mech = new Vector09({ loadout: r.loadout });
    expect(mech.energyShield.equipped).toBe(true);
    expect(mech.visaoNoturna).toBe(false);
  });

  it('quem já enxerga de fábrica (Arara, Lancer, andróide) recusa o módulo: ele existe para os outros', () => {
    for (const id of ['arara', 'lancerL1'] as const) {
      const r = validateLoadout(spec(id, 'visao'));
      expect(r.ok, id).toBe(false);
      if (!r.ok) expect(r.error).toBe('encaixe');
    }
    expect(validateLoadout(spec('android', 'visao')).ok).toBe(false);
    // mas o Arara continua podendo levar um gerador (com a carga pequena dele, só um blaster)
    expect(validateLoadout({ v: 2, chassis: 'arara', right: { id: 'blaster', tier: 0 }, left: null, module: 'frontal' }).ok).toBe(true);
  });

  it('o texto da montagem leva o módulo e volta igual (o link e a sala online já carregam a palavra do módulo)', () => {
    const s = spec('vector09', 'visao');
    const chave = loadoutKey(s);
    expect(chave.endsWith('.visao')).toBe(true);
    expect(parseLoadoutKey(chave)?.module).toBe('visao');
    expect(parseLoadoutKey('v2.vector09.plasma-0.rockets-0.-.fusao')).toBeNull();
  });
});

/** O cenário mínimo de um bot e um alvo: o bot olha para -Z e o alvo fica a `distancia` m à frente. */
async function cenario(distancia: number, escuridao: number) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(400, 2, 400));
  const destructibles = { damage: () => false } as unknown as Destructibles;
  const debris = { shatter: () => {} } as unknown as DebrisSystem;
  const combat = new CombatSystem(destructibles, debris, NO_FX);
  const projectiles = new ProjectileSystem(new THREE.Scene(), physics, NO_FX);
  projectiles.onHit = (hit, dir, dmg, owner) => combat.onProjectileHit(hit, dir, dmg, owner);
  const alvo = new Vector09();
  alvo.spawn(physics, new THREE.Vector3(0, 0, -distancia));
  combat.register(alvo);
  const bots = new BotSystem({
    scene: new THREE.Scene(),
    physics,
    combat,
    projectiles,
    particles: NO_FX,
    respawner: new Respawner([[0, 90]]),
    spawns: [[0, 0]],
    waypoints: [[0, 80], [10, 80]],
    seed: 7,
  });
  bots.targets = [alvo];
  bots.escuridao = escuridao;
  const bot = bots.mechs[0]!;
  const brain = bots.brainOf(bot)!;
  const tiros: number[] = [];
  const atira = projectiles.fire.bind(projectiles);
  projectiles.fire = (...args) => {
    tiros.push(1);
    atira(...args);
  };
  physics.step();
  const rodar = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) {
      alvo.fixedUpdate(IDLE, FIXED_DT);
      bots.fixedUpdate(FIXED_DT);
      projectiles.fixedUpdate(FIXED_DT);
      physics.step();
    }
  };
  return { physics, alvo, bot, brain, bots, tiros, rodar };
}

describe('os bots no escuro (G14): quem não tem visão noturna não vê longe, a não ser o que atira', () => {
  const abertas: PhysicsWorld[] = [];
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });
  const abrir = async (distancia: number, escuridao: number) => {
    const c = await cenario(distancia, escuridao);
    abertas.push(c.physics);
    return c;
  };

  it('de dia o bot vê o alvo a 60 m, reage e atira (a linha de base do teste)', async () => {
    const c = await abrir(60, 0);
    c.rodar(3);
    expect(c.tiros.length).toBeGreaterThan(0);
  });

  it('no escuro total, sem visão noturna, o mesmo alvo a 60 m passa despercebido: o bot segue em patrulha e não atira', async () => {
    const c = await abrir(60, 1);
    c.rodar(3);
    expect(c.tiros).toEqual([]);
    expect(c.brain.seesTarget).toBe(false);
    expect(c.brain.state).toBe('patrol');
  });

  it('no escuro total o bot ainda vê o alvo a 20 m (dentro dos 27 m que sobram)', async () => {
    const c = await abrir(20, 1);
    c.rodar(3);
    expect(c.tiros.length).toBeGreaterThan(0);
  });

  it('com visão noturna (o módulo) o bot enxerga a 60 m no escuro como de dia', async () => {
    const c = await abrir(60, 1);
    c.bot.equip({ ...c.bot.loadout, module: 'visao' });
    expect(c.bot.visaoNoturna).toBe(true);
    c.rodar(3);
    expect(c.tiros.length).toBeGreaterThan(0);
  });

  it('o alvo que atira se denuncia: o clarão do tiro o põe à vista a 60 m, e a denúncia acaba em 2,5 s', async () => {
    const c = await abrir(60, 1);
    c.alvo.onFireMount('rightHand', weapon('plasma'));
    expect(c.alvo.denunciadoS).toBeCloseTo(DENUNCIA_DO_TIRO_S, 9);
    c.rodar(2);
    expect(c.tiros.length).toBeGreaterThan(0); // viu o clarão e atirou de volta
    c.rodar(DENUNCIA_DO_TIRO_S);
    expect(c.alvo.denunciadoS).toBe(0);
  });

  it('o disparo da mão esquerda (o botão secundário) também denuncia', async () => {
    const c = await abrir(60, 1);
    c.alvo.onFireSecondary();
    expect(c.alvo.denunciadoS).toBeCloseTo(DENUNCIA_DO_TIRO_S, 9);
  });
});

describe('a escuridão da partida (Match.escuridao): vem do quadro de luz, só com a fase escura ligada', () => {
  const abertas: PhysicsWorld[] = [];
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  async function partida(modo: 'survival' | 'deathmatch') {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const match = new Match({ physics, scene: new THREE.Scene(), map: 'arena', mode: modo, damage: false, startWave: 1, particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
    const player = new Vector09();
    match.addPlayer(player, 'VOCÊ');
    match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate({ ...IDLE }, dt) });
    return match;
  }

  it('desligada (o padrão), a escuridão é zero mesmo com o quadro apagado: nada muda para quem não liberou a fase', async () => {
    const m = await partida('survival');
    expect(m.faseEscura).toBe(false);
    m.quadro!.vida = 0;
    m.quadro!.fixedUpdate(1, 1, 0);
    expect(m.quadro!.apagado).toBe(true);
    expect(m.escuridao).toBe(0);
  });

  it('ligada, acompanha o quadro: dia com ele inteiro, escurece conforme ele apanha, escuro total apagado', async () => {
    const m = await partida('survival');
    m.faseEscura = true;
    expect(m.escuridao).toBe(0);
    m.quadro!.fixedUpdate(1, 5, 0); // um invasor pesado depreda por 1 s
    expect(m.escuridao).toBeGreaterThan(0);
    expect(m.escuridao).toBeLessThan(1);
    m.quadro!.fixedUpdate(60, 5, 0);
    expect(m.quadro!.apagado).toBe(true);
    expect(m.escuridao).toBe(1);
    // reparado até o quadro voltar a ligar, a luz volta junto
    m.quadro!.fixedUpdate(QUADRO.vidaMax / 16, 0, 2);
    expect(m.escuridao).toBeLessThan(1);
  });

  it('o Comandante força a escuridão (o chip FASE ESCURA), com ou sem quadro; sem a fase ligada ela não vale', async () => {
    const dm = await partida('deathmatch');
    expect(dm.quadro).toBeNull();
    dm.faseEscura = true;
    expect(dm.escuridao).toBe(0); // deathmatch sem quadro: dia
    dm.escuridaoForcada = 1;
    expect(dm.escuridao).toBe(1);
    dm.escuridaoForcada = null;
    expect(dm.escuridao).toBe(0);
    dm.faseEscura = false;
    dm.escuridaoForcada = 1;
    expect(dm.escuridao).toBe(0);
  });

  it('a escuridão da partida chega aos cérebros dos bots a cada tick', async () => {
    const m = await partida('deathmatch');
    m.faseEscura = true;
    m.escuridaoForcada = 1;
    m.step(FIXED_DT);
    expect(m.bots.escuridao).toBe(1);
    m.escuridaoForcada = null;
    m.step(FIXED_DT);
    expect(m.bots.escuridao).toBe(0);
  });
});
