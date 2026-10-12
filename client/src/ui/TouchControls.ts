import type { InputManager } from '../core/InputManager';
import { BASE_SENSITIVITY } from '../core/Settings';
import { DEFAULT_TOUCH_LAYOUT, PAD_BUTTONS, type PadButton, placeButtons, SCALE_LIMITS, type TouchLayout } from './touchLayout';

/**
 * Radianos por pixel arrastado devagar (sensibilidade 1): ~0,3°/px, para o ajuste fino em cima do alvo.
 * Arrastar rápido acelera um pouco (touchLookGain): virar para trás continua sendo um gesto só.
 */
export const TOUCH_RAD_PER_PX = 0.0055;
/** O rig multiplica o delta por radiansPerCount(s) = BASE_SENSITIVITY × s: o toque entra já convertido. */
const LOOK_SCALE = TOUCH_RAD_PER_PX / BASE_SENSITIVITY;
/** Até 15% do raio o direcional não anda: o polegar parado não faz o Mech escorregar. */
const DEADZONE = 0.15;
/**
 * Suavização da velocidade do dedo (0..1, peso da leitura nova). Os eventos de toque chegam em
 * intervalos irregulares; a velocidade crua de cada um oscila, e o ganho oscilava junto (a mira
 * "falhava"). Com a média, o ganho acompanha o gesto, não o ruído.
 */
export const SPEED_SMOOTHING = 0.25;

/** Ganho pela velocidade do dedo (px/ms, já suavizada): 1 devagar; até 1,6 num arrasto rápido (≥ 1,75 px/ms). */
export function touchLookGain(pxPerMs: number): number {
  const t = Math.min(1, Math.max(0, (pxPerMs - 0.25) / 1.5));
  return 1 + 0.6 * t;
}

export interface Stick {
  /** Movimento analógico -1..1 (direita positiva). */
  x: number;
  /** Movimento analógico -1..1 (frente positiva = polegar para cima). */
  z: number;
  /** Posição do pino na tela, presa ao raio da base. */
  knobX: number;
  knobY: number;
}

/**
 * Deslocamento do polegar (px, a partir de onde encostou) → movimento analógico. Zona morta e saturação
 * no raio; o movimento recomeça do zero na borda da zona morta, sem degrau. Escreve em `out` (G4).
 */
export function stickVector(dx: number, dy: number, radius: number, out: Stick): Stick {
  const dist = Math.hypot(dx, dy);
  const clamp = dist > radius ? radius / dist : 1;
  out.knobX = dx * clamp;
  out.knobY = dy * clamp;
  const mag = Math.min(dist / radius, 1);
  if (mag <= DEADZONE) {
    out.x = 0;
    out.z = 0;
    return out;
  }
  const scale = (mag - DEADZONE) / (1 - DEADZONE) / dist;
  out.x = dx * scale;
  out.z = -dy * scale;
  return out;
}

export interface TouchActions {
  onPause(): void;
  onCamera(): void;
  /** O jogador terminou de ajustar os botões (salvar e voltar para a pausa). */
  onLayoutDone(layout: TouchLayout): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  parent.append(e);
  return e;
}

const LABELS: Record<PadButton, string> = { fire: 'ATQ 1', jump: 'PULO', dash: 'DASH', rocket: 'ATQ 2', cam: 'CAM 3ª' };

/**
 * Controles de toque (celular e tablet), visíveis só no modo toque e com o jogo rodando.
 * - Metade esquerda: direcional analógico que nasce onde o polegar encosta.
 * - Metade direita: arrastar mira; FOGO atira enquanto pressionado e também mira se o dedo arrastar.
 * - Botões em arco em volta do polegar direito (touchLayout.ts); o jogador pode arrastar cada um e
 *   mudar o tamanho no editor ("Ajustar controles", na pausa). Pausa e PLACAR no topo.
 * Gera o mesmo MechInput do teclado (via InputManager): a simulação não sabe de onde veio o comando.
 * Custo: só eventos de ponteiro (nada por quadro); nenhuma alocação por movimento.
 */
export class TouchControls {
  private readonly root: HTMLDivElement;
  private readonly stick: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly buttons = {} as Record<PadButton, HTMLButtonElement>;
  private readonly editBar: HTMLDivElement;
  private readonly sizeInput: HTMLInputElement;
  private readonly state: Stick = { x: 0, z: 0, knobX: 0, knobY: 0 };
  private layout: TouchLayout = structuredClone(DEFAULT_TOUCH_LAYOUT) as TouchLayout;
  private editing = false;
  private movePointer: number | null = null;
  private originX = 0;
  private originY = 0;
  private radius = 1;
  /** Dedos que miram (zona direita ou FOGO) → última posição, instante e velocidade suavizada. */
  private readonly aimers = new Map<number, { x: number; y: number; t: number; v: number }>();
  private readonly firePointers = new Set<number>();

  constructor(
    private readonly input: InputManager,
    private readonly actions: TouchActions,
  ) {
    this.root = el('div', '', document.body);
    this.root.id = 'touch-controls';
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());

