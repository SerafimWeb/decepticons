import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { CHASSIS, VECTOR09_STATS } from '../entities/chassis';
import { Vector09 } from '../entities/Vector09';
import { armOptions } from '../hangar/loadout';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from '../sim/Match';
import { weaponFromNet } from '../net/adapters';
import { NET_WEAPONS } from '../../../shared/net/events';
import { Armament, type ShotSink } from './Armament';
import { SHOULDER_TRIGGERS, type MountId } from './mounts';
import { DAMAGE_TYPE, WEAPON_IDS, hitDamage, weapon, type Loadout, type WeaponStats } from './weapons';

const W = weapon('harpoon');
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;

/**
 * Dono, 11/10: *"vamos VARIAR as armas e tecnologias"* nos ombros. O arpão magnético (P77, revivido na P160) é o terceiro tipo de arma de ombro que não é só mais dano: **prende e puxa**.
 * Um tiro de varredura (sem projétil) de até 55 m que morde (10 de dano) e arrasta o inimigo a 9 m/s por até 1,6 s; as regras do cabo estão em `HookSystem.test.ts`.
 */
describe('arpão magnético: o que é', () => {
  it('é de energia, sem projétil, com cabo (`hook`), 10 de dano, um aperto a cada 4 s, 3 t por boca', () => {
    expect(W.kind).toBe('energy');
    expect(W.speed).toBe(0);
    expect(W.hook).toEqual({ pullSpeed: 9, hold: 1.6, arrive: 3, breakRadius: 2.4 });
    expect(W.damage).toBe(10);
    expect(W.fireInterval).toBe(4);
    expect(W.mass).toBe(3);
    expect(DAMAGE_TYPE.harpoon).toBe('balistico');
  });

  it('o nível dá mais alcance (+20% por nível: 55 / 66 / 77 m) e o cabo é o mesmo', () => {
    expect(([0, 1, 2] as const).map((t) => weapon('harpoon', t).maxRange)).toEqual([55, 66, 77]);
    expect(weapon('harpoon', 2).hook).toEqual(W.hook);
  });

  it('só ele tem cabo; o resto do arsenal segue sem o campo', () => {
    for (const id of WEAPON_IDS) expect(weapon(id).hook !== undefined, id).toBe(id === 'harpoon');
  });

  it('é arma SÓ de ombro: o Marauder a oferece nos ombros e nenhum chassi a oferece nas mãos', () => {
    expect(armOptions('shoulders', 'marauder')).toContain('harpoon');
    for (const id of Object.keys(CHASSIS) as Array<keyof typeof CHASSIS>) {
      expect(armOptions('right', id), id).not.toContain('harpoon');
      expect(armOptions('left', id), id).not.toContain('harpoon');
    }
  });

  it('o protocolo conhece o arpão (no fim da lista, para os índices antigos não mudarem)', () => {
    const i = NET_WEAPONS.indexOf('harpoon');
    expect(i).toBeGreaterThan(0);
    expect(i).toBe(NET_WEAPONS.length - 1);
    expect(weaponFromNet(i)).toBe('harpoon');
  });
});

