/**
 * Mede a boca de cada encaixe de arma dos robôs importados e confere com o dado do chassi.
 *
 *   npm run mech:bocas [-- marauder]
 *
 * O servidor não tem o desenho do robô importado (usa o corpo procedural) e atira da `MechStats.muzzles`; o cliente atira
 * da boca do desenho. Este comando carrega o `.glb` num Chrome/Edge headless, monta o robô com a montagem de fábrica, mede
 * a boca de cada encaixe (m, a partir dos pés, virado para -Z) e compara com o dado de `entities/chassis.ts`. Sai com
 * código 1 se algum passar de 15 cm (G14: o tiro tem que sair do mesmo lugar nos dois lados). Sem o dado, só imprime a
 * medida pronta para colar.
 *
 * Temporários só dentro do projeto (G15): `.tmp/` e um arquivo descartável em `client/`.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const TOLERANCIA_M = 0.15;
const MOUNTS = ['rightHand', 'leftHand', 'rightShoulder', 'leftShoulder'];
const so = process.argv.slice(2).find((a) => !a.startsWith('--'));
const TMP = resolve('.tmp', 'rig-medicao');
const PAGE = resolve('client', '.tmp-medir-bocas.html');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;

writeFileSync(
  PAGE,
  `<!doctype html><html><body><script type="module">
  import * as THREE from 'three';
  import { IMPORTED_CHASSIS, tryInstantiateMechRig, whenMechAssetReady } from '/src/entities/importedMechAssets.ts';
  import { CHASSIS } from '/src/entities/chassis.ts';
  import { ImportedMech } from '/src/entities/ImportedMech.ts';
  const r = (v) => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
  const so = ${JSON.stringify(so ?? null)};
  const out = {};
  for (const id of Object.keys(IMPORTED_CHASSIS)) {
    if (so && id !== so) continue;
    const cfg = IMPORTED_CHASSIS[id];
    if (!cfg.weaponMounts) continue; // só quem tem encaixe de arma desenhado tem boca para medir
    const stats = CHASSIS[id];
    await whenMechAssetReady(cfg.url, stats.height, cfg);
    const rig = tryInstantiateMechRig(cfg.url, stats.height);
    // Sem o dado do chassi, a boca vale a medida do rig: é isso que se quer medir.
    const mech = new ImportedMech({ ...stats, muzzles: undefined }, rig, stats.loadout);
    const medido = {};
    for (const m of ${JSON.stringify(MOUNTS)}) medido[m] = r(mech.simMuzzle(new THREE.Vector3(), m));
    out[id] = { medido, dado: stats.muzzles ?? null };
  }
  window.medicao = out; window.pronto = true;
</script></body></html>`,
  'utf8',
);

const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 4223, strictPort: false, open: false } });
let browser;
let falhou = false;
try {
  console.log('bocas  iniciando servidor local');
  await server.listen();
  const { chromium: pw } = await import('playwright-core');
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  for (const channel of process.platform === 'win32' ? ['msedge', 'chrome', undefined] : ['chrome', undefined]) {
    try {
      browser = await pw.launch({ channel, args, timeout: 20_000 });
      break;
    } catch {
      /* próximo */
    }
  }
  if (!browser) throw new Error('nenhum Chrome/Edge encontrado');
  console.log('bocas  navegador pronto, carregando rig');
  const page = await browser.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto(`${server.resolvedUrls.local[0]}.tmp-medir-bocas.html`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.pronto === true, null, { timeout: 120_000 });
  const medicao = await page.evaluate(() => window.medicao);
  if (erros.length) console.error('erros na página:', erros.join(' | '));
  for (const [id, { medido, dado }] of Object.entries(medicao)) {
    console.log(`\n${id}`);
    for (const m of MOUNTS) {
      const a = medido[m];
      const b = dado?.[m];
      const dist = b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : null;
      const ok = dist === null ? '(sem dado no chassi)' : dist <= TOLERANCIA_M ? `ok (${dist.toFixed(2)} m)` : `FORA: ${dist.toFixed(2)} m`;
      if (dist !== null && dist > TOLERANCIA_M) falhou = true;
      console.log(`  ${m.padEnd(14)} medido [${a.join(', ')}]  dado ${b ? `[${b.join(', ')}]` : '—'}  ${ok}`);
    }
    if (!dado || Object.values(medido).some((v, i) => dado[MOUNTS[i]] === undefined)) {
      console.log(`\n  muzzles: {\n${MOUNTS.map((m) => `    ${m}: [${medido[m].join(', ')}],`).join('\n')}\n  },`);
    }
  }
  if (!Object.keys(medicao).length) console.log('nenhum chassi importado com encaixe de arma' + (so ? ` chamado "${so}"` : ''));
} finally {
  await browser?.close();
  await server.close();
  rmSync(PAGE, { force: true });
}
if (falhou) {
  console.error('\nA boca do desenho não bate com o dado do chassi: atualize `muzzles` em entities/chassis.ts.');
  process.exit(1);
}
