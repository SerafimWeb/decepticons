import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { StatusSet } from '../combat/StatusEffects';
import type { MechBase } from '../entities/MechBase';
import type { BurstOptions } from './ParticleSystem';
import { StatusVisuals } from './StatusVisuals';

interface Chamada {
  at: THREE.Vector3;
  o: BurstOptions;
}
function palco() {
  const chamadas: Chamada[] = [];
  const particles = { burst: (at: THREE.Vector3, _n: THREE.Vector3, o: BurstOptions) => chamadas.push({ at: at.clone(), o }) };
  const visuals = new StatusVisuals(particles);
  /** Um Mech de mentira: só o que o módulo lê. */
  const mech = (status = new StatusSet(), alive = true, visible = true) =>
    ({
      alive,
      root: { visible },
      status,
      partWorldPosition: (part: string, target: THREE.Vector3) => target.set(0, part === 'head' ? 5 : 3, 0),
    }) as unknown as MechBase;
  const pulso = () => visuals.beginFrame(0.11, true);
  return { chamadas, visuals, mech, pulso };
}
const congelado = () => {
  const s = new StatusSet();
  for (let i = 0; i < 3; i++) s.chillUp();
  return s;
};

describe('partículas do estado no corpo do inimigo', () => {
  it('sem estado, nada sai (o Mech comum não custa partícula)', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    expect(visuals.update(mech())).toBe(0);
    expect(chamadas).toHaveLength(0);
  });

  it('só solta no pulso de 10 Hz: entre os pulsos não sai nada', () => {
    const { chamadas, visuals, mech } = palco();
    visuals.beginFrame(0.016, true);
    expect(visuals.update(mech(congelado()))).toBe(0);
    expect(chamadas).toHaveLength(0);
  });

  it('congelado solta vapor e cacos frios (azul manda); gelado solta só um sopro', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(congelado()));
    expect(chamadas).toHaveLength(2);
    for (const { o } of chamadas) expect(o.color.b).toBeGreaterThan(o.color.r);
    chamadas.length = 0;
    const gelado = new StatusSet();
    gelado.stacks = 2;
    pulso();
    expect(visuals.update(mech(gelado))).toBe(1);
  });

  it('queimando solta chama (vermelho manda, sobe) e fumaça (cinza, sobe)', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    const s = new StatusSet();
    s.burnUp();
    pulso();
    visuals.update(mech(s));
    const [chama, fumaca] = chamadas.map((c) => c.o);
    expect(chama!.color.r).toBeGreaterThan(chama!.color.b);
    expect(chama!.gravity).toBeLessThan(0); // gravidade negativa: sobe
    expect(fumaca!.color.r).toBeLessThan(0.5);
    expect(fumaca!.gravity).toBeLessThan(0);
  });

  it('chocado solta faíscas azuis; atordoado solta estrelas amarelas na altura da cabeça', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    const choque = new StatusSet();
    choque.shockUp(false);
    pulso();
    visuals.update(mech(choque));
    expect(chamadas[0]!.o.color.b).toBeGreaterThan(chamadas[0]!.o.color.r);
    chamadas.length = 0;
    const atordoado = new StatusSet();
    atordoado.shockUp(true);
    pulso();
    visuals.update(mech(atordoado));
    const estrelas = chamadas.at(-1)!;
    expect(estrelas.o.color.r).toBeGreaterThan(estrelas.o.color.b);
    expect(estrelas.at.y).toBe(5); // a cabeça
  });

  it('o orçamento é por pulso: no máximo 12 unidades, e no pior caso 5 partículas cada', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    const s = new StatusSet();
    s.burnUp();
    s.shockUp(true); // queimando, chocado e atordoado ao mesmo tempo: o caso mais caro
    pulso();
    let total = 0;
    for (let i = 0; i < 40; i++) total += visuals.update(mech(s));
    expect(chamadas.length / 4).toBeLessThanOrEqual(12); // cada unidade solta até 4 rajadas
    expect(total).toBeLessThanOrEqual(12 * 9);
    // 12 unidades por pulso × 10 pulsos por segundo × o pior caso: abaixo do teto do pool de 3000 partículas (G5), com folga.
    expect(12 * 10 * 9).toBeLessThan(3000 / 2);
  });

  it('Mech morto ou escondido (fora da câmera) não solta nada', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(congelado(), false));
    visuals.update(mech(congelado(), true, false));
    expect(chamadas).toHaveLength(0);
  });

  it('com a partida parada (menu, Hangar) o pulso não abre e nada sai', () => {
    const { chamadas, visuals, mech } = palco();
    visuals.beginFrame(1, false);
    expect(visuals.update(mech(congelado()))).toBe(0);
    expect(chamadas).toHaveLength(0);
  });
});
