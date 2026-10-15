import { describe, expect, it } from 'vitest';
import { corsDoPedido, ORIGENS_DO_JOGO, origemPermitida, origensExtras } from './origem';

describe('origemPermitida', () => {
  it('deixa passar o jogo no ar, com e sem www', () => {
    for (const o of ORIGENS_DO_JOGO) expect(origemPermitida(o)).toBe(true);
    expect(origemPermitida('https://CyberMech.online')).toBe(true);
  });

  it('deixa passar a máquina local e a rede de casa, em qualquer porta', () => {
    for (const o of [
      'http://localhost:5173',
      'http://127.0.0.1:2567',
      'http://[::1]:5173',
      'http://192.168.0.12:5173',
      'http://10.0.0.5:4173',
      'http://172.16.3.4:5173',
      'http://172.31.255.255',
    ]) {
      expect(origemPermitida(o), o).toBe(true);
    }
  });

  it('barra qualquer outro site', () => {
    for (const o of [
      'https://exemplo.com',
      'https://cybermech.online.exemplo.com',
      'https://evilcybermech.online',
      'http://cybermech.online.evil.com',
      'http://localhost.evil.com',
      'http://192.168.0.12.evil.com',
      'http://172.32.0.1:5173',
      'http://8.8.8.8',
      'https://www.selvamkt.com.br',
      'null',
    ]) {
      expect(origemPermitida(o), o).toBe(false);
    }
  });

  it('pedido sem origem não é de navegador e passa (o teto por IP cuida dele)', () => {
    expect(origemPermitida(undefined)).toBe(true);
    expect(origemPermitida('')).toBe(true);
  });

  it('aceita o que o dono lista em CYBERMECH_ORIGENS', () => {
    const extras = origensExtras(' https://Beta.cybermech.online/ , ,https://outro.exemplo');
    expect(extras).toEqual(['https://beta.cybermech.online', 'https://outro.exemplo']);
    expect(origemPermitida('https://beta.cybermech.online', extras)).toBe(true);
    expect(origemPermitida('https://beta.cybermech.online')).toBe(false);
    expect(origensExtras(undefined)).toEqual([]);
  });
});

describe('corsDoPedido', () => {
  it('devolve a origem do pedido, nunca o asterisco', () => {
    const h = corsDoPedido('https://cybermech.online');
    expect(h['access-control-allow-origin']).toBe('https://cybermech.online');
    expect(h.vary).toBe('origin');
  });

  it('origem recusada ou ausente: sem cabeçalho de permissão', () => {
    expect(corsDoPedido('https://exemplo.com')['access-control-allow-origin']).toBeUndefined();
    expect(corsDoPedido(undefined)['access-control-allow-origin']).toBeUndefined();
  });
});
