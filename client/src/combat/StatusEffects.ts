/**
 * Efeitos de estado com tempo (pedido do dono, 09/10: elétrica que deixa o alvo "tomando choque, lento e sem funcionar", lança-chamas,
 * arma de gelo). Plano, números e decisões do dono: `.decepticons/ARMAS_ELEMENTAIS.md`.
 *
 * Cada Mech tem um `StatusSet` (alocado uma vez, sem `new` por tick: G4/G5). Quem aplica é o `CombatSystem` ao acertar uma arma com
 * `inflicts`; o tempo corre e o dano por segundo sai no passo fixo (`CombatSystem.tickStatus`, chamado pelo `Match`). Tudo determinístico
 * (G1/G2): sem `Math.random`, `Date.now` nem DOM, e o servidor roda a mesma regra que o jogo offline (G14).
 *
 * | Estado      | Entra por                                   | Efeito                                              |
 * |-------------|---------------------------------------------|-----------------------------------------------------|
 * | queimando   | lança-chamas                                | dano por segundo + calor sem resfriar; gelo apaga   |
 * | chocado     | arma elétrica                               | lento e dano por segundo                            |
 * | atordoado   | elétrica: tiro na cabeça, ou 3 acertos em 1,4 s | não anda nem atira; sem encadear (imunidade)    |
 * | gelado      | arma de gelo, até 3 acúmulos                | mais lento a cada acúmulo; fogo apaga               |
 * | congelado   | 3 acúmulos de gelado                        | não anda (mira e atira) e leva mais dano            |
 */

export type StatusKind = 'queimando' | 'chocado' | 'atordoado' | 'gelado' | 'congelado';
/** O que uma arma aplica no acerto (campo `inflicts` da arma). */
export type StatusInflict = 'burn' | 'shock' | 'chill';

/** Números de partida (tudo em segundos, fração ou dano por segundo). Mexer aqui muda o jogo: os testes dizem o que quebra. */
export const STATUS = {
  burnDps: 6,
  burnTime: 4,
  /** Calor (fração do dissipador) que o fogo põe no Mech por segundo, sem deixá-lo resfriar. */
  burnHeatPerSecond: 0.03,
  shockDps: 2,
  shockTime: 3,
  shockSpeed: 0.65,
  stunTime: 0.8,
  /** Depois de atordoar, nenhum atordoamento novo por este tempo (conta do início): ninguém fica preso até morrer. */
  stunImmune: 4,
  /** "Boa sequência": este tanto de acertos no mesmo alvo, cada um até `comboWindow` s depois do anterior (decisão do dono). */
  comboHits: 3,
  comboWindow: 1.4,
  chillStep: 0.15,
  chillMax: 3,
  chillTime: 4,
  freezeTime: 1.5,
  freezeImmune: 5,
  frozenDamage: 1.2,
  /** O estado só pega se pelo menos esta fração do dano passou pelas defesas (campo de energia, chapa do escudo físico): a cerâmica isola o choque, a chapa de aço não. */
  shieldPass: 0.5,
} as const;

/**
 * Segundo byte de bandeiras da unidade na rede (`shared/net/state.ts`): o mesmo layout vale para o servidor e para o cliente.
 * Os acúmulos de gelado usam 2 bits (0 a 3). `FX_FLAMING` e `FX_SPINNING` são do dono do tiro (lança-chamas ligado, rotatória
 * girando): viajam aqui para o cliente desenhar o fluxo sem um evento por tiro.
 */
export const FX_BURNING = 1;
export const FX_SHOCKED = 2;
export const FX_STUNNED = 4;
export const FX_CHILL_SHIFT = 3; // bits 3 e 4: acúmulos de gelado
export const FX_CHILL_MASK = 3 << FX_CHILL_SHIFT;
export const FX_FROZEN = 32;
export const FX_FLAMING = 64;
export const FX_SPINNING = 128;

/** Quanto tempo uma bandeira vinda da rede mantém o estado ligado se o próximo pacote atrasar (os pacotes chegam a 20 Hz). */
const NET_HOLD = 0.35;

