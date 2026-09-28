/**
 * Roda o Vitest com o temp do processo em .tmp/vitest/ (G15: nada fora da pasta do projeto).
 * O Vitest grava os módulos transformados em os.tmpdir() e nem sempre limpa ao sair; os workers
 * herdam este ambiente. Argumentos extras vão direto para o Vitest (ex.: npm test -- --watch).
 *
 * Sobre o flake do `server/room.test.ts > teto por IP` (27/09): não é concorrência do Vitest — é o
 * `WebSocket` global do Node (undici) que, no Windows, às vezes só dispara `error` numa conexão que o
 * servidor fecha logo após o handshake, sem nunca disparar `close` (Qwen achou a causa raiz; revisão
 * do PR #91). O teste agora usa o `WebSocket` do pacote `ws` (o mesmo do servidor) e o flake sumiu; não
 * há teto de workers aqui. Se `npm run check` voltar a flakar, é sintoma novo — investigar de novo, não
 * reintroduzir o `--maxWorkers` baixo (revisão do Qwen, PR #91: serializa o CI de todo mundo à toa).
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
