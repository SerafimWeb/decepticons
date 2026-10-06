import { describe, it, expect } from "vitest";
import { Diagnostics, scrub } from "./Diagnostics";
describe("diagnóstico do jogador", () => {
  it("mede quadros lentos e percentil sem confundir pausa com jogo", () => {
    const d = new Diagnostics("test");
    for (let i = 0; i < 95; i++) d.frame(16);
    for (let i = 0; i < 5; i++) d.frame(80);
    expect(d.snapshot()).toMatchObject({
      frames: 100,
      slowFrames: 5,
      frameP95Ms: 16,
    });
    d.frame(NaN);
    expect(d.frames).toBe(100);
  });
  it("remove query/fragmento e email antes de federar e limita tempestades de erro", () => {
    const out: unknown[] = [];
    const d = new Diagnostics("abc", (x) => out.push(x));
    for (let i = 0; i < 100; i++)
      d.error(
        new Error("https://game.test/a.js?token=secret#name mail@host.com"),
        "window",
        i * 1001,
      );
    expect(out).toHaveLength(20);
    expect(JSON.stringify(out)).not.toContain("secret");
    expect(JSON.stringify(out)).not.toContain("mail@host.com");
    expect(scrub("https://game.test/a.js?token=secret")).toBe(
      "https://game.test/a.js",
    );
  });
});