export class StatusSet {
  /** Segundos restantes de cada estado (0 = desligado). */
  burn = 0;
  shock = 0;
  stun = 0;
  frozen = 0;
  /** Acúmulos de gelado (0 a 3) e o tempo até eles se desfazerem. */
  stacks = 0;
  private chill = 0;
  private stunImmune = 0;
  private freezeImmune = 0;
  /** Acertos elétricos seguidos no mesmo alvo e quanto falta para a sequência acabar. */
  private combo = 0;
  private comboLeft = 0;
  /** Quem aplicou por último: crédito do abate quando o dano por segundo mata. */
  source: unknown = undefined;
  /** Multiplicador da duração: Mech grande resiste (< 1), pequeno sofre mais (> 1). */
  resist = 1;
  /** Do dono do tiro: lança-chamas ligado e rotatória girando (só viajam na rede, para o desenho dos outros jogadores). */
  flaming = false;
  spinning = false;

  get burning(): boolean {
    return this.burn > 0;
  }
  get shocked(): boolean {
    return this.shock > 0;
  }
  get stunned(): boolean {
    return this.stun > 0;
  }
  get isFrozen(): boolean {
    return this.frozen > 0;
  }

  /** O Mech pode agir (andar, atirar)? O atordoado não. O congelado ainda mira e atira: quem trava é o movimento. */
  get canAct(): boolean {
    return this.stun <= 0;
  }

  /** Multiplicador da velocidade e da mobilidade (0 = nem anda, nem pula, nem dá dash). */
  get speedMultiplier(): number {
    if (this.stun > 0 || this.frozen > 0) return 0;
    return (this.shock > 0 ? STATUS.shockSpeed : 1) * (1 - STATUS.chillStep * this.stacks);
  }

  /** Multiplicador do dano que o Mech recebe: o congelado quebra mais fácil. */
  get damageTaken(): number {
    return this.frozen > 0 ? STATUS.frozenDamage : 1;
  }

  /** Algum estado ligado? (O que a rede e o HUD precisam saber.) */
  get active(): boolean {
    return this.burn > 0 || this.shock > 0 || this.stun > 0 || this.frozen > 0 || this.stacks > 0;
  }

  /** Calor por segundo que o fogo põe no Mech. */
  get heatPerSecond(): number {
    return this.burn > 0 ? STATUS.burnHeatPerSecond : 0;
  }

  /** Fogo: apaga o gelo (acúmulos e congelamento) e renova a queimadura. */
  burnUp(source?: unknown): void {
    this.burn = STATUS.burnTime * this.resist;
    this.stacks = 0;
    this.chill = 0;
    this.frozen = 0;
    this.source = source;
  }

  /**
   * Choque: renova o estado chocado. Atordoa no **tiro bem dado** (na cabeça, ou `comboHits` acertos seguidos, cada um a menos de
   * `comboWindow` s do anterior), a menos que ainda esteja imune de um atordoamento recente. Devolve se atordoou agora.
   */
  shockUp(head: boolean, source?: unknown): boolean {
    this.shock = STATUS.shockTime * this.resist;
    this.source = source;
    this.combo = this.comboLeft > 0 ? this.combo + 1 : 1;
    this.comboLeft = STATUS.comboWindow;
    if ((head || this.combo >= STATUS.comboHits) && this.stunImmune <= 0) {
      this.stun = STATUS.stunTime * this.resist;
      this.stunImmune = STATUS.stunImmune;
      this.combo = 0;
      this.comboLeft = 0;
      return true;
    }
    return false;
  }

  /** Gelo: apaga o fogo, soma um acúmulo (até o máximo) e, no último, congela (a menos que tenha congelado há pouco). */
  chillUp(source?: unknown): void {
    this.burn = 0;
    this.source = source;
    this.chill = STATUS.chillTime * this.resist;
    this.stacks = Math.min(STATUS.chillMax, this.stacks + 1);
    if (this.stacks >= STATUS.chillMax && this.freezeImmune <= 0) {
      this.frozen = STATUS.freezeTime * this.resist;
      this.freezeImmune = STATUS.freezeImmune;
      this.stacks = 0;
      this.chill = 0;
    }
  }

