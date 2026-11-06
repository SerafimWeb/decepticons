/**
 * Gera o roteiro de gravação do rádio de campo (P316): `.decepticons/ROTEIRO_DE_GRAVACAO.md`, a partir de `client/src/audio/radio.json` (`npm run roteiro`).
 * Nada de rede, nada de chave: só lê um JSON e escreve um Markdown.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderizarRoteiro } from './roteiroVozLib.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const radio = JSON.parse(readFileSync(join(raiz, 'client/src/audio/radio.json'), 'utf8'));
const narrador = JSON.parse(readFileSync(join(raiz, 'client/src/audio/falas.json'), 'utf8'));
writeFileSync(join(raiz, '.decepticons/ROTEIRO_DE_GRAVACAO.md'), renderizarRoteiro(radio, narrador));
console.log(`roteiro: ${radio.falas.length} falas de rádio em ${Object.keys(radio.canais).length} canais e ${narrador.falas.length} do narrador -> .decepticons/ROTEIRO_DE_GRAVACAO.md`);
