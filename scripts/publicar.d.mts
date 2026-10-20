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
  /** O CI do GitHub não roda (sem cota ou sem pagamento): não o espera; vale o `npm run check` do hook do push, e o PR só precisa estar CLEAN ou UNSTABLE. */
  semCi?: boolean;
}

export function publicar(ops: OperacoesPublicar, opcoes: OpcoesPublicar): Promise<{ ok: boolean; motivo?: string; pr?: number; merge?: string }>;

/** O ambiente do `git push`: com `--sem-ci` liga `CYBERMECH_CHECK_COMPLETO` (o hook não pula o check da junção sem o CI). */
export function ambienteDoPush(semCi: boolean, base?: Record<string, string | undefined>): Record<string, string | undefined>;
