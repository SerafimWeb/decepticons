import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACEITE_ATUAL, CONTA_CRIAR_PATH, CONTA_EU_PATH, CONTA_PROGRESSO_PATH, CONTA_SAIR_PATH, PROGRESSO_MAX_BYTES, SESSAO_HEADER, type ProgressoPiloto } from '../shared/net/auth';
import { startServer, type GameServer } from './Server';

const progresso = (over: Partial<ProgressoPiloto> = {}): ProgressoPiloto => ({ apelido: 'ANA', nivel: 4, xp: 120, creditos: 700, montagem: '{"chassis":"marauder"}', atualizadoEm: 1700000000000, ...over });

describe('progresso do piloto na conta: GET e PUT /conta/progresso', () => {
  let server: GameServer;
  const url = (path: string) => `http://127.0.0.1:${server.port}${path}`;
  beforeAll(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 100, total: 200, msgs: 200, burst: 200 }, limiteLogin: { teto: 1000 } });
  });
  afterAll(async () => {
    await server.close();
  });

  async function conta(email: string): Promise<string> {
    const r = await fetch(url(CONTA_CRIAR_PATH), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha: 'senhasegura', aceite: ACEITE_ATUAL }) });
    return ((await r.json()) as { token: string }).token;
  }
  const ler = (token?: string) => fetch(url(CONTA_PROGRESSO_PATH), { headers: token ? { [SESSAO_HEADER]: token } : {} });
  const gravar = (token: string | undefined, corpo: unknown) =>
    fetch(url(CONTA_PROGRESSO_PATH), { method: 'PUT', headers: { 'content-type': 'application/json', ...(token ? { [SESSAO_HEADER]: token } : {}) }, body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) });

  it('sem sessão (ou com token inventado): 401 no GET e no PUT, e nada é gravado', async () => {
    expect((await ler()).status).toBe(401);
    expect((await ler('inventado')).status).toBe(401);
    expect((await gravar(undefined, progresso())).status).toBe(401);
    expect((await gravar('inventado', progresso())).status).toBe(401);
  });

  it('conta nova ainda não guardou nada: GET devolve progresso nulo', async () => {
    const token = await conta('nova@x.com');
    const r = await ler(token);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ progresso: null });
  });

  it('PUT grava e GET devolve o mesmo; o último PUT vence (uma linha por conta)', async () => {
    const token = await conta('guarda@x.com');
    const a = await gravar(token, progresso());
    expect(a.status).toBe(200);
    expect(((await a.json()) as { progresso: ProgressoPiloto }).progresso).toEqual(progresso());
    expect(((await (await ler(token)).json()) as { progresso: ProgressoPiloto }).progresso).toEqual(progresso());
    await gravar(token, progresso({ nivel: 9, creditos: 1 }));
    const depois = ((await (await ler(token)).json()) as { progresso: ProgressoPiloto }).progresso;
    expect(depois).toMatchObject({ nivel: 9, creditos: 1 });
  });

  it('cada conta vê só o seu progresso', async () => {
    const a = await conta('a@x.com');
    const b = await conta('b@x.com');
    await gravar(a, progresso({ apelido: 'DA-A' }));
    expect(((await (await ler(b)).json()) as { progresso: unknown }).progresso).toBeNull();
    await gravar(b, progresso({ apelido: 'DO-B' }));
    expect(((await (await ler(a)).json()) as { progresso: ProgressoPiloto }).progresso.apelido).toBe('DA-A');
  });

  it('o apelido passa pelo filtro da sala online (sem sinais e marcação), e o campo a mais do cliente não é guardado', async () => {
    const token = await conta('filtro@x.com');
    const r = await gravar(token, { ...progresso({ apelido: '<b>Rex</b>' }), is_admin: true });
    const guardado = ((await r.json()) as { progresso: Record<string, unknown> }).progresso;
    expect(guardado.apelido).toBe('bRexb');
    expect(guardado.is_admin).toBeUndefined();
  });

  it('progresso fora do contrato: 400, e o que já estava guardado fica', async () => {
    const token = await conta('ruim@x.com');
    await gravar(token, progresso());
    for (const ruim of [progresso({ nivel: 0 }), progresso({ xp: 5000 }), progresso({ creditos: -5 }), { ...progresso(), montagem: 3 }, {}, '{{não é json', '[]']) {
      expect((await gravar(token, ruim)).status, JSON.stringify(ruim)).toBe(400);
    }
    expect(((await (await ler(token)).json()) as { progresso: ProgressoPiloto }).progresso).toEqual(progresso());
  });

  it('corpo acima do teto: 413', async () => {
    const token = await conta('grande@x.com');
    const r = await gravar(token, JSON.stringify({ ...progresso(), lixo: 'x'.repeat(PROGRESSO_MAX_BYTES) }));
    expect(r.status).toBe(413);
  });

  it('depois de sair, a sessão não grava nem lê mais', async () => {
    const token = await conta('sai@x.com');
    await fetch(url(CONTA_SAIR_PATH), { method: 'POST', headers: { [SESSAO_HEADER]: token } });
    expect((await ler(token)).status).toBe(401);
    expect((await gravar(token, progresso())).status).toBe(401);
  });

  it('preflight do CORS: o navegador de outra origem pergunta antes de mandar o cabeçalho da sessão (progresso e /conta/eu)', async () => {
    for (const [path, metodos] of [[CONTA_PROGRESSO_PATH, 'GET, PUT, OPTIONS'], [CONTA_EU_PATH, 'GET, OPTIONS']] as const) {
      const r = await fetch(url(path), { method: 'OPTIONS' });
      expect(r.status, path).toBe(204);
      expect(r.headers.get('access-control-allow-methods'), path).toBe(metodos);
      expect(r.headers.get('access-control-allow-headers'), path).toContain(SESSAO_HEADER);
    }
  });

  it('origem de fora da lista não chama a rota (como as outras de conta)', async () => {
    const token = await conta('origem@x.com');
    const r = await fetch(url(CONTA_PROGRESSO_PATH), { headers: { [SESSAO_HEADER]: token, origin: 'https://site-de-terceiro.example' } });
    expect(r.status).toBe(403);
  });
});
