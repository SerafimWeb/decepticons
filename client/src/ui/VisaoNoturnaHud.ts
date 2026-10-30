import { faseEscura } from '../combat/visaoNoturna';

/**
 * O aviso e a moldura dos óculos de visão noturna (P282). Só mostra algo na **fase escura** (`combat/visaoNoturna.ts`, a partir de metade da escuridão): com visão noturna, a moldura verde
 * (vinheta e linhas finas) e o selo **VISÃO NOTURNA**; sem ela, o aviso **SEM VISÃO NOTURNA** (o jogador entende por que não vê nada: só o que brilha aparece). Os textos moram no `index.html`
 * (o tradutor os lê de lá); aqui só se liga e desliga. Custo: uma comparação por quadro; o DOM só muda quando o estado muda.
 */
export type EstadoDosOculos = 'dia' | 'com' | 'sem';

/** O estado dos óculos para uma escuridão e para quem enxerga ou não no escuro. */
export const estadoDosOculos = (escuridao: number, visaoNoturna: boolean): EstadoDosOculos => (!faseEscura(escuridao) ? 'dia' : visaoNoturna ? 'com' : 'sem');

export class VisaoNoturnaHud {
  private estado: EstadoDosOculos = 'dia';

  constructor(
    private readonly moldura: HTMLElement | null,
    private readonly aviso: HTMLElement | null,
  ) {}

  atualizar(escuridao: number, visaoNoturna: boolean): void {
    const novo = estadoDosOculos(escuridao, visaoNoturna);
    if (novo === this.estado) return;
    this.estado = novo;
    this.moldura?.classList.toggle('on', novo === 'com');
    if (!this.aviso) return;
    this.aviso.hidden = novo === 'dia';
    this.aviso.dataset.estado = novo;
  }
}
