import { describe, expect, it } from 'vitest';
import { CHASSIS } from './chassis';
import { MECH_GRAVITY } from './MechBase';
import { comandoDoModo, comandoDoRoteiro, DT, integrar, novoEstado, QUADROS } from './roteiroDeMovimento';

const V09 = CHASSIS.vector09;

function rodar(): { velMax: number; estado: ReturnType<typeof novoEstado>; quadroDoPulo: number } {
  const s = novoEstado();
  let velMax = 0;
  let quadroDoPulo = -1;
  for (let i = 0; i <= QUADROS; i++) {
    const c = comandoDoRoteiro(i, V09.moveSpeed);
    if (c.pulo) quadroDoPulo = i;
    integrar(s, c, V09, MECH_GRAVITY, i);
    velMax = Math.max(velMax, Math.hypot(s.vx, s.vz));
  }
  return { velMax, estado: s, quadroDoPulo };
}

describe('o roteiro de teste do movimento', () => {
  it('é função pura do quadro: o mesmo quadro dá o mesmo comando', () => {
    for (const i of [0, 36, 300, 441, 492, QUADROS]) expect(comandoDoRoteiro(i, 9)).toEqual(comandoDoRoteiro(i, 9));
  });

  it('o pulo, o dash e o tiro são gestos de um quadro só, uma vez cada no roteiro', () => {
    let pulos = 0;
    let dashes = 0;
    let tiros = 0;
    for (let i = 0; i <= QUADROS; i++) {
      const c = comandoDoRoteiro(i, 9);
      if (c.pulo) pulos++;
      if (c.dash) dashes++;
      if (c.tiro) tiros++;
    }
    expect([pulos, dashes, tiros]).toEqual([1, 1, 1]);
  });

  it('corre na velocidade do chassi, pula, pousa e termina no chão', () => {
    const { velMax, estado, quadroDoPulo } = rodar();
    expect(velMax).toBeGreaterThanOrEqual(V09.moveSpeed - 1e-6);
    expect(estado.grounded).toBe(true);
    expect(estado.y).toBe(0);
    // O voo dura 2·v/g (a mesma gravidade do jogo): ~49 quadros para o Vector-09 (jumpVelocity 13, g 32).
    const voo = (estado.tPouso - quadroDoPulo) * DT;
    expect(voo).toBeGreaterThan((2 * V09.jumpVelocity) / MECH_GRAVITY - 0.05);
    expect(voo).toBeLessThan((2 * V09.jumpVelocity) / MECH_GRAVITY + 0.05);
  });

  it('o dash tem a velocidade e a duração do chassi', () => {
    const s = novoEstado();
    const c = { v: 0, giro: 0, pulo: false, dash: true, tiro: false };
    integrar(s, c, V09, MECH_GRAVITY, 0);
    expect(Math.hypot(s.vx, s.vz)).toBeCloseTo(V09.dashSpeed, 9);
    let quadros = 1;
    while (s.dash > 0 && quadros < 100) {
      integrar(s, { ...c, dash: false }, V09, MECH_GRAVITY, quadros);
      quadros++;
    }
    expect(quadros * DT).toBeGreaterThanOrEqual(V09.dashDuration - DT);
    expect(quadros * DT).toBeLessThanOrEqual(V09.dashDuration + 2 * DT);
  });

  it('os modos da prévia: parado não anda, andar é metade da velocidade, correr é a toda, o roteiro roda em laço', () => {
    expect(comandoDoModo('parado', 10, 9).v).toBe(0);
    expect(comandoDoModo('andar', 10, 9).v).toBe(4.5);
    expect(comandoDoModo('correr', 10, 9).v).toBe(9);
    expect(comandoDoModo('roteiro', 100, 9)).toEqual(comandoDoModo('roteiro', 100 + QUADROS, 9));
  });
});
