/**
 * O grafo da arquitetura do CYBERMECH: um **mapa de setores desenhado** — SVG gerado no build, sem física e
 * sem biblioteca. O núcleo fica no centro; cada **frente** do ROADMAP é um setor ao redor, com os seus módulos.
 *
 * Compõe o que o projeto tem: cada módulo traz arquivos, linhas e **quantos testes o cobrem**; a cor é a
 * **frente**; os selos são a **equipe** que entregou a frente (das etiquetas dos PRs). Tudo lido dos arquivos,
 * do git e das etiquetas — nada digitado à mão (R14).
 *
 * O tema é o neon do jogo, não o âmbar do site: o grafo é uma peça da bancada, e ali vale a paleta do jogo.
 *
 * Uso: const { html, css, script } = grafoOficina(arquitetura(), porModulo(prs));
 */
import { esc } from './tema.mjs';
import { MOD_FRENTE } from './dados.mjs';

/** A frente do ROADMAP: cor e rótulo (o mesmo vocabulário do `ROADMAP.md`). O neon vem do jogo. */
const FRENTES = {
  jogabilidade: { cor: '#00e5ff', rotulo: 'jogabilidade' },
  combate: { cor: '#ff2d3d', rotulo: 'combate e armas' },
  mechs: { cor: '#ffb000', rotulo: 'design dos mechs' },
  cenarios: { cor: '#ff2bd6', rotulo: 'cenários' },
  ux: { cor: '#eef2e8', rotulo: 'interface e experiência' },
  som: { cor: '#ffe14d', rotulo: 'som' },
  rede: { cor: '#2dd4bf', rotulo: 'multiplayer' },
  desempenho: { cor: '#c9a0ff', rotulo: 'desempenho' },
  base: { cor: '#39ff6a', rotulo: 'base técnica' },
  negocio: { cor: '#ff8a1f', rotulo: 'lançamento e negócio' },
};

/** Os agentes: inicial e cor (as mesmas do painel e das etiquetas dos PRs). */
const AGENTES = {
  claude: { letra: 'C', cor: '#ff9a6b' },
  gemini: { letra: 'G', cor: '#eef2e8' },
  codex: { letra: 'X', cor: '#5fd8a8' },
  qwen: { letra: 'Q', cor: '#7fd4ff' },
  dono: { letra: 'D', cor: '#ffb000' },
};

/** Nome legível do módulo (o id `raiz` é o `client/src` no topo). */
const MOD_NOME = { raiz: 'app', shared: 'shared', scripts: 'scripts' };

const nf = (n) => n.toLocaleString('pt-BR');
const frenteOf = (id) => (FRENTES[MOD_FRENTE[id] ?? 'base'] ?? FRENTES.base);

/**
 * O ícone de cada módulo — a ideia que o dono trouxe do grafo do STERM: um símbolo por tipo de elemento, não
 * só uma cor (lá, o ícone de banco de dados dizia "isto é dado"). Aqui são primitivas de SVG desenhadas à mão,
 * no traço do neon do jogo: sem biblioteca e sem arquivo de imagem — cerca de 150 bytes por ícone dentro do
 * HTML do build, zero requisição e zero KB no jogo (G12). O que não estiver no mapa cai no ícone da frente.
 */
