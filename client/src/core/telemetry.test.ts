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

describe('Telemetry: o contexto da audiência (P188)', () => {
  it('o corpo leva o contexto em "o" quando há; sem contexto, o corpo é o de sempre', () => {
    const corpos: string[] = [];
    vi.stubGlobal('navigator', {
      sendBeacon: (_url: string, blob: Blob) => {
        void blob.text().then((t) => corpos.push(t));
        return true;
      },
    });
    const t = new Telemetry('wss://jogo.selvamkt.com.br');
    t.enviar('boot_ok', { canal: 'social', disp: 'mobile' });
    t.enviar('hangar_aberto');
    return new Promise<void>((ok) =>
      setTimeout(() => {
        vi.unstubAllGlobals();
        const [a, b] = corpos.map((c) => JSON.parse(c) as Record<string, unknown>);
        expect(a).toMatchObject({ nome: 'boot_ok', seq: 0, o: { canal: 'social', disp: 'mobile' } });
        expect(b).toMatchObject({ nome: 'hangar_aberto', seq: 1 });
        expect(b).not.toHaveProperty('o');
        ok();
      }, 50),
    );
  });
});
