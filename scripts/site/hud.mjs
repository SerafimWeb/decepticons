/**
 * Sistema de design do site CYBERMECH ONLINE (landing, oficina, sala de controle). Documento: `.decepticons/DESIGN_SYSTEM_SITE.md`.
 * Tokens, componentes (funções que devolvem HTML) e o script de interação ficam aqui; cada página só compõe.
 *
 * Tudo estático: sem WebGL, sem laço por frame. As animações são de CSS (opacity e transform) e param com
 * `prefers-reduced-motion`.
 */
import { esc } from './tema.mjs';

/* ============================== ícones ============================== */
/** Ícones de linha (24×24, o traço herda `currentColor`). */
const ICONS = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.2 3.2 14.8 0 18M12 3c-3.2 3.2-3.2 14.8 0 18"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c3 .2 5 2.2 5 5.3"/>',
  bolt: '<path d="M13 2 5 13.5h6L10 22l9-12.5h-6z"/>',
  tactical: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="11" r="1.3"/><circle cx="15" cy="11" r="1.3"/><path d="M8.5 15.2h7"/>',
  helmet: '<path d="M12 3C7.5 3 4.5 6.6 4.5 11v5.2L7.4 19h9.2l2.9-2.8V11C19.5 6.6 16.5 3 12 3z"/><path d="M8 10.5h8v3.2H8zM12 3v4"/>',
  crosshair: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.4"/><path d="M12 2v4.5M12 17.5V22M2 12h4.5M17.5 12H22"/>',
  burst: '<path d="m12 2.5 1.9 4.9 4.8-2.1-2 4.9 5 1.8-5 2 2 4.8-4.8-2-1.9 5-1.9-5-4.8 2 2-4.8-5-2 5-1.8-2-4.9 4.8 2.1z"/>',
  wrench: '<path d="M14.6 6.4a4 4 0 0 0-5 5L3 18l3 3 6.6-6.6a4 4 0 0 0 5-5l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  chip: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.2"/><path d="M9.5 2.5v4M14.5 2.5v4M9.5 17.5v4M14.5 17.5v4M2.5 9.5h4M2.5 14.5h4M17.5 9.5h4M17.5 14.5h4"/><rect x="10" y="10" width="4" height="4"/>',
  octagon: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M9 12h6M12 9v6"/>',
  xcircle: '<circle cx="12" cy="12" r="9"/><path d="m8.2 8.2 7.6 7.6M15.8 8.2l-7.6 7.6"/>',
  cube: '<path d="M12 2.8 4 7.4v9.2l8 4.6 8-4.6V7.4z"/><path d="M12 12 4 7.4M12 12l8-4.6M12 12v9.2"/>',
  bars: '<path d="M5 20V11M10 20V4M15 20v-8M20 20V8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  scan: '<circle cx="12" cy="12" r="3"/><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/>',
  thermo: '<path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z"/>',
  hex: '<path d="M12 2 21 7v10l-9 5-9-5V7z"/>',
  arrowR: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  arrowUR: '<path d="M7 17 17 7M8 7h9v9"/>',
  arrowD: '<path d="M12 4v15M6 13l6 6 6-6"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  legs: '<path d="M9 3h6v6l2 5-2 1v5h-3v-5l-1-4-1 4v5H7v-5l-2-1 2-5z"/>',
  arm: '<path d="M4 8h9l3 3v5h-3v-3H7v-1H4z"/><path d="M16 11h4v3h-4"/>',
  flame: '<path d="M12 3c1 3.500 5 5.500 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 2.500 1.500 2.500C10 9 10.500 5.500 12 3z"/>',
};
export const ico = (name, size = 24, cls = '') =>
  `<svg class="ico${cls ? ` ${cls}` : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] ?? ICONS.hex}</svg>`;

/** Marca: hexágono vazado com o cubo, o mesmo símbolo do jogo. */
export const LOGO_MARK = `<svg class="logo-mark" width="40" height="44" viewBox="0 0 40 44" aria-hidden="true"><path d="M20 2 37 11.500v21L20 42 3 32.500v-21z" fill="none" stroke="#ffd000" stroke-width="2.600" stroke-linejoin="round"/><path d="M20 22 9 15.800M20 22l11-6.200M20 22v13" fill="none" stroke="#ffd000" stroke-width="2.200" stroke-linecap="round"/><path d="M20 9.500 30 15.200 20 21 10 15.200z" fill="#ffd000"/></svg>`;

