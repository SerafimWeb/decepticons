import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechBase } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { PhysicsWorld, type PhysicsHit } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { FIRE_RING } from './EnergyShield';
import { STATUS } from './StatusEffects';
import { weapon, type Tier } from './weapons';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const CRYO = weapon('cryo');

/**
 * Dono, 11/10: *"posso mandar meu amigo que tenha a tecnologia do anel de fogo, e eu congelo ele pra ele ficar rushando com os inimigos e soltando o anel enquanto eu mando
 * gelo nele pra compensar (por exemplo numa área de recuperação rápida de energia e ele possa ficar macetando ali)"*. O gelo de um **aliado** esfria o aliado (tira calor
 * e apaga o fogo, sem dano e sem congelar); o gelo num inimigo segue congelando.
 */
describe('gelo amigo: quem é do mesmo lado (Match.sameSide)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  async function arena() {
    const physics = await PhysicsWorld.create();
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: { ...DEFAULT_SETTINGS, enemyAndroids: 0, technician: false }, debris: false });
    const eu = new Vector09();
    match.addPlayer(eu, 'EU');
    return { physics, match, eu };
  }

  it('na Arena offline, o jogador e os aliados dele são do mesmo lado; os rebeldes, não', async () => {
    const { match, eu } = await arena();
    const aliado = match.allies!.mechs[0]!;
    const aliado2 = match.allies!.mechs[1];
    const rebelde = match.bots.mechs[0]!;
    expect(match.sameSide(eu, aliado)).toBe(true);
    expect(match.sameSide(aliado, eu)).toBe(true);
    if (aliado2) expect(match.sameSide(aliado, aliado2)).toBe(true);
    expect(match.sameSide(eu, rebelde)).toBe(false);
    expect(match.sameSide(aliado, rebelde)).toBe(false);
    expect(match.sameSide(eu, eu)).toBe(false); // ninguém é aliado de si mesmo
  });

  it('dois jogadores humanos na mesma partida NÃO são aliados (o servidor de hoje é todos contra todos)', async () => {
    const { match, eu } = await arena();
    const outro = new Vector09();
    match.addPlayer(outro, 'OUTRO');
    expect(match.sameSide(eu, outro)).toBe(false);
    expect(match.sameSide(outro, eu)).toBe(false);
  });

  it('com times na sala (setTeam): o mesmo time é aliado, times diferentes não, e tirar o time desfaz', async () => {
    const { match, eu } = await arena();
    const amigo = new Vector09();
    const rival = new Vector09();
    match.addPlayer(amigo, 'AMIGO');
    match.addPlayer(rival, 'RIVAL');
    match.setTeam(eu, 1);
    match.setTeam(amigo, 1);
    match.setTeam(rival, 2);
    expect(match.sameSide(eu, amigo)).toBe(true);
    expect(match.sameSide(eu, rival)).toBe(false);
    expect(match.sameSide(amigo, rival)).toBe(false);
    match.setTeam(amigo, null);
    expect(match.sameSide(eu, amigo)).toBe(false);
  });

  it('no CTF, quem é do mesmo time da bandeira é aliado (dois azuis), e azul e vermelho não', async () => {
    const physics = await PhysicsWorld.create();
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, mode: 'ctf' });
    const azul1 = new Vector09();
    const azul2 = new Vector09();
    match.addPlayer(azul1, 'A1');
    match.addPlayer(azul2, 'A2');
    const vermelho = match.bots.mechs[0]!;
    expect(match.sameSide(azul1, azul2)).toBe(true);
    expect(match.sameSide(azul1, vermelho)).toBe(false);
  });
});

