/**
 * Pedido de parada por arquivo: o jeito de reiniciar o servidor sem precisar de administrador.
 *
 * O processo do jogo roda numa sessão própria da tarefa do Windows e nega acesso até ao mesmo usuário (só administrador o
 * encerra); o `Stop-ScheduledTask` mata o `cmd.exe` da tarefa mas deixa o `node` filho órfão, segurando a porta. Por isso a
 * atualização automática nunca conseguia reiniciar o servidor (achado em 04/10 e de novo em 09/10). Aqui o servidor se
 * encerra sozinho: quem quiser a parada cria `parar.flag` na pasta de dados (`CYBERMECH_DADOS`); o servidor vê, apaga o
 * arquivo e chama `aoPedir` (que salva os números e sai). Custo: um `existsSync` a cada 2 s, fora do laço de 60 Hz.
 */
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const PARADA_ARQUIVO = 'parar.flag';

const apagar = (arquivo: string): void => {
  try {
    rmSync(arquivo, { force: true });
  } catch {
    // sem permissão ou em uso: tenta de novo no próximo ciclo
  }
};

/**
 * Começa a vigiar `parar.flag` em `dir`. Um pedido que já estava lá quando o servidor subiu é velho (feito para o servidor
 * anterior) e é apagado, senão o servidor novo sairia assim que nascesse. Devolve a função que para a vigia.
 */
export function vigiarParada(dir: string, aoPedir: () => void, cadaMs = 2000): () => void {
  const arquivo = join(dir, PARADA_ARQUIVO);
  apagar(arquivo);
  let pedido = false;
  const timer = setInterval(() => {
    if (pedido || !existsSync(arquivo)) return;
    pedido = true; // um pedido só: não chama `aoPedir` duas vezes enquanto o servidor fecha
    apagar(arquivo);
    aoPedir();
  }, cadaMs);
  timer.unref(); // a vigia sozinha não segura o processo vivo
  return () => clearInterval(timer);
}
