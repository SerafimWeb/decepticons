import { mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CONFIG_SMTP_EXEMPLO, EMAIL_ARQUIVO, MailerDaPasta, MailerSmtp, SENHA_DE_EXEMPLO, carregarMailer, enderecoDe, montarMensagem } from './email';
import { executarEmail } from './emailCli';

/**
 * O envio por SMTP (P206): um cliente escrito à mão com `node:tls`, provado contra um servidor SMTP de mentira (um socket de verdade que fala o protocolo e guarda tudo o que recebeu),
 * mais a configuração que o Comandante edita no Bloco de Notas e a ferramenta `npm run email`.
 */
const raiz = resolve('.tmp', `teste-email-smtp-${process.pid}`);
afterAll(() => rmSync(raiz, { recursive: true, force: true }));

interface Sessao {
  ehlo: string;
  auth: string;
  from: string;
  to: string;
  data: string;
  comandos: string[];
}
function servidorSmtp(o: { auth?: 'PLAIN' | 'LOGIN'; authFalha?: boolean; rcpt?: number; mudo?: boolean } = {}) {
  const sessoes: Sessao[] = [];
  const srv = net.createServer((sock) => {
    sock.setEncoding('utf8');
    const s: Sessao = { ehlo: '', auth: '', from: '', to: '', data: '', comandos: [] };
    sessoes.push(s);
    let buf = '';
    let dados = false;
    let loginPasso = 0;
    const dizer = (t: string) => sock.write(`${t}\r\n`);
    if (!o.mudo) dizer('220 fake ESMTP pronto');
    sock.on('data', (d: string) => {
      buf += d;
      for (;;) {
        if (dados) {
          const fim = buf.indexOf('\r\n.\r\n');
          if (fim < 0) return;
          s.data = buf.slice(0, fim + 2);
          buf = buf.slice(fim + 5);
          dados = false;
          dizer('250 2.0.0 aceito para entrega');
          continue;
        }
        const i = buf.indexOf('\r\n');
        if (i < 0) return;
        const linha = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (loginPasso > 0) {
          s.auth += `${Buffer.from(linha, 'base64').toString()}|`;
          loginPasso++;
          dizer(loginPasso === 2 ? '334 UGFzc3dvcmQ6' : o.authFalha ? '535 5.7.8 falhou' : '235 2.7.0 ok');
          if (loginPasso >= 3) loginPasso = 0;
          continue;
        }
        s.comandos.push(linha.split(' ')[0]!);
        if (/^EHLO /i.test(linha)) {
          s.ehlo = linha.slice(5);
          sock.write(`250-fake.local\r\n250-AUTH ${o.auth === 'LOGIN' ? 'LOGIN' : 'PLAIN LOGIN'}\r\n250 8BITMIME\r\n`);
        } else if (/^AUTH PLAIN /i.test(linha)) {
          s.auth = Buffer.from(linha.slice(11), 'base64').toString();
          dizer(o.authFalha ? '535 5.7.8 usuário ou senha incorretos' : '235 2.7.0 autenticado');
        } else if (/^AUTH LOGIN/i.test(linha)) {
          loginPasso = 1;
          dizer('334 VXNlcm5hbWU6');
        } else if (/^MAIL FROM:/i.test(linha)) {
          s.from = /<(.*)>/.exec(linha)![1]!;
          dizer('250 ok');
        } else if (/^RCPT TO:/i.test(linha)) {
          s.to = /<(.*)>/.exec(linha)![1]!;
          dizer(`${o.rcpt ?? 250} destinatário`);
        } else if (/^DATA/i.test(linha)) {
          dizer('354 envie');
          dados = true;
        } else if (/^QUIT/i.test(linha)) {
          dizer('221 tchau');
          sock.end();
        } else dizer('502 comando desconhecido');
      }
    });
    sock.on('error', () => {});
  });
  return new Promise<{ porta: number; sessoes: Sessao[]; fechar: () => Promise<void>; conectar: () => net.Socket }>((ok) => {
    srv.listen(0, '127.0.0.1', () => {
      const porta = (srv.address() as net.AddressInfo).port;
      ok({ porta, sessoes, fechar: () => new Promise<void>((r) => srv.close(() => r())), conectar: () => net.connect(porta, '127.0.0.1') });
    });
  });
}

