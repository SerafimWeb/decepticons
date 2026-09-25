import * as THREE from 'three';
import type { BotSystem } from '../combat/BotSystem';
import type { MechBase } from '../entities/MechBase';

/** Só mostra o nome de quem está até esta distância (m). */
const MAX_DIST = 90;
/** Altura do nome na tela (fração da altura da vista; o sprite não diminui com a distância). */
const HEIGHT = 0.052;
const W = 512;
const H = 96;
const ENEMY = '#ff2d3d';
const TECH = '#ffe14d';

/** Textura do nome: o nome na cor do time e a personalidade (depois do "·") menor, em branco. */
function nameTexture(label: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const [name, persona] = label.split('·');
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.font = `700 50px Consolas, "Courier New", monospace`;
  const nameW = g.measureText(name!).width;
  g.font = `400 30px Consolas, "Courier New", monospace`;
  const personaW = persona ? g.measureText(` ${persona}`).width : 0;
  let x = (W - nameW - personaW) / 2;
  g.font = `700 50px Consolas, "Courier New", monospace`;
  g.fillStyle = color;
  g.fillText(name!, x, H / 2);
  if (persona) {
    x += nameW;
    g.font = `400 30px Consolas, "Courier New", monospace`;
    g.shadowBlur = 6;
    g.fillStyle = '#eef2e8';
    g.fillText(` ${persona}`, x, H / 2 + 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Nome sobre a cabeça de cada IA rebelde (dono, 25/09: "quero que mostre os nomes nos bots"): vermelho
 * para os de combate, amarelo para o técnico, com a personalidade menor. Sprite de tamanho fixo na tela,
 * escondido atrás de prédios (sem ver através de parede), só até 90 m e só com o bot vivo.
 * Custo: um sprite por bot (≤ 7 draw calls), só a posição muda por quadro; texturas feitas uma vez.
 */
export class Nameplates {
  private readonly plates: { mech: MechBase; sprite: THREE.Sprite }[] = [];

  constructor(scene: THREE.Scene, bots: BotSystem) {
    for (const mech of bots.mechs) {
      const map = nameTexture(bots.nameOf(mech), bots.technicianOf(mech) ? TECH : ENEMY);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, sizeAttenuation: false, depthWrite: false, toneMapped: false, transparent: true }));
      sprite.scale.set((HEIGHT * W) / H, HEIGHT, 1);
      sprite.renderOrder = 10;
      sprite.visible = false;
      scene.add(sprite);
      this.plates.push({ mech, sprite });
    }
  }

  /** Por quadro: acompanha a cabeça de cada bot (posição de render). */
  update(player: MechBase): void {
    const p = player.position;
    for (const { mech, sprite } of this.plates) {
      const m = mech.position;
      const near = (m.x - p.x) ** 2 + (m.z - p.z) ** 2 < MAX_DIST * MAX_DIST;
      sprite.visible = mech.alive && near;
      if (sprite.visible) sprite.position.set(m.x, m.y + mech.stats.height + 0.7, m.z);
    }
  }
}
