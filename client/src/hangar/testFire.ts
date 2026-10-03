import { drill } from '../combat/balance';
import type { ChassisHeat } from '../combat/heat';
import type { WeaponStats } from '../combat/weapons';

/** Duração do teste de disparo do Hangar (s). */
export const TEST_FIRE_S = 4;
/** Amostras do calor por segundo (a barra da tela). */
const SAMPLE_S = 0.05;

export interface TestFire {
  weapon: WeaponStats;
  seconds: number;
  /** Segundo de cada tiro, em ordem. */
  shots: number[];
  /** Calor (0–1) a cada \`sample\` segundos. */
  heat: number[];
  sample: number;
  /** Primeiro superaquecimento (s), ou null. */
  overheatAt: number | null;
  /** Dano total dos tiros (acerto perfeito, sem cair com a distância). */
  damage: number;
}

/**
 * Teste de disparo do Hangar (camada 3): o Mech parado, gatilho apertado por 4 s, pelas mesmas regras do jogo
 * (cadência, carregador, calor e trava por superaquecimento). É a bancada da oficina (\`drill\`), com a hora de cada
 * tiro para a cena desenhar e a tela contar. Nada de número inventado para o efeito.
 *
 * \`count\` = quantos encaixes atiram essa arma juntos (2 nos ombros do Marauder): cada um é um tiro da lista, e o calor e
 * o dano somam os dois.
 */
export function testFire(chassis: ChassisHeat, w: WeaponStats, seconds = TEST_FIRE_S, count = 1): TestFire {
  const shots: number[] = [];
  const r = drill(chassis, { speed: 0, fire: Array.from({ length: count }, () => w), onShot: (t) => shots.push(t) }, seconds, Infinity, SAMPLE_S);
  return { weapon: w, seconds, shots, heat: r.heat, sample: SAMPLE_S, overheatAt: r.overheatAt, damage: r.damage };
}

/** Onde o teste está no segundo \`t\`: tiros dados, dano até ali, calor e se travou. */
export function testAt(test: TestFire, t: number): { shots: number; damage: number; heat: number; locked: boolean } {
  let shots = 0;
  while (shots < test.shots.length && test.shots[shots]! <= t) shots++;
  const i = Math.min(test.heat.length - 1, Math.max(0, Math.floor(t / test.sample)));
  return {
    shots,
    damage: shots * test.weapon.damage,
    heat: test.heat[i] ?? 0,
    locked: test.overheatAt !== null && t >= test.overheatAt && (test.heat[i] ?? 0) > 0.4,
  };
}

/** Metros de vaivém lateral do alvo móvel (Codex, cena do estande em `HangarScene.ts`). */
export const MOVING_TARGET_RANGE_M = 3;
/** Segundos de um ciclo completo (ida e volta). */
export const MOVING_TARGET_PERIOD_S = 10.5;

/**
 * Deslocamento lateral (m, eixo local do estande) do alvo móvel, puro em função do tempo decorrido
 * (G2: sem `Math.random`, sem relógio de verdade). O alvo é só cenário: nunca atira, nunca causa dano
 * e não entra na conta de `testFire`/`testAt` (o cálculo continua acerto perfeito, na cadência da arma;
 * mover o alvo não muda tiro, calor nem dano — é o mesmo estande, só com mais vida visual). Quem anima
 * a malha (`HangarScene.ts`) chama isto a cada quadro com o `t` acumulado do teste.
 */
export function movingTargetOffset(t: number): number {
  return Math.sin((t / MOVING_TARGET_PERIOD_S) * Math.PI * 2) * MOVING_TARGET_RANGE_M;
}
