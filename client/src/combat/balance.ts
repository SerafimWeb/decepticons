import { HeatSink, type ChassisHeat } from './heat';
import { FireTimer, RocketLauncher } from './trigger';
import type { WeaponStats } from './weapons';

/** Passo do tick fixo (o mesmo do PhysicsWorld, repetido para o site ler este arquivo sem o Rapier). */
const DT = 1 / 60;

export interface FireResult {
  /** Segundos até tirar a vida pedida (ou o tempo todo, se não tirou). */
  time: number;
  /** Dano causado nesse tempo. */
  damage: number;
}

/**
 * Gatilho apertado com todas as armas de um Mech, todos os tiros no alvo e no alcance ótimo: o teto
 * teórico (no jogo, errar e se mexer deixam mais lento). Roda as mesmas regras do tick fixo que o
 * jogo: cadência (`FireTimer`), carregador (`RocketLauncher`) e um dissipador só para o Mech inteiro
 * (`HeatSink`), que trava tudo ao superaquecer. Serve às metas de equilíbrio (testes) e à tabela do
 * arsenal no site.
 */
export function fireHeld(weapons: readonly WeaponStats[], chassis: ChassisHeat, seconds: number, hp = Infinity): FireResult {
  const heat = new HeatSink(chassis);
  const guns = weapons.map((w) => ({ w, feed: w.kind === 'ammo' ? new RocketLauncher(w) : null, timer: new FireTimer() }));
  let damage = 0;
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i <= ticks; i++) {
    // Mesma ordem do jogo: o Mech esfria no tick dele, depois o controle tenta atirar.
    heat.fixedUpdate(DT);
    for (const g of guns) {
      let fired = false;
      if (g.feed) {
        g.feed.fixedUpdate(DT);
        fired = !heat.overheated && g.feed.tryFire();
      } else {
        g.timer.fixedUpdate(DT);
        fired = g.timer.ready && !heat.overheated;
        if (fired) g.timer.shot(g.w.fireInterval);
      }
      if (!fired) continue;
      damage += g.w.damage;
      heat.shot(g.w.heatPerShot);
    }
    if (damage >= hp) return { time: i * DT, damage };
  }
  return { time: ticks * DT, damage };
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

