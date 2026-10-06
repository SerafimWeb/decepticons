/** Resumo de uma rodada, declarado pelo cliente. Nunca autoridade de placar/recompensa. */
export const PLAY_PATH = "/partida-metricas";
export interface PlayReport {
  v: 1;
  id: string;
  release: string;
  mode: "deathmatch" | "survival" | "ctf";
  online: boolean;
  build: string;
  assisted: boolean;
  outcome: "completed" | "abandoned";
  seconds: number;
  frames: number;
  slowFrames: number;
  kills: number;
  deaths: number;
  damage: number;
  firstKillS: number | null;
}
export function parsePlayReport(raw: unknown): PlayReport | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (
    r.v !== 1 ||
    typeof r.id !== "string" ||
    !/^[a-zA-Z0-9-]{8,40}$/.test(r.id) ||
    typeof r.release !== "string" ||
    !/^[a-zA-Z0-9.-]{1,40}$/.test(r.release) ||
    typeof r.build !== "string" ||
    r.build.length > 80 ||
    !/^[a-zA-Z0-9.-]+$/.test(r.build) ||
    !["deathmatch", "survival", "ctf"].includes(String(r.mode)) ||
    !["completed", "abandoned"].includes(String(r.outcome)) ||
    typeof r.online !== "boolean" ||
    typeof r.assisted !== "boolean"
  )
    return null;
  for (const key of [
    "seconds",
    "frames",
    "slowFrames",
    "kills",
    "deaths",
    "damage",
  ]) {
    const n = r[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1e8)
      return null;
  }
  if (
    (r.seconds as number) > 86400 ||
    (r.slowFrames as number) > (r.frames as number)
  )
    return null;
  if (
    r.firstKillS !== null &&
    (typeof r.firstKillS !== "number" ||
      !Number.isFinite(r.firstKillS) ||
      r.firstKillS < 0 ||
      r.firstKillS > (r.seconds as number) + 1)
  )
    return null;
  return {
    v: 1,
    id: r.id,
    release: r.release,
    mode: r.mode as PlayReport["mode"],
    online: r.online,
    build: r.build,
    assisted: r.assisted,
    outcome: r.outcome as PlayReport["outcome"],
    seconds: r.seconds as number,
    frames: r.frames as number,
    slowFrames: r.slowFrames as number,
    kills: r.kills as number,
    deaths: r.deaths as number,
    damage: r.damage as number,
    firstKillS: r.firstKillS as number | null,
  };
}
export interface PlayGroup {
  release: string;
  mode: string;
  build: string;
  assisted: boolean;
  online: boolean;
  reports: number;
  completed: number;
  seconds: number;
  frames: number;
  slowFrames: number;
  kills: number;
  deaths: number;
  damage: number;
  firstKills: number;
  firstKillSeconds: number;
}
export interface PlaySummary {
  groups: PlayGroup[];
  droppedGroups: number;
}
