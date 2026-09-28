/**
 * Visual comum das páginas do site: terminal de fósforo âmbar dos anos 80/90 (Shadowrun, BattleTech).
 * Um visual só, escuro de propósito. Cada página soma o próprio CSS ao BASE_CSS.
 */

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Markdown mínimo dos arquivos do projeto: `código` e **negrito**. */
export const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
export const upper = (s) => esc(s).toUpperCase();
export const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
export const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
export const brDate = (iso) => iso.split('-').reverse().slice(0, 2).join('/');

/** Grade hexagonal (estilo mapa de BattleTech), em SVG embutido. */
export const HEXGRID = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'><path d='M28 0 L56 16 L56 48 L28 64 L0 48 L0 16 Z M28 64 L28 97' fill='none' stroke='rgba(255,176,0,0.07)' stroke-width='1'/></svg>`,
);

export const BASE_CSS = `
  :root {
    color-scheme: dark;
    --bg: #070604; --panel: #0c0a06; --panel2: #120e07;
    --line: rgba(255,176,0,.2); --line2: rgba(255,176,0,.38); --grid: rgba(255,176,0,.12);
    --amber: #ffb000; --text: #ffcf70; --muted: #b8893a; --faint: #6e5424;
    --green: #7dff72; --bone: #f2e6cf; --red: #ff5a3c;
    --fd: 'VT323', 'Share Tech Mono', Consolas, monospace;
    --fb: 'Share Tech Mono', Consolas, 'Courier New', monospace;
    --fs: 'Saira Stencil One', 'Arial Black', Impact, sans-serif;
    --glow: 0 0 6px rgba(255,176,0,.45), 0 0 18px rgba(255,176,0,.15);
  }
  *, *::before, *::after { box-sizing: border-box; }
  html { background: var(--bg); -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: radial-gradient(ellipse 90% 70% at 50% 30%, #140f06 0%, var(--bg) 70%) fixed, var(--bg);
    color: var(--text);
    font: 400 15px/1.6 var(--fb);
    padding: 0 16px 72px;
    overflow-x: hidden;
  }
  /* CRT: linhas de varredura e vinheta por cima de tudo, sem pegar clique. */
  body::after {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 20;
    background: repeating-linear-gradient(to bottom, rgba(0,0,0,.22) 0 1px, transparent 1px 3px);
  }
  body::before {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 21;
    background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,.55) 100%);
  }
  .wrap { max-width: 1180px; margin: 0 auto; display: grid; gap: 64px; }
  section { display: grid; gap: 16px; min-width: 0; }
  h1, h2, h3 { margin: 0; font-weight: 400; text-wrap: balance; }
  h2 { font: 400 clamp(2rem, 3.6vw, 2.9rem)/1 var(--fd); letter-spacing: .04em; color: var(--amber); text-shadow: var(--glow); text-transform: uppercase; }
  h3 { font: 400 1.35rem/1.05 var(--fd); letter-spacing: .06em; color: var(--amber); }
  p { margin: 0; }
  b { color: var(--amber); font-weight: 400; }
  code { font: inherit; color: var(--bone); }
  a { color: var(--bone); }
  img { max-width: 100%; display: block; }
  .kicker { font: 400 12px/1.3 var(--fb); letter-spacing: .22em; text-transform: uppercase; color: var(--muted); }
  .lede { color: var(--muted); max-width: 66ch; text-wrap: pretty; }
  button { font: inherit; color: inherit; }
  :focus-visible { outline: 2px solid var(--bone); outline-offset: 3px; }

  /* Moldura de HUD: cantos em L, como retícula de cockpit. */
  .frame { position: relative; border: 1px solid var(--line); background: var(--panel); }
  .frame::before {
    content: ''; position: absolute; inset: -1px; pointer-events: none; z-index: 1;
    --c: var(--amber);
    background:
      linear-gradient(var(--c), var(--c)) top left / 14px 2px no-repeat,
      linear-gradient(var(--c), var(--c)) top left / 2px 14px no-repeat,
      linear-gradient(var(--c), var(--c)) top right / 14px 2px no-repeat,
      linear-gradient(var(--c), var(--c)) top right / 2px 14px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom left / 14px 2px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom left / 2px 14px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom right / 14px 2px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom right / 2px 14px no-repeat;
  }

  /* --- barra do sistema e navegação --- */
  .sysbar {
    display: flex; flex-wrap: wrap; gap: 6px 22px; justify-content: space-between; align-items: center;
    padding: 10px 0; border-bottom: 1px solid var(--line); color: var(--muted);
    font: 400 12px/1.3 var(--fb); letter-spacing: .14em; text-transform: uppercase;
  }
  .sysbar .live { color: var(--green); }
  .sysbar .live::before { content: '● '; }
  .nav { display: flex; flex-wrap: wrap; gap: 4px 18px; align-items: center; }
  .nav a { color: var(--muted); text-decoration: none; padding: 4px 0; }
  .nav a:hover, .nav a[aria-current="page"] { color: var(--amber); }
  .nav a[aria-current="page"] { border-bottom: 1px solid var(--amber); }
  .nav .nav-play { color: var(--bg); background: var(--amber); padding: 4px 10px; }
  .nav .nav-play:hover { color: var(--bg); background: var(--text); }

  /* --- chamada principal --- */
  .boot { color: var(--green); font: 400 13px/1.4 var(--fb); letter-spacing: .06em; }
  .cursor { animation: blink 1s step-end infinite; margin-left: 4px; }
  @keyframes blink { 50% { opacity: 0; } }
  /* Título: uma palavra só (CYBERMECH), duas cores — quebra sozinho se faltar espaço, nunca força duas linhas. */
  .title { font: 400 clamp(2.6rem, 6.6vw, 5.4rem)/1.05 var(--fd); letter-spacing: .03em; color: var(--amber); text-shadow: var(--glow); word-break: keep-all; margin: 2px 0 0; }
  .title span { color: var(--text); }
  .play-btn {
    display: inline-block; font: 400 clamp(1.05rem, 1.5vw, 1.3rem)/1 var(--fd); letter-spacing: .07em; color: var(--bg); background: var(--amber);
    padding: 13px 22px 11px; text-decoration: none; box-shadow: 0 0 24px rgba(255,176,0,.35); white-space: nowrap;
    transition: background .15s, box-shadow .15s;
  }
  .play-btn:hover { background: var(--text); box-shadow: 0 0 36px rgba(255,176,0,.55); }
  .play-btn:active { transform: translateY(1px); }
  .link-btn { color: var(--bone); text-decoration: none; letter-spacing: .12em; text-transform: uppercase; font-size: 13px; border-bottom: 1px dashed var(--bone); padding-bottom: 2px; }
  .link-btn:hover { color: var(--text); border-color: var(--text); }

  /* --- leituras numéricas --- */
  .sitrep { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; }
  .read { padding: 14px 16px; display: grid; gap: 6px; align-content: start; }
  .read .k { font-size: 11.5px; letter-spacing: .2em; color: var(--muted); text-transform: uppercase; }
  .read .v { font: 400 2.1rem/1 var(--fd); color: var(--amber); text-shadow: var(--glow); }
  .read .v small { font: 400 .95rem var(--fb); color: var(--muted); text-shadow: none; }

  /* --- chips de agente e frente --- */
  .agent { display: inline-block; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; padding: 1px 6px; border: 1px solid currentColor; }
  .agent.claude { color: #ff9a6b; } .agent.gemini { color: var(--bone); } .agent.codex { color: #5fd8a8; } .agent.dono { color: var(--amber); }

  footer { color: var(--faint); font-size: 12px; letter-spacing: .16em; text-transform: uppercase; border-top: 1px solid var(--line); padding-top: 14px; display: flex; flex-wrap: wrap; gap: 6px 18px; justify-content: space-between; }
  footer a { color: var(--muted); }

  /* Anti-cópia (pedido do dono, 27/09/2026): o texto público não é selecionável nem arrastável.
     É fricção contra quem tenta clonar o texto com o mouse — não é segurança: quem lê o código-fonte
     da página continua lendo o HTML, porque HTML é texto por definição. O que some é a seleção, o
     Ctrl+C e o Ctrl+S. Ver a checagem em scripts/site.mjs (--check e --verify). */
  .wrap, .wrap * { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
  .wrap img { -webkit-user-drag: none; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
`;

