import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { COLUNAS_DE_GLIFOS, DESENHOS_DE_NEON } from './CidadeNeonLayout';

/**
 * A ARTE DOS TELÕES E DOS LETREIROS DA CIDADE NEON (P264, PR2), desenhada em canvas na hora de montar a cena — **nenhum arquivo de imagem**
 * (zero byte de download além deste código) e determinística (semente fixa: o mesmo desenho em toda máquina).
 *
 *  - **Atlas dos anúncios** (1024²): quatro em pé (256×512) e quatro deitados (512×256). Marcas do próprio universo do jogo (CYBERMECH,
 *    SERAFIM, o banco VORCARIS) e invenções da cidade (o implante SINAPSE, o energético BOTO, a ARENA, o UPGRADE do braço), nas cores das
 *    referências do Comandante: rosa, ciano, ouro, vermelho.
 *  - **Atlas dos letreiros** (1024²): em cima, oito colunas de quatro glifos (os letreiros de bandeira); embaixo, oito desenhos em tubo de neon.
 *    **Os glifos são inventados** (traços num gride 3×3, no espírito das letras orientais das referências) — nenhum idioma real é imitado; as
 *    poucas palavras são nomes ou termos que leem em qualquer língua (HOTEL não; BAR, NEON, 24H sim).
 *
 * No Node (testes e servidor) não há canvas: as duas texturas viram um pixel cinza, e a cena monta igual.
 */

export interface ArteDaCidade {
  readonly anuncios: THREE.Texture;
  readonly letreiros: THREE.Texture;
}

/** A cor que domina cada anúncio (0–3 em pé, 4–7 deitados): o reflexo no chão molhado é desta cor (`CidadeNeonReflexos.ts`). */
export const COR_DO_ANUNCIO: readonly number[] = [0xd640ff, 0xff3cc8, 0xffc85a, 0x2fd0ff, 0x3a86ff, 0xff5a2a, 0xff2d3d, 0x22e0ff];

type C2D = CanvasRenderingContext2D;

const FONTE = '"Arial Black", "Segoe UI Black", Impact, "Helvetica Neue", sans-serif';

const brilho = (c: C2D, cor: string, raio: number): void => {
  c.shadowColor = cor;
  c.shadowBlur = raio;
};
const semBrilho = (c: C2D): void => {
  c.shadowBlur = 0;
};

/** Texto centrado em (cx, cy), letra a letra com `espaco` px entre elas (o `letterSpacing` do canvas ainda não vale em todo navegador). */
function textoEspacado(c: C2D, s: string, cx: number, cy: number, tamanho: number, cor: string, corBrilho: string, espaco: number): void {
  c.font = `900 ${tamanho}px ${FONTE}`;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  const larguras = [...s].map((ch) => c.measureText(ch).width);
  const total = larguras.reduce((a, b) => a + b, 0) + espaco * (s.length - 1);
  let x = cx - total / 2;
  c.fillStyle = cor;
  brilho(c, corBrilho, tamanho * 0.45);
  [...s].forEach((ch, i) => {
    c.fillText(ch, x, cy);
    x += larguras[i]! + espaco;
  });
  semBrilho(c);
}

/** Uma célula do atlas: recorta, desloca a origem e no fim passa uma moldura escura (a mipmap não puxa a cor do anúncio vizinho). */
function celula(c: C2D, x: number, y: number, w: number, h: number, desenho: (c: C2D, w: number, h: number) => void): void {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.translate(x, y);
  desenho(c, w, h);
  c.restore();
  c.strokeStyle = '#020304';
  c.lineWidth = 12;
  c.strokeRect(x, y, w, h);
}

function degrade(c: C2D, x0: number, y0: number, x1: number, y1: number, paradas: readonly (readonly [number, string])[]): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [t, cor] of paradas) g.addColorStop(t, cor);
  return g;
}

/** Um caminho por pontos normalizados (0–1 da célula). */
function poligono(c: C2D, w: number, h: number, pontos: readonly (readonly [number, number])[]): void {
  c.beginPath();
  pontos.forEach(([x, y], i) => (i === 0 ? c.moveTo(x * w, y * h) : c.lineTo(x * w, y * h)));
  c.closePath();
}

