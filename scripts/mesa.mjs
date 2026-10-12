#!/usr/bin/env node
/**
 * `npm run mesa`: liga a mesa de vídeo (a ferramenta que monta o vídeo promocional, `FERRAMENTAS.md` §3) e abre no navegador.
 *
 * A mesa mora em `.tmp/video/` (G15: nada fora do projeto; a pasta é local e não vai para o git nem para o site), então este comando só
 * funciona na máquina em que ela existe. É idempotente: se a mesa já estiver ligada na porta 4199, só abre o navegador. Para desligar, Ctrl+C
 * na janela em que ela foi ligada.
 *
 * Opções: `--sem-navegador` (não abre o navegador, só liga).
 *
 * A lógica de decisão é pura e testada em `server/mesa.test.ts`; o resto só liga as peças (porta, arquivo, navegador).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PORTA_DA_MESA = 4199;
export const URL_DA_MESA = `http://127.0.0.1:${PORTA_DA_MESA}/.tmp/video/editor.html`;
export const ARQUIVO_DA_MESA = join('.tmp', 'video', 'servir.mjs');

/** O que fazer, dado o que existe na máquina: sem a mesa instalada, ela já ligada, ou ligar. */
export function decidir({ existe, escutando }) {
  if (!existe) return 'sem-mesa';
  return escutando ? 'ja-ligada' : 'ligar';
}

/** A mensagem de cada caso (o que o terminal escreve). */
export function mensagem(caso) {
  switch (caso) {
    case 'sem-mesa':
      return `A mesa de vídeo não está instalada nesta máquina: falta ${ARQUIVO_DA_MESA}. Ela é local (G15) e não vai para o git; veja .decepticons/FERRAMENTAS.md §3.`;
    case 'ja-ligada':
      return `A mesa já estava ligada: ${URL_DA_MESA}`;
    default:
      return `Mesa de vídeo ligada: ${URL_DA_MESA}  (Ctrl+C desliga)`;
  }
}

/** Alguém escuta nesta porta do computador? (conexão local, sem sair da máquina) */
export function portaEscutando(porta, host = '127.0.0.1', espera = 800) {
  return new Promise((ok) => {
    const s = createConnection({ port: porta, host });
    const fim = (v) => {
      s.destroy();
      ok(v);
    };
    s.setTimeout(espera, () => fim(false));
    s.once('connect', () => fim(true));
    s.once('error', () => fim(false));
  });
}

/** Abre o endereço no navegador padrão (Windows, macOS ou Linux). */
export function abrirNoNavegador(url, plataforma = process.platform) {
  const [cmd, args] = plataforma === 'win32' ? ['cmd', ['/c', 'start', '', url]] : plataforma === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
}

async function principal() {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const arquivo = join(raiz, ARQUIVO_DA_MESA);
  const caso = decidir({ existe: existsSync(arquivo), escutando: await portaEscutando(PORTA_DA_MESA) });
  console.log(mensagem(caso));
  if (caso === 'sem-mesa') process.exit(1);
  const abrir = !process.argv.includes('--sem-navegador');
  if (caso === 'ligar') {
    // Importa o servidor da mesa e liga nesta mesma janela (o processo fica vivo até o Ctrl+C).
    const { servir } = await import(pathToFileURL(arquivo).href);
    await servir(PORTA_DA_MESA);
  }
  if (abrir) abrirNoNavegador(URL_DA_MESA);
  if (caso === 'ja-ligada') process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  principal().catch((e) => {
    console.error('Não consegui ligar a mesa:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
