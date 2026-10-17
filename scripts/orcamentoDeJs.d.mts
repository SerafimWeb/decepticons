export const JS_PARTIDA_KB: number;
export const JS_SOB_DEMANDA_KB: number;
export function nomesCitados(codigo: string): string[];
export function importsEstaticos(codigo: string): string[];
export function entradaDoHtml(html: string): string | null;
export function chunksDePartida(codigos: Map<string, string>, entrada: string): Set<string>;
