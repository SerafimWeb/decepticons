import type { Round, Standing } from '../combat/Round';
import type { MechBase } from '../entities/MechBase';

const REFRESH_S = 0.2;
const HURRY_S = 30;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  parent.append(e);
  return e;
}

/** Quantas linhas o placar mostra: com um esquadrão grande, 30 linhas não cabem em 720 p de altura. */
export const PLACAR_LINHAS = 10;

/**
 * As linhas do placar: se cabem, todas; senão os primeiros e, na última linha, quem joga (com a posição de verdade dele), para o jogador
 * sempre se achar. O resto vira "+N pilotos" no subtítulo.
 */
export function linhasDoPlacar(standings: readonly Readonly<Standing>[], me: MechBase, max = PLACAR_LINHAS): { rank: number; row: Readonly<Standing> }[] {
  const todas = standings.map((row, i) => ({ rank: i + 1, row }));
  if (todas.length <= max) return todas;
  const minha = todas.find((l) => l.row.mech === me);
  return !minha || minha.rank <= max - 1 ? todas.slice(0, max) : [...todas.slice(0, max - 1), minha];
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

  constructor(
    private readonly me: MechBase,
    private readonly visible = true,
  ) {
    const hud = document.getElementById('hud')!;
    this.clockEl = el('div', 'round-clock', hud);
    this.board = el('div', 'round-board', hud);
    this.board.hidden = true;
    this.clockEl.hidden = !visible;
    this.title = el('div', 'rb-title', this.board);
    this.sub = el('div', 'rb-sub', this.board);
    const head = el('div', 'rb-row rb-head', this.board);
    for (const t of ['#', 'PILOTO', 'ABATES', 'MORTES']) el('span', '', head).textContent = t;
    this.rows = el('ol', 'rb-rows', this.board);
  }

  update(dt: number, round: Round, holdingTab: boolean): void {
    if (!this.visible) return;
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
    const linhas = linhasDoPlacar(standings, this.me);
    const ocultos = standings.length - linhas.length;
    const resto = ocultos > 0 ? ` · +${ocultos} pilotos` : '';
    if (round.playing) {
      this.title.textContent = `PLACAR · RODADA ${round.number}`;
      this.sub.textContent = `faltam ${clock(round.timeLeft)} · solte Tab para voltar${resto}`;
    } else {
      this.title.textContent = leader && leader.kills > 0 ? `VENCEDOR: ${leader.name}` : 'RODADA SEM VENCEDOR';
      this.sub.textContent = `próxima rodada em ${Math.max(0, Math.ceil(round.timeLeft))} s${resto}`;
    }
    this.rows.replaceChildren(
      ...linhas.map(({ rank, row: s }) => {
        const li = document.createElement('li');
        li.className = s.mech === this.me ? 'rb-row me' : 'rb-row';
        for (const t of [String(rank), s.name, String(s.kills), String(s.deaths)]) {
          const span = document.createElement('span');
          span.textContent = t;
          li.append(span);
        }
        return li;
      }),
    );
  }
}
