import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CameraRig } from '../camera/CameraRig';
import { SHOULDER_TRIGGERS } from '../combat/mounts';
import type { BarrageSystem } from '../combat/BarrageSystem';
import { fireKick } from '../combat/fireFeel';
import type { ProjectileSystem } from '../combat/ProjectileSystem';
import type { RocketSystem } from '../combat/RocketSystem';
import { weapon, type Loadout, type WeaponStats } from '../combat/weapons';
import type { InputManager } from '../core/InputManager';
import { MechBase, type MechStats } from '../entities/MechBase';
import { buildMechBlueprintRig, MEDIUM_MECH_BLUEPRINT } from '../entities/mechBlueprint';
import { VECTOR09_STATS } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { PlayerController } from './PlayerController';

interface Shot {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  w: WeaponStats;
}

/**
 * Um Mech com lançadores nos ombros: o corpo procedural mais dois nós de boca nos ombros (o que o rig do Marauder importado
 * traz). Sem os nós, a boca do ombro cai no torso e os dois lançamentos nascem no mesmo ponto.
 */
class ShoulderMech extends MechBase {
  constructor(stats: MechStats, loadout: Loadout) {
    const rig = buildMechBlueprintRig(MEDIUM_MECH_BLUEPRINT, { scaleToHeight: stats.height / MEDIUM_MECH_BLUEPRINT.referenceHeight });
    const side = (x: number) => {
      const node = new THREE.Object3D();
      node.position.set(x, 4.8, -0.2);
      rig.model.add(node);
      return node;
    };
    rig.shoulderMuzzles = { right: side(1.08), left: side(-1.08) };
    super(stats, rig, loadout);
  }
}

/** O jogador local de verdade (regra, controle, Mech), com teclado, câmera e sistemas de tiro de mentira que só anotam. */
async function jogador(loadout: Loadout, triggers = VECTOR09_STATS.triggers) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBox(new THREE.Vector3(0, -1, 0), new THREE.Vector3(200, 2, 200));
  const stats = { ...VECTOR09_STATS, loadout, triggers };
  const mech = new ShoulderMech(stats, loadout);
  mech.spawn(physics, new THREE.Vector3(0, 0, 0));
  physics.step();
  const input = {
    mouseDown: false,
    mouseDown2: false,
    virtualFire: false,
    virtualRocket: false,
    autoFire: false,
    virtualMoveX: 0,
    virtualMoveZ: 0,
    virtualJump: false,
    virtualDash: false,
    virtualShield: false,
    resetVersion: 0,
    isDown: () => false,
    axis: () => 0,
    wasPressed: () => false,
  };
  const aim = { yaw: 0, pitch: 0, moveYaw: 0, point: new THREE.Vector3(0, 2.5, -30) };
  const bolts: Shot[] = [];
  const rockets: Shot[] = [];
  const projectiles = { fire: (origin: THREE.Vector3, dir: THREE.Vector3, _o: unknown, _h: boolean, w: WeaponStats) => bolts.push({ origin: origin.clone(), dir: dir.clone(), w }) };
  const rains: { origin: THREE.Vector3; dir: THREE.Vector3; target: THREE.Vector3; w: WeaponStats; volley: number }[] = [];
  const barrageSys = { fire: (origin: THREE.Vector3, dir: THREE.Vector3, target: THREE.Vector3, _o: unknown, w: WeaponStats, volley: number) => rains.push({ origin: origin.clone(), dir: dir.clone(), target: target.clone(), w, volley }) };
  const rocketSys = { fire: (origin: THREE.Vector3, dir: THREE.Vector3, _o: unknown, w: WeaponStats) => rockets.push({ origin: origin.clone(), dir: dir.clone(), w }) };
  const particles = { burst: () => {} };
  const player = new PlayerController(
    mech,
    input as unknown as InputManager,
    { aim } as unknown as CameraRig,
    projectiles as unknown as ProjectileSystem,
    particles as unknown as ParticleSystem,
    rocketSys as unknown as RocketSystem,
    barrageSys as unknown as BarrageSystem,
  );
  player.active = true;
  let sounds = 0;
  let rocketSounds = 0;
  const kicks: number[] = [];
  player.onShot = () => sounds++;
  player.onRocket = () => rocketSounds++;
  player.onKick = (amount) => kicks.push(amount);
  const run = (seconds: number) => {
    for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++) {
      player.fixedUpdate(FIXED_DT);
      physics.step();
    }
  };
  return { player, physics, mech, input, aim, bolts, rockets, rains, kicks, run, sounds: () => sounds, rocketSounds: () => rocketSounds };
}

