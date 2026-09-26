/**
 * `npm run server`: sobe o servidor de jogo (server/main.ts) direto do TypeScript, pelo carregador do Vite (o mesmo
 * que o site usa para ler o código do jogo). Nada é gerado em disco.
 */
import { resolve } from 'node:path';
import { runnerImport } from 'vite';

await runnerImport(resolve('server/main.ts'), { configFile: false, logLevel: 'warn' });
