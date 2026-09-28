import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, ROOM_SIZE } from './constants';
import { parseStatus, serverStatus, STATUS_PATH, statusUrl } from './status';

describe('status público do servidor', () => {
  it('monta o status com a versão do protocolo e o tamanho da sala', () => {
    const s = serverStatus(3, 2, 61.7);
    expect(s).toEqual({ protocol: PROTOCOL_VERSION, players: 3, rooms: 2, roomSize: ROOM_SIZE, uptimeS: 61 });
  });

  it('não deixa passar número quebrado nem negativo', () => {
    expect(serverStatus(-2, 1.9, -5)).toEqual({ protocol: PROTOCOL_VERSION, players: 0, rooms: 1, roomSize: ROOM_SIZE, uptimeS: 0 });
  });

  it('lê de volta o que o servidor mandou', () => {
    const s = serverStatus(1, 1, 10);
    expect(parseStatus(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('recusa resposta fora do contrato (a página mostra "fora do ar", nunca um número inventado)', () => {
    expect(parseStatus(null)).toBeNull();
    expect(parseStatus('<!doctype html>')).toBeNull();
    expect(parseStatus({})).toBeNull();
    expect(parseStatus({ protocol: 1, players: 2, rooms: 1, roomSize: 8 })).toBeNull(); // sem uptimeS
    expect(parseStatus({ protocol: 1, players: '2', rooms: 1, roomSize: 8, uptimeS: 0 })).toBeNull();
    expect(parseStatus({ protocol: 1, players: -1, rooms: 1, roomSize: 8, uptimeS: 0 })).toBeNull();
    expect(parseStatus({ protocol: 1, players: Infinity, rooms: 1, roomSize: 8, uptimeS: 0 })).toBeNull();
  });

  it('tira o endereço do status do endereço do jogo', () => {
    expect(statusUrl('wss://jogo.selvamkt.com.br')).toBe(`https://jogo.selvamkt.com.br${STATUS_PATH}`);
    expect(statusUrl('ws://localhost:2567/?sala=ARENA')).toBe(`http://localhost:2567${STATUS_PATH}`);
    expect(statusUrl('https://algo.trycloudflare.com')).toBe(`https://algo.trycloudflare.com${STATUS_PATH}`);
    expect(statusUrl('  wss://jogo.selvamkt.com.br  ')).toBe(`https://jogo.selvamkt.com.br${STATUS_PATH}`);
  });

  it('sem servidor, ou com endereço estranho, não há status', () => {
    expect(statusUrl(undefined)).toBeNull();
    expect(statusUrl('')).toBeNull();
    expect(statusUrl('jogo.selvamkt.com.br')).toBeNull();
    expect(statusUrl('javascript:alert(1)')).toBeNull();
    expect(statusUrl('file:///c:/jogo')).toBeNull();
  });
});
