/**
 * Landing do jogo (raiz do site, /cybermech/): para quem vai jogar. O que é, como está, o que tem,
 * controles, o compromisso "sem pay-to-win" e o que está sendo construído. A sala de controle (o case do
 * desenvolvimento) ficam em scripts/painel.mjs.
 *
 * Uso: node scripts/landing.mjs --out <.tmp/site/index.html>
 *      Lê o build do jogo em <pasta do out>/jogar/ (tamanho do download) e as capturas em
 *      <pasta do out>/capturas/ (se houver; sem elas a página sai sem imagens).
 *      SITE_URL (env) liga a prévia do link (og:image), que precisa de endereço absoluto.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { arsenal, atividade, bundleSize, entregas, horizonte, jogo, marcos, pledge, readRoadmap, recordSheet, roadmapStats, vitrine } from './site/dados.mjs';
import { brDate, esc, HEXGRID, inline, mb, pagina, topo, upper } from './site/tema.mjs';

const argv = process.argv.slice(2);
const OUT = resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : '.tmp/site/index.html');
const ROOT = dirname(OUT);
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/?$/, '/');

const roadmap = readRoadmap();
const stats = roadmapStats(roadmap);
const m = marcos();
const bundle = bundleSize(join(ROOT, 'jogar'));
const game = await jogo();
const sheet = recordSheet(game);
const arms = arsenal(game);
const vows = pledge();
const features = vitrine();
const futureIdeas = horizonte();
const { prs } = entregas();
const act = atividade(prs);

/** Capturas do jogo feitas pelo site.mjs --capturas (uma por câmera). O ?v= fura o cache a cada build. */
const SHOTS = [
  { file: 'capa.jpg', w: 1280, h: 720, alt: 'O Vector-09 de costas, em terceira pessoa, na arena industrial, com o HUD de integridade das seis partes', label: 'terceira pessoa' },
  { file: 'primeira-pessoa.jpg', w: 1280, h: 720, alt: 'Cockpit em primeira pessoa trocando tiros de plasma com Mechs inimigos entre prédios de aço', label: 'cockpit' },
  { file: 'tatica.jpg', w: 1280, h: 720, alt: 'Câmera tática vista de cima: o Mech do jogador entre barricadas', label: 'câmera tática' },
].filter((s) => existsSync(join(ROOT, 'capturas', s.file)));
const shotSrc = (s) => `capturas/${s.file}?v=${esc(m.head)}`;
const cover = SHOTS.find((s) => s.file === 'capa.jpg');

// ---------- blocos ----------

/**
 * Abertura da marca (dono, 25/09): chuva de pontos verdes em matriz e o emblema da SERAFIM WEB por
 * ~2 s, como as vinhetas de console. Uma vez por sessão, pula com clique, toque ou tecla, e não roda
 * com "reduzir movimento". Sem JavaScript, fica escondida. As imagens são as do jogo (jogar/brand/) e
 * só baixam quando a abertura roda. Custo: um canvas 2D de ~2 s, ~150 pontos por quadro; depois sai do DOM.
 */
const BRAND = existsSync(join(ROOT, 'jogar', 'brand', 'serafim-web.webp'));
const INTRO_JS = `(() => {
  const el = document.getElementById('intro');
  let seen = false;
  try { seen = sessionStorage.getItem('cybermech.intro') === '1'; sessionStorage.setItem('cybermech.intro', '1'); } catch (e) {}
  if (seen || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.remove(); return; }
  for (const img of el.querySelectorAll('img[data-src]')) img.src = img.dataset.src;
  el.hidden = false;
  const cv = el.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = (cv.width = Math.round(innerWidth * dpr));
  const H = (cv.height = Math.round(innerHeight * dpr));
  const cell = 13 * dpr;
  const cols = Math.ceil(W / cell);
  const y = new Float32Array(cols);
  const v = new Float32Array(cols);
  for (let i = 0; i < cols; i++) { y[i] = (Math.random() - 0.75) * H; v[i] = ((0.6 + Math.random()) * H) / 1000; }
  let last = performance.now();
  let raf = 0;
  const draw = (now) => {
    const dt = Math.min(now - last, 50);
    last = now;
    ctx.fillStyle = 'rgba(0,0,0,' + (1 - Math.pow(0.85, dt / 16.7)).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < cols; i++) {
      y[i] += v[i] * dt;
      if (y[i] > H + cell) y[i] = -Math.random() * H * 0.5;
      const cy = Math.floor(y[i] / cell) * cell + cell / 2;
      ctx.fillStyle = i % 7 === 3 ? '#27f0ff' : '#39ff6a';
      ctx.beginPath();
      ctx.arc(i * cell + cell / 2, cy - cell, 1.5 * dpr, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = '#e4ffe9';
      ctx.beginPath();
      ctx.arc(i * cell + cell / 2, cy, 1.9 * dpr, 0, 6.2832);
      ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  const SKIP = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    el.classList.add('out');
    for (const t of SKIP) removeEventListener(t, end, true);
    setTimeout(() => { cancelAnimationFrame(raf); el.remove(); }, 350);
  };
  for (const t of SKIP) addEventListener(t, end, { capture: true, passive: true });
  setTimeout(end, 1900);
})();`;
const introHtml = BRAND
  ? `<div id="intro" hidden aria-hidden="true">
    <canvas></canvas>
    <div class="in-mark">
      <img class="in-emblem" data-src="jogar/brand/serafim-emblem.webp" width="240" height="240" alt="">
      <img class="in-word" data-src="jogar/brand/serafim-web.webp" width="1100" height="251" alt="">
      <span class="in-tag">apresenta</span>
    </div>
    <span class="in-skip">pular ▸</span>
  </div>
  <script>${INTRO_JS}</script>`
  : '';

