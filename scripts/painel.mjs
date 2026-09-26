/**
 * Sala de controle (o case do desenvolvimento; até 25/09, "bastidores"): equipe, fluxo da ideia ao ar, protocolo, evolução, mapa da
 * campanha, frentes, diário de decisões e entregas. Tudo gerado do repositório (scripts/site/dados.mjs).
 *
 * Uso: npm run painel            → gera .tmp/painel/painel.html (G15: nada fora do projeto)
 *      node scripts/painel.mjs --check → só valida o ROADMAP e a VITRINE do GAME_DESIGN (roda no npm run check)
 *      node scripts/painel.mjs --site --out <arquivo> → versão do site (/cybermech/sala-de-controle/)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { atividade, diario, entregas, evolucao, fichas, historicoRoadmap, marcos, pedidos, pipeline, readEstado, readRoadmap, roadmapStats, vitrine } from './site/dados.mjs';
import { burnup, CHART_CSS, gantt, heatTable, pct, PM_CSS, rankBars } from './site/graficos.mjs';
import { brDate, esc, HEXGRID, inline, pagina, topo, upper } from './site/tema.mjs';

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const SITE = argv.includes('--site');
const OUT = resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : '.tmp/painel/painel.html');
// No site, os links são relativos; no arquivo local, apontam para o site publicado.
const BASE = SITE ? '../' : (process.env.SITE_URL || 'https://www.selvamkt.com.br/cybermech/').replace(/\/?$/, '/');

// ---------- validação ----------

const roadmap = readRoadmap();
const errors = [...roadmap.errors];
if (vitrine().length === 0) errors.push('GAME_DESIGN.md sem a seção "## VITRINE" no formato "- **Título:** frase" (a landing lê dela)');
if (errors.length) {
  console.error('❌ ROADMAP.md / GAME_DESIGN.md fora do formato das páginas do site:');
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}
if (CHECK) {
  const items = roadmap.phases.flatMap((p) => p.items).length;
  console.log(`painel  ROADMAP ok: ${roadmap.fronts.length} frentes, ${roadmap.phases.length} grupos, ${items} itens; VITRINE ok`);
  process.exit(0);
}

// ---------- dados ----------

const { fronts, phases } = roadmap;
const stats = roadmapStats(roadmap);
const estado = readEstado();
const m = marcos();
const { prs, fromGithub } = entregas();
const evo = evolucao();
const log = diario();
const act = atividade(prs);
const asked = pedidos();
const last = evo.at(-1) ?? { tests: 0, loc: 0 };
const nf = (n) => n.toLocaleString('pt-BR');

// ---------- equipe ----------

const TEAM = [
  { key: 'dono', name: 'DAN', org: 'criador', role: 'Define o jogo, decide as prioridades e joga cada build no site. Nenhuma IA muda o rumo sozinha.' },
  { key: 'claude', name: 'CLAUDE', org: 'Anthropic', role: 'Arquitetura e engenharia: simulação, combate, IA dos bots, testes, CI, deploy e este site.' },
  { key: 'gemini', name: 'GEMINI', org: 'Google', role: 'Interface e som: HUD, configurações, som sintetizado e a versão para celular.' },
  { key: 'codex', name: 'CODEX', org: 'OpenAI', role: 'Visual e desempenho de render do mundo 3D (efeitos, cenário, modelos) e revisão cruzada: confere o que as outras IAs entregaram. Nenhuma IA aprova o próprio código.' },
  { key: 'qwen', name: 'QWEN', org: 'Alibaba', role: 'Qualidade, documentação e testes: auditoria de arquitetura, relatórios do processo e segunda opinião na revisão cruzada.' },
];
const FRONT_NAME = Object.fromEntries(fronts.map((f) => [f.tag, f.name]));
const teamHtml = TEAM.map((t) => {
  const mine = prs.filter((p) => p.agents.includes(t.key));
  const tally = new Map();
  for (const p of mine) for (const f of p.fronts) tally.set(f, (tally.get(f) ?? 0) + 1);
  const top = [...tally].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => FRONT_NAME[f] ?? f);
  const lines = mine.reduce((acc, p) => acc + (p.add ?? 0), 0);
  const now =
    estado.team.find((r) => r.name.toLowerCase() === t.key)?.role ??
    estado.pending.filter((p) => p.who.toLowerCase() === t.key).map((p) => p.text).join(' · ');
  const numbers =
    t.key === 'dono'
      ? `<div><dt>PEDIDOS</dt><dd>${asked}</dd></div><div><dt>DECISÕES</dt><dd>${log.length}</dd></div>`
      : `<div><dt>COMMITS</dt><dd>${act.byAgent[t.key] ?? 0}</dd></div><div><dt>ENTREGAS</dt><dd>${mine.length}</dd></div>${fromGithub ? `<div><dt>LINHAS</dt><dd>+${nf(lines)}</dd></div>` : ''}`;
  return `<article class="member frame m-${t.key}">
      <header><span class="agent ${t.key}">${esc(t.org)}</span><h3>${t.name}</h3></header>
      <p class="mrole">${esc(t.role)}</p>
      <dl class="mnum">${numbers}</dl>
      ${top.length ? `<p class="mfronts">frentes: ${top.map(esc).join(' · ')}</p>` : ''}
      ${now ? `<p class="mnow"><span>agora &gt;</span> ${inline(now)}</p>` : ''}
    </article>`;
}).join('');

// ---------- atividade (git) ----------

const when = (t) => new Date(t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
const heatHtml = act.heat.days
  .map((d, i) => {
    const row = act.heat.grid[i];
    const cells = row
      .map((n, h) => `<i class="h${n ? '' : ' zero'}" style="--v:${(n / act.heat.max).toFixed(2)}" title="${brDate(d)} · ${h}h · ${n} commit${n === 1 ? '' : 's'}"></i>`)
      .join('');
    return `<span class="hd">${brDate(d)}</span>${cells}`;
  })
  .join('');
const hours = Array.from({ length: 24 }, (_, h) => `<span class="hh">${h % 6 === 0 ? `${String(h).padStart(2, '0')}h` : ''}</span>`).join('');
const prTitle = new Map(prs.map((p) => [p.n, p.title]));
const streamHtml = act.commits
  .slice(0, 40)
  .map((c) => {
    // Entrega: o título do PR (o merge pelo botão do GitHub não traz o título no assunto).
    const text = c.merge ? `entrega #${c.pr} · ${prTitle.get(c.pr) ?? c.subject.replace(/^Merge (PR #\d+: |pull request #\d+ from \S+\s*)/, '')}` : c.subject;
    return `<li class="${c.merge ? 'delivery' : ''}"><time>${when(c.t)}</time><span class="agent ${esc(c.agent)}">${esc(c.agent)}</span><span class="msg">${esc(text)}</span><code class="sha">${esc(c.sha)}</code></li>`;
  })
  .join('');

// ---------- da ideia ao ar ----------

const FLOW = [
  ['PEDIDO', 'Dan descreve o que quer, em português, do jeito que fala.', '“no jogo é muito rápido pra fazer essa configuração fina”'],
  ['PASSO ZERO', 'Antes de tocar no código, a IA lê a memória do projeto: identidade, estado, roadmap e regras.', 'ESTADO_ATUAL · ROADMAP · AGENTS'],
  ['PASTA PRÓPRIA', 'Cada IA trabalha no seu worktree e no seu branch, a partir da main. Duas IAs nunca dividem pasta.', 'claude/calibracao-mouse'],
  ['CÓDIGO + TESTE', `Toda regra de jogo ganha teste de simulação: hoje são ${last.tests} testes automáticos.`, 'ida e volta do cm/360 testada'],
  ['PULL REQUEST', 'O PR ganha sozinho as etiquetas da frente e do agente e segue um modelo: o que muda, custo de CPU, como testar.', 'PR #14 · jogabilidade · claude'],
  ['CI', 'Tipos, testes, build, orçamento de download, boot num navegador sem tela e o site com os cabeçalhos reais. Vermelho não entra.', 'npm run check'],
  ['NO AR', 'O merge publica o site sozinho, confere a produção e fotografa o jogo para a página inicial.', 'deploy em poucos minutos'],
  ['PLAYTEST', 'Dan joga no site e conta o que sentiu. O ciclo recomeça.', '“estão atacando bem, não ficaram perdidos”'],
];
const flowHtml = FLOW.map(
  ([title, text, sample], i) => `<li class="step frame">
      <span class="snum">${String(i + 1).padStart(2, '0')}</span>
      <h3>${title}</h3>
      <p>${esc(text)}</p>
      <p class="sample">${esc(sample)}</p>
    </li>`,
).join('');

// ---------- protocolo ----------

const RULES = [
  ['MEMÓRIA NO REPOSITÓRIO', 'O que não está escrito no repositório não existe. A IA chega lendo o estado e sai deixando o bastão escrito para a próxima.'],
  ['O TESTE É O ÁRBITRO', 'Quando duas IAs discordam sobre uma regra de jogo, quem decide é o teste de simulação, não a opinião.'],
  ['PERFORMANCE PRIMEIRO', 'Cada feature declara o custo de CPU. Nada de alocar memória por quadro; tetos explícitos para tudo.'],
  ['SIMULAÇÃO DETERMINÍSTICA', 'Física a 60 passos fixos por segundo, sem sorteio nem relógio no meio: mesma entrada, mesmo resultado. É a base do multiplayer.'],
  ['VERDADE SOBRE O ESTADO', 'O que não funciona de ponta a ponta fica marcado como DEMO ou AUSENTE. “Pronto” só com o check verde.'],
  ['TRAVAS AUTOMÁTICAS', 'Sem estado atualizado não há commit; segredo no código bloqueia; todo push roda o check; ninguém escreve direto na main.'],
  ['REVISÃO CRUZADA', 'O código de uma IA é revisado por outra. Nenhuma aprova o próprio trabalho.'],
  ['SEM PAY-TO-WIN', 'Nada que se compra ganha partida. Proposta que quebre isso é recusada, não importa quanto renda.'],
];
const rulesHtml = RULES.map(([t, d]) => `<li class="rule"><h3>${t}</h3><p>${esc(d)}</p></li>`).join('');

// ---------- evolução (gráficos) ----------

/** Teto "redondo" para o eixo, sem sobrar metade do gráfico vazia (51 → 60, 4.882 → 5.000). */
function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(Math.max(v, 1)));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((k) => k * p).find((x) => x >= v);
}

