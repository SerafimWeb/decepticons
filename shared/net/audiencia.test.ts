import { describe, expect, it } from 'vitest';
import {
  CANAIS,
  classificarOrigem,
  faixaDeRetorno,
  familiaDoNavegador,
  familiaDoSistema,
  hostDeEndereco,
  idiomaPrincipal,
  parseContextoDeEvento,
  parseUf,
  parseVisita,
  tipoDeAparelho,
  UFS,
} from './audiencia';

/** A audiência (P188): de onde vem a visita e que tipo de aparelho joga, em categorias, sem identificar ninguém. */
describe('classificarOrigem: link, busca, rede social, digitou o endereço, campanha', () => {
  const cls = (referrer: string, search = '', hostProprio = 'cybermech.online') => classificarOrigem({ referrer, hostProprio, search });

  it('sem referrer é direto (digitou o endereço, favorito, app)', () => {
    expect(cls('')).toEqual({ canal: 'direto' });
    expect(cls('texto que nao e endereco')).toEqual({ canal: 'direto' });
  });

  it('buscadores viram "busca", com o nome do site e nunca o caminho nem a consulta', () => {
    expect(cls('https://www.google.com/search?q=mech+jogo')).toEqual({ canal: 'busca', host: 'google.com' });
    expect(cls('https://www.bing.com/')).toEqual({ canal: 'busca', host: 'bing.com' });
    expect(cls('https://duckduckgo.com/')).toEqual({ canal: 'busca', host: 'duckduckgo.com' });
    expect(cls('https://www.google.com.br/')).toEqual({ canal: 'busca', host: 'google.com.br' });
  });

  it('redes sociais e mensageiros viram "social", inclusive o encurtador e o subdomínio do aplicativo', () => {
    for (const [ref, host] of [
      ['https://l.instagram.com/?u=abc', 'l.instagram.com'],
      ['https://t.co/xyz', 't.co'],
      ['https://youtu.be/abc', 'youtu.be'],
      ['https://m.facebook.com/', 'm.facebook.com'],
      ['https://discord.com/channels/1/2', 'discord.com'],
      ['https://www.reddit.com/r/games/', 'reddit.com'],
      ['https://wa.me/5511999999999', 'wa.me'],
    ] as const)
      expect(cls(ref), ref).toEqual({ canal: 'social', host });
  });

  it('qualquer outro endereço é "site" (só o nome do site); nome parecido com rede social não engana', () => {
    expect(cls('https://blog.exemplo.com/post/mechs?x=1#topo')).toEqual({ canal: 'site', host: 'blog.exemplo.com' });
    expect(cls('https://fakeinstagram.com/')).toEqual({ canal: 'site', host: 'fakeinstagram.com' });
    expect(cls('https://notgoogle.com/')).toEqual({ canal: 'site', host: 'notgoogle.com' });
  });

  it('o próprio site (landing → jogo) é "interno": a origem verdadeira é a da primeira página, guardada por quem chama', () => {
    expect(cls('https://cybermech.online/')).toEqual({ canal: 'interno' });
    expect(cls('https://www.cybermech.online/oficina/')).toEqual({ canal: 'interno' });
    expect(cls('https://jogo.cybermech.online/x')).toEqual({ canal: 'interno' });
  });

  it('a campanha marcada no link vale mais que o referrer, em minúsculas e só com o formato permitido', () => {
    expect(cls('https://l.instagram.com/', '?utm_source=Instagram&utm_medium=Story&utm_campaign=Lancamento_1')).toEqual({
      canal: 'campanha',
      host: 'l.instagram.com',
      us: 'instagram',
      um: 'story',
      uc: 'lancamento_1',
    });
    expect(cls('', '?utm_source=newsletter')).toEqual({ canal: 'campanha', us: 'newsletter' });
    expect(cls('', '?utm_campaign=<script>alert(1)</script>')).toEqual({ canal: 'direto' }); // formato fora do permitido: ignorado
    expect(cls('', '?utm_source=' + 'a'.repeat(33))).toEqual({ canal: 'direto' });
    expect(cls('https://cybermech.online/', '?utm_source=amigo')).toEqual({ canal: 'campanha', us: 'amigo' }); // o referrer próprio não vira host
  });

  it('todo canal devolvido está na lista fechada', () => {
    for (const ref of ['', 'https://google.com/', 'https://t.co/', 'https://x.test/', 'https://cybermech.online/'])
      expect(CANAIS).toContain(cls(ref).canal);
  });
});

