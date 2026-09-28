/**
 * MissionHUD — Interface do modo Sobrevivência.
 *
 * Três estados: briefing (antes da onda), combate (HUD de onda visível) e resumo (ao cair ou limpar).
 * Este módulo cuida só da interface; a lógica de ondas e IA fica em sim/Match.ts (Claude).
 *
 * Contrato esperado do servidor/simulação (G3 — callbacks):
 *   onWaveStart(wave, totalEnemies, briefing)
 *   onWaveProgress(killed, total, waveTimeSecs)
 *   onWaveClear(wave, timeSecs, bonusText)
 *   onMissionEnd(survived, waveReached, stats)
 *
 * Custo de CPU: zero por frame quando oculto; ±2 DOM writes/s no combate (textContent só ao mudar).
 */

export interface MissionStats {
  waveReached: number;
  kills: number;
  damageDealt: number;
  survivalSeconds: number;
  /** Texto de conquista opcional, ex.: "3 ondas sem morrer" */
  bonus?: string;
}

export interface WaveBriefing {
  wave: number;
  title: string;
  /** Linhas de descrição da ameaça, exibidas como log de terminal. */
  threats: string[];
  /** Segundos para o briefing fechar automaticamente (0 = manual). */
  autoStartSecs?: number;
}

/** Retorna um nível de ameaça descritivo para o banner lateral. */
function threatLevel(wave: number): string {
  if (wave <= 2) return 'BAIXO';
  if (wave <= 5) return 'MÉDIO';
  if (wave <= 9) return 'ALTO';
  return 'CRÍTICO';
}

/** Formata segundos como mm:ss para o HUD de onda. */
function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface MedalBadge {
  icon: string;
  title: string;
  description: string;
}

/** Calcula as medalhas de conquista conquistadas com base nas estatísticas finais da missão. */
export function getMissionMedals(survived: boolean, stats: MissionStats): MedalBadge[] {
  const medals: MedalBadge[] = [];
  if (survived || stats.waveReached >= 5) {
    medals.push({ icon: '🏅', title: 'SOBREVIVENTE SÊNIOR', description: 'Completou 5+ ondas ou sobreviveu' });
  }
  if (stats.kills >= 8) {
    medals.push({ icon: '🎯', title: 'CAÇADOR DE IAs', description: 'Eliminou 8 ou mais robôs rebeldes' });
  }
  if (stats.damageDealt >= 1500) {
    medals.push({ icon: '💥', title: 'DEVASTADOR DE AÇO', description: 'Causou 1500+ de dano total' });
  }
  if (stats.waveReached >= 3) {
    medals.push({ icon: '⚡', title: 'VETERANO DE ONDAS', description: 'Resistiu a 3 ou mais ondas' });
  }
  return medals;
}

export class MissionHUD {
  private readonly briefingEl: HTMLElement;
  private readonly waveHudEl: HTMLElement;
  private readonly summaryEl: HTMLElement;

  // Estado interno para evitar escritas desnecessárias no DOM (G4 adaptado para UI)
  private shownKilled = -1;
  private shownTotal = -1;
  private shownTime = '';
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private onStartCallback: (() => void) | null = null;

  constructor() {
    this.briefingEl = this._getOrCreate('mission-briefing');
    this.waveHudEl = this._getOrCreate('mission-wave-hud');
    this.summaryEl = this._getOrCreate('mission-summary');
  }

  // ─── API pública: chamada pela simulação/Game ──────────────────────────────

