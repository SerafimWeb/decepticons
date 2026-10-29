import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { ACEITE_ATUAL, CONTA_APAGAR_PATH, CONTA_CRIAR_PATH, CONTA_DADOS_PATH, SESSAO_HEADER, type DadosDaConta } from '../shared/net/auth';
import { ADMIN_HEADER, ADMIN_PRESENCA_PATH, lerPresenca, type AdminPresenca } from '../shared/net/admin';
import { Writer } from '../shared/net/codec';
import { codificarCredencial } from '../shared/net/credencial';
import { PROTOCOL_VERSION } from '../shared/net/constants';
import { encodeJoin, messageType, MSG } from '../shared/net/messages';
import { factorySpec, loadoutKey } from '../client/src/hangar/loadout';
import { PRESENCA_ARQUIVO } from './presenca';
import { startServer, type GameServer } from './Server';

const DONO = 'token-do-dono-so-para-o-teste-0123456789';
const SENHA = 'senhasegura';
const GUARD = { perIp: 100, total: 200, msgs: 400, burst: 400 };
const w = new Writer(256);
const join_ = (nome: string) => new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name: nome, build: loadoutKey(factorySpec('vector09')) }));

async function ate(ok: () => boolean | Promise<boolean>, ms = 30_000): Promise<void> {
  const t0 = Date.now();
  while (!(await ok())) {
    if (Date.now() - t0 > ms) throw new Error('tempo esgotado');
    await new Promise((r) => setTimeout(r, 40));
  }
}

