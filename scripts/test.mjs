/**
 * Roda o Vitest com o temp do processo em .tmp/vitest/ (G15: nada fora da pasta do projeto).
 * O Vitest grava os módulos transformados em os.tmpdir() e nem sempre limpa ao sair; os workers
 * herdam este ambiente. Argumentos extras vão direto para o Vitest (ex.: npm test -- --watch).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const TMP = resolve('.tmp', 'vitest');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const args = process.argv.slice(2);
const cli = resolve('node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [cli, ...(args.length ? args : ['run'])], {
  stdio: 'inherit',
  env: { ...process.env, TEMP: TMP, TMP, TMPDIR: TMP },
});
process.exit(result.status ?? 1);