/* ============================== componentes ============================== */
const NAV = [
  ['inicio', 'INÍCIO', '', ''],
  ['combate', 'O JOGO', '#combate', ''],
  ['hangar', 'HANGAR', '#hangar', ''],
  ['modos', 'MODOS', '#modos', ''],
  ['oficina', 'OFICINA', 'oficina/', ''],
  ['sala', 'ESQUADRÃO', 'sala-de-controle/', 'click_como_e_feito'],
];

/**
 * SiteHeader: marca, links, estado do servidor e o CTA. O botão JOGAR AGORA é sempre o primeiro `a.play-btn`
 * (o teste do site clica nele). `base` = caminho até a raiz do site ('' na landing, '../' nas outras).
 */
export function hudNav({ base = '', current = 'inicio', status = false }) {
  const home = base === '';
  const href = (key, h) => (h.startsWith('#') ? (home ? h : `${base}${h}`) : key === 'inicio' ? base || './' : `${base}${h}`);
  const items = NAV.map(([key, label, h, ev]) => `<a href="${href(key, h)}"${current === key ? ' aria-current="page"' : ''}${ev ? ` data-evento="${ev}"` : ''}>${label}</a>`).join('');
  return `<a class="skip-link" href="#conteudo">Ir para o conteúdo</a>
<nav class="hnav" aria-label="Navegação principal">
  <a class="hlogo" href="${base || './'}" aria-label="CYBERMECH Online, início">${LOGO_MARK}<span><b>CYBER</b>MECH<small>ONLINE</small></span></a>
  <div class="hlinks">${items}</div>
  ${status ? statusIndicator() : ''}
  <a class="play-btn nav-play" href="${base}jogar/" data-evento="click_cockpit">JOGAR AGORA ${ico('arrowR', 18)}</a>
</nav>`;
}

/** StatusIndicator: o ponto e o texto que o script da landing preenche com o `GET /status` do servidor. */
export const statusIndicator = () => `<p class="srv" id="srv" role="status"><i></i><span>Consultando o servidor…</span></p>`;

/** SiteFooter. */
export function hudFooter({ base = '' }) {
  return `<footer class="hfoot"><a class="hlogo" href="${base || './'}">${LOGO_MARK}<span><b>CYBER</b>MECH<small>ONLINE</small></span></a>
  <p>© ${new Date().getFullYear()} SERAFIM WEB · Desenvolvido por Dan e uma equipe de IAs.</p>
  <div><a href="${base}oficina/">Oficina</a><a href="${base}sala-de-controle/">Esquadrão</a><a href="${base}jogar/">Jogar</a></div></footer>`;
}

/** Rótulo de seção: etiqueta numerada em amarelo (estêncil de hangar) + o nome. */
export const eyebrow = (text, n = '') => `<p class="eyebrow">${n ? `<b class="tag" aria-hidden="true">${esc(n)}</b>` : '<i aria-hidden="true"></i>'}<span>${esc(text)}</span></p>`;

/** GameButton: o CTA principal (primeiro nível) ou o secundário (contorno). */
export const gameButton = ({ label, href, event = '', variant = '', icon = 'arrowR' }) =>
  `<a class="${variant === 'ghost' ? 'btn-ghost' : `play-btn${variant ? ` ${variant}` : ''}`}" href="${href}"${event ? ` data-evento="${event}"` : ''}>${label}${icon ? ico(icon, variant === 'big' ? 24 : 18) : ''}</a>`;

/** SectionHeading: rótulo numerado, título em duas cores e nota lateral. */
export const sectionHeading = ({ n, label, title, em, aside = '', id }) =>
  `<div class="sec-head reveal"><div>${eyebrow(label, n)}<h2 class="h2"${id ? ` id="${id}"` : ''}>${title}${em ? ` <em>${em}</em>` : ''}</h2></div>${aside ? `<div class="aside">${aside}</div>` : ''}</div>`;