/** O diário de presença de ponta a ponta (P275): o jogador entra numa sala (convidado ou com a conta), o dono lê quem entrou, e apagar a conta apaga as visitas dela. */
describe('quem entrou nas salas, contra o servidor de verdade (P275)', () => {
  const pasta = resolve('.tmp', `teste-presenca-${process.pid}`);
  let server: GameServer;
  const url = (path: string) => `http://127.0.0.1:${server.port}${path}`;
  const abrir = () => startServer({ port: 0, host: '127.0.0.1', dbContas: resolve(pasta, 'contas.db'), dirDados: pasta, metricasToken: DONO, guard: GUARD, limiteLogin: { teto: 1000 } });
  const ler = async (chave: string | null = DONO) => {
    const r = await fetch(url(ADMIN_PRESENCA_PATH), { headers: chave ? { [ADMIN_HEADER]: chave } : {} });
    return { status: r.status, corpo: r.status === 200 ? lerPresenca(await r.json()) : null };
  };
  /** Entra numa sala; com `token`, manda a credencial da conta antes do JOIN (como o cliente logado faz). */
  const entrar = async (sala: string, nome: string, token?: string) => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/?sala=${sala}`);
    ws.binaryType = 'arraybuffer';
    let bemVindo = false;
    ws.on('message', (d: ArrayBuffer) => {
      if (messageType(new Uint8Array(d)) === MSG.WELCOME) bemVindo = true;
    });
    ws.on('error', () => undefined);
    await new Promise<void>((ok) => ws.on('open', () => ok()));
    if (token) ws.send(codificarCredencial(token));
    ws.send(join_(nome));
    await ate(() => bemVindo);
    return ws;
  };
  const visita = (p: AdminPresenca | null, apelido: string) => p?.visitas.find((v) => v.apelido === apelido);

  beforeAll(async () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    server = await abrir();
  });
  afterAll(async () => {
    await server.close();
    rmSync(pasta, { recursive: true, force: true });
  });

  it('só o dono lê: sem a chave, com a chave errada e pelo método errado a resposta é 401, 401 e 405', async () => {
    expect((await ler(null)).status).toBe(401);
    expect((await ler('chave-errada-0123456789-0123456789')).status).toBe(401);
    expect((await fetch(url(ADMIN_PRESENCA_PATH), { method: 'POST', headers: { [ADMIN_HEADER]: DONO } })).status).toBe(405);
  });

  it('o convidado aparece só com o apelido; quem está logado aparece com a conta (o número e o e-mail mascarado, nunca inteiro); um token falso é só convidado', async () => {
    const criada = await fetch(url(CONTA_CRIAR_PATH), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'piloto@x.com', senha: SENHA, aceite: ACEITE_ATUAL }) });
    const token = ((await criada.json()) as { token: string }).token;
    const convidado = await entrar('PRES', 'Convidado');
    const logado = await entrar('PRES', 'Logada', token);
    const falso = await entrar('PRES', 'Falso', 'token-que-nao-existe-0123456789');
    try {
      await ate(async () => (await ler()).corpo?.dentroAgora === 3);
      const { corpo } = await ler();
      expect(corpo?.retencaoDias).toBe(30);
      expect(visita(corpo, 'Convidado')).toMatchObject({ conta: null, sala: 'PRES', mapa: 'arena', saiuEm: null });
      expect(visita(corpo, 'Falso')?.conta).toBeNull();
      const conta = visita(corpo, 'Logada')?.conta;
      expect(conta?.rotulo).toBe('p***@x.com');
      expect(typeof conta?.id).toBe('number');
      expect(JSON.stringify(corpo)).not.toContain('piloto@x.com'); // o e-mail inteiro nunca sai
      expect(corpo!.visitas.map((v) => v.apelido)).toEqual(['Falso', 'Logada', 'Convidado']); // as mais novas primeiro
    } finally {
      for (const c of [convidado, logado, falso]) c.close();
    }
  });

  it('quem baixa os próprios dados (LGPD art. 18) recebe as entradas da própria conta, e só dela', async () => {
    const cria = async (email: string) => ((await (await fetch(url(CONTA_CRIAR_PATH), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha: SENHA, aceite: ACEITE_ATUAL }) })).json()) as { token: string }).token;
    const minha = await cria('dados@x.com');
    const outra = await cria('outra@x.com');
    const a = await entrar('DADOS', 'MinhaEntrada', minha);
    const b = await entrar('DADOS', 'EntradaAlheia', outra);
    try {
      await ate(async () => !!visita((await ler()).corpo, 'MinhaEntrada')?.conta && !!visita((await ler()).corpo, 'EntradaAlheia')?.conta);
      const r = await fetch(url(CONTA_DADOS_PATH), { headers: { [SESSAO_HEADER]: minha } });
      expect(r.status).toBe(200);
      const d = (await r.json()) as DadosDaConta;
      expect(d.entradasEmSalas.map((e) => e.apelido)).toEqual(['MinhaEntrada']);
      expect(d.entradasEmSalas[0]).toMatchObject({ sala: 'DADOS', mapa: 'arena', saiuEm: null });
      expect(JSON.stringify(d)).not.toContain('EntradaAlheia');
    } finally {
      a.close();
      b.close();
    }
  });

  it('a conexão que cai antes de a sala processar o JOIN (a sala nova ainda carrega) não deixa uma visita "na sala agora" para sempre', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/?sala=CORRIDA&mapa=praia`);
    ws.on('error', () => undefined);
    await new Promise<void>((ok) => ws.on('open', () => ok()));
    ws.send(join_('Corrida'));
    ws.terminate(); // JOIN e queda no mesmo instante: a sala da Estação dos Cabos ainda está sendo montada
    await ate(async () => server.rooms.has('CORRIDA@praia'));
    await new Promise((r) => setTimeout(r, 600)); // o JOIN e o fechamento passam pela fila da sala
    const { corpo } = await ler();
    const v = visita(corpo, 'Corrida');
    if (v) expect(v.saiuEm, 'a entrada, se nasceu, já tem a saída').not.toBeNull();
    expect(corpo?.dentroAgora).toBe(0);
  });

  it('quem sai ganha a hora de saída e deixa de contar como dentro', async () => {
    const ws = await entrar('SAIDA', 'Saindo');
    await ate(async () => visita((await ler()).corpo, 'Saindo')?.saiuEm === null);
    ws.close();
    await ate(async () => typeof visita((await ler()).corpo, 'Saindo')?.saiuEm === 'string');
    const v = visita((await ler()).corpo, 'Saindo')!;
    expect(new Date(v.saiuEm!).getTime()).toBeGreaterThanOrEqual(new Date(v.entrouEm).getTime());
  });

  it('apagar a conta apaga as visitas dela e só as dela: o convidado e as outras contas ficam', async () => {
    const cria = async (email: string) => ((await (await fetch(url(CONTA_CRIAR_PATH), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha: SENHA, aceite: ACEITE_ATUAL }) })).json()) as { token: string }).token;
    const sai = await cria('saira@x.com');
    const fica = await cria('fica@x.com');
    const a = await entrar('APAGA', 'ContaQueSai', sai);
    const b = await entrar('APAGA', 'ContaQueFica', fica);
    const c = await entrar('APAGA', 'ConvidadoFica');
    try {
      await ate(async () => !!visita((await ler()).corpo, 'ContaQueSai')?.conta && !!visita((await ler()).corpo, 'ContaQueFica')?.conta);
      const apagou = await fetch(url(CONTA_APAGAR_PATH), { method: 'POST', headers: { 'content-type': 'application/json', [SESSAO_HEADER]: sai }, body: JSON.stringify({ senha: SENHA }) });
      expect(apagou.status).toBe(200);
      const { corpo } = await ler();
      expect(visita(corpo, 'ContaQueSai')).toBeUndefined();
      expect(visita(corpo, 'ContaQueFica')?.conta?.rotulo).toBe('f***@x.com');
      expect(visita(corpo, 'ConvidadoFica')).toBeDefined();
    } finally {
      for (const ws of [a, b, c]) ws.close();
    }
  });

  it('o diário sobrevive ao reinício e fecha quem ainda estava dentro; o arquivo só leva apelido, conta (número), sala, mapa e horas', async () => {
    const ws = await entrar('REINICIO', 'Dentro');
    await ate(async () => visita((await ler()).corpo, 'Dentro')?.saiuEm === null);
    await server.close(); // o servidor cai com ele dentro
    ws.terminate();
    const arquivo = JSON.parse(readFileSync(resolve(pasta, PRESENCA_ARQUIVO), 'utf8')) as { visitas: Record<string, unknown>[] };
    const dentro = arquivo.visitas.find((v) => v.apelido === 'Dentro')!;
    expect(dentro.saiu).not.toBeNull(); // `close()` encerra o diário
    expect(Object.keys(dentro).sort()).toEqual(['apelido', 'conta', 'entrou', 'id', 'mapa', 'saiu', 'sala']);
    server = await abrir();
    const { corpo } = await ler();
    expect(visita(corpo, 'Dentro')?.saiuEm).not.toBeNull();
    expect(corpo?.dentroAgora).toBe(0);
  });
});
