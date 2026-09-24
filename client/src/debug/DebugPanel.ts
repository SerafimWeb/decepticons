import type * as THREE from 'three';

const $ = (id: string) => document.getElementById(id)!;

/** Degraus da qualidade adaptativa (Quality.ts), na ordem em que entram. */
const TIER_LABEL: readonly string[] = ['ALTA', 'MÉDIA (pixel 1.0)', 'BAIXA (sem bloom)'];
/** O painel não pode pesar no que mede: texto 5×/s, não por frame. */
const REFRESH_S = 0.2;

/** Heap do JS: só o Chrome expõe (API não padrão). */
interface ChromePerformance extends Performance {
  memory?: { usedJSHeapSize: number };
}

function block(parent: HTMLElement, className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  parent.append(el);
  return el;
}

/**
 * Painel de desempenho. Compacto por padrão (FPS, tempo de tick, draw calls); a tecla ' abre o
 * modo detalhado, com qualidade adaptativa, triângulos e memória de GPU e do JS, no visual de
 * terminal do design system Serafim.
 */
export class DebugPanel {
  private readonly panel = $('debug-panel');
  private readonly head = block(this.panel, 'dp-head');
  private readonly fpsLine = block(this.panel, 'dp-fps');
  private readonly coreLines = block(this.panel, 'dp-lines');
  private readonly moreLines = block(this.panel, 'dp-lines');
  private fps = 60;
  private textTimer = 0;
  private detailed = false;

  constructor() {
    this.head.textContent = "// desempenho · tecla '";
    this.setDetailed(false);
  }

  setVisible(visible: boolean): void {
    this.panel.hidden = !visible;
  }

  toggleDetailed(): void {
    this.setDetailed(!this.detailed);
  }

  update(dt: number, tickMs: number, info: THREE.WebGLRenderer['info'], tier: number): void {
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
    this.textTimer -= dt;
    if (this.textTimer > 0) return;
    this.textTimer = REFRESH_S;

    const fps = Math.round(this.fps);
    this.fpsLine.textContent = `FPS   ${fps.toString().padStart(4)}`;
    this.coreLines.textContent =
      `TICK  ${tickMs.toFixed(1).padStart(4)}ms\n` + `DRAWS ${info.render.calls.toString().padStart(4)}`;
    if (!this.detailed) return;

    this.panel.dataset.fps = fps >= 55 ? 'ok' : fps >= 30 ? 'warn' : 'bad';
    const heap = (performance as ChromePerformance).memory?.usedJSHeapSize;
    this.moreLines.textContent =
      `TRIS  ${(info.render.triangles / 1000).toFixed(1).padStart(4)}k\n` +
      `GEOM  ${info.memory.geometries.toString().padStart(4)}\n` +
      `TEX   ${info.memory.textures.toString().padStart(4)}\n` +
      `SHDR  ${(info.programs?.length ?? 0).toString().padStart(4)}\n` +
      `HEAP  ${heap === undefined ? '   —' : `${Math.round(heap / 1048576).toString().padStart(4)}MB`}\n` +
      `QUAL  ${TIER_LABEL[tier] ?? String(tier)}`;
  }

  private setDetailed(on: boolean): void {
    this.detailed = on;
    this.panel.classList.toggle('detailed', on);
    this.head.hidden = !on;
    this.moreLines.hidden = !on;
    this.textTimer = 0;
  }
}
