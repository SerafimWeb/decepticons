import { createVerify, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { METRICAS_HEADER, METRICAS_PATH } from '../shared/net/telemetry';
import { detalheSeguro, GA_CHAVE_ARQUIVO, GA_MEDICAO_ID, GA_ERRO_TTL_MS, GA_PROPRIEDADE_ARQUIVO, GA_TTL_MS, GoogleAnalytics, type GaEstado } from './analytics';
import { startServer } from './Server';

/** O Analytics no `/metricas` (P207): o JWT assinado de verdade, o cache, os erros sem segredo e o servidor que nunca espera o Google. */
const raiz = resolve('.tmp', `teste-analytics-${process.pid}`);
afterAll(() => rmSync(raiz, { recursive: true, force: true }));
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const EMAIL = 'analytics-teste@projeto.iam.gserviceaccount.com';
const PROPRIEDADE = '412345678';

function pasta(nome: string, o: { chave?: boolean | 'ruim'; propriedade?: string } = {}): string {
  const dir = resolve(raiz, nome);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (o.chave !== false) writeFileSync(resolve(dir, GA_CHAVE_ARQUIVO), o.chave === 'ruim' ? '{ torto' : JSON.stringify({ type: 'service_account', client_email: EMAIL, private_key: PEM, client_id: '1' }));
  if (o.propriedade) writeFileSync(resolve(dir, GA_PROPRIEDADE_ARQUIVO), `${o.propriedade}\n`);
  return dir;
}

const linha = (d: string[], m: (string | number)[]) => ({ dimensionValues: d.map((value) => ({ value })), metricValues: m.map((value) => ({ value: String(value) })) });
const RELATORIOS = {
  reports: [
    { rows: [linha([], [120, 80, 150, 90, 187.4, 600])] },
    { rows: [linha(['20261016'], [30, 40]), linha(['20261017'], [50, 60])] },
    { rows: [linha(['Direct'], [90, 70]), linha(['Organic Social'], [60, 50])] },
    { rows: [linha(['BR'], [100]), linha(['us'], [15]), linha(['??lixo'], [5])] },
    { rows: [linha(['mobile'], [70]), linha(['desktop'], [50])] },
  ],
};

/** Um Google de mentira: confere o JWT com a chave pública e responde os relatórios combinados. */
function google(o: { agora?: () => number; tokenStatus?: number; dataStatus?: number; realtimeFalha?: boolean; admin?: unknown; fluxos?: Record<string, string[]>; demoraMs?: number; relatorios?: unknown } = {}) {
  const chamadas: { url: string; corpo: string }[] = [];
  const jwts: { cab: Record<string, unknown>; payload: Record<string, unknown>; assinaturaOk: boolean }[] = [];
  const http = (async (url: string, init: RequestInit = {}) => {
    try {
      return await atender(url, init);
    } catch (e) {
      return new Response(JSON.stringify({ error: { status: 'FALSO', message: String(e) } }), { status: 599 });
    }
  }) as unknown as typeof fetch;
  const atender = async (url: string, init: RequestInit): Promise<Response> => {
    const corpo = init.body instanceof URLSearchParams ? init.body.toString() : String(init.body ?? '');
    chamadas.push({ url, corpo });
    if (o.demoraMs) await new Promise((r) => setTimeout(r, o.demoraMs));
    const json = (status: number, dado: unknown) => new Response(JSON.stringify(dado), { status, headers: { 'content-type': 'application/json' } });
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      if (o.tokenStatus && o.tokenStatus !== 200) return json(o.tokenStatus, { error: 'invalid_grant', error_description: `Invalid JWT Signature ${'A'.repeat(80)}` });
      const jwt = new URLSearchParams(corpo).get('assertion')!;
      const [cab, payload, assinatura] = jwt.split('.');
      const ok = createVerify('RSA-SHA256').update(`${cab}.${payload}`).verify(publicKey, Buffer.from(assinatura!, 'base64url'));
      jwts.push({ cab: JSON.parse(Buffer.from(cab!, 'base64url').toString()), payload: JSON.parse(Buffer.from(payload!, 'base64url').toString()), assinaturaOk: ok });
      return json(200, { access_token: 'token-de-teste', expires_in: 3600 });
    }
    if (url.includes('/dataStreams')) {
      const id = /properties\/(\d+)\/dataStreams/.exec(url)![1]!;
      const medicoes = (o.fluxos ?? { [PROPRIEDADE]: [GA_MEDICAO_ID] })[id] ?? [];
      return json(200, { dataStreams: [{ type: 'ANDROID_APP_DATA_STREAM', displayName: 'app' }, ...medicoes.map((measurementId) => ({ type: 'WEB_DATA_STREAM', webStreamData: { measurementId } }))] });
    }
    if (url.includes('accountSummaries')) return json(200, o.admin ?? { accountSummaries: [{ propertySummaries: [{ property: `properties/${PROPRIEDADE}` }] }] });
    if (url.endsWith(':runRealtimeReport')) return o.realtimeFalha ? json(500, {}) : json(200, { rows: [linha([], [3])] });
    if (url.endsWith(':batchRunReports')) {
      if (o.dataStatus && o.dataStatus !== 200) return json(o.dataStatus, { error: { status: o.dataStatus === 429 ? 'RESOURCE_EXHAUSTED' : 'PERMISSION_DENIED', message: 'The caller does not have permission' } });
      return json(200, o.relatorios ?? RELATORIOS);
    }
    return json(404, {});
  };
  return { http, chamadas, jwts, doTipo: (sufixo: string) => chamadas.filter((c) => c.url.includes(sufixo)).length };
}

