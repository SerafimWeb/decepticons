import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';
import { apontarJogoPara, gerarWav, guardarSessao, tokenDeConta } from './vozLib.mjs';

/**
 * A IDADE E O CHAT DE VOZ no jogo de verdade (P211, e a fase de testes da P241). P211, 19/10: "menores de 18 anos NÃO TEM ACESSO ao microfone nem aos áudios dos outros jogadores". P241, 21/10: "essa regra de 18 anos tá
 * muito restritiva… vamos apenas não dar acesso ao microfone… LIBERA VOZ PRA CONVIDADO E CONTA SEM IDADE" (`VOZ_SO_PARA_ADULTO_DECLARADO = false` em `shared/net/auth.ts`). Chrome com microfone FALSO, o jogo online de uma sala com
 * um colega adulto (uma página da bancada, falando um tom) e cinco jogadores:
 *  1. conta de ADULTO (sessão restaurada): os controles da voz aparecem, o microfone abre e liga ao colega;
 *  2. CONVIDADO: a voz abre sozinha, sem conta; o microfone é pedido; liga ao colega;
 *  3. conta de MENOR: entra na voz SÓ PARA OUVIR (o colega se liga a ela), nenhum pedido de microfone, o indicador diz "SÓ OUVINDO", e a aba da conta explica;
 *  4. conta SEM IDADE: a voz abre sozinha como a do convidado; informar o mês e o ano na aba JOGO segue possível e não derruba a voz;
 *  5. CADASTRO pela tela (mês e ano obrigatórios): como adulto a voz abre; como menor, só ouve;
 *  6. cliente ADULTERADO (token de menor, nenhum, ou torto): o servidor trata cada um pelo que ele é (todos entram) e o limite conhecido fica dito (o áudio vai entre os navegadores).
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
    aviso: document.querySelector('#hud .voz-aviso:not([hidden])')?.textContent ?? '', // o aviso do canto da tela (a frase das Configurações também tem a classe voz-aviso)
    rede: document.querySelector('.voz-rede')?.textContent ?? '',
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
  const ligou = await ate(async () => (await ligadosDoColega(colega)) >= 1, 300_000);
  conferir('1. conta de ADULTO: a voz abre e liga ao colega', !!ligou);
  await abrirConfiguracoes(adulto, 'graficos');
  await ate(() => adulto.evaluate(() => !document.getElementById('voz-controles').hidden), 60_000); // o pedaço da seção da voz chega em segundo plano
  const tAdulto = await estadoDaTela(adulto);
  conferir('1. os controles da voz aparecem e nenhuma frase de bloqueio', tAdulto.controles && tAdulto.frase === '', JSON.stringify(tAdulto));
  conferir('1. ADULTO: sem o botão de conta (a voz já está liberada)', await adulto.evaluate(() => document.getElementById('btn-voz-conta').hidden));
  conferir('1. o jogo pediu o microfone ao navegador', tAdulto.pedidos >= 1, `${tAdulto.pedidos} pedido(s)`);
  conferir('1. ADULTO na voz: nenhum aviso de "sem voz" na tela (a voz está ligada)', tAdulto.aviso === '', tAdulto.aviso);
  // P237: o botão DIAGNÓSTICO DA VOZ mostra o relatório e conclui. Com o colega ligado e falando, a conclusão é "Tudo certo".
  const relatorio = await ate(async () => {
    await adulto.evaluate(() => document.getElementById('btn-voz-diag').click());
    await dormir(1500);
    const txt = await adulto.evaluate(() => document.getElementById('voz-diag').textContent ?? '');
    return txt.includes('CONCLUSÃO: Tudo certo') ? txt : null;
  }, 60_000, 500);
  conferir('1. ADULTO: o diagnóstico da voz mostra a ligação com BRAVO, a rota e conclui "Tudo certo"', !!relatorio && relatorio.includes('BRAVO: conectada') && /rota (host|srflx)/.test(relatorio), (relatorio ?? await adulto.evaluate(() => document.getElementById('voz-diag').textContent)).replace(/\n/g, ' | ').slice(0, 500));
  console.log(String(relatorio ?? '').split('\n').map((l) => '    ' + l).join('\n'));
  await fecharConfiguracoes(adulto);
  await adulto.close();
  await ate(async () => (await ligadosDoColega(colega)) === 0, 60_000);

  // ---------------------------------------------------------------- 2. convidado (fase de testes, P241: fala e ouve)
  const convidado = await entrar(browser, 'CONVIDADO', null);
  const ligouConv = await ate(async () => (await ligadosDoColega(colega)) >= 1, 300_000);
  conferir('2. CONVIDADO (fase de testes): a voz abre sozinha, sem conta, e liga ao colega', !!ligouConv);
  await abrirConfiguracoes(convidado, 'graficos');
  await ate(() => convidado.evaluate(() => !document.getElementById('voz-controles').hidden), 60_000);
  const tConv = await estadoDaTela(convidado);
  conferir('2. CONVIDADO: os controles da voz aparecem, sem frase de bloqueio e sem aviso de "sem voz"', tConv.controles && tConv.frase === '' && tConv.aviso === '', JSON.stringify(tConv));
  conferir('2. CONVIDADO: o jogo pediu o microfone ao navegador (ele pode falar)', tConv.pedidos >= 1, `${tConv.pedidos} pedido(s)`);
  conferir('2. CONVIDADO: sem botão de conta (a voz já está liberada)', await convidado.evaluate(() => document.getElementById('btn-voz-conta').hidden));
  await fecharConfiguracoes(convidado);
  await convidado.close();
  await ate(async () => (await ligadosDoColega(colega)) === 0, 60_000);

  // ---------------------------------------------------------------- 3. conta de menor (só ouve: sem microfone)
  const menor = await entrar(browser, 'MENOR', tokenMenor);
  const ligouMenor = await ate(async () => (await ligadosDoColega(colega)) >= 1, 300_000);
  conferir('3. conta de MENOR: entra na voz e o colega se liga a ela (ela ouve)', !!ligouMenor);
  await dormir(4000);
  await abrirConfiguracoes(menor, 'graficos');
  const tMenor = await estadoDaTela(menor);
  conferir('3. MENOR: sem controles de microfone, e a frase diz que só ouve, sem microfone, e que o áudio do jogo segue normal', !tMenor.controles && tMenor.frase.includes('só ouvem o chat de voz') && tMenor.frase.includes('sem microfone') && tMenor.frase.includes('áudio do jogo segue normal'), JSON.stringify(tMenor));
  conferir('3. MENOR: o jogo NUNCA pediu o microfone ao navegador', tMenor.pedidos === 0, `${tMenor.pedidos} pedido(s)`);
  conferir('3. MENOR: o indicador diz "SÓ OUVINDO" e não há aviso de "sem voz" (a voz está ligada)', tMenor.indicador.includes('SÓ OUVINDO') && tMenor.aviso === '', JSON.stringify({ indicador: tMenor.indicador, aviso: tMenor.aviso }));
  conferir('3. MENOR: sem botão (não há o que fazer)', await menor.evaluate(() => document.getElementById('btn-voz-conta').hidden));
  await page_foto(menor, 'idade-menor-so-ouve-claude.png');
  await fecharConfiguracoes(menor);
  await abrirConfiguracoes(menor, 'jogo');
  const contaMenor = await menor.evaluate(() => document.getElementById('settings-conta')?.textContent ?? '');
  conferir('3. MENOR: a aba da conta explica que o chat de voz só ouve', contaMenor.includes('Conta de menor de 18 anos') && contaMenor.includes('só ouve') && contaMenor.includes('O áudio do jogo segue normal'), contaMenor.replace(/\s+/g, ' ').slice(0, 160));
  await fecharConfiguracoes(menor);
  await menor.close();
  await ate(async () => (await ligadosDoColega(colega)) === 0, 60_000);

  // ---------------------------------------------------------------- 4. conta sem idade (fase de testes: fala e ouve; informar a idade segue possível)
  const semIdade = await entrar(browser, 'SEMIDADE', tokenSemIdade);
  const ligouSem = await ate(async () => (await ligadosDoColega(colega)) >= 1, 300_000);
  conferir('4. conta SEM IDADE (fase de testes): a voz abre sozinha e liga ao colega', !!ligouSem);
  await abrirConfiguracoes(semIdade, 'graficos');
  await ate(() => semIdade.evaluate(() => !document.getElementById('voz-controles').hidden), 60_000);
  const antes = await estadoDaTela(semIdade);
  conferir('4. conta SEM IDADE: os controles da voz aparecem, o microfone foi pedido e não há aviso de "sem voz"', antes.controles && antes.frase === '' && antes.pedidos >= 1 && antes.aviso === '', JSON.stringify(antes));
  await fecharConfiguracoes(semIdade);
  await abrirConfiguracoes(semIdade, 'jogo');
  const formulario = await ate(() => semIdade.evaluate(() => !!document.getElementById('btn-login-nascimento')), 60_000);
  conferir('4. a aba JOGO ainda pede o mês e o ano (é o que separa o menor, que só ouve), com o botão GUARDAR A IDADE desligado', !!formulario && (await semIdade.evaluate(() => document.getElementById('btn-login-nascimento').disabled)));
  conferir('4. o texto da aba diz que quem tem menos de 18 anos só ouve o chat de voz', (await semIdade.evaluate(() => document.getElementById('settings-conta')?.textContent ?? '')).includes('só ouve o chat de voz'));
  await semIdade.selectOption('#login-nasc-mes', '6');
  await semIdade.selectOption('#login-nasc-ano', '1985');
  conferir('4. escolhidos o mês e o ano o botão liga', !(await semIdade.evaluate(() => document.getElementById('btn-login-nascimento').disabled)));
  await semIdade.evaluate(() => document.getElementById('btn-login-nascimento').click());
  await dormir(5000);
  conferir('4. informada a idade (adulto) a voz continua ligada ao colega', (await ligadosDoColega(colega)) >= 1);
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
    const ligadoComData = !!(await ate(() => page.evaluate(() => !document.getElementById('btn-login-submit').disabled), 15_000, 200));
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
  conferir('5. CADASTRO de um menor: o formulário aceita (a pessoa pode jogar, só não tem microfone)', menorNovo.ligadoComData);
  const pedidosAntes = await pedidos(menorNovo.page); // quem entrou como convidado já pediu o microfone uma vez (a idade ainda não era conhecida)
  await menorNovo.page.evaluate(() => document.getElementById('btn-login-submit').click());
  const logouMenor = await ate(() => menorNovo.page.evaluate(() => (document.getElementById('settings-conta')?.textContent ?? '').includes('Conta de menor de 18 anos')), 60_000);
  conferir('5. CADASTRO como menor: a conta nasce e a tela diz que a conta de menor de 18 anos só ouve', !!logouMenor);
  const ouviu = await ate(async () => (await ligadosDoColega(colega)) >= 1, 120_000);
  const soOuve = await ate(() => menorNovo.page.evaluate(() => (document.querySelector('.voz-estado')?.textContent ?? '').includes('SÓ OUVINDO')), 60_000);
  conferir('5. CADASTRO como menor: o microfone que o convidado abrira é LARGADO (SÓ OUVINDO), não pede outro, e a voz segue ligada ao colega', !!soOuve && (await pedidos(menorNovo.page)) === pedidosAntes && !!ouviu, `pedidos ${pedidosAntes} -> ${await pedidos(menorNovo.page)}`);
  await menorNovo.page.close();

  // ---------------------------------------------------------------- 6. cliente adulterado: o servidor trata cada token pelo que ele é
  const abrirHack = async (rotulo, nome, token) => {
    const p = await browser.newPage();
    p.on('pageerror', (e) => erros.add(`${rotulo}: ${e.message}`));
    await p.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
    await abrirBancada(p, nome, token);
    return p;
  };
  const hackMenor = await abrirHack('hack', 'HACKMENOR', tokenMenor);
  const hackSemToken = await abrirHack('hack2', 'HACKSEM', undefined);
  const hackLixo = await abrirHack('hack3', 'HACKLIXO', 'lixo-lixo-lixo-lixo');
  const segundoAdulto = await abrirHack('adulto2', 'CHARLIE', await tokenDeConta(PORTA, 'charlie'));
  const seLigaram = await ate(async () => (await ligadosDoColega(colega)) >= 4, 180_000);
  conferir('6. na fase de testes todos entram: o colega se liga a CHARLIE, ao token de menor, ao sem token e ao token torto', !!seLigaram, `colega: ${await ligadosDoColega(colega)} ligação(ões)`);
  await dormir(6000);
  const estados = {};
  for (const [nome, p] of [['hackMenor', hackMenor], ['hackSemToken', hackSemToken], ['hackLixo', hackLixo], ['adulto2', segundoAdulto]]) estados[nome] = await p.evaluate(() => window.__voz.estado());
  conferir('6. cada um deles está ligado aos outros quatro (a voz é de todos)', Object.values(estados).every((e) => e.ativa && e.ligados === 4), JSON.stringify(estados));
  console.log('    limite conhecido: o áudio vai direto entre os navegadores, então um cliente de menor ADULTERADO (esta bancada) consegue falar; só o cliente de verdade nega o microfone ao menor. VOZ_SO_PARA_ADULTO_DECLARADO volta a regra da P211.');

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
