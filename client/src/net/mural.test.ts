import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Writer } from '../../../shared/net/codec';
import { MSG } from '../../../shared/net/messages';
import { decodeMuralPedido, encodeMural, MURAL_FECHOU, newMuralSala, type MuralSala } from '../../../shared/net/mural';
import { MuralCliente, type EstadoDoMural, type SocketDoMural } from './mural';

const w = new Writer(2048);

class Falso implements SocketDoMural {
  binaryType = '';
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  enviados: Uint8Array[] = [];
  fechado = false;
  constructor(readonly url: string) {}
  send(d: Uint8Array): void {
    this.enviados.push(d.slice());
  }
  close(): void {
    this.fechado = true;
  }
  abre(): void {
    this.readyState = 1;
    this.onopen?.();
  }
  quadro(salas: MuralSala[]): void {
    const copia = encodeMural(w, salas, salas.length).slice();
    this.onmessage?.({ data: copia.buffer });
  }
  cai(code: number): void {
    this.onclose?.({ code });
  }
}

const sala = (codigo: string): MuralSala => {
  const s = newMuralSala();
  s.codigo = codigo;
  s.n = 1;
  return s;
};

function montar(token: string | null = 'T0KEN', servidor: string | null | undefined = 'wss://jogo.selvamkt.com.br') {
  const sockets: Falso[] = [];
  const estados: EstadoDoMural[] = [];
  const quadros: MuralSala[][] = [];
  const cliente = new MuralCliente(servidor, () => token, { estado: (e) => estados.push(e), quadro: (q) => quadros.push(q) }, (url) => {
    const s = new Falso(url);
    sockets.push(s);
    return s;
  });
  return { cliente, sockets, estados, quadros };
}

