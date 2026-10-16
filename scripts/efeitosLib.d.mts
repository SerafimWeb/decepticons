export interface Efeitos {
  velocidade?: number;
  pitch_st?: number;
  graves_db?: number;
  agudos_db?: number;
  passa_alta_hz?: number;
  passa_baixa_hz?: number;
  ruido_db?: number;
  saturacao?: number;
  compressor?: 'leve' | 'medio' | 'forte' | 0;
  eco_ms?: number;
  eco_decay?: number;
  reverso?: boolean;
  fade_in_ms?: number;
}

export interface CapacidadesDoFfmpeg {
  rubberband: boolean;
}

export const LIMITES: Readonly<Record<string, readonly [number, number]>>;
export const COMPRESSORES: Readonly<Record<'leve' | 'medio' | 'forte', string>>;
export function validarEfeitos(e: unknown, quem?: string): string[];
export function velocidadeDe(clip: { efeitos?: Efeitos }): number;
export function duracaoFinal(clip: { de: number; ate: number; efeitos?: Efeitos }): number;
export function passosDeAtempo(fator: number): number[];
export function filtroDeTempoETom(velocidade: number, pitchSt: number, rubberband: boolean): string[];
export function filtrosDeEfeitos(e?: Efeitos, caps?: CapacidadesDoFfmpeg): string[];
export function resumoDosEfeitos(e?: Efeitos): string[];
