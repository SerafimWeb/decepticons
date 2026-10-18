/**
 * A parte pura da publicação do site pelo PC do Comandante (13/10, P105: "publicação automática, facilitada, eficiente e gratuita; não quer pagar o GitHub"):
 * ler a configuração, travar o destino, montar os comandos, decidir se há o que publicar e conferir o que chegou. Nada aqui abre rede, disco ou processo:
 * quem roda (`scripts/publicar-site.mjs`) injeta isso, e `server/publicarSite.test.ts` cobre tudo.
 *
 * **A configuração fica fora do repositório** (R2/R10: nenhum host, usuário ou caminho do servidor no git): um JSON na pasta de dados do servidor (a mesma do
 * `contas.db`, que a atualização automática nunca apaga): `{ "host": "…", "port": 65002, "user": "…", "path": "/home/<usuario>/domains/cybermech.online/public_html", "key": "~/.ssh/id_ed25519" }`.
 * **Trava (a mesma do deploy do Actions):** o destino tem de terminar em `/domains/cybermech.online/public_html`, a raiz do domínio do jogo (desde 15/10 o site mora no domínio
 * próprio, e não mais em `selvamkt.com.br/cybermech/`). A pasta de qualquer outro domínio da conta, em especial a do `selvamkt.com.br` (o site real da Selva MKT), é recusada.
 *
 * **O envio em duas fases (14/10, a lição do site meio publicado):** o pacote sobe INTEIRO para dentro do destino, a soma dele no servidor é conferida contra a do
 * PC e **só então** ele é extraído. Antes, o `tar` do PC extraía no servidor enquanto transmitia (um cano só): quando a conexão era cortada no meio, o `index.html`
 * novo já tinha aterrissado e os `assets/` de nome com hash não — o jogo abria com 404 em todos os scripts. Um arquivo inteiro e conferido não tem meio caminho.
 *
 * **Duas fases, três comandos:** o `tar` empacota no PC (o pacote sai FORA da pasta do site, senão entraria nele mesmo), `cat >` sobe o arquivo, `sha256sum` confere
 * a soma no servidor e `tar -xzf` extrai. Cada argumento é um item de lista: nada passa por shell local; do outro lado só o caminho validado é tocado.
 */

/** O destino é só o que o site do jogo usa: letras, números, ponto, hífen, sublinhado e barra (nada que o shell remoto interprete). */
const CAMINHO_SEGURO = /^\/[A-Za-z0-9._\-/]+$/;
/** A única pasta em que o site do jogo pode ser publicado: a raiz do `cybermech.online` na conta da Hostinger. */
export const PASTA_DO_SITE = '/domains/cybermech.online/public_html';
const HOST_SEGURO = /^[A-Za-z0-9.\-]+$/;
const USUARIO_SEGURO = /^[A-Za-z0-9._\-]+$/;

/** O pacote montado no PC (um nível acima da pasta do site) e o nome com que ele espera no servidor, já dentro do destino. */
export const PACOTE_DO_SITE = 'site-pacote.tgz';
export const PACOTE_NO_SERVIDOR = '.publicar-site.tgz';

/**
 * Valida a configuração. Devolve `{ ok: true, cfg }` ou `{ ok: false, erros }` (frases para a tela, sem repetir valor nenhum).
 * @param {unknown} bruto o JSON já lido
 */
