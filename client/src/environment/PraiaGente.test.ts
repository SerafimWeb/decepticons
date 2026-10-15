import { describe, expect, it } from 'vitest';
import { GENTE, GENTE_X, gentesDaPraia, PISTAS_DA_CICLOVIA, PISTAS_DO_CALCADAO, pipasDaPraia, posicaoDoPassante } from './PraiaGente';
import { praiaColisores } from './PraiaColisores';
import { PRAIA_COMPLEXO } from './PraiaLayout';
import { alturaDoChao, costaEm, funduraDoMarEm, NIVEL_DO_MAR } from './PraiaTerreno';

/** O ponto (x, z) está dentro da pegada de algum colisor que bloqueia uma pessoa (do pé à cabeça)? */
function bateEmAlgo(x: number, z: number): string | null {
  for (const c of praiaColisores()) {
    if (c.rx || c.rz) continue; // as rampas são o chão
    if (c.y + c.h / 2 < 0.3 || c.y - c.h / 2 > 1.8) continue; // passa por cima ou por baixo
    const dx = x - c.x;
    const dz = z - c.z;
    const co = Math.cos(-(c.giro ?? 0));
    const si = Math.sin(-(c.giro ?? 0));
    const lx = dx * co + dz * si;
    const lz = -dx * si + dz * co;
    if (Math.abs(lx) < c.w / 2 + 0.3 && Math.abs(lz) < c.d / 2 + 0.3) return `colisor em (${c.x}, ${c.z})`;
  }
  return null;
}

/** Os instantes de uma volta inteira (ida e volta) de um passante. */
function amostras(comprimento: number, velocidade: number, n = 120): number[] {
  const volta = (2 * Math.abs(comprimento)) / velocidade;
  return Array.from({ length: n }, (_, i) => (i / n) * volta);
}

describe('a gente da praia (P127, rodada de vida): dado puro', () => {
  const gente = gentesDaPraia();

  it('a lista é determinística e cabe nos tetos de instância de cada desenho', () => {
    expect(gente.length).toBe(GENTE.passantes + GENTE.beira + GENTE.ciclistas + GENTE.nadadores);
    expect(gentesDaPraia()).toEqual(gente);
    expect(gente.length).toBeLessThanOrEqual(90);
  });

  it('o passante anda de ponta a ponta do trecho, na velocidade dele, e nunca sai dele', () => {
    for (const p of gente) {
      const lo = Math.min(p.x0, p.x0 + p.comprimento);
      const hi = Math.max(p.x0, p.x0 + p.comprimento);
      for (const t of amostras(p.comprimento, p.velocidade, 40)) {
        const { x } = posicaoDoPassante(p, t);
        expect(x).toBeGreaterThanOrEqual(lo - 1e-6);
        expect(x).toBeLessThanOrEqual(hi + 1e-6);
      }
      // A velocidade escalar no meio do trecho é a pedida (a derivada numérica).
      const t0 = ((0.37 * 2 * Math.abs(p.comprimento)) / p.velocidade) * 0.999;
      const a = posicaoDoPassante(p, t0).x;
      const b = posicaoDoPassante(p, t0 + 0.05).x;
      if (Math.abs(b - a) > 1e-6) expect(Math.abs(b - a) / 0.05).toBeCloseTo(p.velocidade, 1);
    }
  });

  it('ninguém entra no complexo da estação: é uma base, e a orla acaba antes do muro', () => {
    for (const p of gente) {
      for (const t of amostras(p.comprimento, p.velocidade, 60)) {
        const { x } = posicaoDoPassante(p, t);
        expect(x).toBeGreaterThanOrEqual(GENTE_X.min - 1e-6);
        expect(x).toBeLessThanOrEqual(GENTE_X.max + 1e-6);
        expect(x).toBeLessThan(PRAIA_COMPLEXO.minX - 6);
      }
    }
  });

  it('quem anda a pé e quem pedala não atravessa quiosque, barraca, lancha, torre nem carro', () => {
    for (const p of gente) {
      if (p.faixa === 'nadador') continue;
      for (const t of amostras(p.comprimento, p.velocidade, 150)) {
        const { x, z } = posicaoDoPassante(p, t);
        expect(bateEmAlgo(x, z), `${p.faixa} em (${x.toFixed(1)}, ${z.toFixed(1)})`).toBeNull();
      }
    }
  });

  it('as pistas: o calçadão fica longe dos quiosques e dos bancos; a ciclovia dentro da faixa vermelha', () => {
    for (const p of gente.filter((q) => q.faixa === 'calcadao')) {
      expect(p.z).toBeGreaterThan(9.9);
      expect(p.z).toBeLessThan(12.1);
    }
    expect(Math.min(...PISTAS_DO_CALCADAO)).toBeGreaterThan(9.9);
    for (const p of gente.filter((q) => q.faixa === 'ciclovia')) {
      expect(PISTAS_DA_CICLOVIA).toContain(p.z);
      expect(p.z).toBeGreaterThan(12.7);
      expect(p.z).toBeLessThan(15.7);
      expect(p.velocidade).toBeGreaterThan(3.5); // pedalando, não passeando
    }
  });

  it('quem caminha na beira pisa na face molhada, acima d\'água; quem nada está onde cobre, mas não no fundo', () => {
    for (const p of gente.filter((q) => q.faixa === 'beira')) {
      for (const t of amostras(p.comprimento, p.velocidade, 60)) {
        const { x, z } = posicaoDoPassante(p, t);
        expect(alturaDoChao(x, z), 'acima do nível do mar').toBeGreaterThanOrEqual(NIVEL_DO_MAR - 1e-6);
        expect(z, 'do lado de terra da costa').toBeGreaterThan(costaEm(x));
      }
    }
    for (const p of gente.filter((q) => q.faixa === 'nadador')) {
      for (const t of amostras(p.comprimento, p.velocidade, 60)) {
        const { x, z } = posicaoDoPassante(p, t);
        const fundura = funduraDoMarEm(x, z);
        expect(fundura, 'cobre o corpo').toBeGreaterThan(0.8);
        expect(fundura, 'mas é raso: um banhista não vai ao fundo').toBeLessThan(4);
      }
    }
  });
});

describe('as pipas do céu da praia', () => {
  const pipas = pipasDaPraia();

  it('há uma fileira delas, presas na areia (de terra), a uma altura que o vento dá', () => {
    expect(pipas.length).toBeGreaterThanOrEqual(6);
    for (const p of pipas) {
      expect(p.z, 'a linha está presa na areia, não no mar').toBeGreaterThan(costaEm(p.x) + 5);
      expect(p.altura).toBeGreaterThan(30);
      expect(p.altura).toBeLessThan(80);
      expect(Math.hypot(p.dx, p.dz)).toBeLessThan(40);
    }
  });

  it('não se amontoam: duas pipas nunca ficam a menos de 25 m uma da outra', () => {
    for (let i = 0; i < pipas.length; i++) {
      for (let j = i + 1; j < pipas.length; j++) {
        expect(Math.hypot(pipas[i]!.x - pipas[j]!.x, pipas[i]!.z - pipas[j]!.z)).toBeGreaterThan(25);
      }
    }
  });
});
