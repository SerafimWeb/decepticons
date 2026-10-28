import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { BANK_DOOR } from '../../../shared/bank/codes';
import { ARENA_ZONES } from '../combat/Zone';
import { ANDROID_STATS, COLOSSUS_BOSS_STATS } from '../entities/chassis';
import { MECH_GRAVITY } from '../entities/MechBase';
import { VECTOR09_STATS, Vector09 } from '../entities/Vector09';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { COLOSSUS_SPAWN } from '../sim/nascimentos';
import { Arena, BARRICADES_DA_ARENA, BUILDINGS_DA_ARENA, MOBILIARIO_DA_ARENA, PLATAFORMA_DA_ARENA, SPAWN_POINTS } from './Arena';
import { ARENA_QUADRO_DE_LUZ, ARENA_QUADRO_VOLUME, ARENA_TELAO_1, ARENA_TELAO_2 } from './ArenaLayout';
import {
  aberturaMedia,
  caixa,
  componenteDe,
  componentes,
  cruzam,
  fracaoQueSeEnxerga,
  frestasQuePrendem,
  MEIA_PRACA,
  montarGrade,
  type Obstaculo,
  vao,
} from './ArenaMapa';
import { caixaDaRampa, MOBILIARIO_URBANO, PREDIOS_URBANOS, QUIOSQUES_URBANOS, RAMPAS_URBANAS, type BlocoUrbano } from './ArenaUrbana';
import { Destructibles } from './Destructibles';
import { RUA } from './CidadeNeonLayout';
import { SERAFIM_TOWER } from './SerafimTower';

const doBloco = (b: BlocoUrbano): Obstaculo => caixa(b.nome, b.x, b.z, b.w, b.d, b.h);
const NOVOS: Obstaculo[] = [...PREDIOS_URBANOS, ...QUIOSQUES_URBANOS, ...MOBILIARIO_URBANO].map(doBloco);

/** O que a arena tinha antes da praça urbana: os três prédios, as seis barricadas, a plataforma, o Prédio Serafim e o armário do transformador. */
const ORIGINAIS: Obstaculo[] = [
  ...BUILDINGS_DA_ARENA.slice(0, BUILDINGS_DA_ARENA.length - PREDIOS_URBANOS.length).map((b, i) => caixa(`prédio ${i}`, b.x, b.z, b.w, b.d, b.h)),
  ...BARRICADES_DA_ARENA.slice(0, BARRICADES_DA_ARENA.length - QUIOSQUES_URBANOS.length).map((b, i) => caixa(`barricada ${i}`, b.x, b.z, b.w, b.d, b.h)),
  caixa('plataforma', PLATAFORMA_DA_ARENA.x, PLATAFORMA_DA_ARENA.z, PLATAFORMA_DA_ARENA.w, PLATAFORMA_DA_ARENA.d, PLATAFORMA_DA_ARENA.h),
  caixa('Prédio Serafim', SERAFIM_TOWER.x, SERAFIM_TOWER.z, 14, 14, SERAFIM_TOWER.height),
  caixa('transformador', ARENA_QUADRO_DE_LUZ.x, ARENA_QUADRO_DE_LUZ.z, ARENA_QUADRO_VOLUME.w, ARENA_QUADRO_VOLUME.d, ARENA_QUADRO_VOLUME.h),
];
const TODOS: Obstaculo[] = [...ORIGINAIS, ...NOVOS];
/** A pegada da rampa do playground no chão: ela não é obstáculo (o Mech sobe nela), mas ocupa o lugar e não pode cair em cima de nada. */
const PEGADAS_DAS_RAMPAS: Obstaculo[] = RAMPAS_URBANAS.map((r) => caixa(r.nome, r.x + r.run / 2, r.z, r.run, r.largura, r.h));
/** Tudo o que a praça urbana põe no chão (as caixas e as rampas): onde conferir o que não pode invadir. */
const PEGADAS: Obstaculo[] = [...NOVOS, ...PEGADAS_DAS_RAMPAS];

/** A distância de um ponto à caixa (0 se dentro). */
const distanciaDoPonto = (px: number, pz: number, o: Obstaculo): number => Math.hypot(Math.max(o.x0 - px, px - o.x1, 0), Math.max(o.z0 - pz, pz - o.z1, 0));

/** O Marauder, o maior Mech jogável, tem raio 1,6: precisa de 3,2 m para passar. */
const PASSAGEM_MINIMA = 3.8;

