export type Faixas = Readonly<Record<string, readonly [number, number]>>;
export function validarAjustesDoMovimento(entrada: unknown, faixas: Faixas): { ok: true; ajustes: Record<string, number> } | { ok: false; erro: string };
export function moduloMechs(o: { raiz: string; construir?: (c: { raiz: string; saida: string }) => Promise<void> }): {
  id: 'mechs';
  titulo: string;
  estado: () => unknown;
  rotas: (c: unknown) => Promise<boolean>;
  pastasDoGit: string[];
};
