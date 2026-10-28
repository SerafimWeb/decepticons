import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { COLUNAS_DE_GLIFOS, DESENHOS_DE_NEON } from './CidadeNeonLayout';

/**
 * A ARTE DOS LETREIROS DA CIDADE NEON (P264, PR2), desenhada em canvas na hora de montar a cena — **nenhum arquivo de imagem** (zero byte de download além deste código) e
 * determinística (semente fixa: o mesmo desenho em toda máquina). **Os anúncios dos telões saíram daqui na P266:** viraram os outdoors da marca (imagens do catálogo
 * `brand/anuncios.ts`, desenhadas pela mesa de anúncios, `npm run anuncios`).
 *
 * **Atlas dos letreiros** (1024²): em cima, oito colunas de quatro glifos (os letreiros de bandeira); embaixo, oito desenhos em tubo de neon.
 * **Os glifos são inventados** (traços num gride 3×3, no espírito das letras orientais das referências) — nenhum idioma real é imitado; as
 * poucas palavras são nomes ou termos que leem em qualquer língua (HOTEL não; BAR, NEON, 24H sim).
 *
 * No Node (testes e servidor) não há canvas: a textura vira um pixel cinza, e a cena monta igual.
 */

export interface ArteDaCidade {
  readonly letreiros: THREE.Texture;
}

type C2D = CanvasRenderingContext2D;

const FONTE = '"Arial Black", "Segoe UI Black", Impact, "Helvetica Neue", sans-serif';

const brilho = (c: C2D, cor: string, raio: number): void => {
  c.shadowColor = cor;
  c.shadowBlur = raio;
};
const semBrilho = (c: C2D): void => {
  c.shadowBlur = 0;
};

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

/** Desenha o atlas dos letreiros (uma vez, na montagem da cena). Sem DOM, devolve um pixel cinza. */
export function criarArte(): ArteDaCidade {
  if (typeof document === 'undefined') return { letreiros: pixelCinza() };
  // Os letreiros são máscara de intensidade (linear: o halo do traço fica visível).
  return { letreiros: texturaDoCanvas(desenharLetreiros, THREE.NoColorSpace) };
}
