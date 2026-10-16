import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import { armOptions, validateLoadout } from '../hangar/loadout';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { Armament, type ShotSink } from './Armament';
import { sustainedDps, timeToKill } from './balance';
import { fitsMount } from './mountKinds';
import { DEFAULT_TRIGGERS, SHOULDER_TRIGGERS, type MountId, type TriggerLayout } from './mounts';
import { RocketSystem } from './RocketSystem';
import { applySpread, NO_SPREAD, type Spread } from './spread';
import { RocketLauncher } from './trigger';
import { classFor } from './weaponClass';
import { DAMAGE_TYPE, splashDamage, weapon, WEAPON_IDS, type Loadout, type Tier, type WeaponStats } from './weapons';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const V = VECTOR09_STATS;
const TORSO = V.maxModuleHealth.torso;
const LEVELS: readonly Tier[] = [0, 1, 2];
const TUBOS = [8, 16, 32] as const;

/** O lançador que não esquenta: o teste olha a salva e o carregador, não o calor (que trava o Mech antes de a salva de 32 acabar, sem o resfriamento do passo do Mech). */
const cool = (t: Tier = 0): WeaponStats => Object.freeze({ ...weapon('swarm', t), heatPerShot: 0 });

interface Missile {
  t: number;
  mount: MountId;
  volley: number;
  spread: Spread;
}

/** Um Mech de verdade (o corpo procedural, sem física) com o gatilho ligado e um sink que anota cada míssil, com o desvio que o Armament mandou. */
function bench(loadout: Loadout, triggers: TriggerLayout = DEFAULT_TRIGGERS) {
  const mech = new Vector09({ stats: { ...VECTOR09_STATS, triggers, loadout }, loadout });
  const armament = new Armament(mech);
  const missiles: Missile[] = [];
  let t = 0;
  const sink: ShotSink = {
    projectile: () => {},
    rocket: (mount, _w, volley, spread) => missiles.push({ t, mount, volley, spread: { ...spread } }), // o `spread` é um objeto reaproveitado: copia
    melee: () => {},
    flame: () => {},
    wave: () => {},
  };
  /** Segura os botões por `seconds` (em ticks de 60 Hz); um tick só é um "aperto". */
  const hold = (seconds: number, fire: boolean, secondary = false): void => {
    for (let i = 0, n = Math.max(1, Math.round(seconds / FIXED_DT)); i < n; i++, t += FIXED_DT) armament.fixedUpdate(FIXED_DT, fire, secondary, sink);
  };
  return { mech, armament, missiles, hold, now: () => t };
}
const TAP = FIXED_DT; // um tick apertado

describe('lançador de mísseis leve: o que é (P152)', () => {
  it('é munição leve e explosiva; o nível é o tamanho do lançador: 8, 16 e 32 mísseis (`tierMagazine`)', () => {
    const w = weapon('swarm');
    expect(w.kind).toBe('ammo');
    expect(DAMAGE_TYPE.swarm).toBe('explosivo');
    expect(classFor('swarm', 2)).toBe('light');
    expect(LEVELS.map((t) => weapon('swarm', t).magazine)).toEqual([...TUBOS]);
    // Só ele cresce de carregador com o nível, e só ele tem salva.
    for (const id of WEAPON_IDS) {
      expect(weapon(id, 2).magazine === weapon(id, 0).magazine, id).toBe(id !== 'swarm');
      expect(weapon(id).salvo !== undefined, id).toBe(id === 'swarm');
    }
  });

  it('cada míssil é pequeno: 5 de dano (6 e 7 nos níveis), 2,2 m de explosão, 90 m/s até 150 m; o conjunto pesa 2, 3 e 4 t', () => {
    const w = weapon('swarm');
    expect([w.damage, w.blastRadius, w.speed, w.maxRange, w.fireInterval]).toEqual([5, 2.2, 90, 150, 0.07]);
    expect(LEVELS.map((t) => weapon('swarm', t).damage)).toEqual([5, 6, 7]);
    expect(LEVELS.map((t) => weapon('swarm', t).mass)).toEqual([2, 3, 4]);
    expect(w.blastRadius).toBeLessThan(weapon('seeker').blastRadius);
    expect(w.salvo!.cone).toBeGreaterThan(0.02); // dá para ver a nuvem
    expect(w.salvo!.cone).toBeLessThan(0.1);
  });

  it('cabe em braço, ombro e costas; é oferecido a todo Mech e ao andróide (leve), mas não ao gigante (a leve dos Mechs é pequena demais para ele)', () => {
    for (const kind of ['arm', 'shoulder', 'back'] as const) expect(fitsMount('swarm', kind)).toBe(true);
    expect(armOptions('right', 'vector09')).toContain('swarm');
    expect(armOptions('left', 'vector09')).toContain('swarm');
    expect(armOptions('shoulders', 'marauder')).toContain('swarm');
    expect(armOptions('right', 'android')).toContain('swarm');
    expect(armOptions('right', 'colossus01')).not.toContain('swarm');
  });

  it('as montagens válidas: o Vector-09 leva o lançador em qualquer nível (o MK III com um plasma, 4 + 3 t) e o Marauder o leva nos ombros (MK I, o par pesa 4 t)', () => {
    for (const t of LEVELS) {
      expect(validateLoadout({ v: 1, chassis: 'vector09', right: { id: 'plasma', tier: 0 }, left: { id: 'swarm', tier: t } }), `MK ${t + 1}`).toMatchObject({ ok: true });
    }
    expect(validateLoadout({ v: 1, chassis: 'marauder', right: { id: 'blaster', tier: 0 }, left: { id: 'blaster', tier: 0 }, shoulders: { id: 'swarm', tier: 0 } })).toMatchObject({ ok: true });
  });
});