  /** Um tick: o tempo corre e devolve o dano por segundo deste tick (queimadura e choque). */
  step(dt: number): number {
    const damage = (this.burn > 0 ? STATUS.burnDps : 0) * dt + (this.shock > 0 ? STATUS.shockDps : 0) * dt;
    this.burn = Math.max(0, this.burn - dt);
    this.shock = Math.max(0, this.shock - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.frozen = Math.max(0, this.frozen - dt);
    this.stunImmune = Math.max(0, this.stunImmune - dt);
    this.freezeImmune = Math.max(0, this.freezeImmune - dt);
    this.comboLeft = Math.max(0, this.comboLeft - dt);
    if (this.comboLeft <= 0) this.combo = 0;
    if (this.stacks > 0) {
      this.chill = Math.max(0, this.chill - dt);
      if (this.chill <= 0) this.stacks = 0;
    }
    if (!this.active) this.source = undefined;
    return damage;
  }

  /** Volta ao normal (morreu, renasceu, rodada nova). A imunidade também zera: a vida nova começa limpa. */
  reset(): void {
    this.burn = this.shock = this.stun = this.frozen = this.chill = this.stunImmune = this.freezeImmune = this.combo = this.comboLeft = 0;
    this.stacks = 0;
    this.source = undefined;
    this.flaming = false;
    this.spinning = false;
  }

  /** O segundo byte de bandeiras da rede (`FX_*`). */
  get bits(): number {
    return (
      (this.burn > 0 ? FX_BURNING : 0) |
      (this.shock > 0 ? FX_SHOCKED : 0) |
      (this.stun > 0 ? FX_STUNNED : 0) |
      (this.stacks << FX_CHILL_SHIFT) |
      (this.frozen > 0 ? FX_FROZEN : 0) |
      (this.flaming ? FX_FLAMING : 0) |
      (this.spinning ? FX_SPINNING : 0)
    );
  }

  /**
   * Espelha as bandeiras que vieram da rede (o servidor é quem decide): liga os estados com um prazo curto, que o próximo
   * pacote renova, e desliga na hora o que não veio. O cliente só precisa disto para prever a própria lentidão e desenhar os outros.
   */
  applyNet(bits: number): void {
    this.burn = bits & FX_BURNING ? Math.max(this.burn, NET_HOLD) : 0;
    this.shock = bits & FX_SHOCKED ? Math.max(this.shock, NET_HOLD) : 0;
    this.stun = bits & FX_STUNNED ? Math.max(this.stun, NET_HOLD) : 0;
    this.frozen = bits & FX_FROZEN ? Math.max(this.frozen, NET_HOLD) : 0;
    this.stacks = (bits & FX_CHILL_MASK) >> FX_CHILL_SHIFT;
    this.chill = this.stacks > 0 ? Math.max(this.chill, NET_HOLD) : 0;
    this.flaming = (bits & FX_FLAMING) !== 0;
    this.spinning = (bits & FX_SPINNING) !== 0;
  }

  /**
   * Percorre os estados ligados (para o HUD e o painel do alvo), sem alocar: `left` em segundos, `level` de 0 a 1 (o gelado vai de 1/3 a 1
   * com os acúmulos; os outros são 1).
   */
  forEachActive(fn: (kind: StatusKind, left: number, level: number) => void): void {
    if (this.burn > 0) fn('queimando', this.burn, 1);
    if (this.shock > 0) fn('chocado', this.shock, 1);
    if (this.stun > 0) fn('atordoado', this.stun, 1);
    if (this.stacks > 0) fn('gelado', this.chill, this.stacks / STATUS.chillMax);
    if (this.frozen > 0) fn('congelado', this.frozen, 1);
  }

  private readonly kindList: StatusKind[] = [];

  /** Os estados ligados, na ordem de `forEachActive`, numa lista que é sempre a mesma (nada é alocado por quadro): o painel do alvo lê daqui. */
  kinds(): readonly StatusKind[] {
    const list = this.kindList;
    list.length = 0;
    if (this.burn > 0) list.push('queimando');
    if (this.shock > 0) list.push('chocado');
    if (this.stun > 0) list.push('atordoado');
    if (this.stacks > 0) list.push('gelado');
    if (this.frozen > 0) list.push('congelado');
    return list;
  }
}

/** Aplica o que a arma inflige no acerto. `part` é a parte do corpo que levou o tiro (a cabeça vale o atordoamento do choque). */
export function inflictOnHit(status: StatusSet, kind: StatusInflict, part: string, source?: unknown): void {
  if (kind === 'burn') status.burnUp(source);
  else if (kind === 'shock') status.shockUp(part === 'head', source);
  else status.chillUp(source);
}