describe('hostDeEndereco', () => {
  it('só o nome do site: sem www, sem porta, sem caminho, em minúsculas', () => {
    expect(hostDeEndereco('https://WWW.Exemplo.com:8080/a/b?c=d#e')).toBe('exemplo.com');
    expect(hostDeEndereco('http://localhost:5173/')).toBe('localhost');
  });
  it('o que não é endereço, ou tem nome longo demais, vira vazio', () => {
    expect(hostDeEndereco('')).toBe('');
    expect(hostDeEndereco('abc')).toBe('');
    expect(hostDeEndereco('https://' + 'a'.repeat(70) + '.com/')).toBe('');
  });
});

describe('navegador, sistema, aparelho e idioma', () => {
  const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const EDGE = `${CHROME_WIN} Edg/124.0.0.0`;
  const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0';
  const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  const SAFARI_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
  const SAMSUNG = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36';
  const OPERA = `${CHROME_WIN} OPR/110.0.0.0`;
  const CROS = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  it('a família do navegador pelo user agent (Edge e Opera antes do Chrome, que também aparece no texto deles)', () => {
    expect(familiaDoNavegador(CHROME_WIN)).toBe('chrome');
    expect(familiaDoNavegador(EDGE)).toBe('edge');
    expect(familiaDoNavegador(FIREFOX)).toBe('firefox');
    expect(familiaDoNavegador(SAFARI_MAC)).toBe('safari');
    expect(familiaDoNavegador(SAFARI_IOS)).toBe('safari');
    expect(familiaDoNavegador(CHROME_ANDROID)).toBe('chrome');
    expect(familiaDoNavegador(SAMSUNG)).toBe('samsung');
    expect(familiaDoNavegador(OPERA)).toBe('opera');
    expect(familiaDoNavegador('curl/8.0')).toBe('outro');
    expect(familiaDoNavegador('')).toBe('outro');
  });

  it('as marcas do navegador (userAgentData) mandam mais que o texto do user agent', () => {
    expect(familiaDoNavegador(CHROME_WIN, ['Chromium', 'Microsoft Edge', 'Not.A/Brand'])).toBe('edge');
    expect(familiaDoNavegador('', ['Google Chrome', 'Chromium'])).toBe('chrome');
    expect(familiaDoNavegador(FIREFOX, ['Not.A/Brand'])).toBe('firefox'); // marca sem família conhecida: cai no user agent
  });

  it('a família do sistema', () => {
    expect(familiaDoSistema(CHROME_WIN)).toBe('windows');
    expect(familiaDoSistema(SAFARI_MAC)).toBe('mac');
    expect(familiaDoSistema(FIREFOX)).toBe('linux');
    expect(familiaDoSistema(CHROME_ANDROID)).toBe('android');
    expect(familiaDoSistema(SAFARI_IOS)).toBe('ios');
    expect(familiaDoSistema(CROS)).toBe('chromeos');
    expect(familiaDoSistema('', 'Windows')).toBe('windows');
    expect(familiaDoSistema('', 'macOS')).toBe('mac');
    expect(familiaDoSistema('', '')).toBe('outro');
  });

  it('celular, tablet ou computador: o dedo e a largura da janela', () => {
    expect(tipoDeAparelho(false, 1920)).toBe('desktop');
    expect(tipoDeAparelho(false, 400)).toBe('desktop'); // janela estreita de mouse não é celular
    expect(tipoDeAparelho(true, 390)).toBe('mobile');
    expect(tipoDeAparelho(true, 767)).toBe('mobile');
    expect(tipoDeAparelho(true, 768)).toBe('tablet');
  });

  it('a língua principal, dentro das sete do jogo', () => {
    expect(idiomaPrincipal('pt-BR')).toBe('pt');
    expect(idiomaPrincipal('EN-us')).toBe('en');
    expect(idiomaPrincipal('zh-CN')).toBe('zh');
    expect(idiomaPrincipal('ja')).toBe('ja');
    expect(idiomaPrincipal('de-DE')).toBe('outro');
    expect(idiomaPrincipal('')).toBe('outro');
    expect(idiomaPrincipal('outro')).toBe('outro');
  });
});

