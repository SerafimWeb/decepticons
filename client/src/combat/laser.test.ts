import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import { armOptions, validateLoadout } from '../hangar/loadout';
import { BeamVisuals, MAX_BEAMS } from '../fx/BeamVisuals';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { GLOW } from '../core/palette';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { armaServeAoBot } from '../sim/esquadrao';
import { Armament, type ShotSink } from './Armament';
import { drill, sustainedDps, timeToKill } from './balance';
import { fitsMount } from './mountKinds';
import { DEFAULT_TRIGGERS, SHOULDER_TRIGGERS, type MountId, type TriggerLayout } from './mounts';
import { classFor } from './weaponClass';
import { DAMAGE_TYPE, hitDamage, rangeFactor, weapon, WEAPON_IDS, type Loadout, type Tier, type WeaponStats } from './weapons';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const V = VECTOR09_STATS;
const TORSO = V.maxModuleHealth.torso;
const LEVELS: readonly Tier[] = [0, 1, 2];
const W = weapon('laser');

describe('raio laser: o que é (P152)', () => {
  it('é de energia, natureza `laser`, arma média de mão: 6 de dano a cada 0,13 s, 0,02 de calor por pulso, 4 t', () => {
    expect(W.kind).toBe('energy');
    expect(DAMAGE_TYPE.laser).toBe('laser');
    expect(classFor('laser', 2)).toBe('medium');
    expect([W.damage, W.fireInterval, W.heatPerShot, W.mass, W.magazine, W.blastRadius]).toEqual([6, 0.13, 0.02, 4, 0, 0]);
    expect(W.beam).toEqual({ glow: 0.16 });
    for (const id of WEAPON_IDS) expect(weapon(id).beam !== undefined, id).toBe(id === 'laser');
  });

  it('o feixe fica aceso um pouco mais que o intervalo entre pulsos: os pulsos seguidos se emendam numa linha só', () => {
    expect(W.beam!.glow).toBeGreaterThan(W.fireInterval);
    expect(W.beam!.glow).toBeLessThan(W.fireInterval * 2);
  });

  it('longo alcance: dano cheio até 180 m e 70% aos 360 m (o plasma cai a 40% aos 200 m); acerta na hora, sem esperar o projétil', () => {
    expect([W.optimalRange, W.maxRange, W.minFactor]).toEqual([180, 360, 0.7]);
    expect(W.maxRange).toBeGreaterThan(weapon('plasma').maxRange);
    expect(W.maxRange).toBeGreaterThan(weapon('railgun').optimalRange * 2);
    expect(W.minFactor).toBeGreaterThan(weapon('plasma').minFactor);
    expect(hitDamage(W, 100)).toBe(6);
    expect(hitDamage(W, 180)).toBe(6);
    expect(hitDamage(W, 270)).toBe(Math.round(6 * (1 - 0.3 * 0.5)));
    expect(hitDamage(W, 360)).toBe(Math.round(6 * 0.7));
    expect(rangeFactor(W, 1000)).toBe(0.7);
    expect(W.speed).toBeGreaterThan(1000); // se alguma via a tratar como projétil comum, é praticamente instantâneo (e nunca divide por zero)
  });

  it('os níveis sobem o dano (6, 7, 8), o calor e a carga (4, 6 e 8 t); o alcance e a cadência são os mesmos', () => {
    expect(LEVELS.map((t) => weapon('laser', t).damage)).toEqual([6, 7, 8]);
    expect(LEVELS.map((t) => weapon('laser', t).mass)).toEqual([4, 6, 8]);
    expect(LEVELS.map((t) => weapon('laser', t).heatPerShot)).toEqual([0.02, 0.023, 0.026]);
    for (const t of LEVELS) {
      expect(weapon('laser', t).maxRange).toBe(360);
      expect(weapon('laser', t).fireInterval).toBe(0.13);
    }
  });

  it('é arma de mão: nos dois braços de todo Mech, no andróide não (média demais) e no Colossus não (pequena demais); os bots ainda não a usam', () => {
    expect(fitsMount('laser', 'arm')).toBe(true);
    for (const kind of ['shoulder', 'back', 'chest', 'head'] as const) expect(fitsMount('laser', kind)).toBe(false);
    expect(armOptions('right', 'vector09')).toContain('laser');
    expect(armOptions('left', 'vector09')).toContain('laser');
    expect(armOptions('right', 'marauder')).toContain('laser');
    expect(armOptions('shoulders', 'marauder')).not.toContain('laser');
    expect(armOptions('right', 'android')).not.toContain('laser');
    expect(armOptions('right', 'colossus01')).not.toContain('laser');
    expect(armaServeAoBot('laser')).toBe(false);
  });

  it('montagens: o Vector-09 leva o laser em qualquer nível no braço direito (8 t no MK III); a Arara-B1 (pequena) não aguenta o MK III', () => {
    for (const t of LEVELS) expect(validateLoadout({ v: 1, chassis: 'vector09', right: { id: 'laser', tier: t }, left: null }), `MK ${t + 1}`).toMatchObject({ ok: true });
    expect(validateLoadout({ v: 1, chassis: 'vector09', right: { id: 'laser', tier: 2 }, left: { id: 'laser', tier: 2 } })).toMatchObject({ ok: false, error: 'carga' });
  });
});

