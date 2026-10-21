import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MAPAS_ONLINE } from '../shared/net/mapa';
import { ArenaRoom } from './ArenaRoom';
import { formatarFumaca, fumacaDoServidor } from './fumaca';
import { startServer, type GameServer } from './Server';

/**
 * A fumaça do servidor (P239): o que um jogador anônimo vê ao bater na porta de cada mapa. Aqui contra um servidor de teste no próprio Vitest; contra o processo de verdade
 * (`scripts/server.mjs`), em `lancadorDoServidor.test.ts`.
 */
const GUARD = { perIp: 100, total: 200, msgs: 400, burst: 400 };

describe('a fumaça do servidor', () => {
  let server: GameServer;
  const base = () => `http://127.0.0.1:${server.port}`;
  beforeAll(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: GUARD });
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await server.close();
  });

  it('um servidor sadio passa: o mapa público abre, o restrito recusa o anônimo, e nada reiniciou', async () => {
    const r = await fumacaDoServidor({ base: base() });
    expect(r.problemas, formatarFumaca(r)).toEqual([]);
    expect(r.linhas.map((l) => l.mapa)).toEqual([...MAPAS_ONLINE]);
    // O padrão do catálogo: a Cidade Neon e a Praia são públicas; o Bunker, a Terras Raras e o 8 de Janeiro são restritos (`core/funcionalidades.ts`).
    const por = Object.fromEntries(r.linhas.map((l) => [l.mapa, `${l.esperado}/${l.obtido}`]));
    expect(por.arena).toBe('entra/entrou');
    expect(por.praia).toBe('entra/entrou');
    expect(por.janeiro).toBe('recusa/recusado');
    expect(r.ok, formatarFumaca(r)).toBe(true);
    expect(r.uptimeDepoisS).toBeGreaterThanOrEqual(r.uptimeAntesS ?? Infinity);
  }, 90_000);

  it('uma sala que não abre reprova só aquele mapa, com o motivo, e o resto segue verde', async () => {
    // Um servidor novo: a sala `TESTE-FUMACA@praia` do teste anterior ainda estaria em cache e o `create` com falha nem seria chamado.
    const outro = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: GUARD });
    const original = ArenaRoom.create.bind(ArenaRoom);
    vi.spyOn(ArenaRoom, 'create').mockImplementation((code, regras, mapa) => (mapa === 'praia' ? Promise.reject(new Error('o mapa não carregou')) : original(code, regras, mapa)));
    try {
      const r = await fumacaDoServidor({ base: `http://127.0.0.1:${outro.port}` });
      const praia = r.linhas.find((l) => l.mapa === 'praia');
      expect(praia?.ok).toBe(false);
      expect(praia?.obtido).toBe('recusado'); // a conexão cai (1011), não fica pendurada
      expect(r.linhas.filter((l) => l.mapa !== 'praia').every((l) => l.ok)).toBe(true);
      expect(r.ok).toBe(false);
      expect(formatarFumaca(r)).toContain('REPROVOU');
    } finally {
      vi.restoreAllMocks();
      await outro.close();
    }
  }, 90_000);

  it('servidor fora do ar: reprova com o motivo, sem lançar exceção', async () => {
    const r = await fumacaDoServidor({ base: 'http://127.0.0.1:1' });
    expect(r.ok).toBe(false);
    expect(r.linhas).toEqual([]);
    expect(r.problemas[0]).toContain('fora do ar');
  });

  it('as salas da fumaça são de teste: ficam fora do número de jogadores', async () => {
    await fumacaDoServidor({ base: base() });
    const s = (await (await fetch(`${base()}/status`)).json()) as { players: number };
    expect(s.players).toBe(0);
  }, 90_000);
});