describe('RocketLauncher: a salva só começa cheia, não se cancela e só recarrega depois do último míssil', () => {
  const tick = (l: RocketLauncher, seconds: number): void => {
    for (let t = 0; t < seconds - 1e-9; t += FIXED_DT) l.fixedUpdate(FIXED_DT);
  };
  /** Atira (um míssil por intervalo) até a salva em curso acabar: devolve quantos saíram nesta chamada. */
  const solta = (l: RocketLauncher): number => {
    let n = 0;
    for (let guarda = 0; guarda < 6000 && (n === 0 || l.committed); guarda++) {
      l.fixedUpdate(FIXED_DT);
      if (l.tryFire()) n++;
    }
    return n;
  };

  it('começou, está comprometida (`committed`) até o último míssil; a arma comum (foguetes) nunca fica comprometida', () => {
    const l = new RocketLauncher(cool());
    expect(l.committed).toBe(false);
    expect(l.tryFire()).toBe(true);
    expect(l.committed).toBe(true);
    expect(solta(l)).toBe(7); // os outros sete saem no ritmo de 0,07 s
    expect(l.ammo).toBe(0);
    expect(l.committed).toBe(false);

    const comum = new RocketLauncher(weapon('rockets'));
    expect(comum.tryFire()).toBe(true);
    expect(comum.committed).toBe(false);
  });

  it('só começa com todos os tubos carregados: com 7 de 8, o gatilho não faz nada, mesmo esperando o intervalo', () => {
    const l = new RocketLauncher(cool());
    solta(l); // esvazia (com o primeiro míssil, que sai já aqui)
    tick(l, 0.35 * 7 + 0.1); // sete tubos de volta (0,35 s por tubo)
    expect(l.ammo).toBe(7);
    expect(l.tryFire()).toBe(false);
    tick(l, 0.5); // o oitavo
    expect(l.ammo).toBe(8);
    expect(l.tryFire()).toBe(true);
  });

  it('no meio da salva nada recarrega: 10 s parado com 6 dos 8 mísseis fora, os 2 que sobram seguem 2 (a salva é que os leva)', () => {
    const l = new RocketLauncher(cool());
    for (let i = 0; i < 6; i++) {
      l.fixedUpdate(FIXED_DT * 5);
      expect(l.tryFire()).toBe(true);
    }
    expect(l.ammo).toBe(2);
    expect(l.committed).toBe(true);
    tick(l, 10);
    expect(l.ammo).toBe(2);
  });

  it('depois do último míssil os tubos voltam um a um, 0,35 s cada: cheio em 8 x 0,35 = 2,8 s no MK I (e 32 x 0,45 = 14,4 s no MK III)', () => {
    const l = new RocketLauncher(cool());
    solta(l);
    tick(l, 2.8 - 0.05);
    expect(l.ammo).toBe(7);
    tick(l, 0.1);
    expect(l.ammo).toBe(8);

    const grande = new RocketLauncher(cool(2));
    solta(grande);
    expect(grande.ammo).toBe(0);
    tick(grande, 14.4 - 0.1);
    expect(grande.ammo).toBe(31);
    tick(grande, 0.2);
    expect(grande.ammo).toBe(32);
  });

  it('refill (renasceu, rodada nova) apaga o compromisso: carregador cheio e nada comprometido', () => {
    const l = new RocketLauncher(cool());
    l.tryFire();
    expect(l.committed).toBe(true);
    l.refill();
    expect(l.committed).toBe(false);
    expect(l.ammo).toBe(8);
  });
});

