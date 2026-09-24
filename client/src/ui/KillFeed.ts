const $ = (id: string) => document.getElementById(id)!;

interface KillFeedSlot {
  element: HTMLElement;
  textNode: Text;
  timer: number;
}

export class KillFeed {
  private readonly container: HTMLElement;
  private readonly slots: KillFeedSlot[];

  constructor() {
    this.container = $('kill-feed');

    // Pool fixo de 4 elementos no DOM (G4)
    this.slots = Array.from({ length: 4 }, () => {
      const el = document.createElement('div');
      el.className = 'kill-feed-item hidden';
      const textNode = document.createTextNode('');
      el.appendChild(textNode);
      this.container.appendChild(el);
      return { element: el, textNode, timer: 0 };
    });
  }

  /**
   * Adiciona uma nova notificação ao kill feed.
   * Exibe no máximo 4 itens; cada um some em 5 s.
   */
  push(killer: string | null | undefined, victim: string, isPlayerInvolved: boolean): void {
    const killerName = killer ?? 'DESTRUÍDO';
    const text = killer ? `${killerName} ▸ ${victim}` : `${victim} DESTRUÍDO`;

    // Desloca slots existentes para baixo (0 é o mais recente no topo)
    for (let i = this.slots.length - 1; i > 0; i--) {
      const prev = this.slots[i - 1]!;
      const curr = this.slots[i]!;
      curr.textNode.textContent = prev.textNode.textContent;
      curr.element.className = prev.element.className;
      curr.timer = prev.timer;
    }

    // Define o novo item no slot 0
    const top = this.slots[0]!;
    top.textNode.textContent = text;
    top.element.className = `kill-feed-item${isPlayerInvolved ? ' highlight' : ''}`;
    top.timer = 5.0;
  }

  update(dt: number): void {
    for (const slot of this.slots) {
      if (slot.timer > 0) {
        slot.timer -= dt;
        if (slot.timer <= 0) {
          slot.element.className = 'kill-feed-item hidden';
          slot.textNode.textContent = '';
        }
      }
    }
  }
}
