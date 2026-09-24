/**
 * Painel de missão: gera uma página com as fases (rota) e as frentes de trabalho a partir de
 * .decepticons/ROADMAP.md (fases, itens, frentes) e .decepticons/ESTADO_ATUAL.md (próxima missão, equipe),
 * mais o histórico de PRs mergeados (git). Visual: design system Serafim.
 *
 * Uso: npm run painel            → gera .tmp/painel/painel.html (G15: nada fora do projeto)
 *      node scripts/painel.mjs --check → só valida o formato do ROADMAP (roda no npm run check)
 *      node scripts/painel.mjs --site --out <arquivo> → versão do site (botão "Jogar" para ./jogar/)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROADMAP = resolve('.decepticons/ROADMAP.md');
const ESTADO = resolve('.decepticons/ESTADO_ATUAL.md');
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const SITE = argv.includes('--site');
const OUT = resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : '.tmp/painel/painel.html');

/** Sigla de 2 letras de cada frente no hexágono (apresentação; os dados vêm do ROADMAP). */
const CODES = {
  jogabilidade: 'JG',
  combate: 'CB',
  ia: 'IA',
  mechs: 'MC',
  cenarios: 'CN',
  ux: 'UX',
  som: 'SM',
  rede: 'MP',
  desempenho: 'DS',
  base: 'BT',
  negocio: 'NG',
};

// ---------- leitura ----------

