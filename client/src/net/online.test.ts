import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startServer, type GameServer } from '../../../server/Server';
import { weapon, type Loadout } from '../combat/weapons';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { Android } from '../entities/Android';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { NetClient } from './NetClient';
import { REGRAS_SEM_LIMITE } from '../../../shared/regras';
import { onlineConfig } from './onlineConfig';
import { OnlineSession, RECONEXAO_PADRAO_MS, rotariesOf, type OnlineSessionOptions, type OnlineStatus } from './OnlineSession';
import { messageType } from '../../../shared/net/messages';
import { ACEITE_ATUAL, CONTA_CRIAR_PATH } from '../../../shared/net/auth';
import { codificarPronto, codificarSinal, lerLista, lerSinal, VOZ } from '../../../shared/net/voz';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const MECH_BUILD = 'v1.vector09.plasma-0.rockets-0';
const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('M4: endereço do jogo online', () => {
  it('sem ?sala=, offline; com sala no próprio PC, o servidor local; fora dele, pede o servidor', () => {
    expect(onlineConfig('', 'cybermech.online')).toBeNull();
    expect(onlineConfig('?sala=casa&nome=Dan', 'localhost')).toEqual({ url: 'ws://localhost:2567/?sala=CASA', room: 'CASA', name: 'Dan', explicitName: true });
    expect(onlineConfig('?sala=casa', 'cybermech.online')).toMatchObject({ error: expect.stringContaining('servidor') });
    // Endereço do túnel copiado do navegador (https) vira wss.
    expect(onlineConfig('?sala=x&servidor=https://abc.trycloudflare.com', 'cybermech.online')).toMatchObject({ url: 'wss://abc.trycloudflare.com/?sala=X', room: 'X' });
    expect(onlineConfig('?sala=<b>', 'localhost')).toMatchObject({ error: expect.any(String) });
  });
});

