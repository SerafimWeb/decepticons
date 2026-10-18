import {
  type PlayReport,
  type PlayGroup,
  type PlaySummary,
  type PlayDay,
  type PlayMapGroup,
  type PlayTotals,
} from "../shared/net/playMetrics";
import { diaDe } from "./telemetria";
/** Os dias de total guardados (o mesmo prazo das contagens por dia da telemetria) e os mapas×modos diferentes. */
const DIAS_TETO = 120;
const MAPAS_TETO = 24;
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const MODOS = ["deathmatch", "survival", "ctf", "dominio"];
const TOTAIS: (keyof PlayTotals)[] = [
  "reports",
  "completed",
  "seconds",
  "kills",
  "deaths",
  "logged",
  "won",
  "lost",
  "waves",
  "waveReports",
];
/** A faixa da duração: menos de 1 min, 1 a 5, 5 a 15, 15 a 30, 30 ou mais. */
export const faixaDeDuracao = (segundos: number): number => (segundos < 60 ? 0 : segundos < 300 ? 1 : segundos < 900 ? 2 : segundos < 1800 ? 3 : 4);
const totaisVazios = (): PlayTotals => ({
  reports: 0,
  completed: 0,
  seconds: 0,
  kills: 0,
  deaths: 0,
  logged: 0,
  won: 0,
  lost: 0,
  waves: 0,
  waveReports: 0,
  dur: [0, 0, 0, 0, 0],
  qual: [0, 0, 0],
});
const totaisValidos = (g: PlayTotals): boolean =>
  TOTAIS.every(
    (k) => typeof g[k] === "number" && Number.isFinite(g[k]) && g[k] >= 0,
  );
/** Arquivos de antes das faixas não as trazem (ou as trazem tortas): voltam a zero, nada quebra. */
const faixasLidas = (v: unknown, n: number): number[] =>
  Array.isArray(v) && v.length === n && v.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0) ? [...(v as number[])] : new Array<number>(n).fill(0);
