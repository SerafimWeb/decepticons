import * as THREE from 'three';
import type { MechBase } from '../entities/MechBase';

interface Entry {
  mech: MechBase;
  delayS: number;
  left: number | null;
  onRespawn?: (mech: MechBase) => void;
}

/**
 * Renascimento de qualquer Mech (bots e jogador). Conta o tempo no tick fixo e escolhe o ponto
 * mais longe do Mech vivo mais próximo, para ninguém nascer na cara do inimigo. Determinístico.
 * Custo: só roda conta quando alguém está morto.
 */
export class Respawner {
  private readonly entries: Entry[] = [];
  private readonly points: THREE.Vector3[];

  constructor(spawnPoints: readonly (readonly [number, number])[]) {
    this.points = spawnPoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
  }

  track(mech: MechBase, delayS: number, onRespawn?: (mech: MechBase) => void): void {
    this.entries.push({ mech, delayS, left: null, onRespawn });
  }

  /** Para de acompanhar (jogador que saiu da sala). */
  untrack(mech: MechBase): void {
    const i = this.entries.findIndex((e) => e.mech === mech);
    if (i >= 0) this.entries.splice(i, 1);
  }

  /** Segundos até renascer; null se está vivo ou não é acompanhado. */
  timeLeft(mech: MechBase): number | null {
    return this.entries.find((e) => e.mech === mech)?.left ?? null;
  }

  fixedUpdate(dt: number): void {
    for (const e of this.entries) {
      if (e.mech.alive) {
        e.left = null;
        continue;
      }
      e.left ??= e.delayS;
      e.left -= dt;
      if (e.left > 0) continue;
      e.left = null;
      e.mech.respawn(this.farthestPoint(e.mech));
      e.onRespawn?.(e.mech);
    }
  }

  private farthestPoint(self: MechBase): THREE.Vector3 {
    let best = this.points[0]!;
    let bestGap = -1;
    for (const p of this.points) {
      let nearest = Infinity;
      for (const e of this.entries) {
        if (e.mech === self || !e.mech.alive) continue;
        const s = e.mech.simPosition;
        nearest = Math.min(nearest, (p.x - s.x) ** 2 + (p.z - s.z) ** 2);
      }
      if (nearest > bestGap) {
        bestGap = nearest;
        best = p;
      }
    }
    return best;
  }
}