/** Um glifo inventado: 2 a 4 traços num gride 3×3 (barras, caixa, gancho, diagonal, ponto). */
function glifo(c: C2D, cx: number, cy: number, tam: number, rand: () => number): void {
  const p = (i: number): number => (i - 1) * tam * 0.34;
  c.lineWidth = tam * 0.085;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const tracos = 2 + Math.floor(rand() * 3);
  c.beginPath();
  for (let k = 0; k < tracos; k++) {
    const tipo = Math.floor(rand() * 6);
    const a = Math.floor(rand() * 3);
    const b = Math.floor(rand() * 3);
    if (tipo === 0) {
      // barra horizontal numa linha do gride
      const x0 = Math.floor(rand() * 2);
      c.moveTo(cx + p(x0), cy + p(a));
      c.lineTo(cx + p(x0 + 1 + Math.floor(rand() * (2 - x0))), cy + p(a));
    } else if (tipo === 1) {
      const y0 = Math.floor(rand() * 2);
      c.moveTo(cx + p(a), cy + p(y0));
      c.lineTo(cx + p(a), cy + p(y0 + 1 + Math.floor(rand() * (2 - y0))));
    } else if (tipo === 2) {
      // caixa num quadrante
      const qx = Math.floor(rand() * 2);
      const qy = Math.floor(rand() * 2);
      c.rect(cx + p(qx), cy + p(qy), tam * 0.34, tam * 0.34);
    } else if (tipo === 3) {
      // gancho: desce e vira
      c.moveTo(cx + p(a), cy + p(0));
      c.lineTo(cx + p(a), cy + p(2));
      c.lineTo(cx + p(a === 0 ? 1 : a - 1), cy + p(2) - tam * 0.12);
    } else if (tipo === 4) {
      c.moveTo(cx + p(a), cy + p(0));
      c.lineTo(cx + p(b), cy + p(2));
    } else {
      c.moveTo(cx + p(a) + tam * 0.05, cy + p(b));
      c.arc(cx + p(a), cy + p(b), tam * 0.05, 0, Math.PI * 2);
    }
  }
  c.stroke();
}

// ---------------------------------------------------------------- os anúncios

function anuncioCybermech(c: C2D, w: number, h: number): void {
  c.fillStyle = degrade(c, 0, 0, 0, h, [[0, '#16002a'], [0.55, '#4a0068'], [1, '#001824']]);
  c.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h * 0.42;
  c.globalAlpha = 0.2;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.24;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a - 0.05) * h, cy + Math.sin(a - 0.05) * h);
    c.lineTo(cx + Math.cos(a + 0.05) * h, cy + Math.sin(a + 0.05) * h);
    c.closePath();
    c.fillStyle = i % 2 ? '#ff2bd6' : '#00e5ff';
    c.fill();
  }
  c.globalAlpha = 1;
  const s = w * 0.36;
  c.beginPath();
  c.moveTo(cx - s * 0.75, cy - s * 0.9);
  c.lineTo(cx + s * 0.75, cy - s * 0.9);
  c.lineTo(cx + s, cy - s * 0.4);
  c.lineTo(cx + s * 0.9, cy + s * 0.55);
  c.lineTo(cx + s * 0.45, cy + s);
  c.lineTo(cx - s * 0.45, cy + s);
  c.lineTo(cx - s * 0.9, cy + s * 0.55);
  c.lineTo(cx - s, cy - s * 0.4);
  c.closePath();
  c.fillStyle = degrade(c, 0, cy - s, 0, cy + s, [[0, '#2c3238'], [1, '#090c0f']]);
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = '#00e5ff';
  brilho(c, '#00e5ff', 14);
  c.stroke();
  c.fillStyle = '#39ff6a';
  brilho(c, '#39ff6a', 26);
  c.fillRect(cx - s * 0.7, cy - s * 0.2, s * 1.4, s * 0.22);
  semBrilho(c);
  c.strokeStyle = '#ff2bd6';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(cx, cy - s * 0.88);
  c.lineTo(cx, cy - s * 0.32);
  c.stroke();
  c.strokeStyle = '#5d6163';
  for (let i = -2; i <= 2; i++) {
    c.beginPath();
    c.moveTo(cx + i * s * 0.14, cy + s * 0.42);
    c.lineTo(cx + i * s * 0.14, cy + s * 0.84);
    c.stroke();
  }
  textoEspacado(c, '»  »  »', cx, h * 0.09, 22, '#00e5ff', '#00e5ff', 3);
  textoEspacado(c, 'CYBERMECH', cx, h * 0.86, 27, '#ffe14d', '#ff2bd6', 1);
}

