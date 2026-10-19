import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import RAPIER from '@dimforge/rapier3d-simd-compat';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { ACEITE_ATUAL, CONTA_CRIAR_PATH, CONTA_DADOS_PATH, CONTA_ENTRAR_PATH, CONTA_EU_PATH, CONTA_NASCIMENTO_PATH, SESSAO_HEADER, type DadosDaConta } from '../shared/net/auth';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION } from '../shared/net/constants';
import { decodeWelcome, encodeJoin, messageType, MSG } from '../shared/net/messages';
import { METRICAS_HEADER, METRICAS_PATH } from '../shared/net/telemetry';
import { codificarPronto, codificarSinal, lerLista, lerSinal, VOZ } from '../shared/net/voz';
import type { EventoDeAuditoria } from './auditoria';
import { Contas } from './contas';
import { startServer, type GameServer } from './Server';

/**
 * A idade das contas e o chat de voz só para maiores de 18 anos (P211), de ponta a ponta contra o servidor de verdade: o cadastro pergunta o mês e o ano, o servidor guarda **uma vez**,
 * devolve só a faixa (nunca a data) e é ele quem decide a voz, pelo token da sessão no `PRONTO`.
 */
const SENHA = 'senhasegura';
const TOKEN_DONO = 'token-de-teste-com-mais-de-16';
const SDP = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\n';
const BUILD = 'v1.vector09.plasma-0.rockets-0';
const ano = new Date().getUTCFullYear();
const ADULTO = `${ano - 30}-01`;
const MENOR = `${ano - 10}-01`;