/** FeatureCard: imagem de capa, ícone, título e texto; o texto sobe ao passar o mouse (sempre visível no toque). */
export const featureCard = ({ img, pos = '50% 50%', zoom = 1, icon, title, text, n }) =>
  `<li class="fcard reveal"><img src="${img}" alt="" loading="lazy" style="object-position:${pos};transform-origin:${pos};--z:${zoom}"><span class="fnum" aria-hidden="true">${n}</span><div class="fbody"><span class="fico">${ico(icon, 28)}</span><h3>${esc(title)}</h3><p>${text}</p></div></li>`;

/** SectionBackground: palavra gigante em contorno atrás da seção (editorial, sem peso visual). */
export const ghost = (word) => `<span class="ghost" aria-hidden="true">${esc(word)}</span>`;

/* ============================== CSS ============================== */
/** CSS compartilhado. `base` entra nas URLs das fontes (hospedadas em jogar/fonts/). */
export function hudCss(base = '') {
  const f = (fam, file, w, style = 'normal') => `@font-face{font-family:'${fam}';src:url('${base}jogar/fonts/${file}.woff2') format('woff2');font-weight:${w};font-style:${style};font-display:swap}`;
  return `
${f('Chakra Petch', 'chakra-petch-600', 600)}${f('Chakra Petch', 'chakra-petch-700', 700)}${f('Chakra Petch', 'chakra-petch-700i', 700, 'italic')}${f('Barlow', 'barlow-400', 400)}${f('Barlow', 'barlow-600', 600)}
:root{--bg:#090b0f;--bg2:#0d1116;--graphite:#14191f;--panel:#11161c;--panel2:#161c23;--amber:#ffd000;--amber2:#ffe066;--amber-d:#bf9b00;--aline:rgba(255,208,0,.55);--aline-soft:rgba(255,208,0,.22);--line:#27313a;--line2:#4a5761;--text:#d7dce1;--muted:#97a1ac;--faint:#7d8996;--bone:#f4f4f1;--steel:#89929e;--blue:#35c8ff;--red:#ff4a3a;--orange:#ff8a1f;--green:#5dff8a;--pink:#ff3fa4;--violet:#a566ff;--fh:'Chakra Petch','Arial Narrow',Impact,sans-serif;--fb:'Barlow','Segoe UI',Arial,sans-serif;--fm:var(--fh);--fd:var(--fh);--fs:var(--fh);--glow:none;--ease:cubic-bezier(.2,.7,.2,1)}
html{scroll-behavior:smooth;scroll-padding-top:90px;background:var(--bg)}
body{padding:0;font:400 17px/1.65 var(--fb);color:var(--text);background:radial-gradient(1100px 600px at 100% -5%,rgba(255,170,0,.08),transparent 70%),radial-gradient(900px 700px at -10% 45%,rgba(53,200,255,.05),transparent 70%),var(--bg);background-attachment:fixed;text-rendering:optimizeLegibility}
body::before,body::after{display:none}
.wrap{display:block;max-width:none;gap:0}main{display:block}section{display:block}
h1,h2,h3,h4{text-shadow:none;letter-spacing:0;text-wrap:balance}
p{color:var(--muted)}b{font-weight:700;color:inherit}a{color:inherit;transition:color .18s,background .18s,border-color .18s,transform .18s}
.ico{flex:none;display:block}
.container{max-width:1280px;margin:0 auto;padding:0 40px}
.skip-link{position:absolute;top:0;left:20px;transform:translateY(-150%);z-index:100;padding:10px 14px;background:var(--amber);color:#000;font-weight:700}.skip-link:focus{transform:none}
[hidden]{display:none!important}
/* ---- tipografia ---- */
.eyebrow{display:flex;align-items:center;gap:12px;margin:0 0 20px;white-space:nowrap;font:600 14px/1 var(--fh);letter-spacing:.24em;text-transform:uppercase;color:var(--amber)}
.eyebrow .tag{display:inline-block;padding:5px 12px 5px 9px;background:var(--amber);color:#0a0a08;font:700 13px/1 var(--fh);letter-spacing:.08em;clip-path:polygon(0 0,100% 0,calc(100% - 7px) 100%,0 100%)}
.eyebrow i{width:26px;height:3px;background:var(--amber)}
.h2{margin:0;font:italic 700 clamp(40px,5.4vw,78px)/.94 var(--fh);letter-spacing:-.012em;text-transform:uppercase;color:var(--bone)}
.h2 em{font-style:italic;color:var(--amber)}
.h1{margin:0;font:italic 700 clamp(48px,7.4vw,104px)/.9 var(--fh);letter-spacing:-.015em;text-transform:uppercase;color:#fff}
.h1 em{display:block;margin-top:.08em;font-size:.6em;color:var(--amber);font-style:italic}
.lead{margin:0;font-size:19px;line-height:1.6;color:var(--text);max-width:50ch;opacity:.92}
.label{font:600 13px/1.3 var(--fh);letter-spacing:.2em;text-transform:uppercase}
.section{position:relative;padding:110px 0}
.sec-head{display:flex;justify-content:space-between;align-items:flex-end;gap:48px;margin-bottom:48px}
.sec-head .aside{max-width:440px;font-size:16.5px;line-height:1.6;color:var(--muted)}
.sec-head .aside p{margin:0}.sec-head .aside .label{display:block;margin-bottom:10px;color:var(--amber)}
.ghost{position:absolute;right:-1vw;top:34px;z-index:0;pointer-events:none;user-select:none;font:italic 700 clamp(120px,19vw,320px)/.8 var(--fh);letter-spacing:-.02em;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.065);white-space:nowrap}
.section>.container{position:relative;z-index:1}
/* ---- botões ---- */
.play-btn,.btn{display:inline-flex;align-items:center;justify-content:center;gap:14px;padding:17px 34px;border:0;color:#0a0a08;text-decoration:none;font:700 16px/1 var(--fh);letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;cursor:pointer;background:linear-gradient(180deg,#ffe033 0%,#ffd000 55%,#f0bd00 100%);clip-path:polygon(16px 0,100% 0,calc(100% - 16px) 100%,0 100%);transition:filter .18s,transform .18s}
.play-btn:hover,.btn:hover{filter:brightness(1.1) saturate(1.05);color:#0a0a08;transform:translateY(-1px)}
.play-btn:active{transform:translateY(1px)}.play-btn:focus-visible,.btn:focus-visible{outline:3px solid #0a0a08;outline-offset:-8px}
.play-btn.big{padding:25px 48px;font-size:22px;gap:22px}
.play-btn .ico{transition:transform .18s}.play-btn:hover .ico{transform:translateX(4px)}
.btn-ghost{display:inline-flex;align-items:center;gap:12px;padding:16px 26px;color:var(--bone);border:1px solid rgba(255,255,255,.28);text-decoration:none;font:700 14px/1 var(--fh);letter-spacing:.14em;text-transform:uppercase;transform:skewX(-10deg)}
.btn-ghost>*{transform:skewX(10deg)}
.btn-ghost:hover{border-color:var(--amber);color:var(--amber);background:rgba(255,208,0,.08)}
.text-link{display:inline-flex;align-items:center;gap:12px;color:var(--bone);font:700 14px/1.4 var(--fh);letter-spacing:.14em;text-decoration:none;text-transform:uppercase}.text-link:hover{color:var(--amber)}.text-link .ico{color:var(--amber);transition:transform .18s}.text-link:hover .ico{transform:translate(3px,-3px)}
/* ---- painel: grafite liso, canto cortado e uma aba amarela ---- */
.panel{position:relative;background:linear-gradient(180deg,#171d24,#10151b);border:1px solid rgba(255,255,255,.08);clip-path:polygon(0 0,calc(100% - 24px) 0,100% 24px,100% 100%,0 100%)}
.panel::before{content:'';position:absolute;left:0;top:0;width:44px;height:4px;background:var(--amber);z-index:2}
.chip-tag{display:inline-block;padding:5px 10px;border:1px solid currentColor;font:600 12px/1.2 var(--fh);letter-spacing:.14em;text-transform:uppercase}
/* ---- cabeçalho ---- */
.hnav{position:sticky;top:0;z-index:60;display:flex;align-items:center;gap:30px;height:74px;padding:0 max(24px,calc((100vw - 1280px)/2 + 40px));background:linear-gradient(180deg,rgba(7,9,12,.96),rgba(7,9,12,.84));backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.07)}
.hlogo{display:flex;align-items:center;gap:13px;text-decoration:none;color:var(--bone);font:italic 700 24px/1 var(--fh);letter-spacing:.05em;flex:none}
.hlogo span{display:block}.hlogo b{color:var(--amber)}.hlogo small{display:block;margin:6px 0 0 2px;font:600 10px/1 var(--fh);letter-spacing:.6em;color:var(--amber);font-style:normal}
.logo-mark{filter:drop-shadow(0 0 8px rgba(255,208,0,.3))}
.hlinks{display:flex;gap:4px;margin:0 auto}
.hlinks a{position:relative;padding:10px 15px;font:600 14px/1 var(--fh);letter-spacing:.14em;color:var(--text);text-decoration:none;opacity:.8}
.hlinks a::after{content:'';position:absolute;left:15px;right:15px;bottom:2px;height:3px;background:var(--amber);transform:scaleX(0) skewX(-30deg);transform-origin:left;transition:transform .25s var(--ease)}
.hlinks a:hover{opacity:1;color:#fff}.hlinks a:hover::after,.hlinks a[aria-current=page]::after{transform:scaleX(1) skewX(-30deg)}
.hlinks a[aria-current=page]{opacity:1;color:var(--amber)}
.nav-play{padding:14px 24px;font-size:14px;letter-spacing:.12em}
.srv{display:flex;align-items:center;gap:9px;margin:0;font:600 13px/1 var(--fh);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.srv i{width:8px;height:8px;border-radius:50%;background:var(--faint);flex:none}.srv[data-state=online] i{background:var(--green);box-shadow:0 0 10px var(--green)}.srv[data-state=online]{color:var(--text)}
.srv span{max-width:26ch;overflow:hidden;text-overflow:ellipsis}
/* ---- rodapé ---- */
.hfoot{display:flex;align-items:center;gap:36px;justify-content:space-between;max-width:1280px;margin:0 auto;padding:40px 40px 52px;border-top:1px solid rgba(255,255,255,.08);color:var(--faint);text-transform:none;letter-spacing:0}
.hfoot p{margin:0;font:400 14px/1.6 var(--fb);color:var(--faint);max-width:46ch}
.hfoot>div{display:flex;gap:26px}.hfoot>div a{text-decoration:none;font:600 14px var(--fh);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}.hfoot>div a:hover{color:var(--amber)}
.hfoot .hlogo{font-size:20px}.hfoot .logo-mark{width:30px;height:33px}
/* ---- movimento: revelar ao rolar (só com JS; sem JS tudo aparece) ---- */
.js .reveal{opacity:0;transform:translateY(26px);transition:opacity .7s var(--ease),transform .7s var(--ease);transition-delay:var(--d,0s)}
.js .reveal.in{opacity:1;transform:none}
@media(max-width:1100px){.hnav{gap:16px}.hlinks a{padding:10px 9px;font-size:13px;letter-spacing:.08em}.srv{display:none}}
@media(max-width:860px){.hnav{height:auto;flex-wrap:wrap;padding:12px 20px;gap:10px 14px}.hlinks{order:3;flex:1 0 100%;margin:0;overflow-x:auto;gap:0;scrollbar-width:none}.hlinks::-webkit-scrollbar{display:none}.hlinks a{white-space:nowrap}.nav-play{margin-left:auto;padding:12px 18px;font-size:13px}.hlogo{font-size:20px}.container{padding:0 22px}.section{padding:72px 0}.sec-head{display:block;margin-bottom:34px}.sec-head .aside{margin-top:20px}.hfoot{flex-direction:column;align-items:flex-start;gap:18px;padding:30px 22px 40px}.play-btn.big{width:100%;padding:22px 24px;font-size:19px}.lead{font-size:17.5px}.ghost{display:none}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation:none!important;transition:none!important}.js .reveal{opacity:1;transform:none}}
`;
}

