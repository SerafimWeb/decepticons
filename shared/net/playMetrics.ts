/** Resumo de uma rodada, declarado pelo cliente. Nunca autoridade de placar/recompensa. */
export const PLAY_PATH = "/partida-metricas";
export interface PlayReport {
  v: 1;
  id: string;
  release: string;
  mode: "deathmatch" | "survival" | "ctf" | "dominio";
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
  /** O mapa jogado (P185). Opcional: o navegador antigo não manda. */
  map?: string;
  /** A onda mais alta que a rodada alcançou (missões e Sobrevivência). */
  wave?: number;
  /** A missão terminou em vitória (true) ou em derrota (false); ausente nos modos sem esse desfecho. */
  won?: boolean;
  /** O degrau da qualidade gráfica em que a rodada terminou: 0 = a mais alta; 2 = a mais baixa (o jogo rebaixa sozinho quando o aparelho não aguenta, G12). */
  tier?: 0 | 1 | 2;
}
const MAP_RE = /^[a-z0-9-]{1,16}$/;
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
    !["deathmatch", "survival", "ctf", "dominio"].includes(String(r.mode)) ||
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
  if (r.map !== undefined && (typeof r.map !== "string" || !MAP_RE.test(r.map)))
    return null;
  if (
    r.wave !== undefined &&
    (typeof r.wave !== "number" ||
      !Number.isInteger(r.wave) ||
      r.wave < 0 ||
      r.wave > 999)
  )
    return null;
  if (r.won !== undefined && typeof r.won !== "boolean") return null;
  if (r.tier !== undefined && r.tier !== 0 && r.tier !== 1 && r.tier !== 2) return null;
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
    ...(r.map !== undefined ? { map: r.map as string } : {}),
    ...(r.wave !== undefined ? { wave: r.wave as number } : {}),
    ...(r.won !== undefined ? { won: r.won as boolean } : {}),
    ...(r.tier !== undefined ? { tier: r.tier as 0 | 1 | 2 } : {}),
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
/** Os totais de um recorte (um dia, um mapa): só contagens, nenhuma identificação. */
export interface PlayTotals {
  reports: number;
  completed: number;
  seconds: number;
  kills: number;
  deaths: number;
  /** Quantos relatórios vieram de uma conta (com a sessão); os outros são de convidados. */
  logged: number;
  won: number;
  lost: number;
  /** Soma das ondas alcançadas e de quantos relatórios a trazem (a média é a divisão). */
  waves: number;
  waveReports: number;
  /** Rodadas por duração: menos de 1 min, 1 a 5, 5 a 15, 15 a 30, 30 ou mais. */
  dur: number[];
  /** Rodadas por degrau de qualidade ao terminar: alta, média, baixa (só as que informaram). */
  qual: number[];
}
export interface PlayDay extends PlayTotals {
  day: string;
}
export interface PlayMapGroup extends PlayTotals {
  map: string;
  mode: string;
}
export interface PlaySummary {
  groups: PlayGroup[];
  droppedGroups: number;
  /** O total por dia (horário de Brasília, os últimos 120): quanto se joga por dia, com e sem conta. */
  days?: PlayDay[];
  /** O total por mapa e modo (até 24): onde se joga, onde se vence, até que onda se chega. */
  maps?: PlayMapGroup[];
}
