import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it } from 'vitest';
import { ACEITE_ATUAL, ADMIN_CONFIG_PATH, CONFIG_PATH, CONFIG_VALOR_MAX, CONTA_APAGAR_PATH, CONTA_CRIAR_PATH, CONTA_ENTRAR_PATH, CONTA_DADOS_PATH, CONTA_MEDICAO_PATH, chaveDeConfigValida, SESSAO_HEADER, valorDeConfigValido } from '../shared/net/auth';
import { METRICAS_HEADER, METRICAS_PATH } from '../shared/net/telemetry';
import { executarComandoAdmin } from './adminContas';
import { Auditoria, AUDITORIA_DIAS, type EventoDeAuditoria } from './auditoria';
import { Contas, SESSOES_MAX } from './contas';
import { FalhasPorConta } from './login';
import { startServer, type GameServer } from './Server';

/** A segurança de acesso do lançamento (P192): privilégio, autenticação e a trilha de auditoria. */
const raiz = resolve('.tmp', `teste-seguranca-${process.pid}`);
afterAll(() => rmSync(raiz, { recursive: true, force: true }));
const TOKEN = 'token-de-teste-com-mais-de-16';
const SENHA = 'senhasegura';

describe('FalhasPorConta: senha errada demais tranca a CONTA, de onde vierem as tentativas', () => {
  it('tranca ao chegar no teto, só dentro da janela, e a senha certa antes disso zera', () => {
    const f = new FalhasPorConta({ teto: 3, janelaMs: 1000 });
    for (let i = 0; i < 2; i++) f.falhou('a@x.com', 0);
    expect(f.bloqueada('a@x.com', 10)).toBe(false);
    f.falhou('a@x.com', 20);
    expect(f.bloqueada('a@x.com', 30)).toBe(true);
    expect(f.bloqueada('a@x.com', 1001)).toBe(false); // a janela passou
    f.falhou('b@x.com', 0);
    f.falhou('b@x.com', 0);
    f.acertou('b@x.com');
    f.falhou('b@x.com', 5);
    expect(f.bloqueada('b@x.com', 6)).toBe(false); // zerou
  });
  it('a chave é o e-mail normalizado (maiúsculas e espaços não escapam) e cada conta é uma', () => {
    const f = new FalhasPorConta({ teto: 2, janelaMs: 1000 });
    f.falhou('Ana@X.com', 0);
    f.falhou(' ana@x.com ', 0);
    expect(f.bloqueada('ANA@x.com', 1)).toBe(true);
    expect(f.bloqueada('outra@x.com', 1)).toBe(false);
  });
});

describe('Contas: teto de sessões, promover e rebaixar', () => {
  it('a conta guarda no máximo SESSOES_MAX sessões; as mais velhas saem e a nova vale', async () => {
    const contas = new Contas(':memory:');
    const r = await contas.criar('s@x.com', SENHA, Date.now());
    if (!r.ok) throw new Error('criar');
    const tokens: string[] = [];
    for (let i = 0; i < SESSOES_MAX + 5; i++) tokens.push(contas.criarSessao(r.conta.id, Date.now() + i));
    const dados = contas.exportarDados(r.conta.id)!;
    expect(dados.sessoes).toHaveLength(SESSOES_MAX);
    expect(contas.validarSessao(tokens[0]!)).toBeNull(); // a mais velha saiu
    expect(contas.validarSessao(tokens.at(-1)!)).not.toBeNull();
    contas.close();
  });
  it('promover e rebaixar mudam o privilégio na hora; e-mail sem conta devolve nulo; só os administradores aparecem na lista', async () => {
    const contas = new Contas(':memory:');
    const a = await contas.criar('a@x.com', SENHA);
    await contas.criar('b@x.com', SENHA);
    if (!a.ok) throw new Error('criar');
    const token = contas.criarSessao(a.conta.id);
    expect(contas.validarSessao(token)!.is_admin).toBe(false);
    expect(contas.definirAdmin('a@x.com', true)).toMatchObject({ id: a.conta.id, is_admin: true });
    expect(contas.validarSessao(token)!.is_admin).toBe(true); // a sessão que já estava aberta passa a valer
    expect(contas.listarAdmins()).toEqual([{ id: a.conta.id, email: 'a@x.com' }]);
    expect(contas.definirAdmin('ninguem@x.com', true)).toBeNull();
    contas.definirAdmin('a@x.com', false);
    expect(contas.validarSessao(token)!.is_admin).toBe(false);
    expect(contas.listarAdmins()).toEqual([]);
    contas.close();
  });
});

