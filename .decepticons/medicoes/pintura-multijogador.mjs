import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, runnerImport } from 'vite';
import { apontarJogoPara } from './vozLib.mjs';

/**
 * A cor do casco VISTA POR OUTRO PILOTO (P305, "fazer bem feito e completo"): dois jogadores no servidor de verdade, cada um com a sua cor.
 *   - Piloto B (Vector-09, procedural): compra o AZUL MARINHO no HANGAR (clique no mostruário, depois APLICAR MONTAGEM) e entra na sala.
 *   - Piloto A (Marauder, importado): entra com o BRANCO ÓSSEO já na conta (a posse vem do progresso guardado).
 * Cada um confere, no navegador, a cor do robô do outro: o procedural pela cor dos vértices, o importado pela cor do material do casco.
 * Também tira fotos para o dono julgar (regra 16): o HANGAR com a seção COR DO CASCO, e o jogo de cada lado.
 *
 *   node .decepticons/medicoes/pintura-multijogador.mjs [chrome|msedge|brave]
 *
 * SwiftShader (sem GPU): lento, mas a interface e a rede são as de verdade. G15: temporários em `.tmp/`.
 */
const quem = process.argv[2] ?? 'chrome';
const EXE = {
  chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  brave: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  msedge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
}[quem];
if (!EXE) throw new Error('use chrome, brave ou msedge');

const TMP = resolve('.tmp', 'captura');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');
const saida = resolve('.decepticons', 'arte');
mkdirSync(saida, { recursive: true });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const PORTA = 2599;
const { startServer } = (await runnerImport(resolve('server/Server.ts'), { configFile: false, logLevel: 'warn' })).module;
const { loadoutKey, factorySpec } = (await runnerImport(resolve('client/src/hangar/loadout.ts'), { configFile: false, logLevel: 'warn' })).module;
const { PINTURAS } = (await runnerImport(resolve('shared/pinturas.ts'), { configFile: false, logLevel: 'warn' })).module;

const jogo = await startServer({ port: PORTA, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 200, total: 400, msgs: 200, burst: 200 }, log: () => {} });
apontarJogoPara(PORTA);
const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5197, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];

const falhas = [];
const confere = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) falhas.push(texto);
};

// A cor linear (como o THREE guarda no vértice): a mesma conta do `Color.setHex`.
const linear = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
const idxAzul = PINTURAS.findIndex((p) => p.id === 'marinho');
const idxOsseo = PINTURAS.findIndex((p) => p.id === 'osseo');
const corAzul = linear(PINTURAS[idxAzul].cor);
const corOsseo = linear(PINTURAS[idxOsseo].cor);

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const erros = [];

// Piloto A: o Marauder com o branco ósseo, já na conta deste navegador (a posse e a montagem guardadas, como depois de uma compra).
const montagemA = JSON.stringify({ ...factorySpec('marauder'), pintura: idxOsseo });
const progressoA = JSON.stringify({ level: 1, xp: 0, credits: 300, lastResetDate: hoje, challenges: [], pinturas: 2 ** idxOsseo });
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctxA.addInitScript(({ montagem, progresso }) => {
  if (!sessionStorage.getItem('bancada-pintura')) {
    localStorage.setItem('cybermech.hangar.v1', montagem);
    localStorage.setItem('cybermech_pilot_progression', progresso);
    sessionStorage.setItem('bancada-pintura', '1');
  }
}, { montagem: montagemA, progresso: progressoA });
const pageA = await ctxA.newPage();
pageA.on('pageerror', (e) => erros.push(`A pageerror: ${e.message}`));

// Piloto B: começa com 500 ₵ e compra o azul marinho no Hangar, como o jogador faria.
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const pageB = await ctxB.newPage();
pageB.on('pageerror', (e) => erros.push(`B pageerror: ${e.message}`));

