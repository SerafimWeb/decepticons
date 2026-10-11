/**
 * `node scripts/gh.mjs <argumentos do gh>`: o `gh` de sempre, que cai para a credencial do Git se o token do `gh` morreu (`ghSeguro.mjs`).
 * Exemplo: `node scripts/gh.mjs pr list --state open`. A saída é a do `gh`, com o token escondido.
 */
import { gh } from './ghSeguro.mjs';

const r = gh(process.argv.slice(2));
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
if (r.viaGit) process.stderr.write('(o token do gh não valia: usei a credencial do Git; rode `gh auth login -h github.com` para consertar de vez)\n');
if (r.semCredencial) process.stderr.write('(o token do gh não vale e não achei credencial do Git: rode `gh auth login -h github.com`)\n');
process.exit(r.status);
