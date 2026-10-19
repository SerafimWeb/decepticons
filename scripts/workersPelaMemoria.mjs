import { execFileSync } from 'node:child_process';

/** Quanto de memória cada worker do Vitest costuma pedir (three.js, Rapier e a cena de teste): o que sobra define quantos cabem. */
export const MB_POR_WORKER = 700;

/** Quanto da memória virtual livre (o teto do Windows: RAM + arquivo de paginação) os workers podem pedir; o resto fica para o sistema e para as outras sessões. */
export const FOLGA_DA_MEMORIA_VIRTUAL = 0.6;

/** O teto de `CYBERMECH_WORKERS` (mais que isto não ajuda a bateria e só pede memória). */
export const WORKERS_MAXIMO = 16;

/**
 * Quantos workers do Vitest cabem na memória livre agora, ou `null` para deixar o Vitest escolher (memória de sobra: o CI, uma máquina folgada).
 * Na máquina do dono (6 GB, três agentes e navegadores) a memória livre chega a 400 MB e o gate do push morria com "Fatal process out of memory: Zone"
 * (13/10, duas vezes seguidas); com 2 workers a bateria passa, só mais devagar. Nunca menos que 2 — **a não ser que a memória virtual do Windows esteja quase
 * no teto** (19/10: seis sessões do Claude Code abertas, cada uma com os servidores MCP da Hostinger, deixaram 2 GB livres de 24: com 2 workers dez arquivos
 * morreram com `0xC0000409` e o push foi barrado duas vezes): aí um worker só.
 * @param {number} livreBytes memória física livre
 * @param {number} nucleos
 * @param {number | null} [virtualLivreBytes] memória virtual livre (`null` = não se sabe: Linux, o CI)
 */
export function workersPelaMemoria(livreBytes, nucleos, virtualLivreBytes = null) {
  const padrao = Math.max(1, nucleos - 1);
  const porFisica = Math.floor(livreBytes / (MB_POR_WORKER * 1024 * 1024));
  const porVirtual = virtualLivreBytes === null ? Number.POSITIVE_INFINITY : Math.floor((virtualLivreBytes * FOLGA_DA_MEMORIA_VIRTUAL) / (MB_POR_WORKER * 1024 * 1024));
  const cabem = Math.min(porFisica, porVirtual);
  if (cabem >= padrao) return null;
  const piso = porVirtual < 2 ? 1 : 2;
  return Math.max(piso, cabem);
}

/** `CYBERMECH_WORKERS=1`: o jogador de máquina apertada força o número de workers. `null` se não veio, ou veio fora de 1 a `WORKERS_MAXIMO` (inteiro). */
export function workersForcados(valor) {
  if (typeof valor !== 'string') return null;
  const t = valor.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= WORKERS_MAXIMO ? n : null;
}

/**
 * A memória virtual livre em bytes (o que o Windows ainda deixa os programas pedirem: RAM + paginação − o já comprometido), ou `null` onde não se sabe (Linux, o CI, ou o
 * PowerShell não respondeu em 5 s). Custa ~0,6 s: roda uma vez por `npm test`.
 */
export function memoriaVirtualLivre() {
  if (process.platform !== 'win32') return null;
  try {
    const saida = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', '(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    const kb = Number.parseInt(saida.trim(), 10);
    return Number.isFinite(kb) && kb >= 0 ? kb * 1024 : null;
  } catch {
    return null;
  }
}