    const move = el('div', 'tc-zone tc-move', this.root);
    const look = el('div', 'tc-zone tc-look', this.root);
    this.stick = el('div', 'tc-stick', this.root);
    this.knob = el('div', 'tc-knob', this.stick);

    for (const b of PAD_BUTTONS) {
      const btn = el('button', `tc-btn tc-${b}`, this.root, LABELS[b]);
      btn.type = 'button';
      this.buttons[b] = btn;
    }
    const pause = el('button', 'tc-pause', this.root, '❚❚');
    pause.setAttribute('aria-label', 'Pausar');
    const board = el('button', 'tc-board', this.root, 'PLACAR');
    pause.type = board.type = 'button';

    // Barra do editor de botões (só aparece ao ajustar os controles).
    this.editBar = el('div', 'tc-editbar', this.root);
    el('span', 'tc-edit-hint', this.editBar, 'ARRASTE OS BOTÕES');
    const sizeLabel = el('label', 'tc-edit-size', this.editBar, 'TAMANHO ');
    this.sizeInput = el('input', '', sizeLabel);
    Object.assign(this.sizeInput, { type: 'range', min: String(SCALE_LIMITS.min), max: String(SCALE_LIMITS.max), step: '0.05' });
    const reset = el('button', 'tc-edit-btn', this.editBar, 'PADRÃO');
    const done = el('button', 'tc-edit-btn done', this.editBar, 'PRONTO');
    reset.type = done.type = 'button';
    this.sizeInput.addEventListener('input', () => {
      this.layout.scale = Number(this.sizeInput.value);
      this.applyLayout();
    });
    reset.addEventListener('click', () => {
      this.layout = structuredClone(DEFAULT_TOUCH_LAYOUT) as TouchLayout;
      this.sizeInput.value = String(this.layout.scale);
      this.applyLayout();
    });
    done.addEventListener('click', () => this.stopEditing());

