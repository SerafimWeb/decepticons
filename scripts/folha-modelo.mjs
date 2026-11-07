import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { criarEstudio } from './estudio.mjs';

/**
 * A folha de fotos de um modelo (P323, `MODELADOR.md` § 2): o robô parado, de quatro lados (frente, 3/4, lado e costas) mais de cima, na prévia da aba MECHS 3D
 * do Estúdio com o código do jogo, numa folha só. É o que o Claude olha para criticar o desenho (e o que o Comandante julga no Estúdio); o número vem da
 * ficha e dos testes do modelo, a foto não os substitui.
 *
 *   npm run mech:folha -- [--modelo gaviao] [--luz estudio|jogo] [--pecas codigo|blender] [--saida .tmp/modelo/<modelo>/folha.png]
 *
 * `--pecas blender` (só no gaviao) fotografa o peito, a ombreira e o capacete feitos no Blender (a Prova Blender, P329) no lugar dos do kit em código.
 *
 * `--luz estudio` (o padrão) é a caixa de luz suave, para julgar a forma; `--luz jogo` é a luz da arena, o robô como o jogador o vê.
 *
 * O `--modelo` é o valor do seletor da aba (um chassi do jogo, como `vector09`, ou o modelo novo `gaviao`). SwiftShader (sem GPU): lento, mas é o desenho de verdade.
 * G15: temporários só em `.tmp/`.
 */
const args = process.argv.slice(2);
const flag = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : padrao;
};
const MODELO = flag('modelo', 'gaviao');
const PECAS = flag('pecas', 'codigo');
if (!['codigo', 'blender'].includes(PECAS)) throw new Error('--pecas é codigo (o kit em código) ou blender (as peças do Blender)');
const LUZ = flag('luz', 'estudio');
if (!['estudio', 'jogo'].includes(LUZ)) throw new Error('--luz é estudio (a caixa de luz suave) ou jogo (a luz da arena)');
const SAIDA = resolve(flag('saida', `.tmp/modelo/${MODELO}/${PECAS === 'blender' ? 'blender-' : ''}${LUZ === 'jogo' ? 'folha-jogo' : 'folha'}.png`));
const TMP = resolve('.tmp', 'folha-modelo');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(join(TMP, 'ARMAS'), { recursive: true });
mkdirSync(join(TMP, 'VOZ'), { recursive: true });
mkdirSync(join(SAIDA, '..'), { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;

// Cada tomada: o botão da vista, o quanto a câmera se aproxima e a altura do alvo (fração da altura do robô). Corpo inteiro e dois closes.
const VISTAS = [
  ['FRENTE', 0.85, 0.45],
  ['3/4', 0.85, 0.45],
  ['LATERAL', 0.85, 0.45],
  ['COSTAS', 0.85, 0.45],
  ['3/4', 0.3, 0.9], // a cabeça e os ombros
  ['LATERAL', 0.35, 0.1], // as botas
];

const servidor = criarEstudio({ raiz: resolve('.'), origem: join(TMP, 'ARMAS'), origemVozes: join(TMP, 'VOZ'), ffmpeg: undefined });
await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
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

  await quadro.selectOption('select', MODELO);
  await quadro.waitForFunction((x) => {
    const p = window.mechsProva?.();
    return p && p.chassi === x && p.lados.every((l) => l.pronto);
  }, MODELO, { timeout: 180_000 });
  if (LUZ === 'jogo') await quadro.click('button:has-text("COMO NO JOGO")');
  if (PECAS === 'blender') {
    await quadro.click('button:text-is("DO BLENDER")');
    await quadro.waitForFunction(() => {
      const p = window.mechsProva?.();
      return p && p.pecas === 'blender' && p.lados.every((l) => l.pronto && l.pecasNoRig > 0);
    }, null, { timeout: 120_000 });
  }
  // Parado, só a geração 3 (o modelo novo) ou só a 2 (onde não há 3), um robô grande na tela.
  await quadro.click('button:has-text("PARADO")');
  const so3 = await quadro.evaluate(() => window.mechsProva().lados[1].temGen3);
  await quadro.click(so3 ? 'button:has-text("SÓ GER. 3")' : 'button:has-text("SÓ GER. 2")');
  await page.waitForTimeout(1500);

  const fotos = [];
  const palco = quadro.locator('#palco');
  for (const [rotulo, fator, alvo] of VISTAS) {
    await quadro.click(`button:has-text("${rotulo}")`);
    await quadro.evaluate(([f, y]) => window.mechsEnquadrar?.(f, y), [fator, alvo]);
    await page.waitForTimeout(900);
    fotos.push([alvo === 0.45 ? rotulo : `${rotulo} (perto)`, (await palco.screenshot({ type: 'png' })).toString('base64')]);
  }
  // A folha: as fotos em fila de duas colunas, com o rótulo de cada vista.
  const folha = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const quadros = fotos.map(([r, b64]) => `<figure><img src="data:image/png;base64,${b64}"><figcaption>${r}</figcaption></figure>`).join('');
  await folha.setContent(`<style>body{margin:0;background:#15191c;color:#cfe;font:14px monospace;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:6px}figure{margin:0;position:relative}img{width:100%;display:block}figcaption{position:absolute;left:8px;top:6px;background:#000a;padding:2px 8px}</style>${quadros}`);
  await folha.waitForTimeout(500);
  writeFileSync(SAIDA, await folha.screenshot({ type: 'png', fullPage: true }));
  console.log(`folha: ${SAIDA}${erros.length ? `\nerros de página: ${erros.join(' | ')}` : ''}`);
} finally {
  await browser?.close();
  await new Promise((resolver) => servidor.close(resolver));
}
