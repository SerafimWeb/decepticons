import * as THREE from 'three';
import type { BotSystem } from '../combat/BotSystem';
import type { MechBase } from '../entities/MechBase';

/** Só mostra o nome de quem está até esta distância (m). */
const MAX_DIST = 90;
/** Textura pequena, perto do tamanho em que aparece: nítida, sem mipmap borrando a letra. */
const W = 256;
/** Duas faixas: o nome em cima, a barra de vida e a distância embaixo. */
const H = 48;
const NAME_BAND = 30;
const BAR_Y = 36;
const BAR_H = 5;
/** A barra de vida não passa disso, centrada sob o nome (P136, 15/10): o Comandante a achou comprida demais e poluindo o combate. */
const BAR_MAX_W = 96;
const PAD = 8;
/** Espaço à direita da barra para a distância ("999m"). */
const DIST_W = 46;
/** Altura do sprite na tela (fração da altura da vista). Mantém o nome do tamanho de antes, agora com a barra embaixo. */
const HEIGHT = 0.048;
/** Regeneração da textura: só quando a vida (degrau de 5%) ou a distância (degrau de 5 m) mudam, e no máximo a cada tanto. */
const REDRAW_S = 0.12;
const FONT = '"Share Tech Mono", Consolas, "Courier New", monospace';
const ENEMY = '#ff4a55';
const TECH = '#ffe14d';
const ALLY = '#39ff6a';

/** A vida em degraus de 5% (0 a 20): a barra salta de degrau em degrau, não a cada pixel de dano. */
export function hpBucketOf(ratio: number): number {
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return Math.round(r * 20);
}

/** A distância em degraus de 5 m: "35m" muda devagar, sem redesenhar a cada passo. */
export function distBucketOf(meters: number): number {
  const m = Number.isFinite(meters) ? Math.max(0, meters) : 0;
  return Math.round(m / 5) * 5;
}

/** Desenha a plaqueta inteira: nome (e personalidade) na cor do lado e, embaixo, a barra de vida e a distância. */
function drawPlate(
  g: CanvasRenderingContext2D,
  name: string,
  persona: string,
  color: string,
  hp01: number,
  distM: number,
): void {
  g.clearRect(0, 0, W, H);
  g.textBaseline = 'middle';
  g.lineJoin = 'round';

  // ── Nome e personalidade, centrados na faixa de cima ──
  g.font = `700 22px ${FONT}`;
  const nameW = g.measureText(name).width;
  g.font = `400 16px ${FONT}`;
  const personaW = persona ? g.measureText(` ${persona}`).width : 0;
  const x0 = Math.round((W - nameW - personaW) / 2);
  const draw = (text: string, x: number, font: string, fill: string, y: number) => {
    g.font = font;
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.strokeText(text, x, y);
    g.fillStyle = fill;
    g.fillText(text, x, y);
  };
  const nameY = NAME_BAND / 2;
  draw(name, x0, `700 22px ${FONT}`, color, nameY);
  if (persona) draw(` ${persona}`, x0 + nameW, `400 16px ${FONT}`, '#eef2e8', nameY + 1);

  // ── Barra de vida (fundo escuro + preenchimento na cor do lado) ──
  // Discreta (P136, 15/10): metade da largura, centrada sob o nome, mais baixa e sem a moldura branca — a
  // barra comprida em cada NPC pesava no visual do combate (palavras do Comandante).
  const barW = Math.min(W - PAD * 2 - DIST_W, BAR_MAX_W);
  const barX = Math.round((W - barW) / 2);
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(barX, BAR_Y, barW, BAR_H);
  g.fillStyle = color;
  g.fillRect(barX + 1, BAR_Y + 1, Math.max(0, (barW - 2) * hp01), BAR_H - 2);

  // ── Distância à direita da barra ──
  g.font = `400 14px ${FONT}`;
  g.textAlign = 'right';
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText(`${distM}m`, W - PAD, BAR_Y + BAR_H / 2);
  g.fillStyle = '#eef2e8';
  g.fillText(`${distM}m`, W - PAD, BAR_Y + BAR_H / 2);
  g.textAlign = 'left';
}

interface Plate {
  mech: MechBase;
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  name: string;
  persona: string;
  color: string;
  hpBucket: number;
  distBucket: number;
  since: number;
}

/**
 * Plaqueta sobre a cabeça de cada IA (dono, 25/09: "quero que mostre os nomes nos bots"; frente 2 da P109:
 * "nome + barra + distância sobre o inimigo, como no MechArena"). Vermelho para os de combate, amarelo para
 * o técnico, verde para os aliados, com a personalidade menor. Sprite de tamanho fixo na tela, escondido
 * atrás de prédios (sem ver através de parede), só até 90 m e só com o bot vivo.
 *
 * Custo (G4/G5): um sprite por robô (≤ 32 draw calls num esquadrão cheio), só a posição muda por quadro.
 * A textura é redesenhada **só quando a vida cruza um degrau de 5% ou a distância um degrau de 5 m**, e no
 * máximo a cada `REDRAW_S` por robô — parado e com vida cheia, nada é redesenhado.
 */
export class Nameplates {
  private readonly plates: Plate[] = [];

  /** `allies` (30/09): segundo grupo opcional, nome em verde — o mesmo Mech nunca está nos dois. */
  constructor(scene: THREE.Scene, bots: BotSystem, allies?: BotSystem) {
    const add = (system: BotSystem, color: string) => {
      for (const mech of system.mechs) {
        const [name, persona] = system.nameOf(mech).split('·');
        const side = system.technicianOf(mech) ? TECH : color;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d')!;
        drawPlate(ctx, name!, persona ?? '', side, 1, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, sizeAttenuation: false, depthWrite: false, toneMapped: false, transparent: true }));
        sprite.scale.set((HEIGHT * W) / H, HEIGHT, 1);
        sprite.renderOrder = 10;
        sprite.visible = false;
        scene.add(sprite);
        this.plates.push({ mech, sprite, texture, ctx, name: name!, persona: persona ?? '', color: side, hpBucket: -1, distBucket: -1, since: 0 });
      }
    };
    add(bots, ENEMY);
    if (allies) add(allies, ALLY);
  }

  /** Por quadro: acompanha a cabeça de cada bot (posição de render) e atualiza a barra/distância quando mudam. */
  update(dt: number, player: MechBase): void {
    const p = player.position;
    for (const plate of this.plates) {
      const { mech, sprite } = plate;
      const m = mech.position;
      const d2 = (m.x - p.x) ** 2 + (m.z - p.z) ** 2;
      const near = d2 < MAX_DIST * MAX_DIST;
      sprite.visible = mech.alive && near;
      if (!sprite.visible) continue;
      sprite.position.set(m.x, m.y + mech.stats.height + 0.5, m.z);

      plate.since -= dt;
      const maxTorso = mech.stats.maxModuleHealth.torso || 1;
      const hp = hpBucketOf(mech.modules.torso / maxTorso);
      const dist = distBucketOf(Math.sqrt(d2));
      if ((hp !== plate.hpBucket || dist !== plate.distBucket) && plate.since <= 0) {
        plate.hpBucket = hp;
        plate.distBucket = dist;
        plate.since = REDRAW_S;
        drawPlate(plate.ctx, plate.name, plate.persona, plate.color, hp / 20, dist);
        plate.texture.needsUpdate = true;
      }
    }
  }
}