describe('Auditoria: a trilha só acrescenta, sem dado pessoal', () => {
  const T0 = Date.UTC(2026, 9, 18, 15, 0);
  it('grava uma linha por evento no arquivo do mês e lê de volta (mais novo primeiro)', () => {
    const pasta = join(raiz, 'a1');
    const a = new Auditoria(pasta, () => T0);
    a.registrar({ ator: 'conta:7', acao: 'conta_criada', alvo: 'conta:7' });
    a.registrar({ ator: 'dono', acao: 'admin_promovido', alvo: 'conta:7' });
    a.registrar({ ator: 'anonimo', acao: 'admin_acesso', alvo: 'rota:metricas', ok: false });
    expect(readdirSync(pasta)).toEqual(['auditoria-2026-10.jsonl']);
    const linhas = readFileSync(join(pasta, 'auditoria-2026-10.jsonl'), 'utf8').trimEnd().split('\n');
    expect(linhas).toHaveLength(3);
    expect(JSON.parse(linhas[2]!)).toEqual({ quando: new Date(T0).toISOString(), ator: 'anonimo', acao: 'admin_acesso', alvo: 'rota:metricas', ok: false });
    expect(a.recentes(2).map((e) => e.acao)).toEqual(['admin_acesso', 'admin_promovido']);
    // reabrir a trilha traz o que já estava no arquivo
    const b = new Auditoria(pasta, () => T0);
    expect(b.recentes(10)).toHaveLength(3);
    expect(b.recentes(10)[0]!.acao).toBe('admin_acesso');
  });
  it('ator e alvo fora do formato viram texto neutro: e-mail e quebra de linha forjada não entram', () => {
    const pasta = join(raiz, 'a2');
    const a = new Auditoria(pasta, () => T0);
    const e1 = a.registrar({ ator: 'fulano@x.com', acao: 'conta_criada', alvo: 'conta:1' });
    const e2 = a.registrar({ ator: 'conta:1', acao: 'admin_config', alvo: 'config:x\n{"acao":"falso"}' });
    const e3 = a.registrar({ ator: 'conta:1', acao: 'admin_config', alvo: 'fulano@x.com' });
    expect(e1.ator).toBe('anonimo');
    expect(e2.alvo).toBe('invalido:');
    expect(e3.alvo).toBe('invalido:');
    const texto = readFileSync(join(pasta, 'auditoria-2026-10.jsonl'), 'utf8');
    expect(texto).not.toContain('@');
    expect(texto.trimEnd().split('\n')).toHaveLength(3); // nenhuma linha forjada
  });
  it('linhas tortas do arquivo são ignoradas na leitura; um mês novo abre arquivo novo', () => {
    const pasta = join(raiz, 'a3');
    mkdirSync(pasta, { recursive: true });
    writeFileSync(join(pasta, 'auditoria-2026-09.jsonl'), 'lixo\n{"quando":"x"}\n' + JSON.stringify({ quando: 'q', ator: 'dono', acao: 'admin_promovido', alvo: 'conta:1', ok: true }) + '\n' + JSON.stringify({ quando: 'q', ator: 'e@x.com', acao: 'admin_promovido', alvo: '', ok: true }) + '\n');
    const a = new Auditoria(pasta, () => T0);
    expect(a.recentes(10)).toHaveLength(1);
    new Auditoria(pasta, () => Date.UTC(2026, 10, 3)).registrar({ ator: 'sistema', acao: 'servidor_reiniciado', alvo: 'motivo:teste' });
    expect(readdirSync(pasta).sort()).toEqual(['auditoria-2026-09.jsonl', 'auditoria-2026-11.jsonl']);
  });
  it('apaga os meses de mais de 400 dias e guarda o resto; sem pasta funciona só em memória; nunca lança', () => {
    const pasta = join(raiz, 'a4');
    mkdirSync(pasta, { recursive: true });
    for (const m of ['2025-08', '2025-09', '2026-10']) writeFileSync(join(pasta, `auditoria-${m}.jsonl`), '');
    writeFileSync(join(pasta, 'leia-me.txt'), 'x');
    const a = new Auditoria(pasta, () => T0);
    expect(AUDITORIA_DIAS).toBe(400);
    // 400 dias antes de 18/10/2026 é 14/09/2025: o mês 2025-09 ainda vale, o 2025-08 saiu
    expect(a.podar()).toEqual(['auditoria-2025-08.jsonl']);
    expect(readdirSync(pasta).sort()).toEqual(['auditoria-2025-09.jsonl', 'auditoria-2026-10.jsonl', 'leia-me.txt']);
    const memoria = new Auditoria(null, () => T0);
    memoria.registrar({ ator: 'dono', acao: 'admin_promovido', alvo: 'conta:1' });
    expect(memoria.recentes()).toHaveLength(1);
    expect(memoria.podar()).toEqual([]);
    const arquivo = join(raiz, 'sou-arquivo');
    writeFileSync(arquivo, 'x');
    expect(() => new Auditoria(join(arquivo, 'sub'), () => T0).registrar({ ator: 'dono', acao: 'admin_promovido' })).not.toThrow();
  });
});

