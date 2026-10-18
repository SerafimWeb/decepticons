import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DragaController, ALCANCE_DE_TIRO_DO_DRAGA_M } from '../combat/DragaController';
import { DragaMech, type VisualDoDraga } from '../entities/DragaMech';
import { DRAGA_STATS } from '../entities/dragaStats';
import { Vector09 } from '../entities/Vector09';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { LINHA_DA_ALDEIA_X, VELOCIDADE_DA_MARCHA_MS } from '../sim/DragaMarcha';
import { Amazonia } from './Amazonia';
import { chefeDaAmazonia } from './AmazoniaChefe';
import { AMAZONIA_DRAGA_INICIO_X, larguraDoRio, rioEmX } from './AmazoniaLayout';
import { alturaDoTerreno } from './AmazoniaTerreno';

const abertas: PhysicsWorld[] = [];
afterEach(() => {
  while (abertas.length) abertas.pop()!.world.free();
});
beforeAll(async () => {
  await RAPIER.init();
});

/** O mapa (o chão que o Draga pisa) e o Draga no leito, na largada. */
async function nasceODraga(seed = 7, visual: object | null = null) {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const scene = new THREE.Scene();
  new Amazonia(scene, physics);
  const { mech, brain } = chefeDaAmazonia.criar({ physics, visual, seed });
  const draga = mech as DragaMech;
  const n = chefeDaAmazonia.nascimento;
  draga.spawn(physics, new THREE.Vector3(n.x, alturaDoTerreno(n.x, n.z), n.z));
  draga.applyFacing(n.yaw, 0);
  brain.reset();
  const alvos: Vector09[] = [];
  const tick = (): void => {
    const input = brain.think(FIXED_DT, alvos);
    draga.fixedUpdate(input, FIXED_DT);
    for (const a of alvos) a.fixedUpdate({ moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false }, FIXED_DT);
    physics.step();
  };
  const andar = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) tick();
  };
  return { physics, scene, draga, brain, alvos, tick, andar };
}

describe('o corpo do Draga-01 (P180, parte C): os números e o rig vazio', () => {
  it('os números são os do desenho e da regra: 36 m de cápsula, 10 m de raio, 2,6 m/s, o peso nas pernas e no tronco, e o canhão de cerco no convés', () => {
    expect(DRAGA_STATS.name).toBe('DRAGA-01');
    expect(DRAGA_STATS.radius).toBeLessThanOrEqual(DRAGA_STATS.height / 2); // o Rapier não aceita raio maior que a metade da altura
    expect(DRAGA_STATS.moveSpeed).toBe(VELOCIDADE_DA_MARCHA_MS);
    expect(DRAGA_STATS.jumpVelocity).toBe(0);
    expect(DRAGA_STATS.dashSpeed).toBe(0);
    const m = DRAGA_STATS.maxModuleHealth;
    expect(m.torso).toBeGreaterThan(m.leftLeg * 2); // o tronco pesa mais que as duas pernas de um lado...
    expect(m.leftLeg).toBe(m.rightLeg);
    expect(m.leftLeg).toBeGreaterThan(m.leftArm);
    expect(DRAGA_STATS.loadout.primary.id).toBe('siege');
    expect(DRAGA_STATS.muzzles?.rightHand?.[2]).toBeLessThan(0); // a boca fica à frente (-Z)
  });

  it('o canhão alcança menos que o canhão de cerco (400 m) e mais que o suficiente para cobrir a aldeia: 320 m, de propósito', () => {
    expect(ALCANCE_DE_TIRO_DO_DRAGA_M).toBeGreaterThanOrEqual(250);
    expect(ALCANCE_DE_TIRO_DO_DRAGA_M).toBeLessThan(DRAGA_STATS.loadout.primary.maxRange);
  });

  it('o corpo nasce com a vida cheia, rasteja com as duas pernas caídas e o desenho de quatro pernas começa de pé', async () => {
    const { draga } = await nasceODraga();
    expect(draga.alive).toBe(true);
    expect(draga.crawls).toBe(true);
    expect(draga.pernas).toEqual({ fl: 0, fr: 0, rl: 0, rr: 0 });
  });

  it('a regra de velocidade é a do MechBase: inteiro 1, um lado caído 0,5, os dois rastejando a 0,3', async () => {
    const { draga } = await nasceODraga();
    expect(draga.mobility).toBe(1);
    draga.modules.leftLeg = 0;
    expect(draga.mobility).toBe(0.5);
    draga.modules.rightLeg = 0;
    expect(draga.mobility).toBe(0.3);
  });

  it('as quatro pernas do desenho seguem a vida dos dois módulos: a da frente cai primeiro', async () => {
    const { draga } = await nasceODraga();
    const max = DRAGA_STATS.maxModuleHealth;
    draga.modules.leftLeg = max.leftLeg * 0.5;
    expect(draga.pernas).toEqual({ fl: 1, fr: 0, rl: 0, rr: 0 });
    draga.modules.leftLeg = 0;
    draga.modules.rightLeg = max.rightLeg * 0.25;
    expect(draga.pernas).toEqual({ fl: 1, rl: 1, fr: 1, rr: 0.5 });
  });
});

