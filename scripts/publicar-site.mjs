/**
 * `npm run publicar-site` — publica o site (landing, sala de controle, oficina e o jogo) em `cybermech.online` **a partir do PC do Comandante, de graça,
 * sem o GitHub Actions** (13/10, P105: "publicação automática, facilitada, eficiente e gratuita; não quero pagar o GitHub").
 *
 * Monta o site (`npm run site`), empacota **num arquivo** e sobe esse arquivo para dentro do destino, confere a soma dele lá e **só então** extrai — e depois confere
 * por checksum, pelo próprio ssh, que o servidor tem os mesmos arquivos que o PC (daqui o endereço público às vezes nem responde: o TLS é resetado pela VPN; ver
 * `.decepticons/DEPLOY.md`). Só então marca a versão como publicada.
 *
 * **Por que não extrair enquanto transmite (14/10, o site caiu):** o envio antigo era um cano só (`tar` do PC → `ssh` que extraía no servidor). Uma conexão cortada no
 * meio deixava o `index.html` novo aterrissado e os `assets/` (nome com hash) não — o jogo abria com 404 em todos os scripts, e a rodada seguinte não consertava (a
 * trava de uma publicação viva segurava as outras). Com o pacote inteiro e conferido por soma antes da extração, uma conexão cortada não muda nada no ar.
 *
 *   npm run publicar-site                    monta e publica agora
 *   npm run publicar-site -- --se-mudou      só se o código mudou desde a última publicação (o atualizador do PC chama assim, a cada 10 min)
 *   npm run publicar-site -- --capturas      também fotografa o jogo para a landing (Chrome headless: ~30 s a mais; as fotos ficam guardadas para as próximas vezes)
 *   npm run publicar-site -- --so-montar     monta e não envia
 *   npm run publicar-site -- --configurar    diz o que falta na configuração (nunca mostra valor)
 *
 * **A configuração fica fora do repositório** (R2/R10), na pasta de dados do servidor: `deploy-site.json` (ver `scripts/publicarSite.mjs`). **Trava:** o destino termina em
 * `/domains/cybermech.online/public_html`; a pasta de outro domínio (em especial a do selvamkt.com.br, o site real da Selva MKT) é recusada. A lógica pura (validar, montar os comandos, comparar) está em `publicarSite.mjs` e é testada.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ARQUIVOS_DE_CONFERENCIA, PACOTE_DO_SITE, PACOTE_NO_SERVIDOR, assetsDoJogo, comandosDeEnvio, compararSomas, devePublicar, lerSomas, validarConfig } from './publicarSite.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const tem = (f) => argv.includes(f);

/** O tempo máximo de cada passo pelo ssh: o normal é levar segundos; passou disso, é a Hostinger segurando a conexão (o corte tem de virar erro, não espera infinita). */
const TEMPO_DO_ENVIO = 240_000;
const TEMPO_DA_CONFERENCIA = 60_000;

/** A pasta de dados do servidor: a da tarefa (`CYBERMECH_DADOS`) ou `.tmp/servidor` da pasta PRINCIPAL do projeto (a worktree é descartável; a configuração não). */
function pastaDeDados() {
  if (process.env.CYBERMECH_DADOS) return resolve(process.env.CYBERMECH_DADOS);
  const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: RAIZ, encoding: 'utf8' });
  const comum = r.status === 0 ? r.stdout.trim() : '';
  return comum ? join(dirname(comum), '.tmp', 'servidor') : join(RAIZ, '.tmp', 'servidor');
}

const DADOS = pastaDeDados();
mkdirSync(DADOS, { recursive: true });
const LOG = join(DADOS, 'publicar-site.log');
const log = (linha) => {
  const l = `[${new Date().toISOString()}] ${linha}`;
  console.log(l);
  try {
    appendFileSync(LOG, l + '\n', 'utf8');
  } catch {
    // sem log em arquivo, só o console
  }
};
const dorme = (ms) => new Promise((ok) => setTimeout(ok, ms));
const expandir = (p) => (p.startsWith('~') ? join(homedir(), p.slice(1)) : p);

