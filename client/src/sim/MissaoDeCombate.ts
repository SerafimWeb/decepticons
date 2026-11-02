/**
 * A MISSÃO DE COMBATE (P314, a ordem "missões tipo as do GTA, orientadas para combates de mechs"): um objetivo com prazo, em vez de só
 * sobreviver. Três tipos no primeiro corte:
 *   - CAÇA: derrube o alvo marcado. Os outros inimigos são escolta e não contam.
 *   - DESTRUIÇÃO: derrube os três Mechs marcados. Os andróides não contam.
 *   - ANIQUILAÇÃO: nenhum inimigo de pé.
 * O prazo corre desde a largada. Cair = derrota; o prazo acabar = derrota. Pura (sem DOM, sem relógio, sem aleatoriedade): só avança por
 * `fixedUpdate`, como a Sobrevivência (`SurvivalWaves.ts`). O Match põe o elenco e conta os abates; esta máquina diz quando acaba e como.
 */

export type TipoDeMissao = 'caca' | 'destruicao' | 'aniquilacao';

export interface PlanoDeMissao {
  readonly tipo: TipoDeMissao;
  readonly titulo: string;
  /** Uma linha para o briefing: o que o jogador tem de fazer. */
  readonly objetivo: string;
  /** Mechs rebeldes no elenco. Os primeiros `alvos` são os marcados (o pool põe os Mechs antes dos andróides). */
  readonly mechs: number;
  /** Andróides de combate (a escolta; na aniquilação, o resto do inimigo). */
  readonly androids: number;
  /** Quantos inimigos precisam cair para cumprir. Na aniquilação, são todos (Mechs e andróides). */
  readonly alvos: number;
  /** Na aniquilação, qualquer inimigo conta (não só os marcados). */
  readonly exterminio: boolean;
  /** Prazo em segundos, contado desde a largada. */
  readonly limiteS: number;
  /** Teto de atacantes ao mesmo tempo (o diretor de combate, como na Sobrevivência). */
  readonly maxAttackers: number;
}

/** O pool de inimigos do Match tem vaga para até três Mechs e três andróides (`BOT_SPAWNS` e `ANDROID_SPAWNS`, como na Sobrevivência). */
export const MISSAO_MAX_MECHS = 3;
export const MISSAO_MAX_ANDROIDS = 3;

export const MISSOES_DE_COMBATE: Readonly<Record<TipoDeMissao, PlanoDeMissao>> = Object.freeze({
  caca: Object.freeze({
    tipo: 'caca',
    titulo: 'CAÇA',
    objetivo: 'derrube o alvo marcado antes do prazo',
    mechs: 2,
    androids: 2,
    alvos: 1,
    exterminio: false,
    limiteS: 150,
    maxAttackers: 2,
  }),
  destruicao: Object.freeze({
    tipo: 'destruicao',
    titulo: 'DESTRUIÇÃO',
    objetivo: 'derrube os três Mechs marcados',
    mechs: 3,
    androids: 2,
    alvos: 3,
    exterminio: false,
    limiteS: 200,
    maxAttackers: 2.5,
  }),
  aniquilacao: Object.freeze({
    tipo: 'aniquilacao',
    titulo: 'ANIQUILAÇÃO',
    objetivo: 'nenhum inimigo de pé',
    mechs: 3,
    androids: 3,
    alvos: 6,
    exterminio: true,
    limiteS: 240,
    maxAttackers: 2.5,
  }),
});

/** Segundos de preparação antes da largada (a tela mostra o briefing). */
export const BRIEFING_DA_MISSAO_S = 3;
/** Intervalo do aviso de progresso (o mesmo da Sobrevivência). */
export const PROGRESSO_DA_MISSAO_S = 0.1;

export type FaseDaMissao = 'briefing' | 'ativa' | 'cumprida' | 'falhou';
/** Como acabou: cumpriu o objetivo, o prazo acabou, ou o jogador caiu. */
export type DesfechoDaMissao = 'cumprida' | 'tempo' | 'morte';

export interface EstatisticasDaMissao {
  readonly abates: number;
  readonly alvosCaidos: number;
  readonly danoCausado: number;
  readonly segundos: number;
}

