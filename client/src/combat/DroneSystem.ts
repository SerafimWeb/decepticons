import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { SERAFIM_TOWER } from '../environment/SerafimTower';
import type { MechBase } from '../entities/MechBase';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { ProjectileSystem } from './ProjectileSystem';
import { weapon, type WeaponStats } from './weapons';

/**
 * Drones da base Serafim (dono, 06/10: "podem atacar, patrulhar, consertar, reabastecer, kamikazes"). Saem do topo do
 * Prédio Serafim e lutam do lado do jogador. Simulação pura no tick fixo (G1/G2): sem `Math.random`, sem DOM, sem
 * alocação por tick (G4). O desenho é de `fx/DroneVisuals.ts`.
 *
 * Papéis:
 * - **patrulha**: circula a base; inimigo perto da base ou de um amigo vira alvo, e o drone o fustiga com um laser fraco.
 * - **kamikaze**: espera pousado; inimigo perto, mergulha e explode nele (um voo por vida).
 * - **conserto**: paira sobre o amigo mais avariado e devolve vida (e chapa do escudo físico).
 * - **recarga**: paira sobre o amigo mais quente ou com o campo de energia vazio: resfria e recarrega.
 *
 * Voo: cruzeiro a 46 m (acima dos prédios da arena, abaixo do topo do Serafim); só desce perto do alvo. Não é
 * navegação: é a altura que evita paredes. Cada drone tem um colisor pequeno: tiro e explosão o derrubam, e ele volta
 * pela base depois de `RESPAWN_S`.
 *
 * Custo: 4 drones, decisões a 4 Hz e uma linha de visada por drone de ataque a 4 Hz; o resto são contas de vetor.
 */
export type DroneRole = 'patrulha' | 'kamikaze' | 'conserto' | 'recarga';
export type DroneState = 'pouso' | 'voo' | 'abatido';

// Um de cada papel (dono, 06/10: "5 drones, é muito... não podem poluir a tela"): a esquadrilha era 6 e dois
// pares do mesmo papel convergiam para o mesmo alvo e se sobrepunham. Um de cada já mostra os quatro
// comportamentos sem virar enxame; o slot por índice abaixo também evita que um papel repetido no futuro
// volte a empilhar.
export const DRONE_ROSTER: readonly DroneRole[] = ['patrulha', 'kamikaze', 'conserto', 'recarga'];

export const DRONE = Object.freeze({
  hp: 60,
  radius: 1.1,
  speed: 17,
  diveSpeed: 30,
  accel: 34,
  cruiseY: 46,
  /** Topo do prédio: a laje fica em `height + 0.6`. */
  padY: SERAFIM_TOWER.height + 2.2,
  /** Raio de vigília: inimigo a esta distância da base vira alvo. */
  baseGuard: 55,
  /** Inimigo a esta distância de um amigo também vira alvo. */
  friendGuard: 40,
  respawnS: 20,
  kamikazeRespawnS: 25,
  /** Laser do drone de ataque: o blaster com dano de drone. */
  fireInterval: 0.45,
  hoverDistance: 16,
  repairRate: 14,
  ventRate: 0.3,
  energyRate: 20,
  serviceRange: 9,
});

/** Arma do drone de ataque: o blaster (natureza laser), mais fraco. */
export const DRONE_GUN: WeaponStats = Object.freeze({ ...weapon('blaster'), damage: 6 });
/** Explosão do kamikaze: um foguete forte, de raio largo. */
export const KAMIKAZE_BLAST: WeaponStats = Object.freeze({ ...weapon('rockets'), damage: 70, blastRadius: 6 });

export interface Drone {
  readonly role: DroneRole;
  readonly index: number;
  state: DroneState;
  readonly pos: THREE.Vector3;
  /** Posição do tick anterior (o desenho interpola). */
  readonly prev: THREE.Vector3;
  readonly vel: THREE.Vector3;
  hp: number;
  timer: number;
  /** Ângulo da órbita da patrulha (avança só enquanto circula). */
  orbit: number;
  target: MechBase | null;
  /** O feixe de serviço está ligado neste tick (conserto/recarga encostados no alvo). */
  servicing: boolean;
  /** Mergulho do kamikaze em curso. */
  diving: boolean;
  yaw: number;
  body: RAPIER.RigidBody | null;
  collider: RAPIER.Collider | null;
}

const _goal = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _chest = new THREE.Vector3();

export interface DroneSystemOptions {
  physics: PhysicsWorld;
  projectiles: ProjectileSystem;
  particles: ParticleSystem;
  /** Lado do jogador (jogadores e aliados): quem os drones protegem. */
  friends: () => readonly MechBase[];
  /** Quem os drones caçam. */
  enemies: () => readonly MechBase[];
  /** Explosão do kamikaze: o dano é da regra de combate (Match chama `combat.explode` e avisa a tela). */
  explode: (at: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats) => void;
  /** A esquadrilha a montar (padrão: `DRONE_ROSTER`). Só testes trocam, para provar o slot com dois do mesmo papel. */
  roster?: readonly DroneRole[];
}

