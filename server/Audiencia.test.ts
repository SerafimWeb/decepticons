import { describe, expect, it } from 'vitest';
import type { ContextoDeEvento, Visita } from '../shared/net/audiencia';
import { Audiencia, OUTROS } from './Audiencia';

/** O agregador da audiência (P193): soma por dia, só categorias, com teto de memória. */
describe('Audiencia: perfil por página, funil por canal e a conta da partida', () => {
  /** 18/10/2026, meio-dia em Brasília. */
  const T = Date.UTC(2026, 9, 18, 15, 0);
  const DIA = 86_400_000;
  const visita = (over: Partial<Visita> = {}): ContextoDeEvento => ({ tipo: 'visita', visita: { canal: 'social', host: 'instagram.com', disp: 'mobile', nav: 'chrome', so: 'android', lang: 'pt', ret: 'novo', ...over } });
  const funil = (canal: Visita['canal'], conta?: 'logado' | 'convidado'): ContextoDeEvento => ({ tipo: 'funil', funil: { canal, ...(conta ? { conta } : {}) } });

  it('a visita da landing e a do jogo contam em páginas separadas, e as duas entram no funil do canal', () => {
    const a = new Audiencia();
    a.registrar('landing_view', visita(), 'SP', T);
    a.registrar('landing_view', visita({ canal: 'busca', host: 'google.com', nav: 'firefox' }), null, T);
    a.registrar('boot_ok', visita({ disp: 'desktop' }), 'SP', T);
    const [d] = a.resumo().dias;
    expect(d!.dia).toBe('2026-10-18');
    expect(d!.perfil.landing!.canal).toEqual({ social: 1, busca: 1 });
    expect(d!.perfil.landing!.nav).toEqual({ chrome: 1, firefox: 1 });
    expect(d!.perfil.landing!.host).toEqual({ 'instagram.com': 1, 'google.com': 1 });
    expect(d!.perfil.landing!.uf).toEqual({ SP: 1 });
    expect(d!.perfil.jogo!.disp).toEqual({ desktop: 1 });
    expect(d!.perfil.jogo!.canal).toEqual({ social: 1 });
    expect(d!.funil.social).toEqual({ landing_view: 1, boot_ok: 1 });
    expect(d!.funil.busca).toEqual({ landing_view: 1 });
  });

  it('o funil por canal: clique, partida iniciada e terminada; a conta só conta na partida iniciada', () => {
    const a = new Audiencia();
    a.registrar('click_cockpit', funil('social'), null, T);
    a.registrar('partida_iniciada', funil('social', 'logado'), null, T);
    a.registrar('partida_iniciada', funil('social', 'convidado'), null, T);
    a.registrar('partida_iniciada', funil('direto', 'convidado'), null, T);
    a.registrar('partida_terminada', funil('social', 'logado'), null, T);
    const [d] = a.resumo().dias;
    expect(d!.funil.social).toEqual({ click_cockpit: 1, partida_iniciada: 2, partida_terminada: 1 });
    expect(d!.funil.direto).toEqual({ partida_iniciada: 1 });
    expect(d!.conta).toEqual({ logado: 1, convidado: 2 });
  });

  it('sem contexto, ou com o tipo errado para o evento, nada é contado e nada fica sujo', () => {
    const a = new Audiencia();
    a.registrar('boot_ok', undefined, null, T);
    a.registrar('click_cockpit', visita(), null, T); // a visita só vale em landing_view e boot_ok
    a.registrar('landing_view', funil('social'), null, T); // o contexto do funil não vale em evento de visita
    a.registrar('boot_ok', funil('social'), null, T);
    a.registrar('hangar_aberto', funil('social'), null, T); // evento que não é passo do funil
    expect(a.resumo().dias).toEqual([]);
    expect(a.sujo).toBe(false);
  });

  it('o reenvio do mesmo evento (a rede falhou no meio) não conta duas vezes', () => {
    const a = new Audiencia();
    a.registrar('landing_view', visita(), null, T, 'aba1:0');
    a.registrar('landing_view', visita(), null, T + 1000, 'aba1:0');
    a.registrar('landing_view', visita(), null, T + 2000, 'aba1:1'); // outro evento da mesma aba conta
    expect(a.resumo().dias[0]!.funil.social).toEqual({ landing_view: 2 });
    a.registrar('landing_view', visita(), null, T + 700_000, 'aba1:0'); // depois de 10 min o id já foi esquecido
    expect(a.resumo().dias[0]!.funil.social!.landing_view).toBe(3);
  });

  it('o teto de memória: sites de origem passam de 60 e o excedente soma em "(outros)"; um site chamado "constructor" conta como qualquer outro', () => {
    const a = new Audiencia();
    for (let i = 0; i < 70; i++) a.registrar('landing_view', visita({ host: `site${i}.com` }), null, T);
    a.registrar('landing_view', visita({ host: 'constructor' }), null, T);
    a.registrar('landing_view', visita({ host: 'constructor' }), null, T);
    const hosts = a.resumo().dias[0]!.perfil.landing!.host!;
    expect(Object.keys(hosts)).toHaveLength(61); // 60 sites + "(outros)"
    expect(hosts[OUTROS]).toBe(12); // 10 sites e os dois "constructor" que já não couberam
    expect(Object.values(hosts).reduce((x, y) => x + y, 0)).toBe(72); // nada se perdeu
    const b = new Audiencia();
    b.registrar('landing_view', visita({ host: 'constructor' }), null, T);
    b.registrar('landing_view', visita({ host: 'constructor' }), null, T);
    expect(b.resumo().dias[0]!.perfil.landing!.host).toEqual({ constructor: 2 }); // o objeto não confunde com o protótipo
  });

  it('120 dias no máximo: o mais velho sai; a virada do dia é a de Brasília', () => {
    const a = new Audiencia();
    for (let i = 0; i < 125; i++) a.registrar('landing_view', visita(), null, T + i * DIA);
    const dias = a.resumo().dias;
    expect(dias).toHaveLength(120);
    expect(dias[0]!.dia).toBe('2026-10-23');
    const b = new Audiencia();
    b.registrar('landing_view', visita(), null, Date.parse('2026-10-18T02:59:59Z'));
    b.registrar('landing_view', visita(), null, Date.parse('2026-10-18T03:00:00Z'));
    expect(b.resumo().dias.map((d) => d.dia)).toEqual(['2026-10-17', '2026-10-18']);
  });

  it('o resumo entrega cópias: mexer nele não mexe no agregador', () => {
    const a = new Audiencia();
    a.registrar('landing_view', visita(), null, T);
    a.resumo().dias[0]!.funil.social!.landing_view = 999;
    expect(a.resumo().dias[0]!.funil.social!.landing_view).toBe(1);
  });

  it('salva e recarrega tudo igual; exportar limpa o "sujo"; arquivo estragado ou torto não derruba nem inventa categoria', () => {
    const a = new Audiencia();
    a.registrar('landing_view', visita(), 'RJ', T);
    a.registrar('partida_iniciada', funil('social', 'logado'), null, T);
    expect(a.sujo).toBe(true);
    const salvo = JSON.parse(JSON.stringify(a.exportar()));
    expect(a.sujo).toBe(false);
    const b = new Audiencia();
    b.carregar(salvo);
    expect(b.resumo()).toEqual(a.resumo());
    const d = salvo.dias[0];
    const torto = new Audiencia();
    torto.carregar({
      dias: [
        { ...d, dia: 'ontem' },
        { ...d, perfil: { cozinha: d.perfil.landing } }, // página que não existe
        { ...d, perfil: { landing: { cor: { azul: 1 } } } }, // dimensão que não existe
        { ...d, perfil: { landing: { canal: { social: -1 } } } }, // contagem negativa
        { ...d, perfil: { landing: { canal: { 'tem espaço': 1 } } } }, // valor fora do formato
        { ...d, funil: { social: { passo_inventado: 1 } } },
        { ...d, conta: { visitante: 1 } },
        null,
        'x',
        { ...d, dia: '2026-10-01' }, // este é bom
      ],
    });
    expect(torto.resumo().dias.map((x) => x.dia)).toEqual(['2026-10-01']);
    for (const raw of [null, undefined, 5, 'x', {}, { dias: 'x' }]) expect(() => new Audiencia().carregar(raw)).not.toThrow();
  });
});