  /**
   * Abre o briefing da onda com efeito de "digitação" nas ameaças.
   * `onStart` é chamado quando o jogador pressiona INICIAR ou o timer esgota.
   */
  showBriefing(b: WaveBriefing, onStart: () => void): void {
    this.onStartCallback = onStart;
    this._hideAll();

    const wave = b.wave;
    const level = threatLevel(wave);
    const levelClass = wave <= 2 ? 'low' : wave <= 5 ? 'medium' : wave <= 9 ? 'high' : 'critical';

    this.briefingEl.innerHTML = `
      <div class="mission-briefing-inner">
        <div class="mission-header">
          <span class="mission-tag">// MISSÃO</span>
          <span class="mission-wave-num" id="mission-wave-num"></span>
        </div>
        <h2 class="mission-title" id="mission-title"></h2>
        <div class="mission-threat-level ${levelClass}">
          NÍVEL DE AMEAÇA // <strong id="mission-threat-level"></strong>
        </div>
        <ul class="mission-threats" id="mission-threats-list"></ul>
        <div class="mission-briefing-footer">
          <button id="btn-mission-start" class="btn-terminal btn-mission-go">[ INICIAR MISSÃO ]</button>
          ${b.autoStartSecs ? `<span class="mission-auto-timer" id="mission-auto-timer"></span>` : ''}
        </div>
      </div>
    `;
    this.briefingEl.classList?.remove('hidden');

    if (typeof document !== 'undefined') {
      const waveEl = document.getElementById('mission-wave-num');
      if (waveEl) waveEl.textContent = `ONDA ${wave}`;
      const titleEl = document.getElementById('mission-title');
      if (titleEl) titleEl.textContent = b.title.toUpperCase();
      const levelEl = document.getElementById('mission-threat-level');
      if (levelEl) levelEl.textContent = level;
      const timerEl = document.getElementById('mission-auto-timer');
      if (timerEl && b.autoStartSecs) timerEl.textContent = `AUTO ${b.autoStartSecs}s`;

      document.getElementById('btn-mission-start')?.addEventListener('click', () => this._triggerStart());
      const listEl = document.getElementById('mission-threats-list');
      if (listEl) this._typeThreats(b.threats, listEl);
    }

    // Timer de início automático
    if (b.autoStartSecs && b.autoStartSecs > 0) {
      let remaining = b.autoStartSecs;
      const timerEl = document.getElementById('mission-auto-timer');
      const tick = () => {
        remaining -= 1;
        if (timerEl) timerEl.textContent = `AUTO ${remaining}s`;
        if (remaining <= 0) { this._triggerStart(); return; }
        this.autoTimer = setTimeout(tick, 1000);
      };
      this.autoTimer = setTimeout(tick, 1000);
    }
  }

  /**
   * Mostra o HUD de onda no canto da tela (indicador compacto).
   * Chamado imediatamente ao começar a onda; atualizado por `updateWave`.
   */
  showWaveHud(wave: number, total: number): void {
    this._hideAll();
    this.shownKilled = -1;
    this.shownTotal = -1;
    this.shownTime = '';

    this.waveHudEl.innerHTML = `
      <div class="wave-hud-inner">
        <div class="wave-hud-label">ONDA <span id="wave-num">${wave}</span></div>
        <div class="wave-hud-progress">
          <span id="wave-killed">0</span> / <span id="wave-total">${total}</span>
        </div>
        <div class="wave-hud-bar-track">
          <div class="wave-hud-bar-fill" id="wave-bar-fill"></div>
        </div>
        <div class="wave-hud-time" id="wave-time">0:00</div>
      </div>
    `;
    this.waveHudEl.classList?.remove('hidden');
    this.updateWave(0, total, 0);
  }

