export interface ConfigDoSite {
  host: string;
  user: string;
  port: number;
  path: string;
  key?: string | undefined;
  url?: string | undefined;
  gameServer?: string | undefined;
}
export function validarConfig(bruto: unknown): { ok: true; cfg: ConfigDoSite } | { ok: false; erros: string[] };
export interface Programa {
  programa: string;
  args: string[];
  cwd?: string;
}
export function comandosDeEnvio(
  cfg: ConfigDoSite,
  pastaDoSite: string,
): { empacotar: Programa; desempacotar: Programa; conferir: (arquivos: readonly string[]) => Programa };
export function lerSomas(saida: string): Record<string, string>;
export const ARQUIVOS_DE_CONFERENCIA: readonly string[];
export function compararSomas(local: Record<string, string>, remoto: Record<string, string>): { ok: boolean; diferentes: string[] };
export function devePublicar(head: string, publicado: string | null, seMudou: boolean): boolean;