describe('o Draga-01 anda (P180, parte C): a marcha pelo leito, no chão de verdade', () => {
  it('em 30 s ele anda ~76 m rio acima (a 2,6 m/s, com 0,65 s de arrancada), sempre para o oeste', async () => {
    const { draga, andar } = await nasceODraga();
    const x0 = draga.simPosition.x;
    expect(x0).toBeCloseTo(AMAZONIA_DRAGA_INICIO_X, 0);
    let anterior = x0;
    for (let i = 0; i < 6; i++) {
      andar(5);
      expect(draga.simPosition.x, `parte ${i}`).toBeLessThan(anterior);
      anterior = draga.simPosition.x;
    }
    const andou = x0 - draga.simPosition.x;
    expect(andou).toBeGreaterThan(VELOCIDADE_DA_MARCHA_MS * 30 * 0.9);
    expect(andou).toBeLessThan(VELOCIDADE_DA_MARCHA_MS * 30 * 1.02);
  });

  it('segue o rio: em 3 minutos de marcha ele fica dentro do leito (a distância ao eixo é menor que a metade da largura) e os pés seguem o chão', async () => {
    const { draga, andar } = await nasceODraga();
    for (let i = 0; i < 18; i++) {
      andar(10);
      const { x, y, z } = draga.simPosition;
      expect(Math.abs(z - rioEmX(x)), `x ${x.toFixed(0)}`).toBeLessThan(larguraDoRio(x) / 2);
      expect(Math.abs(y - alturaDoTerreno(x, z)), `y em ${x.toFixed(0)}`).toBeLessThan(3);
    }
    expect(draga.simPosition.x).toBeLessThan(AMAZONIA_DRAGA_INICIO_X - 400);
  });

  it('uma perna caída (um lado) o deixa a metade da velocidade; as duas, a 30%', async () => {
    const velocidade = async (lados: { e: boolean; d: boolean }): Promise<number> => {
      const { draga, andar } = await nasceODraga();
      if (lados.e) draga.modules.leftLeg = 0;
      if (lados.d) draga.modules.rightLeg = 0;
      andar(4); // a arrancada
      const x0 = draga.simPosition.x;
      andar(10);
      return (x0 - draga.simPosition.x) / 10;
    };
    const inteiro = await velocidade({ e: false, d: false });
    const manco = await velocidade({ e: true, d: false });
    const mancoDireito = await velocidade({ e: false, d: true });
    const rasteja = await velocidade({ e: true, d: true });
    expect(inteiro).toBeCloseTo(VELOCIDADE_DA_MARCHA_MS, 1);
    expect(manco).toBeCloseTo(inteiro * 0.5, 1);
    expect(mancoDireito).toBeCloseTo(inteiro * 0.5, 1);
    expect(rasteja).toBeCloseTo(inteiro * 0.3, 1);
  });

  it('o casco gira devagar (14°/s, no máximo) e olha para onde anda: o rumo nunca salta de um tick para o outro', async () => {
    const { brain, tick } = await nasceODraga();
    const c = brain as DragaController;
    let anterior = c.rumo;
    let maior = 0;
    for (let i = 0; i < 60 * 60; i++) {
      tick();
      let d = c.rumo - anterior;
      d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
      maior = Math.max(maior, Math.abs(d));
      anterior = c.rumo;
    }
    expect(maior).toBeLessThanOrEqual((0.25 * FIXED_DT) * 1.0001);
  });

  it('reset volta o casco para o oeste e zera a mira e o relógio do tiro', async () => {
    const { brain, andar } = await nasceODraga();
    const c = brain as DragaController;
    andar(20);
    c.reset();
    expect(c.rumo).toBeCloseTo(Math.PI / 2, 12);
    expect(c.wantsToFire).toBe(false);
  });
});