describe('Contas: o nascimento (P211)', () => {
  it('a conta nasce com ou sem nascimento; entrar e a sessão devolvem o que foi guardado', async () => {
    const contas = new Contas(':memory:');
    const c = await contas.criar('ana@x.com', SENHA, Date.now(), null, ADULTO);
    const d = await contas.criar('dan@x.com', SENHA);
    if (!c.ok || !d.ok) throw new Error('não criou');
    expect(c.conta.nascimento).toBe(ADULTO);
    expect(d.conta.nascimento).toBeNull();
    expect((await contas.autenticar('ana@x.com', SENHA))!.nascimento).toBe(ADULTO);
    expect((await contas.autenticar('dan@x.com', SENHA))!.nascimento).toBeNull();
    expect(contas.validarSessao(contas.criarSessao(c.conta.id, Date.now()))!.nascimento).toBe(ADULTO);
    expect(contas.validarSessao(contas.criarSessao(d.conta.id, Date.now()))!.nascimento).toBeNull();
  });

  it('informar vale uma vez só: a data não muda (conta de menor não vira adulta com um clique)', async () => {
    const contas = new Contas(':memory:');
    const r = await contas.criar('eva@x.com', SENHA);
    if (!r.ok) throw new Error('não criou');
    expect(contas.definirNascimento(r.conta.id, MENOR)).toBe(true);
    expect(contas.definirNascimento(r.conta.id, ADULTO)).toBe(false);
    expect(contas.validarSessao(contas.criarSessao(r.conta.id, Date.now()))!.nascimento).toBe(MENOR);
  });

  it('um banco de antes da idade ganha a coluna sozinho: as contas velhas seguem entrando, "sem idade", e a idade pode ser informada depois', async () => {
    const pasta = resolve('.tmp', `teste-migra-idade-${process.pid}`);
    mkdirSync(pasta, { recursive: true });
    const arquivo = resolve(pasta, 'velho.db');
    try {
      const velho = new DatabaseSync(arquivo);
      velho.exec('CREATE TABLE contas (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, hash TEXT NOT NULL, sal TEXT NOT NULL, criada_em TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0)');
      velho.close();
      const contas = new Contas(arquivo);
      const r = await contas.criar('antiga@x.com', SENHA);
      if (!r.ok) throw new Error('não criou');
      expect((await contas.autenticar('antiga@x.com', SENHA))!.nascimento).toBeNull();
      expect(contas.definirNascimento(r.conta.id, ADULTO)).toBe(true);
      contas.close();
      const reaberto = new Contas(arquivo);
      expect((await reaberto.autenticar('antiga@x.com', SENHA))!.nascimento, 'e fica guardado ao reabrir').toBe(ADULTO);
      reaberto.close();
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  it('é dado da conta: vai no arquivo de "baixar meus dados" e some junto quando a conta é apagada', async () => {
    const contas = new Contas(':memory:');
    const r = await contas.criar('ivo@x.com', SENHA, Date.now(), null, ADULTO);
    if (!r.ok) throw new Error('não criou');
    expect(contas.exportarDados(r.conta.id, Date.now())!.conta.nascimento).toBe(ADULTO);
    expect(contas.apagarConta(r.conta.id)).toBe(true);
    expect(contas.exportarDados(r.conta.id, Date.now()), 'apagada a conta, o nascimento vai junto').toBeNull();
    expect(await contas.autenticar('ivo@x.com', SENHA)).toBeNull();
  });
});

describe('a idade pelo HTTP e a voz só de maior de idade, pela rede de verdade (P211)', () => {
  const pasta = resolve('.tmp', `teste-idade-${process.pid}`);
  let server: GameServer;
  const url = (path: string) => `http://127.0.0.1:${server.port}${path}`;
  const json = { 'content-type': 'application/json' };
  const post = (path: string, corpo: unknown, sessao?: string) => fetch(url(path), { method: 'POST', headers: { ...json, ...(sessao ? { [SESSAO_HEADER]: sessao } : {}) }, body: JSON.stringify(corpo) });
  const criar = (email: string, nascimento?: unknown) => post(CONTA_CRIAR_PATH, { email, senha: SENHA, aceite: ACEITE_ATUAL, ...(nascimento === undefined ? {} : { nascimento }) });
  const token = async (email: string, nascimento?: string) => ((await (await criar(email, nascimento)).json()) as { token: string }).token;
  const w = new Writer();

  beforeAll(async () => {
    await RAPIER.init();
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    server = await startServer({
      port: 0,
      host: '127.0.0.1',
      dbContas: resolve(pasta, 'contas.db'),
      dirDados: pasta,
      metricasToken: TOKEN_DONO,
      guard: { perIp: 100, total: 200, msgs: 200, burst: 200 },
      limiteLogin: { teto: 1000 },
    });
  });
  afterAll(async () => {
    await server.close();
    rmSync(pasta, { recursive: true, force: true });
  });

  it('criar com o mês e o ano devolve só a faixa (adulto ou menor), nunca a data', async () => {
    const adulto = await criar('adulto@x.com', ADULTO);
    expect(adulto.status).toBe(201);
    const a = (await adulto.json()) as Record<string, unknown>;
    expect(a.idade).toBe('adulto');
    expect(JSON.stringify(a)).not.toContain(ADULTO);
    const menor = (await (await criar('menor@x.com', MENOR)).json()) as Record<string, unknown>;
    expect(menor.idade).toBe('menor');
    expect(JSON.stringify(menor)).not.toContain(MENOR);
  });

  it('criar sem nascimento (um cliente velho) cria a conta "sem idade"; com nascimento que não vale, recusa e não cria', async () => {
    const sem = await criar('sem@x.com');
    expect(sem.status).toBe(201);
    expect(((await sem.json()) as { idade: string }).idade).toBe('sem-idade');
    for (const ruim of ['hoje', '2020-13', `${ano + 1}-01`, `${ano - 130}-01`, 1990, '1990-1', '1990-01-15']) {
      const r = await criar(`ruim${String(ruim).replace(/\W/g, '')}@x.com`, ruim);
      expect(r.status, String(ruim)).toBe(400);
      expect(((await r.json()) as { codigo: string }).codigo).toBe('nascimento');
    }
    expect((await post(CONTA_ENTRAR_PATH, { email: 'ruim1990@x.com', senha: SENHA })).status, 'a conta recusada não foi criada').toBe(401);
  });

  it('entrar e a sessão (/conta/eu) devolvem a faixa de idade', async () => {
    const t = await token('volta@x.com', MENOR);
    const eu = (await (await fetch(url(CONTA_EU_PATH), { headers: { [SESSAO_HEADER]: t } })).json()) as { idade: string };
    expect(eu.idade).toBe('menor');
    const entrou = (await (await post(CONTA_ENTRAR_PATH, { email: 'volta@x.com', senha: SENHA })).json()) as { idade: string };
    expect(entrou.idade).toBe('menor');
  });

  it('POST /conta/nascimento: sem sessão 401, valor ruim 400, a primeira vez 200 com a faixa, a segunda 409 e a data não muda', async () => {
    expect((await post(CONTA_NASCIMENTO_PATH, { nascimento: ADULTO })).status).toBe(401);
    const t = await token('depois@x.com');
    expect((await post(CONTA_NASCIMENTO_PATH, { nascimento: 'ontem' }, t)).status).toBe(400);
    expect((await post(CONTA_NASCIMENTO_PATH, {}, t)).status).toBe(400);
    const ok = await post(CONTA_NASCIMENTO_PATH, { nascimento: MENOR }, t);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ idade: 'menor' });
    const de_novo = await post(CONTA_NASCIMENTO_PATH, { nascimento: ADULTO }, t);
    expect(de_novo.status).toBe(409);
    const eu = (await (await fetch(url(CONTA_EU_PATH), { headers: { [SESSAO_HEADER]: t } })).json()) as { idade: string };
    expect(eu.idade, 'continua menor').toBe('menor');
  });

  it('a data vai no arquivo de "baixar meus dados" e o informar fica na trilha de auditoria sem a data', async () => {
    const t = await token('trilha@x.com');
    await post(CONTA_NASCIMENTO_PATH, { nascimento: ADULTO }, t);
    const d = (await (await fetch(url(CONTA_DADOS_PATH), { headers: { [SESSAO_HEADER]: t } })).json()) as DadosDaConta;
    expect(d.conta.nascimento).toBe(ADULTO);
    const trilha = ((await (await fetch(url(METRICAS_PATH), { headers: { [METRICAS_HEADER]: TOKEN_DONO } })).json()) as { auditoria: EventoDeAuditoria[] }).auditoria;
    const evento = trilha.find((e) => e.acao === 'nascimento_informado');
    expect(evento, 'o evento ficou na trilha').toBeDefined();
    expect(JSON.stringify(trilha)).not.toContain(ADULTO);
  });

  function cliente(sala: string) {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/?sala=${sala}`);
    ws.binaryType = 'arraybuffer';
    const got: Uint8Array[] = [];
    ws.onmessage = (e) => got.push(new Uint8Array(e.data as ArrayBuffer));
    const aberto = new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('sem conexão'));
    });
    const de = (t: number) => got.filter((b) => messageType(b) === t);
    return { ws, got, aberto, de };
  }
  const ate = async (ok: () => boolean, ms = 20_000) => {
    const t0 = Date.now();
    while (!ok()) {
      if (Date.now() - t0 > ms) throw new Error('tempo esgotado');
      await new Promise((r) => setTimeout(r, 10));
    }
  };
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it('na sala de verdade: dois adultos conversam; menor, sem idade, convidado e sessão inventada não entram na voz nem trocam sinal com ninguém', async () => {
    const nomes = ['Ana', 'Beto', 'Menor', 'SemIdade', 'Convidado', 'Inventada'] as const;
    const tokens: Record<string, string> = {
      Ana: await token('ana-voz@x.com', ADULTO),
      Beto: await token('beto-voz@x.com', ADULTO),
      Menor: await token('menor-voz@x.com', MENOR),
      SemIdade: await token('semidade-voz@x.com'),
      Convidado: '',
      Inventada: 'token-que-nunca-existiu-no-servidor',
    };
    const c = Object.fromEntries(nomes.map((n) => [n, cliente('IDADEVOZ')])) as Record<(typeof nomes)[number], ReturnType<typeof cliente>>;
    await Promise.all(nomes.map((n) => c[n].aberto));
    for (const n of nomes) c[n].ws.send(new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name: n, build: BUILD })));
    await ate(() => nomes.every((n) => c[n].de(MSG.WELCOME).length > 0));
    const id = (n: (typeof nomes)[number]) => decodeWelcome(c[n].de(MSG.WELCOME)[0]!)!.id;

    for (const n of nomes) c[n].ws.send(codificarPronto(true, tokens[n]!));
    await ate(() => c.Ana.de(VOZ.LISTA).length > 0 && lerLista(c.Ana.de(VOZ.LISTA).at(-1)!)!.length === 2);
    expect(lerLista(c.Ana.de(VOZ.LISTA).at(-1)!)!.sort()).toEqual([id('Ana'), id('Beto')].sort());
    await espera(300);

    // O menor tenta falar com a Ana e a Ana com o menor: nada passa.
    c.Menor.ws.send(codificarSinal({ id: id('Ana'), tipo: 'oferta', sdp: SDP }));
    c.Ana.ws.send(codificarSinal({ id: id('Menor'), tipo: 'oferta', sdp: SDP }));
    // Já os dois adultos se falam.
    c.Ana.ws.send(codificarSinal({ id: id('Beto'), tipo: 'oferta', sdp: SDP }));
    await ate(() => c.Beto.de(VOZ.SINAL).length > 0);
    expect(lerSinal(c.Beto.de(VOZ.SINAL)[0]!)).toEqual({ id: id('Ana'), tipo: 'oferta', sdp: SDP });
    await espera(300);
    expect(c.Ana.de(VOZ.SINAL), 'a Ana não recebeu sinal do menor').toHaveLength(0);
    for (const n of ['Menor', 'SemIdade', 'Convidado', 'Inventada'] as const) {
      expect(c[n].de(VOZ.LISTA), `${n} não recebe a lista`).toHaveLength(0);
      expect(c[n].de(VOZ.SINAL), `${n} não recebe sinal`).toHaveLength(0);
    }
    for (const n of nomes) c[n].ws.close();
  });

  it('informar a idade na sala abre a voz: o PRONTO seguinte, com o mesmo token, passa a valer', async () => {
    const t = await token('tarde@x.com');
    const sozinho = cliente('IDADEVOZ2');
    await sozinho.aberto;
    sozinho.ws.send(new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name: 'Tarde', build: BUILD })));
    await ate(() => sozinho.de(MSG.WELCOME).length > 0);
    sozinho.ws.send(codificarPronto(true, t));
    await espera(300);
    expect(sozinho.de(VOZ.LISTA), 'sem idade informada: fora da voz').toHaveLength(0);
    expect((await post(CONTA_NASCIMENTO_PATH, { nascimento: ADULTO }, t)).status).toBe(200);
    sozinho.ws.send(codificarPronto(true, t));
    await ate(() => sozinho.de(VOZ.LISTA).length > 0);
    sozinho.ws.close();
  });
});
