import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { criarEstudio } from '../../scripts/estudio.mjs';

/**
 * A aba MECHS 3D do Estúdio (P321), provada no navegador de verdade: sobe o Estúdio real numa porta livre, abre a aba, espera a prévia montar (o Vite com o
 * código do jogo), e confere que a geração 3 está viva ao lado da 2, que trocar de chassi, desmontar, explodir e mexer nos ajustes não dão erro de página e
 * que a ficha lê os números do código. Fotografa a aba (regra 16). **Não grava nada no dado do jogo** (o SALVAR tem teste de servidor).
 *
 *   node .decepticons/medicoes/estudio-mechs.mjs [chrome|msedge]
 *
 * SwiftShader (sem GPU): lento, mas a interface é a de verdade. G15: temporários em `.tmp/`.
 */
const quem = process.argv[2] ?? 'chrome';
const raiz = resolve('.');
const TMP = resolve('.tmp', 'estudio-prova');
const FOTO = resolve('.decepticons', 'arte', 'estudio-mechs-gen3.png');
const FOTO_MALHA = resolve('.decepticons', 'arte', 'estudio-mechs-todos.png');
const FOTO_GAVIAO = resolve('.decepticons', 'arte', 'gaviao-h3-correndo.png');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(join(TMP, 'ARMAS'), { recursive: true });
mkdirSync(join(TMP, 'VOZ'), { recursive: true });
mkdirSync(resolve('.decepticons', 'arte'), { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;

const falhas = [];
let verificacoes = 0;
const ok = (nome, cond, detalhe = '') => {
  verificacoes++;
  if (!cond) falhas.push(`${nome} ${detalhe}`);
  console.log(`  ${cond ? 'ok    ' : 'FALHA '} ${nome}${detalhe ? ` (${detalhe})` : ''}`);
};

const servidor = criarEstudio({ raiz, origem: join(TMP, 'ARMAS'), origemVozes: join(TMP, 'VOZ'), ffmpeg: undefined });
await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
const base = `http://127.0.0.1:${servidor.address().port}/`;

const { chromium } = await import('playwright-core');
const flags = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let browser;
try {
  for (const channel of [quem, 'chrome', 'msedge']) {
    try {
      browser = await chromium.launch({ channel, args: flags });
      break;
    } catch {
      /* próximo navegador */
    }
  }
  if (!browser) throw new Error('nenhum navegador (chrome ou msedge) encontrado');
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) erros.push(m.text());
  });

  console.log('\nA aba MECHS 3D do Estúdio');
  await page.goto(base);
  await page.click('[data-aba="mechs"]');
  const quadro = await (async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 240_000) {
      const f = page.frames().find((fr) => fr.url().includes('/api/mechs/app/'));
      if (f) return f;
      await page.waitForTimeout(500);
    }
    return null;
  })();
  ok('a prévia montou (Vite) e abriu dentro da aba', quadro !== null);
  if (!quadro) throw new Error('a prévia não abriu');
  await quadro.waitForFunction(() => window.pronto === true, null, { timeout: 240_000 });
  ok('a prévia carregou o código do jogo e a geração 3 (sob demanda)', true);

  // Deixa correr: o SwiftShader é lento, então espera o simulador acumular quadros em vez de contar segundos.
  await quadro.waitForFunction(() => (window.mechsProva?.().quadros ?? 0) > 240, null, { timeout: 240_000 });
  const a = await quadro.evaluate(() => window.mechsProva());
  const [g2, g3] = a.lados;
  ok('as duas gerações correm na velocidade do chassi', Math.abs(g2.v - g3.v) < 0.01 && g3.v > 5, `v ${g3.v.toFixed(1)} m/s`);
  ok('a geração 3 anda de pé (a pelve no máximo 0,3 m abaixo do repouso: o agachado era 0,3 m ou mais)', g3.pelve > -0.3 && g3.pelve < 0.02 && g2.pelve > -0.2, `pelve G2 ${g2.pelve.toFixed(2)} · G3 ${g3.pelve.toFixed(2)} m`);
  ok('as duas dão passos', g2.passosPorSegundo > 0.5 && g3.passosPorSegundo > 0.5, `passos/s G2 ${g2.passosPorSegundo} · G3 ${g3.passosPorSegundo}`);

  const ficha = await quadro.evaluate(() => [...document.querySelectorAll('table')][0]?.innerText ?? '');
  ok('a ficha lê os números do código (alcance, agachamento, passos por segundo)', /Alcance do passo/.test(ficha) && /Passos\/s com o teto/.test(ficha), ficha.split('\n').length + ' linhas');

  // TODOS os robôs do jogo (P324): troca para cada um do seletor (o de malha leva um tempo para carregar o .glb) e confere o que cada corpo permite.
  const opcoes = await quadro.$$eval('select option', (os) => os.map((o) => o.value));
  const total = await quadro.evaluate(() => window.mechsProva().opcoes);
  ok('o seletor lista TODOS os robôs do jogo (um por chassi, sem lista digitada)', opcoes.length === total && opcoes.length >= 11, opcoes.length + ' opções');
  for (const id of opcoes) {
    await quadro.selectOption('select', id);
    await quadro.waitForFunction((x) => {
      const p = window.mechsProva?.();
      return p && p.chassi === x && p.lados.every((l) => l.pronto);
    }, id, { timeout: 180_000 });
    const antes = await quadro.evaluate(() => window.mechsProva().quadros);
    await quadro.waitForFunction((q) => window.mechsProva().quadros > q + 90, antes, { timeout: 180_000 });
    const p = await quadro.evaluate(() => window.mechsProva());
    const [e, d] = p.lados;
    const regra = {
      modelo: d.temGen3 && d.desmontavel,
      codigo: d.temGen3 && d.desmontavel && p.vista !== undefined,
      androide: !d.temGen3 && d.desmontavel && p.vista === 'g2',
      malha: !d.temGen3 && !d.desmontavel && p.vista === 'g2',
    }[p.origem];
    ok(id + ' (' + p.origem + ') monta, anda e respeita o que o corpo permite', Boolean(regra) && e.v > 1, 'geração 3 ' + d.temGen3 + ' · vista ' + p.vista + ' · desmontável ' + d.desmontavel + ' · v ' + e.v.toFixed(1));
    if (id === 'marauder') await page.screenshot({ path: FOTO_MALHA, clip: { x: 0, y: 0, width: 1600, height: 820 } });
    if (id === 'gaviao') await page.screenshot({ path: FOTO_GAVIAO, clip: { x: 0, y: 0, width: 1600, height: 820 } });
  }
  await quadro.selectOption('select', 'vector09');
  await quadro.waitForFunction(() => { const p = window.mechsProva?.(); return p && p.chassi === 'vector09' && p.lados.every((l) => l.pronto); }, null, { timeout: 60_000 });

  // A luz: ESTÚDIO (a caixa de luz suave) e COMO NO JOGO (a luz da arena), sem erro, e a troca vale.
  ok('a luz da prévia começa no ESTÚDIO', (await quadro.evaluate(() => window.mechsProva().luz)) === 'estudio');
  await quadro.click('button:has-text("COMO NO JOGO")');
  ok('COMO NO JOGO troca a luz para a da arena', (await quadro.evaluate(() => window.mechsProva().luz)) === 'jogo');
  await quadro.click('button:has-text("ESTÚDIO")');

  // O pé no chão: o medidor avança a simulação sem esperar o relógio e devolve números finitos (a conta é geometria exata da malha).
  const pes = await quadro.evaluate(() => window.mechsMedirPes(30));
  ok('o medidor de pé no chão responde com um número por lado', pes.lados.length === 2 && pes.lados.every((l) => Number.isFinite(l.pisoMin)), pes.lados.map((l) => (l.pisoMin * 100).toFixed(1) + ' cm').join(' · '));

  // O painel DESENHO só existe no Gavião, e mexer num slider muda a geometria (a largura do robô cresce com a ombreira).
  const blocoDesenho = () => quadro.evaluate(() => { const h = [...document.querySelectorAll('h3')].find((x) => x.textContent === 'Desenho do Gavião-H3'); return h ? !h.parentElement.hidden : null; });
  ok('o painel DESENHO fica escondido nos outros robôs', (await blocoDesenho()) === false);
  await quadro.selectOption('select', 'gaviao');
  await quadro.waitForFunction(() => { const p = window.mechsProva?.(); return p && p.chassi === 'gaviao' && p.lados.every((l) => l.pronto); }, null, { timeout: 60_000 });
  ok('o painel DESENHO aparece no Gavião-H3', (await blocoDesenho()) === true);
  const larguraDeFabrica = await quadro.evaluate(() => window.mechsProva().lados[0].larguraX);
  await quadro.evaluate(() => {
    const h = [...document.querySelectorAll('h3')].find((x) => x.textContent === 'Desenho do Gavião-H3');
    const r = h.parentElement.querySelector('input[type=range]'); // o primeiro slider é o tamanho da ombreira
    r.value = r.max;
    r.dispatchEvent(new Event('input'));
  });
  await quadro.waitForFunction((l0) => { const p = window.mechsProva?.(); return p && p.lados.every((l) => l.pronto) && p.lados[0].larguraX > l0 + 0.05; }, larguraDeFabrica, { timeout: 60_000 });
  const larguraGrande = await quadro.evaluate(() => window.mechsProva().lados[0].larguraX);
  ok('a ombreira no máximo alarga o robô (o desenho muda a geometria de verdade)', larguraGrande > larguraDeFabrica + 0.05, `${larguraDeFabrica.toFixed(2)} → ${larguraGrande.toFixed(2)} m`);
  await quadro.click('button:has-text("PADRÃO DO DESENHO")');

  // As peças do Blender (a Prova Blender, P329): o botão troca o peito, a ombreira e o capacete do kit pelas peças .glb, no MESMO robô andando.
  const pecasNoRig = () => quadro.evaluate(() => window.mechsProva().lados.map((l) => l.pecasNoRig));
  ok('o Gavião começa com as peças do código (nenhuma malha do Blender no rig)', (await quadro.evaluate(() => window.mechsProva().pecas)) === 'codigo' && (await pecasNoRig()).every((n) => n === 0));
  await quadro.click('button:text-is("DO BLENDER")');
  await quadro.waitForFunction(() => { const p = window.mechsProva?.(); return p && p.pecas === 'blender' && p.lados.every((l) => l.pronto && l.pecasNoRig > 0); }, null, { timeout: 120_000 });
  const comBlender = await pecasNoRig();
  ok('DO BLENDER põe as peças nos pivôs do rig (peito, capacete e as duas ombreiras)', comBlender.every((n) => n >= 8 && n <= 12), 'malhas ' + comBlender.join(' / '));
  const antesDasPecas = await quadro.evaluate(() => window.mechsProva().quadros);
  await quadro.waitForFunction((q) => window.mechsProva().quadros > q + 60, antesDasPecas, { timeout: 120_000 });
  ok('o robô com as peças do Blender anda (sem erro de página)', erros.length === 0, erros.slice(0, 2).join(' | '));
  await quadro.click('button:text-is("DO CÓDIGO")');
  await quadro.waitForFunction(() => { const p = window.mechsProva?.(); return p && p.pecas === 'codigo' && p.lados.every((l) => l.pronto && l.pecasNoRig === 0); }, null, { timeout: 120_000 });
  ok('DO CÓDIGO devolve as peças do kit (nenhuma malha do Blender no rig)', true);
  await quadro.selectOption('select', 'vector09');
  await quadro.waitForFunction(() => { const p = window.mechsProva?.(); return p && p.chassi === 'vector09' && p.lados.every((l) => l.pronto); }, null, { timeout: 60_000 });

  // Desmontar, explodir, o roteiro e um ajuste que refaz os Mechs.
  await quadro.click('button:has-text("PERNAS")');
  await quadro.evaluate(() => {
    const r = document.querySelector('input[type=range]');
    r.value = '0.7';
    r.dispatchEvent(new Event('input'));
  });
  await quadro.click('button:has-text("ROTEIRO")');
  const antes = await quadro.evaluate(() => [...document.querySelectorAll('table')][0].innerText);
  await quadro.evaluate(() => {
    const ranges = [...document.querySelectorAll('input[type=range]')];
    const teto = ranges.find((r) => r.max === '3'); // o teto da cadência (faixa 0,6 a 3)
    teto.value = '2.6';
    teto.dispatchEvent(new Event('input'));
  });
  await page.waitForTimeout(600);
  const depois = await quadro.evaluate(() => [...document.querySelectorAll('table')][0].innerText);
  ok('mexer no teto da cadência refaz a ficha (os números vêm do código)', antes !== depois);
  await quadro.click('button:has-text("PADRÃO DE PROJETO")');
  await quadro.click('button:has-text("DESFAZER")');
  await page.waitForTimeout(1500);
  const desfeito = await quadro.evaluate(() => document.getElementById('aviso').textContent);
  ok('DESFAZER lê o arquivo salvo', /salvo no arquivo/.test(desfeito), desfeito);

  await quadro.click('button:has-text("TUDO")');
  await quadro.evaluate(() => {
    const r = document.querySelector('input[type=range]');
    r.value = '0';
    r.dispatchEvent(new Event('input'));
  });
  await quadro.click('button:has-text("CORRER")');
  await quadro.waitForFunction(() => (window.mechsProva?.().quadros ?? 0) > 60, null, { timeout: 120_000 });
  await page.waitForTimeout(800);
  // Só a aba (a faixa de mensagens de baixo é do SONS: a pasta de áudio desta prova está vazia).
  await page.screenshot({ path: FOTO, clip: { x: 0, y: 0, width: 1600, height: 820 } });
  ok('nenhum erro de página nem de console', erros.length === 0, erros.slice(0, 3).join(' | '));
  console.log(`\n  Foto: ${FOTO}`);
} catch (e) {
  falhas.push(`exceção: ${e.message}`);
  console.log(`  FALHA  ${e.message}`);
} finally {
  await browser?.close();
  await new Promise((resolver) => servidor.close(resolver));
}
console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s) em ${verificacoes} verificações.` : `\nRESULTADO: ${verificacoes} verificações, todas ok.`);
process.exit(falhas.length ? 1 : 0);
