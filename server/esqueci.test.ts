import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ACEITE_ATUAL,
  CONTA_CRIAR_PATH,
  CONTA_ENTRAR_PATH,
  CONTA_ESQUECI_PATH,
  CONTA_EU_PATH,
  CONTA_REDEFINIR_PATH,
  IDIOMAS_EMAIL,
  REDEFINIR_VALE_MIN,
  SESSAO_HEADER,
  parseEsqueci,
  parseRedefinir,
  urlDeRedefinicao,
} from '../shared/net/auth';
import { METRICAS_HEADER, METRICAS_PATH } from '../shared/net/telemetry';
import { executarComandoAdmin } from './adminContas';
import { Auditoria } from './auditoria';
import { Contas } from './contas';
import { carregarMailer, type Email, EMAILS_POR_DIA, EMAIL_ARQUIVO, MailerResend, type Mailer, TetoDiario } from './email';
import { emailDeRedefinicao } from './emailTextos';
import { IDIOMAS } from '../client/src/i18n/i18n';
import { startServer, type GameServer } from './Server';

/** O "esqueci a senha" (P205): o fluxo inteiro contra o servidor de verdade, e cada regra de segurança que o sustenta. */
const TOKEN_DONO = 'token-de-teste-com-mais-de-16';
const SENHA = 'senhasegura';
const NOVA = 'senha-nova-123';
const ESPERA = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function ate(cond: () => boolean, ms = 3000): Promise<boolean> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) return false;
    await ESPERA(10);
  }
  return true;
}
/** O e-mail falso: guarda o que o servidor mandaria e devolve o resultado combinado. */
class MailerFalso implements Mailer {
  readonly enviados: Email[] = [];
  resultado = true;
  async enviar(e: Email): Promise<boolean> {
    this.enviados.push(e);
    return this.resultado;
  }
}
const tokenDoEmail = (e: Email): string => /#([A-Za-z0-9_-]{43})/.exec(e.texto)![1]!;

