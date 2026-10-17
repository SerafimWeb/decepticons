import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import { ARENA_ZONES } from '../combat/Zone';
import { SPAWN_POINTS } from '../environment/Arena';
import { AMAZONIA_SPAWNS } from '../environment/AmazoniaLayout';
import { BUNKER_SPAWNS } from '../environment/Bunker';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from './Match';
import {
  ALLY_COUNT,
  ALLY_SPAWNS,
  ANDROID_SPAWNS,
  BOT_SPAWNS,
  capacidadeDoMapa,
  type Contagem,
  EXTRAS_ALIADOS,
  EXTRAS_INIMIGOS,
  nascimentosDoEsquadrao,
  PONTOS_DOS_TITAS,
  type Ponto,
  TECHNICIAN_SPAWNS,
} from './nascimentos';

const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const dist = (a: Ponto, b: Ponto) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const JOGADOR = SPAWN_POINTS[0]!;
const ZERO: Contagem = { mechs: 0, androids: 0, tecnicos: 0, aliadosMechs: 0, aliadosAndroids: 0 };
const chaves = (l: readonly Ponto[]) => l.map((p) => p.join(','));

describe('pontos de nascimento: o jogo de hoje', () => {
  it('os pontos fixos são os de sempre (a partida de hoje nasce onde nascia)', () => {
    expect(BOT_SPAWNS).toEqual([[6, -18], [45, -45], [-40, -5]]);
    expect(ANDROID_SPAWNS).toEqual([[-60, -60], [60, 20], [-65, 60]]);
    expect(TECHNICIAN_SPAWNS).toEqual([[70, 70]]);
    expect(ALLY_SPAWNS).toEqual([[-18, -8], [24, 12]]);
    expect(ALLY_COUNT).toBe(2);
  });

  it('o esquadrão de hoje (1 Mech, 2 andróides, técnico, 2 aliados) usa só os pontos fixos, na ordem', () => {
    const n = nascimentosDoEsquadrao({ mechs: 1, androids: 2, tecnicos: 1, aliadosMechs: 2, aliadosAndroids: 0 }, 'arena');
    expect(n.mechs).toEqual([BOT_SPAWNS[0]]);
    expect(n.androids).toEqual([ANDROID_SPAWNS[0], ANDROID_SPAWNS[1]]);
    expect(n.tecnicos).toEqual([TECHNICIAN_SPAWNS[0]]);
    expect(n.aliadosMechs).toEqual([ALLY_SPAWNS[0], ALLY_SPAWNS[1]]);
  });

  it('o do servidor (3 Mechs, 3 andróides, técnico) também', () => {
    const n = nascimentosDoEsquadrao({ ...ZERO, mechs: 3, androids: 3, tecnicos: 1 }, 'arena');
    expect(n.mechs).toEqual([...BOT_SPAWNS]);
    expect(n.androids).toEqual([...ANDROID_SPAWNS]);
  });
});