describe('Armament: um aperto esvazia o lançador (ordem P152: 8, 16 ou 32 mísseis em sequência)', () => {
  it('um tick de botão apertado (e depois solto) solta a salva inteira: 8, 16 e 32 nos três níveis, no botão 2 e no botão 1', () => {
    for (const t of LEVELS) {
      const sec = bench({ primary: weapon('blaster'), secondary: cool(t) });
      sec.hold(TAP, false, true);
      sec.hold(4, false, false); // solta: a salva segue sozinha
      expect(sec.missiles, `Ataque 2, MK ${t + 1}`).toHaveLength(TUBOS[t]!);

      const pri = bench({ primary: cool(t), secondary: null });
      pri.hold(TAP, true);
      pri.hold(4, false);
      expect(pri.missiles, `Ataque 1, MK ${t + 1}`).toHaveLength(TUBOS[t]!);
      expect(pri.missiles.every((m) => m.mount === 'rightHand')).toBe(true);
    }
  });

  it('os mísseis saem um a um a cada 0,07 s (sem arredondar para o tick): a salva de 8 dura 0,49 s e a de 32, 2,17 s', () => {
    for (const t of [0, 2] as const) {
      const s = bench({ primary: weapon('blaster'), secondary: cool(t) });
      s.hold(TAP, false, true);
      s.hold(4, false, false);
      const ts = s.missiles.map((m) => m.t);
      const passos = ts.slice(1).map((x, i) => x - ts[i]!);
      for (const p of passos) {
        expect(p).toBeGreaterThan(0.05);
        expect(p).toBeLessThan(0.09);
      }
      expect((ts.at(-1)! - ts[0]!) / (ts.length - 1)).toBeCloseTo(0.07, 2);
    }
  });

  it('a arma comum de munição (foguetes) NÃO é comprometida: um tick de aperto solta um foguete só', () => {
    const s = bench({ primary: weapon('blaster'), secondary: Object.freeze({ ...weapon('rockets'), heatPerShot: 0 }) });
    s.hold(TAP, false, true);
    s.hold(2, false, false);
    expect(s.missiles).toHaveLength(1);
  });

  it('segurando o botão: salva, os tubos recarregam (8 x 0,35 s depois do último míssil) e a próxima salva só sai com todos carregados', () => {
    const s = bench({ primary: weapon('blaster'), secondary: cool() });
    s.hold(1, false, true);
    expect(s.missiles).toHaveLength(8); // o botão segue apertado, e com os tubos vazios nada sai
    const ultimo = s.missiles.at(-1)!.t;
    s.hold(1.5, false, true); // a meio da recarga, com o botão apertado: nenhuma salva parcial
    expect(s.missiles).toHaveLength(8);
    s.hold(3, false, true);
    expect(s.missiles).toHaveLength(16);
    const primeiroDaSegunda = s.missiles[8]!.t;
    expect(primeiroDaSegunda).toBeGreaterThanOrEqual(ultimo + 8 * 0.35 - 1e-6);
    expect(primeiroDaSegunda).toBeLessThan(ultimo + 8 * 0.35 + 0.1);
  });

  it('o calor é por míssil: a salva de 8 soma 8 x 0,012 e a de 32 (MK III) 32 x 0,016, no dissipador do Mech', () => {
    const a = bench({ primary: weapon('blaster'), secondary: weapon('swarm') });
    a.hold(TAP, false, true);
    a.hold(2, false, false);
    expect(a.mech.heat).toBeCloseTo(8 * weapon('swarm').heatPerShot, 5);
    const c = bench({ primary: weapon('blaster'), secondary: weapon('swarm', 2) });
    c.hold(TAP, false, true);
    c.hold(4, false, false);
    expect(c.mech.heat).toBeCloseTo(32 * weapon('swarm', 2).heatPerShot, 5);
    expect(c.mech.overheated).toBe(false); // uma salva cheia do MK III não ferve o Mech sozinha (0,51)
  });

  it('os dois ombros do Marauder: cada intervalo solta um míssil de CADA ombro, a salva tem 8 de cada lado e UM carregador (não dois)', () => {
    const s = bench({ primary: weapon('blaster'), offhand: weapon('blaster'), secondary: cool() }, SHOULDER_TRIGGERS);
    s.hold(TAP, false, true);
    s.hold(2, false, false);
    expect(s.missiles).toHaveLength(16);
    expect(s.missiles.filter((m) => m.mount === 'leftShoulder')).toHaveLength(8);
    expect(s.missiles.filter((m) => m.mount === 'rightShoulder')).toHaveLength(8);
    expect(s.missiles.filter((m) => m.volley === 0)).toHaveLength(8);
    expect(new Set(s.missiles.filter((m) => m.volley === 0).map((m) => m.t)).size).toBe(8); // um por intervalo: sai um par por vez
  });

  it('superaquecer no meio da salva a PAUSA, não a cancela nem reinicia: os mísseis que faltam saem quando o Mech esfria, sem passar dos 8', () => {
    const quente: WeaponStats = Object.freeze({ ...weapon('swarm'), heatPerShot: 0.3 });
    const s = bench({ primary: weapon('blaster'), secondary: quente });
    s.hold(TAP, false, true);
    s.hold(3, false, false);
    expect(s.missiles).toHaveLength(4); // 0,3 + 0,6 + 0,9 + 1,2: ferve no quarto
    expect(s.mech.overheated).toBe(true);
    (s.mech as unknown as { heatSink: { heat: number; overheated: boolean } }).heatSink.heat = 0;
    (s.mech as unknown as { heatSink: { heat: number; overheated: boolean } }).heatSink.overheated = false;
    s.hold(0.1, false, false);
    expect(s.armament.launcher.committed).toBe(true); // ainda é a mesma salva
    s.hold(2, false, false);
    expect(s.missiles.length).toBeGreaterThan(4);
    expect(s.missiles.length).toBeLessThanOrEqual(8);
  });

  it('morrer no meio da salva a encerra: o lançador renasce cheio e sem compromisso (o refill do Armament)', () => {
    const s = bench({ primary: weapon('blaster'), secondary: cool() });
    s.hold(TAP, false, true);
    s.hold(0.2, false, false);
    expect(s.armament.launcher.committed).toBe(true);
    s.mech.modules.torso = 0;
    s.hold(0.1, false, false);
    expect(s.armament.launcher.committed).toBe(false);
    expect(s.armament.launcher.ammo).toBe(8);
  });

  it('trocar de arma no Hangar (rearm) apaga a salva em curso', () => {
    const s = bench({ primary: weapon('blaster'), secondary: cool() });
    s.hold(TAP, false, true);
    expect(s.armament.launcher.committed).toBe(true);
    s.armament.rearm();
    expect(s.armament.launcher.committed).toBe(false);
    expect(s.armament.launcher.ammo).toBe(8);
  });
});