describe('o canhão do Draga-01 (P180, parte C): quando atira', () => {
  const alvoEm = async (dist: number, extra: { x?: number } = {}) => {
    const r = await nasceODraga();
    const v = new Vector09();
    const x = r.draga.simPosition.x - dist;
    const z = rioEmX(x);
    v.spawn(r.physics, new THREE.Vector3(x + (extra.x ?? 0), alturaDoTerreno(x, z), z));
    r.alvos.push(v);
    return { ...r, alvo: v };
  };

  it('espera uns 3 s depois de largar para o primeiro tiro, e depois atira na cadência do canhão (4,5 s)', async () => {
    const { brain, draga, tick } = await alvoEm(150);
    const c = brain as DragaController;
    const tiros: number[] = [];
    for (let i = 0; i < 60 * 14; i++) {
      tick();
      if (c.wantsToFire) {
        tiros.push(i * FIXED_DT);
        draga.onFire(); // o BotSystem avisa o corpo (calor)
      }
    }
    expect(tiros.length).toBeGreaterThanOrEqual(3);
    expect(tiros[0]).toBeGreaterThan(2.9);
    expect(tiros[0]).toBeLessThan(3.5);
    expect(tiros[1]! - tiros[0]!).toBeCloseTo(DRAGA_STATS.loadout.primary.fireInterval, 1);
  });

  it('mira no alvo: a direção do tiro aponta para ele (dentro do erro de mira) e o convés gira para lá', async () => {
    const { brain, draga, alvo, tick } = await alvoEm(150);
    const c = brain as DragaController;
    for (let i = 0; i < 60 * 4 && !c.wantsToFire; i++) tick();
    expect(c.wantsToFire).toBe(true);
    const boca = draga.simMuzzle(new THREE.Vector3());
    const ate = new THREE.Vector3(alvo.simPosition.x, alvo.simPosition.y + alvo.stats.height / 2, alvo.simPosition.z).sub(boca).normalize();
    expect(c.shotDir.dot(ate)).toBeGreaterThan(Math.cos(0.1));
    expect(c.shotDir.length()).toBeCloseTo(1, 6);
    // o convés aponta para o alvo (a oeste: π/2 de rumo, dentro de uns graus)
    expect(Math.abs(draga.deckAim - Math.PI / 2)).toBeLessThan(0.3);
  });

  it('não atira em quem está além do alcance (320 m), nem em quem já caiu', async () => {
    const longe = await alvoEm(ALCANCE_DE_TIRO_DO_DRAGA_M + 40);
    let tirou = false;
    for (let i = 0; i < 60 * 8; i++) {
      longe.tick();
      if ((longe.brain as DragaController).wantsToFire) tirou = true;
    }
    expect(tirou).toBe(false);
    const caido = await alvoEm(100);
    caido.alvo.modules.torso = 0;
    for (let i = 0; i < 60 * 8; i++) {
      caido.tick();
      if ((caido.brain as DragaController).wantsToFire) tirou = true;
    }
    expect(tirou).toBe(false);
  });

  it('não atira com um muro no caminho: a visada tem de estar livre', async () => {
    const r = await alvoEm(150);
    const meio = r.draga.simPosition.x - 70;
    r.physics.addStaticBox(new THREE.Vector3(meio, 30, rioEmX(meio)), new THREE.Vector3(4, 80, 160)); // um paredão entre os dois, de ponta a ponta do rio
    r.physics.step();
    let tirou = false;
    for (let i = 0; i < 60 * 8; i++) {
      r.tick();
      if ((r.brain as DragaController).wantsToFire) tirou = true;
    }
    expect(tirou).toBe(false);
  });

  it('o canhão destruído (o braço direito caído) não atira', async () => {
    const r = await alvoEm(120);
    r.draga.modules.rightArm = 0;
    let tirou = false;
    for (let i = 0; i < 60 * 8; i++) {
      r.tick();
      if ((r.brain as DragaController).wantsToFire) tirou = true;
    }
    expect(tirou).toBe(false);
  });

  it('é determinístico: a mesma semente dá os mesmos tiros (G2); outra semente muda o erro de mira', async () => {
    const mira = async (seed: number): Promise<number[]> => {
      const r = await nasceODraga(seed);
      const v = new Vector09();
      const x = r.draga.simPosition.x - 150;
      v.spawn(r.physics, new THREE.Vector3(x, alturaDoTerreno(x, rioEmX(x)), rioEmX(x)));
      r.alvos.push(v);
      const c = r.brain as DragaController;
      const dirs: number[] = [];
      for (let i = 0; i < 60 * 15; i++) {
        r.tick();
        if (c.wantsToFire) {
          dirs.push(c.shotDir.x, c.shotDir.y, c.shotDir.z);
          r.draga.onFire();
        }
      }
      return dirs;
    };
    const a = await mira(5);
    const b = await mira(5);
    const outro = await mira(6);
    expect(a.length).toBeGreaterThan(6);
    expect(a).toEqual(b);
    expect(outro).not.toEqual(a);
  });
});

