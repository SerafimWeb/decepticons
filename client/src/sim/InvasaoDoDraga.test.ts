import { describe, expect, it } from 'vitest';
import { avisoDaEscotilha, escotilhaDoDraga, INVASAO, InvasaoDoDraga } from './InvasaoDoDraga';

const DT = 1 / 60;
const andar = (i: InvasaoDoDraga, s: number, escudoCaiu: boolean, juntos: number, draga = true): void => {
  for (let k = 0; k < Math.round(s / DT); k++) i.fixedUpdate(DT, escudoCaiu, draga, juntos);
};

describe('a invasão do Draga-01 (P180, parte E)', () => {
  it('com o escudo de pé a escotilha fica fechada: nem os três andróides junto dela somam carga', () => {
    const i = new InvasaoDoDraga();
    andar(i, 20, false, 3);
    expect(i.aberta).toBe(false);
    expect(i.carga).toBe(0);
    expect(i.plantando).toBe(0);
  });

  it('o escudo cair abre a escotilha (uma vez, e o aviso é lido uma vez só); ela não fecha mais', () => {
    const i = new InvasaoDoDraga();
    andar(i, 1, false, 0);
    i.fixedUpdate(DT, true, true, 0);
    expect(i.aberta).toBe(true);
    expect(i.abriuNoTick).toBe(true);
    expect(i.consumirAbertura()).toBe(true);
    expect(i.consumirAbertura()).toBe(false);
    andar(i, 1, false, 0); // o escudo "voltar" (não volta de verdade) não a fecha
    expect(i.aberta).toBe(true);
  });

  it('cada andróide junto da escotilha soma carga: um leva 30 s, três levam ~10 s (a carga é a mesma conta, só mais rápida)', () => {
    const um = new InvasaoDoDraga();
    andar(um, 29, true, 1);
    expect(um.detonou).toBe(false);
    expect(um.carga).toBeCloseTo(29 / 30, 1);
    andar(um, 2, true, 1);
    expect(um.detonou).toBe(true);
    const tres = new InvasaoDoDraga();
    andar(tres, 9, true, 3);
    expect(tres.detonou).toBe(false);
    andar(tres, 2, true, 3);
    expect(tres.detonou).toBe(true);
  });

  it('só contam três andróides ao mesmo tempo: cinco juntos plantam como três', () => {
    const tres = new InvasaoDoDraga();
    const cinco = new InvasaoDoDraga();
    andar(tres, 5, true, 3);
    andar(cinco, 5, true, 5);
    expect(cinco.plantando).toBe(INVASAO.maxPlantando);
    expect(cinco.carga).toBeCloseTo(tres.carga, 6);
  });

  it('sem andróide junto a carga recua devagar (45 s para zerar sozinha), e nunca fica abaixo de zero', () => {
    const i = new InvasaoDoDraga();
    andar(i, 6, true, 3); // ~0,6 de carga
    const antes = i.carga;
    expect(antes).toBeGreaterThan(0.5);
    andar(i, 10, true, 0);
    expect(i.carga).toBeLessThan(antes);
    expect(i.carga).toBeGreaterThan(antes - 0.3);
    andar(i, 60, true, 0);
    expect(i.carga).toBe(0);
  });

  it('a detonação vale uma vez e para a conta; o Draga caído por outro caminho também a para', () => {
    const i = new InvasaoDoDraga();
    andar(i, 12, true, 3);
    expect(i.detonou).toBe(true);
    expect(i.consumirDetonacao()).toBe(true);
    expect(i.consumirDetonacao()).toBe(false);
    const j = new InvasaoDoDraga();
    andar(j, 5, true, 3);
    const carga = j.carga;
    andar(j, 20, true, 3, false); // o Draga caiu: nada anda
    expect(j.carga).toBe(carga);
    expect(j.plantando).toBe(0);
  });

  it('rodada nova fecha a escotilha, zera a carga e limpa a detonação', () => {
    const i = new InvasaoDoDraga();
    andar(i, 12, true, 3);
    i.reiniciar();
    expect(i.aberta).toBe(false);
    expect(i.carga).toBe(0);
    expect(i.detonou).toBe(false);
    expect(i.consumirDetonacao()).toBe(false);
  });

  it('um número de andróides quebrado (negativo, fracionário) não estraga a conta', () => {
    const i = new InvasaoDoDraga();
    i.fixedUpdate(DT, true, true, -3);
    expect(i.plantando).toBe(0);
    i.fixedUpdate(DT, true, true, 2.9);
    expect(i.plantando).toBe(2);
  });
});

describe('a escotilha no flanco do casco', () => {
  const out = { x: 0, z: 0 };
  it('olhando para -X (rio acima, yaw π/2), o flanco direito é o do lado sul (z menor), a 13 m do eixo', () => {
    escotilhaDoDraga(100, 20, Math.PI / 2, out);
    expect(out.x).toBeCloseTo(100, 6);
    expect(out.z).toBeCloseTo(20 - INVASAO.ladoDaEscotilhaM, 6);
  });

  it('acompanha o giro do casco: sempre a 13 m do eixo e perpendicular à frente', () => {
    for (const yaw of [0, 0.7, 1.9, Math.PI, -2.4]) {
      escotilhaDoDraga(0, 0, yaw, out);
      expect(Math.hypot(out.x, out.z)).toBeCloseTo(INVASAO.ladoDaEscotilhaM, 6);
      const frente = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      expect(out.x * frente.x + out.z * frente.z).toBeCloseTo(0, 6);
    }
  });

  it('fica fora da cápsula do Draga (raio 10 m): o andróide chega ao casco sem entrar na física dele', () => {
    expect(INVASAO.ladoDaEscotilhaM).toBeGreaterThan(10);
    expect(INVASAO.raioDaEscotilhaM).toBeGreaterThan(0);
  });
});

describe('o aviso da escotilha', () => {
  it('avisa só na passada de fechada para aberta', () => {
    expect(avisoDaEscotilha(false, true)).toBe('ESCOTILHA ABERTA · OS ANDRÓIDES ENTRAM');
    expect(avisoDaEscotilha(true, true)).toBeNull();
    expect(avisoDaEscotilha(false, false)).toBeNull();
    expect(avisoDaEscotilha(true, false)).toBeNull();
  });
});
