import { execFile as execFileDoNode } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * O reinício pelo painel (`POST /admin/reiniciar`) precisa de alguém para ligar o servidor de novo: **o Agendador do Windows não religa uma
 * tarefa cujo programa saiu com código ≠ 0** (medido em 12/10: a tarefa ficou "Ready" com resultado 75 e o servidor ficou 4 min fora, até
 * alguém ligá-lo à mão), e a tarefa só aceita o `Start` depois que a instância velha terminou. Então, antes de sair, o servidor lança um
 * **ajudante** (`scripts/religar-servidor.ps1`) que espera a porta ficar livre e liga a tarefa pelo mesmo caminho que o atualizador usa
 * (`ligar-servidor.ps1`: liga, confere o `/status`, tenta de novo até 3 vezes).
 *
 * **O ajudante tem de sobreviver à saída do servidor** (medido em 12/10, 2ª prova): um `powershell.exe` lançado com `spawn` morre junto com o
 * pai, e com `detached` nem chega a rodar (sem console). Por isso o ajudante é criado **pelo WMI** (`Win32_Process.Create`): o processo nasce
 * filho do serviço do WMI, fora da árvore e do "job" do servidor, e nada o derruba quando o servidor sai. Se o WMI falhar, o servidor
 * aciona a tarefa do atualizador (`schtasks /Run`), que religa o servidor que não responde (é o vigia que roda a cada 10 min). **Nunca os dois
 * ao mesmo tempo:** dois religamentos juntos se atropelam (o segundo para a tarefa que o primeiro acabou de ligar).
 *
 * Cada passo vai para o `religar.log` na pasta de dados (o servidor escreve; o ajudante continua o arquivo), para a próxima falha dizer onde parou.
 * Só faz sentido sob a tarefa do Windows (rodando à mão não há tarefa para ligar): fora dela não faz nada e o painel avisa que reiniciar só desliga.
 */
export interface ResultadoDoComando {
  /** O código de saída (`null` = não abriu ou estourou o tempo). */
  codigo: number | null;
  stdout: string;
  stderr: string;
}

export type RodarComando = (arquivo: string, args: string[], esperaMs: number) => Promise<ResultadoDoComando>;

export interface OpcoesDoAjudante {
  /** O servidor roda sob a tarefa do Windows (a pasta de dados vem da tarefa)? */
  supervisionado: boolean;
  /** A porta em que o servidor escuta: o ajudante espera ela ficar livre e confere o `/status` nela. */
  porta: number;
  /** A pasta `scripts/` do projeto (onde mora `religar-servidor.ps1`). */
  scripts: string;
  /** A pasta de dados do servidor (onde o `religar.log` mora); sem ela, só o log do console. */
  dados?: string;
  /** O nome da tarefa do servidor (padrão do script: "CYBERMECH servidor"). */
  tarefa?: string;
  /** O nome da tarefa do atualizador, o plano B (padrão: "CYBERMECH atualizar"). */
  tarefaDoAtualizador?: string;
  plataforma?: NodeJS.Platform;
  rodar?: RodarComando;
  agora?: () => Date;
  log?: (linha: string) => void;
}

/** Como o ajudante foi acionado: pelo WMI (o caminho rápido), ou pela tarefa do atualizador (o plano B). `null` = nenhum dos dois deu. */
export type ComoReligou = 'wmi' | 'atualizador' | null;