describe('a ferramenta do dono: promover e rebaixar', () => {
  it('lista, promove, rebaixa; valida o e-mail; cada mudança entra na trilha como ação do dono', async () => {
    const contas = new Contas(':memory:');
    await contas.criar('chefe@x.com', SENHA);
    const trilha = new Auditoria(null);
    expect(executarComandoAdmin(['listar'], contas, trilha)).toEqual({ codigo: 0, linhas: ['nenhum administrador'] });
    const p = executarComandoAdmin(['promover', ' Chefe@X.com '], contas, trilha);
    expect(p.codigo).toBe(0);
    expect(contas.listarAdmins()).toHaveLength(1);
    expect(executarComandoAdmin(['listar'], contas, trilha).linhas[0]).toContain('chefe@x.com');
    expect(executarComandoAdmin(['promover', 'ninguem@x.com'], contas, trilha).codigo).toBe(1);
    expect(executarComandoAdmin(['promover', 'invalido'], contas, trilha).codigo).toBe(2);
    expect(executarComandoAdmin(['promover'], contas, trilha).codigo).toBe(2);
    expect(executarComandoAdmin(['voar'], contas, trilha).codigo).toBe(2);
    expect(executarComandoAdmin(['rebaixar', 'chefe@x.com'], contas, trilha).codigo).toBe(0);
    expect(contas.listarAdmins()).toHaveLength(0);
    expect(trilha.recentes().map((e) => [e.ator, e.acao])).toEqual([['dono', 'admin_rebaixado'], ['dono', 'admin_promovido']]);
    contas.close();
  });
});

describe('a configuração global aceita só as chaves conhecidas', () => {
  it('chave e valor: lista branca, JSON, tamanho', () => {
    expect(chaveDeConfigValida('chassis_status')).toBe(true);
    for (const c of ['segredo', '', 'CHASSIS_STATUS', 5, null, 'chassis_status ']) expect(chaveDeConfigValida(c), String(c)).toBe(false);
    expect(valorDeConfigValido('["quadraV2"]')).toBe(true);
    for (const v of ['', 'não é json', '{', 5, null, 'x'.repeat(CONFIG_VALOR_MAX + 1), '"' + 'x'.repeat(CONFIG_VALOR_MAX) + '"']) expect(valorDeConfigValido(v), String(v).slice(0, 20)).toBe(false);
  });
});

