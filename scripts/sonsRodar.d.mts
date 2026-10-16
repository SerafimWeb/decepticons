import type { MapaDeSons, SomDeArma } from './sonsLib.mjs';

export function acharFfmpeg(): string | undefined;
export function duracaoDoArquivo(ffmpeg: string, arquivo: string): number;
export type ResultadoDoSom =
  | { ok: true; destino: string; duracao: number; picoDb: number; mediaDb: number; ganhoDb: number; kb: number }
  | { ok: false; erro: string };
export function processarSom(o: { ffmpeg: string; origem: string; destinoDir: string; mapa: MapaDeSons; som: SomDeArma }): ResultadoDoSom;