function anuncioSinapse(c: C2D, w: number, h: number): void {
  const g = c.createRadialGradient(w * 0.62, h * 0.42, 8, w * 0.62, h * 0.42, h * 0.62);
  g.addColorStop(0, '#ff7ade');
  g.addColorStop(0.45, '#c3127f');
  g.addColorStop(1, '#16000f');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  // O perfil (olhando para a direita), em silhueta contra o brilho.
  c.beginPath();
  c.moveTo(0.12 * w, h);
  c.lineTo(0.2 * w, 0.78 * h);
  c.bezierCurveTo(0.08 * w, 0.66 * h, 0.06 * w, 0.42 * h, 0.2 * w, 0.27 * h);
  c.bezierCurveTo(0.3 * w, 0.17 * h, 0.58 * w, 0.16 * h, 0.66 * w, 0.33 * h);
  c.lineTo(0.68 * w, 0.4 * h);
  c.lineTo(0.67 * w, 0.43 * h);
  c.lineTo(0.77 * w, 0.52 * h);
  c.lineTo(0.69 * w, 0.545 * h);
  c.lineTo(0.715 * w, 0.575 * h);
  c.lineTo(0.69 * w, 0.592 * h);
  c.lineTo(0.71 * w, 0.612 * h);
  c.bezierCurveTo(0.7 * w, 0.66 * h, 0.68 * w, 0.68 * h, 0.62 * w, 0.69 * h);
  c.lineTo(0.5 * w, 0.72 * h);
  c.bezierCurveTo(0.47 * w, 0.82 * h, 0.5 * w, 0.92 * h, 0.52 * w, h);
  c.closePath();
  c.fillStyle = '#07000a';
  c.fill();
  // O implante: o olho aceso e o circuito correndo para a têmpora.
  c.strokeStyle = '#7ff6ff';
  c.lineWidth = 3;
  brilho(c, '#00e5ff', 12);
  c.beginPath();
  c.ellipse(0.615 * w, 0.44 * h, 0.035 * w, 0.008 * h, 0, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.moveTo(0.58 * w, 0.44 * h);
  c.lineTo(0.48 * w, 0.44 * h);
  c.lineTo(0.44 * w, 0.39 * h);
  c.lineTo(0.3 * w, 0.39 * h);
  c.moveTo(0.44 * w, 0.44 * h);
  c.lineTo(0.38 * w, 0.5 * h);
  c.lineTo(0.26 * w, 0.5 * h);
  c.stroke();
  for (const [x, y] of [[0.3, 0.39], [0.26, 0.5], [0.44, 0.39]] as const) {
    c.beginPath();
    c.arc(x * w, y * h, 4, 0, Math.PI * 2);
    c.stroke();
  }
  semBrilho(c);
  textoEspacado(c, 'SINAPSE', w / 2, h * 0.08, 28, '#ffffff', '#ff7ade', 4);
}

function anuncioSerafim(c: C2D, w: number, h: number): void {
  c.fillStyle = degrade(c, 0, 0, 0, h, [[0, '#00081e'], [1, '#00225a']]);
  c.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h * 0.4;
  const halo = c.createRadialGradient(cx, cy, 4, cx, cy, w * 0.6);
  halo.addColorStop(0, 'rgba(255, 214, 120, 0.85)');
  halo.addColorStop(0.35, 'rgba(255, 170, 60, 0.25)');
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  c.fillStyle = halo;
  c.fillRect(0, 0, w, h);
  // Seis asas (três pares), cada uma um leque de cinco penas.
  for (const lado of [-1, 1]) {
    for (const base of [-0.62, 0.05, 0.68]) {
      for (let j = 0; j < 5; j++) {
        const ang = base + (j - 2) * 0.13;
        const dx = Math.cos(ang) * lado;
        const dy = Math.sin(ang);
        const ox = cx + lado * 12;
        const len = w * 0.44 * (1 - Math.abs(j - 2) * 0.12);
        const px = -dy * 7;
        const py = dx * 7;
        c.beginPath();
        c.moveTo(ox, cy);
        c.quadraticCurveTo(ox + dx * len * 0.5 + px, cy + dy * len * 0.5 + py, ox + dx * len, cy + dy * len);
        c.quadraticCurveTo(ox + dx * len * 0.5 - px, cy + dy * len * 0.5 - py, ox, cy);
        c.fillStyle = 'rgba(255, 200, 90, 0.5)';
        c.fill();
        c.strokeStyle = '#ffe2a0';
        c.lineWidth = 2;
        brilho(c, '#ffb347', 8);
        c.stroke();
      }
    }
  }
  semBrilho(c);
  // O olho no centro.
  c.fillStyle = '#fff6e0';
  brilho(c, '#ffffff', 20);
  c.beginPath();
  c.ellipse(cx, cy, 22, 11, 0, 0, Math.PI * 2);
  c.fill();
  semBrilho(c);
  c.fillStyle = '#0a1a4a';
  c.beginPath();
  c.arc(cx, cy, 7, 0, Math.PI * 2);
  c.fill();
  textoEspacado(c, 'SERAFIM', cx, h * 0.84, 30, '#ffd36b', '#ff9f1a', 4);
}

function anuncioBoto(c: C2D, w: number, h: number): void {
  c.fillStyle = degrade(c, 0, 0, 0, h, [[0, '#00d0e8'], [0.5, '#1a5bd0'], [1, '#3b0b5e']]);
  c.fillRect(0, 0, w, h);
  const rand = mulberry32(77);
  c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  c.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    c.beginPath();
    c.arc(rand() * w, rand() * h * 0.8, 2 + rand() * 9, 0, Math.PI * 2);
    c.stroke();
  }
  // O boto-cor-de-rosa saltando: corpo, nadadeira, cauda e o bico comprido.
  c.beginPath();
  c.moveTo(0.22 * w, 0.72 * h);
  c.bezierCurveTo(0.3 * w, 0.5 * h, 0.5 * w, 0.3 * h, 0.68 * w, 0.28 * h);
  c.bezierCurveTo(0.74 * w, 0.26 * h, 0.78 * w, 0.27 * h, 0.8 * w, 0.29 * h);
  c.lineTo(0.94 * w, 0.24 * h);
  c.lineTo(0.94 * w, 0.257 * h);
  c.lineTo(0.8 * w, 0.33 * h);
  c.bezierCurveTo(0.7 * w, 0.42 * h, 0.5 * w, 0.55 * h, 0.3 * w, 0.76 * h);
  c.closePath();
  c.moveTo(0.25 * w, 0.72 * h);
  c.lineTo(0.08 * w, 0.75 * h);
  c.quadraticCurveTo(0.15 * w, 0.8 * h, 0.12 * w, 0.89 * h);
  c.lineTo(0.28 * w, 0.76 * h);
  c.closePath();
  c.moveTo(0.44 * w, 0.43 * h);
  c.lineTo(0.5 * w, 0.355 * h);
  c.lineTo(0.55 * w, 0.4 * h);
  c.closePath();
  c.moveTo(0.62 * w, 0.4 * h);
  c.lineTo(0.6 * w, 0.5 * h);
  c.lineTo(0.67 * w, 0.42 * h);
  c.closePath();
  c.fillStyle = degrade(c, 0, 0.25 * h, 0, 0.8 * h, [[0, '#ffc2e2'], [1, '#ff3d98']]);
  brilho(c, '#ffffff', 16);
  c.fill();
  semBrilho(c);
  c.fillStyle = '#2a0018';
  c.beginPath();
  c.arc(0.76 * w, 0.3 * h, 3, 0, Math.PI * 2);
  c.fill();
  // O respingo embaixo.
  c.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  c.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.arc(0.25 * w + i * 9, 0.82 * h - (i % 2) * 8, 4 + (i % 3) * 2, Math.PI, 0);
    c.stroke();
  }
  textoEspacado(c, 'BOTO', w / 2, h * 0.9, 58, '#ffffff', '#ff3d98', 6);
}

