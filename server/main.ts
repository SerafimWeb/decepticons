import { DEFAULT_HOST, startServer } from './Server';

/**
 * `npm run server`: o servidor de jogo no PC. Padrão: `127.0.0.1:2567` (só o próprio PC, o túnel da Cloudflare fala
 * daqui; nada aparece na rede de casa nem na internet sem o túnel). Outra porta: `PORT=3000`. Rede local para os
 * outros PCs da casa: `HOST=0.0.0.0`. Detalhes e o túnel para o público em `.decepticons/DEPLOY.md`.
 */
const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? DEFAULT_HOST;
const server = await startServer({ port, host, log: (line) => console.log(`[servidor] ${line}`) });
console.log(`CYBERMECH · servidor de jogo em ws://${server.host}:${server.port}/?sala=ARENA (Ctrl+C para parar)`);
if (server.host === '127.0.0.1') console.log('[servidor] só localhost (túnel da Cloudflare fala daqui). HOST=0.0.0.0 expõe à rede de casa.');

// A cada 10 s: salas abertas, jogadores, tempo médio do tick (meta do G14: até 2 ms) e as defesas.
setInterval(() => {
  const g = server.guard;
  if (g.connections || g.rejected.total || g.rejected.ip || g.rejected.flood) {
    console.log(`[servidor] ${g.connections} conex. · recusas: total ${g.rejected.total} · ip ${g.rejected.ip} · taxa ${g.rejected.flood}`);
  }
  for (const r of server.rooms.values()) console.log(`[sala ${r.code}] ${r.humanCount} jogador(es) · tick ${r.tickMs.toFixed(2)} ms · ${r.tick} ticks`);
}, 10_000);
