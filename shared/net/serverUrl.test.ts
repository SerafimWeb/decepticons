import { describe, expect, it } from 'vitest';
import { serverHttpUrl, serverWsUrl } from './serverUrl';

describe('o endereço do servidor de jogo', () => {
  it('serverWsUrl: ws e wss ficam, http e https viram ws e wss, e o caminho e a busca são os pedidos', () => {
    expect(serverWsUrl('wss://jogo.selvamkt.com.br', '/', 'mural=1')).toBe('wss://jogo.selvamkt.com.br/?mural=1');
    expect(serverWsUrl('ws://localhost:2567', '/', 'mural=1')).toBe('ws://localhost:2567/?mural=1');
    expect(serverWsUrl('https://jogo.selvamkt.com.br/algo?x=1#y', '/', 'mural=1')).toBe('wss://jogo.selvamkt.com.br/?mural=1');
    expect(serverWsUrl('http://127.0.0.1:2999', '/')).toBe('ws://127.0.0.1:2999/');
  });

  it('serverWsUrl: sem endereço, torto ou de outro esquema, devolve null', () => {
    for (const ruim of [undefined, null, '', '   ', 'jogo.selvamkt.com.br', 'ftp://x', 'javascript:alert(1)', 'file:///c:/x']) expect(serverWsUrl(ruim, '/', 'mural=1'), String(ruim)).toBeNull();
  });

  it('é o contrário do serverHttpUrl: ir e voltar dá o mesmo servidor', () => {
    const ws = 'wss://jogo.selvamkt.com.br';
    const http = serverHttpUrl(ws, '/')!;
    expect(serverWsUrl(http, '/')).toBe(`${ws}/`);
  });
});
