export interface ArquivoDiferente {
  caminho: string;
  naJuncao: string | null;
  noSegundoPai: string | null;
}
export interface DecisaoDeJuncao {
  pular: boolean;
  motivo: string;
}
export function decidirJuncao(fatos: { ehJuncao: boolean; primeiroPaiVerificado: boolean; segundoPaiNaMain: boolean; diferentes: ArquivoDiferente[] }): DecisaoDeJuncao;
export function avaliarJuncao(
  sha: string,
  opcoes: {
    raiz: string;
    executar?: (args: string[]) => { status: number; saida: string };
    existe?: (caminho: string) => boolean;
  },
): DecisaoDeJuncao;
