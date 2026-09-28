import { describe, expect, it, vi } from 'vitest';
import {
  CTF_BASES,
  CTF_CARRIER_SPEED,
  CTF_FLAG_RETURN_S,
  CTF_MATCH_S,
  CaptureTheFlag,
  type CtfTeam,
  type CtfUnit,
} from './CaptureTheFlag';

function unit(x: number, z: number): CtfUnit & { alive: boolean; simPosition: { x: number; y: number; z: number } } {
  return { alive: true, simPosition: { x, y: 0, z }, stats: { height: 5 }, moveSpeedScale: 1 };
}

function at(u: CtfUnit & { simPosition: { x: number; z: number } }, team: CtfTeam): void {
  u.simPosition.x = CTF_BASES[team].x;
  u.simPosition.z = CTF_BASES[team].z;
}

function game() {
  const ctf = new CaptureTheFlag();
  const blue = unit(CTF_BASES.blue.x, CTF_BASES.blue.z);
  const red = unit(CTF_BASES.red.x, CTF_BASES.red.z);
  ctf.register(blue, 'blue');
  ctf.register(red, 'red');
  return { ctf, blue, red };
}

describe('Capture The Flag', () => {
  it('começa com uma bandeira na base de cada time', () => {
    const { ctf } = game();
    expect(ctf.flag('blue')).toMatchObject({ phase: 'home', x: CTF_BASES.blue.x, z: CTF_BASES.blue.z });
    expect(ctf.flag('red')).toMatchObject({ phase: 'home', x: CTF_BASES.red.x, z: CTF_BASES.red.z });
  });

  it('só o adversário dentro do raio pega a bandeira', () => {
    const { ctf, blue, red } = game();
    ctf.fixedUpdate(1 / 60);
    expect(ctf.flag('red').carrier).toBeNull();
    blue.simPosition.x = CTF_BASES.red.x - 2;
    blue.simPosition.z = CTF_BASES.red.z;
    ctf.fixedUpdate(1 / 60);
    expect(ctf.flag('red').carrier).toBe(blue);
    expect(ctf.flag('red').carrier).not.toBe(red);
  });

  it('abater o portador larga a bandeira onde ele caiu', () => {
    const { ctf, blue, red } = game();
    at(blue, 'red');
    ctf.fixedUpdate(1 / 60);
    blue.simPosition.x = 12;
    blue.simPosition.z = -9;
    blue.alive = false;
    ctf.onKilled(blue, red);
    expect(ctf.flag('red')).toMatchObject({ phase: 'dropped', x: 12, z: -9, returnLeft: CTF_FLAG_RETURN_S });
    expect(ctf.scores.red.kills).toBe(1);
    expect(ctf.scores.red.captures).toBe(0);
  });

  it('bandeira largada volta em 15 s ou ao toque de um defensor', () => {
    const a = game();
    at(a.blue, 'red');
    a.ctf.fixedUpdate(1 / 60);
    a.blue.alive = false;
    a.ctf.onKilled(a.blue);
    a.ctf.fixedUpdate(CTF_FLAG_RETURN_S + 0.001);
    expect(a.ctf.flag('red').phase).toBe('home');

    const b = game();
    at(b.blue, 'red');
    b.ctf.fixedUpdate(1 / 60);
    b.blue.simPosition.x = 0;
    b.blue.simPosition.z = 0;
    b.blue.alive = false;
    b.ctf.onKilled(b.blue);
    b.red.simPosition.x = 0;
    b.red.simPosition.z = 0;
    b.ctf.fixedUpdate(1 / 60);
    expect(b.ctf.flag('red').phase).toBe('home');
  });

  it('não captura enquanto a própria bandeira está fora da base', () => {
    const { ctf, blue, red } = game();
    at(blue, 'red');
    at(red, 'blue');
    ctf.fixedUpdate(1 / 60);
    at(blue, 'blue');
    ctf.fixedUpdate(1 / 60);
    expect(ctf.scores.blue.captures).toBe(0);
  });

  it('captura devolve as bandeiras e soma somente a captura', () => {
    const { ctf, blue } = game();
    at(blue, 'red');
    ctf.fixedUpdate(1 / 60);
    at(blue, 'blue');
    ctf.fixedUpdate(1 / 60);
    expect(ctf.scores.blue).toEqual({ captures: 1, kills: 0 });
    expect(ctf.flag('blue').phase).toBe('home');
    expect(ctf.flag('red').phase).toBe('home');
  });

  it('a terceira captura encerra na hora', () => {
    const { ctf, blue } = game();
    for (let i = 0; i < 3; i++) {
      at(blue, 'red');
      ctf.fixedUpdate(1 / 60);
      at(blue, 'blue');
      ctf.fixedUpdate(1 / 60);
    }
    expect(ctf.ended).toBe(true);
    expect(ctf.winner).toBe('blue');
  });

  it('aos 8 minutos desempata por capturas, depois por abates, ou declara empate', () => {
    const byKill = game();
    byKill.ctf.onKilled(byKill.red, byKill.blue);
    byKill.ctf.fixedUpdate(CTF_MATCH_S);
    expect(byKill.ctf.winner).toBe('blue');

    const tie = game();
    tie.ctf.fixedUpdate(CTF_MATCH_S);
    expect(tie.ctf.ended).toBe(true);
    expect(tie.ctf.winner).toBeNull();
  });

  it('portador perde 15% da corrida e recupera ao largar', () => {
    const { ctf, blue } = game();
    at(blue, 'red');
    ctf.fixedUpdate(1 / 60);
    expect(blue.moveSpeedScale).toBe(CTF_CARRIER_SPEED);
    blue.alive = false;
    ctf.onKilled(blue);
    ctf.fixedUpdate(1 / 60);
    expect(blue.moveSpeedScale).toBe(1);
  });

  it('é determinístico para a mesma sequência de posições e ticks', () => {
    const run = () => {
      const { ctf, blue } = game();
      at(blue, 'red');
      ctf.fixedUpdate(1 / 60);
      at(blue, 'blue');
      ctf.fixedUpdate(1 / 60);
      return `${ctf.timeLeft.toFixed(6)}:${ctf.scores.blue.captures}:${ctf.flag('red').phase}`;
    };
    expect(run()).toBe(run());
  });

  it('emite eventos primitivos para HUD e futura rede', () => {
    const pickup = vi.fn();
    const capture = vi.fn();
    const end = vi.fn();
    const ctf = new CaptureTheFlag({ onFlagPickup: pickup, onCapture: capture, onMatchEnd: end });
    const blue = unit(0, 0);
    ctf.register(blue, 'blue');
    for (let i = 0; i < 3; i++) {
      at(blue, 'red');
      ctf.fixedUpdate(1 / 60);
      at(blue, 'blue');
      ctf.fixedUpdate(1 / 60);
    }
    expect(pickup).toHaveBeenCalledTimes(3);
    expect(capture).toHaveBeenCalledTimes(3);
    expect(end).toHaveBeenCalledWith('blue', expect.any(Object), expect.any(Object));
  });
});
