import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import type { DragaMech } from '../entities/DragaMech';
import type { MechBase, MechInput } from '../entities/MechBase';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { ehAndroide } from '../sim/CabosDeDados';
import { pontoDoRio, rumoPara } from '../sim/DragaMarcha';
import type { CerebroDoChefe } from './CerebroDoChefe';
import { wrapAngle } from './steer';

/**
 * O CÉREBRO DO DRAGA-01 (P180, parte C): ele **marcha pelo leito do rio rumo à aldeia** (nada o distrai: não caça, não foge) e **atira com o canhão do convés** em quem estiver ao alcance. É a regra de
 * `sim/DragaMarcha.ts` posta no tick: o rumo vem do ponto do rio 70 m à frente, o giro do casco é lento (um andador de 38 m não vira na hora), e a velocidade de verdade é a do corpo
 * (`MechBase.mobility`: perna caída, manca; as duas, rasteja).
 *
 * **Determinístico (G1/G2):** o erro de mira vem de um gerador com semente, não de `Math.random`. **Custo por tick:** uma conta de rumo, um laço sobre os alvos (≤ 8) e, quando atira, um raio
 * (a linha de visada); nenhum `new`.
 */

/** O giro máximo do casco (rad/s): ~14°/s. Uma curva do rio de 40° leva 3 s. */
export const GIRO_DO_DRAGA_RAD_S = 0.25;
/** Até onde ele atira (m): o canhão alcança 400, mas a partir daqui o erro de mira já o faz errar quem se mexe. */
export const ALCANCE_DE_TIRO_DO_DRAGA_M = 320;
/** O erro de mira do canhão (rad, ~2,6°): a 200 m são 9 m de erro, um pouco mais que o raio da explosão (5 m): quem anda erra o tiro. */
const ERRO_DE_MIRA_RAD = 0.045;
/** Quanto do alvo ele antecipa (1 = pontaria perfeita no tempo de voo). */
const ANTECIPACAO = 0.8;
/** Atira em que altura do alvo (fração da altura): no meio do corpo. */
const ALTURA_DA_MIRA = 0.5;
/** Primeiro tiro depois de largar (s): o Comandante tem uns segundos para entender o que vem aí. */
const ESPERA_INICIAL_S = 3;

const _ponto = { x: 0, z: 0 };
const _boca = new THREE.Vector3();
const _alvo = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class DragaController implements CerebroDoChefe {
  readonly shotDir = new THREE.Vector3();
  wantsToFire = false;
  /** O rumo do casco (yaw do Mech: π/2 olha para -X, rio acima). */
  private yaw = Math.PI / 2;
  private fireCooldown = ESPERA_INICIAL_S;
  private rand: () => number;
  private readonly entrada: MechInput = { moveX: 0, moveZ: 1, moveYaw: 0, yaw: 0, jump: false, dash: false };

  constructor(
    private readonly mech: DragaMech,
    private readonly physics: PhysicsWorld,
    private readonly seed: number,
  ) {
    this.rand = mulberry32(seed);
  }

  /** O rumo do casco agora (para os testes e o desenho). */
  get rumo(): number {
    return this.yaw;
  }

  reset(): void {
    this.yaw = Math.PI / 2;
    this.fireCooldown = ESPERA_INICIAL_S;
    this.rand = mulberry32(this.seed);
    this.wantsToFire = false;
    this.mech.deckAim = this.yaw;
  }

  think(dt: number, targets: readonly MechBase[]): MechInput {
    this.wantsToFire = false;
    const m = this.mech;
    const p = m.simPosition;
    // O rumo: vira devagar para o ponto do leito 70 m rio acima (nunca mais que o giro do casco por tick).
    pontoDoRio(p.x, _ponto);
    const querer = rumoPara(_ponto.x - p.x, _ponto.z - p.z);
    const passo = GIRO_DO_DRAGA_RAD_S * dt;
    this.yaw = wrapAngle(this.yaw + Math.max(-passo, Math.min(passo, wrapAngle(querer - this.yaw))));
    m.applyFacing(this.yaw, 0);
    this.mirar(dt, targets);
    // Anda para onde o casco olha, a toda (a velocidade de verdade é a do corpo: o dano nas pernas a corta).
    const e = this.entrada;
    e.moveYaw = this.yaw;
    e.yaw = this.yaw;
    return e;
  }

  /**
   * Escolhe o alvo mais perto ao alcance e, na cadência do canhão e com a visada livre, atira. O convés gira para o alvo (o desenho lê `deckAim`). **O canhão de cerco só mira Mechs: andróide é pequeno
   * demais para o radar de tiro dele** (é o que deixa a Resistência chegar à escotilha, parte E; os Mechs e os andróides da guarda não têm essa folga).
   */
  private mirar(dt: number, targets: readonly MechBase[]): void {
    const m = this.mech;
    this.fireCooldown -= dt;
    const arma = m.loadout.primary;
    const p = m.simPosition;
    let alvo: MechBase | null = null;
    let melhor = ALCANCE_DE_TIRO_DO_DRAGA_M * ALCANCE_DE_TIRO_DO_DRAGA_M;
    for (const t of targets) {
      if (!t.alive || ehAndroide(t.stats.name)) continue;
      const q = t.simPosition;
      const d2 = (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z);
      if (d2 < melhor) {
        melhor = d2;
        alvo = t;
      }
    }
    if (!alvo) {
      m.deckAim = this.yaw;
      return;
    }
    m.simMuzzle(_boca);
    const tp = alvo.simPosition;
    const voo = Math.sqrt(melhor) / arma.speed;
    _alvo.set(tp.x + alvo.velocity.x * voo * ANTECIPACAO, tp.y + alvo.stats.height * ALTURA_DA_MIRA, tp.z + alvo.velocity.z * voo * ANTECIPACAO);
    _dir.subVectors(_alvo, _boca);
    m.deckAim = rumoPara(_dir.x, _dir.z);
    if (this.fireCooldown > 0 || !m.canFirePrimary) return;
    const distancia = _dir.length();
    if (distancia < 1e-6) return;
    _dir.multiplyScalar(1 / distancia);
    // A visada: o primeiro que o raio acha tem de ser o alvo (um prédio ou uma torre no caminho segura o tiro).
    const obstaculo = this.physics.firstColliderOnRay(_boca, _dir, distancia, m.collider);
    if (obstaculo && obstaculo.handle !== alvo.collider?.handle) return;
    // O erro de mira: gira um pouco em yaw e em pitch (a semente é a do chefe: o mesmo tiro, a cada partida).
    const err = ERRO_DE_MIRA_RAD;
    const a = (this.rand() * 2 - 1) * err;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const x = _dir.x * ca + _dir.z * sa;
    _dir.z = -_dir.x * sa + _dir.z * ca;
    _dir.x = x;
    _dir.y += (this.rand() * 2 - 1) * err;
    this.shotDir.copy(_dir.normalize());
    this.wantsToFire = true;
    this.fireCooldown = arma.fireInterval;
  }
}
