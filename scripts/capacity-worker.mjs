import { runnerImport } from "vite";
import { resolve } from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
const { module: m } = await runnerImport(resolve(".tmp/capacity-contract.ts"), {
  configFile: false,
  logLevel: "error",
});
const samples = [];
let measuring = false;
const step = m.ArenaRoom.prototype.step;
m.ArenaRoom.prototype.step = function () {
  const t = performance.now();
  step.call(this);
  if (measuring && samples.length < 200000) samples.push(performance.now() - t);
};
const server = await m.startServer({
  port: 0,
  host: "127.0.0.1",
  dbContas: ":memory:",
  guard: { perIp: 110 },
});
const loop = monitorEventLoopDelay({ resolution: 10 });
let cpu, t0, ticks;
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0;
process.on("message", async (msg) => {
  if (msg === "start") {
    samples.length = 0;
    loop.reset();
    loop.enable();
    cpu = process.cpuUsage();
    t0 = performance.now();
    ticks = new Map([...server.rooms].map(([k, r]) => [k, r.tick]));
    measuring = true;
    process.send({ started: true });
  } else if (msg === "stop") {
    measuring = false;
    const seconds = (performance.now() - t0) / 1000,
      c = process.cpuUsage(cpu);
    loop.disable();
    samples.sort((a, b) => a - b);
    process.send({
      result: {
        seconds,
        rooms: server.rooms.size,
        players: [...server.rooms.values()].reduce(
          (s, r) => s + r.humanCount,
          0,
        ),
        tickHz: [...server.rooms].map(
          ([k, r]) => (r.tick - (ticks.get(k) ?? r.tick)) / seconds,
        ),
        roomTickMsP95: q(samples, 0.95),
        roomTickMsP99: q(samples, 0.99),
        eventLoopMsP99: loop.percentile(99) / 1e6,
        cpuCorePercent: (c.user + c.system) / (seconds * 1e4),
        rssMB: process.memoryUsage().rss / 1048576,
        guard: server.guard,
      },
    });
  } else if (msg === "close") {
    await server.close();
    process.exit(0);
  }
});
process.send({ port: server.port });
