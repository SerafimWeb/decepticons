/**
 * Roda no `npm install` (script "prepare"): aponta o git para os hooks versionados
 * em .githooks/ (Protocolo Serafim UM — M5, R15). Fora de um repo git não faz nada.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const HOOKS_DIR = '.githooks';

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
} catch {
  process.exit(0); // sem git (ex.: tarball, CI sem checkout): nada a instalar
}

if (existsSync(HOOKS_DIR)) {
  execFileSync('git', ['config', 'core.hooksPath', HOOKS_DIR]);
  // Linux/macOS precisam do bit de execução; no Windows é inofensivo.
  for (const f of readdirSync(HOOKS_DIR)) chmodSync(join(HOOKS_DIR, f), 0o755);
  console.log(`git hooks: core.hooksPath -> ${HOOKS_DIR}`);
}