function lerConfig() {
  const arquivo = join(DADOS, 'deploy-site.json');
  if (!existsSync(arquivo)) return { ok: false, erros: [`falta o arquivo de configuração (${arquivo}); crie um JSON com host, port, user, path (termina em /domains/cybermech.online/public_html) e key`] };
  let bruto;
  try {
    bruto = JSON.parse(readFileSync(arquivo, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    return { ok: false, erros: [`o deploy-site.json não é um JSON válido (${e instanceof Error ? e.message : e})`] };
  }
  return validarConfig(bruto);
}

if (tem('--configurar')) {
  const c = lerConfig();
  console.log(c.ok ? 'configuração ok (host, usuário, porta e destino válidos; nenhum valor é mostrado aqui)' : `configuração com problema:\n- ${c.erros.join('\n- ')}`);
  process.exit(c.ok ? 0 : 3);
}

const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: RAIZ, encoding: 'utf8' }).stdout.trim();
const MARCA = join(DADOS, 'site-publicado');
const publicado = existsSync(MARCA) ? readFileSync(MARCA, 'utf8') : null;
if (!devePublicar(head, publicado, tem('--se-mudou'))) {
  console.log(`site: nada novo (${head.slice(0, 7)} já está publicado)`);
  process.exit(0);
}

const cfgLida = lerConfig();
if (!cfgLida.ok) {
  log(`NÃO PUBLICOU: ${cfgLida.erros.join('; ')}`);
  process.exit(3);
}
const cfg = { ...cfgLida.cfg, key: cfgLida.cfg.key ? expandir(cfgLida.cfg.key) : undefined };

/** Publicar do branch em que a pasta está põe código não mergeado no ar: vale a pena dizer isso na linha do log, já que a versão publicada é o HEAD da pasta. */
const naMain = spawnSync('git', ['rev-parse', 'origin/main'], { cwd: RAIZ, encoding: 'utf8' }).stdout.trim();

// Uma publicação por vez (o atualizador roda a cada 10 min e a montagem pode passar disso): a trava de arquivo vale 25 min.
const TRAVA = join(DADOS, 'publicar-site.trava');
if (existsSync(TRAVA) && Date.now() - Number(readFileSync(TRAVA, 'utf8').split(' ')[1] ?? 0) < 25 * 60_000) {
  console.log('site: já há uma publicação rodando; deixo para ela');
  process.exit(0);
}
writeFileSync(TRAVA, `${process.pid} ${Date.now()}`);
const soltarTrava = () => rmSync(TRAVA, { force: true });
process.on('exit', soltarTrava);

const PASTA = resolve(RAIZ, '.tmp', 'site');
const PACOTE = resolve(RAIZ, '.tmp', PACOTE_DO_SITE);
const sha = (arquivo) => createHash('sha256').update(readFileSync(arquivo)).digest('hex');

