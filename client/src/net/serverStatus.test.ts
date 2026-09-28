import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, ROOM_SIZE } from '../../../shared/net/constants';
import { serverStatus } from '../../../shared/net/status';
import { probeStatus, statusClass, statusLine } from './serverStatus';

const answers = (body: unknown, ok = true): typeof fetch =>
  (async () =>
    ({
      ok,
      json: async () => {
        if (typeof body === 'string') throw new SyntaxError('não é JSON');
        return body;
      },
    }) as unknown as Response) as unknown as typeof fetch;

describe('sondagem do status do servidor', () => {
  it('lê o status quando o servidor responde', async () => {
    const p = await probeStatus('http://x/status', answers(serverStatus(2, 1, 30)));
    expect(p).toEqual({ up: true, status: { protocol: PROTOCOL_VERSION, players: 2, rooms: 1, roomSize: ROOM_SIZE, uptimeS: 30 } });
  });

  it('servidor desligado, erro de rede ou CSP: fora do ar, sem lançar', async () => {
    const boom = (async () => {
      throw new Error('failed to fetch');
    }) as unknown as typeof fetch;
    await expect(probeStatus('http://x/status', boom)).resolves.toEqual({ up: false });
    await expect(probeStatus('http://x/status', answers({}, false))).resolves.toEqual({ up: false });
  });

  it('servidor de pé que ainda não conhece /status é online sem contagem, não "fora do ar"', async () => {
    // O que o servidor de antes de 28/09 devolve em qualquer caminho: texto, não JSON.
    await expect(probeStatus('http://x/status', answers('CYBERMECH · servidor de jogo · 0 sala(s)'))).resolves.toEqual({ up: true, status: null });
  });

  it('resposta 200 com JSON fora do contrato também é online sem contagem', async () => {
    await expect(probeStatus('http://x/status', answers({ ola: 1 }))).resolves.toEqual({ up: true, status: null });
  });

  it('servidor que não responde no prazo não pendura a página', async () => {
    const never = ((_u: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('abort')));
      })) as unknown as typeof fetch;
    await expect(probeStatus('http://x/status', never, 10)).resolves.toEqual({ up: false });
  });
});

describe('a linha que o jogador lê', () => {
  const up = (players: number, rooms = 1) => ({ up: true as const, status: serverStatus(players, rooms, 0) });

  it('conta os pilotos com a concordância certa', () => {
    expect(statusLine(up(0))).toBe('SERVIDOR ONLINE · ARENA VAZIA · SEJA O PRIMEIRO');
    expect(statusLine(up(1))).toBe('SERVIDOR ONLINE · 1 PILOTO EM COMBATE');
    expect(statusLine(up(3))).toBe('SERVIDOR ONLINE · 3 PILOTOS EM COMBATE');
    expect(statusLine(up(5, 2))).toBe('SERVIDOR ONLINE · 5 PILOTOS EM COMBATE · 2 SALAS');
  });

  it('fora do ar diz que o offline continua valendo', () => {
    expect(statusLine({ up: false })).toBe('SERVIDOR FORA DO AR · MODO OFFLINE CONTRA BOTS');
    expect(statusClass({ up: false })).toBe('offline');
  });

  it('de pé sem contagem não mente sobre o servidor estar fora', () => {
    expect(statusLine({ up: true, status: null })).toBe('SERVIDOR ONLINE · SEM CONTAGEM DE PILOTOS');
    expect(statusClass({ up: true, status: null })).toBe('vazio');
  });

  it('servidor de outra versão não convida para entrar', () => {
    const outra = { up: true as const, status: { ...serverStatus(3, 1, 0), protocol: PROTOCOL_VERSION + 1 } };
    expect(statusLine(outra)).toBe('SERVIDOR EM ATUALIZAÇÃO · RECARREGUE A PÁGINA');
    expect(statusClass(outra)).toBe('versao');
  });

  it('a classe separa online com gente de online vazio', () => {
    expect(statusClass(up(2))).toBe('online');
    expect(statusClass(up(0))).toBe('vazio');
  });
});

describe('o prazo vale para a resposta, não para ler o corpo', () => {
  it('resposta que chegou no prazo é lida até o fim, mesmo com a thread engasgando depois', async () => {
    // O boot do jogo compila o Wasm e monta a arena: os temporizadores só correm depois. Se o prazo ainda
    // estivesse armado, ele abortaria o corpo de uma resposta que já tinha chegado (visto na captura de 28/09).
    const lenta: typeof fetch = (async () =>
      ({
        ok: true,
        json: async () => {
          await new Promise((r) => setTimeout(r, 40));
          return serverStatus(2, 1, 5);
        },
      }) as unknown as Response) as unknown as typeof fetch;
    const p = await probeStatus('http://x/status', lenta, 5);
    expect(p).toEqual({ up: true, status: serverStatus(2, 1, 5) });
  });
});
