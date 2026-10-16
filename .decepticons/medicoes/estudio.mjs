/**
 * Prova o Estúdio (P150, P155) de ponta a ponta num Chrome de verdade: abre a página, corta na onda, liga efeitos, ouve a prévia (o servidor roda o ffmpeg),
 * IMPORTA um arquivo novo (que tem de virar clipe registrado e processado), atribui o clipe a uma arma e salva. Tudo numa CÓPIA dos arquivos do estúdio em
 * `.tmp/` (o repositório não é tocado). Sai com código 1 se algo falhar ou se a página der erro.
 *
 *   node .decepticons/medicoes/estudio.mjs                       # usa as referências de .tmp/SOUNDS/ARMAS
 *   node .decepticons/medicoes/estudio.mjs --origem <pasta>      # outra pasta de referências
 *   node .decepticons/medicoes/estudio.mjs --foto estudio.png    # onde salvar a captura (padrão: .tmp/estudio-e2e.png)
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { criarEstudio } from '../../scripts/estudio.mjs';
import { acharFfmpeg } from '../../scripts/sonsRodar.mjs';

const args = process.argv.slice(2);
const valor = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const origemReal = resolve(valor('origem', '.tmp/SOUNDS/ARMAS'));
const foto = resolve(valor('foto', '.tmp/estudio-e2e.png'));
const { chromium } = await import('playwright-core');

const falhas = [];
const confere = (ok, texto) => { console.log(`${ok ? '✓' : '✗'} ${texto}`); if (!ok) falhas.push(texto); };

mkdirSync(resolve('.tmp'), { recursive: true });
const raiz = mkdtempSync(join(resolve('.tmp'), 'e2e-estudio-'));
for (const rel of ['scripts/sons-armas.json', 'client/src/audio/armasSom.json', 'scripts/estudio/armas-info.json', 'scripts/estudio/index.html', 'scripts/estudio/estudio.css', 'scripts/estudio/nucleo.js', 'scripts/estudio/sons.js']) {
  mkdirSync(join(raiz, rel, '..'), { recursive: true });
  copyFileSync(resolve(rel), join(raiz, rel));
}
if (!existsSync(origemReal)) throw new Error(`a pasta de referências não existe: ${origemReal}`);
// A bancada trabalha numa CÓPIA das referências: importar um arquivo de teste nunca pode sujar a pasta de verdade.
const origem = join(raiz, 'referencias');
mkdirSync(origem, { recursive: true });
for (const a of readdirSync(origemReal)) if (/.(mp3|wav|ogg|m4a|flac|aac|webm)$/i.test(a)) copyFileSync(join(origemReal, a), join(origem, a));
const ffmpeg = acharFfmpeg();
const servidor = criarEstudio({ raiz, origem, ffmpeg });
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${servidor.address().port}/`;

// um WAV novo (senoide que decai) para importar, escrito na pasta do teste
function wav(seg) {
  const taxa = 22050, n = Math.round(taxa * seg), d = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) d.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / taxa) * 18000 * Math.exp(-i / (taxa * 0.4))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(taxa, 24); h.writeUInt32LE(taxa * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(d.length, 40);
  return Buffer.concat([h, d]);
}
const novo = join(raiz, 'meu som novo.wav');
writeFileSync(novo, wav(1.2));

let navegador;
for (const channel of ['chrome', 'msedge', undefined]) {
  try { navegador = await chromium.launch({ channel, args: ['--autoplay-policy=no-user-gesture-required'] }); break; } catch { /* próximo */ }
}
const ctx = await navegador.newContext({ viewport: { width: 1280, height: 1000 } });
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text().slice(0, 160)); });
p.on('dialog', async (d) => { erros.push('dialog: ' + d.message().slice(0, 100)); await d.dismiss(); });
await p.goto(url);
await p.waitForSelector('#lista-clipes li');
await p.waitForTimeout(1500);

const conta = () => p.evaluate(() => ({
  fontes: document.querySelectorAll('#lista-fontes li').length,
  clipes: document.querySelectorAll('#lista-clipes li').length,
  armas: document.querySelectorAll('#tabela-armas tr').length,
  de: document.querySelector('#de').value, ate: document.querySelector('#ate').value,
  nomeClipe: document.querySelector('#nome-clipe').value,
}));
const ao = await conta();
const armasDoJogo = JSON.parse(readFileSync(resolve('scripts/estudio/armas-info.json'), 'utf8')).armas.length;
confere(ao.fontes >= 6 && ao.clipes >= 6 && ao.armas === armasDoJogo, `ao abrir: ${ao.fontes} referências, ${ao.clipes} clipes, ${ao.armas} armas (o jogo tem ${armasDoJogo})`);
confere(await p.locator('#abas button').count() === 3, 'as três abas (sons, tiros e armas, mechs) aparecem');

// as abas "em breve" abrem e voltam
await p.click('#abas button[data-aba="tiros"]');
confere(await p.locator('#aba-tiros').isVisible() && !(await p.locator('#aba-sons').isVisible()), 'a aba "tiros e armas" abre e esconde a de sons');
await p.click('#abas button[data-aba="sons"]');

// a onda foi desenhada e o arrasto muda o trecho
const verdes = await p.evaluate(() => { const c = document.querySelector('#onda'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 120 && d[i] < 100 && d[i + 2] < 140) n++; return n; });
confere(verdes > 2000, `a onda foi desenhada (${verdes} pixels)`);
const caixa = await p.locator('#onda').boundingBox();
await p.mouse.move(caixa.x + caixa.width * 0.05, caixa.y + 60);
await p.mouse.down();
await p.mouse.move(caixa.x + caixa.width * 0.55, caixa.y + 60, { steps: 12 });
await p.mouse.up();
const apos = await conta();
confere(Number(apos.ate) > Number(apos.de) && (Number(apos.de) !== Number(ao.de) || Number(apos.ate) !== Number(ao.ate)), `arrastar na onda muda o trecho: ${apos.de} a ${apos.ate} s`);

