import type { Round } from '../combat/Round';
import type { MechBase } from '../entities/MechBase';

const REFRESH_S = 0.2;
const HURRY_S = 30;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  parent.append(e);
  return e;
}

function clock(seconds: number): string {
  // Online, a rodada é a do servidor: o relógio local não conta.
  if (!Number.isFinite(seconds)) return '--:--';
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Relógio da rodada (topo) e placar: segurando Tab durante a rodada, e sozinho no intervalo.
 * Cria os próprios elementos dentro do #hud (F1 esconde junto). Nomes entram como texto, nunca
 * como HTML: quando existir apelido digitado pelo jogador, ele não vira código na página.
 */
export class RoundHud {
  private readonly clockEl: HTMLDivElement;
  private readonly board: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly sub: HTMLDivElement;
  private readonly rows: HTMLOListElement;
  private shownClock = '';
  private textTimer = 0;

  constructor(private readonly me: MechBase) {
    const hud = document.getElementById('hud')!;
    this.clockEl = el('div', 'round-clock', hud);
    this.board = el('div', 'round-board', hud);
    this.board.hidden = true;
    this.title = el('div', 'rb-title', this.board);
    this.sub = el('div', 'rb-sub', this.board);
    const head = el('div', 'rb-row rb-head', this.board);
    for (const t of ['#', 'PILOTO', 'ABATES', 'MORTES']) el('span', '', head).textContent = t;
    this.rows = el('ol', 'rb-rows', this.board);
  }

  update(dt: number, round: Round, holdingTab: boolean): void {
    const text = round.playing ? `RODADA ${round.number} · ${clock(round.timeLeft)}` : `FIM DA RODADA ${round.number}`;
    if (text !== this.shownClock) {
      this.shownClock = text;
      this.clockEl.textContent = text;
      this.clockEl.classList.toggle('hurry', round.playing && round.timeLeft <= HURRY_S);
    }

    const show = !round.playing || holdingTab;
    if (this.board.hidden === show) {
      this.board.hidden = !show;
      this.textTimer = 0;
    }
    if (!show) return;
    this.textTimer -= dt;
    if (this.textTimer > 0) return;
    this.textTimer = REFRESH_S;

    const standings = round.standings();
    const leader = standings[0];
    if (round.playing) {
      this.title.textContent = `PLACAR · RODADA ${round.number}`;
      this.sub.textContent = `faltam ${clock(round.timeLeft)} · solte Tab para voltar`;
    } else {
      this.title.textContent = leader && leader.kills > 0 ? `VENCEDOR: ${leader.name}` : 'RODADA SEM VENCEDOR';
      this.sub.textContent = `próxima rodada em ${Math.max(0, Math.ceil(round.timeLeft))} s`;
    }
    this.rows.replaceChildren(
      ...standings.map((s, i) => {
        const li = document.createElement('li');
        li.className = s.mech === this.me ? 'rb-row me' : 'rb-row';
        for (const t of [String(i + 1), s.name, String(s.kills), String(s.deaths)]) {
          const span = document.createElement('span');
          span.textContent = t;
          li.append(span);
        }
        return li;
      }),
    );
  }
}
