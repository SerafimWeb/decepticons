import { describe, expect, it } from 'vitest';
import { WEAPON_IDS } from '../client/src/combat/weapons';
import { emWav, ESTILOS, nomeDoArquivo, normalizar, RECEITAS, renderizar, TAXA, bitcrush, distorcer, fade, somar, voz } from '../scripts/retroSynthLib.mjs';

/** Pico em dBFS. */
const picoDb = (x: Float32Array) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); return 20 * Math.log10(m); };
/** RMS em dBFS. */
const rmsDb = (x: Float32Array) => 10 * Math.log10(x.reduce((s, v) => s + v * v, 0) / x.length + 1e-12);
/** Frequência dominante de um trecho, pelo cruzamento do zero (basta para sons de uma nota só). */
function freqPorCruzamentos(x: Float32Array, deS: number, ateS: number): number {
  const a = Math.floor(deS * TAXA), b = Math.min(x.length, Math.floor(ateS * TAXA));
  let cruzamentos = 0;
  for (let i = a + 1; i < b; i++) if (x[i - 1]! <= 0 && x[i]! > 0) cruzamentos++;
  return cruzamentos / ((b - a) / TAXA);
}
const por = (id: string) => RECEITAS.find((r) => r.id === id)!;

describe('o kit de sons retrô (P316): a segurança de cada som', () => {
  it('as receitas têm id único, uso e referência, e cada arma citada existe no jogo', () => {
    expect(new Set(RECEITAS.map((r) => r.id)).size).toBe(RECEITAS.length);
    for (const r of RECEITAS) {
      expect(r.uso.length, r.id).toBeGreaterThan(2);
      expect(r.referencia.length, r.id).toBeGreaterThan(15);
      if (r.arma !== null) expect(WEAPON_IDS as readonly string[], r.id).toContain(r.arma);
    }
  });

  it('toda arma do jogo tem ao menos um candidato (quem acrescentar uma arma nova vê este teste lembrar do som dela)', () => {
    const cobertas = new Set(RECEITAS.map((r) => r.arma).filter(Boolean));
    const faltam = (WEAPON_IDS as readonly string[]).filter((id) => !cobertas.has(id));
    expect(faltam).toEqual([]);
  });

  it('cada som, nas duas leituras: finito, sem estourar, com o pico em −1 dBFS, nunca em silêncio, e com a duração certa (de 20 ms, o tique da rotatória, a 1,5 s)', () => {
    for (const r of RECEITAS) {
      for (const e of ESTILOS) {
        const x = renderizar(r, e);
        const quem = `${r.id}/${e}`;
        expect(x.every(Number.isFinite), `${quem}: NaN ou infinito`).toBe(true);
        expect(picoDb(x), quem).toBeLessThanOrEqual(-0.9);
        expect(picoDb(x), quem).toBeGreaterThanOrEqual(-1.1);
        expect(rmsDb(x), `${quem}: som quase mudo`).toBeGreaterThan(-45);
        expect(x.length / TAXA, quem).toBeGreaterThanOrEqual(0.02);
        expect(x.length / TAXA, quem).toBeLessThanOrEqual(r.longa ? 12 : 1.5);
        expect(x[0], `${quem}: clique no começo`).toBeCloseTo(0, 2);
        expect(Math.abs(x[x.length - 1]!), `${quem}: clique no fim`).toBeLessThan(0.01);
      }
    }
  });

  it('é determinístico: a mesma receita dá os mesmos bytes (nada de sorteio)', () => {
    for (const r of RECEITAS) for (const e of ESTILOS) expect(emWav(renderizar(r, e)).equals(emWav(renderizar(r, e))), `${r.id}/${e}`).toBe(true);
  });

  it('as duas leituras são sons diferentes (a leitura 8 bits não é uma cópia da rave) em todas as armas e em quase todo o resto', () => {
    const iguais = RECEITAS.filter((r) => emWav(renderizar(r, '8bit')).equals(emWav(renderizar(r, 'rave'))));
    // só os avisos e o laser puro (um tom) podem ser iguais nas duas leituras
    expect(iguais.map((r) => r.id).sort()).toEqual(['alerta_missil', 'aviso_calor', 'comms_abrir', 'comms_fechar', 'laser', 'radar_ping']);
    for (const r of RECEITAS.filter((x) => x.arma !== null && x.id !== 'laser')) expect(emWav(renderizar(r, '8bit')).equals(emWav(renderizar(r, 'rave'))), r.id).toBe(false);
  });

  it('um estilo desconhecido é recusado, e o nome do arquivo leva o prefixo RETRO_ que a lista do Estúdio mostra', () => {
    expect(() => renderizar(por('blaster'), 'jazz')).toThrow('estilo desconhecido');
    expect(nomeDoArquivo(por('blaster'), '8bit')).toBe('RETRO_blaster_8bit.wav');
    expect(RECEITAS.flatMap((r) => ESTILOS.map((e) => nomeDoArquivo(r, e))).every((n) => /^RETRO_[a-z0-9_]+_(8bit|rave)\.wav$/.test(n))).toBe(true);
  });
});