function zigueZague(c: C2D, x: number, y: number, larg: number, alt: number): void {
  c.beginPath();
  c.moveTo(x, y);
  for (let i = 1; i <= 4; i++) c.lineTo(x + (larg * i) / 4, i % 2 ? y + alt : y);
  c.stroke();
}

function anuncioVorcaris(c: C2D, w: number, h: number): void {
  c.fillStyle = degrade(c, 0, 0, w, 0, [[0, '#000c2a'], [1, '#00307a']]);
  c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.08;
  c.fillStyle = '#9cc6ff';
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.moveTo(80 + i * 110, 0);
    c.lineTo(140 + i * 110, 0);
    c.lineTo(40 + i * 110, h);
    c.lineTo(-20 + i * 110, h);
    c.closePath();
    c.fill();
  }
  c.globalAlpha = 1;
  c.strokeStyle = '#5aa0ff';
  c.lineWidth = 10;
  c.lineJoin = 'miter';
  brilho(c, '#438cff', 18);
  zigueZague(c, 24, 76, 92, 100);
  semBrilho(c);
  c.font = `900 66px ${FONTE}`;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  c.fillStyle = '#ffffff';
  brilho(c, '#438cff', 22);
  c.fillText('VORCARIS', 132, 112);
  semBrilho(c);
  c.fillStyle = '#5aa0ff';
  c.fillRect(134, 150, 360, 3);
  c.font = `700 26px Consolas, "Courier New", monospace`;
  c.fillStyle = '#39ff6a';
  brilho(c, '#39ff6a', 10);
  c.fillText('▲ +9.999%', 136, 190);
  c.beginPath();
  c.lineWidth = 3;
  c.strokeStyle = '#39ff6a';
  const pts = [0, 6, 2, 12, 9, 18, 15, 30, 26, 44];
  pts.forEach((v, i) => (i === 0 ? c.moveTo(330 + i * 16, 222 - v * 1.8) : c.lineTo(330 + i * 16, 222 - v * 1.8)));
  c.stroke();
  semBrilho(c);
}