/**
 * Linha em degraus (o valor muda a cada entrega), uma série por gráfico: dois números de escalas
 * diferentes viram dois gráficos, nunca dois eixos. Sem legenda: o título diz o que é.
 */
function chart({ id, title, key, unit }) {
  const W = 540;
  const H = 210;
  const pad = { l: 46, r: 62, t: 14, b: 30 };
  const n = evo.length;
  const max = niceMax(Math.max(...evo.map((e) => e[key])));
  const x = (i) => pad.l + (n > 1 ? i / (n - 1) : 0) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  let d = `M${x(0).toFixed(1)},${y(evo[0][key]).toFixed(1)}`;
  for (let i = 1; i < n; i++) d += `H${x(i).toFixed(1)}V${y(evo[i][key]).toFixed(1)}`;
  const area = `${d}V${y(0).toFixed(1)}H${x(0).toFixed(1)}Z`;
  const ticks = [0, max / 2, max]
    .map((t) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="tick" x="${pad.l - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${nf(t)}</text>`)
    .join('');
  // Rótulos do eixo x: a primeira entrega de cada dia.
  const days = evo
    .map((e, i) => ({ e, i }))
    .filter(({ e, i }) => i === 0 || evo[i - 1].date !== e.date)
    .map(({ e, i }) => `<text class="tick" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : 'middle'}">${brDate(e.date)}</text><line class="grid" x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${H - pad.b}" y2="${H - pad.b + 5}"/>`)
    .join('');
  const endV = evo[n - 1][key];
  const points = evo.map((e) => [e.pr, e.date, e[key]]);
  return `<figure class="chart frame" id="${id}" data-unit="${esc(unit)}" data-points='${esc(JSON.stringify(points))}' data-x0="${pad.l}" data-x1="${W - pad.r}" data-w="${W}">
      <figcaption><h3>${esc(title)}</h3><span>${nf(endV)} ${esc(unit)} hoje</span></figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}: de ${nf(evo[0][key])} a ${nf(endV)} ${esc(unit)} em ${n} entregas">
        ${ticks}${days}
        <path class="area" d="${area}"/>
        <path class="line" d="${d}"/>
        <line class="cross" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>
        <circle class="end" cx="${x(n - 1).toFixed(1)}" cy="${y(endV).toFixed(1)}" r="4"/>
        <text class="endlabel" x="${(x(n - 1) + 9).toFixed(1)}" y="${(y(endV) + 4).toFixed(1)}">${nf(endV)}</text>
      </svg>
      <div class="tip" hidden></div>
    </figure>`;
}

const evoHtml =
  evo.length > 1
    ? `<section aria-labelledby="evolucao">
    <span class="kicker">// telemetria · uma leitura por entrega</span>
    <h2 id="evolucao">Evolução</h2>
    <p class="lede">Cada ponto é um merge na <code>main</code>, medido direto no histórico do git. Os testes crescem junto com o código: regra de jogo nova, teste novo.</p>
    <div class="charts">
      ${chart({ id: 'ch-testes', title: 'Testes automáticos', key: 'tests', unit: 'testes' })}
      ${chart({ id: 'ch-linhas', title: 'Linhas de TypeScript do jogo', key: 'loc', unit: 'linhas' })}
    </div>
    <details class="table-view"><summary>ver os números em tabela</summary>
      <table><thead><tr><th>entrega</th><th>data</th><th>testes</th><th>linhas</th></tr></thead><tbody>${evo
        .map((e, i) => `<tr><td>${e.pr ? `PR #${e.pr}` : `commit ${i + 1}`}</td><td>${brDate(e.date)}</td><td>${nf(e.tests)}</td><td>${nf(e.loc)}</td></tr>`)
        .join('')}</tbody></table>
    </details>
  </section>`
    : '';

// ---------- mapa da campanha e frentes (do ROADMAP) ----------

const CODES = { jogabilidade: 'JG', combate: 'CB', ia: 'IA', mechs: 'MC', cenarios: 'CN', ux: 'UX', som: 'SM', rede: 'MP', desempenho: 'DS', base: 'BT', negocio: 'NG', universo: 'UN' };
const TAG = { done: 'OK', doing: '>>', todo: '--', idea: '??' };
const STATUS_LABEL = { done: 'feito', doing: 'em andamento', todo: 'a fazer', idea: 'ideia' };
const PHASE_LABEL = { done: 'CONCLUÍDA', focus: 'POSIÇÃO ATUAL', open: 'EM ABERTO', locked: 'NÃO LIBERADA', ideas: 'SEM ROTA' };
const phaseKey = (p) => (p.ideas ? 'ideias' : `f${p.num}`);
const phaseShort = (p) => (p.ideas ? 'IDEIA' : `F${p.num}`);

const routeHtml = phases
  .map((p) => {
    const ratio = p.items.length ? p.done / p.items.length : 0;
    const count = p.ideas ? `${p.items.length} NA FILA` : `${p.done}/${p.items.length}`;
    return `<li class="node ${p.state}">
      <button type="button" class="node-btn" data-phase="${phaseKey(p)}" aria-pressed="false" title="Filtrar as frentes por esta fase">
        <span class="hex"><span>${p.ideas ? '?' : p.num}</span></span>
        <span class="node-label">${PHASE_LABEL[p.state]}</span>
        <span class="node-title">${upper(p.title)}</span>
        <span class="node-bar"><i style="width:${Math.round(ratio * 100)}%"></i></span>
        <span class="node-count">${count}</span>
      </button>
    </li>`;
  })
  .join('');

const frontsHtml = stats.frontStats
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

// ---------- gestão (sala de operações) ----------

const DAY = 86_400_000;
const NOW = Date.now();
const dayLabel = (t) => new Date(t).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
/** Meia-noite (Brasília) de cada dia entre t0 e t1, para os eixos de tempo. */
function dayTicks(t0, t1) {
  const out = [];
  const first = Date.parse(`${new Date(t0).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })}T00:00:00-03:00`);
  for (let t = first + DAY; t <= t1; t += DAY) out.push({ t, label: dayLabel(t) });
  return out;
}
const span = (ms) => (ms < DAY ? `${Math.max(1, Math.round(ms / 3_600_000))} h` : `${(ms / DAY).toFixed(1).replace('.', ',')} dias`);

const snaps = historicoRoadmap().filter((x) => x.total > 0);
const dora = pipeline(prs);
const focusPhase = stats.focus;
const nextPhase = stats.next;
// Ritmo: itens feitos nas últimas 72 h (a leitura mais antiga dentro da janela serve de base).
const latest = snaps.at(-1);
const base = [...snaps].reverse().find((x) => x.t <= NOW - 3 * DAY) ?? snaps[0];
const pace = latest && base ? (latest.done - base.done) / Math.max(1, (latest.t - base.t) / DAY) : 0;
const focusLeft = focusPhase.items.length - focusPhase.done;
const eta = pace > 0 ? focusLeft / pace : null;

// Código de cada item (frente + posição na frente, na ordem do ROADMAP): CB-07, UX-12...
const itemId = new Map();
for (const f of stats.frontStats) f.items.forEach((it, i) => itemId.set(it.line, `${CODES[f.tag] ?? f.tag.slice(0, 2).toUpperCase()}-${String(i + 1).padStart(2, '0')}`));
const AGENT_RE = /\((Claude|Gemini|Codex)\b[^)]*\)/i;
const card = (it) => {
  const who = AGENT_RE.exec(it.text)?.[1]?.toLowerCase();
  const text = it.text.replace(/\s*\([^)]*\)\s*$/, '');
  return `<li class="card ${it.status}"><span class="cid"><b>${itemId.get(it.line) ?? ''}</b>${esc(FRONT_NAME[it.tag] ?? it.tag)}${it.status === 'doing' ? ' · em curso' : ''}${who ? ` <span class="agent ${who}">${who}</span>` : ''}</span><span class="ct">${inline(text)}</span></li>`;
};
const nowItems = focusPhase.items.filter((i) => i.status !== 'done').sort((a, b) => (b.status === 'doing') - (a.status === 'doing'));
const later = phases.filter((p) => !p.ideas && p.num > (nextPhase?.num ?? focusPhase.num));
const ideasPhase = phases.find((p) => p.ideas);
const boardHtml = `<div class="board">
      <div class="lane now frame"><header><h3>AGORA</h3><span>fase ${focusPhase.num} · ${nowItems.length} abertos</span></header><ol class="cards">${nowItems.map(card).join('')}</ol></div>
      ${nextPhase ? `<div class="lane frame"><header><h3>PRÓXIMO</h3><span>fase ${nextPhase.num} · ${nextPhase.items.length} itens</span></header><ol class="cards">${nextPhase.items.map(card).join('')}</ol></div>` : ''}
      <div class="lane frame"><header><h3>DEPOIS</h3><span>${later.length} fases</span></header><ol class="cards">${later
        .map((p) => `<li class="card phase"><span class="cid"><b>F${p.num}</b>${p.items.length} itens</span><span class="ct">${upper(p.title)}</span></li>`)
        .join('')}${ideasPhase ? `<li class="card phase"><span class="cid"><b>??</b>${ideasPhase.items.length} na fila</span><span class="ct">IDEIAS</span></li>` : ''}</ol></div>
    </div>`;