describe('GoogleAnalytics: o relatório', () => {
  it('assina o JWT de verdade (RS256, o escopo certo, 1 hora) e devolve os números do Google já arrumados', async () => {
    const g = google();
    const ga = new GoogleAnalytics({ dirDados: pasta('ok', { propriedade: PROPRIEDADE }), http: g.http });
    const r = await ga.obter();
    expect(r.estado, JSON.stringify(r)).toBe('ok');
    if (r.estado !== 'ok') return;
    const j = g.jwts[0]!;
    expect(j.assinaturaOk, 'a assinatura confere com a chave pública').toBe(true);
    expect(j.cab).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(j.payload.iss).toBe(EMAIL);
    expect(j.payload.scope).toBe('https://www.googleapis.com/auth/analytics.readonly');
    expect(j.payload.aud).toBe('https://oauth2.googleapis.com/token');
    expect((j.payload.exp as number) - (j.payload.iat as number)).toBe(3600);
    expect(r.relatorio.propriedade).toBe(PROPRIEDADE);
    expect(r.relatorio.agora).toBe(3);
    expect(r.relatorio.resumo).toEqual({ usuarios: 120, novos: 80, sessoes: 150, sessoesEngajadas: 90, duracaoMediaS: 187, paginasVistas: 600 });
    expect(r.relatorio.porDia).toEqual([{ dia: '2026-10-16', usuarios: 30, sessoes: 40 }, { dia: '2026-10-17', usuarios: 50, sessoes: 60 }]);
    expect(r.relatorio.canais[0]).toEqual({ nome: 'Direct', sessoes: 90, usuarios: 70 });
    expect(r.relatorio.paises).toEqual([{ codigo: 'BR', usuarios: 100 }, { codigo: 'US', usuarios: 15 }, { codigo: '??', usuarios: 5 }]);
    expect(r.relatorio.aparelhos.map((a) => a.nome)).toEqual(['mobile', 'desktop']);
    expect(JSON.stringify(r), 'a chave nunca sai').not.toContain('PRIVATE KEY');
  });

  it('pede só somas por categoria: nenhuma dimensão que identifique gente (nada de usuário, IP, cidade ou página)', async () => {
    const g = google();
    await new GoogleAnalytics({ dirDados: pasta('dim', { propriedade: PROPRIEDADE }), http: g.http }).obter();
    const lote = JSON.parse(g.chamadas.find((c) => c.url.endsWith(':batchRunReports'))!.corpo) as { requests: { dimensions?: { name: string }[] }[] };
    const dimensoes = lote.requests.flatMap((q) => (q.dimensions ?? []).map((d) => d.name)).sort();
    expect(dimensoes).toEqual(['countryId', 'date', 'deviceCategory', 'sessionDefaultChannelGroup']);
  });

  it('o tempo real é um extra: se só ele falhar, o resto aparece com `agora: null`', async () => {
    const g = google({ realtimeFalha: true });
    const r = await new GoogleAnalytics({ dirDados: pasta('rt', { propriedade: PROPRIEDADE }), http: g.http }).obter();
    expect(r.estado === 'ok' && r.relatorio.agora).toBeNull();
    expect(r.estado === 'ok' && r.relatorio.resumo.usuarios).toBe(120);
  });

  it('formato estranho do Google vira lista vazia ou erro "api", nunca exceção', async () => {
    const vazio = google({ relatorios: { reports: [{}, {}, {}, {}, {}] } });
    const r = await new GoogleAnalytics({ dirDados: pasta('vazio', { propriedade: PROPRIEDADE }), http: vazio.http }).obter();
    expect(r.estado === 'ok' && r.relatorio.resumo.usuarios).toBe(0);
    const torto = google({ relatorios: { reports: [] } });
    const e = await new GoogleAnalytics({ dirDados: pasta('torto', { propriedade: PROPRIEDADE }), http: torto.http }).obter();
    expect(e).toMatchObject({ estado: 'erro', motivo: 'api' });
  });
});