/** A silhueta de um Mech de perfil (blocos, sem detalhe miúdo), com a borda acesa na cor do time. */
function mechSilhueta(c: C2D, x: number, y: number, s: number, olhaParaDireita: boolean, borda: string): void {
  c.save();
  c.translate(x, y);
  if (!olhaParaDireita) c.scale(-1, 1);
  c.beginPath();
  c.rect(-0.35 * s, -0.25 * s, 0.22 * s, 0.75 * s); // perna de trás
  c.rect(0.08 * s, -0.25 * s, 0.22 * s, 0.75 * s); // perna da frente
  c.rect(-0.45 * s, -0.95 * s, 0.85 * s, 0.75 * s); // torso
  c.rect(-0.18 * s, -1.25 * s, 0.4 * s, 0.32 * s); // cabeça
  c.rect(0.1 * s, -0.8 * s, 0.85 * s, 0.18 * s); // o canhão
  c.fillStyle = '#050506';
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = borda;
  brilho(c, borda, 14);
  c.stroke();
  c.fillStyle = borda;
  c.fillRect(0.02 * s, -1.15 * s, 0.18 * s, 0.07 * s); // o visor
  semBrilho(c);
  c.restore();
}

function anuncioArena(c: C2D, w: number, h: number): void {
  c.fillStyle = degrade(c, 0, 0, w / 2, 0, [[0, '#2a0004'], [1, '#8c1f22']]);
  c.fillRect(0, 0, w / 2 + 30, h);
  c.fillStyle = degrade(c, w / 2, 0, w, 0, [[0, '#a8760f'], [1, '#2e1d00']]);
  poligono(c, w, h, [[0.56, 0], [1, 0], [1, 1], [0.44, 1]]);
  c.fill();
  c.strokeStyle = '#ffffff';
  c.lineWidth = 4;
  brilho(c, '#ffffff', 20);
  c.beginPath();
  c.moveTo(0.56 * w, 0);
  c.lineTo(0.44 * w, h);
  c.stroke();
  semBrilho(c);
  mechSilhueta(c, w * 0.2, h * 0.84, h * 0.5, true, '#ff2d3d');
  mechSilhueta(c, w * 0.8, h * 0.84, h * 0.5, false, '#ffe14d');
  textoEspacado(c, 'VS', w / 2, h * 0.52, 60, '#ffffff', '#ffffff', 2);
  textoEspacado(c, 'ARENA', w / 2, h * 0.13, 30, '#ffffff', '#ff2d3d', 10);
  textoEspacado(c, '24H', w / 2, h * 0.86, 24, '#ffe14d', '#ffb000', 4);
}

function anuncioGlifos(c: C2D, w: number, h: number): void {
  c.fillStyle = '#060006';
  c.fillRect(0, 0, w, h);
  const sol = c.createRadialGradient(w * 0.78, h * 0.5, 10, w * 0.78, h * 0.5, 86);
  sol.addColorStop(0, '#ff8a8a');
  sol.addColorStop(0.7, '#ff2d3d');
  sol.addColorStop(1, '#5a0008');
  c.fillStyle = sol;
  brilho(c, '#ff2d3d', 40);
  c.beginPath();
  c.arc(w * 0.78, h * 0.5, 80, 0, Math.PI * 2);
  c.fill();
  semBrilho(c);
  const rand = mulberry32(2077);
  c.strokeStyle = '#ffffff';
  brilho(c, '#ff5acd', 14);
  for (let i = 0; i < 3; i++) glifo(c, 70 + i * 100, h * 0.5, 96, rand);
  semBrilho(c);
  c.strokeStyle = '#ff2d3d';
  c.lineWidth = 3;
  c.strokeRect(14, 14, w - 28, h - 28);
  c.strokeRect(22, 22, w - 44, h - 44);
}

