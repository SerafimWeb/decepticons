import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { padraoDe } from '../core/funcionalidades';
import { Conversas, LINHAS_POR_CONVERSA } from './Conversas';

describe('as conversas de texto (P216)', () => {
  it('a mensagem que chega com a conversa fechada fica guardada e não lida; abrir (marcar lida) zera; a que chega com ela aberta não conta', () => {
    const c = new Conversas();
    let avisos = 0;
    c.ouvir(() => avisos++);
    expect(c.receber(3, 'oi')).toBe(true);
    expect(c.receber(3, 'tá aí?')).toBe(true);
    expect(c.naoLidas(3)).toBe(2);
    expect(c.linhas(3)).toEqual([{ meu: false, texto: 'oi' }, { meu: false, texto: 'tá aí?' }]);
    c.marcarLida(3);
    expect(c.naoLidas(3)).toBe(0);
    c.receber(3, 'vi', true);
    expect(c.naoLidas(3)).toBe(0);
    c.enviada(3, 'cheguei');
    expect(c.linhas(3).at(-1)).toEqual({ meu: true, texto: 'cheguei' });
    expect(avisos).toBeGreaterThanOrEqual(5);
  });

  it('silenciar é só deste cliente: o que ele manda não chega nem conta; desfazer volta a receber; as outras conversas não mudam', () => {
    const c = new Conversas();
    c.silenciar(4, true);
    expect(c.receber(4, 'spam')).toBe(false);
    expect(c.linhas(4)).toEqual([]);
    expect(c.receber(5, 'oi')).toBe(true);
    c.silenciar(4, false);
    expect(c.receber(4, 'desculpa')).toBe(true);
    expect(c.naoLidas(4)).toBe(1);
  });

  it('cada conversa guarda no máximo as últimas linhas; sair da sala apaga tudo (os ids deixam de valer)', () => {
    const c = new Conversas();
    for (let i = 0; i < LINHAS_POR_CONVERSA + 10; i++) c.receber(1, 'm' + i);
    expect(c.linhas(1)).toHaveLength(LINHAS_POR_CONVERSA);
    expect(c.linhas(1)[0]!.texto).toBe('m10');
    c.silenciar(1, true);
    c.limpar();
    expect(c.linhas(1)).toEqual([]);
    expect(c.naoLidas(1)).toBe(0);
    expect(c.estaSilenciado(1)).toBe(false);
  });
});

describe('a lista de pilotos no monitor REDE (P216): o contrato do HTML e da visibilidade', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

  it('o monitor REDE tem a lista (o lugar da RedePilotos), amarrada ao catálogo de visibilidade e escondida até haver gente; o chat nasce restrito (em teste, só o Comandante vê)', () => {
    const rede = html.slice(html.indexOf('id="mon-rede"'), html.indexOf('id="mon-config"'));
    expect(rede).toMatch(/<ul[^>]*id="rede-pilotos"[^>]*data-func="tela:chat"[^>]*hidden/);
    expect(padraoDe('tela:chat')).toBe('restrito');
  });
});