describe('gelo amigo: o que o tiro faz', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  async function palco() {
    const physics = await PhysicsWorld.create();
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: { ...DEFAULT_SETTINGS, enemyAndroids: 0, technician: false }, debris: false });
    const eu = new Vector09();
    match.addPlayer(eu, 'EU');
    const aliado = match.allies!.mechs[0]!;
    const rebelde = match.bots.mechs[0]!;
    const eventos: unknown[] = [];
    match.combat.onMechHit = (e) => eventos.push(e);
    /** Um tiro de gelo de `quem` em `alvo` (o que o `ProjectileSystem` entrega ao `CombatSystem` ao bater). */
    const gelo = (quem: MechBase, alvo: MechBase, tier: Tier = 0): void => {
      const w = weapon('cryo', tier);
      const hit: PhysicsHit = { point: new THREE.Vector3(0, 3, 0), normal: new THREE.Vector3(0, 1, 0), distance: 10, collider: alvo.collider };
      match.combat.onProjectileHit(hit, new THREE.Vector3(0, 0, -1), w.damage, quem.collider, w, 10);
    };
    const vida = (m: MechBase) => m.modules.torso + m.modules.head + m.modules.leftArm + m.modules.rightArm + m.modules.leftLeg + m.modules.rightLeg;
    return { match, eu, aliado, rebelde, eventos, gelo, vida };
  }

  it('o gelo do jogador no aliado esfria: tira 0,10 de calor por tiro, sem dano, sem acúmulo e sem congelar', async () => {
    const { eu, aliado, gelo, vida, eventos } = await palco();
    aliado.absorbBurn(0.6);
    const vidaAntes = vida(aliado);
    gelo(eu, aliado);
    expect(aliado.heat).toBeCloseTo(0.5, 5);
    expect(vida(aliado)).toBe(vidaAntes);
    expect(aliado.status.stacks).toBe(0);
    expect(aliado.status.isFrozen).toBe(false);
    expect(aliado.status.active).toBe(false);
    expect(eventos).toHaveLength(0); // o marcador de acerto do HUD é de dano
  });

  it('três tiros seguidos NÃO congelam o aliado (num inimigo congelariam), e o calor desce 0,30', async () => {
    const { eu, aliado, rebelde, gelo } = await palco();
    aliado.absorbBurn(0.8);
    for (let i = 0; i < 3; i++) gelo(eu, aliado);
    expect(aliado.heat).toBeCloseTo(0.5, 5);
    expect(aliado.status.isFrozen).toBe(false);
    for (let i = 0; i < 3; i++) gelo(eu, rebelde);
    expect(rebelde.status.isFrozen).toBe(true); // o inimigo, sim
  });

  it('apaga o fogo do aliado', async () => {
    const { eu, aliado, gelo } = await palco();
    aliado.status.burnUp();
    expect(aliado.status.burning).toBe(true);
    gelo(eu, aliado);
    expect(aliado.status.burning).toBe(false);
  });

  it('o gelo no inimigo continua igual: dano, acúmulo de gelado e calor do dano; nada de resfriamento', async () => {
    const { eu, rebelde, gelo, vida } = await palco();
    const antes = vida(rebelde);
    gelo(eu, rebelde);
    expect(antes - vida(rebelde)).toBeGreaterThan(0);
    expect(rebelde.status.stacks).toBe(1);
  });

  it('o aliado também esfria o jogador (o gelo de um aliado, de qualquer lado do par)', async () => {
    const { eu, aliado, gelo } = await palco();
    eu.absorbBurn(0.4);
    gelo(aliado, eu);
    expect(eu.heat).toBeCloseTo(0.3, 5);
    expect(eu.status.stacks).toBe(0);
  });

  it('o nível sobe o resfriamento junto com o dano da arma: 0,10 / 0,12 / 0,14 por tiro', async () => {
    const { eu, aliado, gelo } = await palco();
    const tira = (tier: Tier): number => {
      aliado.absorbBurn(0.9);
      const antes = aliado.heat;
      gelo(eu, aliado, tier);
      const depois = aliado.heat;
      aliado.vent(1); // zera para o próximo
      return antes - depois;
    };
    expect([tira(0), tira(1), tira(2)].map((x) => Math.round(x * 100) / 100)).toEqual([0.1, 0.12, 0.14]);
    expect(weapon('cryo', 2).damage * STATUS.friendlyVentPerDamage).toBeCloseTo(0.14, 5);
  });

  it('o calor nunca fica negativo: esfriar um aliado frio não faz nada', async () => {
    const { eu, aliado, gelo } = await palco();
    expect(aliado.heat).toBe(0);
    gelo(eu, aliado);
    expect(aliado.heat).toBe(0);
  });

  it('esfriar tira um aliado superaquecido da trava quando o calor desce abaixo do limite de recuperação', async () => {
    const { eu, aliado, gelo } = await palco();
    aliado.absorbBurn(1);
    expect(aliado.overheated).toBe(true);
    for (let i = 0; i < 7; i++) gelo(eu, aliado); // 0,7 a menos: 0,3, abaixo de heatRecover (0,4)
    expect(aliado.overheated).toBe(false);
  });

  it('aliado morto não é esfriado (o calor que ele já tinha fica como está)', async () => {
    const { eu, aliado, gelo } = await palco();
    aliado.damagePart('torso', 1e6);
    expect(aliado.alive).toBe(false);
    const calor = aliado.heat;
    aliado.status.burnUp(); // o carcaça ainda queima: o gelo amigo não mexe em quem já caiu
    gelo(eu, aliado);
    expect(aliado.heat).toBe(calor);
    expect(aliado.status.burning).toBe(true);
  });

  it('só o gelo esfria: o tiro de outra arma que aplica estado (elétrica) num aliado segue o caminho de sempre', async () => {
    const { match, eu, aliado, vida } = await palco();
    const w = weapon('arc');
    const antes = vida(aliado);
    const hit: PhysicsHit = { point: new THREE.Vector3(0, 3, 0), normal: new THREE.Vector3(0, 1, 0), distance: 10, collider: aliado.collider };
    match.combat.onProjectileHit(hit, new THREE.Vector3(0, 0, -1), w.damage, eu.collider, w, 10);
    expect(vida(aliado)).toBeLessThan(antes); // o gelo é o único tiro que muda por ser amigo (fogo amigo das outras armas continua como era)
  });

  it('o cliente online (dano desligado) não esfria nada: o servidor decide', async () => {
    const { match, eu, aliado, gelo } = await palco();
    match.combat.damageEnabled = false;
    aliado.absorbBurn(0.5);
    gelo(eu, aliado);
    expect(aliado.heat).toBeCloseTo(0.5, 5);
  });

  it('dois humanos da mesma partida sem time (todos contra todos): o gelo do outro congela e machuca, como sempre', async () => {
    const { match, eu, gelo, vida } = await palco();
    const outro = new Vector09();
    match.addPlayer(outro, 'OUTRO');
    const antes = vida(outro);
    gelo(eu, outro);
    expect(vida(outro)).toBeLessThan(antes);
    expect(outro.status.stacks).toBe(1);
  });

  it('com times na sala, o gelo do colega esfria e o do rival machuca', async () => {
    const { match, eu, gelo, vida } = await palco();
    const colega = new Vector09();
    const rival = new Vector09();
    match.addPlayer(colega, 'COLEGA');
    match.addPlayer(rival, 'RIVAL');
    match.setTeam(eu, 1);
    match.setTeam(colega, 1);
    match.setTeam(rival, 2);
    colega.absorbBurn(0.5);
    gelo(eu, colega);
    expect(colega.heat).toBeCloseTo(0.4, 5);
    const antes = vida(rival);
    gelo(eu, rival);
    expect(vida(rival)).toBeLessThan(antes);
  });
});