describe('pontos extras da Arena', () => {
  it('são muitos, únicos e ficam dentro da arena (as paredes estão a 100 m)', () => {
    expect(EXTRAS_INIMIGOS.length).toBeGreaterThanOrEqual(30);
    expect(EXTRAS_ALIADOS.length).toBeGreaterThanOrEqual(14);
    const todos = [...EXTRAS_INIMIGOS, ...EXTRAS_ALIADOS];
    expect(new Set(chaves(todos)).size).toBe(todos.length);
    for (const [x, z] of todos) {
      expect(Math.abs(x)).toBeLessThanOrEqual(90);
      expect(Math.abs(z)).toBeLessThanOrEqual(90);
    }
  });

  it('nenhum fica perto de outro, nem de um ponto fixo (ninguém nasce em cima de ninguém)', () => {
    for (const [lista, minimo] of [[EXTRAS_INIMIGOS, 14], [EXTRAS_ALIADOS, 8]] as const) {
      for (const [i, p] of lista.entries()) {
        for (const q of lista.slice(i + 1)) expect(dist(p, q), `${p} e ${q}`).toBeGreaterThanOrEqual(minimo);
        for (const f of SPAWN_POINTS) expect(dist(p, f), `${p} e o fixo ${f}`).toBeGreaterThanOrEqual(minimo);
      }
    }
    for (const a of EXTRAS_ALIADOS) for (const e of EXTRAS_INIMIGOS) expect(dist(a, e), `${a} e ${e}`).toBeGreaterThanOrEqual(8);
  });

  it('os inimigos nascem longe do jogador e os aliados perto dele', () => {
    for (const p of EXTRAS_INIMIGOS) {
      expect(dist(p, JOGADOR), `${p}`).toBeGreaterThanOrEqual(55);
    }
    for (const p of EXTRAS_ALIADOS) {
      expect(dist(p, JOGADOR), `${p}`).toBeGreaterThanOrEqual(10);
      expect(dist(p, JOGADOR), `${p}`).toBeLessThanOrEqual(48);
    }
  });

  it('nenhum nasce numa zona de cura ou de resfriamento (a vantagem é de quem a conquista)', () => {
    for (const p of [...EXTRAS_INIMIGOS, ...EXTRAS_ALIADOS]) {
      for (const z of ARENA_ZONES) expect(dist(p, [z.x, z.z]), `${p}`).toBeGreaterThan(z.radius);
    }
  });

  describe('contra a arena de verdade (física)', () => {
    beforeAll(async () => {
      await RAPIER.init();
    });

    it('cabe um Mech grande em pé em cada ponto, sem encostar em prédio, barricada, rampa, plataforma nem na torre', async () => {
      const physics = await PhysicsWorld.create();
      try {
        const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false });
        // As consultas só enxergam o que já passou por um passo da física (o amplo é montado no passo).
        physics.step();
        // O maior Mech que um bot pilota (Onça-B2: raio 1,6 m, 5,3 m de altura), com 3,4 m de folga por todos os lados (5 m do centro até
        // qualquer parede): um cilindro que começa 0,5 m acima do chão (para não bater no piso) e vai até a altura do robô.
        const raio = 5;
        const altura = 5.3;
        const base = 0.5;
        const forma = new RAPIER.Cylinder((altura - base) / 2, raio);
        const fixo = (c: RAPIER.Collider) => {
          const corpo = c.parent();
          return !corpo || corpo.isFixed();
        };
        for (const [x, z] of [...EXTRAS_INIMIGOS, ...EXTRAS_ALIADOS]) {
          const batida = match.physics.world.intersectionWithShape(
            { x, y: base + (altura - base) / 2, z },
            { x: 0, y: 0, z: 0, w: 1 },
            forma,
            undefined, undefined, undefined, undefined,
            fixo,
          );
          expect(batida, `o ponto ${x},${z} encosta em algo da arena`).toBeNull();
        }
        // E o teste enxerga: um ponto dentro de um prédio (o do canto noroeste, em -28,-35) bate.
        const dentro = match.physics.world.intersectionWithShape({ x: -28, y: 3, z: -35 }, { x: 0, y: 0, z: 0, w: 1 }, forma, undefined, undefined, undefined, undefined, fixo);
        expect(dentro).not.toBeNull();
      } finally {
        physics.world.free();
      }
    });
  });
});

describe('pontos dos titãs (P108)', () => {
  it('são quatro, únicos, longe do jogador, longe uns dos outros e dos pontos fixos, fora das zonas de cura', () => {
    expect(PONTOS_DOS_TITAS).toHaveLength(4);
    expect(new Set(chaves(PONTOS_DOS_TITAS)).size).toBe(4);
    for (const [i, p] of PONTOS_DOS_TITAS.entries()) {
      expect(dist(p, JOGADOR), `${p}`).toBeGreaterThanOrEqual(60);
      for (const q of PONTOS_DOS_TITAS.slice(i + 1)) expect(dist(p, q), `${p} e ${q}`).toBeGreaterThanOrEqual(30);
      for (const f of SPAWN_POINTS) expect(dist(p, f), `${p} e o fixo ${f}`).toBeGreaterThanOrEqual(14);
      for (const z of ARENA_ZONES) expect(dist(p, [z.x, z.z]), `${p}`).toBeGreaterThan(z.radius);
      expect(Math.abs(p[0])).toBeLessThanOrEqual(90);
      expect(Math.abs(p[1])).toBeLessThanOrEqual(90);
    }
  });

  it('a alocação dá os pontos dos titãs na ordem, só na Arena, e recusa mais que o mapa comporta', () => {
    const n = nascimentosDoEsquadrao({ ...ZERO, mechs: 1, titas: 2 }, 'arena');
    expect(n.titas).toEqual([PONTOS_DOS_TITAS[0], PONTOS_DOS_TITAS[1]]);
    expect(n.mechs).toEqual([BOT_SPAWNS[0]]);
    expect(nascimentosDoEsquadrao(ZERO, 'arena').titas).toEqual([]);
    expect(() => nascimentosDoEsquadrao({ ...ZERO, titas: 5 }, 'arena')).toThrow(/titã/);
    expect(() => nascimentosDoEsquadrao({ ...ZERO, titas: 1 }, 'bunker')).toThrow(/titã/);
    expect(capacidadeDoMapa('arena').titas).toBe(4);
  });

  describe('contra a arena de verdade (física)', () => {
    beforeAll(async () => {
      await RAPIER.init();
    });

    it('cabe o Colossus-V4 em pé em cada ponto (cilindro de 10 m de raio e 21 m de altura), sem encostar em nada fixo', async () => {
      const physics = await PhysicsWorld.create();
      try {
        const match = new Match({ physics, scene: new THREE.Scene(), particles: NO_FX, foes: DEFAULT_SETTINGS, debris: false });
        physics.step();
        const raio = 10;
        const altura = 21;
        const base = 0.5;
        const forma = new RAPIER.Cylinder((altura - base) / 2, raio);
        const fixo = (c: RAPIER.Collider) => {
          const corpo = c.parent();
          return !corpo || corpo.isFixed();
        };
        for (const [x, z] of PONTOS_DOS_TITAS) {
          const batida = match.physics.world.intersectionWithShape({ x, y: base + (altura - base) / 2, z }, { x: 0, y: 0, z: 0, w: 1 }, forma, undefined, undefined, undefined, undefined, fixo);
          expect(batida, `o ponto ${x},${z} encosta em algo da arena`).toBeNull();
        }
        // E o teste enxerga: o ponto de um prédio não cabe o titã.
        const dentro = match.physics.world.intersectionWithShape({ x: -28, y: 3, z: -35 }, { x: 0, y: 0, z: 0, w: 1 }, forma, undefined, undefined, undefined, undefined, fixo);
        expect(dentro).not.toBeNull();
      } finally {
        physics.world.free();
      }
    });
  });
});

