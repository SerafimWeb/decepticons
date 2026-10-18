/**
 * Landing pública. Os números vêm do jogo (catálogo, arsenal, chassis) e as fotos são dos Mechs reais:
 * `node .decepticons/medicoes/cena-cinematica.mjs` as produz e grava a posição dos rótulos em `scripts/site/cena/`.
 * Direção de arte e componentes: `.decepticons/DESIGN_SYSTEM_SITE.md` e `scripts/site/hud.mjs`.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { arsenal, jogo, marcos, pledge, vitrine } from './site/dados.mjs';
import { esc, inline, pagina } from './site/tema.mjs';
import { HUD_JS, featureCard, gameButton, ghost, hudCss, hudFooter, hudNav, ico, sectionHeading } from './site/hud.mjs';
import { LANDING_CSS } from './site/landing-style.mjs';
import { audienciaParaLanding } from './site/audiencia-landing.mjs';

const args = process.argv.slice(2);
const OUT = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : '.tmp/site/index.html');
const ROOT = dirname(OUT);
const game = await jogo();
if (!game) throw new Error('A landing exige o catálogo real do jogo.');
const AUDIENCIA_JS = await audienciaParaLanding();
const m = marcos();
const SITE_URL = (process.env.SITE_URL || 'https://cybermech.online/').replace(/\/?$/, '/');
const art = (file) => `jogar/press/${file}`;
const nf = (n, d = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const cena = (nome) => JSON.parse(readFileSync(resolve('scripts/site/cena', `${nome}.json`), 'utf8'));
const arse = arsenal(game);
const CH = game.chassis;

/* ---------- herói: as medidas e os rótulos saem da posição real dos Mechs na foto ---------- */
const hero = cena('hero').medidas;
const big = hero.colossusv4;
const small = hero.vector09;
const metros = (n) => `${nf(n, n % 1 ? 1 : 0)} m`;

/* ---------- câmeras: as capturas reais do jogo; sem elas, a arena da vitrine ---------- */
const shots = [
  ['tatica.jpg', 'Câmera tática', 'tactical', 'Observe a arena de cima e planeje seu deslocamento.'],
  ['primeira-pessoa.jpg', 'Câmera de piloto', 'helmet', 'Assuma a perspectiva do piloto para alinhar os disparos.'],
  ['capa.jpg', 'Câmera de ação', 'crosshair', 'Acompanhe o Mech e leia o espaço ao seu redor.'],
].filter(([file]) => existsSync(join(ROOT, 'capturas', file)));

/* ---------- recursos: o texto vem da VITRINE do GAME_DESIGN ---------- */
const vit = vitrine();
const pick = (needle) => vit.find((f) => f.title.toLowerCase().includes(needle));
const resources = [
  [pick('dano por módulo'), 'burst', 'cena-hero.jpg', '86% 62%', 1.9],
  [pick('arsenal configurável'), 'wrench', 'cena-marauder.jpg', '50% 35%', 1.25],
  [pick('oponentes'), 'octagon', 'cena-duelo.jpg', '88% 40%', 1.5],
  [pick('gestão térmica'), 'flame', 'cena-vector09.jpg', '50% 45%', 1.2],
].filter(([f]) => f);

/* ---------- compromisso de jogo: as quatro linhas do GAME_DESIGN ---------- */
const promise = pledge();
const promiseHead = ['Nada que se compra ganha partida.', 'Monetização, se houver, é só estética.', 'Anúncio nunca interrompe a luta.', 'O jogo é sobre habilidade.'];
const promiseIcon = ['xcircle', 'cube', 'bars', 'users'];
const promiseBody = (text) => inline(text.replace(/^\*\*[^*]+\*\*\s*/, ''));
const promiseRows = promise.slice(0, 4).map((t, i) => [promiseIcon[i], promiseHead[i], promiseBody(t)]);

