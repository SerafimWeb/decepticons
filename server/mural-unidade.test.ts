import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { Writer } from '../shared/net/codec';
import { messageType, MSG } from '../shared/net/messages';
import { decodeMural, encodeMuralPedido, MURAL_FECHOU } from '../shared/net/mural';
import type { ArenaRoom } from './ArenaRoom';
import { Mural, type Veredito } from './mural';

const w = new Writer(256);
const pedido = (token: string) => Buffer.from(encodeMuralPedido(w, token));

/** Um WebSocket falso: guarda o que foi mandado e como acabou. */
class Falso extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  enviados: Buffer[] = [];
  fechou: { codigo: number; motivo: string } | null = null;
  send(b: Buffer): void {
    this.enviados.push(b);
  }
  close(codigo: number, motivo = ''): void {
    this.fechou = { codigo, motivo };
    this.readyState = 3;
    this.emit('close');
  }
  terminate(): void {
    this.readyState = 3;
    this.emit('close');
  }
  manda(b: Buffer): void {
    this.emit('message', b, true);
  }
}
const ws = () => new Falso() as unknown as WebSocket & Falso;

/** Uma sala falsa: o mural só lê `code`, `humanCount` e preenche o quadro com `muralDe`. */
const salaFalsa = (code: string, jogadores: number): ArenaRoom =>
  ({
    code,
    humanCount: jogadores,
    muralDe: (out: { codigo: string; jogadores: number; n: number }) => {
      out.codigo = code;
      out.jogadores = jogadores;
      out.n = 0;
    },
  }) as unknown as ArenaRoom;

describe('o mural (unidade, com o WebSocket falso): o que o servidor de verdade não deixa ver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const montar = (extra: { verificar?: (ip: string, t: string) => Veredito; salas?: ArenaRoom[] } = {}) => {
    const lido = { salas: 0, bytes: 0 };
    const mural = new Mural({
      salas: () => {
        lido.salas++;
        return extra.salas ?? [salaFalsa('ARENA', 2)];
      },
      verificar: extra.verificar ?? ((_ip, t) => (t === 'certo' ? 'ok' : 'negado')),
      aoEnviar: (n) => (lido.bytes += n),
      cadaMs: 250,
      esperaMs: 5000,
    });
    return { mural, lido };
  };

  it('quem ainda não provou o token não recebe quadro nenhum, mesmo com outro espectador já assistindo', () => {
    const { mural } = montar();
    const dono = ws();
    const mudo = ws();
    mural.receber(dono, '1.1.1.1');
    mural.receber(mudo, '2.2.2.2');
    dono.manda(pedido('certo'));
    vi.advanceTimersByTime(1000);
    expect(dono.enviados.length).toBeGreaterThanOrEqual(4); // o de entrada e um por 250 ms
    expect(mudo.enviados).toHaveLength(0);
    expect(mural.assistindo).toBe(1);
    expect(mural.conexoes).toBe(2);
  });

  it('o temporizador nasce com o primeiro espectador e morre com o último: sem ninguém, o servidor não lê sala nenhuma', () => {
    const { mural, lido } = montar();
    vi.advanceTimersByTime(5000);
    expect(lido.salas).toBe(0); // nada assistindo: nem temporizador
    expect(mural.ligado).toBe(false);
    const a = ws();
    mural.receber(a, '1.1.1.1');
    a.manda(pedido('certo'));
    vi.advanceTimersByTime(1000);
    expect(lido.salas).toBeGreaterThan(0);
    expect(mural.ligado).toBe(true);
    a.terminate();
    expect(mural.ligado).toBe(false); // o último saiu: o temporizador morreu na hora
    const parou = lido.salas;
    vi.advanceTimersByTime(10_000);
    expect(lido.salas).toBe(parou); // o último saiu: o temporizador parou
    expect(mural.conexoes).toBe(0);
    // E um espectador novo o religa.
    const b = ws();
    mural.receber(b, '1.1.1.1');
    b.manda(pedido('certo'));
    vi.advanceTimersByTime(500);
    expect(lido.salas).toBeGreaterThan(parou);
    mural.parar();
  });

  it('cada quadro conta nos bytes de saída do servidor (o painel mostra o tráfego), e o mesmo quadro vai a todos', () => {
    const { mural, lido } = montar();
    const a = ws();
    const b = ws();
    mural.receber(a, '1.1.1.1');
    mural.receber(b, '2.2.2.2');
    a.manda(pedido('certo'));
    b.manda(pedido('certo'));
    vi.advanceTimersByTime(250);
    const total = a.enviados.reduce((n, x) => n + x.length, 0) + b.enviados.reduce((n, x) => n + x.length, 0);
    expect(total).toBeGreaterThan(0);
    expect(lido.bytes).toBe(total);
    const ultimoA = a.enviados.at(-1)!;
    const ultimoB = b.enviados.at(-1)!;
    expect(messageType(new Uint8Array(ultimoA))).toBe(MSG.MURAL);
    expect(decodeMural(new Uint8Array(ultimoA))![0]!.codigo).toBe('ARENA');
    expect(Buffer.compare(ultimoA, ultimoB)).toBe(0);
    mural.parar();
  });

  it('o espectador sai do servidor limpo: fechar a conexão tira ele da lista, e parar() derruba todos', () => {
    const { mural } = montar();
    const a = ws();
    const b = ws();
    mural.receber(a, '1.1.1.1');
    mural.receber(b, '2.2.2.2');
    a.manda(pedido('certo'));
    expect(mural.conexoes).toBe(2);
    a.terminate();
    expect(mural.conexoes).toBe(1);
    mural.parar();
    expect(mural.conexoes).toBe(0);
    expect(mural.assistindo).toBe(0);
  });

  it('o veredito da chave decide o fechamento: negado 4003, bloqueado 4004, desligado 4005', () => {
    for (const [v, codigo] of [['negado', MURAL_FECHOU.token], ['bloqueado', MURAL_FECHOU.bloqueado], ['desligado', MURAL_FECHOU.desligado]] as const) {
      const { mural } = montar({ verificar: () => v });
      const s = ws();
      mural.receber(s, '1.1.1.1');
      s.manda(pedido('qualquer'));
      expect(s.fechou?.codigo, v).toBe(codigo);
    }
  });
});