  /**
   * Atualiza o indicador de onda sem reescrever o DOM se nada mudou.
   * Deve ser chamado em cada tick da simulação (ou a cada segundo, suficiente).
   */
  updateWave(killed: number, total: number, elapsedSecs: number): void {
    const timeStr = fmtTime(elapsedSecs);
    const k = Math.min(killed, total);

    if (k === this.shownKilled && total === this.shownTotal && timeStr === this.shownTime) return;

    if (typeof document !== 'undefined') {
      if (k !== this.shownKilled) {
        const el = document.getElementById('wave-killed');
        if (el) el.textContent = String(k);
      }
      if (total !== this.shownTotal) {
        const el = document.getElementById('wave-total');
        if (el) el.textContent = String(total);
      }

      const pct = total > 0 ? k / total : 0;
      const fill = document.getElementById('wave-bar-fill');
      if (fill) {
        fill.style.transform = `scaleX(${pct})`;
        fill.classList.toggle('high', pct >= 0.75);
      }

      if (timeStr !== this.shownTime) {
        const el = document.getElementById('wave-time');
        if (el) el.textContent = timeStr;
      }
    }

    this.shownKilled = k;
    this.shownTotal = total;
    this.shownTime = timeStr;
  }

  /**
   * Exibe banner flutuante "ONDA LIMPA" com bônus, depois esconde em 3 s.
   * Usado entre uma onda e o próximo briefing.
   */
  showWaveClear(wave: number, timeSecs: number, bonusText = ''): void {
    const existing = document.getElementById('wave-clear-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'wave-clear-banner';
    banner.className = 'wave-clear-banner';

    const titleEl = document.createElement('div');
    titleEl.className = 'wave-clear-title';
    titleEl.textContent = `ONDA ${wave} ELIMINADA`;
    banner.appendChild(titleEl);

    const timeEl = document.createElement('div');
    timeEl.className = 'wave-clear-time';
    timeEl.textContent = `// ${fmtTime(timeSecs)}`;
    banner.appendChild(timeEl);

    if (bonusText) {
      const bonusEl = document.createElement('div');
      bonusEl.className = 'wave-clear-bonus';
      bonusEl.textContent = bonusText;
      banner.appendChild(bonusEl);
    }

    document.getElementById('hud')?.appendChild(banner);

    // Entrada com animação e saída automática
    requestAnimationFrame(() => banner.classList.add('show'));
    setTimeout(() => {
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 600);
    }, 3000);
  }

  /**
   * Tela final da missão: morreu ou venceu (survived=true).
   */
  showSummary(survived: boolean, stats: MissionStats): void {
    this._hideAll();

    const title = survived ? 'MISSÃO CONCLUÍDA' : 'PILOTO ABATIDO';
    const titleClass = survived ? 'survived' : 'failed';
    const medals = getMissionMedals(survived, stats);

    this.summaryEl.innerHTML = `
      <div class="mission-summary-inner">
        <div class="mission-summary-title ${titleClass}" id="summary-title"></div>
        <div class="mission-summary-wave">ONDAS COMPLETADAS: <strong id="summary-waves"></strong></div>
        <ul class="mission-summary-stats">
          <li>ABATES         <span id="summary-kills"></span></li>
          <li>DANO CAUSADO   <span id="summary-damage"></span></li>
          <li>TEMPO          <span id="summary-time"></span></li>
          <li id="summary-bonus-item" class="bonus animated-bonus hidden">★ BÔNUS  <span id="summary-bonus"></span></li>
        </ul>
        <div id="summary-medals-section" class="mission-medals-section hidden">
          <div class="mission-medals-title">// CONQUISTAS OBTIDAS</div>
          <div class="mission-medals-grid" id="summary-medals-grid"></div>
        </div>
        <div class="mission-summary-actions">
          <button id="btn-mission-retry" class="btn-terminal">[ TENTAR NOVAMENTE ]</button>
          <button id="btn-mission-exit" class="btn-terminal">[ SAIR ]</button>
        </div>
      </div>
    `;
    this.summaryEl.classList?.remove('hidden');

    if (typeof document !== 'undefined') {
      const titleEl = document.getElementById('summary-title');
      if (titleEl) titleEl.textContent = title;
      const waveEl = document.getElementById('summary-waves');
      if (waveEl) waveEl.textContent = String(stats.waveReached);
      const killsEl = document.getElementById('summary-kills');
      if (killsEl) killsEl.textContent = String(stats.kills);
      const damageEl = document.getElementById('summary-damage');
      if (damageEl) damageEl.textContent = stats.damageDealt.toFixed(0);
      const timeEl = document.getElementById('summary-time');
      if (timeEl) timeEl.textContent = fmtTime(stats.survivalSeconds);

      if (stats.bonus) {
        const bonusItem = document.getElementById('summary-bonus-item');
        const bonusEl = document.getElementById('summary-bonus');
        if (bonusItem && bonusEl) {
          bonusItem.classList.remove('hidden');
          bonusEl.textContent = stats.bonus;
        }
      }

      if (medals.length > 0) {
        const sectionEl = document.getElementById('summary-medals-section');
        const gridEl = document.getElementById('summary-medals-grid');
        if (sectionEl && gridEl) {
          sectionEl.classList.remove('hidden');
          medals.forEach((m, idx) => {
            const card = document.createElement('div');
            card.className = 'mission-medal-card';
            card.style.animationDelay = `${idx * 0.15}s`;

            const iconSpan = document.createElement('span');
            iconSpan.className = 'medal-icon';
            iconSpan.textContent = m.icon;
            card.appendChild(iconSpan);

            const infoDiv = document.createElement('div');
            infoDiv.className = 'medal-info';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'medal-name';
            nameDiv.textContent = m.title;
            infoDiv.appendChild(nameDiv);

            const descDiv = document.createElement('div');
            descDiv.className = 'medal-desc';
            descDiv.textContent = m.description;
            infoDiv.appendChild(descDiv);

            card.appendChild(infoDiv);
            gridEl.appendChild(card);
          });
        }
      }

      document.getElementById('btn-mission-retry')?.addEventListener('click', () => this.onRetry?.());
      document.getElementById('btn-mission-exit')?.addEventListener('click', () => this.onExit?.());
    }
  }