/* ---------- Hangar: as seis partes do Marauder, com a blindagem e a montagem de fábrica reais ---------- */
const MAR = CH.marauder;
const spec = game.hangar.factorySpec('marauder');
const armaName = (slot) => game.weapons.weapon(slot.id, slot.tier).name;
const mh = MAR.maxModuleHealth;
const pos = cena('hangar').partes;
const parts = [
  ['CABEÇA', 'Sensores', `${nf(mh.head)} de blindagem. Destruída, o HUD perde os números e a mira.`, pos.head],
  ['TORSO', 'Núcleo', `${nf(mh.torso)} de blindagem. Cada parte tem a própria integridade e muda o que o Mech consegue fazer.`, pos.torso],
  ['BRAÇO DIREITO', armaName(spec.right), `${nf(mh.rightArm)} de blindagem. De fábrica carrega ${armaName(spec.right)}.`, pos.leftArm],
  ['BRAÇO ESQUERDO', armaName(spec.left), `${nf(mh.leftArm)} de blindagem. De fábrica carrega ${armaName(spec.left)}.`, pos.rightArm],
  ['PERNA DIREITA', 'Mobilidade', `${nf(mh.rightLeg)} de blindagem. ${nf(MAR.moveSpeed, 1)} m/s e dash de ${nf(MAR.dashSpeed)} m/s; perna quebrada deixa o Mech lento.`, pos.leftLeg],
  ['PERNA ESQUERDA', 'Estabilidade', `${nf(mh.leftLeg)} de blindagem. ${nf(MAR.maxJumps)} pulos seguidos para mudar de altura e fugir da linha de tiro.`, pos.rightLeg],
];

/* ---------- chassis em escala: a foto dos três lado a lado e os links de montagem ---------- */
const escala = Object.fromEntries(cena('escala').escala.map((e) => [e.id, e]));
// Os quatro tamanhos de robô do jogo, do menor ao maior (CHASSIS_SIZE): o 4 é o gigante, que a foto mostra por trás dos outros.
const chassis = [
  ['android', 'Pequeno e ágil', 'Um robô autônomo do tamanho de uma pessoa: rápido, frágil, com blaster e motosserra.'],
  ['vector09', 'Versatilidade em combate', 'Mobilidade, plasma e foguetes. Um ponto de partida para encontrar seu estilo.'],
  ['colossus01', 'Máquina de cerco', 'Vida enorme, quase não anda e não faz dash: um chassi para dominar uma posição.'],
  ['colossusv4', 'O gigante', 'Blindagem e capacidade de carga de outra escala: o maior chassi do jogo.'],
];
const NOME = { android: 'Andróide', vector09: 'Vector-09', colossus01: 'Colossus-01', colossusv4: 'Colossus-V4' };

/* ---------- arsenal: as seis armas de braço do Vector-09 em três níveis, com o desenho real de cada uma ---------- */
const KIND = { energy: 'Energia', ammo: 'Munição' };
const weaponCards = ['rotary', 'flamer', 'seeker', 'cannon', 'autocannon', 'arc'].map((id) => arse.weapons.find((w) => w.id === id)).filter(Boolean);

const modes = [
  ['01', 'Arena', 'Combate sem pausa', 'Enfrente os rebeldes, use a cobertura e ataque os módulos vulneráveis.', './jogar/?modo=deathmatch', 'cena-duelo.jpg', 'Solo', '72% 50%'],
  ['02', 'Sobrevivência', 'Defenda a estação', 'Resista às ondas de invasores na Praia dos Cabos e preserve o núcleo da estação.', './jogar/?modo=survival&mapa=praia', 'praia.jpg', 'Solo · ondas', '50% 50%'],
  ['03', 'Multiplayer', 'Entre na disputa', `Salas para até ${game.net.ROOM_SIZE} pilotos. Combate todos contra todos, com movimento e dano validados pelo servidor.`, './jogar/?sala=ARENA', 'cena-hero.jpg', 'Online', '20% 60%'],
];

const squad = [
  ['dan', 'Dan', 'Direção e game design', '#ffd000'],
  ['claude', 'Claude', 'Arquitetura e engenharia', '#ff6a5a'],
  ['gemini', 'Gemini', 'Interface e som', '#4aa3ff'],
  ['codex', 'Codex', 'Visual e render', '#3bd68a'],
];

