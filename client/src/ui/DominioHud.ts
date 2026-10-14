import type { DominioLado, DominioPlacar, DominioPonto } from '../sim/Dominio';
import { DOMINIO_ALVO } from '../sim/Dominio';

/** "8:00": minutos e segundos do relógio da partida (para cima: a tela nunca mostra "-0:01"). */
export function formatarTempo(s: number): string {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export type LadoVisual = 'azul' | 'vermelho' | 'neutro';

/** De que lado o ponto está andando agora (o sinal do controle), com a tolerância de uma amostra. */
export function ladoVisual(control: number): LadoVisual {
  return control > 0.001 ? 'azul' : control < -0.001 ? 'vermelho' : 'neutro';
}

export interface Aviso {
  texto: string;
  /** `bom` para o jogador (azul), `ruim`, ou `neutro`. */
  tom: 'bom' | 'ruim';
}

/**
 * O aviso de um ponto que mudou de dono, do ponto de vista do jogador (azul é "nós"). Capturar é bom; perder, ruim; neutralizar o do
 * inimigo é bom e ter o seu neutralizado, ruim.
 */
export function avisoDoPonto(letra: string, antes: DominioLado | null, depois: DominioLado | null): Aviso {
  if (depois === 'blue') return { texto: `PONTO ${letra} CAPTURADO`, tom: 'bom' };
  if (depois === 'red') return { texto: `PONTO ${letra} PERDIDO`, tom: 'ruim' };
  return antes === 'blue' ? { texto: `PONTO ${letra} NEUTRALIZADO`, tom: 'ruim' } : { texto: `PONTO ${letra} DO INIMIGO NEUTRALIZADO`, tom: 'bom' };
}

const AVISO_S = 2.2;

/**
 * A barra do Domínio, em cima no centro: os pontos de cada lado, os cinco pontos de controle (A a E, cada um um hexágono que enche com a
 * captura e muda de cor com o dono) e o relógio; embaixo dela, o aviso do que acabou de acontecer num ponto.
 *
 * **Custo:** os nós nascem uma vez; a cada chamada (5 Hz, vinda da regra) só se escreve o que mudou. O aviso conta o tempo dele no `update`.
 */
export class DominioHud {
  private readonly root = document.createElement('div');
  private readonly pontosAzul = document.createElement('b');
  private readonly pontosVermelho = document.createElement('b');
  private readonly barraAzul = document.createElement('i');
  private readonly barraVermelho = document.createElement('i');
  private readonly tempo = document.createElement('span');
  private readonly hexes: HTMLElement[] = [];
  private readonly aviso = document.createElement('div');
  private avisoLeft = 0;
  private shownAzul = -1;
  private shownVermelho = -1;
  private shownTempo = '';
  private readonly shownHex: string[] = [];

  constructor() {
    this.root.id = 'dominio-hud';
    this.root.hidden = true;
    const lado = (cls: string, pontos: HTMLElement, barra: HTMLElement) => {
      const el = document.createElement('div');
      el.className = `dm-lado ${cls}`;
      barra.className = 'dm-barra';
      el.append(pontos, barra);
      return el;
    };
    this.pontosAzul.className = this.pontosVermelho.className = 'dm-pts';
    const meio = document.createElement('div');
    meio.className = 'dm-meio';
    const hexes = document.createElement('div');
    hexes.className = 'dm-pontos';
    this.tempo.className = 'dm-tempo';
    meio.append(hexes, this.tempo);
    this.aviso.className = 'dm-aviso';
    this.root.append(lado('azul', this.pontosAzul, this.barraAzul), meio, lado('vermelho', this.pontosVermelho, this.barraVermelho), this.aviso);
    document.getElementById('hud')!.append(this.root);
    this.hexesDe = hexes;
  }

  private hexesDe: HTMLElement;

  /** Liga ou desliga a barra (só no modo Domínio). */
  mostrar(on: boolean): void {
    this.root.hidden = !on;
  }

  /** Escreve o quadro da regra (5 Hz). Cria os hexágonos na primeira chamada (a regra é que diz quantos pontos o mapa tem). */
  quadro(pontos: readonly DominioPonto[], tempo: number, azul: Readonly<DominioPlacar>, vermelho: Readonly<DominioPlacar>): void {
    while (this.hexes.length < pontos.length) {
      const h = document.createElement('i');
      h.className = 'dm-ponto';
      h.textContent = pontos[this.hexes.length]!.def.letra;
      this.hexesDe.append(h);
      this.hexes.push(h);
      this.shownHex.push('');
    }
    const a = Math.floor(azul.pontos);
    const v = Math.floor(vermelho.pontos);
    if (a !== this.shownAzul) {
      this.shownAzul = a;
      this.pontosAzul.textContent = String(a);
      this.barraAzul.style.setProperty('--f', String(Math.min(1, a / DOMINIO_ALVO)));
    }
    if (v !== this.shownVermelho) {
      this.shownVermelho = v;
      this.pontosVermelho.textContent = String(v);
      this.barraVermelho.style.setProperty('--f', String(Math.min(1, v / DOMINIO_ALVO)));
    }
    const t = formatarTempo(tempo);
    if (t !== this.shownTempo) {
      this.shownTempo = t;
      this.tempo.textContent = t;
    }
    for (let i = 0; i < pontos.length; i++) {
      const p = pontos[i]!;
      const lado = ladoVisual(p.control);
      const f = Math.round(Math.abs(p.control) * 20) / 20;
      const chave = `${lado}|${f}|${p.dono ?? ''}|${p.disputado ? 1 : 0}`;
      if (chave === this.shownHex[i]) continue;
      this.shownHex[i] = chave;
      const h = this.hexes[i]!;
      h.dataset.lado = lado;
      h.dataset.dono = p.dono ?? '';
      h.dataset.disputado = p.disputado ? '1' : '';
      h.style.setProperty('--p', String(f));
    }
  }

  /** Mostra o aviso de um ponto por um instante. */
  avisar(a: Aviso): void {
    this.aviso.textContent = a.texto;
    this.aviso.dataset.tom = a.tom;
    this.aviso.classList.add('on');
    this.avisoLeft = AVISO_S;
  }

  update(dt: number): void {
    if (this.avisoLeft <= 0) return;
    this.avisoLeft -= dt;
    if (this.avisoLeft <= 0) this.aviso.classList.remove('on');
  }
}