function montar() {
  log(`montando o site (${head.slice(0, 7)}${tem('--capturas') ? ', com capturas' : ''})…`);
  const env = {
    ...process.env,
    // As capturas do jogo ficam guardadas para as montagens sem Chrome (a landing não perde as fotos).
    CYBERMECH_CAPTURAS_CACHE: join(DADOS, 'site-capturas'),
    ...(cfg.gameServer ? { VITE_GAME_SERVER: cfg.gameServer } : {}),
    // O atalho `?comandante=1` no site publicado (P224): ligado enquanto se desenvolve; **no lançamento, `"comandantePorLink": false` em deploy-site.json o fecha** (só a conta de administrador abre o modo Comandante).
    VITE_COMANDANTE_POR_LINK: cfg.comandantePorLink === false ? '0' : '1',
    ...(cfg.url ? { SITE_URL: cfg.url } : {}),
  };
  const r = spawnSync('npm', ['run', 'site', ...(tem('--capturas') ? ['--', '--capturas'] : [])], { cwd: RAIZ, env, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) {
    log(`a montagem do site falhou (código ${r.status}); o site no ar não foi tocado:\n${(r.stdout + r.stderr).split('\n').slice(-25).join('\n')}`);
    return false;
  }
  return true;
}

/** No Windows, o `tar` (bsdtar) e o `ssh` (OpenSSH) do próprio sistema, que existem em qualquer Windows 10 e não dependem do PATH da tarefa; fora dele, os do PATH. */
function programa(nome) {
  if (process.platform !== 'win32') return nome;
  const sistema = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
  const achado = nome === 'tar' ? join(sistema, 'tar.exe') : nome === 'ssh' ? join(sistema, 'OpenSSH', 'ssh.exe') : '';
  return achado && existsSync(achado) ? achado : nome;
}

/** Roda um passo pelo ssh e devolve `{ codigo, saida }` (nunca lança: o que der errado é para o log, não para uma tela que ninguém vê). */
function ssh({ programa: prog, args }, entrada, tempo = TEMPO_DO_ENVIO) {
  const r = spawnSync(programa(prog), args, { input: entrada, encoding: 'utf8', timeout: tempo, maxBuffer: 64 * 1024 * 1024 });
  return { codigo: r.status ?? 1, saida: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim(), erro: r.error ? String(r.error.message) : '' };
}

/** Empacota a pasta do site no arquivo do pacote (o `tar` roda com o `cwd` nela; a saída fica um nível acima, fora do que ele empacota). */
function empacotar() {
  const c = comandosDeEnvio(cfg, PASTA).empacotar;
  rmSync(PACOTE, { force: true });
  const r = spawnSync(programa(c.programa), c.args, { cwd: c.cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || !existsSync(PACOTE)) {
    log(`empacotar o site falhou (código ${r.status}); o site no ar não foi tocado:\n${(r.stdout + r.stderr).split('\n').slice(-10).join('\n')}`);
    return false;
  }
  return true;
}

/** Os arquivos que dizem se o site novo chegou: os de sempre mais os `assets/` que o próprio `jogar/index.html` pede (o que o navegador baixa: era o que faltava no 14/10). */
function arquivosDeConferencia() {
  const jogar = join(PASTA, 'jogar', 'index.html');
  const assets = existsSync(jogar) ? assetsDoJogo(readFileSync(jogar, 'utf8')) : [];
  return [...ARQUIVOS_DE_CONFERENCIA, ...assets];
}

function conferir(arquivos) {
  const local = {};
  for (const a of arquivos) if (existsSync(join(PASTA, a))) local[a] = sha(join(PASTA, a));
  const c = comandosDeEnvio(cfg, PASTA).conferir(arquivos);
  const r = ssh(c, undefined, TEMPO_DA_CONFERENCIA);
  if (r.codigo !== 0) return { ok: false, diferentes: [`(o servidor não confirmou: ${r.saida.split('\n')[0] || 'sem resposta'})`] };
  return compararSomas(local, lerSomas(r.saida));
}

/**
 * O envio em duas fases, com nova tentativa de ponta a ponta: o pacote sobe, a soma dele no servidor tem de ser a do PC e só então ele é extraído; no fim, a
 * conferência dos arquivos serviço por serviço. Qualquer passo que falhe (incluindo a conferência final) refaz o ciclo inteiro — um arquivo inteiro e conferido
 * não tem meio caminho, e o site no ar só muda dentro do `tar -xzf` do pacote conferido.
 */
async function publicar() {
  const somaLocal = sha(PACOTE);
  const arquivos = arquivosDeConferencia();
  const c = comandosDeEnvio(cfg, PASTA);
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    if (tentativa > 1) {
      const espera = tentativa * 12;
      log(`nova tentativa (${tentativa}/5) em ${espera} s (a proteção anti-abuso da Hostinger às vezes derruba a conexão)`);
      await dorme(espera * 1000);
    }
    log(`enviando para o servidor (tentativa ${tentativa}/5)…`);
    const subiu = ssh(c.enviarPacote, readFileSync(PACOTE));
    if (subiu.codigo !== 0) {
      log(`o pacote não subiu (código ${subiu.codigo}): ${subiu.erro || subiu.saida.slice(0, 300)}`);
      continue;
    }
    const soma = ssh(c.conferirPacote);
    const noServidor = lerSomas(soma.saida)[PACOTE_NO_SERVIDOR];
    if (soma.codigo !== 0 || noServidor !== somaLocal) {
      log(`o pacote chegou diferente do PC (${soma.codigo !== 0 ? 'não consegui ler a soma' : 'soma diferente'}); o site no ar não foi tocado`);
      continue;
    }
    const extraiu = ssh(c.extrair);
    if (extraiu.codigo !== 0) {
      log(`a extração falhou (código ${extraiu.codigo}): ${extraiu.saida.slice(0, 300)}`);
      continue;
    }
    const conf = conferir(arquivos);
    if (conf.ok) {
      log(`pacote conferido por soma no servidor e extraído (${arquivos.length} arquivos)`);
      return true;
    }
    log(`ATENÇÃO: o envio terminou, mas o servidor não tem os mesmos arquivos (diferentes: ${conf.diferentes.join(', ')}); refazendo`);
  }
  return false;
}

if (!montar()) process.exit(1);
if (!empacotar()) process.exit(1);
if (tem('--so-montar')) {
  log(`site montado em .tmp/site (--so-montar: não enviei; o pacote é .tmp/${PACOTE_DO_SITE})`);
  process.exit(0);
}
if (naMain && naMain !== head) log(`nota: publicando o HEAD desta pasta (${head.slice(0, 7)}), que não é a origin/main (${naMain.slice(0, 7)}) — confira se é isso mesmo`);

if (!(await publicar())) {
  log('NÃO PUBLICOU: o servidor não recebeu a mesma versão do PC; o site no ar ficou como estava');
  process.exit(2);
}
writeFileSync(`${MARCA}.tmp`, head);
renameSync(`${MARCA}.tmp`, MARCA);
log(`PUBLICADO: ${head.slice(0, 7)} no ar (conferido por checksum: ${arquivosDeConferencia().join(', ')})`);
