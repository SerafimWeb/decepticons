import {
  PLAY_PATH,
  parsePlayReport,
  type PlayReport,
} from "../../../shared/net/playMetrics";
import { serverHttpUrl } from "../../../shared/net/serverUrl";
const KEY = "cybermech.playtests.v1";
const QUEUE = "cybermech.playtests.pending.v1";
type Context = Pick<PlayReport, "mode" | "online" | "build" | "release"> & {
  assisted?: boolean;
};
type Pending = { at: number; report: PlayReport };
/** Só acumula números durante jogo; serialização/envio ao fechar rodada, fora da simulação. */
export class PlayTelemetry {
  private started: Context | null = null;
  private seconds = 0;
  private frames = 0;
  private slowFrames = 0;
  private kills = 0;
  private deaths = 0;
  private damage = 0;
  private firstKillS: number | null = null;
  private assisted = false;
  private running = false;
  private flushing = false;
  private readonly url: string | null;
  private readonly pending: Pending[] = [];
  constructor(
    server: string | undefined,
    private readonly context: () => Context,
  ) {
    this.url = serverHttpUrl(server, PLAY_PATH);
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(QUEUE) ?? "[]");
      if (Array.isArray(raw))
        for (const x of raw.slice(-12)) {
          const report = parsePlayReport(x?.report);
          if (
            report &&
            typeof x.at === "number" &&
            Date.now() - x.at < 86400000
          )
            this.pending.push({ at: x.at, report });
        }
    } catch {}
    window.addEventListener("pagehide", () => this.finish("abandoned"));
    window.addEventListener("online", () => void this.flush());
    window.setInterval(() => void this.flush(), 30000);
  }
  frame(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0 || ms > 60000) return;
    if (!this.running) {
      this.started = this.context();
      this.assisted ||= this.started.assisted ?? false;
    }
    this.running = true;
    this.seconds += ms / 1000;
    this.frames++;
    if (ms > 33.34) this.slowFrames++;
  }
  kill(): void {
    this.kills++;
    if (this.firstKillS === null) this.firstKillS = this.seconds;
  }
  death(): void {
    this.deaths++;
  }
  hit(amount: number): void {
    this.damage += amount;
  }
  cheat(): void {
    this.assisted = true;
  }
  finish(outcome: PlayReport["outcome"]): void {
    if (!this.running) return;
    const report: PlayReport = {
      v: 1,
      id: crypto.randomUUID(),
      ...this.started!,
      assisted: this.assisted,
      outcome,
      seconds: Math.round(this.seconds),
      frames: this.frames,
      slowFrames: this.slowFrames,
      kills: this.kills,
      deaths: this.deaths,
      damage: Math.round(this.damage),
      firstKillS: this.firstKillS === null ? null : Math.round(this.firstKillS),
    };
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      const history = Array.isArray(raw) ? raw.slice(-19) : [];
      history.push(report);
      localStorage.setItem(KEY, JSON.stringify(history));
    } catch {}
    this.pending.push({ at: Date.now(), report });
    if (this.pending.length > 12) this.pending.shift();
    this.save();
    this.running = false;
    this.started = null;
    this.seconds =
      this.frames =
      this.slowFrames =
      this.kills =
      this.deaths =
      this.damage =
        0;
    this.firstKillS = null;
    this.assisted = false;
    void this.flush();
  }
  private save(): void {
    try {
      localStorage.setItem(QUEUE, JSON.stringify(this.pending));
    } catch {}
  }
  async flush(): Promise<void> {
    if (!this.url || this.flushing || !this.pending.length) return;
    this.flushing = true;
    try {
      while (this.pending.length) {
        const p = this.pending[0]!;
        if (Date.now() - p.at > 86400000) {
          this.pending.shift();
          continue;
        }
        const r = await fetch(this.url, {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: JSON.stringify(p.report),
          keepalive: true,
          signal: AbortSignal.timeout(3000),
        });
        if (!r.ok) break;
        this.pending.shift();
        this.save();
      }
    } catch {
    } finally {
      this.flushing = false;
      this.save();
    }
  }
}