const ICONES = {
  physics: '<path d="M12 3v10m0 0l-4-4m4 4l4-4"/><path d="M4 20h16"/>',
  player: '<circle cx="12" cy="6" r="2.6"/><path d="M12 9v6M8.5 20l3.5-5 3.5 5M6 13l6 2 6-2"/>',
  camera: '<rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 12l6-3v6l-6-3z"/>',
  combat: '<circle cx="12" cy="12" r="6"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3"/>',
  entities: '<rect x="7" y="9" width="10" height="9" rx="2"/><path d="M12 4v5M9.5 13h.01M14.5 13h.01M9 18v3m6-3v3"/>',
  hangar: '<path d="M14 4a5 5 0 00-6 6l-5 5 3 3 5-5a5 5 0 006-6l-2.5 2.5-2-2z"/>',
  environment: '<path d="M3 20h18"/><path d="M5 20V9l5-4 5 4v11"/><path d="M15 20v-6h4v6"/>',
  ui: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
  tuning: '<path d="M5 8h14M5 16h14"/><circle cx="9" cy="8" r="2.2"/><circle cx="15" cy="16" r="2.2"/>',
  audio: '<path d="M4 9v6h3l5 4V5L7 9H4z"/><path d="M16 9a4 4 0 010 6"/>',
  net: '<circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M12 7.5l-5.5 8M12 7.5l5.5 8M7.5 18h9"/>',
  shared: '<path d="M4 9h13l-3-3M20 15H7l3 3"/>',
  server: '<rect x="4" y="4" width="16" height="6" rx="1.6"/><rect x="4" y="14" width="16" height="6" rx="1.6"/><path d="M8 7h.01M8 17h.01"/>',
  fx: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  debug: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  core: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M12 3v4m0 10v4M3 12h4m10 0h4"/>',
  sim: '<path d="M20 12a8 8 0 11-2.4-5.7"/><path d="M20 4v5h-5"/>',
  raiz: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  scripts: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l2.5 2.5L7 14M12 15h5"/>',
  brand: '<path d="M4 4h11l5 5-8 8-8-8z"/><circle cx="9" cy="9" r="1.4"/>',
};
/** A que ícone uma frente cai quando o módulo não tem o seu (e o ícone que a legenda mostra). */
const FRENTE_ICONE = {
  jogabilidade: 'player', combate: 'combat', mechs: 'entities', cenarios: 'environment', ux: 'ui',
  som: 'audio', rede: 'net', desempenho: 'fx', base: 'core', negocio: 'brand',
};

/** O ícone de um módulo (ou da frente dele), no traço do neon. `x`/`y` só valem dentro de um SVG. */
const icone = (id, cor, x = 0, y = 0, tam = 14, traco = 1.8) => {
  const forma = ICONES[id] ?? ICONES[FRENTE_ICONE[MOD_FRENTE[id] ?? 'base']] ?? ICONES.core;
  return `<svg x="${x}" y="${y}" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="${traco}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${forma}</svg>`;
};

export const GRAFO_CSS = `
  .arq { margin: 0; padding: 0; border: 1px solid var(--line); background: #050704; overflow: hidden; }
  .arq figcaption { padding: 16px 18px 6px; display: grid; gap: 4px; }
  .arq figcaption h2 { font: 400 clamp(1.7rem, 3vw, 2.4rem)/1 var(--fd); letter-spacing: .04em; color: var(--amber); text-shadow: var(--glow); text-transform: uppercase; }
  .arq figcaption .lede { color: var(--muted); font-size: 13.5px; max-width: 86ch; }
  .arq figcaption .lede b { color: var(--text); }
  .arq-palco { position: relative; overflow: hidden;
    background: radial-gradient(ellipse 62% 62% at 50% 50%, #0b100a 0%, #050704 74%); }
  .arq-palco svg { display: block; width: 100%; height: auto; }
  .arq-palco .mod { cursor: pointer; }
  .arq-palco .mod .chip { transition: fill .12s, filter .12s; }
  .arq-palco .mod:hover .chip { filter: brightness(1.4); }
  .arq-palco .edge { transition: opacity .12s, stroke-width .12s; }
  .arq-palco.foco .edge { opacity: .05 !important; }
  .arq-palco.foco .edge.hot { opacity: .95 !important; stroke-width: 2 !important; }
  .arq-palco.foco .mod { opacity: .28; }
  .arq-palco.foco .mod.hot { opacity: 1; }
  .arq-tip { position: absolute; pointer-events: none; z-index: 3; padding: 9px 12px; border: 1px solid var(--line2);
    background: rgba(4,5,3,.96); color: var(--text); font: 400 12px/1.5 var(--fb); max-width: 320px;
    opacity: 0; transition: opacity .1s; }
  .arq-tip.on { opacity: 1; }
  .arq-tip b { color: var(--bone); font-weight: 400; font-size: 13px; }
  .arq-tip small { color: var(--muted); }
  .arq-legenda, .arq-equipe { position: absolute; z-index: 3; margin: 0; padding: 10px 12px; list-style: none;
    display: grid; gap: 5px; background: rgba(4,5,3,.82); border: 1px solid var(--line); }
  .arq-legenda { left: 14px; bottom: 14px; }
  .arq-equipe { right: 14px; bottom: 14px; }
  .arq-legenda li, .arq-equipe li { display: flex; align-items: center; gap: 8px; font: 400 10px/1 var(--fb);
    letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .arq-legenda i { width: 8px; height: 8px; border-radius: 50%; }
  .arq-equipe b { display: inline-grid; place-items: center; width: 15px; height: 15px; border-radius: 50%;
    font: 400 9px/1 var(--fb); color: #050704; }
  .arq-aviso { position: absolute; right: 14px; top: 14px; z-index: 3; margin: 0; color: var(--faint);
    font: 400 10px/1.5 var(--fb); letter-spacing: .1em; text-transform: uppercase; text-align: right; }
  @media (max-width: 760px) { .arq-legenda, .arq-equipe { display: none; } }
`;