describe('a regra de tiro (Armament): as duas bocas dos ombros disparam juntas no botão 2', () => {
  interface Cabo {
    t: number;
    mount: MountId;
  }
  function bench(loadout: Loadout) {
    const mech = new Vector09({ stats: { ...VECTOR09_STATS, triggers: SHOULDER_TRIGGERS, loadout }, loadout });
    const armament = new Armament(mech);
    const cabos: Cabo[] = [];
    const outros: string[] = [];
    let t = 0;
    const sink: ShotSink = {
      projectile: () => outros.push('projectile'),
      rocket: () => outros.push('rocket'),
      melee: () => outros.push('melee'),
      flame: () => outros.push('flame'),
      wave: () => outros.push('wave'),
      hook: (mount) => cabos.push({ t, mount }),
    };
    const hold = (seconds: number, fire: boolean, secondary: boolean) => {
      for (let i = 0, n = Math.round(seconds / FIXED_DT); i < n; i++, t += FIXED_DT) armament.fixedUpdate(FIXED_DT, fire, secondary, sink);
    };
    return { mech, cabos, outros, hold };
  }
  const marauder = (): Loadout => ({ primary: weapon('blaster'), offhand: weapon('blaster'), secondary: weapon('harpoon') });

  it('um aperto solta um arpão de CADA ombro no mesmo tick, e nenhum projétil', () => {
    const { cabos, outros, hold } = bench(marauder());
    hold(0.1, false, true);
    expect(cabos.map((c) => c.mount).sort()).toEqual(['leftShoulder', 'rightShoulder']);
    expect(new Set(cabos.map((c) => c.t)).size).toBe(1);
    expect(outros).toEqual([]);
  });

  it('segurando o botão, repete a cada 4 s (2 apertos em 4,2 s) e para quando solta', () => {
    const { cabos, hold } = bench(marauder());
    hold(4.2, false, true);
    expect(cabos).toHaveLength(4);
    const n = cabos.length;
    hold(5, false, false);
    expect(cabos).toHaveLength(n);
  });

  it('cada boca soma o calor dela: 0,3 por aperto (2 x 0,15)', () => {
    const { mech, hold } = bench(marauder());
    hold(0.02, false, true);
    expect(mech.heat).toBeCloseTo(2 * W.heatPerShot, 3);
  });

  it('o botão principal segue atirando as mãos enquanto o secundário solta o cabo', () => {
    const { cabos, outros, hold } = bench(marauder());
    hold(0.5, true, true);
    expect(cabos).toHaveLength(2);
    expect(outros.filter((o) => o === 'projectile').length).toBeGreaterThanOrEqual(2);
  });

  it('sem o gancho no sink (quem não tem arpão), o aperto não quebra nada', () => {
    const mech = new Vector09({ stats: { ...VECTOR09_STATS, triggers: SHOULDER_TRIGGERS, loadout: marauder() }, loadout: marauder() });
    const armament = new Armament(mech);
    const sink: ShotSink = { projectile: () => {}, rocket: () => {}, melee: () => {}, flame: () => {}, wave: () => {} };
    expect(() => armament.fixedUpdate(FIXED_DT, false, true, sink)).not.toThrow();
  });
});

