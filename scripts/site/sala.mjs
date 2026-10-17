/**
 * Sala de controle no sistema visual do site: esquadrão (as IAs e o Dan), atividade (mapa de calor por dia da
 * semana e hora, registro de entregas e commits) e "como um pedido vira jogo". Todos os números vêm do git e dos
 * documentos do projeto (`dados.mjs`); aqui só se monta o HTML. O resto da página (guia, novidades, protocolo,
 * evolução, rota, frentes, decisões, entregas) é o markup antigo, extraído por `id` e reaproveitado.
 */
import { brDate, esc } from './tema.mjs';
import { hudFooter, hudNav, ico, limpaRotulos, pageHero } from './hud.mjs';

const TZ = 'America/Sao_Paulo';
const WD = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const WD_IDX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

const SQUAD = {
  dono: { label: 'Criador', c: '#ffd000', title: 'Direção e game design', art: 'eq-dan.jpg', list: ['Direção de produto', 'Game design e level design', 'Prioridades do desenvolvimento', 'Avaliação de jogabilidade', 'Aprovação do que vai ao ar'] },
  claude: { label: 'Anthropic', c: '#ff6a5a', title: 'Arquitetura e engenharia', art: 'eq-claude.jpg' },
  gemini: { label: 'Google', c: '#4aa3ff', title: 'Interface e som', art: 'eq-gemini.jpg' },
  codex: { label: 'OpenAI', c: '#3bd68a', title: 'Visual e render', art: 'eq-codex.jpg' },
  qwen: { label: 'Alibaba', c: '#b07bff', title: 'Qualidade e documentação', art: 'cena-colossusv4.jpg' },
};
const TAG_COLOR = { entrega: '#5dff8a', claude: '#ff6a5a', gemini: '#4aa3ff', codex: '#3bd68a', qwen: '#b07bff', dono: '#ffd000', equipe: '#97a1ac' };
const FLOW_ICON = ['file', 'scan', 'folder', 'code', 'chip', 'shield', 'bolt', 'target'];

const kpi = (icon, label, value, small = '') => `<div class="kpi panel">${ico(icon, 38)}<div><span class="k">${label}</span><span class="v">${value}${small ? `<small>${small}</small>` : ''}</span></div></div>`;

