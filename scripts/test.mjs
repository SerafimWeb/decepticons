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
import { cpus, freemem } from 'node:os';
import { resolve } from 'node:path';
import { memoriaVirtualLivre, workersForcados, workersPelaMemoria } from './workersPelaMemoria.mjs';

const TMP = resolve('.tmp', 'vitest');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const args = process.argv.slice(2);
// Pouca memória livre: menos workers (ver workersPelaMemoria.mjs). Com memória de sobra (o CI), o Vitest escolhe sozinho.
if (!args.some((a) => /^--(max-?workers|pool|no-file-parallelism)/.test(a))) {
  // `CYBERMECH_WORKERS=1` força; senão conta a memória física livre **e a virtual** (o teto do Windows: com o teto quase atingido os workers morrem com 0xC0000409).
  const forcado = workersForcados(process.env.CYBERMECH_WORKERS);
  const virtual = forcado === null ? memoriaVirtualLivre() : null;
  const w = forcado ?? workersPelaMemoria(freemem(), cpus().length, virtual);
  if (w !== null) {
    const motivo = forcado !== null ? 'CYBERMECH_WORKERS' : `pouca memória livre (${Math.round(freemem() / 1048576)} MB${virtual !== null ? `, ${Math.round(virtual / 1048576)} MB de memória virtual` : ''})`;
    console.log(`test: ${motivo}: limitando o Vitest a ${w} worker${w === 1 ? '' : 's'} (mais devagar, mas sem morrer por falta de memória)`);
    args.push(`--maxWorkers=${w}`);
  }
}
const cli = resolve('node_modules', 'vitest', 'vitest.mjs');
// [R17, 14/10] Sem subcomando o Vitest entra em watch e o gate do push (`npm run check`) trava para sempre.
// Com pouca memória o `--maxWorkers` era empurrado e `args.length` deixava de ser 0, e o `run` do padrão se perdia.
// O subcomando passa a ser sempre explícito: `run` quando o pedido não traz `run`, `watch` nem `dev`.
const subcomando = args.some((a) => a === 'run' || a === 'watch' || a === 'dev');
const result = spawnSync(process.execPath, [cli, ...(subcomando ? args : ['run', ...args])], {
  stdio: 'inherit',
  env: { ...process.env, TEMP: TMP, TMP, TMPDIR: TMP },
});
process.exit(result.status ?? 1);
