import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

/**
 * O cartão do fim da partida (P304, "toda partida rende") no jogo de verdade: abre a Cidade Neon (todos contra todos), dá ao piloto 3 abates, uma sequência de 3 e 1.500 de dano,
 * adianta a rodada até o fim e confere, num Chrome de verdade: o cartão no placar do intervalo (XP linha por linha, Créditos, barra de nível), o XP somado ao piloto, o cartão
 * sumindo quando a rodada seguinte começa, o fim de missão no console (com SUBIU DE NÍVEL) e o aviso curto do online. Fotografa em `.decepticons/arte/recompensa-*-claude.jpg`.
 * (`page.evaluate` é a API do Playwright: roda a função no navegador de teste, nada de `eval()` de texto.) G15: nada fora do projeto.
 *
 *   node .decepticons/medicoes/cartao-recompensa.mjs [chrome|msedge|brave]
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

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5195, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text().slice(0, 140)}`); });
mkdirSync(resolve('.decepticons/arte'), { recursive: true });
const foto = (nome) => page.screenshot({ path: resolve(`.decepticons/arte/recompensa-${nome}-claude.jpg`), type: 'jpeg', quality: 82, timeout: 90_000 });
const cartao = () => page.evaluate(() => {
  const c = document.querySelector('.cartao-recompensa');
  return c ? { visivel: !c.hidden && c.getBoundingClientRect().height > 0, texto: c.textContent, pai: c.parentElement?.className || c.parentElement?.id || '', compacto: c.classList.contains('compacto') } : null;
});

try {
  await page.goto(`${base}?mapa=arena&depurar`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 120_000 });
  await page.waitForTimeout(6000);
  for (let i = 0; i < 8; i++) {
    await page.click('#cta').catch(() => {});
    await page.waitForTimeout(500);
    if (await page.evaluate(() => !!document.pointerLockElement)) break;
  }
  await page.waitForTimeout(9000); // a vinheta da marca e o COMBATE!

  // 1) O fim da rodada: 3 abates, sequência de 3, 1.500 de dano, a rodada inteira jogada.
  const antes = await page.evaluate(() => {
    const g = window.__game;
    const alvo = g.match.bots.mechs[0];
    for (let i = 0; i < 3; i++) g.round.recordKill(alvo, g.mech);
    for (let i = 0; i < 3; i++) g.sequencia.abate(100 + i);
    g.danoDaPartida = 1500;
    g.segundosDaPartida = 290;
    const xp = g.dailyChallenges.xp + g.dailyChallenges.level * 1000;
    g.round.timeLeft = 0.05;
    return { xp, creditos: g.dailyChallenges.credits };
  });
  await page.waitForFunction(() => !window.__game.round.playing, null, { timeout: 30_000 });
  await page.waitForTimeout(2500);
  const c1 = await cartao();
  confere(!!c1?.visivel && c1.pai.includes('round-board'), `o cartão aparece no placar do intervalo (${c1?.pai})`);
  confere(/SUA PARTIDA/.test(c1?.texto ?? '') && /ABATES ×3/.test(c1?.texto ?? '') && /SEQUÊNCIA 3×/.test(c1?.texto ?? '') && /DANO CAUSADO 1500/.test(c1?.texto ?? ''), `as linhas do XP: ${c1?.texto?.slice(0, 160)}`);
  const depois = await page.evaluate(() => ({ xp: window.__game.dailyChallenges.xp + window.__game.dailyChallenges.level * 1000, creditos: window.__game.dailyChallenges.credits }));
  confere(depois.xp - antes.xp > 150, `o XP entrou no piloto: +${depois.xp - antes.xp}`);
  confere(depois.creditos > antes.creditos, `os Créditos entraram: +${depois.creditos - antes.creditos}`);
  await foto('rodada');

  // 2) A rodada seguinte começa: o cartão some.
  await page.evaluate(() => (window.__game.round.timeLeft = 0.05));
  await page.waitForFunction(() => window.__game.round.playing, null, { timeout: 30_000 });
  await page.waitForTimeout(800);
  confere((await cartao())?.visivel === false, 'a rodada nova tira o cartão da tela');

  // 3) O fim de missão no console, com o piloto a 100 XP de subir: o cartão diz SUBIU PARA O NÍVEL.
  await page.evaluate(() => {
    const g = window.__game;
    g.dailyChallenges.data.xp = 900;
    g.abatesDaPartida = 12;
    g.danoDaPartida = 5200;
    g.segundosDaPartida = 240;
    g.missionEnded = true;
    g.fimDePartidaNoConsole(true, 6);
    g.setPlaying(false);
    g.input.exitLock();
  });
  await page.waitForTimeout(2500);
  const c3 = await cartao();
  confere(!!c3?.visivel && /SUBIU PARA O NÍVEL/.test(c3.texto ?? ''), `o fim de missão no console mostra o nível novo: ${c3?.texto?.slice(0, 120)}`);
  confere(/ONDAS ×6/.test(c3?.texto ?? '') && /VITÓRIA/.test(c3?.texto ?? ''), 'a missão rende as ondas e a vitória');
  await foto('console');

  // 4) Recomeçar a missão tira o cartão do console.
  await page.click('#cta').catch(() => {});
  await page.waitForTimeout(1500);
  confere((await cartao())?.visivel === false, 'jogar de novo tira o cartão do console');

  // 5) O aviso curto do online (o mesmo cartão, compacto, no topo, sem pegar o mouse).
  await page.evaluate(() => {
    const g = window.__game;
    g.cartao.mostrar(document.getElementById('hud'), { xp: 187, creditos: 46, linhas: [] }, { nivelAntes: 3, xpAntes: 400, nivel: 3, xp: 587, xpPorNivel: 1000 }, ['CAÇADOR DE ANDRÓIDES'], true);
  });
  await page.waitForTimeout(2000);
  const c5 = await cartao();
  confere(!!c5?.visivel && c5.compacto, 'o aviso curto do online aparece no topo');
  confere(await page.evaluate(() => getComputedStyle(document.querySelector('.cartao-recompensa')).pointerEvents === 'none'), 'o aviso curto não pega o mouse');
  await foto('online');
} catch (e) {
  falhas.push(`a bancada quebrou: ${e.message}`);
  console.error(e);
  await foto('erro').catch(() => {});
} finally {
  for (const e of erros) console.log(`  ${e}`);
  confere(erros.filter((e) => !/WebGL|GPU stall|favicon|ERR_CONNECTION_REFUSED|WebSocket/.test(e)).length === 0, `nenhum erro de página (${erros.length} no console, filtrado o ruído de GPU e rede)`);
  await browser.close();
  await vite.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);