describe('o desvio de cada míssil: uma nuvem fixa, sem sorteio (G1/G2)', () => {
  const salva = (): Missile[] => {
    const s = bench({ primary: weapon('blaster'), secondary: cool(1) });
    s.hold(TAP, false, true);
    s.hold(3, false, false);
    return s.missiles;
  };

  it('o primeiro míssil vai reto e os outros se espalham dentro do cone (2,6°): nenhum passa da abertura, e quase todos são diferentes', () => {
    const m = salva();
    const cone = weapon('swarm').salvo!.cone;
    expect(m[0]!.spread).toEqual({ x: 0, y: 0 });
    for (const x of m) expect(Math.hypot(x.spread.x, x.spread.y)).toBeLessThanOrEqual(cone + 1e-12);
    const distintos = new Set(m.map((x) => `${x.spread.x.toFixed(6)},${x.spread.y.toFixed(6)}`));
    expect(distintos.size).toBe(m.length);
    // preenche o cone: sobem em raio, e algum passa de 80% dele
    expect(Math.max(...m.map((x) => Math.hypot(x.spread.x, x.spread.y)))).toBeGreaterThan(cone * 0.8);
  });

  it('é determinística: o servidor e o cliente chegam à mesma nuvem (dois Armament, a mesma sequência de desvios)', () => {
    expect(salva().map((m) => m.spread)).toEqual(salva().map((m) => m.spread));
  });

  it('a conta de número de míssil segue entre as salvas (a nuvem não repete o mesmo desenho a cada salva)', () => {
    const s = bench({ primary: weapon('blaster'), secondary: cool() });
    s.hold(1, false, true);
    s.hold(4, false, true);
    expect(s.missiles).toHaveLength(16);
    expect(s.missiles[8]!.spread).not.toEqual(s.missiles[0]!.spread);
  });

  it('as outras armas de munição saem sem desvio (o foguete, o teleguiado, o cruzador: reto até a mira)', () => {
    for (const id of ['rockets', 'seeker', 'cruise', 'barrage'] as const) {
      const s = bench({ primary: weapon('blaster'), secondary: Object.freeze({ ...weapon(id), heatPerShot: 0 }) });
      s.hold(0.1, false, true);
      expect(s.missiles.length, id).toBeGreaterThan(0);
      for (const m of s.missiles) expect(m.spread, id).toEqual({ x: 0, y: 0 });
    }
  });

  it('applySpread vira a direção por esse desvio sem mudar o tamanho dela, e o desvio zero a devolve intacta', () => {
    const d = new THREE.Vector3(0, 0, -1);
    applySpread(d, NO_SPREAD);
    expect(d.toArray()).toEqual([0, 0, -1]);
    applySpread(d, { x: 0.03, y: -0.02 });
    expect(d.length()).toBeCloseTo(1, 9);
    expect(Math.acos(-d.z)).toBeCloseTo(Math.hypot(0.03, 0.02), 3);
  });
});

