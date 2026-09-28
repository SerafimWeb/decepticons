export type CtfTeam = 'blue' | 'red';
export type CtfFlagPhase = 'home' | 'carried' | 'dropped';

export const CTF_MATCH_S = 480;
export const CTF_CAPTURE_LIMIT = 3;
export const CTF_FLAG_RETURN_S = 15;
export const CTF_PICKUP_RADIUS = 3;
export const CTF_BASE_RADIUS = 7;
export const CTF_CARRIER_SPEED = 0.85;
export const CTF_BASES = {
  blue: { x: -75, z: 75 },
  red: { x: 75, z: -75 },
} as const;

export interface CtfUnit {
  readonly alive: boolean;
  readonly simPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly stats: { readonly height: number };
  moveSpeedScale: number;
}

export interface CtfFlag {
  readonly owner: CtfTeam;
  phase: CtfFlagPhase;
  carrier: CtfUnit | null;
  x: number;
  z: number;
  returnLeft: number;
}

export interface CtfScore {
  captures: number;
  kills: number;
}

export interface CtfCallbacks {
  onFlagPickup?(owner: CtfTeam, carrierTeam: CtfTeam): void;
  onFlagDrop?(owner: CtfTeam, x: number, z: number): void;
  onFlagReturn?(owner: CtfTeam): void;
  onCapture?(team: CtfTeam, blue: number, red: number): void;
  onProgress?(timeLeft: number, blue: Readonly<CtfScore>, red: Readonly<CtfScore>): void;
  onMatchEnd?(winner: CtfTeam | null, blue: Readonly<CtfScore>, red: Readonly<CtfScore>): void;
}

interface Entry {
  readonly unit: CtfUnit;
  readonly team: CtfTeam;
}

const TEAMS: readonly CtfTeam[] = ['blue', 'red'];
const near = (unit: CtfUnit, x: number, z: number, radius: number): boolean => {
  const dx = unit.simPosition.x - x;
  const dz = unit.simPosition.z - z;
  return dx * dx + dz * dz <= radius * radius;
};

/**
 * Regra pura do CTF. São duas bandeiras e uma lista curta de unidades; por tick, no máximo dois
 * testes de raio por unidade. Não cria física, não lê DOM/relógio e não aloca no tick.
 */
export class CaptureTheFlag {
  readonly flags: Record<CtfTeam, CtfFlag> = {
    blue: { owner: 'blue', phase: 'home', carrier: null, x: CTF_BASES.blue.x, z: CTF_BASES.blue.z, returnLeft: 0 },
    red: { owner: 'red', phase: 'home', carrier: null, x: CTF_BASES.red.x, z: CTF_BASES.red.z, returnLeft: 0 },
  };
  readonly scores: Record<CtfTeam, CtfScore> = {
    blue: { captures: 0, kills: 0 },
    red: { captures: 0, kills: 0 },
  };
  timeLeft = CTF_MATCH_S;
  winner: CtfTeam | null = null;
  ended = false;
  private progressLeft = 0;
  private readonly units: Entry[] = [];

  constructor(private readonly callbacks: CtfCallbacks = {}) {}

  register(unit: CtfUnit, team: CtfTeam): void {
    if (this.units.some((entry) => entry.unit === unit)) throw new Error('Unidade já registrada no CTF');
    this.units.push({ unit, team });
  }

  unregister(unit: CtfUnit): void {
    this.dropCarriedBy(unit);
    const index = this.units.findIndex((entry) => entry.unit === unit);
    if (index >= 0) this.units.splice(index, 1);
    unit.moveSpeedScale = 1;
  }

  teamOf(unit: CtfUnit): CtfTeam | undefined {
    return this.units.find((entry) => entry.unit === unit)?.team;
  }

  flag(owner: CtfTeam): Readonly<CtfFlag> {
    return this.flags[owner];
  }

  flagPosition(owner: CtfTeam, out: { x: number; y: number; z: number }): void {
    const flag = this.flags[owner];
    if (flag.carrier) {
      out.x = flag.carrier.simPosition.x;
      out.y = flag.carrier.simPosition.y + flag.carrier.stats.height * 0.82;
      out.z = flag.carrier.simPosition.z;
    } else {
      out.x = flag.x;
      out.y = 0;
      out.z = flag.z;
    }
  }

  fixedUpdate(dt: number): void {
    if (this.ended) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    for (const entry of this.units) entry.unit.moveSpeedScale = 1;
    for (const team of TEAMS) {
      const carrier = this.flags[team].carrier;
      if (carrier?.alive) carrier.moveSpeedScale = CTF_CARRIER_SPEED;
    }

    for (const owner of TEAMS) this.updateFlag(this.flags[owner], dt);
    if (this.timeLeft <= 0) {
      this.finish(this.timeoutWinner());
      return;
    }
    this.progressLeft -= dt;
    if (this.progressLeft <= 0) {
      this.progressLeft = 0.2;
      this.callbacks.onProgress?.(this.timeLeft, this.scores.blue, this.scores.red);
    }
  }

