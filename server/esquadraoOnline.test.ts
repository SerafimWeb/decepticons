import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { ESQUADRAO_VERSAO, type BotSpec, type EsquadraoSpec } from '../client/src/sim/esquadrao';
import { ADMIN_ESQUADRAO_GRAVAR_PATH, ADMIN_ESQUADRAO_PATH, esquadraoDasRegras, LIMITES_ONLINE } from '../client/src/sim/esquadraoOnline';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION, ROOM_SIZE } from '../shared/net/constants';
import { ADMIN_HEADER } from '../shared/net/admin';
import { decodeRoster, encodeJoin, messageType, MSG, type RosterEntry } from '../shared/net/messages';
import { REGRAS_PADRAO } from '../shared/regras';
import { factorySpec, loadoutKey } from '../client/src/hangar/loadout';
import { ArenaRoom, type Peer } from './ArenaRoom';
import { ArmazemDoEsquadraoOnline, ESQUADRAO_ONLINE_ARQUIVO } from './esquadraoOnline';
import { startServer } from './Server';

const TOKEN = 'token-do-dono-so-para-o-teste-0123456789';
const GUARD = { perIp: 100, total: 200, msgs: 400, burst: 400 };
const pasta = resolve('.tmp', 'esquadrao-online-teste');
afterAll(() => rmSync(pasta, { recursive: true, force: true }));
const limpar = () => {
  rmSync(pasta, { recursive: true, force: true });
  mkdirSync(pasta, { recursive: true });
};

const esquadrao = (inimigos: BotSpec[], aliados: BotSpec[] = []): EsquadraoSpec => ({ v: ESQUADRAO_VERSAO, inimigos, aliados });
/** O esquadrão do dono do teste: um Marauder brabo com nome, um Vector-09 com nome, um andróide e o técnico. */
const DO_DONO = esquadrao([
  { papel: 'mech', nome: 'ALFA', chassi: 'marauder', persona: 'brabo', arma: { id: 'blaster', tier: 1 } },
  { papel: 'mech', nome: 'BETA' },
  { papel: 'android', nome: 'ROBO' },
  { papel: 'technician', nome: 'DOC' },
]);

class FakePeer implements Peer {
  readonly got: Uint8Array[] = [];
  send(bytes: Uint8Array): void {
    this.got.push(new Uint8Array(bytes));
  }
  close(): void {}
  roster(): RosterEntry[] {
    return decodeRoster(this.got.filter((b) => messageType(b) === MSG.ROSTER).at(-1)!)!;
  }
}
const w = new Writer();
const entrar = (name = 'DAN') => new Uint8Array(encodeJoin(w, { protocol: PROTOCOL_VERSION, name, build: loadoutKey(factorySpec('vector09')) }));
const bots = (p: FakePeer) => p.roster().filter((e) => e.kind !== 'human');

describe('o armazém do esquadrão das salas online (P270)', () => {
  it('começa sem esquadrão salvo (valem as regras); guarda no arquivo e um armazém novo lê o que o outro gravou', () => {
    limpar();
    const a = new ArmazemDoEsquadraoOnline(pasta);
    expect(a.atual()).toBeNull();
    expect(a.gravar({ esquadrao: DO_DONO })).toBe(true);
    expect(a.atual()?.inimigos.map((b) => b.nome)).toEqual(['ALFA', 'BETA', 'ROBO', 'DOC']);
    expect(new ArmazemDoEsquadraoOnline(pasta).atual()?.inimigos).toHaveLength(4);
    expect(new ArmazemDoEsquadraoOnline(null).atual()).toBeNull(); // sem pasta de dados, só a memória
  });

  it('o dono apaga o esquadrão (`null`) e voltam as regras; o apagado também é lembrado no reinício', () => {
    limpar();
    const a = new ArmazemDoEsquadraoOnline(pasta);
    a.gravar({ esquadrao: DO_DONO });
    expect(a.gravar({ esquadrao: null })).toBe(true);
    expect(a.atual()).toBeNull();
    expect(new ArmazemDoEsquadraoOnline(pasta).atual()).toBeNull();
  });

  it('o que não é um esquadrão (nem `null`) é recusado e nada muda; um esquadrão sem inimigos é válido (a sala só com gente)', () => {
    limpar();
    const a = new ArmazemDoEsquadraoOnline(pasta);
    a.gravar({ esquadrao: DO_DONO });
    for (const ruim of [null, 3, 'x', [], {}, { esquadrao: 'x' }, { esquadrao: { v: 9, inimigos: [] } }, { esquadrao: { v: ESQUADRAO_VERSAO, inimigos: 'x' } }]) {
      expect(a.gravar(ruim), JSON.stringify(ruim)).toBe(false);
    }
    expect(a.atual()?.inimigos).toHaveLength(4);
    expect(a.gravar({ esquadrao: esquadrao([]) })).toBe(true);
    expect(a.atual()?.inimigos).toEqual([]);
  });

  it('o que passa do teto da sala é cortado ao gravar (3 Mechs, 3 andróides, 1 técnico; sem aliados nem titãs)', () => {
    limpar();
    const a = new ArmazemDoEsquadraoOnline(pasta);
    const muito: BotSpec[] = [
      ...Array.from({ length: 6 }, (): BotSpec => ({ papel: 'mech' })), { papel: 'mech', chassi: 'colossus01' },
      ...Array.from({ length: 6 }, (): BotSpec => ({ papel: 'android' })), { papel: 'technician' }, { papel: 'technician' },
    ];
    a.gravar({ esquadrao: esquadrao(muito, [{ papel: 'mech' }]) });
    const guardado = a.atual()!;
    for (const [papel, max] of Object.entries(LIMITES_ONLINE)) expect(guardado.inimigos.filter((b) => b.papel === papel), papel).toHaveLength(max);
    expect(guardado.aliados).toEqual([]);
    expect(guardado.inimigos.some((b) => b.chassi === 'colossus01')).toBe(false);
  });

  it('arquivo estragado ou de outra época não derruba o servidor: vale como se não houvesse esquadrão salvo', () => {
    limpar();
    writeFileSync(resolve(pasta, ESQUADRAO_ONLINE_ARQUIVO), '{isto não é json');
    expect(new ArmazemDoEsquadraoOnline(pasta).atual()).toBeNull();
    writeFileSync(resolve(pasta, ESQUADRAO_ONLINE_ARQUIVO), JSON.stringify({ v: 77, inimigos: [] }));
    expect(new ArmazemDoEsquadraoOnline(pasta).atual()).toBeNull();
  });
});

