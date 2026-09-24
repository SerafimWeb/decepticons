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

const RANKS = [
  [1, 'DOMINADA'],
  [0.67, 'AVANÇADA'],
  [0.34, 'EM CURSO'],
  [0.01, 'INICIADA'],
  [0, 'LATENTE'],
];
const frontStats = fronts.map((f) => {
  const items = phases.flatMap((p) => p.items.map((it) => ({ ...it, phase: p })).filter((it) => it.tag === f.tag));
  const d = items.filter((i) => i.status === 'done').length;
  const ratio = items.length ? d / items.length : 0;
  const rank = RANKS.find(([min]) => ratio >= min)[1];
  return { ...f, items, done: d, ratio, rank };
});

const head = git('log', '-1', '--format=%h·%cs');
const feed = git('log', '--merges', '--first-parent', '--format=%cs%x09%s', '-8')
  .split('\n')
  .map((l) => /^(\S+)\t.*?PR #(\d+):\s*(.+)$/.exec(l))
  .filter(Boolean)
  .map(([, date, n, title]) => ({ date, n, title }));

// ---------- HTML ----------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
const GLYPH = { done: '✓', doing: '◐', todo: '○', idea: '✦' };
const STATUS_LABEL = { done: 'feito', doing: 'em andamento', todo: 'a fazer', idea: 'ideia' };
const PHASE_LABEL = { done: 'CONCLUÍDA', focus: 'VOCÊ ESTÁ AQUI', open: 'EM ABERTO', locked: 'BLOQUEADA', ideas: 'SEM FASE' };
const phaseKey = (p) => (p.ideas ? 'ideias' : `f${p.num}`);
const phaseShort = (p) => (p.ideas ? 'IDEIA' : `F${p.num}`);

function ring(ratio) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--ob5)" stroke-width="5"/><circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--g3)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(c * ratio).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 22 22)"/></svg>`;
}

const routeHtml = phases
  .map((p) => {
    const ratio = p.items.length ? p.done / p.items.length : 0;
    const count = p.ideas ? `${p.items.length} na fila` : `${p.done}/${p.items.length}`;
    return `<li class="node ${p.state}">
      <button type="button" class="node-btn" data-phase="${phaseKey(p)}" aria-pressed="false" title="Mostrar só os itens desta fase">
        <span class="hex"><span>${p.ideas ? '✦' : p.num}</span></span>
        <span class="node-label">${PHASE_LABEL[p.state]}</span>
        <span class="node-title">${esc(p.title)}</span>
        <span class="node-bar"><i style="width:${Math.round(ratio * 100)}%"></i></span>
        <span class="node-count">${count}</span>
      </button>
    </li>`;
  })
  .join('');

const frontsHtml = frontStats
  .map((f) => {
    const code = CODES[f.tag] ?? f.tag.slice(0, 2).toUpperCase();
    const list = f.items.length
      ? f.items
          .map(
            (it) =>
              `<li class="it ${it.status}" data-status="${it.status}" data-phase="${phaseKey(it.phase)}"><span class="g" aria-label="${STATUS_LABEL[it.status]}">${GLYPH[it.status]}</span><span class="t">${inline(it.text)}</span><span class="ph">${phaseShort(it.phase)}</span></li>`,
          )
          .join('')
      : '';
    return `<article class="front" data-front="${f.tag}">
      <header>
        <span class="badge" aria-hidden="true">${code}</span>
        <div class="fh">
          <h3>${esc(f.name)}</h3>
          <p>${esc(f.desc)}</p>
        </div>
        <div class="score">${ring(f.ratio)}<span>${Math.round(f.ratio * 100)}%</span></div>
      </header>
      <div class="lvl"><span>NÍVEL ${f.done}</span><span class="rank r-${f.rank.toLowerCase().replace(/\s/g, '-')}">${f.rank}</span><span class="of">${f.done} de ${f.items.length}</span></div>
      <ul class="items">${list}</ul>
      <p class="empty-note">Nada nesta seleção.</p>
    </article>`;
  })
  .join('');

const teamHtml = estado.team
  .map((m) => `<li><span class="who">${esc(m.name)}</span><span class="what">${inline(m.role)}</span></li>`)
  .join('');
const feedHtml = feed
  .map((f) => `<li><span class="star">✦</span><span class="pr">PR #${f.n}</span><span class="ft">${esc(f.title)}</span><time>${f.date}</time></li>`)
  .join('');
