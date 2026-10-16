import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { argsDaMedicao, argsDoFfmpeg, ganhoParaAlvo, lerMedicao, validarArmas, validarMapa, type MapaDeSons } from '../scripts/sonsLib.mjs';

const MAPA = JSON.parse(readFileSync(resolve('scripts/sons-armas.json'), 'utf8')) as MapaDeSons;
const ALVO = MAPA.alvo;
const um = (parcial: Partial<MapaDeSons['sons'][number]>): MapaDeSons => ({ alvo: ALVO, sons: [{ destino: 'arma_x.mp3', fonte: 'x.mp3', de: 0, ate: 1, fade_ms: 100, ...parcial }] });

describe('preparador de sons de arma (P146): o mapa', () => {
  it('o mapa de verdade é válido', () => {
    expect(validarMapa(MAPA)).toEqual([]);
    expect(MAPA.sons.length).toBeGreaterThanOrEqual(6);
  });

  it('recusa destino repetido, fora do padrão, sem fonte, corte inválido ou longo demais, e fade maior que metade do corte', () => {
    expect(validarMapa({ alvo: ALVO, sons: [um({}).sons[0]!, um({}).sons[0]!] }).join()).toContain('destino repetido');
    expect(validarMapa(um({ destino: 'qualquer.mp3' })).join()).toContain('arma_<nome>.mp3');
    expect(validarMapa(um({ destino: 'arma_x.wav' })).join()).toContain('arma_<nome>.mp3');
    expect(validarMapa(um({ fonte: '' })).join()).toContain('só o nome de um arquivo');
    expect(validarMapa(um({ fonte: '../../segredo.mp3' })).join()).toContain('só o nome de um arquivo');
    expect(validarMapa(um({ fonte: 'a/b.mp3' })).join()).toContain('só o nome de um arquivo');
    expect(validarMapa(um({ ganho_db: 30 })).join()).toContain('ganho extra');
    expect(validarMapa(um({ ganho_db: -30 })).join()).toContain('ganho extra');
    expect(validarMapa(um({ ganho_db: 3 }))).toEqual([]);
    expect(validarMapa(um({ de: 1, ate: 1 })).join()).toContain('corte inválido');
    expect(validarMapa(um({ de: -1, ate: 1 })).join()).toContain('corte inválido');
    expect(validarMapa(um({ de: 0, ate: 9 })).join()).toContain('mais de 4 s');
    expect(validarMapa(um({ de: 0, ate: 1, fade_ms: 600 })).join()).toContain('fade');
  });

  it('recusa alvo de nível impossível', () => {
    expect(validarMapa({ ...um({}), alvo: { media_db: -5, pico_db: -10 } }).join()).toContain('média tem de ser menor');
    expect(validarMapa({ ...um({}), alvo: { media_db: -18, pico_db: 2 } }).join()).toContain('0 dBFS');
    expect(validarMapa({ ...um({}), alvo: { media_db: -50, pico_db: -1 } }).join()).toContain('-40');
  });
});