function anuncioUpgrade(c: C2D, w: number, h: number): void {
  c.fillStyle = degrade(c, 0, 0, w, 0, [[0, '#03090c'], [1, '#00323d']]);
  c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(0, 229, 255, 0.12)';
  c.lineWidth = 1;
  for (let x = 0; x < w; x += 24) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, h);
    c.stroke();
  }
  for (let y = 0; y < h; y += 24) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
  // O braço cibernético fazendo "muque": ombro, cotovelo, punho.
  const ombro = [70, 236] as const;
  const cotovelo = [150, 168] as const;
  const punho = [128, 70] as const;
  c.lineCap = 'round';
  c.strokeStyle = degrade(c, 40, 0, 200, 0, [[0, '#9aa4aa'], [1, '#3c4246']]);
  c.lineWidth = 40;
  c.beginPath();
  c.moveTo(...ombro);
  c.lineTo(...cotovelo);
  c.stroke();
  c.lineWidth = 32;
  c.beginPath();
  c.moveTo(...cotovelo);
  c.lineTo(...punho);
  c.stroke();
  c.fillStyle = '#5d6163';
  c.beginPath();
  c.arc(punho[0], punho[1] - 18, 26, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#00e5ff';
  brilho(c, '#00e5ff', 18);
  for (const [x, y] of [ombro, cotovelo, punho]) {
    c.beginPath();
    c.arc(x, y, 9, 0, Math.PI * 2);
    c.fill();
  }
  semBrilho(c);
  c.font = `900 56px ${FONTE}`;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  c.fillStyle = degrade(c, 230, 0, 500, 0, [[0, '#00e5ff'], [1, '#ffffff']]);
  brilho(c, '#00e5ff', 20);
  c.fillText('UPGRADE', 226, 108);
  c.font = `900 40px ${FONTE}`;
  c.fillStyle = '#ffe14d';
  brilho(c, '#ffb000', 14);
  c.fillText('+100%', 230, 180);
  semBrilho(c);
}

const ANUNCIOS_EM_PE = [anuncioCybermech, anuncioSinapse, anuncioSerafim, anuncioBoto] as const;
const ANUNCIOS_DEITADOS = [anuncioVorcaris, anuncioArena, anuncioGlifos, anuncioUpgrade] as const;

function desenharAnuncios(c: C2D): void {
  c.fillStyle = '#020304';
  c.fillRect(0, 0, 1024, 1024);
  ANUNCIOS_EM_PE.forEach((f, i) => celula(c, i * 256, 0, 256, 512, f));
  ANUNCIOS_DEITADOS.forEach((f, i) => celula(c, (i % 2) * 512, 512 + Math.floor(i / 2) * 256, 512, 256, f));
}

// ---------------------------------------------------------------- os desenhos em neon (contorno branco; a cor vem do letreiro)

type Desenho = (c: C2D, s: number) => void;

