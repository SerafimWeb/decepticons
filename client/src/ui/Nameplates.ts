import * as THREE from 'three';
import type { BotSystem } from '../combat/BotSystem';
import type { MechBase } from '../entities/MechBase';

/** Só mostra o nome de quem está até esta distância (m). */
const MAX_DIST = 90;
/**
 * Altura do nome na tela (fração da altura da vista; o sprite não diminui com a distância). O texto
 * ocupa ~70% da textura: ~15 px de letra numa tela de 720 linhas.
 */
const HEIGHT = 0.03;
/** Textura pequena, perto do tamanho em que aparece: nítida, sem mipmap borrando a letra. */
const W = 256;
const H = 32;
const FONT = '"Share Tech Mono", Consolas, "Courier New", monospace';
const ENEMY = '#ff4a55';
const TECH = '#ffe14d';
const ALLY = '#39ff6a';

/** Textura do nome: o nome na cor do lado e a personalidade (depois do "·") em branco, com contorno escuro. */
function nameTexture(label: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const [name, persona] = label.split('·');
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.font = `700 22px ${FONT}`;
  const nameW = g.measureText(name!).width;
  g.font = `400 16px ${FONT}`;
  const personaW = persona ? g.measureText(` ${persona}`).width : 0;
  const x0 = Math.round((W - nameW - personaW) / 2);
  // Contorno escuro em vez de brilho: lê sobre o céu e sobre o neon sem borrar.
  const draw = (text: string, x: number, font: string, fill: string, y: number) => {
    g.font = font;
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.strokeText(text, x, y);
    g.fillStyle = fill;
    g.fillText(text, x, y);
  };
  draw(name!, x0, `700 22px ${FONT}`, color, H / 2);
  if (persona) draw(` ${persona}`, x0 + nameW, `400 16px ${FONT}`, '#eef2e8', H / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/**
 * Nome sobre a cabeça de cada IA rebelde (dono, 25/09: "quero que mostre os nomes nos bots"; depois:
 * "estão muito grandes e meio borrados"): vermelho para os de combate, amarelo para o técnico, com a
 * personalidade menor. Sprite de tamanho fixo na tela, escondido atrás de prédios (sem ver através de
 * parede), só até 90 m e só com o bot vivo. Textura pequena e sem mipmap: letra nítida.
 * Custo: um sprite por bot (≤ 7 draw calls), só a posição muda por quadro; texturas feitas uma vez.
 */
export class Nameplates {
  private readonly plates: { mech: MechBase; sprite: THREE.Sprite }[] = [];

  /** `allies` (30/09): segundo grupo opcional, nome em verde — o mesmo Mech nunca está nos dois. */
  constructor(scene: THREE.Scene, bots: BotSystem, allies?: BotSystem) {
    const add = (system: BotSystem, color: string) => {
      for (const mech of system.mechs) {
        const map = nameTexture(system.nameOf(mech), system.technicianOf(mech) ? TECH : color);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, sizeAttenuation: false, depthWrite: false, toneMapped: false, transparent: true }));
        sprite.scale.set((HEIGHT * W) / H, HEIGHT, 1);
        sprite.renderOrder = 10;
        sprite.visible = false;
        scene.add(sprite);
        this.plates.push({ mech, sprite });
      }
    };
    add(bots, ENEMY);
    if (allies) add(allies, ALLY);
  }

  /** Por quadro: acompanha a cabeça de cada bot (posição de render). */
  update(player: MechBase): void {
    const p = player.position;
    for (const { mech, sprite } of this.plates) {
      const m = mech.position;
      const near = (m.x - p.x) ** 2 + (m.z - p.z) ** 2 < MAX_DIST * MAX_DIST;
      sprite.visible = mech.alive && near;
      if (sprite.visible) sprite.position.set(m.x, m.y + mech.stats.height + 0.5, m.z);
    }
  }
}
