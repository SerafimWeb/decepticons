import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CARECA, GADO, Multidao, NUNCA, PERUCA, TICKS_DO_TOMBO, type ConfigDaMultidao } from '../sim/Multidao';
import { empacota, geometriaDaPeruca, geometriaDoCareca, geometriaDoGado, MASCARAS_LIGADAS, MultidaoDesenho } from './MultidaoDesenho';

const CONFIG: ConfigDaMultidao = {
  semente: 77,
  fontes: [
    { tipo: 'onibus', x: -120, z: 0 },
    { tipo: 'bueiro', x: -60, z: 10 },
    { tipo: 'lixeira', x: -30, z: -10 },
  ],
  predios: [
    { x: 40, z: -20, meia: 10 },
    { x: 40, z: 20, meia: 10 },
  ],
  saidas: [{ x: -300, z: 0 }],
  cota: 400,
  duracaoTicks: 18_000,
  pAndroide: 0,
};

const triangulos = (g: THREE.BufferGeometry): number => g.attributes.position!.count / 3;
const malhasDe = (d: MultidaoDesenho) => d.grupo.children as THREE.InstancedMesh[];

/** Liga a simulação ao desenho como a demonstração faz. */
function ligar(m: Multidao, d: MultidaoDesenho): void {
  m.aoMorrer = (i) => d.aoMorrer(i);
  m.aoFugir = (i) => d.aoMudar(i);
  m.aoSair = (i) => d.aoSair(i);
}