  onKilled(dead: CtfUnit, killer?: CtfUnit): void {
    this.dropCarriedBy(dead);
    const deadTeam = this.teamOf(dead);
    const killerTeam = killer ? this.teamOf(killer) : undefined;
    if (killerTeam && deadTeam && killerTeam !== deadTeam) this.scores[killerTeam].kills++;
  }

  reset(): void {
    this.timeLeft = CTF_MATCH_S;
    this.winner = null;
    this.ended = false;
    this.progressLeft = 0;
    this.scores.blue.captures = this.scores.blue.kills = 0;
    this.scores.red.captures = this.scores.red.kills = 0;
    for (const entry of this.units) entry.unit.moveSpeedScale = 1;
    this.returnHome('blue', false);
    this.returnHome('red', false);
    this.callbacks.onProgress?.(this.timeLeft, this.scores.blue, this.scores.red);
  }

  private updateFlag(flag: CtfFlag, dt: number): void {
    if (flag.phase === 'carried') {
      const carrier = flag.carrier;
      if (!carrier?.alive) {
        if (carrier) this.drop(flag, carrier.simPosition.x, carrier.simPosition.z);
        return;
      }
      const carrierTeam = this.teamOf(carrier);
      if (carrierTeam && carrierTeam !== flag.owner && this.flags[carrierTeam].phase === 'home') {
        const base = CTF_BASES[carrierTeam];
        if (near(carrier, base.x, base.z, CTF_BASE_RADIUS)) this.capture(carrierTeam);
      }
      return;
    }

    if (flag.phase === 'dropped') {
      flag.returnLeft -= dt;
      if (flag.returnLeft <= 0) {
        this.returnHome(flag.owner, true);
        return;
      }
      // O defensor tem prioridade no mesmo tick: tocar a própria bandeira devolve-a.
      for (const entry of this.units) {
        if (entry.team === flag.owner && entry.unit.alive && near(entry.unit, flag.x, flag.z, CTF_PICKUP_RADIUS)) {
          this.returnHome(flag.owner, true);
          return;
        }
      }
    }

    for (const entry of this.units) {
      if (entry.team === flag.owner || !entry.unit.alive || this.carriedFlagOf(entry.unit)) continue;
      if (near(entry.unit, flag.x, flag.z, CTF_PICKUP_RADIUS)) {
        flag.phase = 'carried';
        flag.carrier = entry.unit;
        flag.returnLeft = 0;
        entry.unit.moveSpeedScale = CTF_CARRIER_SPEED;
        this.callbacks.onFlagPickup?.(flag.owner, entry.team);
        return;
      }
    }
  }

  private carriedFlagOf(unit: CtfUnit): CtfFlag | null {
    for (const team of TEAMS) if (this.flags[team].carrier === unit) return this.flags[team];
    return null;
  }

  private dropCarriedBy(unit: CtfUnit): void {
    const flag = this.carriedFlagOf(unit);
    if (flag) this.drop(flag, unit.simPosition.x, unit.simPosition.z);
  }

  private drop(flag: CtfFlag, x: number, z: number): void {
    flag.phase = 'dropped';
    flag.carrier = null;
    flag.x = x;
    flag.z = z;
    flag.returnLeft = CTF_FLAG_RETURN_S;
    this.callbacks.onFlagDrop?.(flag.owner, x, z);
  }

  private returnHome(owner: CtfTeam, announce: boolean): void {
    const flag = this.flags[owner];
    const base = CTF_BASES[owner];
    if (flag.carrier) flag.carrier.moveSpeedScale = 1;
    flag.phase = 'home';
    flag.carrier = null;
    flag.x = base.x;
    flag.z = base.z;
    flag.returnLeft = 0;
    if (announce) this.callbacks.onFlagReturn?.(owner);
  }

  private capture(team: CtfTeam): void {
    this.scores[team].captures++;
    this.returnHome('blue', false);
    this.returnHome('red', false);
    this.callbacks.onCapture?.(team, this.scores.blue.captures, this.scores.red.captures);
    if (this.scores[team].captures >= CTF_CAPTURE_LIMIT) this.finish(team);
  }

  private timeoutWinner(): CtfTeam | null {
    const blue = this.scores.blue;
    const red = this.scores.red;
    if (blue.captures !== red.captures) return blue.captures > red.captures ? 'blue' : 'red';
    if (blue.kills !== red.kills) return blue.kills > red.kills ? 'blue' : 'red';
    return null;
  }

  private finish(winner: CtfTeam | null): void {
    if (this.ended) return;
    this.ended = true;
    this.winner = winner;
    for (const entry of this.units) entry.unit.moveSpeedScale = 1;
    this.callbacks.onProgress?.(this.timeLeft, this.scores.blue, this.scores.red);
    this.callbacks.onMatchEnd?.(winner, this.scores.blue, this.scores.red);
  }
}
