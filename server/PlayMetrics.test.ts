import { describe, it, expect } from "vitest";
import { PlayMetrics } from "./PlayMetrics";
import { parsePlayReport, type PlayReport } from "../shared/net/playMetrics";
const r: PlayReport = {
  v: 1,
  id: "abcdefgh",
  release: "test",
  mode: "deathmatch",
  online: false,
  build: "v1.vector09.plasma-0.rockets-0",
  assisted: false,
  outcome: "completed",
  seconds: 60,
  frames: 3600,
  slowFrames: 1,
  kills: 2,
  deaths: 1,
  damage: 300,
  firstKillS: 15,
};
describe("relatórios de partida", () => {
  it("recusa dados impossíveis e elimina campos não permitidos", () => {
    expect(parsePlayReport({ ...r, seconds: NaN })).toBeNull();
    expect(parsePlayReport({ ...r, slowFrames: 5000 })).toBeNull();
    expect(parsePlayReport({ ...r, firstKillS: 90 })).toBeNull();
    expect(parsePlayReport({ ...r, email: "private" })).toEqual(r);
  });
  it("deduplica reenvios, separa cheats e persiste apenas agregados", () => {
    const m = new PlayMetrics();
    expect(m.record(r)).toBe(true);
    expect(m.record(r)).toBe(false);
    m.record({ ...r, id: "ijklmnop", assisted: true });
    expect(m.snapshot().groups).toHaveLength(2);
    expect(JSON.stringify(m.snapshot())).not.toContain("abcdefgh");
    const n = new PlayMetrics();
    n.load(m.snapshot());
    expect(n.snapshot()).toEqual(m.snapshot());
  });
});