describe('o desenho da multidão (P217): as três malhas', () => {
  it('cada tipo é uma malha de baixo polígono (uns 100 a 160 triângulos), e desligar a máscara de um tipo troca a cabeça sem mexer nos outros', () => {
    for (const g of [geometriaDoGado(), geometriaDoCareca(), geometriaDaPeruca()]) {
      expect(triangulos(g)).toBeGreaterThan(80);
      expect(triangulos(g)).toBeLessThan(170);
    }
    expect(triangulos(geometriaDoGado(false))).not.toBe(triangulos(geometriaDoGado()));
    expect(triangulos(geometriaDoCareca(false))).toBeLessThan(triangulos(geometriaDoCareca()));
    expect(triangulos(geometriaDaPeruca(false))).toBeLessThan(triangulos(geometriaDaPeruca()));
  });

  it('o shader lê só atributos que as malhas têm (um atributo faltando vira zero na GPU e some a multidão sem aviso)', () => {
    const fonte = readFileSync(new URL('./MultidaoDesenho.ts', import.meta.url), 'utf8');
    const declarados = [...fonte.matchAll(/^attribute\s+\w+\s+(\w+);/gm)].map((m) => m[1]!);
    expect(declarados.length).toBeGreaterThanOrEqual(7);
    // O limite da GPU é de 16 atributos por vértice (só a placa de verdade mostra: o SwiftShader do smoke não liga a demo): position, normal e color do three, os 4 da matriz da instância
    // e os nossos. Com 17 o shader não compilava ("Too many attributes") e a multidão sumia; a bancada `multidao-gpu.mjs` achou.
    expect(3 + 4 + declarados.length).toBeLessThanOrEqual(16);
    const d = new MultidaoDesenho(new Multidao(CONFIG));
    for (const malha of malhasDe(d)) {
      for (const nome of declarados) expect(malha.geometry.getAttribute(nome), nome).toBeDefined();
      const n = malha.instanceMatrix.count; // a capacidade (a contagem desenhada começa em 0 e cresce com as vagas em uso)
      for (const nome of ['aA', 'aB', 'aC', 'aFim', 'aFuga'] as const) expect((malha.geometry.getAttribute(nome) as THREE.InstancedBufferAttribute).count, nome).toBe(n);
    }
  });

  it('a cor empacotada num float volta igual: os 24 bits cabem exatos (e a conta do shader, com a folga de meio degrau, acerta os três canais)', () => {
    for (const hex of [0x000000, 0xffffff, 0x1f8a3b, 0xffd21f, 0x0100ff, 0x00ff01]) {
      const c = new THREE.Color();
      c.setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
      const f = Math.fround(empacota(c));
      expect(f).toBe(empacota(c)); // cabe no float de 32 bits sem perder nada
      const r = Math.floor((f + 0.5) / 65536);
      const resto = f - r * 65536;
      const g = Math.floor((resto + 0.5) / 256);
      expect([r, g, resto - g * 256]).toEqual([(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]);
    }
  });
});

describe('as vagas de instância: o custo na GPU segue quem está presente', () => {
  it('três desenhos para qualquer cota; ninguém nasceu = nenhum vértice enviado; cada nascimento ocupa uma vaga e só ela', () => {
    const m = new Multidao({ ...CONFIG, cota: 1500 });
    const d = new MultidaoDesenho(m);
    expect(d.custo.desenhos).toBe(3);
    expect(d.custo.triangulos).toBe(0);
    d.atualizar(18_000); // sem a simulação andar, ninguém sai: todos nascem e ocupam vaga
    expect(d.presentes).toBe(m.total);
    const por = [0, 0, 0];
    for (let i = 0; i < m.total; i++) por[m.tipo[i]!]!++;
    const esperado = por[GADO]! * triangulos(geometriaDoGado()) + por[CARECA]! * triangulos(geometriaDoCareca()) + por[PERUCA]! * triangulos(geometriaDaPeruca());
    expect(d.custo.triangulos).toBe(esperado);
    // vagas distintas dentro de cada malha
    for (let t = 0; t < 3; t++) {
      const vagas = new Set<number>();
      for (let i = 0; i < m.total; i++) if (m.tipo[i] === t) vagas.add(d.vagaDe(i));
      expect(vagas.size).toBe(por[t]);
      expect(Math.max(...vagas)).toBe(por[t]! - 1);
    }
  });

  it('quem sai da Praça devolve a vaga e outro nasce nela: com a fase inteira rodando, o custo é o máximo de gente AO MESMO TEMPO, não o total que nasceu', () => {
    const m = new Multidao({ ...CONFIG, cota: 1500 });
    const d = new MultidaoDesenho(m);
    ligar(m, d);
    let pico = 0;
    // a fase dura 18.000 ticks de chegada, mais a marcha (a pé da fonte ao prédio), a fachada e a fuga até o limite do mapa: o último some pelo tick 40.000
    for (let t = 0; t <= 45_000; t += 3) {
      m.avancar(t);
      d.atualizar(t);
      pico = Math.max(pico, m.presentes);
      expect(d.presentes, `no tick ${t}`).toBe(m.presentes);
    }
    expect(m.terminou).toBe(true);
    expect(d.presentes).toBe(0);
    const maxima = malhasDe(d).reduce((a, malha) => a + malha.count, 0);
    expect(maxima).toBeGreaterThanOrEqual(pico);
    expect(maxima).toBeLessThan(m.total * 0.7); // bem abaixo do total que nasceu
  });

  it('a missão recomeçada (reiniciar + recomecar): as vagas voltam todas, ninguém fica desenhado, e os nascimentos recomeçam do primeiro como na primeira vez', () => {
    const m = new Multidao({ ...CONFIG, cota: 600 });
    const d = new MultidaoDesenho(m);
    ligar(m, d);
    for (let t = 0; t <= 6_000; t += 3) {
      m.avancar(t);
      d.atualizar(t);
    }
    m.explodir(0, 0.5, 0, 500, 999, 6_000);
    expect(m.presentes).toBeGreaterThanOrEqual(0);
    const antes = d.presentes;
    expect(antes).toBeGreaterThan(0);
    m.reiniciar();
    d.recomecar();
    expect(d.presentes).toBe(0);
    expect(m.presentes).toBe(0);
    expect(m.eliminados).toBe(0);
    expect(m.faltamChegar).toBe(m.total);
    expect(malhasDe(d).every((malha) => malha.count === 0)).toBe(true);
    // a segunda rodada nasce igual à primeira: mesma semente, mesmo cronograma, mesmas vagas
    for (let t = 0; t <= 6_000; t += 3) {
      m.avancar(t);
      d.atualizar(t);
    }
    expect(d.presentes).toBe(antes);
  });

  it('o teto da qualidade (G12): no máximo a fração de cada tipo ao mesmo tempo; a simulação não muda', () => {
    const cheio = new MultidaoDesenho(new Multidao({ ...CONFIG, cota: 1500 }));
    cheio.atualizar(18_000);
    const metade = new MultidaoDesenho(new Multidao({ ...CONFIG, cota: 1500 }));
    metade.limitar(0.5);
    metade.atualizar(18_000);
    expect(metade.presentes).toBeLessThan(cheio.presentes * 0.55);
    expect(metade.presentes).toBeGreaterThan(cheio.presentes * 0.45);
    expect(metade.custo.triangulos).toBeLessThan(cheio.custo.triangulos * 0.55);
  });
});

describe('o desenho ligado à simulação', () => {
  it('o que o jogador causa vai para a vaga: a fuga (com a corrida), a morte, e o corpo caído devolve a vaga depois do tombo', () => {
    const m = new Multidao(CONFIG);
    const d = new MultidaoDesenho(m);
    ligar(m, d);
    const t = 3000;
    m.avancar(t);
    d.atualizar(t);
    m.calcularPosicoes(t);
    const i = [...m.presente].findIndex((v) => v === 1);
    expect(i).toBeGreaterThanOrEqual(0);
    const vaga = d.vagaDe(i);
    expect(vaga).toBeGreaterThanOrEqual(0);
    const malha = malhasDe(d)[m.tipo[i]!]!;
    const fim = malha.geometry.getAttribute('aFim') as THREE.InstancedBufferAttribute;
    const fuga = malha.geometry.getAttribute('aFuga') as THREE.InstancedBufferAttribute;
    expect(fim.getX(vaga)).toBe(NUNCA);
    expect(fim.getY(vaga)).toBe(NUNCA);

    m.explodir(m.posX[i]!, 0.5, m.posZ[i]!, 0.2, 1, t); // fere sem matar: o figurante foge
    expect(m.fugiuNoTick(i)).toBe(t);
    expect(fim.getY(vaga)).toBe(t);
    expect(fim.getZ(vaga)).toBeGreaterThan(t); // saiu depois
    expect(fim.getW(vaga)).toBeGreaterThan(m.velocidade[i]!); // correndo mais que andava
    expect(Math.hypot(fuga.getZ(vaga), fuga.getW(vaga))).toBeCloseTo(1, 4); // a direção da corrida é unitária

    m.explodir(m.posX[i]!, 0.5, m.posZ[i]!, 5, 1000, t + 1);
    expect(fim.getX(vaga)).toBe(t + 1);
    d.atualizar(t + 1 + TICKS_DO_TOMBO - 1);
    expect(d.vagaDe(i)).toBe(vaga); // ainda caído na Praça
    d.atualizar(t + 1 + TICKS_DO_TOMBO);
    expect(d.vagaDe(i)).toBe(-1); // o corpo some e a vaga volta
    const aB = malha.geometry.getAttribute('aB') as THREE.InstancedBufferAttribute;
    expect(aB.getX(vaga)).toBe(NUNCA); // escondida até outro nascer nela
  });

  it('quem entra no meio da fase só desenha quem ainda está na Praça (os mortos e os que já saíram não ocupam vaga)', () => {
    const a = new Multidao(CONFIG);
    const AGORA = 16_000; // já houve gente que chegou, fugiu e saiu, e a explosão matou alguns
    for (let t = 0; t <= AGORA; t++) {
      a.avancar(t);
      if (t === 9000) a.explodir(40, 0.5, -20, 60, 1000, t);
    }
    expect(a.eliminados).toBeGreaterThan(0);
    expect(a.expulsos).toBeGreaterThan(0);
    const b = new Multidao({ ...CONFIG, autoridade: false });
    b.aplicarEstado(a.exportarEstado());
    b.avancar(AGORA, true);
    const d = new MultidaoDesenho(b);
    d.atualizar(AGORA);
    expect(d.presentes).toBe(b.presentes);
    // depois disso, segue igual à simulação que viu tudo
    ligar(b, d);
    for (let t = AGORA + 1; t <= AGORA + 4000; t++) {
      a.avancar(t);
      b.avancar(t);
      d.atualizar(t);
    }
    expect(d.presentes).toBe(b.presentes);
    expect(b.presentes).toBe(a.presentes);
  });

  it('as máscaras ligadas são o padrão', () => {
    expect(MASCARAS_LIGADAS).toEqual({ gado: true, careca: true, peruca: true });
  });
});