describe('Armament: um pulso a cada 0,13 s com o gatilho apertado; solto, o feixe apaga (não é salva)', () => {
  interface Pulso {
    t: number;
    mount: MountId;
    w: WeaponStats;
    via: 'beam' | 'projectile';
  }
  function bench(loadout: Loadout, triggers: TriggerLayout = DEFAULT_TRIGGERS, comBeam = true) {
    const mech = new Vector09({ stats: { ...VECTOR09_STATS, triggers, loadout }, loadout });
    const armament = new Armament(mech);
    const pulsos: Pulso[] = [];
    let t = 0;
    const sink: ShotSink = {
      projectile: (mount, w) => pulsos.push({ t, mount, w, via: 'projectile' }),
      rocket: () => {},
      melee: () => {},
      flame: () => {},
      wave: () => {},
      ...(comBeam ? { beam: (mount: MountId, w: WeaponStats) => pulsos.push({ t, mount, w, via: 'beam' }) } : {}),
    };
    const hold = (seconds: number, fire: boolean, secondary = false): void => {
      for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++, t += FIXED_DT) armament.fixedUpdate(FIXED_DT, fire, secondary, sink);
    };
    return { mech, pulsos, hold };
  }
  const frio: WeaponStats = Object.freeze({ ...weapon('laser'), heatPerShot: 0 });

  it('segurando o botão 1: ~7,7 pulsos por segundo pelo `beam` do sink, da mão direita; soltando, para na hora', () => {
    const s = bench({ primary: frio, secondary: null });
    s.hold(2, true);
    expect(s.pulsos.length).toBeGreaterThanOrEqual(15);
    expect(s.pulsos.length).toBeLessThanOrEqual(16);
    expect(s.pulsos.every((p) => p.via === 'beam' && p.mount === 'rightHand' && p.w.id === 'laser')).toBe(true);
    const n = s.pulsos.length;
    s.hold(1, false);
    expect(s.pulsos).toHaveLength(n);
  });

  it('sem `beam` no sink (um teste, um bot), o pulso cai no projétil comum: a regra nunca fica muda', () => {
    const s = bench({ primary: frio, secondary: null }, DEFAULT_TRIGGERS, false);
    s.hold(1, true);
    expect(s.pulsos.length).toBeGreaterThan(6);
    expect(s.pulsos.every((p) => p.via === 'projectile')).toBe(true);
  });

  it('no braço esquerdo (o Ataque 2 dos pequenos) também sai como feixe', () => {
    const s = bench({ primary: weapon('blaster'), secondary: frio });
    s.hold(1, false, true);
    expect(s.pulsos.length).toBeGreaterThan(6);
    expect(s.pulsos.every((p) => p.via === 'beam' && p.mount === 'leftHand')).toBe(true);
  });

  it('nas duas mãos do Marauder as duas atiram, alternadas (meio intervalo uma da outra)', () => {
    const s = bench({ primary: frio, offhand: frio, secondary: null }, SHOULDER_TRIGGERS);
    s.hold(1, true);
    expect(s.pulsos.filter((p) => p.mount === 'rightHand').length).toBeGreaterThan(5);
    expect(s.pulsos.filter((p) => p.mount === 'leftHand').length).toBeGreaterThan(5);
  });

  it('cada pulso soma 0,02 de calor: o feixe contínuo ferve em ~6 s e trava o Mech (a bancada); antes disso, não', () => {
    const r = drill(V, { speed: 0, fire: [W] }, 20);
    expect(r.overheatAt).not.toBeNull();
    expect(r.overheatAt!).toBeGreaterThan(5);
    expect(r.overheatAt!).toBeLessThan(8);
    const s = bench({ primary: W, secondary: null });
    s.hold(1, true);
    expect(s.mech.heat).toBeCloseTo(s.pulsos.length * 0.02, 5);
  });

  it('superaquecido, o feixe não sai', () => {
    const quente: WeaponStats = Object.freeze({ ...weapon('laser'), heatPerShot: 0.6 });
    const s = bench({ primary: quente, secondary: null });
    s.hold(2, true);
    expect(s.pulsos).toHaveLength(2); // 0,6 + 0,6 = ferve
    expect(s.mech.overheated).toBe(true);
  });
});

