import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, type GameServer } from '../../../server/Server';
import { weapon, type Loadout } from '../combat/weapons';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { Android } from '../entities/Android';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { onlineConfig } from './onlineConfig';
import { OnlineSession } from './OnlineSession';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const MECH_BUILD = 'v1.vector09.plasma-0.rockets-0';
const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('M4: endereço do jogo online', () => {
  it('sem ?sala=, offline; com sala no próprio PC, o servidor local; fora dele, pede o servidor', () => {
    expect(onlineConfig('', 'www.selvamkt.com.br')).toBeNull();
    expect(onlineConfig('?sala=casa&nome=Dan', 'localhost')).toEqual({ url: 'ws://localhost:2567/?sala=CASA', room: 'CASA', name: 'Dan', explicitName: true });
    expect(onlineConfig('?sala=casa', 'www.selvamkt.com.br')).toMatchObject({ error: expect.stringContaining('servidor') });
    // Endereço do túnel copiado do navegador (https) vira wss.
    expect(onlineConfig('?sala=x&servidor=https://abc.trycloudflare.com', 'www.selvamkt.com.br')).toMatchObject({ url: 'wss://abc.trycloudflare.com/?sala=X', room: 'X' });
    expect(onlineConfig('?sala=<b>', 'localhost')).toMatchObject({ error: expect.any(String) });
  });
});

