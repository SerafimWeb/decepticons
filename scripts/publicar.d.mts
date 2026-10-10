export interface RespostaComando {
  status: number;
  stdout: string;
  stderr?: string;
}

export interface OperacoesPublicar {
  git(args: string[]): RespostaComando;
  gh(args: string[]): RespostaComando;
  /** `git push -u origin <branch>` (o hook roda o check); devolve o código de saída. */
  empurrar(branch: string): number;
  dormir(ms: number): Promise<void>;
  log(linha: string): void;
}

export interface OpcoesPublicar {
  titulo?: string;
  /** Arquivo com a descrição do PR. */
  corpo?: string;
  /** Só abre o PR; não espera o CI nem mergeia. */
  soPr?: boolean;
}

export function publicar(ops: OperacoesPublicar, opcoes: OpcoesPublicar): Promise<{ ok: boolean; motivo?: string; pr?: number; merge?: string }>;
