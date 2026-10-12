import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotSystem } from '../combat/BotSystem';
import type { MechBase } from '../entities/MechBase';
import { MAX_ARROWS, OffscreenIndicators } from './OffscreenIndicators';

interface FakeEl {
  className: string;
  style: Record<string, string>;
}

/** Um robô de mentira: só o que a seta lê (posição, altura, vivo). */
function robo(x: number, z: number, tecnico = false): MechBase & { tecnico: boolean } {
  return { position: new THREE.Vector3(x, 0, z), stats: { height: 5 }, alive: true, tecnico } as unknown as MechBase & { tecnico: boolean };
}

describe('setas na borda da tela (esquadrão grande, P91)', () => {
  const elementos: FakeEl[] = [];

  beforeEach(() => {
    elementos.length = 0;
    vi.stubGlobal('document', {
      getElementById: () => ({ append: (e: FakeEl) => elementos.push(e) }),
      createElement: (): FakeEl => ({ className: '', style: {} }),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const camera = () => {
    const c = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 500);
    c.updateMatrixWorld(true);
    return c;
  };
  const bots = (mechs: (MechBase & { tecnico: boolean })[]) => ({ mechs, technicianOf: (m: MechBase & { tecnico: boolean }) => (m.tecnico ? {} : undefined) }) as unknown as BotSystem;
  const jogador = { alive: true, position: new THREE.Vector3(0, 0, 0) } as unknown as MechBase;
  const visiveis = () => elementos.filter((e) => e.style.display === 'block');

  it('com 20 inimigos fora da tela, só as setas dos 8 mais perto aparecem', () => {
    // Atrás da câmera (que olha para -Z): todos fora da tela. Os 12 mais longe são técnicos (setas amarelas): nenhuma deve aparecer.
    const todos = Array.from({ length: 20 }, (_, i) => robo((i % 5) - 2, 15 + i * 4, i >= 8));
    const setas = new OffscreenIndicators();
    setas.update(camera(), bots(todos), jogador);
    expect(visiveis()).toHaveLength(MAX_ARROWS);
    expect(MAX_ARROWS).toBe(8);
    expect(elementos.every((e) => !e.className.includes('technician'))).toBe(true);
  });

  it('a ordem em que os robôs vêm não decide quais aparecem: valem os mais perto', () => {
    const todos = Array.from({ length: 12 }, (_, i) => robo(0, 15 + i * 4, i < 4));
    const setas = new OffscreenIndicators();
    // Os 4 mais perto são técnicos; passados na ordem inversa (do mais longe ao mais perto), eles ainda têm de aparecer.
    setas.update(camera(), bots([...todos].reverse()), jogador);
    expect(visiveis()).toHaveLength(MAX_ARROWS);
    expect(elementos.filter((e) => e.className.includes('technician'))).toHaveLength(4);
  });

  it('com menos que o limite, todos aparecem; os que passam de 120 m e os de frente (na tela) ficam de fora', () => {
    const setas = new OffscreenIndicators();
    setas.update(camera(), bots([robo(0, 30), robo(0, 60), robo(0, 400), robo(0, -30)]), jogador);
    // (0, -30) está na frente da câmera e dentro da tela; (0, 400) está longe demais.
    expect(visiveis()).toHaveLength(2);
  });

  it('as setas que sobraram somem quando os inimigos saem de perto', () => {
    const setas = new OffscreenIndicators();
    const cam = camera();
    setas.update(cam, bots(Array.from({ length: 10 }, (_, i) => robo(0, 15 + i * 4))), jogador);
    expect(visiveis()).toHaveLength(MAX_ARROWS);
    setas.update(cam, bots([robo(0, 20)]), jogador);
    expect(visiveis()).toHaveLength(1);
    setas.update(cam, bots([]), jogador);
    expect(visiveis()).toHaveLength(0);
  });
});