describe('faixaDeRetorno: novo ou recorrente, por quantos dias', () => {
  const hoje = '2026-10-18';
  it('sem marca, no mesmo dia, ou com marca estragada ou do futuro: novo', () => {
    expect(faixaDeRetorno(null, hoje)).toBe('novo');
    expect(faixaDeRetorno('2026-10-18', hoje)).toBe('novo');
    expect(faixaDeRetorno('ontem', hoje)).toBe('novo');
    expect(faixaDeRetorno('2026-10-25', hoje)).toBe('novo');
  });
  it('as faixas por dias desde a primeira visita (os limites são 1, 7, 30)', () => {
    expect(faixaDeRetorno('2026-10-17', hoje)).toBe('d1');
    expect(faixaDeRetorno('2026-10-16', hoje)).toBe('d2-7');
    expect(faixaDeRetorno('2026-10-11', hoje)).toBe('d2-7');
    expect(faixaDeRetorno('2026-10-10', hoje)).toBe('d8-30');
    expect(faixaDeRetorno('2026-09-18', hoje)).toBe('d8-30');
    expect(faixaDeRetorno('2026-09-17', hoje)).toBe('d31+');
    expect(faixaDeRetorno('2024-01-01', hoje)).toBe('d31+');
  });
});

describe('o que o servidor aceita: categorias fechadas e nada de texto livre', () => {
  const visita = { canal: 'social', host: 'instagram.com', disp: 'mobile', nav: 'chrome', so: 'android', lang: 'pt', ret: 'novo' };

  it('aceita a visita completa e a campanha com as três marcas', () => {
    expect(parseVisita(visita)).toEqual(visita);
    expect(parseVisita({ ...visita, canal: 'campanha', us: 'insta', um: 'story', uc: 'lancamento-1' })).toMatchObject({ canal: 'campanha', us: 'insta', um: 'story', uc: 'lancamento-1' });
    const { host: _h, ...semHost } = visita;
    expect(parseVisita({ ...semHost, canal: 'direto' })).toEqual({ ...semHost, canal: 'direto' });
  });

  it('um valor fora da lista, um host torto ou uma marca fora do formato derruba a visita inteira', () => {
    for (const ruim of [
      { canal: 'inventado' }, { disp: 'geladeira' }, { nav: 'netscape' }, { so: 'beos' }, { lang: 'klingon' }, { ret: 'ontem' },
      { host: 'Tem Espaço' }, { host: 'a'.repeat(61) }, { host: 5 }, { us: '<script>' }, { um: 'x'.repeat(33) }, { uc: 7 },
    ])
      expect(parseVisita({ ...visita, ...ruim }), JSON.stringify(ruim)).toBeNull();
    expect(parseVisita(null)).toBeNull();
    expect(parseVisita('x')).toBeNull();
    expect(parseVisita({})).toBeNull();
  });

  it('o campo a mais é descartado, não repassado', () => {
    expect(parseVisita({ ...visita, ip: '1.2.3.4', email: 'a@b.com' })).toEqual(visita);
  });

  it('o contexto de cada evento segue o tipo dele: a visita para landing_view e boot_ok, o do funil para o resto', () => {
    expect(parseContextoDeEvento('landing_view', visita)).toEqual({ tipo: 'visita', visita });
    expect(parseContextoDeEvento('boot_ok', visita)).toEqual({ tipo: 'visita', visita });
    expect(parseContextoDeEvento('click_cockpit', { canal: 'busca' })).toEqual({ tipo: 'funil', funil: { canal: 'busca' } });
    expect(parseContextoDeEvento('partida_iniciada', { canal: 'direto', conta: 'logado' })).toEqual({ tipo: 'funil', funil: { canal: 'direto', conta: 'logado' } });
    expect(parseContextoDeEvento('partida_iniciada', { canal: 'direto', conta: 'visitante' })).toBeNull();
    expect(parseContextoDeEvento('landing_view', { canal: 'busca' })).toBeNull(); // contexto de funil num evento de visita
    expect(parseContextoDeEvento('click_cockpit', visita)).toMatchObject({ tipo: 'funil' }); // a visita carrega canal: lê só o canal
    expect(parseContextoDeEvento('hangar_aberto', { canal: 'busca' })).toBeNull(); // evento que não leva contexto
    expect(parseContextoDeEvento('boot_ok', undefined)).toBeUndefined(); // sem contexto vale (só não entra na audiência)
  });

  it('o estado: só do Brasil e só uma das 27 siglas; nunca cidade', () => {
    expect(UFS).toHaveLength(27);
    expect(parseUf('BR', 'SP')).toBe('SP');
    expect(parseUf('BR', ' rj ')).toBe('RJ');
    expect(parseUf('BR', ['MG', 'SP'])).toBe('MG');
    expect(parseUf('BR', 'XX')).toBeNull();
    expect(parseUf('BR', 'São Paulo')).toBeNull();
    expect(parseUf('US', 'SP')).toBeNull();
    expect(parseUf('BR', undefined)).toBeNull();
    expect(parseUf('??', 'SP')).toBeNull();
  });
});
