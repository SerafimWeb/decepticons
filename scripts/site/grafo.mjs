/**
 * O grafo da arquitetura do CYBERMECH (a "constelação" dos módulos): um grafo de força próprio, desenhado
 * no cliente, **sem biblioteca** (o projeto gera tudo por código; a CSP do site só deixa 'self' e inline).
 *
 * Os dados vêm dos imports reais do código (`dados.mjs` → `arquitetura()`): um nó por módulo, uma corda por
 * dependência, o tamanho do nó pelo quanto o módulo carrega. Some o número digitado à mão (R14).
 *
 * O tema é o neon do jogo, não o âmbar do site: o grafo é uma peça da bancada, e ali vale a paleta do jogo.
 *
 * Uso: const { html, css, script } = grafoOficina(arquitetura());
 */
import { esc } from './tema.mjs';

/** Cor e rótulo de cada camada (o grupo do módulo). O neon vem do jogo (`core/palette.ts`). */
const GRUPOS = {
  'núcleo': { cor: '#39ff6a', rotulo: 'núcleo' },
  'combate': { cor: '#ff2d3d', rotulo: 'combate' },
  'mechs': { cor: '#ffb000', rotulo: 'mechs' },
  'movimento': { cor: '#00e5ff', rotulo: 'movimento' },
  'mundo': { cor: '#ff2bd6', rotulo: 'mundo' },
  'rede': { cor: '#2dd4bf', rotulo: 'rede' },
  'interface': { cor: '#eef2e8', rotulo: 'interface' },
  'produção': { cor: '#ffe14d', rotulo: 'produção' },
  'ferramentas': { cor: '#8fa3b8', rotulo: 'ferramentas' },
};

/** A que camada cada módulo pertence. Módulo novo e desconhecido cai em "ferramentas"? Não: em "interface". */
const MOD_GRUPO = {
  core: 'núcleo', sim: 'núcleo', raiz: 'núcleo',
  combat: 'combate',
  entities: 'mechs',
  physics: 'movimento', player: 'movimento', camera: 'movimento',
  environment: 'mundo', fx: 'mundo',
  net: 'rede', shared: 'rede', server: 'rede',
  ui: 'interface', debug: 'interface', hangar: 'interface', tuning: 'interface',
  audio: 'produção', brand: 'produção',
  scripts: 'ferramentas',
};

/** Nome legível do módulo (o id `raiz` é o `client/src` no topo). */
const MOD_NOME = { raiz: 'app (main)', shared: 'shared (contratos)', scripts: 'scripts (ferramentas)' };

export const GRAFO_CSS = `
  .arq { margin: 0; padding: 0; border: 1px solid var(--line); background: #040503; overflow: hidden; }
  .arq figcaption { padding: 16px 18px 4px; display: grid; gap: 4px; }
  .arq figcaption h2 { font: 400 clamp(1.7rem, 3vw, 2.4rem)/1 var(--fd); letter-spacing: .04em; color: var(--amber); text-shadow: var(--glow); text-transform: uppercase; }
  .arq figcaption .lede { color: var(--muted); font-size: 13.5px; max-width: 74ch; }
  .arq-palco { position: relative; height: clamp(400px, 68vh, 720px); background:
    radial-gradient(ellipse 70% 70% at 50% 45%, #0a0d08 0%, #040503 72%); cursor: grab; }
  .arq-palco.dragging { cursor: grabbing; }
  .arq-palco canvas { display: block; width: 100%; height: 100%; touch-action: none; }
  .arq-tip { position: absolute; pointer-events: none; z-index: 3; padding: 7px 10px; border: 1px solid var(--line2);
    background: rgba(4,5,3,.92); color: var(--text); font: 400 12px/1.45 var(--fb); max-width: 260px;
    opacity: 0; transition: opacity .12s; white-space: pre-line; }
  .arq-tip.on { opacity: 1; }
  .arq-tip b { color: var(--bone); font-weight: 400; }
  .arq-tip small { color: var(--muted); }
  .arq-legenda { position: absolute; left: 12px; bottom: 12px; z-index: 3; margin: 0; padding: 9px 11px;
    list-style: none; display: grid; gap: 4px; background: rgba(4,5,3,.72); border: 1px solid var(--line); }
  .arq-legenda li { display: flex; align-items: center; gap: 7px; font: 400 10px/1 var(--fb);
    letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  .arq-legenda i { width: 8px; height: 8px; border-radius: 50%; }
  .arq-aviso { position: absolute; right: 12px; bottom: 14px; z-index: 3; margin: 0; color: var(--faint);
    font: 400 10px/1.4 var(--fb); letter-spacing: .1em; text-transform: uppercase; text-align: right; }
  .arq-conta { position: absolute; left: 12px; top: 12px; z-index: 3; color: var(--muted);
    font: 400 11px/1.4 var(--fb); letter-spacing: .1em; text-transform: uppercase; }
  .arq-conta b { color: var(--text); }
  @media (max-width: 620px) { .arq-legenda { display: none; } }
`;

