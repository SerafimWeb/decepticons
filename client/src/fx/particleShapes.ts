/**
 * As formas das partículas (dono, 11/10: "os tiros devem ter formato, cor, presença; o gelo deve criar flocos de gelo; o fogo tem o seu formato e
 * comportamento"). Até aqui toda partícula era o mesmo ponto redondo, e por isso faísca, fumaça, fogo e gelo pareciam a mesma coisa.
 *
 * Um **atlas** de 4 × 4 células de 64 px, desenhado uma vez no canvas (branco sobre transparente; a cor vem da partícula): o `ParticleSystem`
 * escolhe a célula por partícula (atributo `particleShape`) e gira o desenho (`particleAngle`; a faísca alongada gira para a direção em que anda).
 * Custo: zero draw call novo (continua um `THREE.Points` só), uma textura de 256 × 256, e dois atributos de um float por partícula.
 */
export const ATLAS_GRID = 4;
export const CELL = 64;

/** O número da célula de cada forma. A 0 é o brilho redondo de sempre: partícula sem forma declarada fica igual ao que era. */
export const SHAPE = {
  glow: 0,
  /** Floco de neve de seis braços, com ramos (gelo). */
  flake: 1,
  /** Caco de cristal fino e comprido. */
  shard: 2,
  /** Língua de fogo em gota, com a ponta para cima. */
  flame: 3,
  /** Faísca alongada: gira para a direção em que a partícula anda. */
  streak: 4,
  /** Anel fino (onda de choque, pulso). */
  ring: 5,
  /** Nuvem macia (fumaça, vapor). */
  puff: 6,
  /** Estrela de quatro pontas (brilho elétrico, estrelas do atordoamento). */
  star: 7,
  /** Raio em zigue-zague. */
  bolt: 8,
  /** Cartucho de metal. */
  casing: 9,
  /** Ponto pequeno e nítido (brasa, fagulha). */
  dot: 10,
  /** Hexágono vazado (campo de energia, EMP). */
  hex: 11,
  /** Arco de onda sonora. */
  wave: 12,
} as const;
export type ParticleShape = (typeof SHAPE)[keyof typeof SHAPE];

/** Os nomes na ordem das células (para o teste e para a prancha de captura). */
export const SHAPE_NAMES = Object.keys(SHAPE) as Array<keyof typeof SHAPE>;

type Ctx = Pick<
  CanvasRenderingContext2D,
  'beginPath' | 'moveTo' | 'lineTo' | 'arc' | 'stroke' | 'fill' | 'closePath' | 'save' | 'restore' | 'translate' | 'rotate' | 'scale' | 'createRadialGradient' | 'fillRect' | 'quadraticCurveTo' | 'ellipse'
> & { fillStyle: unknown; strokeStyle: unknown; lineWidth: number; lineCap: CanvasLineCap; lineJoin: CanvasLineJoin; globalAlpha: number };

const C = CELL / 2;
const WHITE = 'rgba(255,255,255,1)';

/** Gradiente radial branco com o centro em (cx, cy) **no espaço de desenho de agora**: crie-o depois de translate e scale, nunca antes. */
function radial(ctx: Ctx, r: number, stops: Array<[number, number]>, cx = C, cy = C): unknown {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [at, a] of stops) g.addColorStop(at, `rgba(255,255,255,${a})`);
  return g;
}

