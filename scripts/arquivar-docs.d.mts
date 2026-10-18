export interface Saida {
  chave: string;
  texto: string;
}
/** A data `dd/mm` mais recente de um título, como `AAAA-MM-DD` (o ano vem do corte), ou `null`. */
export function dataDoTitulo(titulo: string, corte: string): string | null;
/** O arquivo em que um dia cai: `2026-10-a` (dias 1 a 15) ou `2026-10-b` (16 em diante). */
export function quinzena(dia: string): string;
export function dividirEstado(texto: string, manterAPartirDe: string): { fica: string; saem: Saida[] };
export function dividirHistorico(texto: string, manterAPartirDe: string): { fica: string; saem: Saida[] };
export function agrupar(saem: Saida[]): Map<string, string>;
export function acrescentar(existente: string, novo: string, cabecalho: string): string;
