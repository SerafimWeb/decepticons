export interface Resultado {
  status: number | null;
  stdout?: string;
  stderr?: string;
}

export interface Operacoes {
  git(...args: string[]): Resultado;
  /** Executa o comando e devolve o código de saída. */
  executar(comando: string, args: string[]): number | null;
  log(linha: string): void;
  nodeModulesEhAtalho(): boolean;
  /** true = o servidor parou de verdade (a porta está livre); false = não saiu, e o atualizador não mexe nas dependências. */
  pararServidor(): boolean;
  ligarServidor(): void;
  /** A verificação que uma rodada anterior (cortada pelo limite de tempo do Agendador) não terminou, ou null. */
  lerPendencia(): Pendencia | null;
  gravarPendencia(p: Pendencia): void;
  limparPendencia(): void;
  /** Grava o marcador de reinício pendente (o que o `atualizar-e-reiniciar.ps1` apaga quando o servidor responde). Chamado ao passar na verificação, antes de qualquer outra coisa. */
  marcarReinicio(): void;
}

/** `de` = o último código verificado (para onde voltar se falhar), `para` = o puxado, `feito` = passos já concluídos ('typecheck'). */
export interface Pendencia {
  de: string;
  para: string;
  feito: string[];
}

/** 0 = atualizou e verificou; 1 = nada novo; 2 = recusou ou falhou (e voltou ao anterior). */
export function atualizar(op: Operacoes): 0 | 1 | 2;

/** As últimas `n` linhas de uma saída de comando, sem as cores do terminal e sem linhas vazias (o que o atualizador grava no log quando a verificação falha). */
export function ultimasLinhas(texto: string, n: number): string;
