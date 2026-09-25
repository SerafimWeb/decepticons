/**
 * Gráficos do site em SVG gerado no build (sem biblioteca, sem JavaScript para desenhar). Regras de
 * dataviz do projeto: uma série por gráfico (várias séries viram gráficos lado a lado, na mesma escala);
 * cor só com significado (âmbar = dado, vermelho = travado/alerta, quente × frio nas barras divergentes);
 * texto sempre na cor de texto; todo gráfico tem título, rótulos diretos e uma tabela para quem não vê.
 * Cada marca tem <title> (dica nativa ao passar o mouse ou tocar e segurar).
 */
import { esc } from './tema.mjs';

export const nf = (n, d = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (x, d = 0) => `${nf(x * 100, d)}%`;

/** Teto "redondo" para o eixo (51 → 60, 4.882 → 5.000). */
export function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(Math.max(v, 1e-9)));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((k) => k * p).find((x) => x >= v * 0.999);
}

export const CHART_CSS = `
  .g { margin: 0; padding: 12px 14px 10px; display: grid; gap: 6px; align-content: start; min-width: 0; }
  .g figcaption { display: grid; gap: 2px; }
  .g figcaption h3 { font: 400 1.2rem/1.1 var(--fd); letter-spacing: .05em; }
  .g figcaption p { color: var(--muted); font-size: 12.5px; line-height: 1.45; }
  .g figcaption p b { color: var(--text); }
  .g svg { width: 100%; height: auto; overflow: visible; }
  .g .grid { stroke: var(--grid); stroke-width: 1; }
  .g .axis { stroke: var(--line2); stroke-width: 1; }
  .g .tick { fill: var(--muted); font: 400 10.5px var(--fb); font-variant-numeric: tabular-nums; }
  .g .line { fill: none; stroke: var(--amber); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .g .area { fill: var(--amber); opacity: .1; }
  .g .band { fill: var(--amber); opacity: .07; }
  .g .band-edge { stroke: var(--amber); stroke-width: 1; stroke-dasharray: 3 3; opacity: .55; }
  .g .ceil { stroke: var(--red); stroke-width: 1; opacity: .7; }
  .g .lock { fill: var(--red); }
  .g .lbl { fill: var(--muted); font: 400 10px var(--fb); letter-spacing: .12em; text-transform: uppercase; }
  .g .lbl-hot { fill: var(--red); }
  .g .val { fill: var(--text); font: 400 11.5px var(--fb); font-variant-numeric: tabular-nums; }
  .g .mark { fill: var(--amber); stroke: var(--panel); stroke-width: 2; }
  .bars { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 7px; }
  .bars li { display: grid; grid-template-columns: minmax(12ch, 15rem) 1fr 9ch; gap: 12px; align-items: center; font-size: 13.5px; }
  .bars.rank li { grid-template-columns: minmax(12ch, 17rem) 1fr 12ch; }
  .bars .bl { color: var(--text); }
  .bars .bv { color: var(--text); font-variant-numeric: tabular-nums; text-align: right; }
  .bars .bv small { display: block; color: var(--muted); font-size: 11px; }
  .dtrack { display: flex; height: 14px; }
  .dneg { flex: 0 0 auto; display: flex; justify-content: flex-end; border-right: 1px solid var(--line2); }
  .dpos { flex: 1 1 0; display: flex; }
  .rtrack { display: flex; height: 14px; background: rgba(255,176,0,.08); }
  .dtrack i, .rtrack i { display: block; height: 100%; border-radius: 2px; }
  .warm { background: #e8553a; }
  .cool { background: #2a9db2; }
  .rtrack i { background: var(--amber); }
  .rtrack i.best { background: var(--green); }
  @media (max-width: 620px) {
    .bars li, .bars.rank li { grid-template-columns: 1fr auto; gap: 4px 10px; }
    .bars .bl { grid-column: 1 / -1; font-size: 12.5px; color: var(--muted); }
  }
  .minis { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 14px; }
  .heatmap { width: 100%; border-collapse: separate; border-spacing: 3px; font-variant-numeric: tabular-nums; }
  .heatmap th { font-weight: 400; font-size: 11px; letter-spacing: .14em; color: var(--muted); text-align: left; padding: 4px 6px; }
  .heatmap thead th { text-align: center; }
  .heatmap thead th small { display: block; letter-spacing: .08em; color: var(--faint); }
  .heatmap td { text-align: center; padding: 10px 6px; color: var(--text); font-size: 14px; border: 1px solid var(--line); }
  .heat-legend { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
  .heat-legend i { display: inline-block; width: 90px; height: 10px; background: linear-gradient(90deg, rgba(255,176,0,.9), rgba(255,176,0,.08)); border: 1px solid var(--line); }
  .scroll-x { overflow-x: auto; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .table-view summary { cursor: pointer; color: var(--muted); font-size: 12.5px; letter-spacing: .12em; text-transform: uppercase; }
  .table-view table { margin-top: 10px; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
  .table-view th, .table-view td { padding: 4px 14px 4px 0; text-align: left; border-bottom: 1px solid var(--line); }
  .table-view th { color: var(--muted); font-weight: 400; letter-spacing: .1em; }
`;

