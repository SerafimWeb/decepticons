export interface DecisaoDeCi {
  provado: boolean;
  motivo: string;
}
export function decidirJaProvado(fatos: { evento: string; arvore: string; arvoreDoPai2: string; rodadasVerdesDoPai2: number }): DecisaoDeCi;
export function avaliar(
  entrada: { evento: string; sha: string },
  executores?: { executarGit?: (args: string[]) => string; executarGh?: (args: string[]) => string },
): DecisaoDeCi;
