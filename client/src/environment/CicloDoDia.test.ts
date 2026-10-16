import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { DURACAO_DO_DIA_S, diaFromSearch, faseDoDia, instanteDeLigar, progressoDaPartida, progressoDoDia } from './CicloDoDia';
import { Praia } from './Praia';
import { luzesDaPraia, TIPOS_DE_ILUMINACAO_PUBLICA } from './PraiaLuzesDados';

const passos = (n: number): number[] => Array.from({ length: n + 1 }, (_, i) => i / n);

describe('o CICLO DO DIA da praia (P161): pôr do sol no começo, noite com as luzes acesas em 5 minutos', () => {
  it('o relógio: 300 s de partida levam o dia de 0 a 1, e valor torto cai no começo em vez de quebrar a luz', () => {
    expect(DURACAO_DO_DIA_S).toBe(300);
    expect(progressoDoDia(0)).toBe(0);
    expect(progressoDoDia(150)).toBeCloseTo(0.5, 6);
    expect(progressoDoDia(300)).toBe(1);
    expect(progressoDoDia(900)).toBe(1); // depois dos 5 minutos a noite fica fechada
    expect(progressoDoDia(-5)).toBe(0);
    for (const torto of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(progressoDoDia(torto)).toBe(0);
    expect(progressoDoDia(10, 0)).toBe(0); // duração inválida
  });

  it('no começo é o pôr do sol com a cidade ainda de dia: sol vermelho acima do mar, nada de noite, luzes fracas', () => {
    const f = faseDoDia(0);
    expect(f.solAltura).toBeGreaterThan(0.05); // acima do horizonte, perto dele
    expect(f.solAltura).toBeLessThan(0.15); // "perto da linha do horizonte", não a pino
    expect(f.noite).toBe(0);
    expect(f.lampadas).toBe(0); // a iluminação pública só é um fio de brilho (o shader dá o piso)
    expect(f.luzDoSol).toBeGreaterThan(0.8);
  });

  it('no fim dos 5 minutos o sol já se pôs: abaixo do horizonte, noite fechada, sem luz de sol, as lâmpadas todas acesas', () => {
    const f = faseDoDia(1);
    expect(f.solAltura).toBeLessThan(-0.15);
    expect(f.noite).toBe(1);
    expect(f.lampadas).toBe(1);
    expect(f.luzDoSol).toBe(0);
    expect(f.luaAltura).toBeGreaterThan(faseDoDia(0).luaAltura); // a lua sobe
  });

  it('é contínuo e monótono: o sol só desce, a lua só sobe, a noite e as lâmpadas só crescem, e nada pula entre dois quadros', () => {
    let ant = faseDoDia(0);
    for (const p of passos(3000).slice(1)) {
      const f = faseDoDia(p);
      expect(f.solAltura).toBeLessThanOrEqual(ant.solAltura + 1e-12);
      expect(f.luaAltura).toBeGreaterThanOrEqual(ant.luaAltura - 1e-12);
      expect(f.noite).toBeGreaterThanOrEqual(ant.noite - 1e-12);
      expect(f.lampadas).toBeGreaterThanOrEqual(ant.lampadas - 1e-12);
      expect(f.luzDoSol).toBeLessThanOrEqual(ant.luzDoSol + 1e-12);
      // um passo de 1/3000 do dia (0,1 s) não pode mudar nada além de uma fração pequena
      expect(Math.abs(f.noite - ant.noite)).toBeLessThan(0.01);
      expect(Math.abs(f.lampadas - ant.lampadas)).toBeLessThan(0.01);
      expect(Math.abs(f.luzDoSol - ant.luzDoSol)).toBeLessThan(0.01);
      ant = f;
    }
  });

  it('as luzes da cidade acendem DEPOIS do pôr do sol e a noite só fecha com elas acesas', () => {
    const quandoAcendem = passos(3000).find((p) => faseDoDia(p).lampadas > 0.5)!;
    expect(faseDoDia(quandoAcendem).solAltura, 'o sol já está abaixo do horizonte quando metade das lâmpadas acende').toBeLessThan(0);
    // de dia (o primeiro terço) a iluminação pública está apagada: o pedido do Comandante ("tá tudo aceso ainda de dia")
    for (const p of passos(100).filter((x) => x <= 0.33)) expect(faseDoDia(p).lampadas, `p=${p}`).toBeLessThan(0.05);
    // e quando a noite fecha, todas estão acesas
    for (const p of passos(1000)) if (faseDoDia(p).noite > 0.99) expect(faseDoDia(p).lampadas).toBeGreaterThan(0.95);
  });

  it('é determinístico e tolera entrada torta: mesma entrada, mesma fase; NaN vale o começo e fora de 0..1 é limitado', () => {
    expect(faseDoDia(0.37)).toEqual(faseDoDia(0.37));
    expect(faseDoDia(Number.NaN)).toEqual(faseDoDia(0));
    expect(faseDoDia(-3)).toEqual(faseDoDia(0));
    expect(faseDoDia(7)).toEqual(faseDoDia(1));
  });

  it('cada lâmpada tem o seu instante: a cidade acende aos poucos, não de uma vez', () => {
    const instantes = Array.from({ length: 400 }, (_, i) => instanteDeLigar(i * 0.37 + 0.11));
    for (const t of instantes) {
      expect(t).toBeGreaterThanOrEqual(0.05);
      expect(t).toBeLessThanOrEqual(0.9);
    }
    // espalhados: em cada décimo do intervalo há lâmpadas ligando
    const faixas = new Set(instantes.map((t) => Math.floor((t - 0.05) / 0.085)));
    expect(faixas.size).toBeGreaterThanOrEqual(9);
    expect(instanteDeLigar(1.234)).toBe(instanteDeLigar(1.234));
  });
});

describe('qual relógio manda no dia (a missão, a rodada ou o relógio visual)', () => {
  it('a missão em ondas manda: o dia anda com o tempo da missão', () => {
    expect(progressoDaPartida({ missaoS: 150, rodada: { restanteS: 0, duracaoS: 300, jogando: true }, visualS: 9999 })).toBeCloseTo(0.5, 6);
  });

  it('sem missão, a rodada de 5 minutos manda: começa em 0 e termina em 1; no intervalo a noite fica fechada', () => {
    const r = (restanteS: number, jogando = true) => progressoDaPartida({ missaoS: null, rodada: { restanteS, duracaoS: 300, jogando }, visualS: 0 });
    expect(r(300)).toBe(0);
    expect(r(150)).toBeCloseTo(0.5, 6);
    expect(r(0.5)).toBeGreaterThan(0.99);
    expect(r(8, false)).toBe(1); // no placar (intervalo) a noite segue fechada até a rodada seguinte recomeçar o dia
  });

  it('modos sem tempo (Captura da Bandeira, Domínio e o online: a rodada é infinita) usam o relógio visual do mapa', () => {
    expect(progressoDaPartida({ missaoS: null, rodada: { restanteS: Number.POSITIVE_INFINITY, duracaoS: 300, jogando: true }, visualS: 75 })).toBeCloseTo(0.25, 6);
    expect(progressoDaPartida({ missaoS: null, rodada: null, visualS: 75 })).toBeCloseTo(0.25, 6);
  });

  it('o ?dia= do link fixa a hora (0 a 1); ausente ou torto devolve null para o relógio da partida mandar', () => {
    expect(diaFromSearch('')).toBeNull();
    expect(diaFromSearch('?mapa=praia')).toBeNull();
    expect(diaFromSearch('?dia=0.5')).toBe(0.5);
    expect(diaFromSearch('?dia=0')).toBe(0);
    expect(diaFromSearch('?dia=1')).toBe(1);
    expect(diaFromSearch('?dia=7')).toBe(1);
    expect(diaFromSearch('?dia=-2')).toBe(0);
    expect(diaFromSearch('?dia=abc')).toBeNull();
    expect(diaFromSearch('?dia=')).toBeNull();
  });
});

describe('as lâmpadas da praia: só a iluminação pública acende com o fim do dia', () => {
  const luzes = luzesDaPraia();

  it('há luz pública e há sinalização, e as duas existem de verdade no mapa', () => {
    expect(luzes.filter((l) => l.ligaEm >= 0).length).toBeGreaterThan(100); // postes, varais, refletores, torres
    expect(luzes.filter((l) => l.ligaEm < 0).length).toBeGreaterThan(5); // antenas, boias, navios, semáforos
  });

  it('a luz pública liga num instante entre 0,05 e 0,9; a sinalização (aviso vermelho das antenas e das lanchas) fica sempre ligada', () => {
    for (const l of luzes) {
      if (l.ligaEm < 0) continue;
      expect(l.ligaEm).toBeGreaterThanOrEqual(0.05);
      expect(l.ligaEm).toBeLessThanOrEqual(0.9);
    }
    expect(TIPOS_DE_ILUMINACAO_PUBLICA.has('poste')).toBe(true);
    expect(TIPOS_DE_ILUMINACAO_PUBLICA.has('antena')).toBe(false);
    expect(TIPOS_DE_ILUMINACAO_PUBLICA.has('lancha')).toBe(false);
  });
});

const abertas: PhysicsWorld[] = [];

describe('a praia aplica o ciclo na cena: luzes, névoa e os uniformes que o céu e o mar leem', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  async function montar() {
    const physics = await PhysicsWorld.create();
    abertas.push(physics);
    const scene = new THREE.Scene();
    const praia = new Praia(scene, physics);
    const luzes = {
      ceu: scene.children.find((o) => (o as THREE.HemisphereLight).isHemisphereLight) as THREE.HemisphereLight,
      direcionais: scene.children.filter((o) => (o as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight[],
    };
    const comNoite: THREE.ShaderMaterial[] = [];
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m && m.isShaderMaterial && m.uniforms.uNoite) comNoite.push(m);
    });
    return { scene, praia, luzes, comNoite };
  }

  it('a cena nasce no pôr do sol (progresso 0): sol aceso, névoa rosada, nada de noite', async () => {
    const { scene, luzes, comNoite } = await montar();
    const [sol] = luzes.direcionais.filter((d) => d.position.y > 0).sort((a, b) => b.intensity - a.intensity);
    expect(sol!.intensity).toBeGreaterThan(0.8);
    const fog = scene.fog as THREE.FogExp2;
    expect(fog.color.r).toBeGreaterThan(fog.color.b); // rosa-alaranjado
    expect(comNoite.length, 'o céu e o mar leem a noite').toBeGreaterThanOrEqual(2);
    for (const m of comNoite) expect(m.uniforms.uNoite!.value).toBe(0);
  });

  it('com o progresso 1 a cena é noite: sol apagado, névoa escura e azul, luz do céu azulada, lua mais forte e o céu e o mar sabem', async () => {
    const { scene, praia, luzes, comNoite } = await montar();
    const antes = { fog: (scene.fog as THREE.FogExp2).color.clone(), lua: Math.min(...luzes.direcionais.map((d) => d.intensity)) };
    praia.setProgressoDoDia(1);
    const fog = (scene.fog as THREE.FogExp2).color;
    expect(fog.r + fog.g + fog.b, 'a névoa escurece').toBeLessThan((antes.fog.r + antes.fog.g + antes.fog.b) * 0.3);
    expect(fog.b).toBeGreaterThan(fog.r); // azul-noite
    expect(luzes.ceu.color.b).toBeGreaterThan(luzes.ceu.color.r); // a luz do céu esfria
    const intensidades = luzes.direcionais.map((d) => d.intensity).sort((a, b) => a - b);
    expect(intensidades[0], 'o sol apagou').toBe(0);
    expect(intensidades[intensidades.length - 1]!, 'a lua é a luz forte da noite: mais forte que era de dia').toBeGreaterThan(antes.lua * 1.5);
    // O mar e o céu leem o MESMO uniforme da praia: `UniformsUtils.merge` clona, e o mar já leu uma cópia congelada (as ondas ficavam paradas).
    expect(comNoite.length).toBeGreaterThanOrEqual(2);
    for (const m of comNoite) expect(m.uniforms.uNoite!.value, 'o uniforme de noite chega a cada material').toBe(1);
  });

  it('o mar lê o tempo e o sol da praia (não uma cópia): update(7) chega à água, e a direção do sol se mexe lá também', async () => {
    const { scene, praia } = await montar();
    let mar: THREE.ShaderMaterial | undefined;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m && m.isShaderMaterial && m.uniforms.uNoite && m.uniforms.uDetalhe && (o as THREE.Mesh).geometry instanceof THREE.PlaneGeometry) mar = m;
    });
    expect(mar, 'o plano do mar').toBeDefined();
    praia.update(7);
    expect(mar!.uniforms.uTempo!.value).toBe(7);
    const alturaAntes = (mar!.uniforms.uSolDir!.value as THREE.Vector3).y;
    praia.setProgressoDoDia(1);
    const sol = mar!.uniforms.uSolDir!.value as THREE.Vector3;
    expect(sol.y).toBeLessThan(alturaAntes);
    expect(sol.y).toBeLessThan(0); // depois do pôr do sol o disco está abaixo do horizonte
    expect(sol.length()).toBeCloseTo(1, 5); // segue unitário
  });

  it('o azimute do sol não muda no ciclo (só a altura): as sombras assadas no chão continuam valendo a partida inteira', async () => {
    const { scene, praia } = await montar();
    let ceu: THREE.ShaderMaterial | undefined;
    scene.traverse((o) => {
      const malha = o as THREE.Mesh;
      const m = malha.material as THREE.ShaderMaterial | undefined;
      if (m && m.isShaderMaterial && m.uniforms.uSolDir && malha.geometry instanceof THREE.SphereGeometry) ceu = m; // o domo do céu
    });
    expect(ceu, 'o domo do céu').toBeDefined();
    const sol = ceu!.uniforms.uSolDir!.value as THREE.Vector3;
    const azimute = () => Math.atan2(sol.z, sol.x);
    const inicial = azimute();
    for (const p of [0.2, 0.5, 0.8, 1]) {
      praia.setProgressoDoDia(p);
      expect(azimute(), `p=${p}`).toBeCloseTo(inicial, 5);
    }
  });

  it('o bulbo desenhado de cada poste acende no mesmo instante do halo dele; a sinalização (aviso das antenas) fica sempre ligada', async () => {
    const { scene } = await montar();
    const valores = new Set<number>();
    let malhasComLiga = 0;
    scene.traverse((o) => {
      const malha = o as THREE.Mesh;
      const liga = malha.geometry?.attributes?.aLiga;
      if (!liga) return;
      malhasComLiga++;
      for (let i = 0; i < liga.count; i += 7) valores.add(Math.round(liga.getX(i) * 1000) / 1000);
    });
    expect(malhasComLiga, 'as malhas de brilho (a fixa e a que pisca)').toBeGreaterThanOrEqual(2);
    expect(valores.has(-1), 'há sinalização sempre ligada').toBe(true);
    const publicos = [...valores].filter((v) => v >= 0);
    expect(publicos.length, 'há bulbos públicos com instantes diferentes').toBeGreaterThan(20);
    for (const v of publicos) {
      expect(v).toBeGreaterThanOrEqual(0.05);
      expect(v).toBeLessThanOrEqual(0.9);
    }
    // o instante do bulbo de cada adereço é o mesmo da luz (halo) dele
    const doHalo = new Set(luzesDaPraia().filter((l) => l.ligaEm >= 0).map((l) => Math.round(l.ligaEm * 1000) / 1000));
    for (const v of publicos) expect(doHalo.has(v), `o bulbo que liga em ${v} tem um halo que liga junto`).toBe(true);
  });

  it('aplicar o mesmo progresso de novo ou um valor torto não quebra nem altera a cena', async () => {
    const { scene, praia } = await montar();
    praia.setProgressoDoDia(0.6);
    const cor = (scene.fog as THREE.FogExp2).color.clone();
    praia.setProgressoDoDia(0.6);
    expect((scene.fog as THREE.FogExp2).color.equals(cor)).toBe(true);
    praia.setProgressoDoDia(Number.NaN); // vira o começo do dia
    const fog = (scene.fog as THREE.FogExp2).color;
    expect(Number.isFinite(fog.r + fog.g + fog.b)).toBe(true);
    expect(fog.r).toBeGreaterThan(fog.b);
  });
});
