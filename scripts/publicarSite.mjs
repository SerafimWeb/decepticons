/**
 * A parte pura da publicação do site pelo PC do Comandante (13/10, P105: "publicação automática, facilitada, eficiente e gratuita; não quero pagar o GitHub"):
 * ler a configuração, travar o destino, montar os comandos, decidir se há o que publicar e conferir o que chegou. Nada aqui abre rede, disco ou processo:
 * quem roda (`scripts/publicar-site.mjs`) injeta isso, e `server/publicarSite.test.ts` cobre tudo.
 *
 * **A configuração fica fora do repositório** (R2/R10: nenhum host, usuário ou caminho do servidor no git): um JSON na pasta de dados do servidor (a mesma do
 * `contas.db`, que a atualização automática nunca apaga): `{ "host": "…", "port": 65002, "user": "…", "path": "/home/<usuario>/domains/selvamkt.com.br/public_html/cybermech", "key": "~/.ssh/id_ed25519" }`.
 * **Trava (a mesma do deploy do Actions):** o destino tem de terminar em `/public_html/cybermech`; a raiz do domínio é o site real da Selva MKT.
 */

/** O destino é só o que o site do jogo usa: letras, números, ponto, hífen, sublinhado e barra (nada que o shell remoto interprete). */
const CAMINHO_SEGURO = /^\/[A-Za-z0-9._\-/]+$/;
const HOST_SEGURO = /^[A-Za-z0-9.\-]+$/;
const USUARIO_SEGURO = /^[A-Za-z0-9._\-]+$/;

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
  else if (!caminho.endsWith('/public_html/cybermech')) erros.push('"path" tem de terminar em /public_html/cybermech (a raiz do domínio é o site real da Selva MKT: nunca publicar fora dela)');
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
 * Os dois programas do envio: `tar` empacota a pasta do site e o `ssh` desempacota no destino (a máquina do Comandante é Windows e não tem `rsync`).
 * Só espelha o que há (não apaga o que saiu do build: apagar é decisão à parte, e nunca fora da pasta do jogo). Cada argumento é um item de lista: nada passa por shell local.
 * @param {{ host: string, user: string, port: number, path: string, key?: string }} cfg
 * @param {string} pastaDoSite a pasta montada (`.tmp/site`)
 */
export function comandosDeEnvio(cfg, pastaDoSite) {
  const ssh = ['-p', String(cfg.port), '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'StrictHostKeyChecking=yes'];
  if (cfg.key) ssh.push('-i', cfg.key);
  return {
    // O tar roda com `cwd` na pasta do site (`pastaDoSite`): o tar do Git trata "D:\\pasta" como "máquina D".
    empacotar: { programa: 'tar', args: ['-czf', '-', '.'], cwd: pastaDoSite },
    desempacotar: { programa: 'ssh', args: [...ssh, `${cfg.user}@${cfg.host}`, `mkdir -p '${cfg.path}' && cd '${cfg.path}' && tar -xzf -`] },
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

/** Os arquivos que dizem se o site novo chegou (a landing, o jogo, o painel e o `.htaccess`). */
export const ARQUIVOS_DE_CONFERENCIA = ['index.html', 'jogar/index.html', 'sala-de-controle/index.html', '.htaccess'];

/** O que o PC montou contra o que o servidor tem: `ok` só se todos os arquivos conferem. */
export function compararSomas(local, remoto) {
  const diferentes = ARQUIVOS_DE_CONFERENCIA.filter((a) => !local[a] || local[a] !== remoto[a]);
  return { ok: diferentes.length === 0, diferentes };
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
