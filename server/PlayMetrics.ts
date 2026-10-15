import {
  type PlayReport,
  type PlayGroup,
  type PlaySummary,
} from "../shared/net/playMetrics";
/** Agrega sem guardar identificadores: até 128 combinações por processo/arquivo. */
export class PlayMetrics {
  private readonly groups = new Map<string, PlayGroup>();
  private readonly seen = new Map<string, number>();
  droppedGroups = 0;
  dirty = false;
  record(r: PlayReport, now = Date.now()): boolean {
    for (const [id, t] of this.seen)
      if (now - t > 86400000) this.seen.delete(id);
    if (this.seen.has(r.id)) return false;
    if (this.seen.size >= 4096)
      this.seen.delete(this.seen.keys().next().value!);
    this.seen.set(r.id, now);
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
  snapshot(): PlaySummary {
    return {
      groups: [...this.groups.values()].map((g) => ({ ...g })),
      droppedGroups: this.droppedGroups,
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
        !["deathmatch", "survival", "ctf", "dominio"].includes(g.mode) ||
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
    this.droppedGroups =
      typeof r.droppedGroups === "number" && Number.isFinite(r.droppedGroups)
        ? Math.max(0, r.droppedGroups)
        : 0;
  }
}