const CFG = { host: 'smtp.exemplo.test', porta: 465, usuario: 'nao-responda@cybermech.online', senha: 'senha-secreta-123', de: 'CYBERMECH <nao-responda@cybermech.online>' };
const decodificar = (s: string) => Buffer.from(s.replace(/\r\n/g, ''), 'base64').toString('utf8');

describe('MailerSmtp contra um servidor SMTP de mentira', () => {
  it('fala o protocolo inteiro: EHLO, AUTH PLAIN, MAIL FROM, RCPT TO, DATA com texto e HTML acentuados (a língua não importa), QUIT', async () => {
    const s = await servidorSmtp();
    try {
      const log: string[] = [];
      const m = new MailerSmtp(CFG, (l) => log.push(l), s.conectar, 5000, () => Date.parse('2026-10-19T03:00:00Z'));
      const texto = 'Piloto,\nredefina a senha: https://cybermech.online/redefinir/?lang=ja#TOKEN\n日本語 · Русский · español ñ é\n.linha que começa com ponto\n';
      expect(await m.enviar({ para: 'ana@x.com', assunto: 'CYBERMECH: パスワードの再設定 ✓', texto, html: '<p>Olá, <b>ação</b></p>' })).toBe(true);
      const e = s.sessoes[0]!;
      expect(e.ehlo).toBe('cybermech.online');
      expect(e.auth, 'AUTH PLAIN: \\0usuário\\0senha').toBe('\0nao-responda@cybermech.online\0senha-secreta-123');
      expect(e.from).toBe('nao-responda@cybermech.online');
      expect(e.to).toBe('ana@x.com');
      expect(e.comandos).toEqual(['EHLO', 'AUTH', 'MAIL', 'RCPT', 'DATA', 'QUIT']);
      // O corpo: cabeçalhos certos, assunto codificado, e as duas partes saem inteiras da base64.
      const cab = e.data.slice(0, e.data.indexOf('\r\n\r\n'));
      expect(cab).toContain('From: CYBERMECH <nao-responda@cybermech.online>');
      expect(cab).toContain('To: <ana@x.com>');
      expect(cab).toContain('Date: Mon, 19 Oct 2026 03:00:00 +0000');
      expect(cab).toMatch(/Message-ID: <[0-9a-f]{24}@cybermech\.online>/);
      expect(cab).toContain('Auto-Submitted: auto-generated');
      expect(decodificar(/Subject: =\?UTF-8\?B\?(.*?)\?=/.exec(cab)![1]!)).toBe('CYBERMECH: パスワードの再設定 ✓');
      const partes = [...e.data.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/g)].map((p) => decodificar(p[1]!));
      expect(partes).toEqual([texto, '<p>Olá, <b>ação</b></p>']);
      expect(e.data.split('\r\n').every((l) => l.length <= 998), 'nenhuma linha passa do limite do e-mail').toBe(true);
      expect(log.join(), 'sem erro nenhum').toBe('');
    } finally {
      await s.fechar();
    }
  });

  it('um servidor que só anuncia AUTH LOGIN: usa o LOGIN em três passos', async () => {
    const s = await servidorSmtp({ auth: 'LOGIN' });
    try {
      expect(await new MailerSmtp(CFG, () => {}, s.conectar, 5000).enviar({ para: 'ana@x.com', assunto: 'A', texto: 'T' })).toBe(true);
      expect(s.sessoes[0]!.auth).toBe('nao-responda@cybermech.online|senha-secreta-123|');
    } finally {
      await s.fechar();
    }
  });

  it('senha recusada (535): false, o log diz o passo e o código e NÃO leva a senha nem o e-mail de ninguém', async () => {
    const s = await servidorSmtp({ authFalha: true });
    try {
      const log: string[] = [];
      expect(await new MailerSmtp(CFG, (l) => log.push(l), s.conectar, 5000).enviar({ para: 'ana@x.com', assunto: 'A', texto: 'T' })).toBe(false);
      expect(log.join()).toContain('autenticação');
      expect(log.join()).toContain('535');
      expect(log.join()).not.toContain('senha-secreta-123');
      expect(log.join()).not.toContain('ana@x.com');
      expect(s.sessoes[0]!.comandos, 'parou na autenticação: nem tentou enviar').toEqual(['EHLO', 'AUTH']);
    } finally {
      await s.fechar();
    }
  });

  it('destinatário recusado (550): false no passo "destinatário"', async () => {
    const s = await servidorSmtp({ rcpt: 550 });
    try {
      const log: string[] = [];
      expect(await new MailerSmtp(CFG, (l) => log.push(l), s.conectar, 5000).enviar({ para: 'ana@x.com', assunto: 'A', texto: 'T' })).toBe(false);
      expect(log.join()).toContain('destinatário');
      expect(log.join()).toContain('550');
    } finally {
      await s.fechar();
    }
  });

  it('servidor mudo: estoura o tempo e devolve false (nunca trava o servidor do jogo); porta fechada: false no passo "conexão"', async () => {
    const mudo = await servidorSmtp({ mudo: true });
    try {
      const log: string[] = [];
      const t0 = Date.now();
      expect(await new MailerSmtp(CFG, (l) => log.push(l), mudo.conectar, 300).enviar({ para: 'ana@x.com', assunto: 'A', texto: 'T' })).toBe(false);
      expect(Date.now() - t0).toBeLessThan(2000);
      expect(log.join()).toContain('tempo');
    } finally {
      await mudo.fechar();
    }
    const fechado = await servidorSmtp();
    const porta = fechado.porta;
    await fechado.fechar();
    const log2: string[] = [];
    expect(await new MailerSmtp(CFG, (l) => log2.push(l), () => net.connect(porta, '127.0.0.1'), 3000).enviar({ para: 'ana@x.com', assunto: 'A', texto: 'T' })).toBe(false);
    expect(log2.join()).toContain('conexão');
  });

  it('injeção de cabeçalho: destinatário com quebra de linha ou vírgula nem abre conexão; assunto com quebra vira texto, não cabeçalho', async () => {
    const s = await servidorSmtp();
    try {
      const log: string[] = [];
      const m = new MailerSmtp(CFG, (l) => log.push(l), s.conectar, 5000);
      for (const ruim of ['a@b.com\r\nBcc: x@y.com', 'a@b.com,x@y.com', 'a@b.com>\r\nX: y', 'sem-arroba', '', 'a b@c.com']) {
        expect(await m.enviar({ para: ruim, assunto: 'A', texto: 'T' }), JSON.stringify(ruim)).toBe(false);
      }
      expect(s.sessoes.length, 'nenhuma conexão foi aberta').toBe(0);
      expect(await m.enviar({ para: 'ana@x.com', assunto: 'oi\r\nBcc: x@y.com', texto: 'T' })).toBe(true);
      const e = s.sessoes[0]!;
      expect(e.data).not.toMatch(/^Bcc:/m);
      expect(decodificar(/Subject: =\?UTF-8\?B\?(.*?)\?=/.exec(e.data)![1]!)).toBe('oi Bcc: x@y.com');
    } finally {
      await s.fechar();
    }
  });
});

