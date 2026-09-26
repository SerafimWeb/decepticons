/**
 * O grafo da arquitetura do CYBERMECH (a "constelação" dos módulos): um grafo de força próprio, desenhado
 * no cliente, **sem biblioteca** (o projeto gera tudo por código; a CSP do site só deixa 'self' e inline).
 *
 * Os dados vêm dos imports reais do código (`dados.mjs` → `arquitetura()`): um nó por módulo, uma corda por
 * dependência, o tamanho do nó pelo quanto o módulo carrega. Some o número digitado à mão (R14).
 *
 * O **layout** não é uma bola de força solta: cada camada (núcleo, combate, mechs…) mora num polo próprio, o
 * núcleo no centro. Assim a estrutura aparece em vez do emaranhado, e dá para ler quem depende de quem.
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

/** A que camada cada módulo pertence (o agrupamento do grafo). Desconhecido cai em "interface". */
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
  .arq figcaption .lede { color: var(--muted); font-size: 13.5px; max-width: 78ch; }
  .arq figcaption .lede b { color: var(--text); }
  .arq-palco { position: relative; height: clamp(420px, 72vh, 760px); background:
    radial-gradient(ellipse 62% 62% at 50% 48%, #0b100a 0%, #050703 55%, #030401 100%); cursor: grab; }
  .arq-palco.dragging { cursor: grabbing; }
  .arq-palco canvas { display: block; width: 100%; height: 100%; touch-action: none; }
  .arq-tip { position: absolute; pointer-events: none; z-index: 3; padding: 8px 11px; border: 1px solid var(--line2);
    background: rgba(4,5,3,.94); color: var(--text); font: 400 12px/1.5 var(--fb); max-width: 288px;
    opacity: 0; transition: opacity .12s; white-space: pre-line; }
  .arq-tip.on { opacity: 1; }
  .arq-tip b { color: var(--bone); font-weight: 400; font-size: 13px; }
  .arq-tip small { color: var(--muted); }
  .arq-legenda { position: absolute; left: 12px; bottom: 12px; z-index: 3; margin: 0; padding: 10px 12px;
    list-style: none; display: grid; gap: 5px; background: rgba(4,5,3,.78); border: 1px solid var(--line); }
  .arq-legenda li { display: flex; align-items: center; gap: 8px; font: 400 10px/1 var(--fb);
    letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  .arq-legenda i { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }
  .arq-aviso { position: absolute; right: 12px; bottom: 14px; z-index: 3; margin: 0; color: var(--faint);
    font: 400 10px/1.5 var(--fb); letter-spacing: .1em; text-transform: uppercase; text-align: right; }
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

  // Âncoras: o núcleo no centro; cada outra camada num polo (esfera de Fibonacci). Dá a ordem do layout.
  var ANC = {};
  var outras = grupos.filter(function (g) { return g.id !== 'núcleo'; });
  var R = 400;
  grupos.forEach(function (g) { if (g.id === 'núcleo') ANC[g.id] = { x: 0, y: 0, z: 0 }; });
  outras.forEach(function (g, i) {
    var t = (i + 0.5) / outras.length;
    var inc = Math.acos(1 - 2 * t);
    var az = Math.PI * (1 + Math.sqrt(5)) * i;
    ANC[g.id] = { x: R * Math.sin(inc) * Math.cos(az), y: R * Math.cos(inc) * 0.7, z: R * Math.sin(inc) * Math.sin(az) };
  });

  grupos.forEach(function (g) {
    var li = document.createElement('li');
    li.innerHTML = '<i style="background:' + g.cor + '; color:' + g.cor + '"></i>' + g.rotulo;
    legenda.appendChild(li);
  });

  // Estrelas de fundo (fixas, dão profundidade).
  var estrelas = [];
  for (var s = 0; s < 130; s++) estrelas.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.2, a: Math.random() * 0.4 + 0.05 });

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
  var yaw = -0.5, pitch = 0.28, autoYaw = 0.0014, focal = 900, camZ = 1200, zoom = 1;
  var dragging = false, lastX = 0, lastY = 0, held = null, hover = null, foco = null, moved = 0;
  var ticks = 0, fitted = false; // o enquadramento se ajusta sozinho depois que a física assenta.

  // Física: cada nó é puxado para o polo da sua camada; as cordas intra-camada coesam o aglomerado e a
  // repulsão só evita a sobreposição. O desenho em constelações vem daí, não de uma bola de força solta.
  var ANC_K = 0.04, REPEL = 7200, DAMP = 0.82;
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
      // Na física só as cordas intra-camada: mantêm o aglomerado coeso. As entre camadas são só visuais —
      // senão o núcleo (ligado a todos) puxaria as constelações para o meio e o grafo viraria uma bola.
      if (a.grupo !== b.grupo) continue;
      dx = b.x - a.x; dy = b.y - a.y; dz = b.z - a.z;
      d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      f = (d - 54) * 0.05 / d;
      a.vx += dx * f; a.vy += dy * f; a.vz += dz * f;
      b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
    }
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      if (a === held) continue;
      var anc = ANC[a.grupo] || { x: 0, y: 0, z: 0 };
      a.vx += (anc.x - a.x) * ANC_K; a.vy += (anc.y - a.y) * ANC_K; a.vz += (anc.z - a.z) * ANC_K;
      a.vx *= DAMP; a.vy *= DAMP; a.vz *= DAMP;
      a.x += a.vx; a.y += a.vy; a.z += a.vz;
    }
  }

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

  function pick(mx, my) {
    var best = null, bd = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var p = project(nodes[i]);
      var dx = mx - p.x, dy = my - p.y, dd = dx * dx + dy * dy;
      var rr = Math.max(12, nodes[i].r * p.s) + 7;
      if (dd < rr * rr && dd < bd) { bd = dd; best = nodes[i]; }
    }
    return best;
  }
  function local(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function showTip(n, p) {
    tip.classList.add('on');
    tip.style.left = Math.min(p.x + 16, W - 300) + 'px';
    tip.style.top = Math.max(8, p.y - 12) + 'px';
    tip.innerHTML = '<b>' + n.nome + '</b><br>' + n.files + ' arquivo' + (n.files === 1 ? '' : 's') +
      ' · ' + n.loc + ' linhas<br><small>usa: ' + (n.importsStr || 'nada') +
      '<br>usado por: ' + (n.byStr || 'nada') + '</small>';
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
      if (hover) showTip(hover, p); else tip.classList.remove('on');
    }
  });
  function up() { dragging = false; held = null; wrap.classList.remove('dragging'); }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  // Clique: fixa o foco num módulo (isola as ligações dele); clique no fundo ou no mesmo módulo solta.
  canvas.addEventListener('click', function (e) {
    if (moved > 8) return; // foi um arrasto
    var p = local(e);
    var n = pick(p.x, p.y);
    foco = n && n !== foco ? n : null;
    if (foco) showTip(foco, p); else tip.classList.remove('on');
  });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoom *= e.deltaY < 0 ? 1.08 : 0.93;
    zoom = Math.max(0.35, Math.min(2.8, zoom));
  }, { passive: false });

  // Desenho.
  function draw() {
    ctx.clearRect(0, 0, W, H);
    var i, p, a, b;
    var proj = new Array(nodes.length);
    for (i = 0; i < nodes.length; i++) proj[i] = project(nodes[i]);

    // Estrelas de fundo.
    for (i = 0; i < estrelas.length; i++) {
      var st = estrelas[i];
      ctx.globalAlpha = st.a; ctx.fillStyle = '#9fb8c8';
      ctx.fillRect(st.x * W, st.y * H, st.r, st.r);
    }
    ctx.globalAlpha = 1;

    var ref = foco || hover; // o módulo de referência (foco fixo vence o hover)
    var ordem = nodes.map(function (_, k) { return k; }).sort(function (u, v) { return proj[v].depth - proj[u].depth; });

    // Cordas: discretas por padrão (as intra-camada um pouco mais fortes); com um módulo em foco, só as dele.
    for (i = 0; i < links.length; i++) {
      a = links[i].s; b = links[i].t;
      var na = nodes[a], nb = nodes[b];
      var hot = ref && (na === ref || nb === ref);
      var intra = na.grupo === nb.grupo;
      // Por padrão, só as cordas fortes (peso alto) e as intra-camada; o foco revela todas as de um módulo.
      if (ref) { if (!hot) continue; }
      else if (links[i].w < 4 && !intra) continue;
      var forca = Math.min(1, links[i].w / 16);
      if (hot) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.globalAlpha = 0.95; ctx.lineWidth = 1.8; }
      else { ctx.strokeStyle = nb.cor; ctx.globalAlpha = 0.16 + forca * 0.32; ctx.lineWidth = 0.7 + forca * 1.5; }
      ctx.beginPath(); ctx.moveTo(proj[a].x, proj[a].y); ctx.lineTo(proj[b].x, proj[b].y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Rótulos das constelações (no centroide de cada camada): é o que dá a leitura de primeira.
    var cent = {};
    for (i = 0; i < nodes.length; i++) {
      var n0 = nodes[i];
      if (!cent[n0.grupo]) cent[n0.grupo] = { x: 0, y: 0, z: 0, n: 0, cor: n0.cor, rotulo: n0.grupoRotulo };
      cent[n0.grupo].x += n0.x; cent[n0.grupo].y += n0.y; cent[n0.grupo].z += n0.z; cent[n0.grupo].n++;
    }
    for (var k in cent) {
      var c = cent[k];
      var cp = project({ x: c.x / c.n, y: c.y / c.n, z: c.z / c.n });
      var off = k === 'núcleo' ? 0 : 44;
      ctx.globalAlpha = ref ? 0.28 : 0.9;
      ctx.fillStyle = c.cor;
      ctx.font = '600 12px "Share Tech Mono", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText((c.rotulo || k).toUpperCase(), cp.x, cp.y - off);
    }
    ctx.globalAlpha = 1;

    // Nós, de trás para a frente.
    for (var oi = 0; oi < ordem.length; oi++) {
      var n = nodes[ordem[oi]]; p = proj[ordem[oi]];
      var r = Math.max(2.4, n.r * p.s);
      var dim = ref && n !== ref && !n.adjSet[ref.id] ? 0.16 : 1;
      var destaque = n === ref || n.r >= 15;
      ctx.globalAlpha = dim;
      var grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * (destaque ? 4 : 3));
      grd.addColorStop(0, n.cor); grd.addColorStop(0.3, n.cor); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x, p.y, r * (destaque ? 4 : 3), 0, 6.2832); ctx.fill();
      // Anel (só nos módulos grandes e no foco): dá o ar de "planeta".
      if (destaque) {
        ctx.globalAlpha = dim * 0.85; ctx.strokeStyle = n.cor; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.9, 0, 6.2832); ctx.stroke();
      }
      ctx.globalAlpha = dim;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.4, r * 0.42), 0, 6.2832); ctx.fill();
      // Nome: só nos módulos grandes, no foco ou no hover (evita a sopa de texto).
      if (n.r >= 14 || n === ref) {
        ctx.globalAlpha = dim;
        ctx.fillStyle = '#eef2e8';
        ctx.font = '400 12px "Share Tech Mono", Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.nome, p.x, p.y - r - 6);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Laço principal.
  resize();
  (function loop() {
    if (!dragging || !held) yaw += autoYaw;
    tick();
    if (!fitted && ++ticks > 260) {
      var maxR = 1;
      for (var i = 0; i < nodes.length; i++) {
        var rr = Math.sqrt(nodes[i].x * nodes[i].x + nodes[i].y * nodes[i].y + nodes[i].z * nodes[i].z);
        if (rr > maxR) maxR = rr;
      }
      focal = (Math.min(W, H) * 0.48 * camZ) / maxR;
      fitted = true;
    }
    draw();
    requestAnimationFrame(loop);
  })();
}

