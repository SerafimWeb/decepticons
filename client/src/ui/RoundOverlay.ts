/**
 * RoundOverlay — a abertura da rodada ("RODADA N · 3 · 2 · 1 · COMBATE!") e o painel de estatísticas do fim.
 * Vocabulário e textos centralizados para facilitar localização (ex: CTI/SERAFIM).
 *
 * **A contagem é só da tela** (G1/G2): ela lê o relógio do intervalo que a `Round` já tem (os últimos 3 s antes da rodada seguinte) e não segura ninguém no lugar.
 * Quem toca os sons e fala é de fora (`som`, `falar`): o `Game` liga ao `AudioSystem`. Antes cada bipe criava um contexto de áudio novo, e o navegador limita quantos existem.
 *
 * Custo: zero por quadro além de uma comparação (`contar` só mexe no DOM quando o número muda).
 */
export interface RoundStatsSummary {
  kills: number;
  damage: number;
  streak: number;
  survivalSeconds: number;
}

/** O que o `Game` liga para a abertura soar. */
export interface SonsDaAbertura {
  /** Um bipe por número (3, 2, 1). */
  contagem(n: number): void;
  /** O toque do COMBATE!. */
  combate(): void;
}

/** Quanto do fim do intervalo vira contagem. */
export const CONTAGEM_S = 3;
/** Quanto o "COMBATE!" fica na tela. */
export const COMBATE_NA_TELA_MS = 900;

/** O número que a tela mostra para o tempo que falta do intervalo (3, 2 ou 1), ou `null` fora dos últimos `CONTAGEM_S` segundos. */
export function numeroDaContagem(restanteS: number): 1 | 2 | 3 | null {
  if (!(restanteS > 0) || restanteS > CONTAGEM_S) return null;
  return Math.ceil(restanteS) as 1 | 2 | 3;
}

export class RoundOverlay {
  private readonly el: HTMLDivElement | null = null;
  private readonly countdownEl: HTMLDivElement | null = null;
  private readonly summaryEl: HTMLDivElement | null = null;
  private readonly labelEl: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private numeroAtual: number | null = null;
  /** O texto que a abertura mostra agora (para quem confere sem olhar o DOM). */
  public currentText = '';
  public lastStats: RoundStatsSummary | null = null;
  /** Quem toca os sons da abertura; `null` = mudo. */
  public som: SonsDaAbertura | null = null;
  /** Quem fala ("Rodada 2", "Combate!"); `null` = sem locução. */
  public falar: ((texto: string) => void) | null = null;

  constructor(parent?: HTMLElement) {
    if (typeof document === 'undefined') return;
    const p = parent ?? document.body;
    let el = p.querySelector<HTMLDivElement>('#round-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'round-overlay';
      el.className = 'round-overlay';
      el.style.display = 'none';

      el.innerHTML = `
        <div class="ro-round-label">// RODADA <span id="ro-round-num">1</span> //</div>
        <div class="ro-countdown"></div>
        <div class="ro-summary" hidden>
          <div class="ro-title">// FIM DA RODADA //</div>
          <div class="ro-stats-grid">
            <div class="ro-stat"><span class="ro-label">ABATES</span><span class="ro-val ro-kills">0</span></div>
            <div class="ro-stat"><span class="ro-label">DANO CAUSADO</span><span class="ro-val ro-damage">0</span></div>
            <div class="ro-stat"><span class="ro-label">MAIOR SEQUÊNCIA</span><span class="ro-val ro-streak">0x</span></div>
            <div class="ro-stat"><span class="ro-label">TEMPO DE COMBATE</span><span class="ro-val ro-time">0s</span></div>
          </div>
        </div>
      `;
      p.appendChild(el);
    }
    this.el = el;
    this.countdownEl = el.querySelector('.ro-countdown');
    this.summaryEl = el.querySelector('.ro-summary');
    this.labelEl = el.querySelector('.ro-round-label');
  }

  /**
   * Chamado a cada quadro durante o intervalo: nos últimos 3 s mostra a rodada que vem e o número (3, 2, 1), com um bipe por número. Fora deles não faz nada
   * (e apaga a contagem que ficou na tela, se a rodada foi mudada de outro jeito).
   */
  contar(restanteS: number, proximaRodada: number): void {
    const n = numeroDaContagem(restanteS);
    if (n === null) {
      if (this.numeroAtual !== null) this.parar();
      return;
    }
    if (n === this.numeroAtual) return;
    if (this.numeroAtual === null) this.falar?.(`Rodada ${proximaRodada}`);
    this.numeroAtual = n;
    this.mostrar(`${n}`, proximaRodada);
    this.som?.contagem(n);
  }

  /** A rodada começou: "COMBATE!" por um instante. */
  combate(rodada: number): void {
    this.numeroAtual = null;
    this.mostrar('COMBATE!', rodada);
    this.som?.combate();
    this.falar?.('Combate!');
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.parar(), COMBATE_NA_TELA_MS);
  }

  /** Apaga a abertura (a pausa, a troca de tela, o fim do "COMBATE!"). O painel de estatísticas, se aberto, fica. */
  parar(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.numeroAtual = null;
    this.currentText = '';
    if (this.summaryEl?.hidden !== false && this.el) this.el.style.display = 'none';
  }

  private mostrar(texto: string, rodada: number): void {
    this.currentText = texto;
    if (this.summaryEl) this.summaryEl.hidden = true;
    if (this.countdownEl) {
      this.countdownEl.hidden = false;
      this.countdownEl.textContent = texto;
    }
    if (this.labelEl) {
      const num = this.labelEl.querySelector('#ro-round-num');
      if (num) num.textContent = `${rodada}`;
    }
    if (this.el) {
      this.el.classList.add('leve');
      this.el.style.display = 'flex';
    }
  }

  /** Exibe o painel de fim de rodada com as estatísticas do jogador. */
  showSummary(stats: RoundStatsSummary): void {
    this.lastStats = stats;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.numeroAtual = null;
    if (this.countdownEl) this.countdownEl.hidden = true;
    if (this.summaryEl) this.summaryEl.hidden = false;
    if (this.el) {
      this.el.classList.remove('leve');
      this.el.style.display = 'flex';
    }

    if (this.summaryEl) {
      this.summaryEl.querySelector('.ro-kills')!.textContent = `${stats.kills}`;
      this.summaryEl.querySelector('.ro-damage')!.textContent = `${Math.round(stats.damage)}`;
      this.summaryEl.querySelector('.ro-streak')!.textContent = `${stats.streak}x`;
      this.summaryEl.querySelector('.ro-time')!.textContent = `${Math.round(stats.survivalSeconds)}s`;
    }
  }

  /** Esconde o overlay (inclusive o painel de estatísticas). */
  hide(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.numeroAtual = null;
    this.currentText = '';
    if (this.summaryEl) this.summaryEl.hidden = true;
    if (this.el) this.el.style.display = 'none';
  }
}
