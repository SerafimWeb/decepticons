import type { MechBase } from '../entities/MechBase';

export const ROUND_S = 300;
export const INTERMISSION_S = 10;

export interface Standing {
  readonly mech: MechBase;
  readonly name: string;
  kills: number;
  deaths: number;
}

/** 'ended': acabou o tempo, começa o intervalo. 'started': acabou o intervalo, rodada nova zerada. */
export type RoundEvent = 'ended' | 'started' | null;

/**
 * Rodada de todos contra todos: 5 min valendo abates, placar, 10 s de intervalo e recomeço.
 * Pura e determinística: só avança pelo tick fixo (pausa congela o relógio) e não sabe de tela,
 * então o servidor vai rodar a mesma. Quem executa o recomeço (renascer, restaurar a arena) é o Game.
 */
export class Round {
  number = 1;
  phase: 'playing' | 'intermission' = 'playing';
  timeLeft: number;
  private readonly rows: Standing[] = [];

  constructor(
    private readonly durationS = ROUND_S,
    private readonly intermissionS = INTERMISSION_S,
  ) {
    this.timeLeft = durationS;
  }

  get playing(): boolean {
    return this.phase === 'playing';
  }

  register(mech: MechBase, name: string): void {
    this.rows.push({ mech, name, kills: 0, deaths: 0 });
  }

  /** Sai do placar (jogador que saiu da sala). */
  unregister(mech: MechBase): void {
    const i = this.rows.findIndex((r) => r.mech === mech);
    if (i >= 0) this.rows.splice(i, 1);
  }

  scoreOf(mech: MechBase): Readonly<Standing> | undefined {
    return this.rows.find((r) => r.mech === mech);
  }

  /** Morte para quem caiu; abate para quem deu o tiro final, se foi outro Mech. No intervalo nada conta. */
  recordKill(dead: MechBase, killer?: MechBase): void {
    if (!this.playing) return;
    const d = this.rows.find((r) => r.mech === dead);
    if (d) d.deaths++;
    if (!killer || killer === dead) return;
    const k = this.rows.find((r) => r.mech === killer);
    if (k) k.kills++;
  }

  /** Placar: mais abates primeiro; empate, menos mortes; depois a ordem de entrada. */
  standings(): readonly Readonly<Standing>[] {
    return [...this.rows].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  fixedUpdate(dt: number): RoundEvent {
    this.timeLeft -= dt;
    if (this.timeLeft > 0) return null;
    if (this.phase === 'playing') {
      this.phase = 'intermission';
      this.timeLeft = this.intermissionS;
      return 'ended';
    }
    this.phase = 'playing';
    this.timeLeft = this.durationS;
    this.number++;
    for (const r of this.rows) r.kills = r.deaths = 0;
    return 'started';
  }
}
