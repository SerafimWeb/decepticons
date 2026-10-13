import { describe, expect, it } from 'vitest';
import { ARQUIVOS_DE_CONFERENCIA, comandosDeEnvio, compararSomas, devePublicar, lerSomas, validarConfig } from '../scripts/publicarSite.mjs';

const BOA = { host: 'servidor.exemplo.com', port: 65002, user: 'u123', path: '/home/u123/domains/selvamkt.com.br/public_html/cybermech', key: '~/.ssh/id_ed25519', url: 'https://www.selvamkt.com.br/cybermech/', gameServer: 'wss://jogo.selvamkt.com.br' };
const hash = (c: string) => c.repeat(64).slice(0, 64);

describe('publicar o site pelo PC (sem o GitHub Actions): a configuração e a trava do destino', () => {
  it('aceita a configuração completa e devolve os campos limpos (a barra do fim do caminho some)', () => {
    const r = validarConfig({ ...BOA, path: BOA.path + '/' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cfg).toEqual({ host: BOA.host, user: 'u123', port: 65002, path: BOA.path, key: '~/.ssh/id_ed25519', url: BOA.url, gameServer: BOA.gameServer });
    // key, url e gameServer são opcionais; a porta padrão é a do ssh.
    const minima = validarConfig({ host: 'h.exemplo.com', user: 'u', path: '/home/u/domains/x/public_html/cybermech' });
    expect(minima.ok && minima.cfg.port).toBe(22);
  });

  it('A TRAVA: o destino tem de terminar em /public_html/cybermech (a raiz do domínio é o site real da Selva MKT)', () => {
    for (const path of ['/home/u123/domains/selvamkt.com.br/public_html', '/home/u123/domains/selvamkt.com.br/public_html/', '/home/u123/domains/selvamkt.com.br/public_html/captia', '/home/u123/domains/selvamkt.com.br/public_html/cybermech/..', '/', '/home/u123/public_html/cybermech2']) {
      const r = validarConfig({ ...BOA, path });
      expect(r.ok, path).toBe(false);
    }
    const r = validarConfig({ ...BOA, path: '/home/u123/domains/selvamkt.com.br/public_html' });
    expect(!r.ok && r.erros.join(' ')).toMatch(/public_html\/cybermech/);
  });

  it('recusa o que o shell remoto poderia interpretar: aspas, espaços, ponto e vírgula, cifrão, crase, quebras de linha no host, usuário, caminho e chave', () => {
    const ruins = ["a b", "a;b", "a$(x)", 'a`b', "a'b", 'a"b', 'a\nb', 'a|b', 'a&b'];
    for (const ruim of ruins) {
      expect(validarConfig({ ...BOA, host: ruim }).ok, `host ${JSON.stringify(ruim)}`).toBe(false);
      expect(validarConfig({ ...BOA, user: ruim }).ok, `user ${JSON.stringify(ruim)}`).toBe(false);
      expect(validarConfig({ ...BOA, path: `/home/${ruim}/public_html/cybermech` }).ok, `path ${JSON.stringify(ruim)}`).toBe(false);
    }
    expect(validarConfig({ ...BOA, key: '/c/x"y' }).ok).toBe(false);
  });

  it('recusa o que falta ou está torto: configuração vazia, porta absurda, url sem https, servidor de jogo estranho; as frases não repetem o valor', () => {
    expect(validarConfig(null).ok).toBe(false);
    expect(validarConfig('texto').ok).toBe(false);
    expect(validarConfig({}).ok).toBe(false);
    for (const port of [0, -1, 70000, 'abc', 1.5]) expect(validarConfig({ ...BOA, port }).ok, `porta ${port}`).toBe(false);
    expect(validarConfig({ ...BOA, url: 'http://www.selvamkt.com.br/cybermech/' }).ok).toBe(false);
    expect(validarConfig({ ...BOA, gameServer: 'ftp://x' }).ok).toBe(false);
    const r = validarConfig({ ...BOA, host: 'segredo; rm -rf' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.join(' ')).not.toContain('segredo');
  });
});

describe('o envio: tar e ssh, cada argumento separado (nada passa por shell local)', () => {
  const r = validarConfig(BOA);
  const cfg = r.ok ? r.cfg : (null as never);

  it('empacota a pasta do site (com o cwd nela) e desempacota no destino, só dentro dele', () => {
    const c = comandosDeEnvio(cfg, 'D:/projeto/.tmp/site');
    expect(c.empacotar).toEqual({ programa: 'tar', args: ['-czf', '-', '.'], cwd: 'D:/projeto/.tmp/site' });
    expect(c.desempacotar.programa).toBe('ssh');
    const a = c.desempacotar.args;
    expect(a.slice(0, 2)).toEqual(['-p', '65002']);
    expect(a).toContain('BatchMode=yes'); // nunca pergunta senha: ou a chave vale, ou falha
    expect(a).toContain('StrictHostKeyChecking=yes'); // só o servidor que já conhecemos
    expect(a[a.indexOf('-i') + 1]).toBe('~/.ssh/id_ed25519');
    expect(a.at(-2)).toBe('u123@servidor.exemplo.com');
    expect(a.at(-1)).toBe(`mkdir -p '${BOA.path}' && cd '${BOA.path}' && tar -xzf -`);
    // O comando remoto só mexe no destino validado: não há `--delete`, `rm` nem caminho fora dele.
    expect(a.at(-1)).not.toMatch(/rm |--delete|\.\.\/|\/home\/u123\/domains\/selvamkt.com.br\/public_html'/);
  });

  it('sem chave configurada, não manda -i (o ssh usa as chaves do usuário); a conferência lê os checksums dos arquivos-chave no destino', () => {
    const sem = validarConfig({ ...BOA, key: undefined });
    const cfgSem = sem.ok ? sem.cfg : (null as never);
    expect(comandosDeEnvio(cfgSem, 'x').desempacotar.args).not.toContain('-i');
    const conf = comandosDeEnvio(cfg, 'x').conferir(ARQUIVOS_DE_CONFERENCIA);
    expect(conf.programa).toBe('ssh');
    expect(conf.args.at(-1)).toBe(`cd '${BOA.path}' && sha256sum 'index.html' 'jogar/index.html' 'sala-de-controle/index.html' '.htaccess'`);
  });
});

describe('conferir o que chegou e decidir se há o que publicar', () => {
  it('lê a saída do sha256sum (com ou sem o asterisco do modo binário) e ignora linhas estranhas', () => {
    const a = hash('a');
    const b = hash('b');
    expect(lerSomas(`${a}  index.html\n${b} *jogar/index.html\nlixo\n\nsha256sum: nao-existe: No such file\n`)).toEqual({ 'index.html': a, 'jogar/index.html': b });
    expect(lerSomas('')).toEqual({});
  });

  it('só dá por publicado se TODOS os arquivos-chave do PC são iguais aos do servidor; diz quais diferem', () => {
    const local: Record<string, string> = {};
    ARQUIVOS_DE_CONFERENCIA.forEach((a, i) => (local[a] = hash(String(i))));
    expect(compararSomas(local, { ...local })).toEqual({ ok: true, diferentes: [] });
    const remoto = { ...local, 'jogar/index.html': hash('f') };
    expect(compararSomas(local, remoto)).toEqual({ ok: false, diferentes: ['jogar/index.html'] });
    const faltando = { ...local };
    delete faltando['.htaccess'];
    expect(compararSomas(local, faltando).diferentes).toEqual(['.htaccess']);
    // Arquivo que o PC nem montou também reprova (nunca "iguais por estarem ausentes dos dois lados").
    expect(compararSomas({}, {}).ok).toBe(false);
  });

  it('--se-mudou: só publica quando a versão do código mudou desde a última publicação; sem a opção, sempre', () => {
    expect(devePublicar('abc123', null, true)).toBe(true); // nunca publicou
    expect(devePublicar('abc123', 'abc123\n', true)).toBe(false);
    expect(devePublicar('abc123', 'def456', true)).toBe(true);
    expect(devePublicar('abc123', 'abc123', false)).toBe(true); // à mão, publica mesmo igual
  });
});