/** O script que roda no cliente. Escrito como função e serializado — sem escapar template literal. */
function grafoScript(payload) {
  var nodes = payload.nodes, links = payload.links, grupos = payload.grupos;
  var wrap = document.getElementById('arq-palco');
  var canvas = document.getElementById('arq-canvas');
  var tip = document.getElementById('arq-tip');
  var legenda = document.getElementById('arq-legenda');
  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, cx = 0, cy = 0;

  // Legenda dos grupos que aparecem.
  grupos.forEach(function (g) {
    var li = document.createElement('li');
    li.innerHTML = '<i style="background:' + g.cor + '"></i>' + g.rotulo;
    legenda.appendChild(li);
  });

  function resize() {
    var r = wrap.getBoundingClientRect();
    W = r.width; H = r.height; cx = W / 2; cy = H / 2;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fitted = false;
  }
  window.addEventListener('resize', resize);

  // Estado de câmera e interação.
  var yaw = -0.4, pitch = 0.32, autoYaw = 0.0016, focal = 900, camZ = 900, zoom = 1;
  var dragging = false, lastX = 0, lastY = 0, held = null, hover = null, moved = 0;
  var ticks = 0, fitted = false; // o enquadramento se ajusta sozinho depois que a física assenta.

  // Física: repulsão entre todos, mola nas cordas, gravidade leve para o centro.
  var REPEL = 26000, LEN = 96, SPRING = 0.02, GRAV = 0.006, DAMP = 0.86;
  function project(n) {
    var x1 = n.x * Math.cos(yaw) + n.z * Math.sin(yaw);
    var z1 = -n.x * Math.sin(yaw) + n.z * Math.cos(yaw);
    var y2 = n.y * Math.cos(pitch) - z1 * Math.sin(pitch);
    var z2 = n.y * Math.sin(pitch) + z1 * Math.cos(pitch);
    var depth = z2 * zoom + camZ;
    if (depth < 40) depth = 40;
    var s = (focal * zoom) / depth;
    return { x: cx + x1 * s, y: cy + y2 * s, s: s, depth: depth };
  }
  function tick() {
    var i, j, a, b, dx, dy, dz, d2, d, f;
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j];
        dx = b.x - a.x; dy = b.y - a.y; dz = b.z - a.z;
        d2 = dx * dx + dy * dy + dz * dz || 1;
        d = Math.sqrt(d2);
        f = REPEL / d2;
        dx /= d; dy /= d; dz /= d;
        a.vx -= dx * f; a.vy -= dy * f; a.vz -= dz * f;
        b.vx += dx * f; b.vy += dy * f; b.vz += dz * f;
      }
    }
    for (i = 0; i < links.length; i++) {
      a = nodes[links[i].s]; b = nodes[links[i].t];
      dx = b.x - a.x; dy = b.y - a.y; dz = b.z - a.z;
      d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      f = (d - LEN) * SPRING / d;
      a.vx += dx * f; a.vy += dy * f; a.vz += dz * f;
      b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
    }
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      if (a === held) continue;
      a.vx -= a.x * GRAV; a.vy -= a.y * GRAV; a.vz -= a.z * GRAV;
      a.vx *= DAMP; a.vy *= DAMP; a.vz *= DAMP;
      a.x += a.vx; a.y += a.vy; a.z += a.vz;
    }
  }

  // Movimento do mouse: girar (arrastar o fundo) ou puxar um módulo (arrastar o nó).
  function pick(mx, my) {
    var best = null, bd = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var p = project(nodes[i]);
      var dx = mx - p.x, dy = my - p.y, dd = dx * dx + dy * dy;
      var rr = Math.max(10, nodes[i].r * p.s) + 6;
      if (dd < rr * rr && dd < bd) { bd = dd; best = nodes[i]; }
    }
    return best;
  }
  function local(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  canvas.addEventListener('pointerdown', function (e) {
    var p = local(e);
    held = pick(p.x, p.y); moved = 0;
    lastX = e.clientX; lastY = e.clientY;
    dragging = true; wrap.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = local(e);
    if (dragging) {
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (held) {
        // Puxa o nó no plano da tela (o mais próximo possível do plano z=0).
        held.x += dx / ((focal * zoom) / camZ) * 1.6;
        held.y += dy / ((focal * zoom) / camZ) * 1.6;
        held.vx = held.vy = held.vz = 0;
      } else {
        yaw += dx * 0.005; pitch += dy * 0.005;
        pitch = Math.max(-1.2, Math.min(1.2, pitch));
      }
      lastX = e.clientX; lastY = e.clientY;
    } else {
      hover = pick(p.x, p.y);
      canvas.style.cursor = hover ? 'pointer' : 'grab';
      if (hover) {
        tip.classList.add('on');
        tip.style.left = Math.min(p.x + 14, W - 244) + 'px';
        tip.style.top = Math.max(8, p.y - 12) + 'px';
        tip.innerHTML = '<b>' + hover.nome + '</b><br>' + hover.files + ' arquivo' + (hover.files === 1 ? '' : 's') +
          ' · ' + hover.loc + ' linhas<br><small>usa: ' + (hover.importsStr || 'nada') +
          '<br>usado por: ' + (hover.byStr || 'nada') + '</small>';
      } else tip.classList.remove('on');
    }
  });
  function up() { dragging = false; held = null; wrap.classList.remove('dragging'); }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoom *= e.deltaY < 0 ? 1.08 : 0.93;
    zoom = Math.max(0.4, Math.min(2.6, zoom));
  }, { passive: false });

  // Desenho.
  function draw() {
    ctx.clearRect(0, 0, W, H);
    var i, p, a, b;
    var proj = new Array(nodes.length);
    for (i = 0; i < nodes.length; i++) proj[i] = project(nodes[i]);

    // Ordena por profundidade para o desenho de trás para a frente.
    var ordem = nodes.map(function (_, k) { return k; }).sort(function (u, v) { return proj[v].depth - proj[u].depth; });
    var adj = hover ? hover : null;

    // Cordas.
    for (i = 0; i < links.length; i++) {
      a = links[i].s; b = links[i].t;
      var hot = adj && (a === adj.i || b === adj.i);
      if (adj && !hot) continue;
      ctx.strokeStyle = hot ? 'rgba(255,255,255,.5)' : nodes[b].cor;
      ctx.globalAlpha = hot ? 0.9 : 0.28;
      ctx.lineWidth = hot ? 1.6 : Math.min(2.4, 0.5 + links[i].w * 0.4);
      ctx.beginPath();
      ctx.moveTo(proj[a].x, proj[a].y);
      ctx.lineTo(proj[b].x, proj[b].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Nós.
    for (var oi = 0; oi < ordem.length; oi++) {
      var n = nodes[ordem[oi]]; p = proj[ordem[oi]];
      var r = Math.max(2.2, n.r * p.s);
      var dim = adj && n !== adj && !n.adjSet[adj.id] ? 0.32 : 1;
      ctx.globalAlpha = dim;
      var grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.4);
      grd.addColorStop(0, n.cor); grd.addColorStop(0.28, n.cor); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.5, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      if (n.r > 11 || n === adj) {
        ctx.fillStyle = dim === 1 ? '#eef2e8' : 'rgba(238,242,232,.35)';
        ctx.font = '400 11px "Share Tech Mono", Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.nome, p.x, p.y - r - 5);
      }
    }
  }

  // Laço principal.
  resize();
  (function loop() {
    if (!dragging || !held) yaw += autoYaw;
    tick();
    // Enquadramento automático: depois que a física assenta, o focal faz o grafo caber no palco.
    if (!fitted && ++ticks > 240) {
      var maxR = 1;
      for (var i = 0; i < nodes.length; i++) {
        var rr = Math.sqrt(nodes[i].x * nodes[i].x + nodes[i].y * nodes[i].y + nodes[i].z * nodes[i].z);
        if (rr > maxR) maxR = rr;
      }
      focal = (Math.min(W, H) * 0.5 * camZ) / maxR;
      fitted = true;
    }
    draw();
    requestAnimationFrame(loop);
  })();
}