describe('GoogleAnalytics: cache e pedidos simultâneos', () => {
  it('um token só dentro da hora e os mesmos números dentro de 10 min; depois do prazo pede de novo', async () => {
    let t = 1_000_000;
    const g = google();
    const ga = new GoogleAnalytics({ dirDados: pasta('cache', { propriedade: PROPRIEDADE }), http: g.http, agora: () => t });
    await ga.obter();
    t += GA_TTL_MS - 1000;
    await ga.obter();
    expect(g.doTipo('batchRunReports'), 'dentro do prazo: cache').toBe(1);
    t += 2000;
    await ga.obter();
    expect(g.doTipo('batchRunReports'), 'passou do prazo').toBe(2);
    expect(g.doTipo('oauth2'), 'o token (1 hora) é o mesmo').toBe(1);
    t += 3600_000;
    await ga.obter();
    expect(g.doTipo('oauth2'), 'o token venceu: pede outro').toBe(2);
  });

  it('cinco pedidos ao mesmo tempo viram um só no Google', async () => {
    const g = google({ demoraMs: 30 });
    const ga = new GoogleAnalytics({ dirDados: pasta('voo', { propriedade: PROPRIEDADE }), http: g.http });
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => ga.obter()));
    expect(rs.every((r) => r.estado === 'ok')).toBe(true);
    expect(g.doTipo('oauth2')).toBe(1);
    expect(g.doTipo('batchRunReports')).toBe(1);
  });

  it('um Google lento não segura a página: passa da espera máxima, responde "carregando", e a vez seguinte já tem os números', async () => {
    // Tempos curtos e injetados (a espera máxima de 150 ms, o Google de 600 ms) e a volta por espera ativa: o teste de 4,6 s de relógio de verdade reprovou o push sob carga em 19/10.
    const g = google({ demoraMs: 600 });
    const ga = new GoogleAnalytics({ dirDados: pasta('lento', { propriedade: PROPRIEDADE }), http: g.http, esperaMaxMs: 150 });
    const t0 = Date.now();
    expect((await ga.obter()).estado).toBe('carregando');
    expect(Date.now() - t0, 'respondeu logo, sem esperar o Google inteiro').toBeLessThan(550);
    let r: GaEstado = { estado: 'carregando' };
    for (let i = 0; i < 100 && r.estado !== 'ok'; i++) {
      await new Promise((ok) => setTimeout(ok, 100));
      r = await ga.obter();
    }
    expect(r.estado, JSON.stringify(r)).toBe('ok');
  }, 30000);
});