const DESENHOS: readonly Desenho[] = [
  // coração
  (c, s) => {
    c.beginPath();
    c.moveTo(0.5 * s, 0.82 * s);
    c.bezierCurveTo(0.1 * s, 0.55 * s, 0.12 * s, 0.22 * s, 0.32 * s, 0.22 * s);
    c.bezierCurveTo(0.42 * s, 0.22 * s, 0.48 * s, 0.3 * s, 0.5 * s, 0.36 * s);
    c.bezierCurveTo(0.52 * s, 0.3 * s, 0.58 * s, 0.22 * s, 0.68 * s, 0.22 * s);
    c.bezierCurveTo(0.88 * s, 0.22 * s, 0.9 * s, 0.55 * s, 0.5 * s, 0.82 * s);
    c.stroke();
  },
  // a caveira de gato
  (c, s) => {
    c.beginPath();
    c.moveTo(0.22 * s, 0.5 * s);
    c.lineTo(0.2 * s, 0.14 * s);
    c.lineTo(0.38 * s, 0.3 * s);
    c.lineTo(0.62 * s, 0.3 * s);
    c.lineTo(0.8 * s, 0.14 * s);
    c.lineTo(0.78 * s, 0.5 * s);
    c.bezierCurveTo(0.78 * s, 0.72 * s, 0.64 * s, 0.82 * s, 0.5 * s, 0.82 * s);
    c.bezierCurveTo(0.36 * s, 0.82 * s, 0.22 * s, 0.72 * s, 0.22 * s, 0.5 * s);
    c.moveTo(0.32 * s, 0.46 * s);
    c.lineTo(0.44 * s, 0.52 * s);
    c.lineTo(0.32 * s, 0.56 * s);
    c.closePath();
    c.moveTo(0.68 * s, 0.46 * s);
    c.lineTo(0.56 * s, 0.52 * s);
    c.lineTo(0.68 * s, 0.56 * s);
    c.closePath();
    c.moveTo(0.36 * s, 0.7 * s);
    c.lineTo(0.64 * s, 0.7 * s);
    for (let i = 0; i < 4; i++) {
      c.moveTo((0.4 + i * 0.066) * s, 0.66 * s);
      c.lineTo((0.4 + i * 0.066) * s, 0.74 * s);
    }
    c.stroke();
  },
  // o capacete de Mech
  (c, s) => {
    c.beginPath();
    c.moveTo(0.3 * s, 0.2 * s);
    c.lineTo(0.7 * s, 0.2 * s);
    c.lineTo(0.84 * s, 0.4 * s);
    c.lineTo(0.78 * s, 0.7 * s);
    c.lineTo(0.62 * s, 0.84 * s);
    c.lineTo(0.38 * s, 0.84 * s);
    c.lineTo(0.22 * s, 0.7 * s);
    c.lineTo(0.16 * s, 0.4 * s);
    c.closePath();
    c.moveTo(0.26 * s, 0.46 * s);
    c.lineTo(0.74 * s, 0.46 * s);
    c.lineTo(0.7 * s, 0.54 * s);
    c.lineTo(0.3 * s, 0.54 * s);
    c.closePath();
    c.stroke();
  },
  // o raio
  (c, s) => {
    c.beginPath();
    c.moveTo(0.58 * s, 0.1 * s);
    c.lineTo(0.26 * s, 0.54 * s);
    c.lineTo(0.48 * s, 0.54 * s);
    c.lineTo(0.38 * s, 0.9 * s);
    c.lineTo(0.76 * s, 0.42 * s);
    c.lineTo(0.54 * s, 0.42 * s);
    c.closePath();
    c.stroke();
  },
  // a arara pousada
  (c, s) => {
    c.beginPath();
    c.arc(0.56 * s, 0.26 * s, 0.11 * s, 0, Math.PI * 2);
    c.moveTo(0.66 * s, 0.22 * s);
    c.quadraticCurveTo(0.8 * s, 0.22 * s, 0.76 * s, 0.38 * s);
    c.quadraticCurveTo(0.7 * s, 0.32 * s, 0.66 * s, 0.32 * s);
    c.moveTo(0.48 * s, 0.34 * s);
    c.quadraticCurveTo(0.3 * s, 0.5 * s, 0.4 * s, 0.66 * s);
    c.quadraticCurveTo(0.56 * s, 0.6 * s, 0.62 * s, 0.36 * s);
    c.moveTo(0.42 * s, 0.64 * s);
    c.lineTo(0.24 * s, 0.94 * s);
    c.moveTo(0.46 * s, 0.66 * s);
    c.lineTo(0.34 * s, 0.96 * s);
    c.moveTo(0.3 * s, 0.7 * s);
    c.lineTo(0.7 * s, 0.7 * s);
    c.stroke();
    c.beginPath();
    c.arc(0.58 * s, 0.24 * s, 0.015 * s, 0, Math.PI * 2);
    c.stroke();
  },
  // o coqueiro
  (c, s) => {
    c.beginPath();
    c.moveTo(0.42 * s, 0.94 * s);
    c.quadraticCurveTo(0.5 * s, 0.6 * s, 0.52 * s, 0.34 * s);
    for (const [dx, dy] of [[-0.34, 0.06], [-0.22, -0.16], [0.02, -0.24], [0.24, -0.14], [0.34, 0.08]] as const) {
      c.moveTo(0.52 * s, 0.34 * s);
      c.quadraticCurveTo((0.52 + dx * 0.5) * s, (0.34 + dy - 0.1) * s, (0.52 + dx) * s, (0.34 + dy + 0.06) * s);
    }
    c.moveTo(0.53 * s, 0.39 * s);
    c.arc(0.5 * s, 0.39 * s, 0.03 * s, 0, Math.PI * 2);
    c.moveTo(0.59 * s, 0.4 * s);
    c.arc(0.56 * s, 0.4 * s, 0.03 * s, 0, Math.PI * 2);
    c.stroke();
  },
  // o olho
  (c, s) => {
    c.beginPath();
    c.moveTo(0.14 * s, 0.5 * s);
    c.quadraticCurveTo(0.5 * s, 0.18 * s, 0.86 * s, 0.5 * s);
    c.quadraticCurveTo(0.5 * s, 0.82 * s, 0.14 * s, 0.5 * s);
    c.moveTo(0.62 * s, 0.5 * s);
    c.arc(0.5 * s, 0.5 * s, 0.12 * s, 0, Math.PI * 2);
    c.moveTo(0.54 * s, 0.5 * s);
    c.arc(0.5 * s, 0.5 * s, 0.04 * s, 0, Math.PI * 2);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.85 + i * (Math.PI * 0.7) / 6;
      c.moveTo((0.5 + Math.cos(a) * 0.3) * s, (0.5 + Math.sin(a) * 0.3) * s);
      c.lineTo((0.5 + Math.cos(a) * 0.42) * s, (0.5 + Math.sin(a) * 0.42) * s);
    }
    c.stroke();
  },
  // o coquetel
  (c, s) => {
    c.beginPath();
    c.moveTo(0.2 * s, 0.22 * s);
    c.lineTo(0.8 * s, 0.22 * s);
    c.lineTo(0.5 * s, 0.56 * s);
    c.closePath();
    c.moveTo(0.5 * s, 0.56 * s);
    c.lineTo(0.5 * s, 0.84 * s);
    c.moveTo(0.34 * s, 0.86 * s);
    c.lineTo(0.66 * s, 0.86 * s);
    c.moveTo(0.62 * s, 0.1 * s);
    c.lineTo(0.5 * s, 0.4 * s);
    c.moveTo(0.43 * s, 0.32 * s);
    c.arc(0.4 * s, 0.32 * s, 0.03 * s, 0, Math.PI * 2);
    c.stroke();
  },
];