describe('o combo: o anel de fogo de um amigo, compensado pelo gelo do outro', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  /** O dono do anel (o jogador) e o amigo com a arma de gelo (um aliado). Em `segundos`, o anel pulsa a cada 0,25 s e o gelo atira a cada 0,6 s (se `comGelo`). */
  async function rodada(segundos: number, comGelo: boolean): Promise<{ calor: number; vida: number }> {
    const physics = await PhysicsWorld.create();
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: { ...DEFAULT_SETTINGS, enemyAndroids: 0, technician: false }, debris: false });
    const dono = new Vector09();
    match.addPlayer(dono, 'DONO');
    dono.respawn(new THREE.Vector3(0, 0, 25));
    const amigo = match.allies!.mechs[0]!;
    const w = CRYO;
    const sides = { foes: [match.bots.mechs], friends: [[amigo]] };
    const vida = () => dono.modules.torso + dono.modules.head;
    const inicio = vida();
    let proximoGelo = 0;
    for (let t = 0; t < segundos - 1e-9; t += 0.25) {
      match.fireRing.pulse(dono, sides);
      while (comGelo && proximoGelo <= t + 0.25 - 1e-9) {
        const hit: PhysicsHit = { point: new THREE.Vector3(0, 3, 25), normal: new THREE.Vector3(0, 1, 0), distance: 10, collider: dono.collider };
        match.combat.onProjectileHit(hit, new THREE.Vector3(0, 0, -1), w.damage, amigo.collider, w, 10);
        proximoGelo += w.fireInterval;
      }
    }
    return { calor: dono.heat, vida: inicio - vida() };
  }

  it('sozinho, o anel esquenta quem o solta 0,16 por segundo (em 5 s, ~0,8); com o amigo mandando gelo, o calor fica perto de zero', async () => {
    const sozinho = await rodada(5, false);
    expect(sozinho.calor).toBeCloseTo(FIRE_RING.heat * 20, 1); // 20 pulsos em 5 s
    expect(sozinho.calor).toBeGreaterThan(0.7);
    const compensado = await rodada(5, true);
    expect(compensado.calor).toBeLessThan(sozinho.calor / 3);
    expect(compensado.calor).toBeLessThan(0.25);
  });

  it('o gelo do amigo não machuca nem congela quem solta o anel: ele segue rushando', async () => {
    const r = await rodada(5, true);
    expect(r.vida).toBe(0);
  });

  it('um único gelo por segundo compensa quase todo o calor do anel: 0,17 de resfriamento contra 0,16 de aquecimento', () => {
    const resfria = (CRYO.damage * STATUS.friendlyVentPerDamage) / CRYO.fireInterval;
    const aquece = FIRE_RING.heat / FIRE_RING.pulse;
    expect(resfria).toBeGreaterThanOrEqual(aquece);
    expect(resfria).toBeLessThan(aquece * 1.2); // compensa, mas não é de graça: dois amigos mandando gelo vão além
  });
});