const facts = [
  'mouse e teclado',
  bundle ? `${mb(bundle.total)} para baixar` : null,
  'qualidade que se ajusta ao seu PC',
  'celular: controles de toque (em teste)',
].filter(Boolean);

// Servidor público do multiplayer (variável GAME_SERVER_URL do GitHub, a mesma que o jogo recebe no build).
const ONLINE = Boolean(process.env.VITE_GAME_SERVER?.trim());

/**
 * Status do servidor na própria landing (dono, 28/09: "tem como deixarmos na página, permanentemente, a info
 * se o servidor está online, quantas pessoas jogando?"). O endereço, o caminho e o intervalo vêm do contrato
 * do jogo (`shared/net/status.ts`, via dados.mjs): o texto é o da landing, os números são do servidor.
 *
 * Custo para quem abre a página: um GET de ~350 bytes ao abrir e outro a cada 20 s, só com a aba na frente.
 * Falhou (servidor desligado, túnel fora do ar, sem rede)? A linha diz "fora do ar" e o botão de jogar
 * offline continua exatamente como estava.
 */
const STATUS_URL = game?.net?.statusUrl ?? null;
const STATUS_POLL_S = game?.net?.statusPollS ?? 20;
const STATUS_JS = `(() => {
  const el = document.getElementById('srv');
  const label = el.querySelector('span');
  const online = document.querySelector('.play-btn.online');
  const baseLabel = online ? online.textContent : '';
  const paint = (cls, text) => { el.className = 'srv ' + cls; label.textContent = text; };
  const ask = async () => {
    if (document.visibilityState === 'hidden') return;
    try {
      const res = await fetch(${JSON.stringify(STATUS_URL ?? '')}, { cache: 'no-store', credentials: 'omit' });
      if (!res.ok) throw new Error('http ' + res.status);
      // Servidor de pé que ainda não conhece /status (versão anterior a 28/09) responde texto: online sem contagem.
      let n = null;
      try { const s = await res.json(); if (Number.isFinite(s.players) && s.players >= 0) n = s.players; } catch (e) {}
      if (n === null) paint('vazio', 'SERVIDOR ONLINE · SEM CONTAGEM DE PILOTOS');
      else if (n > 0) paint('on', n === 1 ? '1 PILOTO EM COMBATE AGORA' : n + ' PILOTOS EM COMBATE AGORA');
      else paint('vazio', 'SERVIDOR ONLINE · ARENA VAZIA · SEJA O PRIMEIRO');
      if (online) online.textContent = n ? '[ JOGAR ONLINE · ' + n + ' AGORA ]' : baseLabel;
    } catch (e) {
      paint('off', 'SERVIDOR FORA DO AR · O JOGO OFFLINE CONTINUA VALENDO');
      if (online) online.textContent = baseLabel;
    }
  };
  document.addEventListener('visibilitychange', ask);
  ask();
  setInterval(ask, ${STATUS_POLL_S * 1000});
})();`;
const statusHtml = STATUS_URL
  ? `<p class="srv" id="srv"><i class="dot"></i><span>PROCURANDO O SERVIDOR…</span></p>
      <script>${STATUS_JS}</script>`
  : '';

/**
 * Métricas de produto (dono, 28/09: "quero trackear o consumo, quantas pessoas clicaram, onde clicam, onde
 * saem, se jogaram tantas partidas"). Contrato em `shared/net/telemetry.ts`: lista fechada de eventos, sem
 * cookie e sem id persistente — um id sorteado só para esta visita, nunca gravado. Sem servidor de jogo
 * configurado, `EVENTO_URL` é null e este script nem entra na página.
 */
const EVENTO_URL = game?.net?.eventoUrl ?? null;
const EVENTO_JS = `(() => {
  const url = ${JSON.stringify(EVENTO_URL ?? '')};
  const aba = Math.random().toString(36).slice(2, 18) + Math.random().toString(36).slice(2, 10);
  const mandar = (nome) => {
    try {
      const corpo = JSON.stringify({ nome, aba });
      if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([corpo], { type: 'text/plain' }));
      else fetch(url, { method: 'POST', body: corpo, headers: { 'content-type': 'application/json' }, keepalive: true, mode: 'cors' }).catch(() => {});
    } catch (e) {}
  };
  mandar('landing_view');
  for (const el of document.querySelectorAll('[data-evento]')) {
    el.addEventListener('click', () => mandar(el.dataset.evento), { capture: true });
  }
})();`;
const eventoHtml = EVENTO_URL ? `<script>${EVENTO_JS}</script>` : '';