describe('o fluxo do "esqueci a senha" de ponta a ponta', () => {
  const pasta = resolve('.tmp', `teste-esqueci-${process.pid}`);
  const mailer = new MailerFalso();
  const linhas: string[] = [];
  let server: GameServer;
  const url = (p: string) => `http://127.0.0.1:${server.port}${p}`;
  const post = (p: string, corpo: unknown, sessao?: string) =>
    fetch(url(p), { method: 'POST', headers: { 'content-type': 'application/json', ...(sessao ? { [SESSAO_HEADER]: sessao } : {}) }, body: JSON.stringify(corpo) });
  const criar = async (email: string): Promise<string> => ((await (await post(CONTA_CRIAR_PATH, { email, senha: SENHA, aceite: ACEITE_ATUAL })).json()) as { token: string }).token;
  const auditoria = async () => ((await (await fetch(url(METRICAS_PATH), { headers: { [METRICAS_HEADER]: TOKEN_DONO } })).json()) as { auditoria: { ator: string; acao: string; alvo: string }[] }).auditoria;

  beforeAll(async () => {
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
      limiteEsqueci: { teto: 1000 },
      mailer,
      siteUrl: 'https://exemplo.test/',
      log: (l) => linhas.push(l),
    });
  });
  afterAll(async () => {
    await server.close();
    rmSync(pasta, { recursive: true, force: true });
  });

  it('pedir, receber o link, trocar a senha: a senha velha para de valer, a nova vale, as sessões abertas caem e o link não serve de novo', async () => {
    const sessaoVelha = await criar('ana@x.com');
    const antes = mailer.enviados.length;
    const r = await post(CONTA_ESQUECI_PATH, { email: 'Ana@X.com', lang: 'en' });
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ ok: true });
    expect(await ate(() => mailer.enviados.length > antes), 'o e-mail saiu').toBe(true);
    const email = mailer.enviados.at(-1)!;
    expect(email.para, 'e-mail normalizado').toBe('ana@x.com');
    expect(email.assunto).toBe('CYBERMECH: reset your password');
    expect(email.texto).toContain('https://exemplo.test/redefinir/?lang=en#');
    expect(email.texto).toContain(`${REDEFINIR_VALE_MIN} minutes`);
    const token = tokenDoEmail(email);

    const troca = await post(CONTA_REDEFINIR_PATH, { token, senha: NOVA });
    expect(troca.status).toBe(200);
    expect((await post(CONTA_ENTRAR_PATH, { email: 'ana@x.com', senha: SENHA })).status, 'a senha velha não entra mais').toBe(401);
    expect((await post(CONTA_ENTRAR_PATH, { email: 'ana@x.com', senha: NOVA })).status, 'a nova entra').toBe(200);
    expect((await fetch(url(CONTA_EU_PATH), { headers: { [SESSAO_HEADER]: sessaoVelha } })).status, 'a sessão que já estava aberta foi encerrada').toBe(401);
    const de_novo = await post(CONTA_REDEFINIR_PATH, { token, senha: 'outra-senha-456' });
    expect(de_novo.status, 'o link vale uma vez só').toBe(400);
    expect(((await de_novo.json()) as { codigo: string }).codigo).toBe('token');
  });

  it('a resposta é igual exista a conta ou não (e o e-mail só sai para quem tem conta): nada de descobrir e-mails cadastrados', async () => {
    await criar('existe@x.com');
    const antes = mailer.enviados.length;
    const com = await post(CONTA_ESQUECI_PATH, { email: 'existe@x.com' });
    const sem = await post(CONTA_ESQUECI_PATH, { email: 'nao-existe@x.com' });
    expect(sem.status).toBe(com.status);
    expect(await sem.text()).toBe(await com.text());
    expect(await ate(() => mailer.enviados.length === antes + 1)).toBe(true);
    await ESPERA(150);
    expect(mailer.enviados.length, 'um só e-mail: o de quem tem conta').toBe(antes + 1);
    expect(mailer.enviados.at(-1)!.para).toBe('existe@x.com');
  });

  it('um pedido novo cancela o link anterior (um link vivo por conta)', async () => {
    await criar('dois@x.com');
    const base = mailer.enviados.length;
    await post(CONTA_ESQUECI_PATH, { email: 'dois@x.com' });
    expect(await ate(() => mailer.enviados.length === base + 1)).toBe(true);
    const velho = tokenDoEmail(mailer.enviados.at(-1)!);
    await post(CONTA_ESQUECI_PATH, { email: 'dois@x.com' });
    expect(await ate(() => mailer.enviados.length === base + 2)).toBe(true);
    const novo = tokenDoEmail(mailer.enviados.at(-1)!);
    expect((await post(CONTA_REDEFINIR_PATH, { token: velho, senha: NOVA })).status, 'o link velho morreu').toBe(400);
    expect((await post(CONTA_REDEFINIR_PATH, { token: novo, senha: NOVA })).status, 'o novo vale').toBe(200);
  });

  it('senha curta é recusada com a mensagem para a tela e NÃO queima o link; token torto nem chega ao banco', async () => {
    await criar('curta@x.com');
    const base = mailer.enviados.length;
    await post(CONTA_ESQUECI_PATH, { email: 'curta@x.com' });
    expect(await ate(() => mailer.enviados.length === base + 1)).toBe(true);
    const token = tokenDoEmail(mailer.enviados.at(-1)!);
    const curta = await post(CONTA_REDEFINIR_PATH, { token, senha: '123' });
    expect(curta.status).toBe(400);
    expect(((await curta.json()) as { codigo: string }).codigo).toBe('senha');
    expect((await post(CONTA_REDEFINIR_PATH, { token, senha: NOVA })).status, 'o link ainda vale').toBe(200);
    for (const ruim of [undefined, '', 'curto', 'x'.repeat(43) + '!', 'a'.repeat(44), 42, null]) {
      expect((await post(CONTA_REDEFINIR_PATH, { token: ruim, senha: NOVA })).status).toBe(400);
    }
  });

  it('o e-mail mal formado e o corpo estranho são recusados', async () => {
    expect((await post(CONTA_ESQUECI_PATH, { email: 'sem-arroba' })).status).toBe(400);
    expect((await post(CONTA_ESQUECI_PATH, {})).status).toBe(400);
    expect((await post(CONTA_ESQUECI_PATH, 'texto')).status).toBe(400);
    expect((await fetch(url(CONTA_ESQUECI_PATH), { method: 'GET' })).status).toBe(405);
  });

  it('a trilha de auditoria registra o pedido e a troca com o número da conta, nunca o e-mail nem o token', async () => {
    await criar('audita@x.com');
    const base = mailer.enviados.length;
    await post(CONTA_ESQUECI_PATH, { email: 'audita@x.com' });
    expect(await ate(() => mailer.enviados.length === base + 1)).toBe(true);
    const token = tokenDoEmail(mailer.enviados.at(-1)!);
    await post(CONTA_REDEFINIR_PATH, { token, senha: NOVA });
    const eventos = await auditoria();
    expect(eventos.some((e) => e.acao === 'senha_recuperacao_pedida' && e.ator === 'anonimo' && /^conta:\d+$/.test(e.alvo))).toBe(true);
    expect(eventos.some((e) => e.acao === 'senha_redefinida' && /^conta:\d+$/.test(e.ator))).toBe(true);
    const tudo = JSON.stringify(eventos) + linhas.join('\n');
    expect(tudo).not.toContain('audita@x.com');
    expect(tudo).not.toContain(token);
  });

  it('o provedor recusar o envio não muda a resposta (sempre 202) e o log diz que não enviou, sem o e-mail', async () => {
    await criar('falha@x.com');
    mailer.resultado = false;
    try {
      const base = mailer.enviados.length;
      expect((await post(CONTA_ESQUECI_PATH, { email: 'falha@x.com' })).status).toBe(202);
      expect(await ate(() => mailer.enviados.length === base + 1)).toBe(true);
      expect(await ate(() => linhas.some((l) => l.includes('NÃO enviado')))).toBe(true);
      expect(linhas.join('\n')).not.toContain('falha@x.com');
    } finally {
      mailer.resultado = true;
    }
  });
});

