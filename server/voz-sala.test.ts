import RAPIER from '@dimforge/rapier3d-simd-compat';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION } from '../shared/net/constants';
import { decodeWelcome, encodeJoin, encodeLeave, messageType, MSG } from '../shared/net/messages';
import { codificarPronto, codificarSinal, lerLista, lerSinal, VOZ, VOZ_SDP_MAX } from '../shared/net/voz';
import { ArenaRoom, type Peer } from './ArenaRoom';
import { startServer, type GameServer } from './Server';

const BUILD = 'v1.vector09.plasma-0.rockets-0';
const SDP = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\n';
const w = new Writer();
const join = (name: string) => new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name, build: BUILD }));

class FakePeer implements Peer {
  readonly got: Uint8Array[] = [];
  send(bytes: Uint8Array): void {
    this.got.push(new Uint8Array(bytes));
  }
  close(): void {}
  of(tipo: number): Uint8Array[] {
    return this.got.filter((b) => messageType(b) === tipo);
  }
  get id(): number {
    return decodeWelcome(this.of(MSG.WELCOME)[0]!)!.id;
  }
  ultimaLista(): number[] | null {
    const b = this.of(VOZ.LISTA).at(-1);
    return b ? lerLista(b) : null;
  }
}

describe('voz: a sala repassa a sinalização (P205)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('dois jogadores entram na voz, trocam oferta e resposta, e quem sai some da lista', async () => {
    const sala = await ArenaRoom.create('VOZ1');
    const a = new FakePeer();
    const b = new FakePeer();
    sala.receive(a, join('Alfa'));
    sala.receive(b, join('Bravo'));
    sala.receive(a, codificarPronto(true));
    sala.receive(b, codificarPronto(true));
    expect(a.ultimaLista()).toEqual([a.id, b.id]);
    expect(b.ultimaLista()).toEqual([a.id, b.id]);

    sala.receive(a, codificarSinal({ id: b.id, tipo: 'oferta', sdp: SDP }));
    expect(lerSinal(b.of(VOZ.SINAL).at(-1)!)).toEqual({ id: a.id, tipo: 'oferta', sdp: SDP });
    sala.receive(b, codificarSinal({ id: a.id, tipo: 'resposta', sdp: SDP }));
    expect(lerSinal(a.of(VOZ.SINAL).at(-1)!)).toEqual({ id: b.id, tipo: 'resposta', sdp: SDP });

    sala.receive(a, new Uint8Array(encodeLeave(w)));
    expect(b.ultimaLista()).toEqual([b.id]);
    sala.dispose();
  });

  it('quem ainda não entrou na sala (sem JOIN) não entra na voz nem manda sinal', async () => {
    const sala = await ArenaRoom.create('VOZ2');
    const a = new FakePeer();
    const intruso = new FakePeer();
    sala.receive(a, join('Alfa'));
    sala.receive(a, codificarPronto(true));
    sala.receive(intruso, codificarPronto(true));
    sala.receive(intruso, codificarSinal({ id: a.id, tipo: 'oferta', sdp: SDP }));
    expect(intruso.got).toHaveLength(0);
    expect(a.ultimaLista()).toEqual([a.id]);
    expect(a.of(VOZ.SINAL)).toHaveLength(0);
    sala.dispose();
  });

  it('a voz é por sala: o sinal não atravessa para outra sala', async () => {
    const s1 = await ArenaRoom.create('VOZA');
    const s2 = await ArenaRoom.create('VOZB');
    const a = new FakePeer();
    const b = new FakePeer();
    s1.receive(a, join('Alfa'));
    s2.receive(b, join('Bravo'));
    s1.receive(a, codificarPronto(true));
    s2.receive(b, codificarPronto(true));
    s1.receive(a, codificarSinal({ id: b.id, tipo: 'oferta', sdp: SDP }));
    expect(b.of(VOZ.SINAL)).toHaveLength(0);
    s1.dispose();
    s2.dispose();
  });
});

describe('voz: pela rede de verdade, com o teto de tamanho (P205)', () => {
  let server: GameServer;
  beforeAll(async () => {
    await RAPIER.init();
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 100, total: 200, msgs: 200, burst: 200 } });
  });
  afterAll(async () => {
    await server.close();
  });

  function cliente(sala: string) {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/?sala=${sala}`);
    ws.binaryType = 'arraybuffer';
    const got: Uint8Array[] = [];
    let codigo: number | null = null;
    ws.onmessage = (e) => got.push(new Uint8Array(e.data as ArrayBuffer));
    ws.onclose = (e) => (codigo = e.code);
    const aberto = new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('sem conexão'));
    });
    const ate = async (ok: () => boolean, ms = 25_000) => {
      const t0 = Date.now();
      while (!ok()) {
        if (Date.now() - t0 > ms) throw new Error('tempo esgotado');
        await new Promise((r) => setTimeout(r, 10));
      }
    };
    return { ws, got, aberto, ate, codigo: () => codigo, de: (t: number) => got.filter((b) => messageType(b) === t) };
  }

  it('um SDP de 2,4 KB passa de um jogador ao outro pelo servidor (mais que o teto das mensagens de jogo)', async () => {
    const a = cliente('VOZNET');
    const b = cliente('VOZNET');
    await Promise.all([a.aberto, b.aberto]);
    a.ws.send(join('Alfa'));
    b.ws.send(join('Bravo'));
    await a.ate(() => a.de(MSG.WELCOME).length > 0);
    await b.ate(() => b.de(MSG.WELCOME).length > 0);
    const idA = decodeWelcome(a.de(MSG.WELCOME)[0]!)!.id;
    const idB = decodeWelcome(b.de(MSG.WELCOME)[0]!)!.id;
    a.ws.send(codificarPronto(true));
    b.ws.send(codificarPronto(true));
    await b.ate(() => b.de(VOZ.LISTA).length > 0 && lerLista(b.de(VOZ.LISTA).at(-1)!)!.length === 2);

    const sdp = `${SDP}${'a=candidate:1 1 udp 2113937151 192.168.0.10 50000 typ host\r\n'.repeat(40)}`;
    expect(sdp.length).toBeGreaterThan(2400);
    a.ws.send(codificarSinal({ id: idB, tipo: 'oferta', sdp }));
    await b.ate(() => b.de(VOZ.SINAL).length > 0);
    expect(lerSinal(b.de(VOZ.SINAL)[0]!)).toEqual({ id: idA, tipo: 'oferta', sdp });
    expect(a.codigo()).toBeNull();
    expect(b.codigo()).toBeNull();
    a.ws.close();
    b.ws.close();
  });

  it('mensagem de jogo acima de 1 KB continua derrubando a conexão (G7); a de voz passa do teto do SDP também derruba', async () => {
    const jogo = cliente('VOZG7');
    await jogo.aberto;
    jogo.ws.send(new Uint8Array(2000).fill(MSG.INPUT));
    await jogo.ate(() => jogo.codigo() !== null);
    expect(jogo.codigo()).toBe(1009);

    const voz = cliente('VOZG8');
    await voz.aberto;
    voz.ws.send(new Uint8Array(VOZ_SDP_MAX + 4).fill(VOZ.SINAL));
    await voz.ate(() => voz.codigo() !== null);
    expect(voz.codigo()).toBe(1009);
  });
});
