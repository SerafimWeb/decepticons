import { spawn as spawnDoNode } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * O reinício pelo painel (`POST /admin/reiniciar`) precisa de alguém para ligar o servidor de novo: **o Agendador do Windows não religa uma
 * tarefa cujo programa saiu com código ≠ 0** (medido em 12/10: a tarefa ficou "Ready" com resultado 75 e o servidor ficou 4 min fora, até
 * alguém ligá-lo à mão), e a tarefa só aceita o `Start` depois que a instância velha terminou. Então, antes de sair, o servidor solta um
 * **ajudante** (`scripts/religar-servidor.ps1`): um processo separado, que sobrevive à saída, espera a porta ficar livre e liga a tarefa pelo
 * mesmo caminho que o atualizador usa (`ligar-servidor.ps1`: liga, confere o `/status`, tenta de novo até 3 vezes). Se o ajudante falhar, o
 * vigia do atualizador (a cada 10 min) ainda liga o servidor que não responde.
 *
 * Só faz sentido sob a tarefa do Windows (rodando à mão não há tarefa para ligar): fora dela não solta nada e o painel avisa que reiniciar só desliga.
 */
export interface OpcoesDoAjudante {
  /** O servidor roda sob a tarefa do Windows (a pasta de dados vem da tarefa)? */
  supervisionado: boolean;
  /** A porta em que o servidor escuta: o ajudante espera ela ficar livre e confere o `/status` nela. */
  porta: number;
  /** A pasta `scripts/` do projeto (onde mora `religar-servidor.ps1`). */
  scripts: string;
  /** O nome da tarefa (padrão do script: "CYBERMECH servidor"). */
  tarefa?: string;
  plataforma?: NodeJS.Platform;
  spawn?: typeof spawnDoNode;
  log?: (linha: string) => void;
}

/** Solta o ajudante que religa o servidor depois que ele sair. `true` = soltou; `false` = não se aplica (à mão, fora do Windows) ou não deu. */
export function soltarAjudanteDeReinicio(o: OpcoesDoAjudante): boolean {
  if (!o.supervisionado || (o.plataforma ?? process.platform) !== 'win32') return false;
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', resolve(o.scripts, 'religar-servidor.ps1'), '-Porta', String(o.porta)];
  if (o.tarefa) args.push('-Tarefa', o.tarefa);
  try {
    // Solto (`detached`), sem janela e sem ligação com a saída deste processo: ele continua depois que o servidor sai.
    const filho = (o.spawn ?? spawnDoNode)('powershell.exe', args, { detached: true, stdio: 'ignore', windowsHide: true });
    filho.on('error', (e) => o.log?.(`o ajudante de reinício não abriu: ${e.message}`));
    filho.unref();
    o.log?.('ajudante de reinício solto: ele religa o servidor depois que este sair');
    return true;
  } catch (e) {
    o.log?.(`não consegui soltar o ajudante de reinício: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}