/** O tiro sai apontando para a mira? */
const aimedAt = (s: Shot, point: THREE.Vector3): number => s.dir.dot(point.clone().sub(s.origin).normalize());

describe('PlayerController: o tiro do jogador local, ligado à regra de Armament', () => {
  it('o Vector-09 de fábrica atira da mão direita e lança foguetes da esquerda, em direção à mira', async () => {
    const { input, aim, bolts, rockets, run, sounds, rocketSounds, mech } = await jogador({ primary: weapon('plasma'), secondary: weapon('rockets') });
    input.mouseDown = true;
    run(0.5);
    input.mouseDown = false;
    expect(bolts.length).toBeGreaterThanOrEqual(2);
    expect(bolts.every((s) => s.w.id === 'plasma' && s.origin.x > 0)).toBe(true); // a direita do Mech é +X
    expect(bolts.every((s) => aimedAt(s, aim.point) > 0.9999)).toBe(true);
    expect(sounds()).toBe(bolts.length);
    expect(mech.heat).toBeGreaterThan(0);

    input.mouseDown2 = true;
    run(0.1);
    expect(rockets).toHaveLength(1);
    expect(rockets[0]!.origin.x).toBeLessThan(0); // a esquerda
    expect(rocketSounds()).toBe(1);
  });

  it('o Marauder atira com as DUAS mãos, cada boca apontando para a mira (as balas se cruzam no alvo)', async () => {
    const loadout: Loadout = { primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('rockets') };
    const { input, aim, bolts, run, sounds } = await jogador(loadout, SHOULDER_TRIGGERS);
    input.mouseDown = true;
    run(0.5);
    const right = bolts.filter((s) => s.origin.x > 0);
    const left = bolts.filter((s) => s.origin.x < 0);
    expect(right.length).toBeGreaterThanOrEqual(1);
    expect(left.length).toBeGreaterThanOrEqual(1);
    expect(Math.abs(right[0]!.origin.x - left[0]!.origin.x)).toBeGreaterThan(1.5); // bocas bem afastadas
    expect(bolts.every((s) => aimedAt(s, aim.point) > 0.9999)).toBe(true); // mas as duas miram no mesmo ponto
    expect(sounds()).toBe(bolts.length); // um som por tiro
  });

  it('o botão secundário do Marauder lança um foguete de cada ombro, com um som só, em direção à mira', async () => {
    const loadout: Loadout = { primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('rockets') };
    const { input, aim, rockets, run, rocketSounds, bolts } = await jogador(loadout, SHOULDER_TRIGGERS);
    input.mouseDown2 = true;
    run(0.05);
    input.mouseDown2 = false;
    expect(rockets).toHaveLength(2);
    expect(rockets.map((r) => Math.sign(r.origin.x)).sort()).toEqual([-1, 1]);
    expect(rockets.every((r) => Math.abs(r.origin.y - 4.8) < 0.5)).toBe(true); // na altura dos ombros
    expect(rockets.every((r) => aimedAt(r, aim.point) > 0.9999)).toBe(true);
    expect(rocketSounds()).toBe(1); // a salva faz um estrondo, não dois por cima um do outro
    expect(bolts).toHaveLength(0);
  });
});

describe('PlayerController: a chuva de mísseis', () => {
  it('no Marauder os dois ombros soltam a chuva juntos, cada um com a sua ordem (volley) para as bombas não caírem nos mesmos lugares', async () => {
    const loadout: Loadout = { primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('barrage') };
    const { input, rains, rockets, run, rocketSounds } = await jogador(loadout, SHOULDER_TRIGGERS);
    input.mouseDown2 = true;
    run(0.05);
    expect(rockets).toHaveLength(0);
    expect(rains.map((r) => r.volley)).toEqual([0, 1]);
    expect(Math.sign(rains[0]!.origin.x)).not.toBe(Math.sign(rains[1]!.origin.x));
    expect(rocketSounds()).toBe(1);
  });

  it('o botão secundário com a chuva sobe do braço esquerdo e manda o ponto sob a mira como centro, sem soltar foguete reto', async () => {
    const { input, aim, rockets, rains, run, rocketSounds } = await jogador({ primary: weapon('plasma'), secondary: weapon('barrage') });
    input.mouseDown2 = true;
    run(0.05);
    input.mouseDown2 = false;
    expect(rockets).toHaveLength(0);
    expect(rains).toHaveLength(1);
    expect(rains[0]!.target.toArray()).toEqual(aim.point.toArray());
    expect(rains[0]!.origin.x).toBeLessThan(0); // a esquerda
    expect(rains[0]!.w.id).toBe('barrage');
    expect(rains[0]!.volley).toBe(0);
    expect(rocketSounds()).toBe(1);
  });
});


