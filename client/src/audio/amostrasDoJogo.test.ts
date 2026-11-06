import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (p: string): string => readFileSync(resolve(p), 'utf8');
const GAME = ler('client/src/core/Game.ts');
const AUDIO = ler('client/src/audio/AudioSystem.ts');

/** `this.audio.loadSample('nome', base + 'audio/arquivo.ext')` no Game: [nome, arquivo]. */
const CARREGADAS = [...GAME.matchAll(/loadSample\('([a-z_]+)',\s*base \+ 'audio\/([a-z_]+\.(?:mp3|wav))'\)/g)].map((m) => [m[1]!, m[2]!] as const);

/**
 * P318 (higiene): em 06/11 três amostras (`ambient_action`, `ui_bass`, `shot_heavy`: 475 KB) eram baixadas e decodificadas na abertura de TODA partida e nunca eram tocadas por
 * ninguém. Estas travas impedem a volta do desperdício: o que o jogo baixa na abertura precisa ser tocado, e o que está em `client/public/audio/` precisa ser baixado.
 */
describe('as amostras de áudio da abertura: nada se baixa sem se tocar', () => {
  it('o Game carrega as amostras avulsas (a trava só vale se o padrão foi encontrado)', () => {
    expect(CARREGADAS.length).toBeGreaterThanOrEqual(8);
  });

  it('toda amostra que o Game carrega na abertura é tocada por um playSample do AudioSystem', () => {
    for (const [nome] of CARREGADAS) expect(AUDIO, `${nome} é carregada e nunca tocada`).toContain(`playSample('${nome}'`);
  });

  it('todo arquivo de áudio avulso de client/public/audio é carregado pelo Game (nenhum arquivo morto no deploy), e vice-versa', () => {
    const avulsos = readdirSync(resolve('client/public/audio'), { withFileTypes: true })
      .filter((e) => e.isFile() && /\.(mp3|wav)$/.test(e.name))
      .map((e) => e.name)
      .sort();
    expect(avulsos).toEqual(CARREGADAS.map(([, arquivo]) => arquivo).sort());
  });
});
