import type { InputManager } from '../core/InputManager';

export class TouchControls {
  private readonly container: HTMLDivElement;
  private readonly leftZone: HTMLDivElement;
  private readonly rightZone: HTMLDivElement;
  private readonly stickBase: HTMLDivElement;
  private readonly stickKnob: HTMLDivElement;
  
  private leftTouchId: number | null = null;
  private rightTouchId: number | null = null;
  private startX = 0;
  private startY = 0;

  constructor(private readonly input: InputManager) {
    this.container = document.createElement('div');
    this.container.id = 'touch-controls';
    
    this.leftZone = document.createElement('div');
    this.leftZone.className = 'touch-zone left';
    
    this.rightZone = document.createElement('div');
    this.rightZone.className = 'touch-zone right';

    this.stickBase = document.createElement('div');
    this.stickBase.className = 'stick-base';
    this.stickKnob = document.createElement('div');
    this.stickKnob.className = 'stick-knob';
    this.stickBase.appendChild(this.stickKnob);
    this.leftZone.appendChild(this.stickBase);

    const jumpBtn = this.createButton('PULO', () => this.input.virtualJump = true);
    const dashBtn = this.createButton('DASH', () => this.input.virtualDash = true);
    
    const fireBtn = document.createElement('div');
    fireBtn.className = 'touch-btn fire-btn';
    fireBtn.textContent = 'FOGO';
    fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.virtualFire = true; });
    fireBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.input.virtualFire = false; });
    
    const actions = document.createElement('div');
    actions.className = 'touch-actions';
    actions.appendChild(jumpBtn);
    actions.appendChild(dashBtn);
    this.rightZone.appendChild(actions);
    this.rightZone.appendChild(fireBtn);

    this.container.appendChild(this.leftZone);
    this.container.appendChild(this.rightZone);
    document.body.appendChild(this.container);

    this.bindEvents();
    
    window.addEventListener('touchstart', () => {
      this.container.classList.add('active');
    }, { once: true });
  }

  private createButton(label: string, onPress: () => void): HTMLDivElement {
    const btn = document.createElement('div');
    btn.className = 'touch-btn';
    btn.textContent = label;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onPress();
    });
    return btn;
  }

  private bindEvents() {
    this.leftZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.leftTouchId !== null) return;
      const touch = e.changedTouches[0];
      this.leftTouchId = touch.identifier;
      this.startX = touch.clientX;
      this.startY = touch.clientY;
      
      this.stickBase.style.display = 'block';
      this.stickBase.style.left = `${this.startX - 50}px`;
      this.stickBase.style.top = `${this.startY - 50}px`;
      this.stickKnob.style.transform = `translate(0px, 0px)`;
    });

    this.leftZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.leftTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.leftTouchId) {
          const dx = touch.clientX - this.startX;
          const dy = touch.clientY - this.startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 40;
          
          let nx = dx;
          let ny = dy;
          if (dist > maxDist) {
            nx = (dx / dist) * maxDist;
            ny = (dy / dist) * maxDist;
          }
          
          this.stickKnob.style.transform = `translate(${nx}px, ${ny}px)`;
          
          this.input.virtualMoveX = (Math.abs(nx) > 10) ? nx / maxDist : 0;
          this.input.virtualMoveZ = (Math.abs(ny) > 10) ? -ny / maxDist : 0;
        }
      }
    });

    const resetLeft = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.leftTouchId) {
          this.leftTouchId = null;
          this.stickBase.style.display = 'none';
          this.input.virtualMoveX = 0;
          this.input.virtualMoveZ = 0;
        }
      }
    };
    this.leftZone.addEventListener('touchend', resetLeft);
    this.leftZone.addEventListener('touchcancel', resetLeft);

    let lastCamX = 0;
    let lastCamY = 0;
    this.rightZone.addEventListener('touchstart', (e) => {
      if ((e.target as HTMLElement).classList.contains('touch-btn')) return;
      e.preventDefault();
      if (this.rightTouchId !== null) return;
      const touch = e.changedTouches[0];
      this.rightTouchId = touch.identifier;
      lastCamX = touch.clientX;
      lastCamY = touch.clientY;
    });

    this.rightZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.rightTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.rightTouchId) {
          const dx = touch.clientX - lastCamX;
          const dy = touch.clientY - lastCamY;
          lastCamX = touch.clientX;
          lastCamY = touch.clientY;
          
          this.input.injectMouseDelta(dx * 2.5, dy * 2.5);
        }
      }
    });

    const resetRight = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.rightTouchId) {
          this.rightTouchId = null;
        }
      }
    };
    this.rightZone.addEventListener('touchend', resetRight);
    this.rightZone.addEventListener('touchcancel', resetRight);
  }
}