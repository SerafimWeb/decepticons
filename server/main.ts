import { startServer } from './Server';

/**
 * `npm run server`: o servidor de jogo no PC (porta 2567, ou a de PORT). Para jogar pela rede de casa, os outros
 * computadores usam o IP deste; para jogar pela internet, um túnel (DEPLOY.md, "Servidor de jogo").
 */
const port = Number(process.env.PORT ?? 2567);
const server = await startServer({ port, log: (line) => console.log(`[servidor] ${line}`) });
console.log(`CYBERMECH · servidor de jogo em ws://localhost:${server.port}/?sala=ARENA (Ctrl+C para parar)`);

// A cada 10 s, as salas abertas: jogadores e o tempo médio do tick (meta do G14: até 2 ms).
setInterval(() => {
  for (const r of server.rooms.values()) console.log(`[sala ${r.code}] ${r.humanCount} jogador(es) · tick ${r.tickMs.toFixed(2)} ms · ${r.tick} ticks`);
}, 10_000);
