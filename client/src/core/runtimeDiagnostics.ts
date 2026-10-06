import { Diagnostics, SERAFIM_ERROR_ENDPOINT } from "./Diagnostics";
declare const __CYBERMECH_REVISION__: string;
export const runtimeDiagnostics = new Diagnostics(
  typeof __CYBERMECH_REVISION__ === "undefined"
    ? "local"
    : __CYBERMECH_REVISION__,
  (body) => {
    if (!["www.selvamkt.com.br", "selvamkt.com.br"].includes(location.hostname))
      return;
    void fetch(SERAFIM_ERROR_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "omit",
      body: JSON.stringify(body),
      keepalive: true,
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  },
);
export function installDiagnostics(): void {
  window.addEventListener("error", (e) =>
    runtimeDiagnostics.error(e.error ?? e.message, "window"),
  );
  window.addEventListener("unhandledrejection", (e) =>
    runtimeDiagnostics.error(e.reason, "promise"),
  );
  window.addEventListener(
    "webglcontextlost",
    () => {
      runtimeDiagnostics.contextLosses++;
      runtimeDiagnostics.error("WebGL context lost", "webgl");
    },
    true,
  );
  const panel = document.getElementById("debug-panel");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "EXPORTAR DIAGNÓSTICO";
  button.title = "Baixar medições locais e últimas rodadas, sem nome ou conta";
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    let rounds: unknown = [];
    try {
      rounds = JSON.parse(
        localStorage.getItem("cybermech.playtests.v1") ?? "[]",
      );
    } catch {}
    const blob = new Blob(
      [
        JSON.stringify(
          { runtime: runtimeDiagnostics.snapshot(), rounds },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cybermech-diagnostico.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  button.className = "diagnostics-export";
  panel?.append(button);
}
