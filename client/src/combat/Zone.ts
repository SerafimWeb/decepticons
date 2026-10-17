import type { MechBase } from '../entities/MechBase';

/**
 * Zonas de vantagem tática (dono, 27/09: "3 mechs + 3 andróides que se regeneram, fica muito difícil;
 * preciso de um lugar pra recuperar a vida, ou um resfriador pra ter mais fôlego"). Volume fixo da
 * arena, definido uma vez (`METAGAME.md` § 9): quem cura ou ventila é o servidor (autoridade); custo de
 * rede zero (0 B/s), porque a posição da zona nunca muda e não viaja pela rede.
 *
 * Vantagem de posicionamento, igual para os dois lados (`GAME_DESIGN.md`): qualquer Mech vivo dentro do
 * raio recebe o efeito, inclusive os bots. Não é cosmético e não se compra.
 */
export type ZoneKind = 'heal' | 'cool';

export interface ZoneDef {
  x: number;
  z: number;
  radius: number;
  kind: ZoneKind;
}

/** Vida devolvida por segundo (na parte mais avariada) a quem parar na zona de cura. */
export const HEAL_ZONE_RATE = 20;
/**
 * Calor drenado por segundo na zona de resfriamento, sem esperar o atraso do tiro. O plasma aquece
 * ~0,315/s em rajada contínua (0,07 por tiro a 4,5 tiros/s); a 0,35/s a zona vence esse ritmo: dá para
 * segurar o gatilho parado na zona sem travar.
 */
export const COOL_ZONE_VENT_RATE = 0.35;

/** As duas zonas da arena de hoje: cura no canto sudeste, resfriamento no canto noroeste. */
export const ARENA_ZONES: readonly ZoneDef[] = [
  { x: 75, z: -75, radius: 12, kind: 'heal' },
  { x: -75, z: 45, radius: 12, kind: 'cool' },
];

/**
 * Aplica o efeito das zonas a uma lista de Mechs, um tick fixo por vez. Sem alocação (G4): só laços e
 * comparações de distância ao quadrado. Chamada uma vez para os jogadores e uma para os bots (`Match`),
 * porque são listas diferentes; o custo é `zonas × mechs`, poucas dezenas de comparações por tick.
 */
export class ZoneSystem {
  /**
   * As zonas têm energia? (P164) Na praia elas dependem do **quadro de luz da cidade**: com o quadro apagado (`QuadroDeLuz`), deixam de curar e de resfriar. Nos outros mapas
   * ficam sempre ligadas.
   */
  energizadas = true;

  constructor(private readonly zones: readonly ZoneDef[] = ARENA_ZONES) {}

  fixedUpdate(dt: number, mechs: readonly MechBase[]): void {
    if (!this.energizadas) return;
    for (const z of this.zones) {
      const r2 = z.radius * z.radius;
      for (const m of mechs) {
        if (!m.alive) continue;
        const p = m.simPosition;
        const dx = p.x - z.x;
        const dz = p.z - z.z;
        if (dx * dx + dz * dz > r2) continue;
        if (z.kind === 'heal') m.repair(HEAL_ZONE_RATE * dt);
        else m.vent(COOL_ZONE_VENT_RATE * dt);
      }
    }
  }
}
