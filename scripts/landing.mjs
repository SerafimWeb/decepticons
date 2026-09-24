/**
 * Landing do jogo (raiz do site, /cybermech/): para quem vai jogar. O que é, como está, o que tem,
 * controles, o compromisso "sem pay-to-win" e o que está sendo construído. Os bastidores (o case do
 * desenvolvimento) ficam em scripts/painel.mjs.
 *
 * Uso: node scripts/landing.mjs --out <.tmp/site/index.html>
 *      Lê o build do jogo em <pasta do out>/jogar/ (tamanho do download) e as capturas em
 *      <pasta do out>/capturas/ (se houver; sem elas a página sai sem imagens).
 *      SITE_URL (env) liga a prévia do link (og:image), que precisa de endereço absoluto.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { bundleSize, entregas, marcos, pledge, readRoadmap, recordSheet, roadmapStats, vitrine } from './site/dados.mjs';
import { brDate, esc, HEXGRID, inline, mb, pagina, topo, upper } from './site/tema.mjs';

const argv = process.argv.slice(2);
const OUT = resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : '.tmp/site/index.html');
const ROOT = dirname(OUT);
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/?$/, '/');

const roadmap = readRoadmap();
const stats = roadmapStats(roadmap);
const m = marcos();
const bundle = bundleSize(join(ROOT, 'jogar'));
const sheet = recordSheet();
const vows = pledge();
const features = vitrine();
const { prs } = entregas();

/** Capturas do jogo feitas pelo site.mjs --capturas (uma por câmera). O ?v= fura o cache a cada build. */
const SHOTS = [
  { file: 'capa.jpg', w: 1280, h: 720, alt: 'O Vector-09 de costas, em terceira pessoa, na arena neon, com o HUD de integridade das seis partes', label: 'terceira pessoa' },
  { file: 'primeira-pessoa.jpg', w: 1280, h: 720, alt: 'Cockpit em primeira pessoa trocando tiros de plasma com Mechs inimigos entre prédios neon', label: 'cockpit' },
  { file: 'tatica.jpg', w: 1280, h: 720, alt: 'Câmera tática vista de cima: o Mech do jogador entre barricadas', label: 'câmera tática' },
].filter((s) => existsSync(join(ROOT, 'capturas', s.file)));
const shotSrc = (s) => `capturas/${s.file}?v=${esc(m.head)}`;
const cover = SHOTS.find((s) => s.file === 'capa.jpg');

// ---------- blocos ----------

const facts = [
  'mouse e teclado',
  bundle ? `${mb(bundle.total)} para baixar` : null,
  'qualidade que se ajusta ao seu PC',
  'celular: controles de toque (em teste)',
].filter(Boolean);

const heroHtml = `<header class="hero${cover ? ' with-shot' : ''}">
    <div class="hero-copy">
      <p class="boot">&gt; shooter de mechs · direto no navegador · grátis<span class="cursor" aria-hidden="true">█</span></p>
      <h1 class="title">CYBER-MECH<span>PROTOCOL</span></h1>
      <p class="pitch">Pilote um Mech de combate numa arena neon e desmonte o inimigo peça por peça. Abriu o link, está jogando: sem instalar, sem conta e sem pay-to-win.</p>
      <div class="cta">
        <a class="play-btn" href="./jogar/">[ ENTRAR NO COCKPIT ]</a>
        <a class="link-btn" href="./bastidores/">como este jogo é feito →</a>
      </div>
      <ul class="facts">${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    </div>
    ${
      cover
        ? `<figure class="hero-shot frame">
      <img src="${shotSrc(cover)}" width="${cover.w}" height="${cover.h}" alt="${esc(cover.alt)}" fetchpriority="high">
      <figcaption>REC · captura automática do build de ${esc(brDate(m.headDate))}</figcaption>
    </figure>`
        : ''
    }
  </header>`;

