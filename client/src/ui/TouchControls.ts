import type { InputManager } from '../core/InputManager';
import { BASE_SENSITIVITY } from '../core/Settings';

/**
 * Radianos por pixel arrastado devagar (sensibilidade 1): ~0,3°/px, para o ajuste fino em cima do alvo.
 * Arrastar rápido acelera (touchLookGain): virar para trás continua sendo um gesto só.
 */
export const TOUCH_RAD_PER_PX = 0.0055;
/** O rig multiplica o delta por radiansPerCount(s) = BASE_SENSITIVITY × s: o toque entra já convertido. */
const LOOK_SCALE = TOUCH_RAD_PER_PX / BASE_SENSITIVITY;
/** Até 15% do raio o direcional não anda: o polegar parado não faz o Mech escorregar. */
const DEADZONE = 0.15;

/** Ganho pela velocidade do dedo (px/ms): 1 devagar; até 2,2 num arrasto rápido (≥ 1,75 px/ms). */
export function touchLookGain(pxPerMs: number): number {
  const t = Math.min(1, Math.max(0, (pxPerMs - 0.25) / 1.5));
  return 1 + 1.2 * t;
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
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  parent.append(e);
  return e;
}

/**
 * Controles de toque (celular e tablet), visíveis só no modo toque e com o jogo rodando.
 * - Metade esquerda: direcional analógico que nasce onde o polegar encosta.
 * - Metade direita: arrastar mira; FOGO atira enquanto pressionado e também mira se o dedo arrastar.
 * - Canto direito: CAM, DASH, PULO e FOGO numa grade (nunca se sobrepõem); pausa no topo.
 * Gera o mesmo MechInput do teclado (via InputManager): a simulação não sabe de onde veio o comando.
 * Custo: só eventos de ponteiro (nada por quadro); nenhuma alocação por movimento.
 */
export class TouchControls {
  private readonly root: HTMLDivElement;
  private readonly stick: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly camBtn: HTMLButtonElement;
  private readonly fireBtn: HTMLButtonElement;
  private readonly state: Stick = { x: 0, z: 0, knobX: 0, knobY: 0 };
  private movePointer: number | null = null;
  private originX = 0;
  private originY = 0;
  private radius = 1;
  /** Dedos que miram (zona direita ou FOGO) → última posição e instante. Entradas criadas só ao encostar. */
  private readonly aimers = new Map<number, { x: number; y: number; t: number }>();
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

    const pad = el('div', 'tc-pad', this.root);
    this.camBtn = el('button', 'tc-btn tc-cam', pad, 'CAM 3ª');
    const dash = el('button', 'tc-btn', pad, 'DASH');
    const jump = el('button', 'tc-btn', pad, 'PULO');
    this.fireBtn = el('button', 'tc-btn tc-fire', pad, 'FOGO');
    const rocket = el('button', 'tc-btn tc-rocket', pad, 'FOGUETE');
    const pause = el('button', 'tc-pause', this.root, '❚❚');
    pause.setAttribute('aria-label', 'Pausar');
    const board = el('button', 'tc-board', this.root, 'PLACAR');
    for (const b of [this.camBtn, dash, jump, this.fireBtn, rocket, pause, board]) b.type = 'button';

    // --- andar ---
    move.addEventListener('pointerdown', (e) => {
      if (this.movePointer !== null) return;
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
    const startAim = (e: PointerEvent, target: HTMLElement) => {
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      this.aimers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
    };
    const aim = (e: PointerEvent) => {
      const a = this.aimers.get(e.pointerId);
      if (!a) return;
      const dx = e.clientX - a.x;
      const dy = e.clientY - a.y;
      const gain = touchLookGain(Math.hypot(dx, dy) / Math.max(1, e.timeStamp - a.t)) * LOOK_SCALE;
      this.input.injectMouseDelta(dx * gain, dy * gain);
      a.x = e.clientX;
      a.y = e.clientY;
      a.t = e.timeStamp;
    };
    const endAim = (e: PointerEvent) => {
      this.aimers.delete(e.pointerId);
      if (this.firePointers.delete(e.pointerId) && this.firePointers.size === 0) this.setFire(false);
    };
    look.addEventListener('pointerdown', (e) => startAim(e, look));
    this.fireBtn.addEventListener('pointerdown', (e) => {
      startAim(e, this.fireBtn);
      this.firePointers.add(e.pointerId);
      this.setFire(true);
    });
    for (const t of [look, this.fireBtn] as HTMLElement[]) {
      t.addEventListener('pointermove', aim);
      t.addEventListener('pointerup', endAim);
      t.addEventListener('pointercancel', endAim);
    }

    // --- ações de toque único ---
    const hold = (b: HTMLButtonElement, set: (on: boolean) => void) => {
      b.addEventListener('pointerdown', (e) => {
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
        e.preventDefault();
        b.classList.add('pressed');
        action();
      });
      const up = () => b.classList.remove('pressed');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    };
    tap(jump, () => (this.input.virtualJump = true));
    tap(dash, () => (this.input.virtualDash = true));
    tap(this.camBtn, () => this.actions.onCamera());
    // Segurar: FOGUETE dispara o carregador no ritmo do intervalo; PLACAR mostra o placar (o Tab do toque).
    hold(rocket, (on) => (this.input.virtualRocket = on));
    hold(board, (on) => (this.input.virtualBoard = on));
    // Pausa no click (não no pointerdown): a tela de pausa aparece depois do toque acabar e não
    // recebe o click do mesmo dedo, que retomaria o jogo na hora.
    pause.addEventListener('click', () => this.actions.onPause());
  }

  /** Aparece só no modo toque com o jogo rodando; ao sumir, solta tudo o que estava pressionado. */
  setVisible(on: boolean): void {
    this.root.classList.toggle('on', on);
    if (on) return;
    this.releaseStick();
    this.aimers.clear();
    this.firePointers.clear();
    this.setFire(false);
    this.input.virtualRocket = false;
    this.input.virtualBoard = false;
    for (const b of this.root.querySelectorAll('.pressed')) b.classList.remove('pressed');
  }

  /** Algum dedo mirando agora (a mira assistida só puxa enquanto o jogador age). */
  get aiming(): boolean {
    return this.aimers.size > 0;
  }

  setCameraLabel(text: string): void {
    this.camBtn.textContent = text;
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
    this.fireBtn.classList.toggle('pressed', on);
  }
}
