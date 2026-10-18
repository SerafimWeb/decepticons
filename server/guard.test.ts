import { describe, expect, it } from 'vitest';
import { clientCountry, clientIp, clientRegion, Guard, GUARD_DEFAULTS, ipParaLog, normalizeIp } from './guard';

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

  it('o padrão de fábrica aguenta uma travada de segundos do servidor: a folga é de 2 s a mais e o corte só vem de uma inundação', () => {
    expect(GUARD_DEFAULTS.msgs).toBe(60); // o cliente manda 30 por segundo: a taxa é o dobro da nominal
    expect(GUARD_DEFAULTS.burst).toBeGreaterThanOrEqual(120);
    expect(GUARD_DEFAULTS.dropCut).toBeGreaterThanOrEqual(300);
  });

  it('veredito: dentro do balde passa; vazio, descarta (a conexão segue); só o descarte que se acumula corta', () => {
    const g = new Guard({ ...GUARD_DEFAULTS, msgs: 60, burst: 30, dropCut: 100 });
    const p = g.peer('1.1.1.1', 0);
    for (let i = 0; i < 90; i++) expect(g.judge(p, 0)).toBe('ok');
    // O balde esvaziou: os próximos 100 são descartados sem cortar...
    for (let i = 0; i < 100; i++) expect(g.judge(p, 0), `descarte ${i + 1}`).toBe('drop');
    // ...e o 101º já é abuso.
    expect(g.judge(p, 0)).toBe('cut');
  });

  it('um pico passageiro não corta: depois de um tempo o contador de descartes cai e o balde enche, e a conexão volta ao normal', () => {
    const g = new Guard({ ...GUARD_DEFAULTS, msgs: 60, burst: 30, dropCut: 100 });
    const p = g.peer('1.1.1.1', 0);
    for (let i = 0; i < 190; i++) g.judge(p, 0); // 90 passam, 100 são descartados
    expect(p.drops).toBe(100);
    // 2 s depois (o servidor voltou a respirar): o balde enche (90) e o contador de descartes cai 120 (zera).
    expect(g.judge(p, 2000)).toBe('ok');
    for (let i = 0; i < 89; i++) expect(g.judge(p, 2000)).toBe('ok');
    expect(g.judge(p, 2000)).toBe('drop'); // o balde esvaziou de novo
    expect(p.drops).toBe(1); // e o contador recomeçou do zero, não dos 100 de antes
  });

  it('quem passa da taxa o tempo todo é cortado: acima do dobro do que a taxa repõe, o contador sobe até o corte; abaixo, nunca', () => {
    // 150 mensagens por segundo (60 repõem, 90 de excesso, o contador cai 60): sobe 30 por segundo líquido... mas de 0 desde o balde vazio.
    const g = new Guard({ ...GUARD_DEFAULTS, msgs: 60, burst: 30, dropCut: 600 });
    const p = g.peer('1.1.1.1', 0);
    let corte = -1;
    for (let ms = 0; ms < 120_000 && corte < 0; ms += 1000 / 150) if (g.judge(p, ms) === 'cut') corte = ms;
    expect(corte, 'a taxa 2,5 vezes maior que a de reposição acaba cortada').toBeGreaterThan(0);
    expect(corte).toBeLessThan(60_000);
    // 75 por segundo (15 de excesso, o contador cai 60): nunca acumula, a conexão fica para sempre
    const q = g.peer('2.2.2.2', 0);
    let cortou = false;
    for (let ms = 0; ms < 120_000; ms += 1000 / 75) if (g.judge(q, ms) === 'cut') cortou = true;
    expect(cortou).toBe(false);
    expect(q.drops).toBeLessThan(15);
  });

  it('uma inundação de verdade (mil mensagens de uma vez) é cortada na hora', () => {
    const g = new Guard({ ...GUARD_DEFAULTS });
    const p = g.peer('1.1.1.1', 0);
    let veredito = 'ok';
    let n = 0;
    while (veredito !== 'cut' && n < 5000) {
      veredito = g.judge(p, 0);
      n++;
    }
    expect(veredito).toBe('cut');
    expect(n).toBeLessThan(GUARD_DEFAULTS.msgs + GUARD_DEFAULTS.burst + GUARD_DEFAULTS.dropCut + 5);
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

describe('clientCountry: o país de quem chegou, só se o outro lado é o túnel local', () => {
  it('do túnel (loopback) o cabeçalho da Cloudflare vale, em maiúsculas, com XX e lixo virando ??', () => {
    expect(clientCountry('127.0.0.1', 'br')).toBe('BR');
    expect(clientCountry('::ffff:127.0.0.1', ['US', 'BR'])).toBe('US');
    expect(clientCountry('::1', 'T1')).toBe('T1'); // rede Tor
    expect(clientCountry('127.0.0.1', 'XX')).toBe('??'); // a Cloudflare não soube
    expect(clientCountry('127.0.0.1', undefined)).toBe('??');
    expect(clientCountry('127.0.0.1', 'BRASIL')).toBe('??');
    expect(clientCountry('127.0.0.1', '<script>')).toBe('??');
    expect(clientCountry('127.0.0.1', '')).toBe('??');
  });

  it('de qualquer outra máquina o cabeçalho é ignorado: ninguém inventa país para encher a tabela', () => {
    expect(clientCountry('203.0.113.9', 'BR')).toBe('??');
    expect(clientCountry('192.168.1.20', 'US')).toBe('??');
    expect(clientCountry(undefined, 'BR')).toBe('??');
  });
});

describe('o IP no log (P187, LGPD): nunca inteiro', () => {
  it('IPv4 perde o último trecho: a rede aparece, a casa não', () => {
    expect(ipParaLog('212.8.252.70')).toBe('212.8.252.x');
    expect(ipParaLog('185.177.124.221')).toBe('185.177.124.x');
    expect(ipParaLog('127.0.0.1')).toBe('127.0.0.x');
  });
  it('IPv6 fica só com os três primeiros grupos', () => {
    expect(ipParaLog('2804:14d:5c80:1234:abcd:1:2:3')).toBe('2804:14d:5c80:x');
    expect(ipParaLog('::1')).toBe('0:0:0:x');
    expect(ipParaLog('2001:db8::ff')).toBe('2001:db8:0:x');
  });
  it('o que não parece IP vira ?', () => {
    expect(ipParaLog('?')).toBe('?');
    expect(ipParaLog('')).toBe('?');
    expect(ipParaLog('nome')).toBe('?');
  });
  it('nenhum resultado carrega o endereço completo', () => {
    for (const ip of ['212.8.252.70', '2804:14d:5c80:1234:abcd:1:2:3', '10.0.0.1']) expect(ipParaLog(ip)).not.toContain(ip);
  });
});

describe('o estado do Brasil (P188): só do túnel, só as 27 siglas', () => {
  it('vindo do loopback (o túnel da Cloudflare): vale; de qualquer outra máquina o cabeçalho é ignorado', () => {
    expect(clientRegion('127.0.0.1', 'BR', 'SP')).toBe('SP');
    expect(clientRegion('::ffff:127.0.0.1', 'BR', 'rj')).toBe('RJ');
    expect(clientRegion('203.0.113.9', 'BR', 'SP')).toBeNull(); // ninguém inventa estado para encher a tabela
  });
  it('só para o Brasil e só uma sigla de verdade', () => {
    expect(clientRegion('127.0.0.1', 'US', 'SP')).toBeNull();
    expect(clientRegion('127.0.0.1', 'BR', 'Sao Paulo')).toBeNull();
    expect(clientRegion('127.0.0.1', 'BR', undefined)).toBeNull();
  });
});
