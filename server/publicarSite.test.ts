import { describe, expect, it } from 'vitest';
import { ARQUIVOS_DE_CONFERENCIA, PACOTE_DO_SITE, PACOTE_NO_SERVIDOR, assetsDoJogo, comandosDeEnvio, compararSomas, devePublicar, lerSomas, validarConfig } from '../scripts/publicarSite.mjs';

const BOA = { host: 'servidor.exemplo.com', port: 65002, user: 'u123', path: '/home/u123/domains/cybermech.online/public_html', key: '~/.ssh/id_ed25519', url: 'https://cybermech.online/', gameServer: 'wss://jogo.cybermech.online' };
const hash = (c: string) => c.repeat(64).slice(0, 64);

describe('publicar o site pelo PC (sem o GitHub Actions): a configuração e a trava do destino', () => {
  it('aceita a configuração completa e devolve os campos limpos (a barra do fim do caminho some)', () => {
    const r = validarConfig({ ...BOA, path: BOA.path + '/' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cfg).toEqual({ host: BOA.host, user: 'u123', port: 65002, path: BOA.path, key: '~/.ssh/id_ed25519', url: BOA.url, gameServer: BOA.gameServer });
    // key, url e gameServer são opcionais; a porta padrão é a do ssh.
    const minima = validarConfig({ host: 'h.exemplo.com', user: 'u', path: '/home/u/domains/cybermech.online/public_html' });
    expect(minima.ok && minima.cfg.port).toBe(22);
  });

  it('A TRAVA: o destino tem de terminar em /domains/cybermech.online/public_html (a pasta de outro domínio da conta, como o selvamkt.com.br, é o site real da Selva MKT)', () => {
    for (const path of ['/home/u123/domains/selvamkt.com.br/public_html', '/home/u123/domains/selvamkt.com.br/public_html/cybermech', '/home/u123/domains/selvamkt.com.br/public_html/captia', '/home/u123/domains/cybermech.online', '/home/u123/domains/cybermech.online/public_html/..', '/home/u123/domains/cybermech.online/public_html/cybermech', '/home/u123/domains/evil-cybermech.online/public_html', '/home/u123/domains/cybermech.online.evil/public_html', '/home/u123/public_html', '/']) {
      const r = validarConfig({ ...BOA, path });
      expect(r.ok, path).toBe(false);
    }
    const r = validarConfig({ ...BOA, path: '/home/u123/domains/selvamkt.com.br/public_html/cybermech' });
    expect(!r.ok && r.erros.join(' ')).toMatch(/domains\/cybermech\.online\/public_html/);
  });

  it('recusa o que o shell remoto poderia interpretar: aspas, espaços, ponto e vírgula, cifrão, crase, quebras de linha no host, usuário, caminho e chave', () => {
    const ruins = ["a b", "a;b", "a$(x)", 'a`b', "a'b", 'a"b', 'a\nb', 'a|b', 'a&b'];
    for (const ruim of ruins) {
      expect(validarConfig({ ...BOA, host: ruim }).ok, `host ${JSON.stringify(ruim)}`).toBe(false);
      expect(validarConfig({ ...BOA, user: ruim }).ok, `user ${JSON.stringify(ruim)}`).toBe(false);
      expect(validarConfig({ ...BOA, path: `/home/${ruim}/domains/cybermech.online/public_html` }).ok, `path ${JSON.stringify(ruim)}`).toBe(false);
    }
    expect(validarConfig({ ...BOA, key: '/c/x"y' }).ok).toBe(false);
  });

  it('recusa o que falta ou está torto: configuração vazia, porta absurda, url sem https, servidor de jogo estranho; as frases não repetem o valor', () => {
    expect(validarConfig(null).ok).toBe(false);
    expect(validarConfig('texto').ok).toBe(false);
    expect(validarConfig({}).ok).toBe(false);
    for (const port of [0, -1, 70000, 'abc', 1.5]) expect(validarConfig({ ...BOA, port }).ok, `porta ${port}`).toBe(false);
    expect(validarConfig({ ...BOA, url: 'http://cybermech.online/' }).ok).toBe(false);
    expect(validarConfig({ ...BOA, gameServer: 'ftp://x' }).ok).toBe(false);
    const r = validarConfig({ ...BOA, host: 'segredo; rm -rf' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.join(' ')).not.toContain('segredo');
  });
});

describe('o envio em duas fases: empacota no PC, sobe o arquivo inteiro, confere a soma e só então extrai', () => {
  const r = validarConfig(BOA);
  const cfg = r.ok ? r.cfg : (null as never);

  it('empacota a pasta do site com o cwd nela e escreve o pacote FORA dela (senão o pacote entraria em si mesmo)', () => {
    expect(comandosDeEnvio(cfg, 'D:/projeto/.tmp/site').empacotar).toEqual({ programa: 'tar', args: ['-czf', `../${PACOTE_DO_SITE}`, '.'], cwd: 'D:/projeto/.tmp/site' });
  });

  it('sobe o pacote pelo stdin do ssh, confere a soma dele lá e só então extrai — tudo dentro do destino validado', () => {
    const c = comandosDeEnvio(cfg, 'D:/projeto/.tmp/site');
    for (const passo of [c.enviarPacote, c.conferirPacote, c.extrair]) {
      expect(passo.programa).toBe('ssh');
      expect(passo.args.slice(0, 2)).toEqual(['-p', '65002']);
      expect(passo.args).toContain('BatchMode=yes'); // nunca pergunta senha: ou a chave vale, ou falha
      expect(passo.args).toContain('StrictHostKeyChecking=yes'); // só o servidor que já conhecemos
      expect(passo.args[passo.args.indexOf('-i') + 1]).toBe('~/.ssh/id_ed25519');
      expect(passo.args.at(-2)).toBe('u123@servidor.exemplo.com');
    }
    expect(c.enviarPacote.args.at(-1)).toBe(`cat > '${BOA.path}/${PACOTE_NO_SERVIDOR}'`);
    // A conferência entra na pasta antes do sha256sum: ele imprime o caminho que recebeu e `lerSomas` guarda a linha como ela sai — nome nu, igual ao
    // que a extração usa. Com o caminho inteiro, a chave não bate com o nome do arquivo e a publicação reprova um pacote que chegou certo (14/10).
    expect(c.conferirPacote.args.at(-1)).toBe(`cd '${BOA.path}' && sha256sum '${PACOTE_NO_SERVIDOR}'`);
    expect(lerSomas(`${'a'.repeat(64)}  ${PACOTE_NO_SERVIDOR}\n`)[PACOTE_NO_SERVIDOR]).toBe('a'.repeat(64));
    // A extração apaga o pacote SÓ depois de extrair (falhou, ele fica para a investigação) e anda só dentro do destino.
    expect(c.extrair.args.at(-1)).toBe(`cd '${BOA.path}' && tar -xzf '${PACOTE_NO_SERVIDOR}' && rm -f '${PACOTE_NO_SERVIDOR}'`);
    for (const passo of [c.enviarPacote, c.conferirPacote, c.extrair]) {
      expect(passo.args.at(-1)).not.toMatch(/--delete|\.\.\/|selvamkt/);
    }
  });

  it('sem chave configurada, não manda -i (o ssh usa as chaves do usuário); a conferência lê os checksums dos arquivos-chave no destino', () => {
    const sem = validarConfig({ ...BOA, key: undefined });
    const cfgSem = sem.ok ? sem.cfg : (null as never);
    expect(comandosDeEnvio(cfgSem, 'x').extrair.args).not.toContain('-i');
    const conf = comandosDeEnvio(cfg, 'x').conferir(ARQUIVOS_DE_CONFERENCIA);
    expect(conf.programa).toBe('ssh');
    expect(conf.args.at(-1)).toBe(`cd '${BOA.path}' && sha256sum ${ARQUIVOS_DE_CONFERENCIA.map((a) => `'${a}'`).join(' ')}`);
    expect(ARQUIVOS_DE_CONFERENCIA).toContain('privacidade/index.html'); // a política (P187) tem de chegar ao site como o resto
  });
});

describe('o que o navegador pede para abrir o jogo entra na conferência (a falha de 14/10)', () => {
  const HTML = `<!doctype html><html><head>
    <script type="module" crossorigin src="./assets/index-MEyQz7SO.js"></script>
    <link rel="modulepreload" crossorigin href="./assets/preload-helper-CV_M1NlO.js">
    <link rel="stylesheet" crossorigin href="./assets/index-Z07u_NGl.css">
    <link rel="stylesheet" crossorigin href="./assets/index-Z07u_NGl.css">
    <link rel="icon" href="data:,">
  </head><body></body></html>`;

  it('tira do index.html os assets do jogo, sem repetir, na ordem em que o navegador os pede e com o caminho a partir da raiz do site', () => {
    // O `index.html` do jogo mora em `jogar/`: o `./assets/x.js` dele é `jogar/assets/x.js` na raiz do site (era o erro de 14/10: a conferência
    // procurava `assets/x.js` na raiz, o servidor dizia "No such file or directory" e reprovava um pacote que chegou certo).
    expect(assetsDoJogo(HTML)).toEqual(['jogar/assets/index-MEyQz7SO.js', 'jogar/assets/preload-helper-CV_M1NlO.js', 'jogar/assets/index-Z07u_NGl.css']);
    expect(assetsDoJogo(HTML, 'outra/pasta/')).toEqual(['outra/pasta/assets/index-MEyQz7SO.js', 'outra/pasta/assets/preload-helper-CV_M1NlO.js', 'outra/pasta/assets/index-Z07u_NGl.css']);
    expect(assetsDoJogo(HTML, 'pasta torta; rm -rf /')).toEqual(['jogar/assets/index-MEyQz7SO.js', 'jogar/assets/preload-helper-CV_M1NlO.js', 'jogar/assets/index-Z07u_NGl.css']);
  });

  it('ignora endereço que não é asset local (o data:, um site de fora) e o que tem caractere que o shell remoto poderia interpretar', () => {
    const sujo = `<script src="https://outro.exemplo/x.js"></script><img src="./assets/foto.png"><script src="./assets/a b.js"></script><script src="./assets/a'b.js"></script><script src="./assets/a;b.js"></script>`;
    expect(assetsDoJogo(sujo)).toEqual(['jogar/assets/foto.png']);
    expect(assetsDoJogo('')).toEqual([]);
    expect(assetsDoJogo('<script src="./assets/index.js"></script>')).toEqual(['jogar/assets/index.js']);
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