export function validarConfig(bruto) {
  const erros = [];
  const c = bruto && typeof bruto === 'object' ? /** @type {Record<string, unknown>} */ (bruto) : {};
  const texto = (k) => (typeof c[k] === 'string' ? /** @type {string} */ (c[k]).trim() : '');
  const host = texto('host');
  const user = texto('user');
  const caminho = texto('path').replace(/\/+$/, '');
  const porta = c.port === undefined ? 22 : Number(c.port);
  if (!host || !HOST_SEGURO.test(host)) erros.push('"host" falta ou tem caractere estranho');
  if (!user || !USUARIO_SEGURO.test(user)) erros.push('"user" falta ou tem caractere estranho');
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) erros.push('"port" tem de ser um número de 1 a 65535');
  if (!caminho || !CAMINHO_SEGURO.test(caminho)) erros.push('"path" falta ou tem caractere estranho');
  else if (!caminho.endsWith(PASTA_DO_SITE)) erros.push(`"path" tem de terminar em ${PASTA_DO_SITE} (a pasta de outro domínio da conta, como a raiz do selvamkt.com.br, é o site real da Selva MKT: nunca publicar nela)`);
  const chave = texto('key');
  if (chave && /[\0\n\r"']/.test(chave)) erros.push('"key" tem caractere estranho');
  const url = texto('url');
  if (url && !/^https:\/\/[A-Za-z0-9.\-/]+\/?$/.test(url)) erros.push('"url" tem de ser um endereço https');
  const servidor = texto('gameServer');
  if (servidor && !/^(wss?|https?):\/\/[A-Za-z0-9.\-]+(:\d+)?\/?$/.test(servidor)) erros.push('"gameServer" tem de ser um endereço ws, wss, http ou https de servidor de jogo');
  if (erros.length) return { ok: false, erros };
  return { ok: true, cfg: { host, user, port: porta, path: caminho, key: chave || undefined, url: url || undefined, gameServer: servidor || undefined } };
}

/**
 * Os comandos do envio em duas fases. O `tar` roda no PC (com o `cwd` na pasta do site: o tar do Git trata "D:\\pasta" como "máquina D"), empacota a pasta e
 * escreve o pacote **um nível acima dela** (`../`, senão o pacote entraria dentro de si mesmo); o `ssh` sobe o arquivo, confere a soma e, por último, extrai.
 * Só espelha o que há (não apaga o que saiu do build: apagar é decisão à parte, e nunca fora da pasta do jogo).
 * @param {{ host: string, user: string, port: number, path: string, key?: string }} cfg
 * @param {string} pastaDoSite a pasta montada (`.tmp/site`)
 */
export function comandosDeEnvio(cfg, pastaDoSite) {
  const ssh = ['-p', String(cfg.port), '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'StrictHostKeyChecking=yes'];
  if (cfg.key) ssh.push('-i', cfg.key);
  const noServidor = `${cfg.path}/${PACOTE_NO_SERVIDOR}`;
  return {
    empacotar: { programa: 'tar', args: ['-czf', `../${PACOTE_DO_SITE}`, '.'], cwd: pastaDoSite },
    // O pacote sobe pelo `stdin` do ssh (o chamador manda os bytes do arquivo): nenhum caminho de shell local.
    enviarPacote: { programa: 'ssh', args: [...ssh, `${cfg.user}@${cfg.host}`, `cat > '${noServidor}'`] },
    // O `cd` não é enfeite: o `sha256sum` imprime o caminho que recebeu, e `lerSomas` guarda a linha como ela sai — então o nome tem de ser o do arquivo,
    // igual ao da extração, senão a conferência compara chaves diferentes e reprova um pacote que chegou certo (achado no primeiro teste real, 14/10).
    conferirPacote: { programa: 'ssh', args: [...ssh, `${cfg.user}@${cfg.host}`, `cd '${cfg.path}' && sha256sum '${PACOTE_NO_SERVIDOR}'`] },
    // Extrai o arquivo JÁ conferido e apaga o pacote; limpa o pacote só depois de extrair (falhou, fica para a investigação).
    extrair: { programa: 'ssh', args: [...ssh, `${cfg.user}@${cfg.host}`, `cd '${cfg.path}' && tar -xzf '${PACOTE_NO_SERVIDOR}' && rm -f '${PACOTE_NO_SERVIDOR}'`] },
    conferir: (arquivos) => ({ programa: 'ssh', args: [...ssh, `${cfg.user}@${cfg.host}`, `cd '${cfg.path}' && sha256sum ${arquivos.map((a) => `'${a}'`).join(' ')}`] }),
  };
}

/** `sha256sum` imprime `<hash>  <arquivo>` por linha: vira um mapa arquivo → hash. */
export function lerSomas(saida) {
  /** @type {Record<string, string>} */
  const m = {};
  for (const l of String(saida).split('\n')) {
    const r = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(l.trim());
    if (r) m[r[2]] = r[1];
  }
  return m;
}

/**
 * Os arquivos que dizem se o site novo chegou (a landing, o jogo, o painel e o `.htaccess`). Quem chama junta a esta lista os `assets/` que o próprio
 * `jogar/index.html` pede (`assetsDoJogo`): era exatamente o que faltava quando o site caiu (14/10) e a conferência de então não olhava para eles.
 */
export const ARQUIVOS_DE_CONFERENCIA = ['index.html', 'jogar/index.html', 'sala-de-controle/index.html', 'privacidade/index.html', '.htaccess'];

/**
 * Os `assets/` que o jogo publicado pede (o que o navegador baixa para abrir a página), na ordem em que aparecem, sem repetir. Devolve o caminho **a partir da raiz do
 * site** — os endereços do `jogar/index.html` são relativos a ele (`./assets/x.js` é `jogar/assets/x.js` na raiz); foi assim que a conferência reprovou um pacote
 * que chegou certo no primeiro teste real (14/10: ela procurava `assets/x.js` na raiz). Nome estranho não entra: a lista vai para dentro de um comando remoto,
 * então só passam letras, números, ponto, sublinhado, hífen e barra.
 * @param {string} html o `jogar/index.html` montado no PC
 * @param {string} pasta onde a página mora, a partir da raiz do site (`jogar`)
 */
export function assetsDoJogo(html, pasta = 'jogar') {
  const raiz = /^[A-Za-z0-9._/-]+$/.test(pasta) ? pasta.replace(/\/+$/, '') : 'jogar';
  const nomes = new Set();
  for (const m of String(html).matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)) {
    if (/^assets\/[A-Za-z0-9._/-]+$/.test(m[1])) nomes.add(`${raiz}/${m[1]}`);
  }
  return [...nomes];
}

/** O que o PC montou contra o que o servidor tem: `ok` só se todos os arquivos conferem. */
export function compararSomas(local, remoto) {
  const diferentes = Object.keys(local).filter((a) => !local[a] || local[a] !== remoto[a]);
  return { ok: diferentes.length === 0 && Object.keys(local).length > 0, diferentes };
}

/**
 * Há o que publicar? `--se-mudou`: só se a versão do código (o HEAD da worktree) é outra que a última publicada; sem a opção, sempre.
 * @param {string} head
 * @param {string | null} publicado
 * @param {boolean} seMudou
 */
export function devePublicar(head, publicado, seMudou) {
  if (!seMudou) return true;
  return !publicado || publicado.trim() !== head.trim();
}
