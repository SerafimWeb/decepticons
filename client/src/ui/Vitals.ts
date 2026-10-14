import type { MechBase, MechPart } from '../entities/MechBase';

/** Faixa de cor da integridade: verde, âmbar, vermelho (a mesma lógica serve à barra do torso e às pílulas das partes). */
export type Tom = 'ok' | 'atencao' | 'critico';

/** Abaixo disto (fração da vida da parte) a cor vira âmbar; abaixo do crítico, vermelha e pulsando. */
export const LIMITE_ATENCAO = 0.5;
export const LIMITE_CRITICO = 0.25;

/** 0 a 1: quanto resta de uma parte. Máximo inválido (≤ 0) conta como destruída; sobra e falta são cortadas. */
export function fracao(valor: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(valor)) return 0;
  return Math.max(0, Math.min(1, valor / max));
}

export function tomDe(f: number): Tom {
  return f <= LIMITE_CRITICO ? 'critico' : f <= LIMITE_ATENCAO ? 'atencao' : 'ok';
}

/**
 * As partes que aparecem sob a barra. O torso fica de fora de propósito: ele **é** a barra, porque é o torso que decide a morte
 * (`combat/damage.ts`: torso zerado = Mech destruído); as outras cinco tiram capacidade (braço sem arma, perna sem corrida, cabeça sem mira).
 */
export const PARTES_VITALS: readonly (readonly [MechPart, string])[] = [
  ['head', 'CAB'],
  ['leftArm', 'BR·E'],
  ['rightArm', 'BR·D'],
  ['leftLeg', 'PE·E'],
  ['rightLeg', 'PE·D'],
];

/**
 * Painel de vida do próprio Mech, embaixo no centro: uma barra larga com o torso (o número grande é a vida que falta para morrer) e,
 * sob ela, cinco pílulas com o estado das outras partes. Substitui as seis barras de texto do canto (o mesmo dado, lido de relance).
 * Nome do Mech e placar (abates e mortes) moram aqui também, para o canto de cima ficar com o minimapa.
 *
 * **Custo de CPU:** nenhuma alocação por quadro. Os nós de DOM nascem uma vez; a cada atualização (5 vezes por segundo, chamada pelo
 * `HUD.update`) só se escreve o que mudou (comparação com o último valor mostrado).
 */
export class Vitals {
  private readonly nome = document.createElement('b');
  private readonly placar = document.createElement('span');
  private readonly barra = document.createElement('div');
  private readonly enchimento = document.createElement('i');
  private readonly numero = document.createElement('span');
  private readonly pilulas: HTMLElement[] = [];
  private shownNome = '';
  private shownPlacar = '';
  private shownTorso = -1;
  private shownNumero = -1;
  private shownTom: Tom | '' = '';
  private readonly shownPartes: number[] = [];
  private readonly shownTons: (Tom | 'morta' | '')[] = [];

  constructor(root: HTMLElement) {
    const cabeca = document.createElement('div');
    cabeca.className = 'vt-cabeca';
    this.placar.className = 'vt-placar';
    cabeca.append(this.nome, this.placar);

    this.barra.className = 'vt-barra';
    this.enchimento.className = 'vt-enchimento';
    this.numero.className = 'vt-numero';
    this.barra.append(this.enchimento, this.numero);

    const partes = document.createElement('div');
    partes.className = 'vt-partes';
    for (const [, rotulo] of PARTES_VITALS) {
      const p = document.createElement('i');
      p.textContent = rotulo;
      partes.append(p);
      this.pilulas.push(p);
      this.shownPartes.push(-1);
      this.shownTons.push('');
    }
    root.append(cabeca, this.barra, partes);
  }

  update(mech: MechBase, kills: number, deaths: number): void {
    const nome = mech.stats.name;
    if (nome !== this.shownNome) {
      this.shownNome = nome;
      this.nome.textContent = nome;
    }
    const placar = `${kills} ABATES · ${deaths} MORTES`;
    if (placar !== this.shownPlacar) {
      this.shownPlacar = placar;
      this.placar.textContent = placar;
    }

    const maxTorso = mech.stats.maxModuleHealth.torso;
    const f = Math.round(fracao(mech.modules.torso, maxTorso) * 100) / 100;
    const valor = Math.ceil(Math.max(0, mech.modules.torso));
    if (f !== this.shownTorso) {
      this.shownTorso = f;
      this.enchimento.style.transform = `scaleX(${f})`;
      const tom = tomDe(f);
      if (tom !== this.shownTom) {
        this.shownTom = tom;
        this.barra.dataset.tom = tom;
      }
    }
    if (valor !== this.shownNumero) {
      this.shownNumero = valor;
      this.numero.textContent = String(valor);
    }

    for (let i = 0; i < PARTES_VITALS.length; i++) {
      const parte = PARTES_VITALS[i]![0];
      const pf = Math.round(fracao(mech.modules[parte], mech.stats.maxModuleHealth[parte]) * 20) / 20;
      if (pf === this.shownPartes[i]) continue;
      this.shownPartes[i] = pf;
      const el = this.pilulas[i]!;
      el.style.setProperty('--f', String(pf));
      const tom = pf <= 0 ? 'morta' : tomDe(pf);
      if (tom !== this.shownTons[i]) {
        this.shownTons[i] = tom;
        el.dataset.tom = tom;
      }
    }
  }
}