/** O script (pequeno) do cliente: destaca as ligações de um módulo e mostra a dica. Escrito como função. */
function grafoScript() {
  var palco = document.getElementById('arq-palco');
  var tip = document.getElementById('arq-tip');
  var mods = Array.prototype.slice.call(palco.querySelectorAll('.mod'));
  var arestas = Array.prototype.slice.call(palco.querySelectorAll('.edge'));
  mods.forEach(function (m) {
    var id = m.getAttribute('data-id');
    m.addEventListener('mouseenter', function () {
      palco.classList.add('foco');
      m.classList.add('hot');
      arestas.forEach(function (e) {
        var s = e.getAttribute('data-s'), t = e.getAttribute('data-t');
        if (s === id || t === id) {
          e.classList.add('hot');
          var el = palco.querySelector('.mod[data-id="' + (s === id ? t : s) + '"]');
          if (el) el.classList.add('hot');
        }
      });
      tip.innerHTML = m.getAttribute('data-dica') || '';
      var r = m.getBoundingClientRect(), p = palco.getBoundingClientRect();
      tip.classList.add('on');
      tip.style.left = Math.max(6, Math.min(r.left - p.left + 12, p.width - 336)) + 'px';
      tip.style.top = Math.max(6, r.top - p.top - 6) + 'px';
    });
    m.addEventListener('mouseleave', function () {
      palco.classList.remove('foco');
      mods.forEach(function (x) { x.classList.remove('hot'); });
      arestas.forEach(function (e) { e.classList.remove('hot'); });
      tip.classList.remove('on');
    });
  });
}

