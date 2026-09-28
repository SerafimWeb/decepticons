/** Modos que a simulação entende. Sobrevivência estreia offline; o servidor continua em deathmatch. */
export type GameMode = 'deathmatch' | 'survival' | 'ctf';

/** Lê o modo do link sem depender de DOM, para o mesmo contrato funcionar em testes e no servidor. */
export function gameModeFromSearch(search: string): GameMode {
  const value = new URLSearchParams(search).get('modo');
  if (value === 'ctf') return 'ctf';
  return value === 'survival' || value === 'sobrevivencia' ? 'survival' : 'deathmatch';
}
