import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { REINICIO_AVISO_S } from '../shared/net/constants';
import { CODIGO_REINICIO } from './admin';
import { pastaDados } from './dados';
import { vigiarParada } from './parada';
import { instalarRedeDeSeguranca } from './redeDeSeguranca';
import { soltarAjudanteDeReinicio } from './religar';
import { Registro, REGISTRO_PASTA } from './registro';
import { DEFAULT_HOST, startServer } from './Server';

/**
 * `npm run server`: o servidor de jogo no PC. Padrão: `127.0.0.1:2567` (só o próprio PC, o túnel da Cloudflare fala
 * daqui; nada aparece na rede de casa nem na internet sem o túnel). Outra porta: `PORT=3000`. Rede local para os
 * outros PCs da casa: `HOST=0.0.0.0`. Detalhes e o túnel para o público em `.decepticons/DEPLOY.md`.
 */
/** O registro técnico (P192): um arquivo por dia em `<dados>/registro/`, apagado sozinho depois de 30 dias (`registro.ts`). O `servidor.log` da tarefa fica só com o que o próprio Node escreve. */
const registro = new Registro(join(pastaDados(resolve(import.meta.dirname, '..')), REGISTRO_PASTA));
registro.podar();
setInterval(() => registro.podar(), 6 * 60 * 60 * 1000).unref();
const dizer = (linha: string): void => registro.escrever(linha);
// Uma promessa que falha sem ninguém tratar não derruba mais o servidor de todo mundo (P239): fica no registro, com a causa, e o servidor segue.
instalarRedeDeSeguranca(process, dizer);
const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? DEFAULT_HOST;
/** A versão do código em que o servidor roda (o hash curto do git; a pasta do servidor é uma worktree), para o painel mostrar. */
const release = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8', timeout: 3000 }).trim() || 'desconhecida';
  } catch {
    return 'desconhecida';
  }
})();
/** Sob a tarefa do Windows (`servidor-windows.ps1` define a pasta de dados): o painel sabe religá-lo depois de um reinício (`religar.ts`); o atualizador, se ele cair. */
const supervisionado = !!process.env.CYBERMECH_DADOS;
const server = await startServer({
  port,
  host,
  release,
  supervisionado,
  // Reinício pelo painel (`POST /admin/reiniciar`): lança o ajudante que religa a tarefa (o Agendador NÃO religa quem sai com código ≠ 0:
  // provado em 12/10), espera ele ser lançado (1 a 3 s), salva os números e sai.
  aoReiniciar: (motivo) => {
    dizer(`[servidor] reinício (${motivo}): lançando o ajudante, fechando e saindo com o código ${CODIGO_REINICIO}`);
    setTimeout(() => process.exit(CODIGO_REINICIO), 30_000).unref(); // se o lançamento ou o fechamento travar, sai mesmo assim
    const raiz = resolve(import.meta.dirname, '..');
    void soltarAjudanteDeReinicio({ supervisionado, porta: server.port, scripts: resolve(raiz, 'scripts'), dados: pastaDados(raiz), tarefa: process.env.CYBERMECH_TAREFA, log: (l) => dizer(`[servidor] ${l}`) })
      .then(() => server.fecharComAviso())
      .finally(() => process.exit(CODIGO_REINICIO));
  },
  log: (line) => dizer(`[servidor] ${line}`),
});
console.log(`CYBERMECH · servidor de jogo em ws://${server.host}:${server.port}/?sala=ARENA (Ctrl+C para parar)`);
dizer(`CYBERMECH · servidor de jogo em ws://${server.host}:${server.port}/?sala=ARENA`);
if (server.host === '127.0.0.1') dizer('[servidor] só localhost (túnel da Cloudflare fala daqui). HOST=0.0.0.0 expõe à rede de casa.');

// Reinício sem administrador (server/parada.ts): a atualização automática cria `parar.flag` na pasta de dados; o servidor salva os
// números e sai sozinho, e quem pediu (o atualizador) o liga de novo com o código novo.
vigiarParada(pastaDados(resolve(import.meta.dirname, '..')), () => {
  dizer('[servidor] pedido de parada (parar.flag): fechando e saindo');
  setTimeout(() => process.exit(0), (REINICIO_AVISO_S + 8) * 1000).unref(); // o aviso aos jogadores (REINICIO_AVISO_S) + o fechamento; se travar, sai mesmo assim
  void server.fecharComAviso().finally(() => process.exit(0));
});

// A cada 10 s: salas abertas, jogadores, tempo médio do tick (meta do G14: até 2 ms) e as defesas.
setInterval(() => {
  const g = server.guard;
  if (g.connections || g.rejected.total || g.rejected.ip || g.rejected.flood) {
    dizer(`[servidor] ${g.connections} conex. · recusas: total ${g.rejected.total} · ip ${g.rejected.ip} · taxa ${g.rejected.flood}`);
  }
  for (const r of server.rooms.values()) dizer(`[sala ${r.code}] ${r.humanCount} jogador(es) · tick ${r.tickMs.toFixed(2)} ms · ${r.tick} ticks`);
}, 10_000);