describe('os limites do "esqueci a senha"', () => {
  async function servidor(extra: Parameters<typeof startServer>[0] = {}) {
    const m = new MailerFalso();
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:', guard: { perIp: 100, total: 200, msgs: 200, burst: 200 }, limiteLogin: { teto: 1000 }, mailer: m, ...extra });
    const post = (p: string, corpo: unknown) => fetch(`http://127.0.0.1:${s.port}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
    return { s, m, post };
  }

  it('por conta: 3 pedidos por hora; o quarto responde 202 igual, mas nenhum e-mail novo sai', async () => {
    const { s, m, post } = await servidor({ limiteEsqueci: { teto: 1000 } });
    try {
      await post(CONTA_CRIAR_PATH, { email: 'limite@x.com', senha: SENHA, aceite: ACEITE_ATUAL });
      for (let i = 0; i < 5; i++) expect((await post(CONTA_ESQUECI_PATH, { email: 'limite@x.com' })).status).toBe(202);
      await ate(() => m.enviados.length >= 3);
      await ESPERA(200);
      expect(m.enviados.length).toBe(3);
    } finally {
      await s.close();
    }
  });

  it('por IP: depois do teto, 429', async () => {
    const { s, post } = await servidor({ limiteEsqueci: { teto: 2 } });
    try {
      expect((await post(CONTA_ESQUECI_PATH, { email: 'a@x.com' })).status).toBe(202);
      expect((await post(CONTA_ESQUECI_PATH, { email: 'b@x.com' })).status).toBe(202);
      expect((await post(CONTA_ESQUECI_PATH, { email: 'c@x.com' })).status).toBe(429);
    } finally {
      await s.close();
    }
  });

  it('sem e-mail configurado: 503 com o código "sem-email", sem criar link nenhum', async () => {
    const { s, post } = await servidor({ mailer: null });
    try {
      await post(CONTA_CRIAR_PATH, { email: 'sem@x.com', senha: SENHA, aceite: ACEITE_ATUAL });
      const r = await post(CONTA_ESQUECI_PATH, { email: 'sem@x.com' });
      expect(r.status).toBe(503);
      expect(((await r.json()) as { codigo: string }).codigo).toBe('sem-email');
    } finally {
      await s.close();
    }
  });

  it('o teto diário: depois de EMAILS_POR_DIA, não envia mais; no dia seguinte volta; é por dia de Brasília', () => {
    const t = new TetoDiario(3);
    const meioDia = Date.parse('2026-10-18T15:00:00Z');
    expect([t.tentar(meioDia), t.tentar(meioDia), t.tentar(meioDia), t.tentar(meioDia)]).toEqual([true, true, true, false]);
    expect(t.tentar(Date.parse('2026-10-19T02:59:00Z')), '23:59 de Brasília ainda é o mesmo dia').toBe(false);
    expect(t.tentar(Date.parse('2026-10-19T03:01:00Z')), 'passou da meia-noite de Brasília').toBe(true);
    expect(EMAILS_POR_DIA).toBeLessThan(100); // a cota grátis do Resend é 100 por dia
  });
});

describe('Contas: o link de redefinição', () => {
  it('vence em REDEFINIR_VALE_MIN minutos', async () => {
    const c = new Contas(':memory:');
    await c.criar('v@x.com', SENHA);
    const t0 = Date.parse('2026-10-18T12:00:00Z');
    const { token } = c.pedirRedefinicao('v@x.com', t0)!;
    expect((await c.redefinirSenha(token, NOVA, t0 + (REDEFINIR_VALE_MIN * 60 + 1) * 1000)).ok, 'um segundo depois do prazo').toBe(false);
    const { token: t2 } = c.pedirRedefinicao('v@x.com', t0)!;
    expect((await c.redefinirSenha(t2, NOVA, t0 + (REDEFINIR_VALE_MIN * 60 - 1) * 1000)).ok, 'um segundo antes do prazo').toBe(true);
  });

  it('duas trocas ao mesmo tempo com o mesmo link: só uma passa', async () => {
    const c = new Contas(':memory:');
    await c.criar('p@x.com', SENHA);
    const { token } = c.pedirRedefinicao('p@x.com')!;
    const [a, b] = await Promise.all([c.redefinirSenha(token, 'primeira-senha-1'), c.redefinirSenha(token, 'segunda-senha-2')]);
    expect([a.ok, b.ok].filter(Boolean).length).toBe(1);
    // e a senha que vale é a de quem passou
    const quem = a.ok ? 'primeira-senha-1' : 'segunda-senha-2';
    expect(await c.autenticar('p@x.com', quem)).not.toBeNull();
  });

  it('e-mail sem conta não gera token; a conta apagada leva o link junto; o banco guarda só a impressão digital', async () => {
    const c = new Contas(':memory:');
    expect(c.pedirRedefinicao('ninguem@x.com')).toBeNull();
    const r = await c.criar('apaga@x.com', SENHA);
    if (!r.ok) throw new Error('criar');
    const { token } = c.pedirRedefinicao('apaga@x.com')!;
    c.apagarConta(r.conta.id);
    expect((await c.redefinirSenha(token, NOVA)).ok).toBe(false);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('trocar a senha encerra TODAS as sessões da conta, não as dos outros', async () => {
    const c = new Contas(':memory:');
    const a = await c.criar('a@x.com', SENHA);
    const b = await c.criar('b@x.com', SENHA);
    if (!a.ok || !b.ok) throw new Error('criar');
    const sa1 = c.criarSessao(a.conta.id);
    const sa2 = c.criarSessao(a.conta.id);
    const sb = c.criarSessao(b.conta.id);
    const { token } = c.pedirRedefinicao('a@x.com')!;
    expect((await c.redefinirSenha(token, NOVA)).ok).toBe(true);
    expect(c.validarSessao(sa1)).toBeNull();
    expect(c.validarSessao(sa2)).toBeNull();
    expect(c.validarSessao(sb), 'a sessão de outra conta segue').not.toBeNull();
  });
});

describe('o contrato e a ferramenta do dono', () => {
  it('parseEsqueci normaliza o e-mail e cai no português para língua desconhecida; parseRedefinir separa token ruim de senha ruim', () => {
    expect(parseEsqueci({ email: ' Ana@X.COM ', lang: 'ja' })).toEqual({ email: 'ana@x.com', lang: 'ja' });
    expect(parseEsqueci({ email: 'ana@x.com', lang: 'klingon' })?.lang).toBe('pt');
    expect(parseEsqueci({ email: 'ana' })).toBeNull();
    const tokenBom = 'A'.repeat(43);
    expect(parseRedefinir({ token: tokenBom, senha: NOVA })).toEqual({ ok: true, token: tokenBom, senha: NOVA });
    expect(parseRedefinir({ token: 'curto', senha: NOVA })).toMatchObject({ ok: false, motivo: 'token' });
    expect(parseRedefinir({ token: tokenBom, senha: '1' })).toMatchObject({ ok: false, motivo: 'senha' });
  });

  it('as línguas do e-mail e da página de redefinição são exatamente as do jogo (língua nova no jogo sem e-mail dela quebra aqui)', () => {
    expect([...IDIOMAS_EMAIL].sort()).toEqual(IDIOMAS.map((i) => i.id).sort());
  });

  it('o link leva o token depois do # (fora do servidor e do Referer) e a língua na pergunta', () => {
    expect(urlDeRedefinicao('https://x.test///', 'T'.repeat(43), 'es')).toBe(`https://x.test/redefinir/?lang=es#${'T'.repeat(43)}`);
  });

  it('npm run admin -- link-senha gera o link do e-mail, audita sem o e-mail, e o link troca a senha', async () => {
    const c = new Contas(':memory:');
    await c.criar('dono-ajuda@x.com', SENHA);
    const a = new Auditoria(null, () => Date.now());
    const r = executarComandoAdmin(['link-senha', 'Dono-Ajuda@X.com'], c, a, 'https://exemplo.test');
    expect(r.codigo).toBe(0);
    const link = r.linhas.at(-1)!;
    expect(link).toMatch(/^https:\/\/exemplo\.test\/redefinir\/\?lang=pt#[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(a.recentes(5))).not.toContain('dono-ajuda');
    expect(a.recentes(5).some((e) => e.acao === 'link_senha_gerado' && e.ator === 'dono')).toBe(true);
    expect((await c.redefinirSenha(link.split('#')[1]!, NOVA)).ok).toBe(true);
    expect(executarComandoAdmin(['link-senha', 'nao@x.com'], c, a).codigo).toBe(1);
    expect(executarComandoAdmin(['link-senha', 'lixo'], c, a).codigo).toBe(2);
  });
});

describe('o e-mail', () => {
  it('as sete línguas têm texto completo: o link, o prazo preenchido e a frase de "se não foi você"', () => {
    for (const lang of IDIOMAS_EMAIL) {
      const e = emailDeRedefinicao(lang, 'https://x.test/redefinir/?lang=x#T');
      expect(e.texto, lang).toContain('https://x.test/redefinir/?lang=x#T');
      expect(e.texto, lang).toContain(String(REDEFINIR_VALE_MIN));
      expect(e.texto, lang).not.toContain('{min}');
      expect(e.assunto.startsWith('CYBERMECH'), lang).toBe(true);
      expect(e.html, lang).toContain('href="https://x.test/redefinir/?lang=x#T"');
    }
  });

  it('o HTML escapa o que vier no link (nada de injetar marcação)', () => {
    expect(emailDeRedefinicao('pt', 'https://x.test/?a="><script>').html).not.toContain('<script>');
  });

  it('MailerResend: chave no cabeçalho, destinatário em lista, `ok` só com resposta 2xx, e o log não leva a chave nem o e-mail', async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const linhas: string[] = [];
    const http = (async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return new Response('{}', { status: chamadas.length === 1 ? 200 : 403 });
    }) as unknown as typeof fetch;
    const m = new MailerResend('re_segredo_123', 'CYBERMECH <a@cybermech.online>', http, (l) => linhas.push(l));
    expect(await m.enviar({ para: 'p@x.com', assunto: 'A', texto: 'T' })).toBe(true);
    const c = chamadas[0]!;
    expect(c.url).toBe('https://api.resend.com/emails');
    expect((c.init.headers as Record<string, string>).authorization).toBe('Bearer re_segredo_123');
    expect(JSON.parse(c.init.body as string)).toMatchObject({ from: 'CYBERMECH <a@cybermech.online>', to: ['p@x.com'], subject: 'A', text: 'T' });
    expect(await m.enviar({ para: 'p@x.com', assunto: 'A', texto: 'T' })).toBe(false);
    expect(linhas.join('\n')).toContain('403');
    expect(linhas.join('\n')).not.toContain('re_segredo_123');
    expect(linhas.join('\n')).not.toContain('p@x.com');
    const cai = new MailerResend('k', 'a@x.com', (async () => { throw new Error('rede'); }) as typeof fetch);
    expect(await cai.enviar({ para: 'p@x.com', assunto: 'A', texto: 'T' }), 'rede caída: false, nunca lança').toBe(false);
  });

  it('carregarMailer: variável de ambiente, email.json, e configuração torta ou ausente devolve null com o motivo', () => {
    const pasta = resolve('.tmp', `teste-email-${process.pid}`);
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const dito: string[] = [];
    try {
      expect(carregarMailer(pasta, {}), 'sem nada').toBeNull();
      expect(carregarMailer(pasta, { CYBERMECH_EMAIL_CHAVE: 're_x' })).not.toBeNull();
      writeFileSync(resolve(pasta, EMAIL_ARQUIVO), '{ torto');
      expect(carregarMailer(pasta, {}, (l) => dito.push(l))).toBeNull();
      expect(dito.join()).toContain('não é JSON válido');
      writeFileSync(resolve(pasta, EMAIL_ARQUIVO), JSON.stringify({ provedor: 'resend', chave: 're_y', de: 'CYBERMECH <nao-responda@cybermech.online>' }));
      expect(carregarMailer(pasta, {})).not.toBeNull();
      writeFileSync(resolve(pasta, EMAIL_ARQUIVO), JSON.stringify({ provedor: 'resend', chave: 're_y', de: 'sem-formato <<>>' }));
      expect(carregarMailer(pasta, {}, (l) => dito.push(l))).toBeNull();
      expect(dito.join()).toContain('configuração incompleta');
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });
});