const segs = Array.from({ length: 20 }, (_, i) => `<i class="${i < Math.round((done / total) * 20) ? 'on' : ''}"></i>`).join('');
const generated = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const playHtml = `<div class="play">
      <a class="play-btn" href="./jogar/">JOGAR AGORA <span aria-hidden="true">→</span></a>
      <p class="keys"><b>WASD</b> mover · <b>mouse</b> mirar · <b>clique</b> atirar · <b>Shift</b> dash · <b>Espaço</b> pulo duplo · <b>V</b> câmera · <b>'</b> desempenho · <b>F1</b> esconde o HUD</p>
    </div>`;

const html = `<title>${SITE ? 'Cyber-Mech Protocol' : 'Painel de Missão Cyber-Mech'}</title>
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,500;1,300&family=Space+Grotesk:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&family=Orbitron:wght@600&display=swap">
<style>
  /* Design system Serafim (colors_and_type.css): obsidiana, giz, azul e as cores semânticas dos níveis.
     Visual único e escuro de propósito: é a identidade da marca. */
  :root {
    color-scheme: dark;
    --ob: #05060b; --ob2: #090b14; --ob3: #0e1020; --ob4: #13162a; --ob5: #181b32;
    --chalk: #e4e1da; --c2: #9e9a93; --c3: #6b675f;
    --b2: #2563eb; --b3: #60a5fa;
    --g3: #34d399; --a3: #fbbf24; --r2: #ef4444;
    --ln: rgba(228,225,218,.05); --ln2: rgba(228,225,218,.09); --ln3: rgba(228,225,218,.16);
    --fs: 'Cormorant Garamond', Georgia, serif;
    --fb: 'Space Grotesk', system-ui, sans-serif;
    --fm: 'JetBrains Mono', ui-monospace, Consolas, monospace;
    --fw: 'Azonix', 'Orbitron', 'JetBrains Mono', monospace;
    --ease: cubic-bezier(.22,1,.36,1);
  }
  html { background: var(--ob); }
  body {
    background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(29,78,216,.1), transparent 70%) no-repeat, var(--ob);
    color: var(--chalk);
    font: 300 16px/1.6 var(--fb);
    padding: 0 20px;
    padding-block: 36px 80px;
  }
  .wrap { max-width: 1180px; margin: 0 auto; display: grid; gap: 56px; }
  section { display: grid; gap: 18px; }
  h1, h2 { font-family: var(--fs); font-weight: 300; margin: 0; text-wrap: balance; }
  h1 { font-size: clamp(2.4rem, 5.2vw, 4.4rem); line-height: 1.02; letter-spacing: -.015em; }
  h2 { font-size: clamp(1.7rem, 3vw, 2.3rem); line-height: 1.15; }
  h1 em, h2 em { font-style: italic; color: var(--b3); }
  h3 { font: 500 1.02rem/1.3 var(--fb); margin: 0; color: var(--chalk); }
  p { margin: 0; }
  .kicker { font: 400 10.5px/1 var(--fm); letter-spacing: .18em; text-transform: uppercase; color: var(--b3); }
  .lede { color: var(--c2); font-size: 1.02rem; max-width: 62ch; }
  code { font: 400 .86em var(--fm); color: var(--b3); background: var(--ob4); padding: 1px 5px; border-radius: 4px; }
  button { font: inherit; color: inherit; }
  :focus-visible { outline: 2px solid var(--b3); outline-offset: 3px; border-radius: 6px; }

  /* --- topo --- */
  .top { display: grid; gap: 18px; }
  .brandline { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: baseline; justify-content: space-between; }
  .wordmark { font: 600 13px/1 var(--fw); letter-spacing: .32em; color: var(--chalk); }
  .meta { font: 400 11px/1.4 var(--fm); color: var(--c3); letter-spacing: .06em; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1px; background: var(--ln2); border: 1px solid var(--ln2); border-radius: 14px; overflow: hidden; }
  .stat { background: var(--ob2); padding: 16px 18px; display: grid; gap: 6px; align-content: start; }
  .stat .k { font: 400 10px/1 var(--fm); letter-spacing: .16em; text-transform: uppercase; color: var(--c3); }
  .stat .v { font: 500 1.15rem/1.25 var(--fb); font-variant-numeric: tabular-nums; }
  .stat .v small { font-size: .78rem; color: var(--c2); font-weight: 400; }
  .play { display: flex; flex-wrap: wrap; gap: 14px 22px; align-items: center; }
  .play-btn {
    display: inline-flex; gap: 12px; align-items: center; padding: 14px 26px; border-radius: 10px;
    background: var(--b2); color: #fff; text-decoration: none; font: 600 14px/1 var(--fm); letter-spacing: .14em;
    box-shadow: 0 0 40px rgba(37,99,235,.35); transition: filter .2s var(--ease), transform .2s var(--ease);
  }
  .play-btn:hover { filter: brightness(1.12); }
  .play-btn:active { transform: translateY(1px); }
  .keys { font: 400 12px/1.7 var(--fm); color: var(--c2); max-width: 70ch; }
  .keys b { color: var(--chalk); font-weight: 500; }
  .xp { display: grid; grid-template-columns: repeat(20, 1fr); gap: 3px; margin-top: 4px; }
  .xp i { height: 7px; border-radius: 2px; background: var(--ob5); }
  .xp i.on { background: var(--g3); box-shadow: 0 0 8px rgba(52,211,153,.35); }

  /* --- rota das fases --- */
  .route { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(${phases.length}, 1fr); gap: 0; }
  .node { position: relative; display: flex; }
  .node:not(:last-child)::after {
    content: ''; position: absolute; top: 31px; left: calc(50% + 30px); right: calc(-50% + 30px);
    height: 2px; background: var(--ln3);
  }
  .node.done:not(:last-child)::after { background: linear-gradient(90deg, var(--g3), rgba(52,211,153,.35)); }
  .node.ideas::after, .node:nth-last-child(2)::after { background: repeating-linear-gradient(90deg, var(--ln3) 0 6px, transparent 6px 12px); }
  .node-btn {
    width: 100%; background: none; border: 0; cursor: pointer; padding: 0 8px 10px;
    display: grid; justify-items: center; align-content: start; gap: 7px; text-align: center; border-radius: 12px;
    transition: background .2s var(--ease);
  }
  .node-btn:hover { background: var(--ln); }
  .node-btn[aria-pressed="true"] { background: rgba(96,165,250,.08); }
  .hex {
    width: 62px; height: 62px; display: grid; place-items: center;
    clip-path: polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%);
    background: var(--ln3);
  }
  .hex span {
    width: 58px; height: 58px; display: grid; place-items: center;
    clip-path: polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%);
    background: var(--ob3); font: 500 1.35rem/1 var(--fm); color: var(--c2);
  }
  .done .hex { background: var(--g3); } .done .hex span { color: var(--g3); background: #0b1a17; }
  .focus .hex { background: var(--b3); } .focus .hex span { color: var(--chalk); background: #0f1a33; }
  .focus .hex { animation: pulse 2.4s var(--ease) infinite; }
  .open .hex { background: var(--a3); } .open .hex span { color: var(--a3); }
  .locked .hex span { color: var(--c3); }
  .ideas .hex { background: repeating-linear-gradient(45deg, var(--b3) 0 3px, transparent 3px 6px); } .ideas .hex span { color: var(--b3); }
  @keyframes pulse { 0%, 100% { filter: drop-shadow(0 0 0 rgba(96,165,250,0)); } 50% { filter: drop-shadow(0 0 14px rgba(96,165,250,.75)); } }
  .node-label { font: 400 9.5px/1 var(--fm); letter-spacing: .14em; color: var(--c3); }
  .done .node-label { color: var(--g3); } .focus .node-label { color: var(--b3); } .open .node-label { color: var(--a3); }
  .node-title { font: 500 .92rem/1.25 var(--fb); color: var(--chalk); max-width: 15ch; }
  .locked .node-title { color: var(--c2); }
  .node-bar { width: 72%; height: 4px; border-radius: 2px; background: var(--ob5); overflow: hidden; }
  .node-bar i { display: block; height: 100%; background: var(--g3); }
  .node-count { font: 400 11px/1 var(--fm); color: var(--c2); font-variant-numeric: tabular-nums; }

  /* --- frentes --- */
  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .chip {
    border: 1px solid var(--ln3); background: var(--ob2); border-radius: 999px; padding: 6px 13px;
    font: 400 11.5px/1 var(--fm); letter-spacing: .06em; color: var(--c2); cursor: pointer;
  }
  .chip:hover { color: var(--chalk); border-color: var(--c3); }
  .chip[aria-pressed="true"] { color: var(--ob); background: var(--chalk); border-color: var(--chalk); }
  .chip .d { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; vertical-align: 0; }
  .phase-pill { font: 400 11.5px/1 var(--fm); color: var(--b3); display: none; gap: 8px; align-items: center; margin-left: auto; }
  .phase-pill.on { display: inline-flex; }
  .phase-pill button { background: none; border: 1px solid var(--ln3); border-radius: 6px; padding: 5px 9px; cursor: pointer; color: var(--c2); font: inherit; }
  .fronts { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; align-items: start; }
  .front { background: var(--ob3); border: 1px solid var(--ln2); border-radius: 14px; padding: 18px 18px 16px; display: grid; gap: 12px; transition: border-color .2s var(--ease), transform .2s var(--ease); }
  .front:hover { border-color: var(--ln3); transform: translateY(-2px); }
  .front header { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; }
  .badge {
    width: 40px; height: 40px; display: grid; place-items: center; font: 500 12px/1 var(--fm); letter-spacing: .08em;
    clip-path: polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%); background: var(--ob5); color: var(--b3);
  }
  .fh p { font-size: .8rem; color: var(--c2); line-height: 1.35; }
  .score { position: relative; width: 44px; height: 44px; }
  .ring { width: 44px; height: 44px; display: block; }
  .score span { position: absolute; inset: 0; display: grid; place-items: center; font: 500 10px/1 var(--fm); color: var(--chalk); }
  .lvl { display: flex; gap: 10px; align-items: center; font: 400 10.5px/1 var(--fm); letter-spacing: .1em; color: var(--c3); padding-bottom: 10px; border-bottom: 1px solid var(--ln2); }
  .lvl .of { margin-left: auto; letter-spacing: .04em; }
  .rank { padding: 3px 7px; border-radius: 4px; border: 1px solid currentColor; }
  .r-latente { color: var(--c3); } .r-iniciada { color: var(--a3); } .r-em-curso { color: var(--a3); }
  .r-avançada { color: var(--b3); } .r-dominada { color: var(--g3); }
  .items { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .it { display: grid; grid-template-columns: 16px 1fr auto; gap: 8px; align-items: baseline; font-size: .86rem; line-height: 1.45; color: var(--chalk); }
  .it .g { font: 500 12px/1 var(--fm); text-align: center; }
  .it.done .g { color: var(--g3); } .it.done .t { color: var(--c2); }
  .it.doing .g { color: var(--a3); }
  .it.todo .g { color: var(--chalk); }
  .it.idea .g { color: var(--b3); } .it.idea .t { color: var(--c2); font-style: italic; }
  .it .ph { font: 400 9.5px/1 var(--fm); letter-spacing: .08em; color: var(--c3); border: 1px solid var(--ln3); border-radius: 4px; padding: 3px 5px; }
  .it[hidden] { display: none; }
  .empty-note { display: none; font: 400 11px/1 var(--fm); color: var(--c3); }
  .front.empty .empty-note { display: block; }
  .front.empty { opacity: .45; }

  /* --- agora --- */
  .now { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; align-items: start; }
  .term { background: var(--ob2); border: 1px solid var(--ln2); border-radius: 14px; overflow: hidden; box-shadow: 0 18px 44px rgba(0,0,0,.4), 0 0 40px rgba(29,78,216,.06); }
  .term-bar { display: flex; align-items: center; gap: 7px; padding: 10px 14px; background: var(--ob4); border-bottom: 1px solid var(--ln2); }
  .term-bar i { width: 10px; height: 10px; border-radius: 50%; }
  .term-bar i:nth-child(1) { background: #ef4444; } .term-bar i:nth-child(2) { background: #fbbf24; } .term-bar i:nth-child(3) { background: #34d399; }
  .term-bar span { flex: 1; text-align: center; font: 400 11px/1 var(--fm); color: var(--c3); margin-right: 44px; }
  .term-body { padding: 16px 18px 18px; display: grid; gap: 12px; }
  .prompt { font: 400 12px/1 var(--fm); color: var(--g3); }
  .prompt::after { content: '▌'; margin-left: 4px; animation: blink 1s step-end infinite; color: var(--b3); }
  @keyframes blink { 50% { opacity: 0; } }
  .mission { font-size: 1rem; line-height: 1.55; max-width: 60ch; }
  .team { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .team li { display: grid; grid-template-columns: 90px 1fr; gap: 12px; font-size: .88rem; line-height: 1.45; }
  .who { font: 500 11.5px/1.6 var(--fm); letter-spacing: .08em; color: var(--b3); text-transform: uppercase; }
  .what { color: var(--c2); }
  .feed { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; background: var(--ln2); border: 1px solid var(--ln2); border-radius: 14px; overflow: hidden; }
  .feed li { background: var(--ob2); display: grid; grid-template-columns: 18px 62px 1fr auto; gap: 10px; align-items: baseline; padding: 11px 16px; font-size: .88rem; }
  .star { color: var(--a3); } .pr { font: 500 11.5px/1 var(--fm); color: var(--g3); } .ft { color: var(--chalk); }
  .feed time { font: 400 11px/1 var(--fm); color: var(--c3); }
  footer { font: 400 11px/1.6 var(--fm); color: var(--c3); border-top: 1px solid var(--ln2); padding-top: 16px; }

  @media (max-width: 860px) {
    .route { grid-template-columns: 1fr; gap: 6px; }
    .node:not(:last-child)::after { top: 64px; bottom: -8px; left: 38px; right: auto; width: 2px; height: auto; }
    .node.done:not(:last-child)::after { background: var(--g3); }
    .node-btn { grid-template-columns: 62px 1fr auto; grid-template-areas: 'hex label count' 'hex title title' 'hex bar bar'; justify-items: start; text-align: left; column-gap: 14px; padding: 6px 8px; }
    .hex { grid-area: hex; } .node-label { grid-area: label; } .node-title { grid-area: title; max-width: none; } .node-bar { grid-area: bar; width: 100%; } .node-count { grid-area: count; }
    .feed li { grid-template-columns: 18px 1fr auto; } .feed .pr { display: none; }
    .fronts { grid-template-columns: 1fr; }
    .team li { grid-template-columns: 1fr; gap: 2px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .focus .hex, .prompt::after { animation: none; }
    .front, .front:hover { transition: none; transform: none; }
  }
</style>

<div class="wrap">
  <header class="top">
    <div class="brandline">
      <span class="kicker">// ${SITE ? 'build do dia · painel de missão' : 'painel de missão · gerado do roadmap'}</span>
      <span class="meta">main ${esc(head)} · gerado em ${esc(generated)}</span>
    </div>
    <span class="wordmark">CYBER-MECH PROTOCOL</span>
    <h1>Onde estamos, e o que <em>falta vencer.</em></h1>
    ${SITE ? playHtml : ''}
    <p class="lede">${fronts.length} frentes de trabalho, ${phases.filter((p) => !p.ideas).length} fases. Tudo aqui vem do <code>.decepticons/ROADMAP.md</code>: ${SITE ? 'a cada PR aprovado, o jogo e este painel são publicados de novo.' : 'quando um agente marca um item, o painel acompanha no próximo <code>npm run painel</code>.'}</p>
    <div class="stats">
      <div class="stat"><span class="k">Fase atual</span><span class="v">Fase ${focus.num} · ${esc(focus.title)} <small>${focus.done}/${focus.items.length}</small></span></div>
      <div class="stat"><span class="k">XP do projeto</span><span class="v">${done} <small>de ${total} itens</small></span><div class="xp" aria-hidden="true">${segs}</div></div>
      <div class="stat"><span class="k">Conclusão do roadmap</span><span class="v">${pct(done, total)}%</span></div>
      <div class="stat"><span class="k">Ideias na fila</span><span class="v">${ideasCount} <small>esperando prioridade</small></span></div>
    </div>
  </header>

  <section aria-labelledby="rota">
    <span class="kicker">// rota das fases</span>
    <h2 id="rota">A jornada, <em>fase a fase.</em></h2>
    <p class="lede">Clique numa fase para ver só os itens dela nas frentes. A que pulsa é onde a equipe está agora.</p>
    <ol class="route">${routeHtml}</ol>
  </section>

  <section aria-labelledby="frentes">
    <span class="kicker">// frentes de trabalho</span>
    <h2 id="frentes">Cada frente, <em>um nível para subir.</em></h2>
    <div class="toolbar" role="group" aria-label="Filtrar itens">
      <button type="button" class="chip" data-status="all" aria-pressed="true">tudo</button>
      <button type="button" class="chip" data-status="todo" aria-pressed="false"><span class="d" style="background:var(--chalk)"></span>a fazer</button>
      <button type="button" class="chip" data-status="doing" aria-pressed="false"><span class="d" style="background:var(--a3)"></span>em andamento</button>
      <button type="button" class="chip" data-status="done" aria-pressed="false"><span class="d" style="background:var(--g3)"></span>feito</button>
      <button type="button" class="chip" data-status="idea" aria-pressed="false"><span class="d" style="background:var(--b3)"></span>ideias</button>
      <span class="phase-pill" id="phase-pill"><span id="phase-pill-label"></span><button type="button" id="phase-clear">limpar fase</button></span>
    </div>
    <div class="fronts">${frontsHtml}</div>
  </section>

  <section aria-labelledby="agora">
    <span class="kicker">// agora</span>
    <h2 id="agora">Próxima missão <em>e quem está nela.</em></h2>
    <div class="now">
      <div class="term">
        <div class="term-bar"><i></i><i></i><i></i><span>proxima-missao</span></div>
        <div class="term-body">
          <span class="prompt">$ cat PRÓXIMA SESSÃO</span>
          <p class="mission">${inline(estado.next)}</p>
          ${estado.status ? `<p class="meta">${inline(estado.status)}</p>` : ''}
        </div>
      </div>
      <div class="term">
        <div class="term-bar"><i></i><i></i><i></i><span>equipe</span></div>
        <div class="term-body"><ul class="team">${teamHtml}</ul></div>
      </div>
    </div>
  </section>

  <section aria-labelledby="conquistas">
    <span class="kicker">// conquistas</span>
    <h2 id="conquistas">O que já <em>entrou no jogo.</em></h2>
    <ul class="feed">${feedHtml}</ul>
  </section>

  <footer>Gerado de .decepticons/ROADMAP.md e ESTADO_ATUAL.md · npm run painel · design system Serafim</footer>
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
      pillLabel.textContent = active ? 'fase: ' + active.querySelector('.node-title').textContent : '';
    };
    for (const c of chips) c.addEventListener('click', () => { status = c.dataset.status; apply(); });
    for (const n of nodes) n.addEventListener('click', () => { phase = phase === n.dataset.phase ? null : n.dataset.phase; apply(); });
    document.getElementById('phase-clear').addEventListener('click', () => { phase = null; apply(); });
  })();
</script>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`painel  ${OUT} (${fronts.length} frentes, ${done}/${total} itens, ${ideasCount} ideias)`);
