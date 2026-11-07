import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { criarEstudio } from '../../scripts/estudio.mjs';

/**
 * O pé no chão de todos os robôs (P325, 07/11): sobe o Estúdio numa porta livre e, para cada robô do seletor da aba MECHS 3D, mede o PONTO MAIS BAIXO da malha
 * (geometria exata; com o esqueleto, nas malhas importadas) na **geração 2**, parado, correndo e no roteiro inteiro. Negativo é abaixo do chão. Foi assim que se viu
 * que o afundamento é o andar da geração 2 (parado dá 0 cm). A geração 3 tem o contrato em teste (`client/src/entities/corpoGen3.contrato.test.ts`), que emula o giro do
 * tornozelo do shader: a caixa da malha não o vê.
 *
 *   node .decepticons/medicoes/pes-no-chao.mjs [id1,id2,...]
 *
 * Deixa o robô assentar antes de medir o repouso (a corrida anterior ainda se desfaz). SwiftShader (sem GPU): lento. G15: temporários em `.tmp/`; o resultado também vai
 * para `.tmp/pes-no-chao/pes.json`.
 */
const TMP = resolve('.tmp', 'pes-no-chao');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(join(TMP, 'ARMAS'), { recursive: true });
mkdirSync(join(TMP, 'VOZ'), { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const SO = process.argv[2] ? process.argv[2].split(',') : null;

const servidor = criarEstudio({ raiz: resolve('.'), origem: join(TMP, 'ARMAS'), origemVozes: join(TMP, 'VOZ'), ffmpeg: undefined });
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${servidor.address().port}/`;
const { chromium } = await import('playwright-core');
let browser;
try {
  for (const channel of ['chrome', 'msedge']) {
    try {
      browser = await chromium.launch({ channel, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
      break;
    } catch {
      /* próximo navegador */
    }
  }
  if (!browser) throw new Error('nenhum navegador (chrome ou msedge) encontrado');
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
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
  if (!quadro) throw new Error('a prévia não abriu');
  await quadro.waitForFunction(() => window.pronto === true, null, { timeout: 240_000 });
  const ids = await quadro.$$eval('select option', (os) => os.map((o) => o.value));
  const linhas = [];
  console.log('geração 2, ponto mais baixo da malha (negativo afunda):');
  for (const id of ids) {
    if (SO && !SO.includes(id)) continue;
    await quadro.selectOption('select', id);
    await quadro.waitForFunction((x) => {
      const p = window.mechsProva?.();
      return p && p.chassi === x && p.lados.every((l) => l.pronto);
    }, id, { timeout: 180_000 });
    const origem = await quadro.evaluate(() => window.mechsProva().origem);
    const medir = async (rotulo, n) => {
      await quadro.click(`button:has-text("${rotulo}")`);
      return quadro.evaluate((q) => window.mechsMedirPes(q), n);
    };
    await medir('PARADO', 150);
    const parado = await medir('PARADO', 60);
    await medir('CORRER', 240);
    const correr = await medir('CORRER', 360);
    const roteiro = await medir('ROTEIRO', 620);
    const cm = (r) => Math.round(r.lados[0].pisoMin * 1000) / 10;
    linhas.push({ id, origem, geracao2: { parado: cm(parado), correr: cm(correr), roteiro: cm(roteiro) } });
    console.log(`${id.padEnd(12)} ${origem.padEnd(9)} parado ${String(cm(parado)).padStart(7)} cm   correr ${String(cm(correr)).padStart(7)} cm   roteiro ${String(cm(roteiro)).padStart(7)} cm`);
  }
  writeFileSync(join(TMP, 'pes.json'), JSON.stringify(linhas, null, 2));
  if (erros.length) console.log('erros de página:', erros.join(' | '));
} finally {
  await browser?.close();
  await new Promise((r) => servidor.close(r));
}
