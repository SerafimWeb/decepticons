/**
 * O roteiro de teste do movimento dos Mechs (P321): a mesma sequência de comandos e a mesma integração mínima da posição para a bancada
 * (`npm run mech:movimento`) e para a aba MECHS 3D do Estúdio. Função pura do quadro, a 60 Hz fixos: o mesmo quadro dá o mesmo comando e a
 * mesma rodada dá o mesmo resultado. Sem física (sem Rapier): quem usa chama `render(dt, 1)` do `MechBase`, como o Hangar faz.
 *
 * Fora do pacote de partida: o jogo não importa este módulo (só as duas ferramentas).
 */
export const DT = 1 / 60;
export const DURACAO_S = 9.4;
export const QUADROS = Math.round(DURACAO_S / DT);

export type ModoDeMovimento = 'parado' | 'andar' | 'correr' | 'roteiro';

/** O que o piloto manda neste quadro: velocidade (m/s para a frente), giro (rad/s) e os gestos de um quadro só. */
export interface Comando {
  v: number;
  giro: number;
  pulo: boolean;
  dash: boolean;
  tiro: boolean;
}

/** A posição e a velocidade do Mech no roteiro (o mundo da bancada: o chão é y = 0). */
export interface Estado {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  grounded: boolean;
  /** Segundos de dash que faltam. */
  dash: number;
  /** O quadro do primeiro pouso depois do pulo (-1 enquanto não houve). */
  tPouso: number;
}

/** Os números do chassi que mandam na integração (todos do `MechStats`). */
export interface Fisica {
  readonly groundAccel: number;
  readonly airAccel: number;
  readonly jumpVelocity: number;
  readonly dashSpeed: number;
  readonly dashDuration: number;
}

export const novoEstado = (): Estado => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, grounded: true, dash: 0, tPouso: -1 });

const F = (s: number): number => Math.round(s / DT);
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** O roteiro: parado, arranca e corre, freia, pula, anda virando, dash, tiro, para. `i` é o quadro (0 a `QUADROS`). */
export function comandoDoRoteiro(i: number, vmax: number): Comando {
  const c: Comando = { v: 0, giro: 0, pulo: false, dash: false, tiro: false };
  if (i >= F(0.6) && i < F(4.0)) c.v = vmax;
  if (i === F(5.0)) c.pulo = true;
  if (i >= F(6.6) && i < F(7.3)) c.v = vmax * 0.5;
  if (i >= F(6.8) && i < F(7.3)) c.giro = 1.5;
  if (i === F(7.3)) c.dash = true;
  if (i === F(8.2)) c.tiro = true;
  return c;
}

/** O comando de um modo da prévia: parado, andando (metade da velocidade), correndo, ou o roteiro em laço. */
export function comandoDoModo(modo: ModoDeMovimento, i: number, vmax: number): Comando {
  switch (modo) {
    case 'parado':
      return { v: 0, giro: 0, pulo: false, dash: false, tiro: false };
    case 'andar':
      return { v: vmax * 0.5, giro: 0, pulo: false, dash: false, tiro: false };
    case 'correr':
      return { v: vmax, giro: 0, pulo: false, dash: false, tiro: false };
    case 'roteiro':
      return comandoDoRoteiro(i % QUADROS, vmax);
  }
}

/**
 * Avança um quadro: gira, acelera até a velocidade pedida (com a aceleração do chassi, que no solo é a "Quake": quase sem inércia), pula, cai
 * e pousa, e faz o dash (velocidade fixa por `dashDuration`, como o jogo). `i` é o quadro, só para marcar o pouso. O chamador copia o resultado
 * para o Mech (`velocity`, `grounded`, a posição da raiz e o `dashTimeLeft`).
 */
export function integrar(s: Estado, c: Comando, f: Fisica, gravidade: number, i: number): void {
  s.yaw += c.giro * DT;
  if (c.dash) s.dash = f.dashDuration;
  const fx = -Math.sin(s.yaw);
  const fz = -Math.cos(s.yaw);
  if (s.dash > 0) {
    s.vx = fx * f.dashSpeed;
    s.vz = fz * f.dashSpeed;
    s.dash -= DT;
  } else {
    const acc = (s.grounded ? f.groundAccel : f.airAccel) * DT;
    s.vx += clamp(fx * c.v - s.vx, -acc, acc);
    s.vz += clamp(fz * c.v - s.vz, -acc, acc);
  }
  if (c.pulo && s.grounded) {
    s.vy = f.jumpVelocity;
    s.grounded = false;
  }
  if (!s.grounded) {
    s.vy -= gravidade * DT;
    s.y += s.vy * DT;
    if (s.y <= 0 && s.vy < 0) {
      s.y = 0;
      s.vy = 0;
      s.grounded = true;
      if (s.tPouso < 0) s.tPouso = i;
    }
  }
  s.x += s.vx * DT;
  s.z += s.vz * DT;
}
