import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { expect, it } from "vitest";
import { startServer } from "./Server";
import { METRICAS_HEADER } from "../shared/net/telemetry";

it("relatórios HTTP validam montagem, deduplicam, isolam cheats e persistem agregados", async () => {
  mkdirSync(resolve(".tmp"), { recursive: true });
  const dir = mkdtempSync(resolve(".tmp/play-http-"));
  const options = {
    port: 0,
    host: "127.0.0.1",
    dbContas: ":memory:",
    dirDados: dir,
    metricasToken: "play-test-token-123456789",
  };
  const s = await startServer(options);
  const report = {
    v: 1,
    id: "report-123456",
    release: "test",
    mode: "deathmatch",
    online: false,
    build: "v2.vector09.plasma-0.rockets-0.-.frontal",
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
  const post = (body: unknown) =>
    fetch("http://127.0.0.1:" + s.port + "/partida-metricas", {
      method: "POST",
      body: JSON.stringify(body),
    });
  try {
    expect((await post(report)).status).toBe(204);
    expect((await post(report)).status).toBe(204);
    expect(
      (await post({ ...report, id: "report-654321", assisted: true })).status,
    ).toBe(204);
    expect(
      (
        await post({
          ...report,
          build: "v2.vector09.plasma-0.rockets-0.garbage.frontal",
        })
      ).status,
    ).toBe(400);
    expect((await post({ ...report, slowFrames: 5000 })).status).toBe(400);
    expect((await post({ ...report, padding: "x".repeat(1200) })).status).toBe(
      413,
    );
    expect(
      (await fetch("http://127.0.0.1:" + s.port + "/metricas")).status,
    ).toBe(401);
  } finally {
    await s.close();
  }
  const saved = JSON.parse(readFileSync(join(dir, "partidas.json"), "utf8"));
  expect(saved.groups).toHaveLength(2);
  expect(saved.groups.map((g: { reports: number }) => g.reports)).toEqual([
    1, 1,
  ]);
  expect(JSON.stringify(saved)).not.toContain(report.id);
  const restarted = await startServer(options);
  try {
    const result = await (
      await fetch("http://127.0.0.1:" + restarted.port + "/metricas", {
        headers: { [METRICAS_HEADER]: options.metricasToken },
      })
    ).json();
    expect(result.play).toEqual(saved);
    expect(result.runtime.players).toBe(0);
  } finally {
    await restarted.close();
  }
});