const comFaixas = <T extends PlayTotals>(g: T): T => ({ ...g, dur: faixasLidas(g.dur, 5), qual: faixasLidas(g.qual, 3) });
/** Soma uma rodada nos totais de um recorte. */
function somar(t: PlayTotals, r: PlayReport, logged: boolean): void {
  t.reports++;
  t.completed += Number(r.outcome === "completed");
  t.seconds += r.seconds;
  t.kills += r.kills;
  t.deaths += r.deaths;
  t.logged += Number(logged);
  if (r.won !== undefined) {
    if (r.won) t.won++;
    else t.lost++;
  }
  if (r.wave !== undefined) {
    t.waves += r.wave;
    t.waveReports++;
  }
  t.dur[faixaDeDuracao(r.seconds)]!++;
  if (r.tier !== undefined) t.qual[r.tier]!++;
}
/** Agrega sem guardar identificadores: até 128 combinações por processo/arquivo, 120 dias e 24 mapas. */
export class PlayMetrics {
  private readonly groups = new Map<string, PlayGroup>();
  private readonly days = new Map<string, PlayDay>();
  private readonly maps = new Map<string, PlayMapGroup>();
  private readonly seen = new Map<string, number>();
  droppedGroups = 0;
  dirty = false;
  /** Este relatório já foi contado (o navegador reenvia quando a rede falha no meio)? */
  jaVisto(id: string): boolean {
    return this.seen.has(id);
  }
  /** `logged`: o relatório veio de uma conta (o servidor viu uma sessão válida); só entra na contagem, nunca no que se guarda. */
  record(r: PlayReport, now = Date.now(), logged = false): boolean {
    for (const [id, t] of this.seen)
      if (now - t > 86400000) this.seen.delete(id);
    if (this.seen.has(r.id)) return false;
    if (this.seen.size >= 4096)
      this.seen.delete(this.seen.keys().next().value!);
    this.seen.set(r.id, now);
    this.somarDia(r, now, logged);
    this.somarMapa(r, logged);
    const key = [r.release, r.mode, r.build, r.assisted, r.online].join("|");
    let g = this.groups.get(key);
    if (!g) {
      if (this.groups.size >= 128) {
        this.droppedGroups++;
        this.dirty = true;
        return false;
      }
      g = {
        release: r.release,
        mode: r.mode,
        build: r.build,
        assisted: r.assisted,
        online: r.online,
        reports: 0,
        completed: 0,
        seconds: 0,
        frames: 0,
        slowFrames: 0,
        kills: 0,
        deaths: 0,
        damage: 0,
        firstKills: 0,
        firstKillSeconds: 0,
      };
      this.groups.set(key, g);
    }
    g.reports++;
    g.completed += Number(r.outcome === "completed");
    g.seconds += r.seconds;
    g.frames += r.frames;
    g.slowFrames += r.slowFrames;
    g.kills += r.kills;
    g.deaths += r.deaths;
    g.damage += r.damage;
    if (r.firstKillS !== null) {
      g.firstKills++;
      g.firstKillSeconds += r.firstKillS;
    }
    this.dirty = true;
    return true;
  }
  private somarDia(r: PlayReport, now: number, logged: boolean): void {
    const day = diaDe(now);
    let d = this.days.get(day);
    if (!d) {
      d = { day, ...totaisVazios() };
      this.days.set(day, d);
      if (this.days.size > DIAS_TETO)
        this.days.delete([...this.days.keys()].sort()[0]!);
    }
    somar(d, r, logged);
    this.dirty = true;
  }
  private somarMapa(r: PlayReport, logged: boolean): void {
    if (r.map === undefined) return;
    const key = r.map + "|" + r.mode;
    let m = this.maps.get(key);
    if (!m) {
      if (this.maps.size >= MAPAS_TETO) return;
      m = { map: r.map, mode: r.mode, ...totaisVazios() };
      this.maps.set(key, m);
    }
    somar(m, r, logged);
    this.dirty = true;
  }
  snapshot(): PlaySummary {
    return {
      groups: [...this.groups.values()].map((g) => ({ ...g })),
      droppedGroups: this.droppedGroups,
      days: [...this.days.values()]
        .sort((a, b) => (a.day < b.day ? -1 : 1))
        .map((d) => ({ ...d })),
      maps: [...this.maps.values()].map((m) => ({ ...m })),
    };
  }
  load(raw: unknown): void {
    if (typeof raw !== "object" || raw === null) return;
    const r = raw as Partial<PlaySummary>;
    if (!Array.isArray(r.groups)) return;
    for (const g of r.groups.slice(0, 128)) {
      if (
        !g ||
        typeof g.release !== "string" ||
        !/^[a-zA-Z0-9.-]{1,40}$/.test(g.release) ||
        typeof g.build !== "string" ||
        g.build.length > 80 ||
        !MODOS.includes(g.mode) ||
        typeof g.assisted !== "boolean" ||
        typeof g.online !== "boolean"
      )
        continue;
      const nums = [
        "reports",
        "completed",
        "seconds",
        "frames",
        "slowFrames",
        "kills",
        "deaths",
        "damage",
        "firstKills",
        "firstKillSeconds",
      ] as const;
      if (
        nums.some(
          (k) => typeof g[k] !== "number" || !Number.isFinite(g[k]) || g[k] < 0,
        )
      )
        continue;
      this.groups.set(
        [g.release, g.mode, g.build, g.assisted, g.online].join("|"),
        { ...g },
      );
    }
    // Arquivos de antes dos totais por dia e por mapa não os trazem: começam do zero (nada quebra).
    if (Array.isArray(r.days))
      for (const d of r.days.slice(-DIAS_TETO)) {
        if (!d || typeof d.day !== "string" || !RE_DIA.test(d.day)) continue;
        if (!totaisValidos(d)) continue;
        this.days.set(d.day, comFaixas(d));
      }
    if (Array.isArray(r.maps))
      for (const m of r.maps.slice(0, MAPAS_TETO)) {
        if (
          !m ||
          typeof m.map !== "string" ||
          !/^[a-z0-9-]{1,16}$/.test(m.map) ||
          !MODOS.includes(m.mode) ||
          !totaisValidos(m)
        )
          continue;
        this.maps.set(m.map + "|" + m.mode, comFaixas(m));
      }
    this.droppedGroups =
      typeof r.droppedGroups === "number" && Number.isFinite(r.droppedGroups)
        ? Math.max(0, r.droppedGroups)
        : 0;
  }
}
