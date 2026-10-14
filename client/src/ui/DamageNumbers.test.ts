import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DMG_LIFE_S, DMG_POOL, DamageNumbers, formatDamage } from './DamageNumbers';

/** Elemento de mentira: guarda o que o módulo escreve no DOM (o teste confere o que mudou). */
class Falso {
  className = '';
  textContent = '';
  style: Record<string, string> = { display: 'none' };
  offsetWidth = 0;
  filhos: Falso[] = [];
  appendChild(c: Falso): void { this.filhos.push(c); }
}

function comFalsoDom(): Falso {
  const raiz = new Falso();
  vi.stubGlobal('document', { createElement: () => new Falso() });
  return raiz;
}

/** Câmera na origem olhando para -Z (o padrão do Three): (0,0,-5) projeta no centro da tela. */
const camera = new THREE.PerspectiveCamera();

describe('números de dano flutuantes (frente 2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('formatDamage', () => {
    it('arredonda e nunca mostra 0 (um acerto que passou pela defesa vale ao menos 1)', () => {
      expect(formatDamage(16)).toBe('16');
      expect(formatDamage(15.6)).toBe('16');
      expect(formatDamage(0.4)).toBe('1');
      expect(formatDamage(0)).toBe('1');
      expect(formatDamage(-3)).toBe('1');
      expect(formatDamage(Number.NaN)).toBe('1');
    });
  });

  describe('o pool (DOM de mentira)', () => {
    it('cria o pool fixo de nós escondidos', () => {
      const raiz = comFalsoDom();
      new DamageNumbers(raiz as unknown as HTMLElement);
      expect(raiz.filhos).toHaveLength(DMG_POOL);
      expect(raiz.filhos.every((n) => n.style.display === 'none')).toBe(true);
    });

    it('sem raiz, não quebra (o jogo pode rodar sem o contêiner no HTML)', () => {
      const dn = new DamageNumbers(null);
      expect(() => dn.show(camera, new THREE.Vector3(0, 0, -5), 30)).not.toThrow();
      expect(() => dn.update(0.1)).not.toThrow();
    });

    it('mostra o número no centro quando o ponto está à frente e escreve vw/vh', () => {
      const raiz = comFalsoDom();
      const dn = new DamageNumbers(raiz as unknown as HTMLElement);
      dn.show(camera, new THREE.Vector3(0, 0, -5), 16);
      const n = raiz.filhos[0]!;
      expect(n.textContent).toBe('16');
      expect(n.style.display).toBe('block');
      expect(n.style.left).toBe('50.00vw');
      expect(n.style.top).toBe('50.00vh');
      expect(n.className).toBe('dmg-number live');
    });

    it('acerto em parte destruída ganha a marca crítica', () => {
      const raiz = comFalsoDom();
      const dn = new DamageNumbers(raiz as unknown as HTMLElement);
      dn.show(camera, new THREE.Vector3(0, 0, -5), 90, true);
      expect(raiz.filhos[0]!.className).toBe('dmg-number crit live');
    });

    it('não gasta nó com o ponto atrás da câmera nem fora da tela', () => {
      const raiz = comFalsoDom();
      const dn = new DamageNumbers(raiz as unknown as HTMLElement);
      dn.show(camera, new THREE.Vector3(0, 0, 5), 16); // atrás
      dn.show(camera, new THREE.Vector3(9999, 0, -5), 16); // fora da tela
      expect(raiz.filhos.every((n) => n.style.display === 'none')).toBe(true);
    });

    it('reaproveita o pool em círculo (o 25º usa o primeiro nó)', () => {
      const raiz = comFalsoDom();
      const dn = new DamageNumbers(raiz as unknown as HTMLElement);
      for (let i = 0; i <= DMG_POOL; i++) dn.show(camera, new THREE.Vector3(0, 0, -5), i + 1);
      // O nó 0 recebeu a 1ª escrita e depois a (DMG_POOL+1)ª: o texto é o do último que o usou.
      expect(raiz.filhos[0]!.textContent).toBe(String(DMG_POOL + 1));
    });

    it('some depois do tempo de vida', () => {
      const raiz = comFalsoDom();
      const dn = new DamageNumbers(raiz as unknown as HTMLElement);
      dn.show(camera, new THREE.Vector3(0, 0, -5), 16);
      dn.update(DMG_LIFE_S * 0.5);
      expect(raiz.filhos[0]!.style.display).toBe('block');
      dn.update(DMG_LIFE_S);
      expect(raiz.filhos[0]!.style.display).toBe('none');
    });
  });
});
