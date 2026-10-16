import { ChargeTimer } from './ChargeTimer';
import { HeatSink, OVERHEAT_SPEED, type ChassisHeat } from './heat';
import { FireTimer, FuelTank, RocketLauncher, SpinUp } from './trigger';
import type { WeaponStats } from './weapons';

/** Passo do tick fixo (o mesmo do PhysicsWorld, repetido para o site ler este arquivo sem o Rapier). */
const DT = 1 / 60;

/**
 * Um exercício de bancada (a "oficina"): como o Mech anda, atira e manobra durante a medição. Roda as
 * mesmas regras do tick fixo que o jogo: cadência (`FireTimer`), carregador (`RocketLauncher`) e o
 * dissipador do Mech inteiro (`HeatSink`: tiro, corrida, pulo, dash; superaquecido trava tudo e anda na
 * metade). Todos os tiros acertam, no alcance ótimo: é o teto teórico. Serve às metas de equilíbrio
 * (testes) e aos gráficos da oficina no site.
 */
export interface Drill {
  /** Velocidade no chão, como fração da máxima (0 = parado, 1 = correndo). */
  speed: number;
  /** Armas com o gatilho apertado (vazio = não atira). */
  fire: readonly WeaponStats[];
  /** Rajadas: tiros da primeira arma por rajada e a pausa (s) entre elas. Sem isso, gatilho direto. */
  burst?: { shots: number; pause: number };
  /** Na pausa entre rajadas, para de andar (parado esfria em dobro). */
  stopInPause?: boolean;
  /** Um dash a cada tantos segundos. */
  dashEvery?: number;
  /** Um pulo a cada tantos segundos. */
  jumpEvery?: number;
  /** Cada tiro que sai (segundo do exercício e a arma): o teste de disparo do Hangar desenha a partir disto. */
  onShot?: (t: number, w: WeaponStats) => void;
}

export interface DrillResult {
  /** Segundos até tirar a vida pedida (ou a duração toda). */
  time: number;
  /** Dano causado. */
  damage: number;
  /** Calor (0–1) a cada amostra. */
  heat: number[];
  /** 1 nas amostras em que o Mech estava travado por superaquecimento. */
  locked: number[];
  /** Primeiro superaquecimento (s), ou null se não ferveu. */
  overheatAt: number | null;
  /** Fração do tempo com o Mech travado. */
  lockedShare: number;
}

export function drill(chassis: ChassisHeat, d: Drill, seconds: number, hp = Infinity, sampleEvery = 0.1): DrillResult {
  const heat = new HeatSink(chassis);
  const guns = d.fire.map((w) => ({
    w,
    charge: new ChargeTimer(),
    feed: w.kind === 'ammo' ? new RocketLauncher(w) : null,
    tank: w.flame ? new FuelTank(w.flame.fuel, w.flame.reload) : null,
    timer: new FireTimer(),
    spin: new SpinUp(),
  }));
  const every = Math.max(1, Math.round(sampleEvery / DT));
  const ticks = Math.round(seconds / DT);
  const out: DrillResult = { time: ticks * DT, damage: 0, heat: [], locked: [], overheatAt: null, lockedShare: 0 };
  let nextDash = d.dashEvery ?? Infinity;
  let nextJump = d.jumpEvery ?? Infinity;
  let inBurst = 0;
  let pause = 0;
  let lockedTicks = 0;
  let i = 0;
  for (; i <= ticks; i++) {
    const t = i * DT;
    // Mesma ordem do jogo: o Mech esfria (e esquenta correndo) no tick dele, depois manobra e atira.
    const speed = pause > 0 && d.stopInPause ? 0 : d.speed;
    heat.fixedUpdate(DT, speed * (heat.overheated ? OVERHEAT_SPEED : 1));
    if (t >= nextDash) {
      if (!heat.overheated) heat.add(chassis.heatDash);
      nextDash += d.dashEvery!;
    }
    if (t >= nextJump) {
      if (!heat.overheated) heat.add(chassis.heatJump);
      nextJump += d.jumpEvery!;
    }
    pause = Math.max(0, pause - DT);
    guns.forEach((g, k) => {
      let fired: boolean;
      if (g.feed) {
        g.feed.fixedUpdate(DT);
        fired = pause <= 0 && !heat.overheated && g.feed.tryFire();
      } else if (g.tank) {
        // Lança-chamas: a chama acende com o gatilho apertado e há combustível; um pulso a cada `fireInterval`, como no Armament.
        g.timer.fixedUpdate(DT);
        const lit = g.tank.step(DT, pause <= 0 && !heat.overheated);
        fired = lit && g.timer.ready;
        if (fired) g.timer.shot(g.w.fireInterval);
      } else {
        g.timer.fixedUpdate(DT);
        // A rotatória gira com o gatilho apertado (a cadência sobe com a rotação), como no Armament.
        if (g.w.spin) g.spin.step(DT, pause <= 0 && !heat.overheated, g.w.spin);
        fired = g.charge.step(DT, pause <= 0, g.timer.ready && !heat.overheated, g.w.chargeTime);
        if (fired) g.timer.shot(g.spin.interval(g.w));
      }
      if (!fired) return;
      // A chuva de mísseis conta as bombas que pegam um alvo parado no meio dela (`Barrage.onTarget`) e o lançador leve, a fração dos mísseis da salva que acerta (`Salvo.onTarget`);
      // a escopeta, todos os balins (no alcance ótimo o cone cabe num Mech); as outras armas, o tiro inteiro.
      out.damage += g.w.damage * (g.w.barrage?.onTarget ?? g.w.salvo?.onTarget ?? 1) * (g.w.pellets?.count ?? 1);
      heat.add(g.w.heatPerShot);
      d.onShot?.(t, g.w);
      if (k === 0 && d.burst && ++inBurst >= d.burst.shots) {
        inBurst = 0;
        pause = d.burst.pause;
      }
    });
    if (heat.overheated) {
      lockedTicks++;
      out.overheatAt ??= t;
    }
    if (i % every === 0) {
      out.heat.push(heat.heat);
      out.locked.push(heat.overheated ? 1 : 0);
    }
    if (out.damage >= hp) {
      out.time = t;
      break;
    }
  }
  out.lockedShare = lockedTicks / Math.min(i + 1, ticks + 1);
  return out;
}

export interface FireResult {
  /** Segundos até tirar a vida pedida (ou o tempo todo, se não tirou). */
  time: number;
  /** Dano causado nesse tempo. */
  damage: number;
}

/** Gatilho apertado com todas as armas, a `speed` constante (padrão: parado, o melhor caso de calor). */
export function fireHeld(weapons: readonly WeaponStats[], chassis: ChassisHeat, seconds: number, hp = Infinity, speed = 0): FireResult {
  const r = drill(chassis, { speed, fire: weapons }, seconds, hp);
  return { time: r.time, damage: r.damage };
}

/** Segundos para derrubar uma parte com `hp` de vida (Infinity se não derruba em 2 min). */
export function timeToKill(weapons: readonly WeaponStats[], chassis: ChassisHeat, hp: number): number {
  const r = fireHeld(weapons, chassis, 120, hp);
  return r.damage >= hp ? r.time : Infinity;
}

/** Dano por segundo com o gatilho apertado por `seconds` (inclui as travas por calor e as recargas). */
export function sustainedDps(w: WeaponStats, chassis: ChassisHeat, seconds = 30): number {
  return fireHeld([w], chassis, seconds).damage / seconds;
}
