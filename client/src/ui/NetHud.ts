import type { RosterEntry } from '../../../shared/net/messages';

/**
 * NetHud — Indicador de status da rede, latência e sala no topo da tela.
 * Fica abaixo do relógio da rodada. Só grava no DOM se o estado mudar (G4).
 */
export class NetHud {
  private readonly el: HTMLDivElement | null = null;
  public online = false;
  public room = '';
  public pingMs = 0;
  public statusText = '';
  public isError = false;
  public playerCount = 0;

  constructor(parent?: HTMLElement) {
    if (typeof document === 'undefined') return;
    const p = parent ?? document.body;
    let el = p.querySelector<HTMLDivElement>('.net-status');
    if (!el) {
      el = document.createElement('div');
      el.className = 'net-status';
      el.style.display = 'none';
      p.appendChild(el);
    }
    this.el = el;
  }

  /** Ativa ou desativa a exibição do indicador online. */
  setOnline(online: boolean, room = 'ARENA'): void {
    if (this.online === online && this.room === room) return;
    this.online = online;
    this.room = room;
    if (this.el) this.el.style.display = online ? 'block' : 'none';
    this.render();
  }

  /** Atualiza o ping medido em ms. */
  setPing(ms: number): void {
    const rounded = Math.max(0, Math.round(ms));
    if (this.pingMs === rounded) return;
    this.pingMs = rounded;
    if (this.online) this.render();
  }

  /** Define texto de status (ex: "CONECTANDO...", "SALA CHEIA", "DESCONECTADO"). */
  setStatus(text: string, isError = false): void {
    if (this.statusText === text && this.isError === isError) return;
    this.statusText = text;
    this.isError = isError;
    if (this.online) this.render();
  }

  /** Atualiza a quantidade de participantes pela mensagem ROSTER. */
  setRoster(entries: readonly RosterEntry[]): void {
    if (this.playerCount === entries.length) return;
    this.playerCount = entries.length;
    if (this.online) this.render();
  }

  private render(): void {
    if (!this.online || !this.el) return;
    this.el.classList.toggle('bad', this.isError || (this.pingMs > 150 && this.pingMs > 0));

    if (this.statusText) {
      this.el.textContent = `[ONLINE ${this.room}] // ${this.statusText}`;
      return;
    }

    const pingStr = this.pingMs > 0 ? `${this.pingMs}ms` : '--ms';
    const playersStr = this.playerCount > 0 ? `${this.playerCount} UNIDADES` : '';
    const parts = [`ONLINE [${this.room}]`, playersStr, pingStr].filter(Boolean);
    this.el.textContent = parts.join(' · ');
  }
}