describe('Match.beamPulse: acerta na hora o primeiro que o feixe encontra, com física de verdade', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  async function palco(dist = 100, damage = true) {
    const physics = await PhysicsWorld.create();
    const foes = { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false };
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false });
    match.combat.damageEnabled = damage;
    const atirador = new Vector09();
    match.addPlayer(atirador, 'Atirador');
    atirador.respawn(new THREE.Vector3(0, 0, 55));
    const alvo = new Vector09();
    match.addPlayer(alvo, 'Alvo');
    alvo.respawn(new THREE.Vector3(0, 0, 55 - dist));
    physics.step();
    physics.step();
    const vida = (m: Vector09): number => m.modules.torso + m.modules.head + m.modules.leftArm + m.modules.rightArm + m.modules.leftLeg + m.modules.rightLeg;
    const origem = new THREE.Vector3(0, 3.3, 54.5);
    const mira = new THREE.Vector3(0, 1.8, 55 - dist).sub(origem).normalize();
    const pulsos: Array<{ w: WeaponStats; owner: unknown }> = [];
    match.onBeam = (_o, _d, owner, w) => pulsos.push({ w, owner });
    const atira = (w: WeaponStats = W): void => match.beamPulse(atirador, origem.clone(), mira.clone(), w);
    return { match, physics, atirador, alvo, vida, atira, pulsos, origem, mira };
  }

  it('um pulso a 100 m tira o dano do tiro direto da distância (6) do alvo, no mesmo tick (sem projétil, sem voo)', async () => {
    const { alvo, vida, atira, match } = await palco(100);
    const antes = vida(alvo);
    atira();
    expect(antes - vida(alvo)).toBe(hitDamage(W, 100));
    expect(match.projectiles).toBeDefined();
  });

  it('o MK III bate 8 por pulso; a defesa pelo caminho do tiro vale (o escudo do Mech segura a parte do dano da natureza `laser`)', async () => {
    const { alvo, vida, atira } = await palco(100);
    const antes = vida(alvo);
    atira(weapon('laser', 2));
    expect(antes - vida(alvo)).toBe(8);
  });

  it('o primeiro que o feixe encontra leva: uma parede no meio segura o pulso (o alvo atrás não leva nada) e o feixe acaba na parede', async () => {
    const { match, physics, alvo, vida, atira } = await palco(100);
    physics.addStaticBox(new THREE.Vector3(0, 5, 25), new THREE.Vector3(30, 10, 1));
    physics.step();
    const antes = vida(alvo);
    atira();
    expect(vida(alvo)).toBe(antes);
    const feixe = (match.beams as unknown as { pool: Array<{ left: number; to: THREE.Vector3 }> }).pool.find((b) => b.left > 0)!;
    expect(feixe.to.z).toBeGreaterThan(24); // a face da parede (z = 25 ± 1) em vez de 100 m adiante
    expect(feixe.to.z).toBeLessThan(27);
  });

  it('um segundo Mech na frente tapa o de trás: só o primeiro leva o pulso', async () => {
    const { match, atira, vida, alvo } = await palco(100);
    const frente = new Vector09();
    match.addPlayer(frente, 'Frente');
    frente.respawn(new THREE.Vector3(0, 0, 25));
    match.physics.step(); // o colisor do Mech novo só muda de lugar no passo da física
    const f0 = vida(frente);
    const a0 = vida(alvo);
    atira();
    expect(f0 - vida(frente)).toBeGreaterThan(0);
    expect(vida(alvo)).toBe(a0);
  });

  it('quem atira nunca se acerta, e atirar para o céu sem nada à frente só acende o feixe até o alcance (360 m), sem dano', async () => {
    const { match, atirador, origem, vida, alvo } = await palco(100);
    const antes = atirador.modules.torso;
    const a0 = vida(alvo);
    match.beamPulse(atirador, origem.clone(), new THREE.Vector3(0, 0.7, -0.7).normalize(), W); // para cima, por cima do alvo
    expect(atirador.modules.torso).toBe(antes);
    expect(vida(alvo)).toBe(a0);
    const feixe = (match.beams as unknown as { pool: Array<{ left: number; from: THREE.Vector3; to: THREE.Vector3 }> }).pool.find((b) => b.left > 0)!;
    expect(feixe.from.distanceTo(feixe.to)).toBeCloseTo(360, 3);
  });

  it('o cliente online (dano desligado) só desenha: o feixe acende, o evento sai, e o alvo não leva nada', async () => {
    const { match, alvo, vida, atira, pulsos } = await palco(100, false);
    const antes = vida(alvo);
    atira();
    expect(vida(alvo)).toBe(antes);
    expect(match.beams.active).toBe(1);
    expect(pulsos).toHaveLength(1);
  });

  it('cada pulso avisa o servidor (`onBeam`, o evento de tiro) com a arma e quem atirou; sem `beam` na arma, a partida ignora o pedido', async () => {
    const { atirador, atira, pulsos, match } = await palco(100);
    atira();
    atira();
    expect(pulsos).toHaveLength(2);
    expect(pulsos[0]!.owner).toBe(atirador.collider);
    expect(pulsos[0]!.w.id).toBe('laser');
    const n = match.beams.active;
    match.beamPulse(atirador, new THREE.Vector3(0, 3, 50), new THREE.Vector3(0, 0, -1), weapon('plasma'));
    expect(pulsos).toHaveLength(2);
    expect(match.beams.active).toBe(n);
  });

  it('o feixe do jogador é do jogador (magenta) e o de um bot, hostil (laranja): quem não está na lista de jogadores da partida é inimigo', async () => {
    const { match, atirador, origem, mira } = await palco(100);
    const cor = (k: number): THREE.Color => (match.beams as unknown as { colors: THREE.Color[] }).colors[k]!;
    match.beamPulse(atirador, origem.clone(), mira.clone(), W);
    expect(cor(0).toArray()).toEqual(GLOW.friendlyLaser.toArray());
    const forasteiro = new Vector09();
    forasteiro.spawn(match.physics, new THREE.Vector3(10, 0, 55));
    match.beamPulse(forasteiro, origem.clone(), mira.clone(), W);
    expect(cor(1).toArray()).toEqual(GLOW.hostileLaser.toArray());
  });

  it('drawBeam (o pulso de OUTRO jogador, pelo evento): acha onde o feixe acaba e o acende, sem dano e sem evento', async () => {
    const { match, atirador, origem, mira, alvo, vida, pulsos } = await palco(100);
    const antes = vida(alvo);
    match.drawBeam(origem.clone(), mira.clone(), atirador.collider, W, true);
    expect(match.beams.active).toBe(1);
    expect(vida(alvo)).toBe(antes);
    expect(pulsos).toHaveLength(0);
    const feixe = (match.beams as unknown as { pool: Array<{ left: number; to: THREE.Vector3 }> }).pool.find((b) => b.left > 0)!;
    expect(feixe.to.z).toBeLessThan(-40); // até o alvo a 100 m (z = -45)
  });
});