describe('a sala monta o esquadrão do dono (P270)', () => {
  it('os outros jogadores veem cada robô com o nome, o chassi e a arma que o dono deu; quem manda nos Mechs em campo é o esquadrão (não as regras)', async () => {
    const sala = await ArenaRoom.create('SQUAD', { ...REGRAS_PADRAO, mechs: 1, androides: 0 }, 'arena', 'deathmatch', DO_DONO);
    try {
      const dan = new FakePeer();
      sala.receive(dan, entrar());
      const lista = bots(dan);
      const mechs = lista.filter((e) => e.kind === 'mech');
      expect(mechs).toHaveLength(2); // as regras diriam 1 Mech: o esquadrão tem 2
      expect(mechs[0]).toMatchObject({ name: 'ALFA·BRABO' });
      expect(mechs[0]!.build).toMatch(/^v1\.marauder\.blaster-1\./);
      expect(mechs[1]).toMatchObject({ name: 'BETA', build: loadoutKey(factorySpec('vector09')) });
      expect(lista.filter((e) => e.kind === 'android').map((e) => e.name)).toEqual(['ROBO']); // as regras diriam 0 andróides
      expect(lista.filter((e) => e.kind === 'technician').map((e) => e.name)).toEqual(['DOC']);
    } finally {
      sala.dispose();
    }
  });

  it('com gente entrando, os Mechs de IA cedem as vagas (a sala não passa de ROOM_SIZE) e o esquadrão volta inteiro quando eles saem', async () => {
    const sala = await ArenaRoom.create('SQUAD2', REGRAS_PADRAO, 'arena', 'deathmatch', DO_DONO);
    try {
      const gente = Array.from({ length: ROOM_SIZE - 1 }, () => new FakePeer());
      gente.forEach((p, i) => sala.receive(p, entrar(`P${i}`)));
      expect(bots(gente[0]!).filter((e) => e.kind === 'mech')).toHaveLength(1); // 7 humanos + 1 vaga: o segundo Mech do esquadrão fica na reserva
      sala.leave(gente[6]!);
      expect(bots(gente[0]!).filter((e) => e.kind === 'mech')).toHaveLength(2);
    } finally {
      sala.dispose();
    }
  });

  it('sem esquadrão (ou fora dos mapas do combate livre) os bots são os das regras, como sempre; o de fábrica segue com o Vector-09', async () => {
    const regras = { ...REGRAS_PADRAO, mechs: 2, androides: 2 };
    const sem = await ArenaRoom.create('SEMSQUAD', regras, 'arena', 'deathmatch', null);
    const bunker = await ArenaRoom.create('BUNKERSQUAD', regras, 'bunker', 'deathmatch', DO_DONO);
    try {
      for (const sala of [sem, bunker]) {
        const dan = new FakePeer();
        sala.receive(dan, entrar());
        const lista = bots(dan);
        expect(lista.some((e) => e.name.includes('ALFA')), sala.mapa).toBe(false);
        expect(lista.filter((e) => e.kind === 'mech'), sala.mapa).toHaveLength(2);
        expect(lista.filter((e) => e.kind === 'android'), sala.mapa).toHaveLength(2);
        expect(lista.filter((e) => e.kind === 'mech').every((e) => e.build === loadoutKey(factorySpec('vector09'))), sala.mapa).toBe(true);
      }
    } finally {
      sem.dispose();
      bunker.dispose();
    }
  });
});

