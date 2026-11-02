import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACEITE_ATUAL, CONTA_CRIAR_PATH, CONTA_PROGRESSO_PATH, SESSAO_HEADER, type ProgressoPiloto } from '../shared/net/auth';
import { startServer, type GameServer } from './Server';

const progresso = (over: Partial<ProgressoPiloto> = {}): ProgressoPiloto => ({ apelido: 'ANA', nivel: 4, xp: 120, creditos: 700, montagem: '', atualizadoEm: 1700000000000, ...over });

// P305: a cor do casco comprada não pode sumir da conta. Um navegador antigo (sem o campo) e a compra de outro aparelho
// entram na união; a conta nunca perde um bit.
describe('a cor do casco na conta: o servidor não apaga o que já foi comprado', () => {
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
  const ler = (token: string) => fetch(url(CONTA_PROGRESSO_PATH), { headers: { [SESSAO_HEADER]: token } });
  const gravar = (token: string, corpo: unknown) =>
    fetch(url(CONTA_PROGRESSO_PATH), { method: 'PUT', headers: { 'content-type': 'application/json', [SESSAO_HEADER]: token }, body: JSON.stringify(corpo) });

  it('a cor que chega é gravada e volta no GET', async () => {
    const token = await conta('cores1@x.com');
    expect((await gravar(token, progresso({ pinturas: 0b10 }))).status).toBe(200);
    const lido = (await (await ler(token)).json()) as { progresso: ProgressoPiloto };
    expect(lido.progresso.pinturas).toBe(0b10);
  });

  it('um navegador antigo, que não manda o campo, não apaga as cores que a conta já tinha', async () => {
    const token = await conta('cores2@x.com');
    await gravar(token, progresso({ pinturas: 0b100 }));
    const r = await gravar(token, progresso({ nivel: 9 })); // sem `pinturas`: o cliente antigo
    expect(r.status).toBe(200);
    const lido = (await (await ler(token)).json()) as { progresso: ProgressoPiloto };
    expect(lido.progresso.nivel).toBe(9);
    expect(lido.progresso.pinturas).toBe(0b100);
  });

  it('cores de dois aparelhos somam na conta, sem perder nenhuma', async () => {
    const token = await conta('cores3@x.com');
    await gravar(token, progresso({ pinturas: 0b001 }));
    await gravar(token, progresso({ pinturas: 0b100 }));
    const lido = (await (await ler(token)).json()) as { progresso: ProgressoPiloto };
    expect(lido.progresso.pinturas).toBe(0b101);
  });

  it('um valor fora do catálogo é recusado (400) e nada é gravado', async () => {
    const token = await conta('cores4@x.com');
    await gravar(token, progresso({ pinturas: 0b10 }));
    expect((await gravar(token, progresso({ pinturas: 2 ** 20 }))).status).toBe(400);
    const lido = (await (await ler(token)).json()) as { progresso: ProgressoPiloto };
    expect(lido.progresso.pinturas).toBe(0b10);
  });
});