/**
 * Linha no tempo (uma série), com faixa de alerta opcional e tiras de "travado" no pé do gráfico.
 * `xs`/`ys`: pontos; `band`: [y0, y1, rótulo]; `ceiling`: y da linha vermelha; `locks`: 0/1 por ponto.
 */
export function lineChart({ title, caption, xs, ys, xMax, yMax, xTicks, yTicks, xFmt, yFmt, band, ceiling, locks, marks = [], ariaLabel }) {
  const W = 320;
  const H = 150;
  const pad = { l: 34, r: 10, t: 10, b: locks ? 30 : 22 };
  const x = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b - (locks ? 8 : 0));
  const y0 = y(0);
  const d = xs.map((xv, i) => `${i ? 'L' : 'M'}${x(xv).toFixed(1)},${y(ys[i]).toFixed(1)}`).join('');
  const grid = yTicks
    .map((t) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="tick" x="${pad.l - 6}" y="${(y(t) + 3.5).toFixed(1)}" text-anchor="end">${yFmt(t)}</text>`)
    .join('');
  const xt = xTicks.map((t) => `<text class="tick" x="${x(t).toFixed(1)}" y="${H - 4}" text-anchor="middle">${xFmt(t)}</text>`).join('');
  const bandSvg = band
    ? `<rect class="band" x="${pad.l}" width="${W - pad.l - pad.r}" y="${y(band[1]).toFixed(1)}" height="${(y(band[0]) - y(band[1])).toFixed(1)}"/><line class="band-edge" x1="${pad.l}" x2="${W - pad.r}" y1="${y(band[0]).toFixed(1)}" y2="${y(band[0]).toFixed(1)}"/><text class="lbl" x="${W - pad.r - 2}" y="${(y(band[0]) - 4).toFixed(1)}" text-anchor="end">${esc(band[2])}</text>`
    : '';
  const ceil = ceiling !== undefined ? `<line class="ceil" x1="${pad.l}" x2="${W - pad.r}" y1="${y(ceiling).toFixed(1)}" y2="${y(ceiling).toFixed(1)}"/>` : '';
  // Tiras de "travado": segmentos contínuos de locks = 1, numa faixa logo abaixo do eixo.
  let lockSvg = '';
  if (locks) {
    let start = -1;
    const stripY = y0 + 4;
    const flush = (end) => {
      if (start < 0) return;
      lockSvg += `<rect class="lock" x="${x(xs[start]).toFixed(1)}" y="${stripY.toFixed(1)}" width="${Math.max(1.5, x(xs[end]) - x(xs[start])).toFixed(1)}" height="5"><title>travado de ${nf(xs[start], 1)} a ${nf(xs[end], 1)} s</title></rect>`;
      start = -1;
    };
    locks.forEach((l, i) => {
      if (l && start < 0) start = i;
      if (!l) flush(i);
    });
    flush(locks.length - 1);
    if (lockSvg) lockSvg = `<text class="lbl lbl-hot" x="${pad.l}" y="${(stripY + 16).toFixed(1)}">▮ travado</text>${lockSvg}`;
  }
  const markSvg = marks.map((mk) => `<circle class="mark" cx="${x(mk.x).toFixed(1)}" cy="${y(mk.y).toFixed(1)}" r="4"><title>${esc(mk.title)}</title></circle>`).join('');
  return `<figure class="g frame">
      <figcaption><h3>${esc(title)}</h3>${caption ? `<p>${caption}</p>` : ''}</figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel ?? title)}">
        ${grid}${bandSvg}${ceil}
        <line class="axis" x1="${pad.l}" x2="${W - pad.r}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}"/>
        <path class="area" d="${d}L${x(xs.at(-1)).toFixed(1)},${y0.toFixed(1)}L${x(xs[0]).toFixed(1)},${y0.toFixed(1)}Z"/>
        <path class="line" d="${d}"/>
        ${markSvg}${lockSvg}${xt}
      </svg>
    </figure>`;
}

/**
 * Barras divergentes a partir do zero: positivo para a direita (quente), negativo para a esquerda
 * (frio). Em HTML/CSS: o texto fica no tamanho da página e a linha quebra no celular.
 * `items`: { label, value, title }.
 */
export function divergingBars({ title, caption, items, fmt, ariaLabel }) {
  const maxPos = Math.max(0, ...items.map((i) => i.value));
  const maxNeg = Math.max(0, ...items.map((i) => -i.value));
  const total = maxPos + maxNeg || 1;
  const negShare = (maxNeg / total) * 100;
  const rows = items
    .map((it) => {
      const w = (Math.abs(it.value) / (it.value >= 0 ? maxPos || 1 : maxNeg || 1)) * 100;
      const bar = `<i class="${it.value >= 0 ? 'warm' : 'cool'}" style="width:${Math.max(1.5, w).toFixed(1)}%" title="${esc(it.title ?? `${it.label}: ${fmt(it.value)}`)}"></i>`;
      return `<li><span class="bl">${esc(it.label)}</span><span class="dtrack"><span class="dneg" style="flex-basis:${negShare.toFixed(1)}%">${it.value < 0 ? bar : ''}</span><span class="dpos">${it.value >= 0 ? bar : ''}</span></span><span class="bv">${fmt(it.value)}</span></li>`;
    })
    .join('');
  return `<figure class="g frame">
      <figcaption><h3>${esc(title)}</h3>${caption ? `<p>${caption}</p>` : ''}</figcaption>
      <ul class="bars" aria-label="${esc(ariaLabel ?? title)}">${rows}</ul>
    </figure>`;
}

/** Barras horizontais ordenadas (uma série), em HTML/CSS. `best` pinta de verde a barra que vence. */
export function rankBars({ title, caption, items, fmt, ariaLabel }) {
  const max = Math.max(...items.map((i) => i.value), 1e-9);
  const rows = items
    .map(
      (it) =>
        `<li><span class="bl">${esc(it.label)}</span><span class="rtrack"><i class="${it.best ? 'best' : ''}" style="width:${Math.max(1.5, (it.value / max) * 100).toFixed(1)}%" title="${esc(it.title ?? `${it.label}: ${fmt(it.value)}`)}"></i></span><span class="bv">${fmt(it.value)}${it.note ? `<small>${esc(it.note)}</small>` : ''}</span></li>`,
    )
    .join('');
  return `<figure class="g frame">
      <figcaption><h3>${esc(title)}</h3>${caption ? `<p>${caption}</p>` : ''}</figcaption>
      <ul class="bars rank" aria-label="${esc(ariaLabel ?? title)}">${rows}</ul>
    </figure>`;
}

/**
 * Mapa de calor em tabela (escala de uma cor só: mais intenso = mais rápido/forte). `cells[r][c]` =
 * { v, text, title }. `strong(v)` devolve 0..1 (1 = mais intenso).
 */
export function heatTable({ rows, cols, cells, strong, caption }) {
  const head = `<thead><tr><th scope="col"><span class="sr">arma</span></th>${cols.map((c) => `<th scope="col">${esc(c.label)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</th>`).join('')}</tr></thead>`;
  const body = rows
    .map(
      (r, i) =>
        `<tr><th scope="row">${esc(r)}</th>${cells[i]
          .map((c) => {
            const k = strong(c.v);
            return `<td style="background:rgba(255,176,0,${(0.06 + 0.55 * k).toFixed(3)})" title="${esc(c.title)}">${esc(c.text)}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('');
  return `<div class="scroll-x"><table class="heatmap">${caption ? `<caption class="sr">${esc(caption)}</caption>` : ''}${head}<tbody>${body}</tbody></table></div>`;
}