/** Prepara o mapa: HTML (o SVG desenhado) e o script de interação. */
export function grafoOficina(arq, equipe) {
  const W = 1240;
  const H = 900;
  const cx = W / 2;
  const cy = H / 2;
  const Rx = 452;
  const Ry = 344;
  const LW = 190;

  // Agrupa os módulos por frente; a frente com mais módulos fica no topo.
  const mods = [...arq.nodes].sort((a, b) => b.loc - a.loc);
  const porFrente = new Map();
  for (const m of mods) {
    const f = MOD_FRENTE[m.id] ?? 'base';
    if (!porFrente.has(f)) porFrente.set(f, []);
    porFrente.get(f).push(m);
  }
  const frentes = [...porFrente.keys()].sort((a, b) => porFrente.get(b).length - porFrente.get(a).length || a.localeCompare(b));

  // Posição de cada módulo (o chip) — desenha as conexões e ancora a interação.
  const pos = new Map();
  const setores = frentes.map((f, i) => {
    const theta = (-90 + (360 / frentes.length) * i) * (Math.PI / 180);
    const px = cx + Rx * Math.cos(theta);
    const py = cy + Ry * Math.sin(theta);
    const lista = porFrente.get(f).sort((a, b) => b.loc - a.loc);
    const CH = 36;
    const LH = 26 + lista.length * CH;
    const topo = py - LH / 2;
    lista.forEach((m, k) => {
      const y = topo + 26 + k * CH;
      pos.set(m.id, { x: px - LW / 2, y, w: LW, h: CH, cxi: px, cyi: y + CH / 2 - 2 });
    });
    return { f, px, py, LH, lista };
  });

  // Conexões (imports) entre os módulos, como curvas suaves entre os centros dos chips.
  const arestas = arq.links.map((l) => {
    const a = pos.get(l.source);
    const b = pos.get(l.target);
    if (!a || !b) return '';
    const mx = (a.cxi + b.cxi) / 2 + (b.cyi - a.cyi) * 0.09;
    const my = (a.cyi + b.cyi) / 2 - (b.cxi - a.cxi) * 0.09;
    const cor = frenteOf(l.target).cor;
    const w = Math.min(2.6, 0.5 + l.weight * 0.5);
    const op = Math.min(0.32, 0.07 + l.weight * 0.03);
    return `<path class="edge" data-s="${esc(l.source)}" data-t="${esc(l.target)}" d="M ${a.cxi.toFixed(1)} ${a.cyi.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${b.cxi.toFixed(1)} ${b.cyi.toFixed(1)}" fill="none" stroke="${cor}" stroke-width="${w.toFixed(2)}" stroke-opacity="${op.toFixed(2)}"/>`;
  }).join('');

  const chip = (m) => {
    const p = pos.get(m.id);
    const f = MOD_FRENTE[m.id] ?? 'base';
    const cor = frenteOf(m.id).cor;
    const eq = (equipe[m.id] ?? []).slice(0, 4);
    const selos = eq
      .map((ag, i) => AGENTES[ag] && `<circle cx="${p.x + p.w - 14 - i * 17}" cy="${p.y + 19}" r="7" fill="${AGENTES[ag].cor}"/><text x="${p.x + p.w - 14 - i * 17}" y="${p.y + 22.5}" text-anchor="middle" font-size="9" fill="#050704" font-family="var(--fb)">${AGENTES[ag].letra}</text>`)
      .filter(Boolean)
      .join('');
    const metrica = `${m.files} arq · ${nf(m.loc)} lin${m.tests ? ` · ${m.tests} testes` : ''}`;
    const dica = `<b>${esc(MOD_NOME[m.id] ?? m.id)}</b><br>${esc(metrica)}<br><small>frente: ${esc(frenteOf(m.id).rotulo)}${eq.length ? ` · equipe: ${esc(eq.join(', '))}` : ''}<br>usa: ${esc(m.imports.join(', ') || 'nada')}</small>`;
    return `<g class="mod" data-id="${esc(m.id)}" data-dica="${esc(dica)}">
      <rect class="chip" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h - 5}" rx="6" fill="#0a0d08" stroke="${cor}" stroke-opacity=".6"/>
      <rect x="${p.x}" y="${p.y}" width="3" height="${p.h - 5}" rx="1.5" fill="${cor}"/>
      ${icone(m.id, cor, p.x + 9, p.y + 6)}
      <text x="${p.x + 26}" y="${p.y + 16}" font-family="var(--fb)" font-size="13" fill="#eef2e8">${esc(MOD_NOME[m.id] ?? m.id)}</text>
      <text x="${p.x + 12}" y="${p.y + 28}" font-family="var(--fb)" font-size="10" fill="#8b9a8f">${esc(metrica)}</text>
      ${selos}
    </g>`;
  };

  const painel = (s) => {
    const cor = (FRENTES[s.f] ?? FRENTES.base).cor;
    const x = s.px - LW / 2;
    const y = s.py - s.LH / 2;
    return `<g>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${LW}" height="${s.LH}" rx="10" fill="#070a05" stroke="${cor}" stroke-opacity=".28"/>
      <text x="${(x + 12).toFixed(1)}" y="${(y + 18).toFixed(1)}" font-family="var(--fb)" font-size="11" letter-spacing="1.4" fill="${cor}">${esc((FRENTES[s.f] ?? FRENTES.base).rotulo.toUpperCase())}</text>
      ${s.lista.map(chip).join('')}
    </g>`;
  };

  // Grade radial sutil: anéis concêntricos e um raio por setor.
  const aneis = [130, 260, 390, 520]
    .map((r) => `<ellipse cx="${cx}" cy="${cy}" rx="${((r * Rx) / 520).toFixed(1)}" ry="${((r * Ry) / 520).toFixed(1)}" fill="none" stroke="#39ff6a" stroke-opacity=".045"/>`)
    .join('');
  const raios = setores.map((s) => `<line x1="${cx}" y1="${cy}" x2="${s.px.toFixed(1)}" y2="${s.py.toFixed(1)}" stroke="#39ff6a" stroke-opacity=".045"/>`).join('');

  const totalLoc = mods.reduce((s, m) => s + m.loc, 0);
  const totalTests = mods.reduce((s, m) => s + m.tests, 0);
  const hub = `<g>
    <circle cx="${cx}" cy="${cy}" r="96" fill="none" stroke="#39ff6a" stroke-opacity=".12" stroke-width="10"/>
    <circle cx="${cx}" cy="${cy}" r="90" fill="#0a1508" stroke="#39ff6a" stroke-opacity=".45"/>
    <text x="${cx}" y="${cy - 30}" text-anchor="middle" font-family="var(--fd)" font-size="22" letter-spacing="1" fill="#39ff6a">CYBERMECH</text>
    <text x="${cx}" y="${cy - 10}" text-anchor="middle" font-family="var(--fb)" font-size="9" letter-spacing="3" fill="#7f8f84">O JOGO</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-family="var(--fb)" font-size="12" fill="#eef2e8">${mods.length} módulos · ${arq.files} arquivos</text>
    <text x="${cx}" y="${cy + 33}" text-anchor="middle" font-family="var(--fb)" font-size="12" fill="#eef2e8">${nf(totalLoc)} linhas · ${totalTests} testes</text>
    <text x="${cx}" y="${cy + 50}" text-anchor="middle" font-family="var(--fb)" font-size="11" fill="#8b9a8f">${arq.links.length} dependências</text>
  </g>`;

  const legenda = frentes
    .map((f) => `<li>${icone(FRENTE_ICONE[f] ?? 'core', (FRENTES[f] ?? FRENTES.base).cor)}${esc((FRENTES[f] ?? FRENTES.base).rotulo)}</li>`)
    .join('');
  const usados = [...new Set(Object.values(equipe).flat())].filter((a) => AGENTES[a]);
  const equipeHtml = usados.map((a) => `<li><b style="background:${AGENTES[a].cor}">${AGENTES[a].letra}</b>${esc(a)}</li>`).join('');

  const svg = `<div class="arq-palco" id="arq-palco">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa da arquitetura do CYBERMECH: módulos agrupados por frente">
      ${aneis}${raios}${arestas}${hub}${setores.map(painel).join('')}
    </svg>
    <div class="arq-tip" id="arq-tip"></div>
    <ul class="arq-legenda">${legenda}</ul>
    <ul class="arq-equipe">${equipeHtml}</ul>
    <p class="arq-aviso">passe o mouse num módulo<br>para isolar as ligações dele</p>
  </div>`;

  const html = `<figure class="arq">
    <figcaption>
      <span class="kicker">// arquitetura · o mapa do sistema</span>
      <h2 id="arquitetura">O mapa do CYBERMECH</h2>
      <p class="lede">O núcleo no centro e cada <b>frente</b> do projeto num setor, com os seus módulos. Cada módulo
      traz arquivos, linhas e os <b>testes</b> que o cobrem; a cor é a frente; os selos são a <b>equipe</b> que
      entregou a frente. ${mods.length} módulos, ${arq.files} arquivos, ${nf(totalLoc)} linhas e ${totalTests} testes,
      lidos do próprio repositório — nada digitado à mão.</p>
    </figcaption>
    ${svg}
    <details class="table-view">
      <summary>a lista (para quem não vê o mapa)</summary>
      <div class="scroll-x"><table>
        <thead><tr><th scope="col">módulo</th><th scope="col">frente</th><th scope="col">arquivos</th><th scope="col">linhas</th><th scope="col">testes</th><th scope="col">equipe</th></tr></thead>
        <tbody>${mods.map((m) => `<tr><th scope="row">${esc(m.id)}</th><td>${esc(frenteOf(m.id).rotulo)}</td><td>${m.files}</td><td>${nf(m.loc)}</td><td>${m.tests}</td><td>${esc((equipe[m.id] ?? []).join(', ') || '—')}</td></tr>`).join('')}</tbody>
      </table></div>
    </details>
  </figure>`;

  return { html, script: `(${grafoScript.toString()})();` };
}