export class DroneSystem {
  readonly drones: Drone[];
  private think = 0;
  private readonly byCollider = new Map<number, Drone>();

  constructor(private readonly o: DroneSystemOptions) {
    this.drones = (o.roster ?? DRONE_ROSTER).map((role, index) => ({
      role, index, state: 'pouso' as DroneState,
      pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(),
      hp: DRONE.hp, timer: 0, orbit: 0, target: null, servicing: false, diving: false, yaw: 0, body: null, collider: null,
    }));
    const world = o.physics.world;
    for (const d of this.drones) {
      this.padPosition(d, d.pos);
      d.prev.copy(d.pos);
      d.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(d.pos.x, d.pos.y, d.pos.z));
      d.collider = world.createCollider(RAPIER.ColliderDesc.ball(DRONE.radius), d.body);
      this.byCollider.set(d.collider.handle, d);
    }
  }

  /** Vaga de cada drone no topo do prédio (anel central e docas). */
  padPosition(d: Drone, out: THREE.Vector3): THREE.Vector3 {
    const a = (d.index / this.drones.length) * Math.PI * 2;
    return out.set(SERAFIM_TOWER.x - 1 + Math.cos(a) * 4, DRONE.padY, SERAFIM_TOWER.z - 1 + Math.sin(a) * 4);
  }

  /** Drones no ar, vivos (HUD). */
  get flying(): number {
    let n = 0;
    for (const d of this.drones) if (d.state !== 'abatido') n++;
    return n;
  }

  /** Tiro acertou um colisor: se for drone, ele toma o dano. Devolve true quando era drone. */
  hit(collider: RAPIER.Collider, damage: number): boolean {
    const d = this.byCollider.get(collider.handle);
    if (!d) return false;
    this.damage(d, damage);
    return true;
  }

  /** Explosão em `at`: drones no raio levam o dano (sem cair com a distância: são frágeis). */
  explosion(at: THREE.Vector3, w: WeaponStats): void {
    const r = w.blastRadius + DRONE.radius;
    for (const d of this.drones) if (d.state !== 'abatido' && d.pos.distanceToSquared(at) < r * r) this.damage(d, w.damage);
  }

  /** Todos de volta à base, inteiros (rodada nova). */
  resetAll(): void {
    for (const d of this.drones) {
      d.state = 'pouso';
      d.hp = DRONE.hp;
      d.target = null;
      d.diving = d.servicing = false;
      d.vel.set(0, 0, 0);
      this.padPosition(d, d.pos);
      d.prev.copy(d.pos);
      this.place(d);
    }
  }

  fixedUpdate(dt: number): void {
    this.think -= dt;
    const decide = this.think <= 0;
    if (decide) this.think = 0.25;
    for (const d of this.drones) {
      d.prev.copy(d.pos);
      if (d.state === 'abatido') {
        d.timer -= dt;
        if (d.timer <= 0) {
          d.state = 'pouso';
          d.hp = DRONE.hp;
          this.padPosition(d, d.pos);
          d.prev.copy(d.pos);
          d.vel.set(0, 0, 0);
          this.place(d);
        }
        continue;
      }
      if (decide) this.choose(d);
      d.servicing = false;
      switch (d.role) {
        case 'patrulha': this.patrol(d, dt); break;
        case 'kamikaze': this.kamikaze(d, dt); break;
        default: this.service(d, dt); break;
      }
      this.place(d);
    }
  }

  // ---- decisões (4 Hz) ----

  private choose(d: Drone): void {
    if (d.role === 'kamikaze' && d.diving && d.target?.alive) return;
    if (d.role === 'patrulha' || d.role === 'kamikaze') {
      if (d.target && !(d.target.alive && this.threatening(d.target))) d.target = null;
      d.target ??= this.nearestThreat(d.pos);
      if (d.role === 'kamikaze') d.diving = d.target !== null;
      return;
    }
    // Serviço: o amigo que mais precisa (conserto: vida; recarga: calor e energia).
    let best: MechBase | null = null;
    let need = 0.08;
    for (const f of this.o.friends()) {
      if (!f.alive) continue;
      const n = d.role === 'conserto' ? this.damageNeed(f) : this.rechargeNeed(f);
      if (n > need) { need = n; best = f; }
    }
    d.target = best;
  }

  private damageNeed(f: MechBase): number {
    let have = 0;
    let max = 0;
    for (const k of Object.keys(f.stats.maxModuleHealth) as (keyof typeof f.stats.maxModuleHealth)[]) {
      have += f.modules[k];
      max += f.stats.maxModuleHealth[k];
    }
    const plate = f.metalShield.equipped ? (1 - f.metalShield.fraction) * 0.5 : 0;
    return 1 - have / max + plate;
  }

  private rechargeNeed(f: MechBase): number {
    const energy = f.energyShield.equipped ? 1 - f.energyShield.fraction : 0;
    return Math.max(f.heat, energy);
  }

  /** O inimigo está perto da base ou de algum amigo? */
  private threatening(e: MechBase): boolean {
    const p = e.simPosition;
    if (flat(p.x - SERAFIM_TOWER.x, p.z - SERAFIM_TOWER.z) < DRONE.baseGuard) return true;
    for (const f of this.o.friends()) if (f.alive && flat(p.x - f.simPosition.x, p.z - f.simPosition.z) < DRONE.friendGuard) return true;
    return false;
  }

  private nearestThreat(from: THREE.Vector3): MechBase | null {
    let best: MechBase | null = null;
    let bestD = Infinity;
    for (const e of this.o.enemies()) {
      if (!e.alive || !this.threatening(e)) continue;
      const dd = e.simPosition.distanceToSquared(from);
      if (dd < bestD) { bestD = dd; best = e; }
    }
    return best;
  }

  // ---- comportamentos (todo tick) ----

  private patrol(d: Drone, dt: number): void {
    const t = d.target;
    if (!t) {
      // Órbita da base, cada um num ponto do círculo.
      d.orbit += dt * 0.35;
      const a = d.index * Math.PI + d.orbit;
      this.fly(d, _goal.set(SERAFIM_TOWER.x + Math.cos(a) * 26, DRONE.cruiseY - 6, SERAFIM_TOWER.z + Math.sin(a) * 26), DRONE.speed, dt);
      d.state = 'voo';
      return;
    }
    d.state = 'voo';
    const tp = t.simPosition;
    // Paira a `hoverDistance` do alvo, do lado em que já está, 10 m acima da cabeça.
    // Slot fixo por drone (não pela posição de quem voa, que converge quando dois saem do mesmo lado da base):
    // ângulo da base até o alvo, girado por um deslocamento só deste índice. Dois patrulha nunca miram o mesmo ponto.
    const slot = Math.atan2(tp.z - SERAFIM_TOWER.z, tp.x - SERAFIM_TOWER.x) + hoverSlot(d.index);
    _dir.set(Math.cos(slot), 0, Math.sin(slot));
    _goal.set(tp.x + _dir.x * DRONE.hoverDistance, tp.y + t.stats.height + 10, tp.z + _dir.z * DRONE.hoverDistance);
    this.fly(d, _goal, DRONE.speed, dt);
    d.yaw = Math.atan2(-(tp.x - d.pos.x), -(tp.z - d.pos.z));
    d.timer -= dt;
    if (d.timer > 0) return;
    d.timer = DRONE.fireInterval;
    _chest.set(tp.x, tp.y + t.stats.height * 0.6, tp.z);
    const dist = d.pos.distanceTo(_chest);
    if (dist > DRONE_GUN.maxRange * 0.8) return;
    _dir.subVectors(_chest, d.pos).divideScalar(dist);
    _muzzle.copy(d.pos).addScaledVector(_dir, DRONE.radius + 0.4);
    // Só atira com a linha livre: não gasta tiro na parede.
    const first = this.o.physics.firstColliderOnRay(_muzzle, _dir, dist, d.collider ?? undefined);
    if (first && first !== t.collider) return;
    this.o.projectiles.fire(_muzzle, _dir, d.collider ?? undefined, false, DRONE_GUN);
  }

  private kamikaze(d: Drone, dt: number): void {
    const t = d.target;
    if (!d.diving || !t) {
      // Pousado na vaga, girando devagar: pronto para sair.
      this.padPosition(d, _goal);
      this.fly(d, _goal, DRONE.speed, dt);
      d.state = d.pos.distanceToSquared(_goal) < 1 ? 'pouso' : 'voo';
      d.yaw += dt * 0.6;
      return;
    }
    d.state = 'voo';
    const tp = t.simPosition;
    // Mesma ideia do slot da patrulha: se dois kamikazes mirarem o mesmo alvo, cada um mergulha de um lado.
    const slot = hoverSlot(d.index) * 0.5;
    _chest.set(tp.x + Math.cos(slot) * 1.5, tp.y + t.stats.height * 0.55, tp.z + Math.sin(slot) * 1.5);
    const near = flat(d.pos.x - tp.x, d.pos.z - tp.z);
    // Longe: cruzeiro alto; perto: mergulho direto no peito.
    if (near > 22) _goal.set(tp.x, DRONE.cruiseY, tp.z);
    else _goal.copy(_chest);
    this.fly(d, _goal, near > 22 ? DRONE.speed * 1.3 : DRONE.diveSpeed, dt, false);
    d.yaw = Math.atan2(-(tp.x - d.pos.x), -(tp.z - d.pos.z));
    const reach = t.stats.radius + DRONE.radius + 1.2;
    if (d.pos.distanceToSquared(_chest) < reach * reach || (near < t.stats.radius + 1.5 && d.pos.y < tp.y + t.stats.height)) {
      _dir.copy(d.vel).normalize();
      this.o.explode(_muzzle.copy(d.pos), _dir, KAMIKAZE_BLAST);
      this.down(d, DRONE.kamikazeRespawnS, false);
    }
  }

  private service(d: Drone, dt: number): void {
    const t = d.target;
    if (!t) {
      this.padPosition(d, _goal);
      this.fly(d, _goal, DRONE.speed, dt);
      d.state = d.pos.distanceToSquared(_goal) < 1 ? 'pouso' : 'voo';
      return;
    }
    d.state = 'voo';
    const tp = t.simPosition;
    _goal.set(tp.x, tp.y + t.stats.height + 4, tp.z);
    this.fly(d, _goal, DRONE.speed, dt);
    if (d.pos.distanceToSquared(_goal) > DRONE.serviceRange * DRONE.serviceRange) return;
    d.servicing = true;
    if (d.role === 'conserto') t.repair(DRONE.repairRate * dt);
    else {
      t.vent(DRONE.ventRate * dt);
      const s = t.energyShield;
      if (s.equipped && !s.active) s.energy = Math.min(s.stats.capacity, s.energy + DRONE.energyRate * dt);
    }
  }

  // ---- voo e corpo ----

  /** Anda em direção a `goal`: sobe ao cruzeiro para viajar, desce perto; freia ao chegar. */
  private fly(d: Drone, goal: THREE.Vector3, speed: number, dt: number, cruise = true): void {
    const far = flat(goal.x - d.pos.x, goal.z - d.pos.z);
    const leavingBase = flat(d.pos.x - SERAFIM_TOWER.x, d.pos.z - SERAFIM_TOWER.z) < 12 && d.pos.y > SERAFIM_TOWER.height - 2;
    let gy = goal.y;
    if (cruise && far > 18) gy = leavingBase ? Math.max(gy, DRONE.padY + 2) : Math.max(gy, DRONE.cruiseY);
    _dir.set(goal.x - d.pos.x, gy - d.pos.y, goal.z - d.pos.z);
    const dist = _dir.length();
    const want = dist > 1e-4 ? Math.min(speed, dist * 2.2) / dist : 0;
    _dir.multiplyScalar(want);
    // Acelera até a velocidade desejada (sem teletransporte).
    _dir.sub(d.vel);
    const dv = _dir.length();
    const max = DRONE.accel * dt;
    if (dv > max) _dir.multiplyScalar(max / dv);
    d.vel.add(_dir);
    d.pos.addScaledVector(d.vel, dt);
    if (d.pos.y < 1.5) d.pos.y = 1.5;
    if (!d.target && d.role === 'patrulha') d.yaw = Math.atan2(-d.vel.x, -d.vel.z);
  }

  private place(d: Drone): void {
    d.body?.setNextKinematicTranslation(d.pos);
  }

  private damage(d: Drone, amount: number): void {
    if (d.state === 'abatido' || amount <= 0) return;
    d.hp -= amount;
    if (d.hp <= 0) this.down(d, d.role === 'kamikaze' ? DRONE.kamikazeRespawnS : DRONE.respawnS, true);
  }

  private down(d: Drone, respawnS: number, shotDown: boolean): void {
    if (shotDown) this.o.particles.burst(d.pos, _dir.set(0, 1, 0), { count: 18, color: SPARK, speed: 10, life: 0.4, size: 0.7, spread: 1.4 });
    d.state = 'abatido';
    d.timer = respawnS;
    d.target = null;
    d.diving = d.servicing = false;
    d.vel.set(0, 0, 0);
    // Some do mundo físico até voltar (fica bem abaixo do chão).
    d.pos.set(SERAFIM_TOWER.x, -50 - d.index * 3, SERAFIM_TOWER.z);
    d.prev.copy(d.pos);
    this.place(d);
  }

}

const SPARK = new THREE.Color(1.6, 1.3, 0.6);
const flat = (x: number, z: number): number => Math.hypot(x, z);
/** Ângulo estável por drone (radianos): alterna de lado, abrindo um pouco mais a cada par. Sem `Math.random` (G1). */
const hoverSlot = (index: number): number => (index % 2 === 0 ? 1 : -1) * (0.55 + 0.35 * Math.floor(index / 2));