describe('RocketSystem: os mísseis leves num pool à parte, desenhados em lote', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  const ORIGEM = new THREE.Vector3(0, 3, 20);
  const FRENTE = new THREE.Vector3(0, 0, -1);
  async function mundo() {
    const physics = await PhysicsWorld.create();
    const scene = new THREE.Scene();
    physics.addStaticBox(new THREE.Vector3(0, 5, -40), new THREE.Vector3(60, 10, 1)); // uma parede a 60 m da boca (o `Match` põe as da Arena; aqui o mundo está vazio)
    const sys = new RocketSystem(scene, physics, NO_FX);
    const explosoes: Array<{ at: THREE.Vector3; w: WeaponStats }> = [];
    const disparados: WeaponStats[] = [];
    sys.onExplode = (at, _d, _o, w) => explosoes.push({ at: at.clone(), w });
    sys.onFired = (_o, _d, _ow, w) => disparados.push(w);
    const voa = (s: number): void => {
      for (let t = 0; t < s - 1e-9; t += FIXED_DT) {
        sys.fixedUpdate(FIXED_DT);
        physics.step();
      }
    };
    const micro = () => (sys as unknown as { microMesh: THREE.InstancedMesh }).microMesh;
    const pool = () => (sys as unknown as { pool: Array<{ life: number }> }).pool;
    return { sys, voa, explosoes, disparados, micro, pool, physics, scene };
  }

  it('cada míssil leve ocupa o pool dele (128), não o dos foguetes (24), e explode ao bater (aqui, numa parede a 60 m)', async () => {
    const { sys, voa, explosoes, pool } = await mundo();
    for (let i = 0; i < 5; i++) sys.fire(ORIGEM, FRENTE, undefined, weapon('swarm'));
    expect(sys.microActive).toBe(5);
    expect(pool().every((r) => r.life <= 0)).toBe(true); // o pool dos foguetes ficou intacto
    voa(1.6);
    expect(sys.microActive).toBe(0);
    expect(explosoes).toHaveLength(5);
    for (const e of explosoes) {
      expect(e.w.id).toBe('swarm');
      expect(e.at.z).toBeGreaterThan(-40); // parou na frente da parede (z = -39,5 a -40,5), nos 60 m que levam 0,67 s a 90 m/s
      expect(e.at.z).toBeLessThan(-38);
    }
  });

  it('um foguete comum não gasta o pool leve', async () => {
    const { sys } = await mundo();
    sys.fire(ORIGEM, FRENTE, undefined, weapon('rockets'));
    expect(sys.microActive).toBe(0);
  });

  it('pool cheio: o míssil novo toma o lugar do mais velho (nenhum evento se perde e nenhum míssil novo some)', async () => {
    const { sys, disparados, voa } = await mundo();
    const alto = new THREE.Vector3(0, 40, 20); // sem nada à frente: não explodem em 0,4 s
    for (let i = 0; i < 128; i++) sys.fire(alto, FRENTE, undefined, weapon('swarm'));
    voa(FIXED_DT);
    expect(sys.microActive).toBe(128);
    sys.fire(alto, new THREE.Vector3(1, 0, 0), undefined, weapon('swarm')); // o 129º
    expect(sys.microActive).toBe(128);
    expect(disparados).toHaveLength(129);
    // ... e o 129º está de verdade no ar (voando para +x), no lugar de um dos mais velhos: não foi só o evento que saiu
    const micro = (sys as unknown as { micro: Array<{ life: number; velocity: THREE.Vector3 }> }).micro;
    expect(micro.filter((r) => r.life > 0 && r.velocity.x > 80)).toHaveLength(1);
  });

  it('o desenho: uma instância por míssil vivo num InstancedMesh só (uma chamada de desenho), que zera com o `clear`', async () => {
    const { sys, micro, voa, scene } = await mundo();
    for (let i = 0; i < 6; i++) sys.fire(ORIGEM, FRENTE, undefined, weapon('swarm'));
    voa(0.2);
    sys.render(0.5);
    expect(micro().count).toBe(6);
    expect(scene.children.filter((c) => (c as THREE.InstancedMesh).isInstancedMesh)).toContain(micro());
    // a instância anda com o míssil: a primeira está a ~18 m da boca depois de 0,2 s a 90 m/s
    const m = new THREE.Matrix4();
    micro().getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).z).toBeLessThan(ORIGEM.z - 14);
    sys.clear();
    expect(sys.microActive).toBe(0);
    sys.render(0);
    expect(micro().count).toBe(0);
  });
});

