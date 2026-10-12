import type { SquadOrder } from '../combat/BotController';
/** Ordens de arena offline: teclado e toque usam o mesmo callback. */
export class SquadHUD {
  private readonly root = document.createElement('div');
  private readonly status = document.createElement('span');
  private messageTime = 0;
  private wait = 0;
  private readonly buttons: HTMLButtonElement[] = [];
  onOrder?: (order: SquadOrder) => boolean;
  constructor() {
    this.root.id = 'squad-orders';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Ordens para aliados');
    for (const [order, label] of [['follow','1 · Acompanhar'],['focus','2 · Foco'],['hold','3 · Defender']] as const) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.dataset.order = order;
      b.addEventListener('click', e => { e.stopPropagation(); this.command(order); });
      this.root.append(b); this.buttons.push(b);
    }
    this.status.setAttribute('role', 'status'); this.root.append(this.status);
    document.getElementById('hud')!.append(this.root);
  }
  command(order: SquadOrder): void {
    if (this.root.hidden) return;
    const ok = this.onOrder?.(order);
    this.messageTime = 3;
    this.status.textContent = ok ? ({follow:'Equipe: acompanhando você',focus:'Equipe: concentrar fogo',hold:'Equipe: defender esta posição'}[order]) : 'Mire em um inimigo visível para marcar o alvo';
  }
  update(dt: number, visible: boolean, order: SquadOrder, alive: number, total = 2): void {
    this.root.hidden = !visible;
    if (!visible) return;
    this.messageTime -= dt;
    this.wait -= dt; if (this.wait > 0) return; this.wait = 0.1;
    if (this.messageTime <= 0) this.status.textContent = `${alive}/${total} aliados · ` + ({follow:'Escolta',focus:'Fogo concentrado',hold:'Defesa de posição'}[order]);
    for (const b of this.buttons) b.setAttribute('aria-pressed',String(b.dataset.order === order));
  }
}