describe('BeamVisuals: o feixe aceso (só desenho, pool fixo, em lote)', () => {
  const de = new THREE.Vector3(0, 3, 0);
  const para = new THREE.Vector3(0, 3, -100);

  it('um pulso acende por `glow` segundos e apaga; as duas instâncias (brilho e núcleo) vão num InstancedMesh cada', () => {
    const scene = new THREE.Scene();
    const b = new BeamVisuals(scene);
    expect(scene.children.filter((c) => (c as THREE.InstancedMesh).isInstancedMesh)).toHaveLength(2);
    b.spawn(de, para, false, 0.16);
    expect(b.active).toBe(1);
    for (let i = 0; i < 5; i++) b.update(FIXED_DT);
    expect(b.active).toBe(1); // 0,083 s
    for (let i = 0; i < 6; i++) b.update(FIXED_DT);
    expect(b.active).toBe(0); // 0,18 s
    expect((scene.children[0] as THREE.InstancedMesh).count).toBe(0);
  });

  it('o feixe contínuo: pulsos de 0,13 s com 0,16 s de brilho nunca deixam a linha apagar enquanto o gatilho está apertado', () => {
    const b = new BeamVisuals(new THREE.Scene());
    let t = 0;
    let proximo = 0;
    for (let i = 0; i < 120; i++, t += FIXED_DT) {
      if (t >= proximo) {
        b.spawn(de, para, false, W.beam!.glow);
        proximo += W.fireInterval;
      }
      b.update(FIXED_DT);
      expect(b.active, `t = ${t.toFixed(2)}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('a instância é um cilindro do tamanho do feixe, no meio dele, na direção dele', () => {
    const scene = new THREE.Scene();
    const b = new BeamVisuals(scene);
    b.spawn(new THREE.Vector3(0, 0, 0), new THREE.Vector3(30, 0, 0), true, 0.16);
    b.update(0.001);
    const halo = scene.children[0] as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    halo.getMatrixAt(0, m);
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    m.decompose(p, q, s);
    expect(p.toArray().map((x) => Math.round(x))).toEqual([15, 0, 0]);
    expect(s.z).toBeCloseTo(30, 6); // o comprimento
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(q).x).toBeCloseTo(1, 6); // aponta para +x
  });

  it('pool fixo de 40: cheio, o pulso mais perto de apagar cede o lugar (nada é alocado e nada passa do teto)', () => {
    const scene = new THREE.Scene();
    const b = new BeamVisuals(scene);
    for (let i = 0; i < MAX_BEAMS + 10; i++) {
      b.spawn(de, para, false, 0.16 + i * 0.001);
      b.update(0.0001);
    }
    expect(b.active).toBe(MAX_BEAMS);
    b.clear();
    expect(b.active).toBe(0);
  });
});

describe('equilíbrio: longo alcance sem espera, mas menos dano que o plasma de perto (a regra dos 4,5 s do Comandante, P111)', () => {
  it('sozinho leva mais de 4,5 s para um torso em todo nível (6,4, 5,5 e 4,8 s na bancada, com a trava de calor)', () => {
    for (const t of LEVELS) expect(timeToKill([weapon('laser', t)], V, TORSO), `MK ${t + 1}`).toBeGreaterThan(4.5);
  });

  it('com o plasma, e nas duas mãos do Marauder, nenhuma montagem válida derruba o torso em menos de 2,5 s', () => {
    for (const p of LEVELS) for (const l of LEVELS) expect(timeToKill([weapon('plasma', p), weapon('laser', l)], V, TORSO), `plasma ${p} + laser ${l}`).toBeGreaterThan(2.5);
    expect(timeToKill([weapon('laser', 0), weapon('laser', 0)], V, TORSO)).toBeGreaterThan(2.5);
  });

  it('sustenta menos que o plasma em todo nível e rende menos por tonelada a cada nível', () => {
    for (const t of LEVELS) expect(sustainedDps(weapon('laser', t), V)).toBeLessThan(sustainedDps(weapon('plasma', t), V));
    const porTon = LEVELS.map((t) => sustainedDps(weapon('laser', t), V) / weapon('laser', t).mass);
    expect(porTon[1]!).toBeLessThan(porTon[0]!);
    expect(porTon[2]!).toBeLessThan(porTon[1]!);
  });

  it('o ponto do laser é o alcance: o dano por segundo NOMINAL dele passa o do plasma de 100 m em diante (e é menor de perto)', () => {
    const nominal = (w: WeaponStats, d: number): number => hitDamage(w, d) / w.fireInterval;
    const plasma = weapon('plasma');
    expect(nominal(W, 30)).toBeLessThan(nominal(plasma, 30));
    expect(nominal(W, 250)).toBeGreaterThan(nominal(plasma, 250) * 1.2);
    expect(nominal(W, 300)).toBeGreaterThan(nominal(plasma, 300) * 1.2);
  });
});
