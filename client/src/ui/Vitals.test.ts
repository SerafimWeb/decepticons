import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MechBase } from '../entities/MechBase';
import { LIMITE_ATENCAO, LIMITE_CRITICO, PARTES_VITALS, Vitals, fracao, tomDe } from './Vitals';

/** Um elemento de mentira que conta quantas vezes o texto foi escrito (a regra do painel é "só escreve o que mudou"). */
class Falso {
  className = '';
  dataset: Record<string, string> = {};
  style = { transform: '', props: {} as Record<string, string>, setProperty(k: string, v: string) { this.props[k] = v; } };
  filhos: Falso[] = [];
  escritas = 0;
  private texto = '';
  get textContent(): string { return this.texto; }
  set textContent(v: string) { this.texto = v; this.escritas++; }
  append(...f: Falso[]): void { this.filhos.push(...f); }
}

function mech(torso: number, partes: Partial<Record<string, number>> = {}, nome = 'VECTOR-09'): MechBase {
  const cheio = { head: 100, torso: 300, leftArm: 120, rightArm: 120, leftLeg: 150, rightLeg: 150 };
  return {
    stats: { name: nome, maxModuleHealth: cheio },
    modules: { ...cheio, torso, ...partes },
  } as unknown as MechBase;
}

describe('vida do próprio Mech (painel de baixo)', () => {
  describe('fracao e tom (a lógica de cor)', () => {
    it('corta sobra e falta, e trata máximo inválido e número estranho como destruída', () => {
      expect(fracao(150, 300)).toBe(0.5);
      expect(fracao(400, 300)).toBe(1);
      expect(fracao(-5, 300)).toBe(0);
      expect(fracao(10, 0)).toBe(0);
      expect(fracao(Number.NaN, 300)).toBe(0);
    });

    it('verde acima da metade, âmbar até a metade, vermelho no último quarto', () => {
      expect(tomDe(1)).toBe('ok');
      expect(tomDe(LIMITE_ATENCAO + 0.01)).toBe('ok');
      expect(tomDe(LIMITE_ATENCAO)).toBe('atencao');
      expect(tomDe(LIMITE_CRITICO + 0.01)).toBe('atencao');
      expect(tomDe(LIMITE_CRITICO)).toBe('critico');
      expect(tomDe(0)).toBe('critico');
    });

    it('as cinco pílulas são as partes que não decidem a morte: o torso é a barra', () => {
      expect(PARTES_VITALS.map(([p]) => p)).toEqual(['head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']);
    });
  });

  describe('o painel (DOM de mentira)', () => {
    let raiz: Falso;
    let nos: Falso[];

    beforeEach(() => {
      nos = [];
      vi.stubGlobal('document', {
        createElement: () => {
          const el = new Falso();
          nos.push(el);
          return el;
        },
      });
      raiz = new Falso();
    });
    afterEach(() => vi.unstubAllGlobals());

    const barraDe = () => nos.find((n) => n.className === 'vt-barra')!;
    const enchimentoDe = () => nos.find((n) => n.className === 'vt-enchimento')!;
    const numeroDe = () => nos.find((n) => n.className === 'vt-numero')!;
    const placarDe = () => nos.find((n) => n.className === 'vt-placar')!;
    const pilulas = () => nos.filter((n) => n.filhos.length === 0 && n.className === '' && PARTES_VITALS.some(([, r]) => r === n.textContent));

    it('mostra o torso como número e como barra, e o nome e o placar', () => {
      const v = new Vitals(raiz as unknown as HTMLElement);
      v.update(mech(300), 3, 1);
      expect(numeroDe().textContent).toBe('300');
      expect(enchimentoDe().style.transform).toBe('scaleX(1)');
      expect(barraDe().dataset.tom).toBe('ok');
      expect(placarDe().textContent).toBe('3 ABATES · 1 MORTES');
      expect(nos.find((n) => n.textContent === 'VECTOR-09')).toBeDefined();
    });

    it('a barra muda de cor conforme o torso cai: âmbar na metade, vermelho no último quarto', () => {
      const v = new Vitals(raiz as unknown as HTMLElement);
      v.update(mech(150), 0, 0);
      expect(barraDe().dataset.tom).toBe('atencao');
      v.update(mech(60), 0, 0);
      expect(barraDe().dataset.tom).toBe('critico');
      expect(enchimentoDe().style.transform).toBe('scaleX(0.2)');
      expect(numeroDe().textContent).toBe('60');
    });

    it('a pílula de uma parte destruída fica marcada como morta; as inteiras, verdes', () => {
      const v = new Vitals(raiz as unknown as HTMLElement);
      v.update(mech(300, { leftArm: 0, rightLeg: 30 }), 0, 0);
      const [cab, brE, brD, peE, peD] = pilulas();
      expect(cab!.dataset.tom).toBe('ok');
      expect(brE!.dataset.tom).toBe('morta');
      expect(brD!.dataset.tom).toBe('ok');
      expect(peE!.dataset.tom).toBe('ok');
      expect(peD!.dataset.tom).toBe('critico'); // 30/150 = 20%
      expect(peD!.style.props['--f']).toBe('0.2');
    });

    it('só escreve no DOM o que mudou (custo: nada por quadro quando nada muda)', () => {
      const v = new Vitals(raiz as unknown as HTMLElement);
      const m = mech(300);
      v.update(m, 0, 0);
      const antes = nos.map((n) => n.escritas);
      for (let i = 0; i < 30; i++) v.update(m, 0, 0);
      expect(nos.map((n) => n.escritas)).toEqual(antes);
    });

    it('vida quebrada (fração com ruído de ponto flutuante) não faz o número tremer', () => {
      const v = new Vitals(raiz as unknown as HTMLElement);
      v.update(mech(299.9999), 0, 0);
      expect(numeroDe().textContent).toBe('300');
      v.update(mech(0), 0, 0);
      expect(numeroDe().textContent).toBe('0');
      expect(barraDe().dataset.tom).toBe('critico');
    });
  });
});
