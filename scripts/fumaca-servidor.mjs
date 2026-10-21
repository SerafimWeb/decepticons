/**
 * `npm run fumaca`: abre uma sala de cada mapa num servidor de jogo, como um jogador anônimo, e diz se cada uma abriu (ou, nos mapas restritos, recusou) sem o processo cair.
 * Detalhes e por que existe: `server/fumaca.ts`.
 *
 *   npm run fumaca                                                     o servidor local (http://127.0.0.1:2567)
 *   npm run fumaca -- --url https://jogo.cybermech.online --origem https://cybermech.online     a produção, pelo túnel (só com 0 jogadores: veja o `/status`)
 *
 * Sai com 0 se passou e 1 se reprovou.
 */
import { resolve } from 'node:path';
import { runnerImport } from 'vite';

const args = process.argv.slice(2);
const valor = (nome, padrao) => {
  const i = args.indexOf(nome);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};

const { module } = await runnerImport(resolve('server/fumaca.ts'), { configFile: false, logLevel: 'error' });
const r = await module.fumacaDoServidor({ base: valor('--url', 'http://127.0.0.1:2567').replace(/\/$/, ''), origem: valor('--origem', undefined) });
console.log(module.formatarFumaca(r));
process.exit(r.ok ? 0 : 1);