let gestaoHtml = '';
if (snaps.length > 1) {
  const t0 = snaps[0].t;
  const burnHtml = burnup({
    title: 'Burn-up do roadmap',
    caption: `Tracejado: o escopo (itens nas fases). Âmbar: os feitos. O escopo cresce junto: <b>+${latest.total - snaps[0].total} itens</b> desde ${dayLabel(t0)}.`,
    points: snaps.map((x) => ({ t: x.t, total: x.total, done: x.done })),
    dayTicks: dayTicks(t0, NOW),
    ariaLabel: `Burn-up: de ${snaps[0].done} de ${snaps[0].total} itens em ${dayLabel(t0)} para ${latest.done} de ${latest.total} hoje`,
  });
  const rows = phases
    .filter((p) => !p.ideas)
    .map((p) => {
      const series = snaps.map((x) => ({ t: x.t, ph: x.phases.find((q) => q.title === p.title) }));
      const start = series.find((x) => x.ph && (x.ph.done > 0 || x.ph.active))?.t ?? null;
      let end = null;
      if (p.state === 'done') {
        for (let i = series.length - 1; i >= 0; i--) {
          const ph = series[i].ph;
          if (ph && ph.total > 0 && ph.done === ph.total) end = series[i].t;
          else break;
        }
      }
      const forecast = p.focus && eta !== null ? NOW + eta * DAY : null;
      const note = end ? span(end - start) : start ? `${p.done}/${p.items.length}${forecast ? ` · ~${span(forecast - NOW)}` : ''}` : 'não iniciada';
      return {
        label: `F${p.num} · ${p.title.toUpperCase()}`,
        start: end && start === null ? end : start,
        end,
        forecast,
        state: p.state,
        note,
        title: end ? `${p.title}: de ${dayLabel(start ?? end)} a ${dayLabel(end)}` : start ? `${p.title}: desde ${dayLabel(start)}` : p.title,
      };
    });
  const t1 = Math.max(NOW, ...rows.map((r) => r.forecast ?? 0)) + DAY * 0.3;
  const ganttHtml = gantt({
    title: 'Linha do tempo das fases',
    caption: `Verde: fechada. Âmbar: em curso. Tracejado: estimativa pelo ritmo dos últimos 3 dias (${nf(Math.round(pace))} itens/dia), refeita a cada entrega.`,
    rows,
    t0,
    t1,
    today: NOW,
    ticks: dayTicks(t0, t1),
  });
  const cols = phases.map((p) => ({ label: p.ideas ? 'IDEIAS' : `F${p.num}`, sub: p.ideas ? 'na fila' : `${p.done}/${p.items.length}` }));
  const matrix = heatTable({
    rows: fronts.map((f) => f.name.toUpperCase()),
    cols,
    cells: fronts.map((f) =>
      phases.map((p) => {
        const its = p.items.filter((i) => i.tag === f.tag);
        if (!its.length) return { v: null, text: '·' };
        if (p.ideas) return { v: 0, text: String(its.length), title: `${f.name}: ${its.length} ideias na fila` };
        const d = its.filter((i) => i.status === 'done').length;
        return { v: d / its.length, text: `${d}/${its.length}`, title: `${f.name}, fase ${p.num}: ${d} de ${its.length} feitos` };
      }),
    ),
    strong: (v) => v,
    caption: 'Itens feitos de cada frente em cada fase',
  });
  const byFront = new Map();
  for (const p of prs) for (const f of p.fronts) byFront.set(f, (byFront.get(f) ?? 0) + 1);
  const frontBars = byFront.size
    ? rankBars({
        title: 'Entregas por frente',
        caption: 'PRs no ar que mexeram em cada frente (etiquetas automáticas pelos arquivos).',
        items: [...byFront].sort((a, b) => b[1] - a[1]).map(([f, n]) => ({ label: FRONT_NAME[f] ?? f, value: n })),
        fmt: (v) => nf(v),
      })
    : '';
  const leadBars = rankBars({
    title: 'Lead time das últimas entregas',
    caption: 'Do primeiro commit do PR ao merge na main; o deploy leva mais alguns minutos.',
    items: prs.slice(0, 12).map((p) => ({ label: `#${p.n} ${p.title.length > 26 ? `${p.title.slice(0, 25)}…` : p.title}`, value: Math.max(0, p.leadH * 60), note: p.agents[0] ?? '' })),
    fmt: (v) => `${nf(Math.round(v))} min`,
  });
  const doraHtml = dora
    ? `<div class="dora">
      <div class="read frame"><span class="k">frequência de deploy</span><span class="v">${nf(Math.round(dora.perDay))} <small>por dia</small></span><span class="d">${dora.deploys} deploys: cada merge na main vai para o ar sozinho</span><span class="ref">elite DORA: várias vezes por dia</span></div>
      <div class="read frame"><span class="k">lead time</span><span class="v">${nf(Math.max(1, Math.round(dora.leadH * 60)))} <small>min</small></span><span class="d">mediana, do primeiro commit ao site no ar (deploy de ~${nf(Math.round(dora.deployMin))} min)</span><span class="ref">elite DORA: menos de 1 hora</span></div>
      <div class="read frame"><span class="k">falha de mudança</span><span class="v">${pct(dora.failRate, 1)}</span><span class="d">${dora.failures} de ${dora.runs} deploys falharam no CI ou na publicação</span><span class="ref">elite DORA: até 15%</span></div>
      <div class="read frame"><span class="k">recuperação</span><span class="v">${dora.mttrH === null ? '—' : `${nf(Math.max(1, Math.round(dora.mttrH * 60)))} <small>min</small>`}</span><span class="d">da falha até o próximo deploy bom</span><span class="ref">elite DORA: menos de 1 hora</span></div>
    </div>`
    : '<p class="source">Sem acesso ao GitHub neste build: métricas de entrega indisponíveis.</p>';

  gestaoHtml = `<section aria-labelledby="gestao">
    <span class="kicker">// sala de operações · gestão do projeto</span>
    <h2 id="gestao">Gestão</h2>
    <p class="lede">O projeto é gerido como produto de estúdio: quadro de prioridades, escopo e ritmo medidos a cada entrega, métricas de entrega contínua. Tudo lido do ROADMAP, do git e do GitHub; nenhum número é digitado.</p>
    <div class="sitrep">
      <div class="read frame"><span class="k">Ritmo</span><span class="v">${nf(Math.round(pace))} <small>itens/dia (72 h)</small></span></div>
      <div class="read frame"><span class="k">Escopo</span><span class="v">${latest.total} <small>+${latest.total - snaps[0].total} desde ${dayLabel(t0)}</small></span></div>
      <div class="read frame"><span class="k">Fase atual</span><span class="v">${pct(focusPhase.done / focusPhase.items.length)} <small>${focusLeft} abertos</small></span></div>
      <div class="read frame"><span class="k">Previsão da fase</span><span class="v">${eta === null ? '—' : `~${span(eta * DAY)}`} <small>no ritmo atual</small></span></div>
    </div>
    <h3 class="sub-h">Quadro de prioridades</h3>
    ${boardHtml}
    <div class="pm-grid">${burnHtml}${ganttHtml}</div>
    <h3 class="sub-h">Frentes × fases</h3>
    <p class="lede">Quanto de cada frente já foi feito em cada fase: mais aceso, mais completo. Mostra onde o esforço foi e o que espera à frente.</p>
    ${matrix}
    <h3 class="sub-h">Entrega contínua · métricas DORA</h3>
    <p class="lede">As quatro métricas que a indústria usa para medir times de software (programa DORA, do Google Cloud), medidas nas execuções do CI e no git.</p>
    ${doraHtml}
    <div class="pm-grid">${frontBars}${leadBars}</div>
  </section>`;
}