describe('GoogleAnalytics: o que dá errado, dito sem segredo', () => {
  it('sem chave, chave ilegível e sem propriedade: desligado, com o motivo', async () => {
    expect(await new GoogleAnalytics({ dirDados: pasta('semchave', { chave: false }), http: google().http }).obter()).toEqual({ estado: 'desligado', motivo: 'sem-chave' });
    expect(await new GoogleAnalytics({ dirDados: null, http: google().http }).obter()).toEqual({ estado: 'desligado', motivo: 'sem-chave' });
    expect(await new GoogleAnalytics({ dirDados: pasta('ruim', { chave: 'ruim' }), http: google().http }).obter()).toEqual({ estado: 'desligado', motivo: 'chave-ruim' });
    const g = google({ admin: { accountSummaries: [] } });
    expect(await new GoogleAnalytics({ dirDados: pasta('semprop'), http: g.http }).obter()).toEqual({ estado: 'desligado', motivo: 'sem-propriedade' });
  });

  const props = (...itens: [string, string][]) => ({ accountSummaries: [{ propertySummaries: itens.map(([id, displayName]) => ({ property: `properties/${id}`, displayName })) }] });

  it('sem o ID, descobre a propriedade que tem o fluxo do CYBERMECH (o código de medição do jogo), mesmo com outras ao lado', async () => {
    const uma = await new GoogleAnalytics({ dirDados: pasta('descobre'), http: google().http }).obter();
    expect(uma.estado === 'ok' && uma.relatorio.propriedade).toBe(PROPRIEDADE);
    const duas = google({ admin: props(['111111', 'odpandroid'], [PROPRIEDADE, 'CYBERMECH']), fluxos: { '111111': [], [PROPRIEDADE]: [GA_MEDICAO_ID, 'G-OUTRO000000'] } });
    const r = await new GoogleAnalytics({ dirDados: pasta('duas'), http: duas.http }).obter();
    expect(r.estado === 'ok' && r.relatorio.propriedade).toBe(PROPRIEDADE);
  });

  it('o caso real de 18/10: a conta só enxerga o app Android de outro projeto: NÃO usa os números dele, diz os nomes que enxerga e onde dar o acesso', async () => {
    const g = google({ admin: props(['538478235', 'odpandroid']), fluxos: { '538478235': [] } });
    const r = await new GoogleAnalytics({ dirDados: pasta('errada'), http: g.http }).obter();
    expect(r).toEqual({ estado: 'desligado', motivo: 'propriedade-errada', vistas: ['odpandroid'] });
    expect(g.doTipo('batchRunReports'), 'nenhum relatório da propriedade errada foi pedido').toBe(0);
  });

  it('duas propriedades com o mesmo código de medição: ambíguo, não chuta (o dono escreve o ID)', async () => {
    const g = google({ admin: props(['111111', 'a'], ['222222', 'b']), fluxos: { '111111': [GA_MEDICAO_ID], '222222': [GA_MEDICAO_ID] } });
    expect((await new GoogleAnalytics({ dirDados: pasta('ambigua'), http: g.http }).obter()).estado).toBe('desligado');
    expect(g.doTipo('batchRunReports')).toBe(0);
  });

  it('o ID escrito em ga-propriedade.txt vale sem conferir o fluxo (decisão do dono), e o código de medição pode vir da variável', async () => {
    const g = google({ admin: props(['538478235', 'odpandroid']), fluxos: { '538478235': [] } });
    const escrito = await new GoogleAnalytics({ dirDados: pasta('escrito', { propriedade: '538478235' }), http: g.http }).obter();
    expect(escrito.estado === 'ok' && escrito.relatorio.propriedade).toBe('538478235');
    const outro = google({ admin: props(['333333', 'x']), fluxos: { '333333': ['G-MEUOUTRO01'] } });
    const r = await new GoogleAnalytics({ dirDados: pasta('envmed'), env: { CYBERMECH_GA_MEDICAO: 'G-MEUOUTRO01' }, http: outro.http }).obter();
    expect(r.estado === 'ok' && r.relatorio.propriedade).toBe('333333');
  });

  it('o código de medição do servidor é o mesmo do jogo e do site (nunca se separam)', () => {
    expect(readFileSync(resolve('client/index.html'), 'utf8')).toContain(GA_MEDICAO_ID);
    expect(readFileSync(resolve('scripts/site/tema.mjs'), 'utf8')).toContain(`GA_ID = '${GA_MEDICAO_ID}'`);
  });

  it('o ID vem do arquivo (aceita o "properties/"), da variável de ambiente, e lixo não vale', async () => {
    const a = await new GoogleAnalytics({ dirDados: pasta('arq', { propriedade: 'properties/987654321' }), http: google().http }).obter();
    expect(a.estado === 'ok' && a.relatorio.propriedade).toBe('987654321');
    const b = await new GoogleAnalytics({ dirDados: pasta('env'), env: { CYBERMECH_GA_PROPRIEDADE: '555555555' }, http: google().http }).obter();
    expect(b.estado === 'ok' && b.relatorio.propriedade).toBe('555555555');
    const lixo = google({ admin: { accountSummaries: [] } });
    expect((await new GoogleAnalytics({ dirDados: pasta('lixo', { propriedade: '12ab; DROP' }), http: lixo.http }).obter()).estado).toBe('desligado');
    // O ID também vira parte do endereço do Google: lixo na variável de ambiente não pode entrar nele.
    const noEnv = google({ admin: { accountSummaries: [] } });
    expect(await new GoogleAnalytics({ dirDados: pasta('lixo-env'), env: { CYBERMECH_GA_PROPRIEDADE: '123/../x?y' }, http: noEnv.http }).obter()).toEqual({ estado: 'desligado', motivo: 'sem-propriedade' });
    expect(noEnv.chamadas.some((c) => c.url.includes('x?y') || c.url.includes('../'))).toBe(false);
  });

  it('erro do token, da API, da cota e da rede: o motivo certo, o detalhe sem sequência longa, e só tenta de novo depois do prazo', async () => {
    const casos: [Parameters<typeof google>[0], string][] = [
      [{ tokenStatus: 400 }, 'token'],
      [{ dataStatus: 403 }, 'api'],
      [{ dataStatus: 429 }, 'cota'],
    ];
    for (const [cfg, motivo] of casos) {
      let t = 5_000_000;
      const g = google(cfg);
      const linhasDeLog: string[] = [];
      const ga = new GoogleAnalytics({ dirDados: pasta(`erro-${motivo}`, { propriedade: PROPRIEDADE }), http: g.http, agora: () => t, anotar: (l) => linhasDeLog.push(l) });
      const r = await ga.obter();
      expect(r, motivo).toMatchObject({ estado: 'erro', motivo });
      const detalhe = (r as Extract<GaEstado, { estado: 'erro' }>).detalhe;
      expect(detalhe).not.toMatch(/A{40}/);
      expect(detalhe + linhasDeLog.join()).not.toContain('PRIVATE KEY');
      const antes = g.chamadas.length;
      t += GA_ERRO_TTL_MS - 1000;
      await ga.obter();
      expect(g.chamadas.length, `${motivo}: dentro do prazo do erro não insiste`).toBe(antes);
      t += 2000;
      await ga.obter();
      expect(g.chamadas.length, `${motivo}: passado o prazo, tenta de novo`).toBeGreaterThan(antes);
    }
    const cai = new GoogleAnalytics({ dirDados: pasta('rede', { propriedade: PROPRIEDADE }), http: (async () => { throw new Error('queda'); }) as unknown as typeof fetch });
    expect(await cai.obter()).toMatchObject({ estado: 'erro', motivo: 'rede' });
  });

  it('o erro volta ao normal quando o Google volta (a conta ganhou acesso depois)', async () => {
    let t = 9_000_000;
    let dataStatus = 403;
    const g = google();
    const http = (async (url: string, init?: RequestInit) => (url.endsWith(':batchRunReports') && dataStatus === 403 ? new Response('{"error":{"status":"PERMISSION_DENIED","message":"sem acesso"}}', { status: 403 }) : g.http(url, init))) as unknown as typeof fetch;
    const ga = new GoogleAnalytics({ dirDados: pasta('volta', { propriedade: PROPRIEDADE }), http, agora: () => t });
    expect((await ga.obter()).estado).toBe('erro');
    dataStatus = 200;
    t += GA_ERRO_TTL_MS + 1;
    expect((await ga.obter()).estado).toBe('ok');
  });

  it('detalheSeguro corta sequências longas (parecem chave ou token) e limita o tamanho', () => {
    expect(detalheSeguro(`falhou ${'x'.repeat(60)} fim`)).toBe('falhou … fim');
    expect(detalheSeguro('a'.repeat(500)).length).toBeLessThanOrEqual(160);
    expect(detalheSeguro(undefined)).toBe('');
  });
});