describe('o kit de sons retrô: cada receita faz o que diz', () => {
  it('o "pew" do blaster cai de frequência: o começo é bem mais agudo que o fim', () => {
    const x = renderizar(por('blaster'), '8bit');
    expect(freqPorCruzamentos(x, 0, 0.02)).toBeGreaterThan(freqPorCruzamentos(x, 0.1, 0.14) * 2);
  });

  it('o bumbo do canhão é grave: a energia está abaixo de 300 Hz (a frequência dominante do corpo)', () => {
    const x = renderizar(por('cannon'), 'rave');
    expect(freqPorCruzamentos(x, 0.05, 0.25)).toBeLessThan(300);
  });

  it('o canhão de cerco é mais longo e mais grave que o canhão', () => {
    const canhao = renderizar(por('cannon'), 'rave');
    const cerco = renderizar(por('siege'), 'rave');
    expect(cerco.length).toBeGreaterThan(canhao.length);
  });

  it('o bipe de abrir o rádio está em 2525 Hz e o de fechar em 2475 Hz (os tons dos rádios de voo), e os dois são curtos', () => {
    const abrir = renderizar(por('comms_abrir'), '8bit');
    const fechar = renderizar(por('comms_fechar'), '8bit');
    expect(freqPorCruzamentos(abrir, 0.01, 0.08)).toBeGreaterThan(2400);
    expect(freqPorCruzamentos(abrir, 0.01, 0.08)).toBeLessThan(2650);
    expect(freqPorCruzamentos(fechar, 0.01, 0.08)).toBeGreaterThan(2400);
    expect(freqPorCruzamentos(fechar, 0.01, 0.08)).toBeLessThan(2650);
    expect(abrir.length / TAXA).toBeLessThan(0.25);
  });

  it('o alerta de míssil tem três bipes e um tom longo (o bipe interrompido dos alarmes de radar): três silêncios entre eles', () => {
    const x = renderizar(por('alerta_missil'), '8bit');
    const janela = Math.round(0.01 * TAXA);
    const energia = (de: number) => { let s = 0; for (let i = Math.round(de * TAXA); i < Math.round(de * TAXA) + janela; i++) s += Math.abs(x[i]!); return s; };
    // meio dos silêncios: 0,12 s (entre o 1.º e o 2.º), 0,29 s, e o tom final começa em 0,55 s
    expect(energia(0.14)).toBeLessThan(energia(0.05) * 0.1);
    expect(energia(0.31)).toBeLessThan(energia(0.22) * 0.1);
    expect(energia(0.66)).toBeGreaterThan(energia(0.05) * 0.3);
  });

  it('a fanfarra da rodada toca em Lá menor: a nota mais grave do arpejo é o Lá (220 Hz)', () => {
    const x = renderizar(por('fanfarra_rodada'), '8bit');
    expect(freqPorCruzamentos(x, 0, 0.1)).toBeGreaterThan(200);
    expect(x.length / TAXA).toBeGreaterThan(0.9);
  });

  it('os dois temas de trilha têm exatamente quatro compassos a 108 BPM (≈ 8,9 s), para fechar o laço', () => {
    const quatroCompassos = (4 * 4 * 60) / 108;
    for (const id of ['tema_menu', 'tema_combate']) {
      expect(por(id).longa, id).toBe(true);
      for (const e of ESTILOS) {
        // exatamente quatro compassos (a um período de amostra): é o que faz o laço fechar sem emenda
        expect(renderizar(por(id), e).length, `${id}/${e}`).toBe(Math.round(quatroCompassos * TAXA));
      }
    }
    expect(RECEITAS.filter((r) => r.longa).map((r) => r.id)).toEqual(['tema_menu', 'tema_combate']); // só a trilha é longa
  });

  it('a chuva de mísseis tem seis baques em fila (seis ataques de energia), e o enxame, oito', () => {
    const picos = (x: Float32Array, passo: number, n: number) => Array.from({ length: n }, (_, i) => { let m = 0; for (let j = Math.round(i * passo * TAXA); j < Math.round((i * passo + 0.03) * TAXA); j++) m = Math.max(m, Math.abs(x[j]!)); return m; });
    expect(picos(renderizar(por('barrage'), '8bit'), 0.11, 6).every((p) => p > 0.1)).toBe(true);
    expect(picos(renderizar(por('swarm'), '8bit'), 0.045, 8).every((p) => p > 0.1)).toBe(true);
  });
});

describe('o kit de sons retrô: os blocos de construção', () => {
  it('bitcrush reduz a resolução: poucos níveis distintos; distorcer mantém o limite; fade zera as pontas; normalizar leva ao pico pedido', () => {
    const rampa = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 20));
    expect(new Set(bitcrush(rampa, 4, 1)).size).toBeLessThanOrEqual(17); // 4 bits = 16 degraus entre −1 e +1, ou seja, 17 níveis
    expect(Math.max(...distorcer(Float32Array.from([-9, 0, 9]), 4).map(Math.abs))).toBeLessThanOrEqual(1.0001);
    const f = fade(Float32Array.from({ length: 2000 }, () => 1), 1, 8);
    expect(f[0]).toBe(0);
    expect(f[f.length - 1]).toBe(0);
    expect(picoDb(normalizar(Float32Array.from([0.1, -0.2, 0.05]), -6))).toBeCloseTo(-6, 1);
    expect(normalizar(new Float32Array(10)).every((v) => v === 0)).toBe(true); // silêncio absoluto não vira NaN
  });

  it('somar põe cada camada no seu atraso e o resultado vai até a camada que termina por último; o WAV tem cabeçalho de 16 bits mono a 44,1 kHz', () => {
    const a = voz({ dur: 0.1, onda: 'sine', freq: 440 });
    const b = voz({ dur: 0.1, onda: 'sine', freq: 880 });
    const m = somar([{ x: a }, { x: b, atraso: 0.2 }]);
    expect(m.length).toBe(Math.round(0.2 * TAXA) + b.length);
    expect(m[Math.round(0.15 * TAXA)]).toBe(0);
    const w = emWav(a);
    expect(w.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(w.readUInt32LE(24)).toBe(44100);
    expect(w.readUInt16LE(22)).toBe(1);
    expect(w.readUInt16LE(34)).toBe(16);
    expect(w.length).toBe(44 + a.length * 2);
  });
});