/* ---------- o idioma logo no início (P178): a faixa de idiomas, antes de tudo; `site/idioma-landing.js` a liga ---------- */
const IDIOMAS_DA_FAIXA = [['pt', 'Português'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['ja', '日本語'], ['zh', '中文'], ['ru', 'Русский']];
const faixaDeIdiomas = `<nav class="lang-strip" aria-label="Idioma · Language" data-i18n="nao">
  <span class="lang-ic" aria-hidden="true">🌐 Idioma · Language</span>
  ${IDIOMAS_DA_FAIXA.map(([id, nome]) => `<button type="button" data-lang="${id}" aria-pressed="${id === 'pt'}">${nome}</button>`).join('\n  ')}
</nav>`;

const body = `
${faixaDeIdiomas}
${hudNav({ base: '', current: 'inicio', status: Boolean(game.net.statusUrl) })}
<main id="conteudo">
<header class="hero" id="inicio">
  <div class="hero-stage" data-parallax>
    <img class="hero-art" src="${art('cena-hero.jpg')}" width="2400" height="1200" alt="Colossus-V4, de ${metros(CH.colossusv4.height)}, ao lado de um Vector-09 e de um Marauder num hangar industrial" fetchpriority="high">
    <span class="dim dim-r" style="left:${(big.dir[0] + 2.4).toFixed(1)}%;top:${big.topo[1]}%;height:${(big.base[1] - big.topo[1]).toFixed(2)}%"><i>${metros(CH.colossusv4.height)}</i></span>
    <span class="dim dim-l" style="left:${(small.esq[0] - 1.8).toFixed(1)}%;top:${small.topo[1]}%;height:${(small.base[1] - small.topo[1]).toFixed(2)}%"><i>${metros(CH.vector09.height)}</i></span>
  </div>
  <div class="hero-shade" aria-hidden="true"></div>
  <p class="spec-tag"><b>${esc(CH.colossusv4.name)}</b>Torso ${nf(CH.colossusv4.maxModuleHealth.torso)} · carga ${nf(CH.colossusv4.weaponCapacity)} t</p>
  <div class="container hero-in">
    <div class="hero-copy">
      <p class="eyebrow hero-eyebrow"><i aria-hidden="true"></i><span>Combate mecânico online</span></p>
      <h1><span class="t1">CYBERMECH</span><span class="t2">ONLINE</span></h1>
      <p class="hero-lead">Pilote um Mech de combate numa arena industrial e desmonte o inimigo peça por peça. Acesse pelo navegador, é gratuito e não precisa instalar nada.</p>
      ${gameButton({ label: 'JOGAR AGORA', href: './jogar/', event: 'click_cockpit', variant: 'big' })}
    </div>
  </div>
  <div class="hero-bar"><div class="container"><ul>
    <li>${ico('globe', 30)}<span><b>Jogo no navegador</b>Sem instalar nada</span></li>
    <li>${ico('users', 30)}<span><b>Online e gratuito</b>Até ${game.net.ROOM_SIZE} pilotos por sala</span></li>
    <li>${ico('bolt', 30)}<span><b>Combate em arenas</b>Partidas contra a IA ou online</span></li>
  </ul><small class="art-note">Render promocional dos modelos do jogo</small></div></div>
</header>

<section class="section gameplay" aria-labelledby="combate-t" id="combate">${ghost('ARENA')}<div class="container">
  ${sectionHeading({ n: '01', label: 'Gameplay', title: 'TRÊS CÂMERAS,', em: 'UMA ARENA', id: 'combate-t', aside: '<p>Escolha sua visão, domine a arena e destrua o inimigo. Alterne entre câmera tática, câmera de ação ou visão de piloto e viva o combate do seu jeito.</p>' })}
  <div class="gp reveal">
    <figure class="gp-stage" id="camera-preview">
      <div class="gp-slides">${shots.length ? shots.map(([file, label, , desc], i) => `<div class="camera-slide${i ? '' : ' on'}"><img src="capturas/${file}?v=${esc(m.head)}" width="1280" height="720" alt="${esc(label)}: ${esc(desc)}"${i ? ' loading="lazy"' : ''}></div>`).join('') : `<div class="camera-slide on"><img src="${art('arena.jpg')}" width="1280" height="720" alt="Arena industrial do Cybermech"></div>`}</div>
      <a class="gp-play" href="./jogar/" data-evento="click_cockpit" aria-label="Jogar agora">${ico('play', 34)}</a>
      <figcaption><b id="cam-label">${esc(shots[0]?.[1] ?? 'Arena industrial')}</b><span id="cam-desc">${esc(shots[0]?.[3] ?? 'Captura do jogo')}</span></figcaption>
    </figure>
    <div class="gp-tabs" role="group" aria-label="Escolher prévia de câmera">${shots.map((s, i) => `<button type="button" data-camera="${i}" aria-pressed="${i === 0}" aria-controls="camera-preview">${ico(s[2], 40)}<span><b>${s[1]}</b><small>${s[3]}</small></span><i class="bar" aria-hidden="true"></i></button>`).join('')}<p class="foot-note">Capturas do próprio jogo. Mouse e teclado recomendados; controles de toque em teste.</p></div>
  </div>
</div></section>

<section class="section resources" aria-labelledby="recursos">${ghost('MECHS')}<div class="container">
  ${sectionHeading({ n: '02', label: 'Recursos', title: 'O QUE VOCÊ', em: 'ENCONTRA', id: 'recursos', aside: '<span class="label">Mechs diferentes. Estratégias infinitas.</span><p>Cada máquina tem partes que se destroem, armas que se combinam e um jeito próprio de lutar.</p>' })}
  <ol class="res-grid">${resources.map(([f, icon, img, p, z], i) => featureCard({ img: art(img), pos: p, zoom: z, icon, title: f.title, text: inline(f.text), n: `0${i + 1}` })).join('')}</ol>
</div></section>

<section class="section ptw-sec" aria-labelledby="ptw"><div class="container"><div class="ptw reveal">
  <div class="ptw-head"><p class="label">Jogo limpo, sem vantagens injustas</p><h2 class="h2" id="ptw">SEM <em>PAY-TO-WIN</em></h2></div>
  <ul class="ptw-list">${promiseRows.map(([icon, head, text]) => `<li><span class="ptw-ico">${ico(icon, 34)}</span><div><h3>${esc(head)}</h3><p>${text}</p></div></li>`).join('')}</ul>
</div></div></section>

<section class="section hangar" id="hangar" aria-labelledby="hangar-t">${ghost('HANGAR')}<div class="container">
  ${sectionHeading({ n: '03', label: 'Hangar', title: 'MONTE O', em: 'SEU MECH', id: 'hangar-t', aside: '<span class="label">Armas / módulos / chassis</span><p>Todo poder pesa: a montagem tem de caber na carga do chassi, e a luta decide quem vence. Os números abaixo são os do código do jogo.</p>' })}
  <div class="hg-grid">
    <div class="hg-stage reveal" id="hg-stage"><img src="${art('cena-hangar.jpg')}" width="1000" height="1000" alt="${esc(MAR.name)} no hangar, com as seis partes numeradas" loading="lazy">${parts.map((p, i) => `<button type="button" class="mk" data-part="${i}" style="left:${p[3][0]}%;top:${p[3][1]}%" aria-label="${p[0]}">${i + 1}</button>`).join('')}<p class="stage-cap"><b>${esc(MAR.name)}</b> · ${nf(MAR.height, 1)} m · carga ${nf(MAR.weaponCapacity)} t</p></div>
    <ol class="hg-list">${parts.map((p, i) => `<li class="reveal" data-part="${i}"><span class="n">${i + 1}</span><div><h3>${p[0]} <span>${esc(p[1])}</span></h3><p>${esc(p[2])}</p></div></li>`).join('')}</ol>
  </div>
</div></section>

<section class="section lineup" aria-labelledby="chassis-t"><div class="lineup-photo reveal">
  <img src="${art('cena-escala.jpg')}" width="2400" height="800" alt="Andróide, Vector-09 e Colossus-01 lado a lado, na mesma escala, com o Colossus-V4 por trás" loading="lazy">
  ${chassis.map(([id]) => { const e = escala[id]; const atras = id === 'colossusv4'; const x = e.base[0].toFixed(1); const y = atras ? Math.max(e.topo[1] - 2, 2).toFixed(1) : (e.base[1] + 2.4).toFixed(1); return `<p class="mtag${atras ? ' back' : ''}" style="left:${x}%;top:${y}%"><b>${NOME[id]}</b><span>Tamanho ${game.sizes[id]} · ${metros(CH[id].height)}</span></p>`; }).join('')}
</div><div class="container">
  ${sectionHeading({ n: '04', label: 'Chassis', title: 'ESCOLHA', em: 'O CHASSI', id: 'chassis-t', aside: '<span class="label">Mesma régua, tamanhos diferentes</span><p>Do andróide de 1,6 m ao gigante de 20 m: cada chassi tem blindagem, velocidade e carga próprias. A foto mostra os quatro na mesma escala, com o maior ao fundo.</p>' })}
  <div class="mech-grid">${chassis.map(([id, role, desc]) => {
    const ch = CH[id];
    const s = game.hangar.factorySpec(id);
    if (!game.hangar.validateLoadout(s).ok) throw new Error(`Montagem de divulgação inválida: ${id}`);
    const key = game.hangar.loadoutKey(s);
    return `<article class="mech-card panel reveal"><p class="label">Tamanho ${game.sizes[id]} · ${esc(role)}</p><h3>${esc(ch.name)}</h3><p class="desc">${desc}</p><dl><div><dt>Altura</dt><dd>${metros(ch.height)}</dd></div><div><dt>Torso</dt><dd>${nf(ch.maxModuleHealth.torso)}</dd></div><div><dt>Carga</dt><dd>${nf(ch.weaponCapacity)} t</dd></div></dl><a class="text-link" href="./jogar/?build=${esc(key)}" data-evento="click_cockpit">Pilotar ${esc(ch.name)} ${ico('arrowUR', 18)}</a></article>`;
  }).join('')}</div>
</div></section>

<section class="section arsenal" id="arsenal" aria-labelledby="arsenal-t">${ghost('ARSENAL')}<div class="container">
  ${sectionHeading({ n: '05', label: 'Arsenal', title: 'TRÊS NÍVEIS', em: 'DE PODER', id: 'arsenal-t', aside: '<span class="label">Mesmas regras. Mais combinações.</span><p>Cada arma tem três níveis, com características únicas. Todos os números vêm da mesma simulação do jogo.</p>' })}
  <div class="w-grid">${weaponCards.map((w) => `<article class="wcard panel reveal"><header><img src="${art(`cena-arma-${w.id}.jpg`)}" width="640" height="420" alt="${esc(w.name)}, modelo do jogo" loading="lazy"><div><h3>${esc(w.name)}</h3><p class="label">${KIND[w.kind] ?? w.kind} · ${w.class} · ${w.slot}</p></div></header>
    <table><thead><tr><th></th>${w.tiers.map((t) => `<th>${esc(t.label)}</th>`).join('')}</tr></thead><tbody>
      <tr class="big"><th>Dano por tiro</th>${w.tiers.map((t) => `<td>${nf(t.damage)}</td>`).join('')}</tr>
      <tr><th>Cadência</th>${w.tiers.map((t) => `<td>${nf(t.rate, 1)}/s</td>`).join('')}</tr>
      <tr><th>Calor por tiro</th>${w.tiers.map((t) => `<td>${nf(t.heat * 100)}%</td>`).join('')}</tr>
      <tr><th>Dano sustentado</th>${w.tiers.map((t) => `<td>${nf(t.dps)}</td>`).join('')}</tr>
      <tr><th>Massa</th>${w.tiers.map((t) => `<td>${nf(t.mass, 1)} t</td>`).join('')}</tr>
    </tbody></table></article>`).join('')}</div>
  <p class="foot-note">Medido no Vector-09, contra o torso do mesmo robô, com todos os tiros no alvo. Veja os outros chassis e o resto do arsenal na <a href="./oficina/">Oficina</a>.</p>
</div></section>

<section class="section modes" id="modos" aria-labelledby="modos-t"><div class="container">
  ${sectionHeading({ n: '06', label: 'Operações', title: 'ESCOLHA', em: 'SEU COMBATE', id: 'modos-t', aside: '<p>Comece contra a IA ou dispute uma sala online.</p>' })}
  <div class="mode-grid">${modes.map(([n, name, title, desc, href, file, tag, p]) => `<article class="mode-card reveal"><img src="${art(file)}" width="1280" height="720" alt="${esc(name)}, cenário do Cybermech" loading="lazy" style="object-position:${p}"><div class="mode-body"><p class="label">${n} / ${tag}</p><h3>${title}</h3><p class="desc">${desc}</p><a class="text-link" href="${href}" data-evento="${n === '03' ? 'click_online' : 'click_cockpit'}">Jogar ${name} ${ico('arrowUR', 18)}</a></div></article>`).join('')}</div>
</div></section>

<section class="section squad" aria-labelledby="esquadra">${ghost('ESQUADRÃO')}<div class="container">
  ${sectionHeading({ n: '07', label: 'Esquadrão', title: 'UM COMANDANTE.', em: 'UMA ESQUADRA DE IAs.', id: 'esquadra', aside: '<p>Cada IA trabalha no próprio território de arquivos e prova o que entrega com testes. Ninguém muda o rumo sem o aval do Comandante.</p>' })}
  <ul class="squad-grid">${squad.map(([id, name, role, c]) => `<li class="reveal" style="--c:${c}"><img src="${art(`eq-${id}.jpg`)}" width="350" height="232" alt="" loading="lazy"><div><h3>${name}</h3><p class="label">${role}</p></div></li>`).join('')}</ul>
  <p class="squad-cta">${gameButton({ label: 'Conheça a esquadra e acompanhe o desenvolvimento', href: './sala-de-controle/', event: 'click_como_e_feito', variant: 'ghost' })}</p>
</div></section>

<section class="section briefing" aria-labelledby="primeira-missao"><div class="container brief-grid"><div class="reveal">${sectionHeading({ n: '08', label: 'Primeira partida', title: 'PRONTO PARA', em: 'ASSUMIR O CONTROLE?', id: 'primeira-missao' })}<p class="lead">Abra o jogo e aguarde a preparação da partida. Clique em Jogar para assumir o Mech; pressione Esc quando quiser ajustar sua montagem ou as configurações.</p>${gameButton({ label: 'ENTRAR NO COCKPIT', href: './jogar/', event: 'click_cockpit', variant: 'big' })}</div>
  <div class="reveal"><dl class="control-grid panel"><div><dt><kbd>W A S D</kbd></dt><dd>Movimentar</dd></div><div><dt><kbd>Mouse</kbd></dt><dd>Mirar</dd></div><div><dt><kbd>Clique</kbd></dt><dd>Ataque 1</dd></div><div><dt><kbd>Clique dir.</kbd></dt><dd>Ataque 2</dd></div><div><dt><kbd>Shift</kbd></dt><dd>Dash</dd></div><div><dt><kbd>Espaço</kbd></dt><dd>Saltar</dd></div></dl><p class="foot-note">Teclas padrão. Remapeamento e sensibilidade em Configurações.</p></div></div></section>

<section class="section faq" aria-labelledby="perguntas"><div class="container narrow">${sectionHeading({ n: '09', label: 'Antes de entrar', title: 'INFORMAÇÕES', em: 'DO PILOTO', id: 'perguntas' })}
  <details><summary>Preciso criar uma conta?</summary><p>Não. Você pode começar a jogar sem cadastro. A progressão atual fica salva neste navegador.</p></details>
  <details><summary>Posso jogar sozinho?</summary><p>Sim. Arena e Sobrevivência têm oponentes controlados pela IA e não dependem de uma sala multiplayer disponível.</p></details>
  <details><summary>O jogo funciona no celular?</summary><p>Há controles de toque em teste. Para a experiência principal, use um computador com mouse, teclado e navegador compatível com WebGL2.</p></details>
  <details><summary>Onde acompanho as atualizações?</summary><p>O <a href="./sala-de-controle/">Esquadrão</a> apresenta a equipe, as entregas e o desenvolvimento. A <a href="./oficina/">Oficina</a> reúne os atributos e as análises de combate.</p></details></div></section>
</main>
${hudFooter({ base: '' })}`;

const script = `${HUD_JS}
(() => {
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  if (hero && 'IntersectionObserver' in window) { root.classList.add('home'); new IntersectionObserver(([e]) => root.classList.toggle('past-hero', !e.isIntersecting), { rootMargin: '-80px 0px 0px 0px' }).observe(hero); }
  const buttons = [...document.querySelectorAll('[data-camera]')];
  const slides = [...document.querySelectorAll('.camera-slide')];
  const label = document.getElementById('cam-label'), desc = document.getElementById('cam-desc');
  let current = 0, timer;
  const area = document.querySelector('.gameplay');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const show = (index) => {
    current = index;
    slides.forEach((s, i) => { s.classList.toggle('on', i === index); const img = s.querySelector('img'); if (i === index && img?.loading === 'lazy') img.loading = 'eager'; });
    buttons.forEach((b, i) => { b.setAttribute('aria-pressed', String(i === index)); b.classList.remove('run'); if (i === index) { void b.offsetWidth; b.classList.add('run'); } });
    const b = buttons[index]; if (b) { if (label) label.textContent = b.querySelector('b').textContent; if (desc) desc.textContent = b.querySelector('small').textContent; }
  };
  const pause = () => { clearInterval(timer); buttons.forEach((b) => b.classList.add('still')); };
  const resume = () => { clearInterval(timer); buttons.forEach((b) => b.classList.remove('still')); if (slides.length > 1 && !reduced.matches && !document.hidden && !area.matches(':hover, :focus-within')) timer = setInterval(() => show((current + 1) % slides.length), 6500); };
  buttons.forEach((b, i) => b.addEventListener('click', () => { show(i); pause(); }));
  area.addEventListener('mouseenter', pause); area.addEventListener('mouseleave', resume);
  area.addEventListener('focusin', pause); area.addEventListener('focusout', () => setTimeout(resume, 0));
  reduced.addEventListener('change', resume); document.addEventListener('visibilitychange', resume); show(0); resume();
  const parts = [...document.querySelectorAll('[data-part]')];
  const light = (i, on) => parts.forEach((p) => p.dataset.part === String(i) && p.classList.toggle('on', on));
  parts.forEach((p) => { const i = p.dataset.part; p.addEventListener('mouseenter', () => light(i, true)); p.addEventListener('mouseleave', () => light(i, false)); p.addEventListener('focus', () => light(i, true)); p.addEventListener('blur', () => light(i, false)); });
  const statusUrl = ${JSON.stringify(game.net.statusUrl)};
  if (statusUrl) {
    const status = document.querySelector('#srv'); let pending = false;
    const ask = async () => {
      if (document.hidden || pending) return; pending = true;
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 7000);
      try { const response = await fetch(statusUrl, { cache: 'no-store', credentials: 'omit', signal: controller.signal }); if (!response.ok) throw Error(); const data = await response.json(); if (!Number.isInteger(data.players) || data.players < 0) throw Error();
        status.dataset.state = 'online'; status.querySelector('span').textContent = data.players ? data.players + (data.players === 1 ? ' piloto online' : ' pilotos online') : 'Servidor online';
      } catch { status.dataset.state = 'unknown'; status.querySelector('span').textContent = 'Modo solo disponível'; }
      finally { clearTimeout(timeout); pending = false; }
    }; ask(); setInterval(ask, ${game.net.statusPollS * 1000}); document.addEventListener('visibilitychange', ask);
  }
  const url = ${JSON.stringify(game.net.eventoUrl)};
  if (url) {
    // A audiência (P188): a mesma classificação do jogo, embutida do código-fonte (scripts/site/audiencia-landing.mjs). Só categorias: de onde veio, aparelho, idioma, novo ou recorrente.
    const { Audiencia, lerAmbiente, armazensDoNavegador } = ${AUDIENCIA_JS};
    const audiencia = new Audiencia(lerAmbiente(), armazensDoNavegador());
    const aba = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const send = (nome, o) => { try { const body = JSON.stringify(o ? { nome, aba, o } : { nome, aba }); if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], {type:'text/plain'})); else fetch(url, {method:'POST', body, keepalive:true}).catch(() => {}); } catch {} };
    send('landing_view', audiencia.visita());
    document.querySelectorAll('[data-evento]').forEach(el => el.addEventListener('click', () => send(el.dataset.evento, audiencia.funil())));
  }
})();`;
const html = pagina({ title: 'CYBERMECH — Combate de Mechs no navegador', description: 'Pilote seu Mech, configure o arsenal e entre no combate. Grátis, direto no navegador, sem instalação e sem pay-to-win.', css: hudCss('') + LANDING_CSS, body: `${body}\n<script type="module" src="idioma.js"></script>`, script, og: { url: SITE_URL, image: `${SITE_URL}${art('cena-hero.jpg')}` } });
mkdirSync(ROOT, { recursive: true });
writeFileSync(OUT, html);
// O idioma (P178): o módulo e os dicionários da landing ficam ao lado da página (`idioma.js`, `locales/<id>.json`).
copyFileSync(resolve('scripts/site/idioma-landing.js'), join(ROOT, 'idioma.js'));
mkdirSync(join(ROOT, 'locales'), { recursive: true });
for (const f of readdirSync(resolve('scripts/site/locales'))) if (f.endsWith('.json')) copyFileSync(resolve('scripts/site/locales', f), join(ROOT, 'locales', f));
console.log(`landing ${OUT}: catálogo real, ${resources.length} recursos, ${weaponCards.length} armas, ${shots.length} câmeras`);
