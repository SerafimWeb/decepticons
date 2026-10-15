export const SOTAQUES: readonly string[];
export const API: string;

export interface FalaDoCatalogo {
  chave: string;
  estilo: string;
  texto: Record<string, string>;
}

export interface ConfigDeVozes {
  vozes: Record<string, { voz?: string; descricao?: string }>;
  saida?: string;
}

export interface ItemDoPlano {
  sotaque: string;
  chave: string;
  texto: string;
  estilo: string;
  voz: string;
}

export interface Plano {
  fazer: ItemDoPlano[];
  pulados: { sotaque: string; chave: string; motivo: string }[];
  caracteres: number;
}

export function planejar(o: {
  falas: readonly FalaDoCatalogo[];
  config: ConfigDeVozes;
  existentes: ReadonlySet<string>;
  sotaques?: readonly string[];
  so?: readonly string[] | null;
  refazer?: boolean;
}): Plano;

export function montarManifesto(arquivos: Record<string, readonly string[]>, falas: readonly FalaDoCatalogo[], nota: string): Record<string, unknown>;

export function sintetizar(o: {
  fetchFn: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
  }>;
  chaveApi: string;
  voz: string;
  texto: string;
  estilo: string;
  modelo: string;
  saida: string;
  estilos: Record<string, unknown>;
}): Promise<Uint8Array>;

export function resumoDoPlano(plano: Plano): string;
export function linhasDeVozes(resposta: { voices?: { voice_id: string; name?: string; category?: string; labels?: Record<string, string> }[] } | null | undefined): string[];
