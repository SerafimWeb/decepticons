import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';
import { apontarJogoPara, gerarWav, guardarSessao, tokenDeConta } from './vozLib.mjs';

/**
 * A IDADE E O CHAT DE VOZ no jogo de verdade (P211, ordem do Comandante em 19/10: "menores de 18 anos NÃO TEM ACESSO ao microfone nem aos áudios dos outros jogadores"): Chrome com microfone FALSO,
 * o jogo online de uma sala com um colega adulto (uma página da bancada, falando um tom) e cinco jogadores:
 *  1. conta de ADULTO (sessão restaurada): os controles da voz aparecem, o microfone abre e liga ao colega;
 *  2. CONVIDADO: sem controles, a frase "crie uma conta", nenhum pedido de microfone, ninguém ligado;
 *  3. conta de MENOR: sem controles, a frase "menores de 18 anos", nenhum pedido de microfone, ninguém ligado, e o aviso na aba da conta;
 *  4. conta SEM IDADE informa o mês e o ano na aba JOGO: a voz abre na hora, sem recarregar;
 *  5. CADASTRO pela tela (mês e ano obrigatórios): como adulto a voz abre; como menor, não;
 *  6. cliente ADULTERADO (não confere a idade e manda o token de um menor, ou nenhum): quem decide é o SERVIDOR, e ele o deixa de fora (não ouve o adulto, nem é ouvido).
 *
 *   node .decepticons/medicoes/voz-idade.mjs     # sai com 1 se algo falhar; fotos em arte/idade-*-claude.png; grava medicoes/voz-idade-<data>.json
 *
 * G15: temporários em `.tmp/`.
 */
const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');
const tom = gerarWav('tom.wav', 0.5, 6);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const PORTA = 2595;
const ANO = new Date().getFullYear();

const verificacoes = [];
const conferir = (nome, ok, detalhe = '') => {
  verificacoes.push({ nome, ok: !!ok, detalhe });
  console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
};
async function ate(fn, ms = 90000, passo = 300) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await dormir(passo);
  }
}

const { startServer } = (await runnerImport(resolve('server/Server.ts'), { configFile: false, logLevel: 'warn' })).module;
const jogo = await startServer({ port: PORTA, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 300, total: 600, msgs: 200, burst: 200 }, limiteLogin: { teto: 1000 }, log: () => {} });
apontarJogoPara(PORTA);
const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5193, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const PAGINA = resolve('.decepticons', 'medicoes', 'voz-bancada.html').split(String.fromCharCode(92)).join('/');
const FLAGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${tom}`, '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'];
async function lancar() {
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launch({ channel, args: FLAGS });
    } catch {
      // próximo
    }
  }
  throw new Error('nenhum navegador');
}
/** Conta quantas vezes o jogo pediu o microfone ao navegador (uma bancada que fica sem pedir é a prova do "sem acesso ao microfone"). */
const CONTA_PEDIDOS = () => {
  window.__pedidos = 0;
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => {
    window.__pedidos++;
    return original(c);
  };
};
const erros = new Set();
const SALA = 'IDADE';

/** Abre o jogo como um jogador: com a sessão guardada (ou sem, convidado), entra na partida e devolve a página. */
async function entrar(browser, rotulo, token) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => erros.add(`${rotulo}: ${e.message}`));
  await page.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await page.addInitScript(CONTA_PEDIDOS);
  if (token) await guardarSessao(page, PORTA, token);
  await page.goto(`${base}?sala=${SALA}&nome=${rotulo}&servidor=ws://127.0.0.1:${PORTA}&comandante=1`);
  await page.waitForFunction(() => document.getElementById('cta')?.textContent?.includes('jogar'), null, { timeout: 240_000, polling: 500 }).catch(() => {});
  for (let i = 0; i < 4; i++) {
    await page.click('#cta').catch(() => {});
    await page.waitForTimeout(500);
  }
  return page;
}
/** Abre as Configurações na aba pedida (pelo DOM: o clique de verdade pode cair sob o painel). */
async function abrirConfiguracoes(page, aba) {
  await page.evaluate(() => document.getElementById('btn-settings')?.click());
  await page.waitForTimeout(400);
  await page.evaluate((a) => document.querySelector(`.settings-tab[data-tab="${a}"]`)?.click(), aba);
  await page.waitForTimeout(400);
}
const fecharConfiguracoes = (page) => page.evaluate(() => document.getElementById('btn-settings-close')?.click());
const estadoDaTela = (page) =>
  page.evaluate(() => ({
    controles: !document.getElementById('voz-controles').hidden,
    frase: document.getElementById('voz-elegibilidade').hidden ? '' : document.getElementById('voz-elegibilidade').textContent,
    pedidos: window.__pedidos ?? 0,
    indicador: document.querySelector('.voz-estado')?.textContent ?? '',
  }));