const heroHtml = `<header class="hero${cover ? ' with-shot' : ''}">
    <div class="hero-copy">
      <p class="presents">SERAFIM WEB apresenta</p>
      <p class="boot">&gt; shooter de mechs · direto no navegador · grátis<span class="cursor" aria-hidden="true">█</span></p>
      <h1 class="title">CYBER<span>MECH</span></h1>
      <p class="pitch">Pilote um Mech de combate numa arena industrial e desmonte o inimigo peça por peça. Abriu o link, está jogando: sem instalar, sem conta e sem pay-to-win.</p>
      <div class="cta">
        ${ONLINE ? `<a class="play-btn" href="./jogar/?sala=ARENA" data-evento="click_online">[ JOGAR ONLINE ]</a><div class="cta-online">${statusHtml}</div>` : `<a class="play-btn" href="./jogar/" data-evento="click_cockpit">[ ENTRAR NO COCKPIT ]</a>${statusHtml}`}
        <a class="link-btn cta-more" href="./sala-de-controle/" data-evento="click_como_e_feito">como este jogo é feito →</a>
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
/*
 * Carrossel, não grade fixa (dono, 29/09: "seria bom que essas fotos fiquem girando num carrossel pra
 * nao ficarem se repetindo"): troca sozinha a cada 4,5 s, pausa se o dedo/mouse estiver em cima, respeita
 * "menos movimento" do sistema. Com 1 imagem só, os pontos somem e nada gira (nada a girar).
 */
const CAROUSEL_JS = `(() => {
  const root = document.querySelector('.carousel');
  if (!root) return;
  const track = root.querySelector('.carousel-track');
  const frames = [...track.children];
  const dots = [...root.querySelectorAll('.carousel-dots button')];
  if (frames.length < 2) return;
  let i = 0, timer = null;
  const show = (n) => {
    i = (n + frames.length) % frames.length;
    frames.forEach((f, k) => f.classList.toggle('on', k === i));
    dots.forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false'));
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const restart = () => {
    clearInterval(timer);
    if (!reduced) timer = setInterval(() => show(i + 1), 4500);
  };
  dots.forEach((d, k) => d.addEventListener('click', () => { show(k); restart(); }));
  root.addEventListener('mouseenter', () => clearInterval(timer));
  root.addEventListener('mouseleave', restart);
  show(0);
  restart();
})();`;
const galleryHtml = galleryShots.length
  ? `<section aria-labelledby="combate">
    <span class="kicker">// imagens de combate</span>
    <h2 id="combate">Três câmeras, uma arena</h2>
    <p class="lede">Estas imagens não são montagem: a cada nova versão, o robô que publica o site entra no jogo, joga alguns segundos e fotografa. O que você vê aqui é o build que está no ar.</p>
    <div class="carousel">
      <div class="carousel-track">${galleryShots
        .map(
          (s, i) => `<figure class="shot frame${i === 0 ? ' on' : ''}"><img src="${shotSrc(s)}" width="${s.w}" height="${s.h}" alt="${esc(s.alt)}" loading="lazy"><figcaption>${esc(s.label)}</figcaption></figure>`,
        )
        .join('')}</div>
      ${galleryShots.length > 1 ? `<div class="carousel-dots">${galleryShots.map((s, i) => `<button type="button" aria-label="${esc(s.label)}" aria-current="${i === 0 ? 'true' : 'false'}"></button>`).join('')}</div>` : ''}
    </div>
    <script>${CAROUSEL_JS}</script>
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

const horizonHtml = futureIdeas.length
  ? `<section aria-labelledby="horizonte">
    <span class="kicker">// ideias em estudo · sem data prometida</span>
    <h2 id="horizonte">O que estamos explorando</h2>
    <p class="lede">Direções futuras sob avaliação. Sem promessa de data.</p>
    <ol class="features">${futureIdeas
      .map((idea, i) => `<li class="feature frame"><span class="fnum">${String(i + 1).padStart(2, '0')}</span><h3>${upper(idea.title)}</h3><p>${inline(idea.text)}</p></li>`)
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
        <div><dt>ARMA</dt><dd>${esc(sheet.primary.toLowerCase())} · ${sheet.damage} de dano</dd></div>
        ${sheet.secondary ? `<div><dt>BRAÇO ESQUERDO</dt><dd>${esc(sheet.secondary.toLowerCase())}</dd></div>` : ''}
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

// Hangar (em projeto): planta com os encaixes, o arsenal nos três níveis e as metas de equilíbrio.
// Tudo o que é número vem do código do jogo (dados.mjs → jogo()). O plano de construção do Hangar
// (`GAME_DESIGN.md`, seção HANGAR) não se repete aqui: os quatro primeiros itens dele já aparecem na
// planta e no arsenal, e o roadmap fica na sala de controle.
const num = (x, d = 0) => x.toFixed(d).replace('.', ',');
const pct = (x) => `${Math.round(x * 100)}%`;
const tons = (x) => `${String(x).replace('.', ',')} t`;

/** Planta do Vector-09 de frente (a direita dele fica à esquerda de quem olha); números = legenda. */
const BLUEPRINT = `<svg class="bp" viewBox="0 0 300 312" role="img" aria-label="Planta do Mech com seis encaixes numerados: braço direito, braço esquerdo, torso, ombros, cabeça e pernas">
      <rect class="plan" x="62" y="68" width="30" height="26"/><rect class="plan" x="208" y="68" width="30" height="26"/>
      <rect x="128" y="30" width="44" height="34"/><rect class="visor" x="136" y="44" width="28" height="5"/>
      <rect x="90" y="70" width="120" height="94"/><rect class="visor" x="112" y="92" width="76" height="5"/>
      <rect x="58" y="98" width="30" height="74"/><rect x="64" y="172" width="18" height="48"/><rect class="visor" x="66" y="216" width="14" height="4"/>
      <rect x="212" y="98" width="30" height="62"/><rect x="204" y="148" width="44" height="42"/>
      <circle cx="216" cy="160" r="5"/><circle cx="236" cy="160" r="5"/><circle cx="216" cy="178" r="5"/><circle cx="236" cy="178" r="5"/>
      <rect x="110" y="166" width="80" height="22"/>
      <rect x="112" y="190" width="30" height="100"/><rect x="158" y="190" width="30" height="100"/>
      <rect x="104" y="290" width="44" height="10"/><rect x="152" y="290" width="44" height="10"/>
      <g class="n"><circle cx="73" cy="126" r="11"/><text x="73" y="126">1</text></g>
      <g class="n"><circle cx="227" cy="122" r="11"/><text x="227" y="122">2</text></g>
      <g class="n"><circle cx="150" cy="130" r="11"/><text x="150" y="130">3</text></g>
      <g class="n"><circle cx="77" cy="81" r="11"/><text x="77" y="81">4</text></g>
      <g class="n"><circle cx="223" cy="81" r="11"/><text x="223" y="81">4</text></g>
      <g class="n"><circle cx="150" cy="15" r="11"/><text x="150" y="15">5</text></g>
      <g class="n"><circle cx="127" cy="240" r="11"/><text x="127" y="240">6</text></g>
      <g class="n"><circle cx="173" cy="240" r="11"/><text x="173" y="240">6</text></g>
    </svg>`;

function wpnRows(w) {
  const head =
    w.kind === 'energy'
      ? [
          ['DANO/TIRO', (t) => t.damage],
          ['CADÊNCIA', (t) => `${num(t.rate, 1)}/s`],
          ['CALOR/TIRO', (t) => pct(t.heat)],
        ]
      : [
          ['DANO NO CENTRO', (t) => t.damage],
          ['RECARGA', (t) => `${num(t.reload, 1)} s`],
          ['CALOR/DISPARO', (t) => pct(t.heat)],
        ];
  return [
    ...head,
    ['DANO/S', (t) => num(t.dps)],
    ['DERRUBA EM', (t) => `${num(t.ttk, 1)} s`, 'key'],
    ['CARGA', (t) => tons(t.mass)],
  ];
}

function wpnCard(w, i) {
  const note =
    w.kind === 'energy'
      ? `dano cheio até ${w.optimal} m, cai até ${pct(w.minFactor)} a ${w.max} m, onde o projétil se desfaz · ${w.speed} m/s`
      : `${w.magazine} no carregador · explosão de ${num(w.blast)} m, o dano cai até zero na borda · ${w.speed} m/s: de longe, dá para desviar`;
  return `<article class="wpn frame">
        <header class="wpn-bar"><span class="wpn-id">WPN-0${i + 1}</span><h3>${upper(w.name)}</h3><span class="wpn-kind">${w.kind === 'energy' ? 'energia' : 'munição'} · ${esc(w.slot)}</span></header>
        <div class="wpn-scroll"><table class="wpn-table">
          <thead><tr><th scope="col"><span class="sr">atributo</span></th>${w.tiers.map((t, k) => `<th scope="col">${t.label}${k === 0 ? '<small>no jogo</small>' : ''}</th>`).join('')}</tr></thead>
          <tbody>${wpnRows(w)
            .map(([label, f, cls]) => `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${label}</th>${w.tiers.map((t) => `<td>${f(t)}</td>`).join('')}</tr>`)
            .join('')}</tbody>
        </table></div>
        <p class="wpn-note">${note}</p>
      </article>`;
}

let hangarHtml = '';
if (arms && sheet) {
  const single = Math.min(...arms.weapons.flatMap((w) => w.tiers.map((t) => t.ttk)));
  const combo = Math.min(...arms.combo.map((c) => c.ttk));
  const energy = arms.weapons.find((w) => w.kind === 'energy');
  const gain = Math.round((1 - energy.tiers[2].ttk / energy.tiers[0].ttk) * 100);
  const perTon = energy.tiers.map((t) => t.dps / t.mass);
  const load = arms.weapons.reduce((sum, w) => sum + w.tiers[0].mass, 0);
  const [a0, a1] = arms.weapons;
  const legend = [
    ['BRAÇO D · ENERGIA', `${a0.name} MK I · ${tons(a0.tiers[0].mass)}`],
    ['BRAÇO E · MUNIÇÃO', `${a1.name} MK I · ${tons(a1.tiers[0].mass)}`],
    ['TORSO · DISSIPADOR', `um dissipador para todas as armas · ${arms.torso} de blindagem`],
    ['OMBROS · MÓDULOS', 'em projeto: dissipador extra, radar, escudo, reparo', 'plan'],
    ['CABEÇA · SENSORES', `${sheet.armor[0][1]} de blindagem; destruída, o piloto fica cego`],
    ['PERNAS · MOBILIDADE', `${sheet.speed} m/s, dash de ${sheet.dash} m/s; sem as duas, o Mech para`],
  ];
  hangarHtml = `<section aria-labelledby="hangar">
    <span class="kicker">// hangar · em projeto</span>
    <h2 id="hangar">Hangar: monte o seu Mech</h2>
    <p class="lede">Armas, módulos, chassis. Todo poder pesa. A luta decide quem vence. Números lidos do código em tempo real.</p>
    <div class="grid-2 blueprint">
      <figure class="bp-fig frame">${BLUEPRINT}<figcaption>${esc(arms.target)} · encaixes · tracejado = em projeto</figcaption></figure>
      <div class="stack">
        <ol class="bp-legend">${legend.map(([k, v, cls], i) => `<li${cls ? ` class="${cls}"` : ''}><span class="bp-n" aria-hidden="true">${i + 1}</span><div><b>${k}</b><span>${esc(v)}</span></div></li>`).join('')}</ol>
        <p class="bp-load">carga das armas de fábrica: <b>${tons(load)}</b> · a carga máxima de cada chassi entra com o Hangar</p>
      </div>
    </div>
    <h3 class="sub-h">Arsenal · três níveis de poder</h3>
    <div class="arsenal">${arms.weapons.map(wpnCard).join('')}</div>
    <p class="wpn-legend">MK II: +20% de dano, +15% de calor e +50% de carga. MK III: +40%, +30% e o dobro. DANO/S = gatilho apertado por 30 s, contando as travas por calor e as recargas. DERRUBA EM = tempo para derrubar o torso de um ${esc(arms.target)} (${arms.torso} de vida) com todos os tiros no alvo.</p>
    <h3 class="sub-h">Monte dentro da carga</h3>
    <p class="lede">O ${esc(arms.target)} carrega até ${tons(arms.capacity)} de armas. Das nove combinações de plasma e foguetes, cabem ${arms.builds.flat().filter((b) => b.fits).length}: um braço no MK III obriga o outro a ficar leve. O tempo é o dos dois braços juntos derrubando o torso, com todos os tiros no alvo.</p>
    <div class="wpn-scroll"><table class="builds">
      <thead><tr><th scope="col"><span class="sr">plasma</span></th>${arms.tier.map((t) => `<th scope="col">FOGUETES ${t.label}</th>`).join('')}</tr></thead>
      <tbody>${arms.builds
        .map(
          (row, p) =>
            `<tr><th scope="row">PLASMA ${arms.tier[p].label}</th>${row
              .map((b) =>
                b.fits
                  ? `<td class="fit${b.p === 0 && b.r === 0 ? ' factory' : ''}"><b>${tons(b.mass)}</b><span>${num(b.ttk, 1)} s</span><a href="./jogar/?build=${esc(b.key)}">${b.p === 0 && b.r === 0 ? 'de fábrica' : 'jogar →'}</a></td>`
                  : `<td class="over"><b>${tons(b.mass)}</b><span>não cabe</span></td>`,
              )
              .join('')}</tr>`,
        )
        .join('')}</tbody>
    </table></div>
    <p class="rules-note">Cada montagem que cabe é um link: abre o jogo já com ela. O mesmo link serve para mandar o seu build a alguém. A tela do Hangar, dentro do jogo, está em construção.</p>
    ${arms.pilot ? `<p><a class="link-btn" href="./jogar/?build=${esc(arms.pilot.key)}">ou jogue a pé: andróide de ${num(arms.pilot.height, 1)} m, blaster e motosserra, contra Mechs de ${num(arms.pilot.mechHeight, 1)} m →</a></p>` : ''}
    <h3 class="sub-h">Regras de equilíbrio</h3>
    <div class="sitrep">
      <div class="read frame"><span class="k">uma arma sozinha</span><span class="v">≥ ${num(single, 1)} s</span><span class="d">para derrubar um Mech, mesmo no MK III</span></div>
      <div class="read frame"><span class="k">os dois braços juntos</span><span class="v">≥ ${num(combo, 1)} s</span><span class="d">o calor do Mech trava antes de terminar o serviço</span></div>
      <div class="read frame"><span class="k">MK III contra MK I</span><span class="v">−${gain}%</span><span class="d">de tempo no plasma: dá para sentir, mas não decide a luta</span></div>
      <div class="read frame"><span class="k">dano por tonelada</span><span class="v">${num(perTon[0] / perTon[2], 1)}×</span><span class="d">o MK I rende mais por tonelada que o MK III: poder custa carga</span></div>
    </div>
    <p class="rules-note">Teto teórico, sem errar nenhum tiro. ${arms.tests} testes de simulação travam estas metas a cada entrega: se uma mudança criar apelação, a versão não sai.</p>
    <p><a class="link-btn" href="./oficina/">ver a bancada completa na oficina: calor, partes, distância →</a></p>
  </section>`;
}

// ---------- online: o estado do multiplayer (ROADMAP, fase 4) ----------
// Publica o ritmo (60 Hz de simulação, 20 estados por segundo), não o tamanho: byte por robô, KB/s por
// jogador e teto de unidades são a engenharia que mora no repositório privado e o site não republica.
const net = game?.net;
const onlinePhase = roadmap.phases.find((p) => /multiplayer/i.test(p.title));
let onlineHtml = '';
if (net && onlinePhase) {
  const ready = onlinePhase.items.filter((i) => i.status === 'done').length;
  onlineHtml = `<section aria-labelledby="online">
    <span class="kicker">// fase ${onlinePhase.num} · multiplayer</span>
    <h2 id="online">Online: salas de ${net.ROOM_SIZE} pilotos</h2>
    <p class="lede">Servidor decide tudo. Você controla. Testado em rede fraca. Sem lag.</p>
    <div class="sitrep">
      <div class="read frame"><span class="k">servidor</span><span class="v">${net.SIM_HZ} Hz</span><span class="d">a mesma simulação do jogo, ${net.SIM_HZ} passos por segundo, decidindo tudo</span></div>
      <div class="read frame"><span class="k">estado da sala</span><span class="v">${net.SNAPSHOT_HZ} ×/s</span><span class="d">o que mudou de posição, mira e vida chega ${net.SNAPSHOT_HZ} vezes por segundo — e só isso</span></div>
      <div class="read frame"><span class="k">no seu aparelho</span><span class="v">0 decisões</span><span class="d">dano, calor e quem caiu saem do servidor: o seu Mech desenha, não julga</span></div>
    </div>
    <p>${ONLINE ? '<a class="play-btn online" href="./jogar/?sala=ARENA" data-evento="click_online">[ JOGAR ONLINE AGORA ]</a>' : '<span class="rules-note">O servidor público entra no ar em breve: hoje o online roda em teste, num PC.</span>'}</p>
    <p class="milestone frame">🎯 <strong>Primeira sessão online ponta a ponta:</strong> 26/09/2026, dois aparelhos do dono jogaram juntos na mesma sala pelo túnel público (<code>jogo.selvamkt.com.br</code>). Agora o servidor fica no ar 24 h; convide alguém e testem juntos.</p>
    <p class="rules-note">${ready} de ${onlinePhase.items.length} etapas prontas. A conta da rede é medida pelos ${net.tests} testes de orçamento a cada entrega: se a sala cheia não couber na meta, a versão não sai.</p>
  </section>`;
}

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
        ${act.last ? `<p class="pulse">${act.total} commits e ${act.merges} entregas em ${m.day ?? 1} dia${(m.day ?? 1) > 1 ? 's' : ''} · último em ${esc(new Date(act.last).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às'))}</p>` : ''}
      </div>
    </div>
    <p><a class="link-btn" href="./sala-de-controle/">entrar na sala de controle: equipe, processo, decisões e números →</a></p>
  </section>`;

const endHtml = `<section class="final frame" aria-labelledby="final">
    <h2 id="final">Cockpit liberado</h2>
    <p class="lede">A rodada dura cinco minutos. Três pilotos já estão na arena esperando você.</p>
    <a class="play-btn" href="./jogar/?sala=ARENA" data-evento="click_online">[ JOGAR ONLINE ]</a>
  </section>`;

// ---------- página ----------

const css = `
  .hero { display: grid; gap: 28px; padding-top: 30px; align-items: center; }
  .hero.with-shot { grid-template-columns: minmax(300px, 1fr) minmax(0, 1.05fr); }
  .hero-copy { display: grid; gap: 18px; min-width: 0; }
  .pitch { font-size: 17px; line-height: 1.6; color: var(--text); max-width: 46ch; text-wrap: pretty; }
  .cta { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
  /* Uma só ação em destaque (ENTRAR NO COCKPIT); jogar online é a opção de baixo, menor e discreta —
     nunca dois botões do mesmo peso lado a lado (achado do dono, 29/09: confunde qual é a ação principal). */
  .cta-online { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin: 0; }
  .cta .cta-more { margin-top: 2px; }
  .facts { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 18px; color: var(--muted); font-size: 12.5px; letter-spacing: .1em; text-transform: uppercase; }
  .facts li::before { content: '▸ '; color: var(--amber); }
  .hero-shot, .shot { margin: 0; overflow: hidden; }
  .hero-shot img, .shot img { width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; }
  .hero-shot figcaption, .shot figcaption {
    position: absolute; left: 0; bottom: 0; padding: 4px 10px; background: rgba(7,6,4,.82);
    font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--muted);
  }
  .hero-shot figcaption::before { content: '● '; color: var(--red); }
  .carousel { display: grid; gap: 12px; max-width: 640px; }
  .carousel-track { position: relative; display: grid; }
  .carousel-track .shot { grid-area: 1 / 1; opacity: 0; visibility: hidden; transition: opacity .5s ease; }
  .carousel-track .shot.on { position: relative; opacity: 1; visibility: visible; }
  .carousel-track .shot:not(.on) { position: absolute; inset: 0; }
  .carousel-dots { display: flex; gap: 8px; justify-content: center; }
  .carousel-dots button {
    width: 9px; height: 9px; border-radius: 50%; border: 1px solid var(--amber); background: transparent;
    padding: 0; cursor: pointer;
  }
  .carousel-dots button[aria-current="true"] { background: var(--amber); box-shadow: 0 0 8px rgba(255,176,0,.6); }

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

  .sub-h { font: 400 1.5rem/1.1 var(--fd); letter-spacing: .06em; text-transform: uppercase; margin-top: 12px; }
  .blueprint { align-items: center; }
  .bp-fig {
    margin: 0; padding: 18px 18px 34px; display: grid; justify-items: center;
    background: linear-gradient(rgba(255,176,0,.06) 1px, transparent 1px) 0 0 / 20px 20px, linear-gradient(90deg, rgba(255,176,0,.06) 1px, transparent 1px) 0 0 / 20px 20px, var(--panel);
  }
  .bp { width: 100%; max-width: 300px; height: auto; }
  .bp rect, .bp circle { fill: none; stroke: var(--amber); stroke-width: 1.5; }
  .bp .plan { stroke: var(--muted); stroke-dasharray: 4 3; }
  .bp .visor { fill: var(--green); stroke: none; }
  .bp .n circle { fill: var(--bg); stroke: var(--amber); }
  .bp .n text { fill: var(--amber); font: 13px var(--fb); text-anchor: middle; dominant-baseline: central; }
  .bp-fig figcaption { position: absolute; left: 0; bottom: 0; padding: 4px 10px; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); }
  .bp-legend { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
  .bp-legend li { display: grid; grid-template-columns: 24px 1fr; gap: 12px; align-items: start; font-size: 14px; }
  .bp-legend li > div { display: grid; gap: 2px; }
  .bp-n { width: 22px; height: 22px; margin-top: 1px; border: 1.5px solid var(--amber); border-radius: 50%; display: grid; place-items: center; font-size: 12px; line-height: 1; color: var(--amber); }
  .bp-legend b { font-size: 12px; letter-spacing: .16em; }
  .bp-legend div span { color: var(--text); }
  .bp-legend li.plan b, .bp-legend li.plan div span { color: var(--muted); }
  .bp-legend li.plan .bp-n { border-style: dashed; border-color: var(--muted); color: var(--muted); }
  .bp-load { color: var(--muted); font-size: 13px; }
  .arsenal { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 16px; }
  .wpn { display: grid; align-content: start; min-width: 0; }
  .wpn-bar { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--line); }
  .wpn-id { font-size: 11px; letter-spacing: .18em; color: var(--bg); background: var(--amber); padding: 2px 6px 1px; }
  .wpn-bar h3 { flex: 1; min-width: 12ch; }
  .wpn-kind { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); }
  .wpn-scroll { overflow-x: auto; }
  .wpn-table { width: 100%; border-collapse: collapse; font-size: 13.5px; font-variant-numeric: tabular-nums; }
  .wpn-table th, .wpn-table td { padding: 7px 12px; text-align: right; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .wpn-table thead th { font: 400 1.15rem/1 var(--fd); color: var(--amber); letter-spacing: .06em; vertical-align: bottom; }
  .wpn-table thead small { display: block; font: 400 9.5px/1.4 var(--fb); letter-spacing: .16em; color: var(--green); text-transform: uppercase; }
  .wpn-table tbody th { text-align: left; font-weight: 400; font-size: 11px; letter-spacing: .14em; color: var(--muted); }
  .wpn-table td { color: var(--text); }
  .wpn-table tr.key td { color: var(--amber); }
  .wpn-note { padding: 10px 14px 12px; color: var(--muted); font-size: 12.5px; line-height: 1.5; }
  .builds { width: 100%; border-collapse: separate; border-spacing: 4px; font-variant-numeric: tabular-nums; }
  .builds th { font-weight: 400; font-size: 11px; letter-spacing: .14em; color: var(--muted); text-align: center; padding: 4px; white-space: nowrap; }
  .builds tbody th { text-align: left; }
  .builds td { border: 1px solid var(--line2); background: var(--panel); padding: 10px 8px; text-align: center; vertical-align: top; }
  .builds td b { display: block; font: 400 1.35rem/1 var(--fd); color: var(--amber); }
  .builds td span { display: block; font-size: 12.5px; color: var(--text); margin: 2px 0 6px; }
  .builds td a { font-size: 11.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--bone); text-decoration: none; border-bottom: 1px dashed var(--bone); }
  .builds td.factory { border-color: var(--green); }
  .builds td.over { border-style: dashed; border-color: var(--line); background: transparent; }
  .builds td.over b { color: var(--faint); }
  .builds td.over span { color: var(--red); margin-bottom: 0; }
  .wpn-legend, .rules-note { color: var(--muted); font-size: 13px; max-width: 90ch; }
  .read .d { color: var(--muted); font-size: 12.5px; line-height: 1.4; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

  .build { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .box-bar { display: flex; justify-content: space-between; gap: 12px; padding: 8px 14px; border-bottom: 1px solid var(--line); font-size: 11.5px; letter-spacing: .2em; color: var(--muted); text-transform: uppercase; }
  .box-body { padding: 14px 16px 16px; display: grid; gap: 12px; margin: 0; }
  .meter { height: 10px; border: 1px solid var(--line2); }
  .meter i { display: block; height: 100%; background: var(--green); box-shadow: 0 0 6px rgba(125,255,114,.4); }
  .todo, .recent { list-style: none; padding: 0; display: grid; gap: 7px; font-size: 13.5px; line-height: 1.45; }
  .todo li { display: grid; grid-template-columns: 38px 1fr; gap: 8px; }
  .todo li span { color: var(--text); } .todo li.doing span { color: var(--amber); }
  /* Estilo do .play-btn.online (contorno, secundário) mora em site/tema.mjs — compartilhado com o resto do site. */
  /* Status do servidor, perguntado pela página (GET /status): verde com gente, apagado fora do ar. */
  .srv { display: flex; align-items: center; gap: 9px; margin: -4px 0 0; font-size: 12.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .srv .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--faint); flex: none; }
  .srv.on { color: var(--green); }
  .srv.on .dot { background: var(--green); box-shadow: 0 0 10px rgba(125,255,114,.8); animation: srv-pulse 1.8s ease-in-out infinite; }
  .srv.vazio .dot { background: var(--green); opacity: .5; }
  .srv.off .dot { background: #7a3a3a; }
  @keyframes srv-pulse { 50% { opacity: .35; } }
  /* Marco: quando um marco novo entra, ele aparece dentro da própria seção que ele completa. */
  .milestone { padding: 12px 16px; color: var(--text); font-size: 13.5px; max-width: 90ch; margin: 14px 0; border-left: 3px solid var(--green); }
  .milestone code { color: var(--green); }
  .then { color: var(--muted); font-size: 13px; }
  .pulse { margin: 0; padding: 0 16px 14px; color: var(--green); font-size: 12px; letter-spacing: .06em; }
  .pulse::before { content: '● '; }
  .recent li { display: grid; grid-template-columns: 48px 1fr; gap: 10px; }
  .recent time { color: var(--faint); font-variant-numeric: tabular-nums; }

  .presents { font-size: 11px; letter-spacing: .42em; text-transform: uppercase; color: var(--faint); }

  /* abertura da marca */
  #intro { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: #000; transition: opacity .35s ease-out; }
  #intro[hidden] { display: none; }
  #intro.out { opacity: 0; pointer-events: none; }
  #intro canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .in-mark { position: relative; z-index: 1; isolation: isolate; display: grid; justify-items: center; gap: 12px; padding: 36px 44px; }
  .in-mark::before { content: ''; position: absolute; inset: -40% -25%; z-index: -1; background: radial-gradient(closest-side, #000 45%, rgba(0,0,0,.75) 70%, transparent); }
  .in-emblem { width: clamp(84px, 16vmin, 132px); height: auto; opacity: 0; animation: in-emblem .7s .25s cubic-bezier(.2,.9,.3,1.25) forwards; }
  .in-word { width: min(76vw, 430px); height: auto; mix-blend-mode: screen; opacity: 0; animation: in-word .6s .55s ease-out forwards; }
  .in-tag { font-size: 11px; letter-spacing: .6em; padding-left: .6em; text-transform: uppercase; color: #8fa596; opacity: 0; animation: in-show .5s .95s forwards; }
  .in-skip { position: absolute; right: 18px; bottom: 16px; font-size: 11px; letter-spacing: .24em; text-transform: uppercase; color: #3f4d44; }
  @keyframes in-emblem {
    0% { opacity: 0; transform: scale(.55); filter: brightness(3) drop-shadow(0 0 30px #39ff6a); }
    60% { opacity: 1; }
    100% { opacity: 1; transform: none; filter: brightness(1) drop-shadow(0 0 16px rgba(57,255,106,.5)); }
  }
  @keyframes in-word { from { opacity: 0; clip-path: inset(0 50% 0 50%); } to { opacity: 1; clip-path: inset(0 0 0 0); } }
  @keyframes in-show { to { opacity: 1; } }

  .final { padding: 32px 24px; justify-items: center; text-align: center; background: url("data:image/svg+xml,${HEXGRID}") center / 56px 97px, var(--panel); }

  @media (max-width: 900px) {
    .hero.with-shot, .grid-2, .build, .sheet { grid-template-columns: 1fr; }
    .wpn-table th, .wpn-table td { padding: 7px 8px; }
    .hero-shot { order: -1; }
  }
`;

const body = `
  ${introHtml}
  ${topo({ base: './', current: 'jogo', left: `CYBERMECH // ${esc(m.version ?? 'protótipo')}`, live: `build de hoje · ${esc(m.head)}` })}
  ${heroHtml}
  ${eventoHtml}
  ${galleryHtml}
  ${featuresHtml}
  ${horizonHtml}
  ${sheetHtml}
  ${keysHtml}
  ${pledgeHtml}
  ${hangarHtml}
  ${onlineHtml}
  ${buildHtml}
  ${endHtml}
  <footer><span>CYBERMECH © ${new Date().getFullYear()} <b>SERAFIM WEB</b> · feito por Dan e uma equipe de IAs</span><span>build ${esc(m.head)} · ${esc(m.generated)} BRT</span></footer>
`;

const description = 'Shooter de Mechs direto no navegador: desmonte o inimigo peça por peça numa arena industrial. Grátis, sem instalar e sem pay-to-win.';
const html = pagina({
  title: 'CYBERMECH',
  description,
  css,
  body,
  og: SITE_URL !== '/' ? { url: SITE_URL, image: cover ? `${SITE_URL}${shotSrc(cover)}` : null } : null,
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`landing ${OUT} (${features.length} destaques, ${SHOTS.length} capturas${bundle ? `, download ${mb(bundle.total)}` : ''})`);
