import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, keyLabel, sanitizeSettings, Settings } from './Settings';

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
    const s = new Settings(memoryStorage('{"sensitivity": 999, "fovOffset": "x", "quality": "ultra", "invertY": true, "keys": {"jump": "Escape", "dash": "ShiftRight", "left": "<script>"}}'));
    expect(s.value.sensitivity).toBe(3); // limitado ao máximo
    expect(s.value.fovOffset).toBe(0); // tipo errado → padrão
    expect(s.value.quality).toBe('auto'); // valor desconhecido → padrão
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

  it('rótulo curto das teclas', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Space')).toBe('Espaço');
    expect(keyLabel('Digit3')).toBe('3');
  });
});