  /** Esconde toda a interface de missão (volta ao HUD normal). */
  hide(): void {
    this._hideAll();
  }

  /** Callback chamado ao pressionar "tentar novamente" na tela de resumo. */
  onRetry: (() => void) | null = null;
  /** Callback chamado ao pressionar "sair" na tela de resumo. */
  onExit: (() => void) | null = null;

  // ─── Internos ──────────────────────────────────────────────────────────────

  private _getOrCreate(id: string): HTMLElement {
    if (typeof document === 'undefined') {
      const mockClassList = { add: () => {}, remove: () => {}, toggle: () => {} };
      return {
        id,
        className: id + ' hidden',
        classList: mockClassList,
        innerHTML: '',
        style: {},
      } as unknown as HTMLElement;
    }
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = id + ' hidden';
      document.getElementById('hud')?.appendChild(el);
    }
    return el;
  }

  private _hideAll(): void {
    if (this.autoTimer !== null) { clearTimeout(this.autoTimer); this.autoTimer = null; }
    this.briefingEl.classList?.add('hidden');
    this.waveHudEl.classList?.add('hidden');
    this.summaryEl.classList?.add('hidden');

    if (typeof document !== 'undefined') {
      const banner = document.getElementById('wave-clear-banner');
      if (banner) banner.remove();
    }
  }

  private _triggerStart(): void {
    if (this.autoTimer !== null) { clearTimeout(this.autoTimer); this.autoTimer = null; }
    this.briefingEl.classList?.add('hidden');
    this.onStartCallback?.();
    this.onStartCallback = null;
  }

  /** Efeito de "digitação" nas linhas de ameaça do briefing. */
  private _typeThreats(threats: string[], container: HTMLElement): void {
    let i = 0;
    const next = () => {
      if (i >= threats.length) return;
      const li = document.createElement('li');
      li.textContent = '> ' + threats[i];
      li.classList.add('typing');
      container.appendChild(li);
      i++;
      // Linha seguinte com delay de 180ms por linha
      setTimeout(next, 180);
    };
    next();
  }
}