try {
  // --- B compra e veste a cor no Hangar (offline, com `comandante=1`: a seção nasce restrita e o Comandante a vê).
  await pageB.goto(`${base}?comandante=1&depurar`);
  await pageB.waitForFunction(() => !!window.__game, null, { timeout: 180_000 });
  await dormir(4000);
  await pageB.click('#btn-hangar', { timeout: 60_000 });
  await pageB.waitForSelector(`[data-pintura="${idxAzul}"]`, { state: 'visible', timeout: 60_000 });
  const creditosAntes = await pageB.evaluate(() => window.__game.dailyChallenges.credits);
  await pageB.click(`[data-pintura="${idxAzul}"]`);
  await dormir(500);
  const compra = await pageB.evaluate(() => ({ credits: window.__game.dailyChallenges.credits, pinturas: window.__game.dailyChallenges.pinturas }));
  confere(compra.credits === creditosAntes - PINTURAS[idxAzul].preco, `a compra debitou ${PINTURAS[idxAzul].preco} ₵ (de ${creditosAntes} para ${compra.credits})`);
  confere(compra.pinturas === 2 ** idxAzul, `o azul marinho entrou na posse (máscara ${compra.pinturas.toString(2)})`);
  await pageB.waitForSelector(`[data-pintura="${idxAzul}"].selected`, { timeout: 30_000 });
  await pageB.screenshot({ path: resolve(saida, 'cor-do-casco-hangar-claude.jpg'), type: 'jpeg', quality: 82, timeout: 90_000 });
  await pageB.locator('#hangar-modal [data-action="apply"]:visible').first().click();
  await dormir(800);
  const guardada = await pageB.evaluate(() => JSON.parse(localStorage.getItem('cybermech.hangar.v1') ?? '{}'));
  confere(guardada.pintura === idxAzul, `a montagem salva leva a cor (pintura=${guardada.pintura})`);

  // --- A e B entram na mesma sala. A entra primeiro; B entra com a montagem que acabou de salvar.
  const sala = 'COR';
  await pageA.goto(`${base}?sala=${sala}&nome=ANA&servidor=ws://127.0.0.1:${PORTA}&comandante=1&depurar`);
  await pageA.waitForFunction(() => !!window.__game?.online?.remotes, null, { timeout: 180_000 });
  await pageB.goto(`${base}?sala=${sala}&nome=BRUNO&servidor=ws://127.0.0.1:${PORTA}&comandante=1&depurar`);
  await pageB.waitForFunction(() => !!window.__game?.online?.remotes, null, { timeout: 180_000 });
  // Cada um precisa ver o outro no roster (o robô do outro é criado na chegada da lista).
  const viu = (pagina, nome) => pagina.waitForFunction((n) => {
    const on = window.__game?.online;
    if (!on) return false;
    for (const [id, r] of on.remotes) if (on.names.get(id) === n && r.mech) return true;
    return false;
  }, nome, { timeout: 240_000 });
  await viu(pageA, 'BRUNO');
  await viu(pageB, 'ANA');
  await dormir(2000);

  // O robô do outro, do ponto de vista de cada um: a cor do casco.
  const cor = (pagina, nome, rgb) => pagina.evaluate(([n, c]) => {
    const on = window.__game.online;
    let mech = null;
    for (const [id, r] of on.remotes) if (on.names.get(id) === n) mech = r.mech;
    if (!mech) return null;
    let vertices = 0;
    let batem = 0;
    let materiaisQueBatem = 0;
    const perto = (x, y, z) => Math.abs(x - c[0]) < 0.01 && Math.abs(y - c[1]) < 0.01 && Math.abs(z - c[2]) < 0.01;
    mech.root.traverse((o) => {
      const at = o.geometry?.attributes?.color;
      if (at) for (let i = 0; i < at.count; i++) { vertices++; if (perto(at.getX(i), at.getY(i), at.getZ(i))) batem++; }
      const m = o.material;
      if (m?.color && perto(m.color.r, m.color.g, m.color.b)) materiaisQueBatem++;
    });
    return { vertices, batem, materiaisQueBatem };
  }, [nome, rgb]);

  const doB = await cor(pageA, 'BRUNO', corAzul); // A vê B (Vector-09, procedural)
  confere(!!doB && doB.batem > 0, `ANA vê o robô do BRUNO com o azul marinho (vértices da cor: ${doB?.batem ?? 0} de ${doB?.vertices ?? 0})`);
  const doA = await cor(pageB, 'ANA', corOsseo); // B vê A (Marauder, importado)
  confere(!!doA && doA.materiaisQueBatem > 0, `BRUNO vê o Marauder da ANA com o branco ósseo (materiais na cor: ${doA?.materiaisQueBatem ?? 0})`);
  // Controle: o robô do BRUNO não aparece com a cor do ANA (cada um tem a sua).
  const controle = await cor(pageA, 'BRUNO', corOsseo);
  confere(!!controle && controle.materiaisQueBatem === 0, 'o robô do BRUNO não tem a cor da ANA (cada piloto com a sua)');

  await pageA.screenshot({ path: resolve(saida, 'cor-do-casco-jogo-ana-claude.jpg'), type: 'jpeg', quality: 80, timeout: 90_000 });
} catch (e) {
  falhas.push(`a bancada quebrou: ${e.message}`);
  console.error(e);
} finally {
  for (const e of erros) console.log(`  ${e}`);
  await browser.close();
  await vite.close();
  await jogo.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);
