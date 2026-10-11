import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TRIGGERS, SHOULDER_TRIGGERS, type MountId, type TriggerLayout } from '../combat/mounts';
import { StatusSet } from '../combat/StatusEffects';
import { weapon, type Tier, type WeaponStats } from '../combat/weapons';
import type { MechBase } from '../entities/MechBase';
import { FlameVisuals } from './FlameVisuals';
import { SHAPE } from './particleShapes';
import type { BurstOptions } from './ParticleSystem';

interface Chamada {
  at: THREE.Vector3;
  normal: THREE.Vector3;
  o: BurstOptions;
}
/** A boca de cada encaixe no Mech de mentira: a direita em x = 1, a esquerda em x = -1 (os ombros, mais alto). */
const BOCAS: Record<MountId, [number, number, number]> = { rightHand: [1, 3, 2], leftHand: [-1, 3, 2], rightShoulder: [1.5, 5, 0], leftShoulder: [-1.5, 5, 0] };

function palco() {
  const chamadas: Chamada[] = [];
  const particles = { burst: (at: THREE.Vector3, normal: THREE.Vector3, o: BurstOptions) => chamadas.push({ at: at.clone(), normal: normal.clone(), o }) };
  const visuals = new FlameVisuals(particles);
  /** Um Mech de mentira: só o que o módulo lê. */
  const mech = (
    flaming: boolean,
    o: { yaw?: number; pitch?: number; alive?: boolean; visible?: boolean; primary?: WeaponStats; offhand?: WeaponStats | null; triggers?: TriggerLayout } = {},
  ) => {
    const status = new StatusSet();
    status.flaming = flaming;
    return {
      alive: o.alive ?? true,
      root: { visible: o.visible ?? true },
      status,
      yaw: o.yaw ?? 0,
      pitch: o.pitch ?? 0,
      triggers: o.triggers ?? DEFAULT_TRIGGERS,
      loadout: { primary: o.primary ?? weapon('flamer'), offhand: o.offhand ?? null, secondary: null },
      mountWorldPosition: (m: MountId, t: THREE.Vector3) => t.set(...BOCAS[m]),
    } as unknown as MechBase;
  };
  return { chamadas, visuals, mech, pulso: () => visuals.beginFrame(0.04, true) };
}
const duas = (tier: Tier = 0) => ({ primary: weapon('flamer', tier), offhand: weapon('flamer', tier), triggers: SHOULDER_TRIGGERS });