function parseRoadmap(md) {
  const errors = [];
  const fronts = [];
  const phases = [];
  let current = null;
  md.split(/\r?\n/).forEach((line, i) => {
    const n = i + 1;
    const front = /^\|\s*`#([a-z-]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/.exec(line);
    if (front) {
      fronts.push({ tag: front[1], name: front[2], desc: front[3] });
      return;
    }
    if (line.startsWith('## ')) {
      const phase = /FASE\s+(\d+)\s+—\s+(.+)$/.exec(line);
      if (phase) {
        const focus = /\(atual\)/i.test(phase[2]);
        const title = phase[2].replace(/\s*\([^)]*\)\s*$/, '').trim();
        current = { num: Number(phase[1]), title, focus, ideas: false, items: [] };
        phases.push(current);
      } else if (/IDEIAS/i.test(line)) {
        current = { num: null, title: 'Ideias', focus: false, ideas: true, items: [] };
        phases.push(current);
      } else {
        current = null;
      }
      return;
    }
    const item = /^- \[( |x|~)\]\s+(.+)$/.exec(line);
    if (!item || !current) return;
    const tagged = /^(.*?)\s+#([a-z-]+)\s*$/.exec(item[2]);
    if (!tagged) {
      errors.push(`linha ${n}: item sem etiqueta de frente: "${item[2].slice(0, 60)}"`);
      return;
    }
    const status = item[1] === 'x' ? 'done' : item[1] === '~' ? 'doing' : 'todo';
    current.items.push({ status: current.ideas && status === 'todo' ? 'idea' : status, text: tagged[1], tag: tagged[2], line: n });
  });

  const known = new Set(fronts.map((f) => f.tag));
  if (fronts.length === 0) errors.push('tabela de FRENTES não encontrada (linhas "| `#etiqueta` | Frente | O que cobre |")');
  for (const p of phases) {
    if (p.items.length === 0) errors.push(`${p.ideas ? 'IDEIAS' : `FASE ${p.num}`} sem itens`);
    for (const it of p.items) if (!known.has(it.tag)) errors.push(`linha ${it.line}: etiqueta #${it.tag} não está na tabela de FRENTES`);
  }
  const focused = phases.filter((p) => p.focus);
  if (focused.length !== 1) errors.push(`precisa de exatamente uma fase com "(atual)"; há ${focused.length}`);
  if (!phases.some((p) => !p.ideas)) errors.push('nenhuma fase "## … FASE N — Título" encontrada');
  return { fronts, phases, errors };
}

function parseEstado(md) {
  const section = (title) => {
    const m = new RegExp(`^## ${title}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(md);
    return m ? m[1].trim() : '';
  };
  const next = section('PRÓXIMA SESSÃO');
  const team = [];
  for (const line of section('DIVISÃO DE TRABALHO').split(/\r?\n/)) {
    const row = /^\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (row && !/zona/i.test(row[1])) team.push({ name: row[1], role: row[3] });
  }
  const status = /\*\*Iteração atual:\*\*\s*(.+)/.exec(md)?.[1] ?? '';
  return { next, team, status };
}

/** Sem shell: argumentos em lista. Fora de um repositório git, devolve vazio. */
function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// ---------- validação ----------

const roadmap = parseRoadmap(readFileSync(ROADMAP, 'utf8'));
if (roadmap.errors.length) {
  console.error('❌ ROADMAP.md fora do formato do painel:');
  for (const e of roadmap.errors) console.error(`   - ${e}`);
  process.exit(1);
}
if (CHECK) {
  const items = roadmap.phases.flatMap((p) => p.items).length;
  console.log(`painel  ROADMAP ok: ${roadmap.fronts.length} frentes, ${roadmap.phases.length} grupos, ${items} itens`);
  process.exit(0);
}

// ---------- números ----------

const estado = parseEstado(readFileSync(ESTADO, 'utf8'));
const { fronts, phases } = roadmap;
const phaseItems = phases.filter((p) => !p.ideas).flatMap((p) => p.items);
const done = phaseItems.filter((i) => i.status === 'done').length;
const total = phaseItems.length;
const ideasCount = phases.filter((p) => p.ideas).flatMap((p) => p.items).length;
const focus = phases.find((p) => p.focus);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

for (const p of phases) {
  const d = p.items.filter((i) => i.status === 'done').length;
  p.done = d;
  p.state = p.ideas
    ? 'ideas'
    : d === p.items.length
      ? 'done'
      : p.focus
        ? 'focus'
        : d === 0 && p.num > focus.num
          ? 'locked'
          : 'open';
}

/** Estado de cada frente no vocabulário de um painel de Mech, pelo quanto já foi feito. */
const RANKS = [
  [1, 'MAXIMIZADO', 'max'],
  [0.67, 'NOMINAL', 'ok'],
  [0.34, 'OPERACIONAL', 'op'],
  [0.01, 'CRÍTICO', 'crit'],
  [0, 'OFFLINE', 'off'],
];
const frontStats = fronts.map((f) => {
  const items = phases.flatMap((p) => p.items.map((it) => ({ ...it, phase: p })).filter((it) => it.tag === f.tag));
  const d = items.filter((i) => i.status === 'done').length;
  const ratio = items.length ? d / items.length : 0;
  const [, rank, rankClass] = RANKS.find(([min]) => ratio >= min);
  return { ...f, items, done: d, ratio, rank, rankClass };
});

const head = git('log', '-1', '--format=%h·%cs');
const feed = git('log', '--merges', '--first-parent', '--format=%cs%x09%s', '-8')
  .split('\n')
  .map((l) => /^(\S+)\t.*?PR #(\d+):\s*(.+)$/.exec(l))
  .filter(Boolean)
  .map(([, date, n, title]) => ({ date, n, title }));

/** Ficha técnica do Vector-09 lida do código do jogo (R14). Se o formato mudar, a seção some em vez de mentir. */
function recordSheet() {
  try {
    const v = readFileSync(resolve('client/src/entities/Vector09.ts'), 'utf8');
    const p = readFileSync(resolve('client/src/combat/ProjectileSystem.ts'), 'utf8');
    const n = (src, key) => Number(new RegExp(`\\b${key}:\\s*([\\d.]+)`).exec(src)?.[1]);
    const armor = [
      ['CABEÇA', n(v, 'head')],
      ['TORSO', n(v, 'torso')],
      ['BRAÇO E', n(v, 'leftArm')],
      ['BRAÇO D', n(v, 'rightArm')],
      ['PERNA E', n(v, 'leftLeg')],
      ['PERNA D', n(v, 'rightLeg')],
    ];
    const s = {
      name: /name:\s*'([^']+)'/.exec(v)?.[1],
      speed: n(v, 'moveSpeed'),
      dash: n(v, 'dashSpeed'),
      jumps: n(v, 'maxJumps'),
      fire: n(v, 'fireInterval'),
      damage: Number(/const DAMAGE = (\d+)/.exec(p)?.[1]),
      armor,
    };
    const nums = [s.speed, s.dash, s.jumps, s.fire, s.damage, ...armor.map((a) => a[1])];
    return s.name && nums.every((x) => Number.isFinite(x) && x > 0) ? s : null;
  } catch {
    return null;
  }
}

/** O princípio "não é pay-to-win", do GAME_DESIGN.md (fonte única). */
function pledge() {
  try {
    const g = readFileSync(resolve('.decepticons/GAME_DESIGN.md'), 'utf8').replace(/\r\n/g, '\n');
    const sec = /## PRINCÍPIO: NÃO É PAY-TO-WIN[^\n]*\n([\s\S]*?)\n---/.exec(g)?.[1] ?? '';
    return [...sec.matchAll(/^- (.+)$/gm)].map((m) => m[1]);
  } catch {
    return [];
  }
}

// ---------- HTML ----------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
const TAG = { done: 'OK', doing: '>>', todo: '--', idea: '??' };
const STATUS_LABEL = { done: 'feito', doing: 'em andamento', todo: 'a fazer', idea: 'ideia' };
const PHASE_LABEL = { done: 'CONCLUÍDA', focus: 'POSIÇÃO ATUAL', open: 'EM ABERTO', locked: 'NÃO LIBERADA', ideas: 'SEM ROTA' };
const phaseKey = (p) => (p.ideas ? 'ideias' : `f${p.num}`);
const phaseShort = (p) => (p.ideas ? 'IDEIA' : `F${p.num}`);
const upper = (s) => esc(s).toUpperCase();

const routeHtml = phases
  .map((p) => {
    const ratio = p.items.length ? p.done / p.items.length : 0;
    const count = p.ideas ? `${p.items.length} NA FILA` : `${p.done}/${p.items.length}`;
    return `<li class="node ${p.state}">
      <button type="button" class="node-btn" data-phase="${phaseKey(p)}" aria-pressed="false" title="Filtrar os sistemas por esta fase">
        <span class="hex"><span>${p.ideas ? '?' : p.num}</span></span>
        <span class="node-label">${PHASE_LABEL[p.state]}</span>
        <span class="node-title">${upper(p.title)}</span>
        <span class="node-bar"><i style="width:${Math.round(ratio * 100)}%"></i></span>
        <span class="node-count">${count}</span>
      </button>
    </li>`;
  })
  .join('');

const frontsHtml = frontStats
  .map((f) => {
    const code = CODES[f.tag] ?? f.tag.slice(0, 2).toUpperCase();
    const slots = f.items.map((it) => `<i class="s ${it.status}"></i>`).join('');
    const list = f.items
      .map(
        (it) =>
          `<li class="it ${it.status}" data-status="${it.status}" data-phase="${phaseKey(it.phase)}"><span class="tag" aria-label="${STATUS_LABEL[it.status]}">[${TAG[it.status]}]</span><span class="t">${inline(it.text)}</span><span class="ph">${phaseShort(it.phase)}</span></li>`,
      )
      .join('');
    return `<article class="front frame r-${f.rankClass}" data-front="${f.tag}">
      <header>
        <span class="code" aria-hidden="true">${code}</span>
        <div class="fh"><h3>${upper(f.name)}</h3><p>${esc(f.desc)}</p></div>
        <div class="state"><span class="rank">${f.rank}</span><span class="pct">${Math.round(f.ratio * 100)}%</span></div>
      </header>
      <div class="slots" role="img" aria-label="${f.done} de ${f.items.length} itens feitos">${slots}</div>
      <ul class="items">${list}</ul>
      <p class="empty-note">SEM ENTRADAS NESTE FILTRO</p>
    </article>`;
  })
  .join('');

const sheet = recordSheet();
const maxArmor = sheet ? Math.max(...sheet.armor.map((a) => a[1])) : 1;
const sheetHtml = sheet
  ? `<section aria-labelledby="ficha" class="grid-2">
    <div>
      <span class="kicker">// ficha técnica · chassi em serviço</span>
      <h2 id="ficha">${esc(sheet.name)}</h2>
      <p class="lede">Números lidos direto do código do jogo: mudou no jogo, muda aqui.</p>
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
        <div><dt>CADÊNCIA</dt><dd>${(1 / sheet.fire).toFixed(1)} tiros/s</dd></div>
      </dl>
    </div>
  </section>`
  : '';

const vows = pledge();
const pledgeHtml = vows.length
  ? `<aside class="pledge frame" aria-labelledby="p2w">
    <span class="stamp" id="p2w">SEM PAY-TO-WIN</span>
    <ul>${vows.map((v) => `<li>${inline(v)}</li>`).join('')}</ul>
  </aside>`
  : '';

const teamHtml = estado.team
  .map((m) => `<li><span class="who">${upper(m.name)}</span><span class="what">${inline(m.role)}</span></li>`)
  .join('');
const feedHtml = feed
  .map((f) => `<li><time>${f.date}</time><span class="pr">PR #${f.n}</span><span class="ft">${esc(f.title)}</span><span class="ok">[OK]</span></li>`)
  .join('');
const segs = Array.from({ length: 24 }, (_, i) => `<i class="${i < Math.round((done / total) * 24) ? 'on' : ''}"></i>`).join('');
const generated = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const playHtml = `<div class="play">
      <a class="play-btn" href="./jogar/">[ ENTRAR NO COCKPIT ]</a>
      <p class="keys"><b>WASD</b> mover · <b>MOUSE</b> mirar · <b>CLIQUE</b> atirar · <b>SHIFT</b> dash · <b>ESPAÇO</b> pulo duplo · <b>V</b> câmera · <b>'</b> desempenho · <b>F1</b> esconde o HUD</p>
    </div>`;

// Grade hexagonal do mapa de operações (estilo mapa de BattleTech), em SVG embutido.
const HEXGRID = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'><path d='M28 0 L56 16 L56 48 L28 64 L0 48 L0 16 Z M28 64 L28 97' fill='none' stroke='rgba(255,176,0,0.07)' stroke-width='1'/></svg>`,
);

// Documento completo: sem o <meta charset> o navegador lê o UTF-8 como Windows-1252 e quebra todos os
// acentos (aconteceu no site em 24/09: o servidor manda text/html sem charset); sem o doctype, modo quirks.
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Cyber-Mech Protocol: shooter de Mechs para o navegador. Jogue agora e acompanhe o desenvolvimento.">
<title>${SITE ? 'Cyber-Mech Protocol' : 'Painel de Missão Cyber-Mech'}</title>
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&family=Saira+Stencil+One&display=swap">
<style>
  /* Terminal de fósforo âmbar dos anos 80/90 (Shadowrun, BattleTech): um visual só, escuro de propósito. */
  :root {
    color-scheme: dark;
    --bg: #070604; --panel: #0c0a06; --panel2: #120e07;
    --line: rgba(255,176,0,.2); --line2: rgba(255,176,0,.38);
    --amber: #ffb000; --text: #ffcf70; --muted: #b8893a; --faint: #6e5424;
    --green: #7dff72; --cyan: #5ce1ff; --red: #ff5a3c;
    --fd: 'VT323', 'Share Tech Mono', Consolas, monospace;
    --fb: 'Share Tech Mono', Consolas, 'Courier New', monospace;
    --fs: 'Saira Stencil One', 'Arial Black', Impact, sans-serif;
    --glow: 0 0 6px rgba(255,176,0,.45), 0 0 18px rgba(255,176,0,.15);
  }
  html { background: var(--bg); }
  body {
    background: radial-gradient(ellipse 90% 70% at 50% 30%, #140f06 0%, var(--bg) 70%) fixed, var(--bg);
    color: var(--text);
    font: 400 15px/1.6 var(--fb);
    padding: 0 18px;
    padding-block: 0 72px;
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
  .wrap { max-width: 1180px; margin: 0 auto; display: grid; gap: 54px; }
  section { display: grid; gap: 16px; }
  h1, h2, h3 { margin: 0; font-weight: 400; text-wrap: balance; }
  h2 { font: 400 clamp(2rem, 3.6vw, 2.9rem)/1 var(--fd); letter-spacing: .04em; color: var(--amber); text-shadow: var(--glow); text-transform: uppercase; }
  h3 { font: 400 1.35rem/1.05 var(--fd); letter-spacing: .06em; color: var(--amber); }
  p { margin: 0; }
  b { color: var(--amber); font-weight: 400; }
  code { font: inherit; color: var(--cyan); }
  .kicker { font: 400 12px/1 var(--fb); letter-spacing: .22em; text-transform: uppercase; color: var(--muted); }
  .lede { color: var(--muted); max-width: 64ch; }
  button { font: inherit; color: inherit; }
  :focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; }

  /* Moldura de HUD: cantos em L, como retícula de cockpit. */
  .frame { position: relative; border: 1px solid var(--line); background: var(--panel); }
  .frame::before {
    content: ''; position: absolute; inset: -1px; pointer-events: none;
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

  /* --- barra do sistema --- */
  .sysbar {
    display: flex; flex-wrap: wrap; gap: 6px 22px; justify-content: space-between;
    padding: 10px 0; border-bottom: 1px solid var(--line); color: var(--muted);
    font: 400 12px/1.3 var(--fb); letter-spacing: .14em; text-transform: uppercase;
  }
  .sysbar .live { color: var(--green); }
  .sysbar .live::before { content: '● '; }

  /* --- briefing --- */
  .hero { display: grid; gap: 18px; padding-top: 26px; }
  .boot { color: var(--green); font: 400 13px/1.4 var(--fb); letter-spacing: .06em; }
  .cursor { animation: blink 1s step-end infinite; margin-left: 4px; }
  @keyframes blink { 50% { opacity: 0; } }
  .title { font: 400 clamp(3.2rem, 9vw, 7.4rem)/.86 var(--fd); letter-spacing: .02em; color: var(--amber); text-shadow: var(--glow); }
  .title span { display: block; color: var(--text); }
  .play { display: flex; flex-wrap: wrap; gap: 14px 24px; align-items: center; }
  .play-btn {
    font: 400 1.7rem/1 var(--fd); letter-spacing: .08em; color: var(--bg); background: var(--amber);
    padding: 12px 22px 10px; text-decoration: none; box-shadow: 0 0 24px rgba(255,176,0,.35);
    transition: background .15s, box-shadow .15s;
  }
  .play-btn:hover { background: var(--text); box-shadow: 0 0 36px rgba(255,176,0,.55); }
  .play-btn:active { transform: translateY(1px); }
  .keys { color: var(--muted); font-size: 13px; max-width: 72ch; }
  .sitrep { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
  .read { padding: 14px 16px; display: grid; gap: 6px; align-content: start; }
  .read .k { font-size: 11.5px; letter-spacing: .2em; color: var(--muted); text-transform: uppercase; }
  .read .v { font: 400 2rem/1 var(--fd); color: var(--amber); text-shadow: var(--glow); font-variant-numeric: tabular-nums; }
  .read .v small { font: 400 .95rem var(--fb); color: var(--muted); text-shadow: none; }
  .xp { display: grid; grid-template-columns: repeat(24, 1fr); gap: 2px; margin-top: 4px; }
  .xp i { height: 9px; background: rgba(255,176,0,.1); }
  .xp i.on { background: var(--amber); box-shadow: 0 0 6px rgba(255,176,0,.5); }

  /* --- rota em mapa hexagonal --- */
  .route {
    list-style: none; margin: 0; padding: 22px 6px 14px; display: grid;
    grid-template-columns: repeat(${phases.length}, 1fr);
    background: url("data:image/svg+xml,${HEXGRID}") center / 56px 97px, var(--panel);
    border: 1px solid var(--line);
  }
  .node { position: relative; display: flex; }
  .node:not(:last-child)::after {
    content: ''; position: absolute; top: 33px; left: calc(50% + 34px); right: calc(-50% + 34px); height: 0;
    border-top: 2px dashed var(--faint);
  }
  .node.done:not(:last-child)::after { border-top: 2px solid var(--green); }
  .node-btn {
    width: 100%; background: none; border: 0; cursor: pointer; padding: 0 6px 8px;
    display: grid; justify-items: center; align-content: start; gap: 7px; text-align: center;
  }
  .node-btn:hover .node-title { color: var(--amber); }
  .node-btn[aria-pressed="true"] { outline: 1px dashed var(--cyan); outline-offset: 4px; }
  .hex { width: 66px; height: 66px; display: grid; place-items: center; clip-path: polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%); background: var(--faint); }
  .hex span { width: 62px; height: 62px; display: grid; place-items: center; clip-path: inherit; background: var(--panel2); font: 400 2.1rem/1 var(--fd); color: var(--muted); }
  .done .hex { background: var(--green); } .done .hex span { color: var(--green); }
  .open .hex { background: var(--amber); } .open .hex span { color: var(--amber); }
  .focus .hex { background: var(--cyan); animation: lock 1.6s ease-in-out infinite; } .focus .hex span { color: var(--cyan); }
  .ideas .hex { background: repeating-linear-gradient(45deg, var(--muted) 0 3px, transparent 3px 6px); }
  @keyframes lock { 50% { filter: drop-shadow(0 0 12px rgba(92,225,255,.9)); } }
  .node-label { font-size: 10.5px; letter-spacing: .16em; color: var(--faint); }
  .done .node-label { color: var(--green); } .open .node-label { color: var(--amber); } .focus .node-label { color: var(--cyan); }
  .node-title { font: 400 1.2rem/1.05 var(--fd); letter-spacing: .04em; color: var(--text); max-width: 14ch; }
  .locked .node-title { color: var(--muted); }
  .node-bar { width: 70%; height: 4px; background: rgba(255,176,0,.12); }
  .node-bar i { display: block; height: 100%; background: var(--green); }
  .node-count { font-size: 12px; color: var(--muted); letter-spacing: .08em; font-variant-numeric: tabular-nums; }

  /* --- sistemas (frentes) --- */
  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .chip { background: var(--panel); border: 1px solid var(--line2); padding: 6px 12px; font: 400 12px/1 var(--fb); letter-spacing: .14em; color: var(--muted); cursor: pointer; text-transform: uppercase; }
  .chip:hover { color: var(--amber); border-color: var(--amber); }
  .chip[aria-pressed="true"] { background: var(--amber); color: var(--bg); border-color: var(--amber); }
  .phase-pill { display: none; gap: 10px; align-items: center; margin-left: auto; color: var(--cyan); font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }
  .phase-pill.on { display: inline-flex; }
  .phase-pill button { background: none; border: 1px solid var(--cyan); padding: 5px 9px; cursor: pointer; color: var(--cyan); letter-spacing: .14em; }
  .fronts { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; align-items: start; }
  .front { padding: 16px 16px 14px; display: grid; gap: 12px; }
  .front header { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: start; }
  .code { font: 400 1.5rem/1 var(--fd); color: var(--bg); background: var(--amber); padding: 5px 7px 3px; letter-spacing: .06em; }
  .fh p { font-size: 12.5px; color: var(--muted); line-height: 1.4; margin-top: 3px; }
  .state { display: grid; justify-items: end; gap: 4px; }
  .rank { font-size: 11px; letter-spacing: .16em; padding: 2px 6px; border: 1px solid currentColor; }
  .pct { font: 400 1.7rem/1 var(--fd); color: var(--amber); font-variant-numeric: tabular-nums; }
  .r-max .rank, .r-ok .rank { color: var(--green); }
  .r-op .rank { color: var(--amber); }
  .r-crit .rank { color: var(--red); }
  .r-off .rank { color: var(--faint); }
  .r-off .code { background: var(--faint); }
  .slots { display: flex; flex-wrap: wrap; gap: 3px; padding-bottom: 10px; border-bottom: 1px dashed var(--line); }
  .s { width: 15px; height: 10px; border: 1px solid var(--faint); }
  .s.done { background: var(--green); border-color: var(--green); box-shadow: 0 0 5px rgba(125,255,114,.4); }
  .s.doing { background: linear-gradient(90deg, var(--amber) 50%, transparent 50%); border-color: var(--amber); }
  .s.idea { border-style: dashed; border-color: var(--muted); }
  .items { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
  .it { display: grid; grid-template-columns: 38px 1fr auto; gap: 8px; align-items: baseline; font-size: 13.5px; line-height: 1.45; }
  .it .tag { color: var(--faint); letter-spacing: .04em; }
  .it.done .tag { color: var(--green); } .it.done .t { color: var(--muted); }
  .it.doing .tag { color: var(--amber); }
  .it.todo .tag { color: var(--text); }
  .it.idea .tag { color: var(--cyan); } .it.idea .t { color: var(--muted); }
  .it .ph { font-size: 11px; color: var(--faint); letter-spacing: .08em; }
  .it[hidden] { display: none; }
  .empty-note { display: none; font-size: 12px; letter-spacing: .14em; color: var(--faint); }
  .front.empty .empty-note { display: block; }
  .front.empty { opacity: .45; }

  /* --- ficha técnica e compromisso --- */
  .grid-2 { grid-template-columns: minmax(240px, 1fr) minmax(300px, 1.4fr); align-items: start; gap: 22px; }
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
  .pledge { padding: 22px 22px 18px; display: grid; gap: 14px; }
  .pledge::before { --c: var(--red); }
  .stamp {
    justify-self: start; font: 400 clamp(1.6rem, 3.4vw, 2.4rem)/1 var(--fs); letter-spacing: .08em; color: var(--red);
    border: 3px double var(--red); padding: 8px 14px 6px; transform: rotate(-3deg); opacity: .92;
    text-shadow: 0 0 10px rgba(255,90,60,.35);
  }
  .pledge ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; color: var(--text); font-size: 14px; }
  .pledge li::marker { content: '> '; color: var(--red); }

  /* --- ordens, esquadrão, registro --- */
  .now { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; align-items: start; }
  .term-bar { display: flex; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid var(--line); font-size: 11.5px; letter-spacing: .2em; color: var(--muted); text-transform: uppercase; }
  .term-body { padding: 14px 16px 16px; display: grid; gap: 10px; }
  .prompt { color: var(--green); font-size: 13px; }
  .mission { font-size: 15px; line-height: 1.6; max-width: 62ch; }
  .status-line { color: var(--muted); font-size: 12.5px; }
  .team { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .team li { display: grid; grid-template-columns: 88px 1fr; gap: 12px; font-size: 13.5px; line-height: 1.45; }
  .who { font: 400 1.25rem/1.1 var(--fd); color: var(--cyan); letter-spacing: .06em; }
  .what { color: var(--text); }
  .feed { list-style: none; margin: 0; padding: 6px 0; display: grid; }
  .feed li { display: grid; grid-template-columns: 96px 70px 1fr auto; gap: 12px; padding: 8px 16px; font-size: 13.5px; border-bottom: 1px dashed var(--line); align-items: baseline; }
  .feed li:last-child { border-bottom: 0; }
  .feed time { color: var(--faint); font-variant-numeric: tabular-nums; }
  .pr { color: var(--amber); } .ok { color: var(--green); }
  footer { color: var(--faint); font-size: 12px; letter-spacing: .16em; text-transform: uppercase; border-top: 1px solid var(--line); padding-top: 14px; }

  @media (max-width: 860px) {
    .route { grid-template-columns: 1fr; gap: 4px; }
    .node:not(:last-child)::after { top: 70px; bottom: -6px; left: 39px; right: auto; height: auto; border-top: 0; border-left: 2px dashed var(--faint); }
    .node.done:not(:last-child)::after { border-left: 2px solid var(--green); }
    .node-btn { grid-template-columns: 66px 1fr auto; grid-template-areas: 'hex label count' 'hex title title' 'hex bar bar'; justify-items: start; text-align: left; column-gap: 14px; }
    .hex { grid-area: hex; } .node-label { grid-area: label; } .node-title { grid-area: title; max-width: none; } .node-bar { grid-area: bar; width: 100%; } .node-count { grid-area: count; }
    .grid-2, .sheet { grid-template-columns: 1fr; }
    .fronts { grid-template-columns: 1fr; }
    .feed li { grid-template-columns: 1fr auto; } .feed .pr, .feed time { display: none; }
    .team li { grid-template-columns: 1fr; gap: 2px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cursor, .focus .hex { animation: none; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="sysbar" role="note">
    <span>CYBER-MECH PROTOCOL // TAC-NET</span>
    <span class="live">link seguro · main ${esc(head)}</span>
    <span>${esc(generated)} BRT</span>
  </div>

  <header class="hero">
    <p class="boot">&gt; conexão estabelecida. briefing da unidade carregado<span class="cursor" aria-hidden="true">█</span></p>
    <h1 class="title">OPERAÇÃO<span>CYBER-MECH</span></h1>
    <p class="lede">Briefing da equipe: onde estamos e o que falta vencer. Tudo aqui sai do <code>ROADMAP.md</code> do projeto${SITE ? ' e se atualiza a cada PR aprovado' : ''}.</p>
    ${SITE ? playHtml : ''}
    <div class="sitrep">
      <div class="read frame"><span class="k">Fase atual</span><span class="v">F${focus.num} · ${upper(focus.title)} <small>${focus.done}/${focus.items.length}</small></span></div>
      <div class="read frame"><span class="k">XP do projeto</span><span class="v">${done} <small>de ${total} itens</small></span><div class="xp" aria-hidden="true">${segs}</div></div>
      <div class="read frame"><span class="k">Conclusão do roadmap</span><span class="v">${pct(done, total)}%</span></div>
      <div class="read frame"><span class="k">Ideias na fila</span><span class="v">${ideasCount} <small>esperando prioridade</small></span></div>
    </div>
  </header>

  <section aria-labelledby="rota">
    <span class="kicker">// rota de operações</span>
    <h2 id="rota">Mapa da campanha</h2>
    <p class="lede">Cada hexágono é uma fase. O que pulsa em ciano é a posição atual da equipe. Clique num hexágono para filtrar os sistemas por fase.</p>
    <ol class="route">${routeHtml}</ol>
  </section>

  <section aria-labelledby="frentes">
    <span class="kicker">// sistemas da unidade</span>
    <h2 id="frentes">Frentes de trabalho</h2>
    <p class="lede">Cada frente é um sistema do Mech. Os slots são os itens: verde é feito, meio preenchido está em andamento, tracejado é ideia.</p>
    <div class="toolbar" role="group" aria-label="Filtrar itens">
      <button type="button" class="chip" data-status="all" aria-pressed="true">todos</button>
      <button type="button" class="chip" data-status="todo" aria-pressed="false">pendente</button>
      <button type="button" class="chip" data-status="doing" aria-pressed="false">em curso</button>
      <button type="button" class="chip" data-status="done" aria-pressed="false">concluído</button>
      <button type="button" class="chip" data-status="idea" aria-pressed="false">ideias</button>
      <span class="phase-pill" id="phase-pill"><span id="phase-pill-label"></span><button type="button" id="phase-clear">[ limpar ]</button></span>
    </div>
    <div class="fronts">${frontsHtml}</div>
  </section>

  ${sheetHtml}

  ${pledgeHtml}

  <section aria-labelledby="agora">
    <span class="kicker">// ordens em vigor</span>
    <h2 id="agora">Ordem de missão e esquadrão</h2>
    <div class="now">
      <div class="term frame">
        <div class="term-bar"><span>ordem de missão</span><span>prioridade 1</span></div>
        <div class="term-body">
          <span class="prompt">&gt; cat PROXIMA_SESSAO</span>
          <p class="mission">${inline(estado.next)}</p>
          ${estado.status ? `<p class="status-line">${inline(estado.status)}</p>` : ''}
        </div>
      </div>
      <div class="term frame">
        <div class="term-bar"><span>esquadrão</span><span>${estado.team.length} agentes</span></div>
        <div class="term-body"><ul class="team">${teamHtml}</ul></div>
      </div>
    </div>
  </section>

  <section aria-labelledby="conquistas">
    <span class="kicker">// registro de combate</span>
    <h2 id="conquistas">O que já entrou no jogo</h2>
    <ul class="feed frame">${feedHtml}</ul>
  </section>

  <footer>fim da transmissão · ${SITE ? 'gerado do roadmap do projeto a cada atualização' : 'gerado do ROADMAP.md e do ESTADO_ATUAL.md · npm run painel'}</footer>
</div>

<script>
  (() => {
    const cards = [...document.querySelectorAll('.front')];
    const chips = [...document.querySelectorAll('.chip')];
    const nodes = [...document.querySelectorAll('.node-btn')];
    const pill = document.getElementById('phase-pill');
    const pillLabel = document.getElementById('phase-pill-label');
    let status = 'all';
    let phase = null;
    const apply = () => {
      for (const card of cards) {
        let shown = 0;
        for (const it of card.querySelectorAll('.it')) {
          const ok = (status === 'all' || it.dataset.status === status) && (!phase || it.dataset.phase === phase);
          it.hidden = !ok;
          if (ok) shown++;
        }
        card.classList.toggle('empty', shown === 0);
      }
      for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.status === status));
      for (const n of nodes) n.setAttribute('aria-pressed', String(n.dataset.phase === phase));
      pill.classList.toggle('on', !!phase);
      const active = nodes.find((n) => n.dataset.phase === phase);
      pillLabel.textContent = active ? 'rota: ' + active.querySelector('.node-title').textContent : '';
    };
    for (const c of chips) c.addEventListener('click', () => { status = c.dataset.status; apply(); });
    for (const n of nodes) n.addEventListener('click', () => { phase = phase === n.dataset.phase ? null : n.dataset.phase; apply(); });
    document.getElementById('phase-clear').addEventListener('click', () => { phase = null; apply(); });
  })();
</script>
</body>
</html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`painel  ${OUT} (${fronts.length} frentes, ${done}/${total} itens, ${ideasCount} ideias${sheet ? ', ficha técnica' : ''}${vows.length ? ', compromisso' : ''})`);