// ---------- diário e entregas ----------

const byDay = new Map();
for (const e of log) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
const logHtml = [...byDay]
  .map(
    ([date, entries]) => `<li class="day">
      <h3><time datetime="${date}">${brDate(date)}</time><span>${entries.length} decisões</span></h3>
      <ol>${entries.map((e) => `<li>${inline(e.title)}</li>`).join('')}</ol>
    </li>`,
  )
  .join('');

const prHtml = prs
  .map(
    (p) => `<li>
      <span class="prn">#${p.n}</span>
      <time datetime="${p.date}">${brDate(p.date)}</time>
      <span class="who">${p.agents.map((a) => `<span class="agent ${esc(a)}">${esc(a)}</span>`).join(' ')}</span>
      <span class="ft">${esc(p.title)}${p.fronts.length ? `<small class="fr">${p.fronts.map((f) => esc(FRONT_NAME[f] ?? f)).join(' · ')}</small>` : ''}</span>
    </li>`,
  )
  .join('');

// ---------- novidades, mesa do Dan e fichas de design ----------

// Nada de caminho interno na página pública (a pasta dos documentos tem o codinome).
const pub = (s) => s.replace(/\.decepticons\//g, '');
const newsHtml = `<div class="news">
    <div class="frame"><h3>últimas decisões <a href="#diario">todas →</a></h3><ol>${log
      .slice(0, 5)
      .map((e) => `<li><time datetime="${e.date}">${brDate(e.date)}</time>${inline(pub(e.title))}</li>`)
      .join('')}</ol></div>
    <div class="frame"><h3>últimas entregas <a href="#entregas">todas →</a></h3><ol>${prs
      .slice(0, 5)
      .map((p) => `<li><time datetime="${p.date}">${brDate(p.date)}</time><span class="prn">#${p.n}</span>${esc(p.title)}</li>`)
      .join('')}</ol></div>
  </div>`;

const ownerTests = estado.pending.filter((p) => /^dono$/i.test(p.who));
const mesaHtml =
  estado.open.length || ownerTests.length
    ? `<section aria-labelledby="mesa">
    <span class="kicker">// aguardando o Dan</span>
    <h2 id="mesa">Na mesa do Dan</h2>
    <p class="lede">O que só o dono decide ou testa. As IAs propõem, com critérios e uma recomendação; enquanto a decisão não sai, nada disso muda no jogo.</p>
    ${estado.open.length ? `<ul class="rules">${estado.open.map((d) => `<li class="rule"><h3>${inline(pub(d.title))}</h3><p>${inline(pub(d.text))}</p></li>`).join('')}</ul>` : ''}
    ${ownerTests.length ? `<h3 class="sub-h">Para testar no site</h3><ul class="checks frame">${ownerTests.map((t) => `<li>${inline(pub(t.text))}</li>`).join('')}</ul>` : ''}
  </section>`
    : '';

const F = fichas();
const fichasHtml = F.sheets.length
  ? `<section aria-labelledby="fichas">
    <span class="kicker">// processo criativo</span>
    <h2 id="fichas">Do conceito ao robô</h2>
    <p class="lede">Todo robô e toda arma nascem numa ficha de design: identidade, como se joga com ele e contra ele, silhueta e números. O dono aprova a ficha; as metas de equilíbrio dela viram teste antes de o robô entrar no jogo. A ficha propõe, o código decide.</p>
    <ol class="flow">${F.flow
      .map((s, i) => `<li class="step frame"><span class="snum">${String(i + 1).padStart(2, '0')}</span><h3>${upper(s.status)}</h3><p>${inline(pub(s.what))}</p><p class="sample">${inline(pub(s.who))}</p></li>`)
      .join('')}</ol>
    <h3 class="sub-h">Fichas</h3>
    <ul class="feed frame sheets">${F.sheets
      .map((s) => `<li><span class="st${s.done ? ' ok' : ''}">${s.done ? 'feita' : 'a fazer'}</span><span class="ft">${inline(pub(s.file))}<small class="fr">${inline(pub(s.type))} · ${inline(pub(s.ref))}</small></span><span class="who">${inline(pub(s.state))}</span></li>`)
      .join('')}</ul>
  </section>`
  : '';

// ---------- página ----------

const css = `
  ${CHART_CSS}
  ${PM_CSS}
  .sub-h { font: 400 1.5rem/1.1 var(--fd); letter-spacing: .06em; text-transform: uppercase; margin-top: 12px; }
  .hero { display: grid; gap: 18px; padding-top: 30px; }
  .pitch { font-size: 17px; line-height: 1.6; color: var(--text); max-width: 70ch; text-wrap: pretty; }

  .team { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; }
  .member { padding: 16px; display: grid; gap: 10px; align-content: start; }
  .member header { display: grid; gap: 6px; justify-items: start; }
  .member h3 { font-size: 1.9rem; }
  .m-claude::before { --c: #ff9a6b; } .m-gemini::before { --c: var(--bone); } .m-codex::before { --c: #5fd8a8; }
  .mrole { font-size: 13.5px; line-height: 1.5; color: var(--text); }
  .mnum { margin: 0; display: flex; gap: 18px; }
  .mnum div { display: grid; }
  .mnum dt { font-size: 10.5px; letter-spacing: .2em; color: var(--muted); }
  .mnum dd { margin: 0; font: 400 1.6rem/1 var(--fd); color: var(--amber); }
  .mfronts { font-size: 12px; color: var(--muted); letter-spacing: .06em; }
  .mnow { font-size: 12.5px; line-height: 1.45; color: var(--muted); border-top: 1px dashed var(--line); padding-top: 8px; }
  .mnow span { color: var(--green); }

  .heat { margin: 0; padding: 14px 16px 12px; display: grid; gap: 10px; }
  .heat figcaption { font-size: 11.5px; letter-spacing: .18em; color: var(--muted); text-transform: uppercase; }
  .heat-grid { display: grid; grid-template-columns: 48px repeat(24, minmax(0, 1fr)); gap: 3px; align-items: center; }
  .heat-grid .hd { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .heat-grid .hh { font-size: 10.5px; color: var(--faint); }
  .h { display: block; aspect-ratio: 1; min-height: 10px; background: rgba(255,176,0, calc(.12 + var(--v) * .88)); box-shadow: 0 0 calc(var(--v) * 8px) rgba(255,176,0,.5); }
  .h.zero { background: transparent; box-shadow: none; border: 1px solid var(--line); }
  .heat-legend { display: flex; gap: 4px; align-items: center; justify-content: flex-end; font-size: 11px; color: var(--muted); }
  .heat-legend i { width: 12px; height: 12px; background: rgba(255,176,0, calc(.12 + var(--v) * .88)); }
  .stream { max-height: 440px; overflow-y: auto; }
  .stream ol { list-style: none; margin: 0; padding: 4px 0; }
  .stream li { display: grid; grid-template-columns: 96px 70px 1fr auto; gap: 12px; padding: 7px 16px; font-size: 13px; border-bottom: 1px dashed var(--line); align-items: baseline; }
  .stream li:last-child { border-bottom: 0; }
  .stream time { color: var(--faint); font-variant-numeric: tabular-nums; }
  .stream .msg { color: var(--text); overflow-wrap: anywhere; }
  .stream .sha { color: var(--faint); font-size: 11.5px; }
  .stream li.delivery .msg { color: var(--green); }
  .stream li.delivery .msg::before { content: '▲ '; }
  .flow { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 30px 26px; counter-reset: s; }
  .step { padding: 14px 14px 16px; display: grid; gap: 8px; align-content: start; }
  /* Setas entre passos da mesma linha; no fim da linha, a numeração conduz. */
  .step:not(:last-child)::after { content: '→'; position: absolute; right: -20px; top: 16px; color: var(--amber); font: 400 1.3rem/1 var(--fd); }
  .step:nth-child(4n)::after { content: none; }
  .loop { color: var(--green); font-size: 12.5px; letter-spacing: .14em; text-transform: uppercase; }
  .snum { font: 400 1rem/1 var(--fd); color: var(--bg); background: var(--amber); justify-self: start; padding: 3px 6px 1px; }
  .step h3 { font-size: 1.3rem; }
  .step p { font-size: 13px; line-height: 1.5; color: var(--muted); }
  .step .sample { color: var(--bone); font-size: 12px; border-left: 2px solid var(--line2); padding-left: 8px; }

  .rules { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); }
  .rule { background: var(--panel); padding: 14px 16px 16px; display: grid; gap: 6px; align-content: start; }
  .rule h3 { font-size: 1.2rem; }
  .rule p { font-size: 13px; line-height: 1.5; color: var(--muted); }

  .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
  .chart { margin: 0; padding: 14px 14px 8px; display: grid; gap: 6px; }
  .chart figcaption { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .chart figcaption span { font-size: 12px; color: var(--muted); letter-spacing: .08em; }
  .chart svg { width: 100%; height: auto; overflow: visible; touch-action: pan-y; }
  .chart .grid { stroke: var(--grid); stroke-width: 1; }
  .chart .tick { fill: var(--muted); font: 400 11px var(--fb); font-variant-numeric: tabular-nums; }
  .chart .line { fill: none; stroke: var(--amber); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .chart .area { fill: var(--amber); opacity: .1; }
  .chart .end { fill: var(--amber); stroke: var(--panel); stroke-width: 2; }
  .chart .endlabel { fill: var(--text); font: 400 15px var(--fd); }
  .chart .cross { stroke: var(--muted); stroke-width: 1; }
  .tip { position: absolute; top: 44px; pointer-events: none; background: var(--panel2); border: 1px solid var(--line2); padding: 6px 9px; font-size: 12px; line-height: 1.4; color: var(--text); white-space: nowrap; z-index: 2; }
  .table-view summary { cursor: pointer; color: var(--muted); font-size: 12.5px; letter-spacing: .12em; text-transform: uppercase; }
  .table-view table { margin-top: 10px; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
  .table-view th, .table-view td { padding: 4px 14px 4px 0; text-align: left; border-bottom: 1px solid var(--line); }
  .table-view th { color: var(--muted); font-weight: 400; letter-spacing: .1em; }

  .route {
    list-style: none; margin: 0; padding: 22px 6px 14px; display: grid;
    grid-template-columns: repeat(${phases.length}, minmax(0, 1fr));
    background: url("data:image/svg+xml,${HEXGRID}") center / 56px 97px, var(--panel);
    border: 1px solid var(--line);
  }
  .node { position: relative; display: flex; min-width: 0; }
  .node:not(:last-child)::after {
    content: ''; position: absolute; top: 33px; left: calc(50% + 34px); right: calc(-50% + 34px); height: 0;
    border-top: 2px dashed var(--faint);
  }
  .node.done:not(:last-child)::after { border-top: 2px solid var(--green); }
  .node-btn {
    width: 100%; background: none; border: 0; cursor: pointer; padding: 0 4px 8px;
    display: grid; justify-items: center; align-content: start; gap: 7px; text-align: center;
  }
  .node-btn:hover .node-title { color: var(--amber); }
  .node-btn[aria-pressed="true"] { outline: 1px dashed var(--bone); outline-offset: 4px; }
  .hex { width: 66px; height: 66px; display: grid; place-items: center; clip-path: polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%); background: var(--faint); }
  .hex span { width: 62px; height: 62px; display: grid; place-items: center; clip-path: inherit; background: var(--panel2); font: 400 2.1rem/1 var(--fd); color: var(--muted); }
  .done .hex { background: var(--green); } .done .hex span { color: var(--green); }
  .open .hex { background: var(--amber); } .open .hex span { color: var(--amber); }
  .focus .hex { background: var(--bone); animation: lock 1.6s ease-in-out infinite; } .focus .hex span { color: var(--bone); }
  .ideas .hex { background: repeating-linear-gradient(45deg, var(--muted) 0 3px, transparent 3px 6px); }
  @keyframes lock { 50% { filter: drop-shadow(0 0 12px rgba(242,230,207,.9)); } }
  .node-label { font-size: 10.5px; letter-spacing: .16em; color: var(--faint); }
  .done .node-label { color: var(--green); } .open .node-label { color: var(--amber); } .focus .node-label { color: var(--bone); }
  .node-title { font: 400 1.15rem/1.05 var(--fd); letter-spacing: .04em; color: var(--text); max-width: 14ch; }
  .locked .node-title { color: var(--muted); }
  .node-bar { width: 70%; height: 4px; background: rgba(255,176,0,.12); }
  .node-bar i { display: block; height: 100%; background: var(--green); }
  .node-count { font-size: 12px; color: var(--muted); letter-spacing: .08em; font-variant-numeric: tabular-nums; }

  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .chip { background: var(--panel); border: 1px solid var(--line2); padding: 6px 12px; font: 400 12px/1 var(--fb); letter-spacing: .14em; color: var(--muted); cursor: pointer; text-transform: uppercase; }
  .chip:hover { color: var(--amber); border-color: var(--amber); }
  .chip[aria-pressed="true"] { background: var(--amber); color: var(--bg); border-color: var(--amber); }
  .phase-pill { display: none; gap: 10px; align-items: center; margin-left: auto; color: var(--bone); font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }
  .phase-pill.on { display: inline-flex; }
  .phase-pill button { background: none; border: 1px solid var(--bone); padding: 5px 9px; cursor: pointer; color: var(--bone); letter-spacing: .14em; }
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
  .it.idea .tag { color: var(--bone); } .it.idea .t { color: var(--muted); }
  .it .ph { font-size: 11px; color: var(--faint); letter-spacing: .08em; }
  .it[hidden] { display: none; }
  .empty-note { display: none; font-size: 12px; letter-spacing: .14em; color: var(--faint); }
  .front.empty .empty-note { display: block; }
  .front.empty { opacity: .45; }

  .log { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; align-items: start; }
  .day { border-left: 2px solid var(--line2); padding-left: 16px; display: grid; gap: 10px; }
  .day h3 { display: flex; gap: 12px; align-items: baseline; font-size: 1.6rem; }
  .day h3 span { font: 400 12px var(--fb); letter-spacing: .14em; color: var(--muted); text-transform: uppercase; }
  .day ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 7px; }
  .day ol li { font-size: 13.5px; line-height: 1.45; color: var(--text); position: relative; }
  .day ol li::before { content: ''; position: absolute; left: -21px; top: .55em; width: 8px; height: 8px; background: var(--amber); box-shadow: 0 0 0 2px var(--bg); }

  .feed { list-style: none; margin: 0; padding: 6px 0; display: grid; }
  .feed li { display: grid; grid-template-columns: 44px 48px 150px 1fr; gap: 12px; padding: 8px 16px; font-size: 13.5px; border-bottom: 1px dashed var(--line); align-items: baseline; }
  .feed li:last-child { border-bottom: 0; }
  .feed .prn { color: var(--amber); font-variant-numeric: tabular-nums; }
  .feed time { color: var(--faint); font-variant-numeric: tabular-nums; }
  .feed .fr { display: block; color: var(--muted); font-size: 11.5px; letter-spacing: .04em; margin-top: 2px; }

  .source { color: var(--faint); font-size: 12px; letter-spacing: .06em; }

  .news { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
  .news > div { padding: 12px 0 4px; }
  .news h3 { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 0 16px 10px; font-size: 1.1rem; border-bottom: 1px dashed var(--line); }
  .news h3 a { font: 400 12px var(--fb); letter-spacing: .08em; color: var(--muted); }
  .news ol { list-style: none; margin: 0; padding: 0; }
  .news li { padding: 8px 16px; font-size: 13.5px; line-height: 1.45; border-bottom: 1px dashed var(--line); }
  .news li:last-child { border-bottom: 0; }
  .news time { color: var(--faint); font-variant-numeric: tabular-nums; margin-right: 10px; }
  .news .prn { color: var(--amber); margin-right: 8px; font-variant-numeric: tabular-nums; }
  .sub-h { margin: 24px 0 10px; font-size: 1.2rem; }
  .checks { list-style: none; margin: 0; padding: 6px 0; }
  .checks li { position: relative; padding: 8px 16px 8px 46px; font-size: 13.5px; line-height: 1.5; border-bottom: 1px dashed var(--line); }
  .checks li:last-child { border-bottom: 0; }
  .checks li::before { content: '[ ]'; position: absolute; left: 14px; color: var(--amber); }
  .sheets li { grid-template-columns: 64px 1fr minmax(0, 240px); }
  .sheets .st { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--faint); }
  .sheets .st.ok { color: var(--green); }
  .sheets .who { color: var(--muted); font-size: 12.5px; }
  @media (max-width: 980px) {
    .flow { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .step:nth-child(4n):not(:last-child)::after { content: '→'; }
    .step:nth-child(2n)::after { content: none; }
  }
  @media (max-width: 860px) {
    .route { grid-template-columns: 1fr; gap: 4px; }
    .node:not(:last-child)::after { top: 70px; bottom: -6px; left: 39px; right: auto; height: auto; border-top: 0; border-left: 2px dashed var(--faint); }
    .node.done:not(:last-child)::after { border-left: 2px solid var(--green); }
    .node-btn { grid-template-columns: 66px 1fr auto; grid-template-areas: 'hex label count' 'hex title title' 'hex bar bar'; justify-items: start; text-align: left; column-gap: 14px; }
    .hex { grid-area: hex; } .node-label { grid-area: label; } .node-title { grid-area: title; max-width: none; } .node-bar { grid-area: bar; width: 100%; } .node-count { grid-area: count; }
    .fronts { grid-template-columns: 1fr; }
    .stream li { grid-template-columns: 1fr auto; row-gap: 2px; } .stream time { grid-column: 1; } .stream .agent { grid-column: 2; grid-row: 1; justify-self: end; } .stream .msg { grid-column: 1 / -1; } .stream .sha { display: none; }
    .heat-grid { grid-template-columns: 40px repeat(24, minmax(0, 1fr)); gap: 2px; } .heat-grid .hh { font-size: 9px; }
    .feed li { grid-template-columns: 44px 1fr; row-gap: 4px; } .feed time { display: none; } .feed .ft { grid-column: 1 / -1; }
  }
  @media (max-width: 560px) {
    .flow { grid-template-columns: 1fr; gap: 28px; }
    .step:nth-child(n):not(:last-child)::after { content: '↓'; right: auto; left: 50%; top: auto; bottom: -25px; }
  }
`;

const script = `
  (() => {
    // Filtros das frentes (status e fase).
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

    // Gráficos: linha vertical + dica com a entrega mais próxima do ponteiro.
    for (const fig of document.querySelectorAll('.chart')) {
      const pts = JSON.parse(fig.dataset.points);
      const svg = fig.querySelector('svg');
      const cross = fig.querySelector('.cross');
      const tip = fig.querySelector('.tip');
      const x0 = +fig.dataset.x0, x1 = +fig.dataset.x1, w = +fig.dataset.w;
      const fmt = (n) => n.toLocaleString('pt-BR');
      svg.addEventListener('pointermove', (e) => {
        const r = svg.getBoundingClientRect();
        const vx = ((e.clientX - r.left) / r.width) * w;
        const i = Math.max(0, Math.min(pts.length - 1, Math.round(((vx - x0) / (x1 - x0)) * (pts.length - 1))));
        const cx = x0 + (pts.length > 1 ? i / (pts.length - 1) : 0) * (x1 - x0);
        cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
        const [pr, date, v] = pts[i];
        tip.textContent = (pr ? 'PR #' + pr : 'commit ' + (i + 1)) + ' · ' + date.split('-').reverse().slice(0, 2).join('/') + ' · ' + fmt(v) + ' ' + fig.dataset.unit;
        tip.hidden = false;
        const px = (cx / w) * r.width + svg.offsetLeft;
        tip.style.left = Math.min(Math.max(px - tip.offsetWidth / 2, 4), fig.clientWidth - tip.offsetWidth - 4) + 'px';
      });
      svg.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; });
    }
  })();
`;

const body = `
  ${topo({ base: BASE, current: 'sala', left: `CYBERMECH // SALA DE CONTROLE`, live: `atualizado a cada entrega · ${esc(m.head)}` })}

  <header class="hero">
    <p class="boot">&gt; sala de controle · como o jogo é feito${m.day ? ` · dia ${m.day} do projeto` : ''}<span class="cursor" aria-hidden="true">█</span></p>
    <h1 class="title">SALA DE CONTROLE<span>DA OPERAÇÃO</span></h1>
    <p class="pitch">Dan, três IAs e um protocolo. No CYBERMECH, cada decisão fica registrada, cada entrega passa por testes automáticos e vai para o ar sozinha. Esta página é gerada do próprio repositório a cada entrega; nenhum número aqui é digitado à mão.</p>
    <div class="sitrep">
      ${m.day ? `<div class="read frame"><span class="k">Dia de projeto</span><span class="v">${m.day} <small>desde ${brDate(m.first)}</small></span></div>` : ''}
      <div class="read frame"><span class="k">Commits</span><span class="v">${act.total}</span></div>
      <div class="read frame"><span class="k">Entregas</span><span class="v">${prs.length} <small>PRs no ar</small></span></div>
      <div class="read frame"><span class="k">Testes</span><span class="v">${nf(last.tests)} <small>automáticos</small></span></div>
      <div class="read frame"><span class="k">Linhas de código</span><span class="v">${nf(last.loc)} <small>TypeScript</small></span></div>
      <div class="read frame"><span class="k">Roadmap</span><span class="v">${stats.pct}% <small>${stats.done}/${stats.total}</small></span></div>
      ${m.version ? `<div class="read frame"><span class="k">Versão</span><span class="v">${esc(m.version)}</span></div>` : ''}
    </div>
  </header>

  <section aria-labelledby="novidades">
    <span class="kicker">// transmissão</span>
    <h2 id="novidades">Novidades</h2>
    ${newsHtml}
  </section>

  <section aria-labelledby="equipe">
    <span class="kicker">// esquadrão</span>
    <h2 id="equipe">A equipe</h2>
    <p class="lede">Cada IA tem um território de arquivos e trabalha na própria pasta, para uma não desfazer o trabalho da outra. Dan decide; as IAs propõem, constroem e provam com teste.</p>
    <div class="team">${teamHtml}</div>
    ${fromGithub ? '' : '<p class="source">Sem acesso ao GitHub neste build: entregas contadas pelo git, sem etiquetas de frente e agente.</p>'}
  </section>

  ${mesaHtml}

  <section aria-labelledby="atividade">
    <span class="kicker">// canal da equipe · registro do git</span>
    <h2 id="atividade">Atividade</h2>
    <p class="lede">Cada commit e cada entrega, com quem fez e quando. O mapa mostra as horas de trabalho: quanto mais aceso, mais commits naquela hora.</p>
    <div class="sitrep">
      <div class="read frame"><span class="k">Commits</span><span class="v">${act.total}</span></div>
      <div class="read frame"><span class="k">Entregas</span><span class="v">${act.merges} <small>no ar</small></span></div>
      <div class="read frame"><span class="k">Decisões registradas</span><span class="v">${log.length}</span></div>
      <div class="read frame"><span class="k">Pedidos do Dan</span><span class="v">${asked} <small>atendidos</small></span></div>
    </div>
    <figure class="heat frame">
      <figcaption>commits por hora (horário de Brasília)</figcaption>
      <div class="heat-grid" role="img" aria-label="Mapa de calor de commits por dia e hora">${heatHtml}<span></span>${hours}</div>
      <div class="heat-legend" aria-hidden="true"><span>menos</span><i style="--v:.15"></i><i style="--v:.4"></i><i style="--v:.7"></i><i style="--v:1"></i><span>mais</span></div>
    </figure>
    <div class="stream frame"><ol>${streamHtml}</ol></div>
  </section>

  <section aria-labelledby="fluxo">
    <span class="kicker">// da ideia ao ar</span>
    <h2 id="fluxo">Como um pedido vira jogo</h2>
    <p class="lede">O caminho de toda mudança, com um exemplo real: o estande de calibração do mouse, pedido numa frase e publicado no mesmo dia.</p>
    <ol class="flow">${flowHtml}</ol>
    <p class="loop">↺ e o ciclo recomeça no 01</p>
  </section>

  ${fichasHtml}

  <section aria-labelledby="protocolo">
    <span class="kicker">// regras de engajamento</span>
    <h2 id="protocolo">Protocolo Serafim UM</h2>
    <p class="lede">O protocolo de engenharia que toda IA segue neste projeto: memória persistente, 17 regras absolutas e um ritual de entrada e de saída a cada sessão. Parte dele é aplicada por travas automáticas, não pela boa vontade de quem programa.</p>
    <ul class="rules">${rulesHtml}</ul>
  </section>

  ${evoHtml}

  <section aria-labelledby="rota">
    <span class="kicker">// rota de operações</span>
    <h2 id="rota">Mapa da campanha</h2>
    <p class="lede">Cada hexágono é uma fase. O que pulsa em branco é onde a equipe está agora. Clique num hexágono para filtrar as frentes por fase.</p>
    <ol class="route">${routeHtml}</ol>
  </section>

  ${gestaoHtml}

  <section aria-labelledby="frentes">
    <span class="kicker">// sistemas da unidade</span>
    <h2 id="frentes">Frentes de trabalho</h2>
    <p class="lede">Cada frente é um sistema do Mech; os slots são os itens do roadmap. Verde é feito, meio preenchido está em andamento, tracejado é ideia.</p>
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

  <section aria-labelledby="diario">
    <span class="kicker">// diário de bordo</span>
    <h2 id="diario">Decisões</h2>
    <p class="lede">Toda decisão relevante entra num cofre que só cresce: o que foi decidido, por quê e por quem. É daqui que qualquer IA recupera o contexto antes de mexer no jogo.</p>
    <ol class="log">${logHtml}</ol>
  </section>

  <section aria-labelledby="entregas">
    <span class="kicker">// registro de combate</span>
    <h2 id="entregas">Entregas</h2>
    <p class="lede">Cada linha é um pull request que passou pelo CI e foi para o ar, com quem fez e as frentes que mexeu.</p>
    <ul class="feed frame">${prHtml}</ul>
  </section>

  <footer><span>CYBERMECH © ${new Date().getFullYear()} <b>SERAFIM WEB</b> · fim da transmissão ·${SITE ? 'gerado do repositório a cada entrega' : 'gerado do ROADMAP, ESTADO, HISTORICO e git · npm run painel'}</span><span>build ${esc(m.head)} · ${esc(m.generated)} BRT</span></footer>
`;

const html = pagina({
  title: SITE ? 'Sala de controle · CYBERMECH' : 'Painel de Missão CYBERMECH',
  description: 'Como o CYBERMECH é feito: Dan e uma equipe de IAs sob o Protocolo Serafim UM, com cada decisão, teste e entrega à vista.',
  css,
  body,
  script,
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(
  `painel  ${OUT} (${fronts.length} frentes, ${stats.done}/${stats.total} itens, ${prs.length} entregas${fromGithub ? ' do GitHub' : ' do git'}, ${log.length} decisões, ${evo.length} leituras)`,
);
