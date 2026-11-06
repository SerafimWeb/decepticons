import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import radio from '../client/src/audio/radio.json';
import predef from '../scripts/estudio/predefinidos-voz.json';
import { filtrosDeEfeitos, validarEfeitos, type Efeitos } from '../scripts/efeitosLib.mjs';
import { acharFfmpeg, capacidadesDoFfmpeg } from '../scripts/sonsRodar.mjs';

const ffmpeg = acharFfmpeg();
/** O JSON infere `compressor: string`; o motor exige o literal. A validação de verdade é a do `validarEfeitos` logo abaixo. */
const lista = predef.predefinidos as unknown as { nome: string; efeitos: Efeitos }[];

describe('os predefinidos de voz do Estúdio (P316)', () => {
  it('têm nome único e cada um passa na validação do motor de efeitos (nada fora de faixa chega à tela)', () => {
    expect(new Set(lista.map((p) => p.nome)).size).toBe(lista.length);
    for (const p of lista) {
      expect(validarEfeitos(p.efeitos, p.nome), p.nome).toEqual([]);
      expect(Object.keys(p.efeitos).length, p.nome).toBeGreaterThan(0);
      expect(filtrosDeEfeitos(p.efeitos).length, p.nome).toBeGreaterThan(0);
    }
  });

  it('todo canal do rádio sugere um tratamento que existe (o botão destacado é um botão de verdade)', () => {
    const nomes = new Set(lista.map((p) => p.nome));
    for (const [canal, m] of Object.entries(radio.canais)) expect(nomes.has(m.efeito), `${canal} -> ${m.efeito}`).toBe(true);
    expect(nomes.has('Locutor grave')).toBe(true); // o tratamento sugerido do narrador (modulo-vozes.mjs)
  });

  it('os tratamentos de máquina usam os efeitos novos (robô, bitcrush, fase), e o 8 bits é o mais esmagado', () => {
    const por = (n: string) => lista.find((p) => p.nome === n)!.efeitos;
    expect(por('Androide').robo_hz).toBeGreaterThan(0);
    expect(por('Robô retrô').robo_hz).toBeGreaterThan(0);
    expect(por('Talkbox').fase).toBeGreaterThan(0);
    expect(por('Interceptação').bitcrush).toBeGreaterThan(0);
    const crush = lista.map((p) => ({ nome: p.nome, b: p.efeitos.bitcrush ?? 0 })).sort((a, b) => b.b - a.b);
    expect(crush[0]!.nome).toBe('Chip 8-bit');
  });

  it.skipIf(!ffmpeg)('o ffmpeg desta máquina roda a cadeia de cada tratamento de verdade, sem erro', () => {
    const caps = capacidadesDoFfmpeg(ffmpeg!);
    for (const p of lista) {
      const af = filtrosDeEfeitos(p.efeitos, caps).join(',');
      const r = spawnSync(ffmpeg!, ['-hide_banner', '-nostats', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=0.6', '-af', af, '-f', 'null', '-'], { encoding: 'utf8' });
      expect(r.status, `${p.nome}: ${r.stderr}`).toBe(0);
    }
  });
});