/** Prepara o desenho do grafo: HTML, CSS e o script. */
export function grafoOficina(arq) {
  // Módulos ordenados por peso (linhas), para o raio e para a lista.
  const mods = [...arq.nodes].sort((a, b) => b.loc - a.loc);
  const cor = (id) => (GRUPOS[MOD_GRUPO[id] ?? 'interface'] ?? GRUPOS['interface']).cor;
  const nome = (id) => MOD_NOME[id] ?? id;
  const maxLoc = Math.max(...mods.map((m) => m.loc), 1);
  const idx = new Map(mods.map((m, i) => [m.id, i]));

  // Posições iniciais: esfera de Fibonacci, sem sobreposição e já simétrica.
  const N = mods.length;
  const inicio = mods.map((_, i) => {
    const t = (i + 0.5) / N;
    const inc = Math.acos(1 - 2 * t);
    const az = Math.PI * (1 + Math.sqrt(5)) * i;
    const R = 240;
    return { x: R * Math.sin(inc) * Math.cos(az), y: R * Math.cos(inc), z: R * Math.sin(inc) * Math.sin(az) };
  });

  const nodes = mods.map((m, i) => {
    const imports = m.imports.map(nome);
    const by = m.importedBy.map(nome);
    return {
      id: m.id,
      nome: nome(m.id),
      i: idx.get(m.id),
      cor: cor(m.id),
      files: m.files,
      loc: m.loc,
      r: 7 + Math.sqrt(m.loc / maxLoc) * 13,
      importsStr: imports.slice(0, 8).join(', ') + (imports.length > 8 ? '…' : ''),
      byStr: by.slice(0, 8).join(', ') + (by.length > 8 ? '…' : ''),
      adjSet: {},
      x: inicio[i].x, y: inicio[i].y, z: inicio[i].z,
      vx: 0, vy: 0, vz: 0,
    };
  });
  // Marca a vizinhança (para o realce no hover).
  const links = arq.links.map((l) => ({ s: idx.get(l.source), t: idx.get(l.target), w: l.weight }));
  for (const l of links) {
    nodes[l.s].adjSet[nodes[l.t].id] = 1;
    nodes[l.t].adjSet[nodes[l.s].id] = 1;
  }
  for (const n of nodes) n.adjSet[n.id] = 1;

  const grupos = Object.keys(GRUPOS)
    .filter((g) => mods.some((m) => (MOD_GRUPO[m.id] ?? 'interface') === g))
    .map((g) => ({ cor: GRUPOS[g].cor, rotulo: GRUPOS[g].rotulo }));

  const totalLoc = mods.reduce((s, m) => s + m.loc, 0);
  const hub = mods[0];
  const html = `<figure class="arq">
    <figcaption>
      <span class="kicker">// arquitetura · importa quem</span>
      <h2 id="arquitetura">A constelação dos módulos</h2>
      <p class="lede">Cada ponto é um módulo do código; cada corda, um import entre eles — lido do próprio
      repositório, não digitado. O <b>${esc(hub.id)}</b> é o hub (${hub.files} arquivos, ${hub.importedBy.length} módulos dependem dele).
      ${arq.files} arquivos, ${totalLoc.toLocaleString('pt-BR')} linhas em ${mods.length} módulos; ${arq.links.length} dependências.
      Arraste para girar e puxar os módulos; a roda dá o zoom; passe o mouse para ver as ligações.</p>
    </figcaption>
    <div class="arq-palco" id="arq-palco">
      <canvas id="arq-canvas" aria-label="Grafo das dependências entre os módulos do CYBERMECH"></canvas>
      <span class="arq-conta"><b>${mods.length}</b> módulos · <b>${arq.links.length}</b> ligações · <b>${arq.files}</b> arquivos</span>
      <div class="arq-tip" id="arq-tip"></div>
      <ul class="arq-legenda" id="arq-legenda"></ul>
      <p class="arq-aviso">arraste · puxe os módulos<br>roda = zoom</p>
    </div>
    <details class="table-view">
      <summary>a lista (para quem não vê o grafo)</summary>
      <div class="scroll-x"><table>
        <thead><tr><th scope="col">módulo</th><th scope="col">arquivos</th><th scope="col">linhas</th><th scope="col">usa</th></tr></thead>
        <tbody>${mods.map((m) => `<tr><th scope="row">${esc(m.id)}</th><td>${m.files}</td><td>${m.loc.toLocaleString('pt-BR')}</td><td>${esc(m.imports.join(', ') || '—')}</td></tr>`).join('')}</tbody>
      </table></div>
    </details>
  </figure>`;

  const script = `(${grafoScript.toString()})(${JSON.stringify({ nodes, links, grupos })});`;
  return { html, script };
}
