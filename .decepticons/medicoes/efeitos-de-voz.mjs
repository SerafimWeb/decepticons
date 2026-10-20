import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

/**
 * OS EFEITOS DE VOZ MEDIDOS NO CHROME DE VERDADE (P231): renderiza cada efeito (os mesmos nós do jogo) num `OfflineAudioContext` com sinais conhecidos e confere o que o ouvido do Comandante vai
 * receber: o TOM (o grave de verdade), os filtros do rádio, a cauda da reverberação, o eco, que o pico nunca passa de 1 (não estoura a gravação), a latência e o custo.
 * **Quem julga se a voz ficou boa é o ouvido dele** (isto não ouve nada); aqui só se prova que cada efeito faz o que diz.
 *
 *   node .decepticons/medicoes/efeitos-de-voz.mjs     # sai com 1 se algo falhar; grava medicoes/efeitos-de-voz-<data>.json
 *
 * G15: nada fora do projeto.
 */
const TMP = resolve('.tmp', 'efeitos-de-voz');
mkdirSync(TMP, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMP;
const { chromium } = await import('playwright-core');

const verificacoes = [];
const conferir = (nome, ok, detalhe = '') => {
  verificacoes.push({ nome, ok, detalhe });
  console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
};
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : String(x));

const vite = await createServer({ configFile: resolve('vite.config.ts'), logLevel: 'error', server: { port: 5199, strictPort: false, open: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0];
const PAGINA = resolve('.decepticons', 'medicoes', 'efeitos-de-voz.html').split(String.fromCharCode(92)).join('/');
let browser;
let m;
try {
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('erro de página:', e.message));
  await page.goto(`${base}@fs/${PAGINA}`);
  await page.waitForFunction(() => typeof window.__medir === 'function', null, { timeout: 180_000 });
  m = await page.evaluate(() => window.__medir());
} finally {
  await browser?.close().catch(() => {});
  await vite.close();
}

console.log('\n--- o tom do deslocador sozinho (seno de 500 Hz) ---');
for (const t of m.tom) console.log(`${String(t.semitons).padStart(3)} semitons: esperado ${f1(t.esperado)} Hz, centroide ${f1(t.medido)} Hz (${f1((t.medido / t.esperado - 1) * 100)}%), pico ${f1(t.pico)} Hz`);
console.log('\n--- nível de saída por efeito (dBFS, entrada de 0,2 = −14 dBFS) e a frequência dominante ---');
for (const [nome, linhas] of Object.entries(m.niveis)) {
  console.log(nome.padEnd(8), linhas.map((l) => `${l.entradaHz}Hz:${f1(l.db)}dB→${f1(l.dominanteHz)}Hz`).join('  '));
}
console.log('\n--- resposta LINEAR dos FILTROS (tons a -54 dBFS, sem reverberação e sem deslocador; dB relativos ao tom de 1 kHz) ---');
for (const [nome, linhas] of Object.entries(m.lineares)) {
  const ref = linhas.find((l) => l.entradaHz === 1000).db;
  console.log(nome.padEnd(8), linhas.map((l) => `${l.entradaHz}Hz:${f1(l.db - ref)}`).join('  '));
}
console.log('\n--- pico com entrada a 0,9 ---');
for (const [nome, p] of Object.entries(m.picos)) console.log(nome.padEnd(8), `seno ${p.seno.toFixed(3)}  ruído ${p.ruido.toFixed(3)}`);
console.log('\n--- cauda 0,6 a 1,0 s depois do fim do ruído (dB, relativa ao ruído) ---');
for (const [nome, c] of Object.entries(m.caudas)) console.log(nome.padEnd(8), f1(c));
console.log(`\neco do locutor: autocorrelação no atraso de 42 ms = ${m.eco.noAtraso.toFixed(3)}, maior vizinho = ${m.eco.vizinhoMaximo.toFixed(3)}`);
console.log('latência (s):', Object.entries(m.latencia).map(([n, v]) => `${n} ${(v * 1000).toFixed(1)} ms`).join(' | '));
console.log('velocidade de renderização, melhor de 3 (x tempo real):', Object.entries(m.velocidade).map(([n, v]) => `${n} ${v.toFixed(0)}x`).join(' | '));
console.log('');

// ---- as conferências ----
// A rampa se repete a cada 0,1 s: o espectro tem linhas de 10 em 10 Hz, e o centroide cai na linha mais próxima. O erro aceito é essa grade (10 Hz), que é também o "trepidar" granular do deslocador.
for (const t of m.tom) {
  const erro = Math.abs(t.medido - t.esperado);
  conferir(`o deslocador de ${t.semitons} semitons põe 500 Hz em ${f1(t.esperado)} Hz (erro até 10 Hz, a grade da rampa)`, erro <= 10, `centroide ${f1(t.medido)} Hz, erro ${f1(erro)} Hz`);
}
const nv = (nome, hz) => m.niveis[nome].find((l) => l.entradaHz === hz);
const ln = (nome, hz) => m.lineares[nome].find((l) => l.entradaHz === hz).db - m.lineares[nome].find((l) => l.entradaHz === 1000).db;
conferir('locutor: 100 Hz sai pelo menos 10 dB abaixo de 1 kHz, em nível baixo (corta o grave: banda de rádio)', ln('locutor', 100) <= -10, `${f1(ln('locutor', 100))} dB`);
conferir('locutor: 6 kHz sai pelo menos 8 dB abaixo de 1 kHz, em nível baixo (corta o agudo)', ln('locutor', 6000) <= -8, `${f1(ln('locutor', 6000))} dB`);
conferir('locutor: realça a presença (a faixa de 3 kHz fica acima do grave de 100 Hz por pelo menos 12 dB)', ln('locutor', 3000) - ln('locutor', 100) >= 12, `${f1(ln('locutor', 3000) - ln('locutor', 100))} dB`);
conferir('locutor: o tom não muda (1 kHz sai em 1 kHz, com 2%)', Math.abs(nv('locutor', 1000).dominanteHz / 1000 - 1) <= 0.02, `${f1(nv('locutor', 1000).dominanteHz)} Hz`);
const razaoS = 2 ** (-5 / 12);
const razaoI = 2 ** (-3 / 12);
conferir('sombrio: 1 kHz sai em ~749 Hz (5 semitons abaixo, 3%)', Math.abs(nv('sombrio', 1000).dominanteHz / (1000 * razaoS) - 1) <= 0.03, `${f1(nv('sombrio', 1000).dominanteHz)} Hz`);
conferir('irmão: 1 kHz sai em ~841 Hz (3 semitons abaixo, 3%)', Math.abs(nv('irmao', 1000).dominanteHz / (1000 * razaoI) - 1) <= 0.03, `${f1(nv('irmao', 1000).dominanteHz)} Hz`);
conferir('sombrio: o filtro realça o grave (100 Hz sai mais alto que 1 kHz em pelo menos 5 dB)', ln('sombrio', 100) >= 5, `${f1(ln('sombrio', 100))} dB`);
conferir('irmão: o filtro realça o grave (100 Hz sai mais alto que 1 kHz em pelo menos 3 dB)', ln('irmao', 100) >= 3, `${f1(ln('irmao', 100))} dB`);
for (const nome of Object.keys(m.niveis)) {
  const todos = m.niveis[nome];
  conferir(`${nome}: nenhum tom sai mudo nem estourado (−40 a −3 dBFS na entrada de −14 dBFS)`, todos.every((l) => l.db > -40 && l.db < -3), todos.map((l) => f1(l.db)).join(' / '));
  conferir(`${nome}: o pico nunca passa de 1 (não estoura a gravação), seno e ruído a 0,9`, m.picos[nome].seno <= 1 && m.picos[nome].ruido <= 1, `seno ${m.picos[nome].seno.toFixed(3)}, ruído ${m.picos[nome].ruido.toFixed(3)}`);
  conferir(`${nome}: a voz atrasa menos de 80 ms (a narração não sai dessincronizada do vídeo)`, m.latencia[nome] < 0.08, `${(m.latencia[nome] * 1000).toFixed(1)} ms`);
  conferir(`${nome}: renderiza pelo menos 10x mais rápido que o tempo real (no máximo 10% de um núcleo; só durante a narração e o teste)`, m.velocidade[nome] >= 10, `${m.velocidade[nome].toFixed(0)}x`);
}
conferir('irmão: tem cauda de salão (energia acima de −50 dB em 0,6 a 1,0 s depois do fim)', m.caudas.irmao > -50, `${f1(m.caudas.irmao)} dB`);
conferir('irmão: a cauda é bem mais longa que a do sombrio (pelo menos 8 dB)', m.caudas.irmao - m.caudas.sombrio >= 8, `${f1(m.caudas.irmao - m.caudas.sombrio)} dB`);
conferir('locutor: sem reverberação (a cauda some, abaixo de −60 dB)', m.caudas.locutor < -60, `${f1(m.caudas.locutor)} dB`);
conferir('locutor: o eco de alto-falante está lá (autocorrelação no atraso de 42 ms bem acima dos vizinhos)', m.eco.noAtraso > 0.08 && m.eco.noAtraso > 4 * m.eco.vizinhoMaximo, `${m.eco.noAtraso.toFixed(3)} contra ${m.eco.vizinhoMaximo.toFixed(3)}`);

mkdirSync('.decepticons/medicoes', { recursive: true });
const dia = new Date().toISOString().slice(0, 10);
writeFileSync(`.decepticons/medicoes/efeitos-de-voz-${dia}.json`, JSON.stringify({ data: dia, medidas: m, verificacoes }, null, 1));
const falhas = verificacoes.filter((v) => !v.ok);
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : `\nTUDO CERTO: ${verificacoes.length} verificações`);
process.exitCode = falhas.length ? 1 : 0;