/** As letras dos letreiros que não são glifos inventados (colunas 5 a 7): leem em qualquer língua. */
const PALAVRAS: Readonly<Record<number, readonly string[]>> = { 5: ['2', '4', 'H', '★'], 6: ['B', 'A', 'R', '★'], 7: ['N', 'E', 'O', 'N'] };

function desenharLetreiros(c: C2D): void {
  c.fillStyle = '#000000';
  c.fillRect(0, 0, 1024, 1024);
  c.strokeStyle = '#ffffff';
  c.fillStyle = '#ffffff';
  const rand = mulberry32(0x6c657472);
  for (let col = 0; col < COLUNAS_DE_GLIFOS; col++) {
    for (let k = 0; k < 4; k++) {
      const cx = col * 128 + 64;
      const cy = k * 128 + 64;
      const palavra = PALAVRAS[col];
      brilho(c, '#ffffff', 12);
      if (palavra) {
        c.font = `900 92px ${FONTE}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineWidth = 7;
        c.strokeText(palavra[k]!, cx, cy + 4);
      } else {
        glifo(c, cx, cy, 104, rand);
      }
      semBrilho(c);
    }
  }
  c.lineWidth = 9;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (let i = 0; i < DESENHOS_DE_NEON; i++) {
    c.save();
    c.translate((i % 4) * 256 + 8, 512 + Math.floor(i / 4) * 256 + 8);
    brilho(c, '#ffffff', 16);
    DESENHOS[i]!(c, 240);
    semBrilho(c);
    c.restore();
  }
}

function texturaDoCanvas(desenhar: (c: C2D) => void, espacoDeCor: THREE.ColorSpace): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  desenhar(canvas.getContext('2d')!);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = espacoDeCor;
  t.anisotropy = 4;
  return t;
}

function pixelCinza(): THREE.Texture {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

/** Desenha os dois atlas (uma vez, na montagem da cena). Sem DOM, devolve um pixel cinza para cada um. */
export function criarArte(): ArteDaCidade {
  if (typeof document === 'undefined') return { anuncios: pixelCinza(), letreiros: pixelCinza() };
  // Os anúncios são imagem (sRGB); os letreiros são máscara de intensidade (linear: o halo do traço fica visível).
  return { anuncios: texturaDoCanvas(desenharAnuncios, THREE.SRGBColorSpace), letreiros: texturaDoCanvas(desenharLetreiros, THREE.NoColorSpace) };
}
