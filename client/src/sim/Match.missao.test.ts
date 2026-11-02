import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { Android } from '../entities/Android';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { BRIEFING_DA_MISSAO_S, MISSOES_DE_COMBATE, type DesfechoDaMissao, type TipoDeMissao } from './MissaoDeCombate';
import { Match } from './Match';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const abertas: PhysicsWorld[] = [];

/** Uma partida no modo missão (na Cidade Neon, sem aliados), com o jogador vivo e o desfecho espionado. */
async function partidaDeMissao(tipo: TipoDeMissao, dano = true) {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map: 'arena', mode: 'missao', missao: tipo, damage: dano, particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate({ ...IDLE }, dt) });
  const fim = vi.fn<(desfecho: DesfechoDaMissao) => void>();
  match.onMissaoFim = (desfecho) => fim(desfecho);
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  /** Passa o briefing: a missão larga e o elenco entra no pool. */
  const larga = (): void => run(BRIEFING_DA_MISSAO_S + 0.1);
  /** Derruba o robô `i` do pool, como o combate faria (o Match conta o abate). */
  const derruba = (i: number): void => {
    match.combat.onMechKilled!(match.bots.mechs[i]!, new THREE.Vector3(), player);
  };
  return { match, player, fim, run, larga, derruba };
}

describe('a missão de combate no Match (P314)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('a partida do Deathmatch não tem missão: sem módulo e sem aviso', async () => {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const match = new Match({ physics, scene: new THREE.Scene(), map: 'arena', mode: 'deathmatch', particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false, allies: false });
    expect(match.missaoDeCombate).toBeNull();
  });

  it('a caça larga com o elenco do plano (2 Mechs e 2 andróides) e o pool sai vazio antes da largada', async () => {
    const { match, larga } = await partidaDeMissao('caca');
    const spy = vi.spyOn(match.bots, 'setRoster');
    larga();
    expect(spy).toHaveBeenCalledWith(2, 2);
    expect(match.missaoDeCombate!.fase).toBe('ativa');
  });

  it('derrubar o alvo marcado cumpre a caça: o desfecho sai uma vez e a missão fica encerrada', async () => {
    const { match, fim, larga, derruba } = await partidaDeMissao('caca');
    larga();
    derruba(0);
    expect(fim).toHaveBeenCalledTimes(1);
    expect(fim).toHaveBeenCalledWith('cumprida');
    expect(match.missaoDeCombate!.terminou).toBe(true);
  });

  it('um escolta caído não cumpre a caça', async () => {
    const { match, fim, larga, derruba } = await partidaDeMissao('caca');
    larga();
    derruba(1);
    expect(fim).not.toHaveBeenCalled();
    expect(match.missaoDeCombate!.alvosCaidos).toBe(0);
  });

  it('na destruição os andróides não contam: só os três Mechs marcados cumprem', async () => {
    const { match, fim, larga, derruba } = await partidaDeMissao('destruicao');
    larga();
    // O pool põe os Mechs primeiro (0 a 2) e os andróides depois (3 a 5): é o que a marcação supõe.
    expect(match.bots.mechs[3]).toBeInstanceOf(Android);
    derruba(3);
    derruba(4);
    expect(fim).not.toHaveBeenCalled();
    derruba(0);
    derruba(1);
    expect(fim).not.toHaveBeenCalled();
    derruba(2);
    expect(fim).toHaveBeenCalledWith('cumprida');
  });

  it('a aniquilação só cumpre quando o elenco inteiro cai', async () => {
    const { fim, larga, derruba } = await partidaDeMissao('aniquilacao');
    larga();
    for (let i = 0; i < MISSOES_DE_COMBATE.aniquilacao.alvos - 1; i++) derruba(i);
    expect(fim).not.toHaveBeenCalled();
    derruba(MISSOES_DE_COMBATE.aniquilacao.alvos - 1);
    expect(fim).toHaveBeenCalledWith('cumprida');
  });

  it('o prazo acaba antes do objetivo: derrota por tempo, e o elenco sai de campo', async () => {
    // Sem dano: o jogador parado não pode morrer antes do prazo, que é o que este teste mede.
    const { match, fim, larga, run } = await partidaDeMissao('caca', false);
    const spy = vi.spyOn(match.bots, 'setRoster');
    larga();
    run(MISSOES_DE_COMBATE.caca.limiteS + 1);
    expect(fim).toHaveBeenCalledWith('tempo');
    expect(spy).toHaveBeenLastCalledWith(0, 0);
  }, 180_000);
});
