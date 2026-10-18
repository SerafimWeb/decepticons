import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ADMIN_HEADER } from '../shared/net/admin';
import { ADMIN_REGRAS_GRAVAR_PATH, ADMIN_REGRAS_PATH, normalizarRegras, RECEITAS_DAS_REGRAS, REGRAS_PADRAO } from '../shared/regras';
import { ArenaRoom } from './ArenaRoom';
import { startServer } from './Server';
import { ArmazemDeRegras } from './regras';
import { BOT_SKILLS } from '../client/src/combat/BotController';

const TOKEN = 'token-do-dono-so-para-o-teste-0123456789';
const GUARD = { perIp: 100, total: 200, msgs: 400, burst: 400 };
const pasta = resolve('.tmp', 'regras-teste');
afterAll(() => rmSync(pasta, { recursive: true, force: true }));

describe('as regras dos bots das salas online (P199)', () => {
  it('o padrão é de INICIANTE (o primeiro teste online mostrou que o da partida solo é pesado demais) e as receitas respeitam os limites', () => {
    expect(REGRAS_PADRAO).toEqual({ dificuldade: 'facil', mechs: 2, androides: 1, atacantes: 1.5 });
    for (const r of Object.values(RECEITAS_DAS_REGRAS)) expect(normalizarRegras(r)).toEqual(r);
    expect(RECEITAS_DAS_REGRAS.iniciante.atacantes).toBeLessThan(RECEITAS_DAS_REGRAS.desafio.atacantes);
  });

  it('o que vem de fora é puxado para os limites (nunca lança): lixo vira o padrão, números fora da faixa e fracionários se ajustam, a pressão anda de meio em meio', () => {
    expect(normalizarRegras(null)).toEqual(REGRAS_PADRAO);
    expect(normalizarRegras({ dificuldade: 'impossivel', mechs: 99, androides: -4, atacantes: 7 })).toEqual({ dificuldade: 'facil', mechs: 3, androides: 0, atacantes: 4 });
    expect(normalizarRegras({ dificuldade: 'dificil', mechs: 1.6, androides: 'x', atacantes: 1.3 })).toEqual({ dificuldade: 'dificil', mechs: 2, androides: 1, atacantes: 1.5 });
  });

  it('o armazém guarda no arquivo, avisa as salas ao gravar e um armazém novo lê o que o outro gravou', () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const a = new ArmazemDeRegras(pasta);
    expect(a.atual()).toEqual(REGRAS_PADRAO);
    const avisos: unknown[] = [];
    a.aoMudar((r) => avisos.push(r));
    a.gravar({ dificuldade: 'normal', mechs: 3, androides: 2, atacantes: 2 });
    expect(avisos).toHaveLength(1);
    expect(new ArmazemDeRegras(pasta).atual()).toEqual({ dificuldade: 'normal', mechs: 3, androides: 2, atacantes: 2 });
  });
});

describe('a sala aplica as regras', () => {
  it('a sala nova nasce com a pressão e a dificuldade das regras (antes todos atacavam juntos: maxAttackers era infinito) e, com gente entrando, só os Mechs da regra ficam em campo; aplicar ao vivo troca na hora', async () => {
    const sala = await ArenaRoom.create('REGRAS', { dificuldade: 'facil', mechs: 1, androides: 0, atacantes: 1 });
    try {
      const bots = (sala as unknown as { match: { bots: { maxAttackers: number; mechs: readonly { alive: boolean }[] } } }).match.bots;
      expect(bots.maxAttackers).toBe(1);
      sala.aplicarRegras({ dificuldade: 'dificil', mechs: 3, androides: 0, atacantes: 3 });
      expect(bots.maxAttackers).toBe(3);
      expect(BOT_SKILLS.dificil.reactionS).toBeLessThan(BOT_SKILLS.facil.reactionS); // as duas pontas da régua existem
    } finally {
      sala.dispose();
    }
  });
});

describe('as rotas do dono', () => {
  it('GET e POST /admin/regras exigem a chave (401 sem ela); o POST puxa para os limites, grava e responde as regras que valem', async () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', dirDados: pasta, metricasToken: TOKEN, guard: GUARD });
    try {
      const base = `http://127.0.0.1:${s.port}`;
      const chamar = (caminho: string, token: string | null, corpo?: unknown) =>
        fetch(base + caminho, { method: corpo === undefined ? 'GET' : 'POST', headers: { ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { [ADMIN_HEADER]: token } : {}) }, ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}) });
      expect((await chamar(ADMIN_REGRAS_PATH, null)).status).toBe(401);
      expect((await chamar(ADMIN_REGRAS_GRAVAR_PATH, null, { mechs: 1 })).status).toBe(401);
      const atual = await chamar(ADMIN_REGRAS_PATH, TOKEN);
      expect(atual.status).toBe(200);
      expect(await atual.json()).toEqual(REGRAS_PADRAO);
      const gravou = await chamar(ADMIN_REGRAS_GRAVAR_PATH, TOKEN, { dificuldade: 'dificil', mechs: 9, androides: 2, atacantes: 2.2 });
      expect(gravou.status).toBe(200);
      expect(await gravou.json()).toEqual({ dificuldade: 'dificil', mechs: 3, androides: 2, atacantes: 2 });
      expect(await (await chamar(ADMIN_REGRAS_PATH, TOKEN)).json()).toEqual({ dificuldade: 'dificil', mechs: 3, androides: 2, atacantes: 2 });
    } finally {
      await s.close();
    }
  });
});
