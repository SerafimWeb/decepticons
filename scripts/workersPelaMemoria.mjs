/** Quanto de memória cada worker do Vitest costuma pedir (three.js, Rapier e a cena de teste): o que sobra define quantos cabem. */
export const MB_POR_WORKER = 700;

/**
 * Quantos workers do Vitest cabem na memória livre agora, ou `null` para deixar o Vitest escolher (memória de sobra: o CI, uma máquina folgada).
 * Na máquina do dono (6 GB, três agentes e navegadores) a memória livre chega a 400 MB e o gate do push morria com "Fatal process out of memory: Zone"
 * (13/10, duas vezes seguidas); com 2 workers a bateria passa, só mais devagar. Nunca menos que 2.
 * @param {number} livreBytes
 * @param {number} nucleos
 */
export function workersPelaMemoria(livreBytes, nucleos) {
  const padrao = Math.max(1, nucleos - 1);
  const cabem = Math.floor(livreBytes / (MB_POR_WORKER * 1024 * 1024));
  return cabem >= padrao ? null : Math.max(2, cabem);
}