describe('o desenho do Draga-01 (P180, parte C): o convés, as pernas e o passo seguem a simulação', () => {
  const falso = (): VisualDoDraga & { chamadas: number[] } => {
    const chamadas: number[] = [];
    return {
      root: new THREE.Group(),
      collapse: { fl: 0, fr: 0, rl: 0, rr: 0 },
      deckYaw: 0,
      chamadas,
      update(_dt: number, speedMs: number) {
        chamadas.push(speedMs);
      },
    };
  };

  it('o desenho passado vira filho do corpo (anda e gira com ele), e sem desenho o corpo nasce vazio', async () => {
    const v = falso();
    const { draga } = await nasceODraga(7, null);
    expect(draga.root.children.length).toBe(1); // só o grupo do rig vazio
    const com = new DragaMech(DRAGA_STATS, v);
    let achou = false;
    com.root.traverse((o) => {
      if (o === v.root) achou = true;
    });
    expect(achou).toBe(true);
  });

  it('a cada quadro as pernas caem com a vida dos módulos, o convés gira para a mira e o passo anda com a velocidade de verdade', async () => {
    const v = falso();
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const draga = new DragaMech(DRAGA_STATS, v);
    draga.spawn(physics, new THREE.Vector3(0, 0, 0));
    draga.applyFacing(0, 0);
    draga.deckAim = 0.8;
    draga.modules.leftLeg = DRAGA_STATS.maxModuleHealth.leftLeg * 0.25;
    draga.velocity.set(1.5, 0, 0);
    draga.render(0.016, 1);
    expect(v.collapse).toEqual({ fl: 1, rl: 0.5, fr: 0, rr: 0 });
    expect(v.deckYaw).toBeCloseTo(0.8, 12);
    expect(v.chamadas).toEqual([1.5]);
    draga.applyFacing(Math.PI - 0.1, 0);
    draga.deckAim = -Math.PI + 0.1; // atravessa o ±π: o caminho curto é 0,2 rad
    draga.render(0.016, 1);
    expect(v.deckYaw).toBeCloseTo(0.2, 9);
  });

  it('morto, o desenho não é atualizado (o corpo some)', async () => {
    const v = falso();
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const draga = new DragaMech(DRAGA_STATS, v);
    draga.spawn(physics, new THREE.Vector3(0, 0, 0));
    draga.modules.torso = 0;
    draga.render(0.016, 1);
    expect(v.chamadas).toEqual([]);
  });
});