const galleryShots = SHOTS.filter((s) => s !== cover);
const galleryHtml = galleryShots.length
  ? `<section aria-labelledby="combate">
    <span class="kicker">// imagens de combate</span>
    <h2 id="combate">Três câmeras, uma arena</h2>
    <p class="lede">Estas imagens não são montagem: a cada nova versão, o robô que publica o site entra no jogo, joga alguns segundos e fotografa. O que você vê aqui é o build que está no ar.</p>
    <div class="gallery">${galleryShots
      .map(
        (s) => `<figure class="shot frame"><img src="${shotSrc(s)}" width="${s.w}" height="${s.h}" alt="${esc(s.alt)}" loading="lazy"><figcaption>${esc(s.label)}</figcaption></figure>`,
      )
      .join('')}</div>
  </section>`
  : '';

const featuresHtml = features.length
  ? `<section aria-labelledby="arsenal">
    <span class="kicker">// o que já está no jogo</span>
    <h2 id="arsenal">O que você encontra</h2>
    <ol class="features">${features
      .map(
        (f, i) => `<li class="feature frame"><span class="fnum">${String(i + 1).padStart(2, '0')}</span><h3>${upper(f.title)}</h3><p>${inline(f.text)}</p></li>`,
      )
      .join('')}</ol>
  </section>`
  : '';

const maxArmor = sheet ? Math.max(...sheet.armor.map((a) => a[1])) : 1;
const sheetHtml = sheet
  ? `<section aria-labelledby="ficha" class="grid-2">
    <div class="stack">
      <span class="kicker">// ficha técnica · chassi em serviço</span>
      <h2 id="ficha">${esc(sheet.name)}</h2>
      <p class="lede">Seis partes, cada uma com a própria blindagem. Números lidos direto do código do jogo: mudou no jogo, muda aqui.</p>
    </div>
    <div class="sheet frame">
      <div class="armor">
        ${sheet.armor
          .map(
            ([label, hp]) =>
              `<div class="arow"><span>${label}</span><span class="abar"><i style="width:${Math.round((hp / maxArmor) * 100)}%"></i></span><b>${hp}</b></div>`,
          )
          .join('')}
      </div>
      <dl class="specs">
        <div><dt>MOVIMENTO</dt><dd>${sheet.speed} m/s</dd></div>
        <div><dt>DASH</dt><dd>${sheet.dash} m/s</dd></div>
        <div><dt>SALTOS</dt><dd>${sheet.jumps}× no ar</dd></div>
        <div><dt>ARMA</dt><dd>canhão de plasma · ${sheet.damage} de dano</dd></div>
        <div><dt>CADÊNCIA</dt><dd>${(1 / sheet.fire).toFixed(1).replace('.', ',')} tiros/s</dd></div>
      </dl>
    </div>
  </section>`
  : '';

