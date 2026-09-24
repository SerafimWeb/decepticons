import {
  calibrateFromCounts,
  cmPer360,
  LIMITS,
  MIN_CALIBRATION_COUNTS,
  radiansPerCount,
  sensitivityForCm360,
  type Settings,
} from '../core/Settings';

/** Pixels da faixa por grau girado: 360° = 1440 px. */
const PX_PER_DEG = 4;
const RAD_TO_DEG = 180 / Math.PI;

type Mode = 'idle' | 'test' | 'record';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  parent.append(e);
  return e;
}

/**
 * Estande de calibração do mouse, com o jogo pausado. O jogador ajusta com calma a sensibilidade
 * medindo o giro de verdade:
 * - Testar: prende o mouse na faixa de bússola e mostra quantos graus o movimento gira.
 * - Gravar 1 volta: o movimento físico que ele quer para 360° vira a sensibilidade (sem saber o DPI).
 * - DPI + cm/360 para quem já tem a medida de outro jogo.
 * O Pointer Lock é pedido na própria faixa, não no canvas: o jogo continua pausado.
 * Abre por botões colocados logo depois de cada `anchor` (tela de pausa e janela de configurações).
 */
export class MouseCalibration {
  private readonly layer: HTMLDivElement;
  private readonly tape: HTMLDivElement;
  private readonly strip: HTMLDivElement;
  private readonly heading: HTMLDivElement;
  private readonly hint: HTMLParagraphElement;
  private readonly sensValue: HTMLSpanElement;
  private readonly dpiInput: HTMLInputElement;
  private readonly cmInput: HTMLInputElement;
  private readonly rawInput: HTMLInputElement;
  private readonly recordBtn: HTMLButtonElement;
  private mode: Mode = 'idle';
  private counts = 0;