describe('M4: o jogo online contra o servidor de verdade', () => {
  let server: GameServer;
  beforeAll(async () => {
    await RAPIER.init();
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', regrasIniciais: REGRAS_SEM_LIMITE });
  });
  afterAll(async () => {
    await server.close();
  });

  /** A partida local de um jogador online, como o Game monta: sem bots, sem dano, sem rodada própria. */
  async function player(name: string, room: string, build = MECH_BUILD, loadout?: Loadout, extras: Partial<OnlineSessionOptions> = {}) {
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
      ...extras,
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

  /** Segura o gatilho de `a` até `ve` dizer que o outro jogador viu o tiro (a máquina cheia pode não dar nem um tick a um aperto curto de relógio real). */
  async function espera(jogadores: Player[], ve: () => boolean, aperta: () => void, solta: () => void): Promise<boolean> {
    aperta();
    const t0 = performance.now();
    let visto = false;
    while (!visto && performance.now() - t0 < 8000) {
      await play(jogadores, 50);
      visto = ve();
    }
    solta();
    return visto;
  }

  it('o raio laser e o lançador leve de um jogador aparecem para o outro: cada evento de tiro vira feixe ou míssil no mundo dele, só desenho (P152)', async () => {
    const a = await player('Alfa', 'M4P', 'v1.vector09.laser-0.swarm-0', { primary: weapon('laser'), secondary: weapon('swarm') });
    const b = await player('Bravo', 'M4P');
    try {
      await join([a, b], 7);
      expect(b.match.beams.active).toBe(0);
      expect(b.match.rockets.microActive).toBe(0);
      // O laser (Ataque 1): o feixe do Alfa acende no mundo do Bravo.
      expect(await espera([a, b], () => b.match.beams.active > 0, () => (a.commander.firing = true), () => (a.commander.firing = false))).toBe(true);
      await play([a, b], 300);
      // O lançador leve (Ataque 2): os mísseis do Alfa voam no mundo do Bravo (a salva).
      expect(await espera([a, b], () => b.match.rockets.microActive > 0, () => (a.commander.secondaryHeld = true), () => (a.commander.secondaryHeld = false))).toBe(true);
    } finally {
      a.session.dispose();
      b.session.dispose();
    }
  });

  it('o míssil cruzador de um jogador aparece para o outro: o evento de tiro vira o arco no mundo dele, só desenho (P152)', async () => {
    const c = await player('Carlos', 'M4Q', 'v1.vector09.plasma-0.cruise-0', { primary: weapon('plasma'), secondary: weapon('cruise') });
    const d = await player('Dora', 'M4Q');
    try {
      await join([c, d], 7);
      expect(d.match.cruise.active).toBe(0);
      expect(await espera([c, d], () => d.match.cruise.active > 0, () => (c.commander.secondaryHeld = true), () => (c.commander.secondaryHeld = false))).toBe(true);
    } finally {
      c.session.dispose();
      d.session.dispose();
    }
  });

  it('o estado do servidor (choque, gelo) chega ao próprio jogador (previsão) e aos outros, e some quando acaba', async () => {
    const a = await player('Alfa', 'M4S');
    const b = await player('Bravo', 'M4S');
    try {
      await join([a, b], 7);
      const doServidor = server.rooms.get('M4S')!.mechOf(a.session.myId)!;
      const visto = () => b.session.remotes.get(a.session.myId)!.mech.status; // o outro jogador vê com o atraso da interpolação
      doServidor.status.shockUp(true); // atordoado e chocado, decidido pelo servidor
      doServidor.status.chillUp();
      const t0 = performance.now();
      while (!(a.me.status.stunned && visto().shocked) && performance.now() - t0 < 6000) await play([a, b], 60);
      expect(a.me.status.stunned).toBe(true);
      expect(visto().shocked).toBe(true);
      expect(a.me.status.speedMultiplier).toBe(0); // o próprio Mech já para na previsão
      expect(visto().stacks).toBe(1);
      // Passa o tempo (o choque dura 3 s): some no servidor e nos dois clientes.
      const t1 = performance.now();
      while ((a.me.status.active || visto().active) && performance.now() - t1 < 12000) await play([a, b], 100);
      expect(a.me.status.active).toBe(false);
      expect(visto().active).toBe(false);
    } finally {
      a.session.dispose();
      b.session.dispose();
    }
  });

  it('a elétrica de um jogador aparece para o outro: o evento de tiro vira o projétil dela (e não o do plasma), só desenho', async () => {
    const a = await player('Eletra', 'M4F', 'v1.vector09.arc-0.rockets-0', { primary: weapon('arc'), secondary: weapon('rockets') });
    const b = await player('Observador', 'M4F');
    try {
      await join([a, b], 7);
      const desenhados: string[] = []; // os bots da sala também atiram (plasma): importa que a elétrica apareça
      b.match.projectiles.onFired = (_origin, _dir, _owner, w) => desenhados.push(w.id);
      a.commander.firing = true;
      const t0 = performance.now();
      while (!desenhados.includes('arc') && performance.now() - t0 < 10000) await play([a, b], 100);
      a.commander.firing = false;
      expect(desenhados).toContain('arc');
    } finally {
      a.session.dispose();
      b.session.dispose();
    }
  });

  it('as rotatórias que a montagem leva: uma na direita, duas no Marauder (as duas mãos), nenhuma sem rotatória (o outro jogador desenha uma língua por mão)', () => {
    expect(rotariesOf('v1.vector09.rotary-0.rockets-0').map((g) => g.mount)).toEqual(['rightHand']);
    expect(rotariesOf('v1.vector09.plasma-0.rockets-0')).toEqual([]);
    const duas = rotariesOf('v1.marauder.rotary-1.rotary-0.-');
    expect(duas.map((g) => g.mount)).toEqual(['rightHand', 'leftHand']);
    expect(duas.map((g) => g.w.tier)).toEqual([1, 0]); // cada mão leva o nível da arma dela
    expect(rotariesOf('v1.marauder.rotary-0.blaster-0.-').map((g) => g.mount)).toEqual(['rightHand']);
    expect(rotariesOf('v1.marauder.blaster-0.rotary-0.-').map((g) => g.mount)).toEqual(['leftHand']);
    expect(rotariesOf('isto não é uma montagem')).toEqual([]);
  });

  it('o canhão sônico de um Marauder aparece para o outro: uma onda desenhada de CADA ombro (dois eventos de tiro com o encaixe), só desenho', async () => {
    const a = await player('Sonico', 'M4W', 'v1.marauder.blaster-0.blaster-0.sonic-0', { primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('sonic') });
    const b = await player('Observador', 'M4W');
    try {
      await join([a, b], 7);
      const remoto = b.session.remotes.get(a.session.myId)!;
      const bocas = new Set<string>();
      b.match.drawWave = (origem, _dir, w) => {
        if (w.id !== 'sonic') return;
        for (const m of ['rightShoulder', 'leftShoulder'] as const) if (origem.distanceTo(remoto.mech.simMuzzle(new THREE.Vector3(), m)) < 0.05) bocas.add(m);
      };
      a.commander.secondaryHeld = true;
      const t0 = performance.now();
      while (bocas.size < 2 && performance.now() - t0 < 12000) await play([a, b], 100);
      a.commander.secondaryHeld = false;
      expect([...bocas].sort()).toEqual(['leftShoulder', 'rightShoulder']);
    } finally {
      a.session.dispose();
      b.session.dispose();
    }
  });

  it('um Marauder com duas rotatórias: o outro jogador vê o fluxo sair das DUAS mãos (antes só da direita)', async () => {
    const a = await player('Marauder', 'M4D', 'v1.marauder.rotary-0.rotary-0.-', { primary: weapon('rotary'), offhand: weapon('rotary'), secondary: null });
    const b = await player('Observador', 'M4D');
    try {
      await join([a, b], 7);
      const remoto = b.session.remotes.get(a.session.myId)!;
      expect(remoto.guns.map((g) => g.mount)).toEqual(['rightHand', 'leftHand']);
      const bocas = new Set<string>();
      b.match.projectiles.onFired = (origem, _dir, _dono, w) => {
        if (w.id !== 'rotary') return;
        for (const m of ['rightHand', 'leftHand'] as const) if (origem.distanceTo(remoto.mech.simMuzzle(new THREE.Vector3(), m)) < 0.05) bocas.add(m);
      };
      a.commander.firing = true;
      const t0 = performance.now();
      while (bocas.size < 2 && performance.now() - t0 < 12000) await play([a, b], 100);
      a.commander.firing = false;
      expect([...bocas].sort()).toEqual(['leftHand', 'rightHand']);
    } finally {
      a.session.dispose();
      b.session.dispose();
    }
  });

  it('o tiro da mão esquerda de um jogador aparece para o outro saindo da mão esquerda dele, não da direita (protocolo 14: o evento diz o encaixe)', async () => {
    // Dono, 11/10: "tava usando o marauder e os tiros estavam saindo só pela mão direita".
    const a = await player('Canhoto', 'M4L', 'v1.vector09.plasma-0.cryo-0', { primary: weapon('plasma'), secondary: weapon('cryo') });
    const b = await player('Observador', 'M4L');
    try {
      await join([a, b], 7);
      const remoto = b.session.remotes.get(a.session.myId)!;
      const medidos: Array<{ esquerda: number; direita: number }> = [];
      b.match.projectiles.onFired = (origem, _dir, _dono, w) => {
        if (w.id !== 'cryo') return; // os bots da sala também atiram (plasma)
        const esq = remoto.mech.simMuzzle(new THREE.Vector3(), 'leftHand');
        const dir = remoto.mech.simMuzzle(new THREE.Vector3(), 'rightHand');
        medidos.push({ esquerda: origem.distanceTo(esq), direita: origem.distanceTo(dir) });
      };
      a.commander.secondaryHeld = true;
      const t0 = performance.now();
      while (medidos.length < 1 && performance.now() - t0 < 10000) await play([a, b], 100);
      a.commander.secondaryHeld = false;
      expect(medidos.length).toBeGreaterThanOrEqual(1);
      expect(medidos[0]!.esquerda).toBeLessThan(0.05); // saiu da boca esquerda
      expect(medidos[0]!.direita).toBeGreaterThan(1); // e não da direita (a ~2,3 m de distância)
    } finally {
      a.session.dispose();
      b.session.dispose();
    }
  });

  it('a rotatória de um jogador chega ao outro como fluxo desenhado pela bandeira do cano (sem evento por tiro) e para quando o gatilho solta', async () => {
    const a = await player('Rotor', 'M4R', 'v1.vector09.rotary-0.rockets-0', { primary: weapon('rotary'), secondary: weapon('rockets') });
    const b = await player('Observador', 'M4R');
    try {
      await join([a, b], 7);
      const guns = b.session.remotes.get(a.session.myId)!.guns;
      expect(guns).toHaveLength(1);
      expect(guns[0]?.w.id).toBe('rotary'); // a arma vem da montagem do roster, não do desenho do Mech
      expect(guns[0]?.mount).toBe('rightHand');
      expect(b.session.remotes.get(b.session.myId)).toBeUndefined();
      a.commander.firing = true;
      const t0 = performance.now();
      while (b.session.streamShots < 3 && performance.now() - t0 < 10000) await play([a, b], 100);
      expect(b.session.streamShots).toBeGreaterThanOrEqual(3);
      a.commander.firing = false;
      await play([a, b], 2500); // o cano leva 1,5 s para parar, mais a interpolação do outro lado
      const parou = b.session.streamShots;
      await play([a, b], 700);
      expect(b.session.streamShots).toBe(parou);
    } finally {
      a.session.dispose();
      b.session.dispose();
    }
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
  it('o chat de texto pela sessão (P216): Alfa escreve a Bravo e chega com o id e o nome certos; a lista de pilotos tem só pessoas (não os bots); texto sujo chega limpo; escrever a um bot não chega a ninguém', async () => {
    const recebidos: { de: number; texto: string }[] = [];
    const a = await player('Alfa', 'M4T');
    const b = await player('Bravo', 'M4T', MECH_BUILD, undefined, { onTexto: (de, texto) => recebidos.push({ de, texto }) });
    await join([a, b], 7);
    expect(a.session.pilotos().map((p) => p.nome)).toEqual(['Bravo']); // 7 unidades vistas: 1 pessoa e 6 bots; a lista é só de pessoas
    expect(a.session.enviarTexto(b.session.myId, '  oi,\n Bravo\u202E  ')).toBe(true);
    const bot = [...a.session.remotes].find(([, r]) => r.kind === 'mech')![0];
    expect(a.session.enviarTexto(bot, 'alô, bot')).toBe(true); // o cliente manda; o servidor descarta (o destino não é uma pessoa)
    expect(a.session.enviarTexto(b.session.myId, '   ')).toBe(false); // vazia: nem sai
    const t0 = performance.now();
    while (recebidos.length < 1 && performance.now() - t0 < 6000) await play([a, b], 100);
    await play([a, b], 300);
    expect(recebidos).toEqual([{ de: a.session.myId, texto: 'oi, Bravo' }]);
    expect(b.session.nomeDe(recebidos[0]!.de)).toBe('Alfa');
    a.session.dispose();
    b.session.dispose();
  });
  it('o chat de voz pela sessão (P205): a sala avisa o id, o PRONTO de um vira a LISTA dos dois, a oferta chega ao destino com o remetente certo, o nome vem do roster e a saída avisa', async () => {
    const sala: (number | null)[][] = [[], []];
    const voz: Uint8Array[][] = [[], []];
    const extras = (i: number): Partial<OnlineSessionOptions> => ({ onSala: (id) => sala[i]!.push(id), onVoz: (b) => voz[i]!.push(new Uint8Array(b)) });
    const a = await player('Alfa', 'M4VOZ', MECH_BUILD, undefined, extras(0));
    const b = await player('Bravo', 'M4VOZ', MECH_BUILD, undefined, extras(1));
    await join([a, b], 7);
    const [idA, idB] = [a.session.myId, b.session.myId];
    expect(sala[0]).toEqual([idA]);
    expect(sala[1]).toEqual([idB]);
    expect(a.session.nomeDe(idB)).toBe('Bravo');
    expect(b.session.nomeDe(idA)).toBe('Alfa');
    const ate = async (ok: () => boolean) => {
      const t0 = performance.now();
      while (!ok()) {
        if (performance.now() - t0 > 8000) throw new Error('a voz não chegou');
        await play([a, b], 100);
      }
    };
    // A voz é só de conta de maior de idade (P211): duas contas de verdade, com a idade informada, entregam o token da sessão no PRONTO.
    const token = async (email: string) => {
      const r = await fetch(`http://127.0.0.1:${server.port}${CONTA_CRIAR_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha: 'senhasegura', aceite: ACEITE_ATUAL, nascimento: '1990-01' }) });
      return ((await r.json()) as { token: string }).token;
    };
    a.session.enviarVoz(codificarPronto(true, await token('a@sessao.com')));
    b.session.enviarVoz(codificarPronto(true, await token('b@sessao.com')));
    const listaCom = (i: number) => voz[i]!.filter((m) => messageType(m) === VOZ.LISTA).map((m) => lerLista(m)!).some((ids) => ids.length === 2);
    await ate(() => listaCom(0) && listaCom(1));
    const sdp = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\n';
    a.session.enviarVoz(codificarSinal({ id: idB, tipo: 'oferta', sdp }));
    await ate(() => voz[1]!.some((m) => messageType(m) === VOZ.SINAL));
    expect(lerSinal(voz[1]!.find((m) => messageType(m) === VOZ.SINAL)!)).toEqual({ id: idA, tipo: 'oferta', sdp });
    expect(voz[0]!.some((m) => messageType(m) === VOZ.SINAL)).toBe(false);
    a.session.dispose();
    expect(sala[0]!.at(-1)).toBeNull();
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

describe('G13: a conexão que cai volta sozinha (o online caía e pedia para recarregar a página, 17/10)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  /** Um jogador online contra o servidor `url`, com as esperas de reconexão do teste, guardando cada estado que a sessão anuncia. */
  async function jogador(url: string, nome: string, extra: { build?: string; reconexaoMs?: readonly number[]; persistenciaMs?: number; esperaLongaMs?: number } = {}) {
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
    const me = new Vector09();
    match.addPlayer(me, 'VOCÊ');
    match.respawner.untrack(me);
    const commander = { command: { ...IDLE }, firing: false, secondaryHeld: false };
    match.pilots.push({ fixedUpdate: (dt) => me.fixedUpdate(commander.command, dt) });
    const estados: OnlineStatus[] = [];
    const session = new OnlineSession({
      url,
      room: 'G13A',
      name: nome,
      build: extra.build ?? MECH_BUILD,
      match,
      me,
      commander,
      makeUnit: (e) => (e.kind === 'android' || e.kind === 'technician' ? new Android() : new Vector09()),
      scene: new THREE.Scene(),
      onStatus: (s) => estados.push({ ...s }),
      ...(extra.reconexaoMs ? { reconexaoMs: extra.reconexaoMs } : {}),
      ...(extra.persistenciaMs !== undefined ? { persistenciaMs: extra.persistenciaMs } : {}),
      ...(extra.esperaLongaMs !== undefined ? { esperaLongaMs: extra.esperaLongaMs } : {}),
    });
    match.pilots.push(session);
    return { match, me, session, estados };
  }
  type Jogador = Awaited<ReturnType<typeof jogador>>;

  /** Joga em tempo real (o tick fixo e o desenho por quadro, como no navegador) até a condição valer ou o tempo acabar. */
  async function ate(j: Jogador, cond: () => boolean, ms = 10000): Promise<boolean> {
    const t0 = performance.now();
    let last = t0;
    let acc = 0;
    while (performance.now() - t0 < ms) {
      if (cond()) return true;
      const now = performance.now();
      acc += (now - last) / 1000;
      last = now;
      while (acc >= FIXED_DT) {
        j.match.step(FIXED_DT);
        acc -= FIXED_DT;
      }
      j.session.render(1 / 60, now);
      await sleep(5);
    }
    return cond();
  }

  /** Sobe um servidor de novo no MESMO endereço (a porta do que acabou de cair pode levar um instante para sair do sistema). */
  async function subir(porta: number): Promise<GameServer> {
    const t0 = performance.now();
    for (;;) {
      try {
        return await startServer({ port: porta, host: '127.0.0.1', dbContas: ':memory:', regrasIniciais: REGRAS_SEM_LIMITE });
      } catch (e) {
        if (performance.now() - t0 > 8000) throw e;
        await sleep(100);
      }
    }
  }

  it('o servidor cai e volta no mesmo endereço: a sessão avisa "reconectando" (tentativa n de m), entra na sala de novo e vê os robôs de novo', async () => {
    let servidor = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', regrasIniciais: REGRAS_SEM_LIMITE });
    const porta = servidor.port;
    const j = await jogador(`ws://127.0.0.1:${porta}/?sala=G13A`, 'Volta', { reconexaoMs: [100, 200, 300, 500, 800, 1200] });
    try {
      expect(await ate(j, () => j.session.joined && j.session.remotes.size >= 6)).toBe(true);
      const idAntes = j.session.myId;
      await servidor.close();
      expect(await ate(j, () => j.estados.some((s) => s.state === 'reconectando'), 5000), 'avisou que está reconectando').toBe(true);
      expect(j.session.joined, 'caiu da sala: sem id').toBe(false);
      expect(j.session.remotes.size, 'os robôs da sala velha saíram da cena').toBe(0);
      const aviso = j.estados.find((s) => s.state === 'reconectando')!;
      expect(aviso.tentativa).toBeGreaterThanOrEqual(1);
      expect(aviso.de).toBe(6);
      servidor = await subir(porta);
      expect(await ate(j, () => j.session.joined && j.session.remotes.size >= 6, 15000), 'voltou para a sala e viu os robôs').toBe(true);
      expect(j.estados.at(-1)!.state).toBe('na sala');
      expect(j.session.myId).toBeGreaterThanOrEqual(0);
      expect(j.estados.some((s) => s.state === 'caiu'), 'nunca chegou a desistir').toBe(false);
      void idAntes;
    } finally {
      j.session.dispose();
      await servidor.close();
    }
  }, 40000);

  it('reinício avisado (P204): o aviso chega com o contador, o corte traz o código 4010 e a previsão, e a sessão insiste além da lista até o servidor voltar', async () => {
    let servidor = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', regrasIniciais: REGRAS_SEM_LIMITE });
    const porta = servidor.port;
    const j = await jogador(`ws://127.0.0.1:${porta}/?sala=G13A`, 'Avisado', { reconexaoMs: [50, 50], persistenciaMs: 30000, esperaLongaMs: 100 });
    try {
      expect(await ate(j, () => j.session.joined)).toBe(true);
      const fechando = servidor.fecharComAviso({ gracaS: 1, voltaEmS: 45 });
      expect(await ate(j, () => j.estados.some((s) => s.aviso !== undefined), 5000), 'o aviso chegou antes do corte').toBe(true);
      const dado = j.estados.find((s) => s.aviso)!;
      expect(dado.state, 'ainda conectado quando o aviso chega').toBe('na sala');
      expect(dado.aviso!.voltaEmS).toBe(45);
      expect(dado.aviso!.cortaEm - Date.now(), 'o corte é em ~1 s').toBeGreaterThan(0);
      await fechando;
      expect(await ate(j, () => j.estados.some((s) => s.queda?.previsto != null), 5000), 'a queda traz a previsão do aviso').toBe(true);
      const queda = j.estados.find((s) => s.queda)!.queda!;
      expect(queda.previsto! - queda.desde, 'previsto = desde + os 45 s do aviso').toBe(45_000);
      // A lista de tentativas rápidas (2) acabou há tempo e a sessão continua tentando: nunca virou "caiu".
      await ate(j, () => false, 1500);
      expect(j.estados.some((s) => s.state === 'caiu')).toBe(false);
      expect(j.estados.at(-1)!.state).toBe('reconectando');
      servidor = await subir(porta);
      expect(await ate(j, () => j.session.joined, 15000), 'voltou para a sala sozinha').toBe(true);
      expect(j.estados.at(-1)!.queda, 'na sala de novo: sem queda').toBeUndefined();
    } finally {
      j.session.dispose();
      await servidor.close();
    }
  }, 40000);

  it('queda SEM aviso (PC desligou, túnel caiu): sem previsão, insiste pelo tempo da persistência e só então vira "caiu" (com a queda registrada)', async () => {
    const servidor = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', regrasIniciais: REGRAS_SEM_LIMITE });
    const j = await jogador(`ws://127.0.0.1:${servidor.port}/?sala=G13A`, 'Queda', { reconexaoMs: [50, 50], persistenciaMs: 700, esperaLongaMs: 100 });
    try {
      expect(await ate(j, () => j.session.joined)).toBe(true);
      await servidor.close();
      expect(await ate(j, () => j.estados.at(-1)?.state === 'caiu', 8000), 'desistiu depois da persistência').toBe(true);
      const q = j.estados.find((s) => s.state === 'reconectando')!.queda!;
      expect(q.previsto, 'sem aviso, sem previsão').toBeNull();
      expect(j.estados.at(-1)!.queda, 'o "caiu" também diz desde quando').toBeDefined();
      expect(j.estados.filter((s) => s.state === 'reconectando').length, 'tentou além das 2 da lista').toBeGreaterThan(2);
    } finally {
      j.session.dispose();
    }
  }, 30000);

  it('quem nunca entrou numa sala (servidor desligado desde o início) não ganha tela de queda nem insistência: desiste ao fim da lista, como sempre', async () => {
    const servidor = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', regrasIniciais: REGRAS_SEM_LIMITE });
    const porta = servidor.port;
    await servidor.close();
    const j = await jogador(`ws://127.0.0.1:${porta}/?sala=G13A`, 'NuncaEntrou', { reconexaoMs: [50, 80], persistenciaMs: 30000, esperaLongaMs: 100 });
    try {
      expect(await ate(j, () => j.estados.at(-1)?.state === 'caiu', 8000)).toBe(true);
      expect(j.estados.some((s) => s.queda !== undefined || s.aviso !== undefined), 'nenhuma tela de queda').toBe(false);
    } finally {
      j.session.dispose();
    }
  }, 30000);

  it('fecharComAviso sem ninguém conectado não espera o aviso (reiniciar sala vazia é na hora)', async () => {
    const servidor = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', regrasIniciais: REGRAS_SEM_LIMITE });
    const t0 = performance.now();
    await servidor.fecharComAviso({ gracaS: 10, voltaEmS: 60 });
    expect(performance.now() - t0).toBeLessThan(1500);
  });

  it('duas quedas seguidas: a segunda também reconecta com as tentativas inteiras (o contador volta a zero quando a sala volta)', async () => {
    let servidor = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', regrasIniciais: REGRAS_SEM_LIMITE });
    const porta = servidor.port;
    const j = await jogador(`ws://127.0.0.1:${porta}/?sala=G13A`, 'DuasVezes', { reconexaoMs: [100, 150] });
    try {
      expect(await ate(j, () => j.session.joined)).toBe(true);
      for (let queda = 1; queda <= 2; queda++) {
        await servidor.close();
        expect(await ate(j, () => j.estados.at(-1)?.state === 'reconectando', 5000), `queda ${queda}`).toBe(true);
        servidor = await subir(porta);
        expect(await ate(j, () => j.session.joined, 15000), `voltou da queda ${queda}`).toBe(true);
      }
      expect(j.estados.some((s) => s.state === 'caiu')).toBe(false);
      // a tentativa que o aviso mostra recomeça em 1 a cada queda
      expect(j.estados.filter((s) => s.state === 'reconectando' && s.tentativa === 1).length).toBeGreaterThanOrEqual(2);
    } finally {
      j.session.dispose();
      await servidor.close();
    }
  }, 60000);

  it('esgotadas as tentativas com o servidor fora do ar, o estado fica "caiu" (aí o jogador recarrega) e nada mais é tentado', async () => {
    const servidor = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', regrasIniciais: REGRAS_SEM_LIMITE });
    const j = await jogador(`ws://127.0.0.1:${servidor.port}/?sala=G13A`, 'Desiste', { reconexaoMs: [50, 80] });
    try {
      expect(await ate(j, () => j.session.joined)).toBe(true);
      await servidor.close();
      const chegou = await ate(j, () => j.estados.at(-1)?.state === 'caiu', 8000);
      expect(chegou, JSON.stringify(j.estados.map((s) => [s.state, s.tentativa]))).toBe(true);
      const quantos = j.estados.length;
      await sleep(600);
      expect(j.estados.length, 'depois de desistir não anuncia mais nada').toBe(quantos);
      expect(j.estados.filter((s) => s.state === 'reconectando').length).toBe(2);
    } finally {
      j.session.dispose();
    }
  }, 30000);

  it('quem foi recusado (montagem inválida) NÃO reconecta: a resposta do servidor não muda tentando de novo', async () => {
    const servidor = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', regrasIniciais: REGRAS_SEM_LIMITE });
    const j = await jogador(`ws://127.0.0.1:${servidor.port}/?sala=G13A`, 'Recusado', { build: 'lixo', reconexaoMs: [50, 80] });
    try {
      expect(await ate(j, () => j.estados.some((s) => s.state === 'recusado'), 8000)).toBe(true);
      await sleep(500);
      expect(j.estados.some((s) => s.state === 'reconectando')).toBe(false);
      expect(j.estados.at(-1)!.state).toBe('recusado');
    } finally {
      j.session.dispose();
      await servidor.close();
    }
  }, 30000);

  it('encerrar a sessão durante a espera cancela a reconexão: nenhuma conexão nova chega ao servidor que volta', async () => {
    let servidor = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', regrasIniciais: REGRAS_SEM_LIMITE });
    const porta = servidor.port;
    const j = await jogador(`ws://127.0.0.1:${porta}/?sala=G13A`, 'Sai', { reconexaoMs: [600, 600] });
    try {
      expect(await ate(j, () => j.session.joined)).toBe(true);
      await servidor.close();
      expect(await ate(j, () => j.estados.some((s) => s.state === 'reconectando'), 5000)).toBe(true);
      j.session.dispose(); // sai de propósito no meio da espera de 600 ms
      servidor = await subir(porta);
      await sleep(1500);
      expect(servidor.guard.connections, 'ninguém reconectou').toBe(0);
    } finally {
      await servidor.close();
    }
  }, 30000);

  it('as esperas de fábrica somam ~15 s (G13) e a primeira é quase imediata', () => {
    const total = RECONEXAO_PADRAO_MS.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(12_000);
    expect(total).toBeLessThanOrEqual(18_000);
    expect(RECONEXAO_PADRAO_MS[0]).toBeLessThanOrEqual(500);
    for (let i = 1; i < RECONEXAO_PADRAO_MS.length; i++) expect(RECONEXAO_PADRAO_MS[i]!).toBeGreaterThanOrEqual(RECONEXAO_PADRAO_MS[i - 1]!);
  });
});

describe('NetClient: o fim da conexão é avisado UMA vez, venha o error, o close ou os dois (o navegador manda os dois; o Node dos testes às vezes só o error)', () => {
  /** Um WebSocket de mentira que, ao nascer, falha como o de verdade: com o que o teste mandar. */
  function falso(eventos: ('error' | 'close')[]) {
    return class {
      static CONNECTING = 0;
      static OPEN = 1;
      readyState = 0;
      binaryType = '';
      onopen: (() => void) | null = null;
      onmessage: ((e: unknown) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        queueMicrotask(() => {
          for (const e of eventos) (e === 'error' ? this.onerror : this.onclose)?.();
        });
      }
      send(): void {}
      close(): void {}
    };
  }
  const avisos = async (eventos: ('error' | 'close')[]): Promise<number> => {
    vi.stubGlobal('WebSocket', falso(eventos));
    try {
      let n = 0;
      new NetClient('ws://x', { closed: () => n++ });
      await sleep(20);
      return n;
    } finally {
      vi.unstubAllGlobals();
    }
  };

  it('error e depois close (o navegador): um aviso só', async () => {
    expect(await avisos(['error', 'close'])).toBe(1);
  });
  it('só error numa conexão que não abriu (recusada): um aviso', async () => {
    expect(await avisos(['error'])).toBe(1);
  });
  it('só close: um aviso', async () => {
    expect(await avisos(['close'])).toBe(1);
  });
});