describe('as rotas do dono para o esquadrão das salas online', () => {
  it('exigem a chave (401 sem ela); sem esquadrão salvo respondem o das regras; gravar corta ao teto, é lembrado no reinício e `null` volta às regras', async () => {
    limpar();
    const abrir = () => startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', dirDados: pasta, metricasToken: TOKEN, guard: GUARD });
    const s = await abrir();
    try {
      const base = `http://127.0.0.1:${s.port}`;
      const chamar = (caminho: string, token: string | null, corpo?: unknown) =>
        fetch(base + caminho, {
          method: corpo === undefined ? 'GET' : 'POST',
          headers: { ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { [ADMIN_HEADER]: token } : {}) },
          ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
        });
      expect((await chamar(ADMIN_ESQUADRAO_PATH, null)).status).toBe(401);
      expect((await chamar(ADMIN_ESQUADRAO_GRAVAR_PATH, null, { esquadrao: DO_DONO })).status).toBe(401);
      expect((await chamar(ADMIN_ESQUADRAO_PATH, 'chave-errada-0123456789-0123456789')).status).toBe(401);

      const inicial = await chamar(ADMIN_ESQUADRAO_PATH, TOKEN);
      expect(inicial.status).toBe(200);
      expect(await inicial.json()).toEqual({ salvo: false, esquadrao: esquadraoDasRegras(REGRAS_PADRAO) });

      expect((await chamar(ADMIN_ESQUADRAO_GRAVAR_PATH, TOKEN, { esquadrao: { v: 9 } })).status).toBe(400);
      expect((await chamar(ADMIN_ESQUADRAO_GRAVAR_PATH, TOKEN, {})).status).toBe(400);

      const muito = esquadrao([...Array.from({ length: 5 }, (_, i): BotSpec => ({ papel: 'mech', nome: `M${i}` }))], [{ papel: 'mech' }]);
      const gravou = await chamar(ADMIN_ESQUADRAO_GRAVAR_PATH, TOKEN, { esquadrao: muito });
      expect(gravou.status).toBe(200);
      const resposta = (await gravou.json()) as { salvo: boolean; esquadrao: EsquadraoSpec };
      expect(resposta.salvo).toBe(true);
      expect(resposta.esquadrao.inimigos.map((b) => b.nome)).toEqual(['M0', 'M1', 'M2']); // o teto da sala
      expect(resposta.esquadrao.aliados).toEqual([]);
      expect(JSON.parse(readFileSync(resolve(pasta, ESQUADRAO_ONLINE_ARQUIVO), 'utf8')).inimigos).toHaveLength(3); // o que vai ao disco já é o que vale

      await s.close();
      const s2 = await abrir(); // o reinício lembra
      try {
        const depois = await fetch(`http://127.0.0.1:${s2.port}${ADMIN_ESQUADRAO_PATH}`, { headers: { [ADMIN_HEADER]: TOKEN } });
        expect(((await depois.json()) as { salvo: boolean }).salvo).toBe(true);
        const apagou = await fetch(`http://127.0.0.1:${s2.port}${ADMIN_ESQUADRAO_GRAVAR_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json', [ADMIN_HEADER]: TOKEN }, body: JSON.stringify({ esquadrao: null }) });
        expect(await apagou.json()).toEqual({ salvo: false, esquadrao: esquadraoDasRegras(REGRAS_PADRAO) });
      } finally {
        await s2.close();
      }
    } finally {
      await s.close().catch(() => undefined);
    }
  });

  it('uma sala que abre DEPOIS de o dono gravar nasce com o esquadrão dele, de ponta a ponta pelo WebSocket', async () => {
    limpar();
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', dirDados: pasta, metricasToken: TOKEN, guard: GUARD });
    try {
      const gravou = await fetch(`http://127.0.0.1:${s.port}${ADMIN_ESQUADRAO_GRAVAR_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [ADMIN_HEADER]: TOKEN },
        body: JSON.stringify({ esquadrao: DO_DONO }),
      });
      expect(gravou.status).toBe(200);
      const ws = new WebSocket(`ws://127.0.0.1:${s.port}/?sala=DEPOIS`);
      ws.binaryType = 'arraybuffer';
      const got: Uint8Array[] = [];
      ws.onmessage = (e) => got.push(new Uint8Array(e.data as ArrayBuffer));
      await new Promise<void>((ok, erro) => {
        ws.onopen = () => ok();
        ws.onerror = () => erro(new Error('sem conexão'));
      });
      ws.send(entrar('Dan'));
      const t0 = Date.now();
      while (!got.some((b) => messageType(b) === MSG.ROSTER)) {
        if (Date.now() - t0 > 25_000) throw new Error('tempo esgotado');
        await new Promise((r) => setTimeout(r, 10));
      }
      const roster = decodeRoster(got.filter((b) => messageType(b) === MSG.ROSTER).at(-1)!)!;
      expect(roster.filter((e) => e.kind !== 'human').map((e) => e.name)).toEqual(['ALFA·BRABO', 'BETA', 'ROBO', 'DOC']);
      ws.close();
    } finally {
      await s.close();
    }
  });
});
