export interface AlvoDeNivel {
  media_db: number;
  pico_db: number;
}

export interface SomDeArma {
  destino: string;
  fonte: string;
  de: number;
  ate: number;
  fade_ms: number;
  arma?: string;
  nota?: string;
}

export interface MapaDeSons {
  alvo: AlvoDeNivel;
  sons: SomDeArma[];
}

export function validarMapa(mapa: MapaDeSons): string[];
export function ganhoParaAlvo(mediaDb: number, picoDb: number, alvo: AlvoDeNivel): number;
export function argsDoFfmpeg(s: SomDeArma, entrada: string, saida: string, ganhoDb: number, alvo: AlvoDeNivel): string[];
export function argsDaMedicao(s: SomDeArma, entrada: string): string[];
export function lerMedicao(texto: string): { picoDb: number; mediaDb: number } | null;
