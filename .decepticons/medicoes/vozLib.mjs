import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