describe('a praça urbana da Cidade Neon: o que entra (P268)', () => {
  it('são nove prédios pequenos e médios, cinco contêineres, o playground e dois quiosques que quebram: não lota a praça', () => {
    expect(PREDIOS_URBANOS).toHaveLength(9);
    expect(QUIOSQUES_URBANOS).toHaveLength(2);
    expect(MOBILIARIO_URBANO.filter((b) => b.nome.startsWith('Contêiner'))).toHaveLength(5);
    expect(MOBILIARIO_URBANO.filter((b) => b.nome.startsWith('Playground'))).toHaveLength(6);
    expect(RAMPAS_URBANAS).toHaveLength(1);
    const area = NOVOS.reduce((s, o) => s + (o.x1 - o.x0) * (o.z1 - o.z0), 0);
    expect(area / (2 * MEIA_PRACA) ** 2, 'a fração da praça coberta por peças novas').toBeLessThan(0.06);
  });

  it('os prédios são pequenos e médios (de 8 a 16 m), e nada novo passa de 16 m', () => {
    for (const b of PREDIOS_URBANOS) {
      expect(b.h, b.nome).toBeGreaterThanOrEqual(8);
      expect(b.h, b.nome).toBeLessThanOrEqual(16);
    }
    for (const o of NOVOS) expect(o.h, o.nome).toBeLessThanOrEqual(16);
  });

  it('a arena lê tudo daqui: os prédios e os quiosques entram nas listas dela (com os ids das barricadas antigas intactos) e o mobiliário na dele', () => {
    expect(BUILDINGS_DA_ARENA.slice(-PREDIOS_URBANOS.length)).toEqual(PREDIOS_URBANOS);
    expect(BARRICADES_DA_ARENA.slice(-QUIOSQUES_URBANOS.length)).toEqual(QUIOSQUES_URBANOS);
    expect(BARRICADES_DA_ARENA.slice(0, 6).map((b) => b.x)).toEqual([-8, 14, -30, 10, 22, -14]); // o id é a posição na lista e viaja pela rede
    expect(MOBILIARIO_DA_ARENA).toBe(MOBILIARIO_URBANO);
  });
});

