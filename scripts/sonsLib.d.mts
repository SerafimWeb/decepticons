import type { CapacidadesDoFfmpeg, Efeitos } from './efeitosLib.mjs';

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
  /** Ganho extra (dB) por cima da normalização: o limitador de pico segura o excesso. */
  ganho_db?: number;
  /** Efeitos do clipe (tom, velocidade, compressor...): `efeitosLib.mjs`. */
  efeitos?: Efeitos;
  arma?: string;
  nota?: string;
}

export interface MapaDeSons {
  alvo: AlvoDeNivel;
  sons: SomDeArma[];
}

export interface ArmaComSom {
  clipe: string;
  ganho: number;
  pitch: number;
  maxS: number;
}

export function validarMapa(mapa: MapaDeSons): string[];
export function validarArmas(armas: Record<string, ArmaComSom>, idsConhecidos: readonly string[], clipes: readonly string[], duracaoDe?: (clipe: string) => number): string[];
export function ganhoParaAlvo(mediaDb: number, picoDb: number, alvo: AlvoDeNivel): number;
export function cadeiaBase(s: SomDeArma, caps?: CapacidadesDoFfmpeg): string[];
export function argsDoFfmpeg(s: SomDeArma, entrada: string, saida: string, ganhoDb: number, alvo: AlvoDeNivel, caps?: CapacidadesDoFfmpeg): string[];
export function argsDaMedicao(s: SomDeArma, entrada: string, caps?: CapacidadesDoFfmpeg): string[];
export function lerMedicao(texto: string): { picoDb: number; mediaDb: number } | null;