/** O servidor de verdade: o que cada porta exige de quem bate, e o que a trilha guarda. */
describe('privilégio e trilha no servidor de verdade', () => {
  const pasta = join(raiz, 'srv');
  let server: GameServer;
  const url = (p: string) => `http://127.0.0.1:${server.port}${p}`;
  const json = { 'content-type': 'application/json' };
  const post = (path: string, corpo: unknown, h: Record<string, string> = {}) => fetch(url(path), { method: 'POST', headers: { ...json, ...h }, body: JSON.stringify(corpo) });
  const criar = async (email: string): Promise<{ token: string; id: number }> => {
    const token = ((await (await post(CONTA_CRIAR_PATH, { email, senha: SENHA, aceite: ACEITE_ATUAL })).json()) as { token: string }).token;
    const outra = new DatabaseSync(join(pasta, 'contas.db'));
    const id = Number((outra.prepare('SELECT id FROM contas WHERE email = ?').get(email) as { id: number }).id);
    outra.close();
    return { token, id };
  };
  const tornarAdmin = (email: string) => {
    const outra = new DatabaseSync(join(pasta, 'contas.db'));
    outra.prepare('UPDATE contas SET is_admin = 1 WHERE email = ?').run(email);
    outra.close();
  };
  const trilha = async (): Promise<EventoDeAuditoria[]> => ((await (await fetch(url(METRICAS_PATH), { headers: { [METRICAS_HEADER]: TOKEN } })).json()) as { auditoria: EventoDeAuditoria[] }).auditoria;

  it('sobe', async () => {
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    server = await startServer({ port: 0, host: '127.0.0.1', dbContas: join(pasta, 'contas.db'), dirDados: pasta, metricasToken: TOKEN, guard: { perIp: 100, total: 200, msgs: 200, burst: 200 }, limiteLogin: { teto: 1000 } });
  });

  it('a configuração: a rota pública só entrega a chave conhecida; gravar exige administrador, chave conhecida e JSON', async () => {
    expect((await fetch(url(`${CONFIG_PATH}?chave=segredo`))).status).toBe(400);
    expect((await fetch(url(`${CONFIG_PATH}?chave=${'a'.repeat(5000)}`))).status).toBe(400);
    expect((await fetch(url(CONFIG_PATH))).status).toBe(200); // sem chave: a conhecida
    const comum = await criar('comum@x.com');
    expect((await post(ADMIN_CONFIG_PATH, { chave: 'chassis_status', valor: '[]' })).status).toBe(403);
    expect((await post(ADMIN_CONFIG_PATH, { chave: 'chassis_status', valor: '[]' }, { [SESSAO_HEADER]: comum.token })).status).toBe(403);
    const adm = await criar('adm@x.com');
    tornarAdmin('adm@x.com');
    const h = { [SESSAO_HEADER]: adm.token };
    expect((await post(ADMIN_CONFIG_PATH, { chave: 'segredo', valor: '"x"' }, h)).status).toBe(400);
    expect((await post(ADMIN_CONFIG_PATH, { chave: 'chassis_status', valor: 'não é json' }, h)).status).toBe(400);
    expect((await post(ADMIN_CONFIG_PATH, { chave: 'chassis_status', valor: 'x'.repeat(CONFIG_VALOR_MAX + 1) }, h)).status).toBe(400);
    expect((await post(ADMIN_CONFIG_PATH, { chave: 'chassis_status', valor: '["quadraV2"]' }, h)).status).toBe(200);
    expect(await (await fetch(url(`${CONFIG_PATH}?chave=chassis_status`))).text()).toBe('["quadraV2"]');
  });

  it('a conta tranca depois de senhas erradas demais, mesmo com a senha certa; outra conta não é afetada', async () => {
    await criar('alvo@x.com');
    await criar('livre@x.com');
    for (let i = 0; i < 10; i++) expect((await post(CONTA_ENTRAR_PATH, { email: 'alvo@x.com', senha: 'errada-errada-1' })).status).toBe(401);
    const trancada = await post(CONTA_ENTRAR_PATH, { email: 'ALVO@x.com', senha: SENHA });
    expect(trancada.status, 'a senha certa não passa trancada').toBe(429);
    expect((await post(CONTA_ENTRAR_PATH, { email: 'livre@x.com', senha: SENHA })).status).toBe(200);
    // e-mail que nem existe também é contado (senão o limite viraria um detector de contas)
    for (let i = 0; i < 10; i++) await post(CONTA_ENTRAR_PATH, { email: 'fantasma@x.com', senha: 'errada-errada-1' });
    expect((await post(CONTA_ENTRAR_PATH, { email: 'fantasma@x.com', senha: 'errada-errada-1' })).status).toBe(429);
  });

  it('apagar a conta também respeita a tranca: quem erra a senha demais não consegue apagar, nem adivinhar a senha por aqui', async () => {
    const c = await criar('apagar-tranca@x.com');
    for (let i = 0; i < 10; i++) expect((await post(CONTA_ENTRAR_PATH, { email: 'apagar-tranca@x.com', senha: 'errada-errada-1' })).status).toBe(401);
    expect((await post(CONTA_APAGAR_PATH, { senha: SENHA }, { [SESSAO_HEADER]: c.token })).status, 'com a conta trancada nem a senha certa apaga').toBe(429);
    expect((await post(CONTA_ENTRAR_PATH, { email: 'adm@x.com', senha: SENHA })).status).toBe(200);
  });

  it('a trilha: o que é sensível entra, e não entra e-mail nem IP; a recusa à porta do dono também fica', async () => {
    const c = await criar('trilha@x.com');
    await fetch(url(CONTA_DADOS_PATH), { headers: { [SESSAO_HEADER]: c.token } });
    await post(CONTA_MEDICAO_PATH, { ativa: false }, { [SESSAO_HEADER]: c.token });
    await post(CONTA_APAGAR_PATH, { senha: 'errada-errada-1' }, { [SESSAO_HEADER]: c.token });
    await fetch(url(METRICAS_PATH)); // sem chave: recusado
    expect((await post(CONTA_APAGAR_PATH, { senha: SENHA }, { [SESSAO_HEADER]: c.token })).status).toBe(200);
    const t = await trilha();
    const meus = t.filter((e) => e.alvo === `conta:${c.id}` || e.alvo.startsWith('medir:'));
    expect(meus.map((e) => `${e.ator}|${e.acao}|${e.ok}`)).toEqual(
      expect.arrayContaining([`conta:${c.id}|conta_criada|true`, `conta:${c.id}|dados_baixados|true`, `conta:${c.id}|medicao_alterada|true`, `conta:${c.id}|conta_apagada|false`, `conta:${c.id}|conta_apagada|true`]),
    );
    expect(t.some((e) => e.acao === 'admin_acesso' && e.alvo === 'rota:metricas' && e.ator === 'anonimo' && !e.ok), 'a tentativa sem chave ficou').toBe(true);
    expect(t.some((e) => e.acao === 'admin_acesso' && e.ator === 'dono' && e.ok), 'o acesso do dono ficou').toBe(true);
    expect(t.some((e) => e.acao === 'admin_config' && e.alvo === 'config:chassis_status' && e.ok), 'a mudança de configuração ficou').toBe(true);
    expect(t.some((e) => e.acao === 'admin_config' && !e.ok), 'a recusa ficou').toBe(true);
    const texto = JSON.stringify(t) + readdirSync(join(pasta, 'auditoria')).map((f) => readFileSync(join(pasta, 'auditoria', f), 'utf8')).join('');
    expect(texto).not.toContain('@x.com');
    expect(texto).not.toContain('127.0.0.1');
  });

  it('a mesma recusa repetida conta uma vez a cada 10 minutos (o painel consulta a toda hora)', async () => {
    const antes = (await trilha()).filter((e) => e.acao === 'admin_acesso' && !e.ok).length;
    for (let i = 0; i < 5; i++) await fetch(url(METRICAS_PATH));
    expect((await trilha()).filter((e) => e.acao === 'admin_acesso' && !e.ok).length).toBe(antes);
    await server.close();
  });
});