describe('o /metricas com o Analytics', () => {
  const TOKEN = 'token-de-teste-com-mais-de-16';
  const ler = async (analytics?: { obter(): Promise<GaEstado> } | null) => {
    const dir = pasta(`servidor-${analytics === undefined ? 'padrao' : analytics ? 'falso' : 'nulo'}`, { chave: false });
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', dirDados: dir, metricasToken: TOKEN, guard: { perIp: 100, total: 200, msgs: 200, burst: 200 }, ...(analytics !== undefined ? { analytics } : {}) });
    try {
      const r = await fetch(`http://127.0.0.1:${s.port}${METRICAS_PATH}`, { headers: { [METRICAS_HEADER]: TOKEN } });
      return (await r.json()) as { analytics: GaEstado };
    } finally {
      await s.close();
    }
  };

  it('sem chave guardada: "desligado, sem-chave" (a página explica o que falta)', async () => {
    expect((await ler()).analytics).toEqual({ estado: 'desligado', motivo: 'sem-chave' });
    expect((await ler(null)).analytics).toEqual({ estado: 'desligado', motivo: 'sem-chave' });
  });

  it('com o Analytics ligado: o bloco vai na resposta tal como o serviço o entregou', async () => {
    const estado: GaEstado = { estado: 'carregando' };
    expect((await ler({ obter: async () => estado })).analytics).toEqual(estado);
  });

  it('com a chave de verdade e o Google de mentira, a resposta inteira não leva a chave nem o token', async () => {
    const dir = pasta('servidor-completo', { propriedade: PROPRIEDADE });
    const g = google();
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', dirDados: dir, metricasToken: TOKEN, guard: { perIp: 100, total: 200, msgs: 200, burst: 200 }, analytics: new GoogleAnalytics({ dirDados: dir, http: g.http }) });
    try {
      const texto = await (await fetch(`http://127.0.0.1:${s.port}${METRICAS_PATH}`, { headers: { [METRICAS_HEADER]: TOKEN } })).text();
      expect(JSON.parse(texto).analytics.estado).toBe('ok');
      for (const segredo of ['PRIVATE KEY', 'token-de-teste', PEM.slice(40, 90).replace(/\n/g, '')]) expect(texto).not.toContain(segredo);
    } finally {
      await s.close();
    }
  });
});