    // --- andar ---
    move.addEventListener('pointerdown', (e) => {
      if (this.movePointer !== null || this.editing) return;
      e.preventDefault();
      move.setPointerCapture(e.pointerId);
      this.movePointer = e.pointerId;
      // A base fica onde o polegar encostou, inteira na tela.
      const rect = this.stick.getBoundingClientRect();
      this.radius = rect.width / 2;
      const gx = rect.left + this.radius;
      const gy = rect.top + this.radius;
      const m = this.radius + 6;
      this.originX = Math.max(m, e.clientX);
      this.originY = Math.min(window.innerHeight - m, Math.max(m, e.clientY));
      this.stick.style.transform = `translate(${this.originX - gx}px, ${this.originY - gy}px)`;
      this.stick.classList.add('held');
      this.updateStick(e.clientX, e.clientY);
    });
    move.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.movePointer) this.updateStick(e.clientX, e.clientY);
    });
    const endMove = (e: PointerEvent) => {
      if (e.pointerId === this.movePointer) this.releaseStick();
    };
    move.addEventListener('pointerup', endMove);
    move.addEventListener('pointercancel', endMove);

    // --- mirar (zona da direita e o próprio FOGO) ---
    const fire = this.buttons.fire;
    const startAim = (e: PointerEvent, target: HTMLElement) => {
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      this.aimers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, v: 0 });
    };
    const aim = (e: PointerEvent) => {
      const a = this.aimers.get(e.pointerId);
      if (!a) return;
      const dx = e.clientX - a.x;
      const dy = e.clientY - a.y;
      // Velocidade suavizada (média exponencial): o ganho segue o gesto, não o ruído dos eventos.
      a.v += SPEED_SMOOTHING * (Math.hypot(dx, dy) / Math.max(4, e.timeStamp - a.t) - a.v);
      const gain = touchLookGain(a.v) * LOOK_SCALE;
      this.input.injectMouseDelta(dx * gain, dy * gain);
      a.x = e.clientX;
      a.y = e.clientY;
      a.t = e.timeStamp;
    };
    const endAim = (e: PointerEvent) => {
      this.aimers.delete(e.pointerId);
      if (this.firePointers.delete(e.pointerId) && this.firePointers.size === 0) this.setFire(false);
    };
    look.addEventListener('pointerdown', (e) => {
      if (!this.editing) startAim(e, look);
    });
    fire.addEventListener('pointerdown', (e) => {
      if (this.editing) return;
      startAim(e, fire);
      this.firePointers.add(e.pointerId);
      this.setFire(true);
    });
    for (const t of [look, fire] as HTMLElement[]) {
      t.addEventListener('pointermove', aim);
      t.addEventListener('pointerup', endAim);
      t.addEventListener('pointercancel', endAim);
    }

    // --- ações de toque único e de segurar ---
    const hold = (b: HTMLButtonElement, set: (on: boolean) => void) => {
      b.addEventListener('pointerdown', (e) => {
        if (this.editing) return;
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        b.classList.add('pressed');
        set(true);
      });
      const up = () => {
        b.classList.remove('pressed');
        set(false);
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    };
    const tap = (b: HTMLButtonElement, action: () => void) => {
      b.addEventListener('pointerdown', (e) => {
        if (this.editing) return;
        e.preventDefault();
        b.classList.add('pressed');
        action();
      });
      const up = () => b.classList.remove('pressed');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    };
    tap(this.buttons.jump, () => (this.input.virtualJump = true));
    tap(this.buttons.dash, () => (this.input.virtualDash = true));
    tap(this.buttons.cam, () => this.actions.onCamera());
    // Segurar: FOGUETE dispara o carregador no ritmo do intervalo; PLACAR mostra o placar (o Tab do toque).
    hold(this.buttons.rocket, (on) => (this.input.virtualRocket = on));
    hold(board, (on) => (this.input.virtualBoard = on));
    // Pausa no click (não no pointerdown): a tela de pausa aparece depois do toque acabar e não
    // recebe o click do mesmo dedo, que retomaria o jogo na hora.
    pause.addEventListener('click', () => this.actions.onPause());

    // --- editor: arrastar cada botão ---
    for (const b of PAD_BUTTONS) {
      const btn = this.buttons[b];
      let grab: { id: number; dx: number; dy: number } | null = null;
      btn.addEventListener('pointerdown', (e) => {
        if (!this.editing) return;
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        const r = btn.getBoundingClientRect();
        grab = { id: e.pointerId, dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
        btn.classList.add('pressed');
      });
      btn.addEventListener('pointermove', (e) => {
        if (!this.editing || grab?.id !== e.pointerId) return;
        this.layout.pos[b] = [(e.clientX - grab.dx) / window.innerWidth, (e.clientY - grab.dy) / window.innerHeight];
        this.applyLayout();
      });
      const drop = () => {
        grab = null;
        btn.classList.remove('pressed');
      };
      btn.addEventListener('pointerup', drop);
      btn.addEventListener('pointercancel', drop);
    }

    window.addEventListener('resize', () => this.applyLayout());
    this.applyLayout();
  }

  /** Aparece só no modo toque com o jogo rodando; ao sumir, solta tudo o que estava pressionado. */
  setVisible(on: boolean): void {
    this.root.classList.toggle('on', on || this.editing);
    if (on) return;
    this.releaseStick();
    this.aimers.clear();
    this.firePointers.clear();
    this.setFire(false);
    this.input.virtualRocket = false;
    this.input.virtualBoard = false;
    for (const b of this.root.querySelectorAll('.pressed')) b.classList.remove('pressed');
  }

  /** Layout salvo (ou o padrão): posições em fração da tela e tamanho. */
  setLayout(layout: TouchLayout): void {
    this.layout = structuredClone(layout);
    this.applyLayout();
  }

  /** Editor: os botões aparecem sobre o jogo parado e podem ser arrastados; PRONTO salva e volta. */
  startEditing(): void {
    this.editing = true;
    this.sizeInput.value = String(this.layout.scale);
    this.root.classList.add('on', 'editing');
    this.applyLayout();
  }

  /** Algum dedo mirando agora (a mira assistida só puxa enquanto o jogador age). */
  get aiming(): boolean {
    return this.aimers.size > 0;
  }

  /** Arma superaquecida: o FOGO avisa (e o tiro não sai até esfriar). */
  setOverheated(on: boolean): void {
    const b = this.buttons.fire;
    if (b.classList.contains('over') === on) return;
    b.classList.toggle('over', on);
    b.textContent = on ? 'QUENTE' : LABELS.fire;
  }

  setCameraLabel(text: string): void {
    this.buttons.cam.textContent = text;
  }

  private stopEditing(): void {
    this.editing = false;
    this.root.classList.remove('editing', 'on');
    this.actions.onLayoutDone(structuredClone(this.layout));
  }

  /** Posiciona e dimensiona cada botão pelo layout (px), sempre inteiros dentro da tela. */
  private applyLayout(): void {
    const placed = placeButtons(this.layout, window.innerWidth, window.innerHeight);
    for (const b of PAD_BUTTONS) {
      const { x, y, d } = placed[b];
      const s = this.buttons[b].style;
      s.width = s.height = `${d}px`;
      s.left = `${x - d / 2}px`;
      s.top = `${y - d / 2}px`;
    }
  }

  private updateStick(x: number, y: number): void {
    const s = stickVector(x - this.originX, y - this.originY, this.radius, this.state);
    this.knob.style.transform = `translate(${s.knobX}px, ${s.knobY}px)`;
    this.input.virtualMoveX = s.x;
    this.input.virtualMoveZ = s.z;
  }

  private releaseStick(): void {
    this.movePointer = null;
    this.stick.classList.remove('held');
    this.stick.style.transform = '';
    this.knob.style.transform = '';
    this.input.virtualMoveX = 0;
    this.input.virtualMoveZ = 0;
  }

  private setFire(on: boolean): void {
    this.input.virtualFire = on;
    this.buttons.fire.classList.toggle('pressed', on);
  }
}