const ligadosDoColega = (colega) => colega.evaluate(() => window.__voz.estado().ligados);
const pedidos = (page) => page.evaluate(() => window.__pedidos ?? 0);

let browser;
try {
  browser = await lancar();
  const tokenAdulto = await tokenDeConta(PORTA, 'adulto', '1990-01');
  const tokenMenor = await tokenDeConta(PORTA, 'menor', `${ANO - 10}-03`);
  const tokenSemIdade = await tokenDeConta(PORTA, 'semidade', null);

  // O colega adulto: uma página da bancada na mesma sala, falando um tom.
  const colega = await browser.newPage();
  colega.on('pageerror', (e) => erros.add(`colega: ${e.message}`));
  await colega.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  const abrirBancada = async (pagina, nome, token) => {
    const q = new URLSearchParams({ servidor: `ws://127.0.0.1:${PORTA}`, sala: SALA, nome, dsp: '0', ...(token === undefined ? {} : { token }) });
    await pagina.goto(`${base}@fs/${PAGINA}?${q}`);
    await pagina.waitForFunction(() => !!window.__voz, null, { timeout: 90_000 });
  };
  await abrirBancada(colega, 'BRAVO', await tokenDeConta(PORTA, 'bravo'));
  conferir('o colega adulto entrou na voz sozinho e ninguém mais está ligado a ele', (await ligadosDoColega(colega)) === 0);

  // ---------------------------------------------------------------- 1. conta de adulto
  const adulto = await entrar(browser, 'ADULTO', tokenAdulto);
  const ligou = await ate(async () => (await ligadosDoColega(colega)) >= 1, 120_000);
  conferir('1. conta de ADULTO: a voz abre e liga ao colega', !!ligou);
  await abrirConfiguracoes(adulto, 'graficos');
  const tAdulto = await estadoDaTela(adulto);
  conferir('1. os controles da voz aparecem e nenhuma frase de bloqueio', tAdulto.controles && tAdulto.frase === '', JSON.stringify(tAdulto));
  conferir('1. o jogo pediu o microfone ao navegador', tAdulto.pedidos >= 1, `${tAdulto.pedidos} pedido(s)`);
  await fecharConfiguracoes(adulto);
  await adulto.close();
  await ate(async () => (await ligadosDoColega(colega)) === 0, 60_000);

  // ---------------------------------------------------------------- 2. convidado
  const convidado = await entrar(browser, 'CONVIDADO', null);
  await dormir(8000);
  await abrirConfiguracoes(convidado, 'graficos');
  const tConv = await estadoDaTela(convidado);
  conferir('2. CONVIDADO: sem controles de voz, com a frase de "crie uma conta"', !tConv.controles && tConv.frase.includes('Crie uma conta'), JSON.stringify(tConv));
  conferir('2. CONVIDADO: o jogo NUNCA pediu o microfone e não há indicador de voz', tConv.pedidos === 0 && tConv.indicador === '', JSON.stringify({ pedidos: tConv.pedidos, indicador: tConv.indicador }));
  conferir('2. CONVIDADO: ninguém se ligou a ele (o colega segue sem ligações)', (await ligadosDoColega(colega)) === 0);
  await fecharConfiguracoes(convidado);
  await convidado.close();

  // ---------------------------------------------------------------- 3. conta de menor
  const menor = await entrar(browser, 'MENOR', tokenMenor);
  await dormir(8000);
  await abrirConfiguracoes(menor, 'graficos');
  const tMenor = await estadoDaTela(menor);
  conferir('3. conta de MENOR: sem controles de voz e com a frase dos menores de 18 anos', !tMenor.controles && tMenor.frase.includes('menores de 18 anos') && tMenor.frase.includes('áudio do jogo segue normal'), JSON.stringify(tMenor));
  conferir('3. MENOR: o jogo NUNCA pediu o microfone e não há indicador de voz', tMenor.pedidos === 0 && tMenor.indicador === '', JSON.stringify({ pedidos: tMenor.pedidos, indicador: tMenor.indicador }));
  conferir('3. MENOR: ninguém se ligou a ele', (await ligadosDoColega(colega)) === 0);
  await page_foto(menor, 'idade-menor-sem-voz-claude.png');
  await fecharConfiguracoes(menor);
  await abrirConfiguracoes(menor, 'jogo');
  const contaMenor = await menor.evaluate(() => document.getElementById('settings-conta')?.textContent ?? '');
  conferir('3. MENOR: a aba da conta explica que não há chat de voz', contaMenor.includes('Conta de menor de 18 anos') && contaMenor.includes('O áudio do jogo segue normal'), contaMenor.replace(/\s+/g, ' ').slice(0, 160));
  await fecharConfiguracoes(menor);
  await menor.close();

  // ---------------------------------------------------------------- 4. conta sem idade informa na aba JOGO
  const semIdade = await entrar(browser, 'SEMIDADE', tokenSemIdade);
  await dormir(8000);
  await abrirConfiguracoes(semIdade, 'graficos');
  const antes = await estadoDaTela(semIdade);
  conferir('4. conta SEM IDADE: sem controles e a frase pede o mês e o ano de nascimento', !antes.controles && antes.frase.includes('mês e o ano de nascimento') && antes.pedidos === 0, JSON.stringify(antes));
  await fecharConfiguracoes(semIdade);
  await abrirConfiguracoes(semIdade, 'jogo');
  const formulario = await ate(() => semIdade.evaluate(() => !!document.getElementById('btn-login-nascimento')), 60_000);
  conferir('4. a aba JOGO mostra o pedido do mês e do ano com o botão GUARDAR A IDADE desligado', !!formulario && (await semIdade.evaluate(() => document.getElementById('btn-login-nascimento').disabled)));
  await semIdade.selectOption('#login-nasc-mes', '6');
  await semIdade.selectOption('#login-nasc-ano', '1985');
  conferir('4. escolhidos o mês e o ano o botão liga', !(await semIdade.evaluate(() => document.getElementById('btn-login-nascimento').disabled)));
  await semIdade.evaluate(() => document.getElementById('btn-login-nascimento').click());
  const abriu = await ate(async () => (await ligadosDoColega(colega)) >= 1, 120_000);
  conferir('4. guardada a idade a voz abre NA HORA, sem recarregar, e liga ao colega', !!abriu);
  await fecharConfiguracoes(semIdade);
  await abrirConfiguracoes(semIdade, 'graficos');
  const depois = await estadoDaTela(semIdade);
  conferir('4. os controles da voz apareceram e o microfone foi pedido', depois.controles && depois.frase === '' && depois.pedidos >= 1, JSON.stringify(depois));
  // a data não muda: o servidor recusa a segunda vez (pela API, o mesmo caminho do botão)
  const segunda = await semIdade.evaluate(async (porta) => {
    const chave = `cybermech.conta.token|http://127.0.0.1:${porta}`;
    const r = await fetch(`http://127.0.0.1:${porta}/conta/nascimento`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-cybermech-sessao': localStorage.getItem(chave) ?? '' }, body: JSON.stringify({ nascimento: '2015-01' }) });
    return r.status;
  }, PORTA);
  conferir('4. a idade só se informa uma vez: o servidor recusa trocar (409)', segunda === 409, `status ${segunda}`);
  await fecharConfiguracoes(semIdade);
  await semIdade.close();
  await ate(async () => (await ligadosDoColega(colega)) === 0, 60_000);

  // ---------------------------------------------------------------- 5. cadastro pela tela
  async function cadastrar(rotulo, email, mes, ano) {
    const page = await entrar(browser, rotulo, null);
    await dormir(4000);
    await abrirConfiguracoes(page, 'jogo');
    await page.waitForFunction(() => !!document.querySelector('#settings-conta .login-panel'), null, { timeout: 60_000 });
    await page.evaluate(() => document.getElementById('tab-login-criar')?.click());
    await page.waitForSelector('#login-nasc-mes', { state: 'attached' });
    await page.fill('#login-input-email', email);
    await page.fill('#login-input-senha', 'senhasegura');
    await page.evaluate(() => {
      for (const id of ['login-check-politica', 'login-check-idade']) {
        const c = document.getElementById(id);
        c.checked = true;
        c.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    const desligadoSemData = await page.evaluate(() => document.getElementById('btn-login-submit').disabled);
    await page.selectOption('#login-nasc-mes', String(mes));
    const aindaSemAno = await page.evaluate(() => document.getElementById('btn-login-submit').disabled);
    await page.selectOption('#login-nasc-ano', String(ano));
    const ligadoComData = !(await page.evaluate(() => document.getElementById('btn-login-submit').disabled));
    return { page, desligadoSemData, aindaSemAno, ligadoComData };
  }
  const adultoNovo = await cadastrar('NOVOADULTO', 'novo-adulto@bancada.com', 2, 1992);
  conferir('5. CADASTRO: sem o mês e o ano o botão CRIAR CONTA fica desligado (mesmo com e-mail, senha e as duas caixas)', adultoNovo.desligadoSemData && adultoNovo.aindaSemAno);
  conferir('5. CADASTRO: escolhidos o mês e o ano o botão liga', adultoNovo.ligadoComData);
  // a foto mostra o par de listas do nascimento e as caixas: rola o painel até ele
  await adultoNovo.page.evaluate(() => document.getElementById('login-nasc-ano')?.scrollIntoView({ block: 'center' }));
  await adultoNovo.page.waitForTimeout(400);
  await adultoNovo.page.screenshot({ path: resolve('.decepticons', 'arte', 'idade-cadastro-claude.png') });
  await adultoNovo.page.evaluate(() => document.getElementById('btn-login-submit').click());
  const logou = await ate(() => adultoNovo.page.evaluate(() => (document.getElementById('settings-conta')?.textContent ?? '').includes('novo-adulto@bancada.com')), 60_000);
  conferir('5. CADASTRO como adulto: a conta é criada e a sessão abre', !!logou);
  const abriuNovo = await ate(async () => (await ligadosDoColega(colega)) >= 1, 120_000);
  conferir('5. CADASTRO como adulto: a voz abre e liga ao colega', !!abriuNovo);
  await adultoNovo.page.close();
  await ate(async () => (await ligadosDoColega(colega)) === 0, 60_000);

  const menorNovo = await cadastrar('NOVOMENOR', 'novo-menor@bancada.com', 5, ANO - 12);
  conferir('5. CADASTRO de um menor: o formulário aceita (a pessoa pode jogar, só não tem voz)', menorNovo.ligadoComData);
  await menorNovo.page.evaluate(() => document.getElementById('btn-login-submit').click());
  const logouMenor = await ate(() => menorNovo.page.evaluate(() => (document.getElementById('settings-conta')?.textContent ?? '').includes('Conta de menor de 18 anos')), 60_000);
  conferir('5. CADASTRO como menor: a conta nasce e a tela diz que não há voz', !!logouMenor);
  await dormir(6000);
  conferir('5. CADASTRO como menor: o jogo não pediu o microfone e ninguém se ligou', (await pedidos(menorNovo.page)) === 0 && (await ligadosDoColega(colega)) === 0);
  await menorNovo.page.close();

  // ---------------------------------------------------------------- 6. cliente adulterado: quem decide é o servidor
  const hackMenor = await browser.newPage();
  hackMenor.on('pageerror', (e) => erros.add(`hack: ${e.message}`));
  await hackMenor.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await abrirBancada(hackMenor, 'HACKMENOR', tokenMenor);
  const hackSemToken = await browser.newPage();
  hackSemToken.on('pageerror', (e) => erros.add(`hack2: ${e.message}`));
  await hackSemToken.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await abrirBancada(hackSemToken, 'HACKSEM', undefined);
  const segundoAdulto = await browser.newPage();
  segundoAdulto.on('pageerror', (e) => erros.add(`adulto2: ${e.message}`));
  await segundoAdulto.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await abrirBancada(segundoAdulto, 'CHARLIE', await tokenDeConta(PORTA, 'charlie'));
  const seLigaram = await ate(async () => (await ligadosDoColega(colega)) >= 1, 120_000);
  conferir('6. dois adultos na bancada se ligam entre si', !!seLigaram);
  await dormir(8000);
  const estados = {};
  for (const [nome, p] of [['hackMenor', hackMenor], ['hackSemToken', hackSemToken]]) estados[nome] = await p.evaluate(() => window.__voz.estado());
  conferir('6. cliente que manda o token de um MENOR: o cliente acha que entrou (ativa), mas o servidor o deixa de fora (sem ligações, não ouve ninguém)', estados.hackMenor.ativa && estados.hackMenor.ligados === 0 && estados.hackMenor.ouvindo === 0, JSON.stringify(estados.hackMenor));
  conferir('6. cliente SEM token: idem', estados.hackSemToken.ativa && estados.hackSemToken.ligados === 0 && estados.hackSemToken.ouvindo === 0, JSON.stringify(estados.hackSemToken));
  conferir('6. os adultos continuam ligados entre si e não têm ligação com os de fora', (await ligadosDoColega(colega)) === 1, `colega: ${await ligadosDoColega(colega)} ligação(ões)`);
  conferir('6. os adultos não ouvem os de fora (um só colega ligado a cada adulto)', (await segundoAdulto.evaluate(() => window.__voz.estado().ligados)) === 1);

  conferir('nenhum erro de página', erros.size === 0, [...erros].slice(0, 3).join(' | '));
} finally {
  await browser?.close().catch(() => {});
  await vite.close();
  await jogo.close();
}

async function page_foto(page, nome) {
  await page.screenshot({ path: resolve('.decepticons', 'arte', nome) });
}

const data = new Date().toLocaleDateString('sv');
writeFileSync(resolve('.decepticons', 'medicoes', `voz-idade-${data}.json`), `${JSON.stringify({ data, verificacoes }, null, 2)}\n`);
const falhas = verificacoes.filter((v) => !v.ok);
console.log(`\n${verificacoes.length - falhas.length}/${verificacoes.length} verificações`);
process.exit(falhas.length ? 1 : 0);