describe('o cliente do mural de câmeras', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sem endereço de servidor ou sem token, nem abre conexão e diz por quê', () => {
    const a = montar('T0KEN', null);
    expect(a.cliente.estado).toBe('sem-servidor');
    expect(a.cliente.temServidor).toBe(false);
    a.cliente.abrir();
    expect(a.sockets).toHaveLength(0);
    const b = montar(null);
    b.cliente.abrir();
    expect(b.sockets).toHaveLength(0);
    expect(b.cliente.estado).toBe('sem-token');
  });

  it('abre `/?mural=1` no servidor (https vira wss), manda o token na primeira mensagem e não o põe no endereço', () => {
    const { cliente, sockets } = montar('T0KEN', 'https://jogo.selvamkt.com.br');
    cliente.abrir();
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.url).toBe('wss://jogo.selvamkt.com.br/?mural=1');
    expect(sockets[0]!.url).not.toContain('T0KEN');
    expect(sockets[0]!.binaryType).toBe('arraybuffer');
    expect(sockets[0]!.enviados).toHaveLength(0); // só depois de abrir
    sockets[0]!.abre();
    expect(decodeMuralPedido(sockets[0]!.enviados[0]!)).toBe('T0KEN');
  });

  it('o primeiro quadro põe "ao vivo" e cada quadro chega a quem ouve; repetir `abrir` não abre outra conexão', () => {
    const { cliente, sockets, estados, quadros } = montar();
    cliente.abrir();
    cliente.abrir();
    expect(sockets).toHaveLength(1);
    expect(estados).toEqual(['conectando']);
    sockets[0]!.abre();
    sockets[0]!.quadro([sala('ARENA'), sala('K7Q2')]);
    sockets[0]!.quadro([sala('ARENA')]);
    expect(estados).toEqual(['conectando', 'ao-vivo']);
    expect(quadros.map((q) => q.map((s) => s.codigo))).toEqual([['ARENA', 'K7Q2'], ['ARENA']]);
  });

  it('mensagem que não é quadro, ou quadro torto, é ignorada (não derruba nem avisa)', () => {
    const { cliente, sockets, estados, quadros } = montar();
    cliente.abrir();
    sockets[0]!.abre();
    sockets[0]!.onmessage?.({ data: 'texto' });
    sockets[0]!.onmessage?.({ data: new Uint8Array([MSG.SNAPSHOT, 0]).buffer });
    sockets[0]!.onmessage?.({ data: new Uint8Array([MSG.MURAL, 1]).buffer }); // diz uma sala e não manda
    expect(quadros).toHaveLength(0);
    expect(estados).toEqual(['conectando']);
  });

  it('token recusado (4003), IP bloqueado (4004) e mural desligado (4005) viram estados finais: nada é refeito', () => {
    for (const [codigo, esperado] of [[MURAL_FECHOU.token, 'token'], [MURAL_FECHOU.bloqueado, 'bloqueado'], [MURAL_FECHOU.desligado, 'desligado']] as const) {
      const { cliente, sockets } = montar();
      cliente.abrir();
      sockets[0]!.abre();
      sockets[0]!.cai(codigo);
      expect(cliente.estado).toBe(esperado);
      vi.advanceTimersByTime(60_000);
      expect(sockets, `${esperado} não tenta de novo`).toHaveLength(1);
    }
  });

  it('caiu a rede: tenta de novo sozinho, cada vez esperando mais (1,5 s, 3 s, 6 s, 10 s), e volta ao vivo', () => {
    const { cliente, sockets, estados } = montar();
    cliente.abrir();
    sockets[0]!.cai(1006);
    expect(cliente.estado).toBe('caiu');
    vi.advanceTimersByTime(1499);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    sockets[1]!.cai(1006);
    vi.advanceTimersByTime(2999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
    sockets[2]!.cai(1006);
    vi.advanceTimersByTime(6000);
    sockets[3]!.cai(1006);
    vi.advanceTimersByTime(10_000);
    sockets[4]!.cai(1006);
    vi.advanceTimersByTime(10_000); // o teto da espera é 10 s
    expect(sockets).toHaveLength(6);
    sockets[5]!.abre();
    sockets[5]!.quadro([sala('ARENA')]);
    expect(cliente.estado).toBe('ao-vivo');
    expect(estados.filter((e) => e === 'caiu').length).toBeGreaterThanOrEqual(1);
    // Voltou: a próxima queda recomeça pela espera curta.
    sockets[5]!.cai(1006);
    vi.advanceTimersByTime(1500);
    expect(sockets).toHaveLength(7);
  });

  it('o servidor calou (sem quadro por 3,5 s): a conexão é dada como morta e refeita', () => {
    const { cliente, sockets } = montar();
    cliente.abrir();
    sockets[0]!.abre();
    sockets[0]!.quadro([sala('ARENA')]);
    vi.advanceTimersByTime(3400);
    expect(sockets).toHaveLength(1);
    sockets[0]!.quadro([sala('ARENA')]); // um quadro renova a espera
    vi.advanceTimersByTime(3400);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(200);
    expect(sockets[0]!.fechado).toBe(true);
    expect(cliente.estado).toBe('caiu');
    vi.advanceTimersByTime(1500);
    expect(sockets).toHaveLength(2);
  });

  it('fechar derruba a conexão, para tudo e não refaz; abrir de novo começa do zero', () => {
    const { cliente, sockets, estados } = montar();
    cliente.abrir();
    sockets[0]!.abre();
    sockets[0]!.quadro([sala('ARENA')]);
    cliente.fechar();
    expect(sockets[0]!.fechado).toBe(true);
    sockets[0]!.cai(1000); // o fechamento chegando depois não vira "caiu"
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
    expect(estados.at(-1)).toBe('ao-vivo');
    cliente.abrir();
    expect(sockets).toHaveLength(2);
    expect(estados.at(-1)).toBe('conectando');
  });

  it('um WebSocket que lança ao abrir não derruba a tela: vira "caiu" e tenta de novo', () => {
    let vez = 0;
    const estados: EstadoDoMural[] = [];
    const cliente = new MuralCliente('wss://x.exemplo', () => 'T', { estado: (e) => estados.push(e) }, () => {
      if (vez++ === 0) throw new Error('bloqueado pelo navegador');
      return new Falso('x');
    });
    cliente.abrir();
    expect(cliente.estado).toBe('caiu');
    vi.advanceTimersByTime(1500);
    expect(vez).toBe(2);
  });
});