export interface MissaoCallbacks {
  /** O Match ativa o elenco do plano (ou desativa tudo, com `null`). Nunca cria robôs durante o tick. */
  onRoster(plano: PlanoDeMissao | null): void;
  onStart?(plano: PlanoDeMissao): void;
  onProgresso?(alvosCaidos: number, alvos: number, restanteS: number): void;
  onFim?(desfecho: DesfechoDaMissao, estatisticas: EstatisticasDaMissao): void;
}

export class MissaoDeCombate {
  fase: FaseDaMissao = 'briefing';
  abates = 0;
  alvosCaidos = 0;
  danoCausado = 0;
  segundos = 0;
  private faseRestante = BRIEFING_DA_MISSAO_S;
  private progressoRestante = 0;

  constructor(
    readonly plano: PlanoDeMissao,
    private readonly callbacks: MissaoCallbacks,
  ) {}

  get terminou(): boolean {
    return this.fase === 'cumprida' || this.fase === 'falhou';
  }

  /** Quanto falta para o prazo, em segundos (o prazo inteiro antes da largada). */
  get restanteS(): number {
    return this.fase === 'ativa' ? Math.max(0, this.plano.limiteS - this.segundos) : this.plano.limiteS;
  }

  /**
   * Um inimigo é alvo marcado? Os marcados são os primeiros da lista do pool (os Mechs vêm antes dos andróides); na aniquilação,
   * todos. `indice` é a posição do inimigo no pool (`bots.mechs`), e `-1` (não achado) nunca conta.
   */
  ehAlvo(indice: number): boolean {
    return this.plano.exterminio || (indice >= 0 && indice < this.plano.alvos);
  }

  reset(): void {
    this.fase = 'briefing';
    this.abates = 0;
    this.alvosCaidos = 0;
    this.danoCausado = 0;
    this.segundos = 0;
    this.faseRestante = BRIEFING_DA_MISSAO_S;
    this.progressoRestante = 0;
    this.callbacks.onRoster(null);
  }

  /** Um tick fixo. `jogadorVivo` é false quando o último piloto cai. */
  fixedUpdate(dt: number, jogadorVivo: boolean): void {
    if (this.terminou) return;
    if (!jogadorVivo) {
      this.encerrar('morte');
      return;
    }
    if (this.fase === 'briefing') {
      this.faseRestante -= dt;
      if (this.faseRestante <= 0) this.largar();
      return;
    }
    this.segundos += dt;
    if (this.segundos >= this.plano.limiteS) {
      this.encerrar('tempo');
      return;
    }
    this.progressoRestante -= dt;
    if (this.progressoRestante > 0) return;
    this.progressoRestante = PROGRESSO_DA_MISSAO_S;
    this.callbacks.onProgresso?.(this.alvosCaidos, this.plano.alvos, this.restanteS);
  }

  /**
   * Um inimigo caiu. `alvo` diz se ele estava marcado (`ehAlvo`). Devolve true quando este abate fecha a missão.
   * Antes da largada e depois do fim, não conta nada.
   */
  recordEnemyKilled(alvo: boolean): boolean {
    if (this.fase !== 'ativa') return false;
    this.abates++;
    if (alvo) this.alvosCaidos++;
    if (alvo) this.callbacks.onProgresso?.(this.alvosCaidos, this.plano.alvos, this.restanteS);
    if (this.alvosCaidos < this.plano.alvos) return false;
    this.encerrar('cumprida');
    return true;
  }

  recordDamage(amount: number): void {
    if (this.fase === 'ativa' && amount > 0) this.danoCausado += amount;
  }

  private largar(): void {
    this.fase = 'ativa';
    this.segundos = 0;
    this.progressoRestante = 0;
    this.callbacks.onRoster(this.plano);
    this.callbacks.onStart?.(this.plano);
    this.callbacks.onProgresso?.(0, this.plano.alvos, this.plano.limiteS);
  }

  private encerrar(desfecho: DesfechoDaMissao): void {
    this.fase = desfecho === 'cumprida' ? 'cumprida' : 'falhou';
    this.callbacks.onRoster(null);
    this.callbacks.onFim?.(desfecho, {
      abates: this.abates,
      alvosCaidos: this.alvosCaidos,
      danoCausado: this.danoCausado,
      segundos: this.segundos,
    });
  }
}
