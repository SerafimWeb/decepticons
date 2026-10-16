/**
 * Abre um arquivo do projeto no programa padrão do Windows (o navegador, para um `.html`): `node scripts/abrir.mjs .decepticons/ouvir-sons.html`.
 * Existe porque a pasta `.decepticons` começa com ponto: o Explorador do Windows a esconde, e um atalho do npm resolve.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const alvo = process.argv[2];
if (!alvo) {
  console.error('uso: node scripts/abrir.mjs <arquivo>');
  process.exit(1);
}
const arquivo = resolve(alvo);
if (!existsSync(arquivo)) {
  console.error(`✗ não achei ${arquivo}`);
  process.exit(1);
}
console.log(`abrindo ${arquivo}`);
spawn('cmd', ['/c', 'start', '""', arquivo], { stdio: 'ignore', detached: true, windowsVerbatimArguments: true }).unref();
