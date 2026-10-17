import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/rng';
import { ARENA_ZONES, HEAL_ZONE_RATE, ZoneSystem } from '../combat/Zone';
import { PRAIA_ESTACAO, PRAIA_QUADRO_DE_LUZ } from '../environment/PraiaLayout';
import { CODIGO_DO_ESTADO_DO_QUADRO, pertoDoQuadro, QUADRO, QuadroDeLuz } from './QuadroDeLuz';

const DT = 1 / 60;

function rodar(q: QuadroDeLuz, s: number, atacantes = 0, defensores = 0): void {
  for (let i = 0; i < Math.round(s / DT); i++) q.fixedUpdate(DT, atacantes, defensores);
}

describe('o QUADRO DE LUZ DA CIDADE (P164, frente 3): o circuito que o porto pede para proteger', () => {
  it('fica na ponta oeste do cais, a mais de 500 m da estação: defender os dois ao mesmo tempo é impossível', () => {
    expect(Math.hypot(PRAIA_QUADRO_DE_LUZ.x - PRAIA_ESTACAO.x, PRAIA_QUADRO_DE_LUZ.z - PRAIA_ESTACAO.z)).toBeGreaterThan(500);
  });

  it('começa inteiro e ligado: energia cheia, nada sabotado', () => {
    const q = new QuadroDeLuz();
    expect(q.estado()).toBe('ligado');
    expect(q.energia).toBe(1);
    expect(q.fracaoDaVida).toBe(1);
    expect(q.apagado).toBe(false);
  });

  it('um andróide (peso 0,5) sabota em ~80 s; no meio do caminho o quadro está SABOTADO e a energia cai junto com a vida', () => {
    const q = new QuadroDeLuz();
    rodar(q, 40, 0.5);
    expect(q.estado()).toBe('sabotado');
    expect(q.energia).toBeCloseTo(0.5, 1);
    rodar(q, 41, 0.5);
    expect(q.estado()).toBe('apagado');
    expect(q.vida).toBe(0);
    expect(q.energia).toBe(0); // a cidade no escuro
  });

  it('um quadro sabotado não se recompõe sozinho: sem defensor ele fica como está, o tempo que for', () => {
    const q = new QuadroDeLuz();
    rodar(q, 20, 1);
    const antes = q.vida;
    rodar(q, 300, 0, 0);
    expect(q.vida).toBe(antes);
  });

  it('o defensor recupera: 8 de vida por segundo, até dois; apagado, o quadro volta a ligar aos 25% e a energia volta junto', () => {
    const q = new QuadroDeLuz();
    rodar(q, 100, 1); // apagado (240 / 6 = 40 s)
    expect(q.apagado).toBe(true);
    rodar(q, 6, 0, 1); // 48 de 240 (20%)
    expect(q.apagado).toBe(true);
    expect(q.energia).toBe(0); // ainda no escuro: só volta a ligar com 25%
    rodar(q, 2, 0, 1); // passou de 60
    expect(q.apagado).toBe(false);
    expect(q.energia).toBeGreaterThan(0.2);
    // dois e três defensores rendem o mesmo (o teto é dois)
    const dois = new QuadroDeLuz();
    const tres = new QuadroDeLuz();
    rodar(dois, 100, 1);
    rodar(tres, 100, 1);
    rodar(dois, 4, 0, 2);
    rodar(tres, 4, 0, 3);
    expect(tres.vida).toBeCloseTo(dois.vida, 6);
    rodar(dois, 60, 0, 2);
    expect(dois.vida).toBe(QUADRO.vidaMax);
    expect(dois.estado()).toBe('ligado');
  });

  it('com o invasor em cima ninguém recupera', () => {
    const q = new QuadroDeLuz();
    rodar(q, 10, 1);
    const antes = q.vida;
    rodar(q, 5, 1, 2);
    expect(q.vida).toBeLessThan(antes);
  });

  it('missão nova (reset): inteiro e ligado de novo', () => {
    const q = new QuadroDeLuz();
    rodar(q, 100, 1);
    q.reset();
    expect(q.estado()).toBe('ligado');
    expect(q.energia).toBe(1);
  });

  it('os códigos do estado para o HUD e o desenho: 0 ligado, 1 sabotado, 2 apagado', () => {
    expect(CODIGO_DO_ESTADO_DO_QUADRO).toEqual({ ligado: 0, sabotado: 1, apagado: 2 });
  });

  it('é determinístico e mantém as invariantes: vida em [0, 240], energia zero só apagado, sabotado só com a vida baixa', () => {
    const roda = () => {
      const q = new QuadroDeLuz();
      const r = mulberry32(1337);
      for (let t = 0; t < 60 * 600; t++) {
        q.fixedUpdate(DT, r() < 0.4 ? Math.floor(r() * 4) * 0.5 : 0, r() < 0.3 ? Math.floor(r() * 4) : 0);
        expect(q.vida).toBeGreaterThanOrEqual(0);
        expect(q.vida).toBeLessThanOrEqual(QUADRO.vidaMax);
        if (q.apagado) expect(q.energia).toBe(0);
        else expect(q.energia).toBeCloseTo(q.vida / QUADRO.vidaMax, 9);
        if (q.estado() === 'ligado') expect(q.vida).toBe(QUADRO.vidaMax);
      }
      return JSON.stringify([q.vida, q.estado()]);
    };
    expect(roda()).toBe(roda());
  });

  it('quem está perto do quadro: dentro do raio e só', () => {
    const { x, z } = PRAIA_QUADRO_DE_LUZ;
    expect(pertoDoQuadro(x, z, QUADRO.raioDeAtaque)).toBe(true);
    expect(pertoDoQuadro(x + 5, z, QUADRO.raioDeAtaque)).toBe(true);
    expect(pertoDoQuadro(x + 12, z, QUADRO.raioDeAtaque)).toBe(false);
    expect(pertoDoQuadro(0, 0, QUADRO.raioDeAtaque)).toBe(false);
  });
});

describe('as zonas de cura e de resfriamento dependem do quadro (P164)', () => {
  it('com energia curam como sempre; sem energia (quadro apagado) deixam de curar, e voltam com a energia', () => {
    const [cura] = ARENA_ZONES.filter((z) => z.kind === 'heal');
    const reparos: number[] = [];
    const mech = { alive: true, simPosition: { x: cura!.x, z: cura!.z }, repair: (n: number) => reparos.push(n), vent: () => {} };
    const zonas = new ZoneSystem(ARENA_ZONES);
    zonas.fixedUpdate(1, [mech as never]);
    expect(reparos).toEqual([HEAL_ZONE_RATE]);
    zonas.energizadas = false;
    zonas.fixedUpdate(1, [mech as never]);
    expect(reparos).toEqual([HEAL_ZONE_RATE]); // não curou de novo
    zonas.energizadas = true;
    zonas.fixedUpdate(1, [mech as never]);
    expect(reparos).toEqual([HEAL_ZONE_RATE, HEAL_ZONE_RATE]);
  });
});
