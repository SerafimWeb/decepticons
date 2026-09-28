import { describe, expect, it } from 'vitest';
import { NetHud } from './NetHud';
import type { RosterEntry } from '../../../shared/net/messages';

describe('NetHud (indicador de rede no HUD)', () => {
  it('nasce oculto por padrão', () => {
    const net = new NetHud();
    expect(net.online).toBe(false);
  });

  it('exibe a sala e o ping quando ativado', () => {
    const net = new NetHud();
    net.setOnline(true, 'ARENA');
    net.setPing(42);
    expect(net.online).toBe(true);
    expect(net.room).toBe('ARENA');
    expect(net.pingMs).toBe(42);
  });

  it('mostra status de erro quando a conexão oscila', () => {
    const net = new NetHud();
    net.setOnline(true, 'ARENA');
    net.setStatus('SALA CHEIA', true);
    expect(net.statusText).toBe('SALA CHEIA');
    expect(net.isError).toBe(true);
  });

  it('atualiza quantidade de participantes com a mensagem ROSTER', () => {
    const net = new NetHud();
    net.setOnline(true, 'ARENA');
    const roster: RosterEntry[] = [
      { id: 0, kind: 'human', name: 'Dan', build: 'v1.m' },
      { id: 1, kind: 'mech', name: 'CLAWD', build: 'v1.m' },
    ];
    net.setRoster(roster);
    expect(net.playerCount).toBe(2);
  });
});
