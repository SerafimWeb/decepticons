import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BACKUP_REMOTO_ARQUIVO, CHAVE_EXEMPLO, caminhoRemotoSeguro, cifrar, configurar, decifrar, enviarBackupOffsite, type Executor } from './backupOffsite';

describe('caminhoRemotoSeguro: nunca sob public_html, nunca com o que o shell remoto possa interpretar', () => {
  it('aceita um caminho absoluto simples', () => {
    expect(caminhoRemotoSeguro('/home/usuario/backups-cybermech')).toBe(true);
  });
  it('recusa public_html (web-acessível), `..`, vazio, relativo e caractere de shell', () => {
    for (const c of ['/home/usuario/domains/cybermech.online/public_html/x', '/a/../b', '', 'relativo', "/a'b", '/a;rm -rf', '/a $(x)', '/a `x`', '/a\\x', '/a b', '/a*']) {
      expect(caminhoRemotoSeguro(c), c).toBe(false);
    }
  });
});

describe('cifrar/decifrar: AES-256-GCM com sal e IV por arquivo', () => {
  it('a volta chega igual ao original', () => {
    const original = Buffer.from('um banco de contas de mentira, com acentuação é, ã, ç');
    const pacote = cifrar(original, 'uma frase secreta bem longa');
    expect(decifrar(pacote, 'uma frase secreta bem longa').toString()).toBe(original.toString());
  });
  it('duas chamadas com a mesma frase produzem pacotes diferentes (sal e IV aleatórios)', () => {
    const d = Buffer.from('x');
    expect(cifrar(d, 'frase').equals(cifrar(d, 'frase'))).toBe(false);
  });
  it('a frase errada não decifra (a tag do GCM não confere)', () => {
    const pacote = cifrar(Buffer.from('segredo'), 'frase certa');
    expect(() => decifrar(pacote, 'frase errada')).toThrow();
  });
});

describe('configurar: lê backup-remoto.json da pasta de dados; desligado sem ele', () => {
  const pastas: string[] = [];
  const pasta = (): string => {
    const p = mkdtempSync(join(tmpdir(), 'cybermech-backup-offsite-'));
    pastas.push(p);
    return p;
  };
  afterEach(() => {
    for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
  });

  it('sem o arquivo, devolve null (recurso desligado, sem avisar nada de errado)', () => {
    const avisos: string[] = [];
    expect(configurar(pasta(), (l) => avisos.push(l))).toBeNull();
    expect(avisos).toEqual([]);
  });

  it('com o arquivo completo e o caminho seguro, devolve a configuração', () => {
    const dados = pasta();
    writeFileSync(join(dados, BACKUP_REMOTO_ARQUIVO), JSON.stringify({ host: 'h', user: 'u', key: '/k', path: '/home/u/backups-cybermech', chave: 'frase' }));
    expect(configurar(dados)).toMatchObject({ host: 'h', user: 'u', path: '/home/u/backups-cybermech' });
  });

  it('a frase de exemplo nunca liga o recurso (mesmo com o resto do arquivo certo)', () => {
    const dados = pasta();
    writeFileSync(join(dados, BACKUP_REMOTO_ARQUIVO), JSON.stringify({ host: 'h', user: 'u', key: '/k', path: '/home/u/backups-cybermech', chave: CHAVE_EXEMPLO }));
    const avisos: string[] = [];
    expect(configurar(dados, (l) => avisos.push(l))).toBeNull();
    expect(avisos[0]).toMatch(/frase de exemplo/);
  });

  it('campo faltando, JSON quebrado ou caminho sob public_html: null e um aviso (nunca lança)', () => {
    const casos = [
      { host: 'h', user: 'u', key: '/k', chave: 'frase' }, // sem path
      { host: 'h', user: 'u', key: '/k', path: '/x/public_html/y', chave: 'frase' },
    ];
    for (const j of casos) {
      const dados = pasta();
      writeFileSync(join(dados, BACKUP_REMOTO_ARQUIVO), JSON.stringify(j));
      const avisos: string[] = [];
      expect(configurar(dados, (l) => avisos.push(l))).toBeNull();
      expect(avisos).toHaveLength(1);
    }
    const quebrado = pasta();
    writeFileSync(join(quebrado, BACKUP_REMOTO_ARQUIVO), '{ não é json');
    expect(configurar(quebrado)).toBeNull();
  });
});

describe('enviarBackupOffsite: cifra, sobe por scp, poda pelo guardar — com o executor de mentira', () => {
  const pastas: string[] = [];
  const pasta = (): string => {
    const p = mkdtempSync(join(tmpdir(), 'cybermech-backup-offsite-envio-'));
    pastas.push(p);
    return p;
  };
  afterEach(() => {
    for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
  });

  it('chama scp com o arquivo cifrado e depois ssh para podar; o temporário some ao fim', async () => {
    const dados = pasta();
    const local = join(dados, 'contas-2026-10-22.db');
    writeFileSync(local, 'conteudo de mentira do banco');
    const chamadas: { cmd: string; args: readonly string[] }[] = [];
    const exec: Executor = async (cmd, args) => {
      chamadas.push({ cmd, args });
    };
    await enviarBackupOffsite(local, 'contas-2026-10-22.db', { host: 'h.exemplo.com', user: 'u', key: '/k', path: '/home/u/backups-cybermech', chave: 'frase', guardar: 5 }, exec);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[0]!.cmd).toBe('scp');
    expect(chamadas[0]!.args.join(' ')).toContain('u@h.exemplo.com:/home/u/backups-cybermech/contas-2026-10-22.db.enc');
    expect(chamadas[1]!.cmd).toBe('ssh');
    expect(chamadas[1]!.args.join(' ')).toContain('tail -n +6');
    // o cifrado temporário (local.enc) não sobrevive à chamada, bem ou mal sucedida
    expect(() => readFileSync(`${local}.enc`)).toThrow();
  });

  it('caminho remoto inseguro nunca chega a chamar scp/ssh', async () => {
    const dados = pasta();
    const local = join(dados, 'contas-2026-10-22.db');
    writeFileSync(local, 'x');
    const exec: Executor = async () => {
      throw new Error('não deveria ter chamado');
    };
    await expect(enviarBackupOffsite(local, 'contas-2026-10-22.db', { host: 'h', user: 'u', key: '/k', path: '/a/public_html/b', chave: 'f' }, exec)).rejects.toThrow(/inseguro/);
  });

  it('scp falhando ainda apaga o temporário e propaga o erro (quem chama só registra, nunca deixa o jogo cair)', async () => {
    const dados = pasta();
    const local = join(dados, 'contas-2026-10-22.db');
    writeFileSync(local, 'x');
    const exec: Executor = async (cmd) => {
      if (cmd === 'scp') throw new Error('rede fora');
    };
    await expect(enviarBackupOffsite(local, 'contas-2026-10-22.db', { host: 'h', user: 'u', key: '/k', path: '/home/u/backups-cybermech', chave: 'f' }, exec)).rejects.toThrow('rede fora');
    expect(() => readFileSync(`${local}.enc`)).toThrow();
  });
});
