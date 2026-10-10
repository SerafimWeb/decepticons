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
}

/** `de` = o último código verificado (para onde voltar se falhar), `para` = o puxado, `feito` = passos já concluídos ('typecheck'). */
export interface Pendencia {
  de: string;
  para: string;
  feito: string[];
}

/** 0 = atualizou e verificou; 1 = nada novo; 2 = recusou ou falhou (e voltou ao anterior). */
export function atualizar(op: Operacoes): 0 | 1 | 2;
