import { describe, expect, it } from 'vitest';
import { clientIp, Guard, GUARD_DEFAULTS, normalizeIp } from './guard';

describe('a porteira do servidor de jogo', () => {
  it('teto por IP: aceita até `perIp` conexões do mesmo endereço, recusa a seguinte, e libera quando alguém sai', () => {
    const g = new Guard({ ...GUARD_DEFAULTS, perIp: 2, total: 10 });
    expect(g.admit('1.2.3.4')).toBe('ok');
    expect(g.admit('1.2.3.4')).toBe('ok');
    expect(g.admit('1.2.3.4')).toBe('ip');
    g.remove('1.2.3.4');
    expect(g.admit('1.2.3.4')).toBe('ok');
    // Outro IP não bate no teto.
    expect(g.admit('5.6.7.8')).toBe('ok');
  });

  it('teto geral: cheio de verdade, todo IP é recusado por `total`', () => {
    const g = new Guard({ ...GUARD_DEFAULTS, perIp: 10, total: 2 });
    expect(g.admit('a')).toBe('ok');
    expect(g.admit('b')).toBe('ok');
    expect(g.admit('c')).toBe('total');
    g.remove('a');
    expect(g.admit('c')).toBe('ok');
  });

  it('balde de fichas: aceita a folga na entrada, corta o excesso e recarrega ao longo do tempo', () => {
    const g = new Guard({ ...GUARD_DEFAULTS, msgs: 60, burst: 30 });
    const p = g.peer('1.1.1.1', 0);
    // Nominal + folga = 90 mensagens permitidas de largada.
    for (let i = 0; i < 90; i++) expect(g.allow(p, 0)).toBe(true);
    expect(g.allow(p, 0)).toBe(false);
    // Passou 1 s: 60 fichas voltam.
    expect(g.allow(p, 1000)).toBe(true);
    for (let i = 0; i < 59; i++) expect(g.allow(p, 1000)).toBe(true);
    expect(g.allow(p, 1000)).toBe(false);
  });

  it('IP do cliente: cabeçalho da Cloudflare vale só quando o outro lado é o próprio PC (túnel local)', () => {
    // Túnel: o socket vem do localhost; o IP real é o do cabeçalho.
    expect(clientIp('127.0.0.1', '203.0.113.5')).toBe('203.0.113.5');
    expect(clientIp('::1', '203.0.113.5')).toBe('203.0.113.5');
    // Direto: não confia em cabeçalho vindo de fora.
    expect(clientIp('203.0.113.9', '10.0.0.1')).toBe('203.0.113.9');
    // Sem nada: identifica como '?'.
    expect(clientIp(undefined, undefined)).toBe('?');
  });

  it('normaliza IPv6 mapeado para v4', () => {
    expect(normalizeIp('::ffff:1.2.3.4')).toBe('1.2.3.4');
    expect(normalizeIp('2a02::1')).toBe('2a02::1');
    expect(normalizeIp('')).toBe('?');
  });
});