describe('alocar os pontos de um esquadrão', () => {
  it('passando dos fixos, o inimigo pega os extras na ordem e o aliado os dele (nenhum ponto repete)', () => {
    const n = nascimentosDoEsquadrao({ mechs: 5, androids: 4, tecnicos: 2, aliadosMechs: 4, aliadosAndroids: 2 }, 'arena');
    expect(n.mechs.slice(0, 3)).toEqual([...BOT_SPAWNS]);
    expect(n.mechs.slice(3)).toEqual([EXTRAS_INIMIGOS[0], EXTRAS_INIMIGOS[1]]);
    expect(n.androids.slice(3)).toEqual([EXTRAS_INIMIGOS[2]]);
    expect(n.tecnicos).toEqual([TECHNICIAN_SPAWNS[0], EXTRAS_INIMIGOS[3]]);
    expect(n.aliadosMechs).toEqual([...ALLY_SPAWNS, EXTRAS_ALIADOS[0], EXTRAS_ALIADOS[1]]);
    expect(n.aliadosAndroids).toEqual([EXTRAS_ALIADOS[2], EXTRAS_ALIADOS[3]]);
    const todos = [...n.mechs, ...n.androids, ...n.tecnicos, ...n.aliadosMechs, ...n.aliadosAndroids];
    expect(new Set(chaves(todos)).size).toBe(todos.length);
  });

  it('é determinístico: o mesmo pedido dá os mesmos pontos', () => {
    const c: Contagem = { mechs: 6, androids: 5, tecnicos: 2, aliadosMechs: 5, aliadosAndroids: 1 };
    expect(nascimentosDoEsquadrao(c, 'arena')).toEqual(nascimentosDoEsquadrao(c, 'arena'));
  });

  it('a Arena comporta o teto de CPU com folga e recusa o que não cabe', () => {
    const cap = capacidadeDoMapa('arena');
    expect(cap.inimigos).toBeGreaterThanOrEqual(30);
    expect(cap.aliados).toBeGreaterThanOrEqual(14);
    expect(() => nascimentosDoEsquadrao({ ...ZERO, mechs: cap.inimigos + 1 }, 'arena')).toThrow(/não cabe/);
    expect(() => nascimentosDoEsquadrao({ ...ZERO, aliadosMechs: cap.aliados + 1 }, 'arena')).toThrow(/não cabe/);
    // No limite, ainda monta: nenhum extra a menos do que o pedido.
    const n = nascimentosDoEsquadrao({ ...ZERO, androids: cap.inimigos }, 'arena');
    expect(n.androids).toHaveLength(cap.inimigos);
    expect(n.androids.every(Boolean)).toBe(true);
  });
});