/** Roda um programa e espera ele acabar (ou estourar o tempo). **Nunca lança:** tudo o que dá errado vira `codigo: null` com a mensagem em `stderr`. */
export const rodarComando: RodarComando = (arquivo, args, esperaMs) =>
  new Promise((ok) => {
    try {
      execFileDoNode(arquivo, args, { windowsHide: true, timeout: esperaMs, encoding: 'utf8' }, (erro, stdout, stderr) => {
        // Saída com código ≠ 0: `erro.code` é o número. Não abriu (ENOENT) ou estourou o tempo: `erro.code` é texto ou falta (`null`).
        const e = erro as (Error & { code?: number | string }) | null;
        const codigo = !e ? 0 : typeof e.code === 'number' ? e.code : null;
        ok({ codigo, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') + (e && codigo === null ? ` (${e.message})` : '') });
      });
    } catch (e) {
      ok({ codigo: null, stdout: '', stderr: e instanceof Error ? e.message : String(e) });
    }
  });

/** O texto de um literal de string do PowerShell entre aspas simples (a aspa simples vira duas). */
const literalPs = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/** A linha de comando do ajudante (o que o WMI executa). */
export function linhaDoAjudante(o: Pick<OpcoesDoAjudante, 'scripts' | 'porta' | 'tarefa' | 'dados'>): string {
  // A pasta de dados vai como parâmetro: o processo criado pelo WMI não herda o ambiente (CYBERMECH_DADOS) deste servidor.
  return `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${resolve(o.scripts, 'religar-servidor.ps1')}" -Porta ${o.porta}${o.dados ? ` -Dados "${o.dados}"` : ''}${o.tarefa ? ` -Tarefa "${o.tarefa}"` : ''}`;
}

/**
 * Aciona o ajudante que religa o servidor depois que ele sair. Devolve como foi (ou `null` se nada deu, ou se não se aplica: à mão, fora do
 * Windows). Espera o lançamento (uns 1 a 3 s), não o religamento: quem chama fecha e sai logo depois.
 */
export async function soltarAjudanteDeReinicio(o: OpcoesDoAjudante): Promise<ComoReligou> {
  if (!o.supervisionado || (o.plataforma ?? process.platform) !== 'win32') return null;
  const rodarDeVerdade = o.rodar ?? rodarComando;
  // Quem rodar não derruba o reinício: se até o `rodar` lançar, vira uma falha como as outras.
  const rodar: RodarComando = async (arquivo, args, esperaMs) => {
    try {
      return await rodarDeVerdade(arquivo, args, esperaMs);
    } catch (e) {
      return { codigo: null, stdout: '', stderr: e instanceof Error ? e.message : String(e) };
    }
  };
  const registrar = (linha: string): void => {
    o.log?.(linha);
    if (!o.dados) return;
    try {
      appendFileSync(join(o.dados, 'religar.log'), `[${(o.agora?.() ?? new Date()).toISOString()}] servidor: ${linha}\n`, 'utf8');
    } catch {
      // sem pasta de dados gravável, só o log do console
    }
  };

  // 1. O WMI cria o ajudante fora da árvore do servidor.
  const ps = `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ${literalPs(linhaDoAjudante(o))} }; if ($r.ReturnValue -ne 0) { Write-Error ("Win32_Process.Create devolveu " + $r.ReturnValue); exit 3 }; Write-Output $r.ProcessId`;
  const wmi = await rodar('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], 20_000);
  if (wmi.codigo === 0) {
    registrar(`ajudante de reinício lançado pelo WMI (PID ${wmi.stdout.trim() || '?'}): ele religa o servidor depois que este sair`);
    return 'wmi';
  }
  registrar(`o WMI não lançou o ajudante (código ${wmi.codigo}): ${(wmi.stderr || wmi.stdout).trim().slice(0, 300)}`);

  // 2. Plano B: o atualizador (tarefa do Agendador, fora desta árvore) religa o servidor que não responde.
  const nome = o.tarefaDoAtualizador ?? 'CYBERMECH atualizar';
  const tarefa = await rodar('schtasks.exe', ['/Run', '/TN', nome], 15_000);
  if (tarefa.codigo === 0) {
    registrar(`acionei a tarefa "${nome}": o vigia religa o servidor que não responde`);
    return 'atualizador';
  }
  registrar(`não consegui acionar a tarefa "${nome}" (código ${tarefa.codigo}): ${(tarefa.stderr || tarefa.stdout).trim().slice(0, 300)}; o vigia do atualizador (a cada 10 min) liga o servidor depois`);
  return null;
}