describe('a praça urbana: onde ficam', () => {
  it('tudo dentro do calçadão da praça (a cidade em volta começa depois), com folga de 4 m', () => {
    for (const o of PEGADAS) {
      for (const v of [o.x0, o.x1, o.z0, o.z1]) expect(Math.abs(v), o.nome).toBeLessThan(RUA.calcadao - 4);
    }
  });

  it('nenhuma peça nova entra em outra (tocar na borda, como os degraus do playground, vale; atravessar não)', () => {
    const tudo = [...ORIGINAIS, ...PEGADAS];
    for (let i = 0; i < tudo.length; i++) {
      for (let j = i + 1; j < tudo.length; j++) {
        if (j < ORIGINAIS.length) continue; // os originais entre si não são deste PR
        expect(cruzam(tudo[i]!, tudo[j]!), `${tudo[i]!.nome} × ${tudo[j]!.nome}`).toBe(false);
      }
    }
  });

  it('nada novo a menos de 5 m de um ponto de nascimento (o Mech nasce com chão em volta)', () => {
    for (const [sx, sz] of SPAWN_POINTS) {
      for (const o of PEGADAS) expect(distanciaDoPonto(sx, sz, o), `${o.nome} e o nascimento ${sx},${sz}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('nada novo nas zonas de cura e de frio, nem a menos de 4 m do transformador ou da porta do banco', () => {
    for (const o of PEGADAS) {
      for (const z of ARENA_ZONES) expect(distanciaDoPonto(z.x, z.z, o), `${o.nome} e a zona ${z.kind}`).toBeGreaterThan(z.radius + 2);
      expect(distanciaDoPonto(ARENA_QUADRO_DE_LUZ.x, ARENA_QUADRO_DE_LUZ.z, o), `${o.nome} e o transformador`).toBeGreaterThanOrEqual(8);
      expect(distanciaDoPonto(BANK_DOOR.x, BANK_DOOR.z, o), `${o.nome} e a porta do banco`).toBeGreaterThanOrEqual(BANK_DOOR.radius + 4);
    }
  });

  it('a frente dos telões fica livre: dentro de 10 m de uma tela, só cabe o que está abaixo dela (a tela é para ser vista)', () => {
    const telas = [
      { t: ARENA_TELAO_1, frente: { x0: ARENA_TELAO_1.x - 10, x1: ARENA_TELAO_1.x, z0: ARENA_TELAO_1.z - ARENA_TELAO_1.w / 2, z1: ARENA_TELAO_1.z + ARENA_TELAO_1.w / 2 } },
      { t: ARENA_TELAO_2, frente: { x0: ARENA_TELAO_2.x - ARENA_TELAO_2.w / 2, x1: ARENA_TELAO_2.x + ARENA_TELAO_2.w / 2, z0: ARENA_TELAO_2.z, z1: ARENA_TELAO_2.z + 10 } },
    ];
    for (const { t, frente } of telas) {
      const embaixo = t.y - t.h / 2;
      for (const o of NOVOS) {
        if (!cruzam(o, { ...frente, h: 0, nome: '' })) continue;
        expect(o.h, `${o.nome} na frente do telão em (${t.x}, ${t.z})`).toBeLessThan(embaixo - 1);
      }
    }
  });
});

describe('a praça urbana: ninguém fica preso', () => {
  it('entre dois obstáculos o vão é zero ou passa o Marauder (3,8 m): nada de fresta que prende o Mech ou o bot', () => {
    expect(frestasQuePrendem(TODOS, PASSAGEM_MINIMA)).toEqual([]);
  });

  it('o beco do mercado e o do pátio têm 7 m ou mais (as duas pontas abertas)', () => {
    const por = (n: string) => NOVOS.find((o) => o.nome === n)!;
    expect(vao(por('Mercado 1'), por('Mercado 2'))).toBeGreaterThanOrEqual(7);
    expect(vao(por('Pátio A'), por('Pátio B'))).toBeGreaterThanOrEqual(7);
    expect(vao(por('Mercado 1'), por('Mercado 3'))).toBeGreaterThanOrEqual(7);
  });

  it('o Mech (raio 1,3 m) e o Marauder (1,6 m) vão de todo ponto de nascimento a todo outro, e não sobra bolsão fechado na praça', () => {
    for (const raio of [VECTOR09_STATS.radius + 0.1, 1.7]) {
      const g = montarGrade(TODOS, raio, VECTOR09_STATS.stepHeight);
      const c = componentes(g);
      const dosNascimentos = SPAWN_POINTS.map(([x, z]) => componenteDe(g, c.rotulos, x, z));
      expect(new Set(dosNascimentos).size, `raio ${raio}: componentes dos nascimentos ${dosNascimentos}`).toBe(1);
      expect(dosNascimentos[0], 'o nascimento está em chão livre').toBeGreaterThan(0);
      const livres = c.tamanhos.slice(1).reduce((a, b) => a + b, 0);
      expect(c.tamanhos[dosNascimentos[0]!]! / livres, `raio ${raio}: fração do livre ligada`).toBeGreaterThan(0.995);
    }
  });

  it('a pista do Colossus-01 (do nascimento ao transformador) fica livre de peça nova, mesmo baixa: ele desvia de tudo que vê, e o desvio simples dele prende (achado no P268: uma jardineira de 1,5 m na pista o deixou parado a 70 m do transformador por 120 s)', () => {
    const [bx, bz] = COLOSSUS_SPAWN[0];
    const { x: tx, z: tz } = ARENA_QUADRO_DE_LUZ;
    const margem = COLOSSUS_BOSS_STATS.radius + 2.5;
    for (const o of NOVOS) {
      // a distância da peça ao segmento do nascimento ao transformador (amostrado de metro em metro)
      let menor = Infinity;
      const n = Math.ceil(Math.hypot(tx - bx, tz - bz));
      for (let i = 0; i <= n; i++) menor = Math.min(menor, distanciaDoPonto(bx + ((tx - bx) * i) / n, bz + ((tz - bz) * i) / n, o));
      expect(menor, `${o.nome} na pista do chefe`).toBeGreaterThanOrEqual(margem);
    }
  });

  it('o Colossus-01 (raio 3,6 m, pisa por cima do que tem até 2,4 m) vai do nascimento dele ao transformador que ele ataca', () => {
    const g = montarGrade(TODOS, COLOSSUS_BOSS_STATS.radius + 0.2, COLOSSUS_BOSS_STATS.stepHeight);
    const c = componentes(g);
    const [bx, bz] = COLOSSUS_SPAWN[0];
    const doBoss = componenteDe(g, c.rotulos, bx, bz);
    expect(doBoss, 'o nascimento do Colossus está em chão livre para ele').toBeGreaterThan(0);
    // Ao alcance do braço dele do armário: 8 m a leste, de onde um Colossus de 3,6 m de raio o alcança.
    const alvo = componenteDe(g, c.rotulos, ARENA_QUADRO_DE_LUZ.x + 8, ARENA_QUADRO_DE_LUZ.z);
    expect(alvo, 'o ponto ao lado do transformador está livre para ele').toBeGreaterThan(0);
    expect(alvo).toBe(doBoss);
    // Os becos de 7 m ficam fechados a ele (cabem 7,2 m dele e mais a folga: refúgio de propósito), mas nenhum pedaço de chão livre para ele fica isolado dele: sem bolsão.
    const livres = c.tamanhos.slice(1).reduce((a, b) => a + b, 0);
    expect((livres - c.tamanhos[doBoss]!) / livres, 'a fração do chão livre do Colossus que ele não alcança').toBeLessThan(0.02);
  });

  it('os degraus do playground sobem em passos que cada chassi vence: 0,6 m o Mech sobe andando (com folga do stepHeight de 0,9 m), e o andróide (pulo de 1,5 m) sobe pulando', () => {
    const degraus = MOBILIARIO_URBANO.filter((b) => b.nome.startsWith('Playground: degrau') || b.nome === 'Playground: plataforma').sort((a, b) => a.h - b.h);
    let anterior = 0;
    for (const d of degraus) {
      const subida = +(d.h - anterior).toFixed(2);
      expect(subida, `${d.nome}: a subida`).toBeLessThanOrEqual(VECTOR09_STATS.stepHeight - 0.25);
      anterior = d.h;
    }
    const puloDoAndroide = ANDROID_STATS.jumpVelocity ** 2 / (2 * MECH_GRAVITY);
    expect(puloDoAndroide, 'o pulo do andróide passa o maior degrau').toBeGreaterThan(VECTOR09_STATS.stepHeight);
    for (const b of MOBILIARIO_URBANO.filter((x) => x.nome.startsWith('Playground: cubo'))) expect(b.h, b.nome).toBeLessThan(puloDoAndroide);
  });
});

describe('a praça urbana: o alcance cai (combate de perto)', () => {
  it('a olho de Mech, bem menos pares de pontos a 30–60 m e a 60–100 m se enxergam em linha reta', () => {
    const antes30 = fracaoQueSeEnxerga(ORIGINAIS, 4, 30, 60);
    const depois30 = fracaoQueSeEnxerga(TODOS, 4, 30, 60);
    const antes60 = fracaoQueSeEnxerga(ORIGINAIS, 4, 60, 100);
    const depois60 = fracaoQueSeEnxerga(TODOS, 4, 60, 100);
    expect(antes30, 'a praça de antes era aberta (a medida está de pé)').toBeGreaterThan(0.8);
    expect(depois30, 'a 30–60 m').toBeLessThan(0.62);
    expect(antes30 - depois30, 'queda a 30–60 m').toBeGreaterThan(0.2);
    expect(depois60, 'a 60–100 m').toBeLessThan(0.42);
    expect(antes60 - depois60, 'queda a 60–100 m').toBeGreaterThan(0.25);
  });

  it('a olho de andróide (1,2 m) também: os contêineres e as jardineiras fecham a vista do pequeno', () => {
    const antes = fracaoQueSeEnxerga(ORIGINAIS, 1.2, 60, 100);
    const depois = fracaoQueSeEnxerga(TODOS, 1.2, 60, 100);
    expect(depois).toBeLessThan(0.3);
    expect(antes - depois).toBeGreaterThan(0.25);
  });

  it('os pontos de nascimento ficam mais fechados: a vista livre média em volta cai pelo menos 10 m', () => {
    const media = (obst: readonly Obstaculo[]): number => SPAWN_POINTS.map(([x, z]) => aberturaMedia(x, z, obst, 4, 24)).reduce((a, b) => a + b, 0) / SPAWN_POINTS.length;
    expect(media(ORIGINAIS) - media(TODOS)).toBeGreaterThan(10);
  });
});

describe('a praça urbana na arena de verdade (física e desenho)', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  const montar = async () => {
    const physics = await PhysicsWorld.create();
    const scene = new THREE.Scene();
    const particles = { burst: () => {} } as never;
    const debris = { shatter: () => {} } as never;
    const destructibles = new Destructibles(scene, physics, debris, particles);
    const arena = new Arena(scene, physics, destructibles);
    physics.step();
    return { physics, scene, arena, destructibles };
  };

  it('cada peça nova tem colisor: o chão sob o centro dela está na altura dela', async () => {
    const { physics } = await montar();
    for (const b of [...PREDIOS_URBANOS, ...MOBILIARIO_URBANO]) {
      expect(physics.terrainY(b.x, b.z, 40, 80), b.nome).toBeCloseTo(b.h, 1);
    }
  });

  it('os quiosques quebram (ids 6 e 7, depois das seis barricadas de sempre) e os ids antigos seguem de pé', async () => {
    const { destructibles } = await montar();
    expect(destructibles.standingIds()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    destructibles.breakById(6);
    expect(destructibles.standingIds()).toEqual([0, 1, 2, 3, 4, 5, 7]);
  });

  it('o desenho é barato: os nove prédios e o mobiliário todo cabem em poucas malhas (as arestas e as faixas são uma só cada)', async () => {
    const { scene } = await montar();
    const nomes = (prefixo: string): number => {
      let n = 0;
      scene.traverse((o) => o.name.startsWith(prefixo) && n++);
      return n;
    };
    expect(nomes('praca-predio-')).toBe(PREDIOS_URBANOS.length); // um corpo por prédio (o material de cada um deixa a câmera apagá-lo)
    expect(nomes('praca-predios-arestas')).toBe(1);
    expect(nomes('praca-predios-faixas')).toBe(1);
    expect(nomes('praca-mobiliario')).toBe(2); // corpos e arestas
  });

  it('o Mech sobe a rampa do playground (23°) e chega na plataforma de 3 m, e desce por ela até o chão', async () => {
    const { physics } = await montar();
    const r = RAMPAS_URBANAS[0]!;
    const sobe = new Vector09();
    sobe.spawn(physics, new THREE.Vector3(r.x + r.run + 6, 0, r.z));
    let noAlto = false;
    for (let i = 0; i < 160; i++) {
      sobe.fixedUpdate({ moveX: 0, moveZ: 1, moveYaw: Math.PI / 2, yaw: Math.PI / 2, jump: false, dash: false }, FIXED_DT); // yaw π/2 anda para o oeste (−x)
      physics.step();
      sobe.render(0, 1);
      if (sobe.grounded && Math.abs(sobe.position.y - r.h) < 0.1 && sobe.position.x < r.x) noAlto = true;
    }
    expect(noAlto, 'chegou em cima pela rampa').toBe(true);
    const desce = new Vector09();
    desce.spawn(physics, new THREE.Vector3(r.x - 3, r.h, r.z));
    for (let i = 0; i < 120; i++) {
      desce.fixedUpdate({ moveX: 0, moveZ: 1, moveYaw: -Math.PI / 2, yaw: -Math.PI / 2, jump: false, dash: false }, FIXED_DT); // −π/2 anda para o leste (+x)
      physics.step();
      desce.render(0, 1);
    }
    expect(desce.position.y, 'desceu até o chão').toBeCloseTo(0, 1);
    expect(desce.position.x, 'passou do fim da rampa').toBeGreaterThan(r.x + r.run);
  });

  it('a rampa se encaixa na plataforma e termina no chão: a face de cima passa pela borda de cima na altura dela e chega a zero no fim', () => {
    const r = RAMPAS_URBANAS[0]!;
    const c = caixaDaRampa(r);
    // O ponto da face de cima em x: a reta que passa por (borda de cima, h) e (fim do run, 0).
    const plataforma = MOBILIARIO_URBANO.find((b) => b.nome === 'Playground: plataforma')!;
    expect(plataforma.x + plataforma.w / 2, 'a rampa começa na borda da plataforma').toBeCloseTo(r.x, 6);
    expect(plataforma.h, 'e na altura dela').toBe(r.h);
    expect(Math.abs(r.z - plataforma.z), 'no meio da plataforma').toBeLessThan(plataforma.d / 2 - r.largura / 2 + 1e-9);
    expect(Math.tan(-c.angulo) * 180 / Math.PI, 'a inclinação em graus (tan)').toBeGreaterThan(0);
    expect((Math.atan2(r.h, r.run) * 180) / Math.PI, 'a inclinação').toBeLessThan(35); // o Mech vence 50°; o andróide e o conforto pedem menos
  });

  it('o Mech sobe os degraus do playground andando e chega na plataforma de 3 m', async () => {
    const { physics } = await montar();
    const mech = new Vector09();
    mech.spawn(physics, new THREE.Vector3(-74, 0, -15));
    let noAlto = false;
    for (let i = 0; i < 140; i++) {
      mech.fixedUpdate({ moveX: 0, moveZ: 1, moveYaw: 0, yaw: 0, jump: false, dash: false }, FIXED_DT); // yaw 0 anda para o norte (−z)
      physics.step();
      mech.render(0, 1);
      if (mech.grounded && Math.abs(mech.position.y - 3) < 0.1 && mech.position.z < -28) noAlto = true;
    }
    expect(noAlto, 'chegou em cima da plataforma de 3 m').toBe(true);
  });
});