describe('PlayerController: a metralhadora rotatória do jogador local', () => {
  const ROTARY = weapon('rotary');

  it('o primeiro tiro vai na mira; com o cano girando os tiros se espalham, sempre dentro do cone dela', async () => {
    const { input, aim, bolts, run } = await jogador({ primary: ROTARY, secondary: null });
    input.mouseDown = true;
    run(2.5);
    expect(bolts.length).toBeGreaterThan(20);
    expect(bolts.every((s) => s.w.id === 'rotary')).toBe(true);
    expect(aimedAt(bolts[0]!, aim.point)).toBeGreaterThan(0.9999);
    const desvios = bolts.map((s) => Math.acos(Math.min(1, aimedAt(s, aim.point))));
    expect(Math.max(...desvios)).toBeGreaterThan(ROTARY.spin!.spread * 0.7); // o cone abriu
    expect(Math.max(...desvios)).toBeLessThanOrEqual(ROTARY.spin!.spread * 1.05); // e não passa do que a arma diz
    // O cone é do tiro, não da mira: o meio dele continua na mira (nenhum lado é preferido).
    const lado = bolts.reduce((s, b) => s + b.dir.x, 0) / bolts.length - bolts[0]!.dir.x;
    expect(Math.abs(lado)).toBeLessThan(ROTARY.spin!.spread * 0.2);
  });

  it('o tremor vem a cada tiro, mas o som só a cada quarto tiro (20 tiros por segundo não viram 20 estalos)', async () => {
    const { input, bolts, kicks, run, sounds } = await jogador({ primary: ROTARY, secondary: null });
    input.mouseDown = true;
    run(2);
    expect(bolts.length).toBeGreaterThan(20);
    expect(kicks).toHaveLength(bolts.length);
    expect(kicks.every((k) => k === fireKick(ROTARY))).toBe(true);
    expect(sounds()).toBe(Math.ceil(bolts.length / 4));
  });

  it('o som recebe a arma que atirou (para tocar o estalo elétrico, não o do plasma) e o nível de rotação sobe com o gatilho e cai ao soltar', async () => {
    const eletrica = await jogador({ primary: weapon('arc'), secondary: null });
    const armas: string[] = [];
    eletrica.player.onShot = (w) => armas.push(w.id);
    eletrica.input.mouseDown = true;
    eletrica.run(1);
    expect(armas.length).toBeGreaterThanOrEqual(2);
    expect(armas.every((id) => id === 'arc')).toBe(true);
    expect(eletrica.player.spinLevel).toBe(0); // arma sem cano: o medidor nunca acende

    const rotatoria = await jogador({ primary: ROTARY, secondary: null });
    expect(rotatoria.player.spinLevel).toBe(0);
    rotatoria.input.mouseDown = true;
    rotatoria.run(0.6);
    const subindo = rotatoria.player.spinLevel;
    expect(subindo).toBeGreaterThan(0.3);
    expect(subindo).toBeLessThan(1);
    rotatoria.run(1);
    expect(rotatoria.player.spinLevel).toBe(1);
    rotatoria.input.mouseDown = false;
    rotatoria.run(0.5);
    expect(rotatoria.player.spinLevel).toBeLessThan(1);
    expect(rotatoria.player.spinLevel).toBeGreaterThan(0.5);
  });

  it('arma sem rotação não ganha desvio nem perde som: o plasma continua um som por tiro, reto na mira', async () => {
    const { input, aim, bolts, run, sounds } = await jogador({ primary: weapon('plasma'), secondary: null });
    input.mouseDown = true;
    run(2);
    expect(bolts.every((s) => aimedAt(s, aim.point) > 0.9999)).toBe(true);
    expect(sounds()).toBe(bolts.length);
  });
});