  constructor(
    private readonly settings: Settings,
    anchors: readonly Element[],
  ) {
    for (const anchor of anchors) {
      const open = document.createElement('button');
      open.type = 'button';
      // calib-open: some no modo toque (não há mouse para calibrar).
      open.className = 'btn-terminal calib-open';
      open.textContent = '[ CALIBRAR MOUSE ]';
      // O clique na tela de pausa retoma o jogo: aqui não pode.
      open.addEventListener('click', (e) => {
        e.stopPropagation();
        this.open();
      });
      anchor.after(open);
    }

    this.layer = el('div', 'calib', document.body);
    this.layer.hidden = true;
    this.layer.setAttribute('role', 'dialog');
    this.layer.setAttribute('aria-label', 'Calibração do mouse');
    const panel = el('div', 'calib-panel', this.layer);
    el('div', 'calib-title', panel, 'CALIBRAÇÃO DO MOUSE');
    el(
      'p',
      'calib-lede',
      panel,
      'Ajuste com calma, sem inimigos: meça quanto o movimento real do seu mouse gira o Mech.',
    );

    this.tape = el('div', 'calib-tape', panel);
    this.tape.tabIndex = 0;
    this.strip = el('div', 'calib-strip', this.tape);
    for (let deg = -360; deg <= 720; deg += 30) {
      const label = el('span', 'calib-tick', this.strip, String(((deg % 360) + 360) % 360));
      label.style.left = `${(deg + 360) * PX_PER_DEG}px`;
    }
    el('div', 'calib-center', this.tape);
    this.heading = el('div', 'calib-heading', panel);
    this.hint = el('p', 'calib-hint', panel);

    const sensRow = el('div', 'calib-row', panel);
    el('span', 'calib-label', sensRow, 'SENSIBILIDADE');
    this.sensValue = el('span', 'calib-value', sensRow);
    for (const [label, factor] of [['−10%', 0.9], ['−1%', 0.99], ['+1%', 1.01], ['+10%', 1.1]] as const) {
      const b = el('button', 'calib-btn', sensRow, label);
      b.type = 'button';
      b.addEventListener('click', () => this.setSensitivity(this.settings.value.sensitivity * factor));
    }

    const physRow = el('div', 'calib-row', panel);
    el('label', 'calib-label', physRow, 'DPI DO MOUSE').htmlFor = 'calib-dpi';
    this.dpiInput = el('input', 'calib-input', physRow);
    Object.assign(this.dpiInput, { id: 'calib-dpi', type: 'number', min: String(LIMITS.mouseDpi.min), max: String(LIMITS.mouseDpi.max), step: String(LIMITS.mouseDpi.step) });
    this.dpiInput.addEventListener('change', () => {
      this.settings.update({ mouseDpi: Number(this.dpiInput.value) });
      this.render();
    });
    el('label', 'calib-label', physRow, 'CM POR VOLTA (360°)').htmlFor = 'calib-cm';
    this.cmInput = el('input', 'calib-input', physRow);
    Object.assign(this.cmInput, { id: 'calib-cm', type: 'number', min: '2', max: '200', step: '0.5' });
    this.cmInput.addEventListener('change', () => {
      const cm = Number(this.cmInput.value);
      if (cm > 0) this.setSensitivity(sensitivityForCm360(cm, this.settings.value.mouseDpi));
    });

    const actions = el('div', 'calib-row', panel);
    const test = el('button', 'calib-btn wide', actions, '[ TESTAR GIRO ]');
    test.type = 'button';
    test.addEventListener('click', () => this.lock('test'));
    this.recordBtn = el('button', 'calib-btn wide', actions, '[ GRAVAR 1 VOLTA ]');
    this.recordBtn.type = 'button';
    this.recordBtn.addEventListener('click', () => this.lock('record'));
    this.tape.addEventListener('click', () => this.mode === 'idle' && this.lock('test'));

    const rawRow = el('label', 'calib-check', panel);
    this.rawInput = el('input', '', rawRow);
    this.rawInput.type = 'checkbox';
    this.rawInput.addEventListener('change', () => this.settings.update({ rawInput: this.rawInput.checked }));
    el('span', '', rawRow, ' Movimento cru do mouse (ignora a aceleração do Windows: o mesmo gesto gira sempre o mesmo)');

    const done = el('button', 'calib-btn done', panel, '[ PRONTO ]');
    done.type = 'button';
    done.addEventListener('click', () => this.close());

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.tape && this.mode !== 'idle') {
        if (this.mode === 'record') this.finishRecording(false);
        this.mode = 'idle';
        this.render();
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (this.mode === 'idle' || document.pointerLockElement !== this.tape) return;
      this.counts += e.movementX;
      this.renderTape();
    });
    // Clique com o mouse preso termina a gravação da volta.
    document.addEventListener('mousedown', () => {
      if (this.mode === 'record' && document.pointerLockElement === this.tape) this.finishRecording(true);
    });
    this.layer.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.mode === 'idle') this.close();
    });
  }

  open(): void {
    this.layer.hidden = false;
    this.counts = 0;
    this.render();
    this.tape.focus();
  }

  close(): void {
    if (document.pointerLockElement === this.tape) document.exitPointerLock();
    this.mode = 'idle';
    this.layer.hidden = true;
  }

  private setSensitivity(value: number): void {
    const { min, max } = LIMITS.sensitivity;
    this.settings.update({ sensitivity: Math.min(max, Math.max(min, Math.round(value * 1000) / 1000)) });
    this.render();
  }

  private lock(mode: Mode): void {
    this.mode = mode;
    this.counts = 0;
    const request = (options?: PointerLockOptions) => Promise.resolve(this.tape.requestPointerLock(options));
    request(this.settings.value.rawInput ? { unadjustedMovement: true } : undefined)
      .catch(() => request())
      .catch(() => {
        this.mode = 'idle';
        this.hint.textContent = 'O navegador não liberou o mouse. Clique de novo na faixa.';
      });
    this.render();
  }

  private finishRecording(clicked: boolean): void {
    const counts = this.counts;
    this.mode = 'idle';
    if (document.pointerLockElement === this.tape) document.exitPointerLock();
    if (!clicked) {
      this.hint.textContent = 'Gravação cancelada.';
      return;
    }
    const result = calibrateFromCounts(counts);
    if (!result.ok) {
      this.hint.textContent = `Movimento curto demais (${Math.abs(counts)} pontos; precisa de ${MIN_CALIBRATION_COUNTS}). Tente um gesto maior.`;
      return;
    }
    this.settings.update({ sensitivity: result.sensitivity });
    this.counts = 0;
    this.render();
    this.hint.textContent = `Gravado: 1 volta = ${Math.abs(counts)} pontos do mouse. Teste para conferir.`;
  }

  private render(): void {
    const s = this.settings.value;
    this.sensValue.textContent = s.sensitivity.toFixed(2);
    this.dpiInput.value = String(s.mouseDpi);
    this.cmInput.value = cmPer360(s.sensitivity, s.mouseDpi).toFixed(1);
    this.rawInput.checked = s.rawInput;
    this.hint.textContent =
      this.mode === 'record'
        ? 'Mova o mouse a distância que você quer para uma volta inteira e CLIQUE para gravar. Esc cancela.'
        : this.mode === 'test'
          ? 'Mova o mouse: a faixa gira como o Mech giraria. Esc solta o mouse.'
          : 'Clique na faixa (ou em TESTAR GIRO) para prender o mouse.';
    this.renderTape();
  }

  private renderTape(): void {
    const deg = this.counts * radiansPerCount(this.settings.value.sensitivity) * RAD_TO_DEG;
    const shown = ((deg % 360) + 360) % 360;
    this.strip.style.transform = `translateX(${-(shown + 360) * PX_PER_DEG}px)`;
    const turns = Math.trunc(Math.abs(deg) / 360);
    this.heading.textContent =
      this.mode === 'record'
        ? `GRAVANDO · ${Math.abs(this.counts)} pontos`
        : `${deg >= 0 ? '' : '−'}${Math.abs(deg).toFixed(1)}°${turns ? ` · ${turns} volta${turns > 1 ? 's' : ''}` : ''}`;
  }
}