describe('pontos do Bunker', () => {
  const todos = (n: ReturnType<typeof nascimentosDoEsquadrao>) => [...n.mechs, ...n.androids, ...n.tecnicos, ...n.aliadosMechs, ...n.aliadosAndroids];

  it('o esquadrão de hoje nasce onde nascia (aliados no 1 e no 3, Mech no 2, andróides no 5 e no 6, técnico no 10)', () => {
    const n = nascimentosDoEsquadrao({ mechs: 1, androids: 2, tecnicos: 1, aliadosMechs: 2, aliadosAndroids: 0 }, 'bunker');
    expect(n.aliadosMechs).toEqual([BUNKER_SPAWNS[1], BUNKER_SPAWNS[3]]);
    expect(n.mechs).toEqual([BUNKER_SPAWNS[2]]);
    expect(n.androids).toEqual([BUNKER_SPAWNS[5], BUNKER_SPAWNS[6]]);
    expect(n.tecnicos).toEqual([BUNKER_SPAWNS[10]]);
  });

  it('nunca dois corpos no mesmo ponto, nem o do jogador: o ponto 3, que aliado e terceiro Mech disputavam, vai só para um', () => {
    const n = nascimentosDoEsquadrao({ mechs: 3, androids: 3, tecnicos: 1, aliadosMechs: 2, aliadosAndroids: 0 }, 'bunker');
    const t = todos(n);
    expect(new Set(chaves(t)).size).toBe(t.length);
    expect(chaves(t)).not.toContain(BUNKER_SPAWNS[0]!.join(','));
    expect(n.mechs).toEqual([BUNKER_SPAWNS[2], BUNKER_SPAWNS[4], BUNKER_SPAWNS[8]]);
  });

  it('comporta os 11 pontos livres e recusa o 12º', () => {
    expect(capacidadeDoMapa('bunker')).toEqual({ inimigos: 11, aliados: 11, total: 11, titas: 0 });
    const cheio = nascimentosDoEsquadrao({ mechs: 4, androids: 3, tecnicos: 1, aliadosMechs: 2, aliadosAndroids: 1 }, 'bunker');
    const t = todos(cheio);
    expect(t).toHaveLength(11);
    expect(new Set(chaves(t)).size).toBe(11);
    expect(() => nascimentosDoEsquadrao({ mechs: 4, androids: 3, tecnicos: 1, aliadosMechs: 2, aliadosAndroids: 2 }, 'bunker')).toThrow(/não cabe/);
  });
});

describe('pontos da Amazônia (P180)', () => {
  it('comporta os 11 pontos livres (o 0 é do jogador, na aldeia) e recusa o 12º', () => {
    expect(capacidadeDoMapa('amazonia')).toEqual({ inimigos: 11, aliados: 11, total: 11, titas: 0 });
    expect(() => nascimentosDoEsquadrao({ ...ZERO, mechs: 11 }, 'amazonia')).not.toThrow();
    expect(() => nascimentosDoEsquadrao({ ...ZERO, mechs: 12 }, 'amazonia')).toThrow(/não cabe/);
    expect(() => nascimentosDoEsquadrao({ ...ZERO, mechs: 6, aliadosMechs: 6 }, 'amazonia')).toThrow(/não cabe/);
    expect(() => nascimentosDoEsquadrao({ ...ZERO, titas: 1 }, 'amazonia')).toThrow(/titã/);
  });

  it('cada corpo nasce no seu ponto da margem sul, na ordem do esquadrão, e nenhum ponto se repete nem é o do jogador', () => {
    const n = nascimentosDoEsquadrao({ mechs: 2, androids: 3, tecnicos: 1, aliadosMechs: 1, aliadosAndroids: 2 }, 'amazonia');
    const todos = [...n.mechs, ...n.androids, ...n.tecnicos, ...n.aliadosMechs, ...n.aliadosAndroids];
    expect(todos).toHaveLength(9);
    expect(n.mechs).toEqual(AMAZONIA_SPAWNS.slice(1, 3));
    expect(n.androids).toEqual(AMAZONIA_SPAWNS.slice(3, 6));
    expect(n.aliadosAndroids).toEqual(AMAZONIA_SPAWNS.slice(8, 10));
    expect(new Set(chaves(todos)).size).toBe(9);
    expect(chaves(todos)).not.toContain(chaves([AMAZONIA_SPAWNS[0]!])[0]);
    expect(n.titas).toEqual([]);
  });

  it('é determinístico: o mesmo pedido dá os mesmos pontos', () => {
    const c = { ...ZERO, mechs: 4, androids: 2 };
    expect(nascimentosDoEsquadrao(c, 'amazonia')).toEqual(nascimentosDoEsquadrao(c, 'amazonia'));
  });
});