describe('o fluxo visível do lança-chamas (desenhado pela bandeira, para todos os jogadores)', () => {
  it('sem a bandeira de chama acesa, nada sai', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    expect(visuals.update(mech(false))).toBe(0);
    expect(chamadas).toHaveLength(0);
  });

  it('só solta no pulso de 30 Hz: um quadro curto não abre o pulso', () => {
    const { chamadas, visuals, mech } = palco();
    visuals.beginFrame(0.01, true);
    expect(visuals.update(mech(true))).toBe(0);
    expect(chamadas).toHaveLength(0);
  });

  it('sai da boca da mão e vai na direção do Mech: reto à frente (yaw 0) e para o lado (yaw 90°)', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true, { yaw: 0, pitch: 0 }));
    expect(chamadas[0]!.at.toArray()).toEqual([1, 3, 2]);
    expect(chamadas[0]!.normal.x).toBeCloseTo(0, 5);
    expect(chamadas[0]!.normal.z).toBeCloseTo(-1, 5);
    chamadas.length = 0;
    pulso();
    visuals.update(mech(true, { yaw: Math.PI / 2 }));
    expect(chamadas[0]!.normal.x).toBeCloseTo(-1, 5);
    expect(chamadas[0]!.normal.z).toBeCloseTo(0, 5);
  });

  it('é fogo (vermelho e verde acima do azul, sobe) com uma fumaça cinza atrás; a língua nasce fina e cresce com a distância', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true));
    const [chama, miolo, fumaca] = chamadas.map((c) => c.o);
    expect(chama!.color.r).toBeGreaterThan(chama!.color.b * 5);
    expect(chama!.gravity).toBeLessThan(0); // sobe
    expect(miolo!.color.g).toBeGreaterThan(chama!.color.g); // o miolo é mais claro
    expect(fumaca!.color.r).toBeLessThan(0.5);
    // Fina na boca (a de 3,5 ofuscava a câmera: o dono já reclamou de luz demais) e larga ao longe (1,7 x (1 + 3) = 6,8).
    expect(chama!.size!).toBeLessThanOrEqual(2);
    expect(chama!.size! * (1 + chama!.expansion!)).toBeGreaterThanOrEqual(6);
  });

  it('o alcance visual é o da arma no nível dela: 30 m no MK I, 39 no MK II e 48 no MK III (o fluxo anda a 0,66 s)', () => {
    for (const tier of [0, 1, 2] as const) {
      const { chamadas, visuals, mech, pulso } = palco();
      pulso();
      visuals.update(mech(true, { primary: weapon('flamer', tier) }));
      const chama = chamadas[0]!.o;
      const w = weapon('flamer', tier);
      expect(chama.speed * chama.life, `MK ${tier + 1}`).toBeGreaterThanOrEqual(w.maxRange - 0.5);
      expect(chama.speed * chama.life, `MK ${tier + 1}`).toBeLessThanOrEqual(w.maxRange + 0.5);
    }
    expect(weapon('flamer', 2).maxRange).toBeGreaterThan(weapon('flamer', 0).maxRange * 1.5);
  });

  it('mais pressão nos níveis altos: o MK III solta mais línguas por pulso que o MK I', () => {
    const conta = (tier: Tier) => {
      const { chamadas, visuals, mech, pulso } = palco();
      pulso();
      visuals.update(mech(true, { primary: weapon('flamer', tier) }));
      return chamadas[0]!.o.count;
    };
    expect(conta(2)).toBeGreaterThan(conta(0));
  });

  it('o custo é pequeno e conhecido por mão: 9 partículas por pulso no MK I (270 por segundo) e 11 no MK III (330), com o pool de 3000', () => {
    for (const [tier, esperado] of [[0, 9], [1, 10], [2, 11]] as const) {
      const { chamadas, visuals, mech, pulso } = palco();
      pulso();
      const n = visuals.update(mech(true, { primary: weapon('flamer', tier) }));
      expect(n, `MK ${tier + 1}`).toBe(esperado);
      expect(chamadas.reduce((a, c) => a + c.o.count, 0)).toBe(esperado);
      expect(n * 30).toBeLessThanOrEqual(330);
    }
  });

  it('a boca fica acesa: um clarão curto, parado e brilhante onde o fogo sai (a 4ª rajada do pulso)', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true));
    const boca = chamadas[3]!.o;
    expect(boca.speed).toBe(0);
    expect(boca.life).toBeLessThanOrEqual(0.15);
    expect(boca.color.r).toBeGreaterThan(boca.color.b * 3); // alaranjado
    expect(chamadas[3]!.at.toArray()).toEqual([1, 3, 2]); // na boca da mão
  });

  it('Mech morto, escondido ou com a partida parada (menu, Hangar) não solta nada', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true, { alive: false }));
    visuals.update(mech(true, { visible: false }));
    visuals.beginFrame(1, false);
    expect(visuals.update(mech(true))).toBe(0);
    expect(chamadas).toHaveLength(0);
  });
});

/** Dono, 11/10: no Marauder "os tiros estavam saindo só pela mão direita": o fluxo do fogo era desenhado sempre da mão direita. */
describe('uma língua por mão que leva lança-chamas (o Marauder tem duas no gatilho principal)', () => {
  const bocasDe = (chamadas: Chamada[]) => new Set(chamadas.filter((c) => c.o.speed === 0).map((c) => c.at.x)); // a boca acesa marca cada mão

  it('com lança-chamas nas duas mãos, o fogo sai das duas (e o custo dobra)', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    const n = visuals.update(mech(true, duas()));
    expect(bocasDe(chamadas)).toEqual(new Set([1, -1]));
    expect(n).toBe(18);
    expect(n * 30).toBeLessThanOrEqual(660);
  });

  it('com o lança-chamas só na esquerda (a direita com plasma), sai só da esquerda', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true, { primary: weapon('plasma'), offhand: weapon('flamer'), triggers: SHOULDER_TRIGGERS }));
    expect(bocasDe(chamadas)).toEqual(new Set([-1]));
  });

  it('com o lança-chamas só na direita (a esquerda com plasma), sai só da direita', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true, { primary: weapon('flamer'), offhand: weapon('plasma'), triggers: SHOULDER_TRIGGERS }));
    expect(bocasDe(chamadas)).toEqual(new Set([1]));
  });

  it('cada mão leva o nível da arma dela: MK III na direita e MK I na esquerda soltam alcances diferentes', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true, { primary: weapon('flamer', 2), offhand: weapon('flamer', 0), triggers: SHOULDER_TRIGGERS }));
    const linguas = chamadas.filter((c) => c.o.shape === SHAPE.flame && c.o.count >= 5);
    const direita = linguas.find((c) => c.at.x === 1)!.o;
    const esquerda = linguas.find((c) => c.at.x === -1)!.o;
    expect(direita.speed * direita.life).toBeGreaterThan(esquerda.speed * esquerda.life * 1.5);
  });

  it('um chassi de uma mão só (o encaixe do offhand não existe) não desenha a esquerda mesmo que o offhand exista no dado', () => {
    const { chamadas, visuals, mech, pulso } = palco();
    pulso();
    visuals.update(mech(true, { primary: weapon('flamer'), offhand: weapon('flamer'), triggers: DEFAULT_TRIGGERS }));
    expect(bocasDe(chamadas)).toEqual(new Set([1]));
  });
});
