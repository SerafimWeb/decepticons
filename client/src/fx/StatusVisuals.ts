import * as THREE from 'three';
import type { MechBase, MechPart } from '../entities/MechBase';
import type { BurstOptions, ParticleSystem } from './ParticleSystem';
import { SHAPE } from './particleShapes';

/**
 * Partículas do estado no corpo do inimigo (dono, 11/10: o congelamento não se percebia). Gelo solta vapor frio e cacos de cristal, fogo solta
 * chama e fumaça, choque solta faíscas azuis, atordoamento solta estrelas amarelas. A cor do casco vem de `entities/statusTint.ts`; aqui
 * só entra o que **sobe e cai** do corpo.
 *
 * Mesmo molde do `DamageVisuals`: **10 Hz**, até **12 unidades por pulso**, uma parte do corpo por unidade e pulso (alternando), usando o
 * pool de partículas que já existe (zero draw call novo). Pior caso: 12 × 11 partículas × 10 Hz = 1320 por segundo, abaixo da metade do pool de 3000 (G5).
 * Só o estado já presente no Mech: bot, aliado e jogador remoto (o `StatusSet` vem das bandeiras da rede). O próprio jogador não recebe
 * partículas (seriam na frente da câmera; o chip e a cor do corpo bastam).
 */
const PARTS: readonly MechPart[] = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const UP = new THREE.Vector3(0, 1, 0);
// Cores acima de 1 acendem o bloom; as do estado ficam em torno de 1 de propósito (aparecem, sem virar halo).
// 27/10 (P260): congelado girava por todas as 6 partes em ~0,6 s e cada rajada durava até 0,9 s — em qualquer instante várias
// partes tinham vapor+caco acesos ao mesmo tempo, e o halo de cada um se somava com o vizinho até cobrir o robô inteiro
// (o Comandante: "fica iluminado quando toma tiros", print do alvo congelado quase todo branco). Cor e tamanho cortados para
// o gelo ainda aparecer sem virar um bloco de luz.
const VAPOR: BurstOptions = { count: 2, color: new THREE.Color(0.32, 0.64, 0.8), speed: 1.2, life: 0.9, size: 1.5, expansion: 1.2, spread: 0.6, gravity: 0.8, shape: SHAPE.puff };
const SHARD: BurstOptions = { count: 2, color: new THREE.Color(0.65, 0.95, 1.05), speed: 3.2, life: 0.6, size: 2.0, spread: 1.6, gravity: 5, spin: 4, shape: SHAPE.flake };
const CHILL: BurstOptions = { count: 1, color: new THREE.Color(0.3, 0.64, 0.83), speed: 1, life: 0.9, size: 2.0, spread: 0.6, gravity: 0.5, spin: 3, shape: SHAPE.flake };
// O fogo no corpo (dono, 11/10: "o fogo está muito fraco"): línguas maiores e mais altas, brasas que sobem e uma fumaça mais gorda.
const FLAME: BurstOptions = { count: 4, color: new THREE.Color(2.0, 0.85, 0.12), speed: 3.4, life: 0.7, size: 2.4, expansion: 0.8, spread: 0.8, gravity: -3, shape: SHAPE.flame };
const EMBER: BurstOptions = { count: 2, color: new THREE.Color(2.2, 1.0, 0.25), speed: 4, life: 1, size: 0.9, spread: 1.2, gravity: -2, shape: SHAPE.dot };
const SMOKE: BurstOptions = { count: 1, color: new THREE.Color(0.28, 0.3, 0.3), speed: 1.4, life: 1.3, size: 2.6, expansion: 1.6, spread: 0.5, gravity: -1.2, shape: SHAPE.puff };
// 27/10 (P261, "a luz ainda pisca forte em geral"): faísca e estrela eram as partículas mais acesas do jogo
// (pico 2,5 e 1,6, bem acima do limiar 1,05), e saem junto do estrobo do choque/atordoamento em `statusTint.ts`
// — a combinação lia como flash, não como VFX. Cor e tamanho cortados, mesma forma e cadência.
const SPARK: BurstOptions = { count: 2, color: new THREE.Color(0.4, 0.8, 1.1), speed: 6, life: 0.28, size: 2.0, spread: 1.8, gravity: 0, spin: 10, shape: SHAPE.bolt };
const STARS: BurstOptions = { count: 2, color: new THREE.Color(1.0, 0.88, 0.16), speed: 2.2, life: 0.45, size: 1.4, spread: 1.4, gravity: -1, spin: 6, shape: SHAPE.star };

export class StatusVisuals {
  private readonly origin = new THREE.Vector3();
  private timer = 0;
  private cursor = 0;
  private remaining = 0;
  private emitted = 0;

  constructor(private readonly particles: Pick<ParticleSystem, 'burst'>) {}

  /** Uma vez por quadro, antes dos `update`: abre um pulso a cada 0,1 s. */
  beginFrame(dt: number, active: boolean): void {
    this.remaining = 0;
    if (!active) {
      this.timer = 0;
      return;
    }
    this.timer += dt;
    if (this.timer < 0.1) return;
    this.timer %= 0.1;
    this.cursor = (this.cursor + 1) % PARTS.length;
    this.remaining = 12;
  }

  /** Quantas partículas este Mech solta neste pulso (para o teste e para o orçamento). */
  update(mech: MechBase): number {
    if (this.remaining === 0 || !mech.alive || !mech.root.visible || !mech.status.active) return 0;
    this.remaining--;
    const s = mech.status;
    const part = PARTS[this.cursor]!;
    mech.partWorldPosition(part, this.origin, false);
    this.emitted = 0;
    if (s.frozen > 0) {
      this.emit(VAPOR);
      this.emit(SHARD);
    } else if (s.stacks > 0) this.emit(CHILL);
    if (s.burn > 0) {
      this.emit(FLAME);
      this.emit(EMBER);
      this.emit(SMOKE);
    }
    if (s.shock > 0) this.emit(SPARK);
    if (s.stun > 0) {
      mech.partWorldPosition('head', this.origin, false);
      this.emit(STARS);
    }
    return this.emitted;
  }

  private emit(o: BurstOptions): void {
    this.particles.burst(this.origin, UP, o);
    this.emitted += o.count;
  }
}