describe('preparador de sons de arma: a conta do ganho e a linha do ffmpeg', () => {
  it('leva a média ao alvo quando o pico deixa; senão sobe só até o pico caber', () => {
    expect(ganhoParaAlvo(-12.4, 0, ALVO)).toBeCloseTo(-5.6, 5); // som quente: baixa
    expect(ganhoParaAlvo(-30, -12, ALVO)).toBeCloseTo(11, 5); // fraco, mas o pico tem folga: sobe até a média
    expect(ganhoParaAlvo(-30, -3, ALVO)).toBeCloseTo(2, 5); // fraco E com pico alto: sobe só 2 dB (o pico manda)
  });

  it('o ganho nunca deixa o pico passar do teto', () => {
    for (const [media, pico] of [[-12, 0], [-30, -3], [-25, -20], [-8, -0.5]] as const) {
      expect(pico + ganhoParaAlvo(media, pico, ALVO)).toBeLessThanOrEqual(ALVO.pico_db + 1e-9);
    }
  });

  it('a linha do ffmpeg corta o trecho, aplica o ganho, faz fade nas duas pontas, limita o pico e sai mono em mp3', () => {
    const s = { destino: 'arma_x.mp3', fonte: 'x.mp3', de: 0.85, ate: 2.25, fade_ms: 300 };
    const a = argsDoFfmpeg(s, 'entrada.mp3', 'saida.mp3', -10.3, ALVO);
    const filtro = a[a.indexOf('-af') + 1]!;
    expect(filtro).toContain('atrim=start=0.85:end=2.25');
    expect(filtro).toContain('volume=-10.30dB');
    expect(filtro).toContain('afade=t=in:st=0:d=0.003');
    expect(filtro).toContain('afade=t=out:st=1.100:d=0.300'); // 1,4 s de corte − 0,3 s de fade
    expect(filtro).toContain('alimiter=limit=0.891'); // −1 dBFS
    expect(a).toContain('-ac');
    expect(a[a.indexOf('-ac') + 1]).toBe('1');
    expect(a).toContain('libmp3lame');
    expect(a[a.length - 1]).toBe('saida.mp3');
  });

  it('a medição olha só o trecho cortado, e lê pico e média do texto do volumedetect', () => {
    const m = argsDaMedicao({ destino: 'arma_x.mp3', fonte: 'x.mp3', de: 0.85, ate: 2.25, fade_ms: 300 }, 'entrada.mp3');
    expect(m.join(' ')).toContain('atrim=start=0.85:end=2.25');
    expect(lerMedicao('[Parsed_volumedetect_0] mean_volume: -12.8 dB\n[Parsed_volumedetect_0] max_volume: -0.5 dB')).toEqual({ picoDb: -0.5, mediaDb: -12.8 });
    expect(lerMedicao('nada útil')).toBeNull();
  });
});

describe('preparador de sons de arma: a tabela de armas', () => {
  const IDS = ['blaster', 'plasma', 'cannon'];
  const CLIPES = ['arma_a', 'arma_b'];
  const ok = { clipe: 'arma_a', ganho: 0.8, pitch: 1, maxS: 0.5 };

  it('aceita uma tabela coerente (e vazia)', () => {
    expect(validarArmas({ blaster: ok, cannon: { ...ok, clipe: 'arma_b', pitch: 0.8, maxS: 1 } }, IDS, CLIPES, () => 1)).toEqual([]);
    expect(validarArmas({}, IDS, CLIPES)).toEqual([]);
  });

  it('recusa arma desconhecida, clipe que não existe e valores fora da faixa', () => {
    expect(validarArmas({ foguete_x: ok }, IDS, CLIPES).join()).toContain('o jogo não conhece');
    expect(validarArmas({ blaster: { ...ok, clipe: 'arma_z' } }, IDS, CLIPES).join()).toContain('não existe no mapa');
    expect(validarArmas({ blaster: { ...ok, ganho: 0 } }, IDS, CLIPES).join()).toContain('ganho');
    expect(validarArmas({ blaster: { ...ok, ganho: 2 } }, IDS, CLIPES).join()).toContain('ganho');
    expect(validarArmas({ blaster: { ...ok, pitch: 0.3 } }, IDS, CLIPES).join()).toContain('pitch');
    expect(validarArmas({ blaster: { ...ok, pitch: 3 } }, IDS, CLIPES).join()).toContain('pitch');
    expect(validarArmas({ blaster: { ...ok, maxS: 0.01 } }, IDS, CLIPES).join()).toContain('duração máxima');
    expect(validarArmas({ blaster: { ...ok, maxS: 9 } }, IDS, CLIPES).join()).toContain('duração máxima');
  });

  it('a duração máxima não pode passar do que o clipe dura na altura dada (senão o fade do fim nunca é ouvido)', () => {
    expect(validarArmas({ blaster: { ...ok, maxS: 1.2 } }, IDS, CLIPES, () => 1).join()).toContain('passa do que o clipe dura');
    expect(validarArmas({ blaster: { ...ok, pitch: 0.5, maxS: 1.9 } }, IDS, CLIPES, () => 1)).toEqual([]); // grave: 1 s vira 2 s
    expect(validarArmas({ blaster: { ...ok, pitch: 0.5, maxS: 2.2 } }, IDS, CLIPES, () => 1).join()).toContain('passa do que o clipe dura');
  });
});
