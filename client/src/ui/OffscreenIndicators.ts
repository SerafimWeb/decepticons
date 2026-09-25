import * as THREE from 'three';
import { Android } from '../entities/Android';
import type { BotSystem } from '../combat/BotSystem';
import type { MechBase } from '../entities/MechBase';

const $ = (id: string) => document.getElementById(id)!;

export class OffscreenIndicators {
  private container = $('offscreen-indicators');
  private pool: HTMLElement[] = [];
  private activeCount = 0;

  update(camera: THREE.PerspectiveCamera, bots: BotSystem, player: MechBase): void {
    this.activeCount = 0;

    for (const mech of bots.mechs) {
      if (!mech.alive || mech === player) continue;

      const pos = mech.position.clone();
      pos.y += mech.stats.height / 2; // Point to the center of the mech
      pos.project(camera);

      // offscreen or behind camera?
      if (pos.z > 1 || pos.x < -1 || pos.x > 1 || pos.y < -1 || pos.y > 1) {
        this.showIndicator(pos, mech, bots);
      }
    }

    // Hide unused pool elements
    for (let i = this.activeCount; i < this.pool.length; i++) {
      this.pool[i]!.style.display = 'none';
    }
  }

  private showIndicator(pos: THREE.Vector3, mech: MechBase, bots: BotSystem): void {
    if (this.activeCount >= this.pool.length) {
      const el = document.createElement('div');
      this.container.appendChild(el);
      this.pool.push(el);
    }
    
    const el = this.pool[this.activeCount++]!;
    
    const isTechnician = bots.technicianOf(mech) !== undefined;
    const isAndroid = mech instanceof Android;
    
    let typeClass = 'mech';
    if (isTechnician) typeClass = 'technician';
    else if (isAndroid) typeClass = 'android';
    
    el.className = `offscreen-indicator ${typeClass}`;
    
    let dx = pos.x;
    let dy = -pos.y; // invert Y because screen space Y is down
    
    // If it's behind the camera, invert the direction
    if (pos.z > 1) {
      dx = -dx;
      dy = -dy;
    }
    
    // Normalize direction
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    
    const angle = Math.atan2(dy, dx);
    
    el.style.display = 'block';
    // Translate outward along the rotated axis
    el.style.transform = `rotate(${angle}rad) translateX(min(45vw, 45vh))`;
  }
}
