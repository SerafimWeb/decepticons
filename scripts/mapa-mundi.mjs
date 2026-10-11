#!/usr/bin/env node
/**
 * Gera os dados do mapa-múndi do console de comando, sem o jogo baixar contorno de país nenhum (3 MB de origem):
 *  - `client/src/ui/worldMask.ts`: uma grade de 1° (mar, terra, Brasil), comprimida por corrida de símbolos (RLE), ~7 KB;
 *  - `client/src/ui/brasilContorno.ts`: o litoral e as fronteiras do Brasil como uma linha simplificada (poucas centenas de
 *    pontos), para a borda do país ficar nítida em qualquer zoom por cima dos pontos.
 *
 * Origem: Natural Earth, 1:50m, "Admin 0 – Countries" (domínio público, naturalearthdata.com). O arquivo baixado fica em
 * `.tmp/mapa-mundi/` (G15) e só é baixado de novo se sumir.
 *
 * Uso: `node scripts/mapa-mundi.mjs`. Rodar de novo só se a grade mudar (resolução, recorte ou fonte).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const CACHE = join(ROOT, '.tmp', 'mapa-mundi', 'ne_50m_admin_0_countries.geojson');
const OUT = join(ROOT, 'client', 'src', 'ui', 'worldMask.ts');
const OUT_CONTORNO = join(ROOT, 'client', 'src', 'ui', 'brasilContorno.ts');
/** Tolerância da simplificação do contorno (graus) e quantas unidades gravadas valem um grau. */
const TOLERANCIA = 0.1;
const PRECISAO = 100;

/** Recorte: do norte da Groenlândia ao sul da Terra do Fogo (a Antártida não tem missão e só gastaria tela). */
const LAT_TOP = 84;
const LAT_BOTTOM = -58;
const STEP = 1;

async function source() {
  if (!existsSync(CACHE)) {
    mkdirSync(dirname(CACHE), { recursive: true });
    const res = await fetch(SRC_URL);
    if (!res.ok) throw new Error(`download falhou: ${res.status} ${SRC_URL}`);
    writeFileSync(CACHE, await res.text());
  }
  return JSON.parse(readFileSync(CACHE, 'utf8'));
}

/** Polígonos de um país: lista de anéis (o primeiro é o contorno, os outros são buracos), com a caixa para descartar rápido. */
function polygonsOf(feature) {
  const g = feature.geometry;
  const list = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return list.map((rings) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of rings[0]) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return { rings, x0, x1, y0, y1 };
  });
}

/** Par-ímpar por raio horizontal: dentro de um número ímpar de anéis = dentro do polígono (buraco conta como anel). */
function inside(poly, x, y) {
  if (x < poly.x0 || x > poly.x1 || y < poly.y0 || y > poly.y1) return false;
  let odd = false;
  for (const ring of poly.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
    }
  }
  return odd;
}

/** Douglas–Peucker: tira os pontos que ficam a menos de `tol` graus da reta entre os vizinhos que sobram. */
function simplificar(pts, tol) {
  if (pts.length < 3) return pts;
  const [x1, y1] = pts[0];
  const [x2, y2] = pts[pts.length - 1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1e-9;
  let maior = 0;
  let onde = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / len;
    if (d > maior) {
      maior = d;
      onde = i;
    }
  }
  if (maior <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplificar(pts.slice(0, onde + 1), tol).slice(0, -1), ...simplificar(pts.slice(onde), tol)];
}

const geo = await source();
const land = [];
const brazil = [];
for (const f of geo.features) {
  const polys = polygonsOf(f);
  if (f.properties.ADM0_A3 === 'BRA') brazil.push(...polys);
  else if (f.properties.ADM0_A3 !== 'ATA') land.push(...polys);
}

const cols = 360 / STEP;
const rows = (LAT_TOP - LAT_BOTTOM) / STEP;
const out = [];
let landCells = 0;
let brazilCells = 0;
for (let r = 0; r < rows; r++) {
  const lat = LAT_TOP - (r + 0.5) * STEP;
  let line = '';
  for (let c = 0; c < cols; c++) {
    const lon = -180 + (c + 0.5) * STEP;
    const sym = brazil.some((p) => inside(p, lon, lat)) ? 'b' : land.some((p) => inside(p, lon, lat)) ? '#' : '.';
    if (sym === 'b') brazilCells++;
    else if (sym === '#') landCells++;
    line += sym;
  }
  out.push(line.replace(/([.#b])\1*/g, (run) => `${run[0]}${run.length}`));
}

const body = `/**
 * GERADO por \`scripts/mapa-mundi.mjs\`: não edite à mão. O mapa-múndi do console de comando como uma grade de ${STEP}° (de ${LAT_TOP}° a ${LAT_BOTTOM}°
 * de latitude, de -180° a 180° de longitude), uma linha por faixa de latitude, comprimida por corrida: \`.\` mar, \`#\` terra, \`b\` Brasil,
 * seguidos de quantas células repetem. Origem: Natural Earth 1:50m, Admin 0 – Countries (domínio público). ${landCells + brazilCells} células de
 * terra, ${brazilCells} do Brasil.
 */
export const WORLD_MASK = {
  cols: ${cols},
  rows: ${rows},
  /** Longitude da borda esquerda da coluna 0 e latitude da borda de cima da linha 0, em graus. */
  lon0: -180,
  lat0: ${LAT_TOP},
  step: ${STEP},
  rle: [
${out.map((l) => `    '${l}',`).join('\n')}
  ],
} as const;
`;
writeFileSync(OUT, body);

// O contorno: o maior polígono do Brasil (o continente; as ilhas ficam de fora), só o anel de fora, simplificado.
const continente = brazil.reduce((a, b) => (b.rings[0].length > a.rings[0].length ? b : a));
const anel = continente.rings[0];
const fechado = simplificar(anel.slice(0, -1), TOLERANCIA);
const flat = fechado.flatMap(([lon, lat]) => [Math.round(lon * PRECISAO), Math.round(lat * PRECISAO)]);
const linhas = [];
for (let i = 0; i < flat.length; i += 16) linhas.push('  ' + flat.slice(i, i + 16).join(', ') + ',');
const contorno = [
  '/**',
  ' * GERADO por `scripts/mapa-mundi.mjs`: não edite à mão. O litoral e as fronteiras do Brasil (o continente, sem as ilhas) como uma linha',
  ` * fechada simplificada a ${TOLERANCIA}° (${fechado.length} pontos). Pares de longitude e latitude em centésimos de grau, um depois do outro.`,
  ' * Origem: Natural Earth 1:50m, Admin 0 – Countries (domínio público).',
  ' */',
  'export const BRASIL_CONTORNO: readonly number[] = [',
  ...linhas,
  '];',
  '',
  '/** Quantas unidades de `BRASIL_CONTORNO` valem um grau. */',
  `export const BRASIL_CONTORNO_ESCALA = ${PRECISAO};`,
  '',
].join('\n');
writeFileSync(OUT_CONTORNO, contorno);
console.log(`brasilContorno.ts: ${fechado.length} pontos (de ${anel.length}), ${contorno.length} bytes`);
console.log(`worldMask.ts: ${cols}×${rows}, ${landCells + brazilCells} células de terra (${brazilCells} do Brasil), ${body.length} bytes`);