describe('PlayerController: o peso do tiro na câmera', () => {
  it('cada tiro de energia dá um tremor do peso da arma; o foguete dá um por aperto, não um por foguete', async () => {
    const { input, bolts, rockets, kicks, run } = await jogador({ primary: weapon('plasma'), secondary: weapon('rockets') });
    input.mouseDown = true;
    run(0.5);
    input.mouseDown = false;
    expect(bolts.length).toBeGreaterThanOrEqual(2);
    expect(kicks).toHaveLength(bolts.length); // um tremor por tiro
    expect(kicks.every((k) => k === fireKick(weapon('plasma')))).toBe(true);

    kicks.length = 0;
    input.mouseDown2 = true;
    run(0.1);
    input.mouseDown2 = false;
    expect(rockets).toHaveLength(1);
    expect(kicks).toEqual([fireKick(weapon('rockets'))]);
    expect(fireKick(weapon('rockets'))).toBeGreaterThan(fireKick(weapon('plasma'))); // o foguete pesa mais que o plasma
  });

  it('a salva de dois ombros do Marauder faz um estrondo só, com o peso de uma arma', async () => {
    const loadout: Loadout = { primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('rockets') };
    const { input, rockets, kicks, run } = await jogador(loadout, SHOULDER_TRIGGERS);
    input.mouseDown2 = true;
    run(0.05);
    expect(rockets).toHaveLength(2);
    expect(kicks).toEqual([fireKick(weapon('rockets'))]);
  });

  it('a chuva de mísseis também pesa uma vez por aperto, mesmo com duas ordens de lançamento', async () => {
    const loadout: Loadout = { primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('barrage') };
    const { input, rains, kicks, run } = await jogador(loadout, SHOULDER_TRIGGERS);
    input.mouseDown2 = true;
    run(0.05);
    expect(rains).toHaveLength(2);
    expect(kicks).toEqual([fireKick(weapon('barrage'))]);
  });

  it('sem tiro não há tremor, e o gancho ausente não quebra o disparo (o servidor e os bots não o usam)', async () => {
    const { player, input, bolts, kicks, run } = await jogador({ primary: weapon('plasma'), secondary: null });
    run(0.3);
    expect(kicks).toHaveLength(0);
    player.onKick = undefined;
    input.mouseDown = true;
    run(0.3);
    expect(bolts.length).toBeGreaterThan(0);
    expect(kicks).toHaveLength(0);
  });
});

describe('escudo por toque', () => {
  it('um toque mantém ligado após soltar; o segundo desliga sem interferir nas armas', async () => {
    const s = await jogador({ primary: weapon('plasma'), secondary: weapon('rockets'), module: 'sphere' });
    const press = () => { s.input.virtualShield = true; s.player.collect(); s.run(1 / 60); };
    press();
    s.run(0.5);
    expect(s.mech.energyShield.active).toBe(true);
    expect(s.mech.energyShield.energy).toBeLessThan(150);
    s.input.mouseDown = true; s.input.mouseDown2 = true; s.run(0.1);
    expect(s.bolts.length).toBeGreaterThan(0);
    expect(s.rockets.length).toBeGreaterThan(0);
    press();
    expect(s.mech.energyShield.active).toBe(false);
    s.physics.world.free();
  });
  it('colapso não religa sozinho, um novo toque religa; pausa e perda de foco cancelam', async () => {
    const s = await jogador({ primary: weapon('plasma'), secondary: null, module: 'frontal' });
    const press = () => { s.input.virtualShield = true; s.player.collect(); s.run(1 / 60); };
    press(); s.run(9);
    expect(s.mech.energyShield.active).toBe(false);
    expect(s.mech.energyShield.energy).toBeGreaterThan(15);
    press(); expect(s.mech.energyShield.active).toBe(true);
    s.input.resetVersion++; s.player.collect(); s.run(1 / 60);
    expect(s.mech.energyShield.active).toBe(false);
    press(); s.player.active = false; s.player.collect(); s.player.active = true; s.run(1 / 60);
    expect(s.mech.energyShield.active).toBe(false);
    s.physics.world.free();
  });
});