/**
 * O JavaScript da anti-cópia: sem seleção, o Ctrl+C não tem o que levar. Bloqueia os eventos de cópia
 * (mouse ou teclado), o recorte e o arrasto; Ctrl/Cmd+A, +C, +X e +S caem no mesmo bloqueio. De
 * propósito **não** bloqueia o menu do botão direito nem o Ctrl+U: não impedem ninguém de ler o HTML e
 * quebram o uso normal da página (abrir um link em outra aba, inspecionar o próprio jogo).
 */
const ANTI_COPY_JS = `(() => {
  const bloqueia = (e) => e.preventDefault();
  for (const tipo of ['copy', 'cut', 'dragstart', 'selectstart']) addEventListener(tipo, bloqueia, true);
  addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if ('acxs'.includes(e.key.toLowerCase())) e.preventDefault();
  }, true);
})();`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&family=Saira+Stencil+One&display=swap">`;

/**
 * Documento completo. Sem o <meta charset> o navegador lê o UTF-8 como Windows-1252 e quebra todos os
 * acentos (aconteceu no site em 24/09: o servidor mandava text/html sem charset); sem doctype, modo quirks.
 * `og` = { url, image } absolutos, para a prévia do link em redes e mensageiros.
 */
export function pagina({ title, description, css, body, script = '', og = null }) {
  const ogTags = og
    ? `
<meta property="og:type" content="website">
<meta property="og:site_name" content="CYBERMECH">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(og.url)}">${og.image ? `\n<meta property="og:image" content="${esc(og.image)}">\n<meta name="twitter:card" content="summary_large_image">` : ''}`
    : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="SERAFIM WEB">
<meta name="theme-color" content="#070604">${ogTags}
<link rel="icon" href="data:,">
${FONTS}
<style>${BASE_CSS}${css}</style>
</head>
<body>
<div class="wrap">
${body}
</div>
<script>${ANTI_COPY_JS}</script>
${script ? `<script>${script}</script>` : ''}
</body>
</html>
`;
}

/** Barra do topo com a navegação entre as páginas. `base` = caminho até a raiz do site. */
export function topo({ base, current, left, live }) {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<div class="sysbar">
    <span>${left}</span>
    ${live ? `<span class="live">${live}</span>` : ''}
    <nav class="nav" aria-label="Páginas">
      ${link(base, 'o jogo', 'jogo')}
      ${link(`${base}oficina/`, 'oficina', 'oficina')}
      ${link(`${base}sala-de-controle/`, 'sala de controle', 'sala')}
      <a class="nav-play" href="${base}jogar/">jogar</a>
    </nav>
  </div>`;
}
