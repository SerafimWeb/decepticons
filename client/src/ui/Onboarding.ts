import type { WeaponStats } from '../combat/weapons';
import { DicasVistas } from './dicasDeArma';

export class Onboarding {
  private readonly HAS_SEEN_KEY = 'cybermech.onboarding.v1';
  /** As dicas de primeiro uso de cada arma (P160 parte 5): uma frase própria por arma, mostrada uma vez, na primeira vez que o jogador atira com ela. */
  private readonly dicasDeArma: DicasVistas;
  private readonly root = document.getElementById('onboarding')!;
  
  private hints: Record<string, string> = {};
  private timer = 0;
  private shown = new Set<string>();
  private readonly isTouch: boolean;
  private seen: boolean;

  constructor() {
    this.seen = false;
    try {
      this.seen = localStorage.getItem(this.HAS_SEEN_KEY) === 'true';
    } catch {
      // ignora erro de restrição de localStorage
    }

    let memoria: Storage | null = null;
    try {
      memoria = localStorage;
    } catch {
      // armazenamento bloqueado: a dica de cada arma vale uma vez por abertura do jogo
    }
    this.dicasDeArma = new DicasVistas(memoria);
    this.isTouch = document.documentElement.classList.contains('touch');
    
    // Configura dicas de acordo com a plataforma (PC vs Toque)
    if (this.isTouch) {
      this.hints = {
        walk: 'USE O POLEGAR ESQUERDO PARA ANDAR',
        aim: 'ATIRE NAS PERNAS PARA DERRUBAR O ALVO',
        rockets: 'FOGUETES: DANO EM ÁREA; EXPLODA NO PÉ DO INIMIGO',
        heat: 'QUENTE: ATIRE EM RAJADAS E PARE PARA ESFRIAR',
        androids: 'ANDRÓIDES SÃO PEQUENOS E ÁGEIS: MIRE COM CALMA',
        damage: 'O ARCO VERMELHO MOSTRA DE ONDE VEM O TIRO'
      };
    } else {
      this.hints = {
        walk: 'USE WASD PARA ANDAR',
        aim: 'ATIRE NAS PERNAS PARA DERRUBAR O ALVO',
        rockets: 'FOGUETES: DANO EM ÁREA; EXPLODA NO PÉ DO INIMIGO',
        heat: 'QUENTE: ATIRE EM RAJADAS E PARE PARA ESFRIAR',
        androids: 'ANDRÓIDES SÃO PEQUENOS E ÁGEIS: MIRE COM CALMA',
        damage: 'O ARCO VERMELHO MOSTRA DE ONDE VEM O TIRO'
      };
    }
  }

  trigger(key: string): void {
    if (this.seen || this.shown.has(key) || !this.hints[key]) return;
    
    // Se já tem outra dica, não sobrescreve (espera a oportunidade)
    if (this.timer > 0) return;

    this.shown.add(key);
    this.root.textContent = this.hints[key];
    this.root.classList.add('show');
    this.timer = 5; // Dica some após 5 segundos

    // Se mostrou todas, salva no local storage
    if (this.shown.size >= Object.keys(this.hints).length) {
      this.seen = true;
      try {
        localStorage.setItem(this.HAS_SEEN_KEY, 'true');
      } catch {
        // ignora
      }
    }
  }

  /**
   * O jogador atirou com `w`: na primeira vez, a dica própria da arma (não volta). Com outra dica na tela, espera a próxima ocasião sem marcar. O casulo de
   * foguetes segue com a dica de sempre (`rockets`), para não aparecer duas vezes.
   */
  armaEmUso(w: WeaponStats): void {
    if (w.id === 'rockets') {
      this.trigger('rockets');
      return;
    }
    const texto = this.dicasDeArma.pendente(w);
    if (!texto || this.timer > 0) return;
    this.dicasDeArma.marcar(w);
    this.root.textContent = texto;
    this.root.classList.add('show');
    this.timer = 6;
  }

  /** Tira a dica da tela agora (o fim da rodada: o placar e o cartão da recompensa ficam limpos, P304). A dica não volta: já foi mostrada. */
  calar(): void {
    this.timer = 0;
    this.root.classList.remove('show');
  }

  update(dt: number): void {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.root.classList.remove('show');
      }
    }
  }
}