describe('a explosão pequena e a partida de verdade (Match + física): a nuvem de 8 mísseis num Mech parado', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('cada míssil bate no máximo o dano dele: 5 no centro, zero na borda de 2,2 m, e o MK III 7', () => {
    const w = weapon('swarm');
    expect(splashDamage(w, 0)).toBe(5);
    expect(splashDamage(w, w.blastRadius)).toBe(0);
    expect(splashDamage(w, w.blastRadius / 2)).toBe(Math.round(5 / 2));
    expect(splashDamage(weapon('swarm', 2), 0)).toBe(7);
  });

  /** A salva inteira do Armament contra um Vector-09 parado a `dist` metros, na Arena de verdade; devolve a vida que sobrou e o dano. */
  async function salvaContra(dist: number, tier: Tier = 0) {
    const physics = await PhysicsWorld.create();
    const foes = { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false };
    const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes, debris: false });
    const atirador = new Vector09();
    match.addPlayer(atirador, 'Atirador');
    atirador.respawn(new THREE.Vector3(0, 0, 55));
    const alvo = new Vector09();
    match.addPlayer(alvo, 'Alvo');
    alvo.respawn(new THREE.Vector3(0, 0, 55 - dist));
    physics.step();
    physics.step();
    const vida = (m: Vector09): number => m.modules.torso + m.modules.head + m.modules.leftArm + m.modules.rightArm + m.modules.leftLeg + m.modules.rightLeg;
    const antes = vida(alvo);
    const loadout: Loadout = { primary: weapon('blaster'), secondary: cool(tier) };
    const mech = new Vector09({ stats: { ...VECTOR09_STATS, loadout }, loadout });
    const armament = new Armament(mech);
    const origem = new THREE.Vector3(0, 3.3, 54.5);
    const mira = new THREE.Vector3(0, 1.8, 55 - dist).sub(origem).normalize();
    const d = new THREE.Vector3();
    const sink: ShotSink = {
      projectile: () => {},
      melee: () => {},
      flame: () => {},
      wave: () => {},
      rocket: (_m, w, _v, spread) => match.rockets.fire(origem, applySpread(d.copy(mira), spread), atirador.collider, w),
    };
    armament.fixedUpdate(FIXED_DT, false, true, sink); // um aperto
    for (let t = 0; t < 4; t += FIXED_DT) {
      armament.fixedUpdate(FIXED_DT, false, false, sink); // solto: a salva segue
      match.rockets.fixedUpdate(FIXED_DT);
      physics.step();
    }
    return { dano: antes - vida(alvo), alvo, atirador };
  }

  it('a 30 m a salva de 8 acerta quase tudo (cone de 2,6°: ~1,4 m de raio): entre 20 e 40 de dano, nunca mais que 8 x 5', async () => {
    const { dano } = await salvaContra(30);
    expect(dano).toBeGreaterThan(20);
    expect(dano).toBeLessThanOrEqual(8 * 5);
  });

  it('a 100 m a mesma nuvem já é maior que o corpo (4,5 m de raio) e a salva rende bem menos: posicionamento conta', async () => {
    const perto = await salvaContra(30);
    const longe = await salvaContra(100);
    expect(longe.dano).toBeLessThan(perto.dano * 0.6);
  });

  it('o MK III (32 mísseis) a 30 m bate mais que o MK I, mas uma salva toda, mesmo acertando tudo, não derruba um torso (32 x 7 = 224 < 300)', async () => {
    const um = await salvaContra(30, 0);
    const tres = await salvaContra(30, 2);
    expect(tres.dano).toBeGreaterThan(um.dano * 3);
    expect(32 * weapon('swarm', 2).damage).toBeLessThan(TORSO);
    expect(tres.dano).toBeLessThan(TORSO);
  });
});

