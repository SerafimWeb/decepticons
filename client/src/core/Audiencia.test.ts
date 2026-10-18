import { describe, expect, it } from 'vitest';
import { parseVisita } from '../../../shared/net/audiencia';
import { Audiencia, CHAVE_ORIGEM, CHAVE_VISITOU, hojeLocal, type Ambiente } from './Audiencia';

/** A visita descrita por categorias no navegador (P193): origem, aparelho, idioma, novo ou recorrente. */
describe('Audiencia (navegador)', () => {
  const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const amb = (over: Partial<Ambiente> = {}): Ambiente => ({
    referrer: '',
    hostProprio: 'cybermech.online',
    search: '',
    userAgent: CHROME_WIN,
    marcas: [],
    plataforma: '',
    dedo: false,
    largura: 1920,
    lingua: 'pt-BR',
    ...over,
  });
  class Mem {
    readonly d = new Map<string, string>();
    getItem(k: string): string | null {
      return this.d.get(k) ?? null;
    }
    setItem(k: string, v: string): void {
      this.d.set(k, v);
    }
  }
  const montar = (a: Ambiente, local = new Mem(), sessao = new Mem(), hoje = '2026-10-18') => ({ aud: new Audiencia(a, { local, sessao }, () => hoje), local, sessao });

  it('a primeira visita: novo, com a origem, o aparelho, o navegador, o sistema e o idioma; e o servidor aceita o que sai daqui', () => {
    const { aud } = montar(amb({ referrer: 'https://l.instagram.com/?u=x', dedo: true, largura: 390, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36' }));
    const v = aud.visita();
    expect(v).toEqual({ canal: 'social', host: 'l.instagram.com', disp: 'mobile', nav: 'chrome', so: 'android', lang: 'pt', ret: 'novo' });
    expect(parseVisita(v)).toEqual(v); // o contrato do servidor aceita exatamente isto
  });

  it('a marca de primeira visita: grava o dia na primeira vez, e nas seguintes diz há quantos dias (sem nunca mandar a data)', () => {
    const local = new Mem();
    montar(amb(), local).aud.visita();
    expect(local.getItem(CHAVE_VISITOU)).toBe('2026-10-18');
    expect(montar(amb(), local, new Mem(), '2026-10-18').aud.visita().ret).toBe('novo'); // o mesmo dia
    expect(montar(amb(), local, new Mem(), '2026-10-19').aud.visita().ret).toBe('d1');
    expect(montar(amb(), local, new Mem(), '2026-10-25').aud.visita().ret).toBe('d2-7');
    expect(montar(amb(), local, new Mem(), '2026-12-01').aud.visita().ret).toBe('d31+');
    expect(local.getItem(CHAVE_VISITOU)).toBe('2026-10-18'); // a primeira visita não é regravada
    expect(JSON.stringify(montar(amb(), local, new Mem(), '2026-10-19').aud.visita())).not.toContain('2026-10-18');
  });

  it('uma marca estragada vale como nova e é regravada', () => {
    const local = new Mem();
    local.setItem(CHAVE_VISITOU, 'lixo');
    expect(montar(amb(), local).aud.visita().ret).toBe('novo');
    expect(local.getItem(CHAVE_VISITOU)).toBe('2026-10-18');
  });

  it('da landing para o jogo: o jogo herda a origem da primeira página (e não vira "interno")', () => {
    const sessao = new Mem();
    const landing = montar(amb({ referrer: 'https://www.google.com/search?q=mech' }), new Mem(), sessao);
    expect(landing.aud.canal()).toBe('busca');
    expect(JSON.parse(sessao.getItem(CHAVE_ORIGEM)!)).toEqual({ canal: 'busca', host: 'google.com' });
    const jogo = montar(amb({ referrer: 'https://cybermech.online/' }), new Mem(), sessao);
    expect(jogo.aud.canal()).toBe('busca');
    expect(jogo.aud.visita()).toMatchObject({ canal: 'busca', host: 'google.com' });
    expect(jogo.aud.funil('logado')).toEqual({ canal: 'busca', conta: 'logado' });
  });

  it('o referrer do próprio site sem origem guardada (aba nova) é direto', () => {
    expect(montar(amb({ referrer: 'https://cybermech.online/' })).aud.canal()).toBe('direto');
  });

  it('uma origem guardada estragada ou "interno" não vale: cai em direto', () => {
    for (const lixo of ['isto nao e json', '{"canal":"inventado"}', '{"canal":"interno"}', '5', 'null']) {
      const sessao = new Mem();
      sessao.setItem(CHAVE_ORIGEM, lixo);
      expect(montar(amb({ referrer: 'https://cybermech.online/' }), new Mem(), sessao).aud.canal(), lixo).toBe('direto');
    }
  });

  it('uma origem de fora numa aba que já tinha outra substitui a antiga (outro link, outra visita)', () => {
    const sessao = new Mem();
    montar(amb({ referrer: 'https://www.google.com/' }), new Mem(), sessao).aud.canal();
    montar(amb({ referrer: 'https://t.co/abc' }), new Mem(), sessao).aud.canal();
    expect(JSON.parse(sessao.getItem(CHAVE_ORIGEM)!)).toEqual({ canal: 'social', host: 't.co' });
  });

  it('a campanha marcada no link vai com as três marcas', () => {
    const v = montar(amb({ search: '?utm_source=Amigo&utm_medium=zap&utm_campaign=Lancamento' })).aud.visita();
    expect(v).toMatchObject({ canal: 'campanha', us: 'amigo', um: 'zap', uc: 'lancamento' });
    expect(parseVisita(v)).toEqual(v);
  });

  it('o contexto do funil leva só o canal, e a conta quando se sabe', () => {
    const { aud } = montar(amb({ referrer: 'https://x.test/p' }));
    expect(aud.funil()).toEqual({ canal: 'site' });
    expect(aud.funil('convidado')).toEqual({ canal: 'site', conta: 'convidado' });
  });

  it('sem armazenamento (aba anônima, cota cheia, navegador que lança) a visita vale, sem a memória entre páginas', () => {
    const quebrado = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const aud = new Audiencia(amb({ referrer: 'https://l.instagram.com/' }), { local: quebrado, sessao: quebrado }, () => '2026-10-18');
    expect(() => aud.visita()).not.toThrow();
    expect(aud.visita()).toMatchObject({ canal: 'social', ret: 'novo' });
    const sem = new Audiencia(amb(), { local: null, sessao: null }, () => '2026-10-18');
    expect(sem.visita().canal).toBe('direto');
  });

  it('hojeLocal escreve o dia do aparelho como AAAA-MM-DD', () => {
    expect(hojeLocal(new Date(2026, 9, 8, 23, 59))).toBe('2026-10-08');
    expect(hojeLocal(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});
