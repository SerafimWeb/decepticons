// Tipos do que o teste (`server/idiomaLanding.test.ts`) usa do módulo da landing (o resto é a página, só no navegador).
export const IDIOMAS: ReadonlyArray<{ id: string; nome: string; html: string }>;
export const CHAVE_IDIOMA: string;
export function idiomaInicial(search: string, salvo: string | null, navegador: string | undefined, automatizado: boolean): string;
export function criarTradutor(dic: Readonly<Record<string, string>> | null): (texto: string) => string;