/** Cada forma é desenhada em uma célula de 64 × 64, centrada em (32, 32), com uma margem de 3 px para não vazar na célula vizinha. */
const DRAW: Record<keyof typeof SHAPE, (ctx: Ctx) => void> = {
  glow(ctx) {
    ctx.fillStyle = radial(ctx, C, [[0, 1], [0.3, 0.6], [1, 0]]);
    ctx.fillRect(0, 0, CELL, CELL);
  },
  flake(ctx) {
    ctx.strokeStyle = WHITE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.save();
    ctx.translate(C, C);
    for (let k = 0; k < 6; k++) {
      ctx.save();
      ctx.rotate((k * Math.PI) / 3);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -27);
      ctx.stroke();
      ctx.lineWidth = 2;
      for (const [y, len] of [[-9, 8], [-18, 6]] as const) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(-len, y - len * 0.75);
        ctx.moveTo(0, y);
        ctx.lineTo(len, y - len * 0.75);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.fillStyle = radial(ctx, 8, [[0, 1], [1, 0]], 0, 0);
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  shard(ctx) {
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.moveTo(C, 3);
    ctx.lineTo(C + 7, C);
    ctx.lineTo(C, CELL - 3);
    ctx.lineTo(C - 7, C);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = radial(ctx, C, [[0, 0.8], [1, 0]]);
    ctx.fillRect(0, 0, CELL, CELL);
    ctx.globalAlpha = 1;
  },
  flame(ctx) {
    ctx.save();
    ctx.translate(C, C + 3);
    ctx.scale(0.62, 1);
    ctx.fillStyle = radial(ctx, 29, [[0, 1], [0.5, 0.8], [1, 0.15]], 0, 4);
    ctx.beginPath();
    ctx.moveTo(0, -29);
    ctx.quadraticCurveTo(24, -4, 14, 14);
    ctx.quadraticCurveTo(0, 30, -14, 14);
    ctx.quadraticCurveTo(-24, -4, 0, -29);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  streak(ctx) {
    // Alongada no eixo x, mais grossa no meio e afinando nas duas pontas.
    ctx.save();
    ctx.translate(C, C);
    ctx.scale(1, 0.11);
    ctx.fillStyle = radial(ctx, C - 2, [[0, 1], [0.55, 0.7], [1, 0]], 0, 0);
    ctx.beginPath();
    ctx.arc(0, 0, C - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = radial(ctx, 7, [[0, 1], [1, 0]]);
    ctx.beginPath();
    ctx.arc(C, C, 7, 0, Math.PI * 2);
    ctx.fill();
  },
  ring(ctx) {
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(C, C, 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(C, C, 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
  puff(ctx) {
    for (const [x, y, r] of [[C, C, 22], [C - 10, C + 5, 15], [C + 11, C + 3, 14], [C + 2, C - 11, 14]] as const) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CELL, CELL);
    }
  },
  star(ctx) {
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.moveTo(C, 3);
    ctx.quadraticCurveTo(C + 3, C - 3, CELL - 3, C);
    ctx.quadraticCurveTo(C + 3, C + 3, C, CELL - 3);
    ctx.quadraticCurveTo(C - 3, C + 3, 3, C);
    ctx.quadraticCurveTo(C - 3, C - 3, C, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = radial(ctx, 12, [[0, 1], [1, 0]]);
    ctx.beginPath();
    ctx.arc(C, C, 12, 0, Math.PI * 2);
    ctx.fill();
  },
  bolt(ctx) {
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(5, C + 4);
    ctx.lineTo(18, C - 9);
    ctx.lineTo(27, C + 8);
    ctx.lineTo(38, C - 10);
    ctx.lineTo(46, C + 6);
    ctx.lineTo(CELL - 5, C - 4);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.globalAlpha = 0.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
  casing(ctx) {
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.moveTo(C - 15, C - 5);
    ctx.lineTo(C + 11, C - 5);
    ctx.lineTo(C + 15, C - 3);
    ctx.lineTo(C + 15, C + 3);
    ctx.lineTo(C + 11, C + 5);
    ctx.lineTo(C - 15, C + 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.fillRect(C - 15, C - 1, 30, 2);
    ctx.globalAlpha = 1;
  },
  dot(ctx) {
    ctx.fillStyle = radial(ctx, 9, [[0, 1], [0.6, 0.9], [1, 0]]);
    ctx.beginPath();
    ctx.arc(C, C, 9, 0, Math.PI * 2);
    ctx.fill();
  },
  hex(ctx) {
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + Math.PI / 6;
      const x = C + Math.cos(a) * 24;
      const y = C + Math.sin(a) * 24;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  wave(ctx) {
    ctx.strokeStyle = WHITE;
    ctx.lineCap = 'round';
    for (const [r, w, a] of [[11, 3, 1], [19, 2.6, 0.75], [27, 2.2, 0.5]] as const) {
      ctx.lineWidth = w;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(8, C, r, -0.9, 0.9);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
};

/** Desenha o atlas inteiro num contexto 2D de `ATLAS_GRID * CELL` de lado. */
export function drawAtlas(ctx: Ctx): void {
  for (const name of SHAPE_NAMES) {
    const id = SHAPE[name];
    ctx.save();
    ctx.translate((id % ATLAS_GRID) * CELL, Math.floor(id / ATLAS_GRID) * CELL);
    DRAW[name](ctx);
    ctx.restore();
  }
}

/** O canto (u, v) da célula `shape` no atlas, em 0..1, com o v de baixo para cima como o three.js espera. */
export function cellOrigin(shape: number): { u: number; v: number } {
  return { u: (shape % ATLAS_GRID) / ATLAS_GRID, v: 1 - (Math.floor(shape / ATLAS_GRID) + 1) / ATLAS_GRID };
}
