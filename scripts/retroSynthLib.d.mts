export const TAXA: number;
export const ESTILOS: readonly string[];

export interface Receita {
  id: string;
  arma: string | null;
  uso: string;
  referencia: string;
  /** Trilha: passa do limite de 1,5 s dos sons de efeito (até 12 s). */
  longa?: boolean;
  gerar(estilo: string): Float32Array;
}

export const RECEITAS: readonly Receita[];
export function renderizar(receita: Receita, estilo: string): Float32Array;
export const nomeDoArquivo: (receita: Receita, estilo: string) => string;
export function emWav(x: Float32Array): Buffer;
export function normalizar(x: Float32Array, picoDb?: number): Float32Array;
export function fade(x: Float32Array, entradaMs?: number, saidaMs?: number): Float32Array;
export function somar(camadas: { x: Float32Array; atraso?: number; ganho?: number }[]): Float32Array;
export function bitcrush(x: Float32Array, bits: number, segura?: number): Float32Array;
export function distorcer(x: Float32Array, ganho: number): Float32Array;
export function passaBaixa(x: Float32Array, fc: number | ((t: number) => number)): Float32Array;
export function passaAlta(x: Float32Array, fc: number): Float32Array;
export function eco(x: Float32Array, ms: number, fb: number, mix: number): Float32Array;
export function voz(o: { dur: number; onda?: 'pulse' | 'tri' | 'saw' | 'sine'; duty?: number; freq: number | ((t: number) => number); amp?: (t: number) => number }): Float32Array;
export function ruido(o: { dur: number; hz?: number | ((t: number) => number); modo?: 'longo' | 'curto'; amp?: (t: number) => number }): Float32Array;
export const decaimento: (tau: number) => (t: number) => number;
export const ataqueDecaimento: (ataque: number, tau: number) => (t: number) => number;
export const varredura: (f0: number, f1: number, dur: number) => (t: number) => number;
