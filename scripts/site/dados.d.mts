// Tipos do que `server/ritmoDeConteudo.test.ts` usa de `dados.mjs` (o resto do módulo não tem tipo: é montagem de página).
export function conteudoPorSemana(hoje?: Date): {
  unidades: Array<{ id: string; tipo: 'arma' | 'chassi'; data: string }>;
  semanas: Array<{ segunda: string; n: number; ids: string[] }>;
  total: number;
  media4: number;
};
