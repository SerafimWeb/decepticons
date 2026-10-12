import { runnerImport } from "vite";
import { resolve } from "node:path";
import { fork, execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { cpus } from "node:os";
import { WebSocket } from "ws";
mkdirSync(".tmp", { recursive: true });
writeFileSync(
  ".tmp/capacity-contract.ts",
  "export { startServer } from '../server/Server';\nexport { ArenaRoom } from '../server/ArenaRoom';\nexport { Writer } from '../shared/net/codec';\nexport { PROTOCOL_VERSION } from '../shared/net/constants';\nexport * from '../shared/net/messages';\nexport { newNetInput } from '../shared/net/input';\n",
);
const seconds = Number(
  process.argv.find((x) => x.startsWith("--seconds="))?.split("=")[1] ?? 30,
);
if (!Number.isFinite(seconds) || seconds < 10 || seconds > 600)
  throw Error("Use --seconds=10..600");
const { module: m } = await runnerImport(resolve(".tmp/capacity-contract.ts"), {
  configFile: false,
  logLevel: "error",
});
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
for (const count of [10, 50, 100]) {
  const child = fork("scripts/capacity-worker.mjs", [], {
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  });
  const next = () =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(Error("worker timeout")), 60000);
      child.once("message", (x) => {
        clearTimeout(t);
        resolve(x);
      });
      child.once("error", reject);
    });
  let timer;
  const clients = [];
  try {
    const { port } = await next();
    for (let i = 0; i < count; i++) {
      await new Promise((resolve, reject) => {
        const ws = new WebSocket("ws://127.0.0.1:" + port + "/?sala=CARGA");
        const p = {
          ws,
          bytes: 0,
          snapshots: 0,
          closed: 0,
          tick: 1,
          w: new m.Writer(),
          inputs: [m.newNetInput(), m.newNetInput()],
        };
        clients.push(p);
        const t = setTimeout(() => reject(Error("join timeout " + i)), 20000);
        ws.on("error", reject);
        ws.on("close", () => p.closed++);
        ws.on("open", () =>
          ws.send(
            m.encodeJoin(p.w, {
              protocol: m.PROTOCOL_VERSION,
              name: "P" + i,
              build:
                i % 2
                  ? "v2.vector09.railgun-0.emp-0.-.frontal"
                  : "v1.vector09.plasma-0.rockets-0",
            }),
          ),
        );
        ws.on("message", (data) => {
          p.bytes += data.length;
          if (data[0] === m.MSG.SNAPSHOT) p.snapshots++;
          if (data[0] === m.MSG.REJECT) reject(Error("join rejected"));
          if (data[0] === m.MSG.WELCOME) {
            clearTimeout(t);
            resolve();
          }
        });
      });
    }
    let n = 0;
    timer = setInterval(() => {
      n++;
      clients.forEach((p, i) => {
        if (p.ws.readyState !== 1) return;
        for (const input of p.inputs) {
          input.tick = p.tick++;
          input.moveX = Math.sin(n / 40 + i);
          input.moveZ = Math.cos(n / 40 + i);
          input.yaw = n / 80 + i;
          input.moveYaw = 0;
          input.pitch = -0.08;
          input.fire = true;
          input.shield = n % 180 < 90;
          input.secondary = n % 90 < 20;
          input.dash = n % 90 === 0;
        }
        p.ws.send(m.encodeInputs(p.w, p.inputs, 2));
      });
    }, 1000 / 30);
    await delay(3000);
    clients.forEach((p) => {
      p.bytes = 0;
      p.snapshots = 0;
      p.closed = 0;
    });
    child.send("start");
    await next();
    const t0 = performance.now();
    await delay(seconds * 1000);
    const dt = (performance.now() - t0) / 1000;
    child.send("stop");
    const { result } = await next();
    result.target = count;
    result.clientSeconds = dt;
    result.snapshotHz = clients.map((p) => p.snapshots / dt);
    result.downloadKBpsPerPlayer =
      clients.reduce((s, p) => s + p.bytes, 0) / dt / count / 1024;
    result.disconnected = clients.reduce((s, p) => s + p.closed, 0);
    results.push(result);
    console.log(
      JSON.stringify({
        target: count,
        rooms: result.rooms,
        tickHzMin: Math.min(...result.tickHz),
        snapshotHzMin: Math.min(...result.snapshotHz),
        cpuCorePercent: result.cpuCorePercent,
        rssMB: result.rssMB,
        disconnected: result.disconnected,
        downloadKBpsPerPlayer: result.downloadKBpsPerPlayer,
      }),
    );
  } finally {
    clearInterval(timer);
    clients.forEach((p) => p.ws.terminate());
    if (child.connected) child.send("close");
    if (child.exitCode === null) await new Promise((r) => child.once("exit", r));
  }
}
writeFileSync(
  ".tmp/capacity-results.json",
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      protocol: m.PROTOCOL_VERSION,
      workingTreeModified: execFileSync("git", ["status", "--porcelain"], {encoding:"utf8"}).trim().length > 0,
      cpu: cpus()[0].model,
      node: process.version,
      secondsPerStage: seconds,
      revision: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      limits:
        "Local WebSocket synthetic input, no browser rendering, no internet latency, no production capacity guarantee",
      results,
    },
    null,
    2,
  ),
);
