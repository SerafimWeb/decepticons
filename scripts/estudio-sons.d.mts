import type { Server } from 'node:http';

export function criarEstudio(o: { raiz: string; origem: string; ffmpeg: string | undefined }): Server;
