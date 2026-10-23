/**
 * O CHEFÃO PNEU (P248, pedido do Comandante): um pneu gigante que **rola** pela Esplanada até a Praça — um mecanismo diferente dos Mechs humanoides, sem pernas, sem fase (não há o que
 * derrubar nele: é um alvo só, com uma barra de vida). **Simulação pura** (G1/G2/G14), do mesmo jeito que `sim/Multidao.ts`: posição por tick, sem física, sem corpo no Rapier — quem acerta
 * o tiro é um teste de raio contra um cilindro, igual ao da multidão, só que para um alvo só e bem maior.
 *
 * **Limite honesto (R13), de propósito, para a primeira versão:** ele não persegue o jogador nem ataca — rola em linha reta de um ponto a outro e pode ser destruído no caminho. Sem
 * interação com os prédios nem com o resultado da missão (ela continua decidida só pela integridade deles). Vira um alvo futuro dar dano de contato ou mirar o jogador, se o Comandante
 * quiser depois de ver este primeiro.
 */

/** Nunca aconteceu (o desenho lê o mesmo número que `Multidao.NUNCA`, mas este chefe não tem fuga nem tombo — só vivo ou morto). */
const RAIO_DO_PNEU = 4;
const ALTURA_DO_PNEU = 8;

export interface ConfigDoChefePneu {
  origem: { x: number; z: number };
  alvo: { x: number; z: number };
  /** Metros por segundo. */
  velocidade: number;
  vidaMax: number;
}

export const PADRAO_DO_CHEFE_PNEU: ConfigDoChefePneu = {
  origem: { x: -120, z: 0 },
  alvo: { x: 95, z: 0 },
  velocidade: 4,
  vidaMax: 3000,
};

export class ChefePneu {
  x: number;
  z: number;
  vida: number;
  readonly vidaMax: number;
  /** Quanto já rolou (m): o desenho usa para girar a malha (ângulo = distância ÷ raio visual). */
  distanciaRolada = 0;
  morto = false;
  /** Chegou ao alvo sem morrer: para, mas continua "vivo" (ainda pode ser destruído, só não anda mais). */
  chegou = false;

  aoFerir: ((vida: number, vidaMax: number) => void) | null = null;
  aoMorrer: (() => void) | null = null;

  private readonly origem: { x: number; z: number };
  private readonly velocidade: number;
  private readonly distanciaTotal: number;
  private readonly dirX: number;
  private readonly dirZ: number;

  constructor(cfg: ConfigDoChefePneu = PADRAO_DO_CHEFE_PNEU) {
    this.origem = cfg.origem;
    this.velocidade = cfg.velocidade;
    this.vidaMax = cfg.vidaMax;
    this.vida = cfg.vidaMax;
    this.x = cfg.origem.x;
    this.z = cfg.origem.z;
    const dx = cfg.alvo.x - cfg.origem.x;
    const dz = cfg.alvo.z - cfg.origem.z;
    this.distanciaTotal = Math.hypot(dx, dz) || 1;
    this.dirX = dx / this.distanciaTotal;
    this.dirZ = dz / this.distanciaTotal;
  }

  /** A missão recomeçou: volta à origem, com a vida cheia, vivo — o mesmo objeto (o desenho guarda a referência). */
  reiniciar(): void {
    this.x = this.origem.x;
    this.z = this.origem.z;
    this.vida = this.vidaMax;
    this.distanciaRolada = 0;
    this.morto = false;
    this.chegou = false;
  }

  /** Um tick fixo: rola na direção do alvo até chegar; parado se morto. */
  avancar(dt: number): void {
    if (this.morto || this.chegou) return;
    const passo = Math.min(this.velocidade * dt, this.distanciaTotal - this.distanciaRolada);
    this.distanciaRolada += passo;
    this.x = this.origem.x + this.dirX * this.distanciaRolada;
    this.z = this.origem.z + this.dirZ * this.distanciaRolada;
    if (this.distanciaRolada >= this.distanciaTotal) this.chegou = true;
  }

  /** O tiro: mesmo teste de raio-contra-cilindro de `Multidao.atirar`, para este alvo só. `true` se acertou (morre ou só perde vida). */
  atirar(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, alcance: number, dano: number): boolean {
    if (this.morto) return false;
    const h2 = dx * dx + dz * dz;
    const cx = this.x - ox;
    const cz = this.z - oz;
    let s0 = 0;
    let s1 = alcance;
    if (h2 > 1e-12) {
      const proj = (cx * dx + cz * dz) / h2;
      const qx = cx - dx * proj;
      const qz = cz - dz * proj;
      const folga = RAIO_DO_PNEU * RAIO_DO_PNEU - (qx * qx + qz * qz);
      if (folga < 0) return false;
      const meio = Math.sqrt(folga / h2);
      s0 = Math.max(0, proj - meio);
      s1 = Math.min(s1, proj + meio);
    } else if (cx * cx + cz * cz > RAIO_DO_PNEU * RAIO_DO_PNEU) return false;
    if (dy > 1e-9 || dy < -1e-9) {
      const sA = -oy / dy;
      const sB = (ALTURA_DO_PNEU - oy) / dy;
      s0 = Math.max(s0, sA < sB ? sA : sB);
      s1 = Math.min(s1, sA < sB ? sB : sA);
    } else if (oy < 0 || oy > ALTURA_DO_PNEU) return false;
    if (s0 > s1) return false;
    this.ferir(dano);
    return true;
  }

  /** A explosão: mesmo teste 3D de `Multidao.explodir`, para este alvo só. `true` se o acertou. */
  explodir(x: number, y: number, z: number, raio: number, dano: number): boolean {
    if (this.morto) return false;
    const dx = this.x - x;
    const dz = this.z - z;
    const dv = y > ALTURA_DO_PNEU ? y - ALTURA_DO_PNEU : y < 0 ? -y : 0;
    const d2 = dx * dx + dz * dz + dv * dv;
    if (d2 > raio * raio) return false;
    this.ferir(dano);
    return true;
  }

  private ferir(dano: number): void {
    if (this.morto) return;
    this.vida = Math.max(0, this.vida - dano);
    this.aoFerir?.(this.vida, this.vidaMax);
    if (this.vida <= 0) {
      this.morto = true;
      this.aoMorrer?.();
    }
  }
}
