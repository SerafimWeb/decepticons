/** Landing pública: catálogo da simulação e fotografias dos modelos reais. */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { jogo, marcos, vitrine } from './site/dados.mjs';
import { esc, inline, pagina } from './site/tema.mjs';
import { LANDING_CSS } from './site/landing-style.mjs';

const args = process.argv.slice(2);
const OUT = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : '.tmp/site/index.html');
const ROOT = dirname(OUT);
const game = await jogo();
if (!game) throw new Error('A landing exige o catálogo real do jogo.');
const m = marcos();
const SITE_URL = (process.env.SITE_URL || 'https://cybermech.online/').replace(/\/?$/, '/');
const art = (file) => `jogar/press/${file}`;
const features = vitrine().slice(0, 6);
const nf = (n) => n.toLocaleString('pt-BR');
const chassis = [
  ['vector09', 'Versatilidade em combate', 'Mobilidade, plasma e foguetes. Um ponto de partida para encontrar seu estilo.'],
  ['marauder', 'Potência em múltiplos encaixes', 'Armas nos braços e nos ombros, com montagens para diferentes distâncias.'],
  ['colossusv4', 'Presença de cerco', 'Blindagem e capacidade de carga para quem prefere dominar uma posição.'],
];
const shots = [
  ['capa.jpg', 'Terceira pessoa', 'Acompanhe o Mech e leia o espaço ao seu redor.'],
  ['primeira-pessoa.jpg', 'Primeira pessoa', 'Assuma a perspectiva do piloto para alinhar os disparos.'],
  ['tatica.jpg', 'Visão tática', 'Observe a arena de cima e planeje seu deslocamento.'],
].filter(([file]) => existsSync(join(ROOT, 'capturas', file)));
const button = (label = 'JOGAR AGORA', href = './jogar/', event = 'click_cockpit') => `<a class="play-btn" href="${href}" data-evento="${event}">${label}<span aria-hidden="true">↗</span></a>`;
const modes = [
  ['01', 'ARENA', 'Combate sem pausa', 'Enfrente os rebeldes, use a cobertura e ataque os módulos vulneráveis.', './jogar/?modo=deathmatch', 'arena.jpg', 'SOLO'],
  ['02', 'SOBREVIVÊNCIA', 'Defenda a estação', 'Resista às ondas de invasores na Praia dos Cabos e preserve o núcleo da estação.', './jogar/?modo=survival&mapa=praia', 'praia.jpg', 'SOLO · ONDAS'],
  ['03', 'MULTIPLAYER', 'Entre na disputa', `Salas para até ${game.net.ROOM_SIZE} pilotos. Combate todos contra todos, com movimento e dano validados pelo servidor.`, './jogar/?sala=ARENA', 'duelo.jpg', 'ONLINE'],
];
const status = game.net.statusUrl ? `<p class="server-status" id="srv" role="status"><i></i><span>Consultando o servidor…</span></p>` : '';
const body = `
<a class="skip-link" href="#conteudo">Ir para o conteúdo</a>
<nav class="site-nav" aria-label="Navegação principal">
  <a class="wordmark" href="./" aria-label="Cybermech, início"><span class="brand-symbol" aria-hidden="true">C</span><span>CYBERMECH<small>ONLINE</small></span></a>
  <div class="nav-links"><a href="#combate">O JOGO</a><a href="#hangar">MECHS</a><a href="#modos">MODOS</a><a href="./oficina/">ARSENAL</a><a href="./sala-de-controle/" data-evento="click_como_e_feito">BASTIDORES</a></div>${button('JOGAR')}
</nav>
<main id="conteudo">
<header class="landing-hero">
  <img class="hero-art" src="${art('hero.jpg')}" width="1920" height="1080" alt="Colossus-V4 e Vector-09, modelos do Cybermech, em composição industrial" fetchpriority="high">
  <div class="hero-shade"></div>
  <div class="hero-content"><p class="eyebrow">COMBATE MECÂNICO NO NAVEGADOR</p>
    <h1>CYBERMECH<span>ENTRE NO<br>COMBATE.</span></h1>
    <p class="hero-description">Escolha sua máquina. Domine o arsenal.<br>Desmonte o adversário peça por peça.</p>
    <div class="hero-actions">${button()}<a class="text-link" href="#combate">CONHEÇA O JOGO <span aria-hidden="true">↓</span></a></div>
    <p class="entry-note">Grátis. Sem instalação. Sem cadastro obrigatório.</p>${status}
  </div>
  <div class="hero-caption"><span>COLOSSUS-V4 / VECTOR-09</span><small>Modelos reais · composição promocional</small></div>
  <div class="hero-bottom"><span><b>01</b> ESCOLHA SEU MECH</span><span><b>02</b> CONFIGURE SEU ARSENAL</span><span><b>03</b> ENTRE NA ARENA</span></div>
</header>
<section class="section gameplay" aria-labelledby="combate">
  <div class="section-copy"><p class="eyebrow">01 / VISÃO DE COMBATE</p><h2 id="combate">SEU MECH.<br><em>SUA PERSPECTIVA.</em></h2><p>Avance entre estruturas industriais, flanqueie os rebeldes e encontre o ponto fraco de cada máquina. Alterne entre três perspectivas durante a partida.</p>
    <div class="camera-controls" role="group" aria-label="Escolher prévia de câmera">${shots.map((s, i) => `<button type="button" data-camera="${i}" aria-pressed="${i === 0}" aria-controls="camera-preview"><span>0${i + 1}</span>${s[1]}</button>`).join('')}</div>
    <p class="small">Capturas do jogo. Mouse e teclado recomendados; controles de toque em teste.</p>
  </div>
  <figure class="gameplay-frame" id="camera-preview">${shots.length ? shots.map(([file, label, desc], i) => `<div class="camera-slide"${i ? ' hidden' : ''}><img src="capturas/${file}?v=${esc(m.head)}" width="1280" height="720" alt="${esc(label)}: ${esc(desc)}" loading="lazy"><figcaption><b>${label}</b><span>${desc}</span></figcaption></div>`).join('') : `<img src="${art('arena.jpg')}" width="1280" height="720" alt="Arena industrial do Cybermech" loading="lazy"><figcaption>ARENA INDUSTRIAL · CENA DO JOGO</figcaption>`}</figure>
</section>
<section class="section capabilities" aria-labelledby="recursos"><div class="section-heading"><div><p class="eyebrow">02 / SISTEMAS DE COMBATE</p><h2 id="recursos">CADA PEÇA <em>IMPORTA.</em></h2></div><p>Potência, mobilidade e gestão térmica.<br>O resultado depende de como você combina os três.</p></div>
<ol class="feature-grid">${features.map((f, i) => `<li><span class="feature-index">0${i + 1} /</span><h3>${esc(f.title)}</h3><p>${inline(f.text)}</p></li>`).join('')}</ol></section>
<section class="section roster" aria-labelledby="hangar"><div class="section-heading"><div><p class="eyebrow">03 / HANGAR</p><h2 id="hangar">ENCONTRE <em>SUA MÁQUINA.</em></h2></div><p>Chassis com perfis distintos.<br>Montagens limitadas pela capacidade de carga.</p></div>
<div class="mech-grid">${chassis.map(([id, role, desc]) => {
  const ch = game.chassis[id];
  const spec = game.hangar.factorySpec(id);
  if (!game.hangar.validateLoadout(spec).ok) throw new Error(`Montagem de divulgação inválida: ${id}`);
  const key = game.hangar.loadoutKey(spec);
  return `<article class="mech-card"><div class="mech-picture"><img src="${art(`${id}.jpg`)}" width="720" height="780" alt="${esc(ch.name)}, modelo real do jogo" loading="lazy"><span>TAMANHO ${game.sizes[id]}</span></div><div class="mech-info"><p class="eyebrow">${role}</p><h3>${esc(ch.name)}</h3><p>${desc}</p><dl><div><dt>BLINDAGEM DO TORSO</dt><dd>${nf(ch.maxModuleHealth.torso)}</dd></div><div><dt>CARGA DE ARMAS</dt><dd>${nf(ch.weaponCapacity)} t</dd></div></dl><a class="text-link" href="./jogar/?build=${esc(key)}" data-evento="click_cockpit">PILOTAR ${esc(ch.name)} <span aria-hidden="true">↗</span></a></div></article>`;
}).join('')}</div><p class="small">Atributos da configuração atual do jogo. Explore as compatibilidades, níveis e comparativos na <a href="./oficina/">Oficina de armamentos</a>.</p></section>
<section class="fair-play"><div><p class="eyebrow">COMPROMISSO DE JOGO</p><h2>HABILIDADE.<br><em>SEM PAY-TO-WIN.</em></h2></div><p>Vitórias se conquistam em combate. Nossa política de monetização é exclusivamente cosmética: aparência nunca compra dano, blindagem ou velocidade.</p></section>
<section class="section" aria-labelledby="modos"><div class="section-heading"><div><p class="eyebrow">04 / OPERAÇÕES</p><h2 id="modos">ESCOLHA <em>SEU COMBATE.</em></h2></div><p>Comece contra a IA ou dispute uma sala online.</p></div><div class="mode-grid">${modes.map(([n, name, title, desc, href, file, tag]) => `<article class="mode-card"><img src="${art(file)}" width="1280" height="720" alt="${esc(name)} — cenário do Cybermech" loading="lazy"><div><p class="eyebrow">${n} / ${tag}</p><h3>${title}</h3><p>${desc}</p><a class="text-link" href="${href}" data-evento="${n === '03' ? 'click_online' : 'click_cockpit'}">JOGAR ${name} <span aria-hidden="true">↗</span></a></div></article>`).join('')}</div></section>
<section class="section briefing" aria-labelledby="primeira-missao"><div><p class="eyebrow">05 / PRIMEIRA PARTIDA</p><h2 id="primeira-missao">PRONTO PARA<br><em>ASSUMIR O CONTROLE?</em></h2><p>Abra o jogo e aguarde a preparação da partida. Clique em Jogar para assumir o Mech; pressione Esc quando quiser ajustar sua montagem ou as configurações.</p>${button('ENTRAR NO COCKPIT')}</div><div><dl class="control-grid"><div><dt><kbd>W A S D</kbd></dt><dd>Movimentar</dd></div><div><dt><kbd>MOUSE</kbd></dt><dd>Mirar</dd></div><div><dt><kbd>CLIQUE</kbd></dt><dd>Ataque 1</dd></div><div><dt><kbd>CLIQUE DIR.</kbd></dt><dd>Ataque 2</dd></div><div><dt><kbd>SHIFT</kbd></dt><dd>Dash</dd></div><div><dt><kbd>ESPAÇO</kbd></dt><dd>Saltar</dd></div></dl><p class="small">Teclas padrão. Remapeamento e sensibilidade em Configurações.</p></div></section>
<section class="section faq" aria-labelledby="perguntas"><p class="eyebrow">ANTES DE ENTRAR</p><h2 id="perguntas">INFORMAÇÕES <em>DO PILOTO.</em></h2><details><summary>Preciso criar uma conta?</summary><p>Não. Você pode começar a jogar sem cadastro. A progressão atual fica salva neste navegador.</p></details><details><summary>Posso jogar sozinho?</summary><p>Sim. Arena e Sobrevivência têm oponentes controlados pela IA e não dependem de uma sala multiplayer disponível.</p></details><details><summary>O jogo funciona no celular?</summary><p>Há controles de toque em teste. Para a experiência principal, use um computador com mouse, teclado e navegador compatível com WebGL2.</p></details><details><summary>Onde acompanho as atualizações?</summary><p>A <a href="./sala-de-controle/">Sala de Controle</a> apresenta a equipe, as entregas e o desenvolvimento. A <a href="./oficina/">Oficina</a> reúne os atributos e as análises de combate.</p></details></section>
</main><footer class="site-footer"><a class="wordmark" href="./">CYBERMECH</a><p>© ${new Date().getFullYear()} SERAFIM WEB · Desenvolvido por Dan e uma equipe de IAs.</p><div><a href="./oficina/">Oficina</a><a href="./sala-de-controle/">Sala de Controle</a><a href="./jogar/">Jogar</a></div></footer>`;

