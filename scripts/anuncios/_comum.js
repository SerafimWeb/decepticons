// Peças que todos os anúncios usam (P266): a moldura HUD chanfrada, o ícone do Olho do Pai e pequenos instrumentos. Desenham em SVG sobre a página de 512×1024.
(() => {
const NS = 'http://www.w3.org/2000/svg';
const W = 512;
const H = 1024;

function el(nome, atributos = {}, pai = null) {
  const e = document.createElementNS(NS, nome);
  for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, v);
  if (pai) pai.appendChild(e);
  return e;
}

/** A camada SVG de 512×1024 (um anúncio pode ter várias, empilhadas na ordem em que são pedidas). */
function camada(estilo = '') {
  const s = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: estilo });
  document.querySelector('.painel').appendChild(s);
  return s;
}

/** Caminho de um retângulo com cantos chanfrados: `b` nos cantos superior esquerdo e inferior direito, `s` nos outros dois. */
function chanfrado(i, b, s) {
  return `M${i + b},${i} H${W - i - s} L${W - i},${i + s} V${H - i - b} L${W - i - b},${H - i} H${i + s} L${i},${H - i - s} V${i + b} Z`;
}

/**
 * A moldura: duas linhas chanfradas (a de fora forte, a de dentro fina), cantoneiras e marcas de régua nas laterais. `c1` é a cor forte, `c2` o acento.
 * `grossura` é a da linha de fora (px).
 */
function moldura({ c1, c2, grossura = 3.5, margem = 16 }) {
  const svg = camada(`filter: drop-shadow(0 0 7px ${c1}) drop-shadow(0 0 18px ${c1}66);`);
  el('path', { d: chanfrado(margem, 34, 14), fill: 'none', stroke: c1, 'stroke-width': grossura, 'stroke-linejoin': 'round' }, svg);
  el('path', { d: chanfrado(margem + 13, 26, 10), fill: 'none', stroke: c2, 'stroke-width': 1.4, opacity: 0.75, 'stroke-linejoin': 'round' }, svg);
  // As cantoneiras: pequenos "L" por fora do canto chanfrado.
  const m = margem - 7;
  for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    el('path', { d: `M${x},${y + dy * 26} V${y} H${x + dx * 26}`, fill: 'none', stroke: c2, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg);
  }
  // A régua: marcas curtas nas duas laterais, entre as cantoneiras.
  for (let y = 110; y < H - 100; y += 18) {
    const comprimento = (y / 18) % 5 === 0 ? 11 : 5;
    el('path', { d: `M${margem + 13},${y} h${comprimento}`, stroke: c2, 'stroke-width': 1.3, opacity: 0.55 }, svg);
    el('path', { d: `M${W - margem - 13},${y} h${-comprimento}`, stroke: c2, 'stroke-width': 1.3, opacity: 0.55 }, svg);
  }
  return svg;
}

/** O ícone do Olho do Pai (o do aplicativo): anel, íris e pupila. `cx, cy` é o centro; `r` o raio do anel. */
function olho(svg, cx, cy, r, cor = '#00d4ff', iris = '#0a7ea4') {
  const g = el('g', { style: `filter: drop-shadow(0 0 ${r * 0.28}px ${cor});` }, svg);
  el('circle', { cx, cy, r, fill: 'none', stroke: cor, 'stroke-width': Math.max(2, r * 0.13) }, g);
  el('circle', { cx, cy, r: r * 0.5, fill: iris }, g);
  el('circle', { cx, cy, r: r * 0.22, fill: cor }, g);
  return g;
}

/** O alfinete de localização (gota com um círculo dentro); a ponta fica em (x, y). */
function alfinete(svg, x, y, tamanho, cor, preenchimento = 'rgba(0,0,0,.25)') {
  const k = tamanho / 60;
  const g = el('g', { transform: `translate(${x} ${y}) scale(${k})`, style: `filter: drop-shadow(0 0 ${8 * k}px ${cor});` }, svg);
  el('path', { d: 'M0,0 C-8,-14 -28,-30 -28,-48 C-28,-63 -15,-74 0,-74 C15,-74 28,-63 28,-48 C28,-30 8,-14 0,0 Z', fill: preenchimento, stroke: cor, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
  el('circle', { cx: 0, cy: -48, r: 11, fill: 'none', stroke: cor, 'stroke-width': 5 }, g);
  return g;
}

/** Anéis de radar vistos de cima (elipses concêntricas) com um setor de varredura. */
function radar(svg, cx, cy, raio, cor, { elipse = 0.4, aneis = 3, varredura = true } = {}) {
  const g = el('g', {}, svg);
  for (let i = 1; i <= aneis; i++) {
    const r = (raio * i) / aneis;
    el('ellipse', { cx, cy, rx: r, ry: r * elipse, fill: 'none', stroke: cor, 'stroke-width': 2.2 - i * 0.25, opacity: 0.95 - i * 0.18 }, g);
  }
  if (varredura) {
    const a0 = -0.75;
    const a1 = -0.2;
    const p = (a) => `${cx + Math.cos(a) * raio},${cy + Math.sin(a) * raio * elipse}`;
    el('path', { d: `M${cx},${cy} L${p(a0)} A${raio},${raio * elipse} 0 0 1 ${p(a1)} Z`, fill: cor, opacity: 0.28 }, g);
  }
  return g;
}

/** Três arcos de sinal (como o de Wi-Fi) com um ponto, apontando para cima; o ponto fica em (x, y). */
function sinal(svg, x, y, tamanho, cor, espessura = 6) {
  const g = el('g', { style: `filter: drop-shadow(0 0 ${tamanho * 0.12}px ${cor});` }, svg);
  el('circle', { cx: x, cy: y, r: espessura * 0.9, fill: cor }, g);
  for (let i = 1; i <= 3; i++) {
    const r = (tamanho * i) / 3;
    const a = (Math.PI / 180) * 42;
    const x0 = x - Math.sin(a) * r;
    const y0 = y - Math.cos(a) * r;
    const x1 = x + Math.sin(a) * r;
    el('path', { d: `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y0}`, fill: 'none', stroke: cor, 'stroke-width': espessura, 'stroke-linecap': 'round', opacity: 1 - (i - 1) * 0.12 }, g);
  }
  return g;
}

/** Pequenas linhas de texto técnico (decoração discreta nas bordas). `linhas`: ["GPS LOCK", ...]. */
function dados(svg, x, y, linhas, cor, { ancora = 'start', tamanho = 10, passo = 14 } = {}) {
  linhas.forEach((t, i) => {
    const e = el('text', { x, y: y + i * passo, fill: cor, 'font-family': 'Barlow', 'font-weight': 600, 'font-size': tamanho, 'letter-spacing': 1.5, 'text-anchor': ancora, opacity: 0.5 }, svg);
    e.textContent = t;
  });
}

window.marca = { el, camada, moldura, olho, alfinete, radar, sinal, dados, chanfrado, W, H };
})();
