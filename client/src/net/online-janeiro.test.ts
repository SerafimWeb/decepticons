import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, type GameServer } from '../../../server/Server';
import { ADMIN_HEADER } from '../../../shared/net/admin';
import { ADMIN_VISIBILIDADE_PATH } from '../../../shared/visibilidade';
import { weapon } from '../combat/weapons';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { Android } from '../entities/Android';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { carregarMapaSeFor } from '../environment/mapasSobDemanda';
import { Match } from '../sim/Match';
import { OnlineSession, type OnlineSessionOptions } from './OnlineSession';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const MECH_BUILD = 'v1.vector09.plasma-0.rockets-0';
const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A missão do 8 DE JANEIRO (P243) em coop online: a sala aceita `modo=survival` no mapa `janeiro`, a multidão nunca
 * manda posição (G11) — só os eventos de morte e fuga pela mão do jogador — e quem entra no meio recebe o passado
 * compacto. Harness igual ao de `online.test.ts` (servidor de verdade, WebSocket de verdade), num arquivo à parte
 * por ser uma área nova e grande.
 */
describe('M4 + P243: o 8 de Janeiro em coop online', () => {
  let server: GameServer;
  const TOKEN_DO_DONO = 'token-do-dono-so-para-o-teste-0123456789';
  beforeAll(async () => {
    await RAPIER.init();
    await carregarMapaSeFor('janeiro');
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', metricasToken: TOKEN_DO_DONO });
    // O mapa nasce restrito (P191/P226): o painel o libera, como o Comandante faria (mesma técnica de `server/mapas.test.ts`).
    const r = await fetch(`http://127.0.0.1:${server.port}${ADMIN_VISIBILIDADE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [ADMIN_HEADER]: TOKEN_DO_DONO },
      body: JSON.stringify({ itens: { 'mapa:janeiro': 'publico' } }),
    });
    expect(r.status).toBe(200);
  });
  afterAll(async () => {
    await server.close();
  });

  /** A partida local de um jogador online na Praça, em Sobrevivência: como o `Game` monta (sem bots locais, sem dano, espelho da multidão — `autoridade: false` por causa do `damage: false`). */
  async function player(name: string, room: string, extras: Partial<OnlineSessionOptions> = {}) {
    const physics = await PhysicsWorld.create();
    const match = new Match({
      physics,
      scene: new THREE.Scene(),
      particles: NO_FX,
      foes: { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false },
      debris: false,
      damage: false,
      roundS: Number.POSITIVE_INFINITY,
      mode: 'survival',
      map: 'janeiro',
    });
    const me = new Vector09();
    match.addPlayer(me, 'VOCÊ');
    match.respawner.untrack(me);
    const commander = { command: { ...IDLE }, firing: false, secondaryHeld: false };
    match.pilots.push({ fixedUpdate: (dt) => me.fixedUpdate(commander.command, dt) });
    const session = new OnlineSession({
      url: `ws://127.0.0.1:${server.port}/?sala=${room}&mapa=janeiro&modo=survival`,
      room,
      name,
      build: MECH_BUILD,
      match,
      me,
      commander,
      makeUnit: (e) => (e.kind === 'faxineiro' ? new Android({ visor: 0x39ff6a, tool: 'repair' }) : e.kind === 'android' ? new Android() : new Vector09()),
      scene: new THREE.Scene(),
      ...extras,
    });
    match.pilots.push(session);
    return { match, me, commander, session };
  }

  type Player = Awaited<ReturnType<typeof player>>;

  /** Tempo real: cada jogo no seu tick fixo de 60 Hz, como no navegador (igual a `online.test.ts`). */
  async function play(players: Player[], ms: number): Promise<void> {
    const start = performance.now();
    let last = start;
    let acc = 0;
    while (performance.now() - start < ms) {
      const now = performance.now();
      acc += (now - last) / 1000;
      last = now;
      while (acc >= FIXED_DT) {
        for (const p of players) p.match.step(FIXED_DT);
        acc -= FIXED_DT;
      }
      for (const p of players) p.session.render(1 / 60, now);
      await sleep(4);
    }
  }

  /** Joga até todos entrarem na sala e verem pelo menos `others` outras unidades (a máquina ocupada pode atrasar a entrada). */
  async function join(players: Player[], others: number): Promise<void> {
    const t0 = performance.now();
    while (!players.every((p) => p.session.joined && p.session.remotes.size >= others)) {
      if (performance.now() - t0 > 8000) throw new Error('não entrou na sala');
      await play(players, 100);
    }
    await play(players, 300);
  }

  /** O primeiro figurante presente (vivo, não fugido) no tick `t` da multidão de `m`. */
  function umPresente(m: NonNullable<Match['multidao']>, t: number): number {
    const p = { x: 0, z: 0 };
    for (let i = 0; i < m.total; i++) if (!m.estaMorto(i) && m.fugiuNoTick(i) < 0 && m.posicao(i, t, p)) return i;
    throw new Error('ninguém presente ainda');
  }

  it('a sala aceita modo=survival no mapa janeiro: entra com a multidão, os androides rebeldes e os faxineiros (sempre ativos, nunca BotController) no roster', async () => {
    const a = await player('Alfa', 'JAN1');
    // 6 rebeldes (hoje por chegar, mas já no roster) + 6 faxineiros (2 por prédio × 3): 12 unidades de bot, sem contar o próprio jogador.
    await join([a], 12);
    expect(a.match.multidao).not.toBeNull();
    expect(a.match.missaoJaneiro).not.toBeNull();
    const kinds = [...a.session.remotes.values()].map((r) => r.kind);
    expect(kinds.filter((k) => k === 'faxineiro')).toHaveLength(6);
    expect(kinds.filter((k) => k === 'android')).toHaveLength(6);
    expect(server.rooms.get('JAN1@janeiro:survival')).toBeDefined();
    a.session.dispose();
  });

  it('o servidor decide quem morre e quem foge na multidão; o cliente aplica no espelho sem nunca receber posição (G11) — e quem entra depois recebe o passado', { timeout: 45_000 }, async () => {
    const a = await player('Alfa', 'JAN2');
    await join([a], 12);
    const room = server.rooms.get('JAN2@janeiro:survival')!;
    const authMatch = room['match'] as Match;
    const authMultidao = authMatch.multidao!;
    // O servidor se adianta sozinho (laço próprio de 60 Hz, fora do `play`): só espera em tempo real até ter gente de pé para atirar.
    const t2 = performance.now();
    while (authMultidao.presentes === 0) {
      if (performance.now() - t2 > 25_000) throw new Error('ninguém chegou na praça a tempo');
      await play([a], 500);
    }
    // O tiro é do servidor (a autoridade): mira em alguém de pé, de perto, sem passar por input de jogador (mesma técnica de `Match.janeiro.test.ts`); tenta de novo com um alvo fresco
    // se errar (quem a `umPresente` achou pode já ter saído da linha quando o projétil resolve).
    const pos = { x: 0, z: 0 };
    let alvo = -1;
    const t0 = performance.now();
    while (alvo < 0) {
      if (performance.now() - t0 > 10_000) throw new Error('o tiro não acertou ninguém a tempo');
      const candidato = umPresente(authMultidao, authMatch.tickDaMissao);
      authMultidao.posicao(candidato, authMatch.tickDaMissao, pos);
      authMatch.projectiles.fire(new THREE.Vector3(pos.x - 6, 1, pos.z), new THREE.Vector3(1, 0, 0), undefined, false, weapon('rotary'));
      await play([a], 150);
      if (authMultidao.estaMorto(candidato) || authMultidao.fugiuNoTick(candidato) >= 0) alvo = candidato;
    }
    const morreuNoServidor = authMultidao.estaMorto(alvo);
    const t1 = performance.now();
    while ((morreuNoServidor ? !a.match.multidao!.estaMorto(alvo) : a.match.multidao!.fugiuNoTick(alvo) < 0)) {
      if (performance.now() - t1 > 4000) throw new Error('o espelho do cliente não recebeu o evento a tempo');
      await play([a], 100);
    }
    expect(a.match.multidao!.estaMorto(alvo)).toBe(authMultidao.estaMorto(alvo));

    // Quem entra agora recebe o passado (JANEIRO_MULTIDAO): o mesmo figurante já aparece morto/fugido no espelho dele, sem esperar outro evento.
    const b = await player('Bravo', 'JAN2');
    await join([a, b], 13); // 12 bots + o Alfa
    expect(b.match.multidao!.estaMorto(alvo)).toBe(authMultidao.estaMorto(alvo));
    if (!morreuNoServidor) expect(b.match.multidao!.fugiuNoTick(alvo)).toBeGreaterThanOrEqual(0);
    a.session.dispose();
    b.session.dispose();
  });
});
