import type { StatusKind, StatusSet } from '../combat/StatusEffects';
import type { StatusView } from '../ui/status';

/** Quem manda no som de fundo quando há mais de um estado: o que mais incapacita vence. */
const LOOP_PRIORITY: readonly StatusKind[] = ['congelado', 'atordoado', 'queimando', 'chocado', 'gelado'];
const BIT: Readonly<Record<StatusKind, number>> = { queimando: 1, chocado: 2, atordoado: 4, gelado: 8, congelado: 16 };

/** Para onde vai o que o jogador sofre: os indicadores da tela e os sons (o `Game` liga cada um à peça certa). */
export interface StatusHudSink {
  /** Todos os estados ligados agora (a lista é sempre a mesma; quem guarda copia). */
  badges(list: readonly StatusView[]): void;
  /** Um estado acabou de ligar (o som de entrada toca uma vez). */
  entered(kind: StatusKind): void;
  /** O estado que manda no som de fundo mudou (`null` = nenhum). */
  loop(kind: StatusKind | null): void;
}

/**
 * Liga os estados do jogador (`combat/StatusEffects.ts`) à tela e ao som feitos pelo Gemini (`ui/StatusBadges`, `audio/AudioSystem`).
 * Módulo independente (G3): o `Game` só chama `update` uma vez por quadro. Nada é alocado por quadro (G4): os `StatusView`, a lista e o
 * retorno de chamada são os mesmos sempre.
 */
export class StatusHud {
  private readonly pool: StatusView[] = [];
  private readonly views: StatusView[] = [];
  private used = 0;
  private mask = 0;
  private loopKind: StatusKind | null = null;

  constructor(private readonly sink: StatusHudSink) {
    for (let i = 0; i < LOOP_PRIORITY.length; i++) this.pool.push({ kind: 'chocado', left: 0, level: 0 });
  }

  /** `alive` falso (morto ou fora da partida): nada é mostrado e o próximo estado, ao voltar, toca o som de entrada de novo. */
  update(status: StatusSet, alive: boolean): void {
    this.views.length = 0;
    this.used = 0;
    if (alive) status.forEachActive(this.collect);
    let mask = 0;
    for (let i = 0; i < this.views.length; i++) mask |= BIT[this.views[i]!.kind];
    const added = mask & ~this.mask;
    this.mask = mask;
    if (added !== 0) {
      for (let i = 0; i < this.views.length; i++) {
        const kind = this.views[i]!.kind;
        if ((added & BIT[kind]) !== 0) this.sink.entered(kind);
      }
    }
    let dominant: StatusKind | null = null;
    for (let i = 0; i < LOOP_PRIORITY.length; i++) {
      if ((mask & BIT[LOOP_PRIORITY[i]!]) !== 0) {
        dominant = LOOP_PRIORITY[i]!;
        break;
      }
    }
    if (dominant !== this.loopKind) {
      this.loopKind = dominant;
      this.sink.loop(dominant);
    }
    this.sink.badges(this.views);
  }

  private readonly collect = (kind: StatusKind, left: number, level: number): void => {
    const view = this.pool[this.used++]!;
    view.kind = kind;
    view.left = left;
    view.level = level;
    this.views.push(view);
  };
}