describe('montarMensagem e enderecoDe', () => {
  it('sem HTML sai uma parte só (texto em base64); com HTML, multipart/alternative com a fronteira certa; nenhuma linha começa com ponto', () => {
    const base = { de: 'CYBERMECH <a@cybermech.online>', para: 'p@x.com', assunto: 'A', texto: '.\n.ponto\n'.repeat(30), agora: 0, id: 'abc', fronteira: 'FRONTEIRA' };
    const so = montarMensagem(base);
    expect(so).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(so).not.toContain('multipart');
    const alt = montarMensagem({ ...base, html: '<p>x</p>' });
    expect(alt).toContain('multipart/alternative; boundary="FRONTEIRA"');
    expect(alt).toContain('--FRONTEIRA--');
    for (const m of [so, alt]) expect(m.split('\r\n').some((l) => l.startsWith('.'))).toBe(false);
  });

  it('o endereço do remetente vem de dentro dos < >, ou é o próprio texto', () => {
    expect(enderecoDe('CYBERMECH <nao-responda@cybermech.online>')).toBe('nao-responda@cybermech.online');
    expect(enderecoDe('a@b.co')).toBe('a@b.co');
  });
});

describe('a configuração do e-mail (email.json)', () => {
  const pasta = (nome: string) => {
    const d = resolve(raiz, nome);
    rmSync(d, { recursive: true, force: true });
    mkdirSync(d, { recursive: true });
    return d;
  };
  const gravar = (dir: string, cfg: unknown) => writeFileSync(resolve(dir, EMAIL_ARQUIVO), JSON.stringify(cfg));

  it('SMTP válido carrega; senha de exemplo, campo faltando, porta, host ou remetente tortos devolvem null com o motivo', () => {
    const d = pasta('cfg');
    const dito: string[] = [];
    gravar(d, { provedor: 'smtp', ...CFG });
    expect(carregarMailer(d, {}, (l) => dito.push(l))).not.toBeNull();
    const torto: [Record<string, unknown>, string][] = [
      [{ ...CFG, senha: SENHA_DE_EXEMPLO }, 'valor de exemplo'],
      [{ ...CFG, usuario: '' }, 'incompleta'],
      [{ ...CFG, porta: 0 }, 'incompleta'],
      [{ ...CFG, porta: 70000 }, 'incompleta'],
      [{ ...CFG, host: 'smtp.exemplo.test/../x' }, 'incompleta'],
      [{ ...CFG, host: 'a b' }, 'incompleta'],
      [{ ...CFG, de: 'sem formato <<>>' }, 'incompleta'],
    ];
    for (const [cfg, motivo] of torto) {
      const log: string[] = [];
      gravar(d, { provedor: 'smtp', ...cfg });
      expect(carregarMailer(d, {}, (l) => log.push(l)), JSON.stringify(cfg)).toBeNull();
      expect(log.join(), JSON.stringify(cfg)).toContain(motivo);
    }
  });

  it('o MailerDaPasta relê o arquivo quando ele muda: ligar o e-mail não exige reiniciar o servidor', async () => {
    const s = await servidorSmtp();
    try {
      const d = pasta('relê');
      const log: string[] = [];
      const m = new MailerDaPasta(d, {}, (l) => log.push(l), undefined, s.conectar);
      expect(m.configurado(), 'sem arquivo').toBe(false);
      expect(await m.enviar({ para: 'ana@x.com', assunto: 'A', texto: 'T' })).toBe(false);
      gravar(d, { provedor: 'smtp', ...CFG, senha: SENHA_DE_EXEMPLO });
      expect(m.configurado(), 'com a senha de exemplo ainda não vale').toBe(false);
      expect(log.join()).toContain('valor de exemplo');
      gravar(d, { provedor: 'smtp', ...CFG });
      expect(m.configurado(), 'o dono trocou a senha e salvou').toBe(true);
      expect(await m.enviar({ para: 'ana@x.com', assunto: 'A', texto: 'T' })).toBe(true);
      expect(s.sessoes[0]!.auth).toContain('senha-secreta-123');
      // mudar a senha de novo (mesmo tamanho, instante diferente): a próxima mensagem já usa a nova.
      writeFileSync(resolve(d, EMAIL_ARQUIVO), readFileSync(resolve(d, EMAIL_ARQUIVO), 'utf8').replace('senha-secreta-123', 'outra-senha-1234'));
      utimesSync(resolve(d, EMAIL_ARQUIVO), new Date(), new Date(Date.now() + 5000));
      expect(await m.enviar({ para: 'ana@x.com', assunto: 'A', texto: 'T' })).toBe(true);
      expect(s.sessoes[1]!.auth).toContain('outra-senha-1234');
      // apagar o arquivo desliga.
      rmSync(resolve(d, EMAIL_ARQUIVO));
      expect(m.configurado()).toBe(false);
    } finally {
      await s.fechar();
    }
  });
});