/** Prepara o desenho do grafo: HTML, CSS e o script. */
export function grafoOficina(arq) {
  const mods = [...arq.nodes].sort((a, b) => b.loc - a.loc);
  const grupoOf = (id) => MOD_GRUPO[id] ?? 'interface';
  const nome = (id) => MOD_NOME[id] ?? id;
  const maxLoc = Math.max(...mods.map((m) => m.loc), 1);
  const idx = new Map(mods.map((m, i) => [m.id, i]));

  // Posições iniciais: em volta do polo da própria camada (a física assenta no resto).
  const N = mods.length;
  const inicio = mods.map((m, i) => {
    const t = (i + 0.5) / N;
    const inc = Math.acos(1 - 2 * t);
    const az = Math.PI * (1 + Math.sqrt(5)) * i;
    const R = 260;
    return { x: R * Math.sin(inc) * Math.cos(az), y: R * Math.cos(inc), z: R * Math.sin(inc) * Math.sin(az) };
  });

  const porGrupo = {};
  const nodes = mods.map((m, i) => {
    const g = grupoOf(m.id);
    const gname = porGrupo[g] ?? 0;
    porGrupo[g] = gname + 1;
    const imports = m.imports.map(nome);
    const by = m.importedBy.map(nome);
    return {
      id: m.id,
      nome: nome(m.id),
      i: idx.get(m.id),
      grupo: g,
      grupoRotulo: GRUPOS[g]?.rotulo ?? g,
      cor: (GRUPOS[g] ?? GRUPOS['interface']).cor,
      files: m.files,
      loc: m.loc,
      r: 7 + Math.sqrt(m.loc / maxLoc) * 12 + Math.min(3, m.importedBy.length * 0.35),
      importsStr: imports.slice(0, 8).join(', ') + (imports.length > 8 ? '…' : ''),
      byStr: by.slice(0, 8).join(', ') + (by.length > 8 ? '…' : ''),
      adjSet: {},
      x: inicio[i].x, y: inicio[i].y, z: inicio[i].z,
      vx: 0, vy: 0, vz: 0,
    };
  });
  const links = arq.links.map((l) => ({ s: idx.get(l.source), t: idx.get(l.target), w: l.weight }));
  for (const l of links) {
    nodes[l.s].adjSet[nodes[l.t].id] = 1;
    nodes[l.t].adjSet[nodes[l.s].id] = 1;
  }
  for (const n of nodes) n.adjSet[n.id] = 1;

  const grupos = Object.keys(GRUPOS)
    .filter((g) => mods.some((m) => grupoOf(m.id) === g))
    .map((g) => ({ id: g, cor: GRUPOS[g].cor, rotulo: GRUPOS[g].rotulo }));

  const totalLoc = mods.reduce((s, m) => s + m.loc, 0);
  const hub = mods[0];
  const html = `<figure class="arq">
    <figcaption>
      <span class="kicker">// arquitetura · quem importa quem</span>
      <h2 id="arquitetura">A constelação dos módulos</h2>
      <p class="lede">Cada ponto é um módulo; cada corda, um import — lido do próprio repositório, não digitado.
      As cores agrupam o sistema em camadas (o <b>núcleo</b> no centro). O <b>${esc(hub.id)}</b> é o hub: ${hub.importedBy.length} módulos dependem dele.
      ${arq.files} arquivos, ${totalLoc.toLocaleString('pt-BR')} linhas, ${arq.links.length} dependências.
      <br>Passe o mouse num módulo para ver o que ele usa; <b>clique</b> para travar o foco só nele; arraste para girar; a roda dá o zoom.</p>
    </figcaption>
    <div class="arq-palco" id="arq-palco">
      <canvas id="arq-canvas" aria-label="Grafo das dependências entre os módulos do CYBERMECH"></canvas>
      <span class="arq-conta"><b>${mods.length}</b> módulos · <b>${arq.links.length}</b> ligações · <b>${arq.files}</b> arquivos</span>
      <div class="arq-tip" id="arq-tip"></div>
      <ul class="arq-legenda" id="arq-legenda"></ul>
      <p class="arq-aviso">clique = focar um módulo<br>arraste = girar · roda = zoom</p>
    </div>
    <details class="table-view">
      <summary>a lista (para quem não vê o grafo)</summary>
      <div class="scroll-x"><table>
        <thead><tr><th scope="col">módulo</th><th scope="col">camada</th><th scope="col">arquivos</th><th scope="col">linhas</th><th scope="col">usa</th></tr></thead>
        <tbody>${mods.map((m) => `<tr><th scope="row">${esc(m.id)}</th><td>${esc(GRUPOS[grupoOf(m.id)]?.rotulo ?? '')}</td><td>${m.files}</td><td>${m.loc.toLocaleString('pt-BR')}</td><td>${esc(m.imports.join(', ') || '—')}</td></tr>`).join('')}</tbody>
      </table></div>
    </details>
  </figure>`;

  const script = `(${grafoScript.toString()})(${JSON.stringify({ nodes, links, grupos })});`;
  return { html, script };
}
