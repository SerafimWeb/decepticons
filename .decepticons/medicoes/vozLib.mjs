import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runnerImport } from 'vite';

/** A pasta dos temporários das bancadas de voz (G15: dentro do projeto, ignorada pelo git). */
export const DADOS_DA_VOZ = resolve('.tmp', 'voz');

/** Um WAV mono de 16 bits a 48 kHz: um seno de 440 Hz (`amp` > 0) ou silêncio. É o que o Chrome toca no lugar do microfone (`--use-file-for-fake-audio-capture`). Devolve o caminho. */
export function gerarWav(nome, amp, segundos) {
  mkdirSync(DADOS_DA_VOZ, { recursive: true });
  const hz = 48000;
  const n = hz * segundos;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(hz, 24);
  buf.writeUInt32LE(hz * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(amp * 32767 * Math.sin((2 * Math.PI * 440 * i) / hz)), 44 + i * 2);
  const caminho = resolve(DADOS_DA_VOZ, nome);
  writeFileSync(caminho, buf);
  return caminho;
}

let contasCriadas = 0;
/**
 * Cria uma conta pelo HTTP do servidor da bancada e devolve o token da sessão (P211: a voz é só de conta de maior de idade, e o servidor confere o token do `PRONTO`).
 * `nascimento` é o `AAAA-MM` (padrão: adulto); `null` cria a conta "sem idade".
 */
export async function tokenDeConta(porta, apelido = 'bancada', nascimento = '1990-01') {
  const { ACEITE_ATUAL } = (await runnerImport(resolve('shared/net/auth.ts'), { configFile: false, logLevel: 'silent' })).module;
  const r = await fetch(`http://127.0.0.1:${porta}/conta/criar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${apelido}-${++contasCriadas}@bancada.com`, senha: 'senhasegura', aceite: ACEITE_ATUAL, ...(nascimento ? { nascimento } : {}) }),
  });
  if (r.status !== 201) throw new Error(`conta de bancada não criada: ${r.status} ${await r.text()}`);
  return (await r.json()).token;
}

/** A chave onde o jogo guarda o token da sessão para o servidor dessa porta (`chaveDoToken` do cliente). */
export const chaveDaSessao = (porta) => `cybermech.conta.token|http://127.0.0.1:${porta}`;

/** Deixa o token no navegador antes de a página abrir: o jogo restaura a sessão sozinho. O jogo só fala com o servidor de contas do `VITE_GAME_SERVER` (ver `apontarJogoPara`). */
export const guardarSessao = (page, porta, token) =>
  page.addInitScript(([k, v]) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* sem armazenamento */
    }
  }, [chaveDaSessao(porta), token]);

/** O servidor de contas do jogo vem do build (`VITE_GAME_SERVER`): a bancada o aponta para o servidor dela ANTES de subir o Vite. */
export function apontarJogoPara(porta) {
  process.env.VITE_GAME_SERVER = `ws://127.0.0.1:${porta}`;
}