describe('M4: o jogo online contra o servidor de verdade', () => {
  let server: GameServer;
  beforeAll(async () => {
    await RAPIER.init();
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:' });
  });
  afterAll(async () => {
    await server.close();
  });

  /** A partida local de um jogador online, como o Game monta: sem bots, sem dano, sem rodada própria. */
  async function player(name: string, room: string, build = MECH_BUILD, loadout?: Loadout) {
    const physics = await PhysicsWorld.create();
    const match = new Match({
      physics,
      scene: new THREE.Scene(),
      particles: NO_FX,
      foes: { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false },
      debris: false,
      damage: false,
      roundS: Number.POSITIVE_INFINITY,
    });
    const me = new Vector09(loadout ? { loadout } : {});
    match.addPlayer(me, 'VOCÊ');
    match.respawner.untrack(me);
    const commander = { command: { ...IDLE }, firing: false, secondaryHeld: false };
    match.pilots.push({ fixedUpdate: (dt) => me.fixedUpdate(commander.command, dt) });
    const session = new OnlineSession({
      url: `ws://127.0.0.1:${server.port}/?sala=${room}`,
      room,
      name,
      build,
      match,
      me,
      commander,
      makeUnit: (e) => (e.kind === 'android' || e.kind === 'technician' ? new Android() : new Vector09()),
      scene: new THREE.Scene(),
    });
    match.pilots.push(session);
    return { match, me, commander, session };
  }

  type Player = Awaited<ReturnType<typeof player>>;

  /** Tempo real: cada jogo no seu tick fixo de 60 Hz e desenhando por quadro, como no navegador. */
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

  const serverPos = (room: string, p: Player) => server.rooms.get(room)!.positionOf(p.session.myId)!;

  /** Joga até todos entrarem na sala e verem os outros (a máquina ocupada pode atrasar a entrada), mais uma folga. */
  async function join(players: Player[], others: number): Promise<void> {
    const t0 = performance.now();
    while (!players.every((p) => p.session.joined && p.session.remotes.size >= others)) {
      if (performance.now() - t0 > 8000) throw new Error('não entrou na sala');
      await play(players, 100);
    }
    await play(players, 300);
  }

  it('entra, vê os bots da sala, anda, e a previsão local fica onde o servidor diz', async () => {
    const dan = await player('Dan', 'M4A');
    await join([dan], 6);
    expect(dan.session.joined).toBe(true);
    expect(dan.session.remotes.size).toBe(6); // 3 Mechs, 2 andróides, o técnico
    const z0 = dan.me.simPosition.z;
    dan.commander.command.moveZ = 1;
    await play([dan], 1000);
    dan.commander.command.moveZ = 0;
    await play([dan], 1000);
    const local = dan.me.simPosition;
    const auth = serverPos('M4A', dan);
    // Andou (a 9 m/s por 1 s são ~8 m; com a máquina cheia, o servidor do teste pode ficar para trás e o jogo corrige
    // para onde ele está, que é o que importa: a previsão termina onde o servidor diz).
    expect(z0 - local.z).toBeGreaterThan(2);
    // A correção é gradual (20%/tick, salta acima de 3 m): com a máquina cheia, o servidor pode ter ficado
    // para trás durante o `play` e só alcançar no fim, sem ticks sobrando para o cliente terminar de convergir.
    // Dou a mesma folga que o `join()` já dá acima, em vez de um prazo fixo de tempo real.
    {
      const t0 = performance.now();
      while (Math.hypot(local.x - auth.x, local.z - auth.z) >= 0.3) {
        if (performance.now() - t0 > 8000) break; // deixa a asserção abaixo falhar com a mensagem de sempre
        await play([dan], 200);
      }
    }
    expect(Math.hypot(local.x - auth.x, local.z - auth.z)).toBeLessThan(0.3);
    // Os robôs dos outros seguem o servidor (desenhados ~100 ms atrás).
    for (const [id, r] of dan.session.remotes) {
      const s = server.rooms.get('M4A')!.positionOf(id)!;
      if (!r.mech.alive) continue;
      expect(Math.hypot(r.mech.simPosition.x - s.x, r.mech.simPosition.z - s.z)).toBeLessThan(3);
    }
    dan.session.dispose();
  });

  it('previsão errada é corrigida: um desvio de 5 m volta para onde o servidor diz', async () => {
    const dan = await player('Dan', 'M4B');
    await join([dan], 6);
    dan.me.nudge(5, 0, 0); // o jogo local "errou" (o servidor não sabe disso)
    await play([dan], 800);
    const local = dan.me.simPosition;
    const auth = serverPos('M4B', dan);
    // Mesma folga da outra convergência acima: com a máquina cheia, dar mais tempo real em vez de um prazo fixo.
    {
      const t0 = performance.now();
      while (Math.hypot(local.x - auth.x, local.z - auth.z) >= 0.3) {
        if (performance.now() - t0 > 8000) break;
        await play([dan], 200);
      }
    }
    expect(Math.hypot(local.x - auth.x, local.z - auth.z)).toBeLessThan(0.3);
    dan.session.dispose();
  });

  it('a chuva de mísseis de um jogador aparece para o outro: o evento de tiro vira o lançamento no mundo dele, só desenho', async () => {
    const a = await player('Alfa', 'M4D', 'v1.vector09.plasma-0.barrage-0', { primary: weapon('plasma'), secondary: weapon('barrage') });
    const b = await player('Bravo', 'M4D');
    await join([a, b], 7);
    expect(b.match.barrage.active).toBe(0);
    // Segura o gatilho até o outro ver a chuva: com a máquina cheia (suíte em paralelo) um aperto curto de relógio real
    // pode não virar nem um tick, e o teste ficava esperando um lançamento que nunca saiu.
    a.commander.secondaryHeld = true;
    const t0 = performance.now();
    let visto = false;
    while (!visto && performance.now() - t0 < 8000) {
      await play([a, b], 50);
      visto = b.match.barrage.active > 0;
    }
    a.commander.secondaryHeld = false;
    expect(visto).toBe(true);
    a.session.dispose();
    b.session.dispose();
  });

  it('dois jogadores na mesma sala: cada um vê o outro como pessoa, e o movimento de um aparece para o outro', async () => {
    const a = await player('Alfa', 'M4C');
    const b = await player('Bravo', 'M4C');
    await join([a, b], 7);
    const other = b.session.remotes.get(a.session.myId);
    expect(other?.kind).toBe('human');
    const x0 = other!.mech.simPosition.x;
    a.commander.command.moveX = 1; // Alfa anda para a direita
    // Jogo até o movimento chegar pela rede (com a máquina cheia, o servidor do teste pode demorar mais
    // que os ~350 ms nominais para ticar e mandar o estado; a mesma folga que o `join` já dá acima).
    const t0 = performance.now();
    while (other!.mech.simPosition.x - x0 <= 3) {
      if (performance.now() - t0 > 8000) break; // deixa a asserção abaixo falhar com a mensagem de sempre
      await play([a, b], 200);
    }
    expect(other!.mech.simPosition.x - x0).toBeGreaterThan(3);
    a.session.dispose();
    b.session.dispose();
  });
  it('trilho e EMP são aceitos e o outro jogador recebe carga e tiros distintos', async () => {
    const a=await player('Trilho','M4E','v1.vector09.railgun-0.emp-0',{primary:weapon('railgun'),secondary:weapon('emp')});
    const b=await player('Observador','M4E');
    try {
      await join([a,b],7);
      a.commander.firing=true;
      let chargeSeen=false;const start=performance.now();
      while(performance.now()-start<8000&&!chargeSeen){await play([a,b],50);chargeSeen=!!b.session.remotes.get(a.session.myId)?.mech.weaponCharging;}
      expect(chargeSeen).toBe(true);
      const before=b.session.shotsSeen;const deadline=performance.now();
      while(b.session.shotsSeen===before&&performance.now()-deadline<8000) await play([a,b],100);
      expect(b.session.shotsSeen).toBeGreaterThan(before);
      a.commander.firing=false;a.commander.secondaryHeld=true;
      const secondaryBefore=b.session.shotsSeen;const secondaryStart=performance.now();
      while(b.session.shotsSeen===secondaryBefore&&performance.now()-secondaryStart<8000) await play([a,b],100);
      expect(b.session.shotsSeen).toBeGreaterThan(secondaryBefore);
    } finally {a.session.dispose();b.session.dispose();}
  });

});
