/**
 * `npm run publicar-site` — publica o site (landing, sala de controle, oficina e o jogo) em `www.selvamkt.com.br/cybermech/` **a partir do PC do Comandante, de graça,
 * sem o GitHub Actions** (13/10, P105: "publicação automática, facilitada, eficiente e gratuita; não quero pagar o GitHub").
 *
 * Monta o site (`npm run site`), empacota com `tar` e desempacota no destino por `ssh` (a máquina é Windows e não tem `rsync`), e **confere o que chegou por checksum, pelo
 * próprio SSH** (daqui o endereço público às vezes nem responde: o TLS é resetado pela VPN; ver `.decepticons/DEPLOY.md`). Só então marca a versão como publicada.
 *
 *   npm run publicar-site                    monta e publica agora
 *   npm run publicar-site -- --se-mudou      só se o código mudou desde a última publicação (o atualizador do PC chama assim, a cada 10 min)
 *   npm run publicar-site -- --capturas      também fotografa o jogo para a landing (Chrome headless: ~30 s a mais; as fotos ficam guardadas para as próximas vezes)
 *   npm run publicar-site -- --so-montar     monta e não envia
 *   npm run publicar-site -- --configurar    diz o que falta na configuração (nunca mostra valor)
 *
 * **A configuração fica fora do repositório** (R2/R10), na pasta de dados do servidor: `deploy-site.json` (ver `scripts/publicarSite.mjs`). **Trava:** o destino termina em
 * `/public_html/cybermech`; a raiz do domínio é o site real da Selva MKT. A lógica pura (validar, montar os comandos, comparar) está em `publicarSite.mjs` e é testada.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ARQUIVOS_DE_CONFERENCIA, compararSomas, comandosDeEnvio, devePublicar, lerSomas, validarConfig } from './publicarSite.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const tem = (f) => argv.includes(f);

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
  if (!existsSync(arquivo)) return { ok: false, erros: [`falta o arquivo de configuração (${arquivo}); crie um JSON com host, port, user, path (termina em /public_html/cybermech) e key`] };
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
const sha = (arquivo) => createHash('sha256').update(readFileSync(arquivo)).digest('hex');

function montar() {
  log(`montando o site (${head.slice(0, 7)}${tem('--capturas') ? ', com capturas' : ''})…`);
  const env = {
    ...process.env,
    // As capturas do jogo ficam guardadas para as montagens sem Chrome (a landing não perde as fotos).
    CYBERMECH_CAPTURAS_CACHE: join(DADOS, 'site-capturas'),
    ...(cfg.gameServer ? { VITE_GAME_SERVER: cfg.gameServer } : {}),
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

/** Empacota a pasta e desempacota no destino pelo ssh (um pipe: o `tar` escreve, o `ssh` lê). Devolve true se tudo saiu com 0. */
function enviar() {
  const c = comandosDeEnvio(cfg, PASTA);
  return new Promise((ok) => {
    // O tar roda DENTRO da pasta do site (cwd): o tar do Git trata "D:\\caminho" como "máquina D" e falha.
    const empacotar = spawn(programa(c.empacotar.programa), c.empacotar.args, { cwd: PASTA, stdio: ['ignore', 'pipe', 'inherit'] });
    const desempacotar = spawn(programa(c.desempacotar.programa), c.desempacotar.args, { stdio: ['pipe', 'inherit', 'pipe'] });
    let erro = '';
    desempacotar.stderr.on('data', (d) => (erro += d));
    empacotar.stdout.pipe(desempacotar.stdin);
    let codigos = [null, null];
    const fim = () => {
      if (codigos[0] === null || codigos[1] === null) return;
      if (codigos[0] !== 0 || codigos[1] !== 0) log(`envio falhou (tar ${codigos[0]}, ssh ${codigos[1]}): ${erro.trim().slice(0, 300)}`);
      ok(codigos[0] === 0 && codigos[1] === 0);
    };
    empacotar.on('exit', (c0) => ((codigos[0] = c0 ?? 1), fim()));
    desempacotar.on('exit', (c1) => ((codigos[1] = c1 ?? 1), fim()));
    empacotar.on('error', () => ((codigos[0] = 1), fim()));
    desempacotar.on('error', () => ((codigos[1] = 1), fim()));
  });
}

function conferir() {
  const local = {};
  for (const a of ARQUIVOS_DE_CONFERENCIA) if (existsSync(join(PASTA, a))) local[a] = sha(join(PASTA, a));
  const c = comandosDeEnvio(cfg, PASTA).conferir(ARQUIVOS_DE_CONFERENCIA);
  const r = spawnSync(programa(c.programa), c.args, { encoding: 'utf8', timeout: 60_000 });
  if (r.status !== 0) return { ok: false, diferentes: ['(não consegui ler o destino)'] };
  return compararSomas(local, lerSomas(r.stdout));
}

if (!montar()) process.exit(1);
if (tem('--so-montar')) {
  log('site montado em .tmp/site (--so-montar: não enviei)');
  process.exit(0);
}

let enviado = false;
for (let tentativa = 1; tentativa <= 5 && !enviado; tentativa++) {
  if (tentativa > 1) {
    const espera = tentativa * 12;
    log(`nova tentativa (${tentativa}/5) em ${espera} s (a proteção anti-abuso da Hostinger às vezes derruba a conexão)`);
    await dorme(espera * 1000);
  }
  log(`enviando para o servidor (tentativa ${tentativa}/5)…`);
  enviado = await enviar();
}
if (!enviado) {
  log('NÃO PUBLICOU: o envio falhou 5 vezes; o site no ar ficou como estava');
  process.exit(2);
}
const conf = conferir();
if (!conf.ok) {
  log(`ATENÇÃO: o envio terminou, mas o servidor não tem os mesmos arquivos (diferentes: ${conf.diferentes.join(', ')}); não marco como publicado`);
  process.exit(4);
}
writeFileSync(`${MARCA}.tmp`, head);
renameSync(`${MARCA}.tmp`, MARCA);
log(`PUBLICADO: ${head.slice(0, 7)} no ar (conferido por checksum: ${ARQUIVOS_DE_CONFERENCIA.join(', ')})`);