/** Script de interação comum: marca `js`, revela os blocos ao rolar e dá um leve paralaxe ao palco do herói. */
export const HUD_JS = `(() => {
  const root = document.documentElement; root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = [...document.querySelectorAll('.reveal')];
  if (reduce || !('IntersectionObserver' in window)) { items.forEach((e) => e.classList.add('in')); }
  else {
    const io = new IntersectionObserver((list) => list.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    items.forEach((e, i) => { e.style.setProperty('--d', (i % 4) * 0.07 + 's'); io.observe(e); });
  }
  const stage = document.querySelector('[data-parallax]');
  if (stage && !reduce && matchMedia('(pointer: fine)').matches) {
    let raf = 0;
    addEventListener('pointermove', (e) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const x = (e.clientX / innerWidth - 0.5), y = (e.clientY / innerHeight - 0.5); stage.style.transform = 'translate3d(' + (x * -14).toFixed(1) + 'px,' + (y * -8).toFixed(1) + 'px,0) scale(1.03)'; }); }, { passive: true });
  }
})();`;

/* ============================== páginas internas ============================== */
/** Abertura das páginas internas: rótulo, título em duas linhas, texto e arte à direita (esmaecida). */
export function pageHero({ base = '', eyebrowText, title, sub, pitch, art, extra = '' }) {
  return `<header class="p-hero">
  <img class="p-hero-art" src="${base}jogar/press/${art}" alt="" width="1200" height="600" fetchpriority="high">
  <div class="container">
    ${eyebrow(eyebrowText)}
    <h1 class="h1">${esc(title)}${sub ? `<em>${esc(sub)}</em>` : ''}</h1>
    <p class="pitch">${pitch}</p>
    ${extra}
  </div>
</header>`;
}

