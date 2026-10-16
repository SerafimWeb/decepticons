import type { Server } from 'node:http';

export function ambienteSemGit(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export function pendenciasDoGit(raiz: string, caminhos: readonly string[]): { git: boolean; arquivos: { situacao: string; arquivo: string }[] };
export function criarEstudio(o: { raiz: string; origem: string; origemVozes?: string; ffmpeg: string | undefined; modulos?: readonly unknown[] }): Server;