// efeitos: velocidade 2 encurta, tom e compressor ligam; o resumo acompanha
await p.click('#painel-efeitos summary');
await p.fill('#ef-velocidade', '2'); await p.dispatchEvent('#ef-velocidade', 'change');
await p.fill('#ef-pitch', '-3'); await p.dispatchEvent('#ef-pitch', 'change');
await p.selectOption('#ef-compressor', 'forte');
await p.fill('#ef-eco-ms', '80'); await p.dispatchEvent('#ef-eco-ms', 'change');
const resumo = await p.locator('#resumo-efeitos').textContent();
confere(/×2/.test(resumo) && /tom -3/.test(resumo) && /comp\. forte/.test(resumo) && /eco/.test(resumo), `o resumo dos efeitos acompanha: ${resumo.trim()}`);
const alvo = Number(await p.inputValue('#ef-alvo'));
confere(Math.abs(alvo - (Number(apos.ate) - Number(apos.de)) / 2) < 0.02, `a duração-alvo acompanha a velocidade (${alvo} s)`);

// a prévia: o servidor roda o ffmpeg e a página mostra o resultado
await p.click('#btn-previa');
await p.waitForFunction(() => document.querySelector('#resultado').textContent.includes('prévia:'), null, { timeout: 60000 });
const previa = await p.locator('#resultado').textContent();
const duracaoPrevia = Number(/prévia: ([\d.]+) s/.exec(previa)?.[1]);
confere(Math.abs(duracaoPrevia - (Number(apos.ate) - Number(apos.de)) / 2) < 0.03, `a prévia tem a duração depois da velocidade: ${previa.trim()}`);
confere(await p.locator('#onda-resultado').isVisible(), 'a forma de onda do resultado aparece');

// salvar o corte com efeitos num clipe novo e processar
await p.fill('#nome-clipe', 'arma_teste_efeitos');
await p.click('#btn-salvar-corte');
await p.click('#btn-processar');
await p.waitForFunction(() => [...document.querySelectorAll('#mensagens li')].some((li) => li.textContent.includes('arma_teste_efeitos.mp3:') && li.textContent.includes('efeitos:')), null, { timeout: 60000 });
confere(existsSync(join(raiz, 'client/public/audio/armas/arma_teste_efeitos.mp3')), 'o clipe com efeitos foi processado e o mp3 existe');
const gravado = JSON.parse(readFileSync(join(raiz, 'scripts/sons-armas.json'), 'utf8')).sons.find((s) => s.destino === 'arma_teste_efeitos.mp3');
confere(gravado?.efeitos?.velocidade === 2 && gravado?.efeitos?.pitch_st === -3 && gravado?.efeitos?.compressor === 'forte', `os efeitos foram gravados no mapa: ${JSON.stringify(gravado?.efeitos)}`);

// IMPORTAR um arquivo novo: vira clipe registrado, processado, aberto na tela
const antes = (await conta()).clipes;
await p.setInputFiles('#arquivo', novo);
await p.waitForFunction(() => [...document.querySelectorAll('#mensagens li')].some((li) => li.textContent.includes('Importado e registrado')), null, { timeout: 60000 });
await p.waitForFunction(() => document.querySelector('#nome-clipe').value === 'arma_meu_som_novo', null, { timeout: 30000 }).catch(() => {}); // a página abre o clipe novo logo depois da mensagem
const depois = await conta();
confere(depois.clipes === antes + 1, `o arquivo importado virou um clipe novo (${antes} → ${depois.clipes})`);
confere(depois.nomeClipe === 'arma_meu_som_novo', `o clipe novo tem nome próprio e já está aberto: ${depois.nomeClipe}`);
confere(existsSync(join(raiz, 'client/public/audio/armas/arma_meu_som_novo.mp3')), 'o mp3 do clipe importado já existe (processado)');
const noMapa = JSON.parse(readFileSync(join(raiz, 'scripts/sons-armas.json'), 'utf8')).sons.some((s) => s.destino === 'arma_meu_som_novo.mp3');
confere(noMapa, 'o clipe importado está registrado no mapa de sons');

// atribuir o clipe novo à rotatória e SALVAR TUDO
const linha = p.locator('#tabela-armas tr', { hasText: 'Metralhadora rotatória' });
await linha.locator('select').selectOption('arma_meu_som_novo');
await p.click('#btn-salvar');
await p.waitForFunction(() => [...document.querySelectorAll('#mensagens li')].some((li) => li.textContent.startsWith('Salvo:')), null, { timeout: 30000 });
const armas = JSON.parse(readFileSync(join(raiz, 'client/src/audio/armasSom.json'), 'utf8')).armas;
confere(armas.rotary?.clipe === 'arma_meu_som_novo', `a rotatória usa o clipe importado na tabela salva: ${JSON.stringify(armas.rotary)}`);
confere(await p.locator('#tabela-armas tr', { hasText: 'Lança-chamas' }).locator('select').isDisabled(), 'o lança-chamas não aceita amostra');

// ouvir no ritmo e parar (não pode dar erro)
await linha.locator('button', { hasText: '▶▶' }).click();
await p.waitForTimeout(500);
await p.click('#btn-parar');
await p.screenshot({ path: foto, fullPage: true });
confere(erros.length === 0, erros.length ? `erros da página: ${erros.join(' | ')}` : 'nenhum erro na página');
console.log(`captura: ${foto}`);
await navegador.close();
await new Promise((ok) => servidor.close(ok));
console.log(falhas.length ? `\n${falhas.length} verificação(ões) falharam` : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
