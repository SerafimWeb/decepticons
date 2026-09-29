/** Modos que a simulação entende. Sobrevivência estreia offline; o servidor continua em deathmatch. */
export type GameMode = 'deathmatch' | 'survival' | 'ctf';

/** Lê o modo do link sem depender de DOM, para o mesmo contrato funcionar em testes e no servidor. */
export function gameModeFromSearch(search: string): GameMode {
  const value = new URLSearchParams(search).get('modo');
  if (value === 'ctf') return 'ctf';
  return value === 'survival' || value === 'sobrevivencia' ? 'survival' : 'deathmatch';
}

/**
 * Atalho de bancada `?onda=N` (1 a `waves`): começa a missão na onda pedida, para ver o **encontro com o
 * Colossus-01** sem vencer as cinco ondas antes. É da mesma família do `?potencias=` e do `?build=`: não
 * muda regra nenhuma — a onda começa inteira, com o pool normal.
 */
export function waveFromSearch(search: string, waves: number): number {
  const value = Number(new URLSearchParams(search).get('onda'));
  if (!Number.isFinite(value)) return 1;
  return Math.min(waves, Math.max(1, Math.trunc(value)));
}