describe('equilíbrio: o lançador leve satura, não derruba (a bancada conta só 55% dos mísseis num alvo parado)', () => {
  it('sozinho leva mais de 20 s para um torso em todo nível (regra dos 4,5 s do Comandante, P111, com folga: é arma leve)', () => {
    for (const t of LEVELS) expect(timeToKill([weapon('swarm', t)], V, TORSO), `MK ${t + 1}`).toBeGreaterThan(20);
  });

  it('contar todos os mísseis como acertos (como se a nuvem não abrisse) derrubaria bem mais depressa: a fração `onTarget` é o que mantém a conta honesta', () => {
    const w = weapon('swarm', 2);
    const todos: WeaponStats = { ...w, salvo: { ...w.salvo!, onTarget: 1 } };
    expect(timeToKill([todos], V, TORSO)).toBeLessThan(timeToKill([w], V, TORSO) * 0.7);
  });

  it('o nível é o golpe de abertura, não o dano sustentado: de MK I a MK III a salva cresce 4x em mísseis e ~11x no golpe, e o dano por segundo continua na mesma faixa (< 1,3x)', () => {
    const golpe = (t: Tier): number => weapon('swarm', t).magazine * weapon('swarm', t).damage;
    expect(golpe(2) / golpe(0)).toBeGreaterThan(5);
    const dps = LEVELS.map((t) => sustainedDps(weapon('swarm', t), V));
    expect(dps[2]! / dps[0]!).toBeLessThan(1.3);
    expect(dps[0]!).toBeLessThan(sustainedDps(weapon('plasma'), V) / 4); // arma leve: bem abaixo do plasma
  });

  it('com o plasma, os dois ombros do Marauder em nenhum nível derrubam o torso em menos de 2,5 s (a meta dos dois braços juntos)', () => {
    for (const p of LEVELS) for (const r of LEVELS) expect(timeToKill([weapon('plasma', p), weapon('swarm', r), weapon('swarm', r)], V, TORSO), `plasma ${p} + 2 lançadores ${r}`).toBeGreaterThan(2.5);
  });
});