export function salaSite({ BASE, TEAM, act, prs, log, asked, last, stats, estado, fronts, fromGithub, nf, when, flow, bodyLocal, m }) {
  const FRONT_NAME = Object.fromEntries(fronts.map((f) => [f.tag, f.name]));
  const prTitle = new Map(prs.map((p) => [p.n, p.title]));

  /* ---------- esquadrão ---------- */
  const squadHtml = TEAM.map((t, i) => {
    const s = SQUAD[t.key];
    const mine = prs.filter((p) => p.agents.includes(t.key));
    const tally = new Map();
    for (const p of mine) for (const f of p.fronts) tally.set(f, (tally.get(f) ?? 0) + 1);
    const recent = act.commits.filter((c) => !c.merge && c.agent === t.key).slice(0, 4).map((c) => c.subject.replace(/^w+(([^)]*))?!?:s*/, '').slice(0, 58));
    const byFront = [...tally].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => FRONT_NAME[f] ?? f);
    const list = t.key === 'dono' ? s.list : byFront.length ? byFront : recent;
    const lines = mine.reduce((acc, p) => acc + (p.add ?? 0), 0);
    const nums = t.key === 'dono' ? [['Pedidos', asked], ['Decisões', log.length]] : [['Commits', act.byAgent[t.key] ?? 0], ['Entregas', mine.length], ...(fromGithub ? [['Linhas', `+${nf(lines)}`]] : [])];
    return `<article class="sq panel reveal" style="--c:${s.c}">
      <header><span class="org">${esc(s.label)}</span><span class="idx" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span></header>
      <h3>${esc(t.name)}</h3><p class="sub">${esc(s.title)}</p>
      <dl>${nums.map(([k, v]) => `<div><dt>${k}</dt><dd>${typeof v === 'number' ? nf(v) : v}</dd></div>`).join('')}</dl>
      <img src="${BASE}jogar/press/${s.art}" alt="" width="350" height="232" loading="lazy">
      <p class="desc">${esc(t.role)}</p>
      ${list.length ? `<h4>${t.key !== 'dono' && !byFront.length ? 'Últimos commits' : 'Em atividade'}</h4><ul>${list.map((f) => `<li>${ico('hex', 16)}${esc(f)}</li>`).join('')}</ul>` : ''}
    </article>`;
  }).join('');

  /* ---------- atividade: mapa de calor por dia da semana e hora (horário de Brasília) ---------- */
  const wk = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const c of act.commits) {
    if (c.merge) continue;
    const d = new Date(c.t);
    const wd = WD_IDX[d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' })];
    const h = Number(d.toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }));
    if (wd !== undefined && h >= 0) wk[wd][h]++;
  }
  const wkMax = Math.max(1, ...wk.flat());
  const heat = `<figure class="wk panel reveal"><figcaption>Commits por dia da semana e hora (horário de Brasília)<span class="lg" aria-hidden="true"><i style="--v:.12"></i>baixa<i style="--v:.5"></i>média<i style="--v:1"></i>alta</span></figcaption>
    <div class="wk-grid" role="img" aria-label="Mapa de calor: commits por dia da semana e hora">${wk.map((row, d) => `<b class="wd">${WD[d]}</b>${row.map((n, h) => `<i class="c${n ? '' : ' z'}" style="--v:${(n / wkMax).toFixed(2)}" title="${WD[d]} · ${String(h).padStart(2, '0')}h · ${n} commit${n === 1 ? '' : 's'}"></i>`).join('')}`).join('')}
      <span></span>${Array.from({ length: 24 }, (_, h) => `<b class="hr">${h % 3 === 0 ? `${String(h).padStart(2, '0')}h` : ''}</b>`).join('')}</div></figure>`;

  /* ---------- registro: entregas e commits, com filtro por quem fez ---------- */
  const items = act.commits.slice(0, 60);
  const kinds = ['entrega', ...['claude', 'codex', 'gemini', 'qwen', 'dono'].filter((a) => items.some((c) => !c.merge && c.agent === a))];
  const stream = items.map((c) => {
    const kind = c.merge ? 'entrega' : c.agent;
    const text = c.merge ? `entrega #${c.pr} · ${prTitle.get(c.pr) ?? c.subject.replace(/^Merge (PR #\d+: |pull request #\d+ from \S+\s*)/, '')}` : c.subject;
    return `<li data-k="${esc(kind)}"><time>${when(c.t)}</time><span class="tg" style="--c:${TAG_COLOR[kind] ?? TAG_COLOR.equipe}">${c.merge ? 'ENTREGA' : esc(c.agent.toUpperCase())}</span><span class="msg">${esc(text)}</span><code>${esc(c.sha)}</code></li>`;
  }).join('');
  const log_ = `<div class="logbox panel reveal"><div class="logtabs" role="tablist" aria-label="Filtrar o registro"><button type="button" role="tab" aria-selected="true" data-f="todos">Todos</button>${kinds.map((k) => `<button type="button" role="tab" aria-selected="false" data-f="${k}">${k === 'entrega' ? 'Entregas' : k === 'dono' ? 'Dan' : k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div><ol class="logl">${stream}</ol></div>`;

  /* ---------- como um pedido vira jogo ---------- */
  const flowHtml = flow.map(([title, text, sample], i) => `<li class="step panel reveal"><span class="snum">${String(i + 1).padStart(2, '0')}</span>${ico(FLOW_ICON[i] ?? 'hex', 34)}<h3>${esc(title)}</h3><p>${esc(text)}</p><p class="sample">${esc(sample)}</p></li>`).join('');

  /* ---------- o resto da página: o markup antigo, por id ---------- */
  const grab = (id) => bodyLocal.match(new RegExp(`<section aria-labelledby="${id}">[\\s\\S]*?</section>`))?.[0] ?? '';
  const combatNav = bodyLocal.match(/<nav class="combat-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
  const rest = ['validar-build', 'proximas-decisoes', 'novidades', 'mesa', 'fichas', 'protocolo', 'evolucao', 'rota', 'gestao', 'frentes', 'diario', 'entregas'].map(grab).join('\n');

  const body = `
  ${hudNav({ base: BASE, current: 'sala' })}
  <main id="conteudo">
  ${pageHero({
    base: BASE,
    eyebrowText: `Esquadrão${m.day ? ` · dia ${m.day} do projeto` : ''}`,
    title: 'SALA DE CONTROLE',
    sub: 'DA OPERAÇÃO',
    art: 'cena-escala.jpg',
    pitch: 'Dan e uma equipe de IAs construindo um combate que responde às suas decisões. Acompanhe o que mudou, teste a versão e confira o que ainda precisa evoluir. O histórico e os indicadores desta página vêm do repositório.',
  })}
  <div class="page">
    <div class="sitrep kpis">
      ${m.day ? kpi('clock', 'Dia de projeto', m.day, `desde ${brDate(m.first)}`) : ''}
      ${kpi('code', 'Commits', nf(act.total))}
      ${kpi('cube', 'Entregas', nf(prs.length), 'PRs no ar')}
      ${kpi('shield', 'Testes', nf(last.tests), 'no código')}
      ${kpi('bars', 'Linhas de código', nf(last.loc), 'TypeScript')}
      ${kpi('target', 'Roadmap', `${stats.pct}%`, `${stats.done}/${stats.total}`)}
      ${m.version ? kpi('hex', 'Versão', esc(m.version)) : ''}
    </div>

    <section aria-labelledby="equipe">
      <span class="kicker">// esquadrão</span>
      <h2 id="equipe">A equipe</h2>
      <p class="lede">Direção humana, desenvolvimento assistido por IA. Responsabilidades definidas, contribuições rastreáveis e revisão cruzada sustentam a evolução do Cybermech. Cada IA trabalha no próprio território de arquivos; nenhuma aprova o próprio código.</p>
      <div class="sq-grid">${squadHtml}</div>
      ${fromGithub ? '' : '<p class="source">Sem acesso ao GitHub neste build: entregas contadas pelo git, sem etiquetas de frente e agente.</p>'}
    </section>

    <section aria-labelledby="atividade">
      <span class="kicker">// dados da base · registro do git</span>
      <h2 id="atividade">Atividade</h2>
      <p class="lede">Cada commit e cada entrega, com quem fez e quando. O mapa mostra as horas de trabalho: quanto mais aceso, mais commits naquele dia da semana e horário.</p>
      <div class="sitrep kpis">
        ${kpi('code', 'Commits', nf(act.total))}
        ${kpi('cube', 'Entregas', nf(act.merges), 'no ar')}
        ${kpi('file', 'Decisões registradas', nf(log.length))}
        ${kpi('users', 'Requisitos de produto', nf(asked), 'registros históricos')}
      </div>
      ${heat}
      ${log_}
    </section>

    <section aria-labelledby="fluxo">
      <span class="kicker">// da ideia ao game</span>
      <h2 id="fluxo">Como um pedido vira jogo</h2>
      <p class="lede">O ciclo de desenvolvimento, do requisito à avaliação em partida. Cada passo é registrado no repositório e conferido por teste ou por quem joga.</p>
      <ol class="flow">${flowHtml}</ol>
      <p class="loop">↺ e o ciclo recomeça no 01</p>
    </section>

    ${combatNav}
    ${rest}
  </div>
  </main>
  ${hudFooter({ base: BASE })}`;

  const css = `
.kpis{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.kpi{display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center;padding:24px 26px}
.kpi .ico{color:var(--amber);stroke-width:1.3}
.kpi .k{display:block;font:600 13px/1.3 var(--fh);letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.kpi>div{min-width:0}
.kpi .v{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px;margin-top:6px;font:italic 700 clamp(34px,3.4vw,50px)/1 var(--fh);color:var(--amber)}
.kpi small{font:500 14px var(--fb);font-style:normal;letter-spacing:.01em;color:var(--muted)}
.sq-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:24px;align-items:stretch}
.sq{grid-column:span 2;display:flex;flex-direction:column;gap:12px;padding:26px 26px 28px;min-width:0}
.sq:nth-child(n+4){grid-column:span 3}
.sq::before{background:var(--c)}
.sq header{display:flex;justify-content:space-between;align-items:baseline}
.sq .org{font:700 14px/1 var(--fh);letter-spacing:.22em;text-transform:uppercase;color:var(--c)}
.sq .idx{font:italic 700 34px/1 var(--fh);color:transparent;-webkit-text-stroke:1.5px rgba(255,255,255,.45)}
.sq h3{margin:4px 0 0;font:italic 700 clamp(40px,4vw,58px)/.95 var(--fh);letter-spacing:.01em;text-transform:uppercase;color:#fff}
.sq .sub{margin:0;font:600 14px/1.3 var(--fh);letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.sq dl{display:flex;gap:34px;margin:10px 0 4px}
.sq dt{font:600 12.5px/1.3 var(--fh);letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.sq dd{margin:4px 0 0;font:italic 700 clamp(34px,3.4vw,48px)/1 var(--fh);color:var(--c)}
.sq img{display:block;width:calc(100% + 52px);max-width:none;margin:8px -26px 4px;aspect-ratio:350/200;object-fit:cover}
.sq .desc{margin:0;font-size:16.5px;line-height:1.55;color:var(--text);opacity:.88}
.sq h4{margin:10px 0 0;padding-top:14px;border-top:1px solid rgba(255,255,255,.1);font:700 13.5px/1 var(--fh);letter-spacing:.22em;text-transform:uppercase;color:var(--c)}
.sq ul{list-style:none;margin:0;padding:0;display:grid;gap:9px}
.sq li{display:flex;align-items:flex-start;gap:12px;font-size:16px;line-height:1.4;color:var(--text)}
.sq li .ico{margin-top:3px}
.sq li .ico{color:var(--c);stroke-width:1.5}
.wk{margin:0;padding:24px 26px 20px;display:grid;gap:18px}
.wk figcaption{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;font:600 14px/1.3 var(--fh);letter-spacing:.16em;text-transform:uppercase;color:var(--bone)}
.wk .lg{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);letter-spacing:.12em}
.wk .lg i{width:16px;height:16px;background:color-mix(in srgb,var(--amber) calc(var(--v) * 100%),#171d24)}
.wk-grid{display:grid;grid-template-columns:44px repeat(24,minmax(0,1fr));gap:5px;align-items:center}
.wk-grid .wd{font:700 13px var(--fh);letter-spacing:.12em;color:var(--muted)}
.wk-grid .hr{font:600 12px var(--fh);color:var(--faint);letter-spacing:.06em}
.wk-grid .c{display:block;height:30px;background:color-mix(in srgb,var(--amber) calc(var(--v) * 100%),#171d24);transition:transform .15s}
.wk-grid .c.z{background:#141a20}
.wk-grid .c:hover{transform:scale(1.25);position:relative;z-index:2}
.logbox{padding:0 0 6px}
.logtabs{display:flex;gap:6px;flex-wrap:wrap;padding:20px 22px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.logtabs button{padding:12px 18px;border:0;border-bottom:3px solid transparent;background:none;color:var(--muted);font:700 14px/1 var(--fh);letter-spacing:.14em;text-transform:uppercase;cursor:pointer}
.logtabs button:hover{color:#fff}
.logtabs button[aria-selected=true]{color:var(--amber);border-bottom-color:var(--amber)}
.logl{list-style:none;margin:0;padding:8px 0;max-height:520px;overflow-y:auto}
.logl li{display:grid;grid-template-columns:104px 104px 1fr auto;gap:16px;align-items:center;padding:10px 24px;border-bottom:1px solid rgba(255,255,255,.05);font-size:15.5px}
.logl time{font:600 14px var(--fh);color:var(--faint);font-variant-numeric:tabular-nums}
.logl .tg{justify-self:start;min-width:90px;padding:4px 10px;border:1px solid var(--c);color:var(--c);font:700 12px/1.2 var(--fh);letter-spacing:.14em;text-align:center}
.logl .msg{color:var(--text);overflow-wrap:anywhere}
.logl code{font:500 13px var(--fb);color:var(--faint)}
.flow{gap:22px}
.step{display:grid;gap:10px;align-content:start;padding:26px 26px 28px}
.step .snum{position:absolute;top:16px;right:22px;left:auto;width:auto;height:auto;padding:0;background:none;border:0;font:italic 700 46px/1 var(--fh);color:transparent;-webkit-text-stroke:1.5px rgba(255,255,255,.3)}
.step .ico{color:var(--amber);stroke-width:1.3}
.step h3{margin:6px 0 0;font:italic 700 22px/1.15 var(--fh);letter-spacing:.02em;text-transform:uppercase;color:#fff}
.step p{margin:0;font-size:16px;line-height:1.55;color:var(--muted)}
.step .sample{padding-left:12px;border-left:3px solid var(--amber);font-size:14.5px;color:var(--text)}
.step:not(:last-child)::after{color:var(--amber)}
.loop{margin:6px 0 0;font:700 13.5px var(--fh);letter-spacing:.16em;text-transform:uppercase;color:var(--green)}
@media(max-width:1180px){.sq-grid{grid-template-columns:repeat(2,1fr)}.sq,.sq:nth-child(n+4){grid-column:auto}.sq:last-child{grid-column:1/-1}}
@media(max-width:860px){.sq-grid{grid-template-columns:1fr}.logl li{grid-template-columns:1fr auto;row-gap:6px}.logl time{grid-column:1}.logl .tg{grid-column:2;grid-row:1}.logl .msg{grid-column:1/-1}.logl code{display:none}.wk-grid{grid-template-columns:34px repeat(24,minmax(0,1fr));gap:3px}.wk-grid .c{height:22px}.wk-grid .hr{font-size:10px}.kpi{padding:18px 20px}}
`;

  const js = `(() => {
  const box = document.querySelector('.logbox'); if (!box) return;
  const tabs = [...box.querySelectorAll('[data-f]')]; const rows = [...box.querySelectorAll('.logl li')];
  tabs.forEach((t) => t.addEventListener('click', () => { const f = t.dataset.f; tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t))); rows.forEach((r) => { r.hidden = f !== 'todos' && r.dataset.k !== f; }); }));
})();`;

  return { body: limpaRotulos(body), css, js };
}
