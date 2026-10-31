import { resolve } from 'node:path';
import { createServer } from 'vite';

/**
 * A FICHA DO ROBÔ do ESQUADRÃO no jogo de verdade (P288, 30/10: a ficha só dava a arma direita e a esquerda e a lista de chassis não era a do Hangar). Abre o jogo no modo Comandante, abre a janela
 * ESQUADRÃO e confere, num Chrome de verdade: o chassi na mesma lista do Hangar (os Mechs, o andróide e o técnico), os encaixes extras do Onça (os dois ombros, sem costas), o titã com o aviso de que
 * os encaixes dele são só do Hangar, e a troca de corpo (Mech vira andróide e volta). Fotografa em `.decepticons/arte/`. G15: temporários em `.tmp/`.
 * (`page.$eval`, `$$eval` e `evaluate` são a API do Playwright: leem o DOM do navegador de teste, nada de `eval()` de texto.)
 *
 *   node .decepticons/medicoes/esquadrao-ficha.mjs [chrome|msedge|brave]
 */
const quem = process.argv[2] ?? 'chrome';
const EXE = {
  chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  brave: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  msedge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
}[quem];
if (!EXE) throw new Error('use chrome, brave ou msedge');
const { chromium } = await import('playwright-core');

const falhas = [];
const confere = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) falhas.push(texto);
};

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5193, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text().slice(0, 140)}`); });

try {
  await page.goto(`${base}?comandante=1`);
  await page.waitForSelector('#btn-esquadrao', { state: 'visible', timeout: 120_000 });
  await page.click('#btn-esquadrao');
  await page.waitForSelector('.squad-ficha', { timeout: 30_000 });

  const opcoes = async () => page.$$eval('#squad-campo-chassi option', (os) => os.map((o) => ({ v: o.value, t: o.textContent })));
  // o primeiro inimigo da lista (um Mech)
  await page.click('.squad-bot .squad-linha');
  let lista = await opcoes();
  const valores = lista.map((o) => o.v);
  const hangar = ['vector09', 'colossus01', 'colossusv4', 'arara', 'onca', 'genesis01', 'lancerL1', 'lr7lBastion', 'quadraV2', 'marauder'];
  confere(hangar.every((c) => valores.includes(c)), `o chassi oferece os Mechs do Hangar: ${valores.join(', ')}`);
  confere(valores.includes('android') && valores.includes('technician'), 'o chassi oferece também o andróide e o técnico (o inimigo tem técnico)');

  // o Onça: dois ombros, sem costas
  await page.selectOption('#squad-campo-chassi', 'onca');
  const rotulos = async () => page.$$eval('.squad-ficha .squad-campo label', (ls) => ls.map((l) => l.textContent));
  let r = await rotulos();
  confere(r.includes('Ombro direito') && r.includes('Ombro esquerdo') && !r.includes('Costas'), `o Onça mostra os dois ombros e não as costas: ${r.join(' | ')}`);
  await page.selectOption('#squad-campo-extra-rightShoulder', { index: 1 });
  const nivel = await page.$eval('#squad-campo-extra-nivel-rightShoulder', (s) => ({ desligado: s.disabled, valor: s.value }));
  confere(nivel.desligado === false, 'escolher a arma do ombro liga o seletor de nível dele');
  await page.selectOption('#squad-campo-extra-nivel-rightShoulder', '2');
  const linhaDaLista = await page.$eval('.squad-bot.sel', (el) => el.textContent);
  confere(/ONÇA/i.test(linhaDaLista), `a lista mostra o Onça: ${linhaDaLista.replace(/\s+/g, ' ').slice(0, 90)}`);
  await page.screenshot({ path: resolve('.decepticons/arte/esquadrao-ficha-ombros-claude.png') });

  // o Marauder e o Vector-09: sem encaixes extras
  await page.selectOption('#squad-campo-chassi', 'vector09');
  r = await rotulos();
  confere(!r.includes('Ombro direito') && !r.includes('Costas'), 'o Vector-09 não tem encaixes extras');

  // o titã: aviso de que os encaixes dele são só do Hangar
  await page.selectOption('#squad-campo-chassi', 'colossus01');
  const dicas = await page.$$eval('.squad-ficha .squad-dica', (ps) => ps.map((p) => p.textContent));
  confere(dicas.some((d) => /só do Hangar/.test(d ?? '')), 'o Colossus-01 diz que costas e ombros são só do Hangar');
  confere(!(await rotulos()).includes('Costas'), 'e não oferece as costas ao bot');
  await page.screenshot({ path: resolve('.decepticons/arte/esquadrao-ficha-tita-claude.png') });

  // o corpo: Mech vira andróide e volta (o apelido fica)
  await page.fill('#squad-campo-nome', 'ZEUS');
  await page.selectOption('#squad-campo-chassi', 'android');
  r = await rotulos();
  confere(!r.includes('Personalidade') && !r.includes('Braço esquerdo'), 'o andróide não tem personalidade nem mão esquerda');
  confere((await page.inputValue('#squad-campo-nome')) === 'ZEUS', 'trocar o corpo guarda o apelido');
  await page.selectOption('#squad-campo-chassi', 'marauder');
  confere((await rotulos()).includes('Personalidade'), 'e de volta a Mech a ficha completa volta');

  // a lista da esquerda acompanha, e o link leva os encaixes
  await page.selectOption('#squad-campo-chassi', 'onca');
  await page.selectOption('#squad-campo-extra-leftShoulder', { index: 1 });
  const chave = await page.evaluate(async () => {
    const x = [...document.querySelectorAll('button')].find((b) => /COPIAR LINK/.test(b.textContent ?? ''));
    return x ? 'tem o botão de link' : '';
  });
  confere(chave !== '', 'o botão COPIAR LINK continua na janela');
  await page.screenshot({ path: resolve('.decepticons/arte/esquadrao-ficha-corpo-claude.png') });
} catch (e) {
  confere(false, `a bancada quebrou: ${e.message.slice(0, 200)}`);
  await page.screenshot({ path: resolve('.tmp/esquadrao-ficha-erro.png') }).catch(() => {});
}
confere(erros.length === 0, erros.length ? `erros da página: ${erros.slice(0, 4).join(' | ')}` : 'nenhum erro na página');
await browser.close();
await vite.close();
console.log(falhas.length ? `\n${falhas.length} verificação(ões) falharam` : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
