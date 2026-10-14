import { weapon, type Tier, type WeaponId, type WeaponStats } from './weapons';
import { CHASSIS, COLOSSUS_BOSS_STATS, ehTita, type ChassisId } from '../entities/chassis';
import type { MechStats } from '../entities/MechBase';

/**
 * O titã como bot (P108, 13/10: "quero colocar os Colossus 3 e 4 no time adversário… batalhas épicas de combate e estratégia"). Só números e contas: sem Three.js.
 *
 * - **O Colossus-01 é o chefe da Sobrevivência**: o bot usa `COLOSSUS_BOSS_STATS` (plasma e foguetes, equilibrados em 29/09), não o Colossus que o jogador escolhe no Hangar (canhão e chuva).
 * - **O Colossus-V4 atira o canhão de cerco como projétil comum** (o bot não carrega: a carga de 3 s é do gatilho do jogador, `Armament.ts`) na cadência da arma (4,5 s).
 *   Com os 360 de dano cheios, o primeiro tiro derrubaria um Vector-09 inteiro (torso 350): o bot atira com `DANO_DO_CERCO_DO_BOT` do dano. O dono pediu que o titã
 *   "não seja absurdamente forte" (29/09): quem se expõe leva dois tiros para cair, quem circula escapa. Número de **equilíbrio**: o Comandante ajusta aqui.
 */
export const DANO_DO_CERCO_DO_BOT = 0.6;

/** O dano de uma arma quando é o bot que atira: o canhão de cerco do titã vai reduzido (acima); as outras, intactas. */
export function armaDoBot(id: WeaponId, tier: Tier, chassi: ChassisId): WeaponStats {
  const w = weapon(id, tier);
  return ehTita(chassi) && id === 'siege' ? { ...w, damage: w.damage * DANO_DO_CERCO_DO_BOT } : w;
}

/** Os números do chassi quando é um bot que o pilota: o chefe para o Colossus-01, o chassi de sempre para os outros, e o canhão de cerco reduzido nos titãs. */
export function statsDoBot(chassi: ChassisId): MechStats {
  if (chassi === 'colossus01') return COLOSSUS_BOSS_STATS;
  const base = CHASSIS[chassi];
  const p = base.loadout.primary;
  if (ehTita(chassi) && p.id === 'siege') return { ...base, loadout: { ...base.loadout, primary: { ...p, damage: p.damage * DANO_DO_CERCO_DO_BOT } } };
  return base;
}

/** Quanto o titã demora para voltar depois de abatido (s): um evento, não um respawn de 4 s. */
export const TITA_RESPAWN_S = 60;
