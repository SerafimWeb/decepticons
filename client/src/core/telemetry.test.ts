import { describe, expect, it, vi } from 'vitest';
import { Telemetry } from './telemetry';

describe('Telemetry (emissor de métricas)', () => {
  it('sem servidor, não manda nada e não lança', () => {
    const t = new Telemetry(undefined);
    expect(() => t.enviar('boot_ok')).not.toThrow();
  });

  it('endereço inválido é o mesmo que não ter servidor', () => {
    const t = new Telemetry('jogo.selvamkt.com.br');
    expect(() => t.enviar('boot_ok')).not.toThrow();
  });

  it('com servidor, usa sendBeacon quando existe', () => {
    const beacon = vi.fn((_url: string, _data?: BodyInit) => true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    const t = new Telemetry('wss://jogo.selvamkt.com.br');
    t.enviar('click_cockpit');
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0]!;
    expect(url).toBe('https://jogo.selvamkt.com.br/evento');
    expect(blob).toBeInstanceOf(Blob);
    vi.unstubAllGlobals();
  });

  it('cada instância sorteia um id de aba diferente (não é fixo nem sequencial)', () => {
    const a = new Telemetry('wss://jogo.selvamkt.com.br');
    const b = new Telemetry('wss://jogo.selvamkt.com.br');
    expect(a['aba']).not.toBe(b['aba']);
  });
});
