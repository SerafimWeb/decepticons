/**
 * A REDE DE SEGURANÇA DO PROCESSO (P239): uma promessa que falha e ninguém trata não derruba mais o servidor de todo mundo.
 *
 * O Node, por padrão, mata o processo numa rejeição não tratada. Em 21/10 foi assim que uma sala que não abriu (o `import()` de um mapa) tirou a produção do ar, e quem religa o servidor
 * é uma tarefa que passa a cada 10 min: uma falha de uma conexão virava até 10 min de jogo fora do ar para todos. Agora a rejeição é **registrada com a pilha** e o servidor segue.
 *
 * Duas decisões, e por quê:
 * - **Só a rejeição é perdoada.** Uma exceção síncrona não capturada (`uncaughtException`) deixa o processo em estado desconhecido: continua com o comportamento do Node (cai e é religado). Rejeição é uma
 *   operação assíncrona isolada que falhou; o estado do resto do servidor não foi tocado por ela.
 * - **Tempestade derruba, de propósito.** Mais de `MAX_POR_JANELA` rejeições na janela de 1 min não é um acaso: algo está quebrado de forma sistemática, e continuar serviria um servidor pela metade.
 *   O processo sai com código 1 e é religado limpo.
 *
 * Custo: nenhum no tick (só roda quando algo já falhou).
 */

/** Rejeições toleradas na janela; acima disso o processo sai para ser religado limpo. */
export const MAX_POR_JANELA = 10;
/** A janela (ms) em que as rejeições são contadas. */
export const JANELA_MS = 60_000;

/** O que a rede precisa do `process` (a interface mínima: o teste passa um falso). */
export interface ProcessoParaARede {
  on(evento: 'unhandledRejection', ouvinte: (motivo: unknown) => void): unknown;
  exit(codigo: number): unknown;
}

/** O texto que vai para o registro: a mensagem e a primeira linha da pilha, sem quebrar o registro de uma linha só. */
export function descreverFalha(motivo: unknown): string {
  if (motivo instanceof Error) {
    const onde = motivo.stack?.split('\n').find((l) => l.trim().startsWith('at '))?.trim();
    return onde ? `${motivo.message} (${onde})` : motivo.message;
  }
  return String(motivo);
}

/**
 * Liga a rede. `dizer` escreve no registro do servidor; `erro` (padrão `console.error`) leva a pilha inteira ao `servidor.log`, onde o dono procura a causa;
 * `agora` é o relógio (o teste o controla).
 */
export function instalarRedeDeSeguranca(
  proc: ProcessoParaARede,
  dizer: (linha: string) => void,
  erro: (...args: unknown[]) => void = console.error,
  agora: () => number = Date.now,
): void {
  let instantes: number[] = [];
  proc.on('unhandledRejection', (motivo) => {
    const t = agora();
    instantes = instantes.filter((x) => t - x < JANELA_MS);
    instantes.push(t);
    dizer(`[servidor] rejeição não tratada (${instantes.length} no último minuto), o servidor segue: ${descreverFalha(motivo)}`);
    erro('[servidor] rejeição não tratada:', motivo);
    if (instantes.length > MAX_POR_JANELA) {
      dizer(`[servidor] mais de ${MAX_POR_JANELA} rejeições em 1 min: algo está quebrado de forma sistemática; saindo para ser religado limpo`);
      proc.exit(1);
    }
  });
}
