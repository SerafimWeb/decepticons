import { describe, expect, it } from 'vitest';
import {
  BASE_SENSITIVITY,
  calibrateFromCounts,
  cmPer360,
  DEFAULT_SETTINGS,
  keyLabel,
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
