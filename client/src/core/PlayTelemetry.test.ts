import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSAO_HEADER } from '../../../shared/net/auth';
import { parsePlayReport, type PlayReport } from '../../../shared/net/playMetrics';
import { chaveDoToken } from '../net/sessao';
import { PlayTelemetry } from './PlayTelemetry';

/** O envio da rodada ao servidor (P185): o mapa, a onda e a vitória no corpo, e a sessão da conta no cabeçalho, só para o servidor dono dela. */
describe('PlayTelemetry: o que a rodada leva ao servidor', () => {
  const SERVIDOR = 'wss://jogo.exemplo.test';
  const BUILD = 'v2.vector09.plasma-0.rockets-0.-.frontal';
  let guardado: Map<string, string>;
  let fetchFalso: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    guardado = new Map();
    fetchFalso = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('window', { addEventListener: vi.fn(), setInterval: vi.fn() });
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
      removeItem: (k: string) => void guardado.delete(k),
    });
    vi.stubGlobal('fetch', fetchFalso);
  });
  afterEach(() => vi.unstubAllGlobals());

  const novo = (servidor = SERVIDOR) =>
    new PlayTelemetry(servidor, () => ({ mode: 'survival', online: false, build: BUILD, release: 'teste', map: 'amazonia' }));
  /** Joga uma rodada curta: alguns quadros, e o que o teste quiser antes de fechar. */
  const rodada = (t: PlayTelemetry, antes: (t: PlayTelemetry) => void = () => {}, fim: PlayReport['outcome'] = 'completed') => {
    for (let i = 0; i < 5; i++) t.frame(16);
    antes(t);
    t.finish(fim);
  };
  const enviado = async (n = 0): Promise<{ corpo: PlayReport; cabecalhos: Record<string, string> }> => {
    await vi.waitFor(() => expect(fetchFalso.mock.calls.length).toBeGreaterThan(n));
    const [, init] = fetchFalso.mock.calls[n]! as [string, { body: string; headers: Record<string, string> }];
    return { corpo: parsePlayReport(JSON.parse(init.body))!, cabecalhos: init.headers };
  };

  it('a rodada fechada leva o mapa, a onda mais alta e o desfecho, e o corpo passa pelo contrato do servidor', async () => {
    const t = novo();
    rodada(t, (x) => {
      x.onda(2);
      x.onda(5);
      x.onda(3); // a onda que fica é a mais alta que a rodada alcançou
      x.desfecho(true);
    });
    const { corpo } = await enviado();
    expect(corpo).toMatchObject({ map: 'amazonia', wave: 5, won: true, mode: 'survival' });
  });

  it('onda inválida é ignorada, e a rodada seguinte começa sem a onda nem o desfecho da anterior', async () => {
    const t = novo();
    rodada(t, (x) => {
      x.onda(NaN);
      x.onda(-1);
      x.onda(1000);
      x.onda(2.5);
    });
    const a = await enviado(0);
    expect('wave' in a.corpo).toBe(false);
    rodada(t, (x) => {
      x.onda(4);
      x.desfecho(false);
    });
    await enviado(1);
    rodada(t);
    const c = await enviado(2);
    expect('wave' in c.corpo || 'won' in c.corpo).toBe(false);
    expect((await enviado(1)).corpo).toMatchObject({ wave: 4, won: false });
  });

  it('com a sessão da conta guardada para este servidor, ela vai no cabeçalho; sem ela, só o content-type', async () => {
    guardado.set(chaveDoToken(SERVIDOR), 'token-do-piloto');
    rodada(novo());
    expect((await enviado()).cabecalhos[SESSAO_HEADER]).toBe('token-do-piloto');
    fetchFalso.mockClear();
    guardado.clear();
    rodada(novo());
    const { cabecalhos } = await enviado();
    expect(cabecalhos[SESSAO_HEADER]).toBeUndefined();
    expect(cabecalhos['content-type']).toBe('text/plain');
  });

  it('o token de OUTRO servidor nunca é enviado: um link com ?servidor= apontando para outro lugar não recebe a sessão guardada', async () => {
    guardado.set(chaveDoToken(SERVIDOR), 'token-do-piloto');
    rodada(novo('wss://outro.exemplo.test'));
    const { cabecalhos } = await enviado();
    expect(cabecalhos[SESSAO_HEADER]).toBeUndefined();
  });

  it('o armazenamento do navegador quebrado não derruba o envio: vai como convidado', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    });
    rodada(novo());
    const { cabecalhos } = await enviado();
    expect(cabecalhos[SESSAO_HEADER]).toBeUndefined();
  });
});