const script = `(() => {
  const buttons = [...document.querySelectorAll('[data-camera]')];
  const slides = [...document.querySelectorAll('.camera-slide')];
  let current = 0, timer;
  const area = document.querySelector('.gameplay');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const show = (index) => { current = index; slides.forEach((s, i) => s.hidden = i !== index); buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === index))); };
  const pause = () => clearInterval(timer);
  const resume = () => { pause(); if (slides.length > 1 && !reduced.matches && !document.hidden && !area.matches(':hover, :focus-within')) timer = setInterval(() => show((current + 1) % slides.length), 6000); };
  buttons.forEach((b, i) => b.addEventListener('click', () => { show(i); pause(); }));
  area.addEventListener('mouseenter', pause); area.addEventListener('mouseleave', resume);
  area.addEventListener('focusin', pause); area.addEventListener('focusout', () => setTimeout(resume, 0));
  reduced.addEventListener('change', resume); document.addEventListener('visibilitychange', resume); resume();
  const statusUrl = ${JSON.stringify(game.net.statusUrl)};
  if (statusUrl) {
    const status = document.querySelector('#srv'); let pending = false;
    const ask = async () => {
      if (document.hidden || pending) return; pending = true;
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 7000);
      try { const response = await fetch(statusUrl, { cache: 'no-store', credentials: 'omit', signal: controller.signal }); if (!response.ok) throw Error(); const data = await response.json(); if (!Number.isInteger(data.players) || data.players < 0) throw Error();
        status.dataset.state = 'online'; status.querySelector('span').textContent = data.players ? data.players + (data.players === 1 ? ' piloto online' : ' pilotos online') : 'Servidor online · entre na arena';
      } catch { status.dataset.state = 'unknown'; status.querySelector('span').textContent = 'Não foi possível consultar o servidor · modo solo disponível'; }
      finally { clearTimeout(timeout); pending = false; }
    }; ask(); setInterval(ask, ${game.net.statusPollS * 1000}); document.addEventListener('visibilitychange', ask);
  }
  const url = ${JSON.stringify(game.net.eventoUrl)};
  if (url) { const aba = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); const send = (nome) => { try { const body = JSON.stringify({ nome, aba }); if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], {type:'text/plain'})); else fetch(url, {method:'POST', body, keepalive:true}).catch(() => {}); } catch {} }; send('landing_view'); document.querySelectorAll('[data-evento]').forEach(el => el.addEventListener('click', () => send(el.dataset.evento))); }
})();`;
const html = pagina({ title: 'CYBERMECH — Combate de Mechs no navegador', description: 'Pilote seu Mech, configure o arsenal e entre no combate. Grátis, direto no navegador, sem instalação e sem pay-to-win.', css: LANDING_CSS, body, script, og: { url: SITE_URL, image: `${SITE_URL}${art('hero.jpg')}` } });
mkdirSync(ROOT, { recursive: true });
writeFileSync(OUT, html);
console.log(`landing ${OUT}: catálogo real, ${features.length} destaques, ${shots.length} câmeras`);
