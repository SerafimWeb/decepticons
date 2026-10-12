import { describe, expect, it } from 'vitest';
import { ATLAS_GRID, CELL, SHAPE, SHAPE_NAMES, cellOrigin, drawAtlas } from './particleShapes';

/** Um contexto 2D de mentira que só anota o que foi pedido: translate (a origem de cada célula) e quantos traços saíram dentro dela. */
function gravador() {
  const origens: Array<{ x: number; y: number }> = [];
  const traçosPorCélula: number[] = [];
  let ox = 0;
  let oy = 0;
  let nivel = 0;
  const pilha: Array<{ x: number; y: number }> = [];
  const chamadas = { fill: 0, stroke: 0, fillRect: 0 };
  const g = { addColorStop: () => {} };
  const ctx: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    save: () => {
      pilha.push({ x: ox, y: oy });
      nivel++;
    },
    restore: () => {
      const p = pilha.pop()!;
      ox = p.x;
      oy = p.y;
      nivel--;
    },
    translate: (x: number, y: number) => {
      ox += x;
      oy += y;
      if (nivel === 1 && x % CELL === 0 && y % CELL === 0) origens.push({ x: ox, y: oy });
    },
    createRadialGradient: () => g,
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    ellipse: () => {},
    quadraticCurveTo: () => {},
    closePath: () => {},
    rotate: () => {},
    scale: () => {},
    fill: () => {
      chamadas.fill++;
      traçosPorCélula[origens.length - 1] = (traçosPorCélula[origens.length - 1] ?? 0) + 1;
    },
    stroke: () => {
      chamadas.stroke++;
      traçosPorCélula[origens.length - 1] = (traçosPorCélula[origens.length - 1] ?? 0) + 1;
    },
    fillRect: () => {
      chamadas.fillRect++;
      traçosPorCélula[origens.length - 1] = (traçosPorCélula[origens.length - 1] ?? 0) + 1;
    },
  };
  return { ctx, origens, traçosPorCélula, chamadas };
}

describe('o atlas de formas das partículas', () => {
  it('cada forma tem uma célula própria, e todas cabem na grade de 4 × 4', () => {
    const ids = Object.values(SHAPE);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(ATLAS_GRID * ATLAS_GRID);
    }
    expect(SHAPE_NAMES).toHaveLength(ids.length);
  });

  it('o brilho redondo continua na célula 0: partícula sem forma declarada fica igual ao que era', () => {
    expect(SHAPE.glow).toBe(0);
  });

  it('as formas que o dono pediu existem: floco de seis braços, caco, chama, faísca alongada, anel, raio e onda', () => {
    for (const nome of ['flake', 'shard', 'flame', 'streak', 'ring', 'bolt', 'wave'] as const) expect(SHAPE[nome], nome).toBeGreaterThan(0);
  });

  it('o atlas desenha uma célula por forma, cada uma na sua posição da grade, e cada uma pinta alguma coisa', () => {
    const { ctx, origens, traçosPorCélula } = gravador();
    drawAtlas(ctx as never);
    expect(origens).toHaveLength(SHAPE_NAMES.length);
    const vistos = new Set(origens.map((o) => `${o.x},${o.y}`));
    expect(vistos.size).toBe(SHAPE_NAMES.length);
    for (const nome of SHAPE_NAMES) {
      const id = SHAPE[nome];
      expect(origens[id]).toEqual({ x: (id % ATLAS_GRID) * CELL, y: Math.floor(id / ATLAS_GRID) * CELL });
      expect(traçosPorCélula[id] ?? 0, nome).toBeGreaterThan(0);
    }
  });

  it('a conta da célula no atlas bate com a do shader (u à direita, v de baixo para cima, linha 0 no alto)', () => {
    // O shader: uv = ((col + x) / 4, 1 - (row + y) / 4), com y = 0 no alto do sprite.
    const o0 = cellOrigin(0);
    expect(o0.u).toBe(0);
    expect(o0.v).toBe(0.75); // a célula 0 é a do canto superior esquerdo: a faixa de cima da textura
    const o5 = cellOrigin(SHAPE.ring);
    expect(o5.u).toBe(0.25);
    expect(o5.v).toBe(0.5);
    const o12 = cellOrigin(SHAPE.wave);
    expect(o12.u).toBe(0);
    expect(o12.v).toBe(0);
  });
});