describe('npm run email: iniciar, estado e testar', () => {
  const pasta = (nome: string) => {
    const d = resolve(raiz, nome);
    rmSync(d, { recursive: true, force: true });
    return d;
  };

  it('iniciar cria o arquivo de exemplo UMA vez (não sobrescreve), com a Hostinger preenchida e a senha de exemplo; o servidor o trata como "ainda não"', async () => {
    const d = pasta('cli-iniciar');
    const a = await executarEmail(['iniciar'], d);
    expect(a.codigo).toBe(0);
    expect(a.linhas.join('\n')).toContain(SENHA_DE_EXEMPLO);
    const cfg = JSON.parse(readFileSync(resolve(d, EMAIL_ARQUIVO), 'utf8')) as typeof CONFIG_SMTP_EXEMPLO;
    expect(cfg).toEqual(CONFIG_SMTP_EXEMPLO);
    expect(cfg.host).toBe('smtp.hostinger.com');
    expect(carregarMailer(d, {})).toBeNull();
    writeFileSync(resolve(d, EMAIL_ARQUIVO), '{"minha":"edicao"}');
    const b = await executarEmail(['iniciar'], d);
    expect(b.codigo).toBe(1);
    expect(readFileSync(resolve(d, EMAIL_ARQUIVO), 'utf8'), 'a edição do dono sobrevive').toBe('{"minha":"edicao"}');
  });

  it('estado diz o que está configurado sem mostrar a senha, e acusa a senha de exemplo e o JSON torto', async () => {
    const d = pasta('cli-estado');
    expect((await executarEmail(['estado'], d)).codigo).toBe(1);
    mkdirSync(d, { recursive: true });
    writeFileSync(resolve(d, EMAIL_ARQUIVO), JSON.stringify({ provedor: 'smtp', ...CFG, senha: SENHA_DE_EXEMPLO }));
    const exemplo = await executarEmail(['estado'], d);
    expect(exemplo.codigo).toBe(1);
    expect(exemplo.linhas.join('\n')).toContain('AINDA É O EXEMPLO');
    writeFileSync(resolve(d, EMAIL_ARQUIVO), JSON.stringify({ provedor: 'smtp', ...CFG }));
    const ok = await executarEmail(['estado'], d);
    expect(ok.codigo).toBe(0);
    expect(ok.linhas.join('\n')).toContain('smtp.exemplo.test:465');
    expect(ok.linhas.join('\n')).not.toContain('senha-secreta-123');
    writeFileSync(resolve(d, EMAIL_ARQUIVO), '{ torto');
    expect((await executarEmail(['estado'], d)).linhas.join()).toContain('não é JSON válido');
  });

  it('testar manda a mensagem de verdade pelo caminho do servidor; se falhar, a dica diz o que conferir', async () => {
    const bom = await servidorSmtp();
    const ruim = await servidorSmtp({ authFalha: true });
    try {
      const d = pasta('cli-testar');
      mkdirSync(d, { recursive: true });
      writeFileSync(resolve(d, EMAIL_ARQUIVO), JSON.stringify({ provedor: 'smtp', ...CFG }));
      const ok = await executarEmail(['testar', 'ana@x.com'], d, { conectar: bom.conectar });
      expect(ok.codigo).toBe(0);
      expect(ok.linhas.join('\n')).toContain('enviado para ana@x.com');
      expect(bom.sessoes[0]!.to).toBe('ana@x.com');
      const falha = await executarEmail(['testar', 'ana@x.com'], d, { conectar: ruim.conectar });
      expect(falha.codigo).toBe(1);
      expect(falha.linhas.join('\n')).toContain('NÃO enviou');
      expect(falha.linhas.join('\n')).toContain('recusou o usuário ou a senha');
      expect(falha.linhas.join('\n')).not.toContain('senha-secreta-123');
      expect((await executarEmail(['testar', 'lixo'], d)).codigo).toBe(2);
      expect((await executarEmail(['testar'], d)).codigo).toBe(2);
      expect((await executarEmail(['nada'], d)).codigo).toBe(2);
      const sem = pasta('cli-testar-sem');
      const nada = await executarEmail(['testar', 'ana@x.com'], sem);
      expect(nada.codigo).toBe(1);
      expect(nada.linhas.join('\n')).toContain('npm run email -- iniciar');
    } finally {
      await bom.fechar();
      await ruim.fechar();
    }
  });
});
