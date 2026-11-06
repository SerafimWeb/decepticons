export const MINUTOS_POR_FALA: number;

export interface RadioParaRoteiro {
  canais: Record<string, { rotulo: string; quem: string; efeito: string }>;
  estilos: Record<string, { intencao: string }>;
  falas: readonly {
    chave: string;
    canal: string;
    situacao: string;
    estilo: string;
    texto: string;
    nota?: string;
    cena?: string;
    turno?: number;
    gatilho: string;
  }[];
}

export function renderizarRoteiro(radio: RadioParaRoteiro, narrador?: { falas: readonly { chave: string; estilo: string; texto: Record<string, string> }[] } | null): string;
