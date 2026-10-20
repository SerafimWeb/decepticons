import { describe, expect, it } from 'vitest';
import { decidirComandante, lerModoComandante, linkPermitido } from './DecisaoDoComandante';
import { definirModoComandante, modoComandante } from './ModoComandante';

const base = { search: '', lembrado: null, linkPermitido: true, admin: false };

describe('o modo Comandante (P224): o link só em desenvolvimento; em produção, a conta de administrador', () => {
  it('o link vale no desenvolvimento e no próprio PC; no site publicado só com o interruptor ligado (o lançamento o desliga)', () => {
    expect(linkPermitido('cybermech.online', true, undefined)).toBe(true); // npm run dev
    expect(linkPermitido('localhost', false, undefined)).toBe(true);
    expect(linkPermitido('127.0.0.1', false, undefined)).toBe(true);
    expect(linkPermitido('cybermech.online', false, undefined)).toBe(false); // produção, sem interruptor: fechado por padrão
    expect(linkPermitido('cybermech.online', false, '0')).toBe(false);
    expect(linkPermitido('cybermech.online', false, '1')).toBe(true); // o `publicar-site` liga enquanto se desenvolve
  });

  it('onde o link vale: liga com ?comandante=1, lembra, e desliga com =0 (como sempre foi)', () => {
    expect(decidirComandante({ ...base, search: '?comandante=1' })).toEqual({ ligado: true, gravar: '1' });
    expect(decidirComandante({ ...base, search: '?admin=1' }).ligado).toBe(true);
    expect(decidirComandante({ ...base, lembrado: '1' })).toEqual({ ligado: true, gravar: null });
    expect(decidirComandante({ ...base, lembrado: '1', search: '?comandante=0' })).toEqual({ ligado: false, gravar: 'apagar' });
    expect(decidirComandante(base)).toEqual({ ligado: false, gravar: null });
  });

  it('onde o link NÃO vale (produção fechada): ?comandante=1 e a lembrança do navegador são ignorados, e a lembrança é apagada; quem digita o link não ganha nada', () => {
    const fechado = { ...base, linkPermitido: false };
    expect(decidirComandante({ ...fechado, search: '?comandante=1' })).toEqual({ ligado: false, gravar: null });
    expect(decidirComandante({ ...fechado, search: '?admin=1', lembrado: '1' })).toEqual({ ligado: false, gravar: 'apagar' });
    expect(decidirComandante({ ...fechado, lembrado: '1' }).ligado).toBe(false);
  });

  it('a conta de administrador liga o modo Comandante sem link, em qualquer lugar (e vale mesmo com o link fechado)', () => {
    expect(decidirComandante({ ...base, linkPermitido: false, admin: true })).toEqual({ ligado: true, gravar: null });
    expect(decidirComandante({ ...base, admin: true, search: '?comandante=0' }).ligado).toBe(true); // o =0 não derruba quem é administrador
  });

  it('o valor decidido no início é o que o jogo e o console leem', () => {
    expect(modoComandante()).toBe(false);
    definirModoComandante(true);
    expect(modoComandante()).toBe(true);
    definirModoComandante(false);
  });
});

describe('ler o link (o que sempre valeu: ?comandante=1, ?admin=1, =0 e a lembrança do navegador)', () => {
  it('liga com ?comandante=1 (ou ?admin=1) e manda o navegador lembrar; desliga com =0 e manda esquecer', () => {
    expect(lerModoComandante('?comandante=1', null)).toEqual({ ligado: true, gravar: '1' });
    expect(lerModoComandante('?admin=1', null)).toEqual({ ligado: true, gravar: '1' });
    expect(lerModoComandante('?comandante=0', '1')).toEqual({ ligado: false, gravar: 'apagar' });
  });

  it('sem o parâmetro, vale o que o navegador lembra (e um valor estranho não liga)', () => {
    expect(lerModoComandante('', '1')).toEqual({ ligado: true, gravar: null });
    expect(lerModoComandante('?build=x', null)).toEqual({ ligado: false, gravar: null });
    expect(lerModoComandante('?comandante=talvez', null)).toEqual({ ligado: false, gravar: null });
  });
});
