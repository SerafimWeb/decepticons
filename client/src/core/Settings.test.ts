import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BASE_SENSITIVITY,
  calibrateFromCounts,
  cmPer360,
  DEFAULT_SETTINGS,
  keyLabel,
  KEY_ACTIONS,
  LIMITS,
  MIN_CALIBRATION_COUNTS,
  sanitizeSettings,
  sensitivityForCm360,
  Settings,
} from './Settings';

function memoryStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('cybermech.settings.v1', initial);
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('Settings', () => {
  it('sem nada salvo, começa no padrão (dificuldade normal)', () => {
    const s = new Settings(memoryStorage());
    expect(s.value).toEqual(DEFAULT_SETTINGS);
    expect(s.value.difficulty).toBe('normal');
  });

  it('salva e recarrega entre sessões', () => {
    const storage = memoryStorage();
    new Settings(storage).update({ sensitivity: 1.5, invertY: true, keys: { ...DEFAULT_SETTINGS.keys, jump: 'KeyF' } });
    const again = new Settings(storage);
    expect(again.value.sensitivity).toBe(1.5);
    expect(again.value.invertY).toBe(true);
    expect(again.value.keys.jump).toBe('KeyF');
    expect(again.value.keys.forward).toBe('KeyW');
  });

  it('dado corrompido ou editado à mão vira valor válido, campo a campo', () => {
    const s = new Settings(memoryStorage('{"sensitivity": 999, "fovOffset": "x", "quality": "ultra", "volume": 2, "invertY": true, "keys": {"jump": "Escape", "dash": "ShiftRight", "left": "<script>"}}'));
    expect(s.value.sensitivity).toBe(LIMITS.sensitivity.max); // limitado ao máximo
    expect(s.value.fovOffset).toBe(0); // tipo errado → padrão
    expect(s.value.quality).toBe('auto'); // valor desconhecido → padrão
    expect(s.value.volume).toBe(LIMITS.volume.max); // volume limitado a 1
    expect(s.value.narracao).toBe('br'); // sem o campo → o padrão (narrador brasileiro)
    expect(new Settings(memoryStorage('{"narracao": "klingon"}')).value.narracao).toBe('br'); // sotaque que não existe → padrão
    expect(new Settings(memoryStorage('{"narracao": "ru"}')).value.narracao).toBe('ru'); // sotaque válido é mantido
    expect(new Settings(memoryStorage('{"narracao": "off"}')).value.narracao).toBe('off');
    expect(s.value.invertY).toBe(true); // campo válido é mantido
    expect(s.value.keys.jump).toBe('Space'); // tecla do sistema não pode
    expect(s.value.keys.dash).toBe('Shift'); // os dois Shifts valem
    expect(s.value.keys.left).toBe('KeyA'); // lixo → padrão
  });

  it('JSON quebrado e armazenamento que lança erro não derrubam o jogo', () => {
    expect(new Settings(memoryStorage('{quebrado')).value).toEqual(DEFAULT_SETTINGS);
    const hostile = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('cheio');
      },
    };
    const s = new Settings(hostile);
    s.update({ sensitivity: 2 });
    expect(s.value.sensitivity).toBe(2);
    expect(new Settings(null).value).toEqual(DEFAULT_SETTINGS);
  });

  it('avisa quem escuta (já na inscrição e a cada mudança) e volta ao padrão', () => {
    const s = new Settings(memoryStorage());
    const seen: number[] = [];
    const stop = s.onChange((v) => seen.push(v.fovOffset));
    s.update({ fovOffset: 10 });
    s.reset();
    stop();
    s.update({ fovOffset: 5 });
    expect(seen).toEqual([0, 10, 0]);
  });

  it('sanitize aceita qualquer coisa', () => {
    for (const junk of [null, undefined, 42, 'texto', [], { keys: 7 }]) {
      expect(sanitizeSettings(junk)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('opções do toque: ligadas por padrão, desligáveis e salvas', () => {
    const storage = memoryStorage();
    const s = new Settings(storage);
    expect(s.value.touchAimAssist).toBe(true);
    expect(s.value.touchAutoFire).toBe(true);
    s.update({ touchAutoFire: false });
    expect(new Settings(storage).value.touchAutoFire).toBe(false);
    expect(new Settings(memoryStorage('{"touchAimAssist": "sim"}')).value.touchAimAssist).toBe(true); // tipo errado → padrão
  });

  it('rótulo curto das teclas', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Space')).toBe('Espaço');
    expect(keyLabel('Digit3')).toBe('3');
  });

  it('DPI e entrada crua: válidos, limitados, e padrão seguro', () => {
    const s = new Settings(memoryStorage('{"mouseDpi": 999999, "rawInput": "sim"}'));
    expect(s.value.mouseDpi).toBe(LIMITS.mouseDpi.max);
    expect(s.value.rawInput).toBe(true);
    expect(sanitizeSettings({ mouseDpi: 1600.4 }).mouseDpi).toBe(1600);
  });
});

describe('calibração do mouse (contas físicas)', () => {
  it('padrão: ~25 cm por volta de 360° com 800 DPI (antes eram 9 cm)', () => {
    expect(cmPer360(1, 800)).toBeCloseTo(24.94, 1);
    expect(cmPer360(1, 1600)).toBeCloseTo(12.47, 1);
  });

  it('cm/360 ↔ sensibilidade vai e volta sem perder precisão', () => {
    for (const [cm, dpi] of [[25, 800], [40, 1600], [8, 400], [60, 3200]] as const) {
      expect(cmPer360(sensitivityForCm360(cm, dpi), dpi)).toBeCloseTo(cm, 6);
    }
  });

  it('gravar uma volta: os pontos medidos viram a sensibilidade exata', () => {
    const countsAtDefault = (2 * Math.PI) / BASE_SENSITIVITY; // uma volta com sensibilidade 1
    expect(calibrateFromCounts(countsAtDefault)).toEqual({ ok: true, sensitivity: 1 });
    expect(calibrateFromCounts(-countsAtDefault / 2).sensitivity).toBe(2); // mouse para a esquerda também vale
  });

  it('gravar uma volta: movimento curto demais é recusado; fora da faixa fica no limite', () => {
    expect(calibrateFromCounts(MIN_CALIBRATION_COUNTS - 1).ok).toBe(false);
    expect(calibrateFromCounts(Number.NaN).ok).toBe(false);
    expect(calibrateFromCounts(10_000_000)).toEqual({ ok: true, sensitivity: LIMITS.sensitivity.min });
    expect(calibrateFromCounts(MIN_CALIBRATION_COUNTS)).toEqual({ ok: true, sensitivity: LIMITS.sensitivity.max });
  });
});


it('migra o antigo E uma vez, preserva tecla personalizada e permite voltar a E', () => {
  const storage = memoryStorage(JSON.stringify({ keys: { shield: 'KeyE' } }));
  const s = new Settings(storage);
  expect(s.value.keys.shield).toBe('Control');
  s.update({ keys: { ...s.value.keys, shield: 'KeyE' } });
  expect(new Settings(storage).value.keys.shield).toBe('KeyE');
  expect(new Settings(memoryStorage(JSON.stringify({ keys: { shield: 'KeyF' } }))).value.keys.shield).toBe('KeyF');
  expect(new Settings(memoryStorage(JSON.stringify({ keys: { shield: 'KeyE', jump: 'Control' } }))).value.keys.shield).toBe('KeyE');
});

describe('nomes na tela (06/10: "quero poder mudar o nome dos inimigos, npcs, etc")', () => {
  it('sem nada salvo, os nomes são os de sempre (botNames.ts)', () => {
    const n = new Settings(memoryStorage()).value.names;
    expect(n.mechs).toEqual(['CLAWD', 'GEMINAI', 'CHAD-GPT']);
    expect(n.androids).toEqual(['KUEN', 'DIPSIK', 'MISTRAU']);
    expect(n.technicians).toEqual(['ENTRÓPICO']);
    expect(n.allies).toEqual(['ESCOLTA·PLASMA', 'SUPRESSOR·EMP']);
  });

  it('aceita nomes novos, corta em 16 caracteres e tira tags, aspas e quebras', () => {
    const s = sanitizeSettings({ names: { mechs: ['  NINJA   TURBO  ', '<img src=x>', 'a'.repeat(40)] } });
    expect(s.names.mechs[0]).toBe('NINJA TURBO');
    expect(s.names.mechs[1]).toBe('img src=x');
    expect(s.names.mechs[2]).toHaveLength(16);
    expect(s.names.mechs.every((n) => !/[<>&"'`]/.test(n))).toBe(true);
  });

  it('vazio, tipo errado ou ausente volta ao nome padrão daquele slot; slots a mais são ignorados', () => {
    const s = sanitizeSettings({ names: { mechs: ['   ', 42, 'X', 'EXTRA', 'EXTRA2'], androids: 'nope' } });
    expect(s.names.mechs).toEqual(['CLAWD', 'GEMINAI', 'X']);
    expect(s.names.androids).toEqual(['KUEN', 'DIPSIK', 'MISTRAU']);
  });

  it('trocar um nome pelo painel é salvo e volta na próxima visita', () => {
    const storage = memoryStorage();
    const st = new Settings(storage);
    st.update({ names: { ...st.value.names, technicians: ['DOUTOR'] } });
    expect(new Settings(storage).value.names.technicians).toEqual(['DOUTOR']);
    expect(new Settings(storage).value.names.mechs).toEqual(['CLAWD', 'GEMINAI', 'CHAD-GPT']);
  });
});

describe('mira e brilho (dono, 11/10: "a mira está grossa e os tiros geram muita luz")', () => {
  it('o padrão é discreto: mira menor que o desenho original, translúcida, e bloom abaixo dos 0,85 de antes', () => {
    expect(DEFAULT_SETTINGS.reticleSize).toBeLessThan(1);
    expect(DEFAULT_SETTINGS.reticleOpacity).toBeLessThan(1);
    expect(DEFAULT_SETTINGS.glow).toBeLessThan(0.85);
  });

  it('valor fora do limite ou do tipo errado vira o limite ou o padrão, campo a campo', () => {
    const s = new Settings(memoryStorage('{"reticleSize": 9, "reticleOpacity": 0, "glow": "x"}'));
    expect(s.value.reticleSize).toBe(LIMITS.reticleSize.max);
    expect(s.value.reticleOpacity).toBe(LIMITS.reticleOpacity.min); // a mira nunca some de vez
    expect(s.value.glow).toBe(DEFAULT_SETTINGS.glow);
  });

  it('o jogador consegue ficar com a mira mínima e o brilho mínimo, e isso é salvo', () => {
    const storage = memoryStorage();
    const st = new Settings(storage);
    st.update({ reticleSize: LIMITS.reticleSize.min, reticleOpacity: LIMITS.reticleOpacity.min, glow: LIMITS.glow.min });
    const volta = new Settings(storage).value;
    expect([volta.reticleSize, volta.reticleOpacity, volta.glow]).toEqual([LIMITS.reticleSize.min, LIMITS.reticleOpacity.min, LIMITS.glow.min]);
  });

  it('o CSS nasce com os mesmos números do padrão (antes de as configurações chegarem, a mira já é a discreta)', () => {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    expect(css).toContain(`--reticle-scale: ${DEFAULT_SETTINGS.reticleSize};`);
    expect(css).toContain(`--reticle-opacity: ${DEFAULT_SETTINGS.reticleOpacity};`);
  });
});

describe('Settings: o chat de voz (P205)', () => {
  it('o padrão: voz ligada, microfone sempre aberto, 80% de volume e a tecla T', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ voiceOn: true, voiceMode: 'sempre', voiceVolume: 0.8 });
    expect(DEFAULT_SETTINGS.keys.ptt).toBe('KeyT');
    expect(KEY_ACTIONS.map((k) => k.action)).toContain('ptt');
  });

  it('lixo volta ao padrão e o volume é limitado a 0 e 1; o que é válido é mantido', () => {
    const s = new Settings(memoryStorage('{"voiceOn": "sim", "voiceMode": "klingon", "voiceVolume": 9}')).value;
    expect(s.voiceOn).toBe(true);
    expect(s.voiceMode).toBe('sempre');
    expect(s.voiceVolume).toBe(LIMITS.voiceVolume.max);
    const bom = new Settings(memoryStorage('{"voiceOn": false, "voiceMode": "ptt", "voiceVolume": 0.25}')).value;
    expect([bom.voiceOn, bom.voiceMode, bom.voiceVolume]).toEqual([false, 'ptt', 0.25]);
    expect(new Settings(memoryStorage('{"voiceVolume": -3}')).value.voiceVolume).toBe(LIMITS.voiceVolume.min);
  });

  it('quem já tinha configurações salvas (sem os campos de voz) ganha o padrão, sem perder o resto', () => {
    const s = new Settings(memoryStorage('{"volume": 0.3, "keys": {"forward": "KeyI"}}')).value;
    expect(s.volume).toBe(0.3);
    expect(s.keys.forward).toBe('KeyI');
    expect(s.keys.ptt).toBe('KeyT');
    expect(s.voiceOn).toBe(true);
  });

  it('a tecla do chat pode ser trocada; as teclas do sistema não valem', () => {
    const storage = memoryStorage();
    const st = new Settings(storage);
    st.update({ keys: { ...st.value.keys, ptt: 'KeyG' } });
    expect(new Settings(storage).value.keys.ptt).toBe('KeyG');
    expect(new Settings(memoryStorage('{"keys": {"ptt": "Escape"}}')).value.keys.ptt).toBe('KeyT');
  });

  it('o jogador liga, desliga e troca o modo, e isso é salvo', () => {
    const storage = memoryStorage();
    const st = new Settings(storage);
    st.update({ voiceOn: false, voiceMode: 'ptt', voiceVolume: 0.4 });
    const volta = new Settings(storage).value;
    expect([volta.voiceOn, volta.voiceMode, volta.voiceVolume]).toEqual([false, 'ptt', 0.4]);
  });
});
