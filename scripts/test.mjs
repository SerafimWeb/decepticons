/**
 * Roda o Vitest com o temp do processo em .tmp/vitest/ (G15: nada fora da pasta do projeto).
 * O Vitest grava os módulos transformados em os.tmpdir() e nem sempre limpa ao sair; os workers
 * herdam este ambiente. Argumentos extras vão direto para o Vitest (ex.: npm test -- --watch).
 *
 * Teto de workers (achado em 27/09, Qwen registrou o sintoma em ESTADO_ATUAL.md): com `isolate`
 * (padrão do Vitest 5), cada arquivo de teste ganha um worker próprio — 31 arquivos aqui viram 31
 * processos, cada um abrindo servidor WebSocket e física de verdade. Numa máquina de poucos núcleos,
 * isso estoura o relógio: os testes que dependem de tempo real (o teto por IP do `server/guard.ts`,
 * a janela de banda do M4) competem por CPU e estouram o timeout, sem nenhuma mudança de código.
 * `VITEST_MAX_WORKERS` não existe no Vitest 5 (só a flag `--maxWorkers`); por isso o teto vai aqui,
 * de propósito, para o hook de pre-push e o CI de qualquer agente ficarem determinísticos por padrão.
 * Quem passar `--maxWorkers` explícito (ex.: para depurar com mais paralelismo) sobrescreve este teto.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const TMP = resolve('.tmp', 'vitest');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const args = process.argv.slice(2);
const hasOwnWorkerCap = args.some((a) => a.startsWith('--maxWorkers'));
// 1 worker por padrão: medido em 27/09, 2 e 4 ainda flakam de vez em quando (real WebSocket + física
// de verdade competindo por CPU); só 1 foi 100% estável. O hook de pre-push roda uma vez por push, não
// por iteração — confiabilidade do portão pesa mais que os segundos a mais. Quem quiser mais
// paralelismo (ex.: só rodando um arquivo específico) passa `--maxWorkers` explícito e sobrescreve.
const finalArgs = [...(args.length ? args : ['run']), ...(hasOwnWorkerCap ? [] : ['--maxWorkers=1'])];
const cli = resolve('node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [cli, ...finalArgs], {
  stdio: 'inherit',
  env: { ...process.env, TEMP: TMP, TMP, TMPDIR: TMP },
});
process.exit(result.status ?? 1);
