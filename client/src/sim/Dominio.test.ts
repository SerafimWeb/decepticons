import { describe, expect, it } from 'vitest';
import {
  DOMINIO_ALVO,
  DOMINIO_CAPTURA_S,
  DOMINIO_RAIO,
  DOMINIO_TEMPO_S,
  Dominio,
  velocidadeDeCaptura,
  type DominioLado,
  type DominioPontoDef,
  type DominioUnidade,
} from './Dominio';

const FPS = 60;
const DT = 1 / FPS;

const PONTOS: DominioPontoDef[] = [
  { letra: 'A', x: -60, z: 60 },
  { letra: 'B', x: -50, z: -30 },
  { letra: 'C', x: 0, z: 0 },
  { letra: 'D', x: 50, z: 30 },
  { letra: 'E', x: 60, z: -60 },
];

interface Soldado extends DominioUnidade {
  alive: boolean;
  simPosition: { x: number; z: number };
}
const soldado = (x: number, z: number): Soldado => ({ alive: true, simPosition: { x, z } });

/** Roda `s` segundos de partida. */
function rodar(d: Dominio, s: number): void {
  for (let i = 0; i < Math.round(s * FPS); i++) d.fixedUpdate(DT);
}

describe('Domínio (pontos de controle)', () => {
  describe('capturar', () => {
    it('um ponto sem ninguém em cima fica neutro e não dá ponto a ninguém', () => {
      const d = new Dominio(PONTOS);
      rodar(d, 30);
      expect(d.pontos.every((p) => p.control === 0 && p.dono === null)).toBe(true);
      expect(d.pontosDe('blue')).toBe(0);
      expect(d.pontosDe('red')).toBe(0);
    });

    it('uma unidade em cima domina o ponto em DOMINIO_CAPTURA_S segundos', () => {
      const d = new Dominio(PONTOS);
      const a = soldado(0, 0);
      d.register(a, 'blue');
      rodar(d, DOMINIO_CAPTURA_S - 0.5);
      expect(d.pontos[2]!.dono).toBeNull();
      expect(d.pontos[2]!.control).toBeGreaterThan(0.9);
      rodar(d, 1);
      expect(d.pontos[2]!.dono).toBe('blue');
      expect(d.pontos[2]!.control).toBe(1);
    });

    it('o raio de captura é o da regra: dentro conta, fora não', () => {
      const d = new Dominio(PONTOS);
      const dentro = soldado(DOMINIO_RAIO - 0.1, 0);
      const fora = soldado(0, DOMINIO_RAIO + 0.1);
      d.register(dentro, 'blue');
      d.register(fora, 'red');
      rodar(d, 2);
      expect(d.pontos[2]!.presenca).toEqual({ blue: 1, red: 0 });
    });

    it('mais unidades capturam mais rápido, até três', () => {
      expect(velocidadeDeCaptura(0)).toBe(0);
      expect(velocidadeDeCaptura(2)).toBeGreaterThan(velocidadeDeCaptura(1));
      expect(velocidadeDeCaptura(3)).toBeGreaterThan(velocidadeDeCaptura(2));
      expect(velocidadeDeCaptura(9)).toBe(velocidadeDeCaptura(3));
      expect(velocidadeDeCaptura(1)).toBeCloseTo(1 / DOMINIO_CAPTURA_S, 9);
    });

    it('unidade morta não captura', () => {
      const d = new Dominio(PONTOS);
      const a = soldado(0, 0);
      a.alive = false;
      d.register(a, 'blue');
      rodar(d, 20);
      expect(d.pontos[2]!.control).toBe(0);
    });

    it('os dois lados em cima: o ponto fica disputado e ninguém avança', () => {
      const d = new Dominio(PONTOS);
      d.register(soldado(0, 0), 'blue');
      d.register(soldado(3, 3), 'red');
      rodar(d, 20);
      const c = d.pontos[2]!;
      expect(c.disputado).toBe(true);
      expect(c.control).toBe(0);
      expect(c.dono).toBeNull();
    });

    it('ninguém em cima: o ponto mantém o que tinha (dono e controle)', () => {
      const d = new Dominio(PONTOS);
      const a = soldado(0, 0);
      d.register(a, 'blue');
      rodar(d, DOMINIO_CAPTURA_S + 1);
      a.simPosition.x = 80; // saiu
      rodar(d, 30);
      expect(d.pontos[2]!.dono).toBe('blue');
      expect(d.pontos[2]!.control).toBe(1);
    });
  });

  describe('tomar de quem domina', () => {
    it('o inimigo primeiro neutraliza (o ponto volta a ninguém) e só depois conquista: leva o dobro', () => {
      const eventos: string[] = [];
      const d = new Dominio(PONTOS, { onDono: (p, antes, depois) => eventos.push(`${p.def.letra}:${antes}>${depois}`) });
      const azul = soldado(0, 0);
      const vermelho = soldado(60, -60); // longe: não disputa o C
      d.register(azul, 'blue');
      d.register(vermelho, 'red');
      rodar(d, DOMINIO_CAPTURA_S + 0.5);
      expect(d.pontos[2]!.dono).toBe('blue');
      // O azul sai, o vermelho entra no C.
      azul.simPosition.x = 90;
      vermelho.simPosition.x = 0;
      vermelho.simPosition.z = 0;
      rodar(d, DOMINIO_CAPTURA_S - 0.5);
      expect(d.pontos[2]!.dono, 'ainda não neutralizou: o azul segue dono').toBe('blue');
      rodar(d, 1);
      expect(d.pontos[2]!.dono, 'neutralizado').toBeNull();
      rodar(d, DOMINIO_CAPTURA_S);
      expect(d.pontos[2]!.dono).toBe('red');
      expect(eventos.filter((e) => e.startsWith('C:'))).toEqual(['C:null>blue', 'C:blue>null', 'C:null>red']);
    });

    it('quem perde o ponto para a disputa não o perde de graça: o dono antigo segue pontuando até a neutralização', () => {
      const d = new Dominio(PONTOS);
      const azul = soldado(0, 0);
      d.register(azul, 'blue');
      rodar(d, DOMINIO_CAPTURA_S + 1);
      azul.simPosition.x = 90;
      const vermelho = soldado(0, 0);
      d.register(vermelho, 'red');
      const antes = d.placar.blue.pontos;
      rodar(d, 3); // c: 1 -> ~0,6, ainda azul
      expect(d.pontos[2]!.dono).toBe('blue');
      expect(d.placar.blue.pontos).toBeGreaterThan(antes + 2.5);
    });
  });

  describe('pontuar e vencer', () => {
    it('cada ponto dominado rende um ponto por segundo ao dono (e só a ele)', () => {
      const d = new Dominio(PONTOS);
      // Dois soldados azuis dominam o C e o D (um em cada).
      d.register(soldado(0, 0), 'blue');
      d.register(soldado(50, 30), 'blue');
      rodar(d, DOMINIO_CAPTURA_S + 0.5);
      expect(d.dominados('blue')).toBe(2);
      const base = d.placar.blue.pontos;
      rodar(d, 10);
      expect(d.placar.blue.pontos - base).toBeCloseTo(20, 1);
      expect(d.pontosDe('red')).toBe(0);
    });

    it('quem chega ao alvo vence na hora', () => {
      const fim: (DominioLado | null)[] = [];
      const d = new Dominio(PONTOS, { onFim: (v) => fim.push(v) }, DOMINIO_TEMPO_S, 20);
      d.register(soldado(0, 0), 'blue');
      d.register(soldado(50, 30), 'blue');
      d.register(soldado(60, -60), 'blue');
      rodar(d, 60);
      expect(d.ended).toBe(true);
      expect(d.vencedor).toBe('blue');
      expect(fim).toEqual(['blue']);
    });

    it('terminada a partida, o mundo para (nem ponto nem relógio andam)', () => {
      const d = new Dominio(PONTOS, {}, DOMINIO_TEMPO_S, 5);
      d.register(soldado(0, 0), 'blue');
      d.register(soldado(50, 30), 'blue');
      rodar(d, 40);
      expect(d.ended).toBe(true);
      const t = d.tempoRestante;
      const p = d.placar.blue.pontos;
      rodar(d, 5);
      expect(d.tempoRestante).toBe(t);
      expect(d.placar.blue.pontos).toBe(p);
    });

    it('no fim do relógio vence quem tem mais pontos; empate, quem tem mais abates; igual, ninguém', () => {
      const fim: (DominioLado | null)[] = [];
      const d = new Dominio(PONTOS, { onFim: (v) => fim.push(v) }, 30, DOMINIO_ALVO);
      const azul = soldado(0, 0);
      const vermelho = soldado(60, -60);
      d.register(azul, 'blue');
      d.register(vermelho, 'red');
      rodar(d, 30.1);
      // Os dois dominaram um ponto no mesmo instante: pontos iguais, abates iguais.
      expect(d.pontosDe('blue')).toBe(d.pontosDe('red'));
      expect(d.vencedor).toBeNull();

      const e = new Dominio(PONTOS, { onFim: (v) => fim.push(v) }, 30, DOMINIO_ALVO);
      const a2 = soldado(0, 0);
      const v2 = soldado(60, -60);
      e.register(a2, 'blue');
      e.register(v2, 'red');
      e.onKilled(v2, a2);
      rodar(e, 30.1);
      expect(e.vencedor, 'empate em pontos: o abate desempata').toBe('blue');

      const f = new Dominio(PONTOS, {}, 30, DOMINIO_ALVO);
      f.register(soldado(0, 0), 'blue');
      rodar(f, 30.1);
      expect(f.vencedor, 'quem tem pontos ganha').toBe('blue');
    });

    it('fogo amigo e morte sem matador não contam abate', () => {
      const d = new Dominio(PONTOS);
      const a = soldado(0, 0);
      const b = soldado(1, 1);
      d.register(a, 'blue');
      d.register(b, 'blue');
      d.onKilled(b, a);
      d.onKilled(b);
      expect(d.placar.blue.kills).toBe(0);
      expect(d.placar.red.kills).toBe(0);
    });
  });

  describe('o resto', () => {
    it('reset zera tudo e mantém as unidades registradas', () => {
      const d = new Dominio(PONTOS, {}, 30, 10);
      const a = soldado(0, 0);
      d.register(a, 'blue');
      rodar(d, 20);
      d.reset();
      expect(d.ended).toBe(false);
      expect(d.tempoRestante).toBe(30);
      expect(d.placar.blue).toEqual({ pontos: 0, kills: 0 });
      expect(d.pontos[2]!.control).toBe(0);
      expect(d.pontos[2]!.dono).toBeNull();
      rodar(d, DOMINIO_CAPTURA_S + 0.5);
      expect(d.pontos[2]!.dono).toBe('blue');
    });

    it('registrar a mesma unidade duas vezes é erro; tirar uma unidade a faz sair da conta', () => {
      const d = new Dominio(PONTOS);
      const a = soldado(0, 0);
      d.register(a, 'blue');
      expect(() => d.register(a, 'red')).toThrow(/já registrada/);
      d.unregister(a);
      rodar(d, 20);
      expect(d.pontos[2]!.control).toBe(0);
      expect(d.ladoDe(a)).toBeUndefined();
    });

    it('seis pontos funcionam como cinco: a regra não sabe quantos são', () => {
      const seis = [...PONTOS, { letra: 'F', x: 20, z: -80 }];
      const d = new Dominio(seis);
      d.register(soldado(20, -80), 'red');
      rodar(d, DOMINIO_CAPTURA_S + 0.5);
      expect(d.dominados('red')).toBe(1);
      expect(d.pontos).toHaveLength(6);
    });

    it('avisa o progresso a 5 Hz, não a cada tick (a tela não precisa de mais)', () => {
      let n = 0;
      const d = new Dominio(PONTOS, { onProgresso: () => n++ });
      rodar(d, 10);
      expect(n).toBeGreaterThanOrEqual(40);
      expect(n).toBeLessThanOrEqual(52);
    });
  });
});
