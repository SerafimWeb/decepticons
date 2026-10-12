/** Observabilidade leve: contadores locais, sem payload por frame nem SDK no combate. */
export const SERAFIM_ERROR_ENDPOINT =
  "https://ihebiuxobusmbflliiwn.supabase.co/functions/v1/sinal-erro";
export function scrub(value: string): string {
  return value
    .replace(/https?:\/\/[^\s)]+/g, (u) => {
      try {
        const x = new URL(u);
        return x.origin + x.pathname;
      } catch {
        return "[url]";
      }
    })
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .slice(0, 4000);
}
export class Diagnostics {
  private readonly bins = new Uint32Array(101);
  frames = 0;
  slowFrames = 0;
  activeMs = 0;
  bootMs = 0;
  errors = 0;
  contextLosses = 0;
  private lastErrorAt = -Infinity;
  private sent = 0;
  constructor(
    readonly release: string,
    private readonly send?: (body: unknown) => void,
  ) {}
  frame(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.frames++;
    this.activeMs += ms;
    if (ms > 33.34) this.slowFrames++;
    this.bins[Math.min(100, Math.ceil(ms))]!++;
  }
  snapshot(): {
    release: string;
    bootMs: number;
    activeSeconds: number;
    frames: number;
    slowFrames: number;
    frameP95Ms: number;
    errors: number;
    contextLosses: number;
  } {
    let sum = 0,
      p95 = 0;
    for (let i = 0; i < this.bins.length; i++) {
      sum += this.bins[i]!;
      if (sum >= this.frames * 0.95) {
        p95 = i;
        break;
      }
    }
    return {
      release: this.release,
      bootMs: Math.round(this.bootMs),
      activeSeconds: Math.round(this.activeMs / 1000),
      frames: this.frames,
      slowFrames: this.slowFrames,
      frameP95Ms: p95,
      errors: this.errors,
      contextLosses: this.contextLosses,
    };
  }
  error(err: unknown, origin: string, now = performance.now()): void {
    this.errors++;
    if (this.sent >= 20 || now - this.lastErrorAt < 1000) return;
    this.lastErrorAt = now;
    this.sent++;
    try {
      this.send?.({
        project: "cybermech",
        origin,
        severity: origin === "boot" ? "fatal" : "error",
        message: scrub(err instanceof Error ? err.message : String(err)),
        stack: err instanceof Error ? scrub(err.stack ?? "") : undefined,
        path: "/cybermech/jogar/",
        metadata: this.snapshot(),
      });
    } catch {
      /* Instrumentação nunca interrompe o jogo. */
    }
  }
}
