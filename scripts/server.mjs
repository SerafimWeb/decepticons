/**
 * `npm run server`: sobe o servidor de jogo (server/main.ts) direto do TypeScript, pelo carregador do Vite (o mesmo
 * que o site usa para ler o código do jogo). Nada é gerado em disco.
 *
 * O carregador fica **aberto** enquanto o servidor vive: o `runnerImport` do Vite o fecha assim que o `main.ts` termina de avaliar, e a partir daí
 * todo `import()` preguiçoso do código do jogo (o mapa da Praia, da Amazônia e da Praça, em `mapasSobDemanda.ts`) falha com "Vite module runner has been closed".
 * Em 21/10 isso derrubou a produção: o primeiro jogador que pediu uma sala dessas matou o processo (o túnel respondia 502 até a vigia religá-lo).
 */
import { resolve } from 'node:path';
import { createServer, isRunnableDevEnvironment } from 'vite';

const vite = await createServer({
  configFile: false,
  logLevel: 'warn',
  appType: 'custom',
  // Só o carregador de módulos: sem porta, sem WebSocket de HMR e sem vigia de arquivos (que varreria a pasta do projeto inteira, `.tmp/` e as worktrees junto).
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  environments: {
    // As dependências (ws, three, rapier) carregam pelo Node, como no `runnerImport`; só o código do projeto passa pelo Vite.
    ssr: { resolve: { external: true } },
  },
});
const ssr = vite.environments.ssr;
if (!isRunnableDevEnvironment(ssr)) throw new Error('o ambiente ssr do Vite não executa módulos: o servidor de jogo não tem como subir');
await ssr.runner.import(resolve('server/main.ts'));