describe('as armas novas (P152) no jogador local: o lançador leve, o cruzador e o laser', () => {
  const coolSwarm = (): WeaponStats => Object.freeze({ ...weapon('swarm'), heatPerShot: 0 });

  it('um toque no Ataque 2 solta a salva de 8 mísseis pelo sistema de foguetes, cada um com o desvio dele em volta da mira, e o som sai de quatro em quatro', async () => {
    const { input, aim, rockets, rains, run, rocketSounds, kicks } = await jogador({ primary: weapon('plasma'), secondary: coolSwarm() });
    input.mouseDown2 = true;
    run(1 / 60);
    input.mouseDown2 = false; // soltou: a salva segue
    run(1);
    expect(rockets).toHaveLength(8);
    expect(rains).toHaveLength(0);
    expect(rockets.every((s) => s.w.id === 'swarm')).toBe(true);
    expect(aimedAt(rockets[0]!, aim.point)).toBeGreaterThan(0.99999); // o primeiro vai reto
    const cone = Math.cos(weapon('swarm').salvo!.cone + 0.01);
    for (const s of rockets) expect(aimedAt(s, aim.point)).toBeGreaterThan(cone); // todos dentro do cone
    expect(new Set(rockets.map((s) => s.dir.toArray().map((x) => x.toFixed(5)).join(','))).size).toBeGreaterThanOrEqual(7); // e (quase) todos diferentes
    expect(rocketSounds()).toBe(2); // o 1º e o 5º míssil: o som não repete 8 vezes em meio segundo
    expect(kicks).toHaveLength(2);
  });

  it('os foguetes comuns seguem sem desvio e com o som a cada lançamento (o desvio e o som espaçado são só da salva)', async () => {
    const { input, aim, rockets, run, rocketSounds } = await jogador({ primary: weapon('plasma'), secondary: Object.freeze({ ...weapon('rockets'), heatPerShot: 0 }) });
    input.mouseDown2 = true;
    run(1);
    input.mouseDown2 = false;
    expect(rockets.length).toBeGreaterThanOrEqual(3);
    for (const s of rockets) expect(aimedAt(s, aim.point)).toBeGreaterThan(0.99999);
    expect(rocketSounds()).toBe(rockets.length);
  });

  it('o míssil cruzador vai pelo gancho próprio com o ponto da mira, não pelo sistema de foguetes nem pelo da chuva; um som e um tranco por lançamento', async () => {
    const { player, input, aim, rockets, rains, run, rocketSounds, kicks } = await jogador({ primary: weapon('plasma'), secondary: Object.freeze({ ...weapon('cruise'), heatPerShot: 0 }) });
    const lancados: { w: WeaponStats; target: THREE.Vector3; origin: THREE.Vector3 }[] = [];
    player.cruise = (w, origin, _dir, target) => lancados.push({ w, target: target.clone(), origin: origin.clone() });
    input.mouseDown2 = true;
    run(0.5);
    input.mouseDown2 = false;
    expect(lancados).toHaveLength(1);
    expect(lancados[0]!.w.id).toBe('cruise');
    expect(lancados[0]!.target.toArray()).toEqual(aim.point.toArray());
    expect(rockets).toHaveLength(0);
    expect(rains).toHaveLength(0);
    expect(rocketSounds()).toBe(1);
    expect(kicks).toEqual([fireKick(weapon('cruise'))]);
  });

  it('o laser sai como feixe (o gancho `beam`) na direção da mira, a cada 0,13 s e com o gatilho apertado, sem projétil; o som sai de três em três pulsos', async () => {
    const { player, input, aim, bolts, run, sounds, kicks } = await jogador({ primary: Object.freeze({ ...weapon('laser'), heatPerShot: 0 }), secondary: null });
    const pulsos: { w: WeaponStats; origin: THREE.Vector3; dir: THREE.Vector3 }[] = [];
    player.beam = (w, origin, dir) => pulsos.push({ w, origin: origin.clone(), dir: dir.clone() });
    input.mouseDown = true;
    run(1);
    input.mouseDown = false;
    expect(bolts).toHaveLength(0);
    expect(pulsos.length).toBeGreaterThanOrEqual(7);
    expect(pulsos.length).toBeLessThanOrEqual(8);
    expect(pulsos.every((s) => s.w.id === 'laser' && s.origin.x > 0 && aimedAt(s, aim.point) > 0.9999)).toBe(true);
    expect(sounds()).toBe(Math.ceil(pulsos.length / 3));
    expect(kicks).toHaveLength(pulsos.length);
    const n = pulsos.length;
    run(0.5);
    expect(pulsos).toHaveLength(n); // solto, o feixe para
  });
});
