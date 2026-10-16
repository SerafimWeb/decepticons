import type { Server } from 'node:http';

export function pendenciasDoGit(raiz: string, caminhos: readonly string[]): { git: boolean; arquivos: { situacao: string; arquivo: string }[] };
export function criarEstudio(o: { raiz: string; origem: string; ffmpeg: string | undefined; modulos?: readonly unknown[] }): Server;