const KEYS = [
  ['W A S D', 'mover'],
  ['MOUSE', 'mirar'],
  ['CLIQUE', 'atirar plasma'],
  ['SHIFT', 'dash'],
  ['ESPAÇO', 'pulo (duplo no ar)'],
  ['V', 'trocar câmera'],
  ['TAB', 'placar'],
  ['ESC', 'pausa e configurações'],
  ['F1', 'esconder o HUD'],
];
const keysHtml = `<section aria-labelledby="controles">
    <span class="kicker">// manual de campo</span>
    <h2 id="controles">Controles</h2>
    <p class="lede">As teclas se trocam nas configurações (Esc), e a mira se calibra pelo movimento real do seu mouse.</p>
    <dl class="keys">${KEYS.map(([k, v]) => `<div><dt><kbd>${esc(k)}</kbd></dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  </section>`;

const pledgeHtml = vows.length
  ? `<aside class="pledge frame" aria-labelledby="p2w">
    <span class="stamp" id="p2w">SEM PAY-TO-WIN</span>
    <ul>${vows.map((v) => `<li>${inline(v)}</li>`).join('')}</ul>
  </aside>`
  : '';

const { focus, next } = stats;
const building = focus.items.filter((i) => i.status !== 'done');
const recent = prs.slice(0, 5);
const buildHtml = `<section aria-labelledby="montagem">
    <span class="kicker">// linha de montagem</span>
    <h2 id="montagem">O que está sendo construído</h2>
    <p class="lede">O jogo ganha coisa nova quase todo dia. Cada entrega vai para o ar sozinha: é só recarregar.</p>
    <div class="grid-2 build">
      <div class="frame box">
        <div class="box-bar"><span>fase ${focus.num} · ${upper(focus.title)}</span><span>${focus.done}/${focus.items.length}</span></div>
        <div class="box-body">
          <div class="meter" role="img" aria-label="${focus.done} de ${focus.items.length} itens da fase feitos"><i style="width:${Math.round((focus.done / focus.items.length) * 100)}%"></i></div>
          <ul class="todo">${building.map((i) => `<li class="${i.status}"><span>${i.status === 'doing' ? '[>>]' : '[--]'}</span>${inline(i.text.replace(/\s*\([^)]*\)\s*$/, ''))}</li>`).join('')}</ul>
          ${next ? `<p class="then">depois: <b>fase ${next.num} · ${esc(next.title.toLowerCase())}</b></p>` : ''}
        </div>
      </div>
      <div class="frame box">
        <div class="box-bar"><span>últimas entregas</span><span>${esc(m.version ?? '')}</span></div>
        <ul class="box-body recent">${recent.map((p) => `<li><time datetime="${p.date}">${brDate(p.date)}</time><span>${esc(p.title)}</span></li>`).join('')}</ul>
      </div>
    </div>
    <p><a class="link-btn" href="./bastidores/">ver os bastidores: equipe, processo, diário e números →</a></p>
  </section>`;

const endHtml = `<section class="final frame" aria-labelledby="final">
    <h2 id="final">Cockpit liberado</h2>
    <p class="lede">A rodada dura cinco minutos. Três pilotos já estão na arena esperando você.</p>
    <a class="play-btn" href="./jogar/">[ ENTRAR NO COCKPIT ]</a>
  </section>`;

// ---------- página ----------

const css = `
  .hero { display: grid; gap: 28px; padding-top: 30px; align-items: center; }
  .hero.with-shot { grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); }
  .hero-copy { display: grid; gap: 18px; min-width: 0; }
  .pitch { font-size: 17px; line-height: 1.6; color: var(--text); max-width: 46ch; text-wrap: pretty; }
  .cta { display: flex; flex-wrap: wrap; gap: 14px 24px; align-items: center; }
  .facts { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 18px; color: var(--muted); font-size: 12.5px; letter-spacing: .1em; text-transform: uppercase; }
  .facts li::before { content: '▸ '; color: var(--amber); }
  .hero-shot, .shot { margin: 0; overflow: hidden; }
  .hero-shot img, .shot img { width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; }
  .hero-shot figcaption, .shot figcaption {
    position: absolute; left: 0; bottom: 0; padding: 4px 10px; background: rgba(7,6,4,.82);
    font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--muted);
  }
  .hero-shot figcaption::before { content: '● '; color: var(--red); }
  .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }

  .features { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; counter-reset: f; }
  .feature { padding: 16px 16px 18px; display: grid; gap: 8px; align-content: start; }
  .fnum { font: 400 1rem/1 var(--fd); color: var(--bg); background: var(--amber); justify-self: start; padding: 3px 6px 1px; letter-spacing: .08em; }
  .feature p { color: var(--muted); font-size: 14px; line-height: 1.5; }

  .grid-2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); align-items: start; gap: 22px; }
  .stack { display: grid; gap: 14px; }
  .sheet { padding: 18px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 22px; }
  .armor { display: grid; gap: 8px; }
  .arow { display: grid; grid-template-columns: 70px 1fr 42px; gap: 10px; align-items: center; font-size: 13px; letter-spacing: .08em; color: var(--muted); }
  .arow b { font: 400 1.35rem/1 var(--fd); text-align: right; }
  .abar { height: 10px; border: 1px solid var(--line2); }
  .abar i { display: block; height: 100%; background: repeating-linear-gradient(90deg, var(--green) 0 6px, transparent 6px 8px); }
  .specs { margin: 0; display: grid; gap: 10px; align-content: start; }
  .specs div { display: grid; gap: 2px; }
  .specs dt { font-size: 11px; letter-spacing: .2em; color: var(--muted); }
  .specs dd { margin: 0; font: 400 1.35rem/1.1 var(--fd); color: var(--amber); }

  .keys { margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
  .keys div { display: flex; gap: 12px; align-items: center; padding: 10px 12px; border: 1px solid var(--line); background: var(--panel); }
  .keys dt { flex: none; }
  .keys dd { margin: 0; color: var(--text); font-size: 14px; }
  kbd { font: 400 1.15rem/1 var(--fd); color: var(--amber); border: 1px solid var(--line2); border-bottom-width: 3px; padding: 4px 8px 2px; background: var(--panel2); letter-spacing: .06em; white-space: nowrap; }

  .pledge { padding: 22px 22px 18px; display: grid; gap: 14px; }
  .pledge::before { --c: var(--red); }
  .stamp {
    justify-self: start; font: 400 clamp(1.6rem, 3.4vw, 2.4rem)/1 var(--fs); letter-spacing: .08em; color: var(--red);
    border: 3px double var(--red); padding: 8px 14px 6px; transform: rotate(-3deg); opacity: .92;
    text-shadow: 0 0 10px rgba(255,90,60,.35);
  }
  .pledge ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; color: var(--text); font-size: 14px; }
  .pledge li::marker { content: '> '; color: var(--red); }

  .build { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .box-bar { display: flex; justify-content: space-between; gap: 12px; padding: 8px 14px; border-bottom: 1px solid var(--line); font-size: 11.5px; letter-spacing: .2em; color: var(--muted); text-transform: uppercase; }
  .box-body { padding: 14px 16px 16px; display: grid; gap: 12px; margin: 0; }
  .meter { height: 10px; border: 1px solid var(--line2); }
  .meter i { display: block; height: 100%; background: var(--green); box-shadow: 0 0 6px rgba(125,255,114,.4); }
  .todo, .recent { list-style: none; padding: 0; display: grid; gap: 7px; font-size: 13.5px; line-height: 1.45; }
  .todo li { display: grid; grid-template-columns: 38px 1fr; gap: 8px; }
  .todo li span { color: var(--text); } .todo li.doing span { color: var(--amber); }
  .then { color: var(--muted); font-size: 13px; }
  .recent li { display: grid; grid-template-columns: 48px 1fr; gap: 10px; }
  .recent time { color: var(--faint); font-variant-numeric: tabular-nums; }

  .final { padding: 32px 24px; justify-items: center; text-align: center; background: url("data:image/svg+xml,${HEXGRID}") center / 56px 97px, var(--panel); }

  @media (max-width: 900px) {
    .hero.with-shot, .grid-2, .build, .sheet { grid-template-columns: 1fr; }
    .hero-shot { order: -1; }
  }
`;

const body = `
  ${topo({ base: './', current: 'jogo', left: `CYBER-MECH PROTOCOL // ${esc(m.version ?? 'protótipo')}`, live: `build de hoje · ${esc(m.head)}` })}
  ${heroHtml}
  ${galleryHtml}
  ${featuresHtml}
  ${sheetHtml}
  ${keysHtml}
  ${pledgeHtml}
  ${buildHtml}
  ${endHtml}
  <footer><span>Cyber-Mech Protocol · feito por Dan e uma equipe de IAs</span><span>build ${esc(m.head)} · ${esc(m.generated)} BRT</span></footer>
`;

const description = 'Shooter de Mechs direto no navegador: desmonte o inimigo peça por peça numa arena neon. Grátis, sem instalar e sem pay-to-win.';
const html = pagina({
  title: 'Cyber-Mech Protocol',
  description,
  css,
  body,
  og: SITE_URL !== '/' ? { url: SITE_URL, image: cover ? `${SITE_URL}${shotSrc(cover)}` : null } : null,
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`landing ${OUT} (${features.length} destaques, ${SHOTS.length} capturas${bundle ? `, download ${mb(bundle.total)}` : ''})`);