describe('o Draga-01 na regra (P180, parte C): levar tiro e a linha da aldeia', () => {
  it('o tiro baixo derruba a perna do lado atingido e o alto vai ao tronco: a cápsula tem a mesma regra de zonas do Colossus', async () => {
    const { draga } = await nasceODraga();
    draga.applyFacing(0, 0); // yaw 0: a direita do corpo é +X
    const p = draga.simPosition;
    const baixoDireita = new THREE.Vector3(p.x + 6, p.y + 5, p.z);
    const antes = { ...draga.modules };
    draga.takeHit(baixoDireita, 100);
    expect(draga.modules.rightLeg).toBe(antes.rightLeg - 100);
    expect(draga.modules.leftLeg).toBe(antes.leftLeg);
    draga.takeHit(new THREE.Vector3(p.x - 6, p.y + 5, p.z), 50);
    expect(draga.modules.leftLeg).toBe(antes.leftLeg - 50);
    draga.takeHit(new THREE.Vector3(p.x, p.y + 20, p.z), 70);
    expect(draga.modules.torso).toBe(antes.torso - 70);
  });

  it('a perna zerada derruba o lado, e o dano que sobra em parte caída vai para o tronco (não o blinda)', async () => {
    const { draga } = await nasceODraga();
    draga.applyFacing(0, 0);
    const p = draga.simPosition;
    const baixoDireita = new THREE.Vector3(p.x + 6, p.y + 5, p.z);
    draga.takeHit(baixoDireita, DRAGA_STATS.maxModuleHealth.rightLeg);
    expect(draga.modules.rightLeg).toBe(0);
    expect(draga.mobility).toBe(0.5);
    const torso = draga.modules.torso;
    draga.takeHit(baixoDireita, 40);
    expect(draga.modules.torso).toBe(torso - 40);
  });

  it('chega a pé, sem ajuda, na linha da aldeia em uns 10 minutos, colado ao eixo do rio (a marcha toda de pernas inteiras)', async () => {
    const { draga, tick } = await nasceODraga();
    // acelera a simulação sem renderizar: 600 s = 36.000 ticks de física de verdade (uns segundos de CPU)
    const limite = Math.ceil((1550 / VELOCIDADE_DA_MARCHA_MS + 25) / FIXED_DT);
    let i = 0;
    let desvio = 0; // o quanto ele se afasta do eixo do rio ao longo da marcha toda (o rio tem curvas de 60 m de amplitude)
    while (draga.simPosition.x > LINHA_DA_ALDEIA_X && i++ < limite) {
      tick();
      desvio = Math.max(desvio, Math.abs(draga.simPosition.z - rioEmX(draga.simPosition.x)));
    }
    expect(desvio, `desvio máximo ${desvio.toFixed(1)} m`).toBeLessThan(12); // medido: 5 m; olhar longe demais ou ignorar a curva o leva a dezenas de metros
    expect(draga.simPosition.x).toBeLessThanOrEqual(LINHA_DA_ALDEIA_X);
    expect(i * FIXED_DT).toBeGreaterThan(560);
    expect(i * FIXED_DT).toBeLessThan(640);
  }, 120_000);
});

describe('o registro do chefe da Amazônia (P180, parte C)', () => {
  it('nasce no leito, na largada, olhando para o oeste, e cada chamada de criar faz um corpo e um cérebro novos', async () => {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    expect(chefeDaAmazonia.nascimento.x).toBe(AMAZONIA_DRAGA_INICIO_X);
    expect(chefeDaAmazonia.nascimento.z).toBe(rioEmX(AMAZONIA_DRAGA_INICIO_X));
    expect(chefeDaAmazonia.nascimento.yaw).toBeCloseTo(Math.PI / 2, 12);
    const a = chefeDaAmazonia.criar({ physics, visual: null, seed: 1 });
    const b = chefeDaAmazonia.criar({ physics, visual: null, seed: 1 });
    expect(a.mech).not.toBe(b.mech);
    expect(a.brain).not.toBe(b.brain);
  });

  it('um "desenho" que não é o do Draga é ignorado (o corpo nasce vazio, sem lançar)', async () => {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const spy = vi.fn();
    const { mech } = chefeDaAmazonia.criar({ physics, visual: { root: {}, update: spy }, seed: 1 });
    expect(() => (mech as DragaMech).render(0.016, 1)).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  it('as potências do painel valem para o chefe (a potência do clã dos Mechs multiplica o que ele faz)', async () => {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const { mech } = chefeDaAmazonia.criar({ physics, visual: null, seed: 1 });
    expect(mech.stats.name).toBe('DRAGA-01');
    expect(mech.stats.maxModuleHealth.torso).toBeGreaterThan(0);
  });
});