describe('Match.hookShot: prende o primeiro inimigo à vista, com física de verdade', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  /** O atirador em z = 55 olhando para -Z; o alvo `dist` m à frente. `damage` false = o cliente online (só desenha). */
  async function palco(dist = 30, damage = true) {
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
    const raios: Array<{ from: THREE.Vector3; to: THREE.Vector3; hostile: boolean }> = [];
    match.onHookFx = (from, to, _w, hostile) => raios.push({ from: from.clone(), to: to.clone(), hostile });
    const atira = (mount: MountId = 'rightShoulder', w: WeaponStats = W): void => match.hookShot(atirador, origem.clone(), mira.clone(), w, mount);
    return { match, physics, atirador, alvo, vida, atira, raios, origem, mira };
  }

  it('prende o alvo à vista, morde (10 de dano, a defesa do caminho vale) e o primeiro tick de cabo já o puxa para o atirador', async () => {
    const { match, alvo, vida, atira } = await palco(30);
    const antes = vida(alvo);
    atira();
    expect(match.hooks.count).toBe(1);
    expect(antes - vida(alvo)).toBe(hitDamage(W, 30));
    expect(alvo.shove.z).toBe(0);
    match.hooks.fixedUpdate(FIXED_DT);
    expect(alvo.shove.z).toBeGreaterThan(0.3); // para +Z: o atirador está atrás do alvo
    expect(Math.abs(alvo.shove.x)).toBeLessThan(1e-6);
  });

  it('o raio vai da boca até o alvo (acende o desenho) e o dono do tiro vem como amigo do jogador (cabo ciano)', async () => {
    const { atira, raios, origem } = await palco(30);
    atira();
    expect(raios).toHaveLength(1);
    expect(raios[0]!.from.distanceTo(origem)).toBeLessThan(1e-6);
    expect(raios[0]!.to.z).toBeGreaterThan(55 - 30 - 3);
    expect(raios[0]!.to.z).toBeLessThan(55 - 30 + 3);
    expect(raios[0]!.hostile).toBe(false);
  });

  it('além do alcance (55 m) o raio não chega: nada prende, ninguém leva dano, e o raio acende até o fim do alcance', async () => {
    const { match, alvo, vida, atira, raios, origem } = await palco(70);
    const antes = vida(alvo);
    atira();
    expect(match.hooks.count).toBe(0);
    expect(vida(alvo)).toBe(antes);
    expect(raios[0]!.to.distanceTo(origem)).toBeCloseTo(55, 3);
  });

  it('uma parede no meio segura o raio: o alvo atrás não é preso nem ferido, e o raio acaba na parede', async () => {
    const { match, physics, alvo, vida, atira, raios } = await palco(40);
    physics.addStaticBox(new THREE.Vector3(0, 5, 35), new THREE.Vector3(30, 10, 1));
    physics.step();
    const antes = vida(alvo);
    atira();
    expect(match.hooks.count).toBe(0);
    expect(vida(alvo)).toBe(antes);
    expect(raios[0]!.to.z).toBeGreaterThan(34); // a face da parede (z = 35 ± 1), não os 40 m do alvo
    expect(raios[0]!.to.z).toBeLessThan(37);
  });

  it('o primeiro robô que o raio encontra leva: o de trás fica livre', async () => {
    const { match, physics, atirador, alvo, vida, atira } = await palco(40);
    const frente = new Vector09();
    match.addPlayer(frente, 'Frente');
    frente.respawn(new THREE.Vector3(0, 0, 55 - 15));
    physics.step();
    physics.step();
    const antesTras = vida(alvo);
    const antesFrente = vida(frente);
    atira();
    expect(vida(alvo)).toBe(antesTras);
    expect(vida(frente)).toBeLessThan(antesFrente);
    expect(match.hooks.pool.find((h) => h.active)!.target).toBe(frente);
    expect(match.hooks.pool.find((h) => h.active)!.owner).toBe(atirador);
  });

  it('um aliado do jogador na frente do raio não é preso nem ferido: o cabo só prende inimigo', async () => {
    const { match, physics, vida, atira } = await palco(30);
    const aliado = match.allies?.mechs[0];
    expect(aliado, 'a partida de teste tem aliado').toBeDefined();
    aliado!.respawn(new THREE.Vector3(0, 0, 55 - 15));
    physics.step();
    physics.step();
    const antes = vida(aliado as Vector09);
    atira();
    expect(match.hooks.count).toBe(0);
    expect(vida(aliado as Vector09)).toBe(antes);
  });

  it('os dois ombros no mesmo alvo dividem um cabo só (um aperto = dois tiros)', async () => {
    const { match, atira } = await palco(30);
    atira('rightShoulder');
    atira('leftShoulder');
    expect(match.hooks.count).toBe(1);
    const h = match.hooks.pool.find((x) => x.active)!;
    expect([h.mountA, h.mountB]).toEqual(['rightShoulder', 'leftShoulder']);
  });

  it('uma arma sem cabo (`hook` ausente) não faz nada aqui', async () => {
    const { match, atira, raios } = await palco(30);
    atira('rightShoulder', weapon('sonic'));
    expect(match.hooks.count).toBe(0);
    expect(raios).toHaveLength(0);
  });

  it('o cliente online (dano desligado) só desenha o raio: não morde, não prende, não puxa', async () => {
    const { match, alvo, vida, atira, raios } = await palco(30, false);
    const antes = vida(alvo);
    atira();
    expect(raios).toHaveLength(1);
    expect(match.hooks.count).toBe(0);
    expect(vida(alvo)).toBe(antes);
  });

  it('o arpão de outro jogador (drawHook, pelo evento de tiro) acende o raio vermelho sem regra nenhuma', async () => {
    const { match, atirador, alvo, vida, raios, origem, mira } = await palco(30, false);
    const antes = vida(alvo);
    match.drawHook(origem, mira, W, atirador.collider, true);
    expect(raios).toHaveLength(1);
    expect(raios[0]!.hostile).toBe(true);
    expect(match.hooks.count).toBe(0);
    expect(vida(alvo)).toBe(antes);
  });

  it('o cabo do jogo solta quando o alvo usa o dash (o `isDashing` do robô)', async () => {
    const { match, alvo, atira } = await palco(30);
    atira();
    expect(match.hooks.count).toBe(1);
    let fim = '';
    match.hooks.onEnd = (_h, why) => (fim = why);
    Object.defineProperty(alvo, 'isDashing', { get: () => true });
    match.hooks.fixedUpdate(FIXED_DT);
    expect(fim).toBe('dash');
  });
});
