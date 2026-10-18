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

describe("o mapa, a onda e o desfecho da rodada (P185)", () => {
  const DIA = Date.parse("2026-10-18T15:00:00Z");
  it("aceita os três campos opcionais, recusa o que for impossível e não inventa o que não veio", () => {
    expect(parsePlayReport({ ...r, map: "amazonia", wave: 7, won: false })).toMatchObject({ map: "amazonia", wave: 7, won: false });
    for (const ruim of [{ map: "Amazonia" }, { map: "a b" }, { map: "x".repeat(17) }, { map: "" }, { map: 5 }, { wave: 1.5 }, { wave: -1 }, { wave: 1000 }, { wave: "3" }, { won: "sim" }, { won: 1 }])
      expect(parsePlayReport({ ...r, ...ruim }), JSON.stringify(ruim)).toBeNull();
    const sem = parsePlayReport(r)!;
    expect("map" in sem || "wave" in sem || "won" in sem).toBe(false); // o navegador antigo continua valendo
  });
  it("soma por dia (de Brasília) e por mapa e modo, separando conta de convidado e vitória de derrota", () => {
    const m = new PlayMetrics();
    m.record({ ...r, id: "rodada-01", map: "amazonia", mode: "survival", wave: 4, won: true }, DIA, true);
    m.record({ ...r, id: "rodada-02", map: "amazonia", mode: "survival", wave: 2, won: false, outcome: "abandoned", seconds: 30, kills: 0, deaths: 3, firstKillS: null }, DIA, false);
    m.record({ ...r, id: "rodada-03", map: "arena" }, DIA, false);
    m.record({ ...r, id: "rodada-04" }, DIA + 86_400_000, true); // sem mapa: entra no dia, não em mapa
    const s = m.snapshot();
    expect(s.days).toHaveLength(2);
    expect(s.days![0]).toMatchObject({ day: "2026-10-18", reports: 3, completed: 2, seconds: 150, kills: 4, deaths: 5, logged: 1, won: 1, lost: 1, waves: 6, waveReports: 2 });
    expect(s.days![1]).toMatchObject({ day: "2026-10-19", reports: 1, logged: 1 });
    expect(s.maps).toHaveLength(2);
    expect(s.maps!.find((g) => g.map === "amazonia" && g.mode === "survival")).toMatchObject({ reports: 2, completed: 1, seconds: 90, logged: 1, won: 1, lost: 1, waves: 6, waveReports: 2 });
    expect(s.maps!.find((g) => g.map === "arena")).toMatchObject({ reports: 1, won: 0, lost: 0, waveReports: 0 });
  });
  it("a rodada repetida não conta de novo em lugar nenhum, e o jaVisto avisa antes", () => {
    const m = new PlayMetrics();
    const x = { ...r, id: "repetida-1", map: "praia" };
    expect(m.jaVisto(x.id)).toBe(false);
    m.record(x, DIA, true);
    expect(m.jaVisto(x.id)).toBe(true);
    m.record(x, DIA, true);
    expect(m.snapshot().days![0]!.reports).toBe(1);
    expect(m.snapshot().maps![0]!.reports).toBe(1);
  });
  it("os tetos: 24 mapas e modos diferentes e 120 dias (o mais velho sai); o que passa do teto do mapa ainda conta no dia", () => {
    const m = new PlayMetrics();
    for (let i = 0; i < 26; i++) m.record({ ...r, id: "mapa-" + String(i).padStart(4, "0"), map: "m" + i }, DIA, false);
    expect(m.snapshot().maps).toHaveLength(24);
    expect(m.snapshot().days![0]!.reports).toBe(26);
    const d = new PlayMetrics();
    for (let i = 0; i < 125; i++) d.record({ ...r, id: "dia-" + String(i).padStart(5, "0") }, DIA + i * 86_400_000, false);
    const dias = d.snapshot().days!;
    expect(dias).toHaveLength(120);
    expect(dias[0]!.day).toBe("2026-10-23"); // os cinco primeiros saíram
  });
  it("o teto das 128 combinações de montagem não esconde a rodada do total do dia nem do mapa", () => {
    const m = new PlayMetrics();
    for (let i = 0; i < 130; i++) m.record({ ...r, id: "teto-" + String(i).padStart(5, "0"), build: "v2.vector09.plasma-0.rockets-0.b" + i, map: "arena" }, DIA, false);
    const s = m.snapshot();
    expect(s.groups).toHaveLength(128);
    expect(s.droppedGroups).toBe(2);
    expect(s.days![0]!.reports).toBe(130);
    expect(s.maps![0]!.reports).toBe(130);
  });
  it("salva e recarrega tudo igual; arquivo de antes dos totais carrega sem quebrar; entrada torta é descartada", () => {
    const m = new PlayMetrics();
    m.record({ ...r, id: "salvar-01", map: "arena", wave: 3 }, DIA, true);
    const n = new PlayMetrics();
    n.load(JSON.parse(JSON.stringify(m.snapshot())));
    expect(n.snapshot()).toEqual(m.snapshot());
    const antigo = new PlayMetrics();
    antigo.load({ groups: m.snapshot().groups, droppedGroups: 0 }); // o arquivo de antes: sem days nem maps
    expect(antigo.snapshot().days).toEqual([]);
    expect(antigo.snapshot().maps).toEqual([]);
    expect(antigo.snapshot().groups).toHaveLength(1);
    const torto = new PlayMetrics();
    const s = m.snapshot();
    torto.load({
      groups: s.groups,
      droppedGroups: 0,
      days: [{ ...s.days![0], day: "ontem" }, { ...s.days![0], seconds: -5 }, null, { ...s.days![0], day: "2026-10-01" }],
      maps: [{ ...s.maps![0], map: "Ruim Demais" }, { ...s.maps![0], mode: "golf" }, { ...s.maps![0], kills: NaN }, s.maps![0]],
    });
    expect(torto.snapshot().days!.map((d) => d.day)).toEqual(["2026-10-01"]);
    expect(torto.snapshot().maps).toHaveLength(1);
  });
});
