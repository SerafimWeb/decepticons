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

describe('o circuito é repetível: cada quadro tem o seu lugar e a sua vida (o transformador do banco, P164 parte E)', () => {
  const ponto = { x: -13, z: -33 };

  it('o quadro sem argumentos é o do porto da praia (240); com ponto e vida próprios, nasce inteiro com a vida que pediram', () => {
    const padrao = new QuadroDeLuz();
    expect(padrao.vidaMax).toBe(QUADRO.vidaMax);
    expect(padrao.ponto).toBe(PRAIA_QUADRO_DE_LUZ);
    const banco = new QuadroDeLuz(ponto, 480);
    expect(banco.vidaMax).toBe(480);
    expect(banco.vida).toBe(480);
    expect(banco.ponto).toBe(ponto);
    expect(banco.estado()).toBe('ligado');
    expect(banco.energia).toBe(1);
  });

  it('a vida maior segura mais: o mesmo andróide (peso 0,5, 3/s) leva 160 s para apagar o de 480, e o Colossus (peso 4, 24/s) 20 s', () => {
    const sozinho = new QuadroDeLuz(ponto, 480);
    rodar(sozinho, 100, 0.5);
    expect(sozinho.estado()).toBe('sabotado');
    expect(sozinho.energia).toBeCloseTo(1 - 300 / 480, 2);
    rodar(sozinho, 62, 0.5);
    expect(sozinho.apagado).toBe(true);
    const colossus = new QuadroDeLuz(ponto, 480);
    rodar(colossus, 19, 4);
    expect(colossus.apagado).toBe(false);
    rodar(colossus, 2, 4);
    expect(colossus.apagado).toBe(true);
  });

  it('a energia e a volta valem em fração da vida DELE: o de 480 volta a ligar com 25% (120), não com 60', () => {
    const q = new QuadroDeLuz(ponto, 480);
    rodar(q, 30, 4); // zera
    expect(q.apagado).toBe(true);
    rodar(q, 6, 0, 1); // 48 de vida: ainda apagado
    expect(q.apagado).toBe(true);
    expect(q.energia).toBe(0);
    rodar(q, 6, 0, 1); // 96 de vida: ainda apagado (a volta é aos 120)
    expect(q.apagado).toBe(true);
    rodar(q, 4, 0, 1); // 128: voltou
    expect(q.apagado).toBe(false);
    expect(q.energia).toBeCloseTo(q.vida / 480, 9);
  });

  it('a fração, o reparo e o teto valem para a vida DELE: 180 de dano num de 480 deixam 62,5%; o reparo passa dos 240 da praia e só para nos 480', () => {
    const q = new QuadroDeLuz(ponto, 480);
    rodar(q, 60, 0.5); // 3 por segundo: 180 de dano
    expect(q.vida).toBeCloseTo(300, 0);
    expect(q.fracaoDaVida).toBeCloseTo(0.625, 2);
    expect(q.energia).toBeCloseTo(0.625, 2);
    rodar(q, 10, 0, 1); // um defensor, 8 por segundo: +80, passando dos 240 do quadro da praia
    expect(q.vida).toBeCloseTo(380, 0);
    expect(q.estado()).toBe('sabotado');
    rodar(q, 40, 0, 1);
    expect(q.vida, 'o teto é a vida dele, não a da praia').toBe(480);
    expect(q.estado()).toBe('ligado');
  });

  it('reset volta à vida dele (480), e a conta de quem está perto lê o ponto dele, não o da praia', () => {
    const q = new QuadroDeLuz(ponto, 480);
    rodar(q, 10, 4);
    q.reset();
    expect(q.vida).toBe(480);
    expect(q.estado()).toBe('ligado');
    expect(q.perto(ponto.x, ponto.z, QUADRO.raioDeAtaque)).toBe(true);
    expect(q.perto(ponto.x + 6, ponto.z, QUADRO.raioDeAtaque)).toBe(true);
    expect(q.perto(ponto.x + 8, ponto.z, QUADRO.raioDeAtaque)).toBe(false);
    expect(q.perto(PRAIA_QUADRO_DE_LUZ.x, PRAIA_QUADRO_DE_LUZ.z, QUADRO.raioDeAtaque), 'o ponto da praia não vale para ele').toBe(false);
    expect(pertoDoQuadro(ponto.x, ponto.z, QUADRO.raioDeAtaque, ponto)).toBe(true);
    expect(pertoDoQuadro(ponto.x, ponto.z, QUADRO.raioDeAtaque), 'sem o ponto, vale o da praia').toBe(false);
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