/** Tira o "// " dos rótulos antigos (o novo traz a barra por CSS). */
export const limpaRotulos = (html) => html.replace(/(<span class="kicker">)\/\/\s*/g, '$1');

/** Casca das páginas internas (oficina e sala de controle): reveste as classes antigas com o sistema novo. */
export const HUD_PAGE_CSS = `
.page{max-width:1280px;margin:0 auto;padding:72px 40px 110px;display:grid;gap:96px}
.page section{display:grid;gap:20px;min-width:0}
.page .kicker{display:flex;align-items:center;gap:12px;font:600 14px/1 var(--fh);letter-spacing:.24em;text-transform:uppercase;color:var(--amber)}
.page .kicker::before{content:'';width:26px;height:3px;background:var(--amber)}
.page h2{font:italic 700 clamp(30px,3.8vw,54px)/1 var(--fh);letter-spacing:-.005em;text-transform:uppercase;color:var(--bone);text-shadow:none}
.page h3{font-family:var(--fh);font-weight:700;letter-spacing:.04em}
.page .lede{color:var(--text);opacity:.9;font-size:17.5px;line-height:1.65;max-width:72ch}
.page p{color:var(--muted)}
.page .lede b,.page td b{color:var(--bone)}
.frame{position:relative;background:linear-gradient(180deg,#171d24,#10151b);border:1px solid rgba(255,255,255,.08);box-shadow:none;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,0 100%)}
.frame::before{content:'';position:absolute;left:0;top:0;width:44px;height:4px;inset:auto;right:auto;background:var(--amber)!important;z-index:2;pointer-events:none}
.sitrep{grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px}
.read{padding:22px 24px;gap:8px}
.read .k{font:600 13px/1.3 var(--fh);letter-spacing:.18em;color:var(--muted)}
.read .v{font:italic 700 clamp(34px,3.6vw,50px)/1 var(--fh);color:var(--amber);text-shadow:none}
.read .v small{font:500 14px/1.3 var(--fb);color:var(--muted);letter-spacing:.01em;font-style:normal}
.p-hero{position:relative;isolation:isolate;overflow:hidden;border-bottom:1px solid rgba(255,255,255,.08);padding:92px 0 84px}
.p-hero-art{position:absolute;right:0;top:0;z-index:-1;width:min(60%,900px);height:100%;object-fit:cover;object-position:50% 30%;filter:saturate(1.1) contrast(1.05);-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 42%),linear-gradient(180deg,#000 72%,transparent);-webkit-mask-composite:source-in;mask-image:linear-gradient(90deg,transparent 0,#000 42%),linear-gradient(180deg,#000 72%,transparent);mask-composite:intersect}
.p-hero::before{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,var(--bg) 0,rgba(9,11,15,.9) 32%,rgba(9,11,15,.3) 72%,transparent),linear-gradient(0deg,var(--bg),transparent 30%)}
.pitch{max-width:58ch;margin:26px 0 0;font-size:19px;line-height:1.6;color:#e1e5e9}
.p-hero .hero-meta{display:flex;flex-wrap:wrap;gap:12px 14px;margin-top:30px}
@media(max-width:860px){.page{padding:48px 22px 80px;gap:70px}.p-hero{padding:56px 0 50px}.p-hero-art{width:100%;opacity:.4}}
`;
